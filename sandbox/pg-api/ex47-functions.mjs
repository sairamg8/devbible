// Phase 12 pages 10, 12, 15 — only what is NOT already measured elsewhere.
// generate_series / unnest / WITH ORDINALITY are in ex19, ex8, ex9;
// jsonb_to_recordset is in ex44; trigger functions are in ex46.
// This covers: function inlining, volatility, SRF placement, and procedures.
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
const planOf = async (sql) => (await q(`EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) ${sql}`))
  .rows.map((r) => '    ' + r['QUERY PLAN']).join('\n');
const tryq = async (label, sql) => {
  try { const r = await q(sql); console.log(`${label.padEnd(44)} → OK`); return r; }
  catch (e) { console.log(`${label.padEnd(44)} → ${e.code} ${e.message.split('\n')[0]}`); }
};

await q(`DROP TABLE IF EXISTS f_orders CASCADE`);
await q(`CREATE TABLE f_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer text NOT NULL, total numeric(10,2) NOT NULL)`);
await q(`INSERT INTO f_orders (customer, total)
         SELECT 'cust-' || (g % 5000), (g % 900 + 10)::numeric
           FROM generate_series(1,300000) g`);
await q(`CREATE INDEX f_orders_customer_idx ON f_orders (customer)`);
await q(`ANALYZE f_orders`);
console.log('seeded 300000 orders, 5000 customers');

// --- 1. LANGUAGE sql inlines; plpgsql does not ----------------------------
line('1. a sql function is inlined, a plpgsql function is a black box');
{
  await q(`CREATE OR REPLACE FUNCTION f_sql(c text)
           RETURNS TABLE (id bigint, total numeric) AS $$
             SELECT id, total FROM f_orders WHERE customer = c
           $$ LANGUAGE sql STABLE`);
  await q(`CREATE OR REPLACE FUNCTION f_plpgsql(c text)
           RETURNS TABLE (id bigint, total numeric) AS $$
             BEGIN
               RETURN QUERY SELECT o.id, o.total FROM f_orders o WHERE o.customer = c;
             END
           $$ LANGUAGE plpgsql STABLE`);

  // (a) called on its own — the plans differ but the cost does not
  console.log('-- called on its own --');
  for (const [label, fn] of [['LANGUAGE sql    ', 'f_sql'], ['LANGUAGE plpgsql', 'f_plpgsql']]) {
    const sql = `SELECT count(*) FROM ${fn}('cust-42')`;
    console.log(`${label} ${(await timed(5, () => q(sql))).toFixed(2).padStart(8)} ms`);
    console.log(await planOf(sql));
  }
  console.log('↑ different plans, SAME time: plpgsql runs the same indexed query internally.');
  console.log('  Inlining has not paid for itself yet.');

  // (b) now put a predicate on the RESULT — this is where it matters
  console.log('\n-- with a predicate on the function\'s result --');
  for (const [label, fn] of [['LANGUAGE sql    ', 'f_sql'], ['LANGUAGE plpgsql', 'f_plpgsql']]) {
    const sql = `SELECT count(*) FROM ${fn}('cust-42') WHERE total > 800`;
    console.log(`${label} ${(await timed(5, () => q(sql))).toFixed(2).padStart(8)} ms`);
    console.log(await planOf(sql));
  }

  // (c) and the row estimate the planner uses for a black box
  console.log('\n-- what the planner ESTIMATES for each --');
  for (const [label, fn] of [['LANGUAGE sql    ', 'f_sql'], ['LANGUAGE plpgsql', 'f_plpgsql']]) {
    const r = await q(`EXPLAIN SELECT * FROM ${fn}('cust-42')`);
    console.log(`${label} ${r.rows[0]['QUERY PLAN'].trim()}`);
  }
  console.log('↑ a plpgsql function has no statistics, so the planner assumes a fixed');
  console.log('  1000 rows — which is what wrecks a join against it');
}

// --- 2. volatility decides whether inlining is even allowed ---------------
line('2. VOLATILE blocks inlining, even for LANGUAGE sql');
{
  await q(`CREATE OR REPLACE FUNCTION f_sql_volatile(c text)
           RETURNS TABLE (id bigint, total numeric) AS $$
             SELECT id, total FROM f_orders WHERE customer = c
           $$ LANGUAGE sql VOLATILE`);
  const sql = `SELECT count(*) FROM f_sql_volatile('cust-42')`;
  console.log(`sql VOLATILE     ${(await timed(3, () => q(sql))).toFixed(2).padStart(8)} ms`);
  console.log(await planOf(sql));
  console.log('↑ same body as f_sql, only the volatility marker differs');

  // and what volatility means for how often it runs
  await q(`CREATE OR REPLACE FUNCTION f_counter() RETURNS int AS $$
             SELECT 1
           $$ LANGUAGE sql IMMUTABLE`);
  const evals = await q(`
    SELECT count(*)::int AS c FROM generate_series(1,3) g
     WHERE f_counter() = 1`);
  console.log('IMMUTABLE function in a WHERE clause over 3 rows →', evals.rows[0].c, 'rows kept');
  const cached = await q(`EXPLAIN (COSTS OFF) SELECT * FROM f_orders WHERE total > f_counter()`);
  console.log('  plan shows the call folded to a constant:');
  console.log(cached.rows.map((r) => '    ' + r['QUERY PLAN']).filter((l) => /Filter|Scan/.test(l)).join('\n'));
}

// --- 3. an SRF in the SELECT list vs in FROM ------------------------------
line('3. set-returning function in SELECT vs in FROM');
{
  const inSelect = await q(`SELECT generate_series(1,3) AS g`);
  console.log('SELECT generate_series(1,3) →', inSelect.rows.map((r) => r.g).join(','));

  // two SRFs in the SELECT list: PG10+ takes the LONGEST, padding with NULL
  const two = await q(`SELECT generate_series(1,2) AS a, generate_series(1,4) AS b`);
  console.log('two SRFs in SELECT →', JSON.stringify(two.rows));
  console.log('  ↑ PG10+ runs them in lockstep and pads the shorter with NULL');

  const rowsFrom = await q(`
    SELECT * FROM ROWS FROM (generate_series(1,2), generate_series(1,4)) AS t(a,b)`);
  console.log('ROWS FROM(...)     →', JSON.stringify(rowsFrom.rows));

  // ordinality is the row number, and it is the reason to prefer FROM
  const ord = await q(`
    SELECT * FROM unnest(ARRAY['x','y','z']) WITH ORDINALITY AS t(val, pos)`);
  console.log('WITH ORDINALITY    →', JSON.stringify(ord.rows));

  await tryq('an SRF in the WHERE clause',
    `SELECT * FROM f_orders WHERE id = generate_series(1,3)`);
}

// --- 4. procedures: transaction control -----------------------------------
line('4. procedures vs functions — COMMIT inside the body');
{
  await q(`DROP TABLE IF EXISTS f_batch`);
  await q(`CREATE TABLE f_batch (id int PRIMARY KEY)`);

  await q(`CREATE OR REPLACE PROCEDURE f_proc() AS $$
           BEGIN
             INSERT INTO f_batch VALUES (1);
             COMMIT;
             INSERT INTO f_batch VALUES (2);
             COMMIT;
           END $$ LANGUAGE plpgsql`);
  await tryq('CALL a procedure that COMMITs', `CALL f_proc()`);
  console.log('  rows after the CALL:', (await q(`SELECT count(*)::int c FROM f_batch`)).rows[0].c);

  await q(`CREATE OR REPLACE FUNCTION f_func() RETURNS void AS $$
           BEGIN
             INSERT INTO f_batch VALUES (3);
             COMMIT;
           END $$ LANGUAGE plpgsql`);
  await tryq('the same COMMIT inside a FUNCTION', `SELECT f_func()`);

  // and a procedure called inside an explicit transaction cannot commit either.
  // Clear the table first, or the failure is a duplicate key rather than the
  // transaction-control error being demonstrated.
  await q(`TRUNCATE f_batch`);
  const c = await pool.connect();
  await c.query('BEGIN');
  try {
    await c.query(`CALL f_proc()`);
    console.log('CALL inside an explicit transaction           → OK');
  } catch (e) {
    console.log(`CALL inside an explicit transaction           → ${e.code} ${e.message.split('\n')[0]}`);
  }
  await c.query('ROLLBACK');
  c.release();

  await tryq('SELECT a procedure instead of CALLing it', `SELECT f_proc()`);
}

await q(`DROP TABLE IF EXISTS f_orders, f_batch CASCADE`);
await q(`DROP FUNCTION IF EXISTS f_sql(text), f_plpgsql(text), f_sql_volatile(text), f_counter(), f_func()`);
await q(`DROP PROCEDURE IF EXISTS f_proc()`);
await pool.end();
