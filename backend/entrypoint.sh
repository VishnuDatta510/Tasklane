#!/usr/bin/env sh
# Wait for Postgres, migrate, collect static, then hand over to the CMD.
#
# Only the web service should migrate. The worker and beat set
# RUN_MIGRATIONS=0 so three containers do not race the same migration lock.
set -e

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "Applying migrations..."
  python manage.py migrate --noinput

  echo "Collecting static files..."
  python manage.py collectstatic --noinput --clear
fi

exec "$@"
