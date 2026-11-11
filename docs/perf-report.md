# BÁO CÁO KIỂM THỬ HIỆU NĂNG (k6)

> Kịch bản: [`perf/k6-mix.js`](../perf/k6-mix.js). Kết quả thô: `perf/k6-summary.json` (100 TPS), `perf/k6-summary-500users.json` (500 người dùng đồng thời). Đo ngày 11/11/2026.

## 1. Chỉ tiêu (PHẦN D §1.c, E-HSMT Phần 3)

| Chỉ tiêu | Yêu cầu | Kết quả | Đánh giá |
|---|---|---|---|
| Thông lượng | 100 TPS trong 10 phút | **105,6 req/s** (66.467 request / 10 phút) | Đạt |
| Người dùng đồng thời | 500 | **500 VU** liên tục 5 phút, 103 req/s | Đạt |
| Thời gian phản hồi p95 (giao dịch nội bộ) | < 2 s (E-HSMT: < 5 s) | đọc **68 ms**, ghi **56 ms**, đăng nhập **415 ms** | Đạt |
| Tỷ lệ lỗi | < 0,1 % | **0,0075 %** (5/66.467 — lỗi kết nối mạng Docker, không có lỗi HTTP 5xx từ ứng dụng) | Đạt |
| API dashboard | < 1 s trên dữ liệu seed | overview/ranking/corporations/kpi-list p95 < 100 ms (k6); e2e `P7 hiệu năng` < 1 s | Đạt |

## 2. Kịch bản tải

- **Chế độ 100 TPS** (`constant-arrival-rate`, 100 lượt/s, 10 phút):
  - 70 % đọc: dashboard (tổng quan, xếp hạng tỉnh, TCT/CT, danh sách KPI), danh mục KPI, giao KPI, đánh giá KPI, tổng hợp BSC, chiến lược, đếm thông báo. Mỗi người dùng chỉ gọi chức năng mà vai trò của mình được phép (quyền lấy từ `/auth/me`).
  - 30 % ghi: “Đánh dấu tất cả đã đọc” thông báo; tạo + xóa đơn vị đo (CRUD danh mục có kiểm tra nghiệp vụ và ghi `audit_log`).
  - Song song kịch bản **đăng nhập** 2 lượt/s (người dùng mới vào hệ thống).
  - Phiên đăng nhập tạo sẵn ở `setup()` cho 7 tài khoản vai trò khác nhau (admin, lanhdao, tgd, qtgiao, qtthamdinh, danhgia, giaokpi).
- **Chế độ 500 người dùng** (`MODE=users`, `constant-vus` 500, 5 phút): mỗi người dùng thao tác như trên rồi nghỉ 3–7 giây.

Chạy lại:

```bash
docker run --rm -e BASE=http://<host>:8089/api -v "$PWD/perf:/perf" grafana/k6:0.54.0 run --summary-export=/perf/k6-summary.json /perf/k6-mix.js
docker run --rm -e BASE=http://<host>:8089/api -e MODE=users -e DURATION=5m -v "$PWD/perf:/perf" grafana/k6:0.54.0 run /perf/k6-mix.js
```

Khi đo, đặt `KPI_LOGIN_RATE_LIMIT` (hoặc `--kpi.security.login-rate-limit-per-minute`) cao vì mọi request đến từ một IP.

## 3. Kết quả chi tiết — 100 TPS × 10 phút

| Chỉ số | avg | med | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| Toàn bộ request | 30,3 ms | 9,8 ms | 41,8 ms | 93,7 ms | 468 ms | 1,88 s |
| Đọc (`kind:read`) | 28,6 ms | 11,5 ms | 39,9 ms | **68,1 ms** | 483 ms | 1,88 s |
| Ghi (`kind:write`) | 18,8 ms | 4,0 ms | 22,8 ms | **56,2 ms** | 342 ms | 1,67 s |
| Đăng nhập (`/auth/login`) | 325 ms | 286 ms | 434 ms | **484 ms** | 813 ms | 1,39 s |

- Request: 66.467 (105,6/s); lượt nghiệp vụ: 61.200 (42.002 đọc, 17.998 ghi); checks 99,99 %.
- VU tối đa sử dụng: 160 (pool khởi tạo 150 + đăng nhập).

## 4. Kết quả chi tiết — 500 người dùng đồng thời × 5 phút

| Chỉ số | avg | med | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| Toàn bộ request | 16,4 ms | 9,8 ms | 20,4 ms | 27,1 ms | 230 ms | 665 ms |
| Đọc | 19,5 ms | 11,2 ms | 22,3 ms | 31,5 ms | 257 ms | 665 ms |
| Ghi | 9,7 ms | 4,0 ms | 16,6 ms | 19,4 ms | 158 ms | 472 ms |

31.918 request (103/s), 0 lỗi, checks 100 %.

## 5. Môi trường đo

| Thành phần | Cấu hình |
|---|---|
| Máy | 1 máy: AMD Ryzen 7 7435HS (16 luồng), 32 GB RAM, Windows 11 |
| Ứng dụng | **1 node** Spring Boot (JDK 21, profile dev), HikariCP 30 kết nối, không qua Nginx |
| CSDL | MariaDB 10.11 (Docker), dữ liệu seed demo (34 tỉnh + TCT/CT + phòng ban, 2 năm giao KPI, kết quả các quý) |
| Công cụ tải | k6 0.54.0 (Docker, cùng máy) |

Môi trường triển khai thật (PHẦN B §10) có 2 node ứng dụng sau F5 và MariaDB riêng — năng lực dự kiến cao hơn môi trường đo. Khối lượng “hàng trăm GB” chưa được đo (OPEN-QUESTIONS #17); script `deploy/scripts/seed-volume.sh` dùng để sinh dữ liệu lớn khi có hạ tầng.

## 5b. Kết quả trên dữ liệu khối lượng lớn (`deploy/scripts/seed-volume.sh`)

CSDL ≈ 580 MB: 14.802 người dùng, 49.057 kết quả đánh giá (12 năm), 3.740 dòng tổng hợp BSC, **2.000.000 bản ghi `audit_log`**.

| API (đơn lẻ, sau khi khởi động) | Thời gian |
|---|---|
| `/dashboard/overview` Tập đoàn – Quý / Giai đoạn / Khối tỉnh | 41–139 ms |
| `/dashboard/ranking-provinces` (tất cả tỉnh), `/corporations`, `/kpi-list`, `/province-stage` | 26–69 ms |
| `/dashboard/strategy-map` | 122 ms |
| “Nhật ký hệ thống” `/audit-logs` (2 triệu bản ghi) | **4.477 ms → 248 ms** sau tối ưu (lọc theo ngày: 41 ms; theo người dùng: 21 ms) |
| Danh sách người dùng tìm kiếm (15.000 tài khoản) | 133 ms |

k6 100 TPS × 5 phút trên dữ liệu này (`perf/k6-summary-volume.json`): 109,6 req/s, lỗi 0,003 % (1/33.246), p95 đọc 1,10 s / ghi 0,72 s / đăng nhập 1,51 s — **đạt ngưỡng p95 < 2 s**. Lưu ý: máy đo đồng thời chạy nhiều ứng dụng khác (CPU nền ≈ 79 % khi chưa có tải), nên độ trễ cao hơn lần đo 100 TPS ở §3; từng API đơn lẻ đều < 150 ms, không có điểm nghẽn tập trung (thread dump dưới tải phân tán đều).

## 6. Vấn đề phát hiện và đã khắc phục trong quá trình đo

| # | Hiện tượng | Nguyên nhân | Khắc phục |
|---|---|---|---|
| 1 | Cạn pool kết nối (`Connection is not available … active=30, waiting=178`), đăng nhập trả 500 | `LoginAttemptLogger` dùng `REQUIRES_NEW` bên trong transaction đăng nhập → mỗi lượt đăng nhập cần 2 kết nối; dưới tải 30 transaction giữ kết nối chờ kết nối thứ hai (deadlock pool) | `LoginAttemptLogger` → `REQUIRED`; bcrypt chạy ngoài transaction (`AuthService.login`), phần ghi trong `TransactionTemplate` |
| 2 | Lỗi ghi `Duplicate entry 'DVDxxx' for key 'uk_uom_code'` (1,4 % lượt ghi) | Mã đơn vị đo sinh bằng `LPAD(id, 3, '0')` — cắt chuỗi khi id ≥ 1000 | `CONCAT('DVD', IF(id < 1000, LPAD(id,3,'0'), id))` |
| 3 | k6 mất phiên sau lượt đầu (401) | k6 mặc định xóa cookie mỗi iteration | `noCookiesReset: true` |
| 4 | “Nhật ký hệ thống” 4,5 s với 2 triệu bản ghi | `ORDER BY at DESC LIMIT` filesort toàn bảng (không có index trên `at`) + `COUNT(*)` toàn bảng | V006 `idx_audit_at (at, id)`; đếm có trần 100.000 (lọc theo ngày vẫn chính xác) → 248 ms |
