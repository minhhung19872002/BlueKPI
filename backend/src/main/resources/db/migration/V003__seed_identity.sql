-- =====================================================================
-- V003 — Seed mã quyền (PHẦN B §5), vai trò (PHẦN B §1.2), gán quyền mặc định cho vai trò
-- Versioned (chạy 1 lần) để không ghi đè chỉnh sửa của quản trị viên trên vai trò hệ thống.
-- =====================================================================

INSERT INTO permission (code, name, module, menu_code, description, sort_order, created_by, updated_by) VALUES
('USER:VIEW','Xem người dùng','USER','SYSTEM','Xem danh sách, chi tiết người dùng',101,'system','system'),
('USER:CREATE','Thêm người dùng','USER','SYSTEM',NULL,102,'system','system'),
('USER:UPDATE','Sửa người dùng','USER','SYSTEM',NULL,103,'system','system'),
('USER:DELETE','Xóa người dùng','USER','SYSTEM',NULL,104,'system','system'),
('USER:IMPORT','Nhập dữ liệu người dùng','USER','SYSTEM',NULL,105,'system','system'),
('USER:EXPORT','Xuất dữ liệu người dùng','USER','SYSTEM',NULL,106,'system','system'),
('USER:ASSIGN_ROLE','Gán vai trò cho người dùng','USER','SYSTEM',NULL,107,'system','system'),
('ROLE:VIEW','Xem vai trò','ROLE','SYSTEM',NULL,111,'system','system'),
('ROLE:CREATE','Thêm vai trò','ROLE','SYSTEM',NULL,112,'system','system'),
('ROLE:UPDATE','Sửa vai trò','ROLE','SYSTEM',NULL,113,'system','system'),
('ROLE:DELETE','Xóa vai trò','ROLE','SYSTEM',NULL,114,'system','system'),
('PERMISSION:VIEW','Xem quyền','PERMISSION','SYSTEM',NULL,121,'system','system'),
('PERMISSION:UPDATE','Sửa quyền','PERMISSION','SYSTEM',NULL,122,'system','system'),
('ORG:VIEW','Xem đơn vị','ORG','SYSTEM',NULL,131,'system','system'),
('ORG:CREATE','Thêm đơn vị','ORG','SYSTEM',NULL,132,'system','system'),
('ORG:UPDATE','Sửa đơn vị','ORG','SYSTEM',NULL,133,'system','system'),
('ORG:DELETE','Xóa đơn vị','ORG','SYSTEM',NULL,134,'system','system'),
('ORG:IMPORT','Nhập dữ liệu đơn vị','ORG','SYSTEM',NULL,135,'system','system'),
('ORG:EXPORT','Xuất dữ liệu đơn vị','ORG','SYSTEM',NULL,136,'system','system'),
('SCHEDULE:VIEW','Xem lịch đồng bộ','SCHEDULE','SYSTEM',NULL,141,'system','system'),
('SCHEDULE:UPDATE','Sửa lịch đồng bộ','SCHEDULE','SYSTEM',NULL,142,'system','system'),
('SCHEDULE:RUN','Chạy ngay lịch đồng bộ','SCHEDULE','SYSTEM',NULL,143,'system','system'),
('SYSCONFIG:VIEW','Xem tham số hệ thống','SYSCONFIG','SYSTEM',NULL,151,'system','system'),
('SYSCONFIG:CREATE','Thêm tham số hệ thống','SYSCONFIG','SYSTEM',NULL,152,'system','system'),
('SYSCONFIG:UPDATE','Sửa tham số hệ thống','SYSCONFIG','SYSTEM',NULL,153,'system','system'),
('SYSCONFIG:DELETE','Xóa tham số hệ thống','SYSCONFIG','SYSTEM',NULL,154,'system','system'),
('AUDIT:VIEW','Xem nhật ký hệ thống','AUDIT','SYSTEM','Bổ sung ngoài E-HSMT (PHẦN D §1.a)',161,'system','system'),
('DASHBOARD:VIEW_GROUP','Xem biểu tổng hợp Tập đoàn','DASHBOARD','DASHBOARD',NULL,201,'system','system'),
('DASHBOARD:VIEW_UNIT','Xem biểu tổng hợp Đơn vị','DASHBOARD','DASHBOARD',NULL,202,'system','system'),
('DASHBOARD:VIEW_PROVINCE','Xem biểu tổng hợp Tỉnh','DASHBOARD','DASHBOARD',NULL,203,'system','system'),
('DASHBOARD:EXPORT','Xuất dữ liệu Dashboard','DASHBOARD','DASHBOARD',NULL,204,'system','system'),
('MYKPI:VIEW','Xem KPI đơn vị của tôi','MYKPI','MYKPI',NULL,301,'system','system'),
('MYKPI:PROPOSE_ADJUST','Đề nghị điều chỉnh kết quả KPI','MYKPI','MYKPI',NULL,302,'system','system'),
('MYKPI:EXPORT','Xuất kết quả đánh giá KPI theo mẫu','MYKPI','MYKPI',NULL,303,'system','system'),
('KPI:VIEW','Xem danh mục chỉ tiêu KPI','KPI','KPI_CATALOG',NULL,401,'system','system'),
('KPI:CREATE','Thêm tiêu chí KPI','KPI','KPI_CATALOG',NULL,402,'system','system'),
('KPI:UPDATE','Sửa tiêu chí KPI','KPI','KPI_CATALOG',NULL,403,'system','system'),
('KPI:DELETE','Xóa tiêu chí KPI','KPI','KPI_CATALOG',NULL,404,'system','system'),
('KPI:IMPORT','Nhập dữ liệu KPI','KPI','KPI_CATALOG',NULL,405,'system','system'),
('KPI:EXPORT','Xuất dữ liệu KPI','KPI','KPI_CATALOG',NULL,406,'system','system'),
('UOM:VIEW','Xem đơn vị đo','UOM','KPI_CATALOG',NULL,411,'system','system'),
('UOM:CREATE','Thêm đơn vị đo','UOM','KPI_CATALOG',NULL,412,'system','system'),
('UOM:UPDATE','Sửa đơn vị đo','UOM','KPI_CATALOG',NULL,413,'system','system'),
('UOM:DELETE','Xóa đơn vị đo','UOM','KPI_CATALOG',NULL,414,'system','system'),
('UOM:IMPORT','Nhập dữ liệu đơn vị đo','UOM','KPI_CATALOG',NULL,415,'system','system'),
('UOM:EXPORT','Xuất dữ liệu đơn vị đo','UOM','KPI_CATALOG',NULL,416,'system','system'),
('PERSPECTIVE:VIEW','Xem viễn cảnh','PERSPECTIVE','KPI_CATALOG',NULL,421,'system','system'),
('PERSPECTIVE:CREATE','Thêm viễn cảnh','PERSPECTIVE','KPI_CATALOG',NULL,422,'system','system'),
('PERSPECTIVE:UPDATE','Sửa viễn cảnh','PERSPECTIVE','KPI_CATALOG',NULL,423,'system','system'),
('PERSPECTIVE:DELETE','Xóa viễn cảnh','PERSPECTIVE','KPI_CATALOG',NULL,424,'system','system'),
('PERSPECTIVE:IMPORT','Nhập dữ liệu viễn cảnh','PERSPECTIVE','KPI_CATALOG',NULL,425,'system','system'),
('PERSPECTIVE:EXPORT','Xuất dữ liệu viễn cảnh','PERSPECTIVE','KPI_CATALOG',NULL,426,'system','system'),
('OBJECTIVE:VIEW','Xem mục tiêu trọng tâm','OBJECTIVE','OBJECTIVE',NULL,431,'system','system'),
('OBJECTIVE:CREATE','Thêm mục tiêu trọng tâm','OBJECTIVE','OBJECTIVE',NULL,432,'system','system'),
('OBJECTIVE:UPDATE','Sửa mục tiêu trọng tâm','OBJECTIVE','OBJECTIVE',NULL,433,'system','system'),
('OBJECTIVE:DELETE','Xóa mục tiêu trọng tâm','OBJECTIVE','OBJECTIVE',NULL,434,'system','system'),
('OBJECTIVE:IMPORT','Nhập dữ liệu mục tiêu trọng tâm','OBJECTIVE','OBJECTIVE',NULL,435,'system','system'),
('OBJECTIVE:EXPORT','Xuất dữ liệu mục tiêu trọng tâm','OBJECTIVE','OBJECTIVE',NULL,436,'system','system'),
('FORMULA:VIEW','Xem định nghĩa KPI công thức','FORMULA','KPI_CATALOG',NULL,441,'system','system'),
('FORMULA:CREATE','Thêm định nghĩa KPI công thức','FORMULA','KPI_CATALOG',NULL,442,'system','system'),
('FORMULA:UPDATE','Sửa định nghĩa KPI công thức','FORMULA','KPI_CATALOG',NULL,443,'system','system'),
('FORMULA:DELETE','Xóa định nghĩa KPI công thức','FORMULA','KPI_CATALOG',NULL,444,'system','system'),
('FORMULA:TEST','Kiểm tra kết nối / biểu thức','FORMULA','KPI_CATALOG',NULL,445,'system','system'),
('ASSIGN:VIEW','Xem giao KPI','ASSIGN','ASSIGN',NULL,501,'system','system'),
('ASSIGN:CREATE','Thêm giao KPI','ASSIGN','ASSIGN',NULL,502,'system','system'),
('ASSIGN:UPDATE','Sửa giao KPI','ASSIGN','ASSIGN',NULL,503,'system','system'),
('ASSIGN:DELETE','Xóa giao KPI','ASSIGN','ASSIGN',NULL,504,'system','system'),
('ASSIGN:COPY','Sao chép giao KPI','ASSIGN','ASSIGN',NULL,505,'system','system'),
('ASSIGN:CLOSE','Chốt số liệu giao KPI','ASSIGN','ASSIGN',NULL,506,'system','system'),
('ASSIGN:ADJUST','Điều chỉnh mục tiêu giao KPI','ASSIGN','ASSIGN',NULL,507,'system','system'),
('ASSIGN:IMPORT','Nhập dữ liệu giao KPI','ASSIGN','ASSIGN',NULL,508,'system','system'),
('ASSIGN:EXPORT','Xuất dữ liệu giao KPI','ASSIGN','ASSIGN',NULL,509,'system','system'),
('STRATEGY:VIEW','Xem bản đồ chiến lược','STRATEGY','STRATEGY',NULL,601,'system','system'),
('STRATEGY:CREATE','Thêm chiến lược','STRATEGY','STRATEGY',NULL,602,'system','system'),
('STRATEGY:UPDATE','Cập nhật chiến lược','STRATEGY','STRATEGY',NULL,603,'system','system'),
('STRATEGY:DELETE','Xóa chiến lược','STRATEGY','STRATEGY',NULL,604,'system','system'),
('STRATEGY:ASSIGN_KPI','Gán khung KPI vào chiến lược','STRATEGY','STRATEGY',NULL,605,'system','system'),
('STRATEGY:EXPORT_IMAGE','Tải ảnh bản đồ chiến lược','STRATEGY','STRATEGY',NULL,606,'system','system'),
('EVAL:VIEW','Xem đánh giá KPI','EVAL','EVAL',NULL,701,'system','system'),
('EVAL:SYNC','Đồng bộ lại kết quả','EVAL','EVAL',NULL,702,'system','system'),
('EVAL:INPUT','Nhập kết quả đánh giá','EVAL','EVAL',NULL,703,'system','system'),
('EVAL:IMPORT','Nhập dữ liệu nhập tay từ file','EVAL','EVAL',NULL,704,'system','system'),
('EVAL:ADJUST','Điều chỉnh kết quả KPI cho đơn vị','EVAL','EVAL',NULL,705,'system','system'),
('EVAL:CLOSE_R2','Chốt kết quả R2','EVAL','EVAL',NULL,706,'system','system'),
('BSC:VIEW','Xem tổng hợp kết quả BSC','BSC','BSC',NULL,801,'system','system'),
('BSC:REVOKE','Thu hồi kết quả đánh giá','BSC','BSC',NULL,802,'system','system'),
('BSC:RECALC','Tính lại điểm đánh giá','BSC','BSC',NULL,803,'system','system'),
('BSC:CLOSE','Chốt đánh giá KPI','BSC','BSC',NULL,804,'system','system'),
('BSC:APPROVE','Tổng giám đốc duyệt','BSC','BSC',NULL,805,'system','system'),
('BSC:REPORT','Xuất báo cáo BSC','BSC','BSC',NULL,806,'system','system'),
('NOTIFY:VIEW','Xem thông báo','NOTIFY',NULL,NULL,901,'system','system');

INSERT INTO role (code, name, description, status, data_scope, is_system, created_by, updated_by) VALUES
('ADMIN_HT','Admin hệ thống','Quản trị toàn bộ hệ thống','HIEU_LUC','ALL',1,'system','system'),
('LANH_DAO_TD','Lãnh đạo Tập đoàn','Xem toàn bộ (chỉ xem)','HIEU_LUC','ALL',1,'system','system'),
('TONG_GIAM_DOC','Tổng giám đốc','Xem toàn bộ + Tổng giám đốc duyệt','HIEU_LUC','ALL',1,'system','system'),
('ADMIN_TD','Admin Tập đoàn/Admin','Quản trị nghiệp vụ cấp Tập đoàn','HIEU_LUC','ALL',1,'system','system'),
('QT_TH_GIAO','Quản trị và Tổng hợp giao KPI','Quản trị danh mục và tổng hợp giao KPI','HIEU_LUC','ALL',1,'system','system'),
('QT_TH_THAM_DINH','Quản trị và tổng hợp thẩm định kết quả thực hiện','Thẩm định, chốt kết quả','HIEU_LUC','ALL',1,'system','system'),
('GIAO_KPI','Giao KPI','Giao KPI cho đơn vị mình và đơn vị con','HIEU_LUC','UNIT_AND_CHILDREN',1,'system','system'),
('PHOI_HOP_KPI','Phối hợp KPI','Phối hợp cập nhật kết quả KPI','HIEU_LUC','UNIT_AND_CHILDREN',1,'system','system'),
('DANH_GIA_KPI','Đánh giá KPI','Đánh giá kết quả KPI','HIEU_LUC','UNIT_AND_CHILDREN',1,'system','system'),
('LAP_CHIEN_LUOC','Lập chiến lược','Lập bản đồ chiến lược','HIEU_LUC','UNIT_AND_CHILDREN',1,'system','system'),
('NGUOI_DUNG_DV','Người dùng đơn vị','Xem KPI của đơn vị mình','HIEU_LUC','UNIT',1,'system','system');

-- Gán quyền mặc định
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p WHERE r.code = 'ADMIN_HT';

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p
WHERE r.code IN ('LANH_DAO_TD','TONG_GIAM_DOC') AND p.code IN
 ('DASHBOARD:VIEW_GROUP','DASHBOARD:VIEW_UNIT','DASHBOARD:VIEW_PROVINCE','DASHBOARD:EXPORT','MYKPI:VIEW','MYKPI:EXPORT',
  'KPI:VIEW','UOM:VIEW','PERSPECTIVE:VIEW','OBJECTIVE:VIEW','FORMULA:VIEW','ASSIGN:VIEW','STRATEGY:VIEW','EVAL:VIEW',
  'BSC:VIEW','BSC:REPORT','NOTIFY:VIEW');

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p WHERE r.code = 'TONG_GIAM_DOC' AND p.code = 'BSC:APPROVE';

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p WHERE r.code = 'ADMIN_TD' AND p.code NOT IN ('AUDIT:VIEW','BSC:APPROVE');

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p WHERE r.code = 'QT_TH_GIAO' AND (
  p.module IN ('KPI','UOM','PERSPECTIVE','OBJECTIVE','FORMULA','ASSIGN')
  OR p.code IN ('STRATEGY:VIEW','EVAL:VIEW','BSC:VIEW','DASHBOARD:VIEW_GROUP','DASHBOARD:VIEW_UNIT','DASHBOARD:VIEW_PROVINCE',
                'DASHBOARD:EXPORT','MYKPI:VIEW','NOTIFY:VIEW'));

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p WHERE r.code = 'QT_TH_THAM_DINH' AND (
  p.module IN ('EVAL','DASHBOARD') OR (p.module = 'BSC' AND p.code <> 'BSC:APPROVE')
  OR p.code IN ('KPI:VIEW','UOM:VIEW','PERSPECTIVE:VIEW','OBJECTIVE:VIEW','FORMULA:VIEW','FORMULA:TEST','ASSIGN:VIEW',
                'STRATEGY:VIEW','MYKPI:VIEW','NOTIFY:VIEW'));

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p WHERE r.code = 'GIAO_KPI' AND (
  p.module = 'ASSIGN'
  OR p.code IN ('KPI:VIEW','UOM:VIEW','PERSPECTIVE:VIEW','OBJECTIVE:VIEW','STRATEGY:VIEW','DASHBOARD:VIEW_GROUP',
                'DASHBOARD:VIEW_UNIT','DASHBOARD:VIEW_PROVINCE','MYKPI:VIEW','NOTIFY:VIEW'));

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p WHERE r.code = 'PHOI_HOP_KPI' AND p.code IN
 ('ASSIGN:VIEW','EVAL:VIEW','EVAL:INPUT','KPI:VIEW','OBJECTIVE:VIEW','STRATEGY:VIEW','DASHBOARD:VIEW_GROUP',
  'DASHBOARD:VIEW_UNIT','DASHBOARD:VIEW_PROVINCE','MYKPI:VIEW','NOTIFY:VIEW');

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p WHERE r.code = 'DANH_GIA_KPI' AND p.code IN
 ('EVAL:VIEW','EVAL:SYNC','EVAL:INPUT','EVAL:IMPORT','EVAL:ADJUST','EVAL:CLOSE_R2','BSC:VIEW','KPI:VIEW','ASSIGN:VIEW',
  'STRATEGY:VIEW','DASHBOARD:VIEW_GROUP','DASHBOARD:VIEW_UNIT','DASHBOARD:VIEW_PROVINCE','MYKPI:VIEW','NOTIFY:VIEW');

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p WHERE r.code = 'LAP_CHIEN_LUOC' AND (
  p.module IN ('STRATEGY','OBJECTIVE')
  OR p.code IN ('KPI:VIEW','PERSPECTIVE:VIEW','DASHBOARD:VIEW_GROUP','DASHBOARD:VIEW_UNIT','DASHBOARD:VIEW_PROVINCE',
                'MYKPI:VIEW','NOTIFY:VIEW'));

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r JOIN permission p WHERE r.code = 'NGUOI_DUNG_DV' AND p.code IN
 ('MYKPI:VIEW','MYKPI:PROPOSE_ADJUST','MYKPI:EXPORT','DASHBOARD:VIEW_UNIT','NOTIFY:VIEW');
