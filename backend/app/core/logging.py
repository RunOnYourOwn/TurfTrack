import logging
import sys


def configure_logging():
    """
    Configure logging for the application.
    Sets the logging level to DEBUG for all loggers.
    """
    # Set the root logger level to DEBUG
    logging.getLogger().setLevel(logging.DEBUG)

    # Create a console handler with a higher log level
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)

    # Create a formatter and add it to the handler
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    console_handler.setFormatter(formatter)

    # Add the handler to the root logger
    logging.getLogger().addHandler(console_handler)
