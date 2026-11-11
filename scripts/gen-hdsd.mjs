// Sinh docs/HDSD/<phan-he>.md: hướng dẫn thao tác từng phân hệ + ảnh chụp màn hình Playwright.
// Bước 1 (ảnh): cd frontend && DOCS=1 E2E_SKIP_BUILD=1 npx playwright test e2e/hdsd-screens.spec.ts   → docs/HDSD/img/*.png + index.json
// Bước 2:       node scripts/gen-hdsd.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dir = join(root, 'docs/HDSD');
mkdirSync(dir, { recursive: true });
const idxPath = join(dir, 'img/index.json');
const shots = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, 'utf8')) : [];
const imgs = (screen) => shots.filter((s) => s.screen === screen);
const img = (s) => `![${s.tab ?? s.screen}](img/${s.file})`;

const MODULES = [
  {
    file: '01-dang-nhap-he-thong.md',
    title: 'Đăng nhập, đăng xuất và giao diện chung',
    screens: ['Đăng nhập', 'Thông tin cá nhân', 'Thông báo'],
    stt: '1.1, 1.2, 2.1, 54.1',
    body: `
## Đăng nhập (STT 1.1, 1.2)
1. Mở địa chỉ hệ thống (ví dụ \`https://kpi.vnpt.vn\`) → màn hình **Đăng nhập**.
2. Cách 1 – tài khoản nội bộ: nhập “Tên đăng nhập”, “Mật khẩu” → nhấn **“Đăng nhập”**.
3. Cách 2 – VNPT SSO: nhấn **“Đăng nhập bằng VNPT SSO”** → đăng nhập trên trang CAS của VNPT → hệ thống tự quay lại trang “Dashboard TGĐ BSC”.
4. Sai mật khẩu nhiều lần (mặc định 5 lần) tài khoản bị khóa tạm 15 phút. Tài khoản “Khóa”/“Ngưng hoạt động” không đăng nhập được, hệ thống hiển thị lý do.

## Giao diện chung
- **Thanh trên**: tên hệ thống, chuông **thông báo** (số chưa đọc; “Đánh dấu tất cả đã đọc”, “Xem tất cả”), menu người dùng (Thông tin cá nhân, Đăng xuất).
- **Menu trái**: chỉ hiện các chức năng được phân quyền. **Breadcrumb** cho biết vị trí hiện tại.
- Lưới dữ liệu: tìm kiếm đa tiêu chí, phân trang, sắp xếp theo cột; nút “Thêm mới”, “Sửa”, “Xóa” (luôn có hộp thoại xác nhận), “Nhập dữ liệu”, “Xuất dữ liệu”.
- Thao tác thành công hiện thông báo xanh (ví dụ “Thêm mới thành công”); thất bại hiện lý do; nhập thiếu/sai báo lỗi ngay tại trường.

## Đăng xuất (STT 2.1)
Menu người dùng → **“Đăng xuất”**. Phiên làm việc bị thu hồi; nếu đăng nhập bằng SSO, hệ thống chuyển về trang đăng nhập.
`,
  },
  {
    file: '02-dashboard-tgd-bsc.md',
    title: 'Dashboard TGĐ BSC',
    screens: ['Dashboard TGĐ BSC'],
    stt: '6.1 – 17.8',
    body: `
## Bộ lọc (STT 17.1, 17.2)
- Vào menu **“Dashboard TGĐ BSC”**: hệ thống mở theo mặc định – đơn vị cao nhất trong phạm vi, năm hiện tại, kỳ đánh giá gần nhất đã có kết quả.
- **“Đơn vị”**: “1. Công ty mẹ – Tập đoàn”, “Khối VNPT tỉnh/thành phố” hoặc một đơn vị cụ thể. **“Năm”**. **“Kỳ đánh giá”**: “Cả năm”, “Quý I”…“Quý IV”, “6 tháng đầu năm”, các “Giai đoạn”.
- Nút nhanh **Năm / Quý / Giai đoạn** đi theo sơ đồ điều hướng (SiteMap). Đổi bộ lọc → toàn bộ số liệu được truy vấn lại.

## Các khối số liệu
- 4 thẻ **“Tổng số KPI giao”, “KPI đạt/vượt”, “KPI chưa đạt”, “KPI đang theo dõi”** kèm tỷ lệ so với kỳ trước; nhấn **“Click xem”** → “Danh Sách Chi Tiết Các KPI” của thẻ (17.3).
- **“Điểm BSC tổng hợp”** (thang 5) kèm điểm kỳ trước.
- **“Chỉ đạo trọng tâm”**: thẻ các KPI trọng tâm (“TH kỳ đánh giá”, “% TH/KH kỳ”, “% TH/KH năm”); **“Xem chi tiết”** → chi tiết và phân rã theo đơn vị con (17.5); **“Xem Danh Sách Chi Tiết Các KPI”** → toàn bộ KPI, có tìm kiếm và lọc viễn cảnh (17.4).
- Cấp Tập đoàn: **“Bảng xếp hạng điểm BSC khối VNPT tỉnh/thành phố”** (top 10, “Xem tất cả”; “Xem” → dashboard đơn vị – 16.1) và **“Điểm BSC các Tổng công ty/Công ty”** (nhấn đơn vị → bảng tổng hợp đơn vị thành viên, “Xuất Bảng Excel” – 17.7, 17.8).
- Ở chế độ đơn vị có dòng “Đang xem: <Đơn vị> – <Kỳ>” và nút **“Quay lại Dashboard Tập đoàn”** (16.2).
- “Khối VNPT tỉnh/thành phố”: bảng xếp hạng toàn bộ tỉnh và biểu đồ điểm BSC (12.1, 13.1). Một tỉnh + giai đoạn: biểu đồ và bảng kết quả qua các kỳ (14.1).
- Kỳ “Giai đoạn”: biểu đồ điểm BSC theo năm; **nhấn vào cột một năm** → chuyển sang kết quả cả năm đó (8.1, 11.1).

## Nút trên thanh công cụ
- **“Xuất kết quả đánh giá KPI”** → tải file xlsx (sheet tổng hợp + sheet chi tiết KPI) theo bộ lọc đang chọn (17.6).
- **“Xem bản đồ chiến lược”** → bản đồ chiến lược chỉ đọc của đơn vị/năm (15.1); bấm ▾ trên mục tiêu để xem KPI kèm kết quả.
`,
  },
  {
    file: '03-kpi-don-vi-cua-toi.md',
    title: 'KPI đơn vị của tôi',
    screens: ['KPI đơn vị của tôi'],
    stt: '18 – 22',
    body: `
1. Menu **“KPI đơn vị của tôi”** → danh sách KPI được giao cho đơn vị theo năm/kỳ (18.x), lọc theo năm, kỳ, viễn cảnh, trạng thái.
2. **Xem chi tiết** một KPI: kế hoạch, kết quả, % TH/KH, điểm, dòng thời gian trạng thái (19.x).
3. **“Đề nghị điều chỉnh”** (21.1): khi không đồng ý với kết quả, nhập giá trị đề nghị, lý do, đính kèm minh chứng → **“Gửi”**. Trạng thái chuyển “ĐV đề nghị điều chỉnh”, người thẩm định nhận thông báo.
4. Theo dõi kết quả xử lý đề nghị và kết quả chốt kỳ (20.x, 22.1).
`,
  },
  {
    file: '04-danh-muc-kpi.md',
    title: 'Quản trị KPI – Danh mục chỉ tiêu KPI, mục tiêu trọng tâm',
    screens: ['Danh mục chỉ tiêu KPI', 'Quản lý mục tiêu trọng tâm'],
    stt: '23 – 28',
    body: `
## Danh mục chỉ tiêu KPI (STT 23)
- Menu **“Quản trị KPI” → “Danh mục chỉ tiêu KPI”**. Lưới dạng cây KPI cha – con; tìm theo mã/tên, viễn cảnh, mục tiêu, trạng thái.
- **“Thêm tiêu chí”** (24.1 KPI đơn lẻ, 25.1 KPI cha – con): chọn “Cấu trúc tiêu chí”, nhập tên, viễn cảnh, mục tiêu trọng tâm, loại số liệu giao, phương pháp tính điểm, cách tính kết quả Tập đoàn, đơn vị/cán bộ giao và đánh giá, đơn vị đo, công thức (**“Kiểm tra biểu thức”**). Mã tiêu chí tự sinh theo viễn cảnh (ví dụ TC-001, KPI con TC-001.01).
- **Sửa / Xóa**: KPI đã giao không đổi được cấu trúc; KPI đang được tham chiếu (đã giao, gắn chiến lược) không xóa được – hệ thống báo lý do. Xóa KPI cha sẽ hỏi xác nhận xóa cả KPI con.
- **“Nhập dữ liệu”** từ file mẫu, **“Xuất dữ liệu”** ra Excel.

## Các danh mục khác (tab, STT 26.x, 27.x)
“Đơn vị đo”, “Viễn cảnh”, “Phương pháp tính điểm”, “Định nghĩa KPI công thức” (thành phần hằng số/API, nút test API), “Nguồn dữ liệu” – cùng mẫu thao tác Thêm mới / Sửa / Xóa / Tìm kiếm / Nhập / Xuất.

## Quản lý mục tiêu trọng tâm (STT 28)
Menu **“Quản lý mục tiêu trọng tâm”**: danh sách mục tiêu theo viễn cảnh; thêm/sửa/xóa, gắn KPI vào mục tiêu.
`,
  },
  {
    file: '05-giao-kpi.md',
    title: 'Quản trị KPI – Giao KPI',
    screens: ['Giao KPI'],
    stt: '29 – 35',
    body: `
## Tab “Danh sách giao KPI theo đơn vị” (29–31)
1. **“Thêm mới”** → chọn “Đơn vị được giao”, “Năm” → thêm các KPI, nhập “Trọng số” (tổng = 100) và mục tiêu Quý I, Quý II, 6T ĐN, Quý III, Quý IV, Cả năm → **“Lưu”** (trạng thái “Nháp”).
2. **“Sao chép”** sang năm khác/đơn vị khác. Tích chọn các dòng → **“Chốt số liệu giao KPI”**: chuyển “Đã giao”, sinh kỳ đánh giá cho đơn vị.
## Tab “Danh sách giao KPI theo chỉ tiêu” (32–33)
Giao một KPI cho nhiều đơn vị cùng lúc; cùng quy tắc trọng số, chốt.
## Điều chỉnh mục tiêu (34)
**“Điều chỉnh mục tiêu giao KPI cho tất cả các đơn vị”**: sửa mục tiêu đã giao → **“Lưu nháp”** hoặc **“Lưu chốt”**; nút **“Lịch sử”** trên từng dòng → “Lịch sử điều chỉnh”.
## Nhập / xuất (35)
**“Nhập dữ liệu”** theo file mẫu (kiểm tra → xem trước → xác nhận); **“Xuất dữ liệu”** ra Excel (sheet tổng hợp + chi tiết).
`,
  },
  {
    file: '06-ban-do-chien-luoc.md',
    title: 'Quản trị KPI – Quản lý bản đồ chiến lược',
    screens: ['Quản lý bản đồ chiến lược'],
    stt: '36 – 38',
    body: `
1. Menu **“Quản lý bản đồ chiến lược”**: danh sách chiến lược (tìm kiếm, xem, thêm, sửa, xóa – 36.x).
2. **“Sửa”** → màn hình **“Cập nhật chiến lược”**: các dải ngang theo viễn cảnh; **“Cập nhật mục tiêu trọng tâm”** để đặt mục tiêu lên bản đồ; kéo nối điểm (handle) giữa hai mục tiêu để tạo liên kết (mũi tên); nút **“Xóa”** trên thẻ mục tiêu (37.x); **“Tự động sắp xếp”**; **“Lưu”**. Rời trang khi chưa lưu sẽ được cảnh báo.
3. Gán khung KPI cho mục tiêu, xem KPI trên từng thẻ; **“Tải ảnh bản đồ”** (38.1).
4. Job “Hoàn tất chiến lược” tự chuyển chiến lược hết giai đoạn sang “Hoàn thành”.
`,
  },
  {
    file: '07-danh-gia-kpi.md',
    title: 'Quản trị KPI – Đánh giá KPI',
    screens: ['Đánh giá KPI'],
    stt: '39 – 45',
    body: `
1. Menu **“Đánh giá KPI”**: danh sách KPI-kỳ cần đánh giá; lọc năm, kỳ, viễn cảnh, “Tình trạng” (39.x).
2. **Đồng bộ kết quả** từ nguồn dữ liệu (43.1: “Đồng bộ thành công N/M đơn vị; lỗi K”, “Xem lỗi”), hoặc **nhập tay** trên lưới / **nhập từ file** (44.x).
3. Hệ thống tự tính kết quả, % TH/KH, điểm (thang 5), phân loại; **“Chốt KQ R2”** để khóa kết quả theo chỉ tiêu.
4. Tab **“Tổng hợp BSC theo chỉ tiêu KPI”** và **“Theo dõi kết quả thẩm định và phản hồi”**: xử lý đề nghị điều chỉnh của đơn vị (chấp nhận/từ chối, lý do) (41–42).
5. Báo cáo “Biểu giao KPI”, “Biểu kết quả KPI” (45.x).
`,
  },
  {
    file: '08-tong-hop-ket-qua-bsc.md',
    title: 'Quản trị KPI – Tổng hợp kết quả BSC',
    screens: ['Tổng hợp kết quả BSC'],
    stt: '46 – 54',
    body: `
1. Menu **“Tổng hợp kết quả BSC”**, tab **“Tổng hợp kết quả BSC”**: kết quả mọi đơn vị theo năm/kỳ, xếp hạng; **“Xem”** theo đơn vị/KPI (46.x).
2. **“Thu hồi kết quả đánh giá”** theo KPI hoặc theo đơn vị (46.4, 47.4): kết quả về “BCL yêu cầu làm lại”, đơn vị đánh giá lại. Kỳ đã TGĐ ký duyệt thì không thu hồi được.
3. **“Tính lại điểm đánh giá”** (46.5).
4. **“Chốt đánh giá KPI”** (48.x): chỉ chốt khi mọi đơn vị đủ điều kiện; nếu chưa, hệ thống hiển thị “Danh sách chưa hoàn thành. Vui lòng hoàn thiện trước khi thực hiện chốt đánh giá KPI” kèm danh sách đơn vị. Sau thu hồi, đơn vị đánh giá lại thì chốt lại được.
5. **Tổng giám đốc duyệt** (50.x): xem tổng hợp → **“Ký duyệt”**; kỳ đã duyệt bị khóa toàn bộ.
6. **Báo cáo** (51–53): “Báo cáo TTr94 tổng hợp BSC”, “Báo cáo TTr94 chi tiết KPI”, “Báo cáo KPI từng tỉnh” – chọn phạm vi đơn vị, kỳ → **“Xác nhận”** → tải file.
7. Thông báo (54.1): chuông và email/Zalo cho các sự kiện giao KPI, nhắc hạn, đề nghị điều chỉnh, thu hồi, chốt, duyệt.
`,
  },
  {
    file: '09-quan-tri-he-thong.md',
    title: 'Quản trị hệ thống',
    screens: ['Quản trị hệ thống'],
    stt: '3.x, 4.x, 5.x, 26.17 – 26.24',
    body: `
Menu **“Quản trị hệ thống”**, các tab:
- **Người dùng** (3.x): thêm/sửa/xóa, khóa/mở, nhập/xuất; **“Quản lý vai trò người dùng”**: tích chọn vai trò ở “Vai trò có sẵn” → **“Lưu”** (hoặc “Thêm →” để chọn đơn vị áp dụng); bỏ tích ở “Vai trò đã gán” để bỏ gán.
- **Vai trò / Quyền** (4.x): tạo nhóm quyền, gán quyền theo phân hệ/menu.
- **Đơn vị** (5.x): cây đơn vị/phòng ban, thêm/sửa/xóa, nhập/xuất.
- **Lịch đồng bộ** (26.17–26.19): bật/tắt, sửa cron, “Chạy ngay”, xem lịch sử chạy.
- **Tham số hệ thống** (26.20–26.24): ngưỡng điểm, hạn cập nhật, bảo mật đăng nhập, tích hợp… Sửa có hiệu lực ngay trên node hiện tại và tối đa 30 giây trên node còn lại.
- **Nhật ký hệ thống**: tra cứu thao tác ghi (trước/sau), đăng nhập/đăng xuất.

Chi tiết quản trị: [docs/HDQT.md](../HDQT.md).
`,
  },
];

const index = ['# HƯỚNG DẪN SỬ DỤNG — Phần mềm quản trị và theo dõi chỉ tiêu KPI theo BSC', '', 'Ảnh chụp màn hình sinh tự động bằng Playwright (`frontend/e2e/hdsd-screens.spec.ts`) trên dữ liệu demo.', '', '| Phân hệ | STT | Tài liệu |', '|---|---|---|'];
for (const m of MODULES) {
  const L = [`# ${m.title}`, '', `> Phạm vi chức năng (mã STT E-HSMT): ${m.stt}`, '', m.body.trim(), '', '## Ảnh màn hình', ''];
  const list = m.screens.flatMap(imgs);
  if (!list.length) L.push('_Chưa có ảnh — chạy bước 1 ở đầu `scripts/gen-hdsd.mjs`._');
  for (const s of list) L.push(`**${s.tab ? `${s.screen} – ${s.tab}` : s.screen}**`, '', img(s), '');
  writeFileSync(join(dir, m.file), L.join('\n') + '\n');
  index.push(`| ${m.title} | ${m.stt} | [${m.file}](${m.file}) |`);
}
writeFileSync(join(dir, 'README.md'), index.join('\n') + '\n');
console.log(`HDSD: ${MODULES.length} phân hệ, ${shots.length} ảnh`);
