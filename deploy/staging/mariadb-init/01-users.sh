#!/bin/bash
# Least privilege (PHẦN B §9.6): kpi_migrate có DDL (Flyway), kpi_app chỉ DML. Mật khẩu từ biến môi trường (gen-env.sh).
set -euo pipefail
mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" <<SQL
CREATE USER IF NOT EXISTS 'kpi_app'@'%' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS 'kpi_migrate'@'%' IDENTIFIED BY '${DB_MIGRATE_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON kpi_bsc.* TO 'kpi_app'@'%';
GRANT ALL PRIVILEGES ON kpi_bsc.* TO 'kpi_migrate'@'%';
FLUSH PRIVILEGES;
SQL
