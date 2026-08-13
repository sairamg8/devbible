// Phase 11 pages 01, 02, 03, 09 — ACID concretely, BEGIN/COMMIT/ROLLBACK from pg,
// READ COMMITTED anomalies, savepoints.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 10});
pool.on('error', (e) => console.log('pool error event:', e.code, e.message));
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const ms = (t0) => (Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1);
const sleep = (n) => new Promise(r => setTimeout(r, n));
const err = (e) => `${e.code} ${e.message}`;

// --- 0. fixture -------------------------------------------------------------
await q(`DROP TABLE IF EXISTS t_acct`);
await q(`CREATE TABLE t_acct (
           id int PRIMARY KEY, owner text NOT NULL,
           balance int NOT NULL CHECK (balance >= 0))`);
await q(`INSERT INTO t_acct VALUES (1,'ann',100), (2,'bob',100)`);

// --- 1. Atomicity: the whole transaction, or none of it ---------------------
line('1. atomicity — a failing statement takes the earlier ones with it');
{
  const c = await pool.connect();
  await c.query('BEGIN');
  await c.query(`UPDATE t_acct SET balance = balance - 150 WHERE id = 1`)
    .then(() => console.log('debit 150 from ann: accepted'))
    .catch(e => console.log('debit 150 from ann →', err(e)));
  try { await c.query(`UPDATE t_acct SET balance = balance + 150 WHERE id = 2`); }
  catch (e) { console.log('credit bob →', err(e)); }
  try { await c.query('COMMIT'); } catch (e) { console.log('COMMIT →', err(e)); }
  c.release();
  console.log('balances after:', JSON.stringify((await q(`SELECT id, balance FROM t_acct ORDER BY id`)).rows));
}

// --- 2. Consistency: when the constraint is actually checked ----------------
line('2. consistency — immediate vs DEFERRABLE constraint check');
{
  await q(`DROP TABLE IF EXISTS t_uniq`);
  await q(`CREATE TABLE t_uniq (id int PRIMARY KEY, pos int NOT NULL,
             CONSTRAINT t_uniq_pos UNIQUE (pos) DEFERRABLE INITIALLY IMMEDIATE)`);
  await q(`INSERT INTO t_uniq VALUES (1,1),(2,2)`);

  const c = await pool.connect();
  await c.query('BEGIN');
  try { await c.query(`UPDATE t_uniq SET pos = pos + 1`); }   // 1->2 collides with 2
  catch (e) { console.log('swap with IMMEDIATE check →', err(e)); }
  await c.query('ROLLBACK');

  await c.query('BEGIN');
  await c.query(`SET CONSTRAINTS t_uniq_pos DEFERRED`);
  await c.query(`UPDATE t_uniq SET pos = pos + 1`);
  console.log('same UPDATE with the check DEFERRED: accepted inside the transaction');
  await c.query('COMMIT');
  console.log('rows after commit:', JSON.stringify((await q(`SELECT * FROM t_uniq ORDER BY id`)).rows));
  c.release();
}

// --- 3. Durability: WAL advances, and what synchronous_commit costs ---------
line('3. durability — WAL LSN, and the price of synchronous_commit');
{
  const before = (await q(`SELECT pg_current_wal_lsn() AS l`)).rows[0].l;
  await q(`UPDATE t_acct SET balance = balance WHERE id = 1`);
  const after = (await q(`SELECT pg_current_wal_lsn() AS l`)).rows[0].l;
  const diff = (await q(`SELECT pg_wal_lsn_diff($1,$2)::bigint AS b`, [after, before])).rows[0].b;
  console.log(`WAL lsn ${before} -> ${after}  (${diff} bytes for one UPDATE)`);

  await q(`DROP TABLE IF EXISTS t_wal`);
  await q(`CREATE TABLE t_wal (id serial PRIMARY KEY, v int)`);
  for (const mode of ['on', 'off']) {
    const c = await pool.connect();
    await c.query(`SET synchronous_commit = ${mode}`);
    await c.query(`INSERT INTO t_wal (v) VALUES (0)`);          // warm
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 500; i++) await c.query(`INSERT INTO t_wal (v) VALUES ($1)`, [i]);
    console.log(`500 single-row commits, synchronous_commit=${mode}: ${ms(t0)} ms`);
    c.release();
  }
  const wrapped = await pool.connect();
  await wrapped.query(`SET synchronous_commit = on`);
  await wrapped.query('BEGIN');
  const t1 = process.hrtime.bigint();
  for (let i = 0; i < 500; i++) await wrapped.query(`INSERT INTO t_wal (v) VALUES ($1)`, [i]);
  await wrapped.query('COMMIT');
  console.log(`same 500 inserts inside ONE transaction (sync on): ${ms(t1)} ms`);
  wrapped.release();
}

// --- 4. pg is autocommit; BEGIN on the pool is the classic bug --------------
line('4. autocommit, and why BEGIN must go to a client not a pool');
{
  console.log('isolation default:', (await q(`SHOW default_transaction_isolation`)).rows[0].default_transaction_isolation);
  await q(`UPDATE t_acct SET balance = 100 WHERE id = 1`);

  // (a) each pool.query is its own transaction — no rollback possible
  const x1 = (await q(`SELECT txid_current() AS t`)).rows[0].t;
  const x2 = (await q(`SELECT txid_current() AS t`)).rows[0].t;
  console.log(`two pool.query calls -> xid ${x1} and ${x2} (different transactions)`);

  // (b) BEGIN issued on the pool, with an idle pool: it happens to work
  await pool.query('BEGIN');
  await pool.query(`UPDATE t_acct SET balance = 0 WHERE id = 1`);
  await pool.query('ROLLBACK');
  console.log('serial BEGIN/UPDATE/ROLLBACK via pool.query, ann balance:',
    (await q(`SELECT balance FROM t_acct WHERE id = 1`)).rows[0].balance, '<- rolled back, by luck');

  // (c) the same three calls with one other query in flight: they split up
  await q(`UPDATE t_acct SET balance = 100 WHERE id = 1`);
  const pidOf = async (sql) => (await pool.query(`${sql}; SELECT pg_backend_pid() AS pid`)).at(-1).rows[0].pid;
  const pBegin = await pidOf('BEGIN');
  const busy = pool.query(`SELECT pg_sleep(0.4)`);          // occupies the connection that has the open BEGIN
  await sleep(60);
  const pUpd = await pidOf(`UPDATE t_acct SET balance = 0 WHERE id = 1`);
  const pRb = await pidOf('ROLLBACK');
  await busy;
  console.log(`BEGIN on backend ${pBegin} · UPDATE on backend ${pUpd} · ROLLBACK on backend ${pRb}`);
  console.log('  ann balance after the "rollback":',
    (await q(`SELECT balance FROM t_acct WHERE id = 1`)).rows[0].balance,
    pUpd === pBegin ? '' : '<- the UPDATE ran on another connection and autocommitted');

  const st = await q(`SELECT state, count(*)::int AS n FROM pg_stat_activity
                      WHERE datname = 'devbible' GROUP BY state ORDER BY state`);
  console.log('  pg_stat_activity now:', JSON.stringify(st.rows));
  await q(`UPDATE t_acct SET balance = 100 WHERE id = 1`);
}

// --- 5. an error poisons the whole transaction ------------------------------
line('5. one error aborts the transaction — 25P02 until you roll back');
{
  const c = await pool.connect();
  await c.query('BEGIN');
  await c.query(`UPDATE t_acct SET balance = 50 WHERE id = 1`);
  try { await c.query(`SELECT 1/0`); } catch (e) { console.log('the failing statement →', err(e)); }
  try { await c.query(`SELECT 1`); } catch (e) { console.log('a perfectly valid SELECT after it →', err(e)); }
  const res = await c.query('COMMIT');
  console.log('COMMIT on an aborted transaction returns:', res.command,
    '| ann balance:', (await q(`SELECT balance FROM t_acct WHERE id = 1`)).rows[0].balance);
  c.release();
}

// --- 6. stray BEGIN / ROLLBACK: warnings, not errors ------------------------
line('6. nested BEGIN and stray ROLLBACK are warnings');
{
  const c = await pool.connect();
  c.on('notice', (n) => console.log('  NOTICE/WARNING:', n.severity, n.code, n.message));
  await c.query('BEGIN');
  await c.query('BEGIN');
  await c.query('COMMIT');
  await c.query('ROLLBACK');
  await sleep(50);
  c.release();
}

// --- 7. READ COMMITTED anomalies -------------------------------------------
line('7. READ COMMITTED — non-repeatable read and phantom read');
{
  await q(`UPDATE t_acct SET balance = 100 WHERE id = 1`);
  await q(`DELETE FROM t_acct WHERE id > 2`);
  const reader = await pool.connect();
  const writer = await pool.connect();
  await reader.query('BEGIN');            // default READ COMMITTED
  console.log('reader, first look :', (await reader.query(`SELECT balance FROM t_acct WHERE id=1`)).rows[0].balance);
  console.log('reader, row count  :', (await reader.query(`SELECT count(*)::int AS n FROM t_acct`)).rows[0].n);

  await writer.query(`UPDATE t_acct SET balance = 999 WHERE id = 1`);
  await writer.query(`INSERT INTO t_acct VALUES (3,'cid',10)`);

  console.log('reader, same query :', (await reader.query(`SELECT balance FROM t_acct WHERE id=1`)).rows[0].balance,
    '  <- non-repeatable read');
  console.log('reader, row count  :', (await reader.query(`SELECT count(*)::int AS n FROM t_acct`)).rows[0].n,
    '  <- phantom row');
  await reader.query('COMMIT');
  reader.release(); writer.release();
}

// --- 8. the snapshot is per-STATEMENT under READ COMMITTED ------------------
line('8. one statement = one snapshot, however long it runs');
{
  await q(`DROP TABLE IF EXISTS t_slow`);
  await q(`CREATE TABLE t_slow AS SELECT g AS id, 0 AS v FROM generate_series(1,5) g`);
  const slow = await pool.connect();
  const fast = await pool.connect();
  const running = slow.query(`SELECT id, v, pg_sleep(0.4) IS NULL AS slept FROM t_slow ORDER BY id`);
  await sleep(300);
  await fast.query(`UPDATE t_slow SET v = 99`);
  const r = await running;
  console.log('rows seen by the long statement:', JSON.stringify(r.rows.map(x => x.v)),
    '<- all pre-update, though the UPDATE committed mid-scan');
  console.log('same query, next statement      :',
    JSON.stringify((await slow.query(`SELECT v FROM t_slow ORDER BY id`)).rows.map(x => x.v)));
  slow.release(); fast.release();
}

// --- 9. UPDATE re-reads the newest committed row version --------------------
line('9. UPDATE under READ COMMITTED sees a NEWER row than the SELECT did');
{
  await q(`DROP TABLE IF EXISTS t_stock`);
  await q(`CREATE TABLE t_stock (id int PRIMARY KEY, qty int, status text)`);
  await q(`INSERT INTO t_stock VALUES (1, 10, 'open')`);

  const a = await pool.connect(), b = await pool.connect();
  await a.query('BEGIN');
  await a.query(`UPDATE t_stock SET status = 'closed' WHERE id = 1`);   // holds the row lock

  // b's UPDATE blocks, then re-checks its WHERE clause against the new version
  const bq = b.query(`UPDATE t_stock SET qty = qty - 1 WHERE id = 1 AND status = 'open'`);
  await sleep(200);
  const waiting = await q(`SELECT wait_event_type, wait_event, left(query,48) AS q
                           FROM pg_stat_activity WHERE datname='devbible' AND wait_event_type='Lock'`);
  console.log('while blocked:', JSON.stringify(waiting.rows));
  await a.query('COMMIT');
  const res = await bq;
  console.log(`b's UPDATE after a committed: rowCount = ${res.rowCount}`,
    '<- the WHERE was re-evaluated against status=closed');
  console.log('final row:', JSON.stringify((await q(`SELECT * FROM t_stock`)).rows[0]));
  a.release(); b.release();
}

// --- 10. savepoints ---------------------------------------------------------
line('10. savepoints — partial rollback and recovering from an error');
{
  await q(`DROP TABLE IF EXISTS t_sp`);
  await q(`CREATE TABLE t_sp (id int PRIMARY KEY, v text)`);
  const c = await pool.connect();
  await c.query('BEGIN');
  await c.query(`INSERT INTO t_sp VALUES (1,'keep')`);
  await c.query('SAVEPOINT sp1');
  await c.query(`INSERT INTO t_sp VALUES (2,'discard')`);
  await c.query('ROLLBACK TO SAVEPOINT sp1');
  await c.query(`INSERT INTO t_sp VALUES (3,'after')`);
  await c.query('COMMIT');
  console.log('rows:', JSON.stringify((await q(`SELECT * FROM t_sp ORDER BY id`)).rows));

  // a savepoint turns a fatal statement error into a recoverable one
  await c.query('BEGIN');
  await c.query(`INSERT INTO t_sp VALUES (4,'ok')`);
  await c.query('SAVEPOINT risky');
  try { await c.query(`INSERT INTO t_sp VALUES (1,'dup')`); }
  catch (e) { console.log('duplicate insert →', err(e)); await c.query('ROLLBACK TO SAVEPOINT risky'); }
  await c.query(`INSERT INTO t_sp VALUES (5,'still works')`);
  await c.query('COMMIT');
  console.log('rows:', JSON.stringify((await q(`SELECT * FROM t_sp ORDER BY id`)).rows.map(r => r.id)));

  // RELEASE, and what a rolled-back savepoint costs
  await c.query('BEGIN');
  await c.query('SAVEPOINT s');
  await c.query('RELEASE SAVEPOINT s');
  try { await c.query('ROLLBACK TO SAVEPOINT s'); }
  catch (e) { console.log('ROLLBACK TO a released savepoint →', err(e)); }
  await c.query('ROLLBACK');
  c.release();
}

// --- 11. what savepoints cost ----------------------------------------------
line('11. the cost of one savepoint per statement');
{
  await q(`DROP TABLE IF EXISTS t_spcost`);
  await q(`CREATE TABLE t_spcost (id serial PRIMARY KEY, v int)`);
  for (const useSp of [false, true]) {
    const c = await pool.connect();
    await c.query('BEGIN');
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 2000; i++) {
      if (useSp) await c.query(`SAVEPOINT s${i}`);
      await c.query(`INSERT INTO t_spcost (v) VALUES ($1)`, [i]);
      if (useSp) await c.query(`RELEASE SAVEPOINT s${i}`);
    }
    const t = ms(t0);
    await c.query('COMMIT');
    console.log(`2000 inserts ${useSp ? 'wrapped in SAVEPOINT/RELEASE' : 'plain                     '}: ${t} ms`);
    c.release();
  }
  // every savepoint that writes burns a real transaction id of its own
  await q(`DROP TABLE IF EXISTS t_subxid`);
  await q(`CREATE TABLE t_subxid (id int, tag text)`);
  const sub = await pool.connect();
  await sub.query('BEGIN');
  const top = (await sub.query(`SELECT pg_current_xact_id() AS t`)).rows[0].t;
  await sub.query(`INSERT INTO t_subxid VALUES (0,'top')`);
  for (let i = 1; i <= 4; i++) {
    await sub.query(`SAVEPOINT n${i}`);
    await sub.query(`INSERT INTO t_subxid VALUES ($1,'sp')`, [i]);
  }
  const xmins = await sub.query(`SELECT id, xmin::text FROM t_subxid ORDER BY id`);
  console.log('top-level xid:', top, '| xmin per row:', JSON.stringify(xmins.rows));
  const spSlots = await sub.query(`SELECT backend_xid::text AS bx, backend_xmin::text AS bm
                                   FROM pg_stat_activity WHERE pid = pg_backend_pid()`);
  console.log('backend_xid seen by pg_stat_activity:', JSON.stringify(spSlots.rows[0]));
  await sub.query('COMMIT');
  sub.release();
}

await pool.end();
