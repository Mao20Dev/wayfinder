import bisect
import math

from .risk import interval_risk

METERS_PER_MILE = 1609.344


def distance(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, (*a, *b))
    q = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6_371_008.8 * 2 * math.asin(min(1, math.sqrt(q)))


def cumulative(coordinates):
    result = [0.0]
    for a, b in zip(coordinates, coordinates[1:], strict=False):
        result.append(result[-1] + distance(a, b))
    return result


def interpolate(values, index, fraction):
    return values[index] + (values[index + 1] - values[index]) * fraction


def checkpoints(route, spacing_miles, departure_epoch):
    coordinates = route["coordinates"]
    measures = route["distances"]
    duration = route["times"]
    total = measures[-1]
    interval = spacing_miles * METERS_PER_MILE
    positions = [i * interval for i in range(math.ceil(total / interval))] + [total]
    result = []
    for position in positions:
        i = min(max(bisect.bisect_right(measures, position) - 1, 0), len(measures) - 2)
        length = measures[i + 1] - measures[i]
        fraction = (position - measures[i]) / length if length else 0
        lng = interpolate([coordinates[i][0], coordinates[i + 1][0]], 0, fraction)
        lat = interpolate([coordinates[i][1], coordinates[i + 1][1]], 0, fraction)
        result.append(
            {
                "id": f"{route['id']}-cp-{len(result)}",
                "coordinates": [lng, lat],
                "mile": position / METERS_PER_MILE,
                "eta_epoch": departure_epoch + interpolate(duration, i, fraction),
                "geometry_index": i,
            }
        )
    return result


def road_segments(route):
    """Split the actual provider polyline at sampled locations, without shortcuts."""
    result = []
    for a, b in zip(route["checkpoints"], route["checkpoints"][1:], strict=False):
        path = [
            a["coordinates"],
            *route["coordinates"][a["geometry_index"] + 1 : b["geometry_index"] + 1],
            b["coordinates"],
        ]
        coordinates = [point for index, point in enumerate(path) if index == 0 or point != path[index - 1]]
        if len(coordinates) < 2:
            continue
        result.append(
            {
                "id": f"{route['id']}-segment-{len(result)}",
                "route_id": route["id"],
                "start_mile": a["mile"],
                "end_mile": b["mile"],
                "start_eta_epoch": a["eta_epoch"],
                "end_eta_epoch": b["eta_epoch"],
                "risk": interval_risk(a["risk"], b["risk"]),
                "coordinates": coordinates,
            }
        )
    return result


def corridor_grid(routes, target=120, width_miles=25):
    """Uniform geographic grid, cropped to a buffered union of route corridors."""
    lines = []
    for route in routes:
        coords = route["coordinates"]
        # <= ~10-mile gaps keeps the corridor buffer connected even on long trips.
        stride = max(1, len(coords) // 220)
        lines.extend(coords[::stride] + [coords[-1]])
    min_lon, max_lon = min(c[0] for c in lines), max(c[0] for c in lines)
    min_lat, max_lat = min(c[1] for c in lines), max(c[1] for c in lines)
    lat_pad = width_miles / 69
    lon_pad = lat_pad / max(0.15, math.cos(math.radians((min_lat + max_lat) / 2)))
    min_lon, max_lon = max(-180, min_lon - lon_pad), min(180, max_lon + lon_pad)
    min_lat, max_lat = max(-85, min_lat - lat_pad), min(85, max_lat + lat_pad)
    aspect = max(
        0.1,
        (max_lon - min_lon) * math.cos(math.radians((min_lat + max_lat) / 2)) / max(0.01, max_lat - min_lat),
    )
    nx = max(2, round(math.sqrt(target * aspect)))
    ny = max(2, math.ceil(target / nx))
    dx, dy = (max_lon - min_lon) / nx, (max_lat - min_lat) / ny
    result = []
    for y in range(ny):
        for x in range(nx):
            center = [min_lon + (x + 0.5) * dx, min_lat + (y + 0.5) * dy]
            if min(distance(center, point) for point in lines) > (
                width_miles * METERS_PER_MILE + distance(center, [center[0] + dx / 2, center[1] + dy / 2])
            ):
                continue
            result.append(
                {
                    "id": len(result),
                    "coordinates": center,
                    "bounds": [
                        center[0] - dx / 2,
                        center[1] - dy / 2,
                        center[0] + dx / 2,
                        center[1] + dy / 2,
                    ],
                }
            )
    return result
