import json
from datetime import UTC, datetime
from pathlib import Path

from . import providers
from .departures import compare_departures
from .geometry import METERS_PER_MILE, checkpoints, corridor_grid, distance, road_segments
from .risk import classify, recommend, summarize
from .vehicle import gross_weight_lb
from .weather import at_time, simulated_at

DEMO_ORIGIN = {
    "name": "Chicago, Illinois, United States",
    "latitude": 41.8781,
    "longitude": -87.6298,
    "timezone": "America/Chicago",
}
DEMO_DESTINATION = {
    "name": "Detroit, Michigan, United States",
    "latitude": 42.3314,
    "longitude": -83.0458,
    "timezone": "America/Detroit",
}


def analyze_trip(trip):
    demo = trip["mode"] == "demo"
    generated = datetime.now(UTC).timestamp()
    reference = int(generated // 3600 * 3600)
    departure = trip["departure"].timestamp()
    notices = []
    if demo:
        fixture = json.loads(
            (Path(__file__).parent / "fixtures/demo_routes.json").read_text(encoding="utf-8")
        )
        routes = fixture["routes"]
        origin, destination = DEMO_ORIGIN, DEMO_DESTINATION
        routing_provider = "OSRM recorded routes"
        notices.append(
            "Weather demo only: recorded car routes and synthetic weather. Truck road access is not checked. Do not navigate this example."
        )
    else:
        origin, destination = trip["origin"], trip["destination"]
        if not trip.get("vehicle"):
            raise providers.ProviderError("Truck dimensions and weights are required for live routing.")
        routes = providers.tomtom_routes(
            origin, destination, trip["departure"], trip["vehicle"], trip["load_lb"]
        )
        routing_provider = "TomTom truck"
        notices.append(
            "Truck dimensions, gross and axle weights were sent to TomTom. Restrictions depend on provider map coverage; signs, permits and driving breaks still require review. Non-hazardous cargo only."
        )
    if any(route["duration_seconds"] > 48 * 3600 for route in routes):
        raise providers.ProviderError("This prototype supports routes with up to 48 hours of driving time.")
    if len(routes) < 3:
        notices.append(
            f"The routing provider returned {len(routes)} distinct route(s). No duplicates were added."
        )
    for route in routes:
        route["checkpoints"] = checkpoints(route, trip["spacing_miles"], departure)
    if sum(len(route["checkpoints"]) for route in routes) > 450:
        raise providers.ProviderError(
            "This trip has too many checkpoints for the free forecast budget. Choose 25 or 50 mile spacing, or a shorter trip."
        )
    grid = corridor_grid(routes)
    coords = [cp["coordinates"] for route in routes for cp in route["checkpoints"]] + [
        cell["coordinates"] for cell in grid
    ]
    forecasts = {} if demo else providers.forecast(coords)

    def weather(coordinate, epoch):
        return (
            simulated_at(coordinate, epoch, reference)
            if demo
            else at_time(forecasts.get(tuple(round(v, 4) for v in coordinate)), epoch)
        )

    for route in routes:
        for cp in route["checkpoints"]:
            cp["weather"] = weather(cp["coordinates"], cp["eta_epoch"])
            cp.update(classify(cp["weather"], trip["load_lb"]))
        route["distance_miles"] = route["distance_meters"] / METERS_PER_MILE
        route["summary"] = summarize(route["checkpoints"], route["distance_miles"])
        route["segments"] = road_segments(route)
        # Cumulative arrays are internal provider data, not needed by the client.
        route.pop("times", None)
        route.pop("distances", None)
    for cell in grid:
        cell["arrivals"] = {}
        for route in routes:
            closest = min(
                route["checkpoints"], key=lambda cp: distance(cp["coordinates"], cell["coordinates"])
            )
            sample = weather(cell["coordinates"], closest["eta_epoch"])
            level = classify(sample, trip["load_lb"])
            cell["arrivals"][route["id"]] = {
                **sample,
                "risk": level["risk"],
                "complete": level["complete"],
                "eta_epoch": closest["eta_epoch"],
                "nearby_checkpoint_id": closest["id"],
                "distance_miles": distance(cell["coordinates"], closest["coordinates"]) / METERS_PER_MILE,
            }
        cell["hours"] = []
        for h in range(49):
            sample = weather(cell["coordinates"], reference + h * 3600)
            level = classify(sample, trip["load_lb"])
            cell["hours"].append({**sample, "risk": level["risk"], "complete": level["complete"]})
    if any(not route["summary"]["complete"] for route in routes):
        notices.append(
            "Some arrival forecasts are missing or outside coverage. Incomplete routes are excluded from recommendation."
        )
    if any(not sample["complete"] for cell in grid for sample in cell["hours"]):
        notices.append("Some corridor forecasts are unavailable; missing cells are shown as unknown.")
    analysis = {
        "mode": trip["mode"],
        "origin": origin,
        "destination": destination,
        "departure_epoch": departure,
        "generated_epoch": generated,
        "forecast_reference_epoch": reference,
        "load_lb": trip["load_lb"],
        "spacing_miles": trip["spacing_miles"],
        "vehicle": trip.get("vehicle") if not demo else None,
        "gross_weight_lb": gross_weight_lb(trip["vehicle"], trip["load_lb"]) if not demo else None,
        "routing_profile": "weather_demo" if demo else "truck",
        "routes": routes,
        "recommendation": recommend(routes),
        "corridor": grid,
        "routing_provider": routing_provider,
        "weather_provider": "Synthetic scenario" if demo else "Open-Meteo",
        "notices": notices,
        "_forecasts": forecasts,
        "_base_departure_epoch": departure,
    }
    analysis["departure_window"] = compare_departures(analysis)
    return analysis


def reassess_load(analysis, load_lb):
    """Re-use the exact weather and departure, without consuming any provider quota."""
    if analysis.get("mode") == "live" and analysis.get("load_lb") != load_lb:
        raise providers.ProviderError(
            "Cargo changes require a new truck route calculation because gross weight changes."
        )
    analysis["load_lb"] = load_lb
    for route in analysis["routes"]:
        for cp in route["checkpoints"]:
            cp.update(classify(cp["weather"], load_lb))
        route["summary"] = summarize(route["checkpoints"], route["distance_miles"])
        route["segments"] = road_segments(route)
    for cell in analysis["corridor"]:
        for sample in [*cell["hours"], *cell["arrivals"].values()]:
            level = classify(sample, load_lb)
            sample.update({"risk": level["risk"], "complete": level["complete"]})
    analysis["recommendation"] = recommend(analysis["routes"])
    if "_base_departure_epoch" in analysis:
        analysis["departure_window"] = compare_departures(analysis)
    return analysis
