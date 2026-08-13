// Phase 11 pages 12, 13, 14, 16 — long-running transactions and the xmin horizon,
// VACUUM and bloat, idle in transaction, freezing and XID age.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 12});
pool.on('error', (e) => console.log('pool error event:', e.code, e.message));
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const ms = (t0) => (Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1);
const sleep = (n) => new Promise(r => setTimeout(r, n));
const err = (e) => `${e.code} ${e.message.split('\n')[0]}`;
const conn = async () => { const c = await pool.connect(); await c.query('RESET ALL'); return c; };
const size = async (rel) => (await q(`SELECT pg_size_pretty(pg_relation_size($1)) AS s`, [rel])).rows[0].s;
const stats = async (rel) => {
  await q(`SELECT pg_stat_force_next_flush()`);
  return (await q(`SELECT n_live_tup, n_dead_tup, last_vacuum IS NOT NULL AS vac
                   FROM pg_stat_user_tables WHERE relname = $1`, [rel])).rows[0];
};

console.log('server version:', (await q(`SHOW server_version`)).rows[0].server_version);

// --- 1. which open transactions actually hold the vacuum horizon ------------
line('1. not every open transaction blocks VACUUM — measured per kind');
{
  // The test: 100k rows, UPDATE them all (100k dead), VACUUM, then ask VACUUM
  // VERBOSE how many dead rows it could not remove yet.
  const probe = async (label, setup) => {
    await q(`DROP TABLE IF EXISTS v_h`);
    await q(`CREATE TABLE v_h (id int PRIMARY KEY, pad text)`);
    await q(`INSERT INTO v_h SELECT g, repeat('x',100) FROM generate_series(1,100000) g`);
    await q(`VACUUM ANALYZE v_h`);

    const idler = setup ? await conn() : null;
    let idlerPid = null;
    if (setup) {
      idlerPid = (await idler.query(`SELECT pg_backend_pid() AS p`)).rows[0].p;
      await setup(idler);
    }

    await q(`UPDATE v_h SET pad = repeat('y',100)`);      // 100 000 dead row versions
    const beforeSize = await size('v_h');

    const v = await conn();
    const notes = [];
    v.on('notice', n => notes.push(n.message));
    await v.query(`VACUUM (VERBOSE) v_h`);
    await sleep(60);
    v.release();
    // PG 18 wording: "tuples: N removed, M remain, K are dead but not yet removable"
    const main = notes.find(m => /finished vacuuming "devbible.public.v_h"/.test(m)) ?? '';
    const tup = main.match(/tuples: (\d+) removed, (\d+) remain, (\d+) are dead but not yet removable/);
    const cutoff = main.match(/removable cutoff: (\d+)/);
    const stuck = tup ? [null, tup[3]] : null;
    const removed = tup ? [null, tup[1]] : null;

    // does the next UPDATE reuse the space, or extend the file?
    const mid = await size('v_h');
    await q(`UPDATE v_h SET pad = repeat('z',100)`);
    const after = await size('v_h');

    const xmin = (await q(`SELECT min(backend_xmin::text::bigint)::text AS m FROM pg_stat_activity
                           WHERE datname='devbible' AND backend_xmin IS NOT NULL`)).rows[0].m;
    console.log(`${label.padEnd(46)} removed ${(removed?.[1] ?? '?').padStart(6)}, ` +
      `not yet removable ${(stuck?.[1] ?? '?').padStart(6)} | cutoff xid ${cutoff?.[1] ?? '?'} | ` +
      `${beforeSize} -> ${mid} -> ${after}${after === mid ? ' (reused)' : ' (file GREW)'}`);
    if (idler) { await q(`SELECT pg_terminate_backend($1)`, [idlerPid]); idler.release(true); }
    return {stuck: stuck?.[1] ?? '0', removed: removed?.[1] ?? '0'};
  };

  await probe('no other transaction open', null);
  await probe('idle in transaction, READ COMMITTED, read-only', async (c) => {
    await c.query('BEGIN'); await c.query(`SELECT 1 FROM v_h LIMIT 1`);
  });
  await probe('idle in transaction, REPEATABLE READ', async (c) => {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ'); await c.query(`SELECT 1 FROM v_h LIMIT 1`);
  });
  await probe('idle in transaction that WROTE (holds an xid)', async (c) => {
    await c.query('BEGIN'); await c.query(`INSERT INTO v_h VALUES (-1,'own')`);
  });
  await probe('a long-running SELECT still executing', async (c) => {
    c.query(`SELECT pg_sleep(30)`).catch(() => {});
    await sleep(200);
  });
  console.log('  numbers straight from VACUUM (VERBOSE); 100 000 rows updated once = 100 000 dead');
}

// --- 2. VACUUM vs VACUUM FULL ----------------------------------------------
line('2. VACUUM reuses space; only VACUUM FULL returns it');
{
  await q(`DROP TABLE IF EXISTS v_bloat`);
  await q(`CREATE TABLE v_bloat (id int PRIMARY KEY, pad text)`);
  await q(`INSERT INTO v_bloat SELECT g, repeat('x',200) FROM generate_series(1,200000) g`);
  await q(`VACUUM ANALYZE v_bloat`);
  console.log('200k rows              :', await size('v_bloat'));
  await q(`DELETE FROM v_bloat WHERE id % 2 = 0`);
  console.log('after deleting half   :', await size('v_bloat'));
  await q(`VACUUM v_bloat`);
  console.log('after VACUUM          :', await size('v_bloat'));
  const t0 = process.hrtime.bigint();
  await q(`VACUUM FULL v_bloat`);
  console.log(`after VACUUM FULL     : ${await size('v_bloat')}  (took ${ms(t0)} ms, ACCESS EXCLUSIVE the whole time)`);

  // space freed by VACUUM is reused by the next inserts
  const before = await size('v_bloat');
  await q(`DELETE FROM v_bloat WHERE id % 4 = 1`);
  await q(`VACUUM v_bloat`);
  const mid = await size('v_bloat');
  await q(`INSERT INTO v_bloat SELECT g + 1000000, repeat('z',200) FROM generate_series(1, 40000) g`);
  console.log(`reuse: ${before} -> delete+vacuum ${mid} -> insert 40k more ${await size('v_bloat')}`);
}

// --- 3. how long a transaction has been open, and how to find it ------------
line('3. finding the transactions that matter');
{
  const old1 = await conn(), old2 = await conn();
  await old1.query('BEGIN');
  await old1.query(`SELECT pg_current_xact_id()`);      // holds a real xid
  await old2.query('BEGIN');
  await old2.query(`SELECT 1`);                          // snapshot only, no xid
  await sleep(1200);
  const rows = await q(`
    SELECT pid, state,
           round(extract(epoch from now() - xact_start)::numeric, 1) AS xact_age_s,
           round(extract(epoch from now() - state_change)::numeric, 1) AS idle_s,
           backend_xid::text AS xid, backend_xmin::text AS xmin
    FROM pg_stat_activity
    WHERE datname = 'devbible' AND xact_start IS NOT NULL AND pid <> pg_backend_pid()
    ORDER BY xact_start`);
  console.log(JSON.stringify(rows.rows, null, 0).replace(/},/g, '},\n '));
  console.log('  NOTE: both show backend_xmin = null. An idle READ COMMITTED transaction holds');
  console.log('  no snapshot between statements. The one that WROTE still pins the horizon via');
  console.log('  its backend_xid, which is why section 1 shows it blocking VACUUM.');
  await old1.query('COMMIT'); await old2.query('COMMIT');
  old1.release(); old2.release();
}

// --- 4. idle in transaction, and the timeouts that kill it ------------------
line('4. idle in transaction — the three timeouts');
{
  // (a) what it looks like
  const c = await conn();
  await c.query('BEGIN');
  await c.query(`UPDATE v_bloat SET pad = pad WHERE id = 3`);
  await sleep(300);
  const st = await q(`SELECT state, wait_event_type, wait_event,
                             round(extract(epoch from now() - state_change)::numeric,1) AS for_s
                      FROM pg_stat_activity WHERE datname='devbible' AND state LIKE 'idle in%'`);
  console.log('(a) pg_stat_activity      :', JSON.stringify(st.rows));
  await c.query('ROLLBACK');
  c.release();

  // (b) idle_in_transaction_session_timeout terminates the whole connection
  const victim = await conn();
  victim.on('error', e => console.log('    victim client "error" EVENT:', err(e)));
  await victim.query(`SET idle_in_transaction_session_timeout = '400ms'`);
  await victim.query('BEGIN');
  await victim.query(`SELECT 1`);
  await sleep(800);
  try { await victim.query(`SELECT 1`); }
  catch (e) { console.log('(b) next query on that connection →', err(e)); }
  victim.release(true);

  // (c) transaction_timeout (PostgreSQL 17+) kills it even if it is busy
  const busy = await conn();
  busy.on('error', e => console.log('    busy client "error" EVENT:', err(e)));
  try {
    await busy.query(`SET transaction_timeout = '500ms'`);
    await busy.query('BEGIN');
    await busy.query(`SELECT 1`);
    await sleep(300);
    await busy.query(`SELECT 1`);                     // still inside the budget
    console.log('(c) transaction_timeout=500ms: query at 300 ms still fine');
    await sleep(400);
    await busy.query(`SELECT 1`);
  } catch (e) { console.log('(c) query at 700 ms       →', err(e)); }
  busy.release(true);

  // (d) statement_timeout does NOT help here
  const idle2 = await conn();
  await idle2.query(`SET statement_timeout = '200ms'`);
  await idle2.query('BEGIN');
  await idle2.query(`SELECT 1`);
  await sleep(600);
  const alive = await idle2.query(`SELECT 'still here' AS s`);
  console.log('(d) statement_timeout=200ms, idle 600 ms in a transaction:', alive.rows[0].s);
  await idle2.query('ROLLBACK');
  idle2.release();
}

// --- 5. what an abandoned transaction costs the pool -----------------------
line('5. an abandoned transaction takes a pool connection with it');
{
  const small = new pg.Pool({connectionString: CS, max: 3});
  small.on('error', () => {});
  const leaked = await small.connect();
  await leaked.query('BEGIN');
  await leaked.query(`SELECT 1`);                     // never committed, never released
  const t0 = process.hrtime.bigint();
  const ok = await Promise.all([small.query('SELECT 1'), small.query('SELECT 1')]);
  console.log(`2 queries on the remaining 2 connections: ${ok.length} ok in ${ms(t0)} ms`);
  const t1 = process.hrtime.bigint();
  let timedOut = false;
  await Promise.race([
    Promise.all(Array.from({length: 3}, () => small.query(`SELECT pg_sleep(0.3)`))),
    sleep(1500).then(() => { timedOut = true; }),
  ]);
  console.log(`3 more concurrent queries with 1 connection leaked: ${timedOut ? 'still queued after 1500 ms' : `done in ${ms(t1)} ms`}`);
  console.log('  pool: total', small.totalCount, 'idle', small.idleCount, 'waiting', small.waitingCount);
  leaked.release();
  await small.end();
}

// --- 6. autovacuum: what triggers it ---------------------------------------
line('6. autovacuum thresholds');
{
  const s = await q(`SELECT name, setting, unit FROM pg_settings
                     WHERE name IN ('autovacuum','autovacuum_vacuum_threshold',
                       'autovacuum_vacuum_scale_factor','autovacuum_naptime',
                       'autovacuum_freeze_max_age','vacuum_freeze_min_age',
                       'autovacuum_vacuum_insert_threshold','vacuum_max_eager_freeze_failure_rate')
                     ORDER BY name`);
  for (const r of s.rows) console.log(`  ${r.name.padEnd(38)} ${r.setting}${r.unit ?? ''}`);
  const live = (await q(`SELECT count(*)::int AS n FROM v_bloat`)).rows[0].n;
  console.log(`  v_bloat has ${live} live rows -> autovacuum fires at 50 + 0.2 x ${live} = ` +
    `${Math.round(50 + 0.2 * live)} dead rows`);
  const av = await q(`SELECT relname, last_autovacuum, autovacuum_count, last_autoanalyze
                      FROM pg_stat_user_tables WHERE relname='v_bloat'`);
  console.log('  ', JSON.stringify(av.rows[0]));
}

// --- 7. freezing and XID age -----------------------------------------------
line('7. XID age, freezing, and how far from wraparound this database is');
{
  const db = await q(`SELECT datname, age(datfrozenxid) AS age, datfrozenxid::text AS frozen
                      FROM pg_database WHERE datname IN ('devbible','postgres','template0')
                      ORDER BY age(datfrozenxid) DESC`);
  console.log('per database:', JSON.stringify(db.rows));
  const limit = Number((await q(`SELECT setting FROM pg_settings WHERE name='autovacuum_freeze_max_age'`)).rows[0].setting);
  const worst = Number(db.rows[0].age);
  console.log(`worst age ${worst} of a 2^31 (2147483648) budget = ${(worst / 2147483648 * 100).toFixed(6)}%`);
  console.log(`anti-wraparound autovacuum triggers at autovacuum_freeze_max_age = ${limit}` +
    ` (${(worst / limit * 100).toFixed(2)}% of the way there)`);

  await q(`DROP TABLE IF EXISTS v_freeze`);
  await q(`CREATE TABLE v_freeze AS SELECT g AS id FROM generate_series(1,50000) g`);
  const relAge = async () => (await q(`SELECT age(relfrozenxid) AS a, relfrozenxid::text AS f
                                       FROM pg_class WHERE relname='v_freeze'`)).rows[0];
  console.log('new table         :', JSON.stringify(await relAge()));
  for (let i = 0; i < 5; i++) await q(`SELECT pg_current_xact_id()`);   // burn xids
  console.log('after burning 5 xids:', JSON.stringify(await relAge()));
  await q(`VACUUM FREEZE v_freeze`);
  console.log('after VACUUM FREEZE:', JSON.stringify(await relAge()), '<- relfrozenxid moved up to now');

  // how many xids this workload burns
  const x0 = Number((await q(`SELECT pg_current_xact_id() AS x`)).rows[0].x);
  const tBurn = process.hrtime.bigint();
  for (let i = 0; i < 200; i++) await q(`UPDATE v_freeze SET id = id WHERE id = 1`);
  const elapsed = Number(process.hrtime.bigint() - tBurn) / 1e9;      // seconds, measured
  const x1 = Number((await q(`SELECT pg_current_xact_id() AS x`)).rows[0].x);
  const burned = x1 - x0;
  const perSec = burned / elapsed;
  console.log(`200 autocommitted UPDATEs burned ${burned} xids in ${elapsed.toFixed(2)} s ` +
    `(${(burned / 201).toFixed(2)} per statement, ${perSec.toFixed(0)} xids/s)`);
  console.log(`  at that measured rate a 2^31 budget lasts ` +
    `${(2147483648 / perSec / 86400).toFixed(0)} days of nonstop single-row writes`);

  // read-only statements do NOT burn xids
  const y0 = Number((await q(`SELECT pg_current_xact_id() AS x`)).rows[0].x);
  for (let i = 0; i < 200; i++) await q(`SELECT count(*) FROM v_freeze`);
  const y1 = Number((await q(`SELECT pg_current_xact_id() AS x`)).rows[0].x);
  console.log(`200 SELECTs burned ${y1 - y0 - 1} xids beyond the two probes`);
}

// --- 8. the monitoring queries worth keeping -------------------------------
line('8. the four queries to keep');
{
  const longest = await q(`
    SELECT pid, state, round(extract(epoch from now() - xact_start)::numeric,1) AS xact_s
    FROM pg_stat_activity
    WHERE datname = current_database() AND xact_start IS NOT NULL
    ORDER BY xact_start LIMIT 5`);
  console.log('longest open transactions:', JSON.stringify(longest.rows));

  const dead = await q(`
    SELECT relname, n_live_tup, n_dead_tup,
           CASE WHEN n_live_tup > 0
                THEN round(100.0 * n_dead_tup / n_live_tup, 1) ELSE NULL END AS dead_pct
    FROM pg_stat_user_tables
    WHERE n_dead_tup > 100 ORDER BY n_dead_tup DESC LIMIT 5`);
  console.log('deadest tables          :', JSON.stringify(dead.rows));

  const blocked = await q(`
    SELECT a.pid, a.wait_event_type, cardinality(pg_blocking_pids(a.pid)) AS blockers
    FROM pg_stat_activity a
    WHERE cardinality(pg_blocking_pids(a.pid)) > 0`);
  console.log('blocked right now       :', JSON.stringify(blocked.rows));

  const oldest = await q(`
    SELECT c.relname, age(c.relfrozenxid) AS xid_age
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public'
    ORDER BY age(c.relfrozenxid) DESC LIMIT 3`);
  console.log('oldest relfrozenxid     :', JSON.stringify(oldest.rows));
}

await pool.end();
