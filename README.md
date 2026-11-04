# Wayfinder · Weather-Aware Truck Routing

A React + Django application for the Spotter Full Stack Developer assessment. Compare arrival-time weather exposure on three road routes, apply cargo-dependent risk rules, and explore an hourly corridor forecast from 0 to 48 hours.

## Run locally (Windows / PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
# In .env, set DJANGO_DEBUG=true for local development.
npm ci --prefix frontend
npm run build --prefix frontend
.\.venv\Scripts\python.exe backend/manage.py collectstatic --noinput
.\scripts\start.ps1
```

Open **http://127.0.0.1:8000** in Opera. One local Waitress service serves both the built React frontend and the Django API. A local `.env` has already been generated in this workspace; it is ignored by Git. Never copy it into a public repository.

For frontend development, run Django on port 8000 and `npm run dev --prefix frontend` in another terminal. Vite proxies `/api` to Django. Vite is a build/development tool, not the production Python server.

## Try the application

- **Demo scenario** starts automatically: three recorded OSRM road routes from Chicago to Detroit with clearly labeled **synthetic weather**. No forecast calls occur. Adjust cargo and spacing, then analyze again. The demo starts at the forecast reference hour; departure and city inputs are fixed.
- **Live weather** searches cities, calculates actual road routes and fetches Open-Meteo hourly forecasts. The default provider needs no API key. Select cities from suggestions, choose a future departure and analyze. A cold trip can take tens of seconds because weather requests are batched and paced to respect free service limits.
- Select routes or checkpoints, inspect arrival conditions, open the full checkpoint table, choose a weather layer and scrub the 0–48h timeline. The perspective button tilts the real map. It does not claim to display elevation or real terrain.

**Provider distinction:** without `TOMTOM_API_KEY`, routes use the public OSRM **car profile**. Truck dimensions, legal truck access, gross weight and driving breaks are not modeled. Cargo is used only in the supplied weather-risk rules. When natural alternatives are scarce, up to two API requests via explicit comparison waypoints may supply additional genuine routes. These detours are labeled. If fewer than three distinct routes are available, the app displays the actual count and does not duplicate routes.

## Optional TomTom truck routing

Add `TOMTOM_API_KEY=...` to the ignored `.env`, or the host's secret environment, then restart Django. The adapter uses TomTom Routing v1 with `travelMode=truck`, `maxAlternatives=2`, `departAt` and cumulative distance/travel-time progress. Cargo weight is not incorrectly passed as gross vehicle weight. The adapter has mocked contract tests; end-to-end TomTom verification requires an actual key.

## Publish on Render Free

The included `render.yaml` defines **one Python web service**. It installs Python dependencies, builds React with Node, collects static files and starts Gunicorn with one worker and six threads. Django/WhiteNoise serve the browser files and Django handles `/api/*` on the same domain. No persistent database is required.

1. Publish this directory as a separate GitHub repository. Do not include the parent job-search folder.
2. Connect the repository to a Render Blueprint, using `render.yaml` and the Free plan.
3. Let Render generate `DJANGO_SECRET_KEY`. `DJANGO_DEBUG=false` is already declared. The Render hostname is automatically added to allowed hosts. A custom hostname requires adding it to `DJANGO_ALLOWED_HOSTS`.
4. Keep `TOMTOM_API_KEY` optional and secret. Do not enable a paid plan or attach a payment method for this assessment.
5. Verify `/api/health/`, the demo and a live trip from the public address.

Render Free can sleep after 15 minutes without traffic. The next request may take about a minute to wake it. Its filesystem and in-memory caches are ephemeral. Do not promise permanent availability or production-scale throughput. Configure only one worker/replica: the public-provider pacing and caches are process-local. Scaling requires a shared rate limiter/cache.

For another container host, `Dockerfile` builds the same app. Set a strong runtime `DJANGO_SECRET_KEY` and explicit `DJANGO_ALLOWED_HOSTS`. Enable HTTPS redirects and trusted proxy settings appropriate to that host.

## Verify

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\ruff.exe check backend scripts
.\.venv\Scripts\ruff.exe format --check backend scripts
npm run build --prefix frontend
npm run format:check --prefix frontend
npm test --prefix frontend
.\.venv\Scripts\python.exe backend/manage.py check
```

Tests cover exact weather boundaries, decimal winds, strict cargo thresholds, unknown data, distance-weighted aggregation, ranking priorities, ties, ETA sampling, endpoint inclusion, unit conversions, forecast intervals, provider contracts, input validation, API errors and throttling. Tests do not depend on live provider availability.

`scripts/check_opera.py` runs additional browser checks using the locally installed Opera executable with an isolated temporary profile. It needs Python Playwright and does not use global input, existing browser tabs or the clipboard. Screenshots are written to ignored `artifacts/`.

## Repository map

```text
backend/config/             Django configuration, URLs, WSGI
backend/routing/risk.py      Pure, framework-independent business rules
backend/routing/geometry.py  Distance sampling and corridor grid
backend/routing/weather.py   Temporal sampling and unit conversion
backend/routing/providers.py External API adapters, caching and pacing
backend/routing/service.py   Trip-analysis orchestration
backend/routing/tests/      Domain, adapter and API tests
frontend/src/              React UI, MapLibre layers and time controls
docs/                      Architecture, decisions, validation, walkthrough
render.yaml                Single-service deployment
```

See [architecture and decisions](docs/ARCHITECTURE.md), [risk assumptions](docs/RISK_RULES.md), [walkthrough](docs/WALKTHROUGH_ES.md) and [delivery checklist](docs/DELIVERY_CHECKLIST.md).

## Attribution and assistance

Road geometry: © OpenStreetMap contributors; OSRM; FOSSGIS public routing server. Map display: OpenFreeMap / OpenMapTiles / OpenStreetMap, with attribution kept on the map. Weather: Open-Meteo (CC BY 4.0); data are converted into assessment-specific risk categories. The synthetic demo is not observed or forecast weather.

UI craft follows Emil Kowalski's [Apple Design skill](https://github.com/emilkowalski/skills/tree/main/skills/apple-design): immediate feedback, restrained motion, material depth, accessible controls and reduced-motion support. This is not an official Apple or Spotter product.

Implementation was prepared with Codex assistance at Mauro Uribe's request. Mauro should review and understand the implementation before presenting it, and disclose assistance according to the evaluator's policy. No exclusive unaided-authorship claim is made. Source instructions reviewed did not specify an explicit assessment AI policy; that remains a clarification to obtain if required.
