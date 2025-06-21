import logging
import logging.config
import sys
from typing import Dict, Any
from pythonjsonlogger import jsonlogger
from app.core.config import settings


def setup_logging() -> None:
    """Configure logging for the application."""

    # Get log level from settings
    log_level = getattr(settings, "LOG_LEVEL", "INFO")

    # Determine if we should use JSON formatting
    use_json = settings.ENVIRONMENT == "production"

    # Create formatter
    if use_json:
        formatter = jsonlogger.JsonFormatter(
            fmt="%(timestamp)s %(level)s %(name)s %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    else:
        formatter = logging.Formatter(
            fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    # Create console handler (stdout)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)

    # Clear ALL existing handlers from root logger
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    root_logger.setLevel(log_level)
    root_logger.addHandler(console_handler)

    # Configure application loggers
    app_logger = logging.getLogger("app")
    for handler in app_logger.handlers[:]:
        app_logger.removeHandler(handler)
    app_logger.setLevel(log_level)
    app_logger.propagate = False
    app_logger.addHandler(console_handler)

    # Configure third-party loggers and clear their handlers
    third_party_loggers = [
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "fastapi",
        "sqlalchemy",
        "sqlalchemy.engine",
        "sqlalchemy.orm",
        "sqlalchemy.orm.mapper",
        "celery",
        "redis",
        "httpx",
        "requests",
    ]

    for logger_name in third_party_loggers:
        logger = logging.getLogger(logger_name)
        # Clear existing handlers
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)
        logger.setLevel(log_level)
        logger.propagate = False
        logger.addHandler(console_handler)

    # Set specific levels for verbose loggers in production
    if settings.ENVIRONMENT == "production":
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.orm.mapper").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.orm.relationships").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.orm.strategies").setLevel(logging.WARNING)
        logging.getLogger("celery").setLevel(logging.INFO)

    # Log the configuration
    logger = logging.getLogger("app.core.logging_config")
    logger.info(
        f"Logging configured",
        extra={
            "log_level": log_level,
            "environment": settings.ENVIRONMENT,
            "format": "json" if use_json else "pretty",
        },
    )


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the given name."""
    return logging.getLogger(f"app.{name}")


def log_request_start(request_id: str, method: str, path: str, **kwargs) -> None:
    """Log the start of a request."""
    logger = logging.getLogger("app.middleware.logging")
    logger.info(
        "Request started",
        extra={
            "request_id": request_id,
            "method": method,
            "path": path,
            "event_type": "request_start",
            **kwargs,
        },
    )


def log_request_end(
    request_id: str,
    method: str,
    path: str,
    status_code: int,
    response_time_ms: float,
    **kwargs,
) -> None:
    """Log the end of a request."""
    logger = logging.getLogger("app.middleware.logging")
    log_level = logging.ERROR if status_code >= 400 else logging.INFO

    logger.log(
        log_level,
        "Request completed",
        extra={
            "request_id": request_id,
            "method": method,
            "path": path,
            "status_code": status_code,
            "response_time_ms": round(response_time_ms, 2),
            "event_type": "request_end",
            **kwargs,
        },
    )


def log_exception(request_id: str, exc: Exception, **kwargs) -> None:
    """Log an exception with context."""
    logger = logging.getLogger("app.middleware.logging")
    logger.error(
        f"Exception occurred: {str(exc)}",
        exc_info=True,
        extra={
            "request_id": request_id,
            "exception_type": type(exc).__name__,
            "event_type": "exception",
            **kwargs,
        },
    )
