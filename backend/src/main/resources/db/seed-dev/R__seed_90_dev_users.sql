-- =====================================================================
-- Seed DEV/DEMO (PHẦN D §2): phòng ban mẫu cho mỗi đơn vị cấp 2, tài khoản test mỗi vai trò.
-- Mật khẩu dev cho mọi tài khoản: Kpi@2026 (in trong README; production phải đổi)
-- =====================================================================

-- 2 phòng ban cho mỗi Tổng công ty/Công ty/VNPT tỉnh
INSERT INTO org_unit (code, name, short_name, parent_id, unit_type, region_code, is_kpi_assignable, sort_order, path, level, created_by, updated_by)
SELECT CONCAT(p.code, '_KHKD'), CONCAT('Phòng Kế hoạch – Kinh doanh (', p.short_name, ')'), 'P.KHKD', p.id, 'PHONG_BAN', p.region_code, 1, 1, '/', 3, 'system', 'system'
FROM org_unit p WHERE p.level = 2 AND p.unit_type IN ('TONG_CONG_TY','CONG_TY','VNPT_TINH') AND p.deleted = 0
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO org_unit (code, name, short_name, parent_id, unit_type, region_code, is_kpi_assignable, sort_order, path, level, created_by, updated_by)
SELECT CONCAT(p.code, '_KTDT'), CONCAT('Phòng Kỹ thuật – Đầu tư (', p.short_name, ')'), 'P.KTĐT', p.id, 'PHONG_BAN', p.region_code, 1, 2, '/', 3, 'system', 'system'
FROM org_unit p WHERE p.level = 2 AND p.unit_type IN ('TONG_CONG_TY','CONG_TY','VNPT_TINH') AND p.deleted = 0
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Trung tâm trực thuộc Tổng công ty (đơn vị con cho bảng 17.7)
INSERT INTO org_unit (code, name, short_name, parent_id, unit_type, region_code, is_kpi_assignable, sort_order, path, level, created_by, updated_by)
SELECT CONCAT(p.code, '_TT1'), CONCAT('Trung tâm Kinh doanh 1 (', p.short_name, ')'), 'TT KD1', p.id, 'TRUNG_TAM', NULL, 1, 3, '/', 3, 'system', 'system'
FROM org_unit p WHERE p.level = 2 AND p.unit_type IN ('TONG_CONG_TY','CONG_TY') AND p.deleted = 0
ON DUPLICATE KEY UPDATE name = VALUES(name);

UPDATE org_unit c JOIN org_unit p ON p.id = c.parent_id
SET c.path = CONCAT(p.path, c.id, '/'), c.level = p.level + 1
WHERE c.level = 3 AND c.deleted = 0;

SET @root = (SELECT id FROM org_unit WHERE code = 'VNPT' AND deleted = 0);
SET @hni = (SELECT id FROM org_unit WHERE code = 'VNPT_HNI' AND deleted = 0);
SET @hcm = (SELECT id FROM org_unit WHERE code = 'VNPT_HCM' AND deleted = 0);
SET @pw = '$2a$12$o7K1Xsbln3wG3ZLymyDEHOdud8BZx6YZu9yUsTw4ck/eJLk3YLUpy';

INSERT INTO app_user (username, full_name, email, org_unit_id, status, auth_source, password_hash, created_by, updated_by) VALUES
('lanhdao','Nguyễn Văn Lãnh Đạo','lanhdao@vnpt.vn',@root,'HOAT_DONG','BOTH',@pw,'system','system'),
('tgd','Trần Thị Tổng Giám Đốc','tgd@vnpt.vn',@root,'HOAT_DONG','BOTH',@pw,'system','system'),
('admintd','Lê Văn Admin Tập Đoàn','admintd@vnpt.vn',@root,'HOAT_DONG','BOTH',@pw,'system','system'),
('qtgiao','Phạm Thị Quản Trị Giao','qtgiao@vnpt.vn',@root,'HOAT_DONG','BOTH',@pw,'system','system'),
('qtthamdinh','Hoàng Văn Thẩm Định','qtthamdinh@vnpt.vn',@root,'HOAT_DONG','BOTH',@pw,'system','system'),
('giaokpi','Vũ Thị Giao KPI','giaokpi@vnpt.vn',@root,'HOAT_DONG','BOTH',@pw,'system','system'),
('phoihop','Đặng Văn Phối Hợp','phoihop@vnpt.vn',@root,'HOAT_DONG','BOTH',@pw,'system','system'),
('danhgia','Bùi Thị Đánh Giá','danhgia@vnpt.vn',@root,'HOAT_DONG','BOTH',@pw,'system','system'),
('lapchienluoc','Đỗ Văn Chiến Lược','lapchienluoc@vnpt.vn',@root,'HOAT_DONG','BOTH',@pw,'system','system'),
('tinh_hni','Ngô Thị Hà Nội','tinh_hni@vnpt.vn',@hni,'HOAT_DONG','BOTH',@pw,'system','system'),
('tinh_hcm','Lý Văn Sài Gòn','tinh_hcm@vnpt.vn',@hcm,'HOAT_DONG','BOTH',@pw,'system','system'),
('khoa_test','Tài khoản bị khóa','khoa_test@vnpt.vn',@hni,'KHOA','LOCAL',@pw,'system','system'),
('ngung_test','Tài khoản ngưng hoạt động','ngung_test@vnpt.vn',@hni,'NGUNG','LOCAL',@pw,'system','system')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

INSERT INTO user_role (user_id, role_id, org_unit_id, assigned_by)
SELECT u.id, r.id, NULL, 'system'
FROM (SELECT 'lanhdao' un, 'LANH_DAO_TD' rc UNION ALL SELECT 'tgd','TONG_GIAM_DOC' UNION ALL SELECT 'admintd','ADMIN_TD'
      UNION ALL SELECT 'qtgiao','QT_TH_GIAO' UNION ALL SELECT 'qtthamdinh','QT_TH_THAM_DINH' UNION ALL SELECT 'giaokpi','GIAO_KPI'
      UNION ALL SELECT 'phoihop','PHOI_HOP_KPI' UNION ALL SELECT 'danhgia','DANH_GIA_KPI' UNION ALL SELECT 'lapchienluoc','LAP_CHIEN_LUOC'
      UNION ALL SELECT 'tinh_hni','NGUOI_DUNG_DV' UNION ALL SELECT 'tinh_hcm','NGUOI_DUNG_DV'
      UNION ALL SELECT 'khoa_test','NGUOI_DUNG_DV' UNION ALL SELECT 'ngung_test','NGUOI_DUNG_DV') m
JOIN app_user u ON u.username = m.un AND u.deleted = 0
JOIN role r ON r.code = m.rc
WHERE NOT EXISTS (SELECT 1 FROM user_role x WHERE x.user_id = u.id AND x.role_id = r.id);
