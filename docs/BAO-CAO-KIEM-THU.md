# BÁO CÁO KIỂM THỬ — Phần mềm quản trị và theo dõi chỉ tiêu KPI theo BSC

> Sinh tự động bằng `node scripts/gen-test-report.mjs` lúc 12/11/2026 02:08 từ kết quả chạy thực tế (Playwright, JUnit/Testcontainers, Vitest). Không chỉnh tay.

## 1. Tổng hợp

| Loại kiểm thử | Công cụ | Số ca | Đạt | Không đạt |
|---|---|---|---|---|
| E2E theo STT (1024×768, dữ liệu seed) | Playwright | 187 | 187 | 0 |
| Unit backend (engine ≥ 40 ca, bảo mật) | JUnit 5 | 87 | 87 | 0 |
| Integration backend (MariaDB + MinIO Testcontainers) | JUnit 5 | 25 | 25 | 0 |

Mã STT có e2e: **173/173**. Tổng JUnit: 112 ca, lỗi 0.

## 2. Kết quả theo mã STT (E-HSMT)

| STT | Chức năng | Ca e2e | Kết quả | Bằng chứng |
|---|---|---|---|---|
| 1.1 | Đăng nhập hệ thống | 2 | Đạt | p0-auth.spec.ts, p8-sso.spec.ts |
| 1.2 | Đăng nhập – Thông tin không hợp lệ | 3 | Đạt | p0-auth.spec.ts, p8-sso.spec.ts |
| 2.1 | Đăng xuất hệ thống | 1 | Đạt | p0-auth.spec.ts |
| 3.1 | Lấy danh sách – Người dùng | 1 | Đạt | p1-users.spec.ts |
| 3.2 | Tìm kiếm – Người dùng | 1 | Đạt | p1-users.spec.ts |
| 3.3 | Xem chi tiết – Người dùng | 1 | Đạt | p1-users.spec.ts |
| 3.4 | Thêm mới – Người dùng | 1 | Đạt | p1-users.spec.ts |
| 3.5 | Ghi lại – Người dùng | 1 | Đạt | p1-users.spec.ts |
| 3.6 | Xóa – Người dùng | 1 | Đạt | p1-users.spec.ts |
| 3.7 | Nhập dữ liệu – Người dùng | 1 | Đạt | p1-users.spec.ts |
| 3.8 | Xuất dữ liệu – Người dùng | 1 | Đạt | p1-users.spec.ts |
| 3.9 | Gán vai trò cho người dùng | 2 | Đạt | p1-users.spec.ts |
| 3.10 | Bỏ gán vai trò của người dùng | 1 | Đạt | p1-users.spec.ts |
| 4.1 | Lấy danh sách – Vai trò | 1 | Đạt | p1-roles.spec.ts |
| 4.2 | Tìm kiếm – Vai trò | 1 | Đạt | p1-roles.spec.ts |
| 4.3 | Xem chi tiết – Vai trò | 1 | Đạt | p1-roles.spec.ts |
| 4.4 | Thêm mới – Vai trò | 1 | Đạt | p1-roles.spec.ts |
| 4.5 | Ghi lại – Vai trò | 1 | Đạt | p1-roles.spec.ts |
| 4.6 | Xóa – Vai trò | 1 | Đạt | p1-roles.spec.ts |
| 4.7 | Lấy danh sách – Quyền | 1 | Đạt | p1-roles.spec.ts |
| 4.8 | Xem chi tiết – Quyền | 1 | Đạt | p1-roles.spec.ts |
| 4.9 | Ghi lại – Quyền | 1 | Đạt | p1-roles.spec.ts |
| 5.1 | Lấy danh sách – Đơn vị | 1 | Đạt | p1-org.spec.ts |
| 5.2 | Tìm kiếm – Đơn vị | 1 | Đạt | p1-org.spec.ts |
| 5.3 | Xem chi tiết – Đơn vị | 1 | Đạt | p1-org.spec.ts |
| 5.4 | Thêm mới – Đơn vị | 1 | Đạt | p1-org.spec.ts |
| 5.5 | Ghi lại – Đơn vị | 1 | Đạt | p1-org.spec.ts |
| 5.6 | Xóa – Đơn vị | 1 | Đạt | p1-org.spec.ts |
| 5.7 | Nhập dữ liệu – Đơn vị | 1 | Đạt | p1-org.spec.ts |
| 5.8 | Xuất dữ liệu – Đơn vị | 1 | Đạt | p1-org.spec.ts |
| 6.1 | Xem biểu tổng hợp Tập đoàn – Năm | 1 | Đạt | p7-dashboard.spec.ts |
| 7.1 | Xem biểu tổng hợp Tập đoàn – Quý | 1 | Đạt | p7-dashboard.spec.ts |
| 8.1 | Xem biểu tổng hợp Tập đoàn – Giai đoạn | 1 | Đạt | p7-dashboard.spec.ts |
| 9.1 | Xem biểu tổng hợp Đơn vị – Năm | 1 | Đạt | p7-dashboard.spec.ts |
| 10.1 | Xem biểu tổng hợp Đơn vị – Quý | 1 | Đạt | p7-dashboard.spec.ts |
| 11.1 | Xem biểu tổng hợp Đơn vị – Giai đoạn | 1 | Đạt | p7-dashboard.spec.ts |
| 12.1 | Xem biểu tổng hợp Tỉnh – Năm (tất cả các tỉnh) | 1 | Đạt | p7-dashboard.spec.ts |
| 13.1 | Xem biểu tổng hợp Tỉnh – Quý (tất cả các tỉnh) | 1 | Đạt | p7-dashboard.spec.ts |
| 14.1 | Xem biểu tổng hợp giai đoạn của 1 tỉnh | 1 | Đạt | p7-dashboard.spec.ts |
| 15.1 | Xem bản đồ chiến lược | 1 | Đạt | p7-dashboard.spec.ts |
| 16.1 | Xem Dashboard đơn vị từ bảng xếp hạng | 1 | Đạt | p7-dashboard.spec.ts |
| 16.2 | Quay lại Dashboard Tập đoàn | 1 | Đạt | p7-dashboard.spec.ts |
| 17.1 | Xem tổng quan – Dashboard TGĐ BSC | 1 | Đạt | p7-dashboard.spec.ts |
| 17.2 | Lọc dữ liệu – Dashboard TGĐ BSC | 1 | Đạt | p7-dashboard.spec.ts |
| 17.3 | Xem danh sách KPI theo thẻ chỉ số | 1 | Đạt | p7-dashboard.spec.ts |
| 17.4 | Xem danh sách chi tiết các KPI | 1 | Đạt | p7-dashboard.spec.ts |
| 17.5 | Xem chi tiết KPI trọng tâm | 1 | Đạt | p7-dashboard.spec.ts |
| 17.6 | Xuất kết quả đánh giá KPI | 1 | Đạt | p7-dashboard.spec.ts |
| 17.7 | Xem bảng tổng hợp kết quả KPI giao cho Tổng công ty/Công ty | 1 | Đạt | p7-dashboard.spec.ts |
| 17.8 | Xuất bảng tổng hợp kết quả KPI giao cho Tổng công ty/Công ty | 1 | Đạt | p7-dashboard.spec.ts |
| 18.1 | KPI đơn vị của tôi – Xem theo kỳ đánh giá | 1 | Đạt | p4-eval.spec.ts |
| 19.1 | KPI đơn vị của tôi – Xem theo chỉ tiêu KPI | 1 | Đạt | p4-eval.spec.ts |
| 20.1 | KPI đơn vị của tôi – Theo dõi kết quả thẩm định và phản hồi | 1 | Đạt | p4-eval.spec.ts |
| 21.1 | Đề nghị điều chỉnh kết quả KPI | 1 | Đạt | p4-eval.spec.ts |
| 22.1 | Xuất kết quả đánh giá KPI theo mẫu | 1 | Đạt | p4-eval.spec.ts |
| 23.1 | Lấy danh sách – Danh sách KPI | 1 | Đạt | p2-kpi.spec.ts |
| 23.2 | Tìm kiếm – Danh sách KPI | 1 | Đạt | p2-kpi.spec.ts |
| 23.3 | Xem chi tiết – Danh sách KPI | 1 | Đạt | p2-kpi.spec.ts |
| 23.4 | Ghi lại – Danh sách KPI | 1 | Đạt | p2-kpi.spec.ts |
| 23.5 | Xóa – Danh sách KPI | 1 | Đạt | p2-kpi.spec.ts |
| 23.6 | Nhập dữ liệu – Danh sách KPI | 1 | Đạt | p2-kpi.spec.ts |
| 23.7 | Xuất dữ liệu – Danh sách KPI | 1 | Đạt | p2-kpi.spec.ts |
| 24.1 | Thêm mới tiêu chí đánh giá KPI – KPI đơn lẻ | 1 | Đạt | p2-kpi.spec.ts |
| 25.1 | Thêm mới tiêu chí đánh giá KPI – KPI cha – con | 1 | Đạt | p2-kpi.spec.ts |
| 26.1 | Lấy danh sách – Đơn vị đo | 1 | Đạt | p2-catalog.spec.ts |
| 26.2 | Tìm kiếm – Đơn vị đo | 1 | Đạt | p2-catalog.spec.ts |
| 26.3 | Xem chi tiết – Đơn vị đo | 1 | Đạt | p2-catalog.spec.ts |
| 26.4 | Thêm mới – Đơn vị đo | 1 | Đạt | p2-catalog.spec.ts |
| 26.5 | Ghi lại – Đơn vị đo | 1 | Đạt | p2-catalog.spec.ts |
| 26.6 | Xóa – Đơn vị đo | 1 | Đạt | p2-catalog.spec.ts |
| 26.7 | Nhập dữ liệu – Đơn vị đo | 1 | Đạt | p2-catalog.spec.ts |
| 26.8 | Xuất dữ liệu – Đơn vị đo | 1 | Đạt | p2-catalog.spec.ts |
| 26.9 | Lấy danh sách – Viễn cảnh | 1 | Đạt | p2-catalog.spec.ts |
| 26.10 | Tìm kiếm – Viễn cảnh | 1 | Đạt | p2-catalog.spec.ts |
| 26.11 | Xem chi tiết – Viễn cảnh | 1 | Đạt | p2-catalog.spec.ts |
| 26.12 | Thêm mới – Viễn cảnh | 1 | Đạt | p2-catalog.spec.ts |
| 26.13 | Ghi lại – Viễn cảnh | 1 | Đạt | p2-catalog.spec.ts |
| 26.14 | Xóa – Viễn cảnh | 1 | Đạt | p2-catalog.spec.ts |
| 26.15 | Nhập dữ liệu – Viễn cảnh | 1 | Đạt | p2-catalog.spec.ts |
| 26.16 | Xuất dữ liệu – Viễn cảnh | 1 | Đạt | p2-catalog.spec.ts |
| 26.17 | Lấy danh sách – Lịch đồng bộ | 1 | Đạt | p1-config.spec.ts |
| 26.18 | Xem chi tiết – Lịch đồng bộ | 1 | Đạt | p1-config.spec.ts |
| 26.19 | Ghi lại – Lịch đồng bộ | 1 | Đạt | p1-config.spec.ts |
| 26.20 | Lấy danh sách – Tham số hệ thống | 1 | Đạt | p1-config.spec.ts |
| 26.21 | Xem chi tiết – Tham số hệ thống | 1 | Đạt | p1-config.spec.ts |
| 26.22 | Thêm mới – Tham số hệ thống | 1 | Đạt | p1-config.spec.ts |
| 26.23 | Ghi lại – Tham số hệ thống | 1 | Đạt | p1-config.spec.ts |
| 26.24 | Xóa – Tham số hệ thống | 1 | Đạt | p1-config.spec.ts |
| 27.1 | Lấy danh sách – Định nghĩa KPI công thức | 1 | Đạt | p2-catalog.spec.ts |
| 27.2 | Tìm kiếm – Định nghĩa KPI công thức | 1 | Đạt | p2-catalog.spec.ts |
| 27.3 | Xem chi tiết – Định nghĩa KPI công thức | 1 | Đạt | p2-catalog.spec.ts |
| 27.4 | Thêm mới – Định nghĩa KPI công thức | 1 | Đạt | p2-catalog.spec.ts |
| 27.5 | Ghi lại – Định nghĩa KPI công thức | 1 | Đạt | p2-catalog.spec.ts |
| 27.6 | Xóa – Định nghĩa KPI công thức | 1 | Đạt | p2-catalog.spec.ts |
| 28.1 | Lấy danh sách – Mục tiêu trọng tâm | 1 | Đạt | p2-catalog.spec.ts |
| 28.2 | Tìm kiếm – Mục tiêu trọng tâm | 1 | Đạt | p2-catalog.spec.ts |
| 28.3 | Xem chi tiết – Mục tiêu trọng tâm | 1 | Đạt | p2-catalog.spec.ts |
| 28.4 | Thêm mới – Mục tiêu trọng tâm | 1 | Đạt | p2-catalog.spec.ts |
| 28.5 | Ghi lại – Mục tiêu trọng tâm | 1 | Đạt | p2-catalog.spec.ts |
| 28.6 | Xóa – Mục tiêu trọng tâm | 1 | Đạt | p2-catalog.spec.ts |
| 28.7 | Nhập dữ liệu – Mục tiêu trọng tâm | 1 | Đạt | p2-catalog.spec.ts |
| 28.8 | Xuất dữ liệu – Mục tiêu trọng tâm | 1 | Đạt | p2-catalog.spec.ts |
| 29.1 | Lấy danh sách – Giao KPI theo đơn vị | 1 | Đạt | p3-assign.spec.ts |
| 29.2 | Tìm kiếm – Giao KPI theo đơn vị | 1 | Đạt | p3-assign.spec.ts |
| 29.3 | Xem chi tiết – Giao KPI theo đơn vị | 1 | Đạt | p3-assign.spec.ts |
| 29.4 | Xóa – Giao KPI theo đơn vị | 1 | Đạt | p3-assign.spec.ts |
| 29.5 | Sao chép giao KPI theo đơn vị | 1 | Đạt | p3-assign.spec.ts |
| 30.1 | Thêm mới – Giao KPI theo đơn vị | 1 | Đạt | p3-assign.spec.ts |
| 30.2 | Ghi lại – Giao KPI theo đơn vị | 1 | Đạt | p3-assign.spec.ts |
| 31.1 | Chốt số liệu giao KPI – Giao KPI theo đơn vị | 1 | Đạt | p3-assign.spec.ts |
| 31.2 | Chốt số liệu giao KPI – Giao KPI theo chỉ tiêu | 1 | Đạt | p3-assign.spec.ts |
| 32.1 | Lấy danh sách – Giao KPI theo chỉ tiêu | 1 | Đạt | p3-assign.spec.ts |
| 32.2 | Tìm kiếm – Giao KPI theo chỉ tiêu | 1 | Đạt | p3-assign.spec.ts |
| 32.3 | Xem chi tiết – Giao KPI theo chỉ tiêu | 1 | Đạt | p3-assign.spec.ts |
| 32.4 | Sao chép giao KPI theo chỉ tiêu | 1 | Đạt | p3-assign.spec.ts |
| 33.1 | Thêm mới – Giao KPI theo chỉ tiêu | 1 | Đạt | p3-assign.spec.ts |
| 33.2 | Ghi lại – Giao KPI theo chỉ tiêu | 1 | Đạt | p3-assign.spec.ts |
| 34.1 | Điều chỉnh – Lưu nháp | 1 | Đạt | p3-assign.spec.ts |
| 34.2 | Điều chỉnh – Lưu chốt | 1 | Đạt | p3-assign.spec.ts |
| 34.3 | Điều chỉnh – Xem lịch sử điều chỉnh | 1 | Đạt | p3-assign.spec.ts |
| 35.1 | Giao KPI – Nhập dữ liệu | 1 | Đạt | p3-assign.spec.ts |
| 35.2 | Xuất dữ liệu – Giao KPI theo đơn vị | 1 | Đạt | p3-assign.spec.ts |
| 36.1 | Lấy danh sách – Bản đồ chiến lược | 1 | Đạt | p6-strategy.spec.ts |
| 36.2 | Tìm kiếm – Bản đồ chiến lược | 1 | Đạt | p6-strategy.spec.ts |
| 36.3 | Xem chi tiết – Bản đồ chiến lược | 1 | Đạt | p6-strategy.spec.ts |
| 36.4 | Thêm mới – Bản đồ chiến lược | 1 | Đạt | p6-strategy.spec.ts |
| 36.5 | Ghi lại – Bản đồ chiến lược | 1 | Đạt | p6-strategy.spec.ts |
| 36.6 | Xóa – Bản đồ chiến lược | 1 | Đạt | p6-strategy.spec.ts |
| 37.1 | Cập nhật mục tiêu trọng tâm trên bản đồ chiến lược | 1 | Đạt | p6-strategy.spec.ts |
| 37.2 | Vẽ liên kết giữa các mục tiêu trọng tâm | 1 | Đạt | p6-strategy.spec.ts |
| 37.3 | Xóa mục tiêu trọng tâm khỏi bản đồ | 1 | Đạt | p6-strategy.spec.ts |
| 37.4 | Xem KPI của mục tiêu trọng tâm trên bản đồ | 1 | Đạt | p6-strategy.spec.ts |
| 37.5 | Tải ảnh bản đồ chiến lược | 1 | Đạt | p6-strategy.spec.ts |
| 37.6 | Xóa liên kết giữa các mục tiêu trọng tâm | 1 | Đạt | p6-strategy.spec.ts |
| 38.1 | Gán khung KPI vào chiến lược | 1 | Đạt | p6-strategy.spec.ts |
| 39.1 | Lấy danh sách – Tổng hợp BSC theo chỉ tiêu KPI | 1 | Đạt | p4-eval.spec.ts |
| 39.2 | Tìm kiếm – Tổng hợp BSC theo chỉ tiêu KPI | 1 | Đạt | p4-eval.spec.ts |
| 39.3 | Xem chi tiết – Tổng hợp BSC theo chỉ tiêu KPI | 1 | Đạt | p4-eval.spec.ts |
| 40.1 | Lấy danh sách – Theo dõi kết quả thẩm định và phản hồi | 1 | Đạt | p4-eval.spec.ts |
| 40.2 | Tìm kiếm – Theo dõi kết quả thẩm định và phản hồi | 1 | Đạt | p4-eval.spec.ts |
| 40.3 | Xem chi tiết – Theo dõi kết quả thẩm định và phản hồi | 1 | Đạt | p4-eval.spec.ts |
| 41.1 | Điều chỉnh kết quả KPI cho đơn vị | 1 | Đạt | p4-eval.spec.ts |
| 42.1 | Cập nhật kết quả đánh giá KPI (SL nhập tay) cho đơn vị | 1 | Đạt | p4-eval.spec.ts |
| 43.1 | Đánh giá – Đồng bộ lại | 1 | Đạt | p4-eval.spec.ts |
| 44.1 | Đánh giá – Tổng hợp BSC theo chỉ tiêu KPI (nhập tay) | 1 | Đạt | p4-eval.spec.ts |
| 44.2 | Đánh giá – Nhập dữ liệu | 1 | Đạt | p4-eval.spec.ts |
| 45.1 | Xem chi tiết – Xuất biểu giao KPI | 1 | Đạt | p5-bsc.spec.ts |
| 45.2 | Xem chi tiết – Xuất biểu kết quả KPI | 1 | Đạt | p5-bsc.spec.ts |
| 46.1 | Lấy danh sách – Tổng hợp kết quả BSC | 1 | Đạt | p5-bsc.spec.ts |
| 46.2 | Tìm kiếm – Tổng hợp kết quả BSC | 1 | Đạt | p5-bsc.spec.ts |
| 46.3 | Xem chi tiết – Tổng hợp kết quả BSC | 1 | Đạt | p5-bsc.spec.ts |
| 46.4 | Thu hồi kết quả đánh giá | 1 | Đạt | p5-bsc.spec.ts |
| 46.5 | Tính lại điểm đánh giá | 1 | Đạt | p5-bsc.spec.ts |
| 47.1 | Lấy danh sách – Theo dõi kết quả thẩm định và phản hồi (Tổng hợp BSC) | 1 | Đạt | p5-bsc.spec.ts |
| 47.2 | Tìm kiếm – Theo dõi kết quả thẩm định và phản hồi (Tổng hợp BSC) | 1 | Đạt | p5-bsc.spec.ts |
| 47.3 | Xem chi tiết – Theo dõi kết quả thẩm định và phản hồi (Tổng hợp BSC) | 1 | Đạt | p5-bsc.spec.ts |
| 47.4 | Thu hồi kết quả đánh giá theo đơn vị | 1 | Đạt | p5-bsc.spec.ts |
| 48.1 | Chốt đánh giá KPI – Đủ điều kiện | 1 | Đạt | p5-bsc.spec.ts |
| 48.2 | Chốt đánh giá KPI – Cảnh báo không đủ điều kiện | 1 | Đạt | p5-bsc.spec.ts |
| 48.3 | Chốt đánh giá KPI – Đủ điều kiện (tab Theo dõi) | 1 | Đạt | p5-bsc.spec.ts |
| 48.4 | Chốt đánh giá KPI – Cảnh báo không đủ điều kiện (tab Theo dõi) | 1 | Đạt | p5-bsc.spec.ts |
| 49.1 | Chốt kết quả R2 – Tổng hợp BSC theo chỉ tiêu KPI | 1 | Đạt | p4-eval.spec.ts |
| 50.1 | Tổng giám đốc duyệt – Cảnh báo không đủ điều kiện | 1 | Đạt | p5-bsc.spec.ts |
| 50.2 | Tổng giám đốc duyệt – Ký duyệt | 1 | Đạt | p5-bsc.spec.ts |
| 50.3 | Tổng giám đốc duyệt – Cảnh báo không đủ điều kiện (tab Theo dõi) | 1 | Đạt | p5-bsc.spec.ts |
| 50.4 | Tổng giám đốc duyệt – Ký duyệt (tab Theo dõi) | 1 | Đạt | p5-bsc.spec.ts |
| 51.1 | Xuất báo cáo TTr94 tổng hợp BSC | 1 | Đạt | p5-bsc.spec.ts |
| 51.2 | Xuất báo cáo TTr94 tổng hợp BSC (tab Theo dõi) | 1 | Đạt | p5-bsc.spec.ts |
| 52.1 | Xuất báo cáo TTr94 chi tiết KPI | 1 | Đạt | p5-bsc.spec.ts |
| 52.2 | Xuất báo cáo TTr94 chi tiết KPI (tab Theo dõi) | 1 | Đạt | p5-bsc.spec.ts |
| 53.1 | Xuất báo cáo KPI từng tỉnh | 1 | Đạt | p5-bsc.spec.ts |
| 53.2 | Xuất báo cáo KPI từng tỉnh (tab Theo dõi) | 1 | Đạt | p5-bsc.spec.ts |
| 54.1 | Thông báo (notify) trên hệ thống | 1 | Đạt | p3-assign.spec.ts |

## 3. Kiểm thử bổ sung (điều hướng SiteMap, phân quyền, hiệu năng, SSO)

| Ca kiểm thử | File | Kết quả | Thời gian |
|---|---|---|---|
| SiteMap 1 – Tập đoàn: Năm hiện tại → Năm X → nút Quý → Quý y | p7-dashboard.spec.ts | Đạt | 3.5s |
| SiteMap 2 – Tập đoàn: Giai đoạn → Giai đoạn X–Y (năm đầu) → chọn năm X trên biểu đồ → Năm/Quý | p7-dashboard.spec.ts | Đạt | 3.1s |
| SiteMap 2b – Nhấn vào cột của một năm trên biểu đồ giai đoạn (onClick ECharts) | p7-dashboard.spec.ts | Đạt | 3.3s |
| SiteMap 3 – Nút Bản đồ chiến lược → bản đồ của năm tương ứng; từ biểu giai đoạn cũng mở được | p7-dashboard.spec.ts | Đạt | 2.8s |
| SiteMap 4 – Chọn đơn vị: Năm hiện tại ↔ Năm X ↔ Quý; Giai đoạn ↔ năm X trên biểu đồ | p7-dashboard.spec.ts | Đạt | 3.7s |
| SiteMap 5 – Chọn tỉnh: Tỉnh – Năm hiện tại → Năm X → nút Quý → Quý I năm X | p7-dashboard.spec.ts | Đạt | 3.3s |
| Phân quyền – Người dùng cấp đơn vị chỉ xem dữ liệu đơn vị mình | p7-dashboard.spec.ts | Đạt | 2.5s |
| Phân quyền – Lập chiến lược xem được biểu Tập đoàn và bản đồ chiến lược | p7-dashboard.spec.ts | Đạt | 3.1s |
| P7 hiệu năng – API dashboard < 1s trên dữ liệu seed | p7-dashboard.spec.ts | Đạt | 2.1s |

## 4. Kiểm thử backend (JUnit)

| Loại | Lớp kiểm thử | Số ca | Lỗi | Bỏ qua |
|---|---|---|---|---|
| Integration | `modules.AssignmentIT` | 2 | 0 | 0 |
| Integration | `modules.BscIT` | 2 | 0 | 0 |
| Integration | `modules.CatalogIT` | 4 | 0 | 0 |
| Integration | `modules.DashboardIT` | 3 | 0 | 0 |
| Integration | `modules.StrategyIT` | 2 | 0 | 0 |
| Integration | `modules.SystemAdminIT` | 6 | 0 | 0 |
| Integration | `security.AuthControllerIT` | 6 | 0 | 0 |
| Unit | `common.util.MaskingJsonEncoderTest` | 1 | 0 | 0 |
| Unit | `engine.FormulaEvaluatorTest` | 14 | 0 | 0 |
| Unit | `engine.KpiCalculationEngineTest` | 54 | 0 | 0 |
| Unit | `integration.kpisource.RestKpiSourceClientTest` | 11 | 0 | 0 |
| Unit | `security.SecurityUnitTest` | 7 | 0 | 0 |

## 6. Hiệu năng và bảo mật

- Hiệu năng (k6): xem [`docs/perf-report.md`](perf-report.md).
- An toàn thông tin: xem [`docs/ATTT.md`](ATTT.md) (cơ chế đã triển khai, kết quả quét, rủi ro còn lại).
- Ảnh chụp màn hình từng phân hệ: [`docs/HDSD/`](HDSD/).

## 7. Môi trường kiểm thử

- Trình duyệt Chromium (Playwright), viewport 1024×768, locale vi-VN, múi giờ Asia/Ho_Chi_Minh.
- Backend Spring Boot (profile dev + seed demo) trên MariaDB 10.11 (CSDL `kpi_bsc_e2e` reset trước mỗi lần chạy), MinIO, mock CAS, mock nguồn KPI (`deploy/docker-compose.dev.yml`).
- Integration test: Testcontainers `mariadb:10.11`, `minio/minio`.
