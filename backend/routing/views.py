import logging
import os
import threading
from copy import deepcopy
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.cache import caches
from django.http import FileResponse, JsonResponse
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import exception_handler as drf_exception_handler

from .providers import ProviderError, geocode
from .serializers import LoadSerializer, TripSerializer
from .service import DEMO_DESTINATION, DEMO_ORIGIN, analyze_trip, reassess_load

logger = logging.getLogger(__name__)
ANALYSIS_LOCK = threading.BoundedSemaphore(2)


class ReassessmentThrottle(AnonRateThrottle):
    scope = "cargo_reassessment"
    rate = "60/minute"


class AnalysisThrottle(AnonRateThrottle):
    # A separate cache scope prevents city searches from consuming trip quota.
    scope = "live_analysis"
    rate = "4/minute"

    def allow_request(self, request, view):
        # The offline scenario never calls paid/free-quota weather providers.
        # Keep the shared concurrency bound, but do not interrupt exploration.
        if isinstance(request.data, dict) and request.data.get("mode") == "demo":
            return True
        return super().allow_request(request, view)


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is not None:
        if isinstance(exc, Throttled):
            wait = int(exc.wait or 1)
            response.data = {
                "error": f"Please wait {wait} seconds before making another live request. Your current results are still available.",
                "retry_after_seconds": wait,
            }
        else:
            response.data = {
                "error": "Please check your request or try again later.",
                "details": response.data,
            }
    return response


def health(request):
    return JsonResponse({"status": "ok", "service": "weather-aware-routing"})


@api_view(["GET"])
def configuration(request):
    return Response(
        {
            "routing_provider": "TomTom truck" if os.getenv("TOMTOM_API_KEY") else "OSRM car",
            "demo_origin": DEMO_ORIGIN,
            "demo_destination": DEMO_DESTINATION,
        }
    )


@api_view(["GET"])
def locations(request):
    query = request.query_params.get("q", "").strip()
    if not 2 <= len(query) <= 100:
        return Response({"error": "Enter between 2 and 100 characters."}, status=400)
    try:
        return Response({"results": geocode(query)})
    except ProviderError as exc:
        return Response({"error": str(exc)}, status=502)


@api_view(["POST"])
@throttle_classes([AnalysisThrottle])
def analyze(request):
    serializer = TripSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if not ANALYSIS_LOCK.acquire(blocking=False):
        return Response(
            {"error": "Two trips are already being analyzed. Please try again shortly."}, status=503
        )
    try:
        result = analyze_trip(serializer.validated_data)
        result["analysis_id"] = str(uuid4())
        caches["analyses"].set(result["analysis_id"], result)
        return Response(result)
    except ProviderError as exc:
        return Response({"error": str(exc)}, status=502)
    except Exception:
        # No exception bodies/URLs: credentials may appear inside provider errors.
        logger.error("Unexpected trip-analysis error; inspect local tests and provider response contracts.")
        return Response({"error": "The trip could not be analyzed. Please try again."}, status=500)
    finally:
        ANALYSIS_LOCK.release()


@api_view(["POST"])
@throttle_classes([ReassessmentThrottle])
def reassess(request):
    serializer = LoadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    analysis_id = str(serializer.validated_data["analysis_id"])
    stored = caches["analyses"].get(analysis_id)
    if stored is None:
        return Response(
            {
                "error": "This trip has expired. Analyze it again to refresh the forecast.",
                "code": "analysis_expired",
            },
            status=410,
        )
    return Response(reassess_load(deepcopy(stored), serializer.validated_data["load_lb"]))


def index(request):
    path = Path(settings.BASE_DIR) / "frontend/dist/index.html"
    if not path.exists():
        return JsonResponse({"error": "Build the frontend first: cd frontend && npm run build"}, status=503)
    response = FileResponse(path.open("rb"), content_type="text/html")
    response["Cache-Control"] = "no-store"
    return response
