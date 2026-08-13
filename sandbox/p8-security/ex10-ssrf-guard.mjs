// Phase 8 page 12 — the SSRF guard that actually works on Node 24.19.0.
// ex8 hit `invalid onRequestStart method` mixing the npm undici Agent with global fetch.
import net from 'node:net';
import dns from 'node:dns';
import dnsp from 'node:dns/promises';
import http from 'node:http';

const line = (s) => console.log('\n== ' + s + ' ==');

const srv = http.createServer((req, res) => res.end('SECRET'));
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const redirector = http.createServer((req, res) => {
  res.writeHead(302, { Location: `http://127.0.0.1:${port}/` });
  res.end();
});
await new Promise((r) => redirector.listen(0, '127.0.0.1', r));
const rport = redirector.address().port;

function isPrivate(ip) {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 127 || a === 10 || a === 0 ||
           (a === 172 && b >= 16 && b < 32) ||
           (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip);
}

// a drop-in replacement for dns.lookup that refuses private results
function guardedLookup(hostname, options, callback) {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err);
    const first = Array.isArray(address) ? address[0].address : address;
    if (isPrivate(first)) {
      return callback(Object.assign(new Error(`blocked: ${hostname} resolved to ${first}`), { code: 'ESSRFBLOCKED' }));
    }
    callback(null, address, family);
  });
}

line('A. global fetch + npm undici Agent — the version-mismatch trap');
{
  const { Agent } = await import('undici');
  const agent = new Agent({ connect: { lookup: guardedLookup } });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`, { dispatcher: agent });
    console.log('-> reached', r.status);
  } catch (e) {
    console.log('-> failed:', e.cause?.message ?? e.message);
  }
}

line("B. undici's own fetch + its own Agent — same copy, works");
{
  const { fetch: ufetch, Agent } = await import('undici');
  const agent = new Agent({ connect: { lookup: guardedLookup } });
  for (const target of [
    `http://127.0.0.1:${port}/`,
    `http://2130706433:${port}/`,
    `http://localhost:${port}/`,
    `http://127.0.0.1:${rport}/`,     // redirects into the private range
    'http://example.com/',
  ]) {
    try {
      const r = await ufetch(target, { dispatcher: agent, redirect: 'follow' });
      console.log(target.padEnd(32), '->', r.status, (await r.text()).slice(0, 20).replace(/\n/g, ''));
    } catch (e) {
      console.log(target.padEnd(32), '-> blocked:', e.cause?.message ?? e.message);
    }
  }
}

line('C. no dependency at all: http.request({ lookup })');
{
  const get = (url) =>
    new Promise((resolve, reject) => {
      const req = http.request(url, { lookup: guardedLookup }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body, location: res.headers.location }));
      });
      req.on('error', reject);
      req.end();
    });

  for (const target of [`http://127.0.0.1:${port}/`, `http://2130706433:${port}/`, `http://localhost:${port}/`]) {
    try {
      const r = await get(target);
      console.log(target.padEnd(32), '->', r.status, r.body);
    } catch (e) {
      console.log(target.padEnd(32), '-> blocked:', e.message);
    }
  }
  // redirects are NOT followed by http.request, so you re-check each hop yourself
  const hop = await get(`http://127.0.0.1:${rport}/`).catch((e) => ({ err: e.message }));
  console.log('redirector (no follow)           ->', hop.err ?? `${hop.status} Location: ${hop.location}`);
}

line('D. what a pre-flight resolve-then-fetch misses (TOCTOU)');
{
  const addrs = await dnsp.lookup('example.com', { all: true });
  console.log('checked example.com ->', addrs.map((a) => a.address).join(', '));
  console.log('...then fetch() resolves DNS again. Between the two lookups the answer can change.');
  console.log('That gap is DNS rebinding; only a connect-time check closes it.');
}

srv.close();
redirector.close();
