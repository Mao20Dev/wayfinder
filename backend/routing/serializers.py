from datetime import UTC, datetime, timedelta
from math import isfinite
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework import serializers

from .vehicle import BRANDS, example_vehicle, gross_weight_lb


class LocationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    latitude = serializers.FloatField(min_value=-85, max_value=85)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    timezone = serializers.CharField(max_length=80, default="UTC")

    def validate(self, attrs):
        if not all(isfinite(attrs[key]) for key in ("latitude", "longitude")):
            raise serializers.ValidationError("Coordinates must be finite numbers.")
        return attrs

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError("Select a location with a valid time zone.") from None
        return value


class TruckSerializer(serializers.Serializer):
    empty_weight_lb = serializers.FloatField(min_value=1, max_value=200_000)
    height_ft = serializers.FloatField(min_value=1, max_value=30)
    width_ft = serializers.FloatField(min_value=1, max_value=20)
    length_ft = serializers.FloatField(min_value=1, max_value=200)
    max_axle_weight_lb = serializers.FloatField(min_value=1, max_value=100_000)
    axles = serializers.IntegerField(min_value=2, max_value=20)
    non_hazardous = serializers.BooleanField()

    def validate(self, attrs):
        if any(not isfinite(value) for value in attrs.values() if isinstance(value, float)):
            raise serializers.ValidationError("Truck measurements must be finite numbers.")
        if not attrs["non_hazardous"]:
            raise serializers.ValidationError("This version supports non-hazardous cargo only.")
        return attrs


class TripSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["live", "demo"], default="live")
    origin = LocationSerializer()
    destination = LocationSerializer()
    departure = serializers.DateTimeField()
    load_lb = serializers.FloatField(min_value=0, max_value=200_000)
    spacing_miles = serializers.ChoiceField(choices=[10, 25, 50], default=25)
    vehicle = TruckSerializer(required=False)
    vehicle_source = serializers.ChoiceField(choices=["example", "custom"], required=False)
    vehicle_brand = serializers.ChoiceField(choices=BRANDS, default="", allow_blank=True)

    def validate(self, attrs):
        if not isfinite(attrs["load_lb"]):
            raise serializers.ValidationError({"load_lb": "Cargo weight must be a finite number."})
        if attrs["mode"] == "live":
            source = attrs.setdefault("vehicle_source", "custom" if "vehicle" in attrs else "example")
            if source == "example":
                # Resolve on the server as well: the four assessment inputs are
                # sufficient for testing and the client cannot alter this preset.
                attrs["vehicle"] = example_vehicle(attrs["load_lb"])
            vehicle = attrs.get("vehicle")
            if vehicle is None:
                raise serializers.ValidationError(
                    {"vehicle": "Enter the truck dimensions and loaded axle weight."}
                )
            gross = gross_weight_lb(vehicle, attrs["load_lb"])
            if (
                vehicle["max_axle_weight_lb"] > gross
                or vehicle["max_axle_weight_lb"] * vehicle["axles"] < gross
            ):
                raise serializers.ValidationError(
                    {
                        "vehicle": "Maximum loaded axle weight is inconsistent with gross weight and axle count."
                    }
                )
            now = datetime.now(UTC)
            if not now - timedelta(minutes=5) <= attrs["departure"] <= now + timedelta(hours=96):
                raise serializers.ValidationError(
                    {
                        "departure": "Choose a departure within the next four days so arrival forecasts remain available."
                    }
                )
        a, b = attrs["origin"], attrs["destination"]
        if abs(a["latitude"] - b["latitude"]) + abs(a["longitude"] - b["longitude"]) < 0.001:
            raise serializers.ValidationError(
                {"destination": "Choose a destination different from the origin."}
            )
        return attrs


class LoadSerializer(serializers.Serializer):
    analysis_id = serializers.UUIDField()
    load_lb = serializers.FloatField(min_value=0, max_value=200_000)

    def validate_load_lb(self, value):
        if not isfinite(value):
            raise serializers.ValidationError("Cargo weight must be a finite number.")
        return value


class DepartureSerializer(LoadSerializer):
    offset_hours = serializers.IntegerField(min_value=0, max_value=24)
