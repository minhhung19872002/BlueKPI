import { expect, test } from '@playwright/test';
import { login, PASSWORD } from './helpers';

test('1.1 Đăng nhập hệ thống', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel('Tên đăng nhập')).toBeVisible();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng nhập bằng VNPT SSO' })).toBeVisible();
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'text');
  await login(page, 'admin');
  await expect(page).toHaveURL(/\/dashboard/);
  const nav = page.locator('aside');
  for (const m of ['Dashboard TGĐ BSC', 'KPI đơn vị của tôi', 'Quản trị KPI', 'Quản trị hệ thống']) {
    await expect(nav.getByText(m, { exact: true })).toBeVisible();
  }
  // Hiển thị chức năng theo vai trò: người dùng đơn vị không thấy Quản trị hệ thống
  await page.context().clearCookies();
  await login(page, 'tinh_hni');
  await expect(page.locator('aside').getByText('KPI đơn vị của tôi', { exact: true })).toBeVisible();
  await expect(page.locator('aside').getByText('Quản trị hệ thống', { exact: true })).toHaveCount(0);
});

test('1.2 Đăng nhập – Thông tin không hợp lệ', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập').fill('admin');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('SaiMatKhau@1');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByTestId('login-error')).toHaveText('Tên đăng nhập hoặc mật khẩu không đúng');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Tên đăng nhập').fill('khoa_test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByTestId('login-error')).toHaveText('Tài khoản đã bị khóa');
  await page.getByLabel('Tên đăng nhập').fill('ngung_test');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByTestId('login-error')).toHaveText('Tài khoản đã ngưng hoạt động');
  await page.getByLabel('Tên đăng nhập').fill('');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByText('Vui lòng nhập tên đăng nhập')).toBeVisible();
});

test('2.1 Đăng xuất hệ thống', async ({ page }) => {
  await login(page, 'admin');
  await page.getByTestId('user-menu').click();
  await expect(page.getByRole('menuitem', { name: 'Thông tin tài khoản' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('0.1 Route không có quyền → trang 403', async ({ page }) => {
  await login(page, 'tinh_hni');
  await page.goto('/system');
  await expect(page.getByText('Bạn không có quyền truy cập chức năng này')).toBeVisible();
});
