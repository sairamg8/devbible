// Phase 8 page 19 — HTTPS, HSTS, cookie flags. Node 24.19.0.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';

const line = (t) => console.log(`\n=== ${t} ===`);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-'));
const key = path.join(dir, 'key.pem');
const cert = path.join(dir, 'cert.pem');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
  '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost',
  '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });

line('1. Node TLS defaults');
console.log('tls.DEFAULT_MIN_VERSION ->', tls.DEFAULT_MIN_VERSION);
console.log('tls.DEFAULT_MAX_VERSION ->', tls.DEFAULT_MAX_VERSION);
console.log('default cipher list     ->', tls.DEFAULT_CIPHERS.split(':').slice(0, 4).join(':'), '…');
console.log('rootCertificates count  ->', tls.rootCertificates.length);

line('2. handshake cost, TLS 1.2 vs 1.3 (20 fresh connections each)');
const ca = fs.readFileSync(cert);
async function timeHandshakes(maxVersion, n = 20) {
  const server = https.createServer({ key: fs.readFileSync(key), cert: ca, maxVersion },
    (req, res) => res.end('ok'));
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const t = performance.now();
  let proto;
  for (let i = 0; i < n; i++) {
    await new Promise((resolve, reject) => {
      const socket = tls.connect({ port, host: '127.0.0.1', ca, servername: 'localhost' }, () => {
        proto = socket.getProtocol();
        socket.end(); resolve();
      });
      socket.on('error', reject);
    });
  }
  const ms = performance.now() - t;
  server.close();
  return { proto, ms };
}
for (const v of ['TLSv1.2', 'TLSv1.3']) {
  const { proto, ms } = await timeHandshakes(v);
  console.log(`${v} -> negotiated ${proto}  ${ms.toFixed(1)} ms / 20 = ${(ms / 20).toFixed(2)} ms each`);
}

line('3. session resumption');
{
  const server = https.createServer({ key: fs.readFileSync(key), cert: ca }, (req, res) => res.end('ok'));
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const connect = (session) => new Promise((resolve) => {
    const s = tls.connect({ port, host: '127.0.0.1', ca, servername: 'localhost', session }, () => {
      resolve({ reused: s.isSessionReused(), session: s.getSession(), close: () => s.end() });
    });
  });
  const first = await connect();
  console.log('first connection  -> isSessionReused:', first.reused);
  await new Promise((r) => setTimeout(r, 50));
  first.close();
  const second = await connect(first.session);
  console.log('with saved ticket -> isSessionReused:', second.reused);
  second.close();
  server.close();
}

line('4. what a plain node:http server sends by default');
{
  const server = http.createServer((req, res) => {
    res.writeHead(200).end('hi');
  });
  await new Promise((r) => server.listen(0, r));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/`);
  console.log('headers ->', JSON.stringify(Object.fromEntries(res.headers)));
  console.log('Strict-Transport-Security ->', res.headers.get('strict-transport-security'));
  server.close();
}

line('5. HSTS values, and what each word costs you');
const hsts = [
  ['max-age=0', 'removes the pin — the only way back'],
  ['max-age=31536000', 'one year, this host only'],
  ['max-age=31536000; includeSubDomains', 'every subdomain, including ones you forgot'],
  ['max-age=31536000; includeSubDomains; preload', 'baked into browsers; removal takes months'],
];
for (const [v, note] of hsts) console.log(v.padEnd(52), note);

line('6. HSTS over plain HTTP is ignored — so the redirect must come first');
{
  const server = http.createServer((req, res) => {
    const host = req.headers.host;
    res.writeHead(301, { location: `https://${host}${req.url}`,
                         'strict-transport-security': 'max-age=31536000' }).end();
  });
  await new Promise((r) => server.listen(0, r));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/x`, { redirect: 'manual' });
  console.log('status   ->', res.status, '| location ->', res.headers.get('location'));
  console.log('HSTS sent over http is discarded by browsers; it counts only on the https response');
  server.close();
}

line('7. am I actually on TLS? (and the proxy lie)');
{
  const server = https.createServer({ key: fs.readFileSync(key), cert: ca }, (req, res) => {
    res.end(JSON.stringify({
      encrypted: req.socket.encrypted === true,
      protocol: req.socket.getProtocol?.() ?? null,
      xForwardedProto: req.headers['x-forwarded-proto'] ?? null,
    }));
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const agent = new https.Agent({ ca });
  const get = (headers) => new Promise((resolve) => {
    https.get({ port, host: '127.0.0.1', servername: 'localhost', agent, headers }, (r) => {
      let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => resolve(b));
    });
  });
  console.log('direct TLS         ->', await get({}));
  console.log('client-set header  ->', await get({ 'x-forwarded-proto': 'https' }),
    '  <- a client can send this on a PLAINTEXT hop too');
  server.close();
}

line('8. cookie flags: what each one blocks');
const cookies = [
  ['sid=abc', 'readable by JS, sent over http, sent cross-site'],
  ['sid=abc; HttpOnly', 'XSS cannot read it'],
  ['sid=abc; HttpOnly; Secure', 'never sent over plain http'],
  ['sid=abc; HttpOnly; Secure; SameSite=Lax', 'not sent on cross-site POST — the CSRF default'],
  ['sid=abc; HttpOnly; Secure; SameSite=Strict', 'not sent on any cross-site navigation'],
  ['sid=abc; HttpOnly; SameSite=None', 'REJECTED by browsers: None requires Secure'],
  ['__Host-sid=abc; Secure; Path=/', 'no Domain allowed -> subdomains cannot set or overwrite it'],
];
for (const [c, note] of cookies) console.log(c.padEnd(46), note);

line('9. Node does not validate any of that');
{
  const server = http.createServer((req, res) => {
    res.setHeader('Set-Cookie', [
      'a=1; SameSite=None',                 // invalid without Secure
      '__Host-b=2; Domain=example.com',     // invalid: __Host- forbids Domain
      'c=3; Secure',                        // pointless over http, but sent
      'd=4; Max-Age=notanumber',
    ]);
    res.end('ok');
  });
  await new Promise((r) => server.listen(0, r));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/`);
  console.log('server accepted and sent ->');
  for (const c of res.headers.getSetCookie()) console.log('  ', c);
  console.log('Node validated none of these; only the browser rejects them.');
  server.close();
}

line('10. cookie size and the 4 KB wall');
{
  const server = http.createServer((req, res) => {
    res.setHeader('Set-Cookie', `big=${'x'.repeat(5000)}`);
    res.end('ok');
  });
  await new Promise((r) => server.listen(0, r));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/`);
  const c = res.headers.getSetCookie()[0];
  console.log('Set-Cookie length sent ->', c.length, 'bytes — browsers cap around 4096 and drop it silently');
  server.close();
}

fs.rmSync(dir, { recursive: true, force: true });
