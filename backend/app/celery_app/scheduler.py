from celery.schedules import crontab
from app.celery_app import app


def configure_scheduler():
    """
    Configure the Celery Beat scheduler with periodic tasks.
    """
    app.conf.beat_schedule = {
        "update-weather-daily": {
            "task": "update_weather_for_all_lawns",
            "schedule": crontab(hour=9, minute=0),  # 09:00 UTC = 3am America/Chicago
        },
    }


# Configure the scheduler when this module is imported
configure_scheduler()
