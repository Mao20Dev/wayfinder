import copy
import gzip
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from routing import providers
from routing.serializers import TripSerializer
from routing.service import DEMO_DESTINATION, DEMO_ORIGIN, analyze_trip


@pytest.fixture(autouse=True)
def clean_cache():
    cache.clear()


def payload(mode="demo"):
    return {
        "mode": mode,
        "origin": DEMO_ORIGIN,
        "destination": DEMO_DESTINATION,
        "departure": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        "load_lb": 28000,
        "spacing_miles": 25,
    }


def recorded_routes():
    return json.loads((Path(__file__).parents[1] / "fixtures/demo_routes.json").read_text())["routes"]


def test_demo_full_pipeline_no_network():
    with patch.object(
        providers.CLIENT, "get", side_effect=AssertionError("Demo must not make network calls")
    ):
        response = APIClient().post("/api/analyze/", payload(), format="json")
    assert response.status_code == 200, response.data
    data = response.json()
    assert len(data["routes"]) == 3
    assert data["mode"] == "demo"
    assert data["weather_provider"] == "Synthetic scenario"
    assert data["recommendation"]["route_id"]
    assert len(data["corridor"][0]["hours"]) == 49
    for route in data["routes"]:
        assert sum(route["summary"]["miles_by_risk"]) == pytest.approx(route["distance_miles"])
        assert route["checkpoints"][0]["mile"] == 0
        assert route["checkpoints"][-1]["mile"] == route["distance_miles"]


def test_analysis_response_is_compressed_for_browser():
    response = APIClient().post("/api/analyze/", payload(), format="json", HTTP_ACCEPT_ENCODING="gzip")
    assert response.status_code == 200
    assert response["Content-Encoding"] == "gzip"
    decoded = gzip.decompress(response.content)
    assert len(response.content) < len(decoded) * 0.3
    assert json.loads(decoded)["mode"] == "demo"


def test_missing_live_forecasts_exclude_recommendation(monkeypatch):
    monkeypatch.delenv("TOMTOM_API_KEY", raising=False)
    trip = TripSerializer(data=payload("live"))
    assert trip.is_valid(), trip.errors
    with (
        patch.object(providers, "osrm_routes", return_value=copy.deepcopy(recorded_routes())),
        patch.object(providers, "forecast", return_value={}),
    ):
        result = analyze_trip(trip.validated_data)
    assert result["recommendation"]["route_id"] is None
    assert all(r["summary"]["status"] == "incomplete" for r in result["routes"])
    assert all(r["summary"]["unknown_miles"] > 0 for r in result["routes"])


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("load_lb", -1),
        ("load_lb", float("nan")),
        ("load_lb", float("inf")),
        ("spacing_miles", 12),
        ("mode", "pretend"),
        ("departure", "bad date"),
    ],
)
def test_invalid_trip_inputs(field, value):
    data = payload()
    data[field] = value
    assert not TripSerializer(data=data).is_valid()


def test_invalid_location_and_expired_departure():
    data = payload("live")
    data["departure"] = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    assert not TripSerializer(data=data).is_valid()
    data = payload()
    data["origin"] = {**DEMO_ORIGIN, "latitude": float("nan")}
    assert not TripSerializer(data=data).is_valid()
    data["origin"] = {**DEMO_ORIGIN, "timezone": "Not/AZone"}
    assert not TripSerializer(data=data).is_valid()


def test_provider_failures_do_not_expose_secrets(monkeypatch):
    monkeypatch.delenv("TOMTOM_API_KEY", raising=False)
    with patch.object(
        providers, "osrm_routes", side_effect=providers.ProviderError("Routing is temporarily unavailable.")
    ):
        response = APIClient().post("/api/analyze/", payload("live"), format="json")
    assert response.status_code == 502
    assert response.json() == {"error": "Routing is temporarily unavailable."}


def test_routes_do_not_fabricate_three_options(monkeypatch):
    monkeypatch.delenv("TOMTOM_API_KEY", raising=False)
    trip = TripSerializer(data=payload("live"))
    trip.is_valid(raise_exception=True)
    with (
        patch.object(providers, "osrm_routes", return_value=copy.deepcopy(recorded_routes()[:1])),
        patch.object(providers, "forecast", return_value={}),
    ):
        result = analyze_trip(trip.validated_data)
    assert len(result["routes"]) == 1
    assert any("1 distinct route" in n for n in result["notices"])


def test_health_search_validation_and_analysis_throttle():
    client = APIClient()
    assert client.get("/api/health/").json()["status"] == "ok"
    assert client.get("/api/locations/?q=a").status_code == 400
    for _ in range(4):
        client.post("/api/analyze/", {}, format="json")
    assert client.post("/api/analyze/", {}, format="json").status_code == 429
