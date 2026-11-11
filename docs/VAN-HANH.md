# HƯỚNG DẪN VẬN HÀNH — KPI-BSC

> Dành cho cán bộ vận hành hạ tầng. Cài đặt ban đầu: `deploy/TRIEN-KHAI.md`. Quản trị nghiệp vụ: `docs/HDQT.md`.
> Đường dẫn chuẩn: ứng dụng `/opt/kpi-bsc`, secret `/etc/kpi/secrets.env`, dữ liệu ghi được `/var/lib/kpi-bsc`, log phụ `/var/log/kpi-bsc`, sao lưu DB `/var/backups/kpi-bsc` (trên DB_01).

---

## 1. Khởi động, dừng, log

### 1.1 Ứng dụng (APP_01, APP_02)

```bash
systemctl status kpi-bsc
systemctl start kpi-bsc
systemctl stop kpi-bsc            # graceful: readiness → OUT_OF_SERVICE, chờ request (30s) và job Quartz, tối đa 60s
systemctl restart kpi-bsc
journalctl -u kpi-bsc -f          # log trực tiếp
journalctl -u kpi-bsc --since "1 hour ago" -p warning
journalctl -u kpi-bsc | grep <traceId>
```

- Log ghi ra stdout → journald. Profile `prod` định dạng **JSON** (mỗi dòng một sự kiện, có `mdc.traceId`, `mdc.username`). Không có file log riêng; cấu hình giữ log journald trong `/etc/systemd/journald.conf` (ví dụ `SystemMaxUse=4G`, `MaxRetentionSec=90day`) hoặc chuyển tiếp syslog/SIEM.
- `/var/log/kpi-bsc`: heap dump khi OOM (`-XX:HeapDumpPath`), log cron (`backup.log`, `minio-mirror.log`).
- Khởi động lại **từng node một**, chờ readiness UP rồi mới làm node tiếp theo.

### 1.2 Nginx, MariaDB, MinIO

```bash
nginx -t && systemctl reload nginx      # access/error log: /var/log/nginx/
systemctl status mariadb ; journalctl -u mariadb
systemctl status minio   ; journalctl -u minio
```

### 1.3 Cập nhật phiên bản (rolling, không gián đoạn)

1. Kiểm tra `SHA256SUMS` của gói mới; sao lưu DB (§3.1) trước khi nâng cấp có migration.
2. APP_01: disable member trên F5 (hoặc để readiness tự DOWN) → `bash install.sh` trong thư mục gói → chờ “UP” → enable lại.
3. APP_02: lặp lại.
4. Kiểm tra `GET /api/actuator/info` trên cả hai node cùng `build.version`.

`install.sh` ghi đè `kpi.conf` — áp lại chỉnh sửa tay (real_ip, Swagger…) nếu có. Rollback: cài lại gói cũ; nếu bản mới đã chạy migration không tương thích ngược thì phải khôi phục DB (§3.3).

---

## 2. Kiểm tra sức khỏe và giám sát

| Kiểm tra | Lệnh / endpoint | Kỳ vọng |
|---|---|---|
| Readiness (F5 dùng) | `curl -s http://127.0.0.1:8088/api/actuator/health/readiness` hoặc `curl -s http://<APP>/healthz` | `{"status":"UP"}` |
| Liveness | `/api/actuator/health/liveness` | `UP` |
| Tổng hợp | `/api/actuator/health` | `UP` (không hiện chi tiết: `show-details: never`) |
| Phiên bản | `/api/actuator/info` | `build.version`, `build.time`, `app.name` |
| Replication | `mariadb -e 'SHOW SLAVE STATUS\G'` trên DB_02 | `Slave_IO_Running: Yes`, `Slave_SQL_Running: Yes`, `Seconds_Behind_Master` nhỏ |
| Semi-sync | `SHOW STATUS LIKE 'Rpl_semi_sync_master_status';` trên DB_01 | `ON` |
| Quartz cluster | `SELECT INSTANCE_NAME, FROM_UNIXTIME(LAST_CHECKIN_TIME/1000) FROM QRTZ_SCHEDULER_STATE;` | 2 dòng, checkin trong ~15s |
| Lịch chạy | `SELECT job_type, status, started_at, message FROM sync_batch ORDER BY id DESC LIMIT 10;` | `THANH_CONG` |
| Kết nối DB | `SHOW PROCESSLIST;` / `SHOW STATUS LIKE 'Threads_connected';` | ≤ 2 × `DB_POOL_MAX` + quản trị |
| MinIO | `mc admin info kpi` | online |
| Đĩa | `df -h /var/lib/mysql /data/minio /var/backups/kpi-bsc /var/lib/kpi-bsc` | < 80% |
| Chứng chỉ | `echo | openssl s_client -connect kpi.vnpt.vn:443 2>/dev/null | openssl x509 -noout -enddate` | còn > 30 ngày |

Lưu ý: readiness **không kiểm tra DB/MinIO** (nhóm mặc định của Spring Boot). Giám sát DB/MinIO riêng như bảng trên.

**Chưa triển khai:** endpoint metrics/Prometheus (Actuator chỉ mở `health,info`), cảnh báo tự động. Khuyến nghị giám sát bên ngoài (Zabbix/Prometheus node_exporter + mysqld_exporter) với ngưỡng:
- readiness ≠ UP > 1 phút; `Seconds_Behind_Master` > 60; đĩa > 80%;
- log WARN chứa “bị khóa tạm thời”, “Cảnh báo đăng nhập bất thường”, “Circuit breaker nguồn KPI mở”, “ClamAV không sẵn sàng”;
- `sync_batch.status = 'LOI'`.

---

## 3. Sao lưu và khôi phục

### 3.1 Sao lưu vật lý + logic hằng ngày — `deploy/scripts/backup.sh` (DB_01)

- Cron: `30 1 * * * /opt/kpi-bsc/scripts/backup.sh >> /var/log/kpi-bsc/backup.log 2>&1`.
- Đọc `/etc/kpi/backup.env`: `BACKUP_USER`, `BACKUP_PASSWORD`, `DB_NAME` (mặc định `kpi_bsc`), `BACKUP_DIR` (mặc định `/var/backups/kpi-bsc`), `RETENTION_DAYS` (mặc định 30), `OFFSITE_TARGET` (tùy chọn).
- Tạo `BACKUP_DIR/<yyyyMMdd_HHmm>/` gồm:
  - `physical.tar.gz` — `mariabackup --backup --databases=$DB_NAME` + `--prepare`;
  - `logical.sql.gz` — `mysqldump --single-transaction --routines --triggers --events --hex-blob`;
  - `SHA256SUMS`.
- Nếu có `OFFSITE_TARGET`: `mc mirror --overwrite` thư mục sang đích off-site.
- Xóa thư mục cũ hơn `RETENTION_DAYS` ngày.
- Binlog giữ 7 ngày (`binlog_expire_logs_seconds=604800`, cấu hình MariaDB — `deploy/TRIEN-KHAI.md` §2).

Kiểm tra sau mỗi đêm: `tail -n 5 /var/log/kpi-bsc/backup.log` (dòng “Xong sau …s, dung lượng …”), `ls -lt /var/backups/kpi-bsc | head`.

> Gợi ý: có thể chạy `backup.sh` trên DB_02 (replica) để giảm tải master — cần `backup.env` và user `kpi_backup` trên DB_02.

### 3.2 Sao lưu logic theo lịch ứng dụng — job “Sao lưu logic dữ liệu” (SAO_LUU_LOGIC)

- Chạy 03:00 Chủ nhật hoặc bấm “Chạy ngay” trong “Lịch đồng bộ”. Chạy trên **node Quartz nhận job** (APP_01 hoặc APP_02).
- Mỗi bảng nghiệp vụ (38 bảng: danh mục, giao, đánh giá, BSC, cấu hình, `file_object`…) → `<BACKUP_DIR>/<yyyyMMdd_HHmmss>/<bảng>.jsonl.gz`; giữ `params.keep` bản (mặc định 8). Không gồm `audit_log`, `login_log`, `user_session`, `notification`, `sync_batch*`, `QRTZ_*`.
- `BACKUP_DIR` lấy từ **tham số hệ thống** (seed `/var/backups/kpi`). Vì unit systemd đặt `ProtectSystem=strict` chỉ cho ghi `/var/lib/kpi-bsc` và `/var/log/kpi-bsc`, **phải đổi `BACKUP_DIR` thành `/var/lib/kpi-bsc/backup`**, nếu không job sẽ lỗi ghi file.
- Đây là bản trích xuất JSON để tra cứu/đối soát, **không có script khôi phục tự động**; khôi phục chính thức dùng §3.3.

### 3.3 Khôi phục — `deploy/scripts/restore.sh`

```
restore.sh <thư mục bản sao lưu> [physical|logical]     # mặc định physical
```

Quy trình (mục tiêu RTO ≤ 01 giờ):

1. **Dừng ứng dụng trên cả hai node** (script không tự dừng): `systemctl stop kpi-bsc` trên APP_01, APP_02. Disable pool trên F5 hoặc đặt trang bảo trì.
2. Trên DB_01: `/opt/kpi-bsc/scripts/restore.sh /var/backups/kpi-bsc/20261111_0130 logical`
   - script kiểm `sha256sum -c SHA256SUMS` trước;
   - `logical`: `DROP DATABASE` + `CREATE DATABASE … utf8mb4_vietnamese_ci` + nạp `logical.sql.gz` (cần `BACKUP_USER` có quyền DROP/CREATE/INSERT… — thường chạy với tài khoản quản trị, chỉnh `backup.env` tạm thời);
   - `physical`: dừng MariaDB, chuyển nội dung datadir cũ sang `<datadir>.before-restore.<epoch>` (cần đủ dung lượng trên phân vùng chứa thư mục này), `mariabackup --copy-back`, `chown mysql`, khởi động MariaDB.
3. Script in thời gian thực hiện. Khởi động lại ứng dụng: `systemctl start kpi-bsc` APP_01 → chờ UP → APP_02.
4. Kiểm tra: đăng nhập, số bản ghi chính (`SELECT COUNT(*) FROM evaluation_result;`…), `flyway_schema_history`.
5. Replica: sau khi khôi phục master, **dựng lại DB_02** từ master (`deploy/TRIEN-KHAI.md` §3) vì GTID đã thay đổi.

> **Chế độ `physical` đã diễn tập thành công (12/11/2026, §8.1 lần 3):** `backup.sh` sao lưu vật lý **toàn instance** (gồm schema hệ thống `mysql`) nên `--copy-back` thay cả datadir là hợp lệ; khôi phục 685 MB trong 23 s, dữ liệu khớp 100 %. Datadir cũ luôn được giữ lại (`*.before-restore.*`) để quay lui — xóa thủ công sau khi kiểm tra.

Khôi phục đến thời điểm (PITR) bằng binlog: **chưa có script**. Thủ công: khôi phục bản đêm gần nhất rồi `mariadb-binlog --start-position=<pos trong xtrabackup_binlog_info> --stop-datetime='…' mysql-bin.0000xx | mariadb`.

### 3.4 Khôi phục toàn bộ hệ thống (mất VM)

1. Dựng VM, cài theo `deploy/TRIEN-KHAI.md` (OS, JDK, Nginx, MariaDB, MinIO).
2. Khôi phục `/etc/kpi/secrets.env` từ két bí mật (đặc biệt `KPI_PII_KEY`, `KPI_JWT_SECRET` — mất `KPI_PII_KEY` = mất số điện thoại đã mã hóa).
3. Khôi phục DB (§3.3) từ bản off-site.
4. Khôi phục MinIO: `mc mirror kpi-dr/<bucket> kpi/<bucket>` (đảo chiều §4).
5. `bash install.sh` từ gói cùng phiên bản; kiểm tra §2.

---

## 4. MinIO mirror — `deploy/scripts/minio-mirror.sh`

- Cron hằng giờ trên DB_02 (hoặc DB_01): `0 * * * * /opt/kpi-bsc/scripts/minio-mirror.sh >> /var/log/kpi-bsc/minio-mirror.log 2>&1`.
- Cần alias `kpi` (nguồn) và `kpi-dr` (đích): `mc alias set kpi https://minio.kpi.local:9000 <ak> <sk>`, `mc alias set kpi-dr https://<db02>:9000 <ak> <sk>`.
- Lệnh: `mc mirror --overwrite --preserve kpi/$MINIO_BUCKET kpi-dr/$MINIO_BUCKET`; `MINIO_BUCKET` mặc định trong script là `kpi-bsc` — đặt biến môi trường cho cron nếu bucket khác (code mặc định `kpi-files`).
- Không xóa đối tượng ở đích khi nguồn xóa (không dùng `--remove`).
- RPO tệp ≈ 1 giờ. Muốn gần thời gian thực (đặc tả: `mc mirror --watch`): chạy thường trực `mc mirror --watch --overwrite --preserve kpi/<bucket> kpi-dr/<bucket>` dưới một unit systemd riêng (repo chưa có unit này).

---

## 5. Failover MariaDB thủ công (master hỏng)

1. Xác nhận DB_01 không phục hồi được trong thời gian chấp nhận; dừng ứng dụng 2 node.
2. Trên DB_02:
   ```sql
   STOP SLAVE;
   SHOW SLAVE STATUS\G            -- ghi lại Gtid_IO_Pos
   RESET SLAVE ALL;
   SET GLOBAL read_only = OFF;    -- và bỏ read_only=ON trong cnf
   ```
   Tạo user `kpi_app`, `kpi_migrate` nếu host APP chưa được cấp trên DB_02 (user replicate từ master nên thường đã có).
3. Trên APP_01/APP_02: sửa `DB_URL=jdbc:mariadb://db02.kpi.local:3306/kpi_bsc` trong `/etc/kpi/secrets.env` (chứng chỉ TLS DB_02 phải khớp hostname), `systemctl start kpi-bsc` từng node.
4. Trỏ MinIO: nếu DB_01 cũng mất MinIO, đổi `MINIO_ENDPOINT` sang MinIO DB_02 (dữ liệu tới lần mirror gần nhất).
5. Khi DB_01 sửa xong: dựng lại làm replica của DB_02 (`deploy/TRIEN-KHAI.md` §3), có thể chuyển vai trò lại vào giờ thấp điểm.

---

## 6. Bảo trì partition `audit_log`

`audit_log` partition theo tháng (`V001__init.sql`): `p2025` (< 2026-01-01), `p202601` … `p202706` (< 2027-07-01), `pmax` (MAXVALUE). **Từ 01/07/2027 mọi bản ghi rơi vào `pmax`** — vẫn hoạt động nhưng mất lợi ích partition (xóa theo tháng, truy vấn theo thời gian). Thực hiện **mỗi quý** (hoặc tối thiểu trước 06/2027).

Kiểm tra hiện trạng:

```sql
SELECT PARTITION_NAME, PARTITION_DESCRIPTION, TABLE_ROWS,
       FROM_DAYS(PARTITION_DESCRIPTION) AS less_than
FROM information_schema.PARTITIONS
WHERE TABLE_SCHEMA = 'kpi_bsc' AND TABLE_NAME = 'audit_log'
ORDER BY PARTITION_ORDINAL_POSITION;
```

(Dòng `pmax` có `PARTITION_DESCRIPTION = MAXVALUE`.)

Thêm partition 12 tháng tiếp theo bằng cách tách `pmax` (chạy trên **master** bằng user có quyền ALTER — `kpi_migrate` hoặc root; lệnh tự replicate sang slave):

```sql
ALTER TABLE audit_log REORGANIZE PARTITION pmax INTO (
  PARTITION p202707 VALUES LESS THAN (TO_DAYS('2027-08-01')),
  PARTITION p202708 VALUES LESS THAN (TO_DAYS('2027-09-01')),
  PARTITION p202709 VALUES LESS THAN (TO_DAYS('2027-10-01')),
  PARTITION p202710 VALUES LESS THAN (TO_DAYS('2027-11-01')),
  PARTITION p202711 VALUES LESS THAN (TO_DAYS('2027-12-01')),
  PARTITION p202712 VALUES LESS THAN (TO_DAYS('2028-01-01')),
  PARTITION p202801 VALUES LESS THAN (TO_DAYS('2028-02-01')),
  PARTITION p202802 VALUES LESS THAN (TO_DAYS('2028-03-01')),
  PARTITION p202803 VALUES LESS THAN (TO_DAYS('2028-04-01')),
  PARTITION p202804 VALUES LESS THAN (TO_DAYS('2028-05-01')),
  PARTITION p202805 VALUES LESS THAN (TO_DAYS('2028-06-01')),
  PARTITION p202806 VALUES LESS THAN (TO_DAYS('2028-07-01')),
  PARTITION pmax    VALUES LESS THAN MAXVALUE
);
```

- Khi `pmax` còn rỗng, lệnh gần như tức thời. Nếu `pmax` đã có dữ liệu, MariaDB phải chép lại các dòng (khóa bảng, ghi audit bị chờ) → chạy giờ thấp điểm.
- Sinh nhanh danh sách cho lần sau (thay năm/tháng bắt đầu):
  ```bash
  for i in $(seq 0 11); do s=$(date -d "2028-07-01 +$i month" +%Y-%m-01); n=$(date -d "$s +1 month" +%Y-%m-01); \
    echo "  PARTITION p$(date -d "$s" +%Y%m) VALUES LESS THAN (TO_DAYS('$n')),"; done
  ```
- Đây là thay đổi ngoài Flyway; Flyway chỉ kiểm checksum file migration nên không bị ảnh hưởng. Ghi lại vào sổ vận hành.

Lưu trữ/xóa dữ liệu cũ (theo chính sách lưu trữ CĐT, ví dụ giữ 5 năm):

```bash
# xuất partition trước khi xóa
mysqldump --single-transaction --no-create-info --where="at < '2026-01-01'" kpi_bsc audit_log | gzip > audit_log_p2025.sql.gz
```
```sql
ALTER TABLE audit_log DROP PARTITION p2025;
```

---

## 7. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Xử lý |
|---|---|---|
| Dịch vụ không lên, log `StartupSecurityCheck thất bại — từ chối khởi động: …` | Còn secret mặc định/yếu, `BYPASS_SSO=true`, cookie không Secure | Sửa đúng mục được liệt kê trong `/etc/kpi/secrets.env` (`docs/ATTT.md` §7) |
| `KPI_JWT_SECRET phải dài tối thiểu 64 byte` | Secret ngắn, hoặc `KPI_JWT_SECRET_PREVIOUS` dính chú thích cuối dòng từ `env.example` | Sinh lại bằng `openssl rand -base64 64`; xóa chú thích cuối dòng; để trống biến nếu không dùng |
| `KPI_PII_KEY phải dài tối thiểu 32 ký tự` | Thiếu/ngắn | Đặt khóa (không đổi khóa đã dùng) |
| Đăng nhập DB lỗi `Access denied for user 'kpi_app                 # …'` | Chú thích cuối dòng trong secrets.env | Xóa phần `# …` |
| Lỗi SSL tới MariaDB | `DB_SSL_MODE=verify-full` nhưng DB chưa bật TLS/JVM chưa tin CA/hostname lệch | Cấu hình TLS (`deploy/TRIEN-KHAI.md` §2) |
| Flyway `Validate failed` | File migration đã chạy bị sửa | Không sửa migration đã áp dụng; đối chiếu `flyway_schema_history`, liên hệ nhà phát triển |
| `nginx -t`: `unknown directive "http2"` | Nginx < 1.25.1 | `deploy/TRIEN-KHAI.md` §6.2 |
| F5 đánh dấu node DOWN | ứng dụng chưa sẵn sàng/đang dừng; site `default` chiếm cổng 80 | `curl http://127.0.0.1:8088/api/actuator/health/readiness`; xóa site default |
| SSO xong bị chuyển tới URL sai (`…vnpt.vndashboard`) | `KPI_FRONTEND_URL` thiếu `/` cuối | Đặt `https://kpi.vnpt.vn/` |
| SSO báo “Tài khoản chưa được cấp quyền truy cập hệ thống” | User chưa tạo, `auth_source=LOCAL`, hoặc không hoạt động | Tạo/sửa người dùng (`docs/HDQT.md` §1.2) |
| “Không kết nối được máy chủ VNPT SSO” | `CAS_SERVER_URL` sai, firewall egress | `curl -v $CAS_SERVER_URL/login` từ APP |
| Người dùng báo “Tài khoản tạm khóa…” | Sai mật khẩu ≥ `LOGIN_MAX_FAILED` | Chờ hoặc mở khóa SQL (`docs/HDQT.md` §1.3) |
| Nhiều người cùng bị 429/“quá nhiều yêu cầu” khi đăng nhập | Sau F5 SNAT, rate limit theo IP F5 | Cấu hình `real_ip` (`deploy/TRIEN-KHAI.md` §6.2) |
| Lỗi CSRF “Phiên làm việc không hợp lệ (CSRF)” | Cookie `XSRF-TOKEN` cũ/không có | Tải lại trang; kiểm tra không có proxy xóa cookie |
| Tải tệp mở ra trang lỗi/không truy cập được | Trình duyệt không tới được `MINIO_ENDPOINT`; presigned URL hết hạn (300s) | `deploy/TRIEN-KHAI.md` §7; bấm tải lại |
| “Không lưu được tệp vào kho lưu trữ” | MinIO dừng, sai key, bucket chưa tạo | `mc admin info kpi`, `mc ls kpi/<bucket>` |
| “Nội dung tệp không khớp định dạng” | Đổi đuôi tệp | Người dùng lưu đúng định dạng |
| Đồng bộ KPI lỗi hàng loạt, log “Circuit breaker nguồn KPI mở” | API nguồn lỗi 5 lần liên tiếp | Kiểm tra `KPI_SOURCE_BASE_URL`, xác thực; tự đóng sau 30s; “Chạy ngay” lại |
| Đổi tham số nhưng một số người vẫn thấy giá trị cũ | Cache `sys_config` từng node | Khởi động lại lần lượt 2 node (`docs/HDQT.md` §3) |
| Job “Sao lưu logic dữ liệu” lỗi ghi file | `BACKUP_DIR` ngoài vùng ghi được | `BACKUP_DIR=/var/lib/kpi-bsc/backup` |
| Lịch không chạy | Lịch tắt, Quartz node lệch giờ, misfire | `QRTZ_SCHEDULER_STATE`, `chronyc tracking`, “Chạy ngay” |
| OOM, tiến trình thoát (`ExitOnOutOfMemoryError`) | Heap `-Xmx3g` nhỏ khi xuất lớn | Tăng `-Xmx`; phân tích `/var/log/kpi-bsc/*.hprof` |
| Replication dừng (`Slave_SQL_Running: No`) | Xung đột/ghi tay trên slave | Xem `Last_SQL_Error`; dựng lại replica nếu cần |

Khi liên hệ hỗ trợ: gửi `traceId` (hiển thị trong thông báo lỗi/response), thời điểm, tài khoản, `build.version` từ `/api/actuator/info`.

---

## 8. Mục tiêu RTO/RPO

| Chỉ số | Mục tiêu | Cơ sở |
|---|---|---|
| RTO (khôi phục DB từ bản sao lưu) | ≤ 01 giờ (E-HSMT, PHẦN D §1.a) | `restore.sh` + khởi động 2 node |
| RTO (failover sang DB_02) | ≤ 30 phút (đề xuất) | §5 thủ công |
| RPO dữ liệu DB — có replica | ≈ 0 (semi-sync) | GTID + semi-sync |
| RPO dữ liệu DB — chỉ bản sao lưu | ≤ 24 giờ (bản đêm); thấp hơn nếu áp binlog thủ công | §3.1, §3.3 |
| RPO tệp MinIO | ≤ 1 giờ (cron mirror) | §4 |
| Tần suất sao lưu | Hằng ngày (tối thiểu E-HSMT: 1 lần/tháng) | cron `backup.sh` |
| Diễn tập khôi phục | Hằng tháng | §8.1 |

### 8.1 Kết quả đo RTO thực tế

> Lần 1 đo trên môi trường dev (dữ liệu demo). **Bắt buộc** đo lại trên staging có dữ liệu cỡ thật (PHẦN D §1.a yêu cầu “đã đo thời gian thật”) và điền lần 2–3.

| Lần | Ngày | Môi trường | Kích thước DB | Chế độ | Thời gian `restore.sh` | Tổng thời gian đến khi 2 node UP | Người thực hiện | Ghi chú |
|---|---|---|---|---|---|---|---|---|
| 1 | 11/11/2026 | Dev: MariaDB 10.11 (Docker), 1 node ứng dụng | 20,6 MB (8.352 kết quả đánh giá) | logical (`mariadb-dump --single-transaction` + gzip → nạp lại CSDL mới) | sao lưu 1 s; khôi phục 7 s; đối chiếu số dòng `evaluation_result` khớp 8.352/8.352 | + khởi động ứng dụng 11 s (readiness UP) ⇒ **≈ 20 s** | Nhóm triển khai | Ngoại suy tuyến tính theo kích thước: ~ 6 phút/GB khôi phục logical — với CSDL > 5 GB nên dùng physical (mariabackup) để đạt RTO ≤ 1 giờ |
| 2 | 12/11/2026 | Diễn tập: container `mariadb:10.11` sạch, chạy đúng `backup.sh` + `restore.sh` (systemctl thay bằng stub) | 685 MB (seed-volume: 50.112 kết quả, 2.003.812 audit, 15.014 user) | logical | `backup.sh` 84 s (cả physical + logical, 144 MB nén); `restore.sh logical` **323 s** | + 11 s khởi động ứng dụng ⇒ ≈ 5,6 phút | Nhóm triển khai | Đối chiếu số dòng 3 bảng khớp 100 % |
| 3 | 12/11/2026 | như lần 2 | 685 MB | physical (mariabackup toàn instance) | `backup.sh` 48 s; `restore.sh physical` **23 s** | + 11 s ⇒ **≈ 35 s** | Nhóm triển khai | Khớp 100 %. Phát hiện & sửa: (1) backup partial `--databases` không khôi phục được khi thay cả datadir → sao lưu toàn instance; (2) `mv datadir` lỗi khi datadir là mount point → chuyển nội dung sang thư mục `*.before-restore.*` |
| 4 | _chưa đo_ | Staging/production thật (DB_01/DB_02) | | physical | | | | Bắt buộc trước nghiệm thu: đo trên phần cứng và dữ liệu thật |

Cách đo: ghi thời điểm bắt đầu dừng ứng dụng → dòng “Khôi phục (…) xong sau Ns” của `restore.sh` → thời điểm readiness UP cả hai node.
