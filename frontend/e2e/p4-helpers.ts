import { expect, type Page } from '@playwright/test';
import { login, row, searchKeyword } from './helpers';

/** Mở “Đánh giá KPI” ở tab chỉ định */
export async function openEval(page: Page, tab: 'kpi' | 'review' = 'kpi', user = 'admin') {
  await login(page, user);
  await page.goto(`/kpi-admin/evaluations?tab=${tab}`);
  await expect(page.getByRole('heading', { name: 'Đánh giá KPI', exact: true })).toBeVisible();
  const name = tab === 'kpi' ? 'Tổng hợp BSC theo chỉ tiêu KPI' : 'Theo dõi kết quả thẩm định và phản hồi';
  await expect(page.getByRole('tab', { name })).toHaveAttribute('data-state', 'active');
}

/** Lọc tab “Tổng hợp BSC theo chỉ tiêu KPI” theo mã KPI + kỳ */
export async function findEvalKpi(page: Page, code: string, period: string) {
  await page.getByRole('combobox', { name: 'Kỳ đánh giá', exact: true }).selectOption({ label: period });
  await searchKeyword(page, code);
  const r = row(page, `${code} –`);
  await expect(r).toContainText(period);
  return r;
}

/** Mở màn hình đánh giá (nút “Đánh giá”) cho KPI-kỳ */
export async function openEvalEdit(page: Page, code: string, period: string, action: 'Đánh giá' | 'Xem' = 'Đánh giá') {
  await openEval(page, 'kpi');
  const r = await findEvalKpi(page, code, period);
  await r.getByRole('button', { name: action, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cập nhật kết quả KPI cho tất cả đơn vị' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Danh sách đơn vị được giao' }).locator('tbody tr').first()).toBeVisible();
}

/** Dòng lưới có ô bằng đúng mã đơn vị (tránh khớp đơn vị con VNPT_HNI_xxx) */
export function unitRow(page: Page, code: string) {
  return page.locator('tbody tr').filter({ has: page.getByRole('cell', { name: code, exact: true }) }).first();
}

/** Nút “Đóng” của trang (không lẫn nút đóng toast) */
export function closeBtn(page: Page) {
  return page.getByRole('button', { name: 'Đóng', exact: true }).first();
}

/** Lọc tab “Theo dõi kết quả thẩm định và phản hồi” */
export async function filterReview(page: Page, opts: { keyword?: string; period?: string; status?: string }) {
  if (opts.period) await page.getByRole('combobox', { name: 'Kỳ đánh giá', exact: true }).selectOption({ label: opts.period });
  await page.getByRole('combobox', { name: 'Trạng thái', exact: true }).selectOption(opts.status ? { label: opts.status } : { index: 0 });
  const kw = opts.keyword ?? '';
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/evaluations/review?') && decodeURIComponent(r.url()).includes(kw ? `keyword=${kw}` : '')),
    searchKeyword(page, kw),
  ]);
}

/** Mở “KPI đơn vị của tôi” */
export async function openMyKpi(page: Page, user = 'tinh_hni', query = '') {
  await login(page, user);
  await page.goto(`/my-kpi${query}`);
  await expect(page.getByRole('heading', { name: 'KPI đơn vị của tôi', exact: true })).toBeVisible();
}

export const PDF = { name: 'minh-chung.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%e2e\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF') };
export const PNG = {
  name: 'anh.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
};

/** Dòng lưới “Theo dõi kết quả thẩm định” theo mã đơn vị + mã KPI (tránh bấm nhầm dòng cũ khi đang tải) */
export function reviewRow(page: Page, unitCode: string, kpiCode: string) {
  return page.locator('tbody tr').filter({ hasText: `${unitCode} – ` }).filter({ hasText: `${kpiCode} – ` }).first();
}
