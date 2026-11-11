#!/usr/bin/env bash
# Cài đặt/cập nhật gói kpi-bsc-<version>.tar.gz trên APP node (Ubuntu). Chạy với sudo từ thư mục đã giải nén.
# Rolling: cập nhật từng node — rút node khỏi F5 (hoặc chờ readiness DOWN), cài, kiểm tra readiness, đưa lại vào pool.
set -euo pipefail
APP=/opt/kpi-bsc
id kpi >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin kpi
install -d -o kpi -g kpi "$APP" "$APP/web" "$APP/scripts" /var/log/kpi-bsc /var/lib/kpi-bsc /var/backups/kpi
install -d -m 750 -o root -g kpi /etc/kpi
[[ -f /etc/kpi/secrets.env ]] || { install -m 600 -o root -g kpi env.example /etc/kpi/secrets.env; echo ">> Hãy điền /etc/kpi/secrets.env rồi chạy lại"; exit 1; }

systemctl stop kpi-bsc 2>/dev/null || true
install -m 640 -o kpi -g kpi kpi-bsc.jar "$APP/kpi-bsc.jar"
rm -rf "$APP/web.new" && cp -r web "$APP/web.new" && rm -rf "$APP/web" && mv "$APP/web.new" "$APP/web"
install -m 750 scripts/*.sh "$APP/scripts/"
install -m 644 systemd/kpi-bsc.service /etc/systemd/system/kpi-bsc.service
install -m 644 nginx/kpi.conf /etc/nginx/sites-available/kpi.conf
install -m 644 nginx/kpi-proxy.conf /etc/nginx/kpi-proxy.conf
ln -sf /etc/nginx/sites-available/kpi.conf /etc/nginx/sites-enabled/kpi.conf
nginx -t && systemctl reload nginx
systemctl daemon-reload && systemctl enable --now kpi-bsc

echo -n "Chờ ứng dụng sẵn sàng"
for i in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:8088/api/actuator/health/readiness | grep -q UP; then echo " → UP"; exit 0; fi
  echo -n "."; sleep 2
done
echo " → KHÔNG sẵn sàng sau 180s, xem: journalctl -u kpi-bsc -n 200"; exit 1
