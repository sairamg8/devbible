// Phase 10 pages 05-07 — why an index is not used, multicolumn order, BUFFERS.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const plan = async (sql, params, opts = 'ANALYZE, BUFFERS') =>
  (await q(`EXPLAIN (${opts}) ${sql}`, params)).rows.map(r => r['QUERY PLAN']).join('\n');
const node1 = (p) => (p.split('\n').find(l => /Scan/.test(l))?.trim() ?? '?').split('  (')[0];
const time = (p) => p.match(/Execution Time: ([\d.]+) ms/)?.[1];

// --- shared fixture --------------------------------------------------------
await q(`DROP TABLE IF EXISTS n_users`);
await q(`CREATE TABLE n_users (
           id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
           account_no text,
           email text,
           status text,
           country text,
           created_at timestamptz)`);
await q(`INSERT INTO n_users (account_no, email, status, country, created_at)
         SELECT g::text,
                'User' || g || '@Example.COM',
                CASE WHEN g % 1000 = 0 THEN 'locked' ELSE 'active' END,
                (ARRAY['IN','US','DE'])[1 + g % 3],
                now() - (g || ' seconds')::interval
         FROM generate_series(1, 400000) g`);
await q(`CREATE INDEX n_users_account_no_idx ON n_users (account_no)`);
await q(`CREATE INDEX n_users_email_idx      ON n_users (email)`);
await q(`CREATE INDEX n_users_status_idx     ON n_users (status)`);
await q(`CREATE INDEX n_users_created_at_idx ON n_users (created_at)`);
await q(`ANALYZE n_users`);
console.log('fixture: 400000 rows, 4 secondary indexes, 400 locked / 399600 active');

// --- 1. a function wrapping the column ------------------------------------
line('1. a function around the column kills the index');
{
  const a = await plan(`SELECT * FROM n_users WHERE email = 'User12345@Example.COM'`);
  const b = await plan(`SELECT * FROM n_users WHERE lower(email) = 'user12345@example.com'`);
  console.log('bare column   :', node1(a), '→', time(a), 'ms');
  console.log('lower(email)  :', node1(b), '→', time(b), 'ms');

  const c = await plan(`SELECT * FROM n_users WHERE created_at::date = current_date`);
  const d = await plan(`SELECT * FROM n_users
                        WHERE created_at >= current_date
                          AND created_at <  current_date + 1`);
  console.log('created_at::date =    :', node1(c), '→', time(c), 'ms');
  console.log('range on bare column  :', node1(d), '→', time(d), 'ms');
}

// --- 2. type mismatch, the Node version ------------------------------------
line('2. type mismatch — the shape you actually hit from Node');
{
  // account_no is text; the app has the account number as a JS number
  try {
    const r = await q(`SELECT id FROM n_users WHERE account_no = $1`, [12345]);
    const p = await plan(`SELECT id FROM n_users WHERE account_no = $1`, [12345]);
    console.log('text column, JS number param: no error, rows =', r.rowCount,
      '|', node1(p), '← the driver stringified it, so the index still works');
  } catch (e) { console.log('text column, JS number param →', e.code, e.message); }

  // the mismatch that DOES bite: two columns of different types joined
  await q(`DROP TABLE IF EXISTS t_events`);
  await q(`CREATE TABLE t_events AS
           SELECT g AS id, (g % 400000 + 1)::text AS user_id_text,
                  (g % 400000 + 1)::bigint AS user_id_num
           FROM generate_series(1, 200000) g`);
  await q(`CREATE INDEX ON t_events (user_id_text)`);
  await q(`CREATE INDEX ON t_events (user_id_num)`);
  await q(`ANALYZE t_events`);
  // no operator exists for text = bigint, so ONE side must be cast. Which side decides everything.
  try {
    await q(`SELECT count(*) FROM n_users u JOIN t_events e ON e.user_id_text = u.id`);
  } catch (e) { console.log('\ntext = bigint with no cast →', e.code, e.message); }

  const otherSide = await plan(`SELECT count(*) FROM n_users u
                                JOIN t_events e ON e.user_id_text = u.id::text
                                WHERE u.id < 500`, undefined, 'ANALYZE, BUFFERS, COSTS OFF');
  const thisSide  = await plan(`SELECT count(*) FROM n_users u
                                JOIN t_events e ON e.user_id_text::bigint = u.id
                                WHERE u.id < 500`, undefined, 'ANALYZE, BUFFERS, COSTS OFF');
  const inner = (p) => p.split('\n').filter(l => /t_events/.test(l))[0]?.trim();
  console.log('cast on the OTHER column (u.id::text) :', inner(otherSide));
  console.log('   →', time(otherSide), 'ms |', otherSide.match(/Buffers: shared ([^\n]+)/)?.[1]);
  console.log('cast on the INDEXED column (e.x::bigint):', inner(thisSide));
  console.log('   →', time(thisSide), 'ms |', thisSide.match(/Buffers: shared ([^\n]+)/)?.[1]);

  // so someone "fixes" it by casting the COLUMN
  const cast = await plan(`SELECT * FROM n_users WHERE account_no::bigint = 12345`);
  console.log('account_no::bigint = 12345 :', node1(cast), '→', time(cast), 'ms');
  // the correct fix casts the VALUE
  const val = await plan(`SELECT * FROM n_users WHERE account_no = $1`, ['12345']);
  console.log("account_no = '12345'       :", node1(val), '→', time(val), 'ms');

  // what pg actually sends: the parameter is untyped, the server infers
  const t = await q(`SELECT pg_typeof(account_no)::text AS col FROM n_users LIMIT 1`);
  console.log('column type:', t.rows[0].col, '| driver sends parameters as untyped text; the server infers from context');
}

// --- 3. low selectivity ----------------------------------------------------
line('3. low selectivity — the index exists and is correctly ignored');
{
  const hi = await plan(`SELECT * FROM n_users WHERE status = 'locked'`);   //  400 rows
  const lo = await plan(`SELECT * FROM n_users WHERE status = 'active'`);   // 399600 rows
  console.log("status='locked' (400 rows)   :", node1(hi), '→', time(hi), 'ms');
  console.log("status='active' (399600 rows):", node1(lo), '→', time(lo), 'ms');

  // what the planner thinks the split is
  const st = await q(`SELECT most_common_vals::text AS vals, most_common_freqs::text AS freqs
                      FROM pg_stats WHERE tablename='n_users' AND attname='status'`);
  console.log('pg_stats for status:', st.rows[0].vals, st.rows[0].freqs);

  // force it and time the difference
  await q(`SET enable_seqscan = off`);
  const forced = await plan(`SELECT * FROM n_users WHERE status = 'active'`);
  await q(`RESET enable_seqscan`);
  console.log('forced index path            :', node1(forced), '→', time(forced), 'ms');
}

// --- 4. stale statistics ---------------------------------------------------
line('4. stale statistics');
{
  await q(`DROP TABLE IF EXISTS s_stale`);
  await q(`CREATE TABLE s_stale (id int, tag text) WITH (autovacuum_enabled = off)`);
  await q(`CREATE INDEX s_stale_tag_idx ON s_stale (tag)`);

  // a brand-new table has NO statistics at all
  await q(`INSERT INTO s_stale SELECT g, 'tag' || (g % 5000) FROM generate_series(1,2000) g`);
  console.log('reltuples on a never-analyzed table:',
    (await q(`SELECT reltuples FROM pg_class WHERE relname='s_stale'`)).rows[0].reltuples,
    '← -1 means "unknown", not "empty"');
  await q(`ANALYZE s_stale`);
  console.log('after ANALYZE at 2000 rows        :',
    (await q(`SELECT reltuples FROM pg_class WHERE relname='s_stale'`)).rows[0].reltuples);

  // now the table grows 200x and nobody re-analyzes
  await q(`INSERT INTO s_stale SELECT g, 'tag7' FROM generate_series(1,400000) g`);
  const before = await plan(`SELECT count(*) FROM s_stale WHERE tag = 'tag7'`);
  console.log('\n-- plan with stale stats (planner still believes 2000 rows) --');
  console.log(before);
  console.log('  catalog still says reltuples =',
    (await q(`SELECT reltuples FROM pg_class WHERE relname='s_stale'`)).rows[0].reltuples);

  await q(`ANALYZE s_stale`);
  const after = await plan(`SELECT count(*) FROM s_stale WHERE tag = 'tag7'`);
  console.log('\n-- same query after ANALYZE --');
  console.log(after);
  console.log('  reltuples now:',
    (await q(`SELECT reltuples FROM pg_class WHERE relname='s_stale'`)).rows[0].reltuples);
  console.log(`\nstale: ${time(before)} ms   fresh: ${time(after)} ms`);
}

// --- 5. the other three that come up --------------------------------------
line('5. three more shapes that skip the index');
{
  const cases = [
    ['<>  (negation)     ', `SELECT * FROM n_users WHERE status <> 'active'`],
    ['NOT IN            ', `SELECT * FROM n_users WHERE status NOT IN ('active')`],
    ['OR across columns ', `SELECT * FROM n_users WHERE status = 'locked' OR country = 'IN'`],
    ['OR, both selective', `SELECT * FROM n_users WHERE status = 'locked' OR account_no = '7'`],
    ['leading wildcard  ', `SELECT * FROM n_users WHERE email LIKE '%12345@Example.COM'`],
  ];
  for (const [label, sql] of cases) {
    const p = await plan(sql);
    console.log(label, node1(p).padEnd(46), '→', time(p), 'ms');
  }
}

// --- 6. multicolumn: the leftmost prefix rule ------------------------------
line('6. multicolumn index — column order');
{
  await q(`DROP TABLE IF EXISTS m_orders`);
  await q(`CREATE TABLE m_orders AS
           SELECT g AS id,
                  (g % 5000)  AS user_id,
                  (ARRAY['new','paid','shipped','cancelled'])[1 + g % 4] AS state,
                  (now() - (g || ' seconds')::interval)::timestamptz AS created_at
           FROM generate_series(1, 400000) g`);
  await q(`CREATE INDEX m_orders_ab ON m_orders (user_id, state)`);
  await q(`ANALYZE m_orders`);

  const cases = [
    ['both columns        ', `SELECT * FROM m_orders WHERE user_id = 42 AND state = 'paid'`],
    ['leading column only ', `SELECT * FROM m_orders WHERE user_id = 42`],
    ['SECOND column only  ', `SELECT * FROM m_orders WHERE state = 'paid'`],
    ['ORDER BY (a, b)     ', `SELECT * FROM m_orders ORDER BY user_id, state LIMIT 5`],
    ['ORDER BY (b, a)     ', `SELECT * FROM m_orders ORDER BY state, user_id LIMIT 5`],
  ];
  for (const [label, sql] of cases) {
    const p = await plan(sql);
    console.log(label, node1(p).padEnd(48), '→', time(p), 'ms');
  }

  // PG 18: does the second-column-only query use a skip scan?
  console.log('\nfull plan for the second-column-only query:');
  console.log(await plan(`SELECT * FROM m_orders WHERE state = 'paid'`, undefined, 'ANALYZE, BUFFERS, COSTS OFF'));

  // PG 18 added B-tree skip scan — but only when the leading column has FEW values
  console.log('\n-- PG 18 skip scan: ONLY a (state, user_id) index, query filters user_id --');
  await q(`DROP INDEX m_orders_ab`);
  await q(`CREATE INDEX m_orders_ba_probe ON m_orders (state, user_id)`);
  await q(`ANALYZE m_orders`);
  console.log(await plan(`SELECT * FROM m_orders WHERE user_id = 42`, undefined,
    'ANALYZE, BUFFERS, COSTS OFF'));
  await q(`DROP INDEX m_orders_ba_probe`);
  await q(`CREATE INDEX m_orders_ab ON m_orders (user_id, state)`);
  await q(`ANALYZE m_orders`);

  // low-cardinality leading column changes the answer
  await q(`CREATE INDEX m_orders_ba ON m_orders (state, user_id)`);
  await q(`ANALYZE m_orders`);
  const both = await plan(`SELECT * FROM m_orders WHERE user_id = 42 AND state = 'paid'`);
  console.log('\nwith BOTH (a,b) and (b,a) present, planner picks:', node1(both), '→', time(both), 'ms');
  const sz = await q(`SELECT indexrelname AS name, pg_size_pretty(pg_relation_size(indexrelid)) AS size,
                             idx_scan
                      FROM pg_stat_user_indexes WHERE relname='m_orders' ORDER BY 1`);
  console.table(sz.rows);
}

// --- 7. equality-then-range column order ----------------------------------
line('7. (equality, range) is the right order — not the other way round');
{
  await q(`DROP INDEX IF EXISTS m_orders_ab, m_orders_ba`);
  const sql = `SELECT * FROM m_orders
               WHERE user_id = 42 AND created_at > now() - interval '2 days'
               ORDER BY created_at DESC LIMIT 20`;
  for (const [label, ddl] of [
    ['(user_id, created_at)', `CREATE INDEX m_ord_eq_range ON m_orders (user_id, created_at)`],
    ['(created_at, user_id)', `CREATE INDEX m_ord_range_eq ON m_orders (created_at, user_id)`],
  ]) {
    await q(`DROP INDEX IF EXISTS m_ord_eq_range, m_ord_range_eq`);
    await q(ddl);
    await q(`ANALYZE m_orders`);
    const p = await plan(sql);
    console.log(label, node1(p).padEnd(48), '→', time(p), 'ms |',
      p.match(/Buffers: shared ([^\n]+)/)?.[1] ?? '');
  }
}

// --- 8. BUFFERS: estimated vs actual, and the unit that does not lie -------
line('8. EXPLAIN (ANALYZE, BUFFERS) — estimate vs reality');
{
  await q(`DROP TABLE IF EXISTS c_corr`);
  // country and dial_code are perfectly correlated; the planner assumes independence
  await q(`CREATE TABLE c_corr AS
           SELECT g AS id,
                  (ARRAY['IN','US','DE'])[1 + g % 3] AS country,
                  (ARRAY['+91','+1','+49'])[1 + g % 3] AS dial_code
           FROM generate_series(1, 300000) g`);
  await q(`CREATE INDEX ON c_corr (country)`);
  await q(`ANALYZE c_corr`);
  const p = await plan(`SELECT * FROM c_corr WHERE country = 'IN' AND dial_code = '+91'`);
  console.log(p);
  const m = p.match(/rows=(\d+)[^)]*\)\s*\(actual[^)]*rows=([\d.]+)/);
  console.log(`\nestimated ${m?.[1]} rows, actual ${m?.[2]} — the planner multiplied two independent-looking filters`);

  // cold vs warm buffers on the same query
  await q(`DISCARD ALL`);
  const warm = await plan(`SELECT count(*) FROM n_users WHERE created_at > now() - interval '1 hour'`);
  console.log('\nbuffers line:', warm.match(/Buffers: shared ([^\n]+)/)?.[1]);
  console.log('shared hit = found in shared_buffers; read = went to the OS/disk');
  console.log('block size:', (await q(`SHOW block_size`)).rows[0].block_size, 'bytes — so hit+read x 8 kB is the real work done');
}

await pool.end();
