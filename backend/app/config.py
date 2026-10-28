from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


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
database_url = make_url(settings.database_url)
if database_url.drivername.startswith("sqlite") and database_url.database and not Path(database_url.database).is_absolute():
    repository_root = Path(__file__).resolve().parents[2]
    database_path = (repository_root / database_url.database).resolve()
    settings.database_url = database_url.set(database=str(database_path)).render_as_string(hide_password=False)
