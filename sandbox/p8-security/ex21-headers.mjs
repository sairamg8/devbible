// Phase 8 page 22 — security headers. Node 24.19.0.
import http from 'node:http';
import crypto from 'node:crypto';
import helmet from 'helmet';

const line = (t) => console.log(`\n=== ${t} ===`);
const fs = await import('node:fs');
console.log('helmet version ->', JSON.parse(fs.readFileSync('./node_modules/helmet/package.json', 'utf8')).version);

const serve = async (handler) => {
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, r));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() };
};

line('1. what helmet sets, with no configuration');
{
  const mw = helmet();
  const s = await serve((req, res) => mw(req, res, () => res.end('ok')));
  const res = await fetch(s.url);
  for (const [k, v] of [...res.headers].sort()) {
    if (['date', 'connection', 'keep-alive', 'transfer-encoding'].includes(k)) continue;
    console.log(k.padEnd(36), v.length > 90 ? v.slice(0, 88) + '…' : v);
  }
  s.close();
}

line('2. the default CSP, unwrapped');
{
  const mw = helmet();
  const s = await serve((req, res) => mw(req, res, () => res.end('ok')));
  const csp = (await fetch(s.url)).headers.get('content-security-policy');
  for (const d of csp.split(';').map((x) => x.trim()).filter(Boolean)) console.log('  ', d);
  s.close();
}

line('3. x-powered-by: Node sets none, frameworks do');
{
  const s = await serve((req, res) => res.end('ok'));
  console.log('bare node:http x-powered-by ->', (await fetch(s.url)).headers.get('x-powered-by'));
  s.close();
  const s2 = await serve((req, res) => { res.setHeader('X-Powered-By', 'Express'); res.end('ok'); });
  console.log('with the header             ->', (await fetch(s2.url)).headers.get('x-powered-by'),
    ' <- tells a scanner which CVE list to try');
  s2.close();
}

line('4. nosniff: what MIME sniffing does with a wrong Content-Type');
{
  const body = '<script>alert(1)</script>';
  for (const headers of [
    { 'content-type': 'text/plain' },
    { 'content-type': 'text/plain', 'x-content-type-options': 'nosniff' },
    {},
  ]) {
    const s = await serve((req, res) => { res.writeHead(200, headers).end(body); });
    const res = await fetch(s.url);
    console.log(JSON.stringify(headers).padEnd(72), '->',
      'ct:', res.headers.get('content-type'), '| nosniff:', res.headers.get('x-content-type-options'));
    s.close();
  }
  console.log('  no Content-Type at all -> the browser guesses, and may guess text/html');
}

line('5. CSP with a nonce — the only version that works with inline script');
{
  const s = await serve((req, res) => {
    const nonce = crypto.randomBytes(16).toString('base64');
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy':
        `default-src 'self'; script-src 'self' 'nonce-${nonce}'; object-src 'none'; base-uri 'none'`,
    }).end(`<script nonce="${nonce}">ok()</script><script>injected()</script>`);
  });
  const res = await fetch(s.url);
  console.log('CSP ->', res.headers.get('content-security-policy'));
  console.log('body->', await res.text());
  console.log('  the nonce script runs; the injected one does not. A NEW nonce per response is required.');
  s.close();
}

line('6. the CSP that does nothing');
const useless = [
  ["script-src 'self' 'unsafe-inline'", "unsafe-inline re-permits exactly what XSS injects"],
  ["script-src *", 'any origin'],
  ["default-src 'self'", 'no script-src fallback issue, but inline still blocked — this one is fine'],
  ["script-src 'self' https://cdn.example.com", 'as trustworthy as that CDN, incl. its JSONP endpoints'],
];
for (const [p, note] of useless) console.log(p.padEnd(46), note);

line('7. frame-ancestors supersedes X-Frame-Options');
{
  const s = await serve((req, res) => {
    res.writeHead(200, {
      'x-frame-options': 'SAMEORIGIN',
      'content-security-policy': "frame-ancestors 'none'",
    }).end('ok');
  });
  const res = await fetch(s.url);
  console.log('x-frame-options        ->', res.headers.get('x-frame-options'));
  console.log('csp frame-ancestors    ->', res.headers.get('content-security-policy'));
  console.log('  modern browsers obey frame-ancestors and ignore XFO; keep XFO only for old clients');
  s.close();
}

line('8. Report-Only: measure before you break the site');
{
  const s = await serve((req, res) => {
    res.writeHead(200, {
      'content-security-policy-report-only': "default-src 'self'; report-uri /csp-reports",
    }).end('ok');
  });
  console.log('header ->', (await fetch(s.url)).headers.get('content-security-policy-report-only'));
  console.log('  violations are reported, nothing is blocked. This is how you roll CSP out.');
  s.close();
}

line('9. CORS is not a security header for your server');
{
  const s = await serve((req, res) => {
    res.writeHead(200, { 'access-control-allow-origin': '*' }).end(JSON.stringify({ secret: 'visible' }));
  });
  const res = await fetch(s.url);
  console.log('ACAO:* response read by a non-browser client ->', await res.text());
  console.log('  CORS relaxes the browser same-origin rule. curl, fetch from a server, and any');
  console.log('  attacker tool ignore it entirely. It is not an access control.');
  s.close();
}

line('10. cost of setting them all');
{
  const HEADERS = {
    'content-security-policy': "default-src 'self'; script-src 'self'; object-src 'none'",
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
  };
  const bytes = Object.entries(HEADERS).reduce((n, [k, v]) => n + k.length + v.length + 4, 0);
  console.log('added response bytes ->', bytes, 'per response (uncompressed)');
  const mw = helmet();
  const noop = { setHeader() {}, getHeader() {}, removeHeader() {} };
  const req = { method: 'GET', url: '/', headers: {} };
  const t = performance.now();
  for (let i = 0; i < 100_000; i++) mw(req, noop, () => {});
  const ms = performance.now() - t;
  console.log(`helmet() per request -> ${ms.toFixed(1)} ms / 100k = ${(ms * 1000 / 100_000).toFixed(2)} µs`);
}
