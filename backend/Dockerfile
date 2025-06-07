FROM python:3.12-slim

WORKDIR /app

# Install UV
RUN pip install --no-cache-dir uv

# Copy only the dependency files first for better caching
COPY pyproject.toml .

# Install dependencies using UV
RUN uv pip install --system .

# Copy the rest of the application
COPY . .

ENV PYTHONPATH=/app

# Create non-root user
RUN addgroup --system --gid 1001 celery && \
    adduser --system --uid 1001 --gid 1001 --no-create-home celery

# Set ownership of the app directory
RUN chown -R celery:celery /app

# Switch to non-root user
USER celery