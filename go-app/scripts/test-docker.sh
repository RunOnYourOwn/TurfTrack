#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== Building Docker image ==="
docker compose build

echo "=== Starting services ==="
docker compose up -d

echo "=== Waiting for app to be ready ==="
for i in $(seq 1 30); do
    if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
        echo "App is ready!"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "FAIL: App not ready after 30s"
        docker compose logs app
        docker compose down -v
        exit 1
    fi
    sleep 1
done

echo "=== Testing endpoints ==="
# Health
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
[ "$STATUS" = "200" ] && echo "PASS: /health -> $STATUS" || { echo "FAIL: /health -> $STATUS"; exit 1; }

# Version
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/version)
[ "$STATUS" = "200" ] && echo "PASS: /api/v1/version -> $STATUS" || { echo "FAIL: /api/v1/version -> $STATUS"; exit 1; }

# Pages
for page in "/" "/lawns" "/products" "/applications" "/gdd" "/water" "/reports" "/admin"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080${page}")
    [ "$STATUS" = "200" ] && echo "PASS: $page -> $STATUS" || { echo "FAIL: $page -> $STATUS"; exit 1; }
done

echo "=== Cleaning up ==="
docker compose down -v

echo "=== All smoke tests passed ==="
