# TurfTrack Logging Infrastructure

This directory contains the logging infrastructure for TurfTrack using Grafana Loki, Promtail, and Grafana.

## Quick Start

### Development

```bash
# Start development environment with logging
./scripts/start-logging.sh dev

# Or manually:
docker-compose -f docker-compose.dev.yml -f docker-compose.logging.yml up -d
```

### Production Testing

```bash
# Start production environment with logging
./scripts/start-logging.sh prod

# Or manually:
docker-compose -f docker-compose.prod.yml -f docker-compose.logging.yml up -d
```

## Access Points

- **Frontend**: http://localhost:5173 (dev) or http://localhost:3000 (prod)
- **API**: http://localhost:8000
- **Grafana (Logs)**: http://localhost:3001
- **Loki**: http://localhost:3100

## Grafana Login

- **Username**: admin
- **Password**: admin

## Viewing Logs

### In Grafana:

1. Go to http://localhost:3001
2. Login with admin/admin
3. Click "Explore" (compass icon)
4. Select "Loki" datasource
5. Use these queries:
   - All logs: `{job="docker"}`
   - API logs: `{job="docker", container_name="turftrack-api"}`
   - Frontend logs: `{job="docker", container_name="turftrack-frontend"}`
   - Celery logs: `{job="docker", container_name="turftrack-celery-worker"}`

### Useful Log Queries:

```logql
# All logs from last hour
{job="docker"} | json | line_format "{{.log}}"

# Error logs only
{job="docker"} | json | line_format "{{.log}}" |= "ERROR"

# API request logs
{job="docker", container_name="turftrack-api"} | json | line_format "{{.log}}" |= "Request"

# Celery task logs
{job="docker", container_name="turftrack-celery-worker"} | json | line_format "{{.log}}"
```

## Components

### Loki

- **Purpose**: Log aggregation and storage
- **Port**: 3100
- **Storage**: Local filesystem (31-day retention)

### Promtail

- **Purpose**: Log collection from Docker containers
- **Function**: Scrapes container logs and sends to Loki

### Grafana

- **Purpose**: Log visualization and querying
- **Port**: 3001
- **Features**: Log search, filtering, and dashboards

## Configuration Files

- `loki-config.yaml`: Loki server configuration
- `promtail-config.yaml`: Log collection configuration
- `grafana-datasources.yaml`: Grafana datasource setup

## Log Retention

- **Development**: 31 days
- **Production**: 31 days (configurable in `loki-config.yaml`)

## Troubleshooting

### Logs not appearing in Grafana?

1. Check if Promtail is running: `docker ps | grep promtail`
2. Check Promtail logs: `docker logs turftrack-promtail`
3. Verify Loki is healthy: `curl http://localhost:3100/ready`

### Grafana not accessible?

1. Check if Grafana is running: `docker ps | grep grafana`
2. Check Grafana logs: `docker logs turftrack-grafana`
3. Verify port 3001 is not in use by another service

### Container logs not being collected?

1. Ensure containers have logging driver configured
2. Check Docker daemon logs: `docker system logs`
3. Verify Promtail has access to `/var/lib/docker/containers`

## Stopping Services

```bash
# Stop all services including logging
docker-compose -f docker-compose.dev.yml -f docker-compose.logging.yml down

# Stop only logging services
docker-compose -f docker-compose.logging.yml down
```
