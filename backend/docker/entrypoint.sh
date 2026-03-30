#!/bin/sh
set -e

echo "Running database migrations..."
node -e "
const { AppDataSource } = require('./dist/database/data-source');
AppDataSource.initialize()
  .then(() => AppDataSource.runMigrations())
  .then(() => { console.log('Migrations complete'); process.exit(0); })
  .catch((err) => { console.error('Migration failed:', err); process.exit(1); });
"

echo "Starting application..."
exec node dist/main
