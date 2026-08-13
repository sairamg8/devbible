// Phase 12 pages 07, 08, 11 — views and what the planner does with them,
// trigger firing rules, and materialized views + REFRESH CONCURRENTLY.
import pg from 'pg';

const URL = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: URL, max: 10});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const timed = async (n, fn) => {
  const ts = [];
  for (let i = 0; i < n; i++) {
    const t0 = process.hrtime.bigint();
    await fn();
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ts.sort((a, b) => a - b);
  return ts[Math.floor(ts.length / 2)];
};
const plan = async (sql, re = /Scan|Index Cond|Filter|Rows Removed|Sort|Aggregate|Subquery/) =>
  (await q(`EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) ${sql}`))
    .rows.map((r) => r['QUERY PLAN']).filter((l) => re.test(l))
    .map((l) => '    ' + l.trim()).join('\n');
const tryq = async (label, sql) => {
  try { await q(sql); console.log(`${label.padEnd(46)} → OK`); }
  catch (e) { console.log(`${label.padEnd(46)} → ${e.code} ${e.message.split('\n')[0]}`); }
};

const N = 300_000;
await q(`DROP TABLE IF EXISTS v_orders CASCADE`);
await q(`CREATE TABLE v_orders (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer text NOT NULL,
  status   text NOT NULL,
  total    numeric(10,2) NOT NULL,
  placed_at timestamptz NOT NULL DEFAULT now())`);
await q(`INSERT INTO v_orders (customer, status, total)
         SELECT 'cust-' || (g % 5000),
                (ARRAY['open','shipped','cancelled'])[1 + (g % 3)],
                (g % 900 + 10)::numeric
           FROM generate_series(1,$1) g`, [N]);
await q(`CREATE INDEX v_orders_customer_idx ON v_orders (customer)`);
await q(`ANALYZE v_orders`);
console.log(`seeded ${N} orders, 5000 customers`);

// ===========================================================================
// 07 · VIEWS
// ===========================================================================

line('1. a view is a named query, not stored data');
{
  await q(`CREATE OR REPLACE VIEW v_open AS
           SELECT id, customer, total, placed_at FROM v_orders WHERE status = 'open'`);
  const direct = `SELECT count(*) FROM v_orders WHERE status='open' AND customer='cust-42'`;
  const viaView = `SELECT count(*) FROM v_open WHERE customer='cust-42'`;
  console.log(`direct   ${(await timed(5, () => q(direct))).toFixed(2).padStart(8)} ms`);
  console.log(`via view ${(await timed(5, () => q(viaView))).toFixed(2).padStart(8)} ms`);
  console.log('  plan through the view:');
  console.log(await plan(viaView));
  console.log('↑ the view was expanded into the query; the predicate reached the index');

  const sz = await q(`SELECT pg_size_pretty(pg_relation_size('v_open')) AS s`);
  console.log('pg_relation_size(v_open) =', sz.rows[0].s, '← a view stores nothing');
}

line('2. when the predicate CANNOT be pushed into the view');
{
  // a plain view: predicate pushes down
  await q(`CREATE OR REPLACE VIEW v_totals AS
           SELECT customer, sum(total) AS lifetime FROM v_orders GROUP BY customer`);
  const pushable = `SELECT * FROM v_totals WHERE customer = 'cust-42'`;
  console.log('GROUP BY view, filtering on the GROUP BY key:');
  console.log(`  ${(await timed(3, () => q(pushable))).toFixed(1)} ms`);
  console.log(await plan(pushable));

  // filtering on the AGGREGATE cannot be pushed — the whole view must be built
  const notPushable = `SELECT * FROM v_totals WHERE lifetime > 100000`;
  console.log('\nsame view, filtering on the aggregate result:');
  console.log(`  ${(await timed(3, () => q(notPushable))).toFixed(1)} ms`);
  console.log(await plan(notPushable));
  console.log('↑ the aggregate must be computed for every customer before the filter applies');
}

line('3. a view cannot take parameters');
{
  await tryq('CREATE VIEW ... WHERE customer = $1',
    `CREATE VIEW v_bad AS SELECT * FROM v_orders WHERE customer = $1`);
  console.log('  ↑ the workaround is a set-returning function, not a view');
  const f = await q(`
    CREATE OR REPLACE FUNCTION v_for_customer(c text)
    RETURNS TABLE (id bigint, total numeric) AS $$
      SELECT id, total FROM v_orders WHERE customer = c
    $$ LANGUAGE sql STABLE`);
  const r = await q(`SELECT count(*)::int c FROM v_for_customer('cust-42')`);
  console.log('  a STABLE sql function does take a parameter →', r.rows[0].c, 'rows');
}

line('4. updatable views, and when they stop being updatable');
{
  await tryq('UPDATE through a simple view',
    `UPDATE v_open SET total = total WHERE id = (SELECT min(id) FROM v_open)`);
  await tryq('UPDATE through a GROUP BY view',
    `UPDATE v_totals SET lifetime = 0 WHERE customer = 'cust-42'`);
  // a row that leaves the view's WHERE clause
  const before = await q(`SELECT count(*)::int c FROM v_open WHERE customer='cust-1'`);
  await q(`UPDATE v_open SET total = 1 WHERE customer = 'cust-1'`);
  await q(`CREATE OR REPLACE VIEW v_open_checked AS
           SELECT id, customer, status, total FROM v_orders WHERE status='open'
           WITH CHECK OPTION`);
  await tryq("INSERT a 'shipped' row through a WITH CHECK OPTION view",
    `INSERT INTO v_open_checked (customer, status, total) VALUES ('x','shipped',1)`);
  await tryq("INSERT an 'open' row through the same view",
    `INSERT INTO v_open_checked (customer, status, total) VALUES ('x','open',1)`);
  console.log(`  (v_open had ${before.rows[0].c} rows for cust-1 before the update)`);
}

line('5. dependencies — dropping what a view needs');
{
  await tryq('ALTER TABLE ... DROP COLUMN used by a view',
    `ALTER TABLE v_orders DROP COLUMN placed_at`);
  await tryq('DROP TABLE with a dependent view',
    `DROP TABLE v_orders`);
  console.log('  ↑ views are hard dependencies; CASCADE would drop them too');
}

// ===========================================================================
// 08 · TRIGGERS
// ===========================================================================

line('6. BEFORE can change the row; AFTER cannot');
{
  await q(`DROP TABLE IF EXISTS t_audit, t_rows CASCADE`);
  await q(`CREATE TABLE t_rows (id int PRIMARY KEY, val text, note text)`);
  await q(`CREATE TABLE t_audit (id serial PRIMARY KEY, what text, fired_at timestamptz DEFAULT clock_timestamp())`);

  await q(`CREATE OR REPLACE FUNCTION t_before() RETURNS trigger AS $$
           BEGIN NEW.note = 'set by BEFORE'; RETURN NEW; END $$ LANGUAGE plpgsql`);
  await q(`CREATE OR REPLACE FUNCTION t_after() RETURNS trigger AS $$
           BEGIN NEW.note = 'set by AFTER'; RETURN NEW; END $$ LANGUAGE plpgsql`);
  await q(`CREATE TRIGGER t1 BEFORE INSERT ON t_rows FOR EACH ROW EXECUTE FUNCTION t_before()`);
  await q(`INSERT INTO t_rows (id, val) VALUES (1, 'a')`);
  console.log('after a BEFORE trigger:', (await q(`SELECT note FROM t_rows WHERE id=1`)).rows[0]);

  await q(`DROP TRIGGER t1 ON t_rows`);
  await q(`CREATE TRIGGER t2 AFTER INSERT ON t_rows FOR EACH ROW EXECUTE FUNCTION t_after()`);
  await q(`INSERT INTO t_rows (id, val) VALUES (2, 'b')`);
  console.log('after an AFTER trigger :', (await q(`SELECT note FROM t_rows WHERE id=2`)).rows[0]);
  console.log('↑ the AFTER trigger assigned NEW.note and it was discarded — the row is already written');
  await q(`DROP TRIGGER t2 ON t_rows`);
}

line('7. FOR EACH ROW vs FOR EACH STATEMENT');
{
  await q(`TRUNCATE t_rows, t_audit RESTART IDENTITY`);
  await q(`INSERT INTO t_rows SELECT g, 'v'||g FROM generate_series(1,1000) g`);
  await q(`CREATE OR REPLACE FUNCTION t_log() RETURNS trigger AS $$
           BEGIN INSERT INTO t_audit (what) VALUES (TG_NAME || '/' || TG_LEVEL); RETURN NULL; END $$
           LANGUAGE plpgsql`);
  await q(`CREATE TRIGGER t_row  AFTER UPDATE ON t_rows FOR EACH ROW       EXECUTE FUNCTION t_log()`);
  await q(`CREATE TRIGGER t_stmt AFTER UPDATE ON t_rows FOR EACH STATEMENT EXECUTE FUNCTION t_log()`);

  await q(`UPDATE t_rows SET val = val || 'x'`);          // one statement, 1000 rows
  const counts = await q(`SELECT what, count(*)::int c FROM t_audit GROUP BY what ORDER BY what`);
  console.table(counts.rows);
  console.log('↑ one UPDATE touching 1000 rows: the row trigger fired 1000 times, the statement trigger once');

  // and a statement trigger still fires when NOTHING matched
  await q(`TRUNCATE t_audit RESTART IDENTITY`);
  await q(`UPDATE t_rows SET val = val WHERE id = -1`);   // matches nothing
  const none = await q(`SELECT what, count(*)::int c FROM t_audit GROUP BY what`);
  console.log('after an UPDATE matching 0 rows:', none.rows.length ? none.rows : '(nothing fired)');
}

line('8. cost of the two levels');
{
  await q(`DROP TABLE IF EXISTS t_perf CASCADE`);
  await q(`CREATE OR REPLACE FUNCTION t_noop() RETURNS trigger AS $$ BEGIN RETURN NULL; END $$ LANGUAGE plpgsql`);
  // Each arm gets a FRESH table. Re-updating one table across arms leaves dead
  // tuples behind, so later arms would be slower from bloat, not from triggers.
  const arm = async (label, triggers) => {
    await q(`DROP TABLE IF EXISTS t_perf CASCADE`);
    await q(`CREATE TABLE t_perf (id int PRIMARY KEY, v int)`);
    await q(`INSERT INTO t_perf SELECT g, g FROM generate_series(1,50000) g`);
    await q(`VACUUM ANALYZE t_perf`);
    for (const t of triggers) await q(t);
    const ms = await timed(3, () => q(`UPDATE t_perf SET v = v + 1`));
    console.log(`${label.padEnd(18)} ${ms.toFixed(1).padStart(8)} ms`);
    return ms;
  };
  const base = await arm('no trigger', []);
  await arm('statement trigger', [
    `CREATE TRIGGER p_stmt AFTER UPDATE ON t_perf FOR EACH STATEMENT EXECUTE FUNCTION t_noop()`]);
  const row = await arm('row trigger', [
    `CREATE TRIGGER p_row AFTER UPDATE ON t_perf FOR EACH ROW EXECUTE FUNCTION t_noop()`]);
  const when = await arm('row + WHEN clause', [
    `CREATE TRIGGER p_row_when AFTER UPDATE ON t_perf FOR EACH ROW
       WHEN (OLD.v IS DISTINCT FROM NEW.v AND NEW.v % 1000 = 0)
       EXECUTE FUNCTION t_noop()`]);
  console.log(`\nrow trigger vs no trigger        : ${(row / base).toFixed(2)}x`);
  console.log(`WHEN clause vs unconditional row : ${(when / row).toFixed(2)}x`);
  console.log('↑ WHEN is checked before the function call, so non-matching rows skip plpgsql');
}

line('9. RETURN NULL in a BEFORE trigger cancels the row');
{
  await q(`DROP TABLE IF EXISTS t_skip CASCADE`);
  await q(`CREATE TABLE t_skip (id int PRIMARY KEY, v int)`);
  await q(`CREATE OR REPLACE FUNCTION t_veto() RETURNS trigger AS $$
           BEGIN IF NEW.v % 2 = 0 THEN RETURN NULL; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`);
  await q(`CREATE TRIGGER s1 BEFORE INSERT ON t_skip FOR EACH ROW EXECUTE FUNCTION t_veto()`);
  const r = await q(`INSERT INTO t_skip SELECT g, g FROM generate_series(1,10) g`);
  console.log('inserted 10 rows, rowCount reported:', r.rowCount);
  console.log('rows actually present:', (await q(`SELECT count(*)::int c FROM t_skip`)).rows[0].c);
  console.log('↑ RETURN NULL silently drops the row and rowCount does not reflect it');
}

line('10. firing order is alphabetical by trigger name');
{
  await q(`TRUNCATE t_audit RESTART IDENTITY`);
  await q(`DROP TABLE IF EXISTS t_order CASCADE`);
  await q(`CREATE TABLE t_order (id int)`);
  for (const n of ['zebra', 'alpha', 'middle']) {
    await q(`CREATE TRIGGER ${n} AFTER INSERT ON t_order FOR EACH ROW EXECUTE FUNCTION t_log()`);
  }
  await q(`INSERT INTO t_order VALUES (1)`);
  const order = await q(`SELECT what FROM t_audit ORDER BY id`);
  console.log('created zebra, alpha, middle — fired in this order:');
  console.log('  ', order.rows.map((r) => r.what).join(' → '));
}

// ===========================================================================
// 11 · MATERIALIZED VIEWS
// ===========================================================================

line('11. a materialized view stores its result');
{
  await q(`DROP MATERIALIZED VIEW IF EXISTS mv_totals`);
  const t0 = process.hrtime.bigint();
  await q(`CREATE MATERIALIZED VIEW mv_totals AS
           SELECT customer, sum(total) AS lifetime, count(*)::int AS orders
             FROM v_orders GROUP BY customer`);
  console.log(`CREATE MATERIALIZED VIEW: ${(Number(process.hrtime.bigint()-t0)/1e6).toFixed(0)} ms`);
  const sz = await q(`SELECT pg_size_pretty(pg_relation_size('mv_totals')) AS m,
                             pg_size_pretty(pg_relation_size('v_totals')) AS v`);
  console.log('matview size:', sz.rows[0].m, '| plain view size:', sz.rows[0].v);

  const fromView = `SELECT * FROM v_totals WHERE customer='cust-42'`;
  const fromMv   = `SELECT * FROM mv_totals WHERE customer='cust-42'`;
  console.log(`query the plain view  ${(await timed(3, () => q(fromView))).toFixed(1).padStart(8)} ms`);
  console.log(`query the matview     ${(await timed(3, () => q(fromMv))).toFixed(2).padStart(8)} ms  (no index yet)`);
  await q(`CREATE INDEX mv_totals_cust ON mv_totals (customer)`);
  await q(`ANALYZE mv_totals`);
  console.log(`matview + index       ${(await timed(5, () => q(fromMv))).toFixed(2).padStart(8)} ms`);
}

line('12. REFRESH, and why CONCURRENTLY needs a unique index');
{
  await tryq('REFRESH ... CONCURRENTLY with no unique index',
    `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_totals`);
  await q(`CREATE UNIQUE INDEX mv_totals_pk ON mv_totals (customer)`);
  console.log('');
  const plainMs = await timed(3, () => q(`REFRESH MATERIALIZED VIEW mv_totals`));
  const concMs  = await timed(3, () => q(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_totals`));
  console.log(`REFRESH                ${plainMs.toFixed(0).padStart(6)} ms`);
  console.log(`REFRESH CONCURRENTLY   ${concMs.toFixed(0).padStart(6)} ms   (${(concMs/plainMs).toFixed(1)}x slower)`);
}

line('13. what each REFRESH does to a concurrent reader');
{
  // No explicit transaction: the REFRESH is its own, so the lock is released when
  // the statement finishes. Wrapping it in BEGIN and awaiting the reader first
  // would just deadlock the harness — the lock is only freed at COMMIT.
  const readerBlocked = async (concurrently) => {
    const refresher = await pool.connect();
    const reader = await pool.connect();
    await reader.query(`SET lock_timeout = '15s'`);          // never hang the script
    const p = refresher.query(
      `REFRESH MATERIALIZED VIEW ${concurrently ? 'CONCURRENTLY ' : ''}mv_totals`);
    await new Promise((r) => setTimeout(r, 100));            // let it take its lock
    const t0 = Date.now();
    let waited;
    try {
      await reader.query(`SELECT count(*) FROM mv_totals`);
      waited = `${Date.now() - t0} ms`;
    } catch (e) {
      waited = `${e.code} after ${Date.now() - t0} ms`;
    }
    await p;
    refresher.release(); reader.release();
    return waited;
  };
  console.log(`reader waited during plain REFRESH        : ${await readerBlocked(false)}`);
  console.log(`reader waited during REFRESH CONCURRENTLY : ${await readerBlocked(true)}`);
  console.log('↑ plain REFRESH takes an AccessExclusiveLock; CONCURRENTLY does not block readers');
}

line('14. staleness and WITH NO DATA');
{
  const before = await q(`SELECT lifetime FROM mv_totals WHERE customer='cust-42'`);
  await q(`INSERT INTO v_orders (customer, status, total) VALUES ('cust-42','open',99999)`);
  const after = await q(`SELECT lifetime FROM mv_totals WHERE customer='cust-42'`);
  console.log('matview before the insert:', before.rows[0].lifetime);
  console.log('matview after  the insert:', after.rows[0].lifetime, '← unchanged; nothing refreshes it for you');

  await q(`DROP MATERIALIZED VIEW IF EXISTS mv_empty`);
  await q(`CREATE MATERIALIZED VIEW mv_empty AS SELECT 1 AS x WITH NO DATA`);
  await tryq('SELECT from a WITH NO DATA matview', `SELECT * FROM mv_empty`);
  await q(`REFRESH MATERIALIZED VIEW mv_empty`);
  console.log('after REFRESH:', (await q(`SELECT * FROM mv_empty`)).rows);
  const pop = await q(`SELECT relispopulated FROM pg_class WHERE relname='mv_empty'`);
  console.log('pg_class.relispopulated =', pop.rows[0].relispopulated);
}

await q(`DROP MATERIALIZED VIEW IF EXISTS mv_totals, mv_empty`);
await q(`DROP TABLE IF EXISTS v_orders, t_rows, t_audit, t_perf, t_skip, t_order CASCADE`);
await q(`DROP FUNCTION IF EXISTS v_for_customer(text), t_before(), t_after(), t_log(), t_noop(), t_veto()`);
await pool.end();
