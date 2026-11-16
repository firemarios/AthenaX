"""AthenaX settings (contract §1: env prefix ATHENAX_, comma-separated CORS, no new deps)."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

API_VERSION = "1.0.0"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ATHENAX_",
        env_file=(".env", "../.env"),
        extra="ignore",
    )

    env: str = "development"
    database_url: str = "sqlite+aiosqlite:///./storage/athenax.db"
    api_base_url: str = "http://127.0.0.1:8000"
    rate_limit_per_minute: int = 120
    cors_origins: str = (
        "http://localhost:3000,http://localhost:3001,"
        "http://127.0.0.1:3000,http://127.0.0.1:3001"
    )
    llm_provider: str = "ollama"
    llm_base_url: str = "http://127.0.0.1:11434"
    llm_api_key: str = ""
    llm_model: str = "llama3.2"
    llm_vision_model: str = ""
    embedding_model: str = "nomic-embed-text"
    default_city: str = "Athens"
    max_ai_records: int = 200
    ui_locale_default: str = "el"
    s3_endpoint_url: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = ""
    storage_dir: str = "./storage"
    redis_url: str = ""
    snapshot_live: bool = True
    snapshot_overpass_timeout: float = 12.0
    snapshot_cache_seconds: int = 900

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in (self.cors_origins or "").split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
