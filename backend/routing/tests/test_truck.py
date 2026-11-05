from copy import deepcopy
from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core.cache import caches
from rest_framework.test import APIClient

from routing import providers
from routing.serializers import TripSerializer
from routing.service import DEMO_DESTINATION, DEMO_ORIGIN, analyze_trip, reassess_load
from routing.vehicle import gross_weight_lb, truck_parameters

TRUCK = {
    "empty_weight_lb": 32000,
    "height_ft": 13.5,
    "width_ft": 8.5,
    "length_ft": 70,
    "max_axle_weight_lb": 17000,
    "axles": 5,
    "non_hazardous": True,
}


@pytest.fixture(autouse=True)
def clean_caches():
    caches["default"].clear()
    caches["analyses"].clear()


def payload():
    return {
        "mode": "live",
        "origin": DEMO_ORIGIN,
        "destination": DEMO_DESTINATION,
        "departure": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        "load_lb": 28000,
        "spacing_miles": 25,
        "vehicle": deepcopy(TRUCK),
    }


def test_truck_routes_require_an_explicit_profile():
    data = payload()
    data.pop("vehicle")
    response = APIClient().post("/api/analyze/", data, format="json")
    assert response.status_code == 400
    assert "vehicle" in response.json()["details"]


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("height_ft", 0),
        ("width_ft", float("nan")),
        ("length_ft", float("inf")),
        ("empty_weight_lb", -1),
        ("max_axle_weight_lb", 0),
        ("axles", 2.5),
        ("max_axle_weight_lb", 100000),
        ("max_axle_weight_lb", 100),
        ("non_hazardous", False),
    ],
)
def test_invalid_vehicle_cannot_generate_a_route(field, value):
    data = payload()
    data["vehicle"][field] = value
    assert not TripSerializer(data=data).is_valid()


def test_weight_uses_empty_combination_plus_cargo_and_rounds_up():
    assert gross_weight_lb(TRUCK, 28000) == 60000
    params = truck_parameters(TRUCK, 28000)
    assert params["vehicleWeight"] == 27216
    assert params["vehicleHeight"] == 4.12
    assert params["vehicleAxleWeight"] == 7712
    # Increasing cargo changes provider restrictions, not just weather risk.
    assert truck_parameters(TRUCK, 45000)["vehicleWeight"] > params["vehicleWeight"]


def test_missing_truck_provider_never_falls_back_to_a_car(monkeypatch):
    monkeypatch.delenv("TOMTOM_API_KEY", raising=False)
    trip = TripSerializer(data=payload())
    trip.is_valid(raise_exception=True)
    with (
        patch.object(providers, "osrm_routes", side_effect=AssertionError("No car fallback")),
        patch.object(providers.CLIENT, "get", side_effect=AssertionError("No request without a key")),
    ):
        with pytest.raises(providers.ProviderError, match="not connected"):
            analyze_trip(trip.validated_data)


def test_configuration_reports_unavailable_without_exposing_key(monkeypatch):
    monkeypatch.delenv("TOMTOM_API_KEY", raising=False)
    config = APIClient().get("/api/config/").json()
    assert not config["truck_routing_available"]
    monkeypatch.setenv("TOMTOM_API_KEY", "fake-private-key")
    config = APIClient().get("/api/config/").json()
    assert config["truck_routing_available"]
    assert "fake-private-key" not in str(config)


def test_live_cargo_changes_require_new_roads():
    analysis_id = str(uuid4())
    stored = {"mode": "live", "load_lb": 28000}
    caches["analyses"].set(analysis_id, stored)
    with patch.object(providers.CLIENT, "get", side_effect=AssertionError("No request")):
        response = APIClient().post(
            "/api/reassess/", {"analysis_id": analysis_id, "load_lb": 45000}, format="json"
        )
        assert response.status_code == 409
        assert response.json()["code"] == "route_recheck_required"
        with pytest.raises(providers.ProviderError):
            reassess_load(deepcopy(stored), 45000)
    assert caches["analyses"].get(analysis_id) == stored


def test_new_departure_rechecks_truck_access_and_weights():
    analysis_id = str(uuid4())
    data = payload()
    epoch = datetime.fromisoformat(data["departure"]).timestamp()
    stored = {**data, "_base_departure_epoch": epoch}
    caches["analyses"].set(analysis_id, stored)
    with patch(
        "routing.views.analyze_trip", return_value={"mode": "live", "routing_profile": "truck"}
    ) as analyze:
        response = APIClient().post(
            "/api/departure/",
            {"analysis_id": analysis_id, "offset_hours": 2, "load_lb": 45000},
            format="json",
        )
    assert response.status_code == 200, response.data
    trip = analyze.call_args.args[0]
    assert trip["departure"].timestamp() == epoch + 7200
    assert trip["load_lb"] == 45000
    assert trip["vehicle"] == TRUCK
    assert caches["analyses"].get(analysis_id) == stored


def test_demo_is_never_marked_as_truck_access_checked():
    data = payload()
    data["mode"] = "demo"
    trip = TripSerializer(data=data)
    trip.is_valid(raise_exception=True)
    with patch.object(providers.CLIENT, "get", side_effect=AssertionError("Demo has no network")):
        result = analyze_trip(trip.validated_data)
    assert result["routing_profile"] == "weather_demo"
    assert result["vehicle"] is None
    assert "Do not navigate" in result["notices"][0]


def test_live_departures_are_limited_even_if_client_claims_demo():
    analysis_id = str(uuid4())
    data = payload()
    stored = {**data, "_base_departure_epoch": datetime.fromisoformat(data["departure"]).timestamp()}
    caches["analyses"].set(analysis_id, stored)
    request = {"analysis_id": analysis_id, "offset_hours": 0, "load_lb": 28000, "mode": "demo"}
    with patch("routing.views.analyze_trip", return_value={"mode": "live"}):
        for _ in range(4):
            assert APIClient().post("/api/departure/", request, format="json").status_code == 200
        assert APIClient().post("/api/departure/", request, format="json").status_code == 429
