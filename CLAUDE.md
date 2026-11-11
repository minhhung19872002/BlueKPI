# CLAUDE.md — Quy tắc dự án KPI-BSC (VNPT-IT)

> Repo gốc = thư mục này (tương đương `kpi-bsc/` trong đặc tả). Đặc tả đầy đủ: `docs/SPEC.md`. Truy vết: `docs/TRACEABILITY.md`.

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
