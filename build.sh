#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> Upgrading pip..."
pip install --upgrade pip

echo "==> Installing Python dependencies..."
pip install -r requirements.txt

echo "==> Collecting static files..."
python manage.py collectstatic --noinput

echo "==> Running database migrations..."
python manage.py migrate --noinput

echo "==> Purging demo data and ensuring clean zero-out..."
python manage.py flush_and_zero_out || python manage.py purge_demo_data || true

echo "==> Ghar Sathi build finished successfully!"
