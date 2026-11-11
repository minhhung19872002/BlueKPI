// Sinh docs/TRACEABILITY.md từ docs/traceability-data.txt + dò e2e test theo mã STT
// Chạy: node scripts/gen-traceability.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const data = readFileSync(join(root, 'docs/traceability-data.txt'), 'utf8')
  .split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'))
  .map(l => { const [stt, name, route, endpoint, perm] = l.split('|'); return { stt, name, route, endpoint, perm }; });

// Dò test e2e: test('<STT> ...'
const e2eDir = join(root, 'frontend/e2e');
const tests = new Map();
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.spec\.ts$/.test(f)) {
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(/test\(\s*['"`](\d+\.\d+)\s/g)) {
        if (!tests.has(m[1])) tests.set(m[1], f);
      }
    }
  }
}
walk(e2eDir);

// Trạng thái hoàn thành thủ công: docs/traceability-done.txt (mỗi dòng 1 STT)
const donePath = join(root, 'docs/traceability-done.txt');
const done = new Set(existsSync(donePath) ? readFileSync(donePath, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean) : []);

const esc = s => (s ?? '').replace(/\|/g, '\\|');
let md = `# TRACEABILITY — Bảng truy vết STT → Route FE → Endpoint BE → Quyền → Test e2e\n\n`;
md += `> File sinh tự động bởi \`node scripts/gen-traceability.mjs\` từ \`docs/traceability-data.txt\`. Cột “Test e2e” dò tự động trong \`frontend/e2e/**/*.spec.ts\` (tên test bắt đầu bằng mã STT). ☑ = đã đủ DoD (CLAUDE.md §6) và có e2e.\n\n`;
const total = data.length;
const ok = data.filter(d => done.has(d.stt) && tests.has(d.stt)).length;
md += `**Tiến độ chức năng: ${ok}/${total} STT ☑**\n\n`;
md += `## 1. Chức năng (PHẦN C)\n\n| STT | Tên | Route FE | Endpoint BE | Quyền | Test e2e | Trạng thái |\n|---|---|---|---|---|---|---|\n`;
for (const d of data) {
  const t = tests.get(d.stt);
  const st = done.has(d.stt) && t ? '☑' : '☐';
  md += `| ${d.stt} | ${esc(d.name)} | \`${esc(d.route)}\` | \`${esc(d.endpoint)}\` | \`${esc(d.perm)}\` | ${t ? `\`${t}\`` : '—'} | ${st} |\n`;
}

const nf = readFileSync(join(root, 'docs/traceability-nonfunc.md'), 'utf8');
md += `\n${nf}\n`;
writeFileSync(join(root, 'docs/TRACEABILITY.md'), md);
console.log(`TRACEABILITY: ${ok}/${total} ☑, e2e found for ${tests.size} STT`);
