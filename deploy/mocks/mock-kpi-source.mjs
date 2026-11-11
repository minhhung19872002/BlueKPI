// Mock nguồn dữ liệu KPI công thức (PHẦN B §8.2)
// GET /kpi/{kpiCode}?year=&period=&unitCode=  -> { data: { value: <số> }, meta: {...} }
// Giá trị giả lập ổn định (hash) để test lặp lại được. Header X-Api-Key tùy chọn.
import http from 'node:http';
import { createHash } from 'node:crypto';

const PORT = Number(process.env.PORT || 8092);

function pseudo(key) {
  const h = createHash('sha256').update(key).digest();
  return 50 + (h.readUInt32BE(0) % 7000) / 100; // 50.00 .. 119.99
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
  if (parts[0] === 'kpi' && parts[1]) {
    const year = url.searchParams.get('year') || '';
    const period = url.searchParams.get('period') || '';
    const unit = url.searchParams.get('unitCode') || '';
    if (unit === 'ERR') { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end('{"error":"mock error"}'); }
    const value = Math.round(pseudo(`${parts[1]}|${year}|${period}|${unit}`) * 100) / 100;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ data: { value, unitCode: unit, kpiCode: parts[1], year, period }, meta: { source: 'mock-kpi-source' } }));
  }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log(`mock-kpi-source listening on ${PORT}`));
