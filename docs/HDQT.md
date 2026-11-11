# HƯỚNG DẪN QUẢN TRỊ HỆ THỐNG — KPI-BSC

> Dành cho người giữ vai trò **Admin hệ thống** (`ADMIN_HT`). Các chức năng nằm ở menu “Quản trị hệ thống” (`/system`), gồm các tab: “Danh sách người dùng”, “Vai trò”, “Quyền”, “Danh sách đơn vị”, “Lịch đồng bộ”, “Tham số hệ thống”, “Nhật ký hệ thống”. Tab chỉ hiện khi tài khoản có quyền `…:VIEW` tương ứng.
> Thao tác hằng ngày của người dùng nghiệp vụ: xem `docs/HDSD/`. Cài đặt: `deploy/TRIEN-KHAI.md`. Vận hành máy chủ: `docs/VAN-HANH.md`.

---

## 1. Mô hình phân quyền

- **Người dùng** (`app_user`) thuộc một **đơn vị**; có `auth_source`:
  - `LOCAL` — chỉ đăng nhập bằng mật khẩu nội bộ;
  - `CAS` — chỉ đăng nhập qua VNPT SSO (mật khẩu bị bỏ qua);
  - `BOTH` — cả hai.
- **Vai trò** (`role`) gom các **quyền** dạng `MODULE:ACTION` và có **phạm vi dữ liệu**:
  - `ALL` — toàn bộ đơn vị;
  - `UNIT` — đơn vị áp dụng;
  - `UNIT_AND_CHILDREN` — đơn vị áp dụng và các đơn vị con.
- Khi gán vai trò cho người dùng có thể chọn **đơn vị áp dụng** (`user_role.org_unit_id`). Để trống = đơn vị của người dùng. Một người có thể giữ nhiều vai trò ở nhiều đơn vị; phạm vi được tính theo đúng vai trò chứa quyền đang dùng.
- Quyền có hiệu lực sau tối đa **60 giây** (cache). Trên node xử lý thao tác sửa, cache được xóa ngay.

### 1.1 Vai trò seed sẵn (`V003__seed_identity.sql`)

| Mã | Tên | Phạm vi | Quyền mặc định (tóm tắt) |
|---|---|---|---|
| ADMIN_HT | Admin hệ thống | ALL | Tất cả quyền, kể cả `AUDIT:VIEW` |
| LANH_DAO_TD | Lãnh đạo Tập đoàn | ALL | Xem: Dashboard, KPI của tôi, danh mục, giao, chiến lược, đánh giá, BSC + `BSC:REPORT`, xuất Dashboard |
| TONG_GIAM_DOC | Tổng giám đốc | ALL | Như Lãnh đạo + `BSC:APPROVE` |
| ADMIN_TD | Admin Tập đoàn/Admin | ALL | Tất cả trừ `AUDIT:VIEW`, `BSC:APPROVE` |
| QT_TH_GIAO | Quản trị và Tổng hợp giao KPI | ALL | Toàn quyền KPI/UOM/PERSPECTIVE/OBJECTIVE/FORMULA/ASSIGN; xem chiến lược, đánh giá, BSC, Dashboard |
| QT_TH_THAM_DINH | Quản trị và tổng hợp thẩm định kết quả thực hiện | ALL | Toàn quyền EVAL, DASHBOARD, BSC (trừ APPROVE); xem danh mục, `FORMULA:TEST` |
| GIAO_KPI | Giao KPI | UNIT_AND_CHILDREN | Toàn quyền ASSIGN; xem danh mục, chiến lược, Dashboard |
| PHOI_HOP_KPI | Phối hợp KPI | UNIT_AND_CHILDREN | Xem giao/đánh giá, `EVAL:INPUT` |
| DANH_GIA_KPI | Đánh giá KPI | UNIT_AND_CHILDREN | EVAL VIEW/SYNC/INPUT/IMPORT/ADJUST/CLOSE_R2, `BSC:VIEW` |
| LAP_CHIEN_LUOC | Lập chiến lược | UNIT_AND_CHILDREN | Toàn quyền STRATEGY, OBJECTIVE |
| NGUOI_DUNG_DV | Người dùng đơn vị | UNIT | `MYKPI:VIEW/PROPOSE_ADJUST/EXPORT`, `DASHBOARD:VIEW_UNIT` |

Mọi vai trò đều có `NOTIFY:VIEW`. Danh mục mã quyền đầy đủ: `docs/SPEC.md` PHẦN B §5 (+ `AUDIT:VIEW`).

### 1.2 Thao tác

| Việc | Nơi thực hiện | Quyền |
|---|---|---|
| Thêm/sửa/xóa người dùng, nhập/xuất Excel | tab “Danh sách người dùng” | `USER:CREATE/UPDATE/DELETE/IMPORT/EXPORT` |
| Gán vai trò (kèm đơn vị áp dụng) | tab “Danh sách người dùng” → gán vai trò (`PUT /api/users/{id}/roles`) | `USER:ASSIGN_ROLE` |
| Thêm/sửa vai trò, chọn quyền, phạm vi dữ liệu | tab “Vai trò” (`/api/roles`, `/api/roles/{id}/permissions`) | `ROLE:*` |
| Sửa tên/mô tả/thứ tự quyền | tab “Quyền” (mã quyền là seed cứng, không thêm/xóa) | `PERMISSION:UPDATE` |
| Cây đơn vị | tab “Danh sách đơn vị” | `ORG:*` |

Quy tắc:
- Vai trò `is_system = 1` (11 vai trò seed) **không xóa được**. Xóa vai trò đang gán cho người dùng cần xác nhận và sẽ bỏ gán.
- Người dùng xóa mềm (`deleted = 1`). Đổi trạng thái sang `KHOA`/`NGUNG` → thu hồi toàn bộ phiên đăng nhập của người đó ngay.
- Admin chỉ thao tác được người dùng trong phạm vi đơn vị của mình (kiểm tra `DataScopeService`).
- Người dùng nguồn `LOCAL`/`BOTH` bắt buộc có “Mật khẩu khởi tạo” (chính sách: ≥ 8 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt).
- Tài khoản SSO: tạo trước người dùng với `auth_source = CAS` hoặc `BOTH`, `username` hoặc `email` trùng thông tin CAS trả về. Người dùng CAS chưa được tạo sẽ thấy “Tài khoản chưa được cấp quyền truy cập hệ thống”.

### 1.3 Đặt lại mật khẩu, mở khóa

- **Đặt lại mật khẩu:** sửa người dùng, nhập “Mật khẩu khởi tạo” mới rồi lưu. Hệ thống **chưa có** chức năng người dùng tự đổi mật khẩu hoặc buộc đổi ở lần đăng nhập đầu — gửi mật khẩu mới qua kênh an toàn.
- **Khóa tạm do đăng nhập sai** (≥ `LOGIN_MAX_FAILED` lần): tự mở sau `LOGIN_LOCK_MINUTES` phút. Chưa có nút “Mở khóa” trên UI; nếu cần mở sớm, DBA chạy:
  ```sql
  UPDATE app_user SET locked_until = NULL, failed_login_count = 0 WHERE username = '<tên>' AND deleted = 0;
  ```
- **Khóa hẳn:** đặt trạng thái “Khóa” (`KHOA`).

---

## 2. Tài khoản quản trị đầu tiên (bootstrap)

1. **Seed `R__seed_02_org.sql`** (chạy cả ở production) tạo tài khoản `admin` (vai trò `ADMIN_HT`, `auth_source = BOTH`) **không có mật khẩu**. Chỉ môi trường dev (`db/seed-dev`) mới gán mật khẩu dev.
2. **`AdminBootstrap`** (khi ứng dụng sẵn sàng) chạy khi **không có tài khoản `ADMIN_HT` nào đang hoạt động và có mật khẩu**:
   - dùng `KPI_BOOTSTRAP_ADMIN_USERNAME` (mặc định `admin`) và `KPI_BOOTSTRAP_ADMIN_PASSWORD` (không có mặc định, phải đạt chính sách mật khẩu);
   - nếu username đã tồn tại → kích hoạt lại, đặt mật khẩu mới, xóa khóa; nếu chưa → tạo mới ở đơn vị gốc;
   - gán `ADMIN_HT`, log WARN “Đã khởi tạo tài khoản Admin hệ thống…”.
3. **Ở production**:
   - `StartupSecurityCheck` từ chối khởi động nếu mật khẩu bootstrap là giá trị mặc định/yếu.
   - `AdminBootstrap` quét các tài khoản còn **mật khẩu mặc định của dev** (ví dụ CSDL nâng cấp từ bản cũ). Tài khoản khác `admin` bị vô hiệu mật khẩu (cấp lại qua “Quản lý người dùng”). Riêng `admin` còn mật khẩu dev mà không có `KPI_BOOTSTRAP_ADMIN_PASSWORD` thì ứng dụng **từ chối khởi động**.

Quy trình bắt buộc lần cài đặt đầu:

1. Đặt `KPI_BOOTSTRAP_ADMIN_PASSWORD=<mật khẩu mạnh>` trong `/etc/kpi/secrets.env` của **một** node, khởi động node đó.
2. Đăng nhập `admin`, tạo tài khoản quản trị đích danh cho từng cán bộ (gán `ADMIN_HT`), sau đó có thể chuyển `admin` sang “Khóa”.
3. Xóa giá trị `KPI_BOOTSTRAP_ADMIN_PASSWORD` và khởi động lại.

Dùng AdminBootstrap để **cứu hộ** khi mất hết tài khoản quản trị: đảm bảo không còn `ADMIN_HT` hoạt động (ví dụ đã bị khóa), đặt `KPI_BOOTSTRAP_ADMIN_PASSWORD=<mật khẩu mạnh>` trên **một** node, khởi động lại node đó, đăng nhập, rồi xóa biến và khởi động lại.
---

## 3. Tham số hệ thống (tab “Tham số hệ thống”, `/api/sys-configs`)

Seed tại `R__seed_01_config.sql` (`INSERT IGNORE` — không ghi đè giá trị đã sửa). Tham số `is_core = 1` **không xóa được**. Tham số `is_secret = 1` hiển thị `********`; khi lưu lại giá trị che thì giữ nguyên giá trị cũ.

| Khóa | Mặc định | Nhóm | Ý nghĩa | Lõi |
|---|---|---|---|---|
| `KPI_PASS_SCORE` | 3 | DANH_GIA | Điểm tối thiểu để KPI đạt/vượt (thang 5) | ✓ |
| `KPI_WARNING_RATE` | 90 | DANH_GIA | % TH/KH kỳ dưới mức này là “KPI cảnh báo” | ✓ |
| `KPI_COMPLETION_CAP` | 200 | DANH_GIA | Trần % hoàn thành (công thức nghịch khi TH = 0) | ✓ |
| `DEADLINE_DAY_AFTER_PERIOD` | 15 | DANH_GIA | Hạn cập nhật kết quả: số ngày sau khi kết thúc kỳ | ✓ |
| `UPLOAD_MAX_MB` | 10 | TEP | Dung lượng tệp tối đa (MB). Không vượt 20 (giới hạn multipart) | ✓ |
| `UPLOAD_ALLOWED_EXT` | xlsx,xls,docx,pdf,png,jpg,jpeg | TEP | Đuôi cho phép (chỉ có hiệu lực với đuôi nằm trong danh sách này) | ✓ |
| `FILE_RETENTION_YEARS` | 10 | TEP | Số năm lưu giữ tệp (ghi `retention_until`; chưa có job dọn) | |
| `LOGIN_MAX_FAILED` | 5 | BAO_MAT | Số lần sai trước khi khóa tạm | ✓ |
| `LOGIN_LOCK_MINUTES` | 15 | BAO_MAT | Thời gian khóa tạm (phút) | ✓ |
| `KPI_SOURCE_BASE_URL` | http://localhost:8092 | TICH_HOP | URL nguồn số liệu KPI — **phải sửa ở prod** (giá trị seed là mock dev) | ✓ |
| `KPI_SOURCE_AUTH_TYPE` | NONE | TICH_HOP | NONE, API_KEY, BEARER, BASIC (secret nằm ở biến môi trường `KPI_SOURCE_*`) | ✓ |
| `NOTIFY_EMAIL_ENABLED` | false | THONG_BAO | Bật gửi email | ✓ |
| `NOTIFY_ZALO_ENABLED` | false | THONG_BAO | Bật gửi Zalo | ✓ |
| `REMIND_DAYS_BEFORE_DEADLINE` | 5 | THONG_BAO | Số ngày nhắc trước hạn | ✓ |
| `ZALO_TEMPLATE_GIAO_KPI` | (trống) | THONG_BAO | Template ZNS cho sự kiện giao KPI | |
| `DASHBOARD_DEFAULT_PERIOD` | LATEST | DASHBOARD | Kỳ mặc định dashboard (LATEST hoặc Y/Q1..Q4/H1) | ✓ |
| `BACKUP_DIR` | /var/backups/kpi | VAN_HANH | Thư mục job “Sao lưu logic dữ liệu” — **đổi thành `/var/lib/kpi-bsc/backup`** (unit systemd chỉ cho ghi `/var/lib/kpi-bsc`, `/var/log/kpi-bsc`) | |

Template Zalo cho các sự kiện khác: thêm tham số `ZALO_TEMPLATE_<SỰ_KIỆN>` với `<SỰ_KIỆN>` ∈ `GIAO_KPI`, `NHAC_HAN`, `DE_NGHI_DIEU_CHINH`, `XU_LY_DIEU_CHINH`, `CHOT_KET_QUA`, `TGD_DUYET`, `DIEU_CHINH_MUC_TIEU`, `THU_HOI`. Thiếu template → sự kiện đó không gửi Zalo.

Khung điểm thang 5 không nằm ở đây mà ở bảng `scoring_method` (`KHUNG_TY_LE_5`, `DAT_KHONG_DAT`, `NHAP_DIEM`) — chưa có màn hình sửa `config`; DBA cập nhật cột JSON `config` nếu CĐT ban hành khung chính thức.

> **Quan trọng (2 node):** giá trị tham số được nạp vào bộ nhớ mỗi node và chỉ làm mới trên node xử lý thao tác lưu. Sau khi sửa tham số, **khởi động lại lần lượt cả hai node** (`systemctl restart kpi-bsc`, từng node, chờ readiness UP) để đảm bảo cả hai dùng giá trị mới.

---

## 4. Lịch đồng bộ (tab “Lịch đồng bộ”, `/api/schedules`)

Quartz JDBC clustered: mỗi lần kích hoạt chỉ chạy trên một node. Cron theo cú pháp Quartz 6–7 trường (`giây phút giờ ngày tháng thứ [năm]`), múi giờ `Asia/Ho_Chi_Minh`; màn hình hiển thị mô tả tiếng Việt của cron.

| Mã | Tên | Cron mặc định | Bật | Tham số `params` (JSON) |
|---|---|---|---|---|
| DONG_BO_KQ | Đồng bộ kết quả KPI | `0 0 1 * * ?` (01:00 hằng ngày) | ✓ | `{"year":2026,"periods":["Q3"]}` (tùy chọn; mặc định năm hiện tại, các kỳ đã bắt đầu chưa chốt) |
| HOAN_TAT_CL | Hoàn tất chiến lược | `0 30 0 1 1 ?` (00:30 ngày 01/01) | ✓ | `{"year":…}` |
| NHAC_HAN | Nhắc hạn cập nhật kết quả | `0 0 8 * * ?` | ✓ | — (dùng `DEADLINE_DAY_AFTER_PERIOD`, `REMIND_DAYS_BEFORE_DEADLINE`) |
| TINH_LAI_BSC | Tính lại điểm BSC | `0 0 2 * * ?` | ✗ | `{"year":…,"periods":["Q1","Q2","H1","Q3","Q4","Y"]}` |
| DONG_BO_HRM | Đồng bộ HRM | `0 0 4 * * ?` | ✗ | — (adapter stub, chưa có API HRM) |
| SAO_LUU | Sao lưu logic dữ liệu | `0 0 3 ? * SUN` (03:00 Chủ nhật) | ✓ | `{"keep":8}` — số bản giữ lại |

- Sửa cron/bật-tắt → áp dụng ngay (reschedule). Misfire (bỏ lỡ do tắt máy) **không chạy bù**.
- “Chạy ngay” (`SCHEDULE:RUN`) kích hoạt một lần, ghi `sync_batch.trigger = USER`.
- Kết quả từng lần chạy: cột lần chạy gần nhất/trạng thái trên màn hình; chi tiết trong bảng `sync_batch` / `sync_batch_item`:
  ```sql
  SELECT id, job_type, `trigger`, started_at, finished_at, status, total, success, failed, message
  FROM sync_batch ORDER BY id DESC LIMIT 20;
  ```

---

## 5. Nhật ký hệ thống

- Tab “Nhật ký hệ thống” (chỉ `ADMIN_HT`, quyền `AUDIT:VIEW`): lọc theo người dùng, hành động, đối tượng, từ ngày–đến ngày. Hiển thị trước/sau (JSON, trường nhạy cảm đã che `***`), IP, User-Agent, traceId.
- Hành động thường gặp: `THEM`, `SUA`, `XOA`, `DANG_NHAP`, `DANG_XUAT`, `GAN_VAI_TRO`, `PHAN_QUYEN`, `NHAP_DU_LIEU`, `CHAY_NGAY`, `TAI_LEN_TEP`, `XUAT_BAO_CAO`, và các hành động nghiệp vụ (`CHOT_GIAO`, `SAO_CHEP`, `DONG_BO`, `NHAP_KET_QUA`, `DE_NGHI_DIEU_CHINH`, `DIEU_CHINH_KET_QUA`, `THU_HOI`, `TINH_LAI_DIEM`, `TGD_DUYET`…).
- Lịch sử đăng nhập (`login_log`, gồm cả lần thất bại) **chưa có màn hình**; tra cứu bằng SQL:
  ```sql
  SELECT at, username, result, auth_method, ip FROM login_log
  WHERE at >= NOW() - INTERVAL 1 DAY ORDER BY at DESC;
  -- result: THANH_CONG, SAI_THONG_TIN, TAM_KHOA, BI_KHOA, NGUNG_HOAT_DONG, SSO_CHUA_CAP_QUYEN
  ```
- Dùng `traceId` (header `X-Trace-Id`, trường `traceId` trong response lỗi) để tìm log máy chủ tương ứng: `journalctl -u kpi-bsc | grep <traceId>`.

---

## 6. Thay template báo cáo (JXLS)

Mẫu báo cáo nằm ở bảng `report_template` (mã: `TTR94_TONG_HOP`, `TTR94_CHI_TIET`, `KPI_TUNG_TINH`, `BIEU_GIAO_KPI`, `BIEU_KET_QUA_KPI`, `KQ_DANH_GIA_DON_VI`, `BANG_TH_TCT`), file `.xlsx` lưu trên MinIO (`file_id`). Lần xuất đầu tiên của mỗi mã, nếu chưa có file, hệ thống tự sinh template mặc định và lưu lại.

**Chưa có màn hình/API thay template.** Quy trình hiện tại:

1. Lấy template hiện hành làm mẫu: tìm `file_id` rồi tải về.
   ```sql
   SELECT rt.code, rt.file_id, f.bucket, f.object_key FROM report_template rt LEFT JOIN file_object f ON f.id = rt.file_id;
   ```
   ```bash
   mc cp kpi/<bucket>/<object_key> ./Mau_TTR94_TONG_HOP.xlsx
   ```
2. Sửa trong Excel, **giữ nguyên các chú thích ô JXLS** (`jx:area`, `jx:each`) và biểu thức `${…}` (vd `${r.code}`), chỉ đổi định dạng/tiêu đề/vị trí.
3. Tải file mới lên bằng tài khoản quản trị qua API `POST /api/files` (multipart, trường `file`; có thể dùng Swagger nội bộ `/api/docs`). Ghi lại `id` trả về.
4. Gắn vào mẫu:
   ```sql
   UPDATE file_object SET owner_type = 'REPORT_TEMPLATE' WHERE id = <id_moi>;
   UPDATE report_template SET file_id = <id_moi>, version = version + 1, updated_at = NOW(3) WHERE code = 'TTR94_TONG_HOP';
   ```
5. Xuất thử báo cáo trên màn hình “Tổng hợp kết quả BSC”. Nếu lỗi (“Không xuất được báo cáo theo mẫu …”), đặt lại `file_id` cũ.

Quay về mẫu mặc định: `UPDATE report_template SET file_id = NULL WHERE code = '<mã>';` (lần xuất tiếp theo tự sinh lại).

---

## 7. Danh mục tính điểm, giai đoạn, viễn cảnh

- Viễn cảnh seed: `TC` Tài chính, `KH` Khách hàng, `QT` Quy trình nội bộ, `HP` Học hỏi & phát triển (mã dùng làm tiền tố mã KPI, bất biến khi đã dùng).
- Giai đoạn seed: `GD_2021_2025`, `GD_2026_2030`.
- Phương pháp tính điểm: xem §3 (sửa bằng SQL).

---

## 8. Checklist quản trị định kỳ

| Tần suất | Việc |
|---|---|
| Hằng ngày | Xem trạng thái lần chạy “Đồng bộ kết quả KPI”, “Nhắc hạn cập nhật kết quả” |
| Hằng tuần | Rà soát “Nhật ký hệ thống” các hành động `XOA`, gán vai trò; rà `login_log` thất bại nhiều |
| Hằng tháng | Rà soát người dùng `HOAT_DONG` không đăng nhập > 90 ngày (`last_login_at`), khóa tài khoản nghỉ việc |
| Hằng quý | Rà soát vai trò/quyền theo nguyên tắc tối thiểu; kiểm tra partition `audit_log` (`docs/VAN-HANH.md` §6) |
