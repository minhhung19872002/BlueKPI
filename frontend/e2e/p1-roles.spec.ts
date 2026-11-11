import { expect, test, type Page } from '@playwright/test';
import { expectErrorToast, expectToast, login, row, rowAction, searchKeyword, uid } from './helpers';

async function openTab(page: Page, tab: string, label: string) {
  await login(page, 'admin');
  await page.goto(`/system?tab=${tab}`);
  await expect(page.getByRole('tab', { name: label })).toHaveAttribute('data-state', 'active');
}

async function createRole(page: Page, code: string) {
  await page.getByRole('button', { name: 'Thêm vai trò' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm vai trò' });
  await dlg.getByLabel('Mã vai trò').fill(code);
  await dlg.getByLabel('Tên vai trò').fill(`Vai trò ${code}`);
  await dlg.getByLabel('Phạm vi dữ liệu').selectOption({ label: 'Đơn vị mình và đơn vị con' });
  await dlg.getByTestId('permission-tree').getByText('Xem KPI đơn vị của tôi').click();
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
}

test('4.1 Lấy danh sách – Vai trò', async ({ page }) => {
  await openTab(page, 'roles', 'Vai trò');
  await expect(page.getByRole('heading', { name: 'Danh sách vai trò' })).toBeVisible();
  const head = page.getByRole('table', { name: 'Danh sách vai trò' }).locator('thead');
  for (const h of ['STT', 'Mã – Tên vai trò', 'Mô tả', 'Trạng thái', 'Người tạo', 'Ngày tạo', 'Người cập nhật', 'Ngày cập nhật']) await expect(head.getByText(h, { exact: true })).toBeVisible();
  await expect(row(page, 'ADMIN_HT – Admin hệ thống')).toBeVisible();
});

test('4.2 Tìm kiếm – Vai trò', async ({ page }) => {
  await openTab(page, 'roles', 'Vai trò');
  await searchKeyword(page, 'TONG_GIAM_DOC');
  await expect(page.getByTestId('grid-total')).toHaveText('1');
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await page.getByLabel('Trạng thái').selectOption({ label: 'Hiệu lực' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(row(page, 'Lãnh đạo Tập đoàn')).toBeVisible();
});

test('4.3 Xem chi tiết – Vai trò', async ({ page }) => {
  await openTab(page, 'roles', 'Vai trò');
  await searchKeyword(page, 'NGUOI_DUNG_DV');
  await rowAction(page, 'NGUOI_DUNG_DV', 'Xem');
  const d = page.getByRole('dialog', { name: 'Thông tin vai trò' });
  await expect(d.getByText('Cây quyền đã gán')).toBeVisible();
  await expect(d.getByTestId('permission-tree')).toContainText('Đề nghị điều chỉnh kết quả KPI');
});

test('4.4 Thêm mới – Vai trò', async ({ page }) => {
  await openTab(page, 'roles', 'Vai trò');
  const code = uid('VT');
  await createRole(page, code);
  await searchKeyword(page, code);
  await expect(row(page, `${code} – Vai trò ${code}`)).toBeVisible();
});

test('4.5 Ghi lại – Vai trò', async ({ page }) => {
  await openTab(page, 'roles', 'Vai trò');
  const code = uid('VS');
  await createRole(page, code);
  await searchKeyword(page, code);
  await rowAction(page, code, 'Sửa');
  const dlg = page.getByRole('dialog', { name: 'Sửa vai trò' });
  await expect(dlg.getByLabel('Mã vai trò')).toBeDisabled();
  await dlg.getByLabel('Mô tả').fill('Mô tả đã cập nhật');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(row(page, code)).toContainText('Mô tả đã cập nhật');
  await expect(row(page, code)).toContainText('admin');
});

test('4.6 Xóa – Vai trò', async ({ page }) => {
  await openTab(page, 'roles', 'Vai trò');
  const code = uid('VX');
  await createRole(page, code);
  await searchKeyword(page, code);
  await rowAction(page, code, 'Xóa');
  await page.getByTestId('confirm-ok').click();
  await expectToast(page, 'Xóa thành công');
  // vai trò hệ thống không có nút Xóa
  await searchKeyword(page, 'ADMIN_HT');
  await expect(row(page, 'ADMIN_HT').getByRole('button', { name: 'Xóa' })).toHaveCount(0);
  // vai trò đang gán cho người dùng → hỏi lại
  const code2 = uid('VG');
  await createRole(page, code2);
  await page.goto('/system?tab=users');
  await searchKeyword(page, 'tinh_hcm@vnpt.vn');
  await rowAction(page, 'tinh_hcm@vnpt.vn', 'Quản lý vai trò người dùng');
  const dlg = page.getByRole('dialog', { name: 'Quản lý vai trò người dùng' });
  await dlg.getByTestId('roles-available').getByText(`${code2} – Vai trò ${code2}`).click();
  await dlg.getByRole('button', { name: 'Thêm →' }).click();
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật vai trò thành công');
  await page.goto('/system?tab=roles');
  await searchKeyword(page, code2);
  await rowAction(page, code2, 'Xóa');
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByRole('dialog', { name: 'Xác nhận xóa' })).toContainText('Vai trò đang gán cho 1 người dùng, tiếp tục xóa sẽ bỏ gán');
  await page.getByTestId('confirm-ok').click();
  await expectToast(page, 'Xóa thành công');
});

test('4.7 Lấy danh sách – Quyền', async ({ page }) => {
  await openTab(page, 'permissions', 'Quyền');
  await expect(page.getByRole('heading', { name: 'Danh sách quyền' })).toBeVisible();
  const head = page.getByRole('table', { name: 'Danh sách quyền' }).locator('thead');
  for (const h of ['STT', 'Mã quyền', 'Tên quyền', 'Phân hệ/Menu', 'Mô tả', 'Thứ tự']) await expect(head.getByText(h, { exact: true })).toBeVisible();
  await expect(row(page, 'USER:VIEW')).toBeVisible();
});

test('4.8 Xem chi tiết – Quyền', async ({ page }) => {
  await openTab(page, 'permissions', 'Quyền');
  await searchKeyword(page, 'BSC:APPROVE');
  await rowAction(page, 'BSC:APPROVE', 'Xem');
  const d = page.getByRole('dialog', { name: 'Thông tin quyền' });
  await expect(d.getByText('Vai trò đang có quyền này')).toBeVisible();
  await expect(d).toContainText('TONG_GIAM_DOC – Tổng giám đốc');
});

test('4.9 Ghi lại – Quyền', async ({ page }) => {
  await openTab(page, 'permissions', 'Quyền');
  await searchKeyword(page, 'NOTIFY:VIEW');
  await rowAction(page, 'NOTIFY:VIEW', 'Sửa');
  const dlg = page.getByRole('dialog', { name: 'Sửa quyền' });
  await expect(dlg).toContainText('NOTIFY:VIEW');
  await dlg.getByLabel('Mô tả').fill('Xem chuông thông báo');
  await dlg.getByLabel('Thứ tự').fill('950');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(row(page, 'NOTIFY:VIEW')).toContainText('950');
  // tên quyền bắt buộc
  await rowAction(page, 'NOTIFY:VIEW', 'Sửa');
  await page.getByRole('dialog', { name: 'Sửa quyền' }).getByLabel('Tên quyền').fill('');
  await page.getByRole('dialog', { name: 'Sửa quyền' }).getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Vui lòng nhập Tên quyền')).toBeVisible();
  void expectErrorToast;
});
