import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * E2E: một test cho mỗi STT (tên test bắt đầu bằng mã STT), chạy với dữ liệu seed.
 * Backend e2e chạy cổng 8089 trên DB riêng kpi_bsc_e2e (reset trước mỗi lần chạy — e2e/setup/prepare.mjs).
 * Màn hình 1024×768 (độ phân giải tối thiểu theo E-HSMT).
 */
const BE_PORT = Number(process.env.E2E_BE_PORT ?? 8089);
const FE_PORT = Number(process.env.E2E_FE_PORT ?? 4174);
const javaHome = process.env.JAVA_HOME ?? '';
const java = javaHome ? path.join(javaHome, 'bin', 'java') : 'java';
const jar = process.env.E2E_JAR ?? path.resolve(process.cwd(), '../backend/target/kpi-bsc-1.0.0.jar');
const db = process.env.E2E_DB ?? 'kpi_bsc_e2e';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: `http://localhost:${FE_PORT}`,
    viewport: { width: 1024, height: 768 },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } }],
  webServer: [
    {
      command: `"${java}" -jar "${jar}" --spring.profiles.active=dev --server.port=${BE_PORT} --spring.datasource.url=jdbc:mariadb://localhost:3307/${db} --kpi.demo-seed=true --kpi.security.login-rate-limit-per-minute=1000 --kpi.cas.service-url=http://localhost:${FE_PORT}/api/auth/sso/callback --kpi.cas.frontend-url=http://localhost:${FE_PORT}/`,
      url: `http://localhost:${BE_PORT}/api/actuator/health/readiness`,
      timeout: 300_000,
      reuseExistingServer: !!process.env.E2E_REUSE,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npx vite preview --port ${FE_PORT} --strictPort --outDir ${process.env.E2E_DIST ?? 'dist'}`,
      url: `http://localhost:${FE_PORT}/login`,
      timeout: 120_000,
      reuseExistingServer: !!process.env.E2E_REUSE,
      env: { VITE_PROXY_TARGET: `http://localhost:${BE_PORT}` },
    },
  ],
});
