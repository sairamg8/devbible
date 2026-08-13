// Phase 8 page 12 — SSRF. What a URL allowlist misses, and what actually works.
import net from 'node:net';
import dns from 'node:dns/promises';
import http from 'node:http';

const line = (s) => console.log('\n== ' + s + ' ==');

line('alternate spellings of 127.0.0.1 — does new URL() normalise them?');
for (const raw of [
  'http://127.0.0.1/',
  'http://2130706433/',
  'http://0x7f000001/',
  'http://0177.0.0.1/',
  'http://127.1/',
  'http://[::1]/',
  'http://[::ffff:127.0.0.1]/',
  'http://localhost/',
]) {
  const u = new URL(raw);
  console.log(
    raw.padEnd(28),
    '-> hostname', u.hostname.padEnd(22),
    'net.isIP =', net.isIP(u.hostname)
  );
}

line('do the odd forms actually connect? (server on 127.0.0.1)');
const srv = http.createServer((req, res) => res.end('SECRET'));
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;

for (const host of ['127.0.0.1', '2130706433', '0x7f000001', '127.1', 'localhost']) {
  try {
    const res = await fetch(`http://${host}:${port}/`);
    console.log(String(host).padEnd(14), '->', res.status, await res.text());
  } catch (e) {
    console.log(String(host).padEnd(14), '-> FAILED', e.cause?.code ?? e.message);
  }
}

line('DNS: does a public name resolve to a private address?');
for (const name of ['localhost', 'example.com']) {
  try {
    console.log(name.padEnd(14), '->', (await dns.lookup(name, { all: true })).map((a) => a.address).join(', '));
  } catch (e) {
    console.log(name.padEnd(14), '-> FAILED', e.code);
  }
}

line('redirect: validating the URL up front is not enough');
const redirector = http.createServer((req, res) => {
  res.writeHead(302, { Location: `http://127.0.0.1:${port}/` });
  res.end();
});
await new Promise((r) => redirector.listen(0, '127.0.0.1', r));
const rport = redirector.address().port;

const followed = await fetch(`http://127.0.0.1:${rport}/`);
console.log('default fetch  ->', followed.status, await followed.text(), '| redirected =', followed.redirected);

const manual = await fetch(`http://127.0.0.1:${rport}/`, { redirect: 'manual' });
console.log("redirect:'manual' ->", manual.status, '| location =', manual.headers.get('location'));

try {
  await fetch(`http://127.0.0.1:${rport}/`, { redirect: 'error' });
} catch (e) {
  console.log("redirect:'error'  -> threw", e.cause?.message ?? e.message);
}

line('the real fix: refuse at connect time with a custom lookup');
const { Agent } = await import('undici');

function isPrivate(ip) {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 127 || a === 10 || a === 0 || (a === 172 && b >= 16 && b < 32) ||
           (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
}

const guarded = new Agent({
  connect: {
    lookup(hostname, opts, cb) {
      dns.lookup(hostname, opts).then(
        (r) => {
          const addr = Array.isArray(r) ? r[0].address : r.address;
          if (isPrivate(addr)) return cb(new Error(`blocked private address ${addr} for ${hostname}`));
          cb(null, addr, net.isIP(addr));
        },
        (e) => cb(e)
      );
    },
  },
});

for (const target of [`http://127.0.0.1:${port}/`, `http://2130706433:${port}/`, `http://localhost:${port}/`]) {
  try {
    const r = await fetch(target, { dispatcher: guarded });
    console.log(target.padEnd(30), '->', r.status, await r.text());
  } catch (e) {
    console.log(target.padEnd(30), '-> blocked:', e.cause?.message ?? e.message);
  }
}

line('does the guard survive a redirect into the private range?');
try {
  const r = await fetch(`http://example.com/`, { dispatcher: guarded, redirect: 'follow' });
  console.log('example.com ->', r.status);
} catch (e) {
  console.log('example.com -> ', e.cause?.message ?? e.message);
}
try {
  const r = await fetch(`http://127.0.0.1:${rport}/`, { dispatcher: guarded });
  console.log('redirector via guarded agent ->', r.status, await r.text());
} catch (e) {
  console.log('redirector via guarded agent -> blocked:', e.cause?.message ?? e.message);
}

line('non-http schemes reaching a naive fetcher');
for (const raw of ['file:///etc/passwd', 'ftp://example.com/x', 'data:text/plain,hi']) {
  try {
    const r = await fetch(raw);
    console.log(raw.padEnd(24), '->', r.status, (await r.text()).slice(0, 30));
  } catch (e) {
    console.log(raw.padEnd(24), '-> threw', e.cause?.message ?? e.message);
  }
}

srv.close();
redirector.close();
