from typing import List, Union
from pydantic import field_validator, AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "TurfTrack"
    ENVIRONMENT: str = "development"
    APP_FQDN: str = "localhost"  # For production FQDN
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    NODE_ENV: str = "production"
    VITE_API_URL: str = "/api"

    # Logging
    LOG_LEVEL: str = "INFO"  # Can be overridden by environment variable

    # Timezone
    TZ: str = "UTC"

    # Database
    POSTGRES_SERVER: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "turftrack_password"
    POSTGRES_DB: str = "turftrack"
    POSTGRES_HOST: str = "db"
    DATABASE_URL: str

    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_URL: str

    # Celery
    CELERY_LOG_LEVEL: str = "INFO"
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str
    REDBEAT_REDIS_URL: str
    REDBEAT_LOCK_KEY: str = "redbeat:lock"
    REDBEAT_LOCK_TIMEOUT: int = 900

    # CORS - Handled by validator
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    ALEMBIC_DATABASE_URL: str

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]], info) -> List[AnyHttpUrl]:
        if info.data.get("ENVIRONMENT") == "production":
            return [f"https://{info.data.get('APP_FQDN')}"]
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("DATABASE_URL", mode="before")
    def assemble_db_connection(cls, v: str | None, info) -> str:
        if v:
            return v
        return (
            f"postgresql+asyncpg://{info.data.get('POSTGRES_USER')}:{info.data.get('POSTGRES_PASSWORD')}"
            f"@{info.data.get('POSTGRES_HOST')}:{info.data.get('POSTGRES_PORT')}/{info.data.get('POSTGRES_DB')}"
        )

    @field_validator("REDIS_URL", "REDBEAT_REDIS_URL", mode="before")
    def assemble_redis_connection(cls, v: str | None, info) -> str:
        if v:
            return v
        return f"redis://{info.data.get('REDIS_HOST')}:{info.data.get('REDIS_PORT')}/0"

    @field_validator("ALEMBIC_DATABASE_URL", mode="before")
    def assemble_alembic_db_connection(cls, v: str | None, info) -> str:
        if v:
            return v
        # In production, this will be constructed from the base PG variables
        return (
            f"postgresql+asyncpg://{info.data.get('POSTGRES_USER')}:{info.data.get('POSTGRES_PASSWORD')}"
            f"@{info.data.get('POSTGRES_HOST')}:{info.data.get('POSTGRES_PORT')}/{info.data.get('POSTGRES_DB')}"
        )

    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent.parent.parent.parent / ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()
