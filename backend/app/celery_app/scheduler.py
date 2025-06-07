from celery.schedules import crontab
from app.celery_app import app


def configure_scheduler():
    """
    Configure the Celery Beat scheduler with periodic tasks.
    """
    app.conf.beat_schedule = {}


# Configure the scheduler when this module is imported
configure_scheduler()
