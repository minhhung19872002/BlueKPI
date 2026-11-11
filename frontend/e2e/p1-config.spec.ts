import { expect, test, type Page } from '@playwright/test';
import { expectErrorToast, expectToast, login, row, rowAction, searchKeyword, uid } from './helpers';

async function openTab(page: Page, tab: string, label: string) {
  await login(page, 'admin');
  await page.goto(`/system?tab=${tab}`);
  await expect(page.getByRole('tab', { name: label })).toHaveAttribute('data-state', 'active');
}

test('26.17 Lấy danh sách – Lịch đồng bộ', async ({ page }) => {
  await openTab(page, 'schedules', 'Lịch đồng bộ');
  await expect(page.getByRole('heading', { name: 'Danh sách lịch đồng bộ' })).toBeVisible();
  const head = page.getByRole('table', { name: 'Danh sách lịch đồng bộ' }).locator('thead');
  for (const h of ['STT', 'Mã lịch', 'Tên lịch', 'Loại công việc', 'Lịch chạy', 'Trạng thái', 'Lần chạy gần nhất', 'Kết quả lần chạy', 'Lần chạy tiếp theo']) {
    await expect(head.getByText(h, { exact: true })).toBeVisible();
  }
  await expect(row(page, 'Đồng bộ kết quả KPI')).toContainText('01:00 hằng ngày');
  await expect(row(page, 'Hoàn tất chiến lược')).toContainText('00:30 ngày 01/01 hằng năm');
  await expect(row(page, 'Nhắc hạn cập nhật kết quả')).toContainText('08:00 hằng ngày');
  await expect(row(page, 'Tính lại điểm BSC')).toContainText('Tắt');
  await expect(row(page, 'Đồng bộ HRM')).toContainText('Tắt');
  await expect(row(page, 'Sao lưu logic dữ liệu')).toContainText('03:00 hằng tuần (Chủ nhật)');
});

test('26.18 Xem chi tiết – Lịch đồng bộ', async ({ page }) => {
  await openTab(page, 'schedules', 'Lịch đồng bộ');
  await rowAction(page, 'Đồng bộ HRM', 'Chạy ngay');
  await expectToast(page, 'Đã gửi yêu cầu chạy lịch');
  await rowAction(page, 'Đồng bộ HRM', 'Xem');
  const d = page.getByRole('dialog', { name: 'Thông tin lịch đồng bộ' });
  await expect(d.getByText('20 lần chạy gần nhất')).toBeVisible();
  await expect(d.getByRole('table', { name: 'Lịch sử chạy' })).toContainText('Tích hợp HRM đang tắt', { timeout: 20_000 });
  await expect(d.getByRole('table', { name: 'Lịch sử chạy' })).toContainText('Người dùng (admin)');
});

test('26.19 Ghi lại – Lịch đồng bộ', async ({ page }) => {
  await openTab(page, 'schedules', 'Lịch đồng bộ');
  await rowAction(page, 'Tính lại điểm BSC', 'Sửa');
  const dlg = page.getByRole('dialog', { name: 'Sửa lịch đồng bộ' });
  await dlg.getByLabel('Lịch chạy').selectOption({ label: 'Hằng tuần' });
  await dlg.getByLabel('Giờ chạy').fill('22:15');
  await dlg.getByLabel('Thứ').selectOption({ label: 'Thứ Sáu' });
  await expect(dlg).toContainText('0 15 22 ? * FRI');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(row(page, 'Tính lại điểm BSC')).toContainText('22:15 hằng tuần (Thứ Sáu)');
  // cron nâng cao + bật → có lần chạy tiếp theo (reschedule Quartz ngay)
  await rowAction(page, 'Tính lại điểm BSC', 'Sửa');
  await dlg.getByLabel('Lịch chạy').selectOption({ label: 'Nhập cron nâng cao' });
  await dlg.getByLabel('Cron nâng cao (Quartz)').fill('0 0 2 1 1 ? 2099');
  await dlg.getByRole('switch').click();
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(row(page, 'Tính lại điểm BSC')).toContainText('Bật');
  await expect(row(page, 'Tính lại điểm BSC')).toContainText('01/01/2099 02:00');
  // cron sai
  await rowAction(page, 'Tính lại điểm BSC', 'Sửa');
  await dlg.getByLabel('Cron nâng cao (Quartz)').fill('sai cron');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Lịch chạy (cron) không hợp lệ')).toBeVisible();
  await dlg.getByLabel('Lịch chạy').selectOption({ label: 'Hằng ngày' });
  await dlg.getByRole('switch').click();
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
});

test('26.20 Lấy danh sách – Tham số hệ thống', async ({ page }) => {
  await openTab(page, 'sys-configs', 'Tham số hệ thống');
  await expect(page.getByRole('heading', { name: 'Danh sách tham số hệ thống' })).toBeVisible();
  const head = page.getByRole('table', { name: 'Danh sách tham số hệ thống' }).locator('thead');
  for (const h of ['STT', 'Mã tham số', 'Giá trị', 'Kiểu dữ liệu', 'Nhóm', 'Mô tả', 'Người cập nhật', 'Ngày cập nhật']) await expect(head.getByText(h, { exact: true })).toBeVisible();
  for (const k of ['KPI_PASS_SCORE', 'KPI_WARNING_RATE', 'KPI_COMPLETION_CAP', 'UPLOAD_MAX_MB', 'LOGIN_MAX_FAILED', 'LOGIN_LOCK_MINUTES', 'DASHBOARD_DEFAULT_PERIOD']) {
    await searchKeyword(page, k);
    await expect(row(page, k)).toBeVisible();
  }
});

test('26.21 Xem chi tiết – Tham số hệ thống', async ({ page }) => {
  await openTab(page, 'sys-configs', 'Tham số hệ thống');
  await searchKeyword(page, 'KPI_PASS_SCORE');
  await rowAction(page, 'KPI_PASS_SCORE', 'Xem');
  const d = page.getByRole('dialog', { name: 'Thông tin tham số hệ thống' });
  await expect(d).toContainText('KPI_PASS_SCORE');
  await expect(d).toContainText('Tham số lõi');
});

test('26.22 Thêm mới – Tham số hệ thống', async ({ page }) => {
  await openTab(page, 'sys-configs', 'Tham số hệ thống');
  const key = uid('TS_').toUpperCase();
  await page.getByRole('button', { name: 'Thêm tham số' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm tham số' });
  await dlg.getByLabel('Mã tham số').fill(key);
  await dlg.getByLabel('Kiểu dữ liệu').selectOption({ label: 'Số' });
  await dlg.getByRole('textbox', { name: 'Giá trị', exact: true }).fill('abc');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expect(dlg.getByText('Giá trị phải là số')).toBeVisible();
  await dlg.getByRole('textbox', { name: 'Giá trị', exact: true }).fill('42');
  await dlg.getByLabel('Nhóm').fill('TEST');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
  await searchKeyword(page, key);
  await expect(row(page, key)).toContainText('42');
});

test('26.23 Ghi lại – Tham số hệ thống', async ({ page }) => {
  await openTab(page, 'sys-configs', 'Tham số hệ thống');
  await searchKeyword(page, 'REMIND_DAYS_BEFORE_DEADLINE');
  await rowAction(page, 'REMIND_DAYS_BEFORE_DEADLINE', 'Sửa');
  const dlg = page.getByRole('dialog', { name: 'Sửa tham số' });
  await dlg.getByRole('textbox', { name: 'Giá trị', exact: true }).fill('6');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
  await expect(row(page, 'REMIND_DAYS_BEFORE_DEADLINE')).toContainText('6');
  await rowAction(page, 'REMIND_DAYS_BEFORE_DEADLINE', 'Sửa');
  await dlg.getByRole('textbox', { name: 'Giá trị', exact: true }).fill('5');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Cập nhật thành công');
});

test('26.24 Xóa – Tham số hệ thống', async ({ page }) => {
  await openTab(page, 'sys-configs', 'Tham số hệ thống');
  const key = uid('XOA_').toUpperCase();
  await page.getByRole('button', { name: 'Thêm tham số' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm tham số' });
  await dlg.getByLabel('Mã tham số').fill(key);
  await dlg.getByRole('textbox', { name: 'Giá trị', exact: true }).fill('tam');
  await dlg.getByRole('button', { name: 'Lưu' }).click();
  await expectToast(page, 'Thêm mới thành công');
  await searchKeyword(page, key);
  await rowAction(page, key, 'Xóa');
  await page.getByTestId('confirm-ok').click();
  await expectToast(page, 'Xóa thành công');
  // tham số lõi: không có nút Xóa
  await searchKeyword(page, 'KPI_PASS_SCORE');
  await expect(row(page, 'KPI_PASS_SCORE').getByRole('button', { name: 'Xóa' })).toHaveCount(0);
  void expectErrorToast;
});
