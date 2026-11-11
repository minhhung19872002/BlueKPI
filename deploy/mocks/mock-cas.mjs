// Mock VNPT CAS (protocol 2.0/3.0) cho môi trường dev
// GET /cas/login?service=...       -> form chọn user, redirect về service?ticket=ST-...
// GET /cas/serviceValidate, /cas/p3/serviceValidate?ticket=&service= -> XML CAS
// GET /cas/logout?service=          -> redirect
import http from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.PORT || 8091);
const tickets = new Map(); // ticket -> { user, service, exp }

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  if (p === '/cas/login') {
    const service = url.searchParams.get('service') || '';
    const user = url.searchParams.get('username');
    if (user) {
      const t = 'ST-' + randomBytes(12).toString('hex');
      tickets.set(t, { user, service, exp: Date.now() + 60000 });
      const sep = service.includes('?') ? '&' : '?';
      res.writeHead(302, { Location: `${service}${sep}ticket=${t}` });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta charset="utf-8"><title>VNPT CAS (mock)</title>
<h2>VNPT SSO (mock)</h2><form method="get" action="/cas/login">
<input type="hidden" name="service" value="${esc(service)}">
<label>Tên đăng nhập <input name="username" id="username" value="admin"></label>
<button type="submit" id="submit">Đăng nhập</button></form>`);
  }
  if (p === '/cas/serviceValidate' || p === '/cas/p3/serviceValidate') {
    const t = url.searchParams.get('ticket');
    const info = tickets.get(t);
    tickets.delete(t);
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
    if (!info || info.exp < Date.now()) {
      return res.end(`<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas"><cas:authenticationFailure code="INVALID_TICKET">Ticket ${esc(t)} not recognized</cas:authenticationFailure></cas:serviceResponse>`);
    }
    return res.end(`<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas"><cas:authenticationSuccess><cas:user>${esc(info.user)}</cas:user><cas:attributes><cas:email>${esc(info.user)}@vnpt.vn</cas:email><cas:displayName>${esc(info.user)}</cas:displayName></cas:attributes></cas:authenticationSuccess></cas:serviceResponse>`);
  }
  if (p === '/cas/logout') {
    const service = url.searchParams.get('service');
    if (service) { res.writeHead(302, { Location: service }); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Đã đăng xuất CAS');
  }
  if (p === '/health') { res.writeHead(200); return res.end('ok'); }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log(`mock-cas listening on ${PORT}`));
