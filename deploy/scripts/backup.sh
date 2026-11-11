#!/usr/bin/env bash
# Sao lưu CSDL KPI BSC (chạy trên DB_01 bằng cron, mặc định hằng ngày 01:30):
#   30 1 * * * /opt/kpi-bsc/scripts/backup.sh >> /var/log/kpi-bsc/backup.log 2>&1
# - mariabackup (vật lý, full) + mysqldump (logic) → /var/backups/kpi-bsc/<ngày>/
# - checksum sha256, giữ RETENTION_DAYS ngày, đẩy bản sao off-site (MinIO mc mirror) nếu cấu hình
set -euo pipefail
source /etc/kpi/backup.env   # BACKUP_USER, BACKUP_PASSWORD, DB_NAME, BACKUP_DIR, RETENTION_DAYS, OFFSITE_TARGET
DB_NAME=${DB_NAME:-kpi_bsc}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/kpi-bsc}
RETENTION_DAYS=${RETENTION_DAYS:-30}
TS=$(date +%Y%m%d_%H%M)
DEST="$BACKUP_DIR/$TS"
mkdir -p "$DEST"
umask 077

echo "[$(date -Is)] Bắt đầu sao lưu → $DEST"
START=$(date +%s)
mariabackup --backup --user="$BACKUP_USER" --password="$BACKUP_PASSWORD" --target-dir="$DEST/physical" --databases="$DB_NAME"
mariabackup --prepare --target-dir="$DEST/physical"
tar -C "$DEST" -czf "$DEST/physical.tar.gz" physical && rm -rf "$DEST/physical"

mysqldump --user="$BACKUP_USER" --password="$BACKUP_PASSWORD" --single-transaction --routines --triggers --events \
  --hex-blob --default-character-set=utf8mb4 "$DB_NAME" | gzip -9 > "$DEST/logical.sql.gz"

( cd "$DEST" && sha256sum physical.tar.gz logical.sql.gz > SHA256SUMS )
echo "[$(date -Is)] Xong sau $(( $(date +%s) - START ))s, dung lượng $(du -sh "$DEST" | cut -f1)"

if [[ -n "${OFFSITE_TARGET:-}" ]]; then
  mc mirror --overwrite "$DEST" "$OFFSITE_TARGET/$TS"
  echo "[$(date -Is)] Đã đẩy bản sao off-site: $OFFSITE_TARGET/$TS"
fi

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +
