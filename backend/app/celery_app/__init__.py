from app.celery_app.config import create_celery_app
from app.core.logging import configure_logging
import logging

# Configure logging
configure_logging()

# Create the Celery app instance
app = create_celery_app()

# Explicitly import weather tasks to ensure registration
try:
    from app.tasks import weather

    logger = logging.getLogger(__name__)
    logger.info("Weather tasks imported successfully")
except ImportError as e:
    logger = logging.getLogger(__name__)
    logger.error(f"Failed to import weather tasks: {e}")
    raise

# Import the scheduler configuration to ensure its loaded
try:
    from app.celery_app import scheduler

    logger.info("Scheduler configuration imported successfully")
except ImportError as e:
    logger = logging.getLogger(__name__)
    logger.error(f"Failed to import scheduler configuration: {e}")
    raise
