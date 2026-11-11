-- Hiệu năng “Nhật ký hệ thống” trên dữ liệu khối lượng lớn (seed-volume: 2 triệu bản ghi):
-- ORDER BY at DESC LIMIT 20 trước đây filesort toàn bảng (~3 s) → đọc theo index (at, id).
CREATE INDEX idx_audit_at ON audit_log (at, id);
