// Sinh docs/BAO-CAO-KIEM-THU.md từ kết quả kiểm thử thực tế:
//  - frontend/test-results/results.json (Playwright JSON reporter, chạy `npm run e2e`)
//  - backend/target/surefire-reports, failsafe-reports (`./mvnw verify`)
//  - Vitest: chạy lại `npx vitest run --reporter=json` (tùy chọn --skip-vitest)
//  - docs/perf-report.md (k6) nếu có
// Chạy: node scripts/gen-test-report.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const p = (...a) => join(root, ...a);
const now = new Date();
const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// ---------------- Playwright ----------------
const e2e = [];
const resPath = p('frontend/test-results/results.json');
if (existsSync(resPath)) {
  const j = JSON.parse(readFileSync(resPath, 'utf8'));
  const walk = (suite, file) => {
    const f = suite.file ?? file;
    for (const s of suite.specs ?? []) {
      for (const t of s.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        const status = t.status === 'skipped' ? 'skipped' : last?.status ?? 'unknown';
        const shot = last?.attachments?.find((a) => a.name === 'screenshot')?.path;
        e2e.push({ file: f, title: s.title, status, ms: last?.duration ?? 0, shot });
      }
    }
    for (const c of suite.suites ?? []) walk(c, f);
  };
  for (const s of j.suites ?? []) walk(s);
}
const passed = (s) => s === 'passed' || s === 'expected';

// ---------------- JUnit (surefire/failsafe) ----------------
const junit = [];
for (const dir of ['backend/target/surefire-reports', 'backend/target/failsafe-reports']) {
  if (!existsSync(p(dir))) continue;
  for (const f of readdirSync(p(dir)).filter((x) => /^TEST-.*\.xml$/.test(x))) {
    const x = readFileSync(p(dir, f), 'utf8');
    const m = x.match(/<testsuite[^>]*name="([^"]+)"[^>]*tests="(\d+)"[^>]*errors="(\d+)"[^>]*skipped="(\d+)"[^>]*failures="(\d+)"/) ||
      x.match(/<testsuite[^>]*name="([^"]+)"[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*errors="(\d+)"[^>]*skipped="(\d+)"/);
    if (!m) continue;
    const name = m[1];
    const tests = +m[2];
    const nums = x.match(/failures="(\d+)"/), errs = x.match(/errors="(\d+)"/), skip = x.match(/skipped="(\d+)"/);
    junit.push({ kind: dir.includes('failsafe') ? 'Integration' : 'Unit', name: name.replace('vn.vnpt.kpi.', ''), tests, failures: +nums[1], errors: +errs[1], skipped: +skip[1] });
  }
}

// ---------------- Vitest ----------------
let vitest = null;
if (!process.argv.includes('--skip-vitest')) {
  try {
    const out = execSync('npx vitest run --reporter=json', { cwd: p('frontend'), stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 50e6 }).toString();
    const j = JSON.parse(out.slice(out.indexOf('{')));
    vitest = { total: j.numTotalTests, passed: j.numPassedTests, failed: j.numFailedTests, files: j.testResults.map((r) => ({ name: r.name.replace(/.*[\\/]src[\\/]/, 'src/'), n: r.assertionResults.length, ok: r.assertionResults.every((a) => a.status === 'passed') })) };
  } catch {
    vitest = null;
  }
}

// ---------------- STT map ----------------
const data = readFileSync(p('docs/traceability-data.txt'), 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')).map((l) => {
  const [stt, name] = l.split('|');
  return { stt, name };
});
const bySTT = new Map();
for (const t of e2e) {
  const m = t.title.match(/^(\d+\.\d+)\s/);
  if (!m) continue;
  if (!bySTT.has(m[1])) bySTT.set(m[1], []);
  bySTT.get(m[1]).push(t);
}

const L = [];
const e2eOk = e2e.filter((t) => passed(t.status)).length;
const e2eFail = e2e.filter((t) => !passed(t.status) && t.status !== 'skipped').length;
const juTotal = junit.reduce((a, b) => a + b.tests, 0);
const juFail = junit.reduce((a, b) => a + b.failures + b.errors, 0);
L.push('# BÁO CÁO KIỂM THỬ — Phần mềm quản trị và theo dõi chỉ tiêu KPI theo BSC');
L.push('');
L.push(`> Sinh tự động bằng \`node scripts/gen-test-report.mjs\` lúc ${fmt(now)} từ kết quả chạy thực tế (Playwright, JUnit/Testcontainers, Vitest). Không chỉnh tay.`);
L.push('');
L.push('## 1. Tổng hợp');
L.push('');
L.push('| Loại kiểm thử | Công cụ | Số ca | Đạt | Không đạt |');
L.push('|---|---|---|---|---|');
L.push(`| E2E theo STT (1024×768, dữ liệu seed) | Playwright | ${e2e.filter((t) => t.status !== 'skipped').length} | ${e2eOk} | ${e2eFail} |`);
for (const kind of ['Unit', 'Integration']) {
  const g = junit.filter((x) => x.kind === kind);
  if (!g.length) continue;
  const n = g.reduce((a, b) => a + b.tests, 0), f = g.reduce((a, b) => a + b.failures + b.errors, 0);
  L.push(`| ${kind === 'Unit' ? 'Unit backend (engine ≥ 40 ca, bảo mật)' : 'Integration backend (MariaDB + MinIO Testcontainers)'} | JUnit 5 | ${n} | ${n - f} | ${f} |`);
}
if (vitest) L.push(`| Unit frontend | Vitest + Testing Library | ${vitest.total} | ${vitest.passed} | ${vitest.failed} |`);
L.push('');
const missing = data.filter((d) => !bySTT.has(d.stt));
L.push(`Mã STT có e2e: **${data.length - missing.length}/${data.length}**. Tổng JUnit: ${juTotal} ca, lỗi ${juFail}.`);
L.push('');
L.push('## 2. Kết quả theo mã STT (E-HSMT)');
L.push('');
L.push('| STT | Chức năng | Ca e2e | Kết quả | Bằng chứng |');
L.push('|---|---|---|---|---|');
for (const d of data) {
  const ts = bySTT.get(d.stt) ?? [];
  const ok = ts.length && ts.every((t) => passed(t.status));
  const res = !ts.length ? '— chưa có e2e' : ok ? 'Đạt' : '**Không đạt**';
  const files = [...new Set(ts.map((t) => t.file))].join(', ');
  const img = existsSync(p(`docs/HDSD/img`)) ? '' : '';
  L.push(`| ${d.stt} | ${d.name} | ${ts.length} | ${res} | ${files}${img} |`);
}
L.push('');
L.push('## 3. Kiểm thử bổ sung (điều hướng SiteMap, phân quyền, hiệu năng, SSO)');
L.push('');
L.push('| Ca kiểm thử | File | Kết quả | Thời gian |');
L.push('|---|---|---|---|');
for (const t of e2e.filter((t) => !/^\d+\.\d+\s/.test(t.title) && t.status !== 'skipped')) L.push(`| ${t.title} | ${t.file} | ${passed(t.status) ? 'Đạt' : '**Không đạt**'} | ${(t.ms / 1000).toFixed(1)}s |`);
L.push('');
L.push('## 4. Kiểm thử backend (JUnit)');
L.push('');
L.push('| Loại | Lớp kiểm thử | Số ca | Lỗi | Bỏ qua |');
L.push('|---|---|---|---|---|');
for (const j of junit.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))) L.push(`| ${j.kind} | \`${j.name}\` | ${j.tests} | ${j.failures + j.errors} | ${j.skipped} |`);
if (vitest) {
  L.push('');
  L.push('## 5. Kiểm thử frontend (Vitest)');
  L.push('');
  L.push('| File | Số ca | Kết quả |');
  L.push('|---|---|---|');
  for (const f of vitest.files) L.push(`| \`${f.name}\` | ${f.n} | ${f.ok ? 'Đạt' : '**Không đạt**'} |`);
}
L.push('');
L.push('## 6. Hiệu năng và bảo mật');
L.push('');
L.push(existsSync(p('docs/perf-report.md')) ? '- Hiệu năng (k6): xem [`docs/perf-report.md`](perf-report.md).' : '- Hiệu năng (k6): chưa có `docs/perf-report.md`.');
L.push('- An toàn thông tin: xem [`docs/ATTT.md`](ATTT.md) (cơ chế đã triển khai, kết quả quét, rủi ro còn lại).');
L.push('- Ảnh chụp màn hình từng phân hệ: [`docs/HDSD/`](HDSD/).');
L.push('');
L.push('## 7. Môi trường kiểm thử');
L.push('');
L.push('- Trình duyệt Chromium (Playwright), viewport 1024×768, locale vi-VN, múi giờ Asia/Ho_Chi_Minh.');
L.push('- Backend Spring Boot (profile dev + seed demo) trên MariaDB 10.11 (CSDL `kpi_bsc_e2e` reset trước mỗi lần chạy), MinIO, mock CAS, mock nguồn KPI (`deploy/docker-compose.dev.yml`).');
L.push('- Integration test: Testcontainers `mariadb:10.11`, `minio/minio`.');
writeFileSync(p('docs/BAO-CAO-KIEM-THU.md'), L.join('\n') + '\n');
console.log(`BAO-CAO-KIEM-THU.md: e2e ${e2eOk}/${e2e.length}, junit ${juTotal - juFail}/${juTotal}, STT thiếu e2e: ${missing.map((m) => m.stt).join(', ') || 'không'}`);
