#!/bin/sh
set -e

# First arg selects the role: "web" (default) or "worker".
SERVICE="${1:-web}"

echo "==> Waiting for PostgreSQL..."
until python -c "
import socket, os, sys
host = os.environ.get('POSTGRES_HOST', 'db')
port = int(os.environ.get('POSTGRES_PORT', 5432))
try:
    socket.setdefaulttimeout(1)
    socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect((host, port))
    sys.exit(0)
except Exception:
    sys.exit(1)
"; do
  sleep 1
done
echo "==> PostgreSQL is up."

echo "==> Waiting for Redis..."
until python -c "
import os, socket, sys
import urllib.parse as up
url = os.environ.get('CELERY_BROKER_URL', 'redis://redis:6379/0')
p = up.urlparse(url)
host, port = (p.hostname or 'redis'), (p.port or 6379)
try:
    socket.setdefaulttimeout(1)
    socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect((host, port))
    sys.exit(0)
except Exception:
    sys.exit(1)
"; do
  sleep 1
done
echo "==> Redis is up."

echo "==> Ensuring media directories..."
mkdir -p /app/media/recordings/voice \
         /app/media/recordings/face \
         /app/media/medical/eeg \
         /app/media/medical/mri

# ── Celery worker role ────────────────────────────────────────────────────────
if [ "$SERVICE" = "worker" ]; then
  echo "==> Starting Celery worker..."
  exec celery -A core worker -l info --concurrency="${CELERY_CONCURRENCY:-2}"
fi

# ── Web role (default) ────────────────────────────────────────────────────────
echo "==> Running migrations..."
python manage.py migrate --noinput

echo "==> Collecting static files..."
python manage.py collectstatic --noinput

echo "==> Starting Gunicorn..."
exec gunicorn core.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --threads 2 \
    --worker-class sync \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
