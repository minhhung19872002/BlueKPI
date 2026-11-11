# GIẢI PHÁP AN TOÀN THÔNG TIN — KPI-BSC

> Tài liệu bàn giao (PHẦN B §9, PHẦN D §1.a, §1.d). Mỗi mục ghi **vị trí trong mã nguồn** để kiểm chứng.
> Điểm nào đặc tả yêu cầu nhưng code chưa có được ghi “**Chưa triển khai**”; rủi ro còn lại ghi ở §14.

---

## 1. Định danh và xác thực

| Cơ chế | Hiện thực | Vị trí |
|---|---|---|
| Đăng nhập nội bộ | `POST /api/auth/login` (username/password, Bean Validation), so khớp bcrypt | `security/AuthController`, `AuthService.login` |
| Băm mật khẩu | `BCryptPasswordEncoder(12)` (cost 12) | `config/SecurityConfig.passwordEncoder` |
| SSO VNPT CAS | CAS 2.0 `/serviceValidate` hoặc 3.0 `/p3/serviceValidate`; ticket kiểm tra regex `^[A-Za-z0-9._\-]{4,256}$`; XML parser bật `FEATURE_SECURE_PROCESSING`, cấm DOCTYPE, tắt external entity (chống XXE); timeout 5s/10s | `VnptSsoController`, `CasTicketValidator` |
| Map SSO → tài khoản | theo username hoặc email; tài khoản không tồn tại, `auth_source=LOCAL`, hoặc trạng thái ≠ `HOAT_DONG` → “Tài khoản chưa được cấp quyền truy cập hệ thống” | `AuthService.loginSso` |
| Chống dò tài khoản | user không tồn tại vẫn chạy bcrypt với hash giả (cân bằng thời gian); cùng một thông báo lỗi `ERR_LOGIN_FAILED`; trạng thái khóa chỉ tiết lộ khi mật khẩu đúng | `AuthService.login` |
| Tài khoản `auth_source=CAS` | không đăng nhập được bằng mật khẩu | `AuthService.login` (`!"CAS".equals(authSource)`) |

### 1.1 Chính sách mật khẩu
`PasswordPolicy.valid`: 8–128 ký tự, có chữ hoa, chữ thường, chữ số và ký tự đặc biệt. Áp dụng khi tạo/sửa người dùng (`UserService`), nhập file (`UserImportHandler`) và mật khẩu bootstrap (`AdminBootstrap`).
**Chưa triển khai:** người dùng tự đổi mật khẩu, bắt buộc đổi ở lần đăng nhập đầu, hết hạn mật khẩu, lịch sử mật khẩu (cột `password_changed_at` có nhưng chưa dùng để cưỡng chế).

### 1.2 Khóa tài khoản và rate limit
- Sai mật khẩu ≥ `LOGIN_MAX_FAILED` (mặc định 5) → `locked_until = now + LOGIN_LOCK_MINUTES` (mặc định 15) — tham số trong `sys_config`, sửa được trên UI.
- Từ lần sai thứ 3: log WARN “Cảnh báo đăng nhập bất thường”; khi khóa: log WARN. Đăng nhập từ IP khác lần trước: log WARN “Cảnh báo đăng nhập từ IP mới”.
- Rate limit theo IP cho `/api/auth/login`, 2 lớp:
  - Nginx: `limit_req_zone … zone=kpi_login rate=10r/m`, `burst=5 nodelay` (`deploy/nginx/kpi.conf`).
  - Ứng dụng: `LoginRateLimiter` cửa sổ cố định 1 phút, `KPI_LOGIN_RATE_LIMIT` (mặc định 20, env.example 10), vượt → `ERR_TOO_MANY_REQUESTS`. Bộ đếm nằm trong bộ nhớ **từng node**.
- Mọi lần đăng nhập (thành công/thất bại/khóa/SSO chưa cấp quyền) ghi `login_log` trong transaction riêng (`LoginAttemptLogger`, `REQUIRES_NEW`).

---

## 2. Phiên làm việc (JWT + cookie)

| Thuộc tính | Giá trị | Vị trí |
|---|---|---|
| Thuật toán | HS512, secret `KPI_JWT_SECRET` **≥ 64 byte** (ứng dụng không khởi động nếu ngắn hơn) | `JwtService.toKey` |
| Claim | `sub`=userId, `usr`, `sid` (id `user_session`), `am` (LOCAL/CAS), `typ=access`, `iss=kpi-bsc` | `JwtService.issueAccessToken` |
| Xoay vòng khóa | ký bằng khóa hiện tại, xác minh bằng hiện tại hoặc `KPI_JWT_SECRET_PREVIOUS` | `JwtService` |
| Nguồn quyền | **Không đọc quyền từ token**. Mỗi request nạp user + role + permission từ DB (cache Caffeine 60s, evict khi đổi user/vai trò/quyền); user ≠ `HOAT_DONG` → anonymous | `JwtAuthenticationFilter`, `UserAuthorityService` |
| Cookie | `ACCESS_TOKEN`, `REFRESH_TOKEN`: `HttpOnly`, `Path=/api`, `Secure` (`KPI_COOKIE_SECURE`, prod luôn true), `SameSite` (`KPI_COOKIE_SAMESITE`, mặc định Lax), `Domain` tùy chọn | `AuthCookies` |
| TTL | access `KPI_ACCESS_TTL`=15m, refresh `KPI_REFRESH_TTL`=8h, idle `KPI_IDLE_TIMEOUT`=30m | `JwtProperties` |
| Refresh | token ngẫu nhiên 32 byte, lưu **SHA-256** trong `user_session.refresh_token_hash`; mỗi lần refresh xoay token mới, cập nhật `last_seen_at`; từ chối nếu đã thu hồi/hết hạn/quá idle/user không còn hoạt động | `AuthService.refresh` |
| Đăng xuất | thu hồi phiên theo hash refresh và theo `sid`, xóa cookie, audit `DANG_XUAT`, SLO CAS nếu bật | `AuthService.logout`, `AuthController.logout` |
| Thu hồi khi khóa user | đổi trạng thái user ≠ `HOAT_DONG` → `revokeUserSessions` + evict cache | `UserService.update` |
| Stateless | `SessionCreationPolicy.STATELESS`, tắt form login/basic | `SecurityConfig` |

---

## 3. Phân quyền (RBAC + phạm vi đơn vị)

- Mã quyền `MODULE:ACTION` seed trong `V003__seed_identity.sql` (gồm thêm `AUDIT:VIEW` ngoài E-HSMT). Mỗi endpoint dùng `@PreAuthorize("hasAuthority('…')")` (`@EnableMethodSecurity`).
- Phạm vi dữ liệu: `role.data_scope` = `ALL` / `UNIT` / `UNIT_AND_CHILDREN`, áp theo `user_role.org_unit_id` (gán vai trò theo đơn vị cụ thể). `DataScopeService` tính tập đơn vị theo **các vai trò có quyền đang dùng**; mapper lọc bằng fragment `CommonSql.xml` (`IN (#{…})`).
- Tệp: `FileAccessPolicy` kiểm quyền trên đối tượng sở hữu (đề nghị điều chỉnh, quyết định, template báo cáo, file lỗi import, file xuất) **trước** khi cấp presigned URL.
- Frontend guard (`routes/authGuards.ts`, `hasPerm`) chỉ để điều hướng/ẩn nút; backend là nguồn quyết định.
- Endpoint public: `/auth/login`, `/auth/refresh`, `/auth/sso/login`, `/auth/sso/callback`, `/auth/csrf`, `/actuator/health/**`, `/actuator/info`, `/docs/**`, `/v3/api-docs/**`, `/swagger-ui/**`, `/error`. Còn lại `authenticated()`.

---

## 4. Bảo vệ web

| Biện pháp | Hiện thực |
|---|---|
| CSRF | Double-submit: cookie `XSRF-TOKEN` (đọc được bởi JS, Path `/`, SameSite Lax) ↔ header `X-XSRF-TOKEN`; Spring `CookieCsrfTokenRepository` + `SpaCsrfTokenRequestHandler` (BREACH-safe). Miễn trừ duy nhất `/auth/login`. Lỗi → 403 `ERR_CSRF`. FE gắn header cho mọi request ghi (`api/http.ts`). |
| CORS | Whitelist `KPI_CORS_ORIGINS`; method GET/POST/PUT/DELETE/OPTIONS; header Content-Type, X-XSRF-TOKEN, Accept-Language, Authorization, X-Trace-Id; credentials true. Ở prod FE và API cùng origin. |
| Header (Spring) | `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS 1 năm includeSubDomains |
| Header (Nginx) | HSTS, `X-Content-Type-Options nosniff`, `X-Frame-Options DENY`, `Referrer-Policy`, `Permissions-Policy` (camera/microphone/geolocation/payment tắt), `Cross-Origin-Opener-Policy same-origin`, CSP `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://sso.vnpt.vn; object-src 'none'`; `server_tokens off`; ẩn `X-Powered-By` |
| TLS | Nginx TLS 1.2/1.3, cipher ECDHE-AES-GCM, tắt session ticket; HTTP 80 → 301 HTTPS (trừ `/healthz`) |
| Giới hạn | `client_max_body_size 25m`; Spring multipart 20MB/25MB; `limit_req` API 50 r/s burst 100 |
| Lọc file nhạy cảm | Nginx chặn file ẩn (`/.`) và đuôi `bak|old|orig|sql|env|log` |
| Actuator | Nginx chỉ cho `10.0.0.0/8`, `127.0.0.1` truy cập `/api/actuator/*` trừ health; Spring chỉ expose `health,info`, `show-details: never` |
| XSS | React escape mặc định; không dùng `dangerouslySetInnerHTML` trong `frontend/src` (đã grep) |
| Open redirect / injection header | traceId vào chỉ chấp nhận `^[A-Za-z0-9-]{8,64}$` (`TraceIdFilter`) |

---

## 5. Chống SQL injection (MyBatis)

- Quy tắc: chỉ dùng `#{}`. `${}` chỉ xuất hiện ở:
  - `ORDER BY ${q.orderBy}` — giá trị sinh bởi `PageQuery.applySort(whitelist, default)`; cột không có trong whitelist bị bỏ, hướng chỉ `ASC|DESC`.
  - Tên cột/alias hằng trong XML hoặc service: `${col}` (`CommonSql.xml`, `AssignmentMapper.xml` — whitelist `adj_q1..adj_q4/adj_h1`), `${a}` alias bảng (`KpiMapper.xml`).
- Lệnh kiểm tra khi review: `grep -rn '\${' backend/src/main/resources/mapper` — mọi kết quả phải thuộc các trường hợp trên.
- `LogicalBackupJobHandler` ghép tên bảng từ danh sách hằng `TABLES` (không có dữ liệu người dùng).

---

## 6. Bảo vệ dữ liệu

| Dữ liệu | Biện pháp |
|---|---|
| Mật khẩu | bcrypt cost 12; không bao giờ trả về FE |
| Số điện thoại (PII) | AES-256-GCM qua `EncryptedStringTypeHandler` (IV 12 byte ngẫu nhiên, tag 128 bit, định dạng `v1:base64`). Khóa = SHA-256(`KPI_PII_KEY`), `KPI_PII_KEY` ≥ 32 ký tự (khởi động lỗi nếu ngắn hơn). **Không có cơ chế xoay khóa PII** — đổi khóa làm mất khả năng giải mã dữ liệu cũ. |
| Email | plaintext (cần UNIQUE + map SSO) — quyết định tại `docs/DECISIONS.md` §4.3 |
| Refresh token | chỉ lưu SHA-256 |
| Tham số bí mật | `sys_config.is_secret=1` → API trả `********`, giữ giá trị cũ khi FE gửi lại giá trị che (`SysConfigAdminService`) |
| Kết nối DB | prod: `sslMode=${DB_SSL_MODE:verify-full}` (MariaDB Connector/J) — máy chủ MariaDB phải bật TLS |
| Toàn vẹn | transaction, optimistic lock (`version`), `file_object.sha256`, `SHA256SUMS` cho bản sao lưu và gói cài đặt |

---

## 7. Quản lý bí mật và kiểm tra khi khởi động

- Mọi secret đọc từ biến môi trường, nạp bởi systemd `EnvironmentFile=/etc/kpi/secrets.env` (chmod 600, owner `root:kpi`). Mẫu: `deploy/env.example`. Không có secret thật trong repo; giá trị mặc định trong `application-dev.yml` chứa chuỗi `dev_only`.
- `StartupSecurityCheck` (`@Profile("prod")`) ném `IllegalStateException` → **ứng dụng từ chối khởi động** nếu:
  - `BYPASS_SSO=true`;
  - `KPI_JWT_SECRET`, mật khẩu DB (`spring.datasource.password`), `MINIO_SECRET_KEY`, `KPI_PII_KEY` rỗng hoặc chứa một trong các dấu hiệu mặc định: `dev_only`, `changeme`, `change-me`, `default`, `kpi_app_dev`, `kpi_migrate_dev`, `minioadmin`, `password`, `secret-dev`, `dev-secret`, `kpi@2026`, `admin@123`, `123456`;
  - cookie không Secure;
  - `KPI_BOOTSTRAP_ADMIN_PASSWORD` có giá trị nhưng là mật khẩu mặc định/yếu.
- Không kiểm tra: `DB_MIGRATE_PASSWORD`, `MINIO_ACCESS_KEY`, `SMTP_PASSWORD`, secret nguồn KPI, và **mật khẩu tài khoản `admin` đã seed trong DB** (xem §14).
- `BYPASS_SSO`: thuộc tính `kpi.security.bypass-sso` chỉ được dùng trong `StartupSecurityCheck`; **không có code nào bỏ qua SSO dựa trên cờ này**. Đặt `BYPASS_SSO=false` ở mọi môi trường.

---

## 8. Tệp tải lên

`FileService.store` (`modules/file/service`):
1. Làm sạch tên tệp; tệp rỗng bị từ chối.
2. Kích thước ≤ `sys_config.UPLOAD_MAX_MB` (mặc định 10).
3. Đuôi thuộc `UPLOAD_ALLOWED_EXT` ∩ {xlsx, xls, docx, pdf, png, jpg, jpeg}.
4. Magic bytes bằng Apache Tika: MIME phát hiện phải khớp đuôi.
5. Quét mã độc ClamAV (`MalwareScanner`, lệnh `zINSTREAM` tới `CLAMAV_HOST:CLAMAV_PORT`, timeout 3s/15s) khi `CLAMAV_ENABLED=true`; `FOUND` → từ chối; clamd không phản hồi → `CHUA_QUET` (**fail-open**, tệp vẫn được lưu).
6. Lưu MinIO key `yyyy-MM-dd/<uuid>.<ext>`, ghi `file_object` (sha256, `scan_status`, `retention_until = now + FILE_RETENTION_YEARS`), audit `TAI_LEN_TEP`.
7. Tải xuống: presigned GET TTL 300s (`kpi.minio.presign-ttl-seconds`) với `Content-Disposition: attachment`.

**Chưa triển khai:** job dọn tệp theo `retention_until` (cột và index có, chưa có handler).

---

## 9. Nhật ký và giám sát

- `audit_log`: `AuditService.log` gọi trong transaction nghiệp vụ cho các thao tác ghi (thêm/sửa/xóa/nhập/chốt/thu hồi/duyệt/chạy lịch/tải tệp/đăng nhập `DANG_NHAP`/đăng xuất `DANG_XUAT`), lưu `before_json`/`after_json`, IP, User-Agent, `trace_id`. Trường nhạy cảm (`password`, `passwordHash`, `initialPassword`, `token`, `accessToken`, `refreshToken`, `ticket`, `secret`, `phone`…) thay bằng `***` (`Jsons.toMaskedJson`). Partition theo tháng.
- Màn hình “Nhật ký hệ thống” (tab `audit` trong “Quản trị hệ thống”, quyền `AUDIT:VIEW` — chỉ `ADMIN_HT`): `GET /api/audit-logs?username&action&entity&fromDate&toDate`.
- `login_log`: ghi đầy đủ nhưng **chưa có màn hình/API tra cứu** — truy vấn SQL (xem `docs/HDQT.md` §5).
- Log ứng dụng: `MaskingConverter` che `ticket=`, `ST-…`, `Bearer …`, `password/token/secret=…`, chuỗi JWT `eyJ…`. **Lưu ý:** converter chỉ gắn vào pattern console (profile ≠ prod); ở prod log dùng `JsonEncoder` nên **không qua bộ che** — code hiện tránh ghi token/ticket ra log, nhưng không có lớp che dự phòng.
- IP client lấy từ `X-Real-IP` → `X-Forwarded-For` → remote addr (`RequestInfo`), do Nginx đặt.

---

## 10. Hạ tầng

- systemd hardening (`deploy/systemd/kpi-bsc.service`): user `kpi` không đăng nhập, `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict` (chỉ ghi `/var/log/kpi-bsc`, `/var/lib/kpi-bsc`), `ProtectHome`, `ProtectKernel*`, `RestrictSUIDSGID`, `CapabilityBoundingSet=` rỗng.
- Least privilege DB (`deploy/mariadb/init/01-users.sql`): `kpi_app` chỉ `SELECT, INSERT, UPDATE, DELETE, EXECUTE`; `kpi_migrate` ALL trên schema (Flyway).
- MinIO: user ứng dụng nên chỉ có policy trên bucket `MINIO_BUCKET` (mẫu policy tại `deploy/TRIEN-KHAI.md` §6).
- Mạng (khuyến nghị, cấu hình ngoài repo): chỉ mở 443 ra ngoài; ufw trên DB chỉ mở 3306 cho APP_01/APP_02 và DB_02; SSH qua VPN + fail2ban; hardening CIS cơ bản.

---

## 11. Kiểm tra bảo mật trong CI (`.github/workflows/ci.yml`)

| Công cụ | Cấu hình |
|---|---|
| SpotBugs + FindSecBugs | profile Maven `security`: `effort=Max`, `threshold=High`, `failOnError=true`, `excludeFilterFile=spotbugs-exclude.xml` |
| OWASP Dependency-Check 12.2.2 | `failBuildOnCVSS=7`, `suppressionFile=dependency-check-suppressions.xml`, HTML + JSON, `NVD_API_KEY` từ secret |
| npm audit | `npm audit --audit-level=high --omit=dev` |
| Semgrep 1.95.0 | `--config p/owasp-top-ten --config p/java --config p/typescript --error --severity ERROR` (loại `frontend/e2e`, `perf`) |
| ZAP baseline | `zaproxy/action-baseline@v0.14.0` trên `vars.STAGING_URL` (mặc định `https://kpi-staging.vnpt.vn`), chỉ nhánh `main`, `fail_action: true`, quy tắc `.zap/rules.tsv`: 10049 IGNORE (API no-store), 10096 IGNORE (timestamp trong JSON), 10015 WARN (cache tài nguyên hash) |

Đã sửa (P8): thêm `backend/spotbugs-exclude.xml`, `backend/dependency-check-suppressions.xml`; job `zap-baseline` có `actions/checkout`; mọi GitHub Action được **ghim theo commit SHA** (Semgrep `github-actions-mutable-action-tag`).

### 11.1 Kết quả quét thực tế (11/11/2026)

| Công cụ | Phạm vi | Kết quả | Bằng chứng |
|---|---|---|---|
| ZAP baseline (stable) | Nginx dùng đúng `deploy/nginx/*.conf` + TLS tự ký → backend | **FAIL 0**, PASS 63, WARN 4 (đã đánh giá, xem dưới) | [`docs/security/zap-baseline.html`](security/zap-baseline.html) |
| Semgrep 1.95.0 `p/owasp-top-ten` | toàn repo (404 tệp) | **0 ERROR**; 23 WARNING → đã xử lý: ghim SHA action CI, Nginx bỏ `$host` (Host header injection); còn `unencrypted-socket` (clamd TCP nội bộ 127.0.0.1, chấp nhận) | [`docs/security/semgrep.json`](security/semgrep.json) |
| OSV-Scanner 1.9.2 (thay Dependency-Check khi chạy cục bộ — NVD cần API key) | SBOM CycloneDX backend (phụ thuộc đã resolve) + `package-lock.json` | Ban đầu 40+ lỗ hổng (Tomcat 9.8, Bouncy Castle 9.3, MinIO 8.7, Guava 8.2, BeanUtils 8.8, Jackson 7.5, Snappy 7.5…) → **đã nâng bản vá**; còn 2 CVE Spring Framework 6.2.19 **không ảnh hưởng** (suppression có lý do) | [`docs/security/sbom-backend.cdx.json`](security/sbom-backend.cdx.json), `backend/dependency-check-suppressions.xml` |
| npm audit | frontend | `--omit=dev`: **0**; toàn bộ: 0 critical/high (đã nâng `vitest` 5.1.0), 9 moderate chỉ ở công cụ dev (typescript-eslint/minimatch, exceljs/uuid) — không đóng gói | — |

**Bản vá thư viện (P8)** — ghi đè trong `backend/pom.xml`, giữ Spring Boot 3.5.16 (stack E-HSMT): Tomcat 10.1.61, Jackson 2.21.8, MariaDB Connector/J 3.5.11, Log4j API 2.25.5, commons-lang3 3.21.0, MinIO 8.6.0 (+ `okhttp-jvm` 5.1.0, Kotlin stdlib 2.2.0), Guava 33.8.0-jre, Bouncy Castle 1.87, snappy-java 1.1.10.12, commons-beanutils 1.11.0.

**CVE còn lại — không ảnh hưởng** (chỉ có bản vá ở Spring Framework 7.0.9):
- CVE-2026-47890 (SSE stream corruption): ứng dụng không dùng SSE/`SseEmitter` (thông báo dùng polling).
- CVE-2026-47884 (`XsltView` SSRF/RCE): không dùng `XsltView`/view resolver (REST JSON).
Rà soát lại trước 31/03/2027 hoặc khi nâng Spring Boot 4.

**ZAP WARN còn lại (chấp nhận):** `CSP: style-src unsafe-inline` (React/ECharts/XYFlow đặt style inline; `script-src` không có `unsafe-inline`), `Cross-Origin-Embedder-Policy` (bật sẽ chặn tệp minh chứng mở bằng URL ký trước MinIO), `Re-examine Cache-control`, `Modern Web Application` (thông tin).

---

## 12. Bảng đối chiếu OWASP ASVS 4.0 Level 2 (rút gọn)

| ASVS | Yêu cầu | Hiện trạng | Bằng chứng |
|---|---|---|---|
| V1 Kiến trúc | Tách lớp, kiểm soát tập trung ở backend | Đạt | `docs/KIEN-TRUC.md`, `SecurityConfig` |
| V2.1 Mật khẩu | ≥ 8 ký tự, độ phức tạp, ≤ 128 | Đạt (độ dài tối thiểu ASVS L2 là 12 — hiện 8 theo E-HSMT) | `PasswordPolicy` |
| V2.1 Đổi mật khẩu | Người dùng tự đổi | **Chưa** | — |
| V2.2 Chống brute force | Khóa tài khoản, rate limit | Đạt | `AuthService`, `LoginRateLimiter`, Nginx `kpi_login` |
| V2.4 Lưu mật khẩu | Hàm băm thích ứng | Đạt (bcrypt 12) | `SecurityConfig` |
| V2.10 Secret dịch vụ | Không hard-code | Đạt một phần (seed `admin` có hash cố định — §14) | `env.example`, `StartupSecurityCheck` |
| V3.2–3.4 Token phiên | Ngẫu nhiên, cookie HttpOnly/Secure/SameSite, Path | Đạt | `AuthCookies`, `JwtService` |
| V3.3 Kết thúc phiên | Logout thu hồi, idle timeout, timeout tuyệt đối | Đạt một phần: access token còn hiệu lực ≤ 15 phút sau logout; hạn refresh trượt (không có hạn tuyệt đối) | `AuthService.refresh` |
| V3.5 Token stateless | Ký HS512, kiểm hạn, xoay khóa | Đạt | `JwtService` |
| V4.1–4.2 Kiểm soát truy cập | Deny-by-default, kiểm ở server, IDOR | Đạt | `@PreAuthorize`, `DataScopeService`, `FileAccessPolicy` |
| V4.2.2 CSRF | Chống CSRF | Đạt | double-submit `XSRF-TOKEN` |
| V5.1 Validation | Bean Validation, thông điệp tiếng Việt | Đạt | DTO + `messages_vi.properties` |
| V5.3 Output encoding / injection | Tham số hóa SQL, escape UI | Đạt | MyBatis `#{}`, React |
| V5.5 Deserialization / XXE | Parser an toàn | Đạt | `CasTicketValidator` |
| V7 Log | Không ghi dữ liệu nhạy cảm, có traceId | Đạt một phần (che log chỉ ở non-prod) | `MaskingConverter`, `Jsons` |
| V8.3 Dữ liệu nhạy cảm | Mã hóa PII | Đạt (phone) | `EncryptedStringTypeHandler` |
| V9 Truyền thông | TLS 1.2+, HSTS, TLS tới DB | Đạt (cấu hình) | `kpi.conf`, `application-prod.yml` |
| V10 Mã độc | Quét tệp | Đạt một phần (tắt mặc định, fail-open) | `MalwareScanner` |
| V12.1–12.2 Tệp | Giới hạn kích thước, kiểm magic bytes | Đạt | `FileService` |
| V12.4 Lưu tệp | Ngoài web root, tên ngẫu nhiên | Đạt (MinIO, UUID) | `FileService` |
| V13.1 API | Không lộ thông tin, envelope lỗi chuẩn | Đạt | `GlobalExceptionHandler` |
| V14.2 Phụ thuộc | Quét CVE | Đạt (cấu hình CI, xem §11) | `pom.xml`, `ci.yml` |
| V14.4 Header | CSP, HSTS, XFO, nosniff, Referrer | Đạt | Nginx + Spring |
| V14.3 Lộ thông tin | Ẩn version server, Swagger | Đạt một phần (§14) | `server_tokens off` |

---

## 13. Tuân thủ

Luật CNTT, Luật An ninh mạng, quy định bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP và văn bản thay thế), quy định nội bộ VNPT (OPEN-QUESTIONS #9 — chờ CĐT cung cấp). Hồ sơ pentest bên ngoài: **chưa thực hiện**; sau pentest cập nhật bảng theo dõi lỗ hổng vào cuối tài liệu này.

---

## 14. Rủi ro còn lại và khuyến nghị (cần xử lý trước vận hành chính thức)
## 14. Rủi ro đã xử lý (P8) và rủi ro còn lại

| # | Rủi ro | Trạng thái / Khuyến nghị |
|---|---|---|
| R1 | Seed chung tạo `admin` với hash bcrypt cố định (trùng mật khẩu dev) → `KPI_BOOTSTRAP_ADMIN_PASSWORD` vô tác dụng. | **Đã xử lý (P8).** `R__seed_02_org.sql` tạo `admin` **không mật khẩu**; chỉ `db/seed-dev` gán mật khẩu dev. `AdminBootstrap` coi admin không mật khẩu là “chưa có admin” → đặt từ `KPI_BOOTSTRAP_ADMIN_PASSWORD`. Ở prod, mọi tài khoản còn hash dev bị vô hiệu mật khẩu; riêng `admin` còn mật khẩu dev mà không có biến bootstrap → **từ chối khởi động**. |
| R2 | Bộ đệm `sys_config` chỉ trong bộ nhớ từng node, không TTL. | **Đã xử lý (P8).** TTL 30 giây (`SysConfigService.TTL_MS`); node xử lý request vẫn evict ngay. |
| R3 | Sau F5 SNAT, rate limit/log dùng IP của F5. | **Đã xử lý (P8).** `kpi.conf` có `set_real_ip_from` + `real_ip_header X-Forwarded-For`. **Phải thay** dải `10.0.0.0/24` bằng IP F5 thực tế khi triển khai. |
| R4 | `/api/docs/api-docs` vẫn mở khi `SWAGGER_ENABLED=false`; `/api/docs` public. | **Đã xử lý (P8).** `springdoc.api-docs.enabled` theo `SWAGGER_ENABLED`; Nginx chỉ cho mạng nội bộ truy cập `/api/docs`. |
| R5 | `api_path` là URL tuyệt đối → SSRF và gửi header xác thực nguồn KPI tới máy bất kỳ. | **Đã xử lý (P8).** `RestKpiSourceClient.hostAllowed`: chỉ http(s), không userinfo, host = host của `KPI_SOURCE_BASE_URL` hoặc trong `KPI_SOURCE_ALLOWED_HOSTS` (unit test `RestKpiSourceClientTest`). Vẫn khuyến nghị chặn egress bằng firewall. |
| R6 | Access token không kiểm `user_session.revoked` → còn dùng tối đa 15 phút sau đăng xuất. | Chấp nhận theo thiết kế stateless; có thể giảm `KPI_ACCESS_TTL`. Refresh token nay có **hạn tuyệt đối 8 giờ** (không trượt khi xoay vòng). |
| R7 | ClamAV fail-open. | **Đã xử lý (P8).** `CLAMAV_FAIL_CLOSED=true` (mặc định): bật quét mà clamd lỗi → từ chối tải tệp. Vẫn cần cài `clamd` và đặt `CLAMAV_ENABLED=true` ở prod. |
| R8 | Log JSON prod không che token. | **Đã xử lý (P8).** `MaskingJsonEncoder` (unit test `MaskingJsonEncoderTest`). |
| R9 | Không có xoay khóa `KPI_PII_KEY`. | Còn lại. Bảo quản khóa trong két bí mật, sao lưu cùng quy trình khôi phục. |
| R10 | `env.example` có chú thích cuối dòng (systemd không hỗ trợ). | **Đã xử lý (P8).** Chú thích tách dòng riêng; `KPI_FRONTEND_URL` được chuẩn hóa dấu `/` cuối trong `CasProperties`. |
| R11 | Tệp hết hạn lưu giữ không được dọn. | **Đã xử lý (P8).** Job `DON_DEP_TEP` (03:30 hằng ngày) gọi `FileService.purgeExpired()`. |
| R12 | Readiness không kiểm tra DB → F5 vẫn chuyển traffic vào node mất kết nối CSDL. | **Đã xử lý (P8).** Nhóm `readiness` gồm `readinessState,db`. |
