# Trạng thái thực hiện (handoff) — cập nhật 11/11/2026

Thực hiện theo `PROMPT-KPI-BSC.md` / `docs/SPEC.md`, các phase P0 → P9. Bảng truy vết: `docs/TRACEABILITY.md` (sinh bằng `node scripts/gen-traceability.mjs`; ☑ chỉ khi STT đã được ghi vào `docs/traceability-done.txt` sau khi e2e xanh).

## Đã xong (đã commit trước: P0, P1, P2)
- P0 Nền tảng, P1 Quản trị hệ thống, P2 Danh mục KPI — e2e xanh, đã tick.

## Đã code, đã test một phần (commit này — gom P3 → P7 WIP)
| Phase | Backend | Frontend | Kiểm thử |
|---|---|---|---|
| P3 Giao KPI (29–35) | xong; sửa tìm theo mã KPI con / KPI con giao riêng (`AssignmentMapper.xml` kWhere) | xong | `AssignmentIT` xanh; e2e `p3-assign` 21/21 xanh (54.1 đã chỉnh cho thứ tự thông báo) |
| P4 Đánh giá + KPI của tôi (18–22, 39–44, 49.1) | xong; sửa NPE `manualTemplate`/`manual-import` (`EvaluationService`) | xong | e2e `p4-eval` 17/17 xanh (trên jar trước khi sửa NPE; test 44.2 đang dùng Q3 để né lỗi cũ — có thể chuyển lại Q4) |
| P5 Tổng hợp BSC (45–54) | xong (`BscService`, `BscSummaryService`, `ReportService` JXLS, job nhắc hạn / tính lại BSC) | xong (`features/bsc`) | `BscIT` xanh; e2e `p5-bsc` chưa chạy trọn — các lỗi đã sửa: race khi lọc (46.3/45.x), template JXLS nhóm “Báo cáo KPI từng tỉnh” (comment jx:each sai cột → đã sửa), timeout tính lại |
| P6 Chiến lược (36–38) | xong (`modules/strategy`, job `HOAN_TAT_CHIEN_LUOC`, seed `DemoStrategyStep`) | xong (`features/strategy`, XYFlow + Dagre + html-to-image) | `StrategyIT` xanh; Vitest bản đồ xanh; e2e `p6-strategy`: 36.1–36.4 xanh, 37.1 sửa checkbox disabled (DataGrid), 37.2 sửa cuộn canvas — cần chạy lại |
| P7 Dashboard (6–17) | xong (`modules/dashboard`, `/api/dashboard/*`) | **dở dang** — agent dừng giữa chừng: `features/dashboard/{api,types}.ts`, `components/{Blocks,Charts,Dialogs}.tsx`, `pages/DashboardPage.tsx` (tsc + lint sạch, chưa kiểm thử) | `DashboardIT` xanh; chưa có `e2e/p7-dashboard.spec.ts` |
| P8 (một phần) | `AdminBootstrap` (KPI_BOOTSTRAP_ADMIN_PASSWORD), `StartupSecurityCheck` chặn mật khẩu mặc định | — | — |
| P8/P9 hạ tầng | `deploy/nginx/*`, `deploy/systemd/kpi-bsc.service`, `deploy/env.example`, `deploy/scripts/{backup,restore,minio-mirror,install,package,seed-volume}.sh`, `perf/k6-mix.js`, `.github/workflows/ci.yml`, `.zap/rules.tsv` | | chưa chạy thử |

## Việc còn lại (theo thứ tự đề xuất)
1. Rebuild jar (`cd backend && ./mvnw -B package -DskipTests`), chạy lại e2e `p5-bsc`, `p6-strategy` → sửa đến xanh; chạy lại `p4-eval` (sau sửa NPE).
2. Hoàn thiện P7 frontend + viết `e2e/p7-dashboard.spec.ts` (mỗi STT 6.1…17.8 + SiteMap + phân quyền tinh_hni).
3. Chạy toàn bộ: `./mvnw verify`, `npm run lint && npm run test && npm run e2e`; ghi STT vào `docs/traceability-done.txt`, chạy `gen-traceability`.
4. P8: CAS e2e với mock (`deploy/mocks/mock-cas.mjs`), chạy k6 (docker `grafana/k6`, đặt `KPI_LOGIN_RATE_LIMIT` cao khi đo) → `docs/perf-report.md`; tối ưu “Tính lại điểm đánh giá” (~7s/696 kết quả); Semgrep/ZAP/Dependency-Check qua docker; bảo trì partition `audit_log` (sau 2027-06 rơi vào `pmax`).
5. P9: `docs/HDSD/*.md` (ảnh Playwright), `HDQT.md`, `VAN-HANH.md` (đo RTO restore thật), `TRIEN-KHAI.md`, `ATTT.md`, `KIEN-TRUC.md`, `BAO-CAO-KIEM-THU.md`; test `deploy/scripts/package.sh`; đối chiếu PHẦN C → báo cáo cuối.
6. Cập nhật `docs/DECISIONS.md` / `docs/OPEN-QUESTIONS.md`: giả định dashboard (gộp khối tỉnh = trung bình; giai đoạn = lũy kế “Cả năm”), demo để Q2/H1 năm hiện tại chưa chốt và “Cả năm” năm trước chưa TGĐ duyệt (phục vụ e2e 48.x/50.x), số liệu demo cấp Tập đoàn (% TH/KH rất lớn do KH của công ty mẹ ≠ tổng đơn vị con).

## Ghi chú môi trường dev
- Hạ tầng: `docker compose -f deploy/docker-compose.dev.yml up -d` (MariaDB 3307, MinIO 9100/9101, Mailpit 1026/8026, mock CAS 8091, mock nguồn KPI 8092). Mật khẩu tài khoản seed: `Kpi@2026`.
- e2e mặc định: BE 8089, FE 4174, DB `kpi_bsc_e2e`; có thể cô lập bằng `E2E_DB/E2E_BE_PORT/E2E_FE_PORT/E2E_DIST/E2E_JAR`. Không tắt java theo tên image (cổng 8080/9000/1025/8025 thuộc dự án khác).
