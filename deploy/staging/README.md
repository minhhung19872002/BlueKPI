# Staging KPI-BSC — VM BlueStar (14.225.83.93)

URL: **https://kpi-bsc.14.225.83.93.sslip.io** (tệp/MinIO: `https://kpi-bsc-files.14.225.83.93.sslip.io`).
Tên miền `sslip.io` tự phân giải về IP VM (chưa có bản ghi DNS riêng); khi có `kpi.bluestar.com.vn` chỉ cần thêm tên vào `~/proxy/sites/kpi-bsc.caddy` và sửa `DOMAIN` trong `.env`.

| Thành phần | Cấu hình |
|---|---|
| TLS | Caddy dùng chung `~/proxy` (Let's Encrypt), site `sites/kpi-bsc.caddy`, mạng `kpibsc_net` |
| web | `nginx:1.24-alpine` — SPA `artifacts/web` + proxy `/api`, header bảo mật `deploy/nginx/kpi-security-headers.conf`, real IP chỉ tin `172.16.0.0/12` |
| app | `eclipse-temurin:21-jre` chạy `artifacts/kpi-bsc.jar`, **profile `prod`** (StartupSecurityCheck, cookie Secure, Swagger tắt), `-Xmx768m` |
| db | `mariadb:10.11`, user `kpi_app` (DML) / `kpi_migrate` (DDL), binlog ROW, buffer pool 384 MB |
| minio | `cgr.dev/chainguard/minio` (ghim digest) |

Không mở cổng host; không build trên VM (jar + `frontend/dist` dựng sẵn được chép vào `artifacts/`).

## Cài lần đầu / cập nhật

```sh
# trên máy build
(cd backend && ./mvnw -B verify) && (cd frontend && npm ci && npm run build)
tar --force-local -czf kpi-art.tgz -C backend/target kpi-bsc-1.0.0.jar -C ../../frontend dist
scp kpi-art.tgz hung@14.225.83.93:kpi-bsc/deploy/staging/artifacts/
# trên VM
cd ~/kpi-bsc && git fetch && git checkout -f -B main origin/main
cd deploy/staging && bash gen-env.sh            # chỉ sinh .env lần đầu (secret ngẫu nhiên, quyền 600)
(cd artifacts && tar -xzf kpi-art.tgz && mv kpi-bsc-1.0.0.jar kpi-bsc.jar && rm -rf web && mv dist web && rm kpi-art.tgz)
./kpi-staging.sh up -d && ./kpi-staging.sh restart app web
```

Nối Caddy (đã làm 12/11/2026, không restart Caddy): thêm `kpibsc` vào `networks` của service caddy + khai báo external `kpibsc_net` trong `~/proxy/docker-compose.yml` (bản sao lưu `docker-compose.yml.bak-truoc-them-kpibsc-20261112`), `docker network connect kpibsc_net proxy-caddy`, chép `kpi-bsc.caddy` vào `~/proxy/sites/`, `caddy validate` rồi `caddy reload`.

## Tài khoản

`admin` được `AdminBootstrap` tạo với mật khẩu `KPI_BOOTSTRAP_ADMIN_PASSWORD` trong `~/kpi-bsc/deploy/staging/.env` (không in ra log/chat). Đổi mật khẩu sau lần đăng nhập đầu, tạo tài khoản đích danh rồi xóa biến này. CAS tắt (`CAS_ENABLED=false`), SMTP chưa cấu hình.

## Kết quả kiểm tra trên staging (12/11/2026)

- HTTPS, HTTP→HTTPS 308, header HSTS/CSP/X-Frame-Options/Permissions-Policy/CORP; `/api/docs`, actuator (trừ health) → 404.
- ZAP baseline: **FAIL 0**, PASS 63 — `docs/security/zap-staging.html` (biến repo `STAGING_URL` dùng cho job ZAP trong CI).
- Diễn tập sao lưu/khôi phục 685 MB trên phần cứng VM: logical 163 s, physical 22 s, khớp 100 % — `docs/VAN-HANH.md` §8.1 lần 4.
