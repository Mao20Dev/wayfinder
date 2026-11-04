from copy import deepcopy
from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core.cache import caches
from rest_framework.test import APIClient

from routing.geometry import METERS_PER_MILE, checkpoints, road_segments
from routing.risk import classify, recommend, summarize
from routing.serializers import TripSerializer
from routing.service import DEMO_DESTINATION, DEMO_ORIGIN, analyze_trip, reassess_load


@pytest.fixture(autouse=True)
def clean_caches():
    caches["default"].clear()
    caches["analyses"].clear()


def route_fixture():
    route = {
        "id": "route-1",
        "coordinates": [[0, 0], [1, 0], [1, 1], [2, 1]],
        "distances": [0, 10 * METERS_PER_MILE, 20 * METERS_PER_MILE, 30 * METERS_PER_MILE],
        "times": [0, 1000, 2000, 3000],
        "distance_miles": 30,
        "duration_seconds": 3000,
    }
    route["checkpoints"] = checkpoints(route, 25, 0)
    for cp in route["checkpoints"]:
        cp["weather"] = {"wind_mph": 46, "rain_in_hr": 0, "snow_in_hr": 0, "weather_hour_epoch": 3600}
        cp.update(classify(cp["weather"], 28000))
    route["segments"] = road_segments(route)
    route["summary"] = summarize(route["checkpoints"], 30)
    return route


def test_road_coloring_follows_actual_polyline_and_exposure_totals():
    route = route_fixture()
    segments = route["segments"]
    assert segments[0]["coordinates"][:3] == [[0, 0], [1, 0], [1, 1]]
    assert segments[0]["coordinates"][-1] == segments[1]["coordinates"][0]
    assert segments[-1]["coordinates"][-1] == route["coordinates"][-1]
    assert sum(s["end_mile"] - s["start_mile"] for s in segments) == 30
    assert all(segment["risk"] == 3 for segment in segments)


def test_road_unknown_and_known_prohibition_match_route_summary():
    route = route_fixture()
    route["checkpoints"][0].update({"risk": None, "complete": False})
    assert road_segments(route)[0]["risk"] is None
    route["checkpoints"][1].update({"risk": 4, "complete": True})
    assert road_segments(route)[0]["risk"] == 4
    assert summarize(route["checkpoints"], 30)["status"] == "blocked"


@pytest.mark.parametrize(
    ("wind", "cargo", "rule", "risk"),
    [
        (55, 0, "wind_55", 4),
        (46, 30001, "wind_45_load_30000", 4),
        (36, 40001, "wind_35_load_40000", 3),
        (46, 30000, None, 3),
        (36, 40000, None, 2),
    ],
)
def test_point_explains_the_exact_cargo_rule(wind, cargo, rule, risk):
    point = classify({"wind_mph": wind, "rain_in_hr": 0, "snow_in_hr": 0}, cargo)
    assert point["cargo_rule"] == rule
    assert point["risk"] == risk
    assert point["drivers"] == ["wind"]


@pytest.mark.parametrize(
    ("criterion", "a", "b", "advantage"),
    [
        ("severe_miles", (1, 8, 2, 200), (4, 0, 1, 100), 3),
        ("high_miles", (0, 2, 2, 200), (0, 9, 1, 100), 7),
        ("average_risk", (0, 2, 1, 200), (0, 2, 2, 100), 1),
        ("duration_seconds", (0, 2, 1, 100), (0, 2, 1, 200), 100),
    ],
)
def test_recommendation_exposes_real_deciding_difference(criterion, a, b, advantage):
    def candidate(name, values):
        severe, high, average, seconds = values
        return {
            "id": name,
            "duration_seconds": seconds,
            "summary": {"eligible": True, "average_risk": average, "miles_by_risk": [0, 0, high, severe, 0]},
        }

    result = recommend([candidate("route-1", a), candidate("route-2", b)])
    assert result["route_id"] == "route-1"
    assert result["decision"]["criterion"] == criterion
    assert result["decision"]["comparison_route_id"] == "route-2"
    assert result["decision"]["advantage"] == advantage
    assert result["decision"]["extra_minutes_vs_fastest"] == max(0, (a[3] - b[3]) / 60)


def test_load_reassessment_reuses_weather_and_updates_every_view():
    route = route_fixture()
    sample = {"wind_mph": 46, "rain_in_hr": 0, "snow_in_hr": 0, "risk": 3, "complete": True}
    analysis = {
        "routes": [route],
        "load_lb": 28000,
        "corridor": [{"hours": [deepcopy(sample)], "arrivals": {"route-1": deepcopy(sample)}}],
    }
    before = deepcopy(analysis)
    with patch(
        "routing.providers.CLIENT.get", side_effect=AssertionError("Cargo changes must not use the network")
    ):
        changed = reassess_load(deepcopy(analysis), 45000)
    assert changed["routes"][0]["summary"]["status"] == "blocked"
    assert all(s["risk"] == 4 for s in changed["routes"][0]["segments"])
    assert changed["corridor"][0]["hours"][0]["risk"] == 4
    assert changed["corridor"][0]["arrivals"]["route-1"]["risk"] == 4
    assert (
        changed["routes"][0]["checkpoints"][0]["weather"] == before["routes"][0]["checkpoints"][0]["weather"]
    )
    assert changed["recommendation"]["route_id"] is None
    assert analysis == before


def test_demo_respects_departure_and_arrival_corridor_uses_nearby_point_eta():
    trip = TripSerializer(
        data={
            "mode": "demo",
            "origin": DEMO_ORIGIN,
            "destination": DEMO_DESTINATION,
            "departure": (datetime.now(UTC) + timedelta(hours=2)).isoformat(),
            "load_lb": 28000,
            "spacing_miles": 25,
        }
    )
    trip.is_valid(raise_exception=True)
    result = analyze_trip(trip.validated_data)
    assert result["departure_epoch"] == trip.validated_data["departure"].timestamp()
    cell = result["corridor"][0]
    assert len(cell["hours"]) == 49
    for route in result["routes"]:
        arrival = cell["arrivals"][route["id"]]
        cp = next(cp for cp in route["checkpoints"] if cp["id"] == arrival["nearby_checkpoint_id"])
        assert arrival["eta_epoch"] == cp["eta_epoch"]


def test_cached_cargo_endpoint_and_expired_analysis():
    client = APIClient()
    identifier = str(uuid4())
    analysis = {"analysis_id": identifier, "routes": [route_fixture()], "load_lb": 28000, "corridor": []}
    caches["analyses"].set(identifier, analysis)
    with patch("routing.providers.CLIENT.get", side_effect=AssertionError("No network calls")):
        response = client.post("/api/reassess/", {"analysis_id": identifier, "load_lb": 45000}, format="json")
    assert response.status_code == 200
    assert response.json()["routes"][0]["summary"]["status"] == "blocked"
    assert caches["analyses"].get(identifier)["load_lb"] == 28000
    response = client.post("/api/reassess/", {"analysis_id": str(uuid4()), "load_lb": 45000}, format="json")
    assert response.status_code == 410
    assert response.json()["code"] == "analysis_expired"
