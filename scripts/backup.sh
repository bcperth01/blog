#!/bin/bash
# Daily PostgreSQL backup to S3
# Runs on the EC2 host via cron, reads credentials from ~/app/.env
# Logs to ~/backup.log

set -e

APP_DIR="$HOME/app"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TMP_FILE="/tmp/blogdb_backup_$$.sql.gz"

echo "[$(date)] Starting backup..."

# Load AWS credentials from .env (strip leading whitespace from YAML heredoc indentation)
export $(grep -E '^\s*(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_REGION|AWS_S3_BUCKET)\s*=' "$APP_DIR/.env" | sed 's/^\s*//' | xargs)

BACKUP_KEY="backups/blogdb_${TIMESTAMP}.sql.gz"

# Dump database and compress
cd "$APP_DIR"
sudo docker compose exec -T db pg_dump -U bloguser blogdb | gzip > "$TMP_FILE"

# Upload to S3
aws s3 cp "$TMP_FILE" "s3://${AWS_S3_BUCKET}/${BACKUP_KEY}" --region "${AWS_REGION}"
rm -f "$TMP_FILE"
echo "[$(date)] Uploaded: $BACKUP_KEY"

# Prune backups older than 30 days
CUTOFF=$(date -d "30 days ago" +%Y-%m-%d)
aws s3 ls "s3://${AWS_S3_BUCKET}/backups/" --region "${AWS_REGION}" | while read -r line; do
  FILE_DATE=$(echo "$line" | awk '{print $1}')
  FILE_NAME=$(echo "$line" | awk '{print $4}')
  if [[ -n "$FILE_NAME" && "$FILE_DATE" < "$CUTOFF" ]]; then
    aws s3 rm "s3://${AWS_S3_BUCKET}/backups/$FILE_NAME" --region "${AWS_REGION}"
    echo "[$(date)] Pruned: $FILE_NAME"
  fi
done

echo "[$(date)] Backup complete."
