// Phase 10 pages 12-17 — CONCURRENTLY, unused/duplicate, pg_stat_statements,
// GiST/BRIN/hash, statistics, bloat and REINDEX.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 8});
pool.on('error', (e) => console.log('pool error event:', e.code, e.message));
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const plan = async (sql, opts = 'ANALYZE, BUFFERS, COSTS OFF') =>
  (await q(`EXPLAIN (${opts}) ${sql}`)).rows.map(r => r['QUERY PLAN']).join('\n');
const node1 = (p) => (p.split('\n').find(l => /Scan/.test(l))?.trim() ?? '?').split('  (')[0];
const time = (p) => p.match(/Execution Time: ([\d.]+) ms/)?.[1];
const size = async (rel) => (await q(`SELECT pg_size_pretty(pg_relation_size($1)) AS s`, [rel])).rows[0].s;
const bytes = async (rel) => Number((await q(`SELECT pg_relation_size($1) AS s`, [rel])).rows[0].s);
const ms = (t0) => `${(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0)} ms`;

// --- 1. CREATE INDEX vs CREATE INDEX CONCURRENTLY --------------------------
line('1. CREATE INDEX blocks writes; CONCURRENTLY does not');
{
  await q(`DROP TABLE IF EXISTS x_big`);
  await q(`CREATE TABLE x_big AS
           SELECT g AS id, 'v'||g AS v, (g % 1000) AS bucket
           FROM generate_series(1, 1500000) g`);
  console.log('table:', await size('x_big'));

  // (a) plain CREATE INDEX holds a lock that stops INSERTs
  const builder = await pool.connect();
  const writer  = await pool.connect();
  await builder.query('BEGIN');
  await builder.query(`CREATE INDEX x_big_v_idx ON x_big (v)`);   // lock held until COMMIT
  const lockRow = await q(`SELECT mode, granted FROM pg_locks
                           WHERE relation = 'x_big'::regclass AND mode LIKE 'Share%'`);
  console.log('lock held by the builder:', JSON.stringify(lockRow.rows));
  await writer.query(`SET statement_timeout = '1500ms'`);
  try {
    await writer.query(`INSERT INTO x_big VALUES (-1, 'blocked', 0)`);
    console.log('INSERT while plain CREATE INDEX runs: succeeded');
  } catch (e) { console.log('INSERT while plain CREATE INDEX runs →', e.code, e.message); }
  await builder.query('ROLLBACK');
  await writer.query(`RESET statement_timeout`);

  // (b) CONCURRENTLY cannot be wrapped in a transaction at all
  try {
    await builder.query('BEGIN');
    await builder.query(`CREATE INDEX CONCURRENTLY x_big_v_cc ON x_big (v)`);
  } catch (e) { console.log('CIC inside BEGIN →', e.code, e.message); }
  await builder.query('ROLLBACK');

  // (c) CONCURRENTLY, with a writer hammering the table throughout
  let inserted = 0, stop = false;
  const hammer = (async () => {
    while (!stop) { await writer.query(`INSERT INTO x_big VALUES (default, 'w', 1)`); inserted++; }
  })();
  const t0 = process.hrtime.bigint();
  await builder.query(`CREATE INDEX CONCURRENTLY x_big_v_cc ON x_big (v)`);
  const ccTime = ms(t0);
  stop = true; await hammer;
  console.log(`CREATE INDEX CONCURRENTLY: ${ccTime}, and ${inserted} INSERTs completed during it`);

  // and the plain one, for the time comparison
  await q(`DROP INDEX IF EXISTS x_big_v_idx`);
  const t1 = process.hrtime.bigint();
  await q(`CREATE INDEX x_big_v_idx ON x_big (v)`);
  console.log(`plain CREATE INDEX       : ${ms(t1)} — one table pass instead of two`);

  builder.release(); writer.release();
}

// --- 2. the failure mode: an INVALID index --------------------------------
line('2. what a failed CONCURRENTLY leaves behind');
{
  await q(`DROP TABLE IF EXISTS x_dup`);
  await q(`CREATE TABLE x_dup (id int, email text)`);
  await q(`INSERT INTO x_dup SELECT g, 'dup@example.com' FROM generate_series(1,5) g`);
  try {
    await q(`CREATE UNIQUE INDEX CONCURRENTLY x_dup_email_uq ON x_dup (email)`);
  } catch (e) { console.log('unique CIC over duplicate data →', e.code, e.message); }

  const inv = await q(`SELECT i.indexrelid::regclass::text AS name, i.indisvalid, i.indisready,
                              pg_size_pretty(pg_relation_size(i.indexrelid)) AS size
                       FROM pg_index i WHERE i.indrelid = 'x_dup'::regclass`);
  console.table(inv.rows);
  console.log('the index still EXISTS and still costs write time, but no query can use it');
  const p = await plan(`SELECT * FROM x_dup WHERE email = 'dup@example.com'`);
  console.log('plan:', node1(p));
  console.log('\nfind them all with:');
  const finder = `SELECT indexrelid::regclass AS index, indrelid::regclass AS table
                  FROM pg_index WHERE NOT indisvalid`;
  console.table((await q(finder)).rows);
  await q(`DROP INDEX x_dup_email_uq`);
}

// --- 3. unused and duplicate indexes --------------------------------------
line('3. unused and duplicate indexes');
{
  await q(`DROP TABLE IF EXISTS u_tab`);
  await q(`CREATE TABLE u_tab AS SELECT g AS id, (g%100) AS a, (g%7) AS b, 'x'||g AS c
           FROM generate_series(1,200000) g`);
  await q(`CREATE INDEX u_tab_a      ON u_tab (a)`);
  await q(`CREATE INDEX u_tab_a_copy ON u_tab (a)`);          // exact duplicate
  await q(`CREATE INDEX u_tab_ab     ON u_tab (a, b)`);        // makes u_tab_a redundant
  await q(`CREATE INDEX u_tab_never  ON u_tab (c)`);           // nobody queries c
  await q(`ANALYZE u_tab`);
  for (let i = 0; i < 20; i++) await q(`SELECT * FROM u_tab WHERE a = $1 AND b = 3`, [i]);

  console.log(await plan(`SELECT * FROM u_tab WHERE a = 5 AND b = 3`));
  // index counters are flushed from backend-local memory on a timer, and the READER
  // caches its own snapshot (stats_fetch_consistency = cache). Both lags are real.
  const counters = async () => (await q(`SELECT indexrelname AS i, idx_scan FROM pg_stat_user_indexes
                                         WHERE relname='u_tab' ORDER BY 1`))
    .rows.map(r => `${r.i}=${r.idx_scan}`).join(' ');
  console.log('read immediately            :', await counters());
  await new Promise(r => setTimeout(r, 2000));
  console.log('after 2s                    :', await counters());
  await q(`SELECT pg_stat_clear_snapshot()`);
  await new Promise(r => setTimeout(r, 2000));
  console.log('after 4s + clear_snapshot   :', await counters());
  console.log('stats_fetch_consistency =', (await q(`SHOW stats_fetch_consistency`)).rows[0].stats_fetch_consistency);

  const stats = await q(`SELECT indexrelname AS index, idx_scan, idx_tup_read,
                                pg_size_pretty(pg_relation_size(indexrelid)) AS size
                         FROM pg_stat_user_indexes WHERE relname = 'u_tab' ORDER BY idx_scan DESC`);
  console.table(stats.rows);
  console.log('stats reset at:', (await q(`SELECT stats_reset FROM pg_stat_database WHERE datname=current_database()`)).rows[0].stats_reset);

  // exact duplicates by definition
  const dupes = await q(`
    SELECT array_agg(indexrelid::regclass::text) AS same_definition, count(*)
    FROM pg_index GROUP BY indrelid, indkey::text, indclass::text, indexprs::text,
                           indpred::text, indisunique
    HAVING count(*) > 1 AND indrelid = 'u_tab'::regclass`);
  console.table(dupes.rows);

  // a unique constraint already gives you the index — a second one is pure waste
  await q(`DROP TABLE IF EXISTS u_uq`);
  await q(`CREATE TABLE u_uq (id int PRIMARY KEY, email text UNIQUE)`);
  await q(`CREATE INDEX u_uq_email_extra ON u_uq (email)`);
  console.table((await q(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='u_uq'`)).rows);
}

// --- 4. pg_stat_statements ------------------------------------------------
line('4. pg_stat_statements — what actually costs you');
{
  await q(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`);
  await q(`SELECT pg_stat_statements_reset()`);

  // a fast query run many times, and a slow one run twice
  for (let i = 0; i < 500; i++) await q(`SELECT * FROM u_tab WHERE id = $1`, [i]);
  for (let i = 0; i < 2; i++)   await q(`SELECT count(*) FROM x_big WHERE v LIKE '%9999%'`);
  for (let i = 0; i < 40; i++)  await q(`SELECT * FROM u_tab WHERE a = $1`, [i]);

  const top = await q(`
    SELECT calls,
           round(total_exec_time)::int  AS total_ms,
           round(mean_exec_time::numeric, 3) AS mean_ms,
           rows,
           left(query, 52) AS query
    FROM pg_stat_statements
    WHERE query NOT LIKE '%pg_stat_statements%' AND dbid = (SELECT oid FROM pg_database WHERE datname=current_database())
    ORDER BY total_exec_time DESC LIMIT 6`);
  console.table(top.rows);
  console.log('note: the 500-call query and the 2-call query are ranked by TOTAL, not by mean');

  // parameters are normalised away — literals collapse to $1 too
  await q(`SELECT pg_stat_statements_reset()`);
  await q(`SELECT * FROM u_tab WHERE a = 1`);
  await q(`SELECT * FROM u_tab WHERE a = 2`);
  await q(`SELECT * FROM u_tab WHERE a = 3`);
  console.table((await q(`SELECT calls, query FROM pg_stat_statements
                          WHERE query LIKE 'SELECT * FROM u_tab WHERE a%'`)).rows);
  console.log('pg_stat_statements.max =', (await q(`SHOW pg_stat_statements.max`)).rows[0]['pg_stat_statements.max'],
    '| track =', (await q(`SHOW pg_stat_statements.track`)).rows[0]['pg_stat_statements.track']);
}

// --- 5. BRIN, hash, GiST ---------------------------------------------------
line('5. BRIN, hash and GiST — what each is genuinely for');
{
  // BRIN on naturally ordered data
  await q(`DROP TABLE IF EXISTS r_logs`);
  await q(`CREATE TABLE r_logs AS
           SELECT g AS id, (timestamp '2026-01-01' + (g || ' seconds')::interval) AS at,
                  'line ' || g AS msg
           FROM generate_series(1, 3000000) g`);
  await q(`CREATE INDEX r_logs_at_brin ON r_logs USING brin (at)`);
  await q(`CREATE INDEX r_logs_at_btree ON r_logs USING btree (at)`);
  await q(`VACUUM ANALYZE r_logs`);
  console.log('heap:', await size('r_logs'),
    '| BRIN:', await size('r_logs_at_brin'), '| B-tree:', await size('r_logs_at_btree'),
    `(BRIN is ${(await bytes('r_logs_at_btree') / await bytes('r_logs_at_brin')).toFixed(0)}x smaller)`);

  const rangeSql = `SELECT count(*) FROM r_logs
                    WHERE at BETWEEN timestamp '2026-01-10' AND timestamp '2026-01-11'`;
  await q(`DROP INDEX r_logs_at_btree`);
  const brin = await plan(rangeSql);
  console.log('\nBRIN  :', node1(brin), '→', time(brin), 'ms |', brin.match(/Buffers: shared ([^\n]+)/)?.[1]);
  await q(`CREATE INDEX r_logs_at_btree ON r_logs USING btree (at)`);
  await q(`VACUUM ANALYZE r_logs`);
  await q(`DROP INDEX r_logs_at_brin`);
  const btree = await plan(rangeSql);
  console.log('B-tree:', node1(btree), '→', time(btree), 'ms |', btree.match(/Buffers: shared ([^\n]+)/)?.[1]);

  // BRIN needs correlation — scramble it and watch it collapse
  await q(`DROP TABLE IF EXISTS r_shuffled`);
  await q(`CREATE TABLE r_shuffled AS SELECT * FROM r_logs ORDER BY md5(id::text)`);
  await q(`CREATE INDEX r_shuffled_brin ON r_shuffled USING brin (at)`);
  await q(`VACUUM ANALYZE r_shuffled`);
  const shuffled = await plan(`SELECT count(*) FROM r_shuffled
                               WHERE at BETWEEN timestamp '2026-01-10' AND timestamp '2026-01-11'`);
  console.log('BRIN on shuffled data:', node1(shuffled), '→', time(shuffled), 'ms');
  console.table((await q(`SELECT tablename, attname, correlation FROM pg_stats
                          WHERE tablename IN ('r_logs','r_shuffled') AND attname='at'`)).rows);

  // hash
  await q(`DROP TABLE IF EXISTS h_tok`);
  await q(`CREATE TABLE h_tok AS SELECT g AS id, md5(g::text) AS token FROM generate_series(1,500000) g`);
  await q(`CREATE INDEX h_tok_hash ON h_tok USING hash (token)`);
  await q(`CREATE INDEX h_tok_btree ON h_tok USING btree (token)`);
  await q(`VACUUM ANALYZE h_tok`);
  console.log('\nhash:', await size('h_tok_hash'), '| btree:', await size('h_tok_btree'));
  await q(`DROP INDEX h_tok_btree`);
  const eq = await plan(`SELECT * FROM h_tok WHERE token = md5('12345')`);
  console.log('equality with hash :', node1(eq), '→', time(eq), 'ms');
  const rng = await plan(`SELECT * FROM h_tok WHERE token > 'ff' ORDER BY token LIMIT 5`);
  console.log('range/sort with hash:', node1(rng), '→', time(rng), 'ms ← hash serves = only');
  try { await q(`CREATE UNIQUE INDEX h_uq ON h_tok USING hash (token)`); }
  catch (e) { console.log('UNIQUE hash index →', e.code, e.message); }

  // GiST for ranges — the exclusion constraint nobody can emulate with a B-tree
  await q(`DROP TABLE IF EXISTS g_book`);
  await q(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
  await q(`CREATE TABLE g_book (room int, during tstzrange,
             EXCLUDE USING gist (room WITH =, during WITH &&))`);
  await q(`INSERT INTO g_book VALUES (1, '[2026-08-12 09:00, 2026-08-12 10:00)')`);
  try {
    await q(`INSERT INTO g_book VALUES (1, '[2026-08-12 09:30, 2026-08-12 11:00)')`);
  } catch (e) { console.log('\noverlapping booking, same room →', e.code, '|', e.message.split('\n')[0]); }
  const ok = await q(`INSERT INTO g_book VALUES (2, '[2026-08-12 09:30, 2026-08-12 11:00)') RETURNING room`);
  console.log('same window, different room → inserted room', ok.rows[0].room);
}

// --- 6. statistics and ANALYZE --------------------------------------------
line('6. statistics, ANALYZE and extended statistics');
{
  await q(`DROP TABLE IF EXISTS s_corr`);
  await q(`CREATE TABLE s_corr AS
           SELECT g AS id, (ARRAY['IN','US','DE'])[1 + g % 3] AS country,
                  (ARRAY['+91','+1','+49'])[1 + g % 3] AS dial_code
           FROM generate_series(1, 300000) g`);
  await q(`ANALYZE s_corr`);
  const before = await plan(`SELECT count(*) FROM s_corr WHERE country='IN' AND dial_code='+91'`);
  const est = (p) => p.match(/rows=(\d+)/)?.[1] ?? p.match(/rows=([\d.]+)/)?.[1];
  console.log('-- without extended statistics --');
  console.log(await plan(`SELECT * FROM s_corr WHERE country='IN' AND dial_code='+91'`, 'COSTS ON, ANALYZE'));

  await q(`CREATE STATISTICS s_corr_ext (dependencies, ndistinct) ON country, dial_code FROM s_corr`);
  await q(`ANALYZE s_corr`);
  console.log('\n-- after CREATE STATISTICS + ANALYZE --');
  console.log(await plan(`SELECT * FROM s_corr WHERE country='IN' AND dial_code='+91'`, 'COSTS ON, ANALYZE'));
  console.table((await q(`SELECT statistics_name, n_distinct, dependencies FROM pg_stats_ext
                          WHERE tablename='s_corr'`)).rows);

  // default_statistics_target and what it buys
  console.log('\ndefault_statistics_target =', (await q(`SHOW default_statistics_target`)).rows[0].default_statistics_target);
  const hist = async () => (await q(`SELECT array_length(histogram_bounds::text::text[], 1) AS buckets,
                                            array_length(most_common_vals::text::text[], 1) AS mcvs,
                                            n_distinct
                                     FROM pg_stats WHERE tablename='x_big' AND attname='v'`)).rows[0];
  await q(`ANALYZE x_big`);
  console.log('x_big.v at target 100:', JSON.stringify(await hist()));
  await q(`ALTER TABLE x_big ALTER COLUMN v SET STATISTICS 1000`);
  const t0 = process.hrtime.bigint();
  await q(`ANALYZE x_big`);
  console.log('x_big.v at target 1000:', JSON.stringify(await hist()), '| ANALYZE took', ms(t0));
  await q(`ALTER TABLE x_big ALTER COLUMN v SET STATISTICS -1`);

  console.log('\nwhen autovacuum will analyze on its own:');
  console.table((await q(`SELECT name, setting FROM pg_settings
                          WHERE name IN ('autovacuum_analyze_scale_factor','autovacuum_analyze_threshold',
                                         'autovacuum_naptime')`)).rows);
  console.table((await q(`SELECT relname, n_mod_since_analyze, last_analyze IS NOT NULL AS analyzed,
                                 last_autoanalyze IS NOT NULL AS autoanalyzed
                          FROM pg_stat_user_tables WHERE relname IN ('x_big','s_corr')`)).rows);
}

// --- 7. index bloat and REINDEX -------------------------------------------
line('7. index bloat and REINDEX');
{
  await q(`CREATE EXTENSION IF NOT EXISTS pgstattuple`).catch(e => console.log('pgstattuple:', e.code));
  await q(`DROP TABLE IF EXISTS b_tab`);
  await q(`CREATE TABLE b_tab (id int PRIMARY KEY, v text) WITH (autovacuum_enabled = off)`);
  await q(`INSERT INTO b_tab SELECT g, 'v'||g FROM generate_series(1,400000) g`);
  await q(`CREATE INDEX b_tab_v_idx ON b_tab (v)`);
  const fresh = await bytes('b_tab_v_idx');
  console.log('fresh index:', await size('b_tab_v_idx'));

  // every UPDATE of an indexed column writes a new index entry
  for (let i = 0; i < 6; i++) await q(`UPDATE b_tab SET v = v || 'x' WHERE id % 3 = 0`);
  const bloated = await bytes('b_tab_v_idx');
  console.log('after 6 rewrites of a third of the rows:', await size('b_tab_v_idx'),
    `(${(bloated / fresh).toFixed(1)}x)`);

  const stat = async () => {
    try {
      const r = await q(`SELECT leaf_fragmentation, avg_leaf_density FROM pgstatindex('b_tab_v_idx')`);
      return JSON.stringify(r.rows[0]);
    } catch (e) { return `pgstatindex unavailable (${e.code})`; }
  };
  console.log('pgstatindex bloated:', await stat());

  await q(`VACUUM b_tab`);
  console.log('after VACUUM       :', await size('b_tab_v_idx'), '← VACUUM reclaims entries, not file size');

  const t0 = process.hrtime.bigint();
  await q(`REINDEX INDEX CONCURRENTLY b_tab_v_idx`);
  console.log('after REINDEX CONCURRENTLY:', await size('b_tab_v_idx'), 'in', ms(t0));
  console.log('pgstatindex rebuilt:', await stat());

  // REINDEX CONCURRENTLY leaves a _ccnew index behind if it fails
  console.log('\nleftovers to check for after a failed REINDEX CONCURRENTLY:');
  console.table((await q(`SELECT indexrelid::regclass::text AS name, indisvalid
                          FROM pg_index WHERE indrelid = 'b_tab'::regclass`)).rows);
  console.log('a plain REINDEX takes an ACCESS EXCLUSIVE lock; CONCURRENTLY takes SHARE UPDATE EXCLUSIVE');
}

// --- 8. finding foreign keys with no supporting index ---------------------
line('8. foreign keys whose referencing column is not indexed');
{
  await q(`DROP TABLE IF EXISTS fk_child, fk_ok, fk_parent CASCADE`);
  await q(`CREATE TABLE fk_parent (id int PRIMARY KEY)`);
  await q(`CREATE TABLE fk_child (id int PRIMARY KEY, parent_id int REFERENCES fk_parent(id))`);
  await q(`CREATE TABLE fk_ok    (id int PRIMARY KEY, parent_id int REFERENCES fk_parent(id))`);
  await q(`CREATE INDEX ON fk_ok (parent_id)`);

  const finder = `
    SELECT c.conrelid::regclass::text AS child_table, c.conname AS constraint_name,
           (SELECT string_agg(a.attname, ', ' ORDER BY k.ord)
            FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS fk_columns
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND i.indisvalid
          AND (string_to_array(i.indkey::text, ' ')::smallint[])[1:array_length(c.conkey,1)]
              = c.conkey::smallint[])
    ORDER BY 1`;
  console.log('fk_child has no index on parent_id; fk_ok has one:');
  console.table((await q(finder)).rows);

  // and the cost of the missing one, on a parent DELETE
  await q(`DROP TABLE IF EXISTS ix_child, ix_parent CASCADE`);
  await q(`CREATE TABLE ix_parent (id int PRIMARY KEY)`);
  await q(`CREATE TABLE ix_child (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
           parent_id int REFERENCES ix_parent(id) ON DELETE CASCADE)`);
  await q(`INSERT INTO ix_parent SELECT g FROM generate_series(1,1000) g`);
  await q(`INSERT INTO ix_child (parent_id) SELECT (g%1000)+1 FROM generate_series(1,300000) g`);
  await q(`ANALYZE ix_parent`); await q(`ANALYZE ix_child`);

  let t0 = process.hrtime.bigint();
  await q(`DELETE FROM ix_parent WHERE id = 500`);
  const noIdx = Number(process.hrtime.bigint() - t0) / 1e6;
  await q(`CREATE INDEX ix_child_parent_idx ON ix_child (parent_id)`);
  await q(`ANALYZE ix_child`);
  t0 = process.hrtime.bigint();
  await q(`DELETE FROM ix_parent WHERE id = 501`);
  const withIdx = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`DELETE parent, child FK unindexed: ${noIdx.toFixed(1)} ms`);
  console.log(`DELETE parent, child FK indexed:   ${withIdx.toFixed(1)} ms  (${(noIdx / withIdx).toFixed(0)}x faster)`);
}

await pool.end();
