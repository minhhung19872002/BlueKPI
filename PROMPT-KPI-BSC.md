# PROMPT BUILD — PHẦN MỀM QUẢN TRỊ KPI THEO BSC (VNPT-IT)

> Dán toàn bộ nội dung file này vào Claude Code tại một thư mục trống. Đây là prompt duy nhất: gồm nhiệm vụ, quy tắc, kiến trúc, dữ liệu, đặc tả từng chức năng, phi chức năng và kế hoạch.

## NHIỆM VỤ

Bạn là kỹ sư trưởng xây dựng trọn vẹn phần mềm “Quản trị và theo dõi chỉ tiêu KPI theo BSC” cho Tập đoàn VNPT, đúng 100% đặc tả bên dưới.

Hồ sơ thầu được chấm **Đạt/Không đạt theo TỪNG chức năng có mã STT**. Thiếu một chức năng, sai một nhãn, hoặc thiếu một bước là trượt cả gói.

### Bước 0 — Chuẩn bị (làm trước khi viết code)

1. Lưu nguyên văn prompt này vào `docs/SPEC.md` để tra cứu suốt quá trình làm.
2. Tạo `CLAUDE.md` ở gốc repo từ PHẦN A, để phiên sau tự nạp.
3. Tạo các tài liệu theo dõi:
   - `docs/TRACEABILITY.md`: liệt kê đủ mọi mã STT (PHẦN C, mục IX), 7 mục kiến trúc và 11 mục phi chức năng. Cột gồm: STT | Tên | Route FE | Endpoint BE | Quyền | Test e2e | Trạng thái.
   - `docs/OPEN-QUESTIONS.md`: lấy từ PHẦN D §7.
   - `docs/DECISIONS.md`: ghi phiên bản thư viện chính xác bạn chọn, kèm lý do.
4. Liệt kê ngắn các điểm mâu thuẫn hoặc chưa rõ bạn thấy trong đặc tả, và cách xử lý dự kiến.

### Thực hiện

1. Lần lượt các phase P0 → P9 (PHẦN D §6). Không bỏ phase, không đảo thứ tự.
2. Với mỗi phase:
   - Mỗi STT phải có đủ: migration, mapper XML, service, controller, mã quyền, audit, màn hình, và test e2e Playwright đặt tên bắt đầu bằng mã STT.
   - Cuối phase: chạy `./mvnw verify`, `npm run lint && npm run test && npm run e2e`; sửa đến khi xanh.
   - Tick TRACEABILITY, commit git với message `P<n>: <tóm tắt>`, viết 5–10 dòng tóm tắt (đã làm / còn lại / rủi ro), rồi **tự chuyển sang phase tiếp theo**.
3. Chỉ dừng lại hỏi khi bị chặn thật sự: thiếu thông tin không thể giả định, hoặc lỗi môi trường. Điểm ghi **[GIẢ ĐỊNH]** thì không hỏi: làm theo hướng cấu hình được và ghi vào OPEN-QUESTIONS.

Lưu ý riêng theo phase:

| Phase | Lưu ý |
|---|---|
| P4 | Viết `KpiCalculationEngine` dạng hàm thuần trước, có ≥ 40 ca test bảng-dữ-liệu. Test xanh rồi mới nối vào service |
| P5 | Hai tab “Tổng hợp kết quả BSC” và “Theo dõi kết quả thẩm định và phản hồi”: mỗi STT ở mỗi tab có e2e riêng. Thông báo cảnh báo đúng nguyên văn |
| P6 | Component bản đồ phải dùng lại được ở chế độ readonly cho dashboard (15.1) |
| P7 | Viết e2e cho từng đường điều hướng SiteMap. API dashboard < 1s với dữ liệu seed volume |
| P8 | Chạy k6 100 TPS, ZAP baseline, Dependency-Check; sửa hết lỗi High |
| P9 | Sinh HDSD có ảnh chụp màn hình, báo cáo kiểm thử, gói cài đặt |

### Kết thúc

Sau P9, chạy **kiểm tra chéo**: đối chiếu từng dòng PHẦN C với code. Lập bảng mọi STT còn thiếu, sai nhãn, thiếu cột/trường/nút, sai luồng trạng thái, hoặc thiếu e2e. Sửa hết, rồi báo cáo tổng kết.

---

# PHẦN A — QUY TẮC DỰ ÁN (nội dung cho CLAUDE.md)

## 1. Bối cảnh

Đây là phần mềm quản trị, theo dõi danh mục chỉ tiêu KPI theo BSC (Balanced Scorecard) tại Tập đoàn VNPT và các đơn vị trực thuộc. Chủ đầu tư là Công ty Công nghệ thông tin VNPT (VNPT-IT).

Hồ sơ dự thầu được chấm **Đạt/Không đạt theo TỪNG chức năng** của E-HSMT, và chỉ cần trượt một chức năng là trượt cả gói. Vì vậy:

- Mọi chức năng có mã STT trong PHẦN C đều phải được làm đủ.
- Phải đi đúng luồng thao tác, và đúng **tên menu, tab, nút lệnh, cột, trường, thông báo** như trong đặc tả.
- Tên nào trong đặc tả đặt trong ngoặc kép “...” thì giữ **nguyên văn**, kể cả chữ hoa/thường.

Đặc tả đầy đủ nằm trong `docs/SPEC.md`. Đọc theo thứ tự:
1. PHẦN B — kiến trúc, mô hình dữ liệu, API, bảo mật, hạ tầng, engine tính điểm.
2. PHẦN C — đặc tả từng chức năng (mã STT theo E-HSMT).
3. PHẦN D — yêu cầu phi chức năng, kiểm thử, kế hoạch theo phase, câu hỏi mở.

## 2. Stack cố định (E-HSMT chỉ định — KHÔNG được thay)

| Lớp | Công nghệ |
|---|---|
| Frontend | React 19, TypeScript 5 (strict), Vite, Nginx phục vụ SPA |
| Routing | TanStack Router, khai báo code-based trong `src/routes/index.tsx` và `src/routes/authGuards.ts` |
| Server state | TanStack Query v5 |
| Client state | Zustand: session hiển thị, filter, breadcrumb, sidebar |
| HTTP | Axios: `src/api/http.ts` (instance), `src/api/endpoints.ts` (danh sách endpoint) |
| UI | Tailwind CSS 4; component tự sở hữu kiểu shadcn/ui trên Radix |
| Chart / Diagram | ECharts (`echarts-for-react`); XYFlow (`@xyflow/react`) + Dagre (`@dagrejs/dagre`) cho bản đồ chiến lược |
| i18n | i18next + react-i18next (vi mặc định, en dự phòng) |
| Form | react-hook-form + zod |
| Tiện ích | dayjs (dd/MM/yyyy), html-to-image (xuất ảnh bản đồ) |
| Backend | Java 21, Spring Boot 3.5.x, Spring Web, Spring Security, JWT (jjwt 0.12), Bean Validation |
| Data access | MyBatis (`mybatis-spring-boot-starter`); mapper interface Java + XML trong `resources/mapper/**` |
| CSDL | MariaDB 10.11 LTS (`mariadb-java-client`); migration bằng Flyway |
| File | MinIO (MinIO Java SDK 8.x), URL ký trước có TTL |
| Lịch job | Quartz (`spring-boot-starter-quartz`), JDBC JobStore, clustered |
| API docs | Springdoc OpenAPI 2 |
| Excel | Apache POI (đọc/ghi), JXLS 2 (xuất theo template) |
| Công thức | EvalEx 3 (biểu thức có biến) |
| Mapping | MapStruct, Lombok |
| Kiểm thử | JUnit 5, Testcontainers (MariaDB, MinIO), Vitest + Testing Library, Playwright (e2e), k6 (tải) |

Mô hình triển khai: Trình duyệt → F5 → Nginx (SPA + reverse proxy `/api`) → Spring Boot ×2 node → MariaDB master/slave + MinIO + Quartz. Xác thực ngoài qua VNPT CAS/SSO.

## 3. Cấu trúc repo

```
kpi-bsc/
├── CLAUDE.md
├── docs/                       # đặc tả + TRACEABILITY.md + OPEN-QUESTIONS.md + HDSD
├── backend/                    # Maven, groupId vn.vnpt, package gốc vn.vnpt.kpi
│   └── src/main/java/vn/vnpt/kpi/
│       ├── config/             # SecurityConfig, JwtAuthenticationFilter, QuartzConfig, MinioConfig, OpenApiConfig, WebConfig, MyBatisConfig
│       ├── common/             # ApiResponse, PageResult, ErrorCode, BusinessException, GlobalExceptionHandler, audit/, excel/, util/
│       ├── security/           # JwtService, AuthController, VnptSsoController, CasTicketValidator, CurrentUser, DataScopeService, PermissionCodes
│       ├── modules/
│       │   ├── user/ role/ permission/ org/
│       │   ├── catalog/        # uom, perspective, objective, formula, kpi, scoring
│       │   ├── assignment/     # giao KPI, điều chỉnh, lịch sử
│       │   ├── strategy/       # chiến lược, bản đồ, khung KPI
│       │   ├── evaluation/     # kết quả, thành phần, đề nghị điều chỉnh, thẩm định
│       │   ├── bsc/            # tổng hợp, chốt, R2, thu hồi, TGĐ duyệt, summary
│       │   ├── dashboard/  report/  notification/  file/  sync/  sysconfig/  schedule/
│       │   └── <mỗi module>: controller/ dto/ service/ service/impl/ mapper/ model/
│       ├── engine/             # KpiCalculationEngine, ScoringStrategy*, FormulaEvaluator
│       ├── orchestrator/       # EvaluationOrchestrator, SyncOrchestrator, ClosingOrchestrator
│       ├── job/                # Quartz jobs
│       └── integration/        # cas/, kpisource/, hrm/, mail/, zalo/
│   └── src/main/resources/
│       ├── mapper/<module>/*.xml
│       ├── db/migration/V001__init.sql …  (+ R__seed_*.sql)
│       ├── messages_vi.properties, messages_en.properties
│       ├── excel-templates/*.xlsx
│       └── application.yml, application-dev.yml, application-prod.yml
├── frontend/
│   └── src/
│       ├── main.tsx
│       ├── app/                # AppLayout, Header, Sidebar, Breadcrumb, ErrorBoundary, NotificationBell
│       ├── routes/index.tsx, routes/authGuards.ts
│       ├── api/http.ts, api/endpoints.ts, api/types.ts
│       ├── features/<domain>/  # api.ts, hooks.ts (TanStack Query), components/, pages/
│       ├── pages/              # LoginPage, ForbiddenPage, NotFoundPage
│       ├── stores/             # sessionStore, filterStore, uiStore (Zustand)
│       ├── components/ui/      # Button, Dialog, Drawer, Select, TreeSelect, Toast, ConfirmDialog...
│       ├── components/data-grid/      # DataGrid dùng chung (paging/sort/tree/checkbox/inline edit)
│       ├── components/import-export/  # ImportDialog, ExportButton dùng chung
│       ├── i18n/vi.json, i18n/en.json
│       └── lib/                # format (ngày, số), permissions (hasPerm), download
└── deploy/
    ├── docker-compose.dev.yml  # mariadb, minio, mailpit, mock-cas, mock-kpi-source
    ├── nginx/kpi.conf
    ├── systemd/kpi-backend.service
    └── scripts/                # backup-db.sh, restore-db.sh, minio-mirror.sh
```

## 4. Quy ước bắt buộc

### 4.1 API
- Mọi endpoint nằm dưới context path `/api`.
- Response envelope: `{ "success": bool, "code": "OK|ERR_xxx", "message": "...", "data": ..., "errors": [{ "field", "message" }], "traceId": "..." }`.
- Phân trang: `?page=1&size=20&sort=field,asc` → `data = { items, total, page, size }`.

### 4.2 Phân quyền
- **Backend là nguồn quyết định duy nhất.** Mỗi endpoint dùng `@PreAuthorize("hasAuthority('<PERM>')")`, và đồng thời lọc theo **phạm vi đơn vị** qua `DataScopeService`.
- Guard ở frontend chỉ để điều hướng và ẩn nút.
- Mã quyền dạng `MODULE:ACTION`, ví dụ `USER:VIEW`, `USER:CREATE`, `ASSIGN:CLOSE`, `BSC:APPROVE`. Danh mục đầy đủ ở PHẦN B §5.

### 4.3 Dữ liệu
- Mọi bảng nghiệp vụ có `created_by`, `created_at`, `updated_by`, `updated_at`, `version` (optimistic lock).
- Danh mục dùng soft delete (`deleted = 1`). Nếu bản ghi đang được tham chiếu thì chặn xóa, báo lỗi rõ ràng.
- Tính toán số liệu dùng `BigDecimal`, scale 4 khi lưu, hiển thị 2 chữ số thập phân, `RoundingMode.HALF_UP`.

### 4.4 Audit
Mọi thao tác ghi (thêm/sửa/xóa/nhập/chốt/thu hồi/duyệt/đăng nhập/đăng xuất) đều ghi vào `audit_log` với before/after JSON. Không bao giờ ghi token/ticket/mật khẩu vào log.

### 4.5 MyBatis
- Chỉ dùng `#{}`. **Cấm `${}`**, trừ cột sắp xếp và chỉ khi đã qua whitelist.

### 4.6 Hiển thị
- Ngôn ngữ toàn hệ thống là **tiếng Việt Unicode** (TCVN 6909:2001, UTF-8).
- Ngày hiển thị `dd/mm/yyyy` (ví dụ 15/05/2014); ngày giờ `dd/mm/yyyy HH:mm`.
- Số theo kiểu Việt Nam `1.234.567,89`. Múi giờ Asia/Ho_Chi_Minh.
- Giao diện chạy tốt ở độ phân giải tối thiểu **1024×768**.

### 4.7 Thông báo cho người dùng
- Thao tác thành công: toast tiếng Việt, ví dụ “Thêm mới thành công”, “Cập nhật thành công”, “Xóa thành công”.
- Thao tác thất bại: hiển thị **lý do**.
- Xóa luôn có dialog xác nhận.
- Nhập sai hoặc thiếu: báo lỗi ngay tại từng trường.

### 4.8 Cấu hình
- Đọc từ biến môi trường và profile. Không hard-code secret.
- Production đặt `BYPASS_SSO=false`. Ứng dụng **từ chối khởi động** nếu prod vẫn dùng secret mặc định.

## 5. Lệnh

```bash
docker compose -f deploy/docker-compose.dev.yml up -d
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
cd frontend && npm i && npm run dev
cd backend && ./mvnw verify                          # unit + integration (Testcontainers)
cd frontend && npm run lint && npm run test && npm run e2e
```

## 6. Definition of Done cho mỗi chức năng (mã STT)

1. Đã có migration, mapper XML, service, controller, mã quyền, audit, và thông điệp tiếng Việt trong `messages_vi`.
2. Màn hình frontend đúng nhãn, đúng cột, đúng nút như đặc tả; hoạt động ở 1024×768.
3. Có unit test cho service và tính toán; integration test cho API.
4. Có e2e Playwright cho luồng chính của STT đó. Tên test bắt đầu bằng mã STT, ví dụ `test('3.4 Thêm mới – Người dùng', …)`.
5. Đã tick dòng tương ứng trong `docs/TRACEABILITY.md` (STT → route FE → endpoint BE → test).

## 7. Cách làm việc

- Làm lần lượt theo **phase** trong PHẦN D §6. Hết mỗi phase phải chạy toàn bộ test và cập nhật TRACEABILITY.
- Gặp điểm ghi **[GIẢ ĐỊNH]**:
  - Implement theo hướng **cấu hình được** (tham số hệ thống hoặc bảng cấu hình), không hard-code.
  - Ghi lại vào `docs/OPEN-QUESTIONS.md`.
- Không tự đổi tên nhãn UI đã quy định.
- Không thêm thư viện ngoài stack khi chưa có lý do rõ ràng. Nếu thêm, ghi lý do vào `docs/DECISIONS.md`.
- Ưu tiên component dùng chung (DataGrid, ImportDialog, ExportButton, ConfirmDialog, TreeSelect) để mọi danh mục hành xử nhất quán.

---

# PHẦN B — KIẾN TRÚC, DỮ LIỆU, ENGINE TÍNH TOÁN, API, BẢO MẬT, HẠ TẦNG


> Tài liệu này bám theo E-HSMT Chương V, mục 1.1.2 (điểm b–h). Phần 2 của tiêu chuẩn đánh giá yêu cầu “đáp ứng **tất cả**” các điểm này, nên mọi thành phần nêu tên dưới đây phải tồn tại thật trong source.

---

## 1. Tổng quan giải pháp

- Hệ thống quản lý vòng đời KPI: chuẩn hóa danh mục → gắn KPI với chiến lược → giao chỉ tiêu → theo dõi kết quả → nhập/đồng bộ dữ liệu → đánh giá → điều chỉnh → phản hồi → tổng hợp báo cáo.
- Người dùng làm việc trên **một SPA**. Luật nghiệp vụ, truy cập dữ liệu và tích hợp đều **tập trung ở backend**.
- Hệ thống phân tách 4 lớp: giao diện / nghiệp vụ-API / dữ liệu / dịch vụ hạ tầng.
- Backend là nguồn quyết định cho xác thực, phân quyền và tính đúng nghiệp vụ.
- Dữ liệu bảng ở MariaDB, tệp nhị phân ở MinIO, lịch job do Quartz điều phối.
- Cấu hình tách theo biến môi trường và tệp cấu hình triển khai.

### 1.1 Nhóm vai trò và điểm kiểm soát

| Nhóm vai trò | Nhu cầu chính | Điểm kiểm soát (phải implement) |
|---|---|---|
| Người dùng nghiệp vụ/đơn vị | Tra cứu KPI được giao, cập nhật thông tin, xem kết quả | Phạm vi đơn vị và quyền được kiểm tra qua API (`DataScopeService`) |
| Quản trị KPI | Quản lý danh mục, chiến lược, giao KPI, cấu hình đánh giá | Permission theo chức năng/miền ở backend |
| Quản trị hệ thống | Quản lý người dùng, đơn vị, vai trò, quyền, tham số, lịch | RBAC bảo vệ endpoint quản trị |
| Quản lý/phê duyệt | Theo dõi, phản hồi, phê duyệt/chốt, xem tổng hợp | Trạng thái và lịch sử lưu phía máy chủ (state machine ở service) |

### 1.2 Vai trò seed sẵn (lấy từ E-HSMT)

| Mã | Tên | Phạm vi dữ liệu |
|---|---|---|
| ADMIN_HT | Admin hệ thống | Toàn bộ |
| LANH_DAO_TD | Lãnh đạo Tập đoàn | Toàn bộ (chỉ xem) |
| TONG_GIAM_DOC | Tổng giám đốc | Toàn bộ + quyền `BSC:APPROVE` |
| ADMIN_TD | Admin Tập đoàn/Admin | Toàn bộ |
| QT_TH_GIAO | Quản trị và Tổng hợp giao KPI | Toàn bộ |
| QT_TH_THAM_DINH | Quản trị và tổng hợp thẩm định kết quả thực hiện | Toàn bộ |
| GIAO_KPI | Giao KPI | Đơn vị mình + con |
| PHOI_HOP_KPI | Phối hợp KPI | Đơn vị mình + con |
| DANH_GIA_KPI | Đánh giá KPI | Đơn vị mình + con |
| LAP_CHIEN_LUOC | Lập chiến lược | Đơn vị mình + con |
| NGUOI_DUNG_DV | Người dùng đơn vị | Chỉ đơn vị mình |

---

## 2. Kiến trúc tổng thể (điểm b)

```
Người dùng   → Trình duyệt web
Kênh giao diện → React 19 + TypeScript + Vite; Nginx phục vụ SPA
Lớp dịch vụ  → Spring Boot REST · Security/JWT · Controller → Service/Orchestrator
Lớp dữ liệu  → MariaDB (qua repository/mapper) · MinIO (lưu trữ tệp) · Quartz (job store)
Tích hợp     → VNPT CAS/SSO · API nguồn đồng bộ KPI công thức · (mở rộng) VNPT HRM · SMTP · Zalo
```

### 2.1 Thành phần và trách nhiệm

| Thành phần | Trách nhiệm | Giao tiếp |
|---|---|---|
| Frontend | Màn hình/route, kiểm tra nhập liệu cơ bản, truy vấn/trạng thái UI, gọi API, xử lý tệp | REST; cookie credentials; JSON, multipart, blob |
| Backend API | Xác thực, phân quyền, nghiệp vụ, validation, báo cáo, nhập/xuất, tích hợp | REST dưới context path `/api` |
| MariaDB | Danh mục, cấu hình, người dùng/quyền, phân công, kết quả, lịch sử | JDBC qua repository/mapper |
| MinIO | Đối tượng tệp và dữ liệu xuất nhập | SDK; URL download/preview ký trước |
| VNPT CAS | Xác thực ticket SSO | Gọi service validation URL |
| Nguồn dữ liệu KPI | Cấp dữ liệu KPI công thức cho đồng bộ/tính điểm | HTTP client cấu hình được |
| Quartz | Lập lịch đồng bộ đánh giá và hoàn tất chiến lược | JDBC job store |

---

## 3. Kiến trúc chức năng (điểm c) và ứng dụng (điểm d)

### 3.1 Bảng nhóm chức năng

| Mã | Phân hệ | Chức năng | Dữ liệu |
|---|---|---|---|
| F01 | Quản trị tổ chức/người dùng | Đơn vị, người dùng, role, permission/menu, cấu hình, lịch | User, org unit, role, permission |
| F02 | Thiết lập KPI | KPI cơ sở, nhóm/loại, đơn vị tính, chủ sở hữu, công thức | KPI base, category, formula definition |
| F03 | Chiến lược | Chiến lược/mục tiêu, sơ đồ, liên kết và gắn KPI | Strategy, objectives, links |
| F04 | Giao KPI | Theo đơn vị/chỉ tiêu, sao chép, điều chỉnh, import/export | Assignment, detail, history |
| F05 | Đánh giá KPI | Đồng bộ, nhập thủ công, điều chỉnh, phản hồi, chốt/phê duyệt | Evaluation, feedback, adjustment, approval |
| F06 | BSC và báo cáo | Tổng hợp theo đơn vị/kỳ/năm/cấp tổ chức, xem và xuất | BSC summary, reports |
| F07 | Tệp và thông báo | Upload/download/preview; phát thông báo nghiệp vụ | File metadata, notifications |

### 3.2 Khối frontend

| Khối | Vai trò | Thành phần trong source |
|---|---|---|
| Khởi chạy/layout | SPA, layout dùng chung, điều hướng, lỗi | React 19, `AppLayout`, `Header`, `Sidebar`, `ErrorBoundary` |
| Routing | Route, guard, query validation, lazy page | TanStack Router; `routes/index.tsx`, `authGuards.ts` |
| Features | Page mỏng và modules theo miền | `src/features/<domain>`, `src/pages` |
| Data access | HTTP typed client, endpoint, lỗi API | Axios, `api/http.ts`, `api/endpoints.ts` |
| Server state | Truy vấn, cache, pagination | TanStack Query |
| Client state | Session hiển thị, filter, breadcrumb/sidebar | Zustand stores |
| Presentation | Bảng/form/report/chart/diagram/i18n | Tailwind 4, ECharts, XYFlow/Dagre, i18next |

Yêu cầu riêng cho Axios client (`api/http.ts`):
- Đặt `withCredentials: true` và gắn header `Accept-Language`.
- Nhận 401: điều hướng SSO/đăng nhập, nhưng thử refresh token một lần trước. Nhận 403: chuyển sang trang `/forbidden`.
- Có phương thức riêng cho FormData (`upload`) và blob (`download`, đọc tên file từ `Content-Disposition`).
- Base URL lấy từ `VITE_API_BASE_URL`.
- Gắn header CSRF `X-XSRF-TOKEN` từ cookie cho mọi request ghi.

### 3.3 Khối backend

| Khối | Vai trò | Bằng chứng trong source |
|---|---|---|
| REST/API | Endpoint theo miền, response envelope, API docs | Controller, DTO, Springdoc |
| Security | JWT filter, cookie, SSO, whitelist, method security | `SecurityConfig`, `JwtAuthenticationFilter`, `VnptSsoController` |
| Validation | Ràng buộc DTO và quy tắc miền | validator, Bean Validation, `messages_vi/en` |
| Business | Workflow, tính toán, import/export, orchestration | service, service/impl, orchestrator |
| Data access | Repository và mapper XML/Java | repository, mapper, `resources/mapper` |
| Scheduler | Job đồng bộ kỳ và hoàn tất chiến lược | Quartz configs và jobs |
| External adapters | CAS, MinIO, nguồn công thức | Properties/config/service tương ứng |

---

## 4. Kiến trúc dữ liệu (điểm e) — mô hình chi tiết

**Quy ước chung**
- PK: `id BIGINT AUTO_INCREMENT`.
- Mọi bảng nghiệp vụ có thêm các cột chuẩn: `created_by`, `created_at`, `updated_by`, `updated_at`, `version INT`, `deleted TINYINT DEFAULT 0` (bỏ `deleted` ở bảng log).
- Charset `utf8mb4`, collation `utf8mb4_vietnamese_ci`.
- Enum lưu dạng `VARCHAR`.

### 4.1 Tổ chức/danh tính

| Bảng | Cột chính |
|---|---|
| `org_unit` | `code` UNIQUE, `name`, `short_name`, `parent_id`, `unit_type` (CONG_TY_ME, TONG_CONG_TY, CONG_TY, VNPT_TINH, TRUNG_TAM, PHONG_BAN), `region_code` (Vùng), `is_kpi_assignable` (Giao KPI), `sort_order` (Thứ tự), `path` (vd `/1/5/23/`), `level`, `status`, `hrm_ref` |
| `app_user` | `username` UNIQUE, `full_name`, `email` UNIQUE, `phone` (mã hóa), `org_unit_id`, `status` (HOAT_DONG, KHOA, NGUNG), `auth_source` (LOCAL, CAS, BOTH), `password_hash` (bcrypt cost 12, nullable), `failed_login_count`, `locked_until`, `password_changed_at`, `last_login_at` |
| `role` | `code` UNIQUE, `name`, `description`, `status` (HIEU_LUC, KHONG_HIEU_LUC), `data_scope` (ALL, UNIT, UNIT_AND_CHILDREN), `is_system` |
| `permission` | `code` UNIQUE, `name`, `module`, `menu_code`, `description`, `sort_order`. Seed cứng; người dùng chỉ sửa được name/description/sort_order |
| `menu` | `code`, `name`, `route`, `parent_id`, `icon`, `sort_order`, `permission_code` |
| `role_permission` | `role_id`, `permission_id` |
| `user_role` | `user_id`, `role_id`, `org_unit_id` (nullable: quyền theo đơn vị cụ thể), `assigned_by`, `assigned_at` |
| `user_session` | `user_id`, `refresh_token_hash`, `expires_at`, `revoked`, `ip`, `user_agent`, `created_at` |
| `login_log` | `username`, `result`, `auth_method`, `ip`, `user_agent`, `at` |

### 4.2 Danh mục KPI

| Bảng | Cột chính |
|---|---|
| `unit_of_measure` (Đơn vị đo) | `code` (tự sinh), `name` UNIQUE, `description`, `status` |
| `perspective` (Viễn cảnh) | `code` UNIQUE (dùng làm tiền tố mã KPI, bất biến khi đã dùng), `name`, `sort_order`, `description`, `color` (#hex), `status`. Seed: TC Tài chính, KH Khách hàng, QT Quy trình nội bộ, HP Học hỏi & phát triển |
| `strategic_objective` (Mục tiêu trọng tâm) | `code` UNIQUE, `name`, `perspective_id`, `description`, `status` |
| `formula_definition` (Định nghĩa KPI công thức) | `code` UNIQUE, `name`, `definition_type` (THANH_PHAN_API, THANH_PHAN_NHAP_TAY, CONG_THUC_TONG_HOP), `data_type` (SO, TY_LE, TIEN_TE, SO_LUONG), `expression` (EvalEx), `source_definition` (JSON: hệ thống nguồn, tham số), `api_path`, `http_method`, `response_path` (JSONPath), `business_description`, `status` |
| `scoring_method` (Phương pháp tính điểm) | `code`, `name`, `type` (KHUNG_TY_LE, DAT_KHONG_DAT, NHAP_DIEM), `config` JSON (vd `{"bands":[{"from":0,"to":70,"score":1},…],"maxScore":5}`) |
| `kpi` (Tiêu chí KPI) | xem mục 4.2.1 |
| `kpi_component` (Thành phần KPI) | `kpi_id`, `code` (biến trong biểu thức, vd `A`, `B`), `name`, `formula_definition_id`, `source` (API, NHAP_TAY), `sort_order` |
| `evaluation_stage` (Giai đoạn) | `code`, `name`, `from_year`, `to_year` (vd 2026–2030) |

#### 4.2.1 Bảng `kpi`

| Cột | Ý nghĩa |
|---|---|
| `code` | Mã tiêu chí, tự sinh theo viễn cảnh |
| `name` | Tên tiêu chí |
| `structure` | DON_LE hoặc CHA_CON |
| `parent_id` | KPI cha (nếu là KPI con) |
| `group_aggregation` | Cách tính kết quả KPI Tập đoàn: TONG, TRUNG_BINH, TRUNG_BINH_TRONG_SO, LON_NHAT, NHO_NHAT, CONG_THUC, NHAP_TAY |
| `group_expression` | Biểu thức khi `group_aggregation` = CONG_THUC |
| `perspective_id` | Viễn cảnh |
| `group_kpi_id` | Link với KPI tập đoàn |
| `target_data_type` | Loại số liệu giao: LUY_KE, THEO_KY, CUOI_KY, BINH_QUAN |
| `completion_formula` | Công thức tỷ lệ hoàn thành: THUAN, NGHICH, TUY_CHINH |
| `completion_expression` | Biểu thức khi chọn TUY_CHINH |
| `scoring_method_id` | Phương pháp tính điểm |
| `score_by_result` | Tính điểm theo kết quả thực hiện (bool) |
| `objective_id` | Mục tiêu trọng tâm |
| `weight` | Tỷ trọng (1–100) |
| `unit_of_measure_id` | Đơn vị đo |
| `assigning_unit_id`, `assigning_officer_id` | Đơn vị giao, Cán bộ giao |
| `evaluating_unit_id`, `evaluating_officer_id` | Đơn vị đánh giá, Cán bộ đánh giá |
| `data_source` | Nguồn dữ liệu: API, NHAP_TAY, KET_HOP |
| `result_expression` | Biểu thức kết quả theo biến thành phần; mặc định = thành phần duy nhất |
| `is_focus` | Thuộc vùng “Chỉ đạo trọng tâm” |
| `status` | Trạng thái |

### 4.3 Chiến lược

| Bảng | Cột chính |
|---|---|
| `strategy` | `code` (tự sinh `CL-yyyy-NNN`), `name`, `org_unit_id`, `owner_user_id` (Chủ trì), `stage_id` (Giai đoạn), `year`, `status` (DANG_THUC_HIEN, HOAN_THANH), `viewport` JSON |
| `strategy_objective` | `strategy_id`, `objective_id`, `pos_x`, `pos_y` — UNIQUE(`strategy_id`, `objective_id`) |
| `strategy_link` | `strategy_id`, `source_objective_id`, `target_objective_id`, `source_handle`, `target_handle` — UNIQUE(`strategy_id`, `source`, `target`) |
| `strategy_kpi` (Khung KPI) | `strategy_id`, `objective_id`, `kpi_id` |

### 4.4 Phân công (Giao KPI)

| Bảng | Cột chính |
|---|---|
| `kpi_assignment` (header theo đơn vị) | `org_unit_id`, `year`, `status` (DANG_SOAN, DA_GIAO, DA_DIEU_CHINH) — UNIQUE(`org_unit_id`, `year`) |
| `kpi_assignment_detail` | xem mục 4.4.1 |
| `kpi_assignment_adjustment` | `kpi_id`, `year`, `decision_no`, `decision_date`, `reason`, `status` (NHAP, DA_CHOT) |
| `kpi_assignment_adjustment_line` | `adjustment_id`, `detail_id`, `period_code`, `old_value`, `new_value` |
| `kpi_assignment_history` | `detail_id`, `action` (TAO, SUA, CHOT_GIAO, DIEU_CHINH, SAO_CHEP, NHAP_FILE), `decision_no`, `snapshot` JSON, `at`, `by` |
| `kpi_officer_map` | `kpi_id`, `org_unit_id`, `user_id`, `role` (GIAO, DANH_GIA, PHOI_HOP) — map chủ sở hữu/cán bộ |

#### 4.4.1 Bảng `kpi_assignment_detail`

| Cột | Ý nghĩa |
|---|---|
| `assignment_id` | Header theo đơn vị |
| `kpi_id`, `org_unit_id`, `year` | UNIQUE(`kpi_id`, `org_unit_id`, `year`) |
| `weight` | Trọng số |
| `target_q1`, `target_q2`, `target_h1`, `target_q3`, `target_q4`, `target_year` | KH giao từng kỳ |
| `adj_q1`, `adj_q2`, `adj_h1`, `adj_q3`, `adj_q4` | Giá trị điều chỉnh (NULL = chưa điều chỉnh) |
| `status` | DANG_SOAN, DA_GIAO, DA_DIEU_CHINH |
| `note` | Ghi chú |

**Quy tắc trạng thái:**
- Header theo đơn vị suy từ detail: tất cả DA_GIAO → “Đã giao”; có detail DA_DIEU_CHINH → “Đã điều chỉnh”; còn detail DANG_SOAN → “Đang soạn”.
- Trạng thái theo chỉ tiêu (tab “theo chỉ tiêu”) suy tương tự trên các detail cùng (`kpi_id`, `year`).

### 4.5 Đánh giá

| Bảng | Cột chính |
|---|---|
| `evaluation_kpi` (KPI × kỳ) | `kpi_id`, `year`, `period_code` (Q1, Q2, H1, Q3, Q4, Y), `status` (CHUA_CHAM, DA_CHAM, DA_XU_LY_DIEU_CHINH, BCL_YEU_CAU_LAM_LAI, CHOT_KQ_R2), `result_type` (Loại kết quả: API, NHAP_TAY, KET_HOP), `last_synced_at` — UNIQUE(`kpi_id`, `year`, `period_code`) |
| `evaluation_result` (KPI × kỳ × đơn vị) | xem mục 4.5.1 |
| `evaluation_component_value` | `result_id`, `component_id`, `source`, `value` (Kết quả KPI), `unit_proposed_value` (ĐV đề xuất), `prev_adjustment`, `unit_proposed_adjustment`, `adjustment`, `final_value`, `synced_at` |
| `adjustment_request` (Đề nghị điều chỉnh) | `result_id`, `proposal_note`, `status` (CHO_XU_LY, DA_XU_LY), `handled_by`, `handled_at`, `handling_reason`, `decision_file_id` |
| `evaluation_feedback` (Ý kiến phản hồi) | `result_id`, `author_id`, `content`, `at` |
| `period_closing` | `year`, `period_code`, `status` (CHOT, TGD_DA_DUYET), `closed_by`, `closed_at`, `approved_by`, `approved_at`, `snapshot` JSON |
| `sync_batch` | `job_type`, `year`, `period_code`, `kpi_id`, `trigger` (JOB, USER), `started_at`, `finished_at`, `status`, `total`, `success`, `failed` |
| `sync_batch_item` | `batch_id`, `formula_definition_id`, `org_unit_id`, `request_summary`, `value`, `error` |
| `formula_result` | `formula_definition_id`, `org_unit_id`, `year`, `period_code`, `value`, `batch_id` — giá trị nguồn để truy vết |

#### 4.5.1 Bảng `evaluation_result`

| Cột | Ý nghĩa |
|---|---|
| `evaluation_kpi_id`, `org_unit_id`, `assignment_detail_id` | UNIQUE(`evaluation_kpi_id`, `org_unit_id`) |
| `plan_value` | KH giao kỳ (đã tính điều chỉnh) |
| `year_plan_value` | KH năm |
| `kpi_result` | Kết quả KPI (từ thành phần) |
| `prev_adjustment` | ĐC kỳ trước |
| `adjustment` | Điều chỉnh |
| `final_result` | Kết quả cuối |
| `completion_rate` | % TH/KH kỳ |
| `year_completion_rate` | % TH/KH năm |
| `score` | Điểm đánh giá, thang 5 |
| `bsc_score` | Điểm BSC chỉ tiêu |
| `rating` | DAT_VUOT, CHUA_DAT, DANG_THEO_DOI |
| `status` | CHUA_CO_KQ, DA_CO_KQ, DV_DE_NGHI_DIEU_CHINH, DA_XU_LY_DIEU_CHINH, CHOT_DANH_GIA, BCL_YEU_CAU_LAM_LAI, TGD_DA_DUYET |
| `description` | Mô tả |
| `result_before_adjust`, `result_after_adjust` | Kết quả trước/sau điều chỉnh |

### 4.6 BSC/báo cáo

| Bảng | Cột chính |
|---|---|
| `bsc_unit_summary` | `org_unit_id`, `year`, `period_code` (hoặc `stage_id` cho giai đoạn), `total_kpi`, `achieved`, `not_achieved`, `tracking`, `warning`, `completion_rate`, `bsc_score`, `rank_in_group`, `prev_bsc_score`, `prev_rank`, `computed_at` — tính lại khi có kết quả/chốt/“Tính lại điểm” |
| `report_template` | `code` (TTR94_TONG_HOP, TTR94_CHI_TIET, KPI_TUNG_TINH, BIEU_GIAO_KPI, BIEU_KET_QUA_KPI, KQ_DANH_GIA_DON_VI, BANG_TH_TCT), `name`, `file_id` (template xlsx trên MinIO), `version`, `active` |

### 4.7 Quản trị

| Bảng | Cột chính |
|---|---|
| `sys_config` (Tham số hệ thống) | `config_key` UNIQUE, `config_value`, `data_type` (STRING, NUMBER, BOOLEAN, JSON), `config_group`, `description`, `is_secret` (giá trị secret không trả về FE) |
| `sync_schedule` (Lịch đồng bộ) | `code`, `name`, `job_type` (DONG_BO_KET_QUA_KPI, HOAN_TAT_CHIEN_LUOC, NHAC_HAN_CAP_NHAT, TINH_LAI_BSC, DONG_BO_HRM, SAO_LUU_LOGIC), `cron`, `enabled`, `params` JSON, `last_run_at`, `last_status`, `next_run_at` |
| `notification` | `user_id`, `event_type`, `title`, `content`, `link_route`, `link_params` JSON, `is_read`, `read_at`, `email_status`, `zalo_status`, `created_at` |
| `file_object` | `bucket`, `object_key`, `original_name`, `content_type`, `size`, `sha256`, `scan_status` (CHUA_QUET, SACH, NHIEM), `owner_type`, `owner_id`, `uploaded_by`, `uploaded_at`, `retention_until` |
| `audit_log` | `user_id`, `username`, `action`, `entity`, `entity_id`, `before_json`, `after_json`, `ip`, `user_agent`, `trace_id`, `at` (partition theo tháng) |
| `QRTZ_*` | Bảng chuẩn Quartz (script tables_mysql_innodb) |

**Index tối thiểu:**
- Mọi FK.
- `evaluation_result(evaluation_kpi_id, status)`, `evaluation_result(org_unit_id)`.
- `kpi_assignment_detail(year, org_unit_id)`.
- `bsc_unit_summary(year, period_code, org_unit_id)`.
- `notification(user_id, is_read, created_at)`.
- `org_unit(path)`.
- Fulltext hoặc LIKE prefix cho tìm kiếm theo mã/tên.

---

## 5. Danh mục mã quyền (seed)

| Module | Quyền |
|---|---|
| USER | VIEW, CREATE, UPDATE, DELETE, IMPORT, EXPORT, ASSIGN_ROLE |
| ROLE | VIEW, CREATE, UPDATE, DELETE |
| PERMISSION | VIEW, UPDATE |
| ORG | VIEW, CREATE, UPDATE, DELETE, IMPORT, EXPORT |
| SCHEDULE | VIEW, UPDATE, RUN |
| SYSCONFIG | VIEW, CREATE, UPDATE, DELETE |
| DASHBOARD | VIEW_GROUP, VIEW_UNIT, VIEW_PROVINCE, EXPORT |
| MYKPI | VIEW, PROPOSE_ADJUST, EXPORT |
| KPI | VIEW, CREATE, UPDATE, DELETE, IMPORT, EXPORT |
| UOM / PERSPECTIVE / OBJECTIVE | VIEW, CREATE, UPDATE, DELETE, IMPORT, EXPORT |
| FORMULA | VIEW, CREATE, UPDATE, DELETE, TEST |
| ASSIGN | VIEW, CREATE, UPDATE, DELETE, COPY, CLOSE, ADJUST, IMPORT, EXPORT |
| STRATEGY | VIEW, CREATE, UPDATE, DELETE, ASSIGN_KPI, EXPORT_IMAGE |
| EVAL | VIEW, SYNC, INPUT, IMPORT, ADJUST, CLOSE_R2 |
| BSC | VIEW, REVOKE, RECALC, CLOSE, APPROVE, REPORT |
| NOTIFY | VIEW |

---

## 6. Engine tính toán (`engine/KpiCalculationEngine`)

> Các điểm ghi **[GIẢ ĐỊNH]** phải cấu hình được qua `scoring_method` hoặc `sys_config`, đồng thời ghi vào OPEN-QUESTIONS. Engine là **hàm thuần**: đầu vào là DTO, đầu ra là DTO, để test bảng-dữ-liệu dễ dàng.

### 6.1 Kế hoạch kỳ (`plan_value`)

- Lấy `adj_<kỳ>` nếu khác NULL, ngược lại lấy `target_<kỳ>`.
- Kỳ Y (cả năm) lấy `target_year`.
- Kỳ H1 lấy `target_h1`.
- `year_plan_value` = `target_year`.

### 6.2 Kết quả KPI (`kpi_result`)

- Tính `kpi_result = eval(kpi.result_expression, { <component.code>: component.final_value })`.
- Biểu thức hỗ trợ: `+ - * /`, `SUM`, `AVG`, `MIN`, `MAX`, `IF`, `ROUND`.
- Chia cho 0 → kết quả NULL và đánh dấu lỗi ở dòng đó.
- Với từng thành phần: `final_value = value + prev_adjustment + adjustment`.
- Ở cấp KPI: `final_result = kpi_result + prev_adjustment + adjustment`.
- `prev_adjustment` (ĐC kỳ trước) = tổng `adjustment` của các kỳ trước cùng năm, chỉ áp dụng khi `target_data_type = LUY_KE`, ngược lại bằng 0. **[GIẢ ĐỊNH]**

### 6.3 Tỷ lệ hoàn thành (% TH/KH)

| Công thức | Cách tính |
|---|---|
| THUAN | `final / plan × 100` |
| NGHICH | `plan / final × 100` (final = 0 → dùng trần `KPI_COMPLETION_CAP`) |
| TUY_CHINH | `eval(completion_expression, {TH, KH, KH_NAM})` |

- `plan` NULL hoặc 0 với công thức THUAN → không tính, `rating = DANG_THEO_DOI`.
- `year_completion_rate` = `final / year_plan × 100`. Với LUY_KE dùng lũy kế đến kỳ hiện tại.

### 6.4 Điểm đánh giá (thang 5)

- Loại KHUNG_TY_LE dùng bảng khung từ `scoring_method.config`. Mặc định **[GIẢ ĐỊNH]**:

| % TH/KH | Điểm |
|---|---|
| < 70% | 1 |
| 70% – < 85% | 2 |
| 85% – < 100% | 3 |
| 100% – < 110% | 4 |
| ≥ 110% | 5 |

- Loại DAT_KHONG_DAT: đạt → điểm cấu hình (mặc định 5), không đạt → điểm cấu hình (mặc định 1).
- Loại NHAP_DIEM: cán bộ nhập điểm trực tiếp.
- Nếu `score_by_result = false`, điểm = điểm nhập tay.

### 6.5 Phân loại (rating)

| Điều kiện | rating |
|---|---|
| score ≥ `KPI_PASS_SCORE` (mặc định 3) | DAT_VUOT |
| score < `KPI_PASS_SCORE` | CHUA_DAT |
| chưa có kết quả | DANG_THEO_DOI |

### 6.6 Điểm BSC

- Điểm BSC chỉ tiêu = `score × weight / Σweight` của các KPI được giao cho đơn vị trong năm (thường Σ = 100). Kết quả cũng ở thang 5.
- Điểm BSC đơn vị = Σ điểm BSC chỉ tiêu. **[GIẢ ĐỊNH]**
- **KPI cha–con:** điểm KPI cha = trung bình có trọng số điểm các KPI con, dùng trọng số con nội bộ. Chỉ trọng số KPI cha được cộng vào Σweight của đơn vị. **[GIẢ ĐỊNH]**

### 6.7 Kết quả cấp Tập đoàn

- Gộp `final_result` các đơn vị theo `group_aggregation` (TRUNG_BINH_TRONG_SO dùng trọng số giao).
- NHAP_TAY: lấy dòng của đơn vị “Công ty mẹ – Tập đoàn”.

### 6.8 Giai đoạn (lũy kế)

- % TH/KH giai đoạn = Σ TH / Σ KH các năm trong giai đoạn đến năm đang xem.
- Điểm BSC giai đoạn = trung bình điểm BSC các năm đã có kết quả. **[GIẢ ĐỊNH]**

### 6.9 Các chỉ số trên dashboard

- “KPI cảnh báo”: KPI có % TH/KH kỳ < `KPI_WARNING_RATE` (mặc định 90) hoặc rating CHUA_DAT. **[GIẢ ĐỊNH]**
- Xếp hạng: theo `bsc_score` giảm dần trong cùng nhóm (khối VNPT tỉnh; khối Tổng công ty/Công ty). Bằng điểm thì xếp theo % TH/KH, rồi theo mã đơn vị.
- Biến động = `prev_rank − rank` (dương là tăng hạng, hiển thị ▲/▼).

### 6.10 Hiệu lực tính toán

- Mỗi lần ghi kết quả/điều chỉnh/đồng bộ sẽ tính lại dòng `evaluation_result` liên quan, sau đó cập nhật `bsc_unit_summary` (async, dùng `@TransactionalEventListener`).
- “Tính lại điểm đánh giá” tính lại toàn bộ cho (năm, kỳ).

**Unit test:** tối thiểu 40 ca bảng-dữ-liệu bao phủ THUAN/NGHICH/TUY_CHINH, chia 0, LUY_KE, cha–con, biên các khung điểm, làm tròn.

---

## 7. API (REST dưới `/api`) — danh sách tối thiểu

Quy ước CRUD chuẩn cho mỗi danh mục `<res>`:
- `GET /api/<res>` (list + search + filter + paging)
- `GET /api/<res>/{id}`
- `POST /api/<res>`
- `PUT /api/<res>/{id}`
- `DELETE /api/<res>/{id}`
- `GET /api/<res>/import-template`
- `POST /api/<res>/import/validate` (multipart → preview)
- `POST /api/<res>/import/commit` (importToken)
- `GET /api/<res>/export` (cùng query filter)

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` (user, roles, permissions, menu, org scope), `GET /api/auth/sso/login` (redirect CAS), `GET /api/auth/sso/callback?ticket=` |
| Người dùng | CRUD `/api/users` + `GET/PUT /api/users/{id}/roles` |
| Vai trò/quyền | CRUD `/api/roles` + `GET/PUT /api/roles/{id}/permissions`; `GET /api/permissions`, `GET/PUT /api/permissions/{id}` |
| Đơn vị | CRUD `/api/org-units` + `GET /api/org-units/tree?scope=mine` |
| Lịch đồng bộ | `GET/PUT /api/schedules`, `GET /api/schedules/{id}`, `POST /api/schedules/{id}/run` |
| Tham số | CRUD `/api/sys-configs` |
| Danh mục | CRUD `/api/uoms`, `/api/perspectives`, `/api/objectives`, `/api/formula-definitions` (+ `POST /{id}/test`, `POST /validate-expression`), `/api/scoring-methods` (GET), `/api/stages` |
| KPI | CRUD `/api/kpis` (body gồm `children[]`, `components[]`), `GET /api/kpis/tree`, `GET /api/kpis/next-code?perspectiveId=` |
| Giao theo đơn vị | `/api/assignments/by-unit` (list/CRUD/export/import), `POST …/{id}/copy`, `POST …/close` (ids[]) |
| Giao theo chỉ tiêu | `/api/assignments/by-kpi` (list/CRUD), `POST …/copy`, `POST …/close` |
| Điều chỉnh giao | `GET /api/assignments/by-kpi/{kpiId}/{year}/adjustment`, `POST …/adjustment/draft`, `POST …/adjustment/commit`, `GET /api/assignments/details/{detailId}/history` |
| Chiến lược | CRUD `/api/strategies`; `GET/PUT /api/strategies/{id}/map` (nodes, edges, kpi frame); `GET /api/strategies/{id}/objectives/{objId}/kpis?year=&period=`; `GET /api/objectives/search-for-strategy` |
| Đánh giá theo chỉ tiêu | `GET /api/evaluations/by-kpi`, `GET /api/evaluations/by-kpi/{evalKpiId}`, `GET /api/evaluations/{evalKpiId}/results`, `POST …/sync`, `PUT …/results` (nhập tay hàng loạt), `POST …/calculate-preview`, `GET …/manual-template?componentId=`, `POST …/manual-import`, `POST …/close-r2` |
| Thẩm định/phản hồi | `GET /api/evaluations/review`, `GET /api/evaluations/results/{id}`, `PUT /api/evaluations/results/{id}/adjust` (multipart: decision file), `PUT /api/evaluations/results/{id}/manual` |
| Tổng hợp BSC | `GET /api/bsc/summary`, `POST /api/bsc/revoke` (evalKpiId), `POST /api/bsc/revoke-unit` (resultId), `POST /api/bsc/recalculate` (year, period), `POST /api/bsc/close` (year, period) → 200 hoặc 409 kèm danh sách đơn vị chưa đủ điều kiện, `POST /api/bsc/approve/check`, `POST /api/bsc/approve` |
| Báo cáo | `POST /api/reports/{templateCode}` (scope, year, period) → blob; `GET /api/reports/assignment-sheet`, `GET /api/reports/result-sheet` |
| KPI đơn vị của tôi | `GET /api/my-kpi/by-period`, `GET /api/my-kpi/by-kpi`, `GET /api/my-kpi/review`, `POST /api/my-kpi/results/{id}/adjust-request` (multipart), `GET /api/my-kpi/export` |
| Dashboard | `GET /api/dashboard/overview?unit=&year=&period=`, `/ranking-provinces`, `/corporations`, `/corporations/{unitId}/table` (+`/export`), `/kpi-list?card=`, `/focus-kpis`, `/focus-kpis/{kpiId}/breakdown`, `/province-stage?unitId=&stageId=`, `/export-results`, `/strategy-map?unit=&year=` |
| Tệp | `POST /api/files` (multipart), `GET /api/files/{id}/url` (presigned, TTL 300s), `GET /api/files/{id}/meta` |
| Thông báo | `GET /api/notifications?unreadOnly=`, `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`; `GET /api/notifications/stream` (SSE, tuỳ chọn) |

---

## 8. Kiến trúc tích hợp (điểm f)

### 8.1 VNPT CAS/SSO
- Hỗ trợ CAS protocol 2.0/3.0. Endpoint `serviceValidate` hoặc `p3/serviceValidate` cấu hình qua `CAS_SERVER_URL`, `CAS_SERVICE_URL`.
- `VnptSsoController` thực hiện:
  1. Redirect sang `${CAS}/login?service=…`.
  2. Nhận `ticket`, gọi validation, parse XML lấy `user` + attributes.
  3. Map sang `app_user` theo username hoặc email. Tài khoản không tồn tại hoặc bị khóa → trang lỗi “Tài khoản chưa được cấp quyền truy cập hệ thống”.
  4. Phát JWT cookie.
- Song song vẫn có đăng nhập tài khoản nội bộ.
- Logout có thể gọi `${CAS}/logout` (cấu hình `CAS_SLO_ENABLED`).
- Môi trường dev dùng container mock CAS.

### 8.2 Nguồn dữ liệu KPI
- Interface `KpiSourceClient` dùng Spring `RestClient` (base URL lấy từ `sys_config`).
- Mỗi `formula_definition` khai báo:
  - `api_path` có placeholder `{year}`, `{period}`, `{unitCode}`, `{kpiCode}`.
  - `http_method`.
  - `response_path` (JSONPath lấy giá trị số).
- Kiểu xác thực cấu hình được: NONE, API_KEY header, BEARER, BASIC (secret trong secret store).
- Timeout 10s, retry 2 lần (backoff), circuit breaker đơn giản.
- Mọi lần gọi ghi vào `sync_batch_item`.
- Dev dùng mock server trả số liệu giả lập.

### 8.3 Các tích hợp khác
- **VNPT HRM (mở rộng):** interface `HrmClient` (`syncOrgUnits`, `syncUsers`), có job DONG_BO_HRM. Mặc định tắt; bản đầu implement adapter stub. Đơn vị và người dùng có cột `hrm_ref`.
- **Doanh thu/chi phí:** lấy qua định nghĩa KPI công thức. Không hard-code nguồn.
- **Email:** Spring Mail SMTP.
- **Zalo:** interface `ZaloNotifier` (Zalo OA/ZNS), bật/tắt bằng `NOTIFY_ZALO_ENABLED`, template id trong `sys_config`.
- **Swagger:** Springdoc tại `/api/docs` (prod chỉ mở cho IP nội bộ, cấu hình qua Nginx).

---

## 9. Giải pháp bảo mật (điểm g) — phải implement đủ

1. **Định danh:** SSO/CAS là cơ chế định danh ngoài. JWT xác thực API theo kiểu stateless.
2. **JWT filter:**
   - Nhận Bearer header **hoặc** cookie `ACCESS_TOKEN`; kiểm tra chữ ký (HS512, secret ≥ 64 byte) và thời hạn.
   - Tra cứu user còn hoạt động trong DB.
   - **Role/permission lấy từ DB** (cache Caffeine 60s, evict khi đổi role/quyền/user). Claim role trong token không được thay thế nguồn DB.
3. **Cookie:**
   - Access token và refresh token đều HttpOnly; Path `/api`; Secure (prod); SameSite cấu hình theo domain (mặc định Lax); TTL access 15 phút, refresh 8 giờ.
   - Refresh token xoay vòng, lưu hash trong `user_session`, thu hồi khi đăng xuất.
   - Production chạy HTTPS, `Secure=true`.
4. **Secret:** JWT secret, mật khẩu DB, MinIO key, thông tin tích hợp đều nằm trong secret store (biến môi trường nạp từ file `/etc/kpi/secrets.env` quyền 600, hoặc Vault nếu có). Hỗ trợ xoay vòng: chấp nhận 2 JWT key (current + previous) trong thời gian chuyển tiếp.
5. **Production:** `BYPASS_SSO=false`. `StartupSecurityCheck` fail-fast nếu phát hiện secret hoặc credential mặc định.
6. **Least privilege:**
   - DB: user `kpi_app` chỉ có DML; `kpi_migrate` có DDL dùng cho Flyway.
   - MinIO: policy chỉ cho bucket `kpi-files`.
   - Kiểm tra quyền trên đối tượng sở hữu **trước** khi cấp presigned URL (TTL 300s).
7. **Tệp:**
   - Whitelist đuôi file (xlsx, xls, docx, pdf, png, jpg, jpeg); kiểm tra magic bytes bằng Apache Tika.
   - Giới hạn kích thước (mặc định 10 MB, cấu hình được).
   - Hook quét mã độc (ClamAV `clamd` qua TCP, bật/tắt bằng cấu hình).
   - Chính sách retention (`retention_until` + job dọn).
   - Không ghi token/ticket vào log (logback mask pattern).
8. **Đăng nhập:**
   - Khóa tài khoản 15 phút sau 5 lần sai (cấu hình được).
   - Rate limit theo IP cho `/api/auth/login`.
   - Thông báo lỗi chung chung, không lộ tài khoản nào tồn tại.
   - Chính sách mật khẩu: ≥ 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.
9. **Web:**
   - Chống CSRF bằng double-submit cookie `XSRF-TOKEN`.
   - CORS whitelist.
   - Header bảo mật ở Nginx: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy.
10. **OWASP:**
    - Code tuân thủ OWASP ASVS L2, SANS CWE Top 25, CERT.
    - CI chạy SpotBugs + FindSecBugs, OWASP Dependency-Check, `npm audit`, ZAP baseline.
11. **Đáp ứng quy định ATTT của VNPT:** tài liệu hóa trong `docs/ATTT.md`.

---

## 10. Hạ tầng triển khai (điểm h)

| VM | vCPU | RAM | HDD | OS | Vai trò |
|---|---|---|---|---|---|
| DTC_BSC_APP_01 | 16 | 24 GB | 300 GB | Ubuntu 20.04 LTS | Nginx + backend (systemd, Java 21, `-Xmx12g`) + Quartz node 1 |
| DTC_BSC_APP_02 | 16 | 24 GB | 300 GB | Ubuntu 20.04 LTS | Nginx + backend + Quartz node 2 |
| DTC_BSC_DB_01 | 20 | 32 GB | 600 GB | Ubuntu 20.04 LTS | MariaDB **MASTER** + MinIO (primary) |
| DTC_BSC_DB_02 | 20 | 32 GB | 600 GB | Ubuntu 20.04 LTS | MariaDB **SLAVE** (GTID replication) + MinIO (mirror) |

- **F5:** VIP → Nginx trên APP_01/APP_02 (round robin). Health check `GET /api/actuator/health/readiness`.
- **Stateless:** backend không dùng session server-side, nên không cần sticky session.
- **Quartz:** `isClustered=true` trên JDBC store dùng chung.
- **MariaDB:**
  - `innodb_buffer_pool_size` ≈ 20G; replication GTID + semi-sync.
  - Truy vấn dashboard/báo cáo có thể route sang replica bằng datasource read-only. Tùy chọn, bật bằng `READ_REPLICA_ENABLED`.
  - Có runbook failover thủ công trong `docs/VAN-HANH.md`.
- **MinIO:** chạy trên DB_01, `mc mirror --watch` sang DB_02. **[GIẢ ĐỊNH — hỏi CĐT vị trí đặt MinIO]**
- **Sao lưu:**
  - `mariabackup` full hằng ngày + binlog giữ 7 ngày; MinIO mirror; bản sao off-host.
  - Script `deploy/scripts/backup-db.sh` và `restore-db.sh`.
  - Mục tiêu khôi phục ≤ 01 giờ. Kiểm thử khôi phục định kỳ hằng tháng.
- **Lưu ý:** Ubuntu 20.04 đã hết hỗ trợ tiêu chuẩn. Cần ghi vào OPEN-QUESTIONS (đề xuất 22.04/24.04 hoặc ESM). Code phải chạy được trên cả 20.04 bằng JDK 21 tarball (Temurin).
- **Dev:** `docker-compose.dev.yml` dựng MariaDB 10.11, MinIO, Mailpit, mock CAS, mock KPI source.

---

# PHẦN C — ĐẶC TẢ CHỨC NĂNG (STT 1.1 → 54.1)


> **Nguyên tắc vàng:** mỗi dòng có mã STT là một tiêu chí chấm Đạt/Không đạt.
> - Tên menu, tab, nút, cột, trường, thông báo đặt trong “...” phải giữ **nguyên văn**.
> - Được phép **thêm** cột, trường hoặc nút, nhưng **không được bớt hay đổi tên**.

---

## 0. Khung giao diện chung

### 0.1 Layout và menu

**Layout** gồm:
- **Header:** logo, tên hệ thống “Hệ thống quản trị KPI theo BSC”.
- **Chuông thông báo** (§54.1).
- **Tên tài khoản ở góc trên bên phải.** Bấm vào mở menu gồm “Thông tin tài khoản” và “Đăng xuất”.
- **Sidebar** thu gọn được, kèm **Breadcrumb**.

**Menu cấp 1, theo thứ tự:**
1. “Dashboard TGĐ BSC”
2. “KPI đơn vị của tôi”
3. “Quản trị KPI”, gồm các menu con:
   - “Danh mục chỉ tiêu KPI”
   - “Danh mục mục tiêu trọng tâm”
   - “Giao KPI”
   - “Quản lý bản đồ chiến lược”
   - “Đánh giá KPI”
   - “Tổng hợp kết quả BSC”
4. “Quản trị hệ thống”

**Quy tắc hiển thị:**
- Menu, tab và nút hiển thị theo quyền lấy từ `/api/auth/me`.
- Route không có quyền → trang 403 “Bạn không có quyền truy cập chức năng này”.

### 0.2 Mẫu CRUD chuẩn (áp dụng cho mọi danh mục; dưới đây gọi tắt là **[CRUD]**)

| Thao tác | Hành vi bắt buộc |
|---|---|
| Lấy danh sách | Lưới server-side paging (mặc định 20; tùy chọn 10/20/50/100), sort theo cột, cột “STT” đánh số liên tục theo trang. Khi vào tab, hệ thống query CSDL và hiển thị ngay |
| Tìm kiếm | Ô tìm kiếm + các bộ lọc + nút “Tìm kiếm” và “Làm mới”. Nhấn Enter cũng tìm. Lọc thực hiện ở backend (query CSDL) |
| Xem | Nút “Xem” trên dòng → drawer/dialog chỉ đọc hiển thị đủ thông tin bản ghi |
| Thêm mới | Nút “Thêm …” → form trống, trường bắt buộc có dấu *. Validate cả FE (zod) và BE (Bean Validation). Báo lỗi tại từng trường. “Lưu” → toast “Thêm mới thành công” và lưới tải lại |
| Ghi lại (Sửa) | Nút “Sửa” → form đổ dữ liệu hiện có. “Lưu” → cập nhật “Người cập nhật/Ngày cập nhật”, toast “Cập nhật thành công”. Xung đột version → “Dữ liệu đã bị người khác thay đổi, vui lòng tải lại” |
| Xóa | Nút “Xóa” → dialog “Xác nhận xóa” nêu tên bản ghi. “Xác nhận” → xóa, toast “Xóa thành công”. Bản ghi đang được dùng → “Không thể xóa vì dữ liệu đang được sử dụng tại: …” |
| Nhập dữ liệu | Nút “Nhập dữ liệu” → dialog “Nhập dữ liệu từ file”, chi tiết ở bảng dưới |
| Xuất dữ liệu | Nút “Xuất dữ liệu” → xlsx theo **điều kiện tìm kiếm hiện tại**, tải về máy. Tên file `<TenDanhMuc>_ddMMyyyy_HHmm.xlsx` |

Chi tiết dialog “Nhập dữ liệu từ file”:
1. Link “Tải file mẫu” (biểu mẫu xlsx có header, dòng ví dụ, sheet hướng dẫn và danh mục tra cứu).
2. Vùng chọn/kéo-thả file (.xlsx, tối đa 10 MB).
3. Nút “Kiểm tra”: hệ thống kiểm tra tính hợp lệ và hiển thị bảng xem trước với cột Dòng, các cột dữ liệu, “Trạng thái” (Hợp lệ/Lỗi), “Mô tả lỗi”.
4. Nút “Xác nhận nhập”: chỉ lưu các dòng hợp lệ. Hệ thống thông báo kết quả “Đã nhập X/Y bản ghi; Z bản ghi lỗi” và cho tải file lỗi. Lưới tải lại.

Mọi nút đều ẩn nếu người dùng thiếu quyền. Backend vẫn chặn kể cả khi gọi API trực tiếp.

---

## I. QUẢN TRỊ HỆ THỐNG

### 1. Đăng nhập (route `/login`)

**1.1 Đăng nhập hệ thống**
1. Người dùng truy cập địa chỉ phần mềm, hệ thống hiển thị giao diện đăng nhập gồm:
   - “Tên đăng nhập”, “Mật khẩu” (có nút ẩn/hiện).
   - Nút “Đăng nhập”.
   - Nút “Đăng nhập bằng VNPT SSO” (§8.1 PHẦN B).
2. Người dùng nhập tên đăng nhập, mật khẩu và nhấn “Đăng nhập”.
3. Hệ thống kiểm tra tài khoản, cho phép truy cập và **hiển thị các chức năng theo vai trò được phân quyền**. Sau đăng nhập chuyển về Dashboard, hoặc về trang đầu tiên user có quyền.

**1.2 Đăng nhập – Thông tin không hợp lệ**
- Sai tên đăng nhập hoặc mật khẩu → thông báo lỗi “Tên đăng nhập hoặc mật khẩu không đúng” và **không cho phép truy cập**.
- Tài khoản bị khóa hoặc ngưng → báo lỗi tương ứng.
- Sai quá số lần cho phép → khóa tạm thời.
- Mọi lần đăng nhập ghi vào `login_log`.

### 2. Đăng xuất

**2.1 Đăng xuất hệ thống**
1. Người dùng nhấn vào **tên tài khoản tại góc trên bên phải** và chọn “Đăng xuất”.
2. Hệ thống kết thúc phiên: revoke refresh token, xóa cookie, clear Zustand và TanStack Query cache. Nếu đăng nhập qua SSO và bật SLO thì gọi CAS logout.
3. Hiển thị lại giao diện đăng nhập.

### 3. Quản lý người dùng
Đường dẫn: menu “Quản trị hệ thống” → tab “Danh sách người dùng”.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 3.1 | Lấy danh sách – Người dùng | Lưới “Danh sách người dùng”, cột: “STT”, “Họ tên”, “Email”, “Đơn vị”, “Trạng thái”, “Người tạo”, “Ngày tạo”, “Người cập nhật”, “Ngày cập nhật”, “Thao tác” |
| 3.2 | Tìm kiếm – Người dùng | Ô tìm theo họ tên hoặc email; lọc “Trạng thái”, “Đơn vị” (TreeSelect, **gồm cả đơn vị con**) |
| 3.3 | Xem chi tiết – Người dùng | Nút “Xem” → thông tin người dùng + danh sách vai trò đã gán |
| 3.4 | Thêm mới – Người dùng | Nút “Thêm người dùng”. Trường: “Họ tên”*, “Email”*, “Đơn vị”*, “Trạng thái”*. Bổ sung: “Tên đăng nhập”* (gợi ý từ email), “Số điện thoại”, “Nguồn xác thực” (Nội bộ/SSO/Cả hai), “Mật khẩu khởi tạo” (bắt buộc nếu có xác thực nội bộ). “Lưu” → thông báo thành công |
| 3.5 | Ghi lại – Người dùng | Nút “Sửa” → sửa cùng các trường (không sửa tên đăng nhập) → “Lưu” |
| 3.6 | Xóa – Người dùng | Nút “Xóa” → “Xác nhận”. Không được xóa chính mình. User đã phát sinh dữ liệu → soft delete |
| 3.7 | Nhập dữ liệu – Người dùng | [CRUD]. Cột mẫu: Họ tên, Email, Tên đăng nhập, Mã đơn vị, Trạng thái, Mã vai trò (nhiều, cách nhau dấu phẩy) |
| 3.8 | Xuất dữ liệu – Người dùng | [CRUD] |
| 3.9 | Gán vai trò cho người dùng | Xem bảng chi tiết bên dưới |
| 3.10 | Bỏ gán vai trò của người dùng | Cùng dialog với 3.9: **bỏ chọn** vai trò đã gán → “Lưu” → bỏ gán, thông báo thành công |

**Chi tiết 3.9 – Gán vai trò:**
1. Nút “Quản lý vai trò người dùng” trên dòng → dialog hai cột:
   - Trái: “Vai trò có sẵn”, chỉ liệt kê vai trò **Hiệu lực**.
   - Phải: “Vai trò đã gán”.
   - Mỗi vai trò có checkbox; cho phép chọn “Đơn vị áp dụng” (tùy chọn) để giới hạn vai trò theo đơn vị.
2. Tích chọn một hoặc nhiều vai trò → “Lưu” → gán vai trò, cập nhật quyền truy cập (evict cache) và thông báo thành công.

### 4. Quản lý phân quyền
Đường dẫn: menu “Quản trị hệ thống” → tab “Vai trò” / tab “Quyền”.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 4.1 | Lấy danh sách – Vai trò | Lưới “Danh sách vai trò”: “STT”, “Mã – Tên vai trò”, “Mô tả”, “Trạng thái”, “Người tạo”, “Ngày tạo”, “Người cập nhật”, “Ngày cập nhật” |
| 4.2 | Tìm kiếm – Vai trò | Tìm theo mã hoặc tên; lọc “Trạng thái” (Hiệu lực/Không hiệu lực) |
| 4.3 | Xem chi tiết – Vai trò | Thông tin vai trò + cây quyền đã gán (chỉ đọc) |
| 4.4 | Thêm mới – Vai trò | Nút “Thêm vai trò”. Trường: “Mã vai trò”*, “Tên vai trò”*, “Mô tả”, “Trạng thái”*. Bổ sung: “Phạm vi dữ liệu” (Toàn bộ/Đơn vị mình/Đơn vị mình và đơn vị con), “Phân quyền chức năng” (cây checkbox menu → quyền). “Lưu” → thành công |
| 4.5 | Ghi lại – Vai trò | “Sửa” → “Lưu”. Hệ thống **cập nhật “Người cập nhật”, “Ngày cập nhật”**; mã vai trò không sửa được |
| 4.6 | Xóa – Vai trò | “Xóa” → “Xác nhận”. Vai trò hệ thống không xóa được. Vai trò đang gán cho user → hỏi lại: “Vai trò đang gán cho N người dùng, tiếp tục xóa sẽ bỏ gán” |
| 4.7 | Lấy danh sách – Quyền | Tab “Quyền”, lưới “Danh sách quyền”: “STT”, “Mã quyền”, “Tên quyền”, “Phân hệ/Menu”, “Mô tả”, “Thứ tự” |
| 4.8 | Xem chi tiết – Quyền | Thông tin quyền + danh sách vai trò đang có quyền này |
| 4.9 | Ghi lại – Quyền | Sửa “Tên quyền”, “Mô tả”, “Thứ tự” (mã quyền bất biến) → “Lưu” → thành công |

Yêu cầu E-HSMT 1.1.3.e được hiện thực bằng:
- Quyền quản trị hệ thống tách theo đơn vị: vai trò có phạm vi + `user_role.org_unit_id`.
- Admin đơn vị chỉ quản lý được user thuộc phạm vi của mình.

### 5. Quản lý đơn vị/phòng ban
Đường dẫn: menu “Quản trị hệ thống” → tab “Danh sách đơn vị”.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 5.1 | Lấy danh sách – Đơn vị | Lưới “Danh sách đơn vị”: “STT”, “Mã đơn vị”, “Tên đơn vị”, “Đơn vị cha”, “Tên viết tắt”, “Loại đơn vị”, “Vùng”, “Giao KPI”, “Thứ tự”, “Người tạo”, “Ngày tạo”, “Người cập nhật”, “Ngày cập nhật”. Thêm nút chuyển chế độ xem Lưới/Cây |
| 5.2 | Tìm kiếm – Đơn vị | Tìm theo mã, tên hoặc tên viết tắt; lọc “Loại đơn vị”, “Vùng” |
| 5.3 | Xem chi tiết – Đơn vị | Chỉ đọc |
| 5.4 | Thêm mới – Đơn vị | Nút “Thêm đơn vị”. Trường: “Mã đơn vị”*, “Tên đơn vị”*, “Đơn vị cha”, “Tên viết tắt”, “Loại đơn vị”*, “Vùng”, “Giao KPI” (checkbox), “Thứ tự” |
| 5.5 | Ghi lại – Đơn vị | Không được chọn đơn vị cha là chính nó hoặc con cháu của nó. Hệ thống cập nhật `path` cho cả cây con |
| 5.6 | Xóa – Đơn vị | Chặn nếu còn đơn vị con, người dùng hoặc dữ liệu giao/đánh giá |
| 5.7 | Nhập dữ liệu – Đơn vị | Cột mẫu có “Mã đơn vị cha”. Import theo thứ tự cha trước con |
| 5.8 | Xuất dữ liệu – Đơn vị | [CRUD] |

Seed dữ liệu:
- “1. Công ty mẹ – Tập đoàn” (CONG_TY_ME).
- Các Tổng công ty/Công ty.
- Khối VNPT tỉnh/thành phố gồm các VNPT tỉnh/thành theo địa giới hiện hành.
- Phòng ban mẫu.

### 26.17–26.19 Lịch đồng bộ
Đường dẫn: menu “Quản trị hệ thống” → tab “Lịch đồng bộ”.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 26.17 | Lấy danh sách – Lịch đồng bộ | Lưới “Danh sách lịch đồng bộ”: “STT”, “Mã lịch”, “Tên lịch”, “Loại công việc”, “Lịch chạy” (cron + diễn giải tiếng Việt, ví dụ “02:00 hằng ngày”), “Trạng thái” (Bật/Tắt), “Lần chạy gần nhất”, “Kết quả lần chạy”, “Lần chạy tiếp theo” |
| 26.18 | Xem chi tiết – Lịch đồng bộ | Thông tin lịch + 20 lần chạy gần nhất (từ `sync_batch`) |
| 26.19 | Ghi lại – Lịch đồng bộ | “Sửa”: “Tên lịch”, “Lịch chạy” (bộ chọn: hằng ngày/hằng tuần/hằng tháng/ngày cố định + giờ, hoặc nhập cron nâng cao), “Trạng thái”, “Tham số”. “Lưu” → **reschedule trigger Quartz ngay** và thông báo thành công |

Bổ sung nút “Chạy ngay” (quyền `SCHEDULE:RUN`).

Seed các lịch:
- “Đồng bộ kết quả KPI” — 01:00 hằng ngày.
- “Hoàn tất chiến lược” — 00:30 ngày 01/01.
- “Nhắc hạn cập nhật kết quả” — 08:00 hằng ngày.
- “Tính lại điểm BSC” — tắt.
- “Đồng bộ HRM” — tắt.
- “Sao lưu logic dữ liệu” — 03:00 Chủ nhật.

### 26.20–26.24 Tham số hệ thống
Đường dẫn: menu “Quản trị hệ thống” → tab “Tham số hệ thống”.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 26.20 | Lấy danh sách – Tham số hệ thống | Lưới “Danh sách tham số hệ thống”: “STT”, “Mã tham số”, “Giá trị” (che nếu là secret), “Kiểu dữ liệu”, “Nhóm”, “Mô tả”, “Người cập nhật”, “Ngày cập nhật” |
| 26.21 | Xem chi tiết – Tham số hệ thống | Chỉ đọc |
| 26.22 | Thêm mới – Tham số hệ thống | Nút “Thêm tham số”. Trường: “Mã tham số”*, “Giá trị”*, “Kiểu dữ liệu”*, “Nhóm”, “Mô tả”. Validate giá trị theo kiểu |
| 26.23 | Ghi lại – Tham số hệ thống | Nút “Sửa” trên màn hình danh sách → sửa → “Lưu” → thành công; evict cache cấu hình |
| 26.24 | Xóa – Tham số hệ thống | Không được xóa tham số hệ thống lõi |

Seed tham số:

| Mã | Ý nghĩa |
|---|---|
| `KPI_PASS_SCORE` | 3 |
| `KPI_WARNING_RATE` | 90 |
| `KPI_COMPLETION_CAP` | 200 |
| `UPLOAD_MAX_MB` | 10 |
| `UPLOAD_ALLOWED_EXT` | Danh sách đuôi file cho phép |
| `LOGIN_MAX_FAILED` | 5 |
| `LOGIN_LOCK_MINUTES` | 15 |
| `KPI_SOURCE_BASE_URL` | URL nguồn dữ liệu KPI |
| `KPI_SOURCE_AUTH_TYPE` | Kiểu xác thực nguồn KPI |
| `NOTIFY_EMAIL_ENABLED` | Bật/tắt email |
| `NOTIFY_ZALO_ENABLED` | Bật/tắt Zalo |
| `REMIND_DAYS_BEFORE_DEADLINE` | 5 |
| `DEADLINE_DAY_AFTER_PERIOD` | 15 |
| `DASHBOARD_DEFAULT_PERIOD` | Kỳ mặc định của dashboard |

---

## II. TRANG TỔNG HỢP — menu “Dashboard TGĐ BSC” (STT 6 → 17.8)

Route `/dashboard`. Tham số URL (TanStack Router search params, validate bằng zod): `unit`, `year`, `period`.

### Bộ lọc (thanh trên cùng)

- **“Đơn vị”** (TreeSelect), tùy chọn đầu: “1. Công ty mẹ – Tập đoàn”, “Khối VNPT tỉnh/thành phố”, sau đó là cây đơn vị. Người dùng cấp đơn vị chỉ thấy đơn vị trong phạm vi của mình.
- **“Năm”**.
- **“Kỳ đánh giá”**: “Cả năm”, “Quý I”, “Quý II”, “Quý III”, “Quý IV”, “6 tháng đầu năm”, và các “Giai đoạn <từ năm>–<đến năm>”.

Đổi bộ lọc sẽ **query CSDL và cập nhật toàn bộ số liệu** (17.2). Chọn một đơn vị cụ thể → chuyển sang chế độ xem đơn vị và hiển thị dòng “Đang xem: <Đơn vị> – <Kỳ đánh giá>”.

### Thành phần dùng chung trên mọi chế độ

**“Thời điểm cập nhật mới nhất”**: max(`updated_at`) của kết quả trong phạm vi.

**4 thẻ thống kê KPI**, mỗi thẻ có “tỷ lệ so với kỳ trước” (▲/▼ %) và vùng/nút “Click xem”:

| Thẻ | Định nghĩa |
|---|---|
| “Tổng số KPI giao” | Tổng số KPI được giao |
| “KPI đạt/vượt” | điểm ≥ 3 |
| “KPI chưa đạt” | điểm < 3 |
| “KPI đang theo dõi” | chưa có kết quả |

**Thẻ “Điểm BSC tổng hợp”**: gauge ECharts thang 5, kèm điểm kỳ trước.

**Vùng “Chỉ đạo trọng tâm” (tổng quan các chỉ tiêu cần theo dõi):**
- Grid thẻ các KPI có `is_focus`.
- Mỗi thẻ hiển thị tên KPI, “TH kỳ đánh giá”, “% TH/KH kỳ”, “% TH/KH năm” (progress bar màu theo rating) và nút “Xem chi tiết”.
- Có nút “Xem Danh Sách Chi Tiết Các KPI”.

**Nút trên thanh công cụ:**
- “Xuất kết quả đánh giá KPI”.
- “Xem bản đồ chiến lược”.

### Chế độ A — Tập đoàn (Đơn vị = “1. Công ty mẹ – Tập đoàn”)

| STT | Chức năng | Đặc tả |
|---|---|---|
| 6.1 | Xem biểu tổng hợp Tập đoàn – Năm | Kỳ = “Cả năm”. Hiển thị kết quả KPI cả năm của Tập đoàn: thẻ thống kê, “Điểm BSC tổng hợp”, tổng quan chỉ tiêu cần theo dõi, “Bảng xếp hạng điểm BSC khối VNPT tỉnh/thành phố”, “Điểm BSC các Tổng công ty/Công ty” |
| 7.1 | Xem biểu tổng hợp Tập đoàn – Quý | Như 6.1, số liệu theo quý đã chọn |
| 8.1 | Xem biểu tổng hợp Tập đoàn – Giai đoạn | Như 6.1, số liệu **lũy kế theo giai đoạn** (PHẦN B §6.8) |
| 17.1 | Xem tổng quan – Dashboard TGĐ BSC | Vào menu: hệ thống hiển thị dashboard theo đơn vị/năm/kỳ **mặc định** (đơn vị cao nhất trong phạm vi, năm hiện tại, kỳ đánh giá gần nhất đã có kết quả) |

Ở cấp Tập đoàn có thêm hai khối:

**“Bảng xếp hạng điểm BSC khối VNPT tỉnh/thành phố”:**
- Cột: “Hạng”, “Đơn vị/Tỉnh thành”, “Điểm BSC”, “Biến động”, “Thao tác” (nút “Xem”).
- Mặc định hiện top 10, có “Xem tất cả”.

**“Điểm BSC các Tổng công ty/Công ty”:**
- Bar chart ngang kèm danh sách: “Tên đơn vị”, “% đạt KH kỳ”, “Điểm BSC”.
- Mỗi đơn vị bấm được (→ 17.7).

### Chế độ B — Đơn vị cụ thể

| STT | Chức năng | Đặc tả |
|---|---|---|
| 9.1 | Xem biểu tổng hợp Đơn vị – Năm | Thẻ thống kê KPI, “Điểm BSC tổng hợp”, vùng chỉ đạo trọng tâm gồm thẻ KPI (“TH kỳ đánh giá”, “% TH/KH kỳ”, “% TH/KH năm”) của đơn vị |
| 10.1 | Xem biểu tổng hợp Đơn vị – Quý | Như 9.1 theo quý |
| 11.1 | Xem biểu tổng hợp Đơn vị – Giai đoạn | Như 9.1, lũy kế giai đoạn |
| 16.1 | Xem Dashboard đơn vị từ bảng xếp hạng | Tại dashboard Tập đoàn, nhấn “Xem” trên một dòng “Bảng xếp hạng điểm BSC khối VNPT tỉnh/thành phố” → chuyển sang dashboard điều hành của đơn vị đó, **tự động cập nhật bộ lọc “Đơn vị”**, hiển thị chế độ đang xem (Đơn vị, Kỳ đánh giá) và toàn bộ số liệu KPI theo năm/kỳ đang chọn |
| 16.2 | Quay lại Dashboard Tập đoàn | Ở chế độ đơn vị có nút “Quay lại Dashboard Tập đoàn” → đặt lại bộ lọc Đơn vị = Tập đoàn và hiển thị số liệu cấp Tập đoàn |
| 17.2 | Lọc dữ liệu – Dashboard TGĐ BSC | Đã mô tả ở phần Bộ lọc |

### Chế độ C — Khối VNPT tỉnh/thành phố

| STT | Chức năng | Đặc tả |
|---|---|---|
| 12.1 | Xem biểu tổng hợp Tỉnh – Năm (tất cả các tỉnh) | Đơn vị = “Khối VNPT tỉnh/thành phố”, kỳ “Cả năm”. Hiển thị **bảng tổng hợp kết quả KPI và điểm BSC của tất cả VNPT tỉnh/thành phố, sắp xếp theo thứ hạng điểm BSC**. Cột: “Hạng”, “Mã đơn vị”, “VNPT tỉnh/thành phố”, “Tổng số KPI giao”, “KPI đạt/vượt”, “KPI chưa đạt”, “KPI đang theo dõi”, “% TH/KH kỳ”, “Điểm BSC”, “Biến động”, “Thao tác” (“Xem” → 16.1). Kèm bar chart điểm BSC theo tỉnh |
| 13.1 | Xem biểu tổng hợp Tỉnh – Quý (tất cả các tỉnh) | Như 12.1 theo quý |

### Chế độ D — Một tỉnh, kỳ = Giai đoạn

| STT | Chức năng | Đặc tả |
|---|---|---|
| 14.1 | Xem biểu tổng hợp giai đoạn của 1 tỉnh | Hiển thị kết quả thực hiện KPI và điểm BSC **của tỉnh qua các kỳ đánh giá trong giai đoạn**: line chart điểm BSC theo kỳ và bảng “Kỳ đánh giá”, “Tổng số KPI giao”, “KPI đạt/vượt”, “KPI chưa đạt”, “% TH/KH”, “Điểm BSC”, “Hạng trong khối” |

### Bản đồ chiến lược trên dashboard

**15.1 Xem bản đồ chiến lược**
- Nút “Xem bản đồ chiến lược” → mở bản đồ chiến lược (chỉ đọc) của đơn vị theo năm/giai đoạn đang chọn.
- Bản đồ gồm:
  - Các mục tiêu trọng tâm theo từng viễn cảnh (dải ngang, màu theo viễn cảnh).
  - Liên kết giữa các mục tiêu (mũi tên).
  - Các KPI thuộc từng mục tiêu, kèm kết quả thực hiện (“Mục tiêu”, “Kết quả”, “Kỳ đánh giá”, màu theo rating).
- Dùng lại component bản đồ của §VI ở mode `readonly`.
- Không có chiến lược → “Chưa có bản đồ chiến lược cho đơn vị/kỳ đã chọn”.

### Popup và xuất file trên dashboard

**17.3 Xem danh sách KPI theo thẻ chỉ số**
- Nhấn “Click xem” hoặc vùng một thẻ thống kê → dialog “Danh Sách Chi Tiết Các KPI” chỉ gồm KPI thuộc thẻ đó.
- Cột: “STT”, “Mã KPI”, “Tên chỉ tiêu KPI”, “Viễn cảnh”, “TH kỳ đánh giá”, “% TH/KH kỳ”, “% TH/KH năm”, “Điểm đánh giá”, “Điểm BSC (thang 5)”.
- Nút “Đóng” → quay lại dashboard.

**17.4 Xem danh sách chi tiết các KPI**
- Nút “Xem Danh Sách Chi Tiết Các KPI” tại vùng “Chỉ đạo trọng tâm” → dialog “Danh Sách Chi Tiết Các KPI” với **đầy đủ** KPI của đơn vị/kỳ đang chọn (cùng cột như 17.3).
- Có ô tìm kiếm và lọc viễn cảnh. Nút “Đóng”.

**17.5 Xem chi tiết KPI trọng tâm**
- Nút “Xem chi tiết” trên một thẻ KPI → khung chi tiết gồm:
  - “Mã KPI”, “Tên KPI”, “Viễn cảnh”.
  - Các chỉ số “KH năm”, “KH giao kỳ”, “TH kỳ đánh giá”, “Điểm BSC chỉ tiêu”.
- Bảng “Chi tiết phân rã kết quả các đơn vị con cùng được giao KPI”:
  - Hiển thị kèm “số đơn vị trực thuộc”.
  - Cột: “STT”, “Tên đơn vị con”, “Giá trị TH”, “% TH/KH kỳ”, “Điểm đánh giá”, “Điểm BSC chỉ tiêu (thang 5)”, “Trạng thái”.
  - KPI không giao cho đơn vị con → thông báo “Không có đơn vị con”.
- Nút “Đóng”.

**17.6 Xuất kết quả đánh giá KPI**
- Nút “Xuất kết quả đánh giá KPI” → xuất file xlsx kết quả đánh giá KPI theo **đơn vị, năm, kỳ đánh giá đang chọn** và tải về máy.
- Sheet 1 là tổng hợp, sheet 2 là chi tiết KPI.

**17.7 Xem bảng tổng hợp kết quả KPI giao cho Tổng công ty/Công ty**
- Tại dashboard Tập đoàn, nhấn một đơn vị trong khung “Điểm BSC các Tổng công ty/Công ty” → dialog “Bảng tổng hợp kết quả các KPI giao cho đơn vị”.
- Nội dung: tổng quan KPI giao, tỷ lệ % và điểm BSC của tổng công ty/công ty/trung tâm/phòng ban trực thuộc.
- Cột: “STT”, “Đơn vị thành viên”, “Tổng số KPI giao”, “KPI đạt”, “KPI cảnh báo”, “% TH/KH kỳ”, “Điểm BSC đơn vị (thang 5)”, “Xếp hạng”.
- Nút “Đóng”.

**17.8 Xuất bảng tổng hợp kết quả KPI giao cho Tổng công ty/Công ty**
- Trong dialog 17.7 có nút “Xuất Bảng Excel” → xuất đúng bảng đang xem ra Excel và tải về.

### Điều hướng (SiteMap — E-HSMT trang 3), phải đi được đủ các đường sau

1. **Bắt đầu chương trình** → “Biểu tổng hợp Tập đoàn – Năm hiện tại”.
   - → chọn năm X → “Biểu tổng hợp Tập đoàn – Năm X”.
   - → nhấn nút Quý → “Biểu tổng hợp Tập đoàn – Quý 1 Năm X (nếu là năm hiện tại thì Quý hiện tại)”.
   - → chọn Quý y → “… – Quý y – Năm X”.
2. **Tập đoàn – Năm hiện tại**:
   - → chọn giai đoạn hoặc ấn theo chiến lược tập đoàn → “Biểu tổng hợp Tập đoàn – Giai đoạn, năm hiện tại”.
   - → chọn giai đoạn X–Y → “Tập đoàn – Giai đoạn X–Y, năm đầu tiên của giai đoạn”.
   - → chọn năm X trên biểu đồ → “Tập đoàn – Giai đoạn: năm X”.
   - Từ đó có thể xem theo Năm hoặc theo Quý.
3. **Nhấn nút Bản đồ chiến lược** → “Bản đồ chiến lược của năm tương ứng”. Từ biểu giai đoạn cũng có nút sang bản đồ chiến lược.
4. **Chọn đơn vị** → luồng giống Tập đoàn cho “Biểu tổng hợp đơn vị”: Năm hiện tại ↔ Năm X ↔ Quý; Giai đoạn ↔ Giai đoạn X–Y ↔ năm X trên biểu đồ.
5. **Chọn tỉnh** → “Biểu tổng hợp Tỉnh – Năm hiện tại” → chọn năm X → “Tỉnh – Năm X” → nút Quý → “Biểu tổng hợp đơn vị – Quý 1 Năm X …”.

Trên biểu đồ giai đoạn, **nhấn vào cột của một năm** → chuyển kỳ sang năm đó (onClick ECharts).

**Phân quyền xem** (bảng E-HSMT trang 3–4):
- Biểu Tập đoàn và biểu Tỉnh: Admin hệ thống, Lãnh đạo Tập đoàn, Admin Tập đoàn/Admin, Quản trị và Tổng hợp giao KPI, Quản trị và tổng hợp thẩm định kết quả thực hiện, Giao KPI, Phối hợp KPI, Đánh giá KPI, Lập chiến lược.
- Biểu Đơn vị: mọi vai trò có quyền xem theo đơn vị; người dùng cấp đơn vị chỉ xem dữ liệu đơn vị mình.
- Bản đồ chiến lược: tất cả vai trò trong bảng phân quyền chức năng.

---

## III. KPI ĐƠN VỊ CỦA TÔI — menu “KPI đơn vị của tôi” (STT 18 → 22)

Đơn vị mặc định là đơn vị của người dùng. Nếu user có phạm vi nhiều đơn vị thì có thêm bộ chọn “Đơn vị”. Có bộ chuyển “Hình thức xem” (segmented) gồm 3 lựa chọn: “Theo kỳ đánh giá”, “Theo chỉ tiêu KPI”, “Theo dõi kết quả thẩm định và phản hồi”.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 18.1 | KPI đơn vị của tôi – Xem theo kỳ đánh giá | Chọn “Năm”, “Kỳ đánh giá” → danh sách KPI giao cho đơn vị trong kỳ: “Mã – Tên tiêu chí KPI”, “Viễn cảnh”, “Đơn vị đo”, “Trọng số”, “KH giao”, “Kết quả thực hiện”, “% TH/KH”, “Điểm”, “Trạng thái đánh giá”. KPI cha–con hiển thị dạng cây. Dòng cuối: “Điểm BSC đơn vị” |
| 19.1 | KPI đơn vị của tôi – Xem theo chỉ tiêu KPI | Chọn “Năm” và một tiêu chí KPI → kết quả thực hiện qua các kỳ trong năm: bảng các cột kỳ (Quý I, Quý II, 6 tháng đầu năm, Quý III, Quý IV, Cả năm) × dòng (“KH giao”, “Kết quả thực hiện”, “% TH/KH”, “Điểm”) + biểu đồ cột/đường |
| 20.1 | KPI đơn vị của tôi – Theo dõi kết quả thẩm định và phản hồi | Chọn “Năm”, “Kỳ đánh giá” → danh sách KPI của đơn vị kèm “Kết quả”, “Điểm”, “Trạng thái đánh giá” (“ĐV đề nghị điều chỉnh”/“Đã xử lý điều chỉnh”/“Chốt đánh giá KPI”…) và “Ý kiến phản hồi” (ý kiến của bộ phận thẩm định, lý do điều chỉnh). Nút “Xem” để xem chi tiết lịch sử trao đổi |
| 21.1 | Đề nghị điều chỉnh kết quả KPI | Xem chi tiết bên dưới |
| 22.1 | Xuất kết quả đánh giá KPI theo mẫu | Ở hình thức “Theo kỳ đánh giá”, chọn “Năm”, “Kỳ đánh giá” → nút “Xuất dữ liệu” → xuất file Excel **theo mẫu** (`report_template` KQ_DANH_GIA_DON_VI) và tải về |

**Chi tiết 21.1 – Đề nghị điều chỉnh:**
1. Ở hình thức “Theo dõi kết quả thẩm định và phản hồi”, nút “Đề nghị điều chỉnh” chỉ hiện trên KPI **chưa chốt kết quả**: trạng thái dòng ∈ {Đã có kết quả, Đã xử lý điều chỉnh} và kỳ chưa chốt.
2. Dialog “Đề nghị điều chỉnh kết quả KPI” gồm:
   - Thông tin KPI.
   - Lưới thành phần: “Mã thành phần”, “Tên thành phần”, “Kết quả hiện tại”, “Kết quả KPI đề xuất” (nhập), “Điều chỉnh đề xuất” (nhập).
   - “Ý kiến đề xuất”* (textarea).
   - “File minh chứng” (nhiều file, theo whitelist).
3. Nhấn “Gửi” → lưu đề nghị, chuyển trạng thái đánh giá của KPI sang **“ĐV đề nghị điều chỉnh”**, thông báo thành công.
4. Gửi notify cho cán bộ đánh giá và vai trò thẩm định.

---

## IV. DANH MỤC KPI TẬP TRUNG — menu “Quản trị KPI” (STT 23 → 28)

### 23. Quản lý danh mục chỉ tiêu KPI
Đường dẫn: “Quản trị KPI” → “Danh mục chỉ tiêu KPI” → tab “Danh sách KPI”.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 23.1 | Lấy danh sách – Danh sách KPI | Lưới “Danh sách KPI”: “STT”, “Mã – Tên tiêu chí KPI”, “Viễn cảnh”, “Đơn vị đo”, “Mã KPI cha”, “Mục tiêu trọng tâm”, “Đơn vị giao”. Mỗi KPI cha có **biểu tượng mở rộng** → hiển thị KPI con trực thuộc dạng **cây phân cấp** (lazy load hoặc tree data) |
| 23.2 | Tìm kiếm – Danh sách KPI | Tìm theo từ khóa tên hoặc mã; lọc “Viễn cảnh”, “Mục tiêu trọng tâm”. Kết quả khớp KPI con thì hiển thị cả nhánh cha |
| 23.3 | Xem chi tiết – Danh sách KPI | Toàn bộ trường của form 24/25 (chỉ đọc), danh sách KPI con, danh sách thành phần |
| 23.4 | Ghi lại – Danh sách KPI | “Sửa” → form như 24/25. Không đổi được “Cấu trúc tiêu chí” và “Viễn cảnh” nếu KPI đã được giao. Mã không đổi |
| 23.5 | Xóa – Danh sách KPI | Chặn nếu KPI đã được giao hoặc gắn vào chiến lược. Xóa KPI cha thì hỏi lại vì sẽ xóa cả KPI con |
| 23.6 | Nhập dữ liệu – Danh sách KPI | Mẫu có các cột của form, cột “Mã KPI cha” dùng để tạo cây; các danh mục tra cứu theo **mã** |
| 23.7 | Xuất dữ liệu – Danh sách KPI | [CRUD], xuất cả KPI con |

### 24/25. Thêm mới tiêu chí đánh giá KPI

**24.1 KPI đơn lẻ / 25.1 KPI cha – con.** Nút “Thêm tiêu chí” → giao diện “Thêm mới tiêu chí KPI” gồm các trường sau, đúng thứ tự:

| Trường | Kiểu | Bắt buộc |
|---|---|---|
| “Cấu trúc tiêu chí” | Radio: “KPI đơn lẻ” / “KPI cha – con” | * |
| “Mã tiêu chí” | Chỉ đọc, **tự động sinh theo viễn cảnh**: `<Mã viễn cảnh>-<NNN>` (vd `TC-012`); KPI con `<mã cha>.<NN>`. Sinh khi chọn viễn cảnh (`GET /api/kpis/next-code`); chốt số khi lưu (khóa sequence theo viễn cảnh, chống trùng) | — |
| “Tên tiêu chí” | Text ≤ 500 | * |
| “Cách tính kết quả KPI Tập đoàn” | Select: Tổng; Trung bình; Trung bình có trọng số; Lớn nhất; Nhỏ nhất; Theo công thức (hiện ô biểu thức); Nhập tay | * |
| “Viễn cảnh” | Select | * |
| “Link với KPI tập đoàn” | Select KPI (tìm kiếm) | |
| “Loại số liệu giao” | Select: Lũy kế; Theo kỳ; Cuối kỳ; Bình quân | * |
| “Công thức tỷ lệ hoàn thành chỉ tiêu” | Select: Thuận (TH/KH); Nghịch (KH/TH); Tùy chỉnh (hiện ô biểu thức, biến TH, KH, KH_NAM) | |
| “Phương pháp tính điểm” | Select từ `scoring_method` | * |
| “Tính điểm theo kết quả thực hiện” | Switch | |
| “Mục tiêu trọng tâm” | Select, **lọc theo viễn cảnh đã chọn** | * |
| “Tỷ trọng (1–100)” | Số nguyên 1–100 | |
| “Đơn vị giao” | TreeSelect đơn vị | * |
| “Cán bộ giao” | Select user thuộc đơn vị giao | * |
| “Đơn vị đánh giá” | TreeSelect | * |
| “Cán bộ đánh giá” | Select user thuộc đơn vị đánh giá | * |
| “Nguồn dữ liệu” | Select: API; Nhập tay; Kết hợp | |
| Bổ sung: “Đơn vị đo” | Select | * |
| Bổ sung: “Thuộc vùng chỉ đạo trọng tâm” | Switch | |
| Bổ sung: lưới “Thành phần KPI” | Mỗi dòng gồm “Mã biến”, “Tên thành phần”, “Định nghĩa KPI công thức”, “Nguồn” (API/Nhập tay). Kèm ô “Biểu thức kết quả” và nút “Kiểm tra biểu thức” | |

Luồng thao tác:
- **24.1:** chọn “KPI đơn lẻ”, nhập đủ trường bắt buộc (Tên tiêu chí, Cách tính kết quả KPI Tập đoàn, Viễn cảnh, Loại số liệu giao, Phương pháp tính điểm, Mục tiêu trọng tâm, Đơn vị giao, Cán bộ giao, Đơn vị đánh giá, Cán bộ đánh giá) → hệ thống tự sinh mã → “Lưu” → KPI hiện trong lưới “Danh sách KPI” và thông báo thành công.
- **25.1:** chọn “KPI cha – con” → hệ thống **hiển thị thêm phần nhập KPI con**: lưới “Danh sách KPI con”, nút “Thêm KPI con”. Mỗi KPI con nhập trong sub-form có các trường như trên, kế thừa mặc định viễn cảnh/mục tiêu của cha, có “Tỷ trọng” nội bộ. Nhập đủ trường của KPI cha và thêm một hoặc nhiều KPI con → “Lưu” trong **một transaction** → lưới hiển thị KPI con dưới KPI cha dạng cây, thông báo thành công.

### 26. Danh mục khác (tab trong “Danh mục chỉ tiêu KPI”)

**Tab “Đơn vị đo” (26.1–26.8)** — áp dụng [CRUD] đầy đủ.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 26.1 | Lấy danh sách – Đơn vị đo | Lưới “Danh sách đơn vị đo”: “STT”, “Tên đơn vị đo”, “Mô tả”, “Trạng thái”, “Người tạo”, “Ngày tạo”, “Người cập nhật”, “Ngày cập nhật” |
| 26.2 | Tìm kiếm – Đơn vị đo | Từ khóa tên hoặc mã; lọc “Trạng thái” (Hiệu lực/Không hiệu lực) |
| 26.3 | Xem chi tiết – Đơn vị đo | [CRUD] |
| 26.4 | Thêm mới – Đơn vị đo | Nút “Thêm đơn vị đo”. Trường: “Tên đơn vị đo”*, “Mô tả”, “Trạng thái”* |
| 26.5 | Ghi lại – Đơn vị đo | [CRUD] |
| 26.6 | Xóa – Đơn vị đo | Chặn nếu KPI đang dùng |
| 26.7 | Nhập dữ liệu – Đơn vị đo | [CRUD] |
| 26.8 | Xuất dữ liệu – Đơn vị đo | [CRUD] |

**Tab “Viễn cảnh” (26.9–26.16)** — áp dụng [CRUD] đầy đủ.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 26.9 | Lấy danh sách – Viễn cảnh | Lưới “Danh sách viễn cảnh”: “STT”, “Mã – Tên viễn cảnh”, “Thứ tự”, “Mô tả”, “Màu” (ô màu), “Trạng thái”, “Người tạo”, “Ngày tạo”, “Người cập nhật”, “Ngày cập nhật” |
| 26.10 | Tìm kiếm – Viễn cảnh | Từ khóa tên hoặc mã; lọc “Trạng thái” |
| 26.11 | Xem chi tiết – Viễn cảnh | [CRUD] |
| 26.12 | Thêm mới – Viễn cảnh | Nút “Thêm viễn cảnh”. Trường: “Mã viễn cảnh”*, “Tên viễn cảnh”*, “Thứ tự”, “Mô tả”, “Màu” (color picker), “Trạng thái”* |
| 26.13 | Ghi lại – Viễn cảnh | Mã khóa sửa nếu đã có KPI dùng làm tiền tố |
| 26.14 | Xóa – Viễn cảnh | Chặn nếu có KPI hoặc mục tiêu đang dùng |
| 26.15 | Nhập dữ liệu – Viễn cảnh | [CRUD] |
| 26.16 | Xuất dữ liệu – Viễn cảnh | [CRUD] |

### 27. Quản lý và cấu hình nguồn dữ liệu
Đường dẫn: tab “Định nghĩa KPI công thức”.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 27.1 | Lấy danh sách – Định nghĩa KPI công thức | Lưới “Danh sách định nghĩa KPI công thức”: “STT”, “Mã – Tên định nghĩa”, “Loại định nghĩa”, “Loại số liệu”, “Biểu thức công thức”, “Định nghĩa nguồn”, “Đường dẫn API”, “Mô tả nghiệp vụ”, “Trạng thái”, “Người tạo” |
| 27.2 | Tìm kiếm – Định nghĩa KPI công thức | Từ khóa tên hoặc mã; lọc “Trạng thái” |
| 27.3 | Xem chi tiết – Định nghĩa KPI công thức | Kèm 10 lần đồng bộ gần nhất của định nghĩa |
| 27.4 | Thêm mới – Định nghĩa KPI công thức | Nút “Thêm định nghĩa KPI công thức”. Trường: “Mã định nghĩa”*, “Tên định nghĩa”*, “Loại định nghĩa”* (Thành phần lấy từ API/Thành phần nhập tay/Công thức tổng hợp), “Loại số liệu”*, “Biểu thức công thức” (bắt buộc với Công thức tổng hợp; dùng mã định nghĩa khác làm biến), “Định nghĩa nguồn” (hệ thống nguồn + tham số JSON, có editor), “Đường dẫn API” (bắt buộc với loại API; placeholder `{year}`, `{period}`, `{unitCode}`, `{kpiCode}`), “Mô tả nghiệp vụ”, “Trạng thái”. Bổ sung: “Phương thức HTTP”, “Đường dẫn giá trị trong response (JSONPath)”, nút “Kiểm tra kết nối” (gọi thử với tham số mẫu, hiện giá trị nhận được), “Kiểm tra biểu thức” |
| 27.5 | Ghi lại – Định nghĩa KPI công thức | [CRUD] |
| 27.6 | Xóa – Định nghĩa KPI công thức | Chặn nếu thành phần KPI đang dùng |

### 28. Quản lý mục tiêu trọng tâm
Đường dẫn: “Quản trị KPI” → “Danh mục mục tiêu trọng tâm”. Áp dụng [CRUD] đầy đủ.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 28.1 | Lấy danh sách – Mục tiêu trọng tâm | Lưới “Danh sách mục tiêu trọng tâm”: “STT”, “Mã – Tên mục tiêu”, “Viễn cảnh”, “Mô tả”, “Người tạo”, “Ngày tạo”, “Người cập nhật”, “Ngày cập nhật” |
| 28.2 | Tìm kiếm – Mục tiêu trọng tâm | Mã hoặc tên; lọc “Viễn cảnh” |
| 28.3 | Xem chi tiết – Mục tiêu trọng tâm | [CRUD] |
| 28.4 | Thêm mới – Mục tiêu trọng tâm | Nút “Thêm mục tiêu”. Trường: “Mã mục tiêu”*, “Tên mục tiêu”*, “Viễn cảnh”*, “Mô tả” |
| 28.5 | Ghi lại – Mục tiêu trọng tâm | [CRUD] |
| 28.6 | Xóa – Mục tiêu trọng tâm | Chặn nếu KPI hoặc chiến lược đang dùng |
| 28.7 | Nhập dữ liệu – Mục tiêu trọng tâm | [CRUD] |
| 28.8 | Xuất dữ liệu – Mục tiêu trọng tâm | [CRUD] |

---

## V. GIAO KPI — “Quản trị KPI” → “Giao KPI” (STT 29 → 35)

Trạng thái: **“Đang soạn” → “Đã giao” → “Đã điều chỉnh”**.
- Chỉ bản ghi “Đang soạn” được Sửa hoặc Xóa.
- Chỉ bản ghi “Đã giao” hoặc “Đã điều chỉnh” được Điều chỉnh.

### Tab “Danh sách giao KPI theo đơn vị”

| STT | Chức năng | Đặc tả |
|---|---|---|
| 29.1 | Lấy danh sách – Giao KPI theo đơn vị | Lưới “Danh sách giao KPI theo đơn vị”: [checkbox], “STT”, “Đơn vị được giao”, “Năm”, “Ngày tạo”, “Ngày cập nhật”, “Trạng thái” (Đang soạn/Đã giao/Đã điều chỉnh), “Thao tác” |
| 29.2 | Tìm kiếm – Giao KPI theo đơn vị | Tên hoặc mã đơn vị; lọc “Năm”, “Trạng thái” |
| 29.3 | Xem chi tiết – Giao KPI theo đơn vị | Thông tin giao KPI của đơn vị: danh sách tiêu chí KPI đã giao trong năm (cùng cột như màn 30.1, chỉ đọc), kèm tổng trọng số |
| 29.4 | Xóa – Giao KPI theo đơn vị | Chỉ với “Đang soạn” → “Xác nhận” → xóa header và detail |
| 29.5 | Sao chép giao KPI theo đơn vị | Xem chi tiết bên dưới |
| 30.1 | Thêm mới – Giao KPI theo đơn vị | Xem chi tiết bên dưới |
| 30.2 | Ghi lại – Giao KPI theo đơn vị | “Sửa” trên bản ghi “Đang soạn” → màn hình 30.1 đổ dữ liệu → “Lưu” → thành công |
| 31.1 | Chốt số liệu giao KPI – Giao KPI theo đơn vị | Xem chi tiết bên dưới |
| 35.1 | Giao KPI – Nhập dữ liệu | Trên màn hình nhập giao (30.1 hoặc 33.1): “Nhập dữ liệu” → dialog nhập từ file theo biểu mẫu (mẫu theo đơn vị: một dòng mỗi KPI; mẫu theo chỉ tiêu: một dòng mỗi đơn vị) → hệ thống kiểm tra hợp lệ, **cập nhật số liệu giao KPI lên màn hình nhập giao** (chưa lưu DB) và thông báo kết quả. Người dùng xem lại rồi nhấn “Lưu” |
| 35.2 | Xuất dữ liệu – Giao KPI theo đơn vị | [CRUD]; file gồm sheet tổng hợp + sheet chi tiết KPI từng đơn vị |

**Chi tiết 29.5 – Sao chép giao KPI theo đơn vị:**
1. Nút “Sao chép” trên dòng → dialog “Sao chép giao KPI theo đơn vị” gồm:
   - “Đơn vị nguồn”, “Năm giao nguồn” (chỉ đọc).
   - “Năm giao đích”* (bắt buộc).
   - Ô tìm theo mã hoặc tên đơn vị.
   - Lưới đơn vị nhận bản sao **dạng cây phân cấp**: [checkbox], “STT”, “Đơn vị nhận bản sao”, “Trạng thái giao”, “Nhóm đơn vị”.
2. “Xác nhận” → sao chép KPI, trọng số và chỉ tiêu sang các đơn vị nhận theo năm đích, với trạng thái “Đang soạn”.
3. Đơn vị đích đã có bản “Đang soạn” → ghi đè (đã cảnh báo trong dialog). Đơn vị đích đã “Đã giao” → bỏ qua và liệt kê trong kết quả.
4. Thông báo thành công.

**Chi tiết 30.1 – Thêm mới giao KPI theo đơn vị:**
1. Nút “Thêm mới” → màn hình “Giao KPI theo đơn vị” với:
   - “Đơn vị được giao”*, “Năm giao”*.
   - Nút “Chọn tiêu chí KPI” (dialog chọn nhiều từ danh mục; chọn KPI cha sẽ kèm KPI con).
   - Lưới nhập: “Mã – Tên tiêu chí KPI”, “Viễn cảnh”, “Đơn vị đo”, “Trọng số”, “Quý I”, “Quý II”, “6T ĐN”, “Quý III”, “Quý IV”, “Cả năm”, “Ghi chú”, nút xóa dòng.
   - Dòng tổng trọng số.
   - Nút “Nhập dữ liệu” (35.1).
2. Validate:
   - Số ≥ 0; trọng số 1–100.
   - Tổng trọng số ≠ 100 → cảnh báo khi Lưu, chặn khi Chốt.
   - Cặp (đơn vị, năm) đã tồn tại → báo trùng.
3. “Lưu” → lưu với trạng thái **“Đang soạn”** và thông báo thành công.

**Chi tiết 31.1 – Chốt số liệu giao KPI theo đơn vị:**
1. Tích chọn một hoặc nhiều bản ghi “Đang soạn” → nút “Chốt số liệu giao KPI” → dialog xác nhận chốt số liệu.
2. “Xác nhận” → chuyển các bản ghi sang **“Đã giao”** và thông báo thành công.
3. Sinh `evaluation_kpi` và `evaluation_result` cho các kỳ trong năm (trạng thái “Chưa chấm”/“Chưa có kết quả”).
4. Notify sự kiện “giao KPI” tới người dùng đơn vị được giao.
5. Lỗi validate (tổng trọng số ≠ 100, thiếu KH năm) → liệt kê bản ghi lỗi và không chốt bản đó.

### Tab “Danh sách giao KPI theo chỉ tiêu”

| STT | Chức năng | Đặc tả |
|---|---|---|
| 32.1 | Lấy danh sách – Giao KPI theo chỉ tiêu | Lưới “Danh sách giao KPI theo chỉ tiêu”: [checkbox], “STT”, “Mã – Tên tiêu chí KPI”, “Số đơn vị được giao”, “Viễn cảnh”, “Ngày cập nhật”, “Trạng thái” (Đang soạn/Đã giao/Đã điều chỉnh), “Năm”, “Đơn vị giao”. Biểu tượng mở rộng tại KPI cha → hiển thị thông tin giao của KPI con dạng cây |
| 32.2 | Tìm kiếm – Giao KPI theo chỉ tiêu | Mã hoặc tên tiêu chí; lọc “Năm”, “Viễn cảnh”, “Trạng thái” |
| 32.3 | Xem chi tiết – Giao KPI theo chỉ tiêu | Thông tin giao của tiêu chí gồm danh sách đơn vị được giao (cột như 33.1, chỉ đọc) |
| 32.4 | Sao chép giao KPI theo chỉ tiêu | Xem chi tiết bên dưới |
| 33.1 | Thêm mới – Giao KPI theo chỉ tiêu | Nút “Thêm mới” → màn hình giao: chọn “Tiêu chí KPI”*, “Năm giao”*, “Đơn vị được giao” (chọn nhiều từ cây, chỉ đơn vị có “Giao KPI”) → lưới: “Đơn vị được giao”, “Trọng số”, “Quý I”, “Quý II”, “6T ĐN”, “Quý III”, “Quý IV”, “Cả năm”, “Ghi chú”. Có “Nhập dữ liệu” (35.1). “Lưu” → trạng thái **“Đang soạn”**. Cặp (KPI, đơn vị, năm) đã tồn tại ở trạng thái khác “Đang soạn” → báo lỗi dòng |
| 33.2 | Ghi lại – Giao KPI theo chỉ tiêu | “Sửa” trên bản ghi “Đang soạn” → “Lưu” |
| 31.2 | Chốt số liệu giao KPI – Giao KPI theo chỉ tiêu | Tích chọn bản ghi “Đang soạn” → “Chốt số liệu giao KPI” → “Xác nhận” → chuyển **“Đã giao”** (cùng hậu xử lý như 31.1) |

**Chi tiết 32.4 – Sao chép giao KPI theo chỉ tiêu:**
1. Nút “Sao chép” → dialog “Sao chép chỉ tiêu giao KPI” gồm:
   - “Sao chép KPI”* (tiêu chí nguồn), “Năm”*.
   - Ô “Chọn đơn vị sao chép” (đơn vị nguồn đã được giao KPI này).
   - Ô tìm kiếm.
   - Lưới đơn vị: [checkbox], “STT”, “Đơn vị được sao chép”, “Nhóm đơn vị”.
2. “Xác nhận” → sao chép thông tin giao (trọng số, chỉ tiêu các kỳ) của đơn vị nguồn cho các đơn vị đã chọn, với trạng thái “Đang soạn”.
3. Thông báo thành công.

### 34. Điều chỉnh mục tiêu giao KPI cho tất cả các đơn vị

Nút “Điều chỉnh” trên bản ghi “Đã giao” hoặc “Đã điều chỉnh” ở tab “Danh sách giao KPI theo chỉ tiêu” → màn hình **“Điều chỉnh mục tiêu giao KPI”** gồm:

**Thông tin chung** (chỉ đọc): “Cập nhật mục tiêu giao cho KPI”, “Năm”, “Đơn vị đo”, “Phương pháp tính điểm”, “CT tính tỷ lệ hoàn thành”, “Tình trạng”.

**Trường bắt buộc:** “Quyết định điều chỉnh số”*, “Ngày”* (dd/mm/yyyy), “Lý do điều chỉnh”*. Có bộ lọc “Đơn vị”.

**Lưới đơn vị được giao:** “STT”, “Đơn vị được giao”, “Trọng số”, “Quý I”, “Quý I – ĐC”, “Quý II”, “Quý II – ĐC”, “6T ĐN”, “6T ĐN – ĐC”, “Quý III”, “Quý III – ĐC”, “Quý IV”, “Quý IV – ĐC”, “Thao tác” (nút “Lịch sử”).
- Các cột “– ĐC” cho nhập.
- Kỳ đã chốt đánh giá thì khóa cột ĐC tương ứng.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 34.1 | Điều chỉnh – Lưu nháp | Nhập thông tin bắt buộc và giá trị ĐC → “Lưu nháp” → lưu tạm (`kpi_assignment_adjustment.status = NHAP`), thông báo thành công. Mở lại màn hình sẽ nạp bản nháp |
| 34.2 | Điều chỉnh – Lưu chốt | “Lưu chốt” → lưu và **cập nhật chính thức** mục tiêu giao đã điều chỉnh (`adj_*`), chuyển trạng thái bản giao sang **“Đã điều chỉnh”**, ghi `kpi_assignment_history`, tính lại `plan_value` của các kết quả chưa chốt, notify đơn vị, thông báo thành công |
| 34.3 | Điều chỉnh – Xem lịch sử điều chỉnh | Nút “Lịch sử” trên một dòng đơn vị → dialog lịch sử các lần điều chỉnh của đơn vị đó: “Lần”, “Quyết định số”, “Ngày”, “Lý do”, “Kỳ”, “Giá trị trước”, “Giá trị sau”, “Người thực hiện”, “Thời điểm” |

---

## VI. CHIẾN LƯỢC (BSC) — “Quản trị KPI” → “Quản lý bản đồ chiến lược” (STT 36 → 38)

Trạng thái chiến lược: “Đang thực hiện” / “Hoàn thành”.
- Chỉ chiến lược “Đang thực hiện” mới được Sửa hoặc Xóa.
- Job Quartz “Hoàn tất chiến lược” chuyển sang “Hoàn thành” khi giai đoạn đã kết thúc.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 36.1 | Lấy danh sách – Bản đồ chiến lược | Lưới “Danh sách chiến lược”: “STT”, “Mã – Tên chiến lược”, “Giai đoạn”, “Trạng thái” (Đang thực hiện/Hoàn thành), “Chủ trì”, “Đơn vị”, “Ngày cập nhật” |
| 36.2 | Tìm kiếm – Bản đồ chiến lược | Mã hoặc tên; lọc “Chủ trì”, “Khoảng thời gian” (từ năm – đến năm, giao với giai đoạn), “Trạng thái”, “Đơn vị” |
| 36.3 | Xem chi tiết – Bản đồ chiến lược | Thông tin chiến lược + bản đồ (readonly) |
| 36.4 | Thêm mới – Bản đồ chiến lược | Nút “Thêm chiến lược”. Trường: “Tên chiến lược”*, “Giai đoạn”*, “Chủ trì”*, “Đơn vị”*. “Lưu” → **tự sinh mã chiến lược**, lưu, thông báo thành công |
| 36.5 | Ghi lại – Bản đồ chiến lược | “Sửa” → màn hình “Cập nhật chiến lược” (mô tả bên dưới). Sửa thông tin chung (“Tên chiến lược”, “Đơn vị”, “Chủ trì”, “Năm”, “Trạng thái”) → “Lưu” |
| 36.6 | Xóa – Bản đồ chiến lược | Chỉ “Đang thực hiện” → “Xác nhận” → xóa cả bản đồ, liên kết và khung KPI |
| 37.1 | Cập nhật mục tiêu trọng tâm trên bản đồ chiến lược | Nút “Cập nhật mục tiêu trọng tâm” → dialog “Tìm kiếm mục tiêu trọng tâm đặt vào chiến lược”: ô tìm theo từ khóa, bộ lọc “Viễn cảnh”, lưới phân trang ([checkbox], “STT”, “Mã – Tên mục tiêu trọng tâm”, “Mô tả”, “Viễn cảnh”). Mục tiêu đã có trên bản đồ hiển thị disabled. Tích chọn → “Thêm vào chiến lược” → node xuất hiện ở **dải viễn cảnh tương ứng**. “Lưu” → lưu bản đồ |
| 37.2 | Vẽ liên kết giữa các mục tiêu trọng tâm | Nút “Vẽ liên kết” → chuyển sang chế độ vẽ: hiện **điểm nối (handle)** trên từng thẻ và dòng hướng dẫn **“Kéo từ handle trên node để nối liên kết giữa các mục tiêu”**. Kéo từ handle nguồn đến handle đích → vẽ đường liên kết (cấm tự nối, cấm trùng). “Lưu” → lưu liên kết |
| 37.3 | Xóa mục tiêu trọng tâm khỏi bản đồ | Nút “Xóa” trên thẻ mục tiêu → loại bỏ mục tiêu **cùng các liên kết** và KPI gán của nó khỏi bản đồ → “Lưu” |
| 37.4 | Xem KPI của mục tiêu trọng tâm trên bản đồ | Biểu tượng mở rộng trên thẻ → danh sách KPI thuộc mục tiêu, kèm “Mục tiêu” (KH), “Kết quả”, “Kỳ đánh giá” (kỳ gần nhất có kết quả của đơn vị chiến lược, trong năm đang chọn) |
| 37.5 | Tải ảnh bản đồ chiến lược | Nút “Tải ảnh bản đồ” → dialog “Xem trước ảnh bản đồ chiến lược” (ảnh PNG render bằng html-to-image, fit toàn bản đồ, nền trắng, có tiêu đề chiến lược) → nút “Tải xuống” → tải file ảnh về máy |
| 37.6 | Xóa liên kết giữa các mục tiêu trọng tâm | Chọn một đường liên kết → hệ thống **đánh dấu (highlight)** và bật nút “Xóa liên kết” → nhấn → xóa đường → “Lưu” |
| 38.1 | Gán khung KPI vào chiến lược | Nút “Giao KPI” → dialog chọn tiêu chí KPI cho từng mục tiêu trọng tâm trên bản đồ (danh sách mục tiêu bên trái; bên phải là lưới KPI có tìm kiếm, mặc định lọc theo mục tiêu/viễn cảnh tương ứng). “Xác nhận” → KPI đã gán hiển thị trong thẻ mục tiêu. “Lưu” → lưu **khung KPI của chiến lược** |

### Màn hình “Cập nhật chiến lược” (dùng chung cho 36.5, 37.x, 38.1)

**Phần trên:** form thông tin chung gồm “Tên chiến lược”, “Đơn vị”, “Chủ trì”, “Giai đoạn áp dụng”, “Năm”, “Trạng thái”.

**Canvas `@xyflow/react`:**
- **Dải ngang (swimlane)** cho mỗi viễn cảnh: nhãn bên trái, sắp theo “Thứ tự”, nền nhạt theo “Màu” viễn cảnh. Swimlane là group node, không kéo được.
- **Node mục tiêu** (custom node):
  - Viền màu viễn cảnh.
  - Header “Mã – Tên mục tiêu”.
  - Số KPI gán, chip KPI (thu gọn tối đa 3).
  - Nút mở rộng (37.4), nút “Xóa” (37.3).
  - Handle trên/dưới/trái/phải (chỉ hiện ở chế độ vẽ liên kết).
- **Edge:** dạng smoothstep, có mũi tên, chọn được.

**Thanh công cụ:** “Cập nhật mục tiêu trọng tâm”, “Vẽ liên kết”, “Xóa liên kết”, “Giao KPI”, “Tải ảnh bản đồ”, “Tự động sắp xếp” (Dagre trong từng dải), Zoom +/−, “Vừa màn hình”, “Lưu”.

**Hành vi lưu:**
- Rời trang khi còn thay đổi chưa lưu → cảnh báo.
- “Lưu” gửi `PUT /api/strategies/{id}/map` gồm nodes (vị trí), edges, khung KPI trong một transaction.

---

## VII. ĐÁNH GIÁ KPI — “Quản trị KPI” → “Đánh giá KPI” (STT 39 → 45)

### Trạng thái

**Tình trạng KPI-kỳ (`evaluation_kpi`):**

| Mã | Nhãn hiển thị |
|---|---|
| CHUA_CHAM | “Chưa chấm” |
| DA_CHAM | “Đã chấm” |
| DA_XU_LY_DIEU_CHINH | “Đã xử lý điều chỉnh” |
| BCL_YEU_CAU_LAM_LAI | “BCL yêu cầu làm lại” |
| CHOT_KQ_R2 | “Chốt KQ R2” |

**Trạng thái đánh giá theo đơn vị (`evaluation_result`):**

| Mã | Nhãn hiển thị |
|---|---|
| CHUA_CO_KQ | “Chưa có kết quả” |
| DA_CO_KQ | “Đã có kết quả” |
| DV_DE_NGHI_DIEU_CHINH | “ĐV đề nghị điều chỉnh” |
| DA_XU_LY_DIEU_CHINH | “Đã xử lý điều chỉnh” |
| CHOT_DANH_GIA | “Chốt đánh giá KPI” |
| BCL_YEU_CAU_LAM_LAI | “BCL yêu cầu làm lại” |
| TGD_DA_DUYET | “TGĐ đã ký duyệt” |

Mọi chuyển trạng thái đi qua `EvaluationStateMachine` (service), bị chặn nếu không hợp lệ, và ghi audit.

### Tab “Tổng hợp BSC theo chỉ tiêu KPI”

| STT | Chức năng | Đặc tả |
|---|---|---|
| 39.1 | Lấy danh sách – Tổng hợp BSC theo chỉ tiêu KPI | Lưới “Tổng hợp BSC theo chỉ tiêu KPI”: “STT”, “Mã – Tên tiêu chí KPI”, “Viễn cảnh”, “Đơn vị đo”, “Tình trạng” (Chưa chấm/Đã xử lý điều chỉnh/BCL yêu cầu làm lại/Chốt KQ R2), “Kỳ đánh giá”, “Loại kết quả”, “Đơn vị giao”, “Thao tác” (“Xem”, “Đánh giá”, “Chốt kết quả R2”) |
| 39.2 | Tìm kiếm – Tổng hợp BSC theo chỉ tiêu KPI | Mã hoặc tên tiêu chí; lọc “Năm”, “Kỳ đánh giá”, “Viễn cảnh”, “Trạng thái”, “Loại kết quả” |
| 39.3 | Xem chi tiết – Tổng hợp BSC theo chỉ tiêu KPI | Kết quả đánh giá của tiêu chí theo kỳ đã chọn: màn hình “Cập nhật kết quả KPI cho tất cả đơn vị” ở chế độ chỉ đọc |
| 43.1 | Đánh giá – Đồng bộ lại | Xem chi tiết bên dưới |
| 44.1 | Đánh giá – Tổng hợp BSC theo chỉ tiêu KPI (nhập tay) | Trên màn hình trên, có thể **tìm theo mã hoặc tên đơn vị**, lọc theo “Đánh giá”. Nhập “Kết quả KPI” (với KPI một thành phần nhập tay; KPI nhiều thành phần mở dialog nhập theo thành phần) và “Điều chỉnh” (nếu có) cho từng đơn vị → hệ thống ghi nhận và **tính “Kết quả cuối”, “Điểm” và “Đánh giá”** của từng đơn vị (gọi `calculate-preview`, debounce 300ms). “Lưu” → lưu kết quả các đơn vị, chuyển dòng sang “Đã có kết quả”, KPI-kỳ sang “Đã chấm”, thông báo thành công |
| 44.2 | Đánh giá – Nhập dữ liệu | Xem chi tiết bên dưới |
| 49.1 | Chốt kết quả R2 – Tổng hợp BSC theo chỉ tiêu KPI | Nút “Chốt kết quả R2” trên một bản ghi chưa chốt → dialog xác nhận chốt kết quả R2 → “Xác nhận” → tình trạng sang **“Chốt KQ R2”**, **không cho phép đánh giá lại** (ẩn nút “Đánh giá”, API trả 409), thông báo thành công |

**Màn hình “Cập nhật kết quả KPI cho tất cả đơn vị”** — mở bằng nút “Đánh giá” trên bản ghi chưa chốt kết quả (Tình trạng ∈ {Chưa chấm, Đã chấm, Đã xử lý điều chỉnh, BCL yêu cầu làm lại}).

Thông tin chung:
- “Mã KPI”, “Tên tiêu chí”, “Kỳ đánh giá”, “Đơn vị đo”, “Nguồn số liệu”, “Mã KPI cha”, “Tình trạng”, “Loại số liệu”, “Phương pháp tính điểm”, “Công thức tính tỷ lệ hoàn thành”.

Lưới “Danh sách đơn vị được giao”:
- “STT”, “Mã đơn vị”, “Đơn vị được giao”, “KH giao”, “Kết quả KPI”, “ĐC kỳ trước”, “Điều chỉnh”, “Kết quả cuối”, “Điểm”, “Đánh giá”, “Tình trạng”, “Mô tả”.

Nút: “Đồng bộ lại”, “Nhập dữ liệu”, “Lưu”, “Đóng”.

**Chi tiết 43.1 – Đồng bộ lại:**
1. Nút “Đồng bộ lại” → hệ thống **gọi API lấy lại kết quả của các KPI được định nghĩa lấy kết quả từ API** (theo thành phần có nguồn API, cho mọi đơn vị trong lưới).
2. Cập nhật “Kết quả KPI”, “Kết quả cuối”, “Điểm”, “Đánh giá” của các đơn vị trên lưới.
3. Thông báo kết quả thực hiện: “Đồng bộ thành công N/M đơn vị; lỗi K” kèm link xem lỗi.
4. Chạy đồng bộ có progress. Timeout tổng < 10s với ≤ 100 đơn vị; nếu lâu hơn thì chạy nền và poll trạng thái `sync_batch`.

**Chi tiết 44.2 – Nhập dữ liệu (nhập tay từ file):**
1. Nút “Nhập dữ liệu” → dialog “Nhập dữ liệu nhập tay” gồm: “Thành phần nhập tay”* (select các thành phần có nguồn Nhập tay của KPI), mục “Tải file mẫu”, mục “Tải file lên”.
2. Chọn thành phần → “Tải file mẫu” → tải file Excel mẫu tương ứng. File gồm “Mã đơn vị”, “Tên đơn vị” (đổ sẵn các đơn vị được giao), “Giá trị”, “Ghi chú”.
3. Người dùng điền theo đúng cột, chọn hoặc **kéo thả** file vào mục “Tải file lên” (.xlsx, tối đa 10 MB).
4. “Xác nhận” → hệ thống kiểm tra hợp lệ:
   - Mã đơn vị thuộc danh sách giao.
   - Giá trị là số.
   - Không trùng.
5. Cập nhật dữ liệu thành phần nhập tay cho các đơn vị, **tính lại** “Kết quả KPI”, “Kết quả cuối”, “Điểm”, “Đánh giá” trên lưới và thông báo kết quả.

### Tab “Theo dõi kết quả thẩm định và phản hồi”

| STT | Chức năng | Đặc tả |
|---|---|---|
| 40.1 | Lấy danh sách – Theo dõi kết quả thẩm định và phản hồi | Lưới: “STT”, “Mã – Tên đơn vị”, “Mã – Tên chỉ tiêu KPI”, “Trọng số”, “Mục tiêu giao”, “Kết quả”, “Điểm”, “Trạng thái đánh giá” (ĐV đề nghị điều chỉnh/Đã xử lý điều chỉnh/Chốt đánh giá KPI), “Kỳ đánh giá”, “Thao tác” (“Xem”, “Chỉnh sửa”) |
| 40.2 | Tìm kiếm – Theo dõi kết quả thẩm định và phản hồi | Mã hoặc tên đơn vị, mã hoặc tên chỉ tiêu; lọc “Năm”, “Kỳ đánh giá”, “Trạng thái” |
| 40.3 | Xem chi tiết – Theo dõi kết quả thẩm định và phản hồi | Thông tin kết quả thẩm định KPI của đơn vị, **ý kiến đề xuất của đơn vị** (kèm file minh chứng tải được), **thông tin điều chỉnh** (nếu có: người xử lý, lý do, file quyết định), dòng thời gian trạng thái |
| 41.1 | Điều chỉnh kết quả KPI cho đơn vị | Xem chi tiết bên dưới |
| 42.1 | Cập nhật kết quả đánh giá KPI (SL nhập tay) cho đơn vị | Nút “Chỉnh sửa” trên bản ghi KPI có **nguồn số liệu nhập tay** → giao diện “Cập nhật, điều chỉnh kết quả KPI cho đơn vị” (cùng dialog 41.1, ở chế độ nhập kết quả) → nhập kết quả cho từng **thành phần nhập tay** → hệ thống ghi nhận và **tính lại Kết quả cuối** → “Lưu” → lưu kết quả và thông báo thành công |

**Chi tiết 41.1 – Điều chỉnh kết quả KPI cho đơn vị:**
1. Nút “Chỉnh sửa” trên bản ghi trạng thái **“ĐV đề nghị điều chỉnh”** → dialog **“Cập nhật, điều chỉnh kết quả KPI cho đơn vị”**.
2. Dialog gồm:
   - **Thông tin chung:** “Mã KPI”, “Tên tiêu chí”, “Đơn vị”, “Kỳ đánh giá”, “Đơn vị đo”, “Tình trạng”, “Kế hoạch giao”, “Kết quả cũ”, “Kết quả sau điều chỉnh”, “Ngày cập nhật”.
   - **“Ý kiến đề xuất của đơn vị”** kèm file đính kèm (tải về).
   - **Lưới thành phần KPI:** “Mã thành phần”, “Tên thành phần”, “Kết quả KPI”, “Kết quả KPI ĐV đề xuất”, “ĐC kỳ trước”, “Điều chỉnh ĐV đề xuất”, “Điều chỉnh” (nhập), “Kết quả cuối”.
   - Upload **file “Quyết định điều chỉnh”**.
   - **“Lý do điều chỉnh”*** (bắt buộc).
3. Người dùng xem ý kiến và file, nhập “Điều chỉnh” từng thành phần → hệ thống **tính lại “Kết quả cuối” và “Kết quả sau điều chỉnh”**.
4. “Lưu” → lưu, trạng thái sang **“Đã xử lý điều chỉnh”**, đóng `adjustment_request`, notify đơn vị, thông báo thành công.

### 45. Báo cáo (biểu giao/biểu kết quả)
Đường dẫn: “Quản trị KPI” → “Tổng hợp kết quả BSC” → tab “Tổng hợp kết quả BSC”.

| STT | Chức năng | Đặc tả |
|---|---|---|
| 45.1 | Xem chi tiết – Xuất biểu giao KPI | Nút “Xem” trên dòng → hiển thị lựa chọn “Xem theo đơn vị” / “Xem theo KPI” → chọn “Xem theo đơn vị” → hiển thị kết quả đánh giá các KPI của đơn vị → nút “Xuất biểu giao KPI” → xuất dữ liệu giao KPI ra Excel **theo mẫu** (BIEU_GIAO_KPI) và tải về |
| 45.2 | Xem chi tiết – Xuất biểu kết quả KPI | Như 45.1 → nút “Xuất biểu kết quả KPI” → Excel theo mẫu (BIEU_KET_QUA_KPI) |

---

## VIII. TỔNG HỢP KẾT QUẢ BSC — “Quản trị KPI” → “Tổng hợp kết quả BSC” (STT 46 → 54)

Có hai tab: “Tổng hợp kết quả BSC” và “Theo dõi kết quả thẩm định và phản hồi”.

Thanh công cụ (có ở cả hai tab, theo quyền):
- “Tính lại điểm đánh giá” (chỉ tab 1).
- “Chốt đánh giá KPI”.
- “Tổng giám đốc duyệt”.
- Ô “Chọn loại báo cáo”: “Báo cáo TTr94 tổng hợp BSC”, “Báo cáo TTr94 chi tiết KPI”, “Báo cáo KPI từng tỉnh”.

### Tab “Tổng hợp kết quả BSC”

| STT | Chức năng | Đặc tả |
|---|---|---|
| 46.1 | Lấy danh sách – Tổng hợp kết quả BSC | Lưới: “STT”, “Mã – Tên đơn vị”, “Mã – Tên tiêu chí KPI”, “Viễn cảnh”, “Trọng số”, “Mục tiêu giao”, “Kết quả”, “Điểm”, “Tình trạng”, “Thao tác” (“Xem”, “Thu hồi kết quả đánh giá”) |
| 46.2 | Tìm kiếm – Tổng hợp kết quả BSC | Mã hoặc tên đơn vị, mã hoặc tên tiêu chí; lọc “Năm”, “Kỳ đánh giá”, “Viễn cảnh”, “Trạng thái”, “Loại dữ liệu” (API/Nhập tay/Kết hợp) |
| 46.3 | Xem chi tiết – Tổng hợp kết quả BSC | “Xem” → lựa chọn “Xem theo đơn vị” / “Xem theo KPI” → hiển thị kết quả đánh giá các KPI theo đơn vị **hoặc** theo danh sách KPI (cho tất cả đơn vị) |
| 46.4 | Thu hồi kết quả đánh giá | Xem chi tiết bên dưới |
| 46.5 | Tính lại điểm đánh giá | Nút “Tính lại điểm đánh giá” → dialog “Tính lại điểm KPI”, chọn “Năm”, “Kỳ đánh giá” → “Xác nhận” → **tính lại điểm KPI cho tất cả đơn vị** trong kỳ (engine + `bsc_unit_summary` + xếp hạng), cập nhật cột “Điểm”, thông báo thành công. Kỳ đã TGĐ duyệt → chặn |
| 48.1 | Chốt đánh giá KPI – Đủ điều kiện | Xem chi tiết bên dưới |
| 48.2 | Chốt đánh giá KPI – Cảnh báo không đủ điều kiện | Xem chi tiết bên dưới |
| 50.1 | Tổng giám đốc duyệt – Cảnh báo không đủ điều kiện | Xem chi tiết bên dưới |
| 50.2 | Tổng giám đốc duyệt – Ký duyệt | Xem chi tiết bên dưới |
| 51.1 | Xuất báo cáo TTr94 tổng hợp BSC | Chọn “Báo cáo TTr94 tổng hợp BSC” tại ô “Chọn loại báo cáo” → dialog “Xuất báo cáo TTr94 tổng hợp BSC”: “Phạm vi đơn vị”*, “Năm”*, “Kỳ đánh giá”* → “Xác nhận” → tổng hợp dữ liệu, xuất **theo mẫu tương ứng** ra file và tải về |
| 52.1 | Xuất báo cáo TTr94 chi tiết KPI | Như 51.1 với “Báo cáo TTr94 chi tiết KPI” |
| 53.1 | Xuất báo cáo KPI từng tỉnh | Như 51.1 với “Báo cáo KPI từng tỉnh” (mỗi tỉnh một sheet hoặc một khối) |

**Chi tiết 46.4 – Thu hồi kết quả đánh giá:**
1. Nút “Thu hồi kết quả đánh giá” trên một bản ghi đã có kết quả → dialog “Thu hồi kết quả đánh giá” với câu hỏi xác nhận thu hồi kết quả của tiêu chí KPI trong kỳ đã chọn.
2. “Xác nhận” → **thu hồi kết quả của tất cả đơn vị đủ điều kiện** cho tiêu chí trong kỳ: các dòng có kết quả và chưa “TGĐ đã ký duyệt”; kỳ đã TGĐ duyệt thì chặn.
3. Chuyển tình trạng về **“BCL yêu cầu làm lại”** (ở cả `evaluation_kpi` và `evaluation_result`), mở lại quyền đánh giá, thông báo thành công.

**Chi tiết 48.1 / 48.2 – Chốt đánh giá KPI (tab “Tổng hợp kết quả BSC”):**
1. Nút “Chốt đánh giá KPI” → dialog “Chốt đánh giá KPI”: chọn “Năm”, “Kỳ đánh giá”, kèm câu hỏi xác nhận.
2. “Xác nhận” → kiểm tra điều kiện.
3. Một đơn vị **đủ điều kiện** khi:
   - Mọi `evaluation_result` của đơn vị trong kỳ có kết quả cuối.
   - Trạng thái ∈ {Đã có kết quả, Đã xử lý điều chỉnh}.
   - Không còn “ĐV đề nghị điều chỉnh” hay “BCL yêu cầu làm lại”, không còn “Chưa có kết quả”.
4. **48.1 – tất cả đơn vị đủ điều kiện:** chốt kết quả đánh giá KPI của kỳ, cập nhật tình trạng các bản ghi sang “Chốt đánh giá KPI”, ghi `period_closing`, tính `bsc_unit_summary`, notify, thông báo thành công.
5. **48.2 – có đơn vị chưa đủ điều kiện:** hiển thị cảnh báo nguyên văn **“Danh sách chưa hoàn thành. Vui lòng hoàn thiện trước khi thực hiện chốt đánh giá KPI”** kèm bảng (“Mã đơn vị”, “Tên đơn vị”), và **không thực hiện chốt**.

**Chi tiết 50.1 / 50.2 – Tổng giám đốc duyệt:**
1. Nút “Tổng giám đốc duyệt” (quyền `BSC:APPROVE`) → hệ thống kiểm tra điều kiện ký duyệt của các đơn vị trong kỳ đánh giá (chọn Năm/Kỳ trong dialog). Đủ điều kiện = mọi đơn vị trong kỳ ở trạng thái “Chốt đánh giá KPI”.
2. **50.1 – chưa đủ:** dialog “Tổng giám đốc duyệt” với thông báo nguyên văn **“Danh sách chưa hoàn thành. Vui lòng hoàn thiện trước khi thực hiện ký duyệt TGĐ”** và danh sách đơn vị chưa đủ điều kiện (“Mã đơn vị”, “Tên đơn vị”); **không cho phép ký duyệt** (nút ký disabled).
3. **50.2 – đủ điều kiện:** dialog “Tổng giám đốc duyệt” hiển thị tóm tắt kỳ (Năm, Kỳ, số đơn vị, Điểm BSC Tập đoàn, top/bottom 5) và nút “Ký duyệt”.
4. Người dùng xác nhận ký duyệt → ghi nhận **Tổng giám đốc đã ký duyệt** kết quả đánh giá KPI của kỳ (`period_closing.approved_by/at`), cập nhật tình trạng “TGĐ đã ký duyệt”, **khóa toàn bộ dữ liệu kỳ**, notify toàn bộ, thông báo thành công.

### Tab “Theo dõi kết quả thẩm định và phản hồi”

| STT | Chức năng | Đặc tả |
|---|---|---|
| 47.1 | Lấy danh sách – Theo dõi kết quả thẩm định và phản hồi | Lưới: “STT”, “Mã – Tên đơn vị”, “Mã – Tên chỉ tiêu KPI”, “Trọng số”, “Mục tiêu giao”, “Kết quả”, “Điểm”, “Trạng thái đánh giá”, “Kỳ đánh giá”, “Thao tác” (“Xem”, “Thu hồi kết quả đánh giá”) |
| 47.2 | Tìm kiếm – Theo dõi kết quả thẩm định và phản hồi | Mã hoặc tên đơn vị, mã hoặc tên chỉ tiêu; lọc “Năm”, “Kỳ đánh giá”, “Trạng thái” |
| 47.3 | Xem chi tiết – Theo dõi kết quả thẩm định và phản hồi | Thông tin kết quả thẩm định KPI của đơn vị (như 40.3) |
| 47.4 | Thu hồi kết quả đánh giá theo đơn vị | “Thu hồi kết quả đánh giá” trên một dòng → dialog “Thu hồi theo đơn vị”, hỏi xác nhận thu hồi kết quả **của đơn vị** cho tiêu chí trong kỳ → “Xác nhận” → thu hồi kết quả của đơn vị đủ điều kiện, chuyển **“BCL yêu cầu làm lại”**, thông báo thành công |
| 48.3 | Chốt đánh giá KPI – Đủ điều kiện (tab này) | Giống 48.1, nút đặt ở tab “Theo dõi kết quả thẩm định và phản hồi”; cập nhật trạng thái đánh giá |
| 48.4 | Chốt đánh giá KPI – Cảnh báo không đủ điều kiện (tab này) | Giống 48.2 |
| 50.3 | Tổng giám đốc duyệt – Cảnh báo không đủ điều kiện (tab này) | Giống 50.1 |
| 50.4 | Tổng giám đốc duyệt – Ký duyệt (tab này) | Giống 50.2 |
| 51.2 | Xuất báo cáo TTr94 tổng hợp BSC (tab này) | Giống 51.1 |
| 52.2 | Xuất báo cáo TTr94 chi tiết KPI (tab này) | Giống 52.1 |
| 53.2 | Xuất báo cáo KPI từng tỉnh (tab này) | Giống 53.1 |

> Mỗi STT ở tab thứ hai phải có **e2e test riêng**, vì E-HSMT chấm riêng từng tab.

**Báo cáo theo mẫu:**
- Engine JXLS. Template xlsx lưu trong `report_template` (MinIO), admin thay template mà không cần build lại.
- Bản đầu tạo template dựng sẵn hợp lý. Mẫu TTr94 chính thức chờ CĐT cung cấp → OPEN-QUESTIONS.

### 54. Yêu cầu về notify

**54.1 Thông báo (notify) trên hệ thống**
1. Người dùng đăng nhập hệ thống.
2. Khi phát sinh sự kiện nghiệp vụ liên quan đến người dùng, hệ thống gửi thông báo và **hiển thị số thông báo chưa đọc trên biểu tượng chuông** (badge; poll `unread-count` 60s hoặc SSE).
3. Nhấn chuông → dropdown danh sách thông báo (mới nhất trước; tiêu đề, nội dung ngắn, thời gian tương đối, chấm chưa đọc; “Đánh dấu tất cả đã đọc”; “Xem tất cả”).
4. Nhấn một thông báo → **chuyển đến chức năng tương ứng** (route + params) và **đánh dấu đã đọc**.

Các sự kiện và người nhận:

| Sự kiện | Người nhận | Kênh |
|---|---|---|
| Giao KPI (chốt giao 31.x) | User thuộc đơn vị được giao có quyền MYKPI:VIEW | Chuông + Email (nếu bật) + Zalo (nếu bật) |
| Đến hạn cập nhật kết quả (job nhắc hạn) | Cán bộ đánh giá các KPI chưa có kết quả trong kỳ | Chuông + Email |
| Đơn vị đề nghị điều chỉnh (21.1) | Cán bộ đánh giá + vai trò QT_TH_THAM_DINH | Chuông + Email |
| Xử lý điều chỉnh (41.1) | Người gửi đề nghị + user đơn vị | Chuông + Email |
| Chốt kết quả (48.x, 49.1) | User đơn vị liên quan | Chuông |
| Tổng giám đốc ký duyệt (50.x) | Toàn bộ user có quyền DASHBOARD | Chuông + Email |
| Điều chỉnh mục tiêu giao (34.2), thu hồi (46.4/47.4) | User đơn vị liên quan | Chuông |

---

## IX. Bảng truy vết (Claude Code tạo `docs/TRACEABILITY.md`)

Liệt kê **mọi** mã STT ở trên theo cột: STT | Tên chức năng | Route FE | Endpoint BE | Mã quyền | Test e2e | Trạng thái (☐/☑).

Danh sách STT phải đầy đủ:
- 1.1, 1.2, 2.1
- 3.1–3.10, 4.1–4.9, 5.1–5.8
- 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.1, 13.1, 14.1, 15.1, 16.1, 16.2
- 17.1–17.8
- 18.1, 19.1, 20.1, 21.1, 22.1
- 23.1–23.7, 24.1, 25.1, 26.1–26.24, 27.1–27.6, 28.1–28.8
- 29.1–29.5, 30.1, 30.2, 31.1, 31.2, 32.1–32.4, 33.1, 33.2, 34.1–34.3, 35.1, 35.2
- 36.1–36.6, 37.1–37.6, 38.1
- 39.1–39.3, 40.1–40.3, 41.1, 42.1, 43.1, 44.1, 44.2, 45.1, 45.2
- 46.1–46.5, 47.1–47.4, 48.1–48.4, 49.1, 50.1–50.4, 51.1, 51.2, 52.1, 52.2, 53.1, 53.2, 54.1

Ngoài ra, Phần 2 (kiến trúc, 7 mục) và Phần 3 (phi chức năng, 11 mục) mỗi mục có một dòng truy vết tới bằng chứng (file/class/cấu hình/tài liệu).

---

# PHẦN D — PHI CHỨC NĂNG, KIỂM THỬ, KẾ HOẠCH, CÂU HỎI MỞ


Tài liệu này bám E-HSMT mục 1.1.3 (điểm a–k). Mỗi điểm phải có bằng chứng trong source hoặc tài liệu, và được ghi vào TRACEABILITY.

## 1. Phi chức năng (Phần 3 E-HSMT)

### a) Hệ quản trị CSDL

**Mô hình**
- CSDL tập trung trên MariaDB 10.11, một schema `kpi_bsc`.
- Ràng buộc FK, UNIQUE và CHECK đầy đủ để đảm bảo toàn vẹn và tránh dư thừa (chuẩn 3NF; riêng bảng summary được phép denormalize).

**Mã hóa**
- Mật khẩu: bcrypt.
- Dữ liệu cá nhân nhạy cảm (số điện thoại, email phụ nếu có): AES-256-GCM qua MyBatis `EncryptedStringTypeHandler`. Khóa lấy từ secret store.
- Kết nối DB dùng TLS ở production.

**Kiểm soát truy cập**
- RBAC chi tiết cho từng người dùng và nhóm người dùng, cộng thêm phạm vi đơn vị.
- Xác thực mạnh: chính sách mật khẩu, khóa tài khoản khi nhập sai nhiều lần, SSO.

**Giám sát**
- `audit_log` ghi mọi thao tác ghi, `login_log` ghi mọi lần đăng nhập.
- Tạo màn hình phụ “Nhật ký hệ thống” (chỉ Admin hệ thống) để tra cứu theo người dùng, thời gian, hành động. Đây là phần bổ sung ngoài E-HSMT.
- Cảnh báo đăng nhập bất thường: nhiều lần sai, hoặc đăng nhập từ IP mới. Ghi log mức WARN.

**Chống injection**
- MyBatis chỉ dùng `#{}`.
- Validate đầu vào.
- Encode đầu ra (React mặc định đã escape; cấm `dangerouslySetInnerHTML`).

**Sao lưu và khôi phục**
- Tự động sao lưu theo lịch đặt sẵn (cron `mariabackup`) **và** cho phép tùy chọn thời điểm: job “Sao lưu logic dữ liệu” trong Lịch đồng bộ có nút “Chạy ngay”.
- Tần suất tối thiểu 1 lần/tháng; triển khai mặc định hằng ngày.
- Khôi phục ≤ 01 giờ. Runbook nằm ở `docs/VAN-HANH.md`, đã đo thời gian thật.

**Bảo vệ mạng tới CSDL**
- DB chỉ lắng nghe trên mạng nội bộ.
- Firewall (ufw) chỉ mở 3306 cho APP_01/APP_02.
- Quản trị từ xa qua VPN.

**Quản lý phiên**
- Access token 15 phút, refresh token 8 giờ; idle timeout 30 phút (cấu hình được).
- Cho phép thu hồi phiên.

**Hiệu suất dữ liệu**
- Kiểm thử với dữ liệu giả lập 15.000 tài khoản người dùng và khối dữ liệu lớn (cỡ hàng trăm GB tính theo bản ghi kết quả/lịch sử của nhiều năm).
- Script sinh dữ liệu: `deploy/scripts/seed-volume`.

**Tuân thủ**
- Luật Công nghệ thông tin, Luật An ninh mạng, quy định về bảo vệ dữ liệu cá nhân (Nghị định 13 nêu trong E-HSMT và các văn bản thay thế hiện hành), quy định sao lưu, kết nối và chia sẻ dữ liệu.
- Tài liệu hóa trong `docs/ATTT.md`.

### b) Tích hợp hệ thống

- Song song hai hình thức đăng nhập: tài khoản nội bộ và CAS/SSO.
- HRM: adapter tổ chức đơn vị và nhân sự.
- Hệ thống nội bộ khác (sản lượng, doanh thu, chi phí): qua định nghĩa KPI công thức với API cấu hình được.

### c) Hiệu năng

**Chỉ tiêu cần đạt**
- 500 người dùng; 100 TPS.
- Giao dịch nội bộ < 5 giây; giao dịch có gọi hệ thống ngoài < 10 giây.
- Hiển thị thông tin < 5 giây.

**Biện pháp**
- Mọi danh sách phân trang ở server.
- Index theo PHẦN B §4.
- `bsc_unit_summary` tính sẵn cho dashboard.
- Cache Caffeine cho danh mục và quyền.
- HikariCP pool 30/node.
- Xuất file lớn (> 20.000 dòng) chạy async, có thông báo khi xong.
- HTTP client ra ngoài: timeout 10s.
- Gzip/Brotli ở Nginx; code-splitting route (lazy).

**Kiểm chứng**
- Script k6 `perf/k6-mix.js`: 100 TPS trong 10 phút, mix 70% đọc (dashboard, danh sách) và 30% ghi.
- Ngưỡng: p95 < 2s, lỗi < 0,1%.
- Lưu kết quả vào `docs/perf-report.md`.

### d) An toàn thông tin

- Đủ các cơ chế: xác thực, phân quyền, quản lý phiên, lưu trữ dữ liệu, mã hóa mật khẩu.
- Ghi vết các chức năng cập nhật dữ liệu (`audit_log`).
- Đảm bảo tính liên tục (2 node), toàn vẹn dữ liệu (transaction, optimistic lock, checksum file `sha256`).
- Code theo OWASP Guide, SANS CWE Top 25, CERT Secure Coding.
- CI quét:
  - SpotBugs + FindSecBugs, OWASP Dependency-Check (fail nếu CVSS ≥ 7).
  - `npm audit --audit-level=high`.
  - Semgrep (`p/owasp-top-ten`).
  - ZAP baseline chạy trên môi trường staging.
- Pentest do đơn vị bên ngoài có giấy phép thực hiện. Repo phải sẵn sàng: môi trường staging, tài khoản test các vai trò, tài liệu API.
- Sau pentest: theo dõi lỗ hổng trong `docs/ATTT.md`, xử lý đầy đủ mọi lỗ hổng nghiêm trọng/cao.

### e) Tùy chỉnh chức năng và cấu hình

- Phân quyền quản trị tập trung và phân tách theo từng đơn vị.
- Tạo nhóm quyền theo đơn vị.
- Cấu hình danh mục, tham số, lịch, phương pháp tính điểm, template báo cáo.
- “Cấu trúc lương” nêu trong E-HSMT nhiều khả năng là chép mẫu. Hiện thực bằng tham số và danh mục cấu hình được, và ghi vào OPEN-QUESTIONS.

### f) Hạ tầng

- Chạy trên 4 VM của chủ đầu tư (PHẦN B §10).
- Phương án bảo mật hệ thống: hardening Ubuntu (CIS cơ bản), ufw, fail2ban cho SSH, chỉ mở 443 ra ngoài.
- Khôi phục toàn bộ hệ thống khi sự cố, theo runbook:
  - Cài lại từ artifact.
  - Restore DB.
  - Mirror MinIO.

### g) Giao diện và trải nghiệm

- Thân thiện, thống nhất (design tokens Tailwind).
- Độ phân giải tối thiểu 1024×768, màu high color.
- Thông báo lỗi rõ ràng khi xóa và khi lỗi phát sinh. Cảnh báo khi nhập sai hoặc thiếu. Thông báo thành công/không thành công kèm lý do sau mỗi thao tác cập nhật.
- Tiếng Việt Unicode TCVN 6909:2001. Font hỗ trợ đầy đủ dấu, ví dụ “Be Vietnam Pro”, fallback system-ui.
- Ngày dd/mm/yyyy.
- API + file đáp ứng liên kết với hệ thống khác.
- Thông báo, nhắc việc qua Zalo và Email.

### h) Ổn định và i) Khả dụng

- 2 node sau F5; graceful shutdown; readiness/liveness probe.
- Deploy rolling từng node, không gián đoạn.
- Tìm kiếm đa tiêu chí ở mọi danh sách.
- Hiển thị dữ liệu cần thiết dễ nhìn thấy.

### j) Đào tạo và k) Bảo hành

Claude Code tạo bộ tài liệu:
- `docs/HDSD/<phan-he>.md`: hướng dẫn sử dụng từng phân hệ, có ảnh chụp màn hình bằng Playwright.
- `docs/HDQT.md`: hướng dẫn quản trị.
- `docs/VAN-HANH.md`: vận hành, sao lưu/khôi phục, xử lý sự cố.
- `docs/TRIEN-KHAI.md`: cài đặt trên Ubuntu.

Ngoài ra:
- Endpoint `/api/actuator/info` trả version và build time để hỗ trợ bảo hành.
- Log JSON có `traceId` để hỗ trợ từ xa.

---

## 2. Dữ liệu seed (profile dev + demo)

- **Đơn vị:**
  - “1. Công ty mẹ – Tập đoàn”.
  - ~6 Tổng công ty/Công ty.
  - Khối VNPT tỉnh/thành phố gồm các VNPT tỉnh/thành theo địa giới hành chính hiện hành.
  - Mỗi đơn vị có 2–3 phòng ban.
- **Người dùng:** mỗi vai trò seed một tài khoản test (`admin`, `tgd`, `lanhdao`, `giaokpi`, `danhgia`, `tinh_hni`, …). Mật khẩu dev in trong `README`, prod phải đổi.
- **Danh mục:**
  - 4 viễn cảnh, ~16 mục tiêu trọng tâm, ~60 KPI (có KPI cha–con).
  - ~15 định nghĩa công thức (một nửa nguồn API dùng mock).
  - 3 phương pháp tính điểm, 2 giai đoạn.
- **Giao KPI:** năm hiện tại và năm trước, đã giao; kết quả các quý đã qua; đủ mọi trạng thái để demo dashboard và luồng chốt/duyệt.
- **Chiến lược:** 1 chiến lược Tập đoàn có bản đồ đầy đủ, 1 chiến lược tỉnh.

---

## 3. Kiểm thử

| Loại | Công cụ | Phạm vi tối thiểu |
|---|---|---|
| Unit BE | JUnit 5 | Engine tính toán (≥ 40 ca), state machine đánh giá/giao, sinh mã KPI, validator import |
| Integration BE | Spring Boot Test + Testcontainers (MariaDB, MinIO) | Mọi controller: quyền 401/403, phạm vi đơn vị, happy path, lỗi validate |
| Unit FE | Vitest + Testing Library | DataGrid, ImportDialog, form KPI, bản đồ chiến lược (thêm node/edge/xóa) |
| E2E | Playwright | **Một test cho mỗi STT** (tên test bắt đầu bằng mã STT), chạy với dữ liệu seed |
| Tải | k6 | 100 TPS, kiểm 500 user đồng thời |
| Bảo mật | ZAP baseline, Dependency-Check, Semgrep | Không còn lỗi High trước bàn giao |

Ngoài ra, sinh báo cáo kiểm thử `docs/BAO-CAO-KIEM-THU.md`. Báo cáo map STT → kết quả và có ảnh chụp màn hình, dùng làm hồ sơ nghiệm thu.

---

## 4. CI/CD (GitHub Actions hoặc GitLab CI)

Pipeline gồm các bước:
1. `backend`: build, test, SpotBugs, Dependency-Check.
2. `frontend`: lint, typecheck, test, build.
3. `e2e`: chạy docker-compose + Playwright.
4. `package`: tạo jar + bundle `dist/`, ra tarball `kpi-bsc-<version>.tar.gz` kèm script cài đặt.

---

## 5. Triển khai

- `deploy/TRIEN-KHAI.md` hướng dẫn từng bước trên Ubuntu 20.04:
  - Cài JDK 21 (Temurin tarball), Nginx, MariaDB 10.11 (repo chính thức), MinIO.
  - Tạo user DB, chạy Flyway, cấu hình replication.
  - Cấu hình systemd và Nginx.
  - Cấu hình F5 health check.
  - Sao lưu.
- Biến môi trường mẫu: `deploy/env.example`. Không commit secret thật.

---

## 6. Kế hoạch build theo phase

> Mỗi phase kết thúc khi: test xanh, TRACEABILITY cập nhật, demo được bằng dữ liệu seed.

| Phase | Nội dung | STT phủ |
|---|---|---|
| **P0 – Nền tảng** | Scaffold BE/FE, docker-compose dev, Flyway V001, response envelope, exception handler, audit, `SecurityConfig` + `JwtAuthenticationFilter` + login nội bộ + refresh + logout, `/auth/me` + menu động, `AppLayout`/`Header`/`Sidebar`/`Breadcrumb`/`ErrorBoundary`, `authGuards`, Axios `http.ts`, component DataGrid/ImportDialog/ExportButton/ConfirmDialog/TreeSelect, file service MinIO, khung import/export Excel, khung notification (bảng + API + chuông) | 1.1, 1.2, 2.1, 54.1 (khung) |
| **P1 – Quản trị hệ thống** | Người dùng, vai trò, quyền, đơn vị (cây), tham số, lịch đồng bộ (Quartz clustered + reschedule) | 3.x, 4.x, 5.x, 26.17–26.24 |
| **P2 – Danh mục KPI** | Đơn vị đo, viễn cảnh, mục tiêu trọng tâm, phương pháp tính điểm, định nghĩa công thức (test API, validate biểu thức), KPI đơn lẻ và cha–con, sinh mã | 23–28 |
| **P3 – Giao KPI** | Theo đơn vị/theo chỉ tiêu, sao chép, chốt (sinh evaluation), điều chỉnh nháp/chốt, lịch sử, import/export | 29–35 |
| **P4 – Đánh giá** | Engine tính toán + unit test, `KpiSourceClient` + mock, đồng bộ lại, nhập tay lưới và file, đề nghị điều chỉnh, xử lý điều chỉnh, chốt R2, KPI đơn vị của tôi | 18–22, 39–44 |
| **P5 – Tổng hợp BSC** | Summary + xếp hạng, thu hồi (KPI/đơn vị), tính lại điểm, chốt kỳ (đủ/không đủ), TGĐ duyệt (đủ/không đủ), template JXLS, các báo cáo, notify đầy đủ sự kiện + email + Zalo adapter | 45–54 |
| **P6 – Chiến lược** | Danh sách/CRUD, màn hình “Cập nhật chiến lược” XYFlow (swimlane, node, handle, edge, xóa, dagre), gán khung KPI, xem KPI trên node, xuất ảnh, job hoàn tất chiến lược | 36–38 |
| **P7 – Dashboard** | Mọi chế độ A/B/C/D, thẻ, gauge, chỉ đạo trọng tâm, xếp hạng, tổng công ty, popup 17.3–17.8, xuất, điều hướng SiteMap, bản đồ readonly | 6–17 |
| **P8 – Tích hợp & cứng hóa** | CAS SSO thật + mock, HRM adapter stub, hardening bảo mật (CSRF, headers, rate limit, lockout, file scan hook, secret check), tối ưu hiệu năng + k6, CI quét bảo mật | Phần 2, Phần 3 |
| **P9 – Bàn giao** | E2E đủ mọi STT, báo cáo kiểm thử, HDSD/HDQT/Vận hành/Triển khai, gói cài đặt, seed demo | Toàn bộ |

---

## 7. OPEN-QUESTIONS (Claude Code khởi tạo `docs/OPEN-QUESTIONS.md` với các mục sau)

1. **Mẫu báo cáo:** mẫu “Báo cáo TTr94 tổng hợp BSC”, “TTr94 chi tiết KPI”, “Báo cáo KPI từng tỉnh”, “Biểu giao KPI”, “Biểu kết quả KPI”, mẫu export KPI đơn vị. Cần file mẫu chính thức.
2. **Thuật ngữ:** “KQ R2” và “BCL” nghĩa là gì; vòng R1/R2 có quy trình riêng không.
3. **Tính điểm:** bảng khung điểm thang 5 chính thức; quy tắc điểm BSC đơn vị; xử lý KPI cha–con; KPI nghịch.
4. **Ngưỡng:** ngưỡng “KPI cảnh báo”; cách tính lũy kế giai đoạn; “ĐC kỳ trước”.
5. **Hạn cập nhật:** hạn cập nhật kết quả từng kỳ (dùng cho nhắc hạn).
6. **Tích hợp:** URL/phiên bản CAS, thuộc tính trả về; đặc tả API nguồn KPI; API HRM; tài khoản Zalo OA/ZNS; SMTP.
7. **Hạ tầng:** vị trí đặt MinIO (VM nào); chính sách sao lưu off-site; Ubuntu 20.04 đã hết hỗ trợ tiêu chuẩn, có nâng lên 22.04/24.04 không.
8. **Nội dung chép mẫu:** E-HSMT nêu “600.000 tài sản” và “cấu hình cấu trúc lương”, có vẻ chép từ hồ sơ khác. Xác nhận phạm vi.
9. **Quy định ATTT nội bộ VNPT** cần đáp ứng trước khi vận hành chính thức.
10. **Ký duyệt TGĐ:** có cần chữ ký số không, hay chỉ phê duyệt trên hệ thống.

---

**Bắt đầu ngay từ Bước 0.**
