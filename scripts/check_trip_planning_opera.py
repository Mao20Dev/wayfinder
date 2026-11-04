"""Verify the forecast, departure comparison, Maps links and local saves in Opera.

The Maps destination is intercepted in the isolated browser: no location data
are sent to Google during this check, and no Google account save is claimed.
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from PIL import Image
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
EXECUTABLE = sorted((Path(os.environ["LOCALAPPDATA"]) / "Programs/Opera").glob("*/opera.exe"), reverse=True)[
    0
]


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=str(EXECUTABLE),
        headless=True,
        args=[
            "--no-first-run",
            "--disable-extensions",
            "--enable-unsafe-swiftshader",
            "--use-angle=swiftshader",
        ],
    )
    context = browser.new_context(viewport={"width": 1600, "height": 1000})
    page = context.new_page()
    errors, calls = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: calls.append(request.url) if "/api/" in request.url else None)
    page.goto("http://127.0.0.1:8000/", wait_until="networkidle", timeout=60000)
    with page.expect_response(lambda response: "/api/analyze/" in response.url, timeout=30000) as analysis:
        page.get_by_role("button", name="Try a Chicago", exact=False).click()
    assert analysis.value.status == 200
    demo = analysis.value.json()
    assert not any(key.startswith("_") for key in demo)
    assert len(demo["departure_window"]["routes"]["route-1"]["candidates"]) == 25
    page.wait_for_function("!document.querySelector('.map-loading')", timeout=60000)
    page.get_by_role("button", name="48-hour forecast", exact=True).click()
    page.wait_for_function("document.querySelector('.map-canvas').getAttribute('aria-busy') === 'false'")
    page.screenshot(path=str(ARTIFACTS / "forecast-field.png"), full_page=True)
    pixels = Image.open(ARTIFACTS / "forecast-field.png").convert("RGB")
    colored = sum(
        1 for red, green, blue in pixels.getdata() if green - red > 20 and green - blue > 10 and red > 60
    )
    assert colored > 10000, "The field must show contiguous low-risk coverage, not sparse invisible dots"
    page.get_by_role("button", name="Along the route", exact=True).click()
    selected = page.locator(".route-card[aria-pressed=true]").get_attribute("data-route-id")
    options = demo["departure_window"]["routes"][selected]
    offset = options["best_offset_hours"]
    with page.expect_response(lambda response: "/api/departure/" in response.url) as shifted:
        if offset and page.get_by_role("button", name="Use this departure", exact=True).count():
            page.get_by_role("button", name="Use this departure", exact=True).click()
        else:
            offset = next(
                candidate["offset_hours"]
                for candidate in options["candidates"]
                if candidate["offset_hours"] > 0 and candidate["summary"]["eligible"]
            )
            page.locator(".departure-summary").click()
            page.locator(".departure-options summary").click()
            page.locator(".departure-table tbody tr").nth(offset).get_by_role("button").click()
    assert shifted.value.status == 200
    changed = shifted.value.json()
    assert changed["departure_epoch"] == demo["departure_epoch"] + offset * 3600
    assert changed["analysis_id"] != demo["analysis_id"]
    assert not any(key.startswith("_") for key in changed)
    expect(page.locator(".stale-note")).to_have_count(0)
    assert sum("/api/analyze/" in url for url in calls) == 1
    expect(page.locator(".trip-actions")).to_be_visible()
    page.screenshot(path=str(ARTIFACTS / "departure-applied.png"), full_page=True)
    page.get_by_role("button", name="Save route", exact=True).click()
    expect(page.locator(".saved-trip")).to_have_count(1)
    saved_link = page.locator(".saved-trip a")
    url = saved_link.get_attribute("href")
    assert url.startswith("https://www.google.com/maps/dir/?api=1") and "waypoints=" in url
    context.route(
        "https://www.google.com/maps/**",
        lambda route: route.fulfill(
            status=200, content_type="text/html", body="<p>Maps handoff intercepted for this test.</p>"
        ),
    )
    with page.expect_popup() as maps_page:
        saved_link.click()
    assert maps_page.value.url == url
    maps_page.value.close()
    page.get_by_role("button", name="Close saved routes", exact=True).click()
    page.reload(wait_until="networkidle")
    page.get_by_role("button", name="Saved routes", exact=True).click()
    expect(page.locator(".saved-trip")).to_have_count(1)
    page.get_by_role("button", name="Close saved routes", exact=True).click()

    origin = page.get_by_role("combobox", name="Origin", exact=True)
    origin.fill("Minneapolis")
    page.get_by_role("option", name="Minneapolis, Minnesota, United States", exact=True).click(timeout=30000)
    page.locator('input[type="datetime-local"]').fill(
        (datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M")
    )
    with page.expect_response(
        lambda response: "/api/analyze/" in response.url, timeout=150000
    ) as live_response:
        page.get_by_role("button", name="Compare routes", exact=True).click()
    assert live_response.value.status == 200, live_response.value.text()
    live = live_response.value.json()
    assert live["mode"] == "live" and live["weather_provider"] == "Open-Meteo"
    assert live["recommendation"]["route_id"]
    expect(page.get_by_role("link", name="Start trip", exact=False)).to_be_visible()
    assert "dir_action=navigate" in page.get_by_role("link", name="Start trip", exact=False).get_attribute(
        "href"
    )
    page.wait_for_function("document.querySelector('.map-canvas').getAttribute('aria-busy') === 'false'")
    page.screenshot(path=str(ARTIFACTS / "centered-minneapolis.png"), full_page=True)
    page.get_by_role("button", name="48-hour forecast", exact=True).click()
    page.wait_for_function("document.querySelector('.map-canvas').getAttribute('aria-busy') === 'false'")
    page.screenshot(path=str(ARTIFACTS / "live-forecast-field.png"), full_page=True)
    before = len(calls)
    page.get_by_role("slider", name="Forecast hour", exact=True).focus()
    page.get_by_role("slider", name="Forecast hour", exact=True).press("End")
    assert len(calls) == before
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_role("button", name="48-hour forecast", exact=True).click()
    expect(page.locator(".forecast-dock")).to_be_visible()
    expect(page.locator(".floating-panel")).to_have_count(0)
    page.wait_for_function("document.querySelector('.map-canvas').getAttribute('aria-busy') === 'false'")
    page.screenshot(path=str(ARTIFACTS / "mobile-forecast-field.png"), full_page=True)
    assert not page.evaluate(
        "document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight"
    )
    assert not errors, errors
    report = {
        "browser": str(EXECUTABLE),
        "javascript_errors": errors,
        "live_routes": len(live["routes"]),
        "checks": [
            "continuous forecast coverage",
            "25 departure candidates",
            "cached departure updates",
            "route save survives reload",
            "Maps handoff intercepted",
            "Start trip URL",
            "live Minneapolis to Detroit",
            "48h exploration without new requests",
            "mobile forecast",
        ],
    }
    (ARTIFACTS / "trip-planning-validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))
    browser.close()
