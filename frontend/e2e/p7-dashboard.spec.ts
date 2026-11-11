import { expect, test, type Download, type Locator, type Page } from '@playwright/test';
import { login } from './helpers';

/**
 * P7 — “Dashboard TGĐ BSC” (STT 6.1 → 17.8) + điều hướng SiteMap + phân quyền xem.
 * Dữ liệu seed demo: năm trước có đủ kỳ; năm hiện tại có Q1, Q2, H1, Q3. Chiến lược: Tập đoàn (2021–2025, 2026–2030), VNPT Hà Nội (2026–2030).
 */
test.describe.configure({ timeout: 90_000 });

const CUR = new Date().getFullYear();
const PREV = CUR - 1;
const GROUP_LABEL = '1. Công ty mẹ – Tập đoàn';
const PROVINCES_LABEL = 'Khối VNPT tỉnh/thành phố';

const content = (page: Page) => page.getByTestId('dashboard-content');
const title = (page: Page) => page.getByTestId('dashboard-title');
const periodSel = (page: Page) => page.getByLabel('Kỳ đánh giá', { exact: true });
const yearSel = (page: Page) => page.getByLabel('Năm', { exact: true });
const unitBtn = (page: Page) => page.getByTestId('dashboard-filters').getByRole('button', { name: 'Đơn vị', exact: true });

async function openDash(page: Page, user = 'admin', query = '') {
  await login(page, user);
  await page.goto(`/dashboard${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard TGĐ BSC' })).toBeVisible();
  await expect(content(page)).toBeVisible();
}

/** Chờ số liệu ổn định sau khi đổi bộ lọc */
async function settled(page: Page) {
  await expect(content(page)).toBeVisible();
  await expect(content(page)).not.toHaveClass(/opacity-70/);
}

async function pickUnit(page: Page, label: string) {
  await unitBtn(page).click();
  if (label !== GROUP_LABEL && label !== PROVINCES_LABEL) await page.getByPlaceholder('Tìm theo mã hoặc tên').fill(label);
  await page.getByRole('treeitem', { name: label }).first().click();
  await settled(page);
}

async function pickPeriod(page: Page, label: string) {
  await periodSel(page).selectOption({ label });
  await settled(page);
}

async function pickYear(page: Page, y: number) {
  await yearSel(page).selectOption(String(y));
  await settled(page);
}

const PERIOD_NAME: Record<string, string> = { Y: 'Cả năm', Q1: 'Quý I', Q2: 'Quý II', Q3: 'Quý III', Q4: 'Quý IV', H1: '6 tháng đầu năm' };

/** Kỳ mặc định (17.1) = kỳ gần nhất đã có kết quả — phụ thuộc dữ liệu (P4/P5 có thể đã nhập thêm Quý IV) */
async function defaultPeriod(page: Page) {
  const r = await page.request.get('/api/dashboard/filters');
  const code = (await r.json()).data.defaults.period as string;
  return { code, name: PERIOD_NAME[code] };
}

const viewBtn = (page: Page, name: string) => page.getByRole('group', { name: 'Xem theo' }).getByRole('button', { name, exact: true });

async function cardValue(page: Page, key: string) {
  return Number((await page.getByTestId(`card-${key}`).getByTestId('card-value').innerText()).replace(/\./g, ''));
}

async function expectCommon(page: Page) {
  for (const l of ['Tổng số KPI giao', 'KPI đạt/vượt', 'KPI chưa đạt', 'KPI đang theo dõi']) {
    const c = page.getByRole('button', { name: l, exact: true });
    await expect(c).toBeVisible();
    await expect(c).toContainText('Click xem');
    await expect(c).toContainText('so với kỳ trước');
  }
  await expect(page.getByTestId('bsc-gauge')).toContainText('Điểm BSC tổng hợp');
  await expect(page.getByTestId('bsc-prev')).toContainText('Kỳ trước');
  await expect(page.getByTestId('last-updated')).toContainText('Thời điểm cập nhật mới nhất');
  await expect(page.getByTestId('focus-area')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem Danh Sách Chi Tiết Các KPI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xuất kết quả đánh giá KPI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem bản đồ chiến lược' })).toBeVisible();
}

async function expectGroupBlocks(page: Page) {
  const rk = page.getByTestId('ranking-block');
  await expect(rk).toBeVisible();
  for (const h of ['Hạng', 'Đơn vị/Tỉnh thành', 'Điểm BSC', 'Biến động', 'Thao tác']) await expect(rk.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  await expect(rk.locator('tbody tr')).toHaveCount(10);
  const corp = page.getByTestId('corporations-block');
  await expect(corp).toBeVisible();
  for (const h of ['Tên đơn vị', '% đạt KH kỳ', 'Điểm BSC']) await expect(corp.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
}

async function sheets(d: Download): Promise<{ names: string[]; text: string[] }> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await d.path());
  const names: string[] = [];
  const text: string[] = [];
  wb.eachSheet((ws) => {
    names.push(ws.name);
    const lines: string[] = [];
    ws.eachRow((r) => lines.push((r.values as unknown[]).slice(1).map((v) => (v && typeof v === 'object' && 'result' in v ? (v as { result: unknown }).result : v) ?? '').join('|')));
    text.push(lines.join('\n'));
  });
  return { names, text };
}

async function download(page: Page, btn: Locator) {
  const [d] = await Promise.all([page.waitForEvent('download'), btn.click()]);
  expect(d.suggestedFilename()).toMatch(/\.xlsx$/);
  return d;
}

// ================================ Chế độ A — Tập đoàn ================================

test('17.1 Xem tổng quan – Dashboard TGĐ BSC (mặc định: Tập đoàn, năm hiện tại, kỳ gần nhất có kết quả)', async ({ page }) => {
  await openDash(page);
  await expect(content(page)).toHaveAttribute('data-mode', 'GROUP');
  await expect(unitBtn(page)).toContainText(GROUP_LABEL);
  await expect(yearSel(page)).toHaveValue(String(CUR));
  const def = await defaultPeriod(page);
  expect(['Q1', 'Q2', 'H1', 'Q3', 'Q4', 'Y']).toContain(def.code);
  await expect(periodSel(page)).toHaveValue(def.code);
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – ${def.name} ${CUR}`);
  await expectCommon(page);
  await expectGroupBlocks(page);
});

test('6.1 Xem biểu tổng hợp Tập đoàn – Năm', async ({ page }) => {
  await openDash(page);
  await pickYear(page, PREV);
  await pickPeriod(page, 'Cả năm');
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – Cả năm ${PREV}`);
  await expect(page).toHaveURL(/period=Y/);
  await expectCommon(page);
  await expectGroupBlocks(page);
  expect(await cardValue(page, 'total')).toBeGreaterThan(0);
});

test('7.1 Xem biểu tổng hợp Tập đoàn – Quý', async ({ page }) => {
  await openDash(page);
  await pickPeriod(page, 'Quý II');
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – Quý II ${CUR}`);
  await expect(viewBtn(page, 'Quý')).toHaveAttribute('aria-pressed', 'true');
  await expectCommon(page);
  await expectGroupBlocks(page);
});

test('8.1 Xem biểu tổng hợp Tập đoàn – Giai đoạn', async ({ page }) => {
  await openDash(page);
  await pickPeriod(page, 'Giai đoạn 2021–2025');
  // giai đoạn → năm chuyển về năm đầu giai đoạn; chọn năm có dữ liệu seed → số liệu lũy kế
  await pickYear(page, PREV);
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – Giai đoạn 2021–2025 (đến năm ${PREV})`);
  await expect(page.getByTestId('stage-chart')).toBeVisible();
  await expect(viewBtn(page, 'Giai đoạn')).toHaveAttribute('aria-pressed', 'true');
  await expectCommon(page);
  await expectGroupBlocks(page);
});

// ================================ Chế độ B — Đơn vị ================================

test('9.1 Xem biểu tổng hợp Đơn vị – Năm', async ({ page }) => {
  await openDash(page);
  await pickUnit(page, 'VNPT Hà Nội');
  await pickYear(page, PREV);
  await pickPeriod(page, 'Cả năm');
  await expect(content(page)).toHaveAttribute('data-mode', 'UNIT');
  await expect(page.getByTestId('viewing')).toContainText(`Đang xem: VNPT Hà Nội – Cả năm ${PREV}`);
  await expect(title(page)).toHaveText(`Biểu tổng hợp đơn vị – Cả năm ${PREV}`);
  await expectCommon(page);
  const card = page.getByTestId('focus-card').first();
  await expect(card).toContainText('TH kỳ đánh giá');
  await expect(card).toContainText('% TH/KH kỳ');
  await expect(card).toContainText('% TH/KH năm');
  await expect(card.getByRole('button', { name: /Xem chi tiết/ })).toBeVisible();
  await expect(page.getByTestId('ranking-block')).toHaveCount(0);
});

test('10.1 Xem biểu tổng hợp Đơn vị – Quý', async ({ page }) => {
  await openDash(page);
  await pickUnit(page, 'VNPT Hà Nội');
  await pickPeriod(page, 'Quý I');
  await expect(page.getByTestId('viewing')).toContainText(`Đang xem: VNPT Hà Nội – Quý I ${CUR}`);
  await expectCommon(page);
});

test('11.1 Xem biểu tổng hợp Đơn vị – Giai đoạn', async ({ page }) => {
  await openDash(page);
  await pickUnit(page, 'VNPT Hà Nội');
  await pickPeriod(page, 'Giai đoạn 2021–2025');
  await expect(page.getByTestId('viewing')).toContainText('Đang xem: VNPT Hà Nội – Giai đoạn 2021–2025');
  await expect(page.getByTestId('stage-chart')).toBeVisible();
  await expectCommon(page);
});

test('17.2 Lọc dữ liệu – Dashboard TGĐ BSC (đổi bộ lọc → query lại CSDL, cập nhật toàn bộ số liệu)', async ({ page }) => {
  await openDash(page);
  const reqs: string[] = [];
  page.on('request', (r) => r.url().includes('/api/dashboard/overview') && reqs.push(r.url()));
  await pickPeriod(page, 'Quý I');
  await expect.poll(() => reqs.some((u) => u.includes('period=Q1'))).toBeTruthy();
  await pickYear(page, PREV);
  await expect.poll(() => reqs.some((u) => u.includes(`year=${PREV}`))).toBeTruthy();
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – Quý I ${PREV}`);
  await pickUnit(page, 'VNPT Hải Phòng');
  await expect(page.getByTestId('viewing')).toContainText(`Đang xem: VNPT Hải Phòng – Quý I ${PREV}`);
  await expect(page).toHaveURL(new RegExp(`year=${PREV}`));
});

test('16.1 Xem Dashboard đơn vị từ bảng xếp hạng', async ({ page }) => {
  await openDash(page);
  const first = page.getByTestId('ranking-block').locator('tbody tr').first();
  const name = (await first.locator('td').nth(1).innerText()).trim();
  await first.getByRole('button', { name: `Xem ${name}` }).click();
  await settled(page);
  await expect(content(page)).toHaveAttribute('data-mode', 'UNIT');
  await expect(unitBtn(page)).toContainText(name);
  const def = await defaultPeriod(page);
  await expect(page.getByTestId('viewing')).toContainText(`Đang xem: ${name} – ${def.name} ${CUR}`);
  await expectCommon(page);
});

test('16.2 Quay lại Dashboard Tập đoàn', async ({ page }) => {
  await openDash(page);
  await pickUnit(page, 'VNPT Hà Nội');
  await page.getByRole('button', { name: 'Quay lại Dashboard Tập đoàn' }).click();
  await settled(page);
  await expect(content(page)).toHaveAttribute('data-mode', 'GROUP');
  await expect(unitBtn(page)).toContainText(GROUP_LABEL);
  await expect(page.getByTestId('ranking-block')).toBeVisible();
});

// ================================ Chế độ C — Khối tỉnh ================================

const PROVINCE_COLS = ['Hạng', 'Mã đơn vị', 'VNPT tỉnh/thành phố', 'Tổng số KPI giao', 'KPI đạt/vượt', 'KPI chưa đạt', 'KPI đang theo dõi', '% TH/KH kỳ', 'Điểm BSC', 'Biến động', 'Thao tác'];

async function expectProvinces(page: Page) {
  const b = page.getByTestId('provinces-block');
  await expect(b).toBeVisible();
  for (const h of PROVINCE_COLS) await expect(b.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  await expect(b.locator('tbody tr').first()).toBeVisible();
  expect(await b.locator('tbody tr').count()).toBeGreaterThan(10);
  // sắp xếp theo thứ hạng
  const ranks = (await b.locator('tbody tr td:first-child').allInnerTexts()).map(Number).filter((n) => n > 0);
  expect(ranks).toEqual([...ranks].sort((a, c) => a - c));
  await expect(page.getByTestId('provinces-chart')).toBeVisible();
}

test('12.1 Xem biểu tổng hợp Tỉnh – Năm (tất cả các tỉnh)', async ({ page }) => {
  await openDash(page);
  await pickUnit(page, PROVINCES_LABEL);
  await pickYear(page, PREV);
  await pickPeriod(page, 'Cả năm');
  await expect(title(page)).toHaveText(`Biểu tổng hợp khối VNPT tỉnh/thành phố – Cả năm ${PREV}`);
  await expectProvinces(page);
  // “Xem” → 16.1
  const r = page.getByTestId('provinces-block').locator('tbody tr').filter({ hasText: 'VNPT_HNI' });
  await r.getByRole('button', { name: 'Xem VNPT Hà Nội' }).click();
  await settled(page);
  await expect(page.getByTestId('viewing')).toContainText(`Đang xem: VNPT Hà Nội – Cả năm ${PREV}`);
});

test('13.1 Xem biểu tổng hợp Tỉnh – Quý (tất cả các tỉnh)', async ({ page }) => {
  await openDash(page);
  await pickUnit(page, PROVINCES_LABEL);
  await pickPeriod(page, 'Quý II');
  await expect(title(page)).toHaveText(`Biểu tổng hợp khối VNPT tỉnh/thành phố – Quý II ${CUR}`);
  await expectProvinces(page);
});

// ================================ Chế độ D — 1 tỉnh, giai đoạn ================================

test('14.1 Xem biểu tổng hợp giai đoạn của 1 tỉnh', async ({ page }) => {
  await openDash(page);
  await pickUnit(page, 'VNPT Hà Nội');
  await pickPeriod(page, 'Giai đoạn 2026–2030');
  const b = page.getByTestId('province-stage-block');
  await expect(b).toBeVisible();
  for (const h of ['Kỳ đánh giá', 'Tổng số KPI giao', 'KPI đạt/vượt', 'KPI chưa đạt', '% TH/KH', 'Điểm BSC', 'Hạng trong khối']) await expect(b.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  await expect(b.locator('tbody tr').filter({ hasText: `Quý I ${CUR}` })).toBeVisible();
  await expect(b.getByLabel('Biểu đồ điểm BSC theo kỳ đánh giá')).toBeVisible();
});

// ================================ 15.1 Bản đồ chiến lược ================================

test('15.1 Xem bản đồ chiến lược', async ({ page }) => {
  await openDash(page);
  await page.getByRole('button', { name: 'Xem bản đồ chiến lược' }).click();
  const dlg = page.getByRole('dialog', { name: 'Bản đồ chiến lược' });
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('Chiến lược phát triển Tập đoàn VNPT giai đoạn 2026–2030');
  await expect(dlg.getByTestId('strategy-map')).toBeVisible();
  await expect(dlg.locator('[data-testid="objective-node"]').first()).toBeVisible();
  // readonly: không có thanh công cụ chỉnh sửa
  await expect(dlg.getByRole('toolbar', { name: 'Thanh công cụ bản đồ' })).toHaveCount(0);
  await expect(dlg.locator('.react-flow__edge').first()).toBeAttached();
  await dlg.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await expect(dlg).toHaveCount(0);
  // Đơn vị không có chiến lược
  await pickUnit(page, 'VNPT TP. Hồ Chí Minh');
  await page.getByRole('button', { name: 'Xem bản đồ chiến lược' }).click();
  await expect(page.getByTestId('no-strategy-map')).toHaveText('Chưa có bản đồ chiến lược cho đơn vị/kỳ đã chọn');
});

// ================================ Popup + xuất file ================================

const KPI_COLS = ['STT', 'Mã KPI', 'Tên chỉ tiêu KPI', 'Viễn cảnh', 'TH kỳ đánh giá', '% TH/KH kỳ', '% TH/KH năm', 'Điểm đánh giá', 'Điểm BSC (thang 5)'];

test('17.3 Xem danh sách KPI theo thẻ chỉ số', async ({ page }) => {
  await openDash(page);
  await pickUnit(page, 'VNPT Hà Nội');
  for (const [key, label] of [['achieved', 'KPI đạt/vượt'], ['notAchieved', 'KPI chưa đạt']] as const) {
    const n = await cardValue(page, key);
    await page.getByRole('button', { name: label, exact: true }).getByText('Click xem').click();
    const dlg = page.getByRole('dialog', { name: 'Danh Sách Chi Tiết Các KPI' });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText(label);
    for (const h of KPI_COLS) await expect(dlg.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
    await expect(dlg.getByTestId('kpi-list-total')).toHaveText(String(n));
    await dlg.getByRole('button', { name: 'Đóng', exact: true }).last().click();
    await expect(dlg).toHaveCount(0);
  }
});

test('17.4 Xem danh sách chi tiết các KPI', async ({ page }) => {
  await openDash(page);
  await pickUnit(page, 'VNPT Hà Nội');
  const total = await cardValue(page, 'total');
  await page.getByRole('button', { name: 'Xem Danh Sách Chi Tiết Các KPI' }).click();
  const dlg = page.getByRole('dialog', { name: 'Danh Sách Chi Tiết Các KPI' });
  for (const h of KPI_COLS) await expect(dlg.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  await expect(dlg.getByTestId('kpi-list-total')).toHaveText(String(total));
  // tìm kiếm
  await dlg.getByLabel('Từ khóa tìm kiếm').fill('TC-001');
  await dlg.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect(dlg.locator('tbody tr').first()).toContainText('TC-001');
  await expect(dlg.locator('tbody tr').filter({ hasText: 'KH-001' })).toHaveCount(0);
  // lọc viễn cảnh
  await dlg.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(dlg.getByTestId('kpi-list-total')).toHaveText(String(total));
  await dlg.getByLabel('Viễn cảnh').selectOption({ label: 'Khách hàng' });
  await expect(dlg.locator('tbody tr').first()).toContainText('Khách hàng');
  for (const t of await dlg.locator('tbody tr td:nth-child(4)').allInnerTexts()) expect(t).toBe('Khách hàng');
  await dlg.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await expect(dlg).toHaveCount(0);
});

test('17.5 Xem chi tiết KPI trọng tâm', async ({ page }) => {
  await openDash(page);
  const card = page.getByTestId('focus-card').first();
  const code = (await card.getAttribute('data-kpi'))!;
  await card.getByRole('button', { name: `Xem chi tiết ${code}` }).click();
  const dlg = page.getByRole('dialog', { name: 'Chi tiết KPI trọng tâm' });
  const d = dlg.getByTestId('focus-detail');
  await expect(d).toBeVisible();
  for (const l of ['Mã KPI', 'Tên KPI', 'Viễn cảnh', 'KH năm', 'KH giao kỳ', 'TH kỳ đánh giá', 'Điểm BSC chỉ tiêu']) await expect(d.getByText(l, { exact: true }).first()).toBeVisible();
  await expect(d).toContainText(code);
  await expect(d).toContainText('Chi tiết phân rã kết quả các đơn vị con cùng được giao KPI');
  await expect(d.getByTestId('child-count')).toContainText('số đơn vị trực thuộc');
  for (const h of ['STT', 'Tên đơn vị con', 'Giá trị TH', '% TH/KH kỳ', 'Điểm đánh giá', 'Điểm BSC chỉ tiêu (thang 5)', 'Trạng thái']) await expect(d.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  await expect(d.locator('tbody tr').first()).toBeVisible();
  await dlg.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await expect(dlg).toHaveCount(0);
  // KPI không giao cho đơn vị con → “Không có đơn vị con”
  await pickUnit(page, 'VNPT Hà Nội');
  await page.getByTestId('focus-card').first().getByRole('button', { name: /Xem chi tiết/ }).click();
  await expect(page.getByRole('dialog', { name: 'Chi tiết KPI trọng tâm' }).getByRole('status')).toHaveText('Không có đơn vị con');
});

test('17.6 Xuất kết quả đánh giá KPI', async ({ page }) => {
  await openDash(page);
  await pickUnit(page, 'VNPT Hà Nội');
  await pickPeriod(page, 'Quý II');
  const d = await download(page, page.getByRole('button', { name: 'Xuất kết quả đánh giá KPI' }));
  const { names, text } = await sheets(d);
  expect(names.length).toBeGreaterThanOrEqual(2);
  expect(text[0]).toContain('VNPT Hà Nội');
  expect(text[0]).toContain(`Quý II ${CUR}`);
  expect(text[1]).toContain('TC-001');
});

test('17.7 Xem bảng tổng hợp kết quả KPI giao cho Tổng công ty/Công ty', async ({ page }) => {
  await openDash(page);
  const corp = page.getByTestId('corporations-block');
  const btn = corp.locator('tbody tr').first().getByRole('button');
  const name = (await btn.innerText()).trim();
  await btn.click();
  const dlg = page.getByRole('dialog', { name: 'Bảng tổng hợp kết quả các KPI giao cho đơn vị' });
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText(name);
  for (const h of ['STT', 'Đơn vị thành viên', 'Tổng số KPI giao', 'KPI đạt', 'KPI cảnh báo', '% TH/KH kỳ', 'Điểm BSC đơn vị (thang 5)', 'Xếp hạng']) await expect(dlg.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  await dlg.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await expect(dlg).toHaveCount(0);
});

test('17.8 Xuất bảng tổng hợp kết quả KPI giao cho Tổng công ty/Công ty', async ({ page }) => {
  await openDash(page);
  const btn = page.getByTestId('corporations-block').locator('tbody tr').first().getByRole('button');
  const name = (await btn.innerText()).trim();
  await btn.click();
  const dlg = page.getByRole('dialog', { name: 'Bảng tổng hợp kết quả các KPI giao cho đơn vị' });
  await expect(dlg.locator('tbody tr').first()).toBeVisible();
  const d = await download(page, dlg.getByRole('button', { name: 'Xuất Bảng Excel' }));
  const { text } = await sheets(d);
  expect(text[0]).toContain(name.toUpperCase());
  for (const h of ['STT', 'Đơn vị thành viên', 'Tổng số KPI giao', 'KPI đạt', 'KPI cảnh báo', '% TH/KH kỳ', 'Điểm BSC đơn vị (thang 5)', 'Xếp hạng']) expect(text[0]).toContain(h);
  const firstMember = (await dlg.locator('tbody tr').first().locator('td').nth(1).innerText()).trim();
  expect(text[0]).toContain(firstMember);
});

// ================================ Điều hướng SiteMap ================================

test('SiteMap 1 – Tập đoàn: Năm hiện tại → Năm X → nút Quý → Quý y', async ({ page }) => {
  await openDash(page);
  await viewBtn(page, 'Năm').click();
  await settled(page);
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – Cả năm ${CUR}`);
  await pickYear(page, PREV);
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – Cả năm ${PREV}`);
  await viewBtn(page, 'Quý').click();
  await settled(page);
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – Quý I ${PREV}`);
  await pickPeriod(page, 'Quý IV');
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – Quý IV ${PREV}`);
  // năm hiện tại → nút Quý = quý hiện tại (quý gần nhất có kết quả)
  await pickYear(page, CUR);
  await viewBtn(page, 'Năm').click();
  await settled(page);
  await viewBtn(page, 'Quý').click();
  await settled(page);
  const def = await defaultPeriod(page);
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – ${['Q1', 'Q2', 'Q3', 'Q4'].includes(def.code) ? def.name : PERIOD_NAME[`Q${Math.floor(new Date().getMonth() / 3) + 1}`]} ${CUR}`);
});

test('SiteMap 2 – Tập đoàn: Giai đoạn → Giai đoạn X–Y (năm đầu) → chọn năm X trên biểu đồ → Năm/Quý', async ({ page }) => {
  await openDash(page);
  await viewBtn(page, 'Giai đoạn').click();
  await settled(page);
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – Giai đoạn 2026–2030 (đến năm ${CUR})`);
  await pickPeriod(page, 'Giai đoạn 2021–2025');
  await expect(yearSel(page)).toHaveValue('2021');
  await expect(title(page)).toHaveText('Biểu tổng hợp Tập đoàn – Giai đoạn 2021–2025 (đến năm 2021)');
  await pickYear(page, 2025);
  await expect(title(page)).toHaveText('Biểu tổng hợp Tập đoàn – Giai đoạn 2021–2025 (đến năm 2025)');
  // nhấn cột/năm trên biểu đồ giai đoạn → kỳ = năm đó
  await page.getByTestId('stage-chart').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: `Xem năm ${PREV}` }).click();
  await settled(page);
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – Cả năm ${PREV}`);
  await viewBtn(page, 'Quý').click();
  await settled(page);
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – Quý I ${PREV}`);
});

test('SiteMap 2b – Nhấn vào cột của một năm trên biểu đồ giai đoạn (onClick ECharts)', async ({ page }) => {
  await openDash(page, 'admin', `?unit=GROUP&year=${PREV}&period=GD:1`);
  const chart = page.getByTestId('stage-chart');
  await expect(chart.locator('svg').first()).toBeVisible();
  await chart.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800); // animation ECharts
  const box = (await chart.locator('svg').first().boundingBox())!;
  // 5 cột (2021–2025), cột cuối = năm trước; bấm gần đáy cột cuối
  await page.mouse.click(box.x + box.width * 0.86, box.y + box.height * 0.6);
  await settled(page);
  await expect(title(page)).toHaveText(`Biểu tổng hợp Tập đoàn – Cả năm ${PREV}`);
});

test('SiteMap 3 – Nút Bản đồ chiến lược → bản đồ của năm tương ứng; từ biểu giai đoạn cũng mở được', async ({ page }) => {
  await openDash(page, 'admin', `?unit=GROUP&year=${PREV}&period=Y`);
  await page.getByRole('button', { name: 'Xem bản đồ chiến lược' }).click();
  const dlg = page.getByRole('dialog', { name: 'Bản đồ chiến lược' });
  await expect(dlg).toContainText('Chiến lược Tập đoàn VNPT giai đoạn 2021–2025');
  await expect(page).toHaveURL(/map=true/);
  await dlg.getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await pickPeriod(page, 'Giai đoạn 2026–2030');
  await page.getByRole('button', { name: 'Xem bản đồ chiến lược' }).click();
  await expect(page.getByRole('dialog', { name: 'Bản đồ chiến lược' })).toContainText('Chiến lược phát triển Tập đoàn VNPT giai đoạn 2026–2030');
});

test('SiteMap 4 – Chọn đơn vị: Năm hiện tại ↔ Năm X ↔ Quý; Giai đoạn ↔ năm X trên biểu đồ', async ({ page }) => {
  await openDash(page);
  await pickUnit(page, 'VNPT Hà Nội');
  await viewBtn(page, 'Năm').click();
  await settled(page);
  await expect(page.getByTestId('viewing')).toContainText(`VNPT Hà Nội – Cả năm ${CUR}`);
  await pickYear(page, PREV);
  await expect(page.getByTestId('viewing')).toContainText(`VNPT Hà Nội – Cả năm ${PREV}`);
  await viewBtn(page, 'Quý').click();
  await settled(page);
  await expect(page.getByTestId('viewing')).toContainText(`VNPT Hà Nội – Quý I ${PREV}`);
  await pickPeriod(page, 'Giai đoạn 2021–2025');
  await expect(page.getByTestId('viewing')).toContainText('VNPT Hà Nội – Giai đoạn 2021–2025');
  await page.getByRole('button', { name: `Xem năm ${PREV}` }).click();
  await settled(page);
  await expect(page.getByTestId('viewing')).toContainText(`VNPT Hà Nội – Cả năm ${PREV}`);
});

test('SiteMap 5 – Chọn tỉnh: Tỉnh – Năm hiện tại → Năm X → nút Quý → Quý I năm X', async ({ page }) => {
  await openDash(page);
  await pickUnit(page, 'VNPT Đà Nẵng');
  await viewBtn(page, 'Năm').click();
  await settled(page);
  await expect(page.getByTestId('viewing')).toContainText(`VNPT Đà Nẵng – Cả năm ${CUR}`);
  await expect(page.getByTestId('viewing')).toContainText('Hạng trong khối');
  await pickYear(page, PREV);
  await expect(page.getByTestId('viewing')).toContainText(`VNPT Đà Nẵng – Cả năm ${PREV}`);
  await viewBtn(page, 'Quý').click();
  await settled(page);
  await expect(page.getByTestId('viewing')).toContainText(`VNPT Đà Nẵng – Quý I ${PREV}`);
});

// ================================ Phân quyền xem ================================

test('Phân quyền – Người dùng cấp đơn vị chỉ xem dữ liệu đơn vị mình', async ({ page }) => {
  await openDash(page, 'tinh_hni');
  await expect(content(page)).toHaveAttribute('data-mode', 'UNIT');
  await expect(page.getByTestId('viewing')).toContainText('VNPT Hà Nội');
  await expect(page.getByRole('button', { name: 'Quay lại Dashboard Tập đoàn' })).toHaveCount(0);
  await unitBtn(page).click();
  await expect(page.getByRole('treeitem', { name: GROUP_LABEL })).toHaveCount(0);
  await expect(page.getByRole('treeitem', { name: PROVINCES_LABEL })).toHaveCount(0);
  await expect(page.getByRole('treeitem', { name: /VNPT TP\. Hồ Chí Minh/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  // gõ URL Tập đoàn → quay về đơn vị mặc định; API trả 403
  await page.goto('/dashboard?unit=GROUP');
  await expect(content(page)).toHaveAttribute('data-mode', 'UNIT');
  const res = await page.request.get('/api/dashboard/overview?unit=GROUP');
  expect(res.status()).toBe(403);
});

test('Phân quyền – Lập chiến lược xem được biểu Tập đoàn và bản đồ chiến lược', async ({ page }) => {
  await openDash(page, 'lapchienluoc');
  await expect(content(page)).toHaveAttribute('data-mode', 'GROUP');
  await page.getByRole('button', { name: 'Xem bản đồ chiến lược' }).click();
  await expect(page.getByRole('dialog', { name: 'Bản đồ chiến lược' }).getByTestId('strategy-map')).toBeVisible();
});

test('P7 hiệu năng – API dashboard < 1s trên dữ liệu seed', async ({ page }) => {
  await openDash(page);
  for (const q of [`unit=GROUP&year=${CUR}&period=Q3`, `unit=PROVINCES&year=${PREV}&period=Y`, `unit=GROUP&year=${PREV}&period=GD:1`]) {
    const t0 = Date.now();
    const r = await page.request.get(`/api/dashboard/overview?${q}`);
    expect(r.ok()).toBeTruthy();
    expect(Date.now() - t0).toBeLessThan(1000);
  }
  const t0 = Date.now();
  expect((await page.request.get(`/api/dashboard/ranking-provinces?year=${PREV}&period=Y&all=true`)).ok()).toBeTruthy();
  expect(Date.now() - t0).toBeLessThan(1000);
});
