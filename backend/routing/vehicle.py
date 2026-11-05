"""Truck inputs and conservative provider-unit conversions."""

from decimal import ROUND_CEILING, Decimal

BRANDS = ["", "Freightliner", "Kenworth", "Peterbilt", "Volvo", "Mack", "International", "Other"]


def example_vehicle(cargo_lb):
    """Illustrative configuration, never manufacturer or measured vehicle data.

    The heaviest axle is an explicit test assumption (17/60 of gross), not an
    assertion about a real truck's weight distribution.
    """
    gross = Decimal("32000") + Decimal(str(cargo_lb))
    axle = int((gross * Decimal(17) / Decimal(60)).to_integral_value(ROUND_CEILING))
    return {
        "empty_weight_lb": 32000,
        "height_ft": 13.5,
        "width_ft": 8.5,
        "length_ft": 70,
        "max_axle_weight_lb": axle,
        "axles": 5,
        "non_hazardous": True,
    }


def gross_weight_lb(vehicle, cargo_lb):
    return float(Decimal(str(vehicle["empty_weight_lb"])) + Decimal(str(cargo_lb)))


def truck_parameters(vehicle, cargo_lb):
    # Round restrictions upward: unit conversion must not understate the truck.
    def kilograms(pounds):
        return int((Decimal(str(pounds)) * Decimal("0.45359237")).to_integral_value(ROUND_CEILING))

    def meters(feet):
        return float((Decimal(str(feet)) * Decimal("0.3048")).quantize(Decimal("0.01"), ROUND_CEILING))

    return {
        "vehicleCommercial": "true",
        "vehicleWeight": kilograms(gross_weight_lb(vehicle, cargo_lb)),
        "vehicleAxleWeight": kilograms(vehicle["max_axle_weight_lb"]),
        "vehicleNumberOfAxles": vehicle["axles"],
        "vehicleHeight": meters(vehicle["height_ft"]),
        "vehicleWidth": meters(vehicle["width_ft"]),
        "vehicleLength": meters(vehicle["length_ft"]),
    }
