import pytest

from routing.risk import classify, recommend, summarize, wind_risk


@pytest.mark.parametrize(
    ("wind", "load", "expected"),
    [
        (0, 0, 0),
        (24.999, 50000, 0),
        (25, 0, 1),
        (34.999, 50000, 1),
        (35, 40000, 2),
        (35, 40000.001, 3),
        (44.999, 40000, 2),
        (45, 30000, 3),
        (45, 30000.001, 4),
        (54.999, 30000, 3),
        (54.999, 30001, 4),
        (55, 0, 4),
        (80, 0, 4),
    ],
)
def test_wind_and_strict_load_thresholds(wind, load, expected):
    assert wind_risk(wind, load) == expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0, 0),
        (0.099999, 0),
        (0.1, 1),
        (0.249999, 1),
        (0.25, 2),
        (0.499999, 2),
        (0.5, 3),
        (1.0, 3),
        (1.000001, 4),
    ],
)
def test_rain_boundary_policy(value, expected):
    assert classify({"wind_mph": 0, "rain_in_hr": value, "snow_in_hr": 0}, 0)["risk"] == expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0, 0),
        (0.499999, 0),
        (0.5, 1),
        (0.999999, 1),
        (1, 2),
        (1.999999, 2),
        (2, 3),
        (3, 3),
        (3.000001, 4),
    ],
)
def test_snow_boundary_policy(value, expected):
    assert classify({"wind_mph": 0, "rain_in_hr": 0, "snow_in_hr": value}, 0)["risk"] == expected


@pytest.mark.parametrize("missing", [None, float("nan"), float("inf"), -1])
def test_unknown_is_not_low(missing):
    sample = classify({"wind_mph": missing, "rain_in_hr": 0, "snow_in_hr": 0}, 0)
    assert sample["risk"] is None
    assert not sample["complete"]


def test_known_prohibition_survives_missing_data():
    result = classify({"wind_mph": 60, "rain_in_hr": None, "snow_in_hr": None}, 0)
    assert result["risk"] == 4
    assert not result["complete"]


def test_worst_condition_not_average():
    assert classify({"wind_mph": 0, "rain_in_hr": 0, "snow_in_hr": 2.1}, 0)["risk"] == 3


def test_distance_weighting_and_last_partial_interval():
    points = [
        {"mile": 0, "risk": 0, "complete": True},
        {"mile": 25, "risk": 2, "complete": True},
        {"mile": 30, "risk": 3, "complete": True},
    ]
    summary = summarize(points, 30)
    assert summary["miles_by_risk"] == [0, 0, 25, 5, 0]
    assert sum(summary["miles_by_risk"]) == 30
    assert summary["average_risk"] == pytest.approx(65 / 30)


def candidate(identifier, severe=0, high=0, avg=0, seconds=100, eligible=True):
    return {
        "id": identifier,
        "duration_seconds": seconds,
        "summary": {"eligible": eligible, "miles_by_risk": [0, 0, high, severe, 0], "average_risk": avg},
    }


@pytest.mark.parametrize(
    ("a", "b"),
    [
        (candidate("a", severe=0, high=100), candidate("b", severe=1)),
        (candidate("a", high=0, avg=3), candidate("b", high=1, avg=0)),
        (candidate("a", avg=1, seconds=1000), candidate("b", avg=2, seconds=1)),
        (candidate("a", seconds=50), candidate("b", seconds=100)),
    ],
)
def test_ranking_priorities(a, b):
    assert recommend([b, a])["route_id"] == "a"


def test_ineligible_routes_and_ties():
    assert recommend([candidate("blocked", eligible=False)])["route_id"] is None
    result = recommend([candidate("b"), candidate("a"), candidate("blocked", eligible=False)])
    assert result["route_id"] == "a"
    assert result["tied_route_ids"] == ["a", "b"]


def test_missing_and_blocked_route_summaries():
    points = [{"mile": 0, "risk": None, "complete": False}, {"mile": 5, "risk": 0, "complete": True}]
    result = summarize(points, 5)
    assert result["unknown_miles"] == 5
    assert result["average_risk"] is None
    assert not result["eligible"]
    points[1]["risk"] = 4
    assert summarize(points, 5)["status"] == "blocked"
