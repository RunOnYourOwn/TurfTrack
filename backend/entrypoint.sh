#!/bin/sh
set -e

# Default to 'info' if CELERY_LOG_LEVEL is not set, allowing flexibility.
LOG_LEVEL="${CELERY_LOG_LEVEL:-info}"

# Check the first argument passed to the script (e.g., 'worker' or 'beat')
case "$1" in
  worker)
    echo "Starting Celery worker with log level: $LOG_LEVEL"
    # Execute the worker command, replacing the shell process.
    exec celery -A app.celery_app worker --loglevel="$LOG_LEVEL"
    ;;
  beat)
    echo "Starting Celery beat with log level: $LOG_LEVEL"
    # Execute the beat command, replacing the shell process.
    exec celery -A app.celery_app beat --loglevel="$LOG_LEVEL" --scheduler=redbeat.RedBeatScheduler
    ;;
  *)
    # If the command is not 'worker' or 'beat', execute it directly.
    # This is useful for debugging, e.g., running 'sh' to get a shell.
    echo "Running custom command: $@"
    exec "$@"
    ;;
esac 