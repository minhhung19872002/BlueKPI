#!/usr/bin/env bash
# Đóng gói bàn giao: kpi-bsc-<version>.tar.gz gồm jar, web (frontend/dist), nginx, systemd, scripts, env.example, tài liệu triển khai.
#   (cd backend && ./mvnw -B -DskipTests package) && (cd frontend && npm ci && npm run build) && bash deploy/scripts/package.sh
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
VERSION=${VERSION:-$(sed -n '/<artifactId>kpi-bsc<\/artifactId>/{n;s/.*<version>\(.*\)<\/version>.*/\1/p;}' "$ROOT/backend/pom.xml")}
VERSION=${VERSION:-1.0.0}
OUT="$ROOT/dist-package"
STAGE="$OUT/kpi-bsc-$VERSION"
rm -rf "$STAGE" && mkdir -p "$STAGE"/{web,scripts,nginx,systemd,docs}
JAR=$(ls "$ROOT"/backend/target/kpi-bsc-*.jar | grep -v original | head -1)
cp "$JAR" "$STAGE/kpi-bsc.jar"
cp -r "$ROOT/frontend/dist/." "$STAGE/web/"
cp "$ROOT"/deploy/scripts/{install.sh,backup.sh,restore.sh,minio-mirror.sh,seed-volume.sh} "$STAGE/scripts/"
cp "$ROOT"/deploy/nginx/*.conf "$STAGE/nginx/"
cp "$ROOT"/deploy/systemd/*.service "$STAGE/systemd/"
cp "$ROOT/deploy/env.example" "$STAGE/env.example"
cp "$ROOT"/docs/{TRIEN-KHAI.md,VAN-HANH.md,HDQT.md} "$STAGE/docs/" 2>/dev/null || true
mv "$STAGE/scripts/install.sh" "$STAGE/install.sh"
( cd "$STAGE" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )
tar -C "$OUT" -czf "$OUT/kpi-bsc-$VERSION.tar.gz" "kpi-bsc-$VERSION"
echo "Đã tạo $OUT/kpi-bsc-$VERSION.tar.gz ($(du -h "$OUT/kpi-bsc-$VERSION.tar.gz" | cut -f1))"
