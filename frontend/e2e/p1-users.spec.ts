import { expect, test, type Page } from '@playwright/test';
import { expectErrorToast, expectToast, importFile, login, makeXlsx, pickTree, row, rowAction, searchKeyword, uid } from './helpers';

async function openUsers(page: Page) {
  await login(page, 'admin');
  await page.goto('/system?tab=users');
  await expect(page.getByRole('tab', { name: 'Danh sách người dùng' })).toHaveAttribute('data-state', 'active');
}

async function createUser(page: Page, name: string, username: string) {
  await page.getByRole('button', { name: 'Thêm người dùng' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm người dùng' });
  await dlg.getByLabel('Họ tên').fill(name);
  await dlg.getByLabel('Email').fill(`${username}@vnpt.vn`);
  await pickTree(page, 'Đơn vị *', 'VNPT Hà Nội');
  await expect(dlg.getByLabel('Tên đăng nhập')).toHaveValue(username);
  await dlg.getByLabel('Mật khẩu khởi tạo').fill('Matkhau@123');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
}

test('3.1 Lấy danh sách – Người dùng', async ({ page }) => {
  await openUsers(page);
  await expect(page.getByRole('heading', { name: 'Danh sách người dùng' })).toBeVisible();
  const head = page.getByRole('table', { name: 'Danh sách người dùng' }).locator('thead');
  for (const h of ['STT', 'Họ tên', 'Email', 'Đơn vị', 'Trạng thái', 'Người tạo', 'Ngày tạo', 'Người cập nhật', 'Ngày cập nhật', 'Thao tác']) {
    await expect(head.getByText(h, { exact: true })).toBeVisible();
  }
  await expect(row(page, 'admin@vnpt.vn')).toBeVisible();
});

test('3.2 Tìm kiếm – Người dùng', async ({ page }) => {
  await openUsers(page);
  await searchKeyword(page, 'tinh_hni@vnpt.vn');
  await expect(page.getByTestId('grid-total')).toHaveText('1');
  await expect(row(page, 'Ngô Thị Hà Nội')).toBeVisible();
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await page.getByLabel('Trạng thái').selectOption({ label: 'Khóa' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(row(page, 'khoa_test@vnpt.vn')).toBeVisible();
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await pickTree(page, 'Đơn vị', 'VNPT Hà Nội');
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(row(page, 'tinh_hni@vnpt.vn')).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'tinh_hcm@vnpt.vn' })).toHaveCount(0);
});

test('3.3 Xem chi tiết – Người dùng', async ({ page }) => {
  await openUsers(page);
  await searchKeyword(page, 'admin@vnpt.vn');
  await rowAction(page, 'admin@vnpt.vn', 'Xem');
  const d = page.getByRole('dialog', { name: 'Thông tin người dùng' });
  await expect(d.getByText('Danh sách vai trò đã gán')).toBeVisible();
  await expect(d.getByText('ADMIN_HT – Admin hệ thống')).toBeVisible();
});

test('3.4 Thêm mới – Người dùng', async ({ page }) => {
  await openUsers(page);
  await page.getByRole('button', { name: 'Thêm người dùng' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm người dùng' });
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Vui lòng nhập Họ tên')).toBeVisible();
  await expect(dlg.getByText('Vui lòng chọn Đơn vị')).toBeVisible();
  await dlg.getByRole('button', { name: 'Hủy' }).click();
  const u = uid('nv').toLowerCase();
  await createUser(page, `Nhân viên ${u}`, u);
  await searchKeyword(page, u);
  await expect(row(page, `Nhân viên ${u}`)).toBeVisible();
});

test('3.5 Ghi lại – Người dùng', async ({ page }) => {
  await openUsers(page);
  const u = uid('sua').toLowerCase();
  await createUser(page, `Người sửa ${u}`, u);
  await searchKeyword(page, u);
  await rowAction(page, u, 'Sửa');
  const dlg = page.getByRole('dialog', { name: 'Sửa người dùng' });
  await expect(dlg.getByLabel('Tên đăng nhập')).toBeDisabled();
  await dlg.getByLabel('Họ tên').fill(`Đã sửa ${u}`);
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(row(page, `Đã sửa ${u}`)).toContainText('admin');
});

test('3.6 Xóa – Người dùng', async ({ page }) => {
  await openUsers(page);
  const u = uid('xoa').toLowerCase();
  await createUser(page, `Người xóa ${u}`, u);
  await searchKeyword(page, u);
  await rowAction(page, u, 'Xóa');
  await expect(page.getByRole('dialog', { name: 'Xác nhận xóa' })).toContainText(`Người xóa ${u}`);
  await page.getByTestId('confirm-ok').click();
  await expectToast(page, 'Xóa thành công');
  await expect(page.getByTestId('grid-total')).toHaveText('0');
  // không được xóa chính mình
  await searchKeyword(page, 'admin@vnpt.vn');
  await rowAction(page, 'admin@vnpt.vn', 'Xóa');
  await page.getByTestId('confirm-ok').click();
  await expectErrorToast(page, 'Không được xóa chính tài khoản đang đăng nhập');
});

test('3.7 Nhập dữ liệu – Người dùng', async ({ page }) => {
  await openUsers(page);
  const u = uid('imp').toLowerCase();
  await page.getByRole('button', { name: 'Nhập dữ liệu' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('dialog').getByText('Tải file mẫu').click()]);
  expect(dl.suggestedFilename()).toContain('.xlsx');
  const buf = await makeXlsx(
    ['Họ tên (*)', 'Email (*)', 'Tên đăng nhập (*)', 'Mã đơn vị (*)', 'Trạng thái (*)', 'Mã vai trò', 'Nguồn xác thực', 'Mật khẩu khởi tạo'],
    [
      [`Nhập ${u}`, `${u}@vnpt.vn`, u, 'VNPT_HNI', 'Hoạt động', 'NGUOI_DUNG_DV', 'Cả hai', 'Matkhau@123'],
      ['Lỗi đơn vị', `${u}x@vnpt.vn`, `${u}x`, 'KHONG_CO', 'Hoạt động', '', 'SSO', ''],
    ],
  );
  const dlg = await importFile(page, buf);
  await expect(dlg.getByText('Mã đơn vị không tồn tại')).toBeVisible();
  await dlg.getByRole('button', { name: 'Xác nhận nhập' }).click();
  await expect(dlg.getByTestId('import-result')).toContainText('Đã nhập 1/2 bản ghi; 1 bản ghi lỗi');
  await dlg.getByRole('button', { name: 'Đóng' }).first().click();
  await searchKeyword(page, u);
  await expect(row(page, `Nhập ${u}`)).toBeVisible();
});

test('3.8 Xuất dữ liệu – Người dùng', async ({ page }) => {
  await openUsers(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất dữ liệu' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^DanhSachNguoiDung_\d{8}_\d{4}\.xlsx$/);
});

test('3.9 Gán vai trò cho người dùng', async ({ page }) => {
  await openUsers(page);
  const u = uid('gan').toLowerCase();
  await createUser(page, `Gán vai trò ${u}`, u);
  await searchKeyword(page, u);
  await rowAction(page, u, 'Quản lý vai trò người dùng');
  const dlg = page.getByRole('dialog', { name: 'Quản lý vai trò người dùng' });
  await expect(dlg.getByText('Vai trò có sẵn')).toBeVisible();
  await expect(dlg.getByText('Vai trò đã gán')).toBeVisible();
  await dlg.getByTestId('roles-available').getByText('DANH_GIA_KPI – Đánh giá KPI').click();
  await dlg.getByRole('button', { name: 'Thêm →' }).click();
  await expect(dlg.getByTestId('roles-assigned')).toContainText('DANH_GIA_KPI – Đánh giá KPI');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật vai trò thành công');
  await rowAction(page, u, 'Xem');
  await expect(page.getByRole('dialog', { name: 'Thông tin người dùng' })).toContainText('DANH_GIA_KPI – Đánh giá KPI');
});

test('3.10 Bỏ gán vai trò của người dùng', async ({ page }) => {
  await openUsers(page);
  const u = uid('bo').toLowerCase();
  await createUser(page, `Bỏ gán ${u}`, u);
  await searchKeyword(page, u);
  await rowAction(page, u, 'Quản lý vai trò người dùng');
  let dlg = page.getByRole('dialog', { name: 'Quản lý vai trò người dùng' });
  await dlg.getByTestId('roles-available').getByText('PHOI_HOP_KPI – Phối hợp KPI').click();
  await dlg.getByRole('button', { name: 'Thêm →' }).click();
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật vai trò thành công');
  await rowAction(page, u, 'Quản lý vai trò người dùng');
  dlg = page.getByRole('dialog', { name: 'Quản lý vai trò người dùng' });
  await dlg.getByTestId('roles-assigned').getByText('PHOI_HOP_KPI – Phối hợp KPI').click();
  await expect(dlg.getByTestId('roles-assigned')).not.toContainText('PHOI_HOP_KPI');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật vai trò thành công');
  await rowAction(page, u, 'Xem');
  await expect(page.getByRole('dialog', { name: 'Thông tin người dùng' })).toContainText('Chưa gán vai trò');
});
