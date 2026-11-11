-- =====================================================================
-- Seed cấu hình (repeatable, idempotent): menu, tham số hệ thống, phương pháp tính điểm,
-- giai đoạn, viễn cảnh, lịch đồng bộ, mẫu báo cáo. Không ghi đè giá trị người dùng đã sửa.
-- =====================================================================

-- ---------- Menu (PHẦN C §0.1 — đúng thứ tự, nguyên văn) ----------
INSERT INTO menu (code, name, route, parent_id, icon, sort_order, permission_code, created_by, updated_by) VALUES
('DASHBOARD','Dashboard TGĐ BSC','/dashboard',NULL,'gauge',1,'DASHBOARD:VIEW_GROUP,DASHBOARD:VIEW_UNIT,DASHBOARD:VIEW_PROVINCE','system','system'),
('MYKPI','KPI đơn vị của tôi','/my-kpi',NULL,'target',2,'MYKPI:VIEW','system','system'),
('KPI_ADMIN','Quản trị KPI',NULL,NULL,'layers',3,NULL,'system','system'),
('SYSTEM','Quản trị hệ thống','/system',NULL,'settings',4,'USER:VIEW,ROLE:VIEW,PERMISSION:VIEW,ORG:VIEW,SCHEDULE:VIEW,SYSCONFIG:VIEW,AUDIT:VIEW','system','system')
ON DUPLICATE KEY UPDATE name = VALUES(name), route = VALUES(route), icon = VALUES(icon), sort_order = VALUES(sort_order),
  permission_code = VALUES(permission_code), parent_id = VALUES(parent_id), deleted = 0;

SET @kpi_admin = (SELECT id FROM menu WHERE code = 'KPI_ADMIN');
INSERT INTO menu (code, name, route, parent_id, icon, sort_order, permission_code, created_by, updated_by) VALUES
('KPI_CATALOG','Danh mục chỉ tiêu KPI','/kpi-admin/catalog',@kpi_admin,'list',1,'KPI:VIEW,UOM:VIEW,PERSPECTIVE:VIEW,FORMULA:VIEW','system','system'),
('OBJECTIVE','Danh mục mục tiêu trọng tâm','/kpi-admin/objectives',@kpi_admin,'crosshair',2,'OBJECTIVE:VIEW','system','system'),
('ASSIGN','Giao KPI','/kpi-admin/assignments',@kpi_admin,'send',3,'ASSIGN:VIEW','system','system'),
('STRATEGY','Quản lý bản đồ chiến lược','/kpi-admin/strategies',@kpi_admin,'map',4,'STRATEGY:VIEW','system','system'),
('EVAL','Đánh giá KPI','/kpi-admin/evaluations',@kpi_admin,'clipboard-check',5,'EVAL:VIEW','system','system'),
('BSC','Tổng hợp kết quả BSC','/kpi-admin/bsc',@kpi_admin,'bar-chart',6,'BSC:VIEW','system','system')
ON DUPLICATE KEY UPDATE name = VALUES(name), route = VALUES(route), icon = VALUES(icon), sort_order = VALUES(sort_order),
  permission_code = VALUES(permission_code), parent_id = VALUES(parent_id), deleted = 0;

-- ---------- Tham số hệ thống (26.20–26.24) — is_core = 1: không được xóa ----------
INSERT IGNORE INTO sys_config (config_key, config_value, data_type, config_group, description, is_secret, is_core, created_by, updated_by) VALUES
('KPI_PASS_SCORE','3','NUMBER','DANH_GIA','Điểm tối thiểu để KPI đạt/vượt (thang 5)',0,1,'system','system'),
('KPI_WARNING_RATE','90','NUMBER','DANH_GIA','Ngưỡng % TH/KH kỳ dưới mức này là KPI cảnh báo',0,1,'system','system'),
('KPI_COMPLETION_CAP','200','NUMBER','DANH_GIA','Trần % hoàn thành (dùng cho công thức nghịch khi TH = 0)',0,1,'system','system'),
('UPLOAD_MAX_MB','10','NUMBER','TEP','Dung lượng tệp tải lên tối đa (MB)',0,1,'system','system'),
('UPLOAD_ALLOWED_EXT','xlsx,xls,docx,pdf,png,jpg,jpeg','STRING','TEP','Danh sách đuôi file cho phép',0,1,'system','system'),
('LOGIN_MAX_FAILED','5','NUMBER','BAO_MAT','Số lần đăng nhập sai tối đa trước khi khóa tạm',0,1,'system','system'),
('LOGIN_LOCK_MINUTES','15','NUMBER','BAO_MAT','Thời gian khóa tạm (phút)',0,1,'system','system'),
('KPI_SOURCE_BASE_URL','http://localhost:8092','STRING','TICH_HOP','URL nguồn dữ liệu KPI',0,1,'system','system'),
('KPI_SOURCE_AUTH_TYPE','NONE','STRING','TICH_HOP','Kiểu xác thực nguồn KPI: NONE, API_KEY, BEARER, BASIC',0,1,'system','system'),
('NOTIFY_EMAIL_ENABLED','false','BOOLEAN','THONG_BAO','Bật/tắt gửi email',0,1,'system','system'),
('NOTIFY_ZALO_ENABLED','false','BOOLEAN','THONG_BAO','Bật/tắt gửi Zalo',0,1,'system','system'),
('REMIND_DAYS_BEFORE_DEADLINE','5','NUMBER','THONG_BAO','Số ngày nhắc trước hạn cập nhật kết quả',0,1,'system','system'),
('DEADLINE_DAY_AFTER_PERIOD','15','NUMBER','DANH_GIA','Hạn cập nhật kết quả: số ngày sau khi kết thúc kỳ',0,1,'system','system'),
('DASHBOARD_DEFAULT_PERIOD','LATEST','STRING','DASHBOARD','Kỳ mặc định của dashboard (LATEST = kỳ gần nhất có kết quả, hoặc Y/Q1..Q4/H1)',0,1,'system','system'),
('FILE_RETENTION_YEARS','10','NUMBER','TEP','Số năm lưu giữ tệp đính kèm',0,0,'system','system'),
('ZALO_TEMPLATE_GIAO_KPI','','STRING','THONG_BAO','Template ZNS cho sự kiện giao KPI',0,0,'system','system'),
('BACKUP_DIR','/var/backups/kpi','STRING','VAN_HANH','Thư mục lưu bản sao lưu logic',0,0,'system','system');

-- ---------- Phương pháp tính điểm (PHẦN B §6.4) ----------
INSERT INTO scoring_method (code, name, type, config, created_by, updated_by) VALUES
('KHUNG_TY_LE_5','Khung tỷ lệ hoàn thành (thang 5)','KHUNG_TY_LE',
 '{"bands":[{"from":null,"to":70,"score":1},{"from":70,"to":85,"score":2},{"from":85,"to":100,"score":3},{"from":100,"to":110,"score":4},{"from":110,"to":null,"score":5}],"maxScore":5}','system','system'),
('DAT_KHONG_DAT','Đạt / Không đạt','DAT_KHONG_DAT','{"passRate":100,"passScore":5,"failScore":1,"maxScore":5}','system','system'),
('NHAP_DIEM','Nhập điểm trực tiếp','NHAP_DIEM','{"maxScore":5}','system','system')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ---------- Giai đoạn ----------
INSERT INTO evaluation_stage (code, name, from_year, to_year, created_by, updated_by) VALUES
('GD_2021_2025','Giai đoạn 2021–2025',2021,2025,'system','system'),
('GD_2026_2030','Giai đoạn 2026–2030',2026,2030,'system','system')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ---------- Viễn cảnh (PHẦN B §4.2) ----------
INSERT IGNORE INTO perspective (code, name, sort_order, description, color, status, created_by, updated_by) VALUES
('TC','Tài chính',1,'Viễn cảnh tài chính','#1D4ED8','HIEU_LUC','system','system'),
('KH','Khách hàng',2,'Viễn cảnh khách hàng','#059669','HIEU_LUC','system','system'),
('QT','Quy trình nội bộ',3,'Viễn cảnh quy trình nội bộ','#D97706','HIEU_LUC','system','system'),
('HP','Học hỏi & phát triển',4,'Viễn cảnh học hỏi và phát triển','#7C3AED','HIEU_LUC','system','system');

-- ---------- Lịch đồng bộ (26.17–26.19) ----------
INSERT IGNORE INTO sync_schedule (code, name, job_type, cron, enabled, params, created_by, updated_by) VALUES
('DONG_BO_KQ','Đồng bộ kết quả KPI','DONG_BO_KET_QUA_KPI','0 0 1 * * ?',1,'{}','system','system'),
('HOAN_TAT_CL','Hoàn tất chiến lược','HOAN_TAT_CHIEN_LUOC','0 30 0 1 1 ?',1,'{}','system','system'),
('NHAC_HAN','Nhắc hạn cập nhật kết quả','NHAC_HAN_CAP_NHAT','0 0 8 * * ?',1,'{}','system','system'),
('TINH_LAI_BSC','Tính lại điểm BSC','TINH_LAI_BSC','0 0 2 * * ?',0,'{}','system','system'),
('DONG_BO_HRM','Đồng bộ HRM','DONG_BO_HRM','0 0 4 * * ?',0,'{}','system','system'),
('SAO_LUU','Sao lưu logic dữ liệu','SAO_LUU_LOGIC','0 0 3 ? * SUN',1,'{}','system','system');

-- ---------- Mẫu báo cáo (JXLS, file trên MinIO — tự sinh mặc định khi khởi động) ----------
INSERT IGNORE INTO report_template (code, name, version, active, created_by, updated_by) VALUES
('TTR94_TONG_HOP','Báo cáo TTr94 tổng hợp BSC',1,1,'system','system'),
('TTR94_CHI_TIET','Báo cáo TTr94 chi tiết KPI',1,1,'system','system'),
('KPI_TUNG_TINH','Báo cáo KPI từng tỉnh',1,1,'system','system'),
('BIEU_GIAO_KPI','Biểu giao KPI',1,1,'system','system'),
('BIEU_KET_QUA_KPI','Biểu kết quả KPI',1,1,'system','system'),
('KQ_DANH_GIA_DON_VI','Kết quả đánh giá KPI đơn vị',1,1,'system','system'),
('BANG_TH_TCT','Bảng tổng hợp kết quả KPI giao cho đơn vị',1,1,'system','system');
