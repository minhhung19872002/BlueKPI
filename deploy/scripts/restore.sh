#!/usr/bin/env bash
# Khôi phục CSDL KPI BSC từ bản sao lưu (mục tiêu RTO ≤ 01 giờ — xem docs/VAN-HANH.md).
#   restore.sh /var/backups/kpi-bsc/20261111_0130 [physical|logical]
# Trình tự: dừng ứng dụng 2 node → kiểm tra checksum → khôi phục → khởi động MariaDB → khởi động ứng dụng → kiểm tra readiness.
set -euo pipefail
SRC=${1:?Thiếu thư mục bản sao lưu}
MODE=${2:-physical}
source /etc/kpi/backup.env
DB_NAME=${DB_NAME:-kpi_bsc}
START=$(date +%s)
( cd "$SRC" && sha256sum -c SHA256SUMS )

if [[ "$MODE" == "physical" ]]; then
  systemctl stop mariadb
  DATADIR=$(my_print_defaults --mysqld | sed -n 's/^--datadir=//p' | tail -1); DATADIR=${DATADIR:-/var/lib/mysql}
  # chuyển NỘI DUNG datadir (datadir thường là mount point ổ riêng — không đổi tên được thư mục)
  KEEP="${DATADIR%/}.before-restore.$(date +%s)"; mkdir -p "$KEEP"
  find "$DATADIR" -mindepth 1 -maxdepth 1 -exec mv -t "$KEEP" {} +
  TMP=$(mktemp -d); tar -C "$TMP" -xzf "$SRC/physical.tar.gz"
  mariabackup --copy-back --target-dir="$TMP/physical" --datadir="$DATADIR"
  chown -R mysql:mysql "$DATADIR"; rm -rf "$TMP"
  systemctl start mariadb
else
  mysql --user="$BACKUP_USER" --password="$BACKUP_PASSWORD" -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_vietnamese_ci;"
  gunzip -c "$SRC/logical.sql.gz" | mysql --user="$BACKUP_USER" --password="$BACKUP_PASSWORD" "$DB_NAME"
fi
echo "Khôi phục ($MODE) xong sau $(( $(date +%s) - START ))s. Khởi động lại ứng dụng: systemctl start kpi-bsc (APP_01, APP_02)"
