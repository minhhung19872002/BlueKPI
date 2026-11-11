import { expect, test, type Page } from '@playwright/test';
import { expectErrorToast, expectToast, importFile, login, makeXlsx, row, rowAction, searchKeyword, uid } from './helpers';

const IN_USE = 'Không thể xóa vì dữ liệu đang được sử dụng tại:';

async function openCatalogTab(page: Page, tab: 'uom' | 'perspective' | 'formula', label: string) {
  await login(page, 'admin');
  await page.goto(`/kpi-admin/catalog?tab=${tab}`);
  await expect(page.getByRole('tab', { name: label })).toHaveAttribute('data-state', 'active');
}

async function openObjectives(page: Page) {
  await login(page, 'admin');
  await page.goto('/kpi-admin/objectives');
  await expect(page.getByRole('heading', { name: 'Danh mục mục tiêu trọng tâm' })).toBeVisible();
}

async function expectHeaders(page: Page, table: string, headers: string[]) {
  await expect(page.getByRole('heading', { name: table })).toBeVisible();
  const head = page.getByRole('table', { name: table }).locator('thead');
  for (const h of headers) await expect(head.getByText(h, { exact: true })).toBeVisible();
}

async function confirmOk(page: Page) {
  await page.getByTestId('confirm-ok').click();
}

async function exportFile(page: Page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất dữ liệu' }).click()]);
  return dl.suggestedFilename();
}

const perCode = () => 'P' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 10);

// ======================= Đơn vị đo (26.1–26.8) =======================

async function createUom(page: Page, name: string, desc = 'Đơn vị đo e2e') {
  await page.getByRole('button', { name: 'Thêm đơn vị đo' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm đơn vị đo' });
  await dlg.getByLabel('Tên đơn vị đo').fill(name);
  await dlg.getByLabel('Mô tả').fill(desc);
  await dlg.getByLabel('Trạng thái').selectOption({ label: 'Hiệu lực' });
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
}

test('26.1 Lấy danh sách – Đơn vị đo', async ({ page }) => {
  await openCatalogTab(page, 'uom', 'Đơn vị đo');
  await expectHeaders(page, 'Danh sách đơn vị đo', ['STT', 'Tên đơn vị đo', 'Mô tả', 'Trạng thái', 'Người tạo', 'Ngày tạo', 'Người cập nhật', 'Ngày cập nhật', 'Thao tác']);
  await searchKeyword(page, 'Tỷ đồng');
  await expect(row(page, 'Tỷ đồng')).toContainText('Hiệu lực');
  await expect(page.getByRole('button', { name: 'Thêm đơn vị đo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nhập dữ liệu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xuất dữ liệu' })).toBeVisible();
});

test('26.2 Tìm kiếm – Đơn vị đo', async ({ page }) => {
  await openCatalogTab(page, 'uom', 'Đơn vị đo');
  await searchKeyword(page, 'Thuê bao');
  await expect(row(page, 'Thuê bao')).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'Tỷ đồng' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect(page.getByLabel('Từ khóa tìm kiếm')).toHaveValue('');
  await page.getByLabel('Từ khóa tìm kiếm').fill('Tỷ đồng');
  await page.getByLabel('Trạng thái').selectOption({ label: 'Không hiệu lực' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(page.locator('tbody tr').filter({ hasText: 'Tỷ đồng' })).toHaveCount(0);
  await page.getByLabel('Trạng thái').selectOption({ label: 'Hiệu lực' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(row(page, 'Tỷ đồng')).toBeVisible();
});

test('26.3 Xem chi tiết – Đơn vị đo', async ({ page }) => {
  await openCatalogTab(page, 'uom', 'Đơn vị đo');
  await searchKeyword(page, 'Tỷ đồng');
  await rowAction(page, 'Tỷ đồng', 'Xem');
  const d = page.getByRole('dialog', { name: 'Thông tin đơn vị đo' });
  await expect(d).toContainText('Tỷ đồng');
  await expect(d).toContainText('Hiệu lực');
  for (const l of ['Mã', 'Tên đơn vị đo', 'Mô tả', 'Trạng thái', 'Người tạo', 'Ngày tạo', 'Người cập nhật', 'Ngày cập nhật']) await expect(d.getByText(l, { exact: true })).toBeVisible();
});

test('26.4 Thêm mới – Đơn vị đo', async ({ page }) => {
  await openCatalogTab(page, 'uom', 'Đơn vị đo');
  await page.getByRole('button', { name: 'Thêm đơn vị đo' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm đơn vị đo' });
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Vui lòng nhập Tên đơn vị đo')).toBeVisible();
  // trùng tên → lỗi tại trường (backend)
  await dlg.getByLabel('Tên đơn vị đo').fill('Tỷ đồng');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Tên đơn vị đo đã tồn tại')).toBeVisible();
  await dlg.getByRole('button', { name: 'Hủy' }).click();
  const name = uid('ĐVĐ ');
  await createUom(page, name);
  await searchKeyword(page, name);
  await expect(row(page, name)).toContainText('Đơn vị đo e2e');
  await expect(row(page, name)).toContainText('admin');
});

test('26.5 Ghi lại – Đơn vị đo', async ({ page }) => {
  await openCatalogTab(page, 'uom', 'Đơn vị đo');
  const name = uid('ĐVĐ SỬA ');
  await createUom(page, name);
  await searchKeyword(page, name);
  await rowAction(page, name, 'Sửa');
  const dlg = page.getByRole('dialog', { name: 'Sửa đơn vị đo' });
  await expect(dlg.getByLabel('Tên đơn vị đo')).toHaveValue(name);
  await dlg.getByLabel('Mô tả').fill('Đã cập nhật');
  await dlg.getByLabel('Trạng thái').selectOption({ label: 'Không hiệu lực' });
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(row(page, name)).toContainText('Đã cập nhật');
  await expect(row(page, name)).toContainText('Không hiệu lực');
});

test('26.6 Xóa – Đơn vị đo', async ({ page }) => {
  await openCatalogTab(page, 'uom', 'Đơn vị đo');
  const name = uid('ĐVĐ XÓA ');
  await createUom(page, name);
  await searchKeyword(page, name);
  await rowAction(page, name, 'Xóa');
  await confirmOk(page);
  await expectToast(page, 'Xóa thành công');
  await expect(page.locator('tbody tr').filter({ hasText: name })).toHaveCount(0);
  // đang được KPI sử dụng → chặn
  await searchKeyword(page, 'Tỷ đồng');
  await rowAction(page, 'Tỷ đồng', 'Xóa');
  await confirmOk(page);
  await expectErrorToast(page, IN_USE);
});

test('26.7 Nhập dữ liệu – Đơn vị đo', async ({ page }) => {
  await openCatalogTab(page, 'uom', 'Đơn vị đo');
  const name = uid('ĐVĐ NHẬP ');
  await page.getByRole('button', { name: 'Nhập dữ liệu' }).click();
  const buf = await makeXlsx(
    ['Tên đơn vị đo (*)', 'Mô tả', 'Trạng thái (*)'],
    [
      [name, 'Nhập từ file', 'Hiệu lực'],
      [uid('ĐVĐ LỖI '), 'Sai trạng thái', 'Không rõ'],
    ],
  );
  const dlg = await importFile(page, buf);
  await expect(dlg.getByText('Trạng thái không hợp lệ')).toBeVisible();
  await dlg.getByRole('button', { name: 'Xác nhận nhập' }).click();
  await expect(dlg.getByTestId('import-result')).toContainText('Đã nhập 1/2 bản ghi; 1 bản ghi lỗi');
  await dlg.getByRole('button', { name: 'Đóng' }).first().click();
  await searchKeyword(page, name);
  await expect(row(page, name)).toContainText('Nhập từ file');
});

test('26.8 Xuất dữ liệu – Đơn vị đo', async ({ page }) => {
  await openCatalogTab(page, 'uom', 'Đơn vị đo');
  await page.getByLabel('Trạng thái').selectOption({ label: 'Hiệu lực' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  expect(await exportFile(page)).toMatch(/^DanhSachDonViDo_\d{8}_\d{4}\.xlsx$/);
});

// ======================= Viễn cảnh (26.9–26.16) =======================

async function createPerspective(page: Page, code: string, name = `Viễn cảnh ${code}`) {
  await page.getByRole('button', { name: 'Thêm viễn cảnh' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm viễn cảnh' });
  await dlg.getByLabel('Mã viễn cảnh').fill(code);
  await dlg.getByLabel('Tên viễn cảnh').fill(name);
  await dlg.getByLabel('Thứ tự').fill('9');
  await dlg.getByLabel('Màu', { exact: true }).fill('#10B981');
  await dlg.getByLabel('Mô tả').fill('Viễn cảnh e2e');
  await dlg.getByLabel('Trạng thái').selectOption({ label: 'Hiệu lực' });
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
}

test('26.9 Lấy danh sách – Viễn cảnh', async ({ page }) => {
  await openCatalogTab(page, 'perspective', 'Viễn cảnh');
  await expectHeaders(page, 'Danh sách viễn cảnh', [
    'STT',
    'Mã – Tên viễn cảnh',
    'Thứ tự',
    'Mô tả',
    'Màu',
    'Trạng thái',
    'Người tạo',
    'Ngày tạo',
    'Người cập nhật',
    'Ngày cập nhật',
    'Thao tác',
  ]);
  await expect(row(page, 'TC – Tài chính')).toContainText('#1D4ED8');
  for (const c of ['KH – ', 'QT – ', 'HP – ']) await expect(row(page, c)).toBeVisible();
});

test('26.10 Tìm kiếm – Viễn cảnh', async ({ page }) => {
  await openCatalogTab(page, 'perspective', 'Viễn cảnh');
  await searchKeyword(page, 'Tài chính');
  await expect(row(page, 'TC – Tài chính')).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'KH – ' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await page.getByLabel('Trạng thái').selectOption({ label: 'Không hiệu lực' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(page.locator('tbody tr').filter({ hasText: 'TC – Tài chính' })).toHaveCount(0);
});

test('26.11 Xem chi tiết – Viễn cảnh', async ({ page }) => {
  await openCatalogTab(page, 'perspective', 'Viễn cảnh');
  await rowAction(page, 'TC – Tài chính', 'Xem');
  const d = page.getByRole('dialog', { name: 'Thông tin viễn cảnh' });
  await expect(d).toContainText('Tài chính');
  await expect(d).toContainText('#1D4ED8');
  await expect(d).toContainText('Viễn cảnh tài chính');
  await expect(d.getByText('Người tạo', { exact: true })).toBeVisible();
});

test('26.12 Thêm mới – Viễn cảnh', async ({ page }) => {
  await openCatalogTab(page, 'perspective', 'Viễn cảnh');
  await page.getByRole('button', { name: 'Thêm viễn cảnh' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm viễn cảnh' });
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Vui lòng nhập Mã viễn cảnh')).toBeVisible();
  await expect(dlg.getByText('Vui lòng nhập Tên viễn cảnh')).toBeVisible();
  await dlg.getByLabel('Mã viễn cảnh').fill('TC');
  await dlg.getByLabel('Tên viễn cảnh').fill('Trùng mã');
  await dlg.getByLabel('Màu', { exact: true }).fill('xanh');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Màu phải theo định dạng #RRGGBB')).toBeVisible();
  await dlg.getByLabel('Màu', { exact: true }).fill('#123456');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Mã viễn cảnh đã tồn tại')).toBeVisible();
  await dlg.getByRole('button', { name: 'Hủy' }).click();
  const code = perCode();
  await createPerspective(page, code);
  await searchKeyword(page, code);
  await expect(row(page, `${code} – Viễn cảnh ${code}`)).toContainText('#10B981');
});

test('26.13 Ghi lại – Viễn cảnh', async ({ page }) => {
  await openCatalogTab(page, 'perspective', 'Viễn cảnh');
  // viễn cảnh đã dùng làm tiền tố mã KPI → khóa mã
  await rowAction(page, 'TC – Tài chính', 'Sửa');
  const dlg = page.getByRole('dialog', { name: 'Sửa viễn cảnh' });
  await expect(dlg.getByLabel('Mã viễn cảnh')).toBeDisabled();
  await dlg.getByRole('button', { name: 'Hủy' }).click();
  const code = perCode();
  await createPerspective(page, code);
  await searchKeyword(page, code);
  await rowAction(page, code, 'Sửa');
  await expect(dlg.getByLabel('Mã viễn cảnh')).toBeEnabled();
  await dlg.getByLabel('Tên viễn cảnh').fill(`Đã sửa ${code}`);
  await dlg.getByLabel('Màu', { exact: true }).fill('#F59E0B');
  await dlg.getByLabel('Thứ tự').fill('12');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(row(page, code)).toContainText(`${code} – Đã sửa ${code}`);
  await expect(row(page, code)).toContainText('#F59E0B');
});

test('26.14 Xóa – Viễn cảnh', async ({ page }) => {
  await openCatalogTab(page, 'perspective', 'Viễn cảnh');
  const code = perCode();
  await createPerspective(page, code);
  await searchKeyword(page, code);
  await rowAction(page, code, 'Xóa');
  await confirmOk(page);
  await expectToast(page, 'Xóa thành công');
  await expect(page.locator('tbody tr').filter({ hasText: code })).toHaveCount(0);
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await rowAction(page, 'TC – Tài chính', 'Xóa');
  await confirmOk(page);
  await expectErrorToast(page, IN_USE);
});

test('26.15 Nhập dữ liệu – Viễn cảnh', async ({ page }) => {
  await openCatalogTab(page, 'perspective', 'Viễn cảnh');
  const code = perCode();
  await page.getByRole('button', { name: 'Nhập dữ liệu' }).click();
  const buf = await makeXlsx(
    ['Mã viễn cảnh (*)', 'Tên viễn cảnh (*)', 'Thứ tự', 'Mô tả', 'Màu', 'Trạng thái (*)'],
    [
      [code, `Nhập ${code}`, 7, 'Nhập từ file', '#0EA5E9', 'Hiệu lực'],
      ['SAI-MA', 'Mã lỗi', 8, '', '#000000', 'Hiệu lực'],
    ],
  );
  const dlg = await importFile(page, buf);
  await expect(dlg.getByText('Mã viễn cảnh không hợp lệ')).toBeVisible();
  await dlg.getByRole('button', { name: 'Xác nhận nhập' }).click();
  await expect(dlg.getByTestId('import-result')).toContainText('Đã nhập 1/2 bản ghi; 1 bản ghi lỗi');
  await dlg.getByRole('button', { name: 'Đóng' }).first().click();
  await searchKeyword(page, code);
  await expect(row(page, `${code} – Nhập ${code}`)).toContainText('#0EA5E9');
});

test('26.16 Xuất dữ liệu – Viễn cảnh', async ({ page }) => {
  await openCatalogTab(page, 'perspective', 'Viễn cảnh');
  await page.getByLabel('Trạng thái').selectOption({ label: 'Hiệu lực' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  expect(await exportFile(page)).toMatch(/^DanhSachVienCanh_\d{8}_\d{4}\.xlsx$/);
});

// ======================= Định nghĩa KPI công thức (27.1–27.6) =======================

const API_PATH = '/kpi/{kpiCode}?year={year}&period={period}&unitCode={unitCode}';

async function createManualFormula(page: Page, code: string) {
  await page.getByRole('button', { name: 'Thêm định nghĩa KPI công thức' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm định nghĩa KPI công thức' });
  await dlg.getByLabel('Mã định nghĩa').fill(code);
  await dlg.getByLabel('Tên định nghĩa').fill(`Định nghĩa ${code}`);
  await dlg.getByLabel('Loại định nghĩa').selectOption({ label: 'Thành phần nhập tay' });
  await dlg.getByLabel('Loại số liệu').selectOption({ label: 'Số lượng' });
  await dlg.getByLabel('Mô tả nghiệp vụ').fill('Thành phần nhập tay e2e');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
}

test('27.1 Lấy danh sách – Định nghĩa KPI công thức', async ({ page }) => {
  await openCatalogTab(page, 'formula', 'Định nghĩa KPI công thức');
  await expectHeaders(page, 'Danh sách định nghĩa KPI công thức', [
    'STT',
    'Mã – Tên định nghĩa',
    'Loại định nghĩa',
    'Loại số liệu',
    'Biểu thức công thức',
    'Định nghĩa nguồn',
    'Đường dẫn API',
    'Mô tả nghiệp vụ',
    'Trạng thái',
    'Người tạo',
    'Thao tác',
  ]);
  await searchKeyword(page, 'DT_VT');
  await expect(row(page, 'DT_VT – Doanh thu viễn thông')).toContainText('Thành phần lấy từ API');
  await expect(row(page, 'DT_VT – Doanh thu viễn thông')).toContainText('Tiền tệ');
  await searchKeyword(page, 'DT_TONG');
  await expect(row(page, 'DT_TONG')).toContainText('Công thức tổng hợp');
  await expect(row(page, 'DT_TONG')).toContainText('DT_VT + DT_CNTT + DT_SO');
});

test('27.2 Tìm kiếm – Định nghĩa KPI công thức', async ({ page }) => {
  await openCatalogTab(page, 'formula', 'Định nghĩa KPI công thức');
  await searchKeyword(page, 'Doanh thu');
  await expect(row(page, 'DT_VT')).toBeVisible();
  await expect(row(page, 'DT_CNTT')).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'NPS' })).toHaveCount(0);
  await page.getByLabel('Trạng thái').selectOption({ label: 'Không hiệu lực' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(page.locator('tbody tr').filter({ hasText: 'DT_VT' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await searchKeyword(page, 'NPS');
  await expect(row(page, 'NPS – Chỉ số NPS')).toContainText('Tỷ lệ');
});

test('27.3 Xem chi tiết – Định nghĩa KPI công thức', async ({ page }) => {
  await openCatalogTab(page, 'formula', 'Định nghĩa KPI công thức');
  await searchKeyword(page, 'DT_VT');
  await rowAction(page, 'DT_VT – Doanh thu viễn thông', 'Xem');
  const d = page.getByRole('dialog', { name: 'Thông tin định nghĩa KPI công thức' });
  await expect(d).toContainText('Doanh thu viễn thông');
  await expect(d).toContainText('Thành phần lấy từ API');
  await expect(d).toContainText('$.data.value');
  await expect(d).toContainText('/kpi/DT_VT?year={year}');
  await expect(d.getByText('10 lần đồng bộ gần nhất')).toBeVisible();
  const t = d.getByRole('table', { name: '10 lần đồng bộ gần nhất' });
  for (const h of ['Thời điểm', 'Đơn vị', 'Kỳ', 'Giá trị', 'Lỗi']) await expect(t.locator('thead').getByText(h, { exact: true })).toBeVisible();
});

test('27.4 Thêm mới – Định nghĩa KPI công thức', async ({ page }) => {
  await openCatalogTab(page, 'formula', 'Định nghĩa KPI công thức');
  // thành phần lấy từ API
  await page.getByRole('button', { name: 'Thêm định nghĩa KPI công thức' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm định nghĩa KPI công thức' });
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Vui lòng nhập Mã định nghĩa')).toBeVisible();
  await expect(dlg.getByText('Vui lòng nhập Tên định nghĩa')).toBeVisible();
  await expect(dlg.getByText('Vui lòng chọn Loại định nghĩa')).toBeVisible();
  await expect(dlg.getByText('Vui lòng chọn Loại số liệu')).toBeVisible();
  const apiCode = uid('API_');
  await dlg.getByLabel('Mã định nghĩa').fill(apiCode);
  await dlg.getByLabel('Tên định nghĩa').fill(`Thành phần API ${apiCode}`);
  await dlg.getByLabel('Loại định nghĩa').selectOption({ label: 'Thành phần lấy từ API' });
  await dlg.getByLabel('Loại số liệu').selectOption({ label: 'Số' });
  await dlg.getByLabel('Định nghĩa nguồn').fill('{ sai json');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Vui lòng nhập Đường dẫn API (bắt buộc với loại API)')).toBeVisible();
  await expect(dlg.getByText('Định nghĩa nguồn phải là JSON hợp lệ')).toBeVisible();
  await dlg.getByLabel('Định nghĩa nguồn').fill('{"system":"BI","table":"e2e"}');
  await dlg.getByLabel('Đường dẫn API').fill(API_PATH);
  await dlg.getByLabel('Phương thức HTTP').selectOption('GET');
  await dlg.getByLabel('Đường dẫn giá trị trong response (JSONPath)').fill('$.data.value');
  await dlg.getByRole('button', { name: 'Kiểm tra kết nối' }).click();
  await expect(dlg.getByTestId('connection-result')).toContainText('Kết nối thành công', { timeout: 20_000 });
  await expect(dlg.getByTestId('connection-result')).toContainText('Giá trị nhận được:');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
  await searchKeyword(page, apiCode);
  await expect(row(page, apiCode)).toContainText('Thành phần lấy từ API');

  // công thức tổng hợp
  await page.getByRole('button', { name: 'Thêm định nghĩa KPI công thức' }).click();
  const fCode = uid('CT_');
  await dlg.getByLabel('Mã định nghĩa').fill(fCode);
  await dlg.getByLabel('Tên định nghĩa').fill(`Công thức ${fCode}`);
  await dlg.getByLabel('Loại định nghĩa').selectOption({ label: 'Công thức tổng hợp' });
  await dlg.getByLabel('Loại số liệu').selectOption({ label: 'Tiền tệ' });
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Vui lòng nhập Biểu thức công thức (bắt buộc với Công thức tổng hợp)')).toBeVisible();
  await dlg.getByLabel('Biểu thức công thức').fill('DT_VT + DT_CNTT');
  await dlg.getByRole('button', { name: 'Kiểm tra biểu thức' }).click();
  await expect(dlg.getByTestId('expression-result')).toContainText('Biểu thức hợp lệ');
  await dlg.getByLabel('Mô tả nghiệp vụ').fill('Tổng doanh thu VT + CNTT');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
  await searchKeyword(page, fCode);
  await expect(row(page, fCode)).toContainText('DT_VT + DT_CNTT');
});

test('27.5 Ghi lại – Định nghĩa KPI công thức', async ({ page }) => {
  await openCatalogTab(page, 'formula', 'Định nghĩa KPI công thức');
  const code = uid('SUA_');
  await createManualFormula(page, code);
  await searchKeyword(page, code);
  await rowAction(page, code, 'Sửa');
  const dlg = page.getByRole('dialog', { name: 'Sửa định nghĩa KPI công thức' });
  await expect(dlg.getByLabel('Mã định nghĩa')).toBeDisabled();
  await dlg.getByLabel('Tên định nghĩa').fill(`Đã sửa ${code}`);
  await dlg.getByLabel('Loại định nghĩa').selectOption({ label: 'Công thức tổng hợp' });
  await dlg.getByLabel('Biểu thức công thức').fill('DT_VT +');
  await dlg.getByRole('button', { name: 'Kiểm tra biểu thức' }).click();
  await expect(dlg.getByTestId('expression-result')).not.toContainText('Biểu thức hợp lệ');
  await dlg.getByLabel('Biểu thức công thức').fill('(DT_VT + DT_CNTT) / 2');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(row(page, code)).toContainText(`${code} – Đã sửa ${code}`);
  await expect(row(page, code)).toContainText('Công thức tổng hợp');
});

test('27.6 Xóa – Định nghĩa KPI công thức', async ({ page }) => {
  await openCatalogTab(page, 'formula', 'Định nghĩa KPI công thức');
  const code = uid('XOA_');
  await createManualFormula(page, code);
  await searchKeyword(page, code);
  await rowAction(page, code, 'Xóa');
  await confirmOk(page);
  await expectToast(page, 'Xóa thành công');
  await expect(page.locator('tbody tr').filter({ hasText: code })).toHaveCount(0);
  await searchKeyword(page, 'DT_VT');
  await rowAction(page, 'DT_VT – Doanh thu viễn thông', 'Xóa');
  await confirmOk(page);
  await expectErrorToast(page, IN_USE);
});

// ======================= Mục tiêu trọng tâm (28.1–28.8) =======================

async function createObjective(page: Page, code: string, perspective = 'TC – Tài chính') {
  await page.getByRole('button', { name: 'Thêm mục tiêu' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm mục tiêu' });
  await dlg.getByLabel('Mã mục tiêu').fill(code);
  await dlg.getByLabel('Tên mục tiêu').fill(`Mục tiêu ${code}`);
  await dlg.getByLabel('Viễn cảnh').selectOption({ label: perspective });
  await dlg.getByLabel('Mô tả').fill('Mục tiêu e2e');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
}

test('28.1 Lấy danh sách – Mục tiêu trọng tâm', async ({ page }) => {
  await openObjectives(page);
  await expectHeaders(page, 'Danh sách mục tiêu trọng tâm', ['STT', 'Mã – Tên mục tiêu', 'Viễn cảnh', 'Mô tả', 'Người tạo', 'Ngày tạo', 'Người cập nhật', 'Ngày cập nhật', 'Thao tác']);
  await searchKeyword(page, 'MT-TC-01');
  await expect(row(page, 'MT-TC-01 – ')).toContainText('TC – Tài chính');
  await searchKeyword(page, 'MT-HP-04');
  await expect(row(page, 'MT-HP-04 – ')).toContainText('HP – Học hỏi & phát triển');
});

test('28.2 Tìm kiếm – Mục tiêu trọng tâm', async ({ page }) => {
  await openObjectives(page);
  await searchKeyword(page, 'MT-TC-01');
  await expect(row(page, 'MT-TC-01')).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'MT-KH-01' })).toHaveCount(0);
  // lọc theo viễn cảnh
  await page.getByLabel('Viễn cảnh', { exact: true }).selectOption({ label: 'KH – Khách hàng' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(page.locator('tbody tr').filter({ hasText: 'MT-TC-01' })).toHaveCount(0);
  await searchKeyword(page, 'MT-KH-01');
  await expect(row(page, 'MT-KH-01')).toContainText('KH – Khách hàng');
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect(page.getByLabel('Viễn cảnh', { exact: true })).toHaveValue('');
});

test('28.3 Xem chi tiết – Mục tiêu trọng tâm', async ({ page }) => {
  await openObjectives(page);
  await searchKeyword(page, 'MT-TC-01');
  await rowAction(page, 'MT-TC-01', 'Xem');
  const d = page.getByRole('dialog', { name: 'Thông tin mục tiêu trọng tâm' });
  await expect(d).toContainText('MT-TC-01');
  await expect(d).toContainText('TC – Tài chính');
  for (const l of ['Mã mục tiêu', 'Tên mục tiêu', 'Viễn cảnh', 'Mô tả', 'Người tạo', 'Ngày tạo']) await expect(d.getByText(l, { exact: true })).toBeVisible();
});

test('28.4 Thêm mới – Mục tiêu trọng tâm', async ({ page }) => {
  await openObjectives(page);
  await page.getByRole('button', { name: 'Thêm mục tiêu' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm mục tiêu' });
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Vui lòng nhập Mã mục tiêu')).toBeVisible();
  await expect(dlg.getByText('Vui lòng nhập Tên mục tiêu')).toBeVisible();
  await expect(dlg.getByText('Vui lòng chọn Viễn cảnh')).toBeVisible();
  await dlg.getByLabel('Mã mục tiêu').fill('MT-TC-01');
  await dlg.getByLabel('Tên mục tiêu').fill('Trùng mã');
  await dlg.getByLabel('Viễn cảnh').selectOption({ label: 'TC – Tài chính' });
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Mã mục tiêu đã tồn tại')).toBeVisible();
  await dlg.getByRole('button', { name: 'Hủy' }).click();
  const code = uid('MT-E2E-');
  await createObjective(page, code, 'QT – Quy trình nội bộ');
  await searchKeyword(page, code);
  await expect(row(page, code)).toContainText('QT – Quy trình nội bộ');
  await expect(row(page, code)).toContainText('Mục tiêu e2e');
});

test('28.5 Ghi lại – Mục tiêu trọng tâm', async ({ page }) => {
  await openObjectives(page);
  const code = uid('MT-SUA-');
  await createObjective(page, code);
  await searchKeyword(page, code);
  await rowAction(page, code, 'Sửa');
  const dlg = page.getByRole('dialog', { name: 'Sửa mục tiêu' });
  await expect(dlg.getByLabel('Mã mục tiêu')).toBeDisabled();
  await dlg.getByLabel('Tên mục tiêu').fill(`Đã sửa ${code}`);
  await dlg.getByLabel('Viễn cảnh').selectOption({ label: 'KH – Khách hàng' });
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(row(page, code)).toContainText(`${code} – Đã sửa ${code}`);
  await expect(row(page, code)).toContainText('KH – Khách hàng');
});

test('28.6 Xóa – Mục tiêu trọng tâm', async ({ page }) => {
  await openObjectives(page);
  const code = uid('MT-XOA-');
  await createObjective(page, code);
  await searchKeyword(page, code);
  await rowAction(page, code, 'Xóa');
  await confirmOk(page);
  await expectToast(page, 'Xóa thành công');
  await expect(page.locator('tbody tr').filter({ hasText: code })).toHaveCount(0);
  await searchKeyword(page, 'MT-TC-01');
  await rowAction(page, 'MT-TC-01', 'Xóa');
  await confirmOk(page);
  await expectErrorToast(page, IN_USE);
});

test('28.7 Nhập dữ liệu – Mục tiêu trọng tâm', async ({ page }) => {
  await openObjectives(page);
  const code = uid('MT-NHAP-');
  await page.getByRole('button', { name: 'Nhập dữ liệu' }).click();
  const buf = await makeXlsx(
    ['Mã mục tiêu (*)', 'Tên mục tiêu (*)', 'Mã viễn cảnh (*)', 'Mô tả'],
    [
      [code, `Nhập ${code}`, 'TC', 'Nhập từ file'],
      [uid('MT-LOI-'), 'Viễn cảnh sai', 'KHONGCO', ''],
    ],
  );
  const dlg = await importFile(page, buf);
  await expect(dlg.getByText('Mã viễn cảnh không tồn tại')).toBeVisible();
  await dlg.getByRole('button', { name: 'Xác nhận nhập' }).click();
  await expect(dlg.getByTestId('import-result')).toContainText('Đã nhập 1/2 bản ghi; 1 bản ghi lỗi');
  await dlg.getByRole('button', { name: 'Đóng' }).first().click();
  await searchKeyword(page, code);
  await expect(row(page, code)).toContainText('TC – Tài chính');
});

test('28.8 Xuất dữ liệu – Mục tiêu trọng tâm', async ({ page }) => {
  await openObjectives(page);
  await page.getByLabel('Viễn cảnh', { exact: true }).selectOption({ label: 'TC – Tài chính' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  expect(await exportFile(page)).toMatch(/^DanhSachMucTieuTrongTam_\d{8}_\d{4}\.xlsx$/);
});
