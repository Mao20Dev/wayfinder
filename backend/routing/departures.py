"""Compare departure times using already-fetched hourly forecasts, never new I/O."""

from datetime import UTC, datetime

from .geometry import road_segments
from .risk import classify, summarize
from .weather import at_time, simulated_at

HORIZON_HOURS = 24


def weather_at(analysis, coordinate, epoch):
    if analysis["mode"] == "demo":
        return simulated_at(coordinate, epoch, analysis["forecast_reference_epoch"])
    forecast = analysis.get("_forecasts", {}).get(tuple(round(value, 4) for value in coordinate))
    return at_time(forecast, epoch)


def departure_available(analysis, epoch, now):
    return analysis["mode"] == "demo" or now - 300 <= epoch <= now + 96 * 3600


def comparison_key(summary):
    # Driving time is fixed within a route. Keep the assessment's exact order;
    # waiting time is not secretly added as a competing risk weight.
    return (summary["miles_by_risk"][3], summary["miles_by_risk"][2], summary["average_risk"])


def compare_departures(analysis, now=None):
    now = datetime.now(UTC).timestamp() if now is None else now
    base = analysis["_base_departure_epoch"]
    options = {}
    for route in analysis["routes"]:
        candidates = []
        for offset in range(HORIZON_HOURS + 1):
            epoch = base + offset * 3600
            points = []
            for point in route["checkpoints"]:
                arrival = epoch + point["eta_epoch"] - analysis["departure_epoch"]
                points.append(
                    {
                        "mile": point["mile"],
                        **classify(weather_at(analysis, point["coordinates"], arrival), analysis["load_lb"]),
                    }
                )
            candidates.append(
                {
                    "offset_hours": offset,
                    "departure_epoch": epoch,
                    "available": departure_available(analysis, epoch, now),
                    "summary": summarize(points, route["distance_miles"]),
                }
            )
        eligible = [
            candidate
            for candidate in candidates
            if candidate["available"] and candidate["summary"]["eligible"]
        ]
        best = min(
            eligible,
            key=lambda candidate: (*comparison_key(candidate["summary"]), candidate["offset_hours"]),
            default=None,
        )
        options[route["id"]] = {
            "best_offset_hours": best["offset_hours"] if best else None,
            "best_departure_epoch": best["departure_epoch"] if best else None,
            "eligible_count": len(eligible),
            "tied_offsets": [
                candidate["offset_hours"]
                for candidate in eligible
                if comparison_key(candidate["summary"]) == comparison_key(best["summary"])
            ]
            if best
            else [],
            "candidates": candidates,
        }
    return {
        "base_epoch": base,
        "end_epoch": base + HORIZON_HOURS * 3600,
        "step_hours": 1,
        "current_offset_hours": round((analysis["departure_epoch"] - base) / 3600),
        "routes": options,
    }


def apply_departure(analysis, offset_hours, load_lb):
    previous = analysis["departure_epoch"]
    departure = analysis["_base_departure_epoch"] + offset_hours * 3600
    analysis["departure_epoch"] = departure
    analysis["load_lb"] = load_lb
    points_by_id = {}
    for route in analysis["routes"]:
        for point in route["checkpoints"]:
            point["eta_epoch"] += departure - previous
            point["weather"] = weather_at(analysis, point["coordinates"], point["eta_epoch"])
            point.update(classify(point["weather"], load_lb))
            points_by_id[point["id"]] = point
        route["summary"] = summarize(route["checkpoints"], route["distance_miles"])
        route["segments"] = road_segments(route)
    for cell in analysis["corridor"]:
        for arrival in cell["arrivals"].values():
            epoch = points_by_id[arrival["nearby_checkpoint_id"]]["eta_epoch"]
            sample = weather_at(analysis, cell["coordinates"], epoch)
            arrival.update(sample)
            arrival["eta_epoch"] = epoch
    # The service reapplies cargo rules to every map view and recomputes the
    # recommendation and departure window after these new weather samples.
    return analysis
