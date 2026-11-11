# HƯỚNG DẪN TRIỂN KHAI — KPI-BSC trên Ubuntu

> Áp dụng Ubuntu **20.04 LTS** (theo E-HSMT). Khác biệt cho 22.04/24.04 ghi chú tại từng bước.
> Ubuntu 20.04 đã hết hỗ trợ tiêu chuẩn (04/2025) — khuyến nghị 22.04/24.04 hoặc Ubuntu Pro/ESM (OPEN-QUESTIONS #7).
> Mọi lệnh chạy bằng `sudo`. Thay `10.x.x.x`, tên miền, mật khẩu bằng giá trị thật. **Không commit secret thật.**

## 0. Tổng quan

| Máy | IP ví dụ | Cài đặt |
|---|---|---|
| APP_01, APP_02 | 10.0.1.11, 10.0.1.12 | JDK 21 Temurin, Nginx, gói `kpi-bsc-<version>.tar.gz` |
| DB_01 | 10.0.1.21 (`db01.kpi.local`) | MariaDB 10.11 MASTER, MinIO primary, cron sao lưu |
| DB_02 | 10.0.1.22 (`db02.kpi.local`) | MariaDB 10.11 SLAVE, MinIO mirror |

Cổng: ứng dụng `8088` (chỉ `127.0.0.1`), Nginx `80/443`, MariaDB `3306`, MinIO `9000` (API) / `9001` (console).

Thứ tự: (1) chuẩn bị OS → (2) MariaDB DB_01/DB_02 → (3) replication → (4) MinIO → (5) đóng gói → (6) APP node: JDK, Nginx, secrets, cài gói → (7) F5 → (8) sao lưu → (9) kiểm tra.

---

## 1. Chuẩn bị chung (mọi VM)

```bash
timedatectl set-timezone Asia/Ho_Chi_Minh
apt update && apt -y upgrade
apt -y install curl ca-certificates gnupg ufw chrony fail2ban
systemctl enable --now chrony        # Quartz cluster cần đồng hồ đồng bộ
```

Firewall (ufw) — ví dụ:

```bash
# APP_01/APP_02
ufw allow from <dải VPN quản trị> to any port 22 proto tcp
ufw allow 443/tcp
ufw allow from <IP self-IP F5> to any port 80 proto tcp   # health check /healthz
ufw enable
# DB_01/DB_02
ufw allow from <dải VPN quản trị> to any port 22 proto tcp
ufw allow from 10.0.1.11 to any port 3306 proto tcp
ufw allow from 10.0.1.12 to any port 3306 proto tcp
ufw allow from 10.0.1.22 to any port 3306 proto tcp        # trên DB_01: cho replica
ufw allow from 10.0.1.11 to any port 9000 proto tcp        # MinIO từ APP
ufw allow from 10.0.1.12 to any port 9000 proto tcp
ufw enable
```

> MinIO cũng phải truy cập được từ **trình duyệt người dùng** (xem §7) hoặc qua reverse proxy.

---

## 2. MariaDB 10.11 (DB_01 và DB_02)

Dùng repo chính thức MariaDB (Ubuntu 20.04 apt chỉ có 10.3):

```bash
curl -LsS https://r.mariadb.com/downloads/mariadb_repo_setup | bash -s -- --mariadb-server-version="mariadb-10.11"
apt update
apt -y install mariadb-server mariadb-client mariadb-backup
mariadb --version          # 10.11.x
mariadb-secure-installation
```

> 22.04/24.04: lệnh giống hệt (script tự nhận bản phát hành). Ubuntu 24.04 apt có sẵn 10.11 nhưng vẫn khuyến nghị repo chính thức để cập nhật patch.

Cấu hình `/etc/mysql/mariadb.conf.d/60-kpi.cnf` (DB_01):

```ini
[mysqld]
bind-address              = 10.0.1.21
character-set-server      = utf8mb4
collation-server          = utf8mb4_vietnamese_ci
default-time-zone         = '+07:00'
max_connections           = 300          # 2 node × Hikari 30 + dự phòng quản trị/replica
innodb_buffer_pool_size   = 20G          # ≈ 60–65% RAM 32 GB (PHẦN B §10)
innodb_log_file_size      = 2G
innodb_flush_log_at_trx_commit = 1
sync_binlog               = 1
# --- replication (GTID) ---
server_id                 = 1
log_bin                   = /var/lib/mysql/mysql-bin
binlog_format             = ROW
log_slave_updates         = ON
gtid_strict_mode          = ON
binlog_expire_logs_seconds = 604800      # giữ binlog 7 ngày
rpl_semi_sync_master_enabled = ON
rpl_semi_sync_slave_enabled  = ON
rpl_semi_sync_master_timeout = 10000
# --- TLS (bắt buộc vì DB_SSL_MODE=verify-full) ---
ssl_cert = /etc/mysql/tls/server-cert.pem
ssl_key  = /etc/mysql/tls/server-key.pem
ssl_ca   = /etc/mysql/tls/ca.pem
```

DB_02: giống trên nhưng `bind-address = 10.0.1.22`, `server_id = 2`, thêm `read_only = ON`.

```bash
systemctl restart mariadb
```

> TLS: chứng chỉ máy chủ phải có CN/SAN khớp hostname trong `DB_URL` (`db01.kpi.local`). Với `verify-full`, JVM trên APP phải tin CA này: hoặc import CA vào truststore của JDK (`keytool -importcert -cacerts …`), hoặc đặt `DB_SSL_MODE=verify-ca`/`trust` nếu CĐT chấp nhận. Nếu chưa có TLS, ứng dụng sẽ không kết nối được với giá trị mặc định `verify-full`.

### 2.1 Tạo schema và user (chỉ trên DB_01 — replica nhận qua replication)

Dựa trên `deploy/mariadb/init/01-users.sql` (bản dev dùng `'%'` và mật khẩu dev; prod giới hạn host và mật khẩu mạnh):

```sql
CREATE DATABASE kpi_bsc CHARACTER SET utf8mb4 COLLATE utf8mb4_vietnamese_ci;

-- Flyway (DDL) — dùng lúc ứng dụng khởi động
CREATE USER 'kpi_migrate'@'10.0.1.11' IDENTIFIED BY '<mật khẩu mạnh 1>';
CREATE USER 'kpi_migrate'@'10.0.1.12' IDENTIFIED BY '<mật khẩu mạnh 1>';
GRANT ALL PRIVILEGES ON kpi_bsc.* TO 'kpi_migrate'@'10.0.1.11', 'kpi_migrate'@'10.0.1.12';

-- Ứng dụng (chỉ DML)
CREATE USER 'kpi_app'@'10.0.1.11' IDENTIFIED BY '<mật khẩu mạnh 2>';
CREATE USER 'kpi_app'@'10.0.1.12' IDENTIFIED BY '<mật khẩu mạnh 2>';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON kpi_bsc.* TO 'kpi_app'@'10.0.1.11', 'kpi_app'@'10.0.1.12';

-- Sao lưu (backup.sh chạy cục bộ trên DB)
CREATE USER 'kpi_backup'@'localhost' IDENTIFIED BY '<mật khẩu mạnh 3>';
GRANT RELOAD, PROCESS, LOCK TABLES, BINLOG MONITOR, SELECT, SHOW VIEW, TRIGGER, EVENT ON *.* TO 'kpi_backup'@'localhost';

-- Replication
CREATE USER 'repl'@'10.0.1.22' IDENTIFIED BY '<mật khẩu mạnh 4>';
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'10.0.1.22';
FLUSH PRIVILEGES;
```

Bắt buộc TLS cho user ứng dụng (tùy chọn, khuyến nghị): `ALTER USER 'kpi_app'@'10.0.1.11' REQUIRE SSL;` (lặp cho các user/host khác).

### 2.2 Flyway

- **Không chạy Flyway thủ công.** Ứng dụng tự chạy migration khi khởi động (`spring.flyway.enabled=true`, user `DB_MIGRATE_USER`, `locations=classpath:db/migration`, `baseline-on-migrate=true`, `validate-on-migrate=true`). Bảng lịch sử: `flyway_schema_history`.
- Lần khởi động đầu tạo toàn bộ bảng (`V001`), Quartz (`V002`), quyền/vai trò (`V003`), cấu hình và cây đơn vị (`R__seed_01_config`, `R__seed_02_org`). Seed dev (`db/seed-dev`) chỉ nạp ở profile `dev`.
- Khi nâng cấp rolling, node khởi động trước sẽ migrate; node cũ phải chịu được schema mới (migration cần tương thích ngược).

---

## 3. Replication master → slave (GTID)

Trên DB_02 (sau khi DB_01 đã có dữ liệu, dùng mariabackup để khởi tạo):

```bash
# DB_01
mariabackup --backup --user=root --target-dir=/tmp/seed && mariabackup --prepare --target-dir=/tmp/seed
rsync -a /tmp/seed/ db02:/tmp/seed/
# DB_02
systemctl stop mariadb && rm -rf /var/lib/mysql/*
mariabackup --copy-back --target-dir=/tmp/seed && chown -R mysql:mysql /var/lib/mysql
systemctl start mariadb
cat /tmp/seed/xtrabackup_binlog_info      # lấy GTID, ví dụ 0-1-12345
```

```sql
-- DB_02
SET GLOBAL gtid_slave_pos = '0-1-12345';
CHANGE MASTER TO MASTER_HOST='10.0.1.21', MASTER_USER='repl', MASTER_PASSWORD='<mật khẩu mạnh 4>',
  MASTER_USE_GTID=slave_pos, MASTER_SSL=1;
START SLAVE;
SHOW SLAVE STATUS\G      -- Slave_IO_Running=Yes, Slave_SQL_Running=Yes, Seconds_Behind_Master≈0
```

Nếu DB còn trống (cài mới), có thể bỏ bước mariabackup: tạo cấu hình xong trên cả hai, rồi `CHANGE MASTER … MASTER_USE_GTID=slave_pos` trước khi tạo schema trên DB_01.

> Ứng dụng **chưa có** định tuyến đọc sang replica (`READ_REPLICA_ENABLED` chưa được code sử dụng). Để `READ_REPLICA_ENABLED=false`. Failover thủ công: `docs/VAN-HANH.md` §5.

---

## 4. MinIO (DB_01 primary, DB_02 mirror)

```bash
useradd --system --home /var/lib/minio --shell /usr/sbin/nologin minio-user
curl -fsSL https://dl.min.io/server/minio/release/linux-amd64/minio -o /usr/local/bin/minio
curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc
chmod +x /usr/local/bin/minio /usr/local/bin/mc
install -d -o minio-user -g minio-user /data/minio
cat >/etc/default/minio <<'EOF'
MINIO_ROOT_USER=<root-user>
MINIO_ROOT_PASSWORD=<root-password-manh>
MINIO_VOLUMES=/data/minio
MINIO_OPTS="--address :9000 --console-address :9001 --certs-dir /etc/minio/certs"
EOF
chmod 600 /etc/default/minio
```

Unit `/etc/systemd/system/minio.service` (repo không kèm file này — mẫu):

```ini
[Unit]
Description=MinIO
After=network-online.target
[Service]
User=minio-user
Group=minio-user
EnvironmentFile=/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_OPTS $MINIO_VOLUMES
Restart=always
LimitNOFILE=65536
[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now minio
```

Tạo bucket + user ứng dụng chỉ có quyền trên bucket (tên bucket = `MINIO_BUCKET`; `env.example` dùng `kpi-bsc`, mặc định trong code là `kpi-files` — **chọn một tên và dùng thống nhất** cho `MINIO_BUCKET`, `minio-mirror.sh`):

```bash
mc alias set kpi https://minio.kpi.local:9000 <root-user> <root-password>
mc mb kpi/kpi-bsc
cat >/tmp/kpi-app-policy.json <<'EOF'
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow", "Action": ["s3:GetBucketLocation","s3:ListBucket"], "Resource": ["arn:aws:s3:::kpi-bsc"] },
  { "Effect": "Allow", "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject"], "Resource": ["arn:aws:s3:::kpi-bsc/*"] } ] }
EOF
mc admin policy create kpi kpi-app /tmp/kpi-app-policy.json
mc admin user add kpi <MINIO_ACCESS_KEY> <MINIO_SECRET_KEY>
mc admin policy attach kpi kpi-app --user <MINIO_ACCESS_KEY>
```

> Ứng dụng có gọi `makeBucket` nếu bucket chưa tồn tại; với policy trên thì bucket phải được tạo trước như hướng dẫn.

DB_02: cài MinIO tương tự, tạo bucket cùng tên; đồng bộ bằng `minio-mirror.sh` (xem `docs/VAN-HANH.md` §4).

---

## 5. Đóng gói (máy build / CI)

```bash
(cd backend && ./mvnw -B -DskipTests package)
(cd frontend && npm ci && npm run build)
bash deploy/scripts/package.sh            # VERSION lấy từ backend/pom.xml (1.0.0) hoặc VERSION=...
# → dist-package/kpi-bsc-<version>.tar.gz
```

Nội dung gói: `kpi-bsc.jar`, `web/` (frontend/dist), `install.sh`, `scripts/{backup,restore,minio-mirror,seed-volume}.sh`, `nginx/{kpi.conf,kpi-proxy.conf}`, `systemd/kpi-bsc.service`, `env.example`, `docs/` (nếu có), `SHA256SUMS`. CI (`.github/workflows/ci.yml`, job `package`) tạo artifact `kpi-bsc-tarball`.

> `package.sh` sao chép `docs/TRIEN-KHAI.md`, trong khi tài liệu này nằm ở `deploy/TRIEN-KHAI.md` → hiện **không được đóng vào gói** (cp lỗi bị bỏ qua). Sao chép thủ công hoặc sửa script.

---

## 6. APP_01 / APP_02

### 6.1 JDK 21 (Temurin tarball — chạy được trên 20.04/22.04/24.04)

```bash
cd /tmp
curl -fLO https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz
sha256sum OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz   # đối chiếu .sha256.txt trên trang phát hành
install -d /opt/java
tar -C /opt/java -xzf OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz
ln -sfn /opt/java/jdk-21.0.13+9 /opt/java/jdk-21          # unit systemd dùng /opt/java/jdk-21
/opt/java/jdk-21/bin/java -version
```

### 6.2 Nginx

`deploy/nginx/kpi.conf` dùng cú pháp `http2 on;` — **cần Nginx ≥ 1.25.1**. Nginx trong apt của Ubuntu 20.04/22.04 là 1.18, của 24.04 là 1.24 → `nginx -t` sẽ lỗi. Chọn một trong hai:

- (a) Cài Nginx từ repo nginx.org (stable ≥ 1.26):
  ```bash
  curl -fsSL https://nginx.org/keys/nginx_signing.key | gpg --dearmor -o /usr/share/keyrings/nginx-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/ubuntu $(lsb_release -cs) nginx" > /etc/apt/sources.list.d/nginx.list
  apt update && apt -y install nginx
  install -d /etc/nginx/sites-available /etc/nginx/sites-enabled
  # gói nginx.org không include sites-enabled: thêm dòng sau vào khối http {} của /etc/nginx/nginx.conf
  #   include /etc/nginx/sites-enabled/*;
  ```
- (b) Dùng Nginx của Ubuntu (`apt -y install nginx`) và sửa trong `kpi.conf`: bỏ dòng `http2 on;`, đổi `listen 443 ssl;` thành `listen 443 ssl http2;`.

Xóa site mặc định để `server_name _` cổng 80 nhận health check: `rm -f /etc/nginx/sites-enabled/default`.

Chứng chỉ TLS tại `/etc/kpi/tls/fullchain.pem`, `/etc/kpi/tls/privkey.pem` (tên miền trong `server_name kpi.vnpt.vn` — sửa theo thực tế). Nếu TLS kết thúc ở F5, vẫn giữ khối 443 (F5 re-encrypt) hoặc điều chỉnh theo mô hình CĐT.

Sau F5 có SNAT, thêm vào khối `http`/`server` để rate limit và log dùng IP thật:

```nginx
set_real_ip_from <IP self-IP F5>;
real_ip_header   X-Forwarded-For;
```

Giới hạn Swagger cho mạng nội bộ (khuyến nghị, chưa có trong `kpi.conf`):

```nginx
location /api/docs { allow 10.0.0.0/8; deny all; include /etc/nginx/kpi-proxy.conf; proxy_pass http://kpi_backend; }
```

### 6.3 Secrets `/etc/kpi/secrets.env`

Tạo từ `deploy/env.example` (`install.sh` tự sao chép lần đầu rồi dừng để bạn điền):

| Biến | Giá trị prod |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` (unit systemd cũng đặt) |
| `SERVER_PORT` | `8088` (khớp `upstream` Nginx) |
| `DB_URL` | `jdbc:mariadb://db01.kpi.local:3306/kpi_bsc` |
| `DB_SSL_MODE` | `verify-full` (xem §2 về CA) |
| `DB_USER` / `DB_PASSWORD` | `kpi_app` / mật khẩu §2.1 |
| `DB_MIGRATE_USER` / `DB_MIGRATE_PASSWORD` | `kpi_migrate` / mật khẩu §2.1 |
| `DB_POOL_MAX` | `30` |
| `KPI_JWT_SECRET` | `openssl rand -base64 64 \| tr -d '\n'` (≥ 64 byte, **giống nhau trên 2 node**) |
| `KPI_JWT_SECRET_PREVIOUS` | trống, hoặc khóa cũ khi xoay vòng |
| `KPI_PII_KEY` | `openssl rand -base64 32` (≥ 32 ký tự, **giống nhau trên 2 node, không bao giờ đổi**) |
| `KPI_ACCESS_TTL` / `KPI_REFRESH_TTL` / `KPI_IDLE_TIMEOUT` | `15m` / `8h` / `30m` |
| `KPI_COOKIE_SECURE` / `KPI_COOKIE_SAMESITE` / `KPI_COOKIE_DOMAIN` | `true` / `Lax` / trống |
| `KPI_FRONTEND_URL` | `https://kpi.vnpt.vn/` — **phải có dấu `/` cuối** (code ghép `…/dashboard`, `…/sso-error`; `env.example` đang thiếu `/`) |
| `KPI_CORS_ORIGINS` | `https://kpi.vnpt.vn` |
| `KPI_LOGIN_RATE_LIMIT` | `10` (số lần/phút/IP/node) |
| `KPI_BOOTSTRAP_ADMIN_USERNAME` / `_PASSWORD` | **bắt buộc lần cài đầu** — seed tạo `admin` không mật khẩu; xem `docs/HDQT.md` §2 |
| `KPI_DEMO_SEED` | `false` |
| `CAS_ENABLED`, `CAS_SERVER_URL`, `CAS_SERVICE_URL`, `CAS_PROTOCOL`, `CAS_SLO_ENABLED` | theo CĐT; `CAS_SERVICE_URL=https://kpi.vnpt.vn/api/auth/sso/callback` |
| `BYPASS_SSO` | `false` (bắt buộc) |
| `MINIO_ENDPOINT` | URL mà **cả APP và trình duyệt** truy cập được (xem §7) |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_BUCKET` | user §4 / tên bucket thống nhất |
| `CLAMAV_ENABLED` / `CLAMAV_HOST` / `CLAMAV_PORT` | khuyến nghị `true` / `127.0.0.1` / `3310` (`apt install clamav-daemon`, bật `TCPSocket 3310` trong `/etc/clamav/clamd.conf`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | theo CĐT |
| `ZALO_ACCESS_TOKEN` | token OA (nếu dùng) |
| `KPI_SOURCE_API_KEY`, `KPI_SOURCE_API_KEY_HEADER`, `KPI_SOURCE_BEARER`, `KPI_SOURCE_BASIC_USER`, `KPI_SOURCE_BASIC_PASSWORD` | theo kiểu xác thực nguồn KPI |
| `HRM_ENABLED` | `false` (adapter stub) |
| `SWAGGER_ENABLED` | `false` |
| `READ_REPLICA_ENABLED` / `DB_REPLICA_URL` | `false` (chưa dùng) |

**Bắt buộc:** systemd `EnvironmentFile` không hiểu chú thích cuối dòng. Xóa mọi phần `# …` sau giá trị trong file (ví dụ `DB_USER=kpi_app                 # chỉ quyền DML` → `DB_USER=kpi_app`). Giá trị có khoảng trắng (`MAIL_FROM=Hệ thống KPI BSC <…>`) nên đặt trong dấu nháy kép.

```bash
chown root:kpi /etc/kpi/secrets.env && chmod 600 /etc/kpi/secrets.env
```

> Với `chmod 600 root:kpi`, systemd (chạy root) vẫn đọc được `EnvironmentFile` trước khi hạ quyền sang user `kpi` — đúng ý đồ.

Ở prod, `StartupSecurityCheck` từ chối khởi động nếu còn secret mặc định (xem `docs/ATTT.md` §7). Log lỗi: `journalctl -u kpi-bsc -n 100`.

### 6.4 Cài/cập nhật gói

```bash
tar -xzf kpi-bsc-1.0.0.tar.gz && cd kpi-bsc-1.0.0
sha256sum -c SHA256SUMS
bash install.sh
```

`install.sh` thực hiện: tạo user hệ thống `kpi`; tạo `/opt/kpi-bsc{,/web,/scripts}`, `/var/log/kpi-bsc`, `/var/lib/kpi-bsc`, `/etc/kpi` (750 root:kpi); nếu chưa có `/etc/kpi/secrets.env` → sao chép `env.example`, in thông báo và **thoát** (điền rồi chạy lại); dừng dịch vụ; cài `kpi-bsc.jar`, thay `web/`, scripts; cài `/etc/systemd/system/kpi-bsc.service`, `/etc/nginx/sites-available/kpi.conf` (+ symlink sites-enabled), `/etc/nginx/kpi-proxy.conf`; `nginx -t && systemctl reload nginx`; `systemctl enable --now kpi-bsc`; chờ tối đa 180s cho `http://127.0.0.1:8088/api/actuator/health/readiness` = UP.

> `install.sh` ghi đè `kpi.conf` mỗi lần cập nhật — các chỉnh sửa tay ở §6.2 cần áp lại (hoặc đưa vào repo).

### 6.5 Unit systemd (`deploy/systemd/kpi-bsc.service`)

- `User=kpi`, `WorkingDirectory=/opt/kpi-bsc`, `EnvironmentFile=/etc/kpi/secrets.env`, `SPRING_PROFILES_ACTIVE=prod`, `JAVA_HOME=/opt/java/jdk-21`.
- JVM: `-Xms1g -Xmx3g -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+ExitOnOutOfMemoryError -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/var/log/kpi-bsc -Duser.timezone=Asia/Ho_Chi_Minh`.
  Đặc tả §10 đề xuất `-Xmx12g` cho VM 24 GB; điều chỉnh bằng `systemctl edit kpi-bsc` (override `ExecStart`) theo kết quả đo tải.
- `TimeoutStopSec=60`, `Restart=on-failure`, `RestartSec=10`, `LimitNOFILE=65536`, hardening `ProtectSystem=strict` — chỉ ghi được `/var/log/kpi-bsc`, `/var/lib/kpi-bsc`.

### 6.6 Lần khởi động đầu

1. Node APP_01 khởi động trước (Flyway tạo schema), kiểm tra readiness, sau đó mới APP_02.
2. Đăng nhập `admin` và **đổi mật khẩu ngay** (xem `docs/HDQT.md` §2).
3. Kiểm tra “Tham số hệ thống”: sửa `KPI_SOURCE_BASE_URL` (seed là `http://localhost:8092` — mock dev), `BACKUP_DIR` → `/var/lib/kpi-bsc/backup` (xem `docs/VAN-HANH.md` §3.2), rồi khởi động lại lần lượt hai node để cả hai nạp tham số mới.

---

## 7. Truy cập tệp (MinIO presigned URL)

Frontend mở trực tiếp URL ký trước do backend sinh từ `MINIO_ENDPOINT` (TTL 300s). Chữ ký gắn với host trong URL nên:
- `MINIO_ENDPOINT` phải là tên miền/IP mà **người dùng phân giải và truy cập được qua HTTPS** (ví dụ `https://files.kpi.vnpt.vn`), và APP cũng gọi được tới đó; hoặc
- dựng một `server` Nginx riêng (`server_name files.kpi.vnpt.vn`) proxy tới MinIO `:9000`, giữ nguyên header `Host`, đặt `MINIO_ENDPOINT=https://files.kpi.vnpt.vn`.

Repo chưa có cấu hình Nginx cho MinIO — cần thống nhất với CĐT (OPEN-QUESTIONS #7). Giá trị mẫu `https://minio.kpi.local:9000` chỉ dùng được trong mạng nội bộ.

---

## 8. F5

| Tham số | Giá trị |
|---|---|
| Pool | APP_01:443, APP_02:443, round robin, không sticky |
| Monitor (cách 1) | HTTP tới cổng **80**, `GET /healthz HTTP/1.1\r\nHost: kpi.vnpt.vn\r\nConnection: close\r\n\r\n`, receive string `"status":"UP"` (Nginx chuyển tiếp tới `/api/actuator/health/readiness`) |
| Monitor (cách 2) | HTTPS tới cổng 443, `GET /api/actuator/health/readiness`, receive `"status":"UP"` |
| Interval / timeout | 5s / 16s (gợi ý) |
| Header | chèn `X-Forwarded-For` (để Nginx `real_ip` — §6.2) |

Readiness trả 503 `OUT_OF_SERVICE` khi ứng dụng đang tắt (graceful) → F5 rút node trước khi tiến trình dừng. Lưu ý: nhóm readiness mặc định của Spring Boot **không** kiểm tra DB/MinIO; mất DB lúc đang chạy vẫn báo UP.

---

## 9. Sao lưu (DB_01)

```bash
install -d /opt/kpi-bsc/scripts /var/log/kpi-bsc /var/backups/kpi-bsc
install -m 750 scripts/backup.sh scripts/restore.sh /opt/kpi-bsc/scripts/
cat >/etc/kpi/backup.env <<'EOF'
BACKUP_USER=kpi_backup
BACKUP_PASSWORD=<mật khẩu mạnh 3>
DB_NAME=kpi_bsc
BACKUP_DIR=/var/backups/kpi-bsc
RETENTION_DAYS=30
OFFSITE_TARGET=
EOF
chmod 600 /etc/kpi/backup.env
crontab -e
# 30 1 * * * /opt/kpi-bsc/scripts/backup.sh >> /var/log/kpi-bsc/backup.log 2>&1
```

`OFFSITE_TARGET` là đích `mc` (ví dụ `offsite/kpi-backup`, cần `mc alias set offsite …` trước). Chi tiết vận hành, khôi phục, MinIO mirror: `docs/VAN-HANH.md` §3–§4.

---

## 10. Kiểm tra sau triển khai

```bash
curl -fsS http://127.0.0.1:8088/api/actuator/health/readiness      # {"status":"UP"}
curl -fsS http://127.0.0.1:8088/api/actuator/info                  # build.version, build.time
curl -fsSI https://kpi.vnpt.vn/ | grep -i -E 'strict-transport|content-security|x-frame'
curl -fsS http://<APP>/healthz                                     # từ F5/mạng nội bộ
journalctl -u kpi-bsc -n 50 | grep -E 'StartupSecurityCheck: OK|Started'
```

- Đăng nhập nội bộ và SSO CAS; thử upload/tải tệp (kiểm tra §7); “Chạy ngay” một lịch trong “Lịch đồng bộ”; xem “Nhật ký hệ thống”.
- `SHOW SLAVE STATUS\G` trên DB_02.
