// Phase 11 pages 07, 08, 10, 11, 15 — row lock modes, SKIP LOCKED queues,
// table locks and DDL, deadlocks, advisory locks.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 30});
pool.on('error', (e) => console.log('pool error event:', e.code, e.message));
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const ms = (t0) => (Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1);
const sleep = (n) => new Promise(r => setTimeout(r, n));
const err = (e) => `${e.code} ${e.message.split('\n')[0]}`;
// pg does NOT reset session state on release() — see section 1b. Every checkout
// from here on starts clean, or a stray SET from an earlier section leaks in.
const conn = async () => { const c = await pool.connect(); await c.query('RESET ALL'); return c; };

// --- 1. the four row-lock modes and what each one blocks --------------------
line('1. row lock modes — which pairs conflict');
{
  await q(`DROP TABLE IF EXISTS l_row CASCADE`);
  await q(`CREATE TABLE l_row (id int PRIMARY KEY, v int)`);
  await q(`INSERT INTO l_row VALUES (1, 1)`);
  const modes = ['FOR UPDATE', 'FOR NO KEY UPDATE', 'FOR SHARE', 'FOR KEY SHARE'];
  console.log('holder \\ requester'.padEnd(20), modes.map(m => m.replace('FOR ', '').padEnd(13)).join(''));
  for (const held of modes) {
    const a = await pool.connect();
    await a.query('BEGIN');
    await a.query(`SELECT * FROM l_row WHERE id = 1 ${held}`);
    const row = [];
    for (const want of modes) {
      const b = await pool.connect();
      try {
        await b.query(`SET lock_timeout = '250ms'`);
        await b.query('BEGIN');
        await b.query(`SELECT * FROM l_row WHERE id = 1 ${want}`);
        row.push('ok');
        await b.query('ROLLBACK');
      } catch (e) { row.push(e.code === '55P03' ? 'BLOCKS' : e.code); await b.query('ROLLBACK').catch(()=>{}); }
      finally { b.release(); }                     // NB: lock_timeout stays set on it

    }
    console.log(held.replace('FOR ', '').padEnd(20), row.map(r => r.padEnd(13)).join(''));
    await a.query('ROLLBACK');
    a.release();
  }
}

// --- 1b. a released pooled connection keeps whatever you SET on it ----------
line('1b. SET survives release() — the pool hands the setting to the next caller');
{
  const c1 = await pool.connect();
  await c1.query(`SET lock_timeout = '250ms'`);
  const pid1 = (await c1.query(`SELECT pg_backend_pid() AS p`)).rows[0].p;
  c1.release();
  const c2 = await pool.connect();
  const [pid2, lt] = Object.values((await c2.query(
    `SELECT pg_backend_pid() AS p, current_setting('lock_timeout') AS lt`)).rows[0]);
  console.log(`connection returned to the pool with lock_timeout=250ms; next checkout ` +
    `(pid ${pid1} -> ${pid2}) sees lock_timeout = ${lt}`);
  await c2.query(`RESET ALL`);
  console.log('after RESET ALL:', (await c2.query(`SELECT current_setting('lock_timeout') AS lt`)).rows[0].lt);
  c2.release();
  // clear every idle connection this script has already touched
  for (const cl of [await pool.connect(), await pool.connect(), await pool.connect(), await pool.connect()]) {
    await cl.query('RESET ALL'); cl.release();
  }
}

// --- 2. waiting, NOWAIT and SKIP LOCKED on the same locked row --------------
line('2. the three ways to react to a locked row');
{
  const holder = await pool.connect();
  await holder.query('RESET ALL');
  await holder.query('BEGIN');
  await holder.query(`SELECT * FROM l_row WHERE id = 1 FOR UPDATE`);

  const other = await pool.connect();
  await other.query('RESET ALL');
  // (a) plain: waits
  const t0 = process.hrtime.bigint();
  const waiting = other.query(`SELECT id FROM l_row WHERE id = 1 FOR UPDATE`)
    .catch(e => console.log('(a) unexpectedly failed →', err(e)));
  await sleep(250);
  const wait = await q(`SELECT wait_event_type, wait_event FROM pg_stat_activity
                        WHERE datname='devbible' AND wait_event_type='Lock'`);
  console.log('(a) plain FOR UPDATE  : still waiting after 250 ms,', JSON.stringify(wait.rows[0]));

  // (b) NOWAIT: immediate error
  const nw = await pool.connect();
  try { await nw.query(`SELECT id FROM l_row WHERE id = 1 FOR UPDATE NOWAIT`); }
  catch (e) { console.log('(b) FOR UPDATE NOWAIT :', err(e)); }
  nw.release();

  // (c) SKIP LOCKED: no error, no row
  const sl = await pool.connect();
  const r = await sl.query(`SELECT id FROM l_row WHERE id = 1 FOR UPDATE SKIP LOCKED`);
  console.log(`(c) FOR UPDATE SKIP LOCKED: no error, rowCount = ${r.rowCount}`);
  sl.release();

  await holder.query('COMMIT');
  await waiting;
  console.log(`(a) resumed once the holder committed, total wait ${ms(t0)} ms`);
  holder.release(); other.release();
}

// --- 3. lock_timeout vs statement_timeout -----------------------------------
line('3. lock_timeout is the safety net for a blocked writer');
{
  const holder = await pool.connect();
  await holder.query('BEGIN');
  await holder.query(`SELECT * FROM l_row WHERE id = 1 FOR UPDATE`);
  for (const [setting, val] of [['lock_timeout', '300ms'], ['statement_timeout', '300ms']]) {
    const c = await pool.connect();
    await c.query(`SET ${setting} = '${val}'`);
    const t0 = process.hrtime.bigint();
    try { await c.query(`UPDATE l_row SET v = v + 1 WHERE id = 1`); }
    catch (e) { console.log(`${setting.padEnd(18)} → ${err(e)} after ${ms(t0)} ms`); }
    c.release();
  }
  await holder.query('ROLLBACK');
  holder.release();
}

// --- 4. a foreign key takes FOR KEY SHARE on the parent ---------------------
line('4. inserting a child row locks the parent key');
{
  await q(`DROP TABLE IF EXISTS l_child`);
  await q(`DROP TABLE IF EXISTS l_parent CASCADE`);
  await q(`CREATE TABLE l_parent (id int PRIMARY KEY, name text)`);
  await q(`CREATE TABLE l_child (id int PRIMARY KEY, parent_id int REFERENCES l_parent(id))`);
  await q(`INSERT INTO l_parent VALUES (1,'p')`);

  const ins = await conn();
  await ins.query('BEGIN');
  await ins.query(`INSERT INTO l_child VALUES (1, 1)`);
  const locks = await q(`SELECT mode FROM pg_locks WHERE relation='l_parent'::regclass AND locktype='tuple'`);
  console.log('locks on the parent tuple while the child insert is open:', JSON.stringify(locks.rows));

  const upd = await conn();
  await upd.query(`SET lock_timeout = '300ms'`);
  try { await upd.query(`UPDATE l_parent SET name = 'renamed' WHERE id = 1`); console.log('UPDATE of a non-key column: ok (not blocked)'); }
  catch (e) { console.log('UPDATE of a non-key column →', err(e)); }
  try { await upd.query(`UPDATE l_parent SET id = 99 WHERE id = 1`); console.log('UPDATE of the key column: ok'); }
  catch (e) { console.log('UPDATE of the KEY column   →', err(e)); }
  await ins.query('ROLLBACK');
  ins.release(); upd.release();
}

// --- 5. SKIP LOCKED as a job queue ------------------------------------------
line('5. SKIP LOCKED job queue — 8 workers, 200 jobs');
{
  const seed = async () => {
    await q(`DROP TABLE IF EXISTS l_jobs`);
    await q(`CREATE TABLE l_jobs (id serial PRIMARY KEY, state text DEFAULT 'ready', worker int)`);
    await q(`INSERT INTO l_jobs (state) SELECT 'ready' FROM generate_series(1,200)`);
    await q(`CREATE INDEX ON l_jobs (state) WHERE state = 'ready'`);
  };
  const run = async (label, claimSql) => {
    await seed();
    const claimed = [];
    const worker = async (w) => {
      for (;;) {
        const c = await conn();
        try {
          await c.query('BEGIN');
          const r = await c.query(claimSql);
          if (r.rowCount === 0) { await c.query('ROLLBACK'); return; }
          await c.query(`UPDATE l_jobs SET state='done', worker=$1 WHERE id=$2`, [w, r.rows[0].id]);
          await c.query('COMMIT');
          claimed.push(r.rows[0].id);
        } catch (e) { await c.query('ROLLBACK').catch(()=>{}); console.log(`  ${label} worker ${w} →`, err(e)); return; }
        finally { c.release(); }
      }
    };
    const t0 = process.hrtime.bigint();
    await Promise.all(Array.from({length: 8}, (_, w) => worker(w)));
    const dupes = claimed.length - new Set(claimed).size;
    const done = (await q(`SELECT count(*)::int AS n FROM l_jobs WHERE state='done'`)).rows[0].n;
    const spread = (await q(`SELECT count(DISTINCT worker)::int AS n FROM l_jobs WHERE state='done'`)).rows[0].n;
    console.log(`${label.padEnd(34)} ${ms(t0).padStart(7)} ms | claimed ${claimed.length}, done ${done}, ` +
      `duplicates ${dupes}, workers used ${spread}`);
  };
  await run('FOR UPDATE SKIP LOCKED',
    `SELECT id FROM l_jobs WHERE state='ready' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`);
  await run('plain FOR UPDATE (serialised)',
    `SELECT id FROM l_jobs WHERE state='ready' ORDER BY id LIMIT 1 FOR UPDATE`);
  await run('no locking at all (broken)',
    `SELECT id FROM l_jobs WHERE state='ready' ORDER BY id LIMIT 1`);
}

// --- 6. table-level locks and DDL -------------------------------------------
line('6. what DDL locks, and for how long');
{
  await q(`DROP TABLE IF EXISTS l_ddl`);
  await q(`CREATE TABLE l_ddl (id int PRIMARY KEY, v text, n int)`);
  await q(`INSERT INTO l_ddl SELECT g, 'v'||g, g FROM generate_series(1,200000) g`);
  const probe = async (label, ddl) => {
    const d = await conn();
    await d.query('BEGIN');
    const t0 = process.hrtime.bigint();
    await d.query(ddl);
    const took = ms(t0);
    const dpid = (await d.query(`SELECT pg_backend_pid() AS p`)).rows[0].p;
    const mode = (await q(`SELECT string_agg(DISTINCT mode, '+') AS m FROM pg_locks
                           WHERE relation = 'l_ddl'::regclass AND pid = $1 AND granted`,
                          [dpid])).rows[0].m ?? '?';
    const r = await conn();
    await r.query(`SET lock_timeout = '300ms'`);
    let readOk;
    try { await r.query(`SELECT count(*) FROM l_ddl`); readOk = 'reads OK'; }
    catch (e) { readOk = `reads BLOCKED (${e.code})`; }
    r.release();
    console.log(`${label.padEnd(38)} ${took.padStart(7)} ms | ${mode.padEnd(22)} | ${readOk}`);
    await d.query('ROLLBACK');
    d.release();
  };
  await probe('ADD COLUMN (no default)', `ALTER TABLE l_ddl ADD COLUMN c1 int`);
  await probe('ADD COLUMN with a constant default', `ALTER TABLE l_ddl ADD COLUMN c2 int NOT NULL DEFAULT 7`);
  await probe('ADD COLUMN with a volatile default', `ALTER TABLE l_ddl ADD COLUMN c3 float8 DEFAULT random()`);
  await probe('ALTER TYPE int -> bigint', `ALTER TABLE l_ddl ALTER COLUMN n TYPE bigint`);
  await probe('ALTER TYPE int -> text', `ALTER TABLE l_ddl ALTER COLUMN n TYPE text`);
  await probe('CREATE INDEX', `CREATE INDEX l_ddl_n_idx ON l_ddl (n)`);
  await probe('DROP COLUMN', `ALTER TABLE l_ddl DROP COLUMN v`);
  await probe('VALIDATE-free CHECK (NOT VALID)', `ALTER TABLE l_ddl ADD CONSTRAINT c_pos CHECK (n > 0) NOT VALID`);
}

// --- 7. the lock queue: one blocked DDL stops every reader behind it ---------
line('7. a blocked ALTER queues everything behind it');
{
  const reader = await conn();
  await reader.query('BEGIN');
  await reader.query(`SELECT count(*) FROM l_ddl`);          // holds ACCESS SHARE

  const ddl = await conn();
  const ddlP = ddl.query(`ALTER TABLE l_ddl ADD COLUMN queued int`).catch(e => console.log('  ddl →', err(e)));
  await sleep(200);

  const late = await conn();
  await late.query(`SET lock_timeout = '400ms'`);
  const t0 = process.hrtime.bigint();
  try { await late.query(`SELECT count(*) FROM l_ddl`); console.log('a plain SELECT behind the ALTER: succeeded'); }
  catch (e) { console.log(`a plain SELECT behind the ALTER → ${err(e)} after ${ms(t0)} ms`); }
  const queue = await q(`SELECT mode, granted FROM pg_locks
                         WHERE relation='l_ddl'::regclass ORDER BY granted DESC, mode`);
  console.log('  lock queue:', JSON.stringify(queue.rows));
  await reader.query('COMMIT');
  await ddlP;
  await q(`ALTER TABLE l_ddl DROP COLUMN IF EXISTS queued`);
  reader.release(); ddl.release(); late.release();
}

// --- 8. deadlock ------------------------------------------------------------
line('8. deadlock — opposite lock order, and the fix');
{
  await q(`DROP TABLE IF EXISTS l_dl`);
  await q(`CREATE TABLE l_dl (id int PRIMARY KEY, v int)`);
  await q(`INSERT INTO l_dl VALUES (1,0),(2,0)`);
  console.log('deadlock_timeout:', (await q(`SHOW deadlock_timeout`)).rows[0].deadlock_timeout);

  let lastDeadlock = null;
  const pair = async (firstA, secondA, firstB, secondB) => {
    const a = await conn(), b = await conn();
    const out = [];
    const tx = async (c, first, second, tag) => {
      try {
        await c.query('BEGIN');
        await c.query(`UPDATE l_dl SET v = v + 1 WHERE id = $1`, [first]);
        await sleep(150);
        await c.query(`UPDATE l_dl SET v = v + 1 WHERE id = $1`, [second]);
        await c.query('COMMIT');
        out.push(`${tag}: committed`);
      } catch (e) {
        if (e.code === '40P01') lastDeadlock = e;
        out.push(`${tag}: ${err(e)}`);
        await c.query('ROLLBACK').catch(()=>{});
      }
    };
    const t0 = process.hrtime.bigint();
    await Promise.all([tx(a, firstA, secondA, 'A'), tx(b, firstB, secondB, 'B')]);
    a.release(); b.release();
    return [out, ms(t0)];
  };

  let [out, t] = await pair(1, 2, 2, 1);
  console.log(`opposite order (A:1->2, B:2->1) after ${t} ms :`, JSON.stringify(out));
  if (lastDeadlock) {
    console.log('  the full error object:');
    console.log(`    code  : ${lastDeadlock.code}\n    msg   : ${lastDeadlock.message}`);
    console.log(lastDeadlock.detail.split('\n').map(l => `    detail: ${l}`).join('\n'));
    console.log(`    hint  : ${lastDeadlock.hint}`);
  }
  [out, t] = await pair(1, 2, 1, 2);
  console.log(`same order     (A:1->2, B:1->2) after ${t} ms :`, JSON.stringify(out));
  console.log('final:', JSON.stringify((await q(`SELECT * FROM l_dl ORDER BY id`)).rows));
}

// --- 9. advisory locks ------------------------------------------------------
line('9. advisory locks — a mutex the database does not tie to a row');
{
  const a = await conn(), b = await conn();
  const KEY = 987654;

  console.log('a takes it   :', (await a.query(`SELECT pg_try_advisory_lock($1) AS ok`, [KEY])).rows[0].ok);
  console.log('b tries      :', (await b.query(`SELECT pg_try_advisory_lock($1) AS ok`, [KEY])).rows[0].ok, '<- no waiting, just false');
  console.log('a takes again:', (await a.query(`SELECT pg_try_advisory_lock($1) AS ok`, [KEY])).rows[0].ok, '<- re-entrant for the same session');

  const held = await q(`SELECT locktype, mode, objid FROM pg_locks WHERE locktype='advisory'`);
  console.log('pg_locks     :', JSON.stringify(held.rows));

  console.log('a unlocks once:', (await a.query(`SELECT pg_advisory_unlock($1) AS ok`, [KEY])).rows[0].ok);
  console.log('b tries again :', (await b.query(`SELECT pg_try_advisory_lock($1) AS ok`, [KEY])).rows[0].ok, '<- still held: it was taken twice');
  await a.query(`SELECT pg_advisory_unlock($1)`, [KEY]);
  console.log('b after the 2nd unlock:', (await b.query(`SELECT pg_try_advisory_lock($1) AS ok`, [KEY])).rows[0].ok);
  await b.query(`SELECT pg_advisory_unlock($1)`, [KEY]);

  // session lock survives COMMIT; xact lock does not
  await a.query('BEGIN');
  await a.query(`SELECT pg_advisory_lock($1)`, [KEY]);
  await a.query('COMMIT');
  console.log('session lock after COMMIT, b sees:',
    (await b.query(`SELECT pg_try_advisory_lock($1) AS ok`, [KEY])).rows[0].ok, '<- still held');
  await a.query(`SELECT pg_advisory_unlock($1)`, [KEY]);
  await b.query(`SELECT pg_advisory_unlock($1)`, [KEY]);

  await a.query('BEGIN');
  await a.query(`SELECT pg_advisory_xact_lock($1)`, [KEY]);
  await a.query('COMMIT');
  console.log('xact lock after COMMIT, b sees   :',
    (await b.query(`SELECT pg_try_advisory_lock($1) AS ok`, [KEY])).rows[0].ok, '<- released automatically');
  await b.query(`SELECT pg_advisory_unlock($1)`, [KEY]);

  // unlocking something you never held
  const bad = await a.query(`SELECT pg_advisory_unlock(11111) AS ok`);
  await sleep(30);
  console.log('unlocking a lock you never held  :', bad.rows[0].ok);

  // the two-int form is a different lock space from the one-bigint form
  await a.query(`SELECT pg_advisory_lock(1, 2)`);
  const both = await q(`SELECT classid, objid, objsubid FROM pg_locks WHERE locktype='advisory'`);
  console.log('pg_advisory_lock(1,2) in pg_locks :', JSON.stringify(both.rows), '(objsubid 2 = two-int form)');
  await a.query(`SELECT pg_advisory_unlock(1, 2)`);
  a.release(); b.release();
}

// --- 10. advisory lock as a single-runner guard -----------------------------
line('10. 10 processes race to run one job — only one should');
{
  await q(`DROP TABLE IF EXISTS l_once`);
  await q(`CREATE TABLE l_once (id serial PRIMARY KEY, who int, at timestamptz DEFAULT now())`);
  let ran = 0, skipped = 0;
  await Promise.all(Array.from({length: 10}, async (_, i) => {
    const c = await conn();
    try {
      const got = (await c.query(`SELECT pg_try_advisory_lock(424242) AS ok`)).rows[0].ok;
      if (!got) { skipped++; return; }
      await sleep(80);
      await c.query(`INSERT INTO l_once (who) VALUES ($1)`, [i]);
      ran++;
      await c.query(`SELECT pg_advisory_unlock(424242)`);
    } finally { c.release(); }
  }));
  console.log(`ran: ${ran}, skipped: ${skipped}, rows written:`,
    (await q(`SELECT count(*)::int AS n FROM l_once`)).rows[0].n);
}

await pool.end();
