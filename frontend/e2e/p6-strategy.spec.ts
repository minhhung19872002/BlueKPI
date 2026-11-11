import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectErrorToast, expectToast, login, pickSearch, pickTree, row, uid } from './helpers';

test.describe.configure({ mode: 'serial' });

const NAME = `Chiến lược E2E ${uid('')}`;
let code = '';

async function openList(page: Page) {
  await login(page);
  await page.goto('/kpi-admin/strategies');
  await expect(page.getByRole('heading', { level: 1, name: 'Quản lý bản đồ chiến lược' })).toBeVisible();
}

async function search(page: Page, kw: string) {
  await page.getByLabel('Từ khóa tìm kiếm').fill(kw);
  await page.getByLabel('Từ khóa tìm kiếm').press('Enter');
}

async function openEdit(page: Page) {
  await openList(page);
  await search(page, code);
  await row(page, code).getByRole('button', { name: 'Sửa', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cập nhật chiến lược' })).toBeVisible();
  await expect(page.getByTestId('strategy-map')).toBeVisible();
}

const node = (page: Page, c: string) => page.locator(`[data-testid="objective-node"][data-code="${c}"]`);

async function save(page: Page) {
  await page.getByRole('toolbar', { name: 'Thanh công cụ bản đồ' }).getByRole('button', { name: 'Lưu', exact: true }).click();
  await expectToast(page, 'Lưu bản đồ chiến lược thành công');
  await expect(page.getByText('Có thay đổi chưa lưu')).toHaveCount(0);
}

async function addObjective(page: Page, c: string) {
  await page.getByRole('button', { name: 'Cập nhật mục tiêu trọng tâm' }).click();
  const dlg = page.getByRole('dialog', { name: 'Tìm kiếm mục tiêu trọng tâm đặt vào chiến lược' });
  await dlg.getByLabel('Từ khóa tìm kiếm mục tiêu').fill(c);
  await dlg.getByLabel('Từ khóa tìm kiếm mục tiêu').press('Enter');
  const r = dlg.locator('tbody tr').filter({ hasText: c });
  await expect(r).toHaveCount(1);
  await r.getByLabel('Chọn dòng').check();
  await dlg.getByRole('button', { name: 'Thêm vào chiến lược' }).click();
  await expect(dlg).toHaveCount(0);
  await expect(node(page, c)).toBeVisible();
}

async function center(l: Locator) {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Kéo từ handle nguồn đến handle đích (chế độ vẽ liên kết) */
async function connect(page: Page, from: string, fromHandle: string, to: string, toHandle: string) {
  await page.getByTestId('strategy-map').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  const a = await center(node(page, from).locator(`.react-flow__handle-${fromHandle}`));
  const b = await center(node(page, to).locator(`.react-flow__handle-${toHandle}`));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

// ================================ 36.x ================================

test('36.1 Lấy danh sách – Bản đồ chiến lược', async ({ page }) => {
  await openList(page);
  const t = page.getByRole('table', { name: 'Danh sách chiến lược' });
  for (const h of ['STT', 'Mã – Tên chiến lược', 'Giai đoạn', 'Trạng thái', 'Chủ trì', 'Đơn vị', 'Ngày cập nhật']) await expect(t.locator('thead').getByText(h, { exact: true })).toBeVisible();
  await expect(row(page, 'Chiến lược phát triển Tập đoàn VNPT giai đoạn 2026–2030')).toContainText('Đang thực hiện');
  await expect(row(page, 'Chiến lược Tập đoàn VNPT giai đoạn 2021–2025')).toContainText('Hoàn thành');
  await expect(row(page, 'VNPT Hà Nội giai đoạn 2026–2030')).toContainText('VNPT Hà Nội');
  // chỉ “Đang thực hiện” mới được Sửa / Xóa
  const done = row(page, 'Chiến lược Tập đoàn VNPT giai đoạn 2021–2025');
  await expect(done.getByRole('button', { name: 'Sửa', exact: true })).toHaveCount(0);
  await expect(done.getByRole('button', { name: 'Xóa', exact: true })).toHaveCount(0);
  await expect(done.getByRole('button', { name: 'Xem', exact: true })).toBeVisible();
});

test('36.2 Tìm kiếm – Bản đồ chiến lược', async ({ page }) => {
  await openList(page);
  await search(page, 'Hà Nội');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(row(page, 'Hà Nội')).toContainText('CL-');
  await search(page, '');
  await page.getByRole('combobox', { name: 'Trạng thái' }).selectOption({ label: 'Hoàn thành' });
  await search(page, '');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(row(page, 'giai đoạn 2021–2025')).toBeVisible();
  // khoảng thời gian giao với giai đoạn
  await page.getByRole('combobox', { name: 'Trạng thái' }).selectOption({ label: 'Tất cả' });
  await page.getByRole('combobox', { name: 'Từ năm' }).selectOption('2027');
  await page.getByRole('combobox', { name: 'Đến năm' }).selectOption('2028');
  await search(page, '');
  await expect(row(page, 'Tập đoàn VNPT giai đoạn 2026–2030')).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: '2021–2025' })).toHaveCount(0);
  // đơn vị
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await pickTree(page, 'Đơn vị', 'VNPT Hà Nội');
  await search(page, '');
  await expect(page.locator('tbody tr')).toHaveCount(1);
});

test('36.3 Xem chi tiết – Bản đồ chiến lược', async ({ page }) => {
  await openList(page);
  await search(page, 'Tập đoàn VNPT giai đoạn 2026–2030');
  await row(page, '2026–2030').getByRole('button', { name: 'Xem', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Xem chi tiết chiến lược' })).toBeVisible();
  await expect(page.getByText('Chiến lược phát triển Tập đoàn VNPT giai đoạn 2026–2030').first()).toBeVisible();
  await expect(page.getByTestId('lane')).toHaveCount(4);
  await expect(page.getByTestId('objective-node')).toHaveCount(16);
  await expect(page.locator('.react-flow__edge')).toHaveCount(13);
  await expect(node(page, 'MT-TC-01').getByTestId('kpi-count')).toContainText('KPI');
  // readonly: không có công cụ sửa
  for (const b of ['Lưu', 'Vẽ liên kết', 'Cập nhật mục tiêu trọng tâm', 'Giao KPI']) await expect(page.getByRole('button', { name: b, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xóa mục tiêu MT-TC-01' })).toHaveCount(0);
});

test('36.4 Thêm mới – Bản đồ chiến lược', async ({ page }) => {
  await openList(page);
  await page.getByRole('button', { name: 'Thêm chiến lược' }).click();
  const dlg = page.getByRole('dialog', { name: 'Thêm chiến lược' });
  await dlg.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(dlg.getByText('Vui lòng nhập Tên chiến lược')).toBeVisible();
  await expect(dlg.getByText('Vui lòng chọn Giai đoạn')).toBeVisible();
  await expect(dlg.getByText('Vui lòng chọn Đơn vị')).toBeVisible();
  await expect(dlg.getByText('Vui lòng chọn Chủ trì')).toBeVisible();
  await dlg.getByLabel('Tên chiến lược').fill(NAME);
  await dlg.getByLabel('Giai đoạn').selectOption({ label: 'Giai đoạn 2026–2030' });
  await pickTree(page, 'Đơn vị', 'VNPT Hà Nội');
  await pickSearch(page, 'Chủ trì', 'tinh_hni');
  await dlg.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expectToast(page, 'Thêm mới thành công');
  await expect(page.getByRole('heading', { level: 1, name: 'Cập nhật chiến lược' })).toBeVisible();
  const yyyy = new Date().getFullYear();
  const c = page.getByText(new RegExp(`^CL-${yyyy}-\\d{3}$`));
  await expect(c).toBeVisible();
  code = (await c.textContent())!.trim();
  await openList(page);
  await search(page, code);
  await expect(row(page, code)).toContainText(NAME);
  await expect(row(page, code)).toContainText('Đang thực hiện');
});

test('37.1 Cập nhật mục tiêu trọng tâm trên bản đồ chiến lược', async ({ page }) => {
  await openEdit(page);
  await expect(page.getByTestId('lane')).toHaveCount(4);
  await addObjective(page, 'MT-TC-01');
  await addObjective(page, 'MT-KH-01');
  await addObjective(page, 'MT-QT-01');
  // node nằm ở dải viễn cảnh tương ứng: TC trên KH trên QT
  const y = async (c: string) => (await node(page, c).boundingBox())!.y;
  expect(await y('MT-TC-01')).toBeLessThan(await y('MT-KH-01'));
  expect(await y('MT-KH-01')).toBeLessThan(await y('MT-QT-01'));
  // mục tiêu đã có trên bản đồ → disabled
  await page.getByRole('button', { name: 'Cập nhật mục tiêu trọng tâm' }).click();
  const dlg = page.getByRole('dialog', { name: 'Tìm kiếm mục tiêu trọng tâm đặt vào chiến lược' });
  for (const h of ['STT', 'Mã – Tên mục tiêu trọng tâm', 'Mô tả', 'Viễn cảnh']) await expect(dlg.locator('thead').getByText(h, { exact: true })).toBeVisible();
  await dlg.getByLabel('Viễn cảnh').selectOption({ label: 'Tài chính' });
  await dlg.getByRole('button', { name: 'Tìm kiếm' }).click();
  const r = dlg.locator('tbody tr').filter({ hasText: 'MT-TC-01' });
  await expect(r).toContainText('đã có trên bản đồ');
  await expect(r.getByLabel('Chọn dòng')).toBeDisabled();
  await dlg.getByRole('button', { name: 'Hủy' }).click();
  await save(page);
  await page.reload();
  await expect(page.getByTestId('objective-node')).toHaveCount(3);
});

test('37.2 Vẽ liên kết giữa các mục tiêu trọng tâm', async ({ page }) => {
  await openEdit(page);
  await expect(page.getByText('Kéo từ handle trên node để nối liên kết giữa các mục tiêu')).toHaveCount(0);
  await page.getByRole('button', { name: 'Vẽ liên kết' }).click();
  await expect(page.getByText('Kéo từ handle trên node để nối liên kết giữa các mục tiêu')).toBeVisible();
  await expect(node(page, 'MT-KH-01').locator('.react-flow__handle-top')).toBeVisible();
  await connect(page, 'MT-KH-01', 'top', 'MT-TC-01', 'bottom');
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await connect(page, 'MT-QT-01', 'top', 'MT-KH-01', 'bottom');
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  // cấm trùng
  await connect(page, 'MT-TC-01', 'bottom', 'MT-KH-01', 'top');
  await expectErrorToast(page, 'Liên kết giữa hai mục tiêu đã tồn tại');
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await save(page);
  await page.reload();
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
});

test('37.6 Xóa liên kết giữa các mục tiêu trọng tâm', async ({ page }) => {
  await openEdit(page);
  await expect(page.getByRole('button', { name: 'Xóa liên kết' })).toBeDisabled();
  await page.getByTestId('strategy-map').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  const edge = page.locator('.react-flow__edge').first();
  await edge.locator('.react-flow__edge-interaction').click({ force: true });
  await expect(page.locator('.react-flow__edge.edge-selected')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Xóa liên kết' })).toBeEnabled();
  await page.getByRole('button', { name: 'Xóa liên kết' }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await save(page);
  await page.reload();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
});

test('38.1 Gán khung KPI vào chiến lược', async ({ page }) => {
  await openEdit(page);
  await expect(node(page, 'MT-TC-01').getByTestId('kpi-count')).toHaveText('0 KPI');
  await page.getByRole('button', { name: 'Giao KPI', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Giao KPI' });
  await dlg.getByRole('option', { name: /MT-TC-01/ }).click();
  const grid = dlg.getByRole('table', { name: 'Danh sách tiêu chí KPI' });
  await expect(grid.locator('tbody tr').first()).toBeVisible();
  // mặc định lọc theo mục tiêu tương ứng
  for (const t of await grid.locator('tbody tr').allInnerTexts()) expect(t).toContain('MT-TC-01');
  await grid.getByLabel('Chọn TC-001').check();
  await dlg.getByRole('option', { name: /MT-KH-01/ }).click();
  await grid.locator('tbody tr').first().getByRole('checkbox').check();
  await dlg.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(node(page, 'MT-TC-01').getByTestId('kpi-count')).toHaveText('1 KPI');
  await expect(node(page, 'MT-TC-01')).toContainText('TC-001');
  await expect(node(page, 'MT-KH-01').getByTestId('kpi-count')).toHaveText('1 KPI');
  await save(page);
  await page.reload();
  await expect(node(page, 'MT-TC-01')).toContainText('TC-001');
});

test('37.4 Xem KPI của mục tiêu trọng tâm trên bản đồ', async ({ page }) => {
  await openList(page);
  await search(page, 'Tập đoàn VNPT giai đoạn 2026–2030');
  await row(page, '2026–2030').getByRole('button', { name: 'Xem', exact: true }).click();
  await page.getByRole('button', { name: 'Xem KPI của mục tiêu MT-TC-01' }).click();
  const dlg = page.getByRole('dialog', { name: 'KPI của mục tiêu MT-TC-01' });
  const t = dlg.getByRole('table', { name: 'Danh sách KPI thuộc mục tiêu' });
  for (const h of ['Mã – Tên KPI', 'Mục tiêu', 'Kết quả', 'Kỳ đánh giá']) await expect(t.locator('thead').getByText(h, { exact: true })).toBeVisible();
  const r = t.locator('tbody tr').filter({ hasText: 'TC-001' });
  await expect(r).toContainText(/Quý (I|II|III|IV) \d{4}|6 tháng đầu năm \d{4}/);
  await expect(r).toContainText(/\d+,\d{2}/);
});

test('37.5 Tải ảnh bản đồ chiến lược', async ({ page }) => {
  await openEdit(page);
  await page.getByRole('button', { name: 'Tải ảnh bản đồ' }).click();
  const dlg = page.getByRole('dialog', { name: 'Xem trước ảnh bản đồ chiến lược' });
  const img = dlg.getByRole('img', { name: 'Ảnh bản đồ chiến lược' });
  await expect(img).toBeVisible();
  expect(await img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  const [d] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Tải xuống' }).click()]);
  expect(d.suggestedFilename()).toBe(`BanDoChienLuoc_${code}.png`);
});

test('37.3 Xóa mục tiêu trọng tâm khỏi bản đồ', async ({ page }) => {
  await openEdit(page);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await page.getByRole('button', { name: 'Xóa mục tiêu MT-KH-01' }).click();
  await expect(node(page, 'MT-KH-01')).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  // rời trang khi chưa lưu → cảnh báo
  await page.getByRole('button', { name: 'Quay lại' }).click();
  const warn = page.getByRole('alertdialog').or(page.getByRole('dialog', { name: 'Thay đổi chưa được lưu' }));
  await expect(warn).toContainText('Bản đồ chiến lược còn thay đổi chưa lưu');
  await warn.getByRole('button', { name: 'Hủy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cập nhật chiến lược' })).toBeVisible();
  await save(page);
  await page.reload();
  await expect(page.getByTestId('objective-node')).toHaveCount(2);
  await expect(node(page, 'MT-KH-01')).toHaveCount(0);
});

test('36.5 Ghi lại – Bản đồ chiến lược', async ({ page }) => {
  await openEdit(page);
  await page.getByLabel('Tên chiến lược').fill(`${NAME} (sửa)`);
  await page.getByLabel('Năm', { exact: true }).selectOption('2028');
  await save(page);
  await openList(page);
  await search(page, code);
  await expect(row(page, code)).toContainText(`${NAME} (sửa)`);
  // tên bắt buộc
  await row(page, code).getByRole('button', { name: 'Sửa', exact: true }).click();
  await page.getByLabel('Tên chiến lược').fill('');
  await page.getByRole('toolbar', { name: 'Thanh công cụ bản đồ' }).getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Vui lòng nhập Tên chiến lược')).toBeVisible();
});

test('36.6 Xóa – Bản đồ chiến lược', async ({ page }) => {
  await openList(page);
  await search(page, code);
  await row(page, code).getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(page.getByRole('alertdialog').or(page.getByRole('dialog')).first()).toContainText('Bản đồ, liên kết và khung KPI của chiến lược cũng bị xóa.');
  await page.getByTestId('confirm-ok').click();
  await expectToast(page, 'Xóa thành công');
  await expect(page.locator('tbody tr').filter({ hasText: code })).toHaveCount(0);
});
