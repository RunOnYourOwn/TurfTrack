from celery import Celery
import logging
from app.core.config import settings

# Configure logging for RedBeat
logging.getLogger("redbeat").setLevel(logging.DEBUG)
beat_logger = logging.getLogger("redbeat.scheduler")
beat_logger.setLevel(logging.DEBUG)


def create_celery_app():
    """
    Create and configure the Celery application.

    Returns:
        Celery: Configured Celery application instance
    """
    app = Celery(
        "worker",
        broker=settings.CELERY_BROKER_URL,
        backend=settings.CELERY_RESULT_BACKEND,
    )

    app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        beat_scheduler="redbeat.RedBeatScheduler",
        redbeat_redis_url=settings.REDBEAT_REDIS_URL,
        redbeat_lock_key=settings.REDBEAT_LOCK_KEY,
        redbeat_lock_timeout=settings.REDBEAT_LOCK_TIMEOUT,
        redbeat_retry_period=5,
        redbeat_retry_timeout=60,
        broker_transport_options={
            "visibility_timeout": 3600,
            "socket_timeout": 30,
            "socket_connect_timeout": 30,
        },
    )

    return app
