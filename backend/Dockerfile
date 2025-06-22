FROM python:3.12-slim

WORKDIR /app

# Set up a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install UV properly (like production)
RUN apt-get update && apt-get install -y curl && \
    curl -L -o /tmp/uv-installer.sh https://astral.sh/uv/install.sh && \
    sh /tmp/uv-installer.sh && \
    mv /root/.local/bin/uv /usr/local/bin/uv && \
    chmod +x /usr/local/bin/uv && \
    rm -rf /var/lib/apt/lists/*

# Copy .env file for development
COPY .env .

# Copy only the dependency files first for better caching
COPY backend/pyproject.toml .

# Use uv to install dependencies into the virtual environment
RUN uv pip install --python /opt/venv/bin/python --no-cache .

# Copy the application code (excluding .env directory)
COPY backend/app/ ./app/
COPY backend/alembic/ ./alembic/
COPY backend/main.py .
COPY backend/alembic.ini .

# Copy VERSION file for version management (from project root)
COPY VERSION .
COPY VERSION ./app/

# Set Python to run in unbuffered mode (better for logging)
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Create non-root user for API service
RUN groupadd --system --gid 1001 api && \
    useradd --system --uid 1001 --gid 1001 --no-create-home --shell /bin/bash api

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/data /tmp && \
    chown -R api:api /app && \
    chown -R api:api /tmp

# Switch to non-root user
USER api

# Expose the port the app runs on
EXPOSE 8000