from copy import deepcopy
from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core.cache import caches
from rest_framework.test import APIClient

from routing.departures import apply_departure, compare_departures
from routing.risk import classify, summarize
from routing.service import DEMO_DESTINATION, DEMO_ORIGIN, reassess_load


def forecast_trip(wind=46):
    base = int(datetime.now(UTC).timestamp() // 3600 * 3600) + 3600
    points = [
        {"id": "route-1-cp-0", "coordinates": [0, 0], "mile": 0, "eta_epoch": base, "geometry_index": 0},
        {
            "id": "route-1-cp-1",
            "coordinates": [1, 0],
            "mile": 10,
            "eta_epoch": base + 7200,
            "geometry_index": 0,
        },
    ]
    for point in points:
        point["weather"] = {"wind_mph": wind, "rain_in_hr": 0, "snow_in_hr": 0}
        point.update(classify(point["weather"], 45000))
    route = {
        "id": "route-1",
        "checkpoints": points,
        "coordinates": [[0, 0], [1, 0]],
        "distance_miles": 10,
        "duration_seconds": 7200,
    }
    route["summary"] = summarize(points, 10)
    hourly = {
        "time": [base + h * 3600 for h in range(28)],
        "wind_speed_10m": [(wind if h < 3 else 10) * 1.609344 for h in range(28)],
        "rain": [0] * 28,
        "showers": [0] * 28,
        "snowfall": [0] * 28,
    }
    return {
        "mode": "live",
        "load_lb": 45000,
        "departure_epoch": base,
        "forecast_reference_epoch": base,
        "_base_departure_epoch": base,
        "_forecasts": {(0, 0): {"hourly": hourly}, (1, 0): {"hourly": deepcopy(hourly)}},
        "routes": [route],
        "corridor": [],
    }


def test_departure_checks_arrival_weather_and_chooses_earliest_lowest_risk():
    trip = forecast_trip()
    with patch("routing.providers.CLIENT.get", side_effect=AssertionError("No provider calls")):
        result = compare_departures(trip)
    options = result["routes"]["route-1"]
    assert len(options["candidates"]) == 25
    assert options["candidates"][0]["summary"]["status"] == "blocked"
    assert options["best_offset_hours"] == 3
    assert options["tied_offsets"] == list(range(3, 25))


def test_missing_arrival_coverage_never_becomes_a_good_departure():
    trip = forecast_trip()
    trip["_forecasts"].pop((1, 0))
    options = compare_departures(trip)["routes"]["route-1"]
    assert options["best_offset_hours"] is None
    assert options["eligible_count"] == 0


def test_past_departures_are_excluded_even_when_their_risk_is_low():
    trip = forecast_trip(wind=10)
    options = compare_departures(trip, now=trip["departure_epoch"] + 3600)["routes"]["route-1"]
    assert options["candidates"][0]["available"] is False
    assert options["best_offset_hours"] == 1


def test_applying_a_departure_updates_eta_weather_segments_and_load_without_io():
    trip = forecast_trip()
    before = deepcopy(trip)
    with patch("routing.providers.CLIENT.get", side_effect=AssertionError("No provider calls")):
        shifted = reassess_load(apply_departure(deepcopy(trip), 3, 45000), 45000)
    assert shifted["departure_epoch"] == before["departure_epoch"] + 10800
    assert shifted["routes"][0]["checkpoints"][-1]["eta_epoch"] == before["departure_epoch"] + 5 * 3600
    assert shifted["routes"][0]["checkpoints"][0]["weather"]["wind_mph"] == pytest.approx(10)
    assert shifted["routes"][0]["segments"][0]["risk"] == 0
    assert shifted["recommendation"]["route_id"] == "route-1"
    assert shifted["departure_window"]["current_offset_hours"] == 3
    assert trip == before


def test_private_forecast_series_never_leave_the_api_and_new_analysis_is_cached():
    caches["default"].clear()
    caches["analyses"].clear()
    client = APIClient()
    response = client.post(
        "/api/analyze/",
        {
            "mode": "demo",
            "origin": DEMO_ORIGIN,
            "destination": DEMO_DESTINATION,
            "departure": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
            "load_lb": 28000,
            "spacing_miles": 25,
        },
        format="json",
    )
    assert response.status_code == 200
    original = response.json()
    assert not any(key.startswith("_") for key in original)
    assert original["departure_window"]["routes"]["route-1"]["candidates"]
    with patch("routing.providers.CLIENT.get", side_effect=AssertionError("No provider calls")):
        response = client.post(
            "/api/departure/",
            {"analysis_id": original["analysis_id"], "offset_hours": 2, "load_lb": 45000},
            format="json",
        )
    assert response.status_code == 200, response.data
    changed = response.json()
    assert changed["analysis_id"] != original["analysis_id"]
    assert changed["departure_epoch"] == original["departure_epoch"] + 7200
    assert changed["load_lb"] == 45000
    assert not any(key.startswith("_") for key in changed)
    assert caches["analyses"].get(original["analysis_id"])["departure_epoch"] == original["departure_epoch"]
    assert (
        client.post(
            "/api/reassess/", {"analysis_id": changed["analysis_id"], "load_lb": 28000}, format="json"
        ).json()["departure_epoch"]
        == changed["departure_epoch"]
    )


@pytest.mark.parametrize("offset", [-1, 25, 1.5, "bad"])
def test_departure_offsets_are_bounded_integer_hours(offset):
    response = APIClient().post(
        "/api/departure/",
        {"analysis_id": str(uuid4()), "offset_hours": offset, "load_lb": 28000},
        format="json",
    )
    assert response.status_code == 400


def test_departure_expiration_has_a_clear_refresh_response():
    response = APIClient().post(
        "/api/departure/", {"analysis_id": str(uuid4()), "offset_hours": 1, "load_lb": 28000}, format="json"
    )
    assert response.status_code == 410
    assert response.json()["code"] == "analysis_expired"
