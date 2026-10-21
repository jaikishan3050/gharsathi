#!/bin/sh
set -e

echo "=== Starting Ghar Sathi Django Backend Container on Cloud Run ==="

TARGET_PORT="${PORT:-8000}"

# Wait for PostgreSQL database if configured
if [ "$POSTGRES_DB" ] && [ "$POSTGRES_HOST" ]; then
  echo "Waiting for PostgreSQL service at $POSTGRES_HOST:${POSTGRES_PORT:-5432}..."
  while ! nc -z "$POSTGRES_HOST" "${POSTGRES_PORT:-5432}"; do
    sleep 0.5
  done
  echo "PostgreSQL is ready and accessible!"
fi

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Collecting static assets for WhiteNoise..."
python manage.py collectstatic --noinput

echo "Checking seed dataset..."
python manage.py seed_gharsathi || echo "Initial seed already present."

echo "Starting Daphne ASGI server on port ${TARGET_PORT} (HTTP + WebSockets)..."
exec daphne -b 0.0.0.0 -p "${TARGET_PORT}" gharsathi_backend.asgi:application
