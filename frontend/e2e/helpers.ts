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

/** Tạo file .xlsx (sheet 1: dòng tiêu đề + dữ liệu) để nhập */
export async function makeXlsx(headers: string[], rows: (string | number | null)[][]): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Du lieu');
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Mở dialog nhập, kiểm tra và xác nhận; trả về locator kết quả */
export async function importFile(page: Page, buffer: Buffer, name = 'nhap.xlsx') {
  const dlg = page.getByRole('dialog', { name: 'Nhập dữ liệu từ file' });
  await expect(dlg.getByText('Tải file mẫu')).toBeVisible();
  await dlg.getByTestId('import-file').setInputFiles({ name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await dlg.getByRole('button', { name: 'Kiểm tra' }).click();
  await expect(dlg.getByRole('table', { name: 'Bảng xem trước' })).toBeVisible();
  return dlg;
}

/** Bấm nút trên một dòng lưới */
export async function rowAction(page: Page, text: string | RegExp, action: string) {
  await row(page, text).getByRole('button', { name: action, exact: true }).click();
}

/** Tìm kiếm theo từ khóa trên thanh tìm kiếm */
export async function searchKeyword(page: Page, kw: string) {
  await page.getByLabel('Từ khóa tìm kiếm').fill(kw);
  await page.getByLabel('Từ khóa tìm kiếm').press('Enter');
}
