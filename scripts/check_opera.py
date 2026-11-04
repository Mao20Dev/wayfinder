"""Exercise the real UI in installed Opera with an isolated temporary profile.

No global keyboard/mouse/clipboard, other windows or existing cookies are used.
Only the final error-feedback checks mock a response; screenshots label those
as test artifacts and are never passed off as provider results.
"""

import json
import os
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
executables = sorted((Path(os.environ["LOCALAPPDATA"]) / "Programs/Opera").glob("*/opera.exe"), reverse=True)
if not executables:
    raise SystemExit("Installed Opera executable not found.")


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=str(executables[0]),
        headless=True,
        args=[
            "--no-first-run",
            "--disable-extensions",
            "--enable-unsafe-swiftshader",
            "--use-angle=swiftshader",
        ],
    )
    context = browser.new_context(viewport={"width": 1440, "height": 1100}, device_scale_factor=1)
    page = context.new_page()
    errors, requests = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on(
        "request",
        lambda request: requests.append(request.url.split("8000")[-1]) if "/api/" in request.url else None,
    )
    page.goto("http://127.0.0.1:8000/", wait_until="networkidle", timeout=60000)
    page.locator(".route-card").nth(2).wait_for(timeout=30000)
    page.wait_for_function("!document.querySelector('.map-loading')", timeout=60000)
    canvas = page.locator(".maplibregl-canvas")
    box = canvas.bounding_box()
    assert box and box["width"] > 300 and box["height"] > 400, "Map canvas has a zero or undersized viewport"
    assert page.locator("html").get_attribute("lang") == "es"
    assert page.locator(".weather-pin").count() >= 3
    page.locator(".map-stage").screenshot(path=str(ARTIFACTS / "risk-road.png"))
    colors = Counter(Image.open(ARTIFACTS / "risk-road.png").convert("RGB").getdata())
    assert colors[(40, 132, 108)] > 100, "The map must render actual green road risk segments"
    page.screenshot(path=str(ARTIFACTS / "desktop.png"), full_page=True)

    page.locator(".map-route-picker button").nth(1).click()
    assert page.locator(".route-card").nth(1).get_attribute("aria-pressed") == "true"
    page.locator(".weather-pin").first.click()
    assert page.locator(".point-rule").is_visible()
    assert page.locator(".point-rule p").first.inner_text()
    page.locator(".point-detail").get_by_role("button", name="Cerrar", exact=True).click()
    page.get_by_role("button", name="Ver puntos de clima", exact=True).click()
    assert page.locator(".checkpoint-table tbody tr").count() > 5
    page.get_by_role("button", name="Cerrar", exact=True).click()

    before = sum("/api/analyze/" in url for url in requests)
    with page.expect_response(lambda response: "/api/reassess/" in response.url) as reassessment:
        page.get_by_role("spinbutton", name="Peso de la carga", exact=True).fill("45000")
    assert reassessment.value.status == 200
    changed = reassessment.value.json()
    assert changed["load_lb"] == 45000
    page.wait_for_function("document.querySelector('.results-column').getAttribute('aria-busy') === 'false'")
    assert sum("/api/analyze/" in url for url in requests) == before, (
        "Cargo changes must reuse the saved forecast"
    )

    count = len(requests)
    page.get_by_role("button", name="Explorar próximas 48 h", exact=True).click()
    slider = page.get_by_role("slider", name="Explorar próximas 48 h", exact=True)
    slider.focus()
    slider.press("End")
    assert slider.input_value() == "48"
    assert page.locator(".weather-pin").count() == 0
    assert len(requests) == count, "Forecast scrubbing must not call the backend"
    page.get_by_role("button", name="Vista en perspectiva", exact=True).click()
    page.get_by_role("button", name="Viento", exact=True).click()
    page.screenshot(path=str(ARTIFACTS / "perspective.png"), full_page=True)
    page.get_by_role("button", name="Clima durante el viaje", exact=True).click()
    assert page.locator(".weather-pin").count() >= 3

    page.get_by_role("button", name="EN", exact=True).click()
    assert page.locator("html").get_attribute("lang") == "en"
    page.get_by_role("button", name="How risk is calculated", exact=True).first.click()
    page.get_by_role("heading", name="Assessment risk rules", exact=True).wait_for()
    assert page.locator(".rules-table tbody tr").count() == 3
    page.get_by_role("button", name="Close", exact=True).click()
    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path=str(ARTIFACTS / "mobile.png"), full_page=True)
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (
        "Mobile horizontal overflow"
    )
    page.set_viewport_size({"width": 1440, "height": 1100})

    page.get_by_role("button", name="My real trip", exact=True).click()
    origin = page.get_by_role("combobox", name="Origin", exact=True)
    origin.fill("Chicago")
    page.get_by_role("option", name="Chicago, Illinois, United States", exact=True).click(timeout=30000)
    departure = (datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M")
    page.get_by_label("Departure date and time", exact=False).fill(departure)
    with page.expect_response(lambda response: "/api/analyze/" in response.url, timeout=150000) as analysis:
        page.get_by_role("button", name="Compare routes", exact=True).click()
    assert analysis.value.status == 200
    live = analysis.value.json()
    assert live["mode"] == "live" and live["weather_provider"] == "Open-Meteo"
    assert all(route["summary"]["complete"] for route in live["routes"])
    page.locator(".data-badge.live").wait_for()
    page.screenshot(path=str(ARTIFACTS / "live-desktop.png"), full_page=True)
    before = sum("/api/analyze/" in url for url in requests)
    with page.expect_response(lambda response: "/api/reassess/" in response.url) as reassessment:
        page.get_by_role("spinbutton", name="Cargo weight", exact=True).fill("28000")
    assert reassessment.value.status == 200
    assert sum("/api/analyze/" in url for url in requests) == before
    page.wait_for_function("document.querySelector('.results-column').getAttribute('aria-busy') === 'false'")

    page.route(
        "**/api/analyze/",
        lambda route: route.fulfill(
            status=429,
            content_type="application/json",
            body=json.dumps({"error": "Test-only throttled response", "retry_after_seconds": 2}),
        ),
    )
    page.get_by_role("button", name="Compare routes", exact=True).click()
    page.get_by_text("You can check live weather again in 2 seconds.", exact=False).wait_for()
    assert page.get_by_role("button", name="Available in", exact=False).is_disabled()
    page.get_by_role("button", name="Compare routes", exact=True).wait_for(timeout=5000)
    page.unroute("**/api/analyze/")
    assert not errors, errors
    report = {
        "browser": str(executables[0]),
        "javascript_errors": errors,
        "live_routes": len(live["routes"]),
        "live_complete": True,
        "checks": [
            "nonzero map canvas",
            "risk-colored road pixels",
            "weather pins",
            "route selection",
            "point explanations",
            "weather table",
            "cargo reassessment without new forecast",
            "independent 48h map",
            "perspective",
            "Spanish/English",
            "rule table",
            "mobile layout",
            "real city search",
            "live trip",
            "429 countdown and result preservation",
        ],
    }
    (ARTIFACTS / "browser-validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))
    browser.close()
