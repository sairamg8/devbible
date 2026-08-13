// Phase 8 page 11 — CSRF. Origin checking, double-submit tokens, cookie attributes.
import http from 'node:http';
import crypto from 'node:crypto';

const line = (s) => console.log('\n== ' + s + ' ==');

line('what Node sends by default for a Set-Cookie you wrote yourself');
const srv = http.createServer((req, res) => {
  if (req.url === '/login') {
    res.setHeader('Set-Cookie', 'sid=abc123; Path=/; HttpOnly');
    return res.end('ok');
  }
  res.end(JSON.stringify({
    method: req.method,
    origin: req.headers.origin ?? null,
    referer: req.headers.referer ?? null,
    secFetchSite: req.headers['sec-fetch-site'] ?? null,
    contentType: req.headers['content-type'] ?? null,
    cookie: req.headers.cookie ?? null,
  }));
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const base = `http://127.0.0.1:${port}`;

const login = await fetch(`${base}/login`);
console.log('Set-Cookie as written  ->', login.headers.getSetCookie().join(' | '));

line('a cross-site form POST, as the browser would send it');
const crossSite = await fetch(`${base}/transfer`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Origin: 'https://evil.example',
    Referer: 'https://evil.example/page',
    Cookie: 'sid=abc123',
  },
  body: 'to=mallory&amount=1000',
});
console.log(await crossSite.text());

line('the same-origin request, for comparison');
const sameSite = await fetch(`${base}/transfer`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base, Cookie: 'sid=abc123' },
  body: '{}',
});
console.log(await sameSite.text());

line('Origin header normalisation — what you are actually comparing');
for (const raw of [
  'https://app.example.com',
  'https://app.example.com:443',
  'https://app.example.com/',
  'https://app.example.com:8443',
  'http://app.example.com',
  'null',
]) {
  try {
    console.log(raw.padEnd(30), '-> origin', new URL(raw).origin);
  } catch (e) {
    console.log(raw.padEnd(30), '-> URL threw', e.message);
  }
}

line('double-submit token comparison');
const token = crypto.randomBytes(32).toString('base64url');
console.log('token          =', token, `(${token.length} chars)`);

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
console.log('same           =', safeEqual(token, token));
console.log('tampered       =', safeEqual(token, token.slice(0, -1) + 'A'));
console.log('short          =', safeEqual(token, 'x'));

line('signed double submit — token bound to the session');
const secret = 'server-side-secret';
const sid = 'abc123';
const sign = (sid, nonce) =>
  crypto.createHmac('sha256', secret).update(`${sid}.${nonce}`).digest('base64url');
const nonce = crypto.randomBytes(16).toString('base64url');
const csrf = `${nonce}.${sign(sid, nonce)}`;
console.log('csrf cookie    =', csrf);

function verify(sid, value) {
  const [nonce, mac] = String(value).split('.');
  if (!nonce || !mac) return false;
  return safeEqual(mac, sign(sid, nonce));
}
console.log('right session  =', verify('abc123', csrf));
console.log('other session  =', verify('def456', csrf), ' <- a token stolen from another session is useless');

line('cookie attribute combinations Node will happily send');
for (const c of [
  'sid=1; SameSite=None',
  'sid=1; SameSite=None; Secure',
  'sid=1; SameSite=Lax; HttpOnly; Secure; Path=/',
  '__Host-sid=1; Path=/; Secure; HttpOnly; SameSite=Lax',
  '__Host-sid=1; Path=/app; Secure',
]) {
  console.log('  ', c);
}
console.log('(Node validates none of these — the browser decides. __Host- requires Secure, Path=/ and no Domain.)');

srv.close();
