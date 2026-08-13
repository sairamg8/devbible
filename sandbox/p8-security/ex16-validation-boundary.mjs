// Phase 8 page 17 — the boundary handler itself, plus record/catchall holes. Node 24.19.0, zod 4.4.3.
import http from 'node:http';
import { z } from 'zod';

const j = (x) => JSON.stringify(x);
const line = (t) => console.log(`\n=== ${t} ===`);

line('G. z.record / .catchall keep attacker-chosen keys');
const Rec = z.record(z.string(), z.string());
const rec = Rec.parse(JSON.parse('{"a":"1","__proto__":"x","constructor":"y"}'));
console.log('record own keys  ->', j(Object.keys(rec)));
console.log('hasOwn __proto__ ->', Object.hasOwn(rec, '__proto__'));
console.log('proto polluted?  ->', {}.a);
const Catch = z.object({ name: z.string() }).catchall(z.string());
console.log('catchall out     ->', j(Catch.parse(JSON.parse('{"name":"Sai","__proto__":"x","isAdmin":"true"}'))));

line('H. the boundary handler: cap -> parse -> schema');
const MAX_BODY = 1024;                                   // bytes

async function readJson(req, limit = MAX_BODY) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const err = new Error(`body exceeds ${limit} bytes`);
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const err = new Error('body is not valid JSON');
    err.status = 400;
    throw err;
  }
}

const CreateUser = z.strictObject({
  email: z.email().max(254),
  name: z.string().trim().min(1).max(80),
  age: z.coerce.number().int().min(13).max(130).optional(),
});

const server = http.createServer(async (req, res) => {
  try {
    if (req.headers['content-type'] !== 'application/json') {
      res.writeHead(415).end(j({ error: 'expected application/json' }));
      return;
    }
    const body = await readJson(req);
    const parsed = CreateUser.safeParse(body);
    if (!parsed.success) {
      res.writeHead(400, { 'content-type': 'application/json' })
         .end(j({ error: 'invalid body', fields: z.flattenError(parsed.error).fieldErrors }));
      return;
    }
    res.writeHead(201, { 'content-type': 'application/json' }).end(j({ created: parsed.data }));
  } catch (err) {
    res.writeHead(err.status ?? 500, { 'content-type': 'application/json' }).end(j({ error: err.message }));
  }
});

await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const send = async (label, body, headers = { 'content-type': 'application/json' }) => {
  const res = await fetch(base, { method: 'POST', headers, body });
  console.log(String(label).padEnd(28), res.status, await res.text());
};

await send('valid', j({ email: 'a@b.com', name: '  Sai  ', age: '33' }));
await send('unknown key', j({ email: 'a@b.com', name: 'Sai', isAdmin: true }));
await send('bad email + short name', j({ email: 'nope', name: '' }));
await send('wrong content-type', 'x', { 'content-type': 'text/plain' });
await send('not JSON', '{oops');
await send('2 KB body (cap 1 KB)', j({ email: 'a@b.com', name: 'x'.repeat(2048) }));

line('I. what the size cap saved: 20 MB without a cap');
const huge = j({ email: 'a@b.com', name: 'x'.repeat(20_000_000) });
let t = performance.now();
try { JSON.parse(huge); } catch {}
console.log('JSON.parse 20 MB      ->', (performance.now() - t).toFixed(1), 'ms of event loop, before any schema runs');
t = performance.now();
console.log('cap check on 20 MB    -> rejected after', MAX_BODY, 'bytes, in', (performance.now() - t).toFixed(3), 'ms');

server.close();
