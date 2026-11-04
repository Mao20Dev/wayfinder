"""Pure domain rules. No HTTP, framework, rounding, or presentation logic."""

from enum import IntEnum
from math import isfinite


class Risk(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4


LABELS = ["Low", "Moderate", "High", "Severe", "No Travel"]


def valid(value):
    return isinstance(value, (int, float)) and isfinite(value) and value >= 0


def wind_risk(mph, load_lb):
    if mph >= 55 or (mph >= 45 and load_lb > 30_000):
        return Risk.NO_TRAVEL
    if mph >= 45 or (mph >= 35 and load_lb > 40_000):
        return Risk.SEVERE
    if mph >= 35:
        return Risk.HIGH
    return Risk.MODERATE if mph >= 25 else Risk.LOW


def accumulation_risk(value, moderate, high, severe, no_travel):
    if value > no_travel:
        return Risk.NO_TRAVEL
    if value >= severe:
        return Risk.SEVERE
    if value >= high:
        return Risk.HIGH
    return Risk.MODERATE if value >= moderate else Risk.LOW


def classify(weather, load_lb):
    """Preserve known prohibitions even if another weather field is missing."""
    fields = ("wind_mph", "rain_in_hr", "snow_in_hr")
    w, r, s = (weather.get(field) for field in fields)
    values = {
        "wind": wind_risk(w, load_lb) if valid(w) else None,
        "rain": accumulation_risk(r, 0.10, 0.25, 0.50, 1.0) if valid(r) else None,
        "snow": accumulation_risk(s, 0.5, 1.0, 2.0, 3.0) if valid(s) else None,
    }
    known = [int(x) for x in values.values() if x is not None]
    complete = len(known) == 3
    risk = max(known) if known and (complete or Risk.NO_TRAVEL in known) else None
    return {
        "risk": risk,
        "risk_label": LABELS[risk] if risk is not None else "Unknown",
        "complete": complete,
        "factors": values,
    }


def summarize(checkpoints, total_miles):
    miles = [0.0] * 5
    unknown = 0.0
    for a, b in zip(checkpoints, checkpoints[1:], strict=False):
        length = b["mile"] - a["mile"]
        # Each sample represents both adjacent intervals conservatively.
        levels = (a["risk"], b["risk"])
        if Risk.NO_TRAVEL in levels:
            miles[Risk.NO_TRAVEL] += length
        elif None in levels:
            unknown += length
        else:
            miles[max(levels)] += length
    complete = all(c["complete"] for c in checkpoints)
    blocked = any(c["risk"] == Risk.NO_TRAVEL for c in checkpoints)
    average = sum(i * n for i, n in enumerate(miles)) / total_miles if complete and total_miles else None
    return {
        "miles_by_risk": miles,
        "unknown_miles": unknown,
        "average_risk": average,
        "complete": complete,
        "eligible": complete and not blocked,
        "status": "blocked" if blocked else "ready" if complete else "incomplete",
        "max_risk": max((c["risk"] for c in checkpoints if c["risk"] is not None), default=None),
    }


def recommend(routes):
    eligible = [r for r in routes if r["summary"]["eligible"]]
    if not eligible:
        return {
            "route_id": None,
            "tied_route_ids": [],
            "reason": "No route has complete weather coverage without No Travel exposure.",
        }

    def key(route):
        s = route["summary"]
        return (
            s["miles_by_risk"][Risk.SEVERE],
            s["miles_by_risk"][Risk.HIGH],
            s["average_risk"],
            route["duration_seconds"],
        )

    ordered = sorted(eligible, key=lambda r: (*key(r), r["id"]))
    best = ordered[0]
    tied = [r["id"] for r in ordered if key(r) == key(best)]
    return {
        "route_id": best["id"],
        "tied_route_ids": tied if len(tied) > 1 else [],
        "reason": "Fewest Severe miles, then fewest High miles, lowest distance-weighted risk, then shortest travel time.",
    }
