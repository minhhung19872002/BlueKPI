-- Kiểm tra chéo PHẦN C §II: 17.6 “Xuất kết quả đánh giá KPI” / 17.8 “Xuất Bảng Excel” là chức năng của dashboard,
-- spec không tách quyền xuất → mọi vai trò được xem dashboard (Tập đoàn/tỉnh/đơn vị) đều được xuất.
-- Phạm vi dữ liệu xuất vẫn do backend kiểm (DashboardService.resolve + DataScopeService); bảng TCT/CT cần DASHBOARD:VIEW_GROUP.
INSERT IGNORE INTO role_permission (role_id, permission_id)
SELECT DISTINCT rp.role_id, pe.id
FROM role_permission rp
JOIN permission pv ON pv.id = rp.permission_id AND pv.code IN ('DASHBOARD:VIEW_GROUP', 'DASHBOARD:VIEW_PROVINCE', 'DASHBOARD:VIEW_UNIT')
JOIN permission pe ON pe.code = 'DASHBOARD:EXPORT';
