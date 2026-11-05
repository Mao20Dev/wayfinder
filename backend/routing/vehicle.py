"""Truck inputs and conservative provider-unit conversions."""

from decimal import ROUND_CEILING, Decimal


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
