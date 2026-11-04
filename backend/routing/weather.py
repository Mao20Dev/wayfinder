import bisect
import math

from .risk import valid


def at_time(forecast, epoch):
    if not forecast:
        return {"wind_mph": None, "rain_in_hr": None, "snow_in_hr": None, "weather_hour_epoch": None}
    hourly = forecast.get("hourly", {})
    times = hourly.get("time", [])
    if not times or epoch < times[0] or epoch > times[-1]:
        return at_time(None, epoch)
    # Hourly accumulations stamped t describe (t-1h, t]. Never interpolate sums.
    hi = bisect.bisect_left(times, epoch)
    lo = max(0, hi - 1)
    rain = hourly["rain"][hi]
    showers = hourly["showers"][hi]
    snow = hourly["snowfall"][hi]
    w0, w1 = hourly["wind_speed_10m"][lo], hourly["wind_speed_10m"][hi]
    fraction = (epoch - times[lo]) / (times[hi] - times[lo]) if hi != lo else 0
    wind = (w0 + fraction * (w1 - w0)) / 1.609344 if valid(w0) and valid(w1) else None
    return {
        "wind_mph": wind,
        "rain_in_hr": (rain + showers) / 25.4 if valid(rain) and valid(showers) else None,
        "snow_in_hr": snow / 2.54 if valid(snow) else None,
        "weather_hour_epoch": times[hi],
    }


def simulated_at(coordinate, epoch, reference):
    """Explicitly synthetic scenario; reproducible across dates, never live weather."""
    lon, lat = coordinate
    hour = (epoch - reference) / 3600
    center_lon = -86.6 + hour * 0.09
    storm = math.exp(-(((lon - center_lon) / 1.05) ** 2) - ((lat - 41.55) / 0.48) ** 2)
    return {
        "wind_mph": 13 + 38 * storm,
        "rain_in_hr": 0.015 + 0.36 * storm,
        "snow_in_hr": 0.0,
        "weather_hour_epoch": math.ceil(epoch / 3600) * 3600,
    }
