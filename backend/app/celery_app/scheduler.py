from celery.schedules import crontab
from app.celery_app import app
import logging

logger = logging.getLogger(__name__)


def configure_scheduler():
    """
    Configure the Celery Beat scheduler with periodic tasks.
    """
    logger.info("Configuring Celery Beat scheduler...")

    app.conf.beat_schedule = {
        "update-weather-daily": {
            "task": "update_weather_for_all_lawns",
            "schedule": crontab(hour=9, minute=0),  # 09:00 UTC = 3am America/Chicago
        },
    }

    logger.info(f"Beat schedule configured: {app.conf.beat_schedule}")

    # Log registered tasks for debugging
    registered_tasks = list(app.tasks.keys())
    logger.info(f"Registered tasks: {registered_tasks}")

    # Verify our task is registered
    if "update_weather_for_all_lawns" in registered_tasks:
        logger.info("✅ update_weather_for_all_lawns task is registered")
    else:
        logger.error("❌ update_weather_for_all_lawns task is NOT registered")


# Configure the scheduler when this module is imported
configure_scheduler()
