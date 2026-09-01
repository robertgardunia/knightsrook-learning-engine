from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_host: str
    postgres_port: int
    postgres_user: str
    postgres_pass: str
    postgres_db: str
    api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    """Lazy so importing app.config (transitively, e.g. via app.ingest) never
    requires .env to be present — only code paths that actually need
    settings pay for validating them."""
    return Settings()
