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


def interval_risk(a, b):
    """Use this same interval rule for totals and the colored road geometry."""
    if Risk.NO_TRAVEL in (a, b):
        return int(Risk.NO_TRAVEL)
    return None if a is None or b is None else max(a, b)


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
    cargo_rule = None
    if valid(w):
        if w >= 55:
            cargo_rule = "wind_55"
        elif w >= 45 and load_lb > 30_000:
            cargo_rule = "wind_45_load_30000"
        elif w >= 35 and load_lb > 40_000:
            cargo_rule = "wind_35_load_40000"
    return {
        "risk": risk,
        "risk_label": LABELS[risk] if risk is not None else "Unknown",
        "complete": complete,
        "factors": values,
        "cargo_rule": cargo_rule,
        "drivers": [name for name, level in values.items() if risk is not None and level == risk],
    }


def summarize(checkpoints, total_miles):
    miles = [0.0] * 5
    unknown = 0.0
    for a, b in zip(checkpoints, checkpoints[1:], strict=False):
        length = b["mile"] - a["mile"]
        # Each sample represents both adjacent intervals conservatively.
        level = interval_risk(a["risk"], b["risk"])
        if level is None:
            unknown += length
        else:
            miles[level] += length
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
            "decision": {"criterion": "none"},
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
    fastest = min(eligible, key=lambda route: route["duration_seconds"])
    decision = {
        "criterion": "only_eligible",
        "comparison_route_id": None,
        "advantage": None,
        "extra_minutes_vs_fastest": (best["duration_seconds"] - fastest["duration_seconds"]) / 60,
        "eligible_count": len(eligible),
    }
    label = best["id"].replace("route-", "Route ")
    reason = f"{label} is the only route with complete weather and no No Travel exposure."
    if len(tied) > 1:
        decision["criterion"] = "tie"
        reason = "Multiple routes tie on all four ranking criteria."
    elif len(ordered) > 1:
        runner_up = ordered[1]
        criteria = ["severe_miles", "high_miles", "average_risk", "duration_seconds"]
        index = next(i for i, (a, b) in enumerate(zip(key(best), key(runner_up), strict=True)) if a != b)
        advantage = key(runner_up)[index] - key(best)[index]
        decision.update(
            {"criterion": criteria[index], "comparison_route_id": runner_up["id"], "advantage": advantage}
        )
        units = [
            "fewer Severe miles",
            "fewer High miles",
            "less distance-weighted risk",
            "seconds less driving",
        ]
        reason = f"{label} wins with {advantage:.2f} {units[index]} than the next eligible option."
    return {
        "route_id": best["id"],
        "tied_route_ids": tied if len(tied) > 1 else [],
        "reason": reason,
        "decision": decision,
    }
