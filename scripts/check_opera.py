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
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("WAYFINDER_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
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
    context.add_init_script("localStorage.setItem('wayfinder-language', 'es')")
    page = context.new_page()
    errors, requests = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on(
        "request",
        lambda request: (
            requests.append(request.url.removeprefix(BASE_URL)) if "/api/" in request.url else None
        ),
    )
    page.goto(f"{BASE_URL}/", wait_until="networkidle", timeout=60000)
    assert page.locator("html").get_attribute("lang") == "en"
    assert page.locator(".language-switch").count() == 0
    assert page.get_by_role("button", name="Compare routes", exact=True).is_enabled()
    assert not requests, "Opening the planner must not trigger an automatic weather request"
    assert not page.locator(".trip-options").get_attribute("open")
    page.wait_for_function("document.querySelectorAll('.endpoint-preview').length === 2")
    canvas = page.locator(".maplibregl-canvas")
    box = canvas.bounding_box()
    assert box and box["x"] == 0 and box["y"] == 0
    assert box["width"] == 1440 and box["height"] == 1100, "The map must fill the viewport"
    assert not page.evaluate("document.documentElement.scrollHeight > innerHeight"), (
        "The workspace must not scroll"
    )
    page.screenshot(path=str(ARTIFACTS / "planner-empty.png"), full_page=True)
    origin = page.get_by_role("combobox", name="Origin", exact=True)
    origin.fill("Seattle")
    page.get_by_role("option", name="Seattle, Washington, United States", exact=True).click(timeout=30000)
    destination = page.get_by_role("combobox", name="Destination", exact=True)
    destination.fill("Portland")
    page.get_by_role("option", name="Portland, Oregon, United States", exact=True).click(timeout=30000)
    page.wait_for_function(
        """() => {
      const pins = [...document.querySelectorAll('.endpoint-preview')];
      return pins.length === 2 && pins.every(pin => {
        const box = pin.getBoundingClientRect();
        return box.left + box.width / 2 >= 375 && box.left + box.width / 2 <= innerWidth - 75 && box.top + box.height / 2 >= 125 && box.top + box.height / 2 <= innerHeight - 100;
      });
    }""",
        timeout=15000,
    )
    assert sum("/api/analyze/" in url for url in requests) == 0, (
        "City selection must focus the map before route analysis"
    )
    page.screenshot(path=str(ARTIFACTS / "city-preview.png"), full_page=True)
    page.locator(".trip-options summary").click()
    page.get_by_role("button", name="10 mi", exact=True).click()
    assert "10 mi" in page.locator(".trip-options summary").inner_text()
    page.get_by_role("button", name="25 mi", exact=True).click()
    page.locator(".trip-options summary").click()
    pending = []
    page.route("**/api/analyze/", lambda route: pending.append(route))
    page.get_by_role("button", name="Try a Chicago", exact=False).click()
    page.locator(".search-status").wait_for()
    assert page.locator(".route-skeleton").count() == 3
    page.wait_for_function(
        """() => {
      const pins = [...document.querySelectorAll('.endpoint-preview.searching')];
      return pins.length === 2 && pins.every(pin => {
        const box = pin.getBoundingClientRect();
        return box.left + box.width / 2 >= 375 && box.left + box.width / 2 <= innerWidth - 350 && box.top + box.height / 2 >= 125 && box.top + box.height / 2 <= innerHeight - 100;
      });
    }""",
        timeout=15000,
    )
    page.screenshot(path=str(ARTIFACTS / "searching.png"), full_page=True)
    page.emulate_media(reduced_motion="reduce")
    assert (
        page.locator(".search-orbit").evaluate("element => getComputedStyle(element).animationName") == "none"
    )
    assert all(
        name == "none"
        for name in page.locator(".endpoint-ring").evaluate_all(
            "elements => elements.map(element => getComputedStyle(element).animationName)"
        )
    )
    page.emulate_media(reduced_motion="no-preference")
    assert pending, "The analysis request should be pending while the preview already focuses"
    pending[0].continue_()
    page.unroute("**/api/analyze/")
    page.locator(".route-card").nth(2).wait_for(timeout=30000)
    assert page.locator(".route-card").count() == 3
    assert page.locator(".map-route-picker").count() == 0
    assert page.locator(".mode-switch").count() == 0
    assert page.get_by_role("button", name="Use live weather", exact=True).is_visible()
    page.wait_for_function("!document.querySelector('.map-loading')", timeout=60000)
    canvas = page.locator(".maplibregl-canvas")
    box = canvas.bounding_box()
    assert box and box["width"] > 300 and box["height"] > 400, "Map canvas has a zero or undersized viewport"
    assert page.locator("html").get_attribute("lang") == "en"
    assert page.locator(".weather-pin").count() >= 3
    assert page.locator(".selected-route-chip").is_visible()
    assert "Best route" in page.locator(".selected-route-chip").inner_text()
    page.locator(".map-stage").screenshot(path=str(ARTIFACTS / "risk-road.png"))
    colors = Counter(Image.open(ARTIFACTS / "risk-road.png").convert("RGB").getdata())
    assert colors[(40, 132, 108)] > 100, "The map must render actual green road risk segments"
    page.screenshot(path=str(ARTIFACTS / "desktop.png"), full_page=True)

    page.locator(".route-card").nth(1).click()
    assert page.locator(".route-card").nth(1).get_attribute("aria-pressed") == "true"
    assert "Route 2" in page.locator(".selected-route-chip").inner_text()
    assert "Selected" in page.locator(".route-card").nth(1).inner_text()
    page.locator(".weather-pin").first.click()
    assert page.locator(".point-rule").is_visible()
    assert page.locator(".point-rule p").first.inner_text()
    page.screenshot(path=str(ARTIFACTS / "point-details.png"), full_page=True)
    page.locator(".point-detail").get_by_role("button", name="Close point details", exact=True).click()
    page.get_by_role("button", name="Weather details", exact=True).click()
    assert page.locator(".checkpoint-table tbody tr").count() > 5
    page.get_by_role("button", name="Close", exact=True).click()

    before = sum("/api/analyze/" in url for url in requests)
    with page.expect_response(lambda response: "/api/reassess/" in response.url) as reassessment:
        page.get_by_role("spinbutton", name="Cargo weight", exact=True).fill("45000")
    assert reassessment.value.status == 200
    changed = reassessment.value.json()
    assert changed["load_lb"] == 45000
    page.wait_for_function("document.querySelector('.results-column').getAttribute('aria-busy') === 'false'")
    assert page.locator(".route-card").nth(1).get_attribute("aria-pressed") == "true", (
        "Cargo changes must keep the manually selected route"
    )
    assert sum("/api/analyze/" in url for url in requests) == before, (
        "Cargo changes must reuse the saved forecast"
    )

    count = len(requests)
    page.get_by_role("button", name="48-hour forecast", exact=True).click()
    slider = page.get_by_role("slider", name="Forecast hour", exact=True)
    slider.focus()
    slider.press("End")
    assert slider.input_value() == "48"
    assert page.locator(".weather-pin").count() == 0
    assert len(requests) == count, "Forecast scrubbing must not call the backend"
    page.get_by_role("button", name="Perspective view", exact=True).click()
    page.get_by_role("button", name="Wind", exact=True).click()
    page.screenshot(path=str(ARTIFACTS / "perspective.png"), full_page=True)
    page.get_by_role("button", name="Along the route", exact=True).click()
    assert page.locator(".weather-pin").count() >= 3
    page.get_by_role("button", name="Perspective view", exact=True).click()

    assert page.locator("html").get_attribute("lang") == "en"
    page.get_by_role("button", name="Risk rules", exact=True).first.click()
    page.get_by_role("heading", name="Assessment risk rules", exact=True).wait_for()
    assert page.locator(".rules-table tbody tr").count() == 3
    page.get_by_role("button", name="Close", exact=True).click()
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_function("document.querySelectorAll('.weather-pin').length <= 3")
    page.get_by_role("button", name="48-hour forecast", exact=True).click()
    expect(page.locator(".forecast-dock")).to_be_visible()
    expect(page.locator(".floating-panel")).to_have_count(0)
    page.wait_for_function("document.querySelector('.map-canvas').getAttribute('aria-busy') === 'false'")
    page.screenshot(path=str(ARTIFACTS / "mobile-forecast.png"), full_page=True)
    page.get_by_role("button", name="Along the route", exact=True).click()
    expect(
        page.locator(".workspace-actions").get_by_role("button", name="Routes", exact=False)
    ).to_have_attribute("aria-pressed", "false")
    page.locator(".workspace-actions").get_by_role("button", name="Routes", exact=False).click()
    expect(
        page.locator(".workspace-actions").get_by_role("button", name="Routes", exact=False)
    ).to_have_attribute("aria-pressed", "true")
    page.wait_for_function("document.querySelector('.map-canvas').getAttribute('aria-busy') === 'false'")
    page.screenshot(path=str(ARTIFACTS / "mobile.png"), full_page=True)
    mobile_box = canvas.bounding_box()
    assert mobile_box and mobile_box["width"] == 390 and mobile_box["height"] == 844
    page.get_by_role("button", name="Hide routes", exact=True).click()
    page.get_by_role("button", name="Trip", exact=True).click()
    assert page.get_by_role("heading", name="Plan your trip").is_visible()
    page.get_by_role("button", name="Hide trip planner", exact=True).click()
    assert not page.evaluate("document.documentElement.scrollHeight > innerHeight"), (
        "Mobile map must stay fullscreen"
    )
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (
        "Mobile horizontal overflow"
    )
    page.set_viewport_size({"width": 1440, "height": 1100})
    page.wait_for_function("document.querySelector('.maplibregl-canvas').getBoundingClientRect().width > 600")

    expect(page.get_by_role("heading", name="Plan your trip")).to_be_visible()
    origin = page.get_by_role("combobox", name="Origin", exact=True)
    origin.fill("Chicago")
    page.get_by_role("option", name="Chicago, Illinois, United States", exact=True).click(timeout=30000)
    departure = (datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M")
    page.locator('input[type="datetime-local"]').fill(departure)
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
            "fullscreen canvas on desktop and mobile without page scrolling",
            "city selection focuses before any route response",
            "pending search rings and skeletons, no invented road",
            "distinct Best route and Selected labels",
            "collapsible floating panels",
            "mobile forecast gives the map room",
            "risk-colored road pixels",
            "weather pins",
            "route selection",
            "point explanations",
            "weather table",
            "cargo reassessment without new forecast",
            "independent 48h map",
            "perspective",
            "English only, including a previous Spanish preference",
            "no automatic provider calls",
            "one route selector",
            "collapsed sampling options",
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
