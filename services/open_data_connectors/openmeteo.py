"""Open-Meteo weather connector — contract §5.2."""
from __future__ import annotations

from typing import Any

from services.connector_kit.base import BaseConnector, NormalizedRecord
from services.connector_kit.helpers import coerce_float, first_str, get_json

DEFAULT_LAT = 37.9838  # Athens
DEFAULT_LON = 23.7275

_WEATHER_CODE_TEXT = {
    0: "καθαρός ουρανός",
    1: "λίγα σύννεφα",
    2: "μερικά σύννεφα",
    3: "συννεφιά",
    45: "ομίχλη",
    48: "παγωμένη ομίχλη",
    51: "ελαφριά δροσία",
    61: "βροχή",
    63: "μέτρια βροχή",
    65: "έντονη βροχή",
    71: "χιόνι",
    80: "μπουρίνι βροχής",
    95: "καταιγίδα",
}


class OpenMeteoConnector(BaseConnector):
    """Current weather snapshot from Open-Meteo (CC BY 4.0)."""

    name = "openmeteo"
    kind = "weather"
    source_url = "https://open-meteo.com"
    default_reliability = 0.9

    DEFAULT_ENDPOINT = "https://api.open-meteo.com/v1/forecast"

    def __init__(self, endpoint_url: str = "", enabled: bool = True, config: dict | None = None) -> None:
        super().__init__(endpoint_url or self.DEFAULT_ENDPOINT, enabled, config)

    def _coordinates(self, query: str | None) -> tuple[float, float]:
        parts = str(query or "").split(",")
        if len(parts) == 2:
            lat, lon = coerce_float(parts[0]), coerce_float(parts[1])
            if lat is not None and lon is not None and -90 <= lat <= 90 and -180 <= lon <= 180:
                return lat, lon
        lat = coerce_float(self.config.get("lat")) or DEFAULT_LAT
        lon = coerce_float(self.config.get("lon")) or DEFAULT_LON
        return lat, lon

    async def fetch(self, query: str | None = None, limit: int = 50) -> Any:
        lat, lon = self._coordinates(query)
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,precipitation,wind_speed_10m,weather_code",
            "timezone": "auto",
            "forecast_days": 1,
        }
        return await get_json(self.endpoint_url, params=params, transport=self.config.get("transport"))

    async def normalize(self, raw: Any) -> list[NormalizedRecord]:
        if not isinstance(raw, dict):
            return []
        current = raw.get("current")
        if not isinstance(current, dict):
            current = raw.get("current_weather") if isinstance(raw.get("current_weather"), dict) else None
        if not isinstance(current, dict):
            return []
        try:
            time_text = first_str(current.get("time"), raw.get("timezone"))
            temp = coerce_float(current.get("temperature_2m") or current.get("temperature"))
            precip = coerce_float(current.get("precipitation"))
            wind = coerce_float(current.get("wind_speed_10m") or current.get("windspeed"))
            code = current.get("weather_code") if current.get("weather_code") is not None else current.get("weathercode")
            parts = []
            if temp is not None:
                parts.append(f"θερμοκρασία {temp:.1f}°C")
            if precip is not None:
                parts.append(f"βροχή {precip:.1f} mm")
            if wind is not None:
                parts.append(f"άνεμος {wind:.1f} km/h")
            code_text = _WEATHER_CODE_TEXT.get(int(code)) if isinstance(code, (int, float)) else None
            if code_text:
                parts.append(code_text)
            if not parts:
                return []
            title = f"Καιρός — {time_text}" if time_text else "Καιρός"
            lat = coerce_float(raw.get("latitude"))
            lon = coerce_float(raw.get("longitude"))
            return [
                NormalizedRecord(
                    title=title,
                    source_name=self.name,
                    source_url="https://open-meteo.com/",
                    description=" · ".join(parts),
                    provider="Open-Meteo",
                    license="CC BY 4.0",
                    category="weather",
                    tags=["καιρός", "weather"],
                    lat=lat,
                    lon=lon,
                    extra={
                        "time": time_text,
                        "temperature_2m": temp,
                        "precipitation_mm": precip,
                        "wind_speed_kmh": wind,
                        "weather_code": code,
                        "timezone": raw.get("timezone"),
                    },
                    reliability=self.default_reliability,
                )
            ]
        except Exception:  # noqa: BLE001 — tolerate malformed payloads
            return []
