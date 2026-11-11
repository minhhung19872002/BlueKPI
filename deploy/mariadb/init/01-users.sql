-- Least privilege (PHẦN B §9.6): kpi_migrate có DDL (Flyway), kpi_app chỉ DML
CREATE USER IF NOT EXISTS 'kpi_app'@'%' IDENTIFIED BY 'kpi_app_dev';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON kpi_bsc.* TO 'kpi_app'@'%';
GRANT ALL PRIVILEGES ON kpi_bsc.* TO 'kpi_migrate'@'%';
-- Database phục vụ e2e (reset được)
CREATE DATABASE IF NOT EXISTS kpi_bsc_e2e CHARACTER SET utf8mb4 COLLATE utf8mb4_vietnamese_ci;
GRANT ALL PRIVILEGES ON kpi_bsc_e2e.* TO 'kpi_migrate'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON kpi_bsc_e2e.* TO 'kpi_app'@'%';
FLUSH PRIVILEGES;
