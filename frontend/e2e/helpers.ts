import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'Kpi@2026';

/** Đăng nhập bằng tài khoản seed */
export async function login(page: Page, username = 'admin', password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập').fill(username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByTestId('user-menu')).toBeVisible();
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByTestId('toast-success').filter({ hasText: text }).first()).toBeVisible();
}

export async function expectErrorToast(page: Page, text: string | RegExp) {
  await expect(page.getByTestId('toast-error').filter({ hasText: text }).first()).toBeVisible();
}

export function uid(prefix = 'E2E') {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
}

/** Dòng lưới chứa text */
export function row(page: Page, text: string | RegExp) {
  return page.locator('tbody tr').filter({ hasText: text }).first();
}

/** Mở TreeSelect và chọn mục theo nhãn */
export async function pickTree(page: Page, triggerLabel: string, itemText: string) {
  await page.getByRole('button', { name: triggerLabel }).click();
  await page.getByPlaceholder('Tìm theo mã hoặc tên').fill(itemText);
  await page.getByRole('treeitem', { name: itemText }).first().click();
}

/** Mở SearchSelect và chọn option */
export async function pickSearch(page: Page, triggerLabel: string, itemText: string) {
  await page.getByRole('button', { name: triggerLabel }).click();
  await page.getByPlaceholder('Tìm kiếm').last().fill(itemText);
  await page.getByRole('option', { name: new RegExp(itemText) }).first().click();
}
