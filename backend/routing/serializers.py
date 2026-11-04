from datetime import UTC, datetime, timedelta
from math import isfinite
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework import serializers


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


class TripSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["live", "demo"], default="live")
    origin = LocationSerializer()
    destination = LocationSerializer()
    departure = serializers.DateTimeField()
    load_lb = serializers.FloatField(min_value=0, max_value=200_000)
    spacing_miles = serializers.ChoiceField(choices=[10, 25, 50], default=25)

    def validate(self, attrs):
        if not isfinite(attrs["load_lb"]):
            raise serializers.ValidationError({"load_lb": "Cargo weight must be a finite number."})
        if attrs["mode"] == "live":
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
