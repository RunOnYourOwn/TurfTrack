from app.celery_app.config import create_celery_app
from app.core.logging import configure_logging

# Configure logging
configure_logging()

# Create the Celery app instance
app = create_celery_app()

# Explicitly import weather tasks to ensure registration
from app.tasks import weather

# Import the scheduler configuration to ensure it's loaded
from app.celery_app import scheduler
