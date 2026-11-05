"""Check real truck routing in isolated Opera; never drive or contact Google Maps."""

import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

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
        expect(page.get_by_role("link", name="Open in Google Maps", exact=True)).to_be_visible()
        assert "dir_action=navigate" not in page.get_by_role(
            "link", name="Open in Google Maps", exact=True
        ).get_attribute("href")
        assert page.get_by_role("button", name="Export", exact=False).count() == 0
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
        assert live["recommendation"]["route_id"], "Live forecast must be complete for a route handoff"
        assert all(route["summary"]["complete"] for route in live["routes"])
        assert not any(key.startswith("_") for key in live)
        page.wait_for_function(
            "document.querySelector('.map-canvas').getAttribute('aria-busy') === 'false'", timeout=60000
        )
        page.screenshot(path=str(artifacts / "truck-live-desktop.png"))
        link = page.get_by_role("link", name="Open in Google Maps", exact=True)
        maps_url = link.get_attribute("href")
        assert maps_url.startswith("https://www.google.com/maps/dir/?api=1")
        assert "dir_action=navigate" in maps_url and "waypoints=" in maps_url
        context.route(
            "https://www.google.com/maps/**",
            lambda route: route.fulfill(
                status=200, content_type="text/html", body="<p>Maps handoff intercepted for verification.</p>"
            ),
        )
        with page.expect_popup() as popup:
            link.click()
        assert popup.value.url == maps_url
        popup.value.close()
        selected = live["recommendation"]["route_id"]
        page.get_by_role("button", name="Save route", exact=True).click()
        expect(page.locator(".saved-trip")).to_have_count(2)
        expect(page.locator(".saved-trip").first).to_contain_text("Example truck route")
        expect(
            page.locator(".saved-trip").first.get_by_role("link", name="Open in Google Maps", exact=True)
        ).to_have_attribute("href", maps_url)
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
        # Personal walkthrough example: use actual geocoded Colombian cities.
        page.get_by_label("Truck type", exact=True).select_option("example")
        page.get_by_role("spinbutton", name="Cargo weight", exact=True).fill("28000")
        page.get_by_role("combobox", name="Origin", exact=True).fill("Cucuta")
        page.get_by_role("option").filter(has_text="Colombia").first.click(timeout=30000)
        page.get_by_role("combobox", name="Destination", exact=True).fill("Bucaramanga")
        page.get_by_role("option").filter(has_text="Colombia").first.click(timeout=30000)
        with page.expect_response(
            lambda response: "/api/analyze/" in response.url, timeout=150000
        ) as colombia_response:
            page.get_by_role("button", name="Compare truck routes", exact=True).click()
        assert colombia_response.value.status == 200, colombia_response.value.text()
        colombia = colombia_response.value.json()
        assert colombia["routing_provider"] == "TomTom truck" and colombia["routes"]
        assert all(route["summary"]["complete"] for route in colombia["routes"])
        page.wait_for_function(
            "document.querySelector('.map-canvas').getAttribute('aria-busy') === 'false'", timeout=60000
        )
        page.screenshot(path=str(artifacts / "colombia-live-desktop.png"))
        chosen = next(
            (route for route in colombia["routes"] if route["id"] == colombia["recommendation"]["route_id"]),
            colombia["routes"][0],
        )
        if chosen["summary"]["eligible"]:
            params = parse_qs(
                urlsplit(
                    page.get_by_role("link", name="Open in Google Maps", exact=True).get_attribute("href")
                ).query
            )
            first, last = chosen["coordinates"][0], chosen["coordinates"][-1]
            assert params["origin"] == [f"{first[1]:.5f},{first[0]:.5f}"]
            assert params["destination"] == [f"{last[1]:.5f},{last[0]:.5f}"]
        assert not errors, errors
        report = {
            "base_url": BASE_URL,
            "provider": live["routing_provider"],
            "live_routes": len(live["routes"]),
            "colombia_routes": len(colombia["routes"]),
            "colombia_origin": colombia["origin"]["name"],
            "colombia_destination": colombia["destination"]["name"],
            "javascript_errors": errors,
            "checks": [
                "preselected example without manual setup",
                "optional brand does not change measurements",
                "60000 lb gross",
                "complete real forecast",
                "weather demo opens a Maps preview without navigation intent",
                "25 hourly weather options",
                "selected route Maps handoff with guide points",
                "saved truck profile",
                "48h slider without requests",
                "mobile without overflow",
                "cargo invalidates roads and axle measurement",
                "new departure rechecks truck routes",
                "Maps popup intercepted before external navigation",
                "Cucuta to Bucaramanga with current Maps endpoints",
            ],
        }
        (artifacts / "truck-validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report))
        browser.close()


if __name__ == "__main__":
    main()
