-- =====================================================================
-- Seed đơn vị (PHẦN C §5): “1. Công ty mẹ – Tập đoàn”, các Tổng công ty/Công ty,
-- Khối VNPT tỉnh/thành phố theo địa giới hành chính hiện hành (34 tỉnh/thành từ 01/07/2025),
-- phòng ban mẫu cấp Tập đoàn; tài khoản admin. Idempotent theo mã đơn vị.
-- =====================================================================

INSERT INTO org_unit (code, name, short_name, parent_id, unit_type, region_code, is_kpi_assignable, sort_order, path, level, created_by, updated_by)
VALUES ('VNPT','1. Công ty mẹ – Tập đoàn','Tập đoàn',NULL,'CONG_TY_ME',NULL,1,1,'/',1,'system','system')
ON DUPLICATE KEY UPDATE name = VALUES(name);
SET @root = (SELECT id FROM org_unit WHERE code = 'VNPT' AND deleted = 0);
UPDATE org_unit SET path = CONCAT('/', id, '/'), level = 1 WHERE id = @root;

INSERT INTO org_unit (code, name, short_name, parent_id, unit_type, region_code, is_kpi_assignable, sort_order, path, level, created_by, updated_by) VALUES
('VNPT_VINAPHONE','Tổng công ty Dịch vụ Viễn thông (VNPT VinaPhone)','VNPT VinaPhone',@root,'TONG_CONG_TY',NULL,1,10,'/',2,'system','system'),
('VNPT_NET','Tổng công ty Hạ tầng mạng (VNPT Net)','VNPT Net',@root,'TONG_CONG_TY',NULL,1,11,'/',2,'system','system'),
('VNPT_MEDIA','Tổng công ty Truyền thông (VNPT Media)','VNPT Media',@root,'TONG_CONG_TY',NULL,1,12,'/',2,'system','system'),
('VNPT_IT','Công ty Công nghệ thông tin VNPT (VNPT-IT)','VNPT-IT',@root,'CONG_TY',NULL,1,13,'/',2,'system','system'),
('VNPT_TECH','Công ty Công nghệ Công nghiệp Bưu chính Viễn thông (VNPT Technology)','VNPT Technology',@root,'CONG_TY',NULL,1,14,'/',2,'system','system'),
('VNPT_I','Công ty Viễn thông Quốc tế (VNPT-I)','VNPT-I',@root,'CONG_TY',NULL,1,15,'/',2,'system','system'),
('BAN_KHDT','Ban Kế hoạch – Đầu tư','Ban KHĐT',@root,'PHONG_BAN',NULL,0,90,'/',2,'system','system'),
('BAN_KTTD','Ban Kiểm tra – Thẩm định','Ban KTTĐ',@root,'PHONG_BAN',NULL,0,91,'/',2,'system','system'),
('BAN_TCNL','Ban Tổ chức – Nhân lực','Ban TCNL',@root,'PHONG_BAN',NULL,0,92,'/',2,'system','system'),
('VNPT_HNI','VNPT Hà Nội','VNPT HNI',@root,'VNPT_TINH','MB',1,101,'/',2,'system','system'),
('VNPT_HPG','VNPT Hải Phòng','VNPT HPG',@root,'VNPT_TINH','MB',1,102,'/',2,'system','system'),
('VNPT_QNH','VNPT Quảng Ninh','VNPT QNH',@root,'VNPT_TINH','MB',1,103,'/',2,'system','system'),
('VNPT_CBG','VNPT Cao Bằng','VNPT CBG',@root,'VNPT_TINH','MB',1,104,'/',2,'system','system'),
('VNPT_TQG','VNPT Tuyên Quang','VNPT TQG',@root,'VNPT_TINH','MB',1,105,'/',2,'system','system'),
('VNPT_LCI','VNPT Lào Cai','VNPT LCI',@root,'VNPT_TINH','MB',1,106,'/',2,'system','system'),
('VNPT_TNN','VNPT Thái Nguyên','VNPT TNN',@root,'VNPT_TINH','MB',1,107,'/',2,'system','system'),
('VNPT_LSN','VNPT Lạng Sơn','VNPT LSN',@root,'VNPT_TINH','MB',1,108,'/',2,'system','system'),
('VNPT_PTO','VNPT Phú Thọ','VNPT PTO',@root,'VNPT_TINH','MB',1,109,'/',2,'system','system'),
('VNPT_BNH','VNPT Bắc Ninh','VNPT BNH',@root,'VNPT_TINH','MB',1,110,'/',2,'system','system'),
('VNPT_HYN','VNPT Hưng Yên','VNPT HYN',@root,'VNPT_TINH','MB',1,111,'/',2,'system','system'),
('VNPT_NBH','VNPT Ninh Bình','VNPT NBH',@root,'VNPT_TINH','MB',1,112,'/',2,'system','system'),
('VNPT_LCU','VNPT Lai Châu','VNPT LCU',@root,'VNPT_TINH','MB',1,113,'/',2,'system','system'),
('VNPT_DBN','VNPT Điện Biên','VNPT DBN',@root,'VNPT_TINH','MB',1,114,'/',2,'system','system'),
('VNPT_SLA','VNPT Sơn La','VNPT SLA',@root,'VNPT_TINH','MB',1,115,'/',2,'system','system'),
('VNPT_THA','VNPT Thanh Hóa','VNPT THA',@root,'VNPT_TINH','MT',1,116,'/',2,'system','system'),
('VNPT_NAN','VNPT Nghệ An','VNPT NAN',@root,'VNPT_TINH','MT',1,117,'/',2,'system','system'),
('VNPT_HTH','VNPT Hà Tĩnh','VNPT HTH',@root,'VNPT_TINH','MT',1,118,'/',2,'system','system'),
('VNPT_QTI','VNPT Quảng Trị','VNPT QTI',@root,'VNPT_TINH','MT',1,119,'/',2,'system','system'),
('VNPT_HUE','VNPT Huế','VNPT HUE',@root,'VNPT_TINH','MT',1,120,'/',2,'system','system'),
('VNPT_DNG','VNPT Đà Nẵng','VNPT DNG',@root,'VNPT_TINH','MT',1,121,'/',2,'system','system'),
('VNPT_QNI','VNPT Quảng Ngãi','VNPT QNI',@root,'VNPT_TINH','MT',1,122,'/',2,'system','system'),
('VNPT_GLI','VNPT Gia Lai','VNPT GLI',@root,'VNPT_TINH','MT',1,123,'/',2,'system','system'),
('VNPT_KHA','VNPT Khánh Hòa','VNPT KHA',@root,'VNPT_TINH','MT',1,124,'/',2,'system','system'),
('VNPT_DLK','VNPT Đắk Lắk','VNPT DLK',@root,'VNPT_TINH','MT',1,125,'/',2,'system','system'),
('VNPT_LDG','VNPT Lâm Đồng','VNPT LDG',@root,'VNPT_TINH','MN',1,126,'/',2,'system','system'),
('VNPT_HCM','VNPT TP. Hồ Chí Minh','VNPT HCM',@root,'VNPT_TINH','MN',1,127,'/',2,'system','system'),
('VNPT_DNI','VNPT Đồng Nai','VNPT DNI',@root,'VNPT_TINH','MN',1,128,'/',2,'system','system'),
('VNPT_TNH','VNPT Tây Ninh','VNPT TNH',@root,'VNPT_TINH','MN',1,129,'/',2,'system','system'),
('VNPT_CTO','VNPT Cần Thơ','VNPT CTO',@root,'VNPT_TINH','MN',1,130,'/',2,'system','system'),
('VNPT_VLG','VNPT Vĩnh Long','VNPT VLG',@root,'VNPT_TINH','MN',1,131,'/',2,'system','system'),
('VNPT_DTP','VNPT Đồng Tháp','VNPT DTP',@root,'VNPT_TINH','MN',1,132,'/',2,'system','system'),
('VNPT_CMU','VNPT Cà Mau','VNPT CMU',@root,'VNPT_TINH','MN',1,133,'/',2,'system','system'),
('VNPT_AGG','VNPT An Giang','VNPT AGG',@root,'VNPT_TINH','MN',1,134,'/',2,'system','system')
ON DUPLICATE KEY UPDATE name = VALUES(name), short_name = VALUES(short_name);

UPDATE org_unit c JOIN org_unit p ON p.id = c.parent_id
SET c.path = CONCAT(p.path, c.id, '/'), c.level = p.level + 1
WHERE c.parent_id = @root AND c.deleted = 0;

-- Tài khoản quản trị (mật khẩu khởi tạo phải đổi trước khi chạy production — xem docs/TRIEN-KHAI.md)
INSERT INTO app_user (username, full_name, email, org_unit_id, status, auth_source, password_hash, password_changed_at, created_by, updated_by)
VALUES ('admin','Quản trị hệ thống','admin@vnpt.vn',@root,'HOAT_DONG','BOTH',
        '$2a$12$o7K1Xsbln3wG3ZLymyDEHOdud8BZx6YZu9yUsTw4ck/eJLk3YLUpy',NULL,'system','system')
ON DUPLICATE KEY UPDATE full_name = full_name;

INSERT INTO user_role (user_id, role_id, org_unit_id, assigned_by)
SELECT u.id, r.id, NULL, 'system' FROM app_user u JOIN role r ON r.code = 'ADMIN_HT'
WHERE u.username = 'admin' AND u.deleted = 0
  AND NOT EXISTS (SELECT 1 FROM user_role x WHERE x.user_id = u.id AND x.role_id = r.id);
