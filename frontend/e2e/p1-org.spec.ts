import { expect, test, type Page } from '@playwright/test';
import { expectErrorToast, expectToast, importFile, login, makeXlsx, pickTree, row, rowAction, searchKeyword, uid } from './helpers';

async function openOrg(page: Page) {
  await login(page, 'admin');
  await page.goto('/system?tab=org-units');
  await expect(page.getByRole('tab', { name: 'Danh sách đơn vị' })).toHaveAttribute('data-state', 'active');
}

async function createUnit(page: Page, code: string, parent = 'VNPT Hà Nội') {
  await page.getByRole('button', { name: 'Thêm đơn vị' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm đơn vị' });
  await dlg.getByLabel('Mã đơn vị').fill(code);
  await dlg.getByLabel('Tên đơn vị').fill(`Phòng ${code}`);
  await pickTree(page, 'Đơn vị cha', parent);
  await dlg.getByLabel('Tên viết tắt').fill(`P.${code}`);
  await dlg.getByLabel('Loại đơn vị').selectOption({ label: 'Phòng ban' });
  await dlg.getByLabel('Vùng').selectOption({ label: 'Miền Bắc' });
  await dlg.getByText('Giao KPI').click();
  await dlg.getByLabel('Thứ tự').fill('5');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
}

test('5.1 Lấy danh sách – Đơn vị', async ({ page }) => {
  await openOrg(page);
  await expect(page.getByRole('heading', { name: 'Danh sách đơn vị' })).toBeVisible();
  const head = page.getByRole('table', { name: 'Danh sách đơn vị' }).locator('thead');
  for (const h of ['STT', 'Mã đơn vị', 'Tên đơn vị', 'Đơn vị cha', 'Tên viết tắt', 'Loại đơn vị', 'Vùng', 'Giao KPI', 'Thứ tự', 'Người tạo', 'Ngày tạo', 'Người cập nhật', 'Ngày cập nhật']) {
    await expect(head.getByText(h, { exact: true })).toBeVisible();
  }
  await expect(row(page, '1. Công ty mẹ – Tập đoàn')).toBeVisible();
  // chuyển chế độ xem Lưới/Cây
  await page.getByRole('button', { name: 'Cây' }).click();
  const tree = page.getByRole('table', { name: 'Cây đơn vị' });
  await expect(tree).toContainText('1. Công ty mẹ – Tập đoàn');
  await tree.getByTestId('tree-toggle').first().click();
  await expect(tree).toContainText('VNPT Hà Nội');
  await page.getByRole('button', { name: 'Lưới' }).click();
});

test('5.2 Tìm kiếm – Đơn vị', async ({ page }) => {
  await openOrg(page);
  await searchKeyword(page, 'VNPT HCM');
  await expect(row(page, 'VNPT TP. Hồ Chí Minh')).toBeVisible();
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await page.getByLabel('Loại đơn vị').selectOption({ label: 'VNPT tỉnh/thành phố' });
  await page.getByLabel('Vùng').selectOption({ label: 'Miền Trung' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(row(page, 'VNPT Đà Nẵng')).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'VNPT Hà Nội' })).toHaveCount(0);
});

test('5.3 Xem chi tiết – Đơn vị', async ({ page }) => {
  await openOrg(page);
  await searchKeyword(page, 'VNPT_HUE');
  await rowAction(page, 'VNPT_HUE', 'Xem');
  const d = page.getByRole('dialog', { name: 'Thông tin đơn vị' });
  await expect(d).toContainText('VNPT Huế');
  await expect(d).toContainText('1. Công ty mẹ – Tập đoàn');
  await expect(d).toContainText('Miền Trung');
});

test('5.4 Thêm mới – Đơn vị', async ({ page }) => {
  await openOrg(page);
  await page.getByRole('button', { name: 'Thêm đơn vị' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm đơn vị' });
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Vui lòng nhập Mã đơn vị')).toBeVisible();
  await expect(dlg.getByText('Vui lòng chọn Loại đơn vị')).toBeVisible();
  await dlg.getByRole('button', { name: 'Hủy' }).click();
  const code = uid('DV');
  await createUnit(page, code);
  await searchKeyword(page, code);
  await expect(row(page, code)).toContainText('VNPT Hà Nội');
});

test('5.5 Ghi lại – Đơn vị', async ({ page }) => {
  await openOrg(page);
  const a = uid('CHA');
  const b = uid('CON');
  await createUnit(page, a);
  await createUnit(page, b, `Phòng ${a}`);
  // không chọn cha là con cháu của nó
  await searchKeyword(page, a);
  await rowAction(page, `Phòng ${a}`, 'Sửa');
  await pickTree(page, 'Đơn vị cha', `Phòng ${b}`);
  await page.getByRole('dialog', { name: 'Sửa đơn vị' }).getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Không được chọn đơn vị cha là đơn vị con cháu của nó').first()).toBeVisible();
  await page.getByRole('dialog', { name: 'Sửa đơn vị' }).getByRole('button', { name: 'Hủy' }).click();
  // đổi cha sang VNPT Hải Phòng → cập nhật path cả cây con
  await rowAction(page, `Phòng ${a}`, 'Sửa');
  await pickTree(page, 'Đơn vị cha', 'VNPT Hải Phòng');
  await page.getByRole('dialog', { name: 'Sửa đơn vị' }).getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(row(page, `Phòng ${a}`)).toContainText('VNPT Hải Phòng');
  await page.goto('/system?tab=users');
  await pickTree(page, 'Đơn vị', 'VNPT Hải Phòng');
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(page.getByTestId('grid-total')).toBeVisible();
});

test('5.6 Xóa – Đơn vị', async ({ page }) => {
  await openOrg(page);
  const code = uid('DX');
  await createUnit(page, code);
  await searchKeyword(page, code);
  await rowAction(page, code, 'Xóa');
  await page.getByTestId('confirm-ok').click();
  await expectToast(page, 'Xóa thành công');
  // còn đơn vị con / người dùng → chặn
  await searchKeyword(page, 'VNPT_HNI');
  await rowAction(page, 'VNPT Hà Nội', 'Xóa');
  await page.getByTestId('confirm-ok').click();
  await expectErrorToast(page, 'Không thể xóa vì dữ liệu đang được sử dụng tại:');
});

test('5.7 Nhập dữ liệu – Đơn vị', async ({ page }) => {
  await openOrg(page);
  const p = uid('IMPP');
  const c = uid('IMPC');
  await page.getByRole('button', { name: 'Nhập dữ liệu' }).click();
  const buf = await makeXlsx(
    ['Mã đơn vị (*)', 'Tên đơn vị (*)', 'Mã đơn vị cha', 'Tên viết tắt', 'Loại đơn vị (*)', 'Vùng', 'Giao KPI', 'Thứ tự'],
    [
      [p, `Trung tâm ${p}`, 'VNPT_HNI', 'TT', 'Trung tâm', 'MB', 'Có', 1],
      [c, `Tổ ${c}`, p, 'TO', 'PHONG_BAN', 'MB', 'Không', 2],
      [uid('BAD'), 'Lỗi cha', 'KHONG_TON_TAI', '', 'PHONG_BAN', '', '', ''],
    ],
  );
  const dlg = await importFile(page, buf);
  await expect(dlg.getByText('Mã đơn vị cha không tồn tại')).toBeVisible();
  await dlg.getByRole('button', { name: 'Xác nhận nhập' }).click();
  await expect(dlg.getByTestId('import-result')).toContainText('Đã nhập 2/3 bản ghi; 1 bản ghi lỗi');
  await dlg.getByRole('button', { name: 'Đóng' }).first().click();
  await searchKeyword(page, c);
  await expect(row(page, c)).toContainText(`Trung tâm ${p}`);
});

test('5.8 Xuất dữ liệu – Đơn vị', async ({ page }) => {
  await openOrg(page);
  await page.getByLabel('Loại đơn vị').selectOption({ label: 'VNPT tỉnh/thành phố' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất dữ liệu' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^DanhSachDonVi_\d{8}_\d{4}\.xlsx$/);
});
