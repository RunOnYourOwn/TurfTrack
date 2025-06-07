from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "TaskApp"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "taskapp"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/taskapp"

    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_URL: str = "redis://redis:6379/0"

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/0"
    REDBEAT_REDIS_URL: str = "redis://redis:6379/0"
    REDBEAT_LOCK_KEY: str = "redbeat:lock"
    REDBEAT_LOCK_TIMEOUT: int = 900

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    ALEMBIC_DATABASE_URL: str = DATABASE_URL

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str):
            return eval(v)
        return v

    @field_validator("DATABASE_URL", mode="before")
    def assemble_db_connection(cls, v: str | None, values: dict) -> str:
        if isinstance(v, str):
            return v
        return f"postgresql+asyncpg://{values.get('POSTGRES_USER')}:{values.get('POSTGRES_PASSWORD')}@{values.get('POSTGRES_SERVER')}:{values.get('POSTGRES_PORT')}/{values.get('POSTGRES_DB')}?timezone=UTC"

    @field_validator("REDIS_URL", mode="before")
    def assemble_redis_connection(cls, v: str | None, values: dict) -> str:
        if isinstance(v, str):
            return v
        return f"redis://{values.get('REDIS_HOST')}:{values.get('REDIS_PORT')}/{values.get('REDIS_DB')}"

    @field_validator("ALEMBIC_DATABASE_URL", mode="before")
    def assemble_alembic_db_connection(cls, v: str | None, values: dict) -> str:
        if isinstance(v, str):
            return v
        return values.get("DATABASE_URL", "")

    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent.parent.parent / ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()
