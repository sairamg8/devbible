// Phase 7 pages 14,15,16 — LISTEN/NOTIFY, cursors, postgres.js.
import pg from 'pg';
import Cursor from 'pg-cursor';
import postgres from 'postgres';

const URL = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const line = (t) => console.log(`\n=== ${t} ===`);
const pool = new pg.Pool({connectionString: URL, max: 5});
const q = (...a) => pool.query(...a);

// --- 1. LISTEN / NOTIFY ----------------------------------------------------
line('1. LISTEN / NOTIFY needs a dedicated Client');
{
  const listener = new pg.Client({connectionString: URL});
  await listener.connect();
  const got = [];
  listener.on('notification', n => got.push({channel: n.channel, payload: n.payload, from: n.processId}));
  await listener.query('LISTEN jobs');

  await q(`NOTIFY jobs, 'from-pool'`);
  await q(`SELECT pg_notify('jobs', $1)`, ['via-pg_notify']);
  await new Promise(r => setTimeout(r, 300));
  console.log('received:', got);

  // delivery is on COMMIT, not on NOTIFY
  got.length = 0;
  const c = await pool.connect();
  await c.query('BEGIN');
  await c.query(`NOTIFY jobs, 'inside-tx'`);
  await new Promise(r => setTimeout(r, 250));
  console.log('after NOTIFY, before COMMIT →', got.length, 'notifications');
  await c.query('COMMIT');
  await new Promise(r => setTimeout(r, 250));
  console.log('after COMMIT                →', got.length, 'notifications:', got.map(g => g.payload));
  c.release();

  // rolled back NOTIFY is never delivered
  got.length = 0;
  const c2 = await pool.connect();
  await c2.query('BEGIN');
  await c2.query(`NOTIFY jobs, 'rolled-back'`);
  await c2.query('ROLLBACK');
  await new Promise(r => setTimeout(r, 250));
  console.log('after ROLLBACK              →', got.length, 'notifications');
  c2.release();

  // duplicate notifications inside one transaction are folded
  got.length = 0;
  const c3 = await pool.connect();
  await c3.query('BEGIN');
  for (let i = 0; i < 3; i++) await c3.query(`NOTIFY jobs, 'same'`);
  await c3.query(`NOTIFY jobs, 'different'`);
  await c3.query('COMMIT');
  await new Promise(r => setTimeout(r, 250));
  console.log('3 identical + 1 different   →', got.length, 'delivered:', got.map(g => g.payload));
  c3.release();

  // payload limit
  try { await q(`SELECT pg_notify('jobs', repeat('x', 8000))`); }
  catch (e) { console.log('8000-byte payload →', e.code, e.message.split('\n')[0]); }

  // what the pool CANNOT do: LISTEN on a pooled connection is useless
  await q('LISTEN pooled_channel');
  got.length = 0;
  await q(`NOTIFY pooled_channel, 'x'`);
  await new Promise(r => setTimeout(r, 250));
  console.log('LISTEN issued via pool.query → the connection went back to the pool;',
    'no handler is attached, notifications are lost');

  await listener.query('UNLISTEN jobs');
  await listener.end();
}

// --- 2. cursors ------------------------------------------------------------
line('2. streaming a large result');
{
  await q(`DROP TABLE IF EXISTS cur_t`);
  await q(`CREATE TABLE cur_t (id bigint, junk text)`);
  await q(`INSERT INTO cur_t SELECT g, repeat('x',200) FROM generate_series(1,300000) g`);

  const mb = () => Math.round(process.memoryUsage().heapUsed / 1048576);
  const settle = async () => { global.gc?.(); await new Promise(r => setTimeout(r, 100)); global.gc?.(); };

  await settle();
  const base = mb();
  let all = await q(`SELECT * FROM cur_t`);
  const afterAll = mb();
  const count = all.rowCount;
  all = null;                                   // drop the reference before the next test
  await settle();
  console.log(`baseline heap ${base} MB`);
  console.log(`pool.query  → ${count} rows buffered, heap ${base} → ${afterAll} MB (+${afterAll - base})`);
  console.log(`  after releasing it and collecting: ${mb()} MB`);

  await settle();
  const cBase = mb();
  const c = await pool.connect();
  const cursor = c.query(new Cursor(`SELECT * FROM cur_t`));
  let seen = 0, batches = 0, peak = cBase;
  for (;;) {
    const rows = await cursor.read(1000);
    if (!rows.length) break;
    seen += rows.length; batches++;
    peak = Math.max(peak, mb());
  }
  await cursor.close();
  c.release();
  console.log(`pg-cursor   → ${seen} rows in ${batches} batches of 1000, heap ${cBase} → peak ${peak} MB (+${peak - cBase})`);

  // a server-side cursor requires a transaction to outlive the statement
  const c2 = await pool.connect();
  await c2.query('BEGIN');
  await c2.query(`DECLARE srv_cur CURSOR FOR SELECT id FROM cur_t`);
  const f1 = await c2.query('FETCH 3 FROM srv_cur');
  console.log('DECLARE/FETCH →', f1.rows.map(r => r.id).join(','));
  await c2.query('COMMIT');
  try { await c2.query('FETCH 3 FROM srv_cur'); }
  catch (e) { console.log('FETCH after COMMIT →', e.code, e.message.split('\n')[0]); }
  c2.release();
}

// --- 3. postgres.js for comparison -----------------------------------------
line('3. postgres.js — the same work, a different shape');
{
  const sql = postgres(URL, {max: 2});
  const min = 1, name = 'x';

  const rows = await sql`SELECT id, junk FROM cur_t WHERE id <= ${5} ORDER BY id`;
  console.log('tagged template →', rows.length, 'rows; result is an Array:', Array.isArray(rows),
    '| .count =', rows.count);
  console.log('  the interpolation is a PARAMETER, not string concatenation');

  const t = await sql`SELECT 9007199254740993::int8 AS big, '10.50'::numeric AS num,
                             '2026-08-12'::date AS d, ARRAY['a','b'] AS arr`;
  const r = t[0];
  console.log('types →', {
    big: `${typeof r.big} ${JSON.stringify(r.big)}`,
    num: `${typeof r.num} ${JSON.stringify(r.num)}`,
    d: r.d?.constructor?.name, arr: Array.isArray(r.arr)});

  // identifiers get their own helper
  const col = 'id';
  const dyn = await sql`SELECT ${sql(col)} FROM cur_t ORDER BY id LIMIT 2`;
  console.log('sql(identifier) →', JSON.stringify(dyn));

  // injection attempt through the template
  const evil = `1; DROP TABLE cur_t; --`;
  const safe = await sql`SELECT count(*)::int AS n FROM cur_t WHERE junk = ${evil}`;
  console.log('injection payload as a value →', safe[0].n, 'rows; table still there:',
    (await sql`SELECT to_regclass('cur_t') AS t`)[0].t);

  await sql.end();
}

await q(`DROP TABLE IF EXISTS cur_t`);
await pool.end();
