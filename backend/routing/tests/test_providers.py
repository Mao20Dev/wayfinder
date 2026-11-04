from datetime import UTC, datetime
from unittest.mock import Mock, patch

import httpx
import pytest
from django.core.cache import cache

from routing import providers
from routing.providers import ProviderError, forecast, normalize_osrm, reserve_weather_budget, tomtom_routes
from routing.service import DEMO_DESTINATION, DEMO_ORIGIN


@pytest.fixture(autouse=True)
def clean_cache():
    cache.clear()


def forecast_response(units="km/h"):
    return {
        "hourly_units": {"wind_speed_10m": units, "rain": "mm", "showers": "mm", "snowfall": "cm"},
        "hourly": {
            "time": [0, 3600],
            "wind_speed_10m": [10, 20],
            "rain": [0, 0],
            "showers": [0, 0],
            "snowfall": [0, 0],
        },
    }


def test_forecast_reuses_coordinates_and_cache():
    with (
        patch.object(providers, "fetch_json", return_value=forecast_response()) as fetch,
        patch.object(providers.time, "sleep"),
    ):
        assert len(forecast([[-87, 42], [-87, 42]])) == 1
        assert len(forecast([[-87, 42]])) == 1
    assert fetch.call_count == 1


def test_forecast_contract_rejects_units_and_bad_series():
    for response in [
        forecast_response("mph"),
        {**forecast_response(), "hourly": {"time": [3600, 0]}},
        {**forecast_response(), "hourly": {"time": [0, 3600]}},
    ]:
        cache.clear()
        with (
            patch.object(providers, "fetch_json", return_value=response),
            patch.object(providers.time, "sleep"),
        ):
            assert forecast([[-87, 42]]) == {}


def test_forecast_outage_leaves_unknown():
    with (
        patch.object(providers, "fetch_json", side_effect=ProviderError("Unavailable")),
        patch.object(providers.time, "sleep"),
    ):
        assert forecast([[-87, 42]]) == {}


def test_hourly_weather_budget():
    with patch.object(providers.time, "time", return_value=100000):
        assert reserve_weather_budget(4400)
        assert not reserve_weather_budget(200)
        assert reserve_weather_budget(100)
        assert not reserve_weather_budget(1)


def test_http_error_redacts_credential(caplog):
    secret = "never-log-this-provider-key"
    with (
        patch.object(
            providers.CLIENT, "get", side_effect=httpx.ConnectError(f"https://provider.example/?key={secret}")
        ),
        pytest.raises(ProviderError) as exc,
    ):
        providers.fetch_json("https://provider.example/", {"key": secret})
    assert secret not in str(exc.value)
    assert secret not in caplog.text


def test_osrm_annotation_contract():
    raw = {
        "geometry": {"coordinates": [[0, 0], [1, 0]]},
        "legs": [{"annotation": {"duration": [100], "distance": [1000]}}],
    }
    result = normalize_osrm(raw, "r")
    assert result["times"] == [0, 100]
    assert result["distances"] == [0, 1000]
    raw["legs"][0]["annotation"]["duration"] = []
    with pytest.raises(ProviderError):
        normalize_osrm(raw, "r")


@pytest.mark.parametrize("bad", [-1, float("nan"), float("inf")])
def test_bad_provider_timings_are_rejected(bad):
    raw = {
        "geometry": {"coordinates": [[0, 0], [1, 0]]},
        "legs": [{"annotation": {"duration": [bad], "distance": [1000]}}],
    }
    with pytest.raises(ProviderError):
        normalize_osrm(raw, "r")


def test_tomtom_requests_truck_and_interpolates_progress(monkeypatch):
    monkeypatch.setenv("TOMTOM_API_KEY", "test-not-a-real-key")
    response = {
        "routes": [
            {
                "legs": [
                    {
                        "points": [
                            {"longitude": 0, "latitude": 0},
                            {"longitude": 1, "latitude": 0},
                            {"longitude": 2, "latitude": 0},
                        ]
                    }
                ],
                "progress": [
                    {"pointIndex": 0, "distanceInMeters": 0, "travelTimeInSeconds": 0},
                    {"pointIndex": 2, "distanceInMeters": 2000, "travelTimeInSeconds": 400},
                ],
            }
        ]
    }
    fetch = Mock(return_value=response)
    with patch.object(providers, "fetch_json", fetch):
        result = tomtom_routes(DEMO_ORIGIN, DEMO_DESTINATION, datetime.now(UTC))
    params = fetch.call_args.args[1]
    assert params["travelMode"] == "truck"
    assert params["maxAlternatives"] == 2
    assert params["extendedRouteRepresentation"] == ["distance", "travelTime"]
    assert "vehicleWeight" not in params  # Cargo is not gross vehicle weight.
    assert result[0]["times"] == pytest.approx([0, 200, 400])
    assert result[0]["distances"] == pytest.approx([0, 1000, 2000])
