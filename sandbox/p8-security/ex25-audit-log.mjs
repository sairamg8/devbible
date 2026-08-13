// Phase 8 page 27 — audit logging and tamper-evidence. Node 24.19.0.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const line = (t) => console.log(`\n=== ${t} ===`);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));

line('1. an audit event is not a log line');
const event = {
  ts: '2026-08-11T02:15:00.000Z',
  actor: { id: 'u_1042', type: 'user', ip: '203.0.113.9' },
  action: 'permission.grant',
  target: { type: 'project', id: 'p_77' },
  before: { role: 'viewer' },
  after: { role: 'admin' },
  outcome: 'success',
  requestId: '01J9Z3K7WQ',
  actorSession: 's_88f1',
};
console.log(JSON.stringify(event));
console.log('  who, what, to what, from->to, when, outcome, and the request that carried it.');

line('2. the hash chain: each record commits to the one before');
const KEY = crypto.createSecretKey(crypto.randomBytes(32));
const canonical = (o) =>                                     // stable key order, or the hash is meaningless
  JSON.stringify(o, Object.keys(o).sort());
const chain = [];
const append = (payload) => {
  const prev = chain.length ? chain[chain.length - 1].mac : ''.padEnd(64, '0');
  const seq = chain.length;
  const body = canonical({ ...payload, seq, prev });
  const mac = crypto.createHmac('sha256', KEY).update(body).digest('hex');
  chain.push({ seq, prev, payload, mac });
  return chain[chain.length - 1];
};
append({ action: 'login', actor: 'u_1' });
append({ action: 'permission.grant', actor: 'u_1', target: 'p_77' });
append({ action: 'export.download', actor: 'u_1', rows: 40_000 });
for (const r of chain) console.log(`  seq ${r.seq} ${r.payload.action.padEnd(18)} mac ${r.mac.slice(0, 16)}…`);

const verify = (records) => {
  let prev = ''.padEnd(64, '0');
  for (const r of records) {
    const body = canonical({ ...r.payload, seq: r.seq, prev });
    const mac = crypto.createHmac('sha256', KEY).update(body).digest('hex');
    if (mac !== r.mac) return `BROKEN at seq ${r.seq}`;
    if (r.prev !== prev) return `BROKEN link at seq ${r.seq}`;
    prev = r.mac;
  }
  return 'intact';
};
console.log('  verify ->', verify(chain));

line('3. what each kind of tampering looks like');
{
  const edited = structuredClone(chain);
  edited[1].payload.target = 'p_99';
  console.log('  edit a field   ->', verify(edited));
}
{
  const deleted = structuredClone(chain).filter((r) => r.seq !== 1);
  console.log('  delete a record->', verify(deleted));
}
{
  const truncated = structuredClone(chain).slice(0, 2);
  console.log('  truncate the end->', verify(truncated), ' <- a chain alone CANNOT detect this');
}

line('4. truncation needs an external anchor');
{
  const head = chain[chain.length - 1];
  console.log('  publish periodically: { seq:', head.seq, ', mac:', head.mac.slice(0, 16) + '… }');
  console.log('  to a second system, a signed receipt, or an append-only store.');
  console.log('  Without an anchor, an attacker with write access removes the tail and re-verifies clean.');
}

line('5. cost of chaining');
{
  const payload = { action: 'permission.grant', actor: 'u_1', target: 'p_77' };
  const bench = (label, fn, n) => {
    for (let i = 0; i < 5_000; i++) fn();
    const t = performance.now();
    for (let i = 0; i < n; i++) fn();
    const ms = performance.now() - t;
    console.log(`  ${label.padEnd(34)} ${(ms * 1000 / n).toFixed(2)} µs`);
  };
  bench('JSON.stringify only', () => JSON.stringify(payload), 200_000);
  bench('canonical + HMAC (the chain)', () => {
    const body = canonical({ ...payload, seq: 1, prev: 'x'.repeat(64) });
    return crypto.createHmac('sha256', KEY).update(body).digest('hex');
  }, 200_000);
  const t = performance.now();
  const v = verify(chain);
  console.log(`  verifying ${chain.length} records took ${(performance.now() - t).toFixed(3)} ms (${v})`);
  console.log('  a 10M-record chain verifies in one pass; store periodic checkpoints to avoid re-reading all of it.');
}

line('6. append-only at the OS level');
{
  const f = path.join(dir, 'audit.log');
  const fd = fs.openSync(f, 'a');
  fs.writeSync(fd, JSON.stringify(chain[0]) + '\n');
  fs.writeSync(fd, JSON.stringify(chain[1]) + '\n');
  fs.fsyncSync(fd);                                  // durability: the record must survive a crash
  fs.closeSync(fd);
  console.log('  opened with "a": every write goes to the end;', fs.readFileSync(f, 'utf8').trim().split('\n').length, 'lines');
  fs.truncateSync(f, 10);
  console.log('  but the same process can still truncate it ->', fs.statSync(f).size, 'bytes');
  console.log('  "append-only" in the app is a convention; enforcement is chattr +a, WORM storage,');
  console.log('  or shipping to a system your app cannot write twice.');
}

line('7. what must never enter an audit log');
{
  const bad = {
    action: 'login', password: 'hunter2', token: 'eyJhbGci…',
    card: '4111111111111111', email: 'alice@example.com',
  };
  const SENSITIVE = new Set(['password', 'token', 'secret', 'authorization', 'card']);
  const safe = Object.fromEntries(Object.entries(bad).map(([k, v]) =>
    [k, SENSITIVE.has(k) ? '[redacted]' : v]));
  console.log('  raw      ->', JSON.stringify(bad));
  console.log('  auditable->', JSON.stringify(safe));
  console.log('  an audit log is long-lived and widely read: it is the WORST place for a secret.');
  console.log('  card numbers -> store a last-4 or a token; emails -> consider a stable pseudonym.');
}

line('8. retention and the clock');
{
  const now = new Date('2026-08-11T02:15:00.000Z');
  console.log('  ts must be UTC ISO-8601 ->', now.toISOString());
  console.log('  local time  ->', now.toString().slice(0, 33), ' <- ambiguous across DST and hosts');
  console.log('  server clocks drift; a record ordered ONLY by timestamp is not ordered.');
  console.log('  the seq number in the chain is the authority — see phase 7, page 10.');
}

fs.rmSync(dir, { recursive: true, force: true });
