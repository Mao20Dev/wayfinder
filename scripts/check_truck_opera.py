"""Check real truck routing in isolated Opera; never drive or contact Google Maps."""

import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("WAYFINDER_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
PROFILE = {
    "Height": "13.5",
    "Width": "8.5",
    "Total length": "70",
    "Empty truck + trailer": "32000",
    "Axle count": "5",
    "Max loaded axle weight": "17000",
}


def main():
    executable = sorted(
        (Path(os.environ["LOCALAPPDATA"]) / "Programs/Opera").glob("*/opera.exe"), reverse=True
    )[0]
    artifacts = ROOT / "artifacts"
    artifacts.mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=str(executable),
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
        page.goto(BASE_URL, wait_until="networkidle", timeout=60000)
        expect(page.get_by_role("button", name="Compare truck routes", exact=True)).to_be_enabled()
        assert not page.locator(".truck-options").get_attribute("open")
        expect(page.locator(".truck-options summary")).to_contain_text("Example")
        assert not any("/api/analyze/" in call for call in calls)

        with page.expect_response(lambda r: "/api/analyze/" in r.url, timeout=30000) as response:
            page.get_by_role("button", name="Try a Chicago", exact=False).click()
        demo = response.value.json()
        assert demo["routing_profile"] == "weather_demo" and demo["vehicle"] is None
        assert len(demo["departure_window"]["routes"]["route-1"]["candidates"]) == 25
        expect(page.get_by_role("button", name="Export GPX", exact=True)).to_be_disabled()
        assert page.get_by_role("link", name="Start trip", exact=False).count() == 0
        page.get_by_role("button", name="Save route", exact=True).click()
        expect(page.locator(".saved-trip")).to_have_count(1)
        expect(page.locator(".saved-trip")).to_contain_text("Weather example")
        page.get_by_role("button", name="Close saved routes", exact=True).click()
        page.reload(wait_until="networkidle")
        page.get_by_role("button", name="Saved routes", exact=True).click()
        expect(page.locator(".saved-trip")).to_have_count(1)
        page.get_by_role("button", name="Close saved routes", exact=True).click()

        page.locator(".truck-options summary").click()
        for label, value in PROFILE.items():
            expect(page.get_by_role("spinbutton", name=label, exact=True)).to_have_value(value)
        page.get_by_label("Brand (optional)", exact=True).select_option("Volvo")
        expect(page.get_by_label("Truck type", exact=True)).to_have_value("example")
        expect(page.get_by_role("spinbutton", name="Height", exact=True)).to_have_value("13.5")
        expect(page.locator(".truck-gross")).to_have_text("Gross weight: 60,000 lb")
        with page.expect_response(lambda r: "/api/analyze/" in r.url, timeout=150000) as response:
            page.get_by_role("button", name="Compare truck routes", exact=True).click()
        assert response.value.status == 200, response.value.text()
        live = response.value.json()
        assert live["routing_profile"] == "truck" and live["routing_provider"] == "TomTom truck"
        assert live["gross_weight_lb"] == 60000
        assert live["vehicle_source"] == "example" and live["vehicle_brand"] == "Volvo"
        assert live["vehicle"]["height_ft"] == 13.5
        assert live["recommendation"]["route_id"], "Live forecast must be complete for an exportable route"
        assert all(route["summary"]["complete"] for route in live["routes"])
        assert not any(key.startswith("_") for key in live)
        page.wait_for_function(
            "document.querySelector('.map-canvas').getAttribute('aria-busy') === 'false'", timeout=60000
        )
        page.screenshot(path=str(artifacts / "truck-live-desktop.png"))
        with page.expect_download() as download:
            page.get_by_role("button", name="Export example GPX", exact=True).click()
        download.value.save_as(artifacts / "truck-planning-track.gpx")
        gpx = (artifacts / "truck-planning-track.gpx").read_text()
        selected = live["recommendation"]["route_id"]
        route = next(route for route in live["routes"] if route["id"] == selected)
        assert gpx.count("<trkpt ") == len(route["coordinates"])
        assert "60000 lb gross" in gpx
        assert "EXAMPLE TRUCK FOR TESTING" in gpx and "Volvo" in gpx
        page.get_by_role("button", name="Save route", exact=True).click()
        expect(page.locator(".saved-trip")).to_have_count(2)
        expect(page.locator(".saved-trip").first).to_contain_text("Example truck route")
        page.get_by_role("button", name="Close saved routes", exact=True).click()
        options = live["departure_window"]["routes"][selected]
        offset = next(
            candidate["offset_hours"]
            for candidate in options["candidates"]
            if candidate["offset_hours"] > 0 and candidate["summary"]["eligible"]
        )
        page.locator(".departure-summary").click()
        page.locator(".departure-options summary").click()
        with page.expect_response(lambda r: "/api/departure/" in r.url, timeout=150000) as shifted:
            page.locator(".departure-table tbody tr").nth(offset).get_by_role("button").click()
        assert shifted.value.status == 200, shifted.value.text()
        assert shifted.value.json()["departure_epoch"] == live["departure_epoch"] + offset * 3600
        assert shifted.value.json()["routing_profile"] == "truck"
        page.get_by_role("button", name="48-hour forecast", exact=True).click()
        before = len(calls)
        slider = page.get_by_role("slider", name="Forecast hour", exact=True)
        slider.focus()
        slider.press("End")
        assert len(calls) == before
        page.screenshot(path=str(artifacts / "truck-forecast-desktop.png"))
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_function(
            "document.querySelector('.map-canvas').getAttribute('aria-busy') === 'false'", timeout=60000
        )
        page.screenshot(path=str(artifacts / "truck-forecast-mobile.png"))
        assert not page.evaluate(
            "document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight"
        )
        page.set_viewport_size({"width": 1600, "height": 1000})
        page.get_by_role("button", name="Along the route", exact=True).click()
        # Example assumptions update automatically; custom profiles need actual axle loads.
        before = len(calls)
        page.get_by_role("spinbutton", name="Cargo weight", exact=True).fill("45000")
        page.locator(".truck-options summary").click()
        expect(page.get_by_role("spinbutton", name="Max loaded axle weight", exact=True)).to_have_value(
            "21817"
        )
        expect(page.get_by_role("button", name="Compare truck routes", exact=True)).to_be_enabled()
        page.get_by_label("Truck type", exact=True).select_option("custom")
        page.get_by_role("spinbutton", name="Cargo weight", exact=True).fill("40000")
        expect(page.get_by_role("spinbutton", name="Max loaded axle weight", exact=True)).to_have_value("")
        expect(page.locator(".trip-actions")).to_have_count(0)
        expect(page.get_by_role("button", name="Compare truck routes", exact=True)).to_be_disabled()
        assert len(calls) == before
        assert not errors, errors
        report = {
            "base_url": BASE_URL,
            "provider": live["routing_provider"],
            "live_routes": len(live["routes"]),
            "javascript_errors": errors,
            "checks": [
                "preselected example without manual setup",
                "optional brand does not change measurements",
                "60000 lb gross",
                "complete real forecast",
                "weather demo not navigable",
                "25 hourly weather options",
                "full track GPX",
                "saved truck profile",
                "48h slider without requests",
                "mobile without overflow",
                "cargo invalidates roads and axle measurement",
                "new departure rechecks truck routes",
                "no automatic Google Maps navigation",
            ],
        }
        (artifacts / "truck-validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report))
        browser.close()


if __name__ == "__main__":
    main()
