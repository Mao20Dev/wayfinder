# Wayfinder · Weather-Aware Truck Routing

A React + Django application for the Spotter Full Stack Developer assessment. Compare arrival-time weather exposure on three road routes, apply cargo-dependent risk rules, and explore an hourly corridor forecast from 0 to 48 hours.

**Live app:** [wayfinder-w1d0.onrender.com](https://wayfinder-w1d0.onrender.com) · **Repository:** [Mao20Dev/wayfinder](https://github.com/Mao20Dev/wayfinder).

Hosted as one Render Free Python web service in the `Projects-testing` workspace. Free instances sleep after inactivity, so the first visit can take around a minute. No paid service or database is required. The service currently uses the public Git repository source; subsequent releases can be started from **Manual Deploy** in Render.

## Run locally (Windows / PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# In .env, set DJANGO_DEBUG=true for local development.
npm ci --prefix frontend
npm run build --prefix frontend
.\.venv\Scripts\python.exe backend/manage.py collectstatic --noinput
.\scripts\start.ps1
```

Open **http://127.0.0.1:8000** in Opera. One local Waitress service serves both the built React frontend and the Django API. A local `.env` has already been generated in this workspace; it is ignored by Git. Never copy it into a public repository.

For frontend development, run Django on port 8000 and `npm run dev --prefix frontend` in another terminal. Vite proxies `/api` to Django. Vite is a build/development tool, not the production Python server.

## Try the application

- The interface is **English only**. The map fills the viewport from the first frame. The trip form floats on the left and route options appear on the right; both can be hidden. Mobile uses one scrollable bottom panel at a time. There is **no automatic analysis** or routing/weather call until you request routes.
- Choosing both cities immediately fits the map to them, before any route response. Camera padding accounts for the floating panels. During analysis, endpoint rings, a search status and placeholder cards show activity without drawing an invented road or a false percentage. Reduced-motion preferences disable the camera animation and pulses.
- Enter origin, destination, departure and cargo weight, then **Compare routes**. City suggestions use live geocoding; choose a suggestion to resolve coordinates. Live weather is the default.
- **Weather sampling** expands to the required 10/25/50-mile interval choices. The default is 25 miles. These are forecast lookups, not truck stops.
- A single set of route cards shows driving time, distance, estimated Severe/High miles, and distance-weighted average risk. **Best route** identifies the first-ranked eligible option under the assessment rules; exact ties show **Joint best**. **Selected** separately identifies the route being inspected, including when it is an alternative. The recommendation explains the deciding difference and any time cost.
- **Along the route** colors the selected road using weather at each point's estimated arrival. Labels show weather and ETA. Selecting a point opens its forecast and applied rule directly over the map; **Weather details** opens the complete table.
- **48-hour forecast** exposes the corridor heatmap, Risk/Wind/Rain/Snow layers and a 0–48-hour slider. The whole area shows a common forecast hour. Scrubbing does not change departure or recommendation and makes no API requests. Roads are neutral in this view.
- The forecast field uses a geographically registered raster, interpolating only within sampled cells. Low risk stays visible in green, missing values are gray, and unsampled territory remains transparent. Layer scales stay fixed across time. Area values are estimates; selecting a cell shows the actual hourly sample.
- **Best time to leave** compares 25 hourly departures from the original chosen departure through +24 hours for the selected route. It uses the same Severe miles → High miles → distance-weighted average order, excludes No Travel and incomplete options, and reports ties. **Use this departure** updates ETA, checkpoint weather, road colors and route rankings from cached forecasts, without provider calls. Roads and driving durations stay fixed; future traffic and breaks are not predicted.
- **Start trip** opens a Google Maps directions URL with the selected route's endpoints and up to three guide points. Maps recalculates its own directions; its exact road geometry is not guaranteed and the planned departure time must be set there. No paid Maps API or account integration is used. Demo results offer a preview, and blocked/incomplete routes cannot start.
- **Save route** stores up to ten trip snapshots on this device, not in a Google account. **Saved** opens the list, including Maps preview links and removal. Forecasts are not saved as current weather.
- **Risk rules** opens the full threshold and cargo-rule tables. Provider information and assumptions sit behind **Trip & data sources**; the car-profile limitation remains visible.
- **Try a Chicago → Detroit example** is optional and explicitly uses synthetic weather over three recorded OSRM road routes. It does not call forecast providers. **Use live weather** compares the trip against Open-Meteo instead.
- Changing only cargo automatically reassesses the stored forecast through Django without new routing/weather calls. Saved analyses expire after 15 minutes and the cache holds at most 24 trips; an expired trip prompts a fresh comparison.

Live analysis is limited separately to four requests/minute; demo exploration and city searches do not consume that counter. The UI preserves current results and shows a countdown when live analysis is temporarily limited.

## Assessment requirements in the interface

| Required behavior | Where to find it |
|---|---|
| Origin, destination, departure, cargo | Trip form; live forecasts are the default. |
| Three routing API alternatives and comparison | One set of selectable route cards, all routes on the map. |
| Weather every 10/25/50 miles at checkpoint ETA | Weather sampling options; map labels and Weather details table. |
| Weather thresholds and cargo overrides | Risk rules; applied rule when selecting a weather point. |
| Severe miles, High miles, weighted average, duration ranking | Route cards and the recommendation's deciding difference. |
| Corridor heatmap and 0–48-hour exploration | 48-hour forecast, with Risk/Wind/Rain/Snow layers and slider. |

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

Tests cover exact weather boundaries, decimal winds, strict cargo thresholds, unknown data, distance-weighted aggregation, ranking priorities and explanations, ties, ETA sampling, polyline continuity and risk colors, unit conversions, forecast intervals, provider contracts, cached cargo reassessment, input validation, API errors and separate throttling scopes. Unit tests do not depend on live provider availability.

`scripts/check_opera.py` runs additional checks using installed Opera with an isolated temporary profile. It needs Python Playwright and Pillow and does not use global input, existing tabs or the clipboard. It checks a fullscreen canvas without page scrolling, camera focus immediately after city selection, loading feedback while an analysis request is held, actual colored road pixels, weather labels, English despite an old Spanish preference, panel controls, mobile layout, a real live trip, cargo reassessment without a new forecast and countdown feedback. The held request subsequently continues to the real backend; no road or weather results are fabricated for that check. The final 429 feedback check uses an explicitly mocked response. Screenshots and the report are written to ignored `artifacts/`.

`scripts/check_trip_planning_opera.py` verifies the continuous forecast field, a cached departure change, persistence after reload, a Maps popup intercepted before any data reach Google, and a live Minneapolis–Detroit trip on desktop/mobile. The actual Google Maps account or navigation interface is not controlled by this app. See [Maps URLs documentation](https://developers.google.com/maps/documentation/urls/get-started).

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
