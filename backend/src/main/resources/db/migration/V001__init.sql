-- =====================================================================
-- V001 — Mô hình dữ liệu KPI-BSC (PHẦN B §4)
-- Charset utf8mb4 / utf8mb4_vietnamese_ci; enum lưu VARCHAR
-- Cột chuẩn bảng nghiệp vụ: created_by, created_at, updated_by, updated_at, version, deleted
-- Mã UNIQUE trên danh mục soft-delete: cột sinh `uk_code` (= code khi deleted=0) để cho phép
-- tạo lại mã đã xóa mềm mà vẫn đảm bảo duy nhất trong bản ghi còn hiệu lực.
-- =====================================================================

-- ---------- 4.1 Tổ chức / danh tính ----------
CREATE TABLE org_unit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(100),
  parent_id BIGINT NULL,
  unit_type VARCHAR(30) NOT NULL,
  region_code VARCHAR(30),
  is_kpi_assignable TINYINT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  path VARCHAR(500) NOT NULL DEFAULT '/',
  level INT NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'HIEU_LUC',
  hrm_ref VARCHAR(100),
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  uk_code VARCHAR(50) AS (CASE WHEN deleted = 0 THEN code END) PERSISTENT,
  UNIQUE KEY uk_org_unit_code (uk_code),
  KEY idx_org_unit_parent (parent_id),
  KEY idx_org_unit_path (path),
  KEY idx_org_unit_name (name),
  CONSTRAINT fk_org_unit_parent FOREIGN KEY (parent_id) REFERENCES org_unit(id),
  CONSTRAINT ck_org_unit_type CHECK (unit_type IN ('CONG_TY_ME','TONG_CONG_TY','CONG_TY','VNPT_TINH','TRUNG_TAM','PHONG_BAN'))
) ENGINE=InnoDB;

CREATE TABLE app_user (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(500) NULL COMMENT 'AES-256-GCM (EncryptedStringTypeHandler)',
  org_unit_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'HOAT_DONG',
  auth_source VARCHAR(10) NOT NULL DEFAULT 'BOTH',
  password_hash VARCHAR(100) NULL,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until DATETIME(3) NULL,
  password_changed_at DATETIME(3) NULL,
  last_login_at DATETIME(3) NULL,
  last_login_ip VARCHAR(64) NULL,
  hrm_ref VARCHAR(100),
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  uk_username VARCHAR(100) AS (CASE WHEN deleted = 0 THEN username END) PERSISTENT,
  uk_email VARCHAR(255) AS (CASE WHEN deleted = 0 THEN email END) PERSISTENT,
  UNIQUE KEY uk_app_user_username (uk_username),
  UNIQUE KEY uk_app_user_email (uk_email),
  KEY idx_app_user_org (org_unit_id),
  KEY idx_app_user_name (full_name),
  CONSTRAINT fk_app_user_org FOREIGN KEY (org_unit_id) REFERENCES org_unit(id),
  CONSTRAINT ck_app_user_status CHECK (status IN ('HOAT_DONG','KHOA','NGUNG')),
  CONSTRAINT ck_app_user_auth CHECK (auth_source IN ('LOCAL','CAS','BOTH'))
) ENGINE=InnoDB;

CREATE TABLE role (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(1000),
  status VARCHAR(20) NOT NULL DEFAULT 'HIEU_LUC',
  data_scope VARCHAR(30) NOT NULL DEFAULT 'UNIT',
  is_system TINYINT NOT NULL DEFAULT 0,
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  uk_code VARCHAR(50) AS (CASE WHEN deleted = 0 THEN code END) PERSISTENT,
  UNIQUE KEY uk_role_code (uk_code),
  CONSTRAINT ck_role_status CHECK (status IN ('HIEU_LUC','KHONG_HIEU_LUC')),
  CONSTRAINT ck_role_scope CHECK (data_scope IN ('ALL','UNIT','UNIT_AND_CHILDREN'))
) ENGINE=InnoDB;

CREATE TABLE permission (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  module VARCHAR(50) NOT NULL,
  menu_code VARCHAR(50),
  description VARCHAR(1000),
  sort_order INT NOT NULL DEFAULT 0,
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_permission_code (code)
) ENGINE=InnoDB;

CREATE TABLE menu (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  route VARCHAR(255),
  parent_id BIGINT NULL,
  icon VARCHAR(50),
  sort_order INT NOT NULL DEFAULT 0,
  permission_code VARCHAR(255) COMMENT 'Một hoặc nhiều mã quyền, phân tách bằng dấu phẩy (OR)',
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_menu_code (code),
  KEY idx_menu_parent (parent_id),
  CONSTRAINT fk_menu_parent FOREIGN KEY (parent_id) REFERENCES menu(id)
) ENGINE=InnoDB;

CREATE TABLE role_permission (
  role_id BIGINT NOT NULL,
  permission_id BIGINT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_rp_perm (permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES role(id),
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permission(id)
) ENGINE=InnoDB;

CREATE TABLE user_role (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  org_unit_id BIGINT NULL COMMENT 'Đơn vị áp dụng (giới hạn vai trò theo đơn vị)',
  assigned_by VARCHAR(100),
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_ur_user (user_id),
  KEY idx_ur_role (role_id),
  KEY idx_ur_org (org_unit_id),
  UNIQUE KEY uk_ur (user_id, role_id, org_unit_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES app_user(id),
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES role(id),
  CONSTRAINT fk_ur_org FOREIGN KEY (org_unit_id) REFERENCES org_unit(id)
) ENGINE=InnoDB;

CREATE TABLE user_session (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  last_seen_at DATETIME(3) NULL,
  revoked TINYINT NOT NULL DEFAULT 0,
  auth_method VARCHAR(10) NOT NULL DEFAULT 'LOCAL',
  ip VARCHAR(64),
  user_agent VARCHAR(500),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_session_hash (refresh_token_hash),
  KEY idx_session_user (user_id),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES app_user(id)
) ENGINE=InnoDB;

CREATE TABLE login_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100),
  result VARCHAR(30) NOT NULL,
  auth_method VARCHAR(10) NOT NULL,
  ip VARCHAR(64),
  user_agent VARCHAR(500),
  at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_login_log_user (username, at),
  KEY idx_login_log_at (at)
) ENGINE=InnoDB;

-- ---------- 4.2 Danh mục KPI ----------
CREATE TABLE unit_of_measure (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(1000),
  status VARCHAR(20) NOT NULL DEFAULT 'HIEU_LUC',
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  uk_code VARCHAR(30) AS (CASE WHEN deleted = 0 THEN code END) PERSISTENT,
  uk_name VARCHAR(255) AS (CASE WHEN deleted = 0 THEN name END) PERSISTENT,
  UNIQUE KEY uk_uom_code (uk_code),
  UNIQUE KEY uk_uom_name (uk_name),
  CONSTRAINT ck_uom_status CHECK (status IN ('HIEU_LUC','KHONG_HIEU_LUC'))
) ENGINE=InnoDB;

CREATE TABLE perspective (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  description VARCHAR(1000),
  color VARCHAR(7) NOT NULL DEFAULT '#2563EB',
  status VARCHAR(20) NOT NULL DEFAULT 'HIEU_LUC',
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  uk_code VARCHAR(10) AS (CASE WHEN deleted = 0 THEN code END) PERSISTENT,
  UNIQUE KEY uk_perspective_code (uk_code),
  CONSTRAINT ck_perspective_color CHECK (color REGEXP '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT ck_perspective_status CHECK (status IN ('HIEU_LUC','KHONG_HIEU_LUC'))
) ENGINE=InnoDB;

CREATE TABLE strategic_objective (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(500) NOT NULL,
  perspective_id BIGINT NOT NULL,
  description VARCHAR(2000),
  status VARCHAR(20) NOT NULL DEFAULT 'HIEU_LUC',
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  uk_code VARCHAR(50) AS (CASE WHEN deleted = 0 THEN code END) PERSISTENT,
  UNIQUE KEY uk_objective_code (uk_code),
  KEY idx_objective_perspective (perspective_id),
  CONSTRAINT fk_objective_perspective FOREIGN KEY (perspective_id) REFERENCES perspective(id)
) ENGINE=InnoDB;

CREATE TABLE formula_definition (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(500) NOT NULL,
  definition_type VARCHAR(30) NOT NULL,
  data_type VARCHAR(20) NOT NULL,
  expression VARCHAR(2000),
  source_definition JSON,
  api_path VARCHAR(1000),
  http_method VARCHAR(10) DEFAULT 'GET',
  response_path VARCHAR(500),
  business_description VARCHAR(2000),
  status VARCHAR(20) NOT NULL DEFAULT 'HIEU_LUC',
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  uk_code VARCHAR(50) AS (CASE WHEN deleted = 0 THEN code END) PERSISTENT,
  UNIQUE KEY uk_formula_code (uk_code),
  CONSTRAINT ck_formula_type CHECK (definition_type IN ('THANH_PHAN_API','THANH_PHAN_NHAP_TAY','CONG_THUC_TONG_HOP')),
  CONSTRAINT ck_formula_dtype CHECK (data_type IN ('SO','TY_LE','TIEN_TE','SO_LUONG')),
  CONSTRAINT ck_formula_method CHECK (http_method IS NULL OR http_method IN ('GET','POST'))
) ENGINE=InnoDB;

CREATE TABLE scoring_method (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,
  config JSON,
  status VARCHAR(20) NOT NULL DEFAULT 'HIEU_LUC',
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_scoring_code (code),
  CONSTRAINT ck_scoring_type CHECK (type IN ('KHUNG_TY_LE','DAT_KHONG_DAT','NHAP_DIEM'))
) ENGINE=InnoDB;

CREATE TABLE evaluation_stage (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  from_year INT NOT NULL,
  to_year INT NOT NULL,
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_stage_code (code),
  CONSTRAINT ck_stage_years CHECK (to_year >= from_year)
) ENGINE=InnoDB;

CREATE TABLE kpi (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(500) NOT NULL,
  structure VARCHAR(10) NOT NULL DEFAULT 'DON_LE',
  parent_id BIGINT NULL,
  group_aggregation VARCHAR(30) NOT NULL,
  group_expression VARCHAR(2000),
  perspective_id BIGINT NOT NULL,
  group_kpi_id BIGINT NULL,
  target_data_type VARCHAR(20) NOT NULL,
  completion_formula VARCHAR(20) NOT NULL DEFAULT 'THUAN',
  completion_expression VARCHAR(2000),
  scoring_method_id BIGINT NOT NULL,
  score_by_result TINYINT NOT NULL DEFAULT 1,
  objective_id BIGINT NOT NULL,
  weight INT NULL,
  unit_of_measure_id BIGINT NOT NULL,
  assigning_unit_id BIGINT NOT NULL,
  assigning_officer_id BIGINT NOT NULL,
  evaluating_unit_id BIGINT NOT NULL,
  evaluating_officer_id BIGINT NOT NULL,
  data_source VARCHAR(20) DEFAULT 'NHAP_TAY',
  result_expression VARCHAR(2000),
  is_focus TINYINT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'HIEU_LUC',
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  uk_code VARCHAR(50) AS (CASE WHEN deleted = 0 THEN code END) PERSISTENT,
  UNIQUE KEY uk_kpi_code (uk_code),
  KEY idx_kpi_parent (parent_id),
  KEY idx_kpi_perspective (perspective_id),
  KEY idx_kpi_objective (objective_id),
  KEY idx_kpi_scoring (scoring_method_id),
  KEY idx_kpi_uom (unit_of_measure_id),
  KEY idx_kpi_group (group_kpi_id),
  KEY idx_kpi_assign_unit (assigning_unit_id),
  KEY idx_kpi_assign_officer (assigning_officer_id),
  KEY idx_kpi_eval_unit (evaluating_unit_id),
  KEY idx_kpi_eval_officer (evaluating_officer_id),
  KEY idx_kpi_name (name(191)),
  CONSTRAINT fk_kpi_parent FOREIGN KEY (parent_id) REFERENCES kpi(id),
  CONSTRAINT fk_kpi_perspective FOREIGN KEY (perspective_id) REFERENCES perspective(id),
  CONSTRAINT fk_kpi_group FOREIGN KEY (group_kpi_id) REFERENCES kpi(id),
  CONSTRAINT fk_kpi_scoring FOREIGN KEY (scoring_method_id) REFERENCES scoring_method(id),
  CONSTRAINT fk_kpi_objective FOREIGN KEY (objective_id) REFERENCES strategic_objective(id),
  CONSTRAINT fk_kpi_uom FOREIGN KEY (unit_of_measure_id) REFERENCES unit_of_measure(id),
  CONSTRAINT fk_kpi_assign_unit FOREIGN KEY (assigning_unit_id) REFERENCES org_unit(id),
  CONSTRAINT fk_kpi_assign_officer FOREIGN KEY (assigning_officer_id) REFERENCES app_user(id),
  CONSTRAINT fk_kpi_eval_unit FOREIGN KEY (evaluating_unit_id) REFERENCES org_unit(id),
  CONSTRAINT fk_kpi_eval_officer FOREIGN KEY (evaluating_officer_id) REFERENCES app_user(id),
  CONSTRAINT ck_kpi_structure CHECK (structure IN ('DON_LE','CHA_CON')),
  CONSTRAINT ck_kpi_agg CHECK (group_aggregation IN ('TONG','TRUNG_BINH','TRUNG_BINH_TRONG_SO','LON_NHAT','NHO_NHAT','CONG_THUC','NHAP_TAY')),
  CONSTRAINT ck_kpi_tdt CHECK (target_data_type IN ('LUY_KE','THEO_KY','CUOI_KY','BINH_QUAN')),
  CONSTRAINT ck_kpi_cf CHECK (completion_formula IN ('THUAN','NGHICH','TUY_CHINH')),
  CONSTRAINT ck_kpi_ds CHECK (data_source IS NULL OR data_source IN ('API','NHAP_TAY','KET_HOP')),
  CONSTRAINT ck_kpi_weight CHECK (weight IS NULL OR (weight BETWEEN 1 AND 100))
) ENGINE=InnoDB;

-- Khóa sinh mã KPI theo viễn cảnh (SELECT ... FOR UPDATE)
CREATE TABLE kpi_code_sequence (
  perspective_id BIGINT PRIMARY KEY,
  last_no INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_kcs_perspective FOREIGN KEY (perspective_id) REFERENCES perspective(id)
) ENGINE=InnoDB;

CREATE TABLE kpi_component (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  kpi_id BIGINT NOT NULL,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(500) NOT NULL,
  formula_definition_id BIGINT NULL,
  source VARCHAR(10) NOT NULL DEFAULT 'NHAP_TAY',
  sort_order INT NOT NULL DEFAULT 0,
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  KEY idx_kc_kpi (kpi_id),
  KEY idx_kc_formula (formula_definition_id),
  CONSTRAINT fk_kc_kpi FOREIGN KEY (kpi_id) REFERENCES kpi(id),
  CONSTRAINT fk_kc_formula FOREIGN KEY (formula_definition_id) REFERENCES formula_definition(id),
  CONSTRAINT ck_kc_source CHECK (source IN ('API','NHAP_TAY'))
) ENGINE=InnoDB;

-- ---------- 4.3 Chiến lược ----------
CREATE TABLE strategy (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(500) NOT NULL,
  org_unit_id BIGINT NOT NULL,
  owner_user_id BIGINT NOT NULL,
  stage_id BIGINT NOT NULL,
  year INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DANG_THUC_HIEN',
  viewport JSON,
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_strategy_code (code),
  KEY idx_strategy_org (org_unit_id),
  KEY idx_strategy_owner (owner_user_id),
  KEY idx_strategy_stage (stage_id),
  CONSTRAINT fk_strategy_org FOREIGN KEY (org_unit_id) REFERENCES org_unit(id),
  CONSTRAINT fk_strategy_owner FOREIGN KEY (owner_user_id) REFERENCES app_user(id),
  CONSTRAINT fk_strategy_stage FOREIGN KEY (stage_id) REFERENCES evaluation_stage(id),
  CONSTRAINT ck_strategy_status CHECK (status IN ('DANG_THUC_HIEN','HOAN_THANH'))
) ENGINE=InnoDB;

CREATE TABLE strategy_objective (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  strategy_id BIGINT NOT NULL,
  objective_id BIGINT NOT NULL,
  pos_x DOUBLE NOT NULL DEFAULT 0,
  pos_y DOUBLE NOT NULL DEFAULT 0,
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_so (strategy_id, objective_id),
  KEY idx_so_obj (objective_id),
  CONSTRAINT fk_so_strategy FOREIGN KEY (strategy_id) REFERENCES strategy(id) ON DELETE CASCADE,
  CONSTRAINT fk_so_obj FOREIGN KEY (objective_id) REFERENCES strategic_objective(id)
) ENGINE=InnoDB;

CREATE TABLE strategy_link (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  strategy_id BIGINT NOT NULL,
  source_objective_id BIGINT NOT NULL,
  target_objective_id BIGINT NOT NULL,
  source_handle VARCHAR(20),
  target_handle VARCHAR(20),
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_sl (strategy_id, source_objective_id, target_objective_id),
  KEY idx_sl_src (source_objective_id),
  KEY idx_sl_tgt (target_objective_id),
  CONSTRAINT fk_sl_strategy FOREIGN KEY (strategy_id) REFERENCES strategy(id) ON DELETE CASCADE,
  CONSTRAINT fk_sl_src FOREIGN KEY (source_objective_id) REFERENCES strategic_objective(id),
  CONSTRAINT fk_sl_tgt FOREIGN KEY (target_objective_id) REFERENCES strategic_objective(id),
  CONSTRAINT ck_sl_self CHECK (source_objective_id <> target_objective_id)
) ENGINE=InnoDB;

CREATE TABLE strategy_kpi (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  strategy_id BIGINT NOT NULL,
  objective_id BIGINT NOT NULL,
  kpi_id BIGINT NOT NULL,
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_sk (strategy_id, objective_id, kpi_id),
  KEY idx_sk_obj (objective_id),
  KEY idx_sk_kpi (kpi_id),
  CONSTRAINT fk_sk_strategy FOREIGN KEY (strategy_id) REFERENCES strategy(id) ON DELETE CASCADE,
  CONSTRAINT fk_sk_obj FOREIGN KEY (objective_id) REFERENCES strategic_objective(id),
  CONSTRAINT fk_sk_kpi FOREIGN KEY (kpi_id) REFERENCES kpi(id)
) ENGINE=InnoDB;

-- ---------- 4.4 Phân công (Giao KPI) ----------
CREATE TABLE kpi_assignment (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  org_unit_id BIGINT NOT NULL,
  year INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DANG_SOAN',
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_assignment (org_unit_id, year),
  KEY idx_assignment_year (year),
  CONSTRAINT fk_assignment_org FOREIGN KEY (org_unit_id) REFERENCES org_unit(id),
  CONSTRAINT ck_assignment_status CHECK (status IN ('DANG_SOAN','DA_GIAO','DA_DIEU_CHINH'))
) ENGINE=InnoDB;

CREATE TABLE kpi_assignment_detail (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  assignment_id BIGINT NOT NULL,
  kpi_id BIGINT NOT NULL,
  org_unit_id BIGINT NOT NULL,
  year INT NOT NULL,
  weight DECIMAL(9,4) NULL,
  target_q1 DECIMAL(24,4), target_q2 DECIMAL(24,4), target_h1 DECIMAL(24,4),
  target_q3 DECIMAL(24,4), target_q4 DECIMAL(24,4), target_year DECIMAL(24,4),
  adj_q1 DECIMAL(24,4), adj_q2 DECIMAL(24,4), adj_h1 DECIMAL(24,4),
  adj_q3 DECIMAL(24,4), adj_q4 DECIMAL(24,4),
  status VARCHAR(20) NOT NULL DEFAULT 'DANG_SOAN',
  note VARCHAR(1000),
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_assign_detail (kpi_id, org_unit_id, year),
  KEY idx_ad_assignment (assignment_id),
  KEY idx_ad_year_org (year, org_unit_id),
  KEY idx_ad_org (org_unit_id),
  CONSTRAINT fk_ad_assignment FOREIGN KEY (assignment_id) REFERENCES kpi_assignment(id),
  CONSTRAINT fk_ad_kpi FOREIGN KEY (kpi_id) REFERENCES kpi(id),
  CONSTRAINT fk_ad_org FOREIGN KEY (org_unit_id) REFERENCES org_unit(id),
  CONSTRAINT ck_ad_status CHECK (status IN ('DANG_SOAN','DA_GIAO','DA_DIEU_CHINH')),
  CONSTRAINT ck_ad_nonneg CHECK (COALESCE(target_q1,0) >= 0 AND COALESCE(target_q2,0) >= 0 AND COALESCE(target_h1,0) >= 0
     AND COALESCE(target_q3,0) >= 0 AND COALESCE(target_q4,0) >= 0 AND COALESCE(target_year,0) >= 0)
) ENGINE=InnoDB;

CREATE TABLE kpi_assignment_adjustment (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  kpi_id BIGINT NOT NULL,
  year INT NOT NULL,
  decision_no VARCHAR(100) NOT NULL,
  decision_date DATE NOT NULL,
  reason VARCHAR(2000) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'NHAP',
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  KEY idx_adj_kpi_year (kpi_id, year, status),
  CONSTRAINT fk_adj_kpi FOREIGN KEY (kpi_id) REFERENCES kpi(id),
  CONSTRAINT ck_adj_status CHECK (status IN ('NHAP','DA_CHOT'))
) ENGINE=InnoDB;

CREATE TABLE kpi_assignment_adjustment_line (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  adjustment_id BIGINT NOT NULL,
  detail_id BIGINT NOT NULL,
  period_code VARCHAR(5) NOT NULL,
  old_value DECIMAL(24,4),
  new_value DECIMAL(24,4),
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  KEY idx_adjl_adj (adjustment_id),
  KEY idx_adjl_detail (detail_id),
  CONSTRAINT fk_adjl_adj FOREIGN KEY (adjustment_id) REFERENCES kpi_assignment_adjustment(id) ON DELETE CASCADE,
  CONSTRAINT fk_adjl_detail FOREIGN KEY (detail_id) REFERENCES kpi_assignment_detail(id),
  CONSTRAINT ck_adjl_period CHECK (period_code IN ('Q1','Q2','H1','Q3','Q4'))
) ENGINE=InnoDB;

CREATE TABLE kpi_assignment_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  detail_id BIGINT NOT NULL,
  action VARCHAR(20) NOT NULL,
  decision_no VARCHAR(100),
  decision_date DATE,
  reason VARCHAR(2000),
  snapshot JSON,
  at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `by` VARCHAR(100),
  KEY idx_ah_detail (detail_id, at),
  CONSTRAINT fk_ah_detail FOREIGN KEY (detail_id) REFERENCES kpi_assignment_detail(id) ON DELETE CASCADE,
  CONSTRAINT ck_ah_action CHECK (action IN ('TAO','SUA','CHOT_GIAO','DIEU_CHINH','SAO_CHEP','NHAP_FILE'))
) ENGINE=InnoDB;

CREATE TABLE kpi_officer_map (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  kpi_id BIGINT NOT NULL,
  org_unit_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role VARCHAR(10) NOT NULL,
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_kom (kpi_id, org_unit_id, user_id, role),
  KEY idx_kom_user (user_id),
  KEY idx_kom_org (org_unit_id),
  CONSTRAINT fk_kom_kpi FOREIGN KEY (kpi_id) REFERENCES kpi(id),
  CONSTRAINT fk_kom_org FOREIGN KEY (org_unit_id) REFERENCES org_unit(id),
  CONSTRAINT fk_kom_user FOREIGN KEY (user_id) REFERENCES app_user(id),
  CONSTRAINT ck_kom_role CHECK (role IN ('GIAO','DANH_GIA','PHOI_HOP'))
) ENGINE=InnoDB;

-- ---------- 4.7 (một phần) Tệp — cần trước bảng đánh giá ----------
CREATE TABLE file_object (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  bucket VARCHAR(100) NOT NULL,
  object_key VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  content_type VARCHAR(200),
  size BIGINT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  scan_status VARCHAR(10) NOT NULL DEFAULT 'CHUA_QUET',
  owner_type VARCHAR(50),
  owner_id BIGINT,
  uploaded_by VARCHAR(100),
  uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  retention_until DATE,
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_file_key (bucket, object_key),
  KEY idx_file_owner (owner_type, owner_id),
  KEY idx_file_retention (retention_until),
  CONSTRAINT ck_file_scan CHECK (scan_status IN ('CHUA_QUET','SACH','NHIEM'))
) ENGINE=InnoDB;

-- ---------- 4.5 Đánh giá ----------
CREATE TABLE evaluation_kpi (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  kpi_id BIGINT NOT NULL,
  year INT NOT NULL,
  period_code VARCHAR(5) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'CHUA_CHAM',
  result_type VARCHAR(10) NOT NULL DEFAULT 'NHAP_TAY',
  last_synced_at DATETIME(3),
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_eval_kpi (kpi_id, year, period_code),
  KEY idx_ek_year_period (year, period_code, status),
  CONSTRAINT fk_ek_kpi FOREIGN KEY (kpi_id) REFERENCES kpi(id),
  CONSTRAINT ck_ek_period CHECK (period_code IN ('Q1','Q2','H1','Q3','Q4','Y')),
  CONSTRAINT ck_ek_status CHECK (status IN ('CHUA_CHAM','DA_CHAM','DA_XU_LY_DIEU_CHINH','BCL_YEU_CAU_LAM_LAI','CHOT_KQ_R2')),
  CONSTRAINT ck_ek_rtype CHECK (result_type IN ('API','NHAP_TAY','KET_HOP'))
) ENGINE=InnoDB;

CREATE TABLE evaluation_result (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  evaluation_kpi_id BIGINT NOT NULL,
  org_unit_id BIGINT NOT NULL,
  assignment_detail_id BIGINT NULL,
  plan_value DECIMAL(24,4),
  year_plan_value DECIMAL(24,4),
  kpi_result DECIMAL(24,4),
  prev_adjustment DECIMAL(24,4),
  adjustment DECIMAL(24,4),
  final_result DECIMAL(24,4),
  completion_rate DECIMAL(14,4),
  year_completion_rate DECIMAL(14,4),
  score DECIMAL(9,4),
  manual_score DECIMAL(9,4),
  bsc_score DECIMAL(9,4),
  rating VARCHAR(20) NOT NULL DEFAULT 'DANG_THEO_DOI',
  status VARCHAR(30) NOT NULL DEFAULT 'CHUA_CO_KQ',
  description VARCHAR(2000),
  calc_error VARCHAR(500),
  result_before_adjust DECIMAL(24,4),
  result_after_adjust DECIMAL(24,4),
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_eval_result (evaluation_kpi_id, org_unit_id),
  KEY idx_er_ek_status (evaluation_kpi_id, status),
  KEY idx_er_org (org_unit_id),
  KEY idx_er_detail (assignment_detail_id),
  KEY idx_er_updated (updated_at),
  CONSTRAINT fk_er_ek FOREIGN KEY (evaluation_kpi_id) REFERENCES evaluation_kpi(id),
  CONSTRAINT fk_er_org FOREIGN KEY (org_unit_id) REFERENCES org_unit(id),
  CONSTRAINT fk_er_detail FOREIGN KEY (assignment_detail_id) REFERENCES kpi_assignment_detail(id),
  CONSTRAINT ck_er_rating CHECK (rating IN ('DAT_VUOT','CHUA_DAT','DANG_THEO_DOI')),
  CONSTRAINT ck_er_status CHECK (status IN ('CHUA_CO_KQ','DA_CO_KQ','DV_DE_NGHI_DIEU_CHINH','DA_XU_LY_DIEU_CHINH','CHOT_DANH_GIA','BCL_YEU_CAU_LAM_LAI','TGD_DA_DUYET'))
) ENGINE=InnoDB;

CREATE TABLE evaluation_component_value (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  result_id BIGINT NOT NULL,
  component_id BIGINT NOT NULL,
  source VARCHAR(10) NOT NULL,
  value DECIMAL(24,4),
  unit_proposed_value DECIMAL(24,4),
  prev_adjustment DECIMAL(24,4),
  unit_proposed_adjustment DECIMAL(24,4),
  adjustment DECIMAL(24,4),
  final_value DECIMAL(24,4),
  note VARCHAR(1000),
  synced_at DATETIME(3),
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_ecv (result_id, component_id),
  KEY idx_ecv_component (component_id),
  CONSTRAINT fk_ecv_result FOREIGN KEY (result_id) REFERENCES evaluation_result(id) ON DELETE CASCADE,
  CONSTRAINT fk_ecv_component FOREIGN KEY (component_id) REFERENCES kpi_component(id),
  CONSTRAINT ck_ecv_source CHECK (source IN ('API','NHAP_TAY'))
) ENGINE=InnoDB;

CREATE TABLE adjustment_request (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  result_id BIGINT NOT NULL,
  proposal_note VARCHAR(4000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'CHO_XU_LY',
  requested_by_id BIGINT NULL,
  handled_by VARCHAR(100),
  handled_by_id BIGINT NULL,
  handled_at DATETIME(3),
  handling_reason VARCHAR(4000),
  decision_file_id BIGINT NULL,
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  KEY idx_ar_result (result_id, status),
  KEY idx_ar_requested (requested_by_id),
  KEY idx_ar_handled (handled_by_id),
  KEY idx_ar_file (decision_file_id),
  CONSTRAINT fk_ar_result FOREIGN KEY (result_id) REFERENCES evaluation_result(id),
  CONSTRAINT fk_ar_req_user FOREIGN KEY (requested_by_id) REFERENCES app_user(id),
  CONSTRAINT fk_ar_handled_user FOREIGN KEY (handled_by_id) REFERENCES app_user(id),
  CONSTRAINT fk_ar_file FOREIGN KEY (decision_file_id) REFERENCES file_object(id),
  CONSTRAINT ck_ar_status CHECK (status IN ('CHO_XU_LY','DA_XU_LY'))
) ENGINE=InnoDB;

CREATE TABLE evaluation_feedback (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  result_id BIGINT NOT NULL,
  author_id BIGINT NOT NULL,
  content VARCHAR(4000) NOT NULL,
  feedback_type VARCHAR(30) NOT NULL DEFAULT 'Y_KIEN',
  at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_ef_result (result_id, at),
  KEY idx_ef_author (author_id),
  CONSTRAINT fk_ef_result FOREIGN KEY (result_id) REFERENCES evaluation_result(id),
  CONSTRAINT fk_ef_author FOREIGN KEY (author_id) REFERENCES app_user(id)
) ENGINE=InnoDB;

-- Dòng thời gian trạng thái (40.3)
CREATE TABLE evaluation_status_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  result_id BIGINT NULL,
  evaluation_kpi_id BIGINT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  note VARCHAR(2000),
  at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `by` VARCHAR(100),
  KEY idx_esh_result (result_id, at),
  KEY idx_esh_ek (evaluation_kpi_id, at),
  CONSTRAINT fk_esh_result FOREIGN KEY (result_id) REFERENCES evaluation_result(id) ON DELETE CASCADE,
  CONSTRAINT fk_esh_ek FOREIGN KEY (evaluation_kpi_id) REFERENCES evaluation_kpi(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE period_closing (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  year INT NOT NULL,
  period_code VARCHAR(5) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'CHOT',
  closed_by VARCHAR(100),
  closed_at DATETIME(3),
  approved_by VARCHAR(100),
  approved_at DATETIME(3),
  snapshot JSON,
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_period_closing (year, period_code),
  CONSTRAINT ck_pc_status CHECK (status IN ('CHOT','TGD_DA_DUYET')),
  CONSTRAINT ck_pc_period CHECK (period_code IN ('Q1','Q2','H1','Q3','Q4','Y'))
) ENGINE=InnoDB;

CREATE TABLE sync_batch (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_type VARCHAR(30) NOT NULL,
  year INT,
  period_code VARCHAR(5),
  kpi_id BIGINT NULL,
  schedule_id BIGINT NULL,
  `trigger` VARCHAR(10) NOT NULL DEFAULT 'USER',
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at DATETIME(3),
  status VARCHAR(20) NOT NULL DEFAULT 'DANG_CHAY',
  total INT NOT NULL DEFAULT 0,
  success INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  message VARCHAR(2000),
  triggered_by VARCHAR(100),
  KEY idx_sb_job (job_type, started_at),
  KEY idx_sb_kpi (kpi_id),
  KEY idx_sb_schedule (schedule_id, started_at),
  CONSTRAINT fk_sb_kpi FOREIGN KEY (kpi_id) REFERENCES kpi(id),
  CONSTRAINT ck_sb_trigger CHECK (`trigger` IN ('JOB','USER')),
  CONSTRAINT ck_sb_status CHECK (status IN ('DANG_CHAY','THANH_CONG','LOI','MOT_PHAN'))
) ENGINE=InnoDB;

CREATE TABLE sync_batch_item (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT NOT NULL,
  formula_definition_id BIGINT NULL,
  org_unit_id BIGINT NULL,
  request_summary VARCHAR(1000),
  value DECIMAL(24,4),
  error VARCHAR(2000),
  at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_sbi_batch (batch_id),
  KEY idx_sbi_formula (formula_definition_id, at),
  KEY idx_sbi_org (org_unit_id),
  CONSTRAINT fk_sbi_batch FOREIGN KEY (batch_id) REFERENCES sync_batch(id) ON DELETE CASCADE,
  CONSTRAINT fk_sbi_formula FOREIGN KEY (formula_definition_id) REFERENCES formula_definition(id),
  CONSTRAINT fk_sbi_org FOREIGN KEY (org_unit_id) REFERENCES org_unit(id)
) ENGINE=InnoDB;

CREATE TABLE formula_result (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  formula_definition_id BIGINT NOT NULL,
  org_unit_id BIGINT NOT NULL,
  year INT NOT NULL,
  period_code VARCHAR(5) NOT NULL,
  value DECIMAL(24,4),
  batch_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_formula_result (formula_definition_id, org_unit_id, year, period_code),
  KEY idx_fr_org (org_unit_id),
  KEY idx_fr_batch (batch_id),
  CONSTRAINT fk_fr_formula FOREIGN KEY (formula_definition_id) REFERENCES formula_definition(id),
  CONSTRAINT fk_fr_org FOREIGN KEY (org_unit_id) REFERENCES org_unit(id),
  CONSTRAINT fk_fr_batch FOREIGN KEY (batch_id) REFERENCES sync_batch(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- 4.6 BSC / báo cáo ----------
CREATE TABLE bsc_unit_summary (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  org_unit_id BIGINT NOT NULL,
  year INT NOT NULL,
  period_code VARCHAR(20) NOT NULL COMMENT 'Q1..Q4,H1,Y hoặc STAGE',
  stage_id BIGINT NULL,
  total_kpi INT NOT NULL DEFAULT 0,
  achieved INT NOT NULL DEFAULT 0,
  not_achieved INT NOT NULL DEFAULT 0,
  tracking INT NOT NULL DEFAULT 0,
  warning INT NOT NULL DEFAULT 0,
  completion_rate DECIMAL(14,4),
  bsc_score DECIMAL(9,4),
  rank_in_group INT,
  rank_group VARCHAR(30),
  prev_bsc_score DECIMAL(9,4),
  prev_rank INT,
  computed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_bsc_summary (org_unit_id, year, period_code),
  KEY idx_bsc_year_period_org (year, period_code, org_unit_id),
  KEY idx_bsc_stage (stage_id),
  CONSTRAINT fk_bsc_org FOREIGN KEY (org_unit_id) REFERENCES org_unit(id),
  CONSTRAINT fk_bsc_stage FOREIGN KEY (stage_id) REFERENCES evaluation_stage(id)
) ENGINE=InnoDB;

CREATE TABLE report_template (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  file_id BIGINT NULL,
  version INT NOT NULL DEFAULT 1,
  active TINYINT NOT NULL DEFAULT 1,
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_report_template (code),
  KEY idx_rt_file (file_id),
  CONSTRAINT fk_rt_file FOREIGN KEY (file_id) REFERENCES file_object(id),
  CONSTRAINT ck_rt_code CHECK (code IN ('TTR94_TONG_HOP','TTR94_CHI_TIET','KPI_TUNG_TINH','BIEU_GIAO_KPI','BIEU_KET_QUA_KPI','KQ_DANH_GIA_DON_VI','BANG_TH_TCT'))
) ENGINE=InnoDB;

-- ---------- 4.7 Quản trị ----------
CREATE TABLE sys_config (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  config_value VARCHAR(4000) NOT NULL,
  data_type VARCHAR(10) NOT NULL DEFAULT 'STRING',
  config_group VARCHAR(50),
  description VARCHAR(1000),
  is_secret TINYINT NOT NULL DEFAULT 0,
  is_core TINYINT NOT NULL DEFAULT 0 COMMENT 'Tham số lõi không được xóa',
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  uk_key VARCHAR(100) AS (CASE WHEN deleted = 0 THEN config_key END) PERSISTENT,
  UNIQUE KEY uk_sys_config_key (uk_key),
  CONSTRAINT ck_sc_type CHECK (data_type IN ('STRING','NUMBER','BOOLEAN','JSON'))
) ENGINE=InnoDB;

CREATE TABLE sync_schedule (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  job_type VARCHAR(30) NOT NULL,
  cron VARCHAR(100) NOT NULL,
  enabled TINYINT NOT NULL DEFAULT 1,
  params JSON,
  last_run_at DATETIME(3),
  last_status VARCHAR(20),
  next_run_at DATETIME(3),
  created_by VARCHAR(100), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(100), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  version INT NOT NULL DEFAULT 0,
  deleted TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_schedule_code (code),
  CONSTRAINT ck_ss_job CHECK (job_type IN ('DONG_BO_KET_QUA_KPI','HOAN_TAT_CHIEN_LUOC','NHAC_HAN_CAP_NHAT','TINH_LAI_BSC','DONG_BO_HRM','SAO_LUU_LOGIC'))
) ENGINE=InnoDB;

CREATE TABLE notification (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content VARCHAR(4000),
  link_route VARCHAR(500),
  link_params JSON,
  is_read TINYINT NOT NULL DEFAULT 0,
  read_at DATETIME(3),
  email_status VARCHAR(20),
  zalo_status VARCHAR(20),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_notification_user (user_id, is_read, created_at),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES app_user(id)
) ENGINE=InnoDB;

-- audit_log: partition theo tháng (PK gồm cột partition), không FK
CREATE TABLE audit_log (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT,
  username VARCHAR(100),
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(100),
  entity_id VARCHAR(100),
  before_json LONGTEXT,
  after_json LONGTEXT,
  ip VARCHAR(64),
  user_agent VARCHAR(500),
  trace_id VARCHAR(64),
  at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id, at),
  KEY idx_audit_user (username, at),
  KEY idx_audit_entity (entity, entity_id),
  KEY idx_audit_action (action, at)
) ENGINE=InnoDB
PARTITION BY RANGE (TO_DAYS(at)) (
  PARTITION p2025 VALUES LESS THAN (TO_DAYS('2026-01-01')),
  PARTITION p202601 VALUES LESS THAN (TO_DAYS('2026-02-01')),
  PARTITION p202602 VALUES LESS THAN (TO_DAYS('2026-03-01')),
  PARTITION p202603 VALUES LESS THAN (TO_DAYS('2026-04-01')),
  PARTITION p202604 VALUES LESS THAN (TO_DAYS('2026-05-01')),
  PARTITION p202605 VALUES LESS THAN (TO_DAYS('2026-06-01')),
  PARTITION p202606 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  PARTITION p202607 VALUES LESS THAN (TO_DAYS('2026-08-01')),
  PARTITION p202608 VALUES LESS THAN (TO_DAYS('2026-09-01')),
  PARTITION p202609 VALUES LESS THAN (TO_DAYS('2026-10-01')),
  PARTITION p202610 VALUES LESS THAN (TO_DAYS('2026-11-01')),
  PARTITION p202611 VALUES LESS THAN (TO_DAYS('2026-12-01')),
  PARTITION p202612 VALUES LESS THAN (TO_DAYS('2027-01-01')),
  PARTITION p202701 VALUES LESS THAN (TO_DAYS('2027-02-01')),
  PARTITION p202702 VALUES LESS THAN (TO_DAYS('2027-03-01')),
  PARTITION p202703 VALUES LESS THAN (TO_DAYS('2027-04-01')),
  PARTITION p202704 VALUES LESS THAN (TO_DAYS('2027-05-01')),
  PARTITION p202705 VALUES LESS THAN (TO_DAYS('2027-06-01')),
  PARTITION p202706 VALUES LESS THAN (TO_DAYS('2027-07-01')),
  PARTITION pmax VALUES LESS THAN MAXVALUE
);
