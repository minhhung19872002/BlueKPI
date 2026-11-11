import { expect, test, type Locator } from '@playwright/test';
import { expectErrorToast, expectToast, makeXlsx, row, searchKeyword } from './helpers';
import { closeBtn, filterReview, findEvalKpi, openEval, openEvalEdit, openMyKpi, PDF, PNG, reviewRow, unitRow } from './p4-helpers';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function expectHeaders(table: Locator, headers: string[]) {
  const head = table.locator('thead');
  for (const h of headers) await expect(head.getByText(h, { exact: true })).toBeVisible();
}

// ============================ KPI đơn vị của tôi ============================

test('18.1 KPI đơn vị của tôi – Xem theo kỳ đánh giá', async ({ page }) => {
  await openMyKpi(page);
  await expect(page.getByRole('radio', { name: 'Theo kỳ đánh giá' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'Theo chỉ tiêu KPI' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Theo dõi kết quả thẩm định và phản hồi' })).toBeVisible();
  // một đơn vị → không hiển thị chọn “Đơn vị”
  await expect(page.getByRole('combobox', { name: 'Đơn vị', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Năm' })).toHaveValue('2026');
  await expect(page.getByRole('combobox', { name: 'Kỳ đánh giá' })).toHaveValue('Q3');
  const table = page.getByRole('table', { name: 'Kết quả đánh giá KPI theo kỳ' });
  await expectHeaders(table, ['Mã – Tên tiêu chí KPI', 'Viễn cảnh', 'Đơn vị đo', 'Trọng số', 'KH giao', 'Kết quả thực hiện', '% TH/KH', 'Điểm', 'Trạng thái đánh giá']);
  // cây KPI cha – con mở sẵn
  await expect(row(page, 'TC-001 –')).toBeVisible();
  await expect(row(page, 'TC-001.01')).toBeVisible();
  await expect(row(page, 'TC-002 –')).toContainText('Đã có kết quả');
  await expect(row(page, 'TC-002 –')).toContainText(/\d+,\d{2}%/);
  await expect(page.getByTestId('bsc-footer')).toContainText('Điểm BSC đơn vị');
  await expect(page.getByTestId('bsc-score')).toHaveText(/^\d+,\d{2}$/);
  // kỳ chưa có kết quả
  await page.getByRole('combobox', { name: 'Kỳ đánh giá' }).selectOption({ label: 'Quý IV' });
  await expect(page).toHaveURL(/period=Q4/);
  await expect(row(page, 'TC-002 –')).toContainText('Chưa có kết quả');
});

test('19.1 KPI đơn vị của tôi – Xem theo chỉ tiêu KPI', async ({ page }) => {
  await openMyKpi(page);
  await page.getByRole('radio', { name: 'Theo chỉ tiêu KPI' }).click();
  await expect(page).toHaveURL(/view=kpi/);
  await expect(page.getByRole('radio', { name: 'Theo chỉ tiêu KPI' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('combobox', { name: 'Tiêu chí KPI' }).selectOption({ label: 'TC-002 – Lợi nhuận trước thuế' });
  await expect(page.getByRole('heading', { name: 'TC-002 – Lợi nhuận trước thuế' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Kết quả theo chỉ tiêu KPI' });
  await expectHeaders(table, ['Chỉ tiêu', 'Quý I', 'Quý II', '6 tháng đầu năm', 'Quý III', 'Quý IV', 'Cả năm']);
  for (const r of ['KH giao', 'Kết quả thực hiện', '% TH/KH', 'Điểm']) await expect(table.locator('tbody tr').filter({ hasText: r }).first()).toBeVisible();
  await expect(table.locator('tbody tr').filter({ hasText: 'Kết quả thực hiện' }).locator('td').nth(1)).toHaveText(/\d/);
  await expect(page.getByTestId('kpi-chart').locator('canvas').first()).toBeVisible();
  // năm trước cũng có dữ liệu cả năm
  await page.getByRole('combobox', { name: 'Năm' }).selectOption('2025');
  await expect(page.getByRole('combobox', { name: 'Tiêu chí KPI' })).not.toHaveValue('');
  await expect(table.locator('tbody tr').filter({ hasText: 'Kết quả thực hiện' }).locator('td').nth(6)).toHaveText(/\d/);
});

test('20.1 KPI đơn vị của tôi – Theo dõi kết quả thẩm định và phản hồi', async ({ page }) => {
  await openMyKpi(page, 'tinh_hni', '?view=review');
  await expect(page.getByRole('radio', { name: 'Theo dõi kết quả thẩm định và phản hồi' })).toHaveAttribute('aria-checked', 'true');
  const table = page.getByRole('table', { name: 'Danh sách kết quả thẩm định' });
  await expectHeaders(table, ['Mã – Tên tiêu chí KPI', 'Kết quả', 'Điểm', 'Trạng thái đánh giá', 'Ý kiến phản hồi', 'Thao tác']);
  const nps = row(page, 'KH-001 –');
  await expect(nps).toContainText('ĐV đề nghị điều chỉnh');
  await expect(nps).toContainText('Số liệu khảo sát NPS quý III');
  // đã gửi đề nghị → không cho đề nghị tiếp
  await expect(nps.getByRole('button', { name: 'Đề nghị điều chỉnh' })).toHaveCount(0);
  await expect(row(page, 'TC-002 –').getByRole('button', { name: 'Đề nghị điều chỉnh' })).toBeVisible();
  await nps.getByRole('button', { name: 'Xem', exact: true }).click();
  const d = page.getByRole('dialog', { name: 'Thông tin kết quả thẩm định KPI' });
  await expect(d.getByText('Ý kiến đề xuất của đơn vị')).toBeVisible();
  await expect(d.getByTestId('unit-proposal')).toContainText('Số liệu khảo sát NPS quý III');
  await expect(d.getByText('Lịch sử trao đổi')).toBeVisible();
  await expect(d.getByRole('list', { name: 'Dòng thời gian trạng thái' })).toContainText('ĐV đề nghị điều chỉnh');
});

test('21.1 Đề nghị điều chỉnh kết quả KPI', async ({ page }) => {
  await openMyKpi(page, 'tinh_hni', '?view=review&year=2026&period=Q3');
  const r = row(page, 'TC-002 –');
  await expect(r).toContainText('Đã có kết quả');
  await r.getByRole('button', { name: 'Đề nghị điều chỉnh' }).click();
  const dlg = page.getByRole('dialog', { name: 'Đề nghị điều chỉnh kết quả KPI' });
  await expectHeaders(dlg.getByRole('table', { name: 'Thành phần KPI' }), ['Mã thành phần', 'Tên thành phần', 'Kết quả hiện tại', 'Kết quả KPI đề xuất', 'Điều chỉnh đề xuất']);
  await dlg.getByRole('button', { name: 'Gửi' }).click();
  await expect(dlg.getByText('Vui lòng nhập Ý kiến đề xuất')).toBeVisible();
  await dlg.getByLabel('Kết quả KPI đề xuất A').fill('120');
  await dlg.getByLabel('Điều chỉnh đề xuất A').fill('2');
  await dlg.getByLabel('Ý kiến đề xuất', { exact: true }).fill('Đề nghị cập nhật lợi nhuận theo số liệu quyết toán E2E');
  await dlg.getByTestId('evidence-files').setInputFiles([PDF, PNG]);
  await dlg.getByRole('button', { name: 'Gửi' }).click();
  await expectToast(page, 'Gửi đề nghị điều chỉnh thành công');
  await expect(dlg).toBeHidden();
  await expect(r).toContainText('ĐV đề nghị điều chỉnh');
  await expect(r.getByRole('button', { name: 'Đề nghị điều chỉnh' })).toHaveCount(0);
  await r.getByRole('button', { name: 'Xem', exact: true }).click();
  const d = page.getByRole('dialog', { name: 'Thông tin kết quả thẩm định KPI' });
  await expect(d.getByTestId('unit-proposal')).toContainText('số liệu quyết toán E2E');
  await expect(d.getByRole('button', { name: 'minh-chung.pdf' })).toBeVisible();
});

test('22.1 Xuất kết quả đánh giá KPI theo mẫu', async ({ page }) => {
  await openMyKpi(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất dữ liệu' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^KetQuaDanhGiaKPI_\d{8}_\d{4}\.xlsx$/);
});

// ============================ Đánh giá KPI ============================

test('39.1 Lấy danh sách – Tổng hợp BSC theo chỉ tiêu KPI', async ({ page }) => {
  await openEval(page, 'kpi');
  await expect(page.getByRole('tab', { name: 'Theo dõi kết quả thẩm định và phản hồi' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tổng hợp BSC theo chỉ tiêu KPI' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Tổng hợp BSC theo chỉ tiêu KPI' });
  await expectHeaders(table, ['STT', 'Mã – Tên tiêu chí KPI', 'Viễn cảnh', 'Đơn vị đo', 'Tình trạng', 'Kỳ đánh giá', 'Loại kết quả', 'Đơn vị giao', 'Thao tác']);
  await expect(page.getByRole('combobox', { name: 'Năm' })).toHaveValue('2026');
  const first = table.locator('tbody tr').first();
  await expect(first).toContainText('2026');
  await expect(first.getByRole('button', { name: 'Xem', exact: true })).toBeVisible();
  await expect(first.getByRole('button', { name: 'Đánh giá', exact: true })).toBeVisible();
  await expect(first.getByRole('button', { name: 'Chốt kết quả R2', exact: true })).toBeVisible();
  expect(Number(await page.getByTestId('grid-total').textContent())).toBeGreaterThan(20);
});

test('39.2 Tìm kiếm – Tổng hợp BSC theo chỉ tiêu KPI', async ({ page }) => {
  await openEval(page, 'kpi');
  const r = await findEvalKpi(page, 'KH-001', 'Quý IV');
  await expect(r).toContainText('Chỉ số hài lòng khách hàng (NPS)');
  await expect(r).toContainText('Chưa chấm');
  await expect(r).toContainText('API');
  await expect(page.getByTestId('grid-total')).toHaveText('1');
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await page.getByRole('combobox', { name: 'Viễn cảnh', exact: true }).selectOption({ label: 'KH – Khách hàng' });
  await page.getByRole('combobox', { name: 'Kỳ đánh giá', exact: true }).selectOption({ label: 'Quý III' });
  await page.getByRole('combobox', { name: 'Trạng thái', exact: true }).selectOption({ label: 'Đã chấm' });
  await page.getByRole('combobox', { name: 'Loại kết quả', exact: true }).selectOption({ label: 'API' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  const rows = page.getByRole('table', { name: 'Tổng hợp BSC theo chỉ tiêu KPI' }).locator('tbody tr');
  await expect(rows.filter({ hasText: 'KH-002 –' })).toHaveCount(1);
  await expect(rows.filter({ hasText: 'TC-' })).toHaveCount(0);
  for (const t of await rows.allTextContents()) {
    expect(t).toContain('Quý III 2026');
    expect(t).toContain('API');
    expect(t).toContain('Khách hàng');
    expect(t).toContain('Đã chấm');
  }
});

test('39.3 Xem chi tiết – Tổng hợp BSC theo chỉ tiêu KPI', async ({ page }) => {
  await openEvalEdit(page, 'KH-001', 'Quý III', 'Xem');
  await expect(page).toHaveURL(/mode=view/);
  const info = page.locator('section').filter({ hasText: 'Thông tin chung' }).first();
  for (const l of ['Mã KPI', 'Tên tiêu chí', 'Kỳ đánh giá', 'Đơn vị đo', 'Nguồn số liệu', 'Mã KPI cha', 'Tình trạng', 'Loại số liệu', 'Phương pháp tính điểm', 'Công thức tính tỷ lệ hoàn thành']) {
    await expect(info.getByText(l, { exact: true })).toBeVisible();
  }
  await expect(info).toContainText('Chỉ số hài lòng khách hàng (NPS)');
  await expect(info).toContainText('Quý III 2026');
  await expect(info).toContainText('Thuận (TH/KH)');
  const table = page.getByRole('table', { name: 'Danh sách đơn vị được giao' });
  await expectHeaders(table, ['STT', 'Mã đơn vị', 'Đơn vị được giao', 'KH giao', 'Kết quả KPI', 'ĐC kỳ trước', 'Điều chỉnh', 'Kết quả cuối', 'Điểm', 'Đánh giá', 'Tình trạng', 'Mô tả']);
  await expect(unitRow(page, 'VNPT_HNI')).toContainText(/ĐV đề nghị điều chỉnh|Đã xử lý điều chỉnh/);
  // chế độ xem: không có nút chỉnh sửa / ô nhập
  for (const b of ['Lưu', 'Đồng bộ lại', 'Nhập dữ liệu']) await expect(page.getByRole('button', { name: b, exact: true })).toHaveCount(0);
  await expect(table.locator('input')).toHaveCount(0);
  // lọc theo đơn vị / đánh giá
  await searchKeyword(page, 'VNPT_HCM');
  await expect(unitRow(page, 'VNPT_HCM')).toBeVisible();
  for (const t of await table.locator('tbody tr').allTextContents()) expect(t).toContain('VNPT_HCM');
  await expect(table.locator('tbody tr').filter({ hasText: 'VNPT_HNI' })).toHaveCount(0);
  await expect(unitRow(page, 'VNPT_HCM')).toContainText('VNPT TP. Hồ Chí Minh');
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await page.getByRole('combobox', { name: 'Đánh giá', exact: true }).selectOption({ label: 'Chưa đạt' });
  await page.getByRole('button', { name: 'Tìm kiếm' }).click();
  await expect(table.locator('tbody tr').filter({ hasText: 'Chưa đạt' }).first()).toBeVisible();
  for (const t of await table.locator('tbody tr').allTextContents()) expect(t).toContain('Chưa đạt');
  await closeBtn(page).click();
  await expect(page.getByRole('heading', { name: 'Đánh giá KPI', exact: true })).toBeVisible();
});

test('40.1 Lấy danh sách – Theo dõi kết quả thẩm định và phản hồi', async ({ page }) => {
  await openEval(page, 'review');
  const table = page.getByRole('table', { name: 'Danh sách kết quả thẩm định' });
  await expectHeaders(table, ['STT', 'Mã – Tên đơn vị', 'Mã – Tên chỉ tiêu KPI', 'Trọng số', 'Mục tiêu giao', 'Kết quả', 'Điểm', 'Trạng thái đánh giá', 'Kỳ đánh giá', 'Thao tác']);
  const first = table.locator('tbody tr').first();
  await expect(first.getByRole('button', { name: 'Xem', exact: true })).toBeVisible();
  await expect(first.getByRole('button', { name: 'Chỉnh sửa', exact: true })).toBeVisible();
  expect(Number(await page.getByTestId('grid-total').textContent())).toBeGreaterThan(20);
  // mặc định chỉ các bản ghi đã có kết quả
  await expect(table.locator('tbody tr').filter({ hasText: 'Chưa có kết quả' })).toHaveCount(0);
});

test('40.2 Tìm kiếm – Theo dõi kết quả thẩm định và phản hồi', async ({ page }) => {
  await openEval(page, 'review');
  await filterReview(page, { keyword: 'VNPT_HNI', period: 'Quý III', status: 'ĐV đề nghị điều chỉnh' });
  const r = reviewRow(page, 'VNPT_HNI', 'KH-001');
  await expect(r).toContainText('VNPT_HNI – VNPT Hà Nội');
  await expect(r).toContainText('ĐV đề nghị điều chỉnh');
  await expect(r).toContainText('Quý III 2026');
  await filterReview(page, { keyword: 'KH-004', period: 'Quý III', status: 'Đã xử lý điều chỉnh' });
  await expect(reviewRow(page, 'VNPT_HCM', 'KH-004')).toContainText('Đã xử lý điều chỉnh');
  await filterReview(page, { keyword: 'QT-004', period: 'Quý III', status: 'Chưa có kết quả' });
  await expect(reviewRow(page, 'VNPT_CMU', 'QT-004')).toBeVisible();
  await expect(reviewRow(page, 'VNPT_AGG', 'QT-004')).toBeVisible();
});

test('40.3 Xem chi tiết – Theo dõi kết quả thẩm định và phản hồi', async ({ page }) => {
  await openEval(page, 'review');
  await filterReview(page, { keyword: 'VNPT_HNI', period: 'Quý III', status: 'ĐV đề nghị điều chỉnh' });
  await reviewRow(page, 'VNPT_HNI', 'KH-001').getByRole('button', { name: 'Xem', exact: true }).click();
  const d = page.getByRole('dialog', { name: 'Thông tin kết quả thẩm định KPI' });
  for (const s of ['Ý kiến đề xuất của đơn vị', 'Thông tin điều chỉnh', 'Lịch sử trao đổi', 'Dòng thời gian trạng thái']) await expect(d.getByText(s, { exact: true })).toBeVisible();
  await expect(d).toContainText('VNPT_HNI – VNPT Hà Nội');
  await expect(d.getByTestId('unit-proposal')).toContainText('Số liệu khảo sát NPS quý III');
  await expect(d.getByRole('table', { name: 'Danh sách thành phần' })).toContainText('A');
  await expect(d.getByRole('list', { name: 'Dòng thời gian trạng thái' })).toContainText('ĐV đề nghị điều chỉnh');
  await d.getByRole('button', { name: 'Đóng cửa sổ' }).click();
  // liên kết từ thông báo: ?resultId=… mở sẵn drawer
  const res = await page.request.get('/api/evaluations/review?keyword=VNPT_HNI&year=2026&period=Q3&status=DV_DE_NGHI_DIEU_CHINH');
  const id = (await res.json()).data.items.find((x: { kpiCode: string }) => x.kpiCode === 'KH-001').id;
  await page.goto(`/kpi-admin/evaluations?tab=review&resultId=${id}`);
  await expect(page.getByRole('dialog', { name: 'Thông tin kết quả thẩm định KPI' }).getByTestId('unit-proposal')).toContainText('Số liệu khảo sát NPS');
});

test('41.1 Điều chỉnh kết quả KPI cho đơn vị', async ({ page }) => {
  await openEval(page, 'review');
  await filterReview(page, { keyword: 'VNPT_HNI', period: 'Quý III', status: 'ĐV đề nghị điều chỉnh' });
  await reviewRow(page, 'VNPT_HNI', 'KH-001').getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Cập nhật, điều chỉnh kết quả KPI cho đơn vị' });
  for (const l of ['Mã KPI', 'Tên tiêu chí', 'Đơn vị', 'Kỳ đánh giá', 'Đơn vị đo', 'Tình trạng', 'Kế hoạch giao', 'Kết quả cũ', 'Kết quả sau điều chỉnh', 'Ngày cập nhật']) {
    await expect(dlg.getByText(l, { exact: true }).first()).toBeVisible();
  }
  await expect(dlg).toContainText('Số liệu khảo sát NPS quý III');
  await expectHeaders(dlg.getByRole('table', { name: 'Thành phần KPI' }), ['Mã thành phần', 'Tên thành phần', 'Kết quả KPI', 'Kết quả KPI ĐV đề xuất', 'ĐC kỳ trước', 'Điều chỉnh ĐV đề xuất', 'Điều chỉnh', 'Kết quả cuối']);
  await expect(dlg.getByTestId('result-after-adjust')).toHaveText('50,70');
  await dlg.getByLabel('Điều chỉnh A').fill('3');
  await expect(dlg.getByTestId('result-after-adjust')).toHaveText('53,70');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Vui lòng nhập Lý do điều chỉnh')).toBeVisible();
  await dlg.getByTestId('decision-file').setInputFiles({ ...PDF, name: 'quyet-dinh.pdf' });
  await dlg.getByLabel('Lý do điều chỉnh', { exact: true }).fill('Bổ sung kênh khảo sát trực tuyến theo đề nghị của đơn vị');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Điều chỉnh kết quả thành công');
  await expect(dlg).toBeHidden();
  await filterReview(page, { keyword: 'VNPT_HNI', period: 'Quý III', status: 'Đã xử lý điều chỉnh' });
  const r = reviewRow(page, 'VNPT_HNI', 'KH-001');
  await expect(r).toContainText('Đã xử lý điều chỉnh');
  await expect(r).toContainText('53,70');
  await r.getByRole('button', { name: 'Xem', exact: true }).click();
  const d = page.getByRole('dialog', { name: 'Thông tin kết quả thẩm định KPI' });
  await expect(d).toContainText('Bổ sung kênh khảo sát trực tuyến');
  await expect(d.getByRole('button', { name: 'quyet-dinh.pdf' })).toBeVisible();
});

test('42.1 Cập nhật kết quả đánh giá KPI (SL nhập tay) cho đơn vị', async ({ page }) => {
  await openEval(page, 'review');
  await filterReview(page, { keyword: 'VNPT_HNI', period: 'Quý III', status: 'Đã có kết quả' });
  const r = reviewRow(page, 'VNPT_HNI', 'QT-001');
  await r.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Cập nhật, điều chỉnh kết quả KPI cho đơn vị' });
  await expect(dlg.getByLabel('Lý do điều chỉnh')).toHaveCount(0);
  await dlg.getByLabel('Kết quả KPI A').fill('97,5');
  await expect(dlg.getByTestId('result-after-adjust')).toHaveText('97,50');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật kết quả thành công');
  await expect(dlg).toBeHidden();
  await expect(r).toContainText('97,50');
  await expect(r).toContainText('Đã có kết quả');
  // bản ghi “Chưa có kết quả” của KPI API → không cho chỉnh sửa
  await filterReview(page, { keyword: 'TC-003', period: 'Quý IV', status: 'Chưa có kết quả' });
  await reviewRow(page, 'VNPT_HNI', 'TC-003').getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await expectErrorToast(page, 'Bản ghi không ở trạng thái cho phép chỉnh sửa');
});

test('43.1 Đánh giá – Đồng bộ lại', async ({ page }) => {
  await openEvalEdit(page, 'KH-001', 'Quý IV');
  await expect(page.getByLabel('Kết quả KPI VNPT_HNI', { exact: true })).toHaveCount(0);
  await expect(unitRow(page, 'VNPT_HNI')).toContainText('Chưa có kết quả');
  await page.getByRole('button', { name: 'Đồng bộ lại' }).click();
  await expectToast(page, /Đồng bộ thành công \d+\/\d+ đơn vị; lỗi 0/);
  await expect(page.getByTestId('sync-status')).toContainText('Đồng bộ thành công');
  await expect(page.getByText('Xem lỗi')).toHaveCount(0);
  await expect(unitRow(page, 'VNPT_HNI')).toContainText('Đã có kết quả');
  await expect(page.getByTestId('score-VNPT_HNI')).toHaveText(/\d/);
  // KPI không có thành phần API → báo lỗi lý do
  await closeBtn(page).click();
  const r = await findEvalKpi(page, 'TC-002', 'Quý IV');
  await r.getByRole('button', { name: 'Đánh giá', exact: true }).click();
  await page.getByRole('button', { name: 'Đồng bộ lại' }).click();
  await expectErrorToast(page, 'KPI không có thành phần lấy kết quả từ API');
});

test('44.1 Đánh giá – Tổng hợp BSC theo chỉ tiêu KPI (nhập tay)', async ({ page }) => {
  await openEvalEdit(page, 'TC-002', 'Quý IV');
  const r = unitRow(page, 'VNPT_HNI');
  await expect(r).toContainText('Chưa có kết quả');
  await expect(page.getByTestId('score-VNPT_HNI')).toHaveText('');
  const plan = (await r.locator('td').nth(3).textContent())!.trim();
  expect(plan).toMatch(/\d/);
  await page.getByLabel('Kết quả KPI VNPT_HNI', { exact: true }).fill(plan.replace(/\./g, ''));
  await page.getByLabel('Mô tả VNPT_HNI', { exact: true }).fill('Nhập tay E2E');
  // tính thử trước khi lưu
  await expect(page.getByTestId('score-VNPT_HNI')).toHaveText(/^\d+,\d{2}$/);
  await expect(page.getByTestId('final-VNPT_HNI')).toContainText(plan);
  await expect(r).toContainText('Đạt/Vượt');
  await expect(r).toContainText('Chưa có kết quả');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expectToast(page, 'Lưu kết quả thành công');
  await expect(r).toContainText('Đã có kết quả');
  await expect(page.getByLabel('Kết quả KPI VNPT_HNI', { exact: true })).toHaveValue(/\d/);
  await expect(page.getByLabel('Mô tả VNPT_HNI', { exact: true })).toHaveValue('Nhập tay E2E');
  const info = page.locator('section').filter({ hasText: 'Thông tin chung' }).first();
  await expect(info).toContainText('Đã chấm');
});

test('44.2 Đánh giá – Nhập dữ liệu', async ({ page }) => {
  await openEvalEdit(page, 'HP-001', 'Quý III');
  // BE: manual-import lỗi NPE nếu đơn vị chưa có “Điều chỉnh”/“Mô tả” (EvaluationService.currentAdj/currentDesc) → nhập trước
  await page.getByLabel('Điều chỉnh VNPT_HNI', { exact: true }).fill('0');
  await page.getByLabel('Mô tả VNPT_HNI', { exact: true }).fill('Trước khi nhập file');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expectToast(page, 'Lưu kết quả thành công');
  await page.getByRole('button', { name: 'Nhập dữ liệu' }).click();
  const dlg = page.getByRole('dialog', { name: 'Nhập dữ liệu nhập tay' });
  await expect(dlg.getByText('Tải file mẫu', { exact: true }).first()).toBeVisible();
  await expect(dlg.getByText('Tải file lên', { exact: true })).toBeVisible();
  await dlg.getByLabel('Thành phần nhập tay', { exact: true }).selectOption({ index: 1 });
  const [tpl] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Tải file mẫu' }).click()]);
  expect(tpl.suggestedFilename()).toMatch(/\.xlsx$/);
  const buf = await makeXlsx(['Mã đơn vị (*)', 'Tên đơn vị', 'Giá trị (*)', 'Ghi chú'], [
    ['VNPT_HNI', 'VNPT Hà Nội', 91, 'E2E'],
    ['KHONG_TON_TAI', 'Sai mã', 80, null],
  ]);
  await dlg.getByTestId('manual-import-file').setInputFiles({ name: 'nhap-tay.xlsx', mimeType: XLSX, buffer: buf });
  await dlg.getByRole('button', { name: 'Xác nhận' }).click();
  await expectToast(page, 'Đã cập nhật 1/2 đơn vị; 1 dòng lỗi');
  await expect(dlg.getByRole('table', { name: 'Danh sách dòng lỗi' })).toContainText('Mã đơn vị không thuộc danh sách giao');
  await dlg.getByRole('button', { name: 'Hủy' }).click();
  await expect(unitRow(page, 'VNPT_HNI')).toContainText('Đã có kết quả');
  await expect(page.getByLabel('Kết quả KPI VNPT_HNI', { exact: true })).toHaveValue(/^91/);
});

test('49.1 Chốt kết quả R2 – Tổng hợp BSC theo chỉ tiêu KPI', async ({ page, browser }) => {
  await openEval(page, 'kpi');
  const r = await findEvalKpi(page, 'HP-002', 'Quý IV');
  await r.getByRole('button', { name: 'Chốt kết quả R2', exact: true }).click();
  const c = page.getByRole('dialog', { name: 'Chốt kết quả R2' });
  await expect(c).toContainText(/Xác nhận chốt kết quả R2 cho tiêu chí HP-002 – .+ kỳ Quý IV năm 2026\? Sau khi chốt sẽ không cho phép đánh giá lại\./);
  await c.getByTestId('confirm-ok').click();
  await expectToast(page, 'Chốt kết quả R2 thành công');
  await expect(r).toContainText('Chốt KQ R2');
  await expect(r.getByRole('button', { name: 'Đánh giá', exact: true })).toHaveCount(0);
  await expect(r.getByRole('button', { name: 'Chốt kết quả R2', exact: true })).toHaveCount(0);
  // xem: chỉ đọc
  await r.getByRole('button', { name: 'Xem', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cập nhật kết quả KPI cho tất cả đơn vị' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0);
  // tài khoản đánh giá thấy trạng thái đã chốt
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await openEval(p2, 'kpi', 'danhgia');
  await p2.getByRole('combobox', { name: 'Trạng thái', exact: true }).selectOption({ label: 'Chốt KQ R2' });
  const r2 = await findEvalKpi(p2, 'HP-002', 'Quý IV');
  await expect(r2).toContainText('Chốt KQ R2');
  await expect(r2.getByRole('button', { name: 'Đánh giá', exact: true })).toHaveCount(0);
  await ctx.close();
});
