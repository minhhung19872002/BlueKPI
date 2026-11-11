import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectErrorToast, expectToast, login, makeXlsx, uid } from './helpers';

// ------------------------------- Tiện ích -------------------------------
async function api<T = unknown>(page: Page, method: 'get' | 'post' | 'put', url: string, data?: unknown): Promise<T> {
  const xsrf = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value ?? '';
  const r = await page.request.fetch(`/api${url}`, { method: method.toUpperCase(), data, headers: { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } });
  const body = await r.json();
  if (!body.success) throw new Error(`${method} ${url}: ${body.message}`);
  return body.data as T;
}
async function kpiId(page: Page, code: string): Promise<number> {
  const list = await api<{ id: number; code: string }[]>(page, 'get', `/kpis/options?keyword=${encodeURIComponent(code)}`);
  return list.find((k) => k.code === code)!.id;
}
async function unitId(page: Page, code: string): Promise<number> {
  const r = await api<{ items: { id: number; code: string }[] }>(page, 'get', `/org-units?keyword=${encodeURIComponent(code)}&size=50`);
  return r.items.find((u) => u.code === code)!.id;
}
/** Tạo bản giao theo đơn vị “Đang soạn” qua API */
async function createByUnit(page: Page, unit: string, year: number, kpis: [string, number | null, number | null][]) {
  const details = [];
  for (const [code, weight, targetYear] of kpis) details.push({ kpiId: await kpiId(page, code), weight, targetYear });
  return api(page, 'post', '/assignments/by-unit', { orgUnitId: await unitId(page, unit), year, details });
}
/** Tạo giao theo chỉ tiêu “Đang soạn” qua API */
async function createByKpi(page: Page, kpi: string, year: number, units: [string, number | null, number | null][]) {
  const details = [];
  for (const [code, weight, targetYear] of units) details.push({ orgUnitId: await unitId(page, code), weight, targetYear });
  return api(page, 'post', '/assignments/by-kpi', { kpiId: await kpiId(page, kpi), year, details });
}

const gridRow = (scope: Page | Locator, text: string | RegExp) => scope.locator('tbody tr').filter({ hasText: text }).first();

async function openUnitTab(page: Page) {
  await login(page, 'admin');
  await page.goto('/kpi-admin/assignments?tab=unit');
  await expect(page.getByRole('tab', { name: 'Danh sách giao KPI theo đơn vị' })).toHaveAttribute('data-state', 'active');
}
async function openKpiTab(page: Page) {
  await login(page, 'admin');
  await page.goto('/kpi-admin/assignments?tab=kpi');
  await expect(page.getByRole('tab', { name: 'Danh sách giao KPI theo chỉ tiêu' })).toHaveAttribute('data-state', 'active');
}
async function filterList(page: Page, opts: { keyword?: string; year?: string; status?: string; perspective?: string }) {
  if (opts.keyword !== undefined) await page.getByLabel('Từ khóa tìm kiếm').fill(opts.keyword);
  if (opts.year !== undefined) await page.getByRole('combobox', { name: 'Năm', exact: true }).selectOption(opts.year);
  if (opts.status !== undefined) await page.getByRole('combobox', { name: 'Trạng thái', exact: true }).selectOption(opts.status ? { label: opts.status } : '');
  if (opts.perspective !== undefined) await page.getByRole('combobox', { name: 'Viễn cảnh', exact: true }).selectOption({ label: opts.perspective });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
}
/** Chọn đơn vị trong TreeSelect theo mã đơn vị */
async function pickUnitByCode(page: Page, trigger: string, code: string, name: string | RegExp, close = true) {
  const btn = page.getByRole('button', { name: trigger, exact: true });
  if (!(await page.getByPlaceholder('Tìm theo mã hoặc tên').isVisible())) await btn.click();
  await page.getByPlaceholder('Tìm theo mã hoặc tên').fill(code);
  await page.getByRole('treeitem', { name }).first().click();
  if (close && (await page.getByPlaceholder('Tìm theo mã hoặc tên').isVisible())) await page.keyboard.press('Escape');
}
async function pickKpis(page: Page, codes: string[]) {
  await page.getByRole('button', { name: 'Chọn tiêu chí KPI' }).click();
  const dlg = page.getByRole('dialog', { name: 'Chọn tiêu chí KPI' });
  for (const c of codes) {
    await dlg.getByLabel('Tìm tiêu chí KPI').fill(c);
    await dlg.getByRole('checkbox', { name: new RegExp(`^${c} –`) }).click();
  }
  await dlg.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(dlg).toBeHidden();
}

// ------------------------------- 29 Theo đơn vị -------------------------------
test('29.1 Lấy danh sách – Giao KPI theo đơn vị', async ({ page }) => {
  await openUnitTab(page);
  await expect(page.getByRole('heading', { name: 'Giao KPI', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Danh sách giao KPI theo đơn vị' })).toBeVisible();
  const grid = page.getByRole('table', { name: 'Danh sách giao KPI theo đơn vị' });
  for (const h of ['STT', 'Đơn vị được giao', 'Năm', 'Ngày tạo', 'Ngày cập nhật', 'Trạng thái', 'Thao tác']) await expect(grid.locator('thead').getByText(h, { exact: true })).toBeVisible();
  const hni = gridRow(grid, 'VNPT Hà Nội');
  await expect(hni).toContainText('2026');
  await expect(hni).toContainText('Đã giao');
  await expect(hni.getByRole('checkbox')).toBeDisabled(); // dòng “Đã giao” không chọn được
  await expect(hni.getByRole('button', { name: 'Sửa', exact: true })).toHaveCount(0);
  await expect(hni.getByRole('button', { name: 'Sao chép', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chốt số liệu giao KPI' })).toBeDisabled();
  await filterList(page, { year: '2027' });
  const draft = gridRow(grid, 'VNPT Hà Nội');
  await expect(draft).toContainText('Đang soạn');
  await expect(draft.getByRole('checkbox', { name: 'Chọn dòng' })).toBeVisible();
  await expect(draft.getByRole('button', { name: 'Sửa', exact: true })).toBeVisible();
  await expect(draft.getByRole('button', { name: 'Xóa', exact: true })).toBeVisible();
});

test('29.2 Tìm kiếm – Giao KPI theo đơn vị', async ({ page }) => {
  await openUnitTab(page);
  await filterList(page, { keyword: 'VNPT_HCM' });
  const grid = page.getByRole('table', { name: 'Danh sách giao KPI theo đơn vị' });
  await expect(gridRow(grid, 'VNPT TP. Hồ Chí Minh')).toBeVisible();
  await expect(grid.locator('tbody tr').filter({ hasText: 'VNPT Hà Nội' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await filterList(page, { keyword: 'VNPT', year: '2027', status: 'Đang soạn' });
  await expect(gridRow(grid, 'VNPT Hà Nội')).toContainText('Đang soạn');
  await expect(gridRow(grid, 'VNPT TP. Hồ Chí Minh')).toContainText('2027');
  await expect(grid.locator('tbody tr').filter({ hasText: 'Đã giao' })).toHaveCount(0);
});

test('29.3 Xem chi tiết – Giao KPI theo đơn vị', async ({ page }) => {
  await openUnitTab(page);
  await filterList(page, { keyword: 'VNPT_HNI', year: '2026' });
  await gridRow(page, /^\d+VNPT Hà Nội/).getByRole('button', { name: 'Xem', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Xem chi tiết giao KPI theo đơn vị' })).toBeVisible();
  const t = page.getByRole('table', { name: 'Danh sách tiêu chí KPI giao' });
  for (const h of ['Mã – Tên tiêu chí KPI', 'Viễn cảnh', 'Đơn vị đo', 'Trọng số', 'Quý I', 'Quý II', '6T ĐN', 'Quý III', 'Quý IV', 'Cả năm', 'Ghi chú']) await expect(t.locator('thead').getByText(h, { exact: true })).toBeVisible();
  await expect(t).toContainText('TC-001.01');
  await expect(gridRow(t, 'TC-001.01')).toContainText('↳');
  await expect(page.getByTestId('total-weight')).toHaveText('100,00');
  await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Đơn vị được giao', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Quay lại' }).click();
  await expect(page.getByRole('heading', { name: 'Danh sách giao KPI theo đơn vị' })).toBeVisible();
});

test('29.4 Xóa – Giao KPI theo đơn vị', async ({ page }) => {
  await openUnitTab(page);
  await createByUnit(page, 'VNPT_HPG', 2029, [['TC-002', 100, 10]]);
  await filterList(page, { keyword: 'VNPT_HPG', year: '2029' });
  await gridRow(page, 'VNPT Hải Phòng').getByRole('button', { name: 'Xóa', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Xác nhận xóa' });
  await expect(dlg).toContainText('VNPT Hải Phòng – 2029');
  await page.getByTestId('confirm-ok').click();
  await expectToast(page, 'Xóa thành công');
  await expect(page.locator('tbody tr').filter({ hasText: 'VNPT Hải Phòng' })).toHaveCount(0);
});

test('29.5 Sao chép giao KPI theo đơn vị', async ({ page }) => {
  await openUnitTab(page);
  await filterList(page, { keyword: 'VNPT_HNI', year: '2026' });
  await gridRow(page, /^\d+VNPT Hà Nội/).getByRole('button', { name: 'Sao chép', exact: true }).click();
  let dlg = page.getByRole('dialog', { name: 'Sao chép giao KPI theo đơn vị' });
  await expect(dlg).toContainText('Đơn vị nguồn');
  await expect(dlg).toContainText('VNPT Hà Nội');
  await expect(dlg.getByLabel('Năm giao đích', { exact: true })).toHaveValue('2027');
  await expect(dlg).toContainText('Đơn vị đích đã có bản “Đang soạn” sẽ bị ghi đè; đơn vị “Đã giao” sẽ được bỏ qua.');
  for (const h of ['STT', 'Đơn vị nhận bản sao', 'Trạng thái giao', 'Nhóm đơn vị']) await expect(dlg.locator('thead').getByText(h, { exact: true })).toBeVisible();
  await dlg.getByLabel('Năm giao đích', { exact: true }).selectOption('2029');
  await dlg.getByPlaceholder('Tìm theo mã hoặc tên đơn vị').fill('VNPT_DNG');
  await gridRow(dlg, 'VNPT Đà Nẵng').getByRole('checkbox').click();
  await dlg.getByRole('button', { name: 'Xác nhận' }).click();
  await expectToast(page, 'Sao chép thành công 1 đơn vị');
  await expect(dlg).toBeHidden();
  // đích “Đã giao” → bỏ qua
  await gridRow(page, /^\d+VNPT Hà Nội/).getByRole('button', { name: 'Sao chép', exact: true }).click();
  dlg = page.getByRole('dialog', { name: 'Sao chép giao KPI theo đơn vị' });
  await dlg.getByLabel('Năm giao đích', { exact: true }).selectOption('2026');
  await dlg.getByPlaceholder('Tìm theo mã hoặc tên đơn vị').fill('VNPT_HUE');
  await expect(gridRow(dlg, 'VNPT Huế')).toContainText('Đã giao');
  await gridRow(dlg, 'VNPT Huế').getByRole('checkbox').click();
  await dlg.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(dlg.getByTestId('copy-result')).toContainText('VNPT Huế');
  await expect(dlg.getByTestId('copy-result')).toContainText('bỏ qua');
  await dlg.getByRole('button', { name: 'Hủy' }).click();
  await filterList(page, { keyword: 'VNPT_DNG', year: '2029' });
  await expect(gridRow(page, 'VNPT Đà Nẵng')).toContainText('Đang soạn');
});

// ------------------------------- 30 Thêm mới / Ghi lại -------------------------------
test('30.1 Thêm mới – Giao KPI theo đơn vị', async ({ page }) => {
  await openUnitTab(page);
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  await expect(page.getByRole('heading', { name: 'Giao KPI theo đơn vị' })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Vui lòng chọn Đơn vị được giao')).toBeVisible();
  await pickUnitByCode(page, 'Đơn vị được giao', 'VNPT_DNG_KHKD', /Phòng Kế hoạch – Kinh doanh/);
  await page.getByLabel('Năm giao', { exact: true }).selectOption('2027');
  await pickKpis(page, ['TC-001', 'TC-002']);
  const t = page.getByRole('table', { name: 'Danh sách tiêu chí KPI giao' });
  await expect(gridRow(t, 'TC-001.02')).toContainText('↳');
  await page.getByLabel('Trọng số TC-002', { exact: true }).fill('150');
  await expect(page.getByText('Trọng số phải từ 1 đến 100')).toBeVisible();
  await page.getByLabel('Quý I TC-002', { exact: true }).fill('-5');
  await expect(page.getByText('Giá trị phải lớn hơn hoặc bằng 0')).toBeVisible();
  await page.getByLabel('Quý I TC-002', { exact: true }).fill('25,5');
  await page.getByLabel('Trọng số TC-002', { exact: true }).fill('40');
  await page.getByLabel('Trọng số TC-001', { exact: true }).fill('60');
  await page.getByLabel('Trọng số TC-001.01', { exact: true }).fill('50');
  await page.getByLabel('Trọng số TC-001.02', { exact: true }).fill('50');
  for (const c of ['TC-001', 'TC-001.01', 'TC-001.02', 'TC-002']) await page.getByLabel(`Cả năm ${c}`, { exact: true }).fill('1.200');
  await page.getByLabel('Ghi chú TC-002', { exact: true }).fill('Giao thử nghiệm');
  await expect(page.getByTestId('total-weight')).toHaveText('100,00');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expectToast(page, 'Thêm mới thành công');
  await expect(page.getByRole('heading', { name: 'Danh sách giao KPI theo đơn vị' })).toBeVisible();
  await filterList(page, { keyword: 'VNPT_DNG_KHKD', year: '2027' });
  await expect(page.locator('tbody tr').filter({ hasText: '2027' }).first()).toContainText('Đang soạn');
  // trùng đơn vị – năm → lỗi tại trường
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  await pickUnitByCode(page, 'Đơn vị được giao', 'VNPT_DNG_KHKD', /Phòng Kế hoạch – Kinh doanh/);
  await page.getByLabel('Năm giao', { exact: true }).selectOption('2027');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'đã có bản giao KPI năm 2027' })).toBeVisible();
});

test('30.2 Ghi lại – Giao KPI theo đơn vị', async ({ page }) => {
  await openUnitTab(page);
  await createByUnit(page, 'VNPT_HPG', 2028, [['TC-002', 100, 10]]);
  await filterList(page, { keyword: 'VNPT_HPG', year: '2028' });
  await gridRow(page, 'VNPT Hải Phòng').getByRole('button', { name: 'Sửa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Giao KPI theo đơn vị' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đơn vị được giao', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Năm giao', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Trọng số TC-002', { exact: true })).toHaveValue('100');
  await page.getByLabel('Trọng số TC-002', { exact: true }).fill('70');
  await pickKpis(page, ['KH-001']);
  await page.getByLabel('Trọng số KH-001', { exact: true }).fill('20');
  await page.getByLabel('Cả năm KH-001', { exact: true }).fill('99');
  await expect(page.getByTestId('total-weight')).toHaveText('90,00');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(page.getByTestId('toast-info').first()).toContainText('100');
  await filterList(page, { keyword: 'VNPT_HPG', year: '2028' });
  await gridRow(page, 'VNPT Hải Phòng').getByRole('button', { name: 'Xem', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Danh sách tiêu chí KPI giao' })).toContainText('KH-001');
  await expect(page.getByTestId('total-weight')).toHaveText('90,00');
});

// ------------------------------- 31 Chốt -------------------------------
test('31.1 Chốt số liệu giao KPI – Giao KPI theo đơn vị', async ({ page }) => {
  await openUnitTab(page);
  await createByUnit(page, 'VNPT_HUE', 2028, [['TC-002', 60, 100], ['KH-001', 40, 200]]);
  await createByUnit(page, 'VNPT_DNG', 2028, [['TC-002', 50, 100]]);
  await filterList(page, { keyword: 'VNPT', year: '2028', status: 'Đang soạn' });
  await gridRow(page, 'VNPT Huế').getByRole('checkbox', { name: 'Chọn dòng' }).click();
  await gridRow(page, 'VNPT Đà Nẵng').getByRole('checkbox', { name: 'Chọn dòng' }).click();
  await page.getByRole('button', { name: 'Chốt số liệu giao KPI' }).click();
  const c = page.getByRole('dialog', { name: 'Chốt số liệu giao KPI' });
  await expect(c).toContainText('Xác nhận chốt số liệu giao KPI cho 2 bản ghi đã chọn?');
  await c.getByRole('button', { name: 'Xác nhận' }).click();
  await expectToast(page, 'Chốt số liệu giao KPI thành công');
  const res = page.getByRole('dialog', { name: 'Kết quả chốt số liệu giao KPI' });
  await expect(res).toContainText('VNPT Đà Nẵng – 2028');
  await expect(res).toContainText('Tổng trọng số khác 100');
  await res.getByRole('button', { name: 'Đóng' }).first().click();
  await filterList(page, { keyword: 'VNPT_HUE', year: '2028', status: '' });
  await expect(gridRow(page, 'VNPT Huế')).toContainText('Đã giao');
});

test('31.2 Chốt số liệu giao KPI – Giao KPI theo chỉ tiêu', async ({ page }) => {
  await openKpiTab(page);
  await createByKpi(page, 'TC-005', 2029, [['VNPT_HUE', 10, 100], ['VNPT_DNG', 10, 120]]);
  await createByKpi(page, 'TC-006', 2029, [['VNPT_HUE', 10, null]]);
  await filterList(page, { year: '2029' });
  const grid = page.getByRole('table', { name: 'Danh sách giao KPI theo chỉ tiêu' });
  await gridRow(grid, 'TC-005').getByRole('checkbox', { name: 'Chọn dòng' }).click();
  await gridRow(grid, 'TC-006').getByRole('checkbox', { name: 'Chọn dòng' }).click();
  await page.getByRole('button', { name: 'Chốt số liệu giao KPI' }).click();
  const c = page.getByRole('dialog', { name: 'Chốt số liệu giao KPI' });
  await expect(c).toContainText('Xác nhận chốt số liệu giao KPI cho 2 bản ghi đã chọn?');
  await c.getByRole('button', { name: 'Xác nhận' }).click();
  await expectToast(page, 'Chốt số liệu giao KPI thành công');
  const res = page.getByRole('dialog', { name: 'Kết quả chốt số liệu giao KPI' });
  await expect(res).toContainText('TC-006');
  await expect(res).toContainText('thiếu KH năm');
  await res.getByRole('button', { name: 'Đóng' }).first().click();
  await expect(gridRow(grid, 'TC-005')).toContainText('Đã giao');
  await expect(gridRow(grid, 'TC-006')).toContainText('Đang soạn');
});

// ------------------------------- 32 Theo chỉ tiêu -------------------------------
test('32.1 Lấy danh sách – Giao KPI theo chỉ tiêu', async ({ page }) => {
  await openKpiTab(page);
  await expect(page.getByRole('heading', { name: 'Danh sách giao KPI theo chỉ tiêu' })).toBeVisible();
  const grid = page.getByRole('table', { name: 'Danh sách giao KPI theo chỉ tiêu' });
  for (const h of ['STT', 'Mã – Tên tiêu chí KPI', 'Số đơn vị được giao', 'Viễn cảnh', 'Ngày cập nhật', 'Trạng thái', 'Năm', 'Đơn vị giao', 'Thao tác']) {
    await expect(grid.locator('thead').getByText(h, { exact: true })).toBeVisible();
  }
  const parent = gridRow(grid, 'TC-001 –');
  await expect(parent).toContainText('2026');
  await expect(parent).toContainText('Đã giao');
  await expect(parent.getByRole('button', { name: 'Điều chỉnh', exact: true })).toBeVisible();
  await expect(grid.locator('tbody tr').filter({ hasText: 'TC-001.01' })).toHaveCount(0);
  await parent.getByTestId('tree-toggle').click();
  await expect(gridRow(grid, 'TC-001.01')).toBeVisible();
});

test('32.2 Tìm kiếm – Giao KPI theo chỉ tiêu', async ({ page }) => {
  await openKpiTab(page);
  const grid = page.getByRole('table', { name: 'Danh sách giao KPI theo chỉ tiêu' });
  await filterList(page, { keyword: 'KH-002', year: '2026' });
  await expect(gridRow(grid, 'KH-002 –')).toBeVisible();
  await expect(gridRow(grid, 'KH-002.01')).toBeVisible();
  await expect(grid.locator('tbody tr').filter({ hasText: 'TC-001' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await filterList(page, { year: '2026', perspective: 'KH – Khách hàng', status: 'Đã giao' });
  await expect(gridRow(grid, 'KH-001')).toBeVisible();
  await expect(grid.locator('tbody tr').filter({ hasText: 'TC-002' })).toHaveCount(0);
});

test('32.3 Xem chi tiết – Giao KPI theo chỉ tiêu', async ({ page }) => {
  await openKpiTab(page);
  await filterList(page, { keyword: 'TC-002', year: '2026' });
  await gridRow(page, 'TC-002').getByRole('button', { name: 'Xem', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Xem chi tiết giao KPI theo chỉ tiêu' })).toBeVisible();
  const t = page.getByRole('table', { name: 'Danh sách đơn vị được giao' });
  await expect(t).toContainText('VNPT Hà Nội');
  await expect(t).toContainText('VNPT TP. Hồ Chí Minh');
  for (const h of ['Đơn vị được giao', 'Trọng số', 'Quý I', 'Quý II', '6T ĐN', 'Quý III', 'Quý IV', 'Cả năm', 'Ghi chú']) await expect(t.locator('thead').getByText(h, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0);
});

test('32.4 Sao chép giao KPI theo chỉ tiêu', async ({ page }) => {
  await openKpiTab(page);
  await page.getByRole('button', { name: 'Sao chép', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Sao chép chỉ tiêu giao KPI' });
  await dlg.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(dlg.getByText('Vui lòng chọn Sao chép KPI')).toBeVisible();
  await dlg.getByRole('button', { name: 'Sao chép KPI', exact: true }).click();
  await page.getByPlaceholder('Tìm kiếm').last().fill('TC-003');
  await page.getByRole('option', { name: /^TC-003 –/ }).first().click();
  await dlg.getByLabel('Năm', { exact: true }).selectOption('2027');
  await dlg.getByLabel('Chọn đơn vị sao chép').selectOption({ label: 'VNPT Hà Nội' });
  for (const h of ['STT', 'Đơn vị được sao chép', 'Nhóm đơn vị']) await expect(dlg.locator('thead').getByText(h, { exact: true })).toBeVisible();
  await dlg.getByPlaceholder('Tìm theo mã hoặc tên đơn vị').fill('VNPT_HPG');
  await gridRow(dlg, 'VNPT Hải Phòng').getByRole('checkbox').click();
  await dlg.getByRole('button', { name: 'Xác nhận' }).click();
  await expectToast(page, 'Sao chép thành công 1 đơn vị');
  await filterList(page, { keyword: 'TC-003', year: '2027' });
  await gridRow(page, 'TC-003').getByRole('button', { name: 'Xem', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Danh sách đơn vị được giao' })).toContainText('VNPT Hải Phòng');
});

// ------------------------------- 33 Thêm mới / Ghi lại theo chỉ tiêu -------------------------------
test('33.1 Thêm mới – Giao KPI theo chỉ tiêu', async ({ page }) => {
  await openKpiTab(page);
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  await expect(page.getByRole('heading', { name: 'Giao KPI theo chỉ tiêu' })).toBeVisible();
  await page.getByRole('button', { name: 'Tiêu chí KPI', exact: true }).click();
  await page.getByPlaceholder('Tìm kiếm').last().fill('TC-007');
  await page.getByRole('option', { name: /^TC-007 –/ }).first().click();
  await page.getByLabel('Năm giao', { exact: true }).selectOption('2028');
  await pickUnitByCode(page, 'Đơn vị được giao', 'VNPT_HUE', 'VNPT Huế', false);
  await pickUnitByCode(page, 'Đơn vị được giao', 'VNPT_HPG', 'VNPT Hải Phòng');
  const t = page.getByRole('table', { name: 'Danh sách đơn vị được giao' });
  await expect(t).toContainText('VNPT Huế');
  await expect(t).toContainText('VNPT Hải Phòng');
  await page.getByLabel('Trọng số VNPT_HUE', { exact: true }).fill('0');
  await expect(page.getByText('Trọng số phải từ 1 đến 100')).toBeVisible();
  await page.getByLabel('Trọng số VNPT_HUE', { exact: true }).fill('10');
  await page.getByLabel('Cả năm VNPT_HUE', { exact: true }).fill('100');
  await page.getByLabel('Trọng số VNPT_HPG', { exact: true }).fill('15');
  await page.getByLabel('Quý IV VNPT_HPG', { exact: true }).fill('80');
  await page.getByLabel('Cả năm VNPT_HPG', { exact: true }).fill('80');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expectToast(page, 'Thêm mới thành công');
  await filterList(page, { keyword: 'TC-007', year: '2028' });
  await expect(gridRow(page, 'TC-007')).toContainText('Đang soạn');
  // đơn vị đã “Đã giao” KPI này → lỗi dòng
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  await page.getByRole('button', { name: 'Tiêu chí KPI', exact: true }).click();
  await page.getByPlaceholder('Tìm kiếm').last().fill('TC-002');
  await page.getByRole('option', { name: /^TC-002 –/ }).first().click();
  await page.getByLabel('Năm giao', { exact: true }).selectOption('2026');
  await pickUnitByCode(page, 'Đơn vị được giao', 'VNPT_HUE', 'VNPT Huế');
  await page.getByLabel('Cả năm VNPT_HUE', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expectErrorToast(page, 'Dòng 1:');
  await expect(page.getByRole('table', { name: 'Danh sách đơn vị được giao' }).getByRole('alert').filter({ hasText: 'Đã giao' })).toBeVisible();
});

test('33.2 Ghi lại – Giao KPI theo chỉ tiêu', async ({ page }) => {
  await openKpiTab(page);
  await createByKpi(page, 'TC-008', 2028, [['VNPT_DNG', 10, 50]]);
  await filterList(page, { keyword: 'TC-008', year: '2028' });
  await gridRow(page, 'TC-008').getByRole('button', { name: 'Sửa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Giao KPI theo chỉ tiêu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tiêu chí KPI', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Cả năm VNPT_DNG', { exact: true })).toHaveValue('50');
  await page.getByLabel('Cả năm VNPT_DNG', { exact: true }).fill('80');
  await pickUnitByCode(page, 'Đơn vị được giao', 'VNPT_HPG', 'VNPT Hải Phòng');
  await page.getByLabel('Trọng số VNPT_HPG', { exact: true }).fill('5');
  await page.getByLabel('Cả năm VNPT_HPG', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expectToast(page, 'Cập nhật thành công');
  await filterList(page, { keyword: 'TC-008', year: '2028' });
  await expect(gridRow(page, 'TC-008')).toContainText('2');
  await gridRow(page, 'TC-008').getByRole('button', { name: 'Xem', exact: true }).click();
  const t = page.getByRole('table', { name: 'Danh sách đơn vị được giao' });
  await expect(gridRow(t, 'VNPT Đà Nẵng')).toContainText('80,00');
  await expect(gridRow(t, 'VNPT Hải Phòng')).toContainText('30,00');
});

// ------------------------------- 34 Điều chỉnh -------------------------------
async function openAdjust(page: Page, kpi: string) {
  await openKpiTab(page);
  await filterList(page, { keyword: kpi, year: '2026' });
  await gridRow(page, `${kpi} –`).getByRole('button', { name: 'Điều chỉnh', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Điều chỉnh mục tiêu giao KPI' })).toBeVisible();
}
async function fillDecision(page: Page, no: string) {
  await page.getByLabel('Quyết định điều chỉnh số', { exact: true }).fill(no);
  await page.getByLabel('Ngày', { exact: true }).fill('15/11/2026');
  await page.getByLabel('Lý do điều chỉnh', { exact: true }).fill(`Điều chỉnh theo ${no}`);
}

test('34.1 Điều chỉnh – Lưu nháp', async ({ page }) => {
  await openAdjust(page, 'TC-002');
  for (const l of ['Cập nhật mục tiêu giao cho KPI', 'Năm', 'Đơn vị đo', 'Phương pháp tính điểm', 'CT tính tỷ lệ hoàn thành', 'Tình trạng']) await expect(page.getByText(l, { exact: true })).toBeVisible();
  await expect(page.getByText('TC-002 –').first()).toBeVisible();
  const t = page.getByRole('table', { name: 'Danh sách đơn vị điều chỉnh' });
  for (const h of ['STT', 'Đơn vị được giao', 'Trọng số', 'Quý I', 'Quý I – ĐC', '6T ĐN – ĐC', 'Quý IV – ĐC', 'Thao tác']) await expect(t.locator('thead').getByText(h, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu nháp' }).click();
  await expect(page.getByText('Vui lòng nhập Quyết định điều chỉnh số')).toBeVisible();
  await expect(page.getByText('Vui lòng nhập Lý do điều chỉnh')).toBeVisible();
  await page.getByLabel('Ngày', { exact: true }).fill('32/13/2026');
  await page.getByRole('button', { name: 'Lưu nháp' }).click();
  await expect(page.getByText('Ngày không hợp lệ (dd/mm/yyyy)')).toBeVisible();
  const no = uid('QD-NHAP-');
  await fillDecision(page, no);
  await page.getByLabel('Đơn vị', { exact: true }).fill('VNPT_HNI');
  await expect(t.locator('tbody tr').filter({ hasText: 'VNPT TP. Hồ Chí Minh' })).toHaveCount(0);
  await page.getByLabel('Quý IV – ĐC VNPT_HNI', { exact: true }).fill('123,5');
  await page.getByRole('button', { name: 'Lưu nháp' }).click();
  await expectToast(page, 'Lưu nháp thành công');
  await page.reload();
  await expect(page.getByLabel('Quý IV – ĐC VNPT_HNI', { exact: true })).toHaveValue('123,5');
  await expect(page.getByLabel('Quyết định điều chỉnh số', { exact: true })).toHaveValue(no);
  await expect(page.getByLabel('Ngày', { exact: true })).toHaveValue('15/11/2026');
  await expect(page.getByTestId('adjust-status')).toHaveText('Đã giao');
});

test('34.2 Điều chỉnh – Lưu chốt', async ({ page }) => {
  await openAdjust(page, 'TC-003');
  const no = uid('QD-CHOT-');
  await fillDecision(page, no);
  await page.getByLabel('Quý IV – ĐC VNPT_HCM', { exact: true }).fill('77');
  await page.getByRole('button', { name: 'Lưu chốt' }).click();
  await page.getByRole('dialog', { name: 'Lưu chốt điều chỉnh' }).getByRole('button', { name: 'Xác nhận' }).click();
  await expectToast(page, 'Lưu chốt điều chỉnh thành công');
  await expect(page.getByTestId('adjust-status')).toHaveText('Đã điều chỉnh');
  const r = gridRow(page.getByRole('table', { name: 'Danh sách đơn vị điều chỉnh' }), 'VNPT TP. Hồ Chí Minh');
  await expect(r).toContainText('77,00');
  await page.getByRole('button', { name: 'Quay lại' }).click();
  await filterList(page, { keyword: 'TC-003', year: '2026' });
  await expect(gridRow(page, 'TC-003 –')).toContainText('Đã điều chỉnh');
});

test('34.3 Điều chỉnh – Xem lịch sử điều chỉnh', async ({ page }) => {
  await openAdjust(page, 'KH-001');
  const no = uid('QD-LS-');
  await fillDecision(page, no);
  await page.getByLabel('Quý IV – ĐC VNPT_HPG', { exact: true }).fill('55');
  await page.getByRole('button', { name: 'Lưu chốt' }).click();
  await page.getByRole('dialog', { name: 'Lưu chốt điều chỉnh' }).getByRole('button', { name: 'Xác nhận' }).click();
  await expectToast(page, 'Lưu chốt điều chỉnh thành công');
  const t = page.getByRole('table', { name: 'Danh sách đơn vị điều chỉnh' });
  await gridRow(t, 'VNPT Hải Phòng').getByRole('button', { name: 'Lịch sử' }).click();
  const dlg = page.getByRole('dialog', { name: 'Lịch sử điều chỉnh' });
  for (const h of ['Lần', 'Quyết định số', 'Ngày', 'Lý do', 'Kỳ', 'Giá trị trước', 'Giá trị sau', 'Người thực hiện', 'Thời điểm']) await expect(dlg.locator('thead').getByText(h, { exact: true })).toBeVisible();
  const line = gridRow(dlg, no);
  await expect(line).toContainText('15/11/2026');
  await expect(line).toContainText('Quý IV');
  await expect(line).toContainText('55,00');
  await expect(line).toContainText('admin');
  await dlg.getByRole('button', { name: 'Đóng' }).first().click();
  await gridRow(t, 'VNPT Đà Nẵng').getByRole('button', { name: 'Lịch sử' }).click();
  await expect(page.getByRole('dialog', { name: 'Lịch sử điều chỉnh' })).toContainText('Chưa có lần điều chỉnh');
});

// ------------------------------- 35 Nhập / Xuất -------------------------------
const IMPORT_COLS = ['Trọng số', 'Quý I', 'Quý II', '6T ĐN', 'Quý III', 'Quý IV', 'Cả năm (*)', 'Ghi chú'];

test('35.1 Giao KPI – Nhập dữ liệu', async ({ page }) => {
  await openUnitTab(page);
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  await pickUnitByCode(page, 'Đơn vị được giao', 'VNPT_HCM', 'VNPT TP. Hồ Chí Minh');
  await page.getByLabel('Năm giao', { exact: true }).selectOption('2028');
  await page.getByRole('button', { name: 'Nhập dữ liệu' }).click();
  let dlg = page.getByRole('dialog', { name: 'Nhập dữ liệu giao KPI' });
  const [tpl] = await Promise.all([page.waitForEvent('download'), dlg.getByText('Tải file mẫu').click()]);
  expect(tpl.suggestedFilename()).toMatch(/\.xlsx$/);
  const buf = await makeXlsx(['Mã KPI (*)', ...IMPORT_COLS], [
    ['TC-002', 60, 10, 20, 20, 30, 40, 40, 'Nhập file'],
    ['KH-001', 40, null, null, null, null, null, 75, null],
    ['XX-999', 10, null, null, null, null, null, 1, null],
  ]);
  await dlg.getByTestId('assign-import-file').setInputFiles({ name: 'giao.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: buf });
  await dlg.getByRole('button', { name: 'Kiểm tra và cập nhật' }).click();
  await expectToast(page, 'Đã cập nhật 2/3 dòng lên màn hình; 1 dòng lỗi');
  await expect(dlg.getByTestId('assign-import-errors')).toContainText('Mã KPI không tồn tại');
  await dlg.getByRole('button', { name: 'Đóng' }).first().click();
  await expect(page.getByLabel('Trọng số TC-002', { exact: true })).toHaveValue('60');
  await expect(page.getByLabel('Cả năm KH-001', { exact: true })).toHaveValue('75');
  await expect(page.getByLabel('Ghi chú TC-002', { exact: true })).toHaveValue('Nhập file');
  await expect(page.getByTestId('total-weight')).toHaveText('100,00');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expectToast(page, 'Thêm mới thành công');
  await filterList(page, { keyword: 'VNPT_HCM', year: '2028' });
  await expect(gridRow(page, /^\d+VNPT TP\. Hồ Chí Minh/)).toContainText('Đang soạn');

  // theo chỉ tiêu (mode=kpi)
  await page.goto('/kpi-admin/assignments/kpi/new/new');
  await page.getByRole('button', { name: 'Tiêu chí KPI', exact: true }).click();
  await page.getByPlaceholder('Tìm kiếm').last().fill('TC-009');
  await page.getByRole('option', { name: /^TC-009 –/ }).first().click();
  await page.getByLabel('Năm giao', { exact: true }).selectOption('2028');
  await page.getByRole('button', { name: 'Nhập dữ liệu' }).click();
  dlg = page.getByRole('dialog', { name: 'Nhập dữ liệu giao KPI' });
  const buf2 = await makeXlsx(['Mã đơn vị (*)', ...IMPORT_COLS], [
    ['VNPT_HUE', 10, null, null, null, null, null, 300, null],
    ['VNPT_HPG', 20, null, null, null, null, null, 400, null],
  ]);
  await dlg.getByTestId('assign-import-file').setInputFiles({ name: 'giao2.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: buf2 });
  await dlg.getByRole('button', { name: 'Kiểm tra và cập nhật' }).click();
  await expectToast(page, 'Đã cập nhật 2/2 dòng lên màn hình; 0 dòng lỗi');
  await expect(dlg).toBeHidden();
  await expect(page.getByLabel('Cả năm VNPT_HPG', { exact: true })).toHaveValue('400');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expectToast(page, 'Thêm mới thành công');
});

test('35.2 Xuất dữ liệu – Giao KPI theo đơn vị', async ({ page }) => {
  await openUnitTab(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất dữ liệu' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^GiaoKPITheoDonVi_\d{8}_\d{4}\.xlsx$/);
});

// ------------------------------- 54.1 Thông báo -------------------------------
test('54.1 Thông báo (notify) trên hệ thống', async ({ page }) => {
  await login(page, 'tinh_hni');
  const badge = page.getByTestId('notification-badge');
  await expect(badge).toBeVisible();
  const before = Number((await badge.textContent())?.replace('+', '') ?? '0');
  expect(before).toBeGreaterThanOrEqual(1);
  await page.getByTestId('notification-bell').click();
  await expect(page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' })).toBeVisible();
  const item = page.getByTestId('notification-item').first();
  await expect(item).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(/\/(my-kpi|dashboard)/);
  if (before === 1) await expect(badge).toHaveCount(0);
  else await expect.poll(async () => Number((await badge.textContent())?.replace('+', '') ?? '0')).toBeLessThan(before);
});
