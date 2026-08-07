#!/bin/sh
set -eu

backup_directory=${BACKUP_DIRECTORY:-./backups}
retention_days=${BACKUP_RETENTION_DAYS:-7}
mkdir -p "$backup_directory"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-pickseat}" -d "${POSTGRES_DB:-pickseat}" -Fc > "$backup_directory/pickseat-$timestamp.dump"
find "$backup_directory" -type f -name 'pickseat-*.dump' -mtime "+$retention_days" -delete
printf 'Backup saved to %s\n' "$backup_directory/pickseat-$timestamp.dump"
