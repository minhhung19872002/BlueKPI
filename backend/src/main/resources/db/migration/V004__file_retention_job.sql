-- P8: job dọn tệp hết hạn lưu giữ (file_object.retention_until) — PHẦN B §9.7
ALTER TABLE sync_schedule DROP CONSTRAINT ck_ss_job;
ALTER TABLE sync_schedule ADD CONSTRAINT ck_ss_job CHECK (job_type IN ('DONG_BO_KET_QUA_KPI','HOAN_TAT_CHIEN_LUOC','NHAC_HAN_CAP_NHAT','TINH_LAI_BSC','DONG_BO_HRM','SAO_LUU_LOGIC','DON_DEP_TEP'));

INSERT IGNORE INTO sync_schedule (code, name, job_type, cron, enabled, params, created_by, updated_by) VALUES
('DON_DEP_TEP','Dọn tệp hết hạn lưu giữ','DON_DEP_TEP','0 30 3 * * ?',1,'{}','system','system');
