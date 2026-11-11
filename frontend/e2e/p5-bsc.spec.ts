import { expect, test, type Download, type Locator, type Page } from '@playwright/test';
import { expectToast, login, row } from './helpers';

test.describe.configure({ mode: 'serial', timeout: 150_000 });

const slowToast = (page: Page, text: string | RegExp) => expect(page.getByTestId('toast-success').filter({ hasText: text }).first()).toBeVisible({ timeout: 60_000 });

const WARN_CLOSE = 'Danh sách chưa hoàn thành. Vui lòng hoàn thiện trước khi thực hiện chốt đánh giá KPI';
const WARN_APPROVE = 'Danh sách chưa hoàn thành. Vui lòng hoàn thiện trước khi thực hiện ký duyệt TGĐ';

async function openBsc(page: Page, tab: 'summary' | 'review' = 'summary') {
  await login(page);
  await page.goto(`/kpi-admin/bsc${tab === 'review' ? '?tab=review' : ''}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Tổng hợp kết quả BSC' })).toBeVisible();
  await expect(page.getByRole('tab', { name: tab === 'review' ? 'Theo dõi kết quả thẩm định và phản hồi' : 'Tổng hợp kết quả BSC', exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function expectHeaders(table: Locator, headers: string[]) {
  for (const h of headers) await expect(table.locator('thead').getByText(h, { exact: true })).toBeVisible();
}

async function filter(page: Page, opts: { keyword?: string; year?: string; period?: string; status?: string; perspective?: string; dataType?: string }) {
  if (opts.year) await page.getByRole('combobox', { name: 'Năm', exact: true }).first().selectOption(opts.year);
  if (opts.period) await page.getByRole('combobox', { name: 'Kỳ đánh giá', exact: true }).first().selectOption({ label: opts.period });
  if (opts.status) await page.getByRole('combobox', { name: 'Trạng thái', exact: true }).selectOption({ label: opts.status });
  else if (opts.status === '') await page.getByRole('combobox', { name: 'Trạng thái', exact: true }).selectOption({ index: 0 });
  if (opts.perspective) await page.getByRole('combobox', { name: 'Viễn cảnh', exact: true }).selectOption({ label: opts.perspective });
  if (opts.dataType) await page.getByRole('combobox', { name: 'Loại dữ liệu', exact: true }).selectOption({ label: opts.dataType });
  await page.getByLabel('Từ khóa tìm kiếm').fill(opts.keyword ?? '');
  await page.getByLabel('Từ khóa tìm kiếm').press('Enter');
}

async function pickPeriod(dlg: Locator, year: string, period: string) {
  await dlg.getByLabel('Năm', { exact: true }).selectOption(year);
  await dlg.getByLabel('Kỳ đánh giá', { exact: true }).selectOption({ label: period });
}

async function sheetText(d: Download): Promise<string> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await d.path());
  const out: string[] = [];
  wb.eachSheet((ws) => {
    out.push(`#${ws.name}`);
    ws.eachRow((r) => out.push((r.values as unknown[]).map((v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))).join('|')));
  });
  return out.join('\n');
}

async function closeExpectWarning(page: Page) {
  await page.getByRole('button', { name: 'Chốt đánh giá KPI', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Chốt đánh giá KPI' });
  await pickPeriod(dlg, '2026', 'Quý III');
  await expect(dlg).toContainText('Bạn có chắc chắn muốn chốt kết quả đánh giá KPI của kỳ đã chọn?');
  await dlg.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(dlg.getByRole('alert')).toHaveText(WARN_CLOSE);
  const t = dlg.getByRole('table', { name: 'Danh sách đơn vị chưa đủ điều kiện' });
  await expectHeaders(t, ['Mã đơn vị', 'Tên đơn vị']);
  await expect(t.locator('tbody tr').filter({ hasText: 'VNPT_CMU' })).toContainText('VNPT Cà Mau');
  await expect(dlg.getByRole('button', { name: 'Xác nhận', exact: true })).toHaveCount(0);
  await dlg.getByRole('button', { name: 'Đóng', exact: true }).click();
  // không thực hiện chốt
  await filter(page, { year: '2026', period: 'Quý III', status: 'Chốt đánh giá KPI' });
  await expect(page.getByText('Không có dữ liệu').first()).toBeVisible();
}

async function closeEligible(page: Page, period: string) {
  await page.getByRole('button', { name: 'Chốt đánh giá KPI', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Chốt đánh giá KPI' });
  await pickPeriod(dlg, '2026', period);
  await dlg.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await slowToast(page, `Chốt đánh giá KPI thành công (${period} 2026)`);
  await expect(dlg).toHaveCount(0);
  await filter(page, { year: '2026', period, keyword: 'VNPT_HNI' });
  await expect(row(page, 'VNPT_HNI')).toContainText('Chốt đánh giá KPI');
}

async function approveExpectWarning(page: Page) {
  await page.getByRole('button', { name: 'Tổng giám đốc duyệt', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Tổng giám đốc duyệt' });
  await pickPeriod(dlg, '2026', 'Quý III');
  await expect(dlg.getByRole('alert')).toHaveText(WARN_APPROVE);
  const t = dlg.getByRole('table', { name: 'Danh sách đơn vị chưa đủ điều kiện' });
  await expectHeaders(t, ['Mã đơn vị', 'Tên đơn vị']);
  await expect(t.locator('tbody tr').filter({ hasText: 'VNPT_HNI' }).first()).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Ký duyệt', exact: true })).toBeDisabled();
  await dlg.getByRole('button', { name: 'Đóng', exact: true }).click();
}

async function approveEligible(page: Page, year: string, period: string) {
  await page.getByRole('button', { name: 'Tổng giám đốc duyệt', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Tổng giám đốc duyệt' });
  await pickPeriod(dlg, year, period);
  const s = dlg.getByTestId('approve-summary');
  await expect(s).toContainText(year);
  await expect(s).toContainText(period);
  await expect(s).toContainText('Số đơn vị');
  await expect(s).toContainText('Điểm BSC Tập đoàn');
  await expect(dlg.getByRole('table', { name: 'Top 5 đơn vị' }).locator('tbody tr')).toHaveCount(5);
  await expect(dlg.getByRole('table', { name: 'Bottom 5 đơn vị' }).locator('tbody tr')).toHaveCount(5);
  await dlg.getByRole('button', { name: 'Ký duyệt', exact: true }).click();
  await slowToast(page, `Tổng giám đốc ký duyệt thành công (${period} ${year})`);
  await filter(page, { year, period, keyword: 'VNPT_HCM' });
  await expect(row(page, 'VNPT_HCM')).toContainText('TGĐ đã ký duyệt');
  // kỳ đã khóa: không còn thao tác thu hồi
  await expect(row(page, 'VNPT_HCM').getByRole('button', { name: 'Thu hồi kết quả đánh giá', exact: true })).toHaveCount(0);
}

async function exportReport(page: Page, label: string, scope: string, expects: string[]) {
  await page.getByRole('combobox', { name: 'Chọn loại báo cáo' }).selectOption({ label });
  const dlg = page.getByRole('dialog', { name: `Xuất ${label.charAt(0).toLowerCase()}${label.slice(1)}` });
  await expect(dlg.getByText('Phạm vi đơn vị')).toBeVisible();
  await dlg.getByLabel('Phạm vi đơn vị').selectOption({ label: scope });
  await pickPeriod(dlg, '2025', 'Cả năm');
  const [d] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Xác nhận', exact: true }).click()]);
  expect(d.suggestedFilename()).toMatch(/_\d{8}_\d{4}\.xlsx$/);
  await expectToast(page, 'Xuất báo cáo thành công');
  const txt = await sheetText(d);
  for (const e of expects) expect(txt).toContain(e);
}

// ============================ Tab “Tổng hợp kết quả BSC” ============================

test('46.1 Lấy danh sách – Tổng hợp kết quả BSC', async ({ page }) => {
  await openBsc(page);
  await expect(page.getByRole('button', { name: 'Tính lại điểm đánh giá' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chốt đánh giá KPI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tổng giám đốc duyệt' })).toBeVisible();
  const sel = page.getByRole('combobox', { name: 'Chọn loại báo cáo' });
  for (const o of ['Báo cáo TTr94 tổng hợp BSC', 'Báo cáo TTr94 chi tiết KPI', 'Báo cáo KPI từng tỉnh']) await expect(sel.locator('option', { hasText: o })).toHaveCount(1);
  const t = page.getByRole('table', { name: 'Tổng hợp kết quả BSC' });
  await expectHeaders(t, ['STT', 'Mã – Tên đơn vị', 'Mã – Tên tiêu chí KPI', 'Viễn cảnh', 'Trọng số', 'Mục tiêu giao', 'Kết quả', 'Điểm', 'Tình trạng', 'Thao tác']);
  await expect(t.locator('tbody tr').first()).toBeVisible();
  await expect(t.locator('tbody tr').first().getByRole('button', { name: 'Xem', exact: true })).toBeVisible();
});

test('46.2 Tìm kiếm – Tổng hợp kết quả BSC', async ({ page }) => {
  await openBsc(page);
  await filter(page, { year: '2026', period: 'Quý II', keyword: 'VNPT_HNI', perspective: 'Tài chính' });
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toContainText('VNPT_HNI');
  for (const t of await rows.allInnerTexts()) {
    expect(t).toContain('VNPT_HNI');
    expect(t).toContain('Tài chính');
  }
  await filter(page, { keyword: 'Tổng doanh thu', perspective: 'Tất cả', dataType: 'API' });
  await expect(rows.first()).toContainText('Tổng doanh thu');
  // không khớp
  await filter(page, { keyword: 'KHONG_TON_TAI_XYZ' });
  await expect(page.getByText('Không có dữ liệu').first()).toBeVisible();
});

test('46.3 Xem chi tiết – Tổng hợp kết quả BSC', async ({ page }) => {
  await openBsc(page);
  await filter(page, { year: '2026', period: 'Quý II', keyword: 'VNPT_HNI' });
  await row(page, /VNPT_HNI.*TC-002 –/).getByRole('button', { name: 'Xem', exact: true }).click();
  let choice = page.getByRole('dialog', { name: 'Xem chi tiết' });
  await choice.getByRole('button', { name: 'Xem theo đơn vị' }).click();
  const byUnit = page.getByRole('dialog', { name: 'Kết quả đánh giá KPI theo đơn vị' });
  await expect(byUnit).toContainText('VNPT_HNI');
  const ut = byUnit.getByRole('table', { name: 'Kết quả đánh giá các KPI của đơn vị' });
  await expect(ut.locator('tbody tr').filter({ hasText: 'TC-001' }).first()).toBeVisible();
  expect(await ut.locator('tbody tr').count()).toBeGreaterThan(5);
  await page.keyboard.press('Escape');
  await row(page, /VNPT_HNI.*TC-002 –/).getByRole('button', { name: 'Xem', exact: true }).click();
  choice = page.getByRole('dialog', { name: 'Xem chi tiết' });
  await choice.getByRole('button', { name: 'Xem theo KPI' }).click();
  const byKpi = page.getByRole('dialog', { name: 'Kết quả đánh giá KPI theo tiêu chí' });
  const kt = byKpi.getByRole('table', { name: 'Kết quả đánh giá của các đơn vị' });
  await expect(kt.locator('tbody tr').filter({ hasText: 'VNPT_HCM – ' })).toBeVisible();
  await expect(kt.locator('tbody tr').filter({ hasText: 'VNPT_HNI – ' })).toBeVisible();
});

test('45.1 Xem chi tiết – Xuất biểu giao KPI', async ({ page }) => {
  await openBsc(page);
  await filter(page, { year: '2026', period: 'Quý II', keyword: 'VNPT_HNI' });
  await row(page, /VNPT_HNI.*TC-002 –/).getByRole('button', { name: 'Xem', exact: true }).click();
  await page.getByRole('dialog', { name: 'Xem chi tiết' }).getByRole('button', { name: 'Xem theo đơn vị' }).click();
  const dlg = page.getByRole('dialog', { name: 'Kết quả đánh giá KPI theo đơn vị' });
  const [d] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Xuất biểu giao KPI' }).click()]);
  expect(d.suggestedFilename()).toMatch(/^BieuGiaoKPI_\d{8}_\d{4}\.xlsx$/);
  const txt = await sheetText(d);
  expect(txt).toContain('VNPT Hà Nội');
  expect(txt).toContain('TC-001');
});

test('45.2 Xem chi tiết – Xuất biểu kết quả KPI', async ({ page }) => {
  await openBsc(page);
  await filter(page, { year: '2026', period: 'Quý II', keyword: 'VNPT_HNI' });
  await row(page, /VNPT_HNI.*TC-002 –/).getByRole('button', { name: 'Xem', exact: true }).click();
  await page.getByRole('dialog', { name: 'Xem chi tiết' }).getByRole('button', { name: 'Xem theo đơn vị' }).click();
  const dlg = page.getByRole('dialog', { name: 'Kết quả đánh giá KPI theo đơn vị' });
  const [d] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Xuất biểu kết quả KPI' }).click()]);
  expect(d.suggestedFilename()).toMatch(/^BieuKetQuaKPI_\d{8}_\d{4}\.xlsx$/);
  const txt = await sheetText(d);
  expect(txt).toContain('VNPT Hà Nội');
  expect(txt).toContain('Quý II');
  expect(txt).toContain('TC-002');
});

test('46.4 Thu hồi kết quả đánh giá', async ({ page }) => {
  await openBsc(page);
  await filter(page, { year: '2026', period: 'Quý III', keyword: 'TC-002', status: 'Đã có kết quả' });
  const r = row(page, 'TC-002');
  await r.getByRole('button', { name: 'Thu hồi kết quả đánh giá', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Thu hồi kết quả đánh giá' });
  await expect(dlg).toContainText(/thu hồi kết quả đánh giá của tiêu chí KPI TC-002 – .+ trong kỳ Quý III 2026/);
  await dlg.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await slowToast(page, /Thu hồi kết quả đánh giá thành công \(\d+ đơn vị\)/);
  await filter(page, { year: '2026', period: 'Quý III', keyword: 'TC-002', status: 'BCL yêu cầu làm lại' });
  await expect(row(page, 'TC-002')).toContainText('BCL yêu cầu làm lại');
  await filter(page, { year: '2026', period: 'Quý III', keyword: 'TC-002', status: 'Đã có kết quả' });
  await expect(page.getByText('Không có dữ liệu').first()).toBeVisible();
  // kỳ đã TGĐ duyệt → không có nút thu hồi
  await filter(page, { year: '2026', period: 'Quý I', keyword: 'TC-002', status: 'Tất cả' });
  await expect(row(page, 'TC-002')).toContainText('TGĐ đã ký duyệt');
  await expect(row(page, 'TC-002').getByRole('button', { name: 'Thu hồi kết quả đánh giá', exact: true })).toHaveCount(0);
});

test('46.5 Tính lại điểm đánh giá', async ({ page }) => {
  await openBsc(page);
  await page.getByRole('button', { name: 'Tính lại điểm đánh giá' }).click();
  const dlg = page.getByRole('dialog', { name: 'Tính lại điểm KPI' });
  await dlg.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(dlg.getByText('Vui lòng chọn Kỳ đánh giá')).toBeVisible();
  await pickPeriod(dlg, '2026', 'Quý III');
  await dlg.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByTestId('toast-success').filter({ hasText: /Tính lại điểm KPI thành công cho \d+ kết quả \(Quý III 2026\)/ })).toBeVisible({ timeout: 60_000 });
  await filter(page, { year: '2026', period: 'Quý III', keyword: 'VNPT_HCM' });
  await expect(row(page, 'VNPT_HCM')).toContainText(/\d+,\d{2}/);
  // kỳ đã TGĐ duyệt → chặn
  await page.getByRole('button', { name: 'Tính lại điểm đánh giá' }).click();
  await pickPeriod(page.getByRole('dialog', { name: 'Tính lại điểm KPI' }), '2026', 'Quý I');
  await page.getByRole('dialog', { name: 'Tính lại điểm KPI' }).getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByTestId('toast-error').first()).toBeVisible();
});

test('48.2 Chốt đánh giá KPI – Cảnh báo không đủ điều kiện', async ({ page }) => {
  await openBsc(page);
  await closeExpectWarning(page);
});

test('48.1 Chốt đánh giá KPI – Đủ điều kiện', async ({ page }) => {
  await openBsc(page);
  await closeEligible(page, 'Quý II');
});

test('50.1 Tổng giám đốc duyệt – Cảnh báo không đủ điều kiện', async ({ page }) => {
  await openBsc(page);
  await approveExpectWarning(page);
});

test('50.2 Tổng giám đốc duyệt – Ký duyệt', async ({ page }) => {
  await openBsc(page);
  await approveEligible(page, '2026', 'Quý II');
});

test('51.1 Xuất báo cáo TTr94 tổng hợp BSC', async ({ page }) => {
  await openBsc(page);
  await exportReport(page, 'Báo cáo TTr94 tổng hợp BSC', 'Toàn Tập đoàn', ['BÁO CÁO TTr94 TỔNG HỢP BSC', 'Toàn Tập đoàn', 'VNPT Hà Nội', 'Cả năm']);
});

test('52.1 Xuất báo cáo TTr94 chi tiết KPI', async ({ page }) => {
  await openBsc(page);
  await exportReport(page, 'Báo cáo TTr94 chi tiết KPI', 'Khối VNPT tỉnh/thành phố', ['TTr94', 'VNPT Hà Nội', 'TC-001']);
});

test('53.1 Xuất báo cáo KPI từng tỉnh', async ({ page }) => {
  await openBsc(page);
  await exportReport(page, 'Báo cáo KPI từng tỉnh', 'Khối VNPT tỉnh/thành phố', ['VNPT Hà Nội', 'VNPT TP. Hồ Chí Minh', 'TC-001']);
});

// ==================== Tab “Theo dõi kết quả thẩm định và phản hồi” ====================

test('47.1 Lấy danh sách – Theo dõi kết quả thẩm định và phản hồi', async ({ page }) => {
  await openBsc(page, 'review');
  await expect(page.getByRole('button', { name: 'Tính lại điểm đánh giá' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Chốt đánh giá KPI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tổng giám đốc duyệt' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Chọn loại báo cáo' })).toBeVisible();
  const t = page.getByRole('table', { name: 'Theo dõi kết quả thẩm định và phản hồi' });
  await expectHeaders(t, ['STT', 'Mã – Tên đơn vị', 'Mã – Tên chỉ tiêu KPI', 'Trọng số', 'Mục tiêu giao', 'Kết quả', 'Điểm', 'Trạng thái đánh giá', 'Kỳ đánh giá', 'Thao tác']);
  await expect(t.locator('tbody tr').first()).toBeVisible();
});

test('47.2 Tìm kiếm – Theo dõi kết quả thẩm định và phản hồi', async ({ page }) => {
  await openBsc(page, 'review');
  await filter(page, { year: '2026', period: 'Quý III', keyword: 'VNPT_HCM', status: 'Đã xử lý điều chỉnh' });
  await expect(row(page, 'KH-004')).toContainText('Đã xử lý điều chỉnh');
  for (const t of await page.locator('tbody tr').allInnerTexts()) {
    expect(t).toContain('VNPT_HCM');
    expect(t).toContain('Quý III 2026');
  }
  // tìm theo tên đơn vị; đề nghị điều chỉnh KH-001 của VNPT Hà Nội có thể đã được P4 xử lý khi chạy cả bộ
  await filter(page, { year: '2026', period: 'Quý III', keyword: 'Hà Nội', status: '' });
  await expect(row(page, 'KH-001')).toContainText(/ĐV đề nghị điều chỉnh|Đã xử lý điều chỉnh/);
  for (const t of await page.locator('tbody tr').allInnerTexts()) expect(t).toContain('Hà Nội');
});

test('47.3 Xem chi tiết – Theo dõi kết quả thẩm định và phản hồi', async ({ page }) => {
  await openBsc(page, 'review');
  await filter(page, { year: '2026', period: 'Quý III', keyword: 'VNPT_HCM', status: 'Đã xử lý điều chỉnh' });
  await row(page, 'KH-004').getByRole('button', { name: 'Xem', exact: true }).click();
  const d = page.getByRole('dialog', { name: 'Thông tin kết quả thẩm định KPI' });
  await expect(d).toContainText('VNPT_HCM');
  await expect(d).toContainText('KH-004');
  await expect(d).toContainText('Quý III 2026');
  await expect(d).toContainText('Đã xử lý điều chỉnh');
  await expect(d).toContainText('Thành phần KPI');
});

test('47.4 Thu hồi kết quả đánh giá theo đơn vị', async ({ page }) => {
  await openBsc(page, 'review');
  await filter(page, { year: '2026', period: 'Quý III', keyword: 'VNPT_HCM', status: 'Đã có kết quả' });
  const r = row(page, 'TC-003');
  await r.getByRole('button', { name: 'Thu hồi kết quả đánh giá', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Thu hồi theo đơn vị' });
  await expect(dlg).toContainText(/thu hồi kết quả đánh giá của đơn vị VNPT_HCM – .+ cho tiêu chí TC-003 – .+ trong kỳ Quý III 2026/);
  await dlg.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expectToast(page, 'Thu hồi kết quả đánh giá của đơn vị thành công');
  await filter(page, { year: '2026', period: 'Quý III', keyword: 'TC-003', status: 'BCL yêu cầu làm lại' });
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('VNPT_HCM');
  // các đơn vị khác không bị ảnh hưởng
  await filter(page, { year: '2026', period: 'Quý III', keyword: 'TC-003', status: 'Đã có kết quả' });
  await expect(row(page, 'VNPT_HNI')).toBeVisible();
});

test('48.4 Chốt đánh giá KPI – Cảnh báo không đủ điều kiện (tab Theo dõi kết quả thẩm định và phản hồi)', async ({ page }) => {
  await openBsc(page, 'review');
  await closeExpectWarning(page);
});

test('48.3 Chốt đánh giá KPI – Đủ điều kiện (tab Theo dõi kết quả thẩm định và phản hồi)', async ({ page }) => {
  await openBsc(page, 'review');
  await closeEligible(page, '6 tháng đầu năm');
});

test('50.3 Tổng giám đốc duyệt – Cảnh báo không đủ điều kiện (tab Theo dõi kết quả thẩm định và phản hồi)', async ({ page }) => {
  await openBsc(page, 'review');
  await approveExpectWarning(page);
});

test('50.4 Tổng giám đốc duyệt – Ký duyệt (tab Theo dõi kết quả thẩm định và phản hồi)', async ({ page }) => {
  await openBsc(page, 'review');
  await approveEligible(page, '2026', '6 tháng đầu năm');
});

test('51.2 Xuất báo cáo TTr94 tổng hợp BSC (tab Theo dõi kết quả thẩm định và phản hồi)', async ({ page }) => {
  await openBsc(page, 'review');
  await exportReport(page, 'Báo cáo TTr94 tổng hợp BSC', 'Khối Tổng công ty/Công ty', ['BÁO CÁO TTr94 TỔNG HỢP BSC', 'Khối Tổng công ty/Công ty']);
});

test('52.2 Xuất báo cáo TTr94 chi tiết KPI (tab Theo dõi kết quả thẩm định và phản hồi)', async ({ page }) => {
  await openBsc(page, 'review');
  await exportReport(page, 'Báo cáo TTr94 chi tiết KPI', 'Toàn Tập đoàn', ['TTr94', 'TC-001']);
});

test('53.2 Xuất báo cáo KPI từng tỉnh (tab Theo dõi kết quả thẩm định và phản hồi)', async ({ page }) => {
  await openBsc(page, 'review');
  await exportReport(page, 'Báo cáo KPI từng tỉnh', 'Khối VNPT tỉnh/thành phố', ['VNPT Hà Nội', 'TC-001']);
});
