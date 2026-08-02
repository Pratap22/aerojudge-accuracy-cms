#!/bin/sh
set -e

cd /app

echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy --schema=./database/prisma/schema.prisma

# Seed only on first boot — set RUN_SEED=false in .env.deploy after success
if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Seeding database..."
  ./node_modules/.bin/tsx ./database/prisma/seed/index.ts
fi

exec "$@"
