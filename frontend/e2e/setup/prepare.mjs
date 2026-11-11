// Chuẩn bị e2e: reset DB kpi_bsc_e2e (backend chạy Flyway + seed demo khi khởi động) và build FE
import { execSync } from 'node:child_process';

const run = (c) => execSync(c, { stdio: 'inherit' });
if (!process.env.E2E_REUSE) {
  const sql = [
    'DROP DATABASE IF EXISTS kpi_bsc_e2e',
    'CREATE DATABASE kpi_bsc_e2e CHARACTER SET utf8mb4 COLLATE utf8mb4_vietnamese_ci',
    "GRANT ALL PRIVILEGES ON kpi_bsc_e2e.* TO 'kpi_migrate'@'%'",
    "GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON kpi_bsc_e2e.* TO 'kpi_app'@'%'",
  ].join('; ');
  run(`docker compose -f ../deploy/docker-compose.dev.yml exec -T mariadb mariadb -uroot -proot_dev_only -e "${sql}"`);
}
if (!process.env.E2E_SKIP_BUILD) run('npx vite build');
