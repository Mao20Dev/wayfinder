# Public deployment

- Application: https://wayfinder-w1d0.onrender.com
- Repository: https://github.com/Mao20Dev/wayfinder
- Render workspace: `Projects-testing`; project: `My project`; environment: `Production`.
- Service: `wayfinder`, `srv-dblsapqfngtc73c6rgi0`.
- First deploy: `dep-dblsaq2fngtc73c6rha0`, application commit `7fa189169828f4bf3ee7a372ca5dcd59e3103d42`.
- Native Python 3.13.5 / Node 22.15.0, Oregon; **Free**, 0.1 CPU / 512 MB.
- One Gunicorn worker with six threads; frontend and API share the HTTPS origin.
- Build/start commands match `render.yaml`; health check is `/api/health/`.
- Render generates the production Django secret. Debug is disabled, HTTPS is enforced, and the generated Render hostname is allowed. No secrets were committed.

The repository was uploaded using the local Git Credential Manager account for `Mao20Dev`. Its GitHub Actions checks passed. This repository's local Git configuration enables the native account picker, without changing global Git settings.

The service was connected through its public Git URL in the user's existing Opera session. This is a manual deployment connection, not a claim that a GitHub webhook was installed. For a new release, push the intended commit, open the Render service and choose **Manual Deploy → Deploy latest commit**. Keep the compute plan Free. Do not create a second instance or attach a paid datastore.

Free instances sleep after 15 minutes without inbound traffic, clear in-memory analyses on restart and can take about a minute to wake. Saved routes remain in the visitor's browser, separate from server caches.

For a public Opera smoke test:

```powershell
$env:WAYFINDER_BASE_URL = 'https://wayfinder-w1d0.onrender.com'
python scripts/check_truck_opera.py
```

The current script uses isolated Opera to verify real TomTom truck routing, the vehicle profile, complete arrival forecasts, GPX export, local saves, the 48-hour slider and mobile layout. It never starts Google Maps navigation. It does not use existing user tabs, cookies or the clipboard. The earlier scripts and results below describe the historical car-profile release.

Public root and compiled assets returned 200, `/api/health/` returned the expected service identity, and HTTPS responses carried HSTS. The hosted app remains an assessment prototype with the routing and risk-model limitations documented in the README.


## Verified release

Application commit: `d7ae0c56475ab37a856ce0bcc5b138ce555d6497`.
Render deploy: `dep-dblsefui0phs7389f4q0` (live).
GitHub Actions: https://github.com/Mao20Dev/wayfinder/actions/runs/41937898888 (success).

The public Opera check passed with real Minneapolis?Detroit weather, three routes, departure comparison, persistent local saves, Maps URL handoff and mobile forecast; no JavaScript errors were observed. Google Maps navigation was intercepted during the automated test. A separate Chicago?Detroit API check returned three complete routes. See `VALIDATION.md` for the initial weather failure and successful subsequent checks.

Later documentation-only commits do not require rebuilding the running application.

## Truck routing release

- Application commit: `691d16a`.
- Render deploy: `dep-dblt2bijnfac73ddlvog`, live on November 4, 2026 (Colombia).
- GitHub Actions: https://github.com/Mao20Dev/wayfinder/actions/runs/41943409377 (success; actor Mao20Dev).
- A dedicated Routing API key was created in the user's TomTom account under Evaluation, without enabling a paid plan. It is stored only in the ignored local `.env` and the Render service environment. No key value is recorded here.
- Public health and configuration returned HTTP 200, with `routing_provider=TomTom truck` and `truck_routing_available=true`.
- The current public Opera smoke test passed all twelve checks: required profile, gross weight, complete real weather, non-navigable weather demo, hourly weather options, complete GPX track, saved profile, slider without API calls, mobile layout, cargo invalidation, fresh truck routes after departure changes and no Google Maps navigation. It returned three live truck routes with no JavaScript errors.
- An additional direct TomTom check requested `report=effectiveSettings`. The response confirmed commercial truck mode, height 4.12 m, width 2.60 m, length 21.34 m, gross weight 27,216 kg, maximum axle weight 7,712 kg and five axles for the documented test case. The private API key was excluded from the diagnostic artifact.

The previous release's Google Maps Start trip behavior has been removed. GPX is a planning track, not a truck navigator or a guarantee that every restriction is mapped. Configure a truck navigator with the same vehicle profile and review current restrictions before driving.
