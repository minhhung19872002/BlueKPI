#!/usr/bin/env bash
# Sinh deploy/staging/.env (quyền 600) với secret ngẫu nhiên — CHẠY TRÊN VM, không tạo secret ở máy khác rồi copy.
# Không ghi đè .env đã có (giữ mật khẩu DB/MinIO khớp với volume dữ liệu).
set -euo pipefail
cd "$(dirname "$0")"
DOMAIN=${DOMAIN:-kpi-bsc.14.225.83.93.sslip.io}
FILES_DOMAIN=${FILES_DOMAIN:-kpi-bsc-files.14.225.83.93.sslip.io}
if [[ -f .env ]]; then echo ".env đã tồn tại — giữ nguyên"; exit 0; fi
rnd() { openssl rand -base64 "$1" | tr -d '\n/+=' | cut -c1-"$2"; }
umask 077
cat > .env <<EOF
# Sinh bởi gen-env.sh $(date -Is) — KHÔNG commit
DB_ROOT_PASSWORD=$(rnd 32 32)
DB_USER=kpi_app
DB_PASSWORD=$(rnd 32 32)
DB_MIGRATE_USER=kpi_migrate
DB_MIGRATE_PASSWORD=$(rnd 32 32)
DB_POOL_MAX=30
KPI_JWT_SECRET=$(openssl rand -base64 96 | tr -d '\n')
KPI_JWT_SECRET_PREVIOUS=
KPI_PII_KEY=$(openssl rand -base64 32 | tr -d '\n')
KPI_COOKIE_SECURE=true
KPI_COOKIE_SAMESITE=Lax
KPI_FRONTEND_URL=https://${DOMAIN}/
KPI_CORS_ORIGINS=https://${DOMAIN}
KPI_LOGIN_RATE_LIMIT=20
KPI_BOOTSTRAP_ADMIN_USERNAME=admin
# Mật khẩu admin khởi tạo (đạt chính sách: hoa, thường, số, ký tự đặc biệt) — đổi sau lần đăng nhập đầu
KPI_BOOTSTRAP_ADMIN_PASSWORD=Stg#$(rnd 24 16)9a
CAS_ENABLED=false
BYPASS_SSO=false
MINIO_ENDPOINT=https://${FILES_DOMAIN}
MINIO_ACCESS_KEY=kpi$(rnd 16 12)
MINIO_SECRET_KEY=$(rnd 48 40)
MINIO_BUCKET=kpi-files
CLAMAV_ENABLED=false
SMTP_HOST=localhost
SMTP_PORT=25
SWAGGER_ENABLED=false
HRM_ENABLED=false
EOF
chmod 600 .env
echo "Đã sinh .env cho https://${DOMAIN}"
