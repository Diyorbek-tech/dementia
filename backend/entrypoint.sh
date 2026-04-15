#!/bin/sh
set -e

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

echo "==> Creating media directories..."
mkdir -p /app/media/recordings/voice \
         /app/media/recordings/face \
         /app/media/medical/eeg \
         /app/media/medical/mri

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
