import logging
import os
import threading
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, JsonResponse
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import exception_handler as drf_exception_handler

from .providers import ProviderError, geocode
from .serializers import TripSerializer
from .service import DEMO_DESTINATION, DEMO_ORIGIN, analyze_trip

logger = logging.getLogger(__name__)
ANALYSIS_LOCK = threading.BoundedSemaphore(2)


class AnalysisThrottle(AnonRateThrottle):
    rate = "4/minute"


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is not None:
        response.data = {"error": "Please check your request or try again later.", "details": response.data}
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
        return Response(analyze_trip(serializer.validated_data))
    except ProviderError as exc:
        return Response({"error": str(exc)}, status=502)
    except Exception:
        # No exception bodies/URLs: credentials may appear inside provider errors.
        logger.error("Unexpected trip-analysis error; inspect local tests and provider response contracts.")
        return Response({"error": "The trip could not be analyzed. Please try again."}, status=500)
    finally:
        ANALYSIS_LOCK.release()


def index(request):
    path = Path(settings.BASE_DIR) / "frontend/dist/index.html"
    if not path.exists():
        return JsonResponse({"error": "Build the frontend first: cd frontend && npm run build"}, status=503)
    return FileResponse(path.open("rb"), content_type="text/html")
