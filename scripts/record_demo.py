"""Explicit maintenance command: record genuine API routes, never a CI network call."""

import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django  # noqa: E402

django.setup()
from routing.providers import osrm_routes  # noqa: E402
from routing.service import DEMO_DESTINATION, DEMO_ORIGIN  # noqa: E402

routes = osrm_routes(DEMO_ORIGIN, DEMO_DESTINATION)
payload = {
    "source": "https://routing.openstreetmap.de/",
    "attribution": "OpenStreetMap contributors; OSRM; FOSSGIS",
    "recorded_at": datetime.now(UTC).isoformat(),
    "note": "Real road geometry and annotated times. Weather is generated separately as an explicitly synthetic scenario.",
    "routes": routes,
}
(ROOT / "backend/routing/fixtures/demo_routes.json").write_text(
    json.dumps(payload, separators=(",", ":")), encoding="utf-8"
)
print("Recorded", len(routes), "genuine routes:")
for route in routes:
    print(
        route["id"],
        round(route["distance_meters"] / 1609.344, 1),
        "mi",
        round(route["duration_seconds"] / 3600, 1),
        "h",
        "comparison waypoint:",
        route["via_comparison_point"],
    )
