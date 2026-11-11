#!/usr/bin/env bash
# Mirror bucket MinIO (file minh chứng, template báo cáo, file xuất) sang site dự phòng — cron mỗi giờ.
#   0 * * * * /opt/kpi-bsc/scripts/minio-mirror.sh >> /var/log/kpi-bsc/minio-mirror.log 2>&1
# Yêu cầu: mc alias đã cấu hình `kpi` (nguồn) và `kpi-dr` (đích): mc alias set kpi https://minio.kpi.local:9000 <ak> <sk>
set -euo pipefail
BUCKET=${MINIO_BUCKET:-kpi-files}
mc mirror --overwrite --preserve "kpi/$BUCKET" "kpi-dr/$BUCKET"
echo "[$(date -Is)] mirror $BUCKET xong"
