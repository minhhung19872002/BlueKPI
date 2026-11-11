## 2. Kiến trúc (Phần 2 E-HSMT — 7 mục, PHẦN B)

| Mục | Nội dung | Bằng chứng | Trạng thái |
|---|---|---|---|
| A1 | Tổng quan giải pháp (§1) | `docs/KIEN-TRUC.md` §1; vai trò seed `R__seed_01_identity.sql` | ☐ |
| A2 (b) | Kiến trúc tổng thể (§2) | `docs/KIEN-TRUC.md` §2; `deploy/nginx/kpi.conf`; `backend/.../config/*` | ☐ |
| A3 (c) | Kiến trúc chức năng F01–F07 (§3.1) | `backend/src/main/java/vn/vnpt/kpi/modules/*` | ☐ |
| A4 (d) | Kiến trúc ứng dụng FE/BE (§3.2–3.3) | `frontend/src/api/http.ts`, `routes/index.tsx`, `authGuards.ts`, `stores/*`; BE `SecurityConfig`, `JwtAuthenticationFilter`, `VnptSsoController` | ☐ |
| A5 (e) | Kiến trúc dữ liệu (§4) | `backend/src/main/resources/db/migration/V001__init.sql` … | ☐ |
| A6 (f) | Kiến trúc tích hợp (§8) | `integration/cas`, `integration/kpisource`, `integration/hrm`, `integration/mail`, `integration/zalo` | ☐ |
| A7 (g,h) | Bảo mật (§9) & hạ tầng (§10) | `config/SecurityConfig`, `StartupSecurityCheck`, `docs/ATTT.md`, `docs/TRIEN-KHAI.md`, `deploy/*` | ☐ |

## 3. Phi chức năng (Phần 3 E-HSMT — 11 mục, PHẦN D §1)

| Mục | Nội dung | Bằng chứng | Trạng thái |
|---|---|---|---|
| NF-a | Hệ quản trị CSDL (mô hình, mã hóa, RBAC, giám sát, injection, sao lưu, phiên, hiệu suất, tuân thủ) | migrations; `EncryptedStringTypeHandler`; `audit_log`; màn hình “Nhật ký hệ thống”; `deploy/scripts/backup-db.sh`; `docs/VAN-HANH.md` | ☐ |
| NF-b | Tích hợp hệ thống | `VnptSsoController`, `HrmClient`, `KpiSourceClient` | ☐ |
| NF-c | Hiệu năng (500 user, 100 TPS) | `perf/k6-mix.js`, `docs/perf-report.md` | ☐ |
| NF-d | An toàn thông tin | SpotBugs/FindSecBugs, Dependency-Check, `npm audit`, Semgrep, ZAP; `docs/ATTT.md` | ☐ |
| NF-e | Tùy chỉnh chức năng & cấu hình | Vai trò theo đơn vị, `sys_config`, `sync_schedule`, `scoring_method`, `report_template` | ☐ |
| NF-f | Hạ tầng | `docs/TRIEN-KHAI.md`, `deploy/systemd`, `deploy/nginx`, hardening | ☐ |
| NF-g | Giao diện & trải nghiệm | Tailwind tokens, font Be Vietnam Pro, 1024×768 e2e, toast/validate | ☐ |
| NF-h | Ổn định | 2 node, graceful shutdown, readiness/liveness | ☐ |
| NF-i | Khả dụng | Tìm kiếm đa tiêu chí mọi danh sách | ☐ |
| NF-j | Đào tạo | `docs/HDSD/*.md`, `docs/HDQT.md` | ☐ |
| NF-k | Bảo hành | `/api/actuator/info`, log JSON `traceId`, `docs/VAN-HANH.md` | ☐ |
