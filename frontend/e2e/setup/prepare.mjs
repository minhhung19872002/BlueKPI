// Chuẩn bị e2e: reset DB ${db} (backend chạy Flyway + seed demo khi khởi động) và build FE
import { execSync } from 'node:child_process';

const db = process.env.E2E_DB ?? 'kpi_bsc_e2e';
const run = (c) => execSync(c, { stdio: 'inherit' });
if (!process.env.E2E_REUSE) {
  const sql = [
    `DROP DATABASE IF EXISTS ${db}`,
    `CREATE DATABASE ${db} CHARACTER SET utf8mb4 COLLATE utf8mb4_vietnamese_ci`,
    `GRANT ALL PRIVILEGES ON ${db}.* TO 'kpi_migrate'@'%'`,
    `GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON ${db}.* TO 'kpi_app'@'%'`,
  ].join('; ');
  run(`docker compose -f ../deploy/docker-compose.dev.yml exec -T mariadb mariadb -uroot -proot_dev_only -e "${sql}"`);
}
if (!process.env.E2E_SKIP_BUILD) run(`npx vite build --outDir ${process.env.E2E_DIST ?? 'dist'}`);
