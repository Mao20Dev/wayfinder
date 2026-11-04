"""Provider adapters keep credentials and network errors out of API responses."""

import hashlib
import logging
import math
import os
import threading
import time
from bisect import bisect_right

import httpx
from django.core.cache import cache

from .geometry import cumulative, distance

logger = logging.getLogger(__name__)
CLIENT = httpx.Client(
    timeout=httpx.Timeout(30, connect=8),
    headers={"User-Agent": "WeatherAwareRoutingAssessment/1.0 (interactive prototype)"},
    follow_redirects=False,
)
OSRM_LOCK = threading.Lock()
WEATHER_LOCK = threading.Lock()
LAST_OSRM = 0.0
LAST_WEATHER = 0.0


def reserve_weather_budget(count):
    """Called under WEATHER_LOCK, across both simultaneous analyses.

    Count locations conservatively, not HTTP batches. Stay below published free
    hourly/daily quotas; returning unknown is preferable to an unbounded burst.
    """
    now = time.time()
    buckets = [
        (f"weather-hour:{int(now // 3600)}", 4500, 3700),
        (f"weather-day:{int(now // 86400)}", 9000, 86500),
    ]
    if any(cache.get(key, 0) + count > maximum for key, maximum, _ in buckets):
        return False
    for key, _, ttl in buckets:
        cache.set(key, cache.get(key, 0) + count, ttl)
    return True


class ProviderError(Exception):
    pass


def fetch_json(url, params=None, ttl=600, provider="External provider"):
    # Hash keys: API credentials and route locations must never appear in cache logs.
    key = "provider:" + hashlib.sha256((url + repr(sorted((params or {}).items()))).encode()).hexdigest()
    result = cache.get(key)
    if result is not None:
        return result
    try:
        response = CLIENT.get(url, params=params)
        response.raise_for_status()
        result = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        # Never log the HTTP exception: its URL may contain API credentials.
        logger.warning("%s request failed (%s)", provider, type(exc).__name__)
        raise ProviderError(
            f"{provider} is unavailable or its request limit was reached. Please try again later."
        ) from None
    cache.set(key, result, ttl)
    return result


def geocode(query):
    data = fetch_json(
        "https://geocoding-api.open-meteo.com/v1/search",
        {"name": query, "count": 6, "language": "en", "format": "json"},
        ttl=86400,
        provider="Location search",
    )
    return [
        {
            "name": ", ".join(dict.fromkeys(filter(None, [p["name"], p.get("admin1"), p.get("country")]))),
            "latitude": p["latitude"],
            "longitude": p["longitude"],
            "timezone": p.get("timezone", "UTC"),
        }
        for p in data.get("results", [])
    ]


def normalize_osrm(raw, route_id, via=False):
    coords = raw["geometry"]["coordinates"]
    durations = [value for leg in raw["legs"] for value in leg["annotation"]["duration"]]
    distances = [value for leg in raw["legs"] for value in leg["annotation"]["distance"]]
    if len(durations) != len(coords) - 1 or len(distances) != len(durations):
        raise ProviderError("The routing provider returned inconsistent geometry and timing data.")
    if any(not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0 for v in durations + distances):
        raise ProviderError("The routing provider returned invalid distances or driving times.")
    if len(coords) < 2 or any(
        len(c) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in c) for c in coords
    ):
        raise ProviderError("The routing provider returned invalid route coordinates.")
    times, measures = [0.0], [0.0]
    for duration, length in zip(durations, distances, strict=True):
        times.append(times[-1] + duration)
        measures.append(measures[-1] + length)
    if measures[-1] < 100:
        raise ProviderError("Choose different locations at least 100 meters apart.")
    return {
        "id": route_id,
        "coordinates": coords,
        "times": times,
        "distances": measures,
        "duration_seconds": times[-1],
        "distance_meters": measures[-1],
        "via_comparison_point": via,
    }


def _osrm(points, alternatives=True):
    global LAST_OSRM
    coords = ";".join(f"{p[0]:.6f},{p[1]:.6f}" for p in points)
    # Public server policy: <= 1 request/second across this single-process app.
    with OSRM_LOCK:
        time.sleep(max(0, 1.05 - (time.monotonic() - LAST_OSRM)))
        LAST_OSRM = time.monotonic()
        data = fetch_json(
            f"https://routing.openstreetmap.de/routed-car/route/v1/driving/{coords}",
            {
                "alternatives": "3" if alternatives else "false",
                "geometries": "geojson",
                "overview": "full",
                "annotations": "duration,distance",
            },
            ttl=3600,
            provider="OSRM routing",
        )
    if data.get("code") != "Ok" or not data.get("routes"):
        raise ProviderError("No road route was found between these locations.")
    return data["routes"]


def osrm_routes(origin, destination):
    a, b = [origin["longitude"], origin["latitude"]], [destination["longitude"], destination["latitude"]]
    separation = distance(a, b)
    if separation > 1_600_000:
        raise ProviderError(
            "This public routing demo supports trips up to 1,600 km apart. Choose a shorter trip."
        )
    candidates = [(raw, False) for raw in _osrm([a, b])[:3]]
    # When natural alternatives are scarce, obtain genuine API routes via two
    # explicit comparison waypoints. Do not duplicate a route to fill three cards.
    if len(candidates) < 3 and separation > 10_000:
        middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        coslat = max(0.15, math.cos(math.radians(middle[1])))
        dx, dy = (b[0] - a[0]) * coslat, b[1] - a[1]
        norm = math.hypot(dx, dy)
        offset = min(0.65, max(0.12, separation / 111_000 * 0.18))
        for direction in (1, -1):
            if len(candidates) >= 3:
                break
            via = [
                middle[0] - direction * dy / norm * offset / coslat,
                middle[1] + direction * dx / norm * offset,
            ]
            try:
                candidate = _osrm([a, via, b], alternatives=False)[0]
            except ProviderError:
                continue
            if all(
                abs(candidate["distance"] - raw["distance"]) > max(250, raw["distance"] * 0.005)
                for raw, _ in candidates
            ):
                candidates.append((candidate, True))
    return [normalize_osrm(raw, f"route-{i + 1}", via) for i, (raw, via) in enumerate(candidates)]


def tomtom_routes(origin, destination, departure):
    points = (
        f"{origin['latitude']},{origin['longitude']}:{destination['latitude']},{destination['longitude']}"
    )
    data = fetch_json(
        f"https://api.tomtom.com/routing/1/calculateRoute/{points}/json",
        {
            "key": os.environ["TOMTOM_API_KEY"],
            "travelMode": "truck",
            "maxAlternatives": 2,
            "departAt": departure.isoformat(),
            "extendedRouteRepresentation": ["distance", "travelTime"],
        },
        provider="TomTom routing",
    )
    result = []
    for i, raw in enumerate(data.get("routes", [])[:3]):
        coords = [[p["longitude"], p["latitude"]] for leg in raw["legs"] for p in leg["points"]]
        progress = raw.get("progress", [])
        if (
            len(progress) < 2
            or progress[0]["pointIndex"] != 0
            or progress[-1]["pointIndex"] != len(coords) - 1
        ):
            raise ProviderError("TomTom did not return complete cumulative timing data.")
        geometry_lengths = cumulative(coords)
        measures, times = [], []
        indices = [p["pointIndex"] for p in progress]
        if any(b <= a for a, b in zip(indices, indices[1:], strict=False)):
            raise ProviderError("TomTom returned inconsistent progress indices.")
        for field in ("distanceInMeters", "travelTimeInSeconds"):
            values = [p.get(field) for p in progress]
            if any(not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0 for v in values):
                raise ProviderError("TomTom returned invalid cumulative progress.")
            if values[0] != 0 or any(b < a for a, b in zip(values, values[1:], strict=False)):
                raise ProviderError("TomTom returned non-monotonic cumulative progress.")
        for index in range(len(coords)):
            j = min(max(bisect_right(indices, index) - 1, 0), len(progress) - 2)
            lo, hi = progress[j], progress[j + 1]
            length = geometry_lengths[hi["pointIndex"]] - geometry_lengths[lo["pointIndex"]]
            ratio = (geometry_lengths[index] - geometry_lengths[lo["pointIndex"]]) / length if length else 0
            measures.append(
                lo["distanceInMeters"] + ratio * (hi["distanceInMeters"] - lo["distanceInMeters"])
            )
            times.append(
                lo["travelTimeInSeconds"] + ratio * (hi["travelTimeInSeconds"] - lo["travelTimeInSeconds"])
            )
        result.append(
            {
                "id": f"route-{i + 1}",
                "coordinates": coords,
                "distances": measures,
                "times": times,
                "duration_seconds": times[-1],
                "distance_meters": measures[-1],
                "via_comparison_point": False,
            }
        )
    if not result:
        raise ProviderError("TomTom found no routes for this trip.")
    return result


def forecast(coordinates):
    """Cache by requested coordinate; failed batches remain missing, never zero."""
    global LAST_WEATHER
    result, missing = {}, []
    for coordinate in dict.fromkeys(tuple(round(v, 4) for v in c) for c in coordinates):
        key = f"forecast:{coordinate[0]}:{coordinate[1]}"
        data = cache.get(key)
        if data is not None:
            result[coordinate] = data
        else:
            missing.append(coordinate)
    for start in range(0, len(missing), 20):
        batch = missing[start : start + 20]
        # Multi-location calls conservatively count each location toward quota.
        # 20 locations / 2.1s < 600 locations/minute, serialized across requests.
        with WEATHER_LOCK:
            if not reserve_weather_budget(len(batch)):
                logger.warning("Local weather request budget reached; remaining locations stay unknown")
                break
            time.sleep(max(0, 2.1 - (time.monotonic() - LAST_WEATHER)))
            LAST_WEATHER = time.monotonic()
            try:
                payload = fetch_json(
                    "https://api.open-meteo.com/v1/forecast",
                    {
                        "latitude": ",".join(str(c[1]) for c in batch),
                        "longitude": ",".join(str(c[0]) for c in batch),
                        "hourly": "wind_speed_10m,rain,showers,snowfall",
                        "forecast_days": 7,
                        "past_hours": 1,
                        "timezone": "GMT",
                        "timeformat": "unixtime",
                        "wind_speed_unit": "kmh",
                        "precipitation_unit": "mm",
                    },
                    provider="Open-Meteo forecast",
                )
            except ProviderError:
                continue
        items = payload if isinstance(payload, list) else [payload]
        if len(items) != len(batch):
            continue
        for coordinate, data in zip(batch, items, strict=True):
            units = data.get("hourly_units", {})
            expected = {"wind_speed_10m": "km/h", "rain": "mm", "showers": "mm", "snowfall": "cm"}
            if any(units.get(k) != v for k, v in expected.items()):
                logger.warning("Forecast units did not match the adapter contract")
                continue
            hourly = data.get("hourly", {})
            times = hourly.get("time", [])
            if not times or any(not isinstance(t, (int, float)) or not math.isfinite(t) for t in times):
                continue
            if any(b <= a for a, b in zip(times, times[1:], strict=False)):
                continue
            if any(len(hourly.get(field, [])) != len(times) for field in expected):
                continue
            result[coordinate] = data
            cache.set(f"forecast:{coordinate[0]}:{coordinate[1]}", data, 900)
    return result
