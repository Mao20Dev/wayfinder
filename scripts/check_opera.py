"""UI smoke checks in the installed Opera executable, never global input.

Requires Playwright for Python. Does not use the user's existing windows,
cookies, clipboard, keyboard, or mouse. No other browser is launched.
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
opera_dir = Path(os.environ["LOCALAPPDATA"]) / "Programs/Opera"
executables = sorted(opera_dir.glob("*/opera.exe"), reverse=True)
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
    context = browser.new_context(viewport={"width": 1440, "height": 1250}, device_scale_factor=1)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://127.0.0.1:8000/", wait_until="networkidle", timeout=60000)
    page.locator(".route-card").nth(2).wait_for(timeout=30000)
    page.wait_for_selector(".maplibregl-canvas", timeout=30000)
    page.wait_for_function("!document.querySelector('.map-loading')", timeout=60000)
    page.screenshot(path=str(ARTIFACTS / "desktop.png"), full_page=True)
    page.locator(".route-card").nth(1).click()
    assert page.locator(".route-card").nth(1).get_attribute("aria-pressed") == "true"
    page.get_by_role("button", name="Checkpoints", exact=True).click()
    assert page.locator(".checkpoint-table tbody tr").count() > 5
    page.get_by_role("button", name="Close dialog").click()
    slider = page.get_by_role("slider", name="Forecast hours from reference time")
    slider.focus()
    slider.press("End")
    assert slider.input_value() == "48"
    page.get_by_role("button", name="Toggle perspective map").click()
    page.get_by_role("button", name="Wind", exact=True).click()
    page.get_by_role("button", name="Toggle weather overlay").click()
    page.get_by_role("button", name="Toggle weather overlay").click()
    page.screenshot(path=str(ARTIFACTS / "perspective.png"), full_page=True)
    page.get_by_role("button", name="How it works", exact=True).last.click()
    page.get_by_role("heading", name="A little foresight, explained").wait_for()
    page.get_by_role("button", name="Close dialog").click()
    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path=str(ARTIFACTS / "mobile.png"), full_page=True)
    overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth")
    assert not overflow, "Mobile page overflows horizontally"
    assert not errors, errors
    page.set_viewport_size({"width": 1440, "height": 1250})
    page.get_by_role("button", name="Live weather", exact=True).click()
    origin_input = page.get_by_role("combobox", name="Origin", exact=True)
    origin_input.fill("Chicago")
    page.get_by_role("option", name="Chicago, Illinois, United States", exact=True).wait_for(timeout=30000)
    page.get_by_role("option", name="Chicago, Illinois, United States", exact=True).click()
    assert origin_input.input_value() == "Chicago, Illinois, United States"
    local_departure = (datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M")
    page.get_by_label("Departure", exact=False).fill(local_departure)
    with page.expect_response(lambda response: "/api/analyze/" in response.url, timeout=150000) as analysis:
        page.get_by_role("button", name="Find safer routes", exact=True).click()
    assert analysis.value.status == 200
    live = analysis.value.json()
    assert live["mode"] == "live"
    assert live["weather_provider"] == "Open-Meteo"
    assert all(r["summary"]["complete"] for r in live["routes"])
    page.locator(".data-badge.live").wait_for(timeout=10000)
    page.screenshot(path=str(ARTIFACTS / "live-desktop.png"), full_page=True)
    assert not errors, errors
    print(
        json.dumps(
            {
                "browser": str(executables[0]),
                "javascript_errors": errors,
                "mobile_horizontal_overflow": overflow,
                "live_routes": len(live["routes"]),
                "live_complete": all(r["summary"]["complete"] for r in live["routes"]),
                "screenshots": ["desktop.png", "mobile.png", "perspective.png", "live-desktop.png"],
                "checks": [
                    "demo",
                    "map",
                    "route selection",
                    "checkpoint table",
                    "keyboard slider",
                    "perspective",
                    "weather layers",
                    "method dialog",
                    "mobile",
                    "live city search",
                    "live trip end to end",
                ],
            }
        )
    )
    browser.close()
