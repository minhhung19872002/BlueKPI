import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectErrorToast, expectToast, importFile, login, makeXlsx, row, rowAction, searchKeyword, uid } from './helpers';

async function openKpi(page: Page) {
  await login(page, 'admin');
  await page.goto('/kpi-admin/catalog?tab=kpi');
  await expect(page.getByRole('tab', { name: 'Danh sách KPI' })).toHaveAttribute('data-state', 'active');
}

async function pickTreeIn(page: Page, scope: Locator, label: string, item: string) {
  await scope.getByRole('button', { name: label, exact: true }).click();
  await page.getByPlaceholder('Tìm theo mã hoặc tên').fill(item);
  await page.getByRole('treeitem', { name: item }).first().click();
}

/** Điền các trường bắt buộc của form tiêu chí KPI */
async function fillKpi(page: Page, dlg: Locator, name: string, opts: { perspective?: string; objective?: string; child?: boolean } = {}) {
  await dlg.getByLabel('Tên tiêu chí').fill(name);
  await dlg.getByLabel('Cách tính kết quả KPI Tập đoàn').selectOption({ label: 'Tổng' });
  if (!opts.child) await dlg.getByLabel('Viễn cảnh', { exact: true }).selectOption({ label: opts.perspective ?? 'HP – Học hỏi & phát triển' });
  await dlg.getByLabel('Loại số liệu giao').selectOption({ label: 'Lũy kế' });
  await dlg.getByLabel('Phương pháp tính điểm').selectOption({ label: 'Khung tỷ lệ hoàn thành (thang 5)' });
  await dlg.getByLabel('Mục tiêu trọng tâm').selectOption({ label: opts.objective ?? 'MT-HP-02 – Thúc đẩy đổi mới sáng tạo' });
  await pickTreeIn(page, dlg, opts.child ? 'Đơn vị giao (KPI con)' : 'Đơn vị giao', '1. Công ty mẹ – Tập đoàn');
  await dlg.getByLabel('Cán bộ giao').selectOption({ label: 'Vũ Thị Giao KPI (giaokpi)' });
  await pickTreeIn(page, dlg, opts.child ? 'Đơn vị đánh giá (KPI con)' : 'Đơn vị đánh giá', '1. Công ty mẹ – Tập đoàn');
  await dlg.getByLabel('Cán bộ đánh giá').selectOption({ label: 'Bùi Thị Đánh Giá (danhgia)' });
  await dlg.getByLabel('Đơn vị đo').selectOption({ label: 'Sản phẩm' });
  await dlg.getByLabel('Tên thành phần 1').fill(name);
}

async function createKpi(page: Page, name: string) {
  await page.getByRole('button', { name: 'Thêm tiêu chí' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm mới tiêu chí KPI' });
  await fillKpi(page, dlg, name);
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
}

test('23.1 Lấy danh sách – Danh sách KPI', async ({ page }) => {
  await openKpi(page);
  await expect(page.getByRole('heading', { name: 'Danh sách KPI' })).toBeVisible();
  const head = page.getByRole('table', { name: 'Danh sách KPI' }).locator('thead');
  for (const h of ['STT', 'Mã – Tên tiêu chí KPI', 'Viễn cảnh', 'Đơn vị đo', 'Mã KPI cha', 'Mục tiêu trọng tâm', 'Đơn vị giao']) await expect(head.getByText(h, { exact: true })).toBeVisible();
  const parent = row(page, 'TC-001');
  await expect(parent).toContainText('Tổng doanh thu');
  await expect(page.locator('tbody tr').filter({ hasText: 'TC-001.01' })).toHaveCount(0);
  await parent.getByTestId('tree-toggle').click();
  await expect(row(page, 'TC-001.01')).toContainText('TC-001');
});

test('23.2 Tìm kiếm – Danh sách KPI', async ({ page }) => {
  await openKpi(page);
  await searchKeyword(page, 'TC-001.02');
  // khớp KPI con → hiển thị cả nhánh cha
  await expect(row(page, 'TC-001 –')).toBeVisible();
  await expect(row(page, 'TC-001.02')).toBeVisible();
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await page.getByRole('combobox', { name: 'Viễn cảnh', exact: true }).selectOption({ label: 'KH – Khách hàng' });
  await page.getByLabel('Mục tiêu trọng tâm').selectOption({ label: 'MT-KH-03 – Giữ chân khách hàng' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(row(page, 'Tỷ lệ rời mạng')).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'Tổng doanh thu' })).toHaveCount(0);
});

test('23.3 Xem chi tiết – Danh sách KPI', async ({ page }) => {
  await openKpi(page);
  await searchKeyword(page, 'TC-001');
  await rowAction(page, 'Tổng doanh thu', 'Xem');
  const d = page.getByRole('dialog', { name: 'Thông tin tiêu chí KPI' });
  await expect(d).toContainText('KPI cha – con');
  await expect(d.getByRole('table', { name: 'Danh sách KPI con' })).toContainText('TC-001.01');
  await expect(d.getByRole('table', { name: 'Danh sách thành phần' })).toContainText('DT_VT');
  await expect(d).toContainText('Phương pháp tính điểm');
});

test('24.1 Thêm mới tiêu chí đánh giá KPI – KPI đơn lẻ', async ({ page }) => {
  await openKpi(page);
  await page.getByRole('button', { name: 'Thêm tiêu chí' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm mới tiêu chí KPI' });
  await expect(dlg.getByRole('radio', { name: 'KPI đơn lẻ' })).toBeChecked();
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  for (const m of ['Vui lòng nhập Tên tiêu chí', 'Vui lòng chọn Cách tính kết quả KPI Tập đoàn', 'Vui lòng chọn Viễn cảnh', 'Vui lòng chọn Loại số liệu giao',
    'Vui lòng chọn Phương pháp tính điểm', 'Vui lòng chọn Mục tiêu trọng tâm', 'Vui lòng chọn Đơn vị giao', 'Vui lòng chọn Cán bộ giao',
    'Vui lòng chọn Đơn vị đánh giá', 'Vui lòng chọn Cán bộ đánh giá']) {
    await expect(dlg.getByText(m)).toBeVisible();
  }
  const name = `KPI đơn lẻ ${uid()}`;
  await fillKpi(page, dlg, name);
  await expect(dlg.getByLabel('Mã tiêu chí')).toHaveValue(/^HP-\d{3}$/);
  const code = await dlg.getByLabel('Mã tiêu chí').inputValue();
  await dlg.getByRole('button', { name: 'Kiểm tra biểu thức' }).click();
  await expect(dlg.getByText('Biểu thức hợp lệ')).toBeVisible();
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
  await searchKeyword(page, name);
  await expect(row(page, name)).toContainText(code);
});

test('25.1 Thêm mới tiêu chí đánh giá KPI – KPI cha – con', async ({ page }) => {
  await openKpi(page);
  await page.getByRole('button', { name: 'Thêm tiêu chí' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm mới tiêu chí KPI' });
  await dlg.getByRole('radio', { name: 'KPI cha – con' }).click();
  await expect(dlg.getByText('Danh sách KPI con')).toBeVisible();
  const name = `KPI cha ${uid()}`;
  await fillKpi(page, dlg, name);
  for (const c of ['Con 1', 'Con 2']) {
    await dlg.getByRole('button', { name: 'Thêm KPI con' }).click();
    const sub = page.getByRole('dialog', { name: 'KPI con' });
    await sub.getByLabel('Tên tiêu chí').fill(`${name} – ${c}`);
    await sub.getByLabel('Tỷ trọng (1–100) nội bộ').fill('50');
    await sub.getByLabel('Tên thành phần 1').fill(c);
    await sub.getByRole('button', { name: 'Xác nhận' }).click();
    await expect(sub).toBeHidden();
  }
  await expect(dlg.getByRole('table', { name: 'Danh sách KPI con' })).toContainText(`${name} – Con 2`);
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
  await searchKeyword(page, name);
  await expect(page.getByRole('table', { name: 'Danh sách KPI' })).toContainText(`${name} – Con 1`);
  await expect(page.getByRole('table', { name: 'Danh sách KPI' })).toContainText(/HP-\d{3}\.01/);
});

test('23.4 Ghi lại – Danh sách KPI', async ({ page }) => {
  await openKpi(page);
  const name = `KPI sửa ${uid()}`;
  await createKpi(page, name);
  await searchKeyword(page, name);
  await rowAction(page, name, 'Sửa');
  const dlg = page.getByRole('dialog', { name: 'Cập nhật tiêu chí KPI' });
  await expect(dlg.getByLabel('Viễn cảnh', { exact: true })).toBeDisabled();
  await dlg.getByLabel('Tên tiêu chí').fill(`${name} (đã sửa)`);
  await dlg.getByText('Thuộc vùng chỉ đạo trọng tâm').click();
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(row(page, `${name} (đã sửa)`)).toContainText('Trọng tâm');
});

test('23.5 Xóa – Danh sách KPI', async ({ page }) => {
  await openKpi(page);
  const name = `KPI xóa ${uid()}`;
  await createKpi(page, name);
  await searchKeyword(page, name);
  await rowAction(page, name, 'Xóa');
  await expect(page.getByRole('dialog', { name: 'Xác nhận xóa' })).toContainText(name);
  await page.getByTestId('confirm-ok').click();
  await expectToast(page, 'Xóa thành công');
  // KPI cha có con → hỏi lại vì sẽ xóa cả KPI con
  await searchKeyword(page, 'Năng suất lao động');
  await rowAction(page, 'HP-003 –', 'Xóa');
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByRole('dialog', { name: 'Xác nhận xóa' })).toContainText('xóa KPI cha sẽ xóa cả KPI con');
  await page.getByRole('button', { name: 'Hủy' }).click();
  void expectErrorToast;
});

test('23.6 Nhập dữ liệu – Danh sách KPI', async ({ page }) => {
  await openKpi(page);
  const n = uid('NK');
  await page.getByRole('button', { name: 'Nhập dữ liệu' }).click();
  const headers = ['Mã tham chiếu', 'Mã KPI cha', 'Tên tiêu chí (*)', 'Cách tính kết quả KPI Tập đoàn (*)', 'Mã viễn cảnh (*)', 'Link với KPI tập đoàn',
    'Loại số liệu giao (*)', 'Công thức tỷ lệ hoàn thành chỉ tiêu', 'Mã phương pháp tính điểm (*)', 'Tính điểm theo kết quả thực hiện',
    'Mã mục tiêu trọng tâm (*)', 'Tỷ trọng (1–100)', 'Mã đơn vị giao (*)', 'Cán bộ giao (tên đăng nhập) (*)', 'Mã đơn vị đánh giá (*)',
    'Cán bộ đánh giá (tên đăng nhập) (*)', 'Nguồn dữ liệu', 'Đơn vị đo (*)', 'Thuộc vùng chỉ đạo trọng tâm'];
  const base = (name: string, ref: string, parent: string) => [ref, parent, name, 'Tổng', 'QT', '', 'Theo kỳ', 'THUAN', 'KHUNG_TY_LE_5', 'Có', 'MT-QT-02', '', 'VNPT', 'giaokpi', 'VNPT', 'danhgia', 'Nhập tay', '%', 'Không'];
  const buf = await makeXlsx(headers, [base(`Nhập cha ${n}`, 'R1', ''), base(`Nhập con ${n}`, 'R2', 'R1'), base(`Lỗi ${n}`, 'R3', 'KHONG_CO')]);
  const dlg = await importFile(page, buf);
  await expect(dlg.getByText('Mã KPI cha không tồn tại')).toBeVisible();
  await dlg.getByRole('button', { name: 'Xác nhận nhập' }).click();
  await expect(dlg.getByTestId('import-result')).toContainText('Đã nhập 2/3 bản ghi; 1 bản ghi lỗi');
  await dlg.getByRole('button', { name: 'Đóng' }).first().click();
  await searchKeyword(page, n);
  await expect(page.getByRole('table', { name: 'Danh sách KPI' })).toContainText(`Nhập con ${n}`);
});

test('23.7 Xuất dữ liệu – Danh sách KPI', async ({ page }) => {
  await openKpi(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất dữ liệu' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^DanhSachKPI_\d{8}_\d{4}\.xlsx$/);
});
