from datetime import UTC, datetime

import pytest

from routing.geometry import METERS_PER_MILE, checkpoints, corridor_grid
from routing.weather import at_time


def forecast():
    return {
        "hourly": {
            "time": [0, 3600, 7200],
            "wind_speed_10m": [0, 16.09344, 32.18688],
            "rain": [0, 12.7, 0],
            "showers": [0, 12.7, 0],
            "snowfall": [0, 2.54, 0],
        }
    }


def test_units_and_accumulation_interval():
    weather = at_time(forecast(), 1800)
    assert weather["wind_mph"] == pytest.approx(5)
    assert weather["rain_in_hr"] == pytest.approx(1)
    assert weather["snow_in_hr"] == pytest.approx(1)
    assert weather["weather_hour_epoch"] == 3600


def test_exact_hour_and_horizon():
    assert at_time(forecast(), 3600)["rain_in_hr"] == 1
    assert at_time(forecast(), 3601)["rain_in_hr"] == 0
    assert at_time(forecast(), 7201)["wind_mph"] is None
    assert at_time(forecast(), -1)["rain_in_hr"] is None


def test_nulls_do_not_become_zero():
    data = forecast()
    data["hourly"]["showers"][1] = None
    assert at_time(data, 1800)["rain_in_hr"] is None
    assert at_time(None, 1800)["wind_mph"] is None


@pytest.mark.parametrize("spacing", [10, 25, 50])
def test_distance_sampling_and_cumulative_eta(spacing):
    route = {
        "id": "r",
        "coordinates": [[0, 0], [1, 0], [2, 0]],
        "distances": [0, 25 * METERS_PER_MILE, 55 * METERS_PER_MILE],
        "times": [0, 3600, 10800],
    }
    samples = checkpoints(route, spacing, 1000)
    assert samples[0]["mile"] == 0
    assert samples[-1]["mile"] == 55
    assert samples[-1]["eta_epoch"] == 11800
    assert all(b["eta_epoch"] >= a["eta_epoch"] for a, b in zip(samples, samples[1:], strict=False))
    assert all(b["mile"] - a["mile"] <= spacing + 1e-8 for a, b in zip(samples, samples[1:], strict=False))
    if spacing == 25:
        assert samples[1]["eta_epoch"] == 4600


def test_exact_multiple_no_duplicate_endpoint():
    route = {
        "id": "r",
        "coordinates": [[0, 0], [1, 0]],
        "distances": [0, 50 * METERS_PER_MILE],
        "times": [0, 3600],
    }
    assert [p["mile"] for p in checkpoints(route, 25, 0)] == [0, 25, 50]


def test_grid_is_bounded_and_contains_off_route_points():
    grid = corridor_grid([{"coordinates": [[-87, 42], [-86, 42], [-85, 42]]}])
    assert 20 < len(grid) < 180
    assert any(c["coordinates"][1] != 42 for c in grid)


def test_timezone_offsets_represent_same_instant():
    assert datetime.fromisoformat("2026-11-04T12:00:00-05:00").astimezone(UTC) == datetime.fromisoformat(
        "2026-11-04T17:00:00+00:00"
    )
