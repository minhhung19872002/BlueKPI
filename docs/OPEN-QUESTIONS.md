# OPEN-QUESTIONS — Câu hỏi mở cho Chủ đầu tư (VNPT-IT)

> Các điểm **[GIẢ ĐỊNH]** đều đã được hiện thực theo hướng cấu hình được (tham số hệ thống `sys_config` hoặc `scoring_method.config`). Cột “Cách xử lý hiện tại” mô tả giả định đang dùng.

| # | Chủ đề | Câu hỏi | Cách xử lý hiện tại |
|---|---|---|---|
| 1 | Mẫu báo cáo | Cần file mẫu chính thức: “Báo cáo TTr94 tổng hợp BSC”, “TTr94 chi tiết KPI”, “Báo cáo KPI từng tỉnh”, “Biểu giao KPI”, “Biểu kết quả KPI”, mẫu export KPI đơn vị | Tạo template JXLS dựng sẵn hợp lý (bảng `report_template`, lưu MinIO); admin thay template không cần build lại |
| 2 | Thuật ngữ | “KQ R2” và “BCL” nghĩa là gì; vòng R1/R2 có quy trình riêng không | Hiểu R2 = vòng chốt kết quả lần 2 theo chỉ tiêu; BCL = bộ phận chất lượng/thẩm định yêu cầu làm lại. Chỉ 1 vòng chốt R2 cho mỗi KPI-kỳ |
| 3 | Tính điểm | Bảng khung điểm thang 5 chính thức; quy tắc điểm BSC đơn vị; xử lý KPI cha–con; KPI nghịch | Khung mặc định <70→1, 70–<85→2, 85–<100→3, 100–<110→4, ≥110→5 (`scoring_method.config`); BSC đơn vị = Σ score×weight/Σweight; KPI cha = TB trọng số con; NGHICH = KH/TH, TH=0 → `KPI_COMPLETION_CAP` |
| 4 | Ngưỡng | Ngưỡng “KPI cảnh báo”; cách tính lũy kế giai đoạn; “ĐC kỳ trước” | `KPI_WARNING_RATE`=90 hoặc CHUA_DAT; giai đoạn = ΣTH/ΣKH các năm; BSC giai đoạn = TB BSC năm; ĐC kỳ trước = Σ điều chỉnh các kỳ trước cùng năm khi LUY_KE |
| 5 | Hạn cập nhật | Hạn cập nhật kết quả từng kỳ (cho nhắc hạn) | `DEADLINE_DAY_AFTER_PERIOD`=15 ngày sau kết thúc kỳ; nhắc trước `REMIND_DAYS_BEFORE_DEADLINE`=5 ngày |
| 6 | Tích hợp | URL/phiên bản CAS, thuộc tính trả về; đặc tả API nguồn KPI; API HRM; tài khoản Zalo OA/ZNS; SMTP | CAS 2.0/3.0 cấu hình `CAS_SERVER_URL`; mock CAS + mock KPI source trong dev; HRM adapter stub (tắt); Zalo adapter bật/tắt `NOTIFY_ZALO_ENABLED`; SMTP qua Spring Mail (Mailpit dev) |
| 7 | Hạ tầng | Vị trí đặt MinIO (VM nào); chính sách sao lưu off-site; Ubuntu 20.04 đã hết hỗ trợ tiêu chuẩn — có nâng lên 22.04/24.04 (hoặc Ubuntu Pro ESM) không | MinIO trên DB_01, `mc mirror --watch` sang DB_02; code chạy JDK 21 tarball trên 20.04/22.04/24.04 |
| 8 | Nội dung chép mẫu | E-HSMT nêu “600.000 tài sản” và “cấu hình cấu trúc lương” — có vẻ chép từ hồ sơ khác. Xác nhận phạm vi | Hiện thực bằng tham số/danh mục cấu hình được; không xây phân hệ lương/tài sản |
| 9 | ATTT | Quy định ATTT nội bộ VNPT cần đáp ứng trước khi vận hành chính thức | Tài liệu hóa `docs/ATTT.md` theo OWASP ASVS L2, CWE Top 25 |
| 10 | Ký duyệt TGĐ | Có cần chữ ký số không, hay chỉ phê duyệt trên hệ thống | Phê duyệt trên hệ thống (ghi `period_closing.approved_by/at` + audit); có điểm mở rộng ký số |
| 11 | Mâu thuẫn đặc tả | 39.1 liệt kê “Tình trạng” 4 giá trị nhưng bảng trạng thái có 5 (thiếu “Đã chấm”) | Hiển thị đủ 5 giá trị |
| 12 | Mâu thuẫn đặc tả | STT 26.17–26.24 (Lịch đồng bộ, Tham số) đánh số trong nhóm 26 (Danh mục KPI) nhưng đường dẫn ở “Quản trị hệ thống” | Đặt tại “Quản trị hệ thống” theo đường dẫn đặc tả |
| 13 | Mâu thuẫn đặc tả | STT 45.x nằm trong mục VII (Đánh giá) nhưng đường dẫn ở “Tổng hợp kết quả BSC” | Đặt tại tab “Tổng hợp kết quả BSC” (nút “Xem”) |
| 14 | Chưa rõ | Dashboard: chọn 1 tỉnh + kỳ Giai đoạn trùng giữa 11.1 và 14.1 | Hiển thị nội dung 11.1 và bổ sung khối 14.1 (line chart + bảng các kỳ) |
| 15 | Chưa rõ | 36.4 chỉ có “Giai đoạn”, 36.5 có thêm “Năm” | `year` mặc định = năm bắt đầu giai đoạn, sửa được ở 36.5 |
| 16 | Chưa rõ | “Khóa toàn bộ dữ liệu kỳ” sau TGĐ duyệt có cho mở khóa không | Không có chức năng mở khóa trên UI; chỉ Admin hệ thống thao tác DB theo quy trình vận hành |
| 17 | Hiệu năng | Dữ liệu “hàng trăm GB” để kiểm thử | Script `deploy/scripts/seed-volume` sinh dữ liệu có tham số quy mô; kiểm thử nội bộ ở quy mô nhỏ hơn, ghi trong `docs/perf-report.md` |
