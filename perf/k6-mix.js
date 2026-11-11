// k6 — kiểm chứng hiệu năng (PHẦN C §1.c): 100 TPS trong 10 phút, 70% đọc (dashboard, danh sách) / 30% ghi.
// Ngưỡng: p95 < 2s, lỗi < 0,1%. Kết quả ghi vào docs/perf-report.md.
//
// Chạy (k6 cài sẵn hoặc docker):
//   k6 run -e BASE=http://localhost:8089/api perf/k6-mix.js
//   docker run --rm -i --network host -e BASE=http://localhost:8089/api -v "$PWD/perf:/perf" grafana/k6 run /perf/k6-mix.js
// Biến: BASE, RATE (mặc định 100), DURATION (mặc định 10m), VUS (mặc định 150), USERS (danh sách user:pass, mặc định tài khoản seed dev)
import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://localhost:8089/api';
const RATE = Number(__ENV.RATE || 100);
const DURATION = __ENV.DURATION || '10m';
const PASSWORD = __ENV.PASSWORD || 'Kpi@2026';
const USERS = (__ENV.USERS || 'admin,lanhdao,tgd,qtgiao,qtthamdinh,danhgia,giaokpi').split(',');
const YEAR = Number(__ENV.YEAR || new Date().getFullYear());

export const options = {
  scenarios: {
    mix: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Number(__ENV.VUS || 150),
      maxVUs: Number(__ENV.MAX_VUS || 500),
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.001'],
    http_req_duration: ['p(95)<2000'],
    'http_req_duration{kind:read}': ['p(95)<2000'],
    'http_req_duration{kind:write}': ['p(95)<2000'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const writes = new Counter('kpi_writes');
const reads = new Counter('kpi_reads');
const loginTime = new Trend('kpi_login_ms');

function cookieValue(jar, name) {
  const c = jar.cookiesForURL(BASE)[name];
  return c && c.length ? c[0] : '';
}

/** Đăng nhập một lần cho mỗi VU; giữ cookie ACCESS_TOKEN/REFRESH_TOKEN/XSRF-TOKEN */
function session() {
  if (__VU in sessions) return sessions[__VU];
  const jar = http.cookieJar();
  http.get(`${BASE}/auth/me`, { tags: { kind: 'auth' } });
  const user = USERS[__VU % USERS.length];
  const r = http.post(`${BASE}/auth/login`, JSON.stringify({ username: user, password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': cookieValue(jar, 'XSRF-TOKEN') },
    tags: { kind: 'auth' },
  });
  loginTime.add(r.timings.duration);
  if (!check(r, { 'đăng nhập 200': (x) => x.status === 200 })) fail(`login ${user} → ${r.status}`);
  sessions[__VU] = { jar, user, xsrf: () => cookieValue(jar, 'XSRF-TOKEN') };
  return sessions[__VU];
}
const sessions = {};

const READS = [
  () => `/dashboard/overview?unit=GROUP&year=${YEAR}&period=Q2`,
  () => `/dashboard/ranking-provinces?year=${YEAR}&period=Q2`,
  () => `/dashboard/corporations?year=${YEAR}&period=Q2`,
  () => `/dashboard/kpi-list?unit=GROUP&year=${YEAR}&period=Q2&card=ALL`,
  () => `/kpis?page=1&size=20`,
  () => `/assignments/by-unit?page=1&size=20&year=${YEAR}`,
  () => `/evaluations/by-kpi?page=1&size=20&year=${YEAR}`,
  () => `/bsc/summary?page=1&size=20&year=${YEAR}&period=Q2`,
  () => `/strategies?page=1&size=20`,
  () => `/notifications/unread-count`,
];

export default function () {
  const s = session();
  if (Math.random() < 0.7) {
    const url = READS[Math.floor(Math.random() * READS.length)]();
    const r = http.get(`${BASE}${url}`, { tags: { kind: 'read', name: url.split('?')[0] } });
    check(r, { 'đọc 200': (x) => x.status === 200 });
    reads.add(1);
  } else {
    // Ghi: tạo nháp giao KPI không hợp lệ? — dùng thao tác ghi idempotent và có kiểm tra nghiệp vụ:
    // 1) đánh dấu đã đọc thông báo  2) tạo + xóa đơn vị đo (CRUD đầy đủ, có audit)
    const h = { headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': s.xsrf() }, tags: { kind: 'write' } };
    if (Math.random() < 0.5) {
      const r = http.post(`${BASE}/notifications/read-all`, null, { ...h, tags: { kind: 'write', name: '/notifications/read-all' } });
      check(r, { 'ghi 200': (x) => x.status === 200 });
    } else {
      const name = `k6 ${__VU}-${__ITER}-${Date.now()}`;
      const c = http.post(`${BASE}/uoms`, JSON.stringify({ name, status: 'HIEU_LUC' }), { ...h, tags: { kind: 'write', name: '/uoms' } });
      check(c, { 'ghi 200': (x) => x.status === 200 });
      if (c.status === 200) {
        const d = c.json('data');
        const del = http.del(`${BASE}/uoms/${d.id}?version=${d.version}`, null, { ...h, tags: { kind: 'write', name: '/uoms/{id}' } });
        check(del, { 'xóa 200': (x) => x.status === 200 });
      }
    }
    writes.add(1);
  }
}
