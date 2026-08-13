// Phase 10 pages 01-04 — what an index costs, B-tree reach, EXPLAIN, scan types.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const ms = (t0) => `${(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0)} ms`;
const now = () => process.hrtime.bigint();

// plan text, one string
const plan = async (sql, opts = 'ANALYZE, BUFFERS, COSTS') =>
  (await q(`EXPLAIN ${opts ? `(${opts})` : ''} ${sql}`)).rows.map(r => r['QUERY PLAN']).join('\n');

// --- 1. what an index costs on write --------------------------------------
line('1. the write cost of an index');
{
  const rows = 200_000;
  const shapes = [
    ['no index          ', []],
    ['1 index (email)   ', ['CREATE INDEX ON w_users (email)']],
    ['3 indexes         ', ['CREATE INDEX ON w_users (email)',
                            'CREATE INDEX ON w_users (created_at)',
                            'CREATE INDEX ON w_users (status, created_at)']],
  ];
  for (const [label, idx] of shapes) {
    await q(`DROP TABLE IF EXISTS w_users`);
    await q(`CREATE TABLE w_users (
               id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
               email text, status text, created_at timestamptz)`);
    for (const s of idx) await q(s);
    const t0 = now();
    await q(`INSERT INTO w_users (email, status, created_at)
             SELECT 'u'||g||'@example.com',
                    (ARRAY['active','locked','pending'])[1 + g % 3],
                    now() - (g || ' minutes')::interval
             FROM generate_series(1,$1) g`, [rows]);
    const took = ms(t0);
    const sz = await q(`SELECT pg_size_pretty(pg_relation_size('w_users')) AS heap,
                               pg_size_pretty(pg_indexes_size('w_users')) AS idx`);
    console.log(`${label} insert ${rows} → ${took.padStart(7)} | heap ${sz.rows[0].heap} | indexes ${sz.rows[0].idx}`);
  }

  // and the read the indexes bought
  const t1 = now();
  await q(`SELECT * FROM w_users WHERE email = 'u150000@example.com'`);
  console.log('indexed lookup by email :', ms(t1));
  await q(`DROP INDEX IF EXISTS w_users_email_idx`);
  const t2 = now();
  await q(`SELECT * FROM w_users WHERE email = 'u150000@example.com'`);
  console.log('same lookup, no index   :', ms(t2));
}

// --- 2. everything one B-tree serves --------------------------------------
line('2. what a single B-tree can serve');
{
  await q(`DROP TABLE IF EXISTS b_events`);
  await q(`CREATE TABLE b_events AS
           SELECT g AS id,
                  'sku-' || lpad(g::text, 7, '0') AS sku,
                  (now() - (g || ' seconds')::interval)::timestamptz AS at,
                  (g % 1000) AS bucket
           FROM generate_series(1, 500000) g`);
  await q(`CREATE INDEX b_events_sku_idx ON b_events (sku)`);
  await q(`CREATE INDEX b_events_at_idx ON b_events (at)`);
  await q(`ANALYZE b_events`);

  const cases = [
    ['equality        ', `SELECT * FROM b_events WHERE sku = 'sku-0250000'`],
    ['range           ', `SELECT * FROM b_events WHERE at > now() - interval '30 seconds'`],
    ['sort order      ', `SELECT sku FROM b_events ORDER BY sku LIMIT 5`],
    ['prefix LIKE     ', `SELECT * FROM b_events WHERE sku LIKE 'sku-025000%'`],
    ['infix LIKE      ', `SELECT * FROM b_events WHERE sku LIKE '%250000%'`],
    ['min/max         ', `SELECT max(at) FROM b_events`],
  ];
  for (const [label, sql] of cases) {
    const p = await plan(sql);
    const node = p.split('\n')[0].trim();
    const time = p.match(/Execution Time: ([\d.]+) ms/)?.[1];
    console.log(`${label} ${node.slice(0, 78)}  [${time} ms]`);
  }

  // the collation caveat on prefix LIKE — the one case a plain B-tree misses
  console.log('\ndb collation:', (await q(`SELECT datcollate FROM pg_database WHERE datname = current_database()`)).rows[0].datcollate);
  console.log('prefix LIKE on a normal btree:\n' +
    await plan(`SELECT * FROM b_events WHERE sku LIKE 'sku-025%'`, 'COSTS OFF'));
  await q(`CREATE INDEX b_events_sku_pat_idx ON b_events (sku text_pattern_ops)`);
  await q(`ANALYZE b_events`);
  console.log('\nsame query after CREATE INDEX ... (sku text_pattern_ops):\n' +
    await plan(`SELECT * FROM b_events WHERE sku LIKE 'sku-025%'`, 'COSTS OFF'));
  const pt = await plan(`SELECT * FROM b_events WHERE sku LIKE 'sku-025%'`);
  console.log('execution time now:', pt.match(/Execution Time: ([\d.]+) ms/)?.[1], 'ms');
  console.log('but equality still needs the plain one — text_pattern_ops index cannot serve ORDER BY sku:\n' +
    await plan(`SELECT sku FROM b_events ORDER BY sku LIMIT 3`, 'COSTS OFF'));
}

// --- 3. EXPLAIN vs EXPLAIN ANALYZE ----------------------------------------
line('3. EXPLAIN vs EXPLAIN ANALYZE');
{
  const sql = `SELECT count(*) FROM b_events WHERE bucket = 7`;
  console.log('-- EXPLAIN (plan only, query NOT run) --');
  console.log(await plan(sql, ''));
  console.log('\n-- EXPLAIN ANALYZE (query actually run) --');
  console.log(await plan(sql, 'ANALYZE'));

  // ANALYZE really executes: prove it with a DML statement
  await q(`DROP TABLE IF EXISTS e_proof`);
  await q(`CREATE TABLE e_proof (id int)`);
  await q(`EXPLAIN INSERT INTO e_proof VALUES (1)`);
  console.log('\nrows after plain EXPLAIN INSERT   :',
    (await q(`SELECT count(*)::int AS c FROM e_proof`)).rows[0].c);
  await q(`EXPLAIN ANALYZE INSERT INTO e_proof VALUES (2)`);
  console.log('rows after EXPLAIN ANALYZE INSERT:',
    (await q(`SELECT count(*)::int AS c FROM e_proof`)).rows[0].c,
    '← ANALYZE wrote the row for real');

  // and it is not rolled back
  console.log('surviving ids:', (await q(`SELECT id FROM e_proof ORDER BY id`)).rows.map(r => r.id).join(','));
}

// --- 4. seq vs index vs bitmap --------------------------------------------
line('4. the three scan shapes on ONE table and ONE index');
{
  await q(`ANALYZE b_events`);
  const selectivities = [
    ['1 row       ', `SELECT * FROM b_events WHERE at = (SELECT max(at) FROM b_events)`],
    ['~500 rows   ', `SELECT * FROM b_events WHERE bucket = 7`],
    ['~50k rows   ', `SELECT * FROM b_events WHERE bucket < 100`],
    ['~250k rows  ', `SELECT * FROM b_events WHERE bucket < 500`],
    ['all rows    ', `SELECT * FROM b_events`],
  ];
  await q(`CREATE INDEX b_events_bucket_idx ON b_events (bucket)`);
  await q(`ANALYZE b_events`);
  for (const [label, sql] of selectivities) {
    const p = await plan(sql);
    const node = p.split('\n').find(l => /Scan/.test(l))?.trim() ?? '?';
    const actual = p.match(/actual time=[\d.]+\.\.[\d.]+ rows=(\d+)/)?.[1];
    const time = p.match(/Execution Time: ([\d.]+) ms/)?.[1];
    console.log(`${label} rows=${String(actual).padStart(6)}  ${node.slice(0, 52).padEnd(52)} [${time} ms]`);
  }

  console.log('\n-- the bitmap plan in full (two-step: index then heap) --');
  console.log(await plan(`SELECT * FROM b_events WHERE bucket < 100`, 'ANALYZE, BUFFERS'));

  console.log('\n-- is the seq scan the CORRECT plan? force the alternative and time it --');
  const sql = `SELECT * FROM b_events WHERE bucket < 800`;
  const natural = await plan(sql);
  await q(`SET enable_seqscan = off`);
  const noSeq = await plan(sql);
  await q(`SET enable_bitmapscan = off`);
  const pureIdx = await plan(sql);
  await q(`RESET enable_seqscan`); await q(`RESET enable_bitmapscan`);
  const show = (lbl, p) => console.log(lbl,
    (p.split('\n').find(l => /Scan/.test(l))?.trim() ?? '?').split('  (')[0].padEnd(46),
    '→', p.match(/Execution Time: ([\d.]+) ms/)?.[1], 'ms |',
    p.match(/Buffers: shared ([^\n]+)/)?.[1] ?? '');
  show('planner default      :', natural);
  show('enable_seqscan=off   :', noSeq);
  show('+ bitmapscan=off     :', pureIdx);
}

// --- 5. what the index actually costs in space -----------------------------
line('5. index size relative to the table');
{
  const r = await q(`SELECT indexrelname AS name,
                            pg_size_pretty(pg_relation_size(indexrelid)) AS size
                     FROM pg_stat_user_indexes WHERE relname = 'b_events'
                     ORDER BY pg_relation_size(indexrelid) DESC`);
  console.table(r.rows);
  console.log('heap:', (await q(`SELECT pg_size_pretty(pg_relation_size('b_events')) AS s`)).rows[0].s,
    '| all indexes:', (await q(`SELECT pg_size_pretty(pg_indexes_size('b_events')) AS s`)).rows[0].s);
}

await pool.end();
