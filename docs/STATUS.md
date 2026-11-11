# Trạng thái thực hiện (handoff) — cập nhật 12/11/2026

Thực hiện theo `PROMPT-KPI-BSC.md` / `docs/SPEC.md`, phase P0 → P9 **đã hoàn tất**, kèm kiểm tra chéo PHẦN C. Bảng truy vết: `docs/TRACEABILITY.md` (sinh bằng `node scripts/gen-traceability.mjs`) — **173/173 STT ☑**, 7/7 mục kiến trúc, 11/11 mục phi chức năng.

## Kết quả kiểm thử (lần chạy cuối)

| Bộ | Kết quả |
|---|---|
| `./mvnw verify` | 87 unit (engine 54 ca, bảo mật, SSRF, log mask) + 25 integration (Testcontainers MariaDB + MinIO) — **xanh** |
| `npm run lint && npm run test` | lint sạch, typecheck sạch, Vitest 15/15 |
| `npm run e2e` (DB reset) | **187/187** trên mã cuối cùng (12/11/2026, chạy theo 7 nhóm spec — mỗi nhóm reset CSDL về seed — vì máy dev thiếu RAM khi chạy liền 188 test; 1 spec HDSD bỏ qua khi không có `DOCS=1`) — mọi STT có ≥ 1 e2e |
| k6 | 100 TPS × 10 phút p95 < 100 ms, lỗi 0,0075 %; 500 user đồng thời 0 lỗi — `docs/perf-report.md` |
| Bảo mật | ZAP FAIL 0, Semgrep 0 ERROR, OSV đã vá (2 CVE Spring không ảnh hưởng), npm audit 0 high — `docs/ATTT.md` §11.1 |

Báo cáo nghiệm thu: `docs/BAO-CAO-KIEM-THU.md` (`node scripts/gen-test-report.mjs` sau khi chạy e2e + verify).

## Phase

| Phase | Trạng thái | Commit |
|---|---|---|
| P0–P2 | xong | `fa20b7f`, `eaca9a1`, `595b52a` |
| P3–P6 | xong (WIP `24c4924` + sửa e2e chạy cả bộ) | `24c4924`, `c6c1be0` |
| P7 Dashboard | xong — e2e 6.1–17.8, SiteMap, phân quyền, API < 1 s; sửa click cột biểu đồ (ECharts 6) | `c6c1be0` |
| P8 Tích hợp & cứng hóa | xong — CAS e2e (mock), SSRF, mật khẩu admin prod, log mask, ClamAV fail-closed, TTL cấu hình, job dọn tệp, readiness DB; k6; ZAP/Semgrep/OSV; vá thư viện; deadlock pool đăng nhập | `d5f8aa9`, `6b32158` |
| Kiểm tra chéo PHẦN C | xong — 2 Blocker (3.9 gán vai trò, 46.4/47.4 thu hồi sau chốt) + 4 Minor đã sửa | `572a95d` |
| P9 Bàn giao | xong — HDSD 9 phân hệ (30 ảnh), HDQT, VAN-HANH (RTO đo lần 1), TRIEN-KHAI, ATTT, KIEN-TRUC, BÁO CÁO KIỂM THỬ, gói `kpi-bsc-<version>.tar.gz` | commit P9 |

## Việc còn lại / rủi ro (cần Chủ đầu tư hoặc môi trường thật)

1. **Đo lại trên staging thật** (đã diễn tập tại dev): sao lưu/khôi phục bằng `backup.sh`/`restore.sh` với 685 MB — logical 323 s, physical 23 s, khớp 100 % (`docs/VAN-HANH.md` §8.1 lần 2–3); `seed-volume` 2 triệu audit — dashboard < 150 ms, k6 100 TPS đạt (`docs/perf-report.md` §5b). Còn: đo trên phần cứng DB_01/DB_02 + 2 node sau F5 (§8.1 lần 4).
2. **Pentest bên ngoài** (PHẦN D §1.d) và chạy pipeline CI thật (Dependency-Check cần `NVD_API_KEY`; ZAP cần `STAGING_URL`).
3. **Cấu hình theo hạ tầng thật**: dải IP F5 trong `set_real_ip_from` (`deploy/nginx/kpi.conf`), `KPI_SOURCE_ALLOWED_HOSTS`, CAS URL/thuộc tính, SMTP, Zalo OA (OPEN-QUESTIONS #6).
4. Spring Framework 6.2.19 còn 2 CVE chỉ vá ở 7.x (không ảnh hưởng — suppression hết hạn 31/03/2027): rà soát khi có bản 6.2.x vá hoặc khi E-HSMT cho phép Spring Boot 4.
5. Các câu hỏi mở `docs/OPEN-QUESTIONS.md` (mẫu báo cáo chính thức, khung điểm, thuật ngữ R2/BCL, ký số TGĐ…).

## Ghi chú môi trường dev
- Hạ tầng: `docker compose -f deploy/docker-compose.dev.yml up -d` (MariaDB 3307, MinIO 9100/9101, Mailpit 1026/8026, mock CAS 8091, mock nguồn KPI 8092). Mật khẩu tài khoản seed dev: `Kpi@2026` (chỉ seed-dev; production không có mật khẩu mặc định — xem `docs/HDQT.md` §2).
- JDK 21 bắt buộc (`JAVA_HOME`); e2e mặc định BE 8089, FE 4174, DB `kpi_bsc_e2e` (cô lập bằng `E2E_DB/E2E_BE_PORT/E2E_FE_PORT/E2E_DIST/E2E_JAR`). CAS e2e cần mock CAS 8091.
- HDSD: `cd frontend && DOCS=1 E2E_REUSE=1 E2E_FE_PORT=<fe> E2E_BE_PORT=<be> npx playwright test e2e/hdsd-screens.spec.ts` → `node scripts/gen-hdsd.mjs`.
