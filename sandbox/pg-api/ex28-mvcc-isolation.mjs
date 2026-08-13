// Phase 11 pages 04, 05, 06 — MVCC row versions and snapshots, the lost update and
// its four fixes, REPEATABLE READ / SERIALIZABLE and the 40001 retry loop.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 25});
pool.on('error', (e) => console.log('pool error event:', e.code, e.message));
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const ms = (t0) => (Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1);
const sleep = (n) => new Promise(r => setTimeout(r, n));
const err = (e) => `${e.code} ${e.message}`;
const size = async (rel) => (await q(`SELECT pg_size_pretty(pg_relation_size($1)) AS s`, [rel])).rows[0].s;

// --- 1. an UPDATE writes a new row version; the old one stays ---------------
line('1. UPDATE = a new row version, and the old one is only marked dead');
{
  await q(`DROP TABLE IF EXISTS m_row`);
  await q(`CREATE TABLE m_row (id int PRIMARY KEY, v int)`);
  await q(`INSERT INTO m_row VALUES (1, 10)`);
  const show = async (tag) => {
    const r = await q(`SELECT ctid::text, xmin::text, xmax::text, v FROM m_row WHERE id = 1`);
    console.log(tag.padEnd(18), JSON.stringify(r.rows[0]));
  };
  await show('after INSERT');
  await q(`UPDATE m_row SET v = 20 WHERE id = 1`);
  await show('after UPDATE');
  await q(`UPDATE m_row SET v = 30 WHERE id = 1`);
  await show('after 2nd UPDATE');

  const c = await pool.connect();
  await c.query('BEGIN');
  await c.query(`DELETE FROM m_row WHERE id = 1`);
  const inTx = await c.query(`SELECT ctid::text, xmin::text, xmax::text FROM m_row WHERE id = 1`);
  console.log('mid-DELETE, own view :', inTx.rowCount, 'rows');
  const other = await q(`SELECT ctid::text, xmin::text, xmax::text FROM m_row WHERE id = 1`);
  console.log('mid-DELETE, other tx :', JSON.stringify(other.rows[0]), '<- xmax set, still visible elsewhere');
  await c.query('ROLLBACK');
  console.log('after ROLLBACK       :', (await q(`SELECT v FROM m_row WHERE id=1`)).rows[0].v);
  c.release();
}

// --- 2. readers never block writers, writers never block readers ------------
line('2. a reader in a transaction does not block a writer (and vice versa)');
{
  const reader = await pool.connect(), writer = await pool.connect();
  await reader.query('BEGIN');
  await reader.query(`SELECT * FROM m_row`);
  const t0 = process.hrtime.bigint();
  await writer.query(`UPDATE m_row SET v = v + 1`);
  console.log(`UPDATE while a reader holds an open transaction: ${ms(t0)} ms (no wait)`);
  await reader.query('COMMIT');
  reader.release(); writer.release();
}

// --- 3. snapshots: what a transaction can see -------------------------------
line('3. the snapshot — xmin, xmax and the in-progress list');
{
  const obs = await pool.connect(), b = await pool.connect(), c = await pool.connect();
  const snap = async (tag) =>
    console.log(tag.padEnd(34), (await obs.query(`SELECT pg_current_snapshot()::text AS s`)).rows[0].s);

  await snap('nothing running');
  await b.query('BEGIN');
  const bx = (await b.query(`SELECT pg_current_xact_id() AS x`)).rows[0].x;
  await snap(`b (older, xid ${bx}) open`);
  await c.query('BEGIN');
  const cx = (await c.query(`SELECT pg_current_xact_id() AS x`)).rows[0].x;
  await snap(`b ${bx} and c ${cx} both open`);
  await c.query('COMMIT');                       // the YOUNGER one commits first
  await snap(`c ${cx} committed, b ${bx} open`);
  await b.query('COMMIT');
  await snap('both committed');
  console.log(`  format is xmin:xmax:in-progress. xmax is one past the last COMPLETED`);
  console.log(`  transaction, so ${cx} needed no list entry while it was the newest — but`);
  console.log(`  once it committed ahead of ${bx}, the older ${bx} had to be listed explicitly.`);

  // an old open transaction is what holds the xmin horizon down
  await b.query('BEGIN');
  await b.query(`SELECT pg_current_xact_id()`);
  const horizon = await q(`SELECT backend_xid::text AS bx, backend_xmin::text AS bm, state
                           FROM pg_stat_activity WHERE datname='devbible' AND backend_xid IS NOT NULL`);
  console.log('  backends holding an xid:', JSON.stringify(horizon.rows));
  await b.query('COMMIT');
  obs.release(); b.release(); c.release();
}

// --- 4. HOT updates: when a new version stays off the index -----------------
line('4. HOT updates — an indexed column changes everything');
{
  const cases = [
    ['fillfactor 100 (default), no index on v', 'm_hot_a', 100, false],
    ['fillfactor 70,             no index on v', 'm_hot_b', 70, false],
    ['fillfactor 70,   index ON the updated col', 'm_hot_c', 70, true],
  ];
  for (const [label, t, ff, indexed] of cases) {
    await q(`DROP TABLE IF EXISTS ${t}`);
    await q(`CREATE TABLE ${t} (id int PRIMARY KEY, v int, pad text) WITH (fillfactor = ${ff})`);
    await q(`INSERT INTO ${t} SELECT g, 0, repeat('x',40) FROM generate_series(1,50000) g`);
    if (indexed) await q(`CREATE INDEX ON ${t} (v)`);
    await q(`VACUUM ANALYZE ${t}`);
    const before = await size(t);
    for (let i = 0; i < 5; i++) await q(`UPDATE ${t} SET v = v + 1`);
    await q(`SELECT pg_stat_force_next_flush()`);
    const st = (await q(`SELECT n_tup_upd, n_tup_hot_upd, n_dead_tup
                         FROM pg_stat_user_tables WHERE relname = $1`, [t])).rows[0];
    const pct = ((st.n_tup_hot_upd / st.n_tup_upd) * 100).toFixed(1);
    console.log(`${label}: ${before} -> ${(await size(t)).padStart(6)} | ` +
      `upd ${st.n_tup_upd} hot ${st.n_tup_hot_upd} (${pct}%)`);
  }
}

// --- 5. the lost update, and four fixes -------------------------------------
line('5. lost update — 20 concurrent read-modify-writes');
{
  const reset = async () => {
    await q(`DROP TABLE IF EXISTS m_ctr`);
    await q(`CREATE TABLE m_ctr (id int PRIMARY KEY, qty int, version int DEFAULT 1)`);
    await q(`INSERT INTO m_ctr VALUES (1, 0, 1)`);
  };
  const N = 20;
  const runAll = async (fn) => {
    const out = await Promise.all(Array.from({length: N}, (_, i) => fn(i)));
    return out;
  };

  // (a) read, modify, write — the bug
  await reset();
  await runAll(async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const cur = (await c.query(`SELECT qty FROM m_ctr WHERE id = 1`)).rows[0].qty;
      await sleep(10);
      await c.query(`UPDATE m_ctr SET qty = $1 WHERE id = 1`, [cur + 1]);
      await c.query('COMMIT');
    } finally { c.release(); }
  });
  console.log(`(a) SELECT then UPDATE, ${N} concurrent : qty =`,
    (await q(`SELECT qty FROM m_ctr WHERE id=1`)).rows[0].qty, ' <- writes lost, no error');

  // (b) let the database do the arithmetic
  await reset();
  let t0 = process.hrtime.bigint();
  await runAll(() => q(`UPDATE m_ctr SET qty = qty + 1 WHERE id = 1`));
  console.log(`(b) UPDATE ... SET qty = qty + 1        : qty =`,
    (await q(`SELECT qty FROM m_ctr WHERE id=1`)).rows[0].qty, `| ${ms(t0)} ms`);

  // (c) SELECT ... FOR UPDATE
  await reset();
  t0 = process.hrtime.bigint();
  await runAll(async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const cur = (await c.query(`SELECT qty FROM m_ctr WHERE id = 1 FOR UPDATE`)).rows[0].qty;
      await c.query(`UPDATE m_ctr SET qty = $1 WHERE id = 1`, [cur + 1]);
      await c.query('COMMIT');
    } finally { c.release(); }
  });
  console.log(`(c) SELECT ... FOR UPDATE then UPDATE   : qty =`,
    (await q(`SELECT qty FROM m_ctr WHERE id=1`)).rows[0].qty, `| ${ms(t0)} ms`);

  // (d) optimistic locking on a version column
  await reset();
  let retries = 0;
  t0 = process.hrtime.bigint();
  await runAll(async () => {
    for (;;) {
      const row = (await q(`SELECT qty, version FROM m_ctr WHERE id = 1`)).rows[0];
      const r = await q(`UPDATE m_ctr SET qty = $1, version = version + 1
                         WHERE id = 1 AND version = $2`, [row.qty + 1, row.version]);
      if (r.rowCount === 1) return;
      retries++;
    }
  });
  console.log(`(d) optimistic version column          : qty =`,
    (await q(`SELECT qty FROM m_ctr WHERE id=1`)).rows[0].qty, `| ${retries} retries | ${ms(t0)} ms`);

  // (e) REPEATABLE READ — the database refuses instead of losing the write
  await reset();
  let serialErrs = 0, done = 0;
  await runAll(async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      const cur = (await c.query(`SELECT qty FROM m_ctr WHERE id = 1`)).rows[0].qty;
      await sleep(10);
      await c.query(`UPDATE m_ctr SET qty = $1 WHERE id = 1`, [cur + 1]);
      await c.query('COMMIT');
      done++;
    } catch (e) {
      serialErrs++;
      if (serialErrs === 1) console.log('    first failure →', err(e));
      await c.query('ROLLBACK').catch(() => {});
    } finally { c.release(); }
  });
  console.log(`(e) REPEATABLE READ, no retry          : qty =`,
    (await q(`SELECT qty FROM m_ctr WHERE id=1`)).rows[0].qty,
    `| ${done} committed, ${serialErrs} rejected  <- lost writes became errors`);
}

// --- 6. REPEATABLE READ: a stable snapshot ----------------------------------
line('6. REPEATABLE READ — same query, same answer, all transaction long');
{
  await q(`DROP TABLE IF EXISTS m_rr`);
  await q(`CREATE TABLE m_rr (id int PRIMARY KEY, v int)`);
  await q(`INSERT INTO m_rr VALUES (1,100),(2,100)`);
  const r = await pool.connect(), w = await pool.connect();
  await r.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  console.log('reader first look :', JSON.stringify((await r.query(`SELECT id,v FROM m_rr ORDER BY id`)).rows));
  await w.query(`UPDATE m_rr SET v = 999 WHERE id = 1`);
  await w.query(`INSERT INTO m_rr VALUES (3, 7)`);
  console.log('reader after both :', JSON.stringify((await r.query(`SELECT id,v FROM m_rr ORDER BY id`)).rows),
    '<- no non-repeatable read, no phantom');
  await r.query('COMMIT');
  console.log('reader after COMMIT:', JSON.stringify((await r.query(`SELECT id,v FROM m_rr ORDER BY id`)).rows));

  // setting the level too late
  await r.query('BEGIN');
  await r.query(`SELECT 1`);
  try { await r.query(`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`); }
  catch (e) { console.log('SET ISOLATION after the first query →', err(e)); }
  await r.query('ROLLBACK');
  r.release(); w.release();
}

// --- 7. write skew: what REPEATABLE READ still allows -----------------------
line('7. write skew — REPEATABLE READ allows it, SERIALIZABLE does not');
{
  await q(`DROP TABLE IF EXISTS m_oncall`);
  await q(`CREATE TABLE m_oncall (name text PRIMARY KEY, on_call boolean)`);
  const reset = () => q(`TRUNCATE m_oncall`).then(() =>
    q(`INSERT INTO m_oncall VALUES ('ann',true),('bob',true)`));

  for (const level of ['REPEATABLE READ', 'SERIALIZABLE']) {
    await reset();
    const a = await pool.connect(), b = await pool.connect();
    await a.query(`BEGIN ISOLATION LEVEL ${level}`);
    await b.query(`BEGIN ISOLATION LEVEL ${level}`);
    // both check "is anyone else on call?" — both see 2, both go off call
    const ca = (await a.query(`SELECT count(*)::int AS n FROM m_oncall WHERE on_call`)).rows[0].n;
    const cb = (await b.query(`SELECT count(*)::int AS n FROM m_oncall WHERE on_call`)).rows[0].n;
    await a.query(`UPDATE m_oncall SET on_call = false WHERE name = 'ann'`);
    await b.query(`UPDATE m_oncall SET on_call = false WHERE name = 'bob'`);
    let outcome = 'both committed';
    try { await a.query('COMMIT'); } catch (e) { outcome = `a: ${err(e)}`; }
    try { await b.query('COMMIT'); } catch (e) { outcome = `b: ${err(e)}`; await b.query('ROLLBACK').catch(()=>{}); }
    const left = (await q(`SELECT count(*)::int AS n FROM m_oncall WHERE on_call`)).rows[0].n;
    console.log(`${level.padEnd(15)} both saw ${ca}/${cb} on call -> ${outcome} | still on call: ${left}`);
    a.release(); b.release();
  }
}

// --- 8. a retry loop is the whole story for SERIALIZABLE --------------------
line('8. SERIALIZABLE with a retry loop — 20 concurrent transfers');
{
  await q(`DROP TABLE IF EXISTS m_bank`);
  await q(`CREATE TABLE m_bank (id int PRIMARY KEY, balance int NOT NULL)`);
  await q(`INSERT INTO m_bank VALUES (1,1000),(2,1000)`);
  let attempts = 0, retried = 0;
  const transfer = async (from, to, amt) => {
    for (let tryNo = 1; ; tryNo++) {
      const c = await pool.connect();
      try {
        attempts++;
        await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        const bal = (await c.query(`SELECT balance FROM m_bank WHERE id = $1`, [from])).rows[0].balance;
        if (bal < amt) { await c.query('ROLLBACK'); return 'declined'; }
        await c.query(`UPDATE m_bank SET balance = balance - $1 WHERE id = $2`, [amt, from]);
        await c.query(`UPDATE m_bank SET balance = balance + $1 WHERE id = $2`, [amt, to]);
        await c.query('COMMIT');
        return 'ok';
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        if (e.code !== '40001' && e.code !== '40P01') throw e;
        retried++;
        await sleep(5 * tryNo);
      } finally { c.release(); }
    }
  };
  const t0 = process.hrtime.bigint();
  await Promise.all(Array.from({length: 20}, (_, i) =>
    transfer(i % 2 ? 1 : 2, i % 2 ? 2 : 1, 10)));
  const serTime = ms(t0);
  console.log(`SERIALIZABLE + retry (backoff 5ms x attempt): ${attempts} attempts, ` +
    `${retried} retries, ${serTime} ms`);
  let rows = (await q(`SELECT id, balance FROM m_bank ORDER BY id`)).rows;
  console.log('  balances:', JSON.stringify(rows), '| total:', rows.reduce((s, r) => s + r.balance, 0));

  // the same workload done with row locks taken in a fixed order
  await q(`UPDATE m_bank SET balance = 1000`);
  let lockAttempts = 0;
  const transferLocked = async (from, to, amt) => {
    const c = await pool.connect();
    try {
      lockAttempts++;
      await c.query('BEGIN');
      const [lo, hi] = from < to ? [from, to] : [to, from];    // fixed lock order
      const bals = (await c.query(`SELECT id, balance FROM m_bank WHERE id IN ($1,$2)
                                   ORDER BY id FOR UPDATE`, [lo, hi])).rows;
      if (bals.find(r => r.id === from).balance < amt) { await c.query('ROLLBACK'); return 'declined'; }
      await c.query(`UPDATE m_bank SET balance = balance - $1 WHERE id = $2`, [amt, from]);
      await c.query(`UPDATE m_bank SET balance = balance + $1 WHERE id = $2`, [amt, to]);
      await c.query('COMMIT');
    } finally { c.release(); }
  };
  const t1 = process.hrtime.bigint();
  await Promise.all(Array.from({length: 20}, (_, i) =>
    transferLocked(i % 2 ? 1 : 2, i % 2 ? 2 : 1, 10)));
  console.log(`READ COMMITTED + FOR UPDATE in id order    : ${lockAttempts} attempts, ` +
    `0 retries, ${ms(t1)} ms`);
  rows = (await q(`SELECT id, balance FROM m_bank ORDER BY id`)).rows;
  console.log('  balances:', JSON.stringify(rows), '| total:', rows.reduce((s, r) => s + r.balance, 0));
}

await pool.end();
