# DECISIONS — Quyết định kỹ thuật & phiên bản thư viện

> Phiên bản được chốt ngày 11/11/2026, tra trực tiếp từ Maven Central / npm registry. Nguyên tắc: bám đúng stack E-HSMT chỉ định (CLAUDE.md §2); trong mỗi dòng major bắt buộc, chọn bản patch ổn định mới nhất.

## 1. Backend (Maven, `backend/pom.xml`)

| Thư viện | Phiên bản | Lý do |
|---|---|---|
| JDK | Temurin 21.0.13+9 | Java 21 LTS theo E-HSMT; Temurin tarball chạy được trên Ubuntu 20.04 |
| Maven | 3.9.11 (qua `mvnw`) | Wrapper cố định phiên bản build |
| Spring Boot | 3.5.16 | E-HSMT yêu cầu 3.5.x — bản patch mới nhất của dòng 3.5 (không lên 4.x). P8: ghi đè bản vá thư viện do Boot quản lý — `tomcat.version` 10.1.61, `jackson-bom.version` 2.21.8, `mariadb.version` 3.5.11, `log4j2.version` 2.25.5, `commons-lang3.version` 3.21.0; `dependencyManagement` ép Guava 33.8.0-jre, Bouncy Castle 1.87, snappy-java 1.1.10.12, commons-beanutils 1.11.0 (xem `docs/ATTT.md` §11.1) |
| mybatis-spring-boot-starter | 3.0.5 | Dòng 3.0.x tương thích Spring Boot 3 (4.x dành cho Boot 4) |
| mariadb-java-client | 3.5.x (Boot BOM quản lý) | Driver chính thức MariaDB 10.11 |
| Flyway (core + flyway-mysql) | Boot BOM quản lý (11.x) | Migration; module `flyway-mysql` hỗ trợ MariaDB |
| jjwt-api/impl/jackson | 0.12.7 | E-HSMT yêu cầu jjwt 0.12 |
| MinIO Java SDK | 8.6.0 | E-HSMT yêu cầu SDK 8.x. P8 nâng từ 8.5.17 vì GHSA-h7rh-xfpj-hpcm (CVSS 8.7, sửa ở 8.6.0). OkHttp 5 phát hành kiểu đa nền tảng (Maven không resolve lớp JVM) → khai báo thêm `com.squareup.okhttp3:okhttp-jvm:5.1.0` và `kotlin.version=2.2.0` |
| Quartz | Boot BOM (spring-boot-starter-quartz) | JDBC JobStore, clustered |
| springdoc-openapi-starter-webmvc-ui | 2.8.x (bản 2.x tương thích Boot 3.5) | E-HSMT yêu cầu Springdoc OpenAPI 2 |
| Apache POI (poi-ooxml) | 5.5.1 | Đọc/ghi Excel |
| JXLS (jxls + jxls-poi) | 2.14.0 | E-HSMT yêu cầu JXLS 2 (xuất theo template) |
| EvalEx | 3.6.x | E-HSMT yêu cầu EvalEx 3 |
| json-path (Jayway) | Boot BOM | Đọc `response_path` của nguồn KPI |
| MapStruct | 1.6.3 | Mapping DTO |
| Lombok | 1.18.x (Boot BOM) | Giảm boilerplate |
| Caffeine | 3.x (Boot BOM) | Cache quyền 60s, danh mục |
| Apache Tika (tika-core) | 3.3.3 | Kiểm tra magic bytes file upload (PHẦN B §9.7) |
| Testcontainers | 1.21.x (Boot BOM) | Integration test MariaDB/MinIO |
| SpotBugs Maven plugin + FindSecBugs | 4.9.x / 1.14.0 | Quét bảo mật tĩnh |
| OWASP dependency-check-maven | 12.2.2 | Quét CVE phụ thuộc, fail CVSS ≥ 7 |

## 2. Frontend (`frontend/package.json`)

| Thư viện | Phiên bản | Lý do |
|---|---|---|
| React / React DOM | 19.x (^19.2) | E-HSMT: React 19 |
| TypeScript | 5.9.3 | E-HSMT: TypeScript 5 strict (không dùng 7.x) |
| Vite | 7.3.x | Ổn định, tương thích @vitejs/plugin-react 5 & Vitest 3 (Vite 8 mới, plugin-react 6 yêu cầu Vite 8 — tránh rủi ro) |
| @vitejs/plugin-react | 5.x | Đi cùng Vite 7 |
| @tanstack/react-router | 1.x | Routing code-based |
| @tanstack/react-query | 5.x | E-HSMT: TanStack Query v5 |
| zustand | 5.x | Client state |
| axios | 1.x | HTTP |
| tailwindcss + @tailwindcss/vite | 4.x | E-HSMT: Tailwind CSS 4 |
| Radix UI primitives (dialog, dropdown-menu, select, checkbox, tabs, popover, switch, radio-group, toast…) | 1.x/2.x | Component tự sở hữu kiểu shadcn/ui |
| echarts + echarts-for-react | 6.x / 3.0.x | Chart/gauge |
| @xyflow/react + @dagrejs/dagre | 12.x / 1.x–3.x | Bản đồ chiến lược |
| i18next + react-i18next | 25+/15+ | i18n vi/en |
| react-hook-form + zod + @hookform/resolvers | 7.x / 4.x / 5.x | Form + validate |
| dayjs | 1.11.x | Ngày dd/MM/yyyy |
| html-to-image | 1.11.13 | Xuất ảnh bản đồ |
| lucide-react | latest | Icon (bổ sung — xem §3) |
| Vitest + @testing-library/react + jsdom | 5.1.0 / 16.x | Unit FE. P8 nâng Vitest 3.2 → 5.1.0 (GHSA-82fw-gwwq-j7x9, tinypool prototype pollution — critical, chỉ công cụ dev); 15/15 test vẫn xanh |
| @playwright/test | 1.5x+ | E2E |
| ESLint 9 + typescript-eslint 8 | 9.39.x / 8.x | Lint |

Phiên bản chính xác đã khóa trong `frontend/package-lock.json`.

## 3. Thư viện bổ sung ngoài stack (kèm lý do)

| Thư viện | Lý do |
|---|---|
| `lucide-react` | Bộ icon SVG cho nút/menu; shadcn/ui dùng mặc định, nhẹ, MIT |
| `clsx` + `tailwind-merge` | Ghép class Tailwind theo quy ước shadcn/ui (`cn()`) |
| `jsdom` | Môi trường DOM cho Vitest |
| Apache Tika (BE) | Bắt buộc theo PHẦN B §9.7 (magic bytes) |
| Jayway json-path (BE) | Bắt buộc để đọc `response_path` (JSONPath) |
| `cron-utils` (BE) — không dùng; tự viết `CronDescriber` tiếng Việt | Tránh thêm phụ thuộc |
| `exceljs` (devDependency FE) | Chỉ dùng trong e2e Playwright để tạo file .xlsx nhập liệu; không đóng gói vào bản build |
| `@fontsource/be-vietnam-pro` | Font “Be Vietnam Pro” đóng gói cục bộ (không phụ thuộc Google Fonts khi chạy mạng nội bộ) |

## 4. Quyết định kiến trúc

1. **Gốc repo**: đặc tả mô tả thư mục `kpi-bsc/`; thực tế repo gốc là thư mục `BlueKPI` (GitHub `minhhung19872002/BlueKPI`). Cấu trúc bên trong giữ nguyên (`backend/`, `frontend/`, `deploy/`, `docs/`).
2. **Context path**: `server.servlet.context-path=/api` → mọi controller khai báo đường dẫn không có tiền tố `/api`; actuator ở `/api/actuator/*`.
3. **Mã hóa PII**: `phone` mã hóa AES-256-GCM qua `EncryptedStringTypeHandler`; `email` giữ plaintext vì cần UNIQUE và map SSO.
4. **audit_log partition theo tháng**: PK = (`id`, `at`), partition RANGE theo `TO_DAYS(at)`; không FK (bảng log).
5. **Trạng thái header giao KPI** được lưu đồng thời (cột `status`) và tính lại từ detail mỗi khi detail đổi, theo quy tắc PHẦN B §4.4.
6. **Engine tính toán** là lớp thuần (`engine/KpiCalculationEngine`) không phụ thuộc Spring; tham số cấu hình (`KPI_PASS_SCORE`, `KPI_COMPLETION_CAP`, bands…) truyền vào qua DTO `EngineConfig`.
7. **Tính lại BSC async**: `@TransactionalEventListener(phase=AFTER_COMMIT)` + `@Async`; nút “Tính lại điểm đánh giá” chạy đồng bộ.
8. **Báo cáo JXLS**: template mặc định tự sinh lúc khởi động (nếu bảng `report_template` chưa có file) bằng POI, lưu MinIO; admin thay file khác qua API.
9. **Dev không có Docker cho chạy app**: backend chạy bằng `mvnw` trên máy, hạ tầng (MariaDB/MinIO/Mailpit/mock CAS/mock KPI source) chạy bằng `deploy/docker-compose.dev.yml`.
10. **Kỳ đánh giá**: mã kỳ `Q1, Q2, H1, Q3, Q4, Y`; giai đoạn trên dashboard dùng tham số `period=GD:<id>` (id bảng `evaluation_stage`).
