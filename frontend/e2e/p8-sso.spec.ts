import { expect, test } from '@playwright/test';

/**
 * P8 — Tích hợp VNPT CAS/SSO (PHẦN B §8.1) với mock CAS (deploy/mocks/mock-cas.mjs, cổng 8091).
 * Luồng: /login → “Đăng nhập bằng VNPT SSO” → CAS login → ticket → /api/auth/sso/callback → validate → JWT cookie → /dashboard.
 */
test.describe.configure({ timeout: 60_000 });

test('1.1 Đăng nhập – VNPT SSO (CAS) thành công', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Đăng nhập bằng VNPT SSO' }).click();
  await expect(page).toHaveURL(/localhost:8091\/cas\/login\?service=/);
  await page.locator('#username').fill('tinh_hni');
  await page.locator('#submit').click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId('user-menu')).toBeVisible();
  // ticket không còn trên URL, phiên dùng cookie HttpOnly
  expect(page.url()).not.toContain('ticket=');
  const cookies = await page.context().cookies();
  const at = cookies.find((c) => /access/i.test(c.name));
  expect(at?.httpOnly).toBeTruthy();
  const me = await page.request.get('/api/auth/me');
  expect(me.ok()).toBeTruthy();
  expect(JSON.stringify(await me.json())).toContain('tinh_hni');
});

test('1.2 Đăng nhập – VNPT SSO ticket không hợp lệ', async ({ page }) => {
  await page.goto('/api/auth/sso/callback?ticket=ST-khong-hop-le-123');
  await expect(page).toHaveURL(/\/sso-error/);
  await expect(page.getByRole('heading').first()).toBeVisible();
  const me = await page.request.get('/api/auth/me');
  expect(me.status()).toBe(401);
});

test('1.2 Đăng nhập – VNPT SSO tài khoản chưa có trên hệ thống', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Đăng nhập bằng VNPT SSO' }).click();
  await page.locator('#username').fill('khong_ton_tai_e2e');
  await page.locator('#submit').click();
  await expect(page).toHaveURL(/\/sso-error/);
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
});
