from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/sellgoods"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    frontend_origin: str = "http://127.0.0.1:5173"
    campus_email_domain: str | None = None

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
