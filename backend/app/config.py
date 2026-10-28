from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    # SQLite by default so a fresh clone runs with no database server.
    # Point DATABASE_URL at PostgreSQL for a shared deployment.
    database_url: str = "sqlite:///sellgoods-local.db"
    # Dev-only fallback. Always set a long random JWT_SECRET in backend/.env
    # before deploying anywhere real.
    jwt_secret: str = "dev-only-local-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    frontend_origin: str = "http://localhost:5173"
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
