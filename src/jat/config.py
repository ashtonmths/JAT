"""Settings from environment variables (JAT_*) or a git-ignored .env file."""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="JAT_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    data_dir: Path | None = None
    host: str = "127.0.0.1"
    port: int = 8770
    windows_snapshots: bool = False


class ConfigError(RuntimeError):
    pass


def resolve_data_dir(settings: Settings, override: Path | None = None) -> Path:
    path = override or settings.data_dir
    if path is None:
        raise ConfigError(
            "No data directory configured. Set JAT_DATA_DIR in .env (see .env.example) or pass --data-dir."
        )
    return path.expanduser().resolve()
