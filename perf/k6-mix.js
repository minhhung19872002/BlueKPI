// k6 — kiểm chứng hiệu năng (PHẦN D §1.c): 100 TPS trong 10 phút, 70% đọc (dashboard, danh sách) / 30% ghi.
// Ngưỡng: p95 < 2s, lỗi < 0,1%. Kết quả ghi vào docs/perf-report.md.
//
// Mô hình tải: 500 người dùng đã đăng nhập (setup() tạo sẵn phiên cho từng tài khoản, mỗi VU dùng lại phiên của tài khoản mình)
// + kịch bản “login” 2 lượt đăng nhập/giây suốt thời gian đo (người dùng mới vào hệ thống) — tránh “bão đăng nhập” phi thực tế
// (bcrypt cost 12 ≈ 250 ms CPU/lượt) làm sai lệch số đo các giao dịch nghiệp vụ.
//
// Chạy (k6 cài sẵn hoặc docker):
//   k6 run -e BASE=http://localhost:8089/api perf/k6-mix.js
//   docker run --rm -e BASE=http://host.docker.internal:8089/api -v "$PWD/perf:/perf" grafana/k6:0.54.0 run --summary-export=/perf/k6-summary.json /perf/k6-mix.js
// Biến: BASE, RATE (100), DURATION (10m), VUS (150), MAX_VUS (500), LOGIN_RATE (2/s), USERS, PASSWORD, YEAR
// Lưu ý: tắt/nâng rate limit đăng nhập khi đo (kpi.security.login-rate-limit-per-minute), vì mọi request đến từ 1 IP.
import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://localhost:8089/api';
const RATE = Number(__ENV.RATE || 100);
const DURATION = __ENV.DURATION || '10m';
const PASSWORD = __ENV.PASSWORD || 'Kpi@2026';
const USERS = (__ENV.USERS || 'admin,lanhdao,tgd,qtgiao,qtthamdinh,danhgia,giaokpi').split(',');
const YEAR = Number(__ENV.YEAR || new Date().getFullYear());

// MODE=users: 500 người dùng đồng thời (constant-vus), mỗi người nghỉ 3–7 s giữa thao tác ≈ 100 req/s
const USERS_MODE = __ENV.MODE === 'users';
export const options = {
  scenarios: USERS_MODE
    ? { users: { executor: 'constant-vus', exec: 'mixThink', vus: Number(__ENV.VUS || 500), duration: DURATION } }
    : {
    mix: {
      executor: 'constant-arrival-rate',
      exec: 'mix',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Number(__ENV.VUS || 150),
      maxVUs: Number(__ENV.MAX_VUS || 500),
    },
    login: {
      executor: 'constant-arrival-rate',
      exec: 'loginFlow',
      rate: Number(__ENV.LOGIN_RATE || 2),
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 10,
      maxVUs: 50,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.001'],
    'http_req_duration{kind:read}': ['p(95)<2000'],
    'http_req_duration{kind:write}': ['p(95)<2000'],
    'http_req_duration{kind:auth}': ['p(95)<2000'],
    checks: ['rate>0.999'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  // giữ cookie phiên giữa các iteration của cùng VU — như người dùng thật
  noCookiesReset: true,
};

const writes = new Counter('kpi_writes');
const reads = new Counter('kpi_reads');
const loginTime = new Trend('kpi_login_ms', true);

function cookieValue(jar, name) {
  const c = jar.cookiesForURL(BASE)[name];
  return c && c.length ? c[0] : '';
}

/** Đăng nhập trên jar của VU hiện tại; trả về { access, perms } */
function doLogin(user) {
  const jar = http.cookieJar();
  jar.clear(BASE);
  // chưa đăng nhập: 401 là kỳ vọng (chỉ để nhận cookie XSRF-TOKEN)
  http.get(`${BASE}/auth/me`, { tags: { kind: 'auth', name: '/auth/me (anon)' }, responseCallback: http.expectedStatuses(200, 401) });
  const r = http.post(`${BASE}/auth/login`, JSON.stringify({ username: user, password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': cookieValue(jar, 'XSRF-TOKEN') },
    tags: { kind: 'auth', name: '/auth/login' },
  });
  loginTime.add(r.timings.duration);
  if (!check(r, { 'đăng nhập 200': (x) => x.status === 200 })) fail(`login ${user} → ${r.status}`);
  const me = http.get(`${BASE}/auth/me`, { tags: { kind: 'auth', name: '/auth/me' } });
  return { access: cookieValue(jar, 'ACCESS_TOKEN'), perms: me.status === 200 ? me.json('data.permissions') : [] };
}

/** Phiên sẵn cho từng tài khoản (ACCESS_TOKEN 15 phút ≥ thời gian đo 10 phút) */
export function setup() {
  const out = {};
  for (const u of USERS) out[u] = doLogin(u);
  return out;
}

const sessions = {};
function session(data) {
  if (__VU in sessions) return sessions[__VU];
  const user = USERS[__VU % USERS.length];
  const jar = http.cookieJar();
  jar.set(BASE, 'ACCESS_TOKEN', data[user].access, { path: '/api' });
  http.get(`${BASE}/notifications/unread-count`, { tags: { kind: 'read', name: '/notifications/unread-count' } }); // nhận XSRF-TOKEN
  sessions[__VU] = { user, perms: new Set(data[user].perms), xsrf: () => cookieValue(jar, 'XSRF-TOKEN') };
  return sessions[__VU];
}

/** [quyền cần có, url] — mỗi VU chỉ gọi chức năng mà vai trò của mình được phép (như người dùng thật) */
const READS = [
  ['DASHBOARD:VIEW_GROUP', () => `/dashboard/overview?unit=GROUP&year=${YEAR}&period=Q2`],
  ['DASHBOARD:VIEW_GROUP', () => `/dashboard/ranking-provinces?year=${YEAR}&period=Q2`],
  ['DASHBOARD:VIEW_GROUP', () => `/dashboard/corporations?year=${YEAR}&period=Q2`],
  ['DASHBOARD:VIEW_GROUP', () => `/dashboard/kpi-list?unit=GROUP&year=${YEAR}&period=Q2&card=ALL`],
  ['KPI:VIEW', () => `/kpis?page=1&size=20`],
  ['ASSIGN:VIEW', () => `/assignments/by-unit?page=1&size=20&year=${YEAR}`],
  ['EVAL:VIEW', () => `/evaluations/by-kpi?page=1&size=20&year=${YEAR}`],
  ['BSC:VIEW', () => `/bsc/summary?page=1&size=20&year=${YEAR}&period=Q2`],
  ['STRATEGY:VIEW', () => `/strategies?page=1&size=20`],
  [null, () => `/notifications/unread-count`],
];

export function mix(data) {
  const s = session(data);
  if (Math.random() < 0.7) {
    const allowed = READS.filter(([p]) => !p || s.perms.has(p));
    const url = allowed[Math.floor(Math.random() * allowed.length)][1]();
    const r = http.get(`${BASE}${url}`, { tags: { kind: 'read', name: url.split('?')[0] } });
    check(r, { 'đọc 200': (x) => x.status === 200 });
    reads.add(1);
  } else {
    // Ghi có kiểm tra nghiệp vụ + audit: (1) đánh dấu đã đọc thông báo  (2) tạo + xóa đơn vị đo (CRUD danh mục)
    if (Math.random() < 0.5 || !s.perms.has('UOM:CREATE') || !s.perms.has('UOM:DELETE')) {
      const r = http.post(`${BASE}/notifications/read-all`, null, { headers: { 'X-XSRF-TOKEN': s.xsrf() }, tags: { kind: 'write', name: '/notifications/read-all' } });
      check(r, { 'ghi 200': (x) => x.status === 200 });
    } else {
      const name = `k6 ${__VU}-${__ITER}-${Date.now()}`;
      const c = http.post(`${BASE}/uoms`, JSON.stringify({ name, status: 'HIEU_LUC' }), {
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': s.xsrf() },
        tags: { kind: 'write', name: '/uoms' },
      });
      check(c, { 'ghi 200': (x) => x.status === 200 });
      if (c.status === 200) {
        const d = c.json('data');
        // XSRF-TOKEN xoay vòng sau mỗi request ghi → lấy token mới
        const del = http.del(`${BASE}/uoms/${d.id}?version=${d.version}`, null, { headers: { 'X-XSRF-TOKEN': s.xsrf() }, tags: { kind: 'write', name: '/uoms/{id}' } });
        check(del, { 'xóa 200': (x) => x.status === 200 });
      }
    }
    writes.add(1);
  }
}

/** Người dùng thật: thao tác rồi nghỉ 3–7 s */
export function mixThink(data) {
  mix(data);
  sleep(3 + Math.random() * 4);
}

/** Người dùng mới đăng nhập (đo /auth/login dưới tải nền) */
export function loginFlow() {
  doLogin(USERS[__ITER % USERS.length]);
}
