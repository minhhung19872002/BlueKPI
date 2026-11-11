import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { login } from './helpers';

/**
 * P9 — Chụp ảnh màn hình cho HDSD (docs/HDSD/img). Không thuộc bộ e2e thường; chạy: DOCS=1 npx playwright test e2e/hdsd-screens.spec.ts
 * Mỗi màn hình: ảnh trang + ảnh từng tab (role=tab). Danh mục ảnh ghi ra docs/HDSD/img/index.json để sinh HDSD.
 */
test.skip(!process.env.DOCS, 'Chỉ chạy khi sinh tài liệu (DOCS=1)');
test.describe.configure({ timeout: 300_000 });

const OUT = path.resolve(process.cwd(), '../docs/HDSD/img');
const index: { file: string; screen: string; tab?: string }[] = [];

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

async function shot(page: Page, name: string, screen: string, tab?: string) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(400);
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  index.push({ file, screen, tab });
}

async function screenWithTabs(page: Page, url: string, name: string, screen: string) {
  await page.goto(url);
  await expect(page.locator('main, [data-testid="dashboard-content"], h1').first()).toBeVisible();
  await shot(page, name, screen);
  const tabs = page.getByRole('tab');
  const n = await tabs.count();
  for (let i = 1; i < n; i++) {
    const t = tabs.nth(i);
    const label = (await t.innerText()).trim();
    await t.click();
    await shot(page, `${name}--${slug(label)}`, screen, label);
  }
}

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
test.afterAll(() => fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2)));

test('HDSD – chụp màn hình', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/login');
  await shot(page, '01-dang-nhap', 'Đăng nhập');
  await login(page);

  await screenWithTabs(page, '/dashboard', '02-dashboard', 'Dashboard TGĐ BSC');
  // Dashboard: các popup
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Tổng số KPI giao', exact: true }).click();
  await shot(page, '02-dashboard--danh-sach-kpi', 'Dashboard TGĐ BSC', 'Danh Sách Chi Tiết Các KPI');
  await page.keyboard.press('Escape');
  await page.getByTestId('focus-card').first().getByRole('button', { name: /Xem chi tiết/ }).click();
  await shot(page, '02-dashboard--chi-tiet-kpi-trong-tam', 'Dashboard TGĐ BSC', 'Chi tiết KPI trọng tâm');
  await page.keyboard.press('Escape');
  await page.getByTestId('corporations-block').locator('tbody tr').first().getByRole('button').click();
  await shot(page, '02-dashboard--bang-tong-hop-tct', 'Dashboard TGĐ BSC', 'Bảng tổng hợp kết quả các KPI giao cho đơn vị');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Xem bản đồ chiến lược' }).click();
  await page.waitForTimeout(1200);
  await shot(page, '02-dashboard--ban-do-chien-luoc', 'Dashboard TGĐ BSC', 'Bản đồ chiến lược');
  await page.goto('/dashboard?unit=PROVINCES');
  await shot(page, '02-dashboard--khoi-tinh', 'Dashboard TGĐ BSC', 'Khối VNPT tỉnh/thành phố');

  await screenWithTabs(page, '/my-kpi', '03-kpi-don-vi-cua-toi', 'KPI đơn vị của tôi');
  await screenWithTabs(page, '/kpi-admin/catalog', '04-danh-muc-kpi', 'Danh mục chỉ tiêu KPI');
  await screenWithTabs(page, '/kpi-admin/objectives', '05-muc-tieu-trong-tam', 'Quản lý mục tiêu trọng tâm');
  await screenWithTabs(page, '/kpi-admin/assignments', '06-giao-kpi', 'Giao KPI');
  await screenWithTabs(page, '/kpi-admin/strategies', '07-chien-luoc', 'Quản lý bản đồ chiến lược');
  await page.getByRole('button', { name: 'Sửa', exact: true }).first().click();
  await page.waitForTimeout(1500);
  await shot(page, '07-chien-luoc--cap-nhat', 'Quản lý bản đồ chiến lược', 'Cập nhật chiến lược');
  await screenWithTabs(page, '/kpi-admin/evaluations', '08-danh-gia-kpi', 'Đánh giá KPI');
  await screenWithTabs(page, '/kpi-admin/bsc', '09-tong-hop-bsc', 'Tổng hợp kết quả BSC');
  await screenWithTabs(page, '/system', '10-quan-tri-he-thong', 'Quản trị hệ thống');
  await screenWithTabs(page, '/notifications', '11-thong-bao', 'Thông báo');
  await screenWithTabs(page, '/profile', '12-thong-tin-ca-nhan', 'Thông tin cá nhân');
});
