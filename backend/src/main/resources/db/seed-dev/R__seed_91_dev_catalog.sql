-- Seed DEV/DEMO danh mục KPI (PHẦN D §2): đơn vị đo, ~16 mục tiêu trọng tâm, ~15 định nghĩa công thức (một nửa nguồn API dùng mock)

INSERT INTO unit_of_measure (code, name, description, status, created_by, updated_by) VALUES
('DVD001','Tỷ đồng','Tiền tệ','HIEU_LUC','system','system'),
('DVD002','Triệu đồng','Tiền tệ','HIEU_LUC','system','system'),
('DVD003','%','Tỷ lệ phần trăm','HIEU_LUC','system','system'),
('DVD004','Thuê bao','Số lượng thuê bao','HIEU_LUC','system','system'),
('DVD005','Khách hàng','Số lượng khách hàng','HIEU_LUC','system','system'),
('DVD006','Điểm','Điểm đánh giá','HIEU_LUC','system','system'),
('DVD007','Giờ','Thời gian','HIEU_LUC','system','system'),
('DVD008','Sản phẩm','Số lượng sản phẩm','HIEU_LUC','system','system')
ON DUPLICATE KEY UPDATE description = VALUES(description);

SET @tc = (SELECT id FROM perspective WHERE code = 'TC' AND deleted = 0);
SET @kh = (SELECT id FROM perspective WHERE code = 'KH' AND deleted = 0);
SET @qt = (SELECT id FROM perspective WHERE code = 'QT' AND deleted = 0);
SET @hp = (SELECT id FROM perspective WHERE code = 'HP' AND deleted = 0);

INSERT INTO strategic_objective (code, name, perspective_id, description, status, created_by, updated_by) VALUES
('MT-TC-01','Tăng trưởng doanh thu bền vững',@tc,'Doanh thu toàn Tập đoàn tăng trưởng ổn định','HIEU_LUC','system','system'),
('MT-TC-02','Nâng cao hiệu quả sử dụng vốn',@tc,'Tối ưu ROE, ROA','HIEU_LUC','system','system'),
('MT-TC-03','Tối ưu chi phí vận hành',@tc,'Giảm tỷ lệ chi phí/doanh thu','HIEU_LUC','system','system'),
('MT-TC-04','Tăng trưởng doanh thu dịch vụ số',@tc,'Chuyển dịch sang dịch vụ số','HIEU_LUC','system','system'),
('MT-KH-01','Nâng cao trải nghiệm khách hàng',@kh,'Chỉ số NPS, CSAT','HIEU_LUC','system','system'),
('MT-KH-02','Mở rộng thị phần',@kh,'Tăng thị phần di động, băng rộng','HIEU_LUC','system','system'),
('MT-KH-03','Giữ chân khách hàng',@kh,'Giảm tỷ lệ rời mạng','HIEU_LUC','system','system'),
('MT-KH-04','Phát triển khách hàng doanh nghiệp',@kh,'Khối khách hàng tổ chức, doanh nghiệp','HIEU_LUC','system','system'),
('MT-QT-01','Nâng cao chất lượng mạng lưới',@qt,'Chất lượng hạ tầng','HIEU_LUC','system','system'),
('MT-QT-02','Chuyển đổi số quy trình nội bộ',@qt,'Số hóa quy trình','HIEU_LUC','system','system'),
('MT-QT-03','Đảm bảo an toàn thông tin',@qt,'Không sự cố ATTT nghiêm trọng','HIEU_LUC','system','system'),
('MT-QT-04','Rút ngắn thời gian cung cấp dịch vụ',@qt,'Thời gian lắp đặt, xử lý sự cố','HIEU_LUC','system','system'),
('MT-HP-01','Phát triển nguồn nhân lực chất lượng cao',@hp,'Đào tạo, chứng chỉ','HIEU_LUC','system','system'),
('MT-HP-02','Thúc đẩy đổi mới sáng tạo',@hp,'Sáng kiến, sản phẩm mới','HIEU_LUC','system','system'),
('MT-HP-03','Xây dựng văn hóa doanh nghiệp',@hp,'Gắn kết nhân viên','HIEU_LUC','system','system'),
('MT-HP-04','Nâng cao năng suất lao động',@hp,'Doanh thu/lao động','HIEU_LUC','system','system')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO formula_definition (code, name, definition_type, data_type, expression, source_definition, api_path, http_method, response_path, business_description, status, created_by, updated_by) VALUES
('DT_VT','Doanh thu viễn thông','THANH_PHAN_API','TIEN_TE',NULL,'{"system":"BI","table":"doanh_thu"}','/kpi/DT_VT?year={year}&period={period}&unitCode={unitCode}','GET','$.data.value','Doanh thu dịch vụ viễn thông','HIEU_LUC','system','system'),
('DT_CNTT','Doanh thu CNTT','THANH_PHAN_API','TIEN_TE',NULL,'{"system":"BI"}','/kpi/DT_CNTT?year={year}&period={period}&unitCode={unitCode}','GET','$.data.value','Doanh thu dịch vụ CNTT','HIEU_LUC','system','system'),
('DT_SO','Doanh thu dịch vụ số','THANH_PHAN_API','TIEN_TE',NULL,'{"system":"BI"}','/kpi/DT_SO?year={year}&period={period}&unitCode={unitCode}','GET','$.data.value','Doanh thu dịch vụ số','HIEU_LUC','system','system'),
('CP_VH','Chi phí vận hành','THANH_PHAN_API','TIEN_TE',NULL,'{"system":"ERP"}','/kpi/CP_VH?year={year}&period={period}&unitCode={unitCode}','GET','$.data.value','Chi phí vận hành','HIEU_LUC','system','system'),
('TB_DD','Thuê bao di động phát triển mới','THANH_PHAN_API','SO_LUONG',NULL,'{"system":"CCBS"}','/kpi/TB_DD?year={year}&period={period}&unitCode={unitCode}','GET','$.data.value','Thuê bao di động','HIEU_LUC','system','system'),
('TB_BRCD','Thuê bao băng rộng cố định','THANH_PHAN_API','SO_LUONG',NULL,'{"system":"CCBS"}','/kpi/TB_BRCD?year={year}&period={period}&unitCode={unitCode}','GET','$.data.value','Thuê bao FiberVNN','HIEU_LUC','system','system'),
('NPS','Chỉ số NPS','THANH_PHAN_API','TY_LE',NULL,'{"system":"CRM"}','/kpi/NPS?year={year}&period={period}&unitCode={unitCode}','GET','$.data.value','Net Promoter Score','HIEU_LUC','system','system'),
('TL_ROI_MANG','Tỷ lệ rời mạng','THANH_PHAN_API','TY_LE',NULL,'{"system":"CCBS"}','/kpi/TL_ROI_MANG?year={year}&period={period}&unitCode={unitCode}','GET','$.data.value','Churn rate','HIEU_LUC','system','system'),
('SL_SANG_KIEN','Số sáng kiến được công nhận','THANH_PHAN_NHAP_TAY','SO_LUONG',NULL,NULL,NULL,'GET',NULL,'Nhập tay từ báo cáo','HIEU_LUC','system','system'),
('TL_DAO_TAO','Tỷ lệ CBNV được đào tạo','THANH_PHAN_NHAP_TAY','TY_LE',NULL,NULL,NULL,'GET',NULL,'Nhập tay','HIEU_LUC','system','system'),
('SU_CO_ATTT','Số sự cố ATTT nghiêm trọng','THANH_PHAN_NHAP_TAY','SO_LUONG',NULL,NULL,NULL,'GET',NULL,'Nhập tay','HIEU_LUC','system','system'),
('TG_LAP_DAT','Thời gian lắp đặt bình quân','THANH_PHAN_NHAP_TAY','SO',NULL,NULL,NULL,'GET',NULL,'Giờ','HIEU_LUC','system','system'),
('DIEM_VH','Điểm văn hóa doanh nghiệp','THANH_PHAN_NHAP_TAY','SO',NULL,NULL,NULL,'GET',NULL,'Khảo sát','HIEU_LUC','system','system'),
('DT_TONG','Tổng doanh thu','CONG_THUC_TONG_HOP','TIEN_TE','DT_VT + DT_CNTT + DT_SO',NULL,NULL,'GET',NULL,'Tổng các nguồn doanh thu','HIEU_LUC','system','system'),
('TL_CP_DT','Tỷ lệ chi phí trên doanh thu','CONG_THUC_TONG_HOP','TY_LE','CP_VH / (DT_VT + DT_CNTT + DT_SO) * 100',NULL,NULL,'GET',NULL,'Chi phí/doanh thu','HIEU_LUC','system','system')
ON DUPLICATE KEY UPDATE name = VALUES(name);
