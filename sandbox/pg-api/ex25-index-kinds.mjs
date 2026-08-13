// Phase 10 pages 08-11 — index-only + INCLUDE, partial, expression, GIN/trgm.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const plan = async (sql, opts = 'ANALYZE, BUFFERS, COSTS OFF') =>
  (await q(`EXPLAIN (${opts}) ${sql}`)).rows.map(r => r['QUERY PLAN']).join('\n');
const node1 = (p) => (p.split('\n').find(l => /Scan/.test(l))?.trim() ?? '?').split('  (')[0];
const time = (p) => p.match(/Execution Time: ([\d.]+) ms/)?.[1];
const bufs = (p) => p.match(/Buffers: shared ([^\n]+)/)?.[1] ?? '';
const size = async (rel) => (await q(`SELECT pg_size_pretty(pg_relation_size($1)) AS s`, [rel])).rows[0].s;

// --- 1. index-only scans and the visibility map ---------------------------
line('1. index-only scan — and why it needs the visibility map');
{
  await q(`DROP TABLE IF EXISTS i_orders`);
  await q(`CREATE TABLE i_orders AS
           SELECT g AS id, (g % 20000) AS user_id, (g % 97) * 1.5 AS amount,
                  'note ' || g AS note
           FROM generate_series(1, 400000) g`);
  await q(`CREATE INDEX i_orders_user_idx ON i_orders (user_id)`);
  await q(`ANALYZE i_orders`);

  const sqlCovered = `SELECT user_id FROM i_orders WHERE user_id BETWEEN 100 AND 400`;
  const sqlExtra   = `SELECT user_id, amount FROM i_orders WHERE user_id BETWEEN 100 AND 400`;

  // right after a bulk load nothing is marked all-visible yet
  const cold = await plan(sqlCovered);
  console.log('-- covered query, table never vacuumed --');
  console.log(cold);
  console.log('\nvisibility map pages:',
    (await q(`SELECT relallvisible FROM pg_class WHERE relname='i_orders'`)).rows[0].relallvisible);

  await q(`VACUUM i_orders`);
  console.log('after VACUUM, relallvisible =',
    (await q(`SELECT relallvisible FROM pg_class WHERE relname='i_orders'`)).rows[0].relallvisible,
    'of', (await q(`SELECT relpages FROM pg_class WHERE relname='i_orders'`)).rows[0].relpages, 'pages');
  const warm = await plan(sqlCovered);
  console.log('\n-- same query after VACUUM --');
  console.log(warm);

  // one extra column and the index-only scan is gone
  console.log('\n-- add one column that is not in the index --');
  const extra = await plan(sqlExtra);
  console.log(node1(extra), '→', time(extra), 'ms |', bufs(extra));

  // INCLUDE puts it back — test it ALONE so nothing else can serve the query
  await q(`CREATE INDEX i_orders_user_inc_idx ON i_orders (user_id) INCLUDE (amount)`);
  await q(`VACUUM ANALYZE i_orders`);
  const inc = await plan(sqlExtra);
  console.log('with INCLUDE (amount) only:', node1(inc), '→', time(inc), 'ms |', bufs(inc));

  await q(`CREATE INDEX i_orders_user_amt_idx ON i_orders (user_id, amount)`);
  await q(`VACUUM ANALYZE i_orders`);
  console.log('\nindex sizes — key only / INCLUDE / two-column key:');
  console.table((await q(`SELECT indexrelname AS name, pg_size_pretty(pg_relation_size(indexrelid)) AS size
                          FROM pg_stat_user_indexes WHERE relname='i_orders' ORDER BY 1`)).rows);

  // what INCLUDE cannot do, with the two-column index present as the control
  console.log('\nWHERE amount = 42.0 — searchable in a KEY column, not in an INCLUDE column:');
  const withKey = await plan(`SELECT user_id FROM i_orders WHERE amount = 42.0`);
  console.log('  (user_id, amount) present :', node1(withKey), '→', time(withKey), 'ms');
  await q(`DROP INDEX i_orders_user_amt_idx`);
  await q(`ANALYZE i_orders`);
  const byInc = await plan(`SELECT user_id FROM i_orders WHERE amount = 42.0`);
  console.log('  only INCLUDE (amount)     :', node1(byInc), '→', time(byInc), 'ms');
  console.log('\n  ORDER BY an INCLUDE column — note the explicit Sort node:');
  console.log(await plan(`SELECT user_id, amount FROM i_orders WHERE user_id = 42 ORDER BY amount LIMIT 5`));

  // and a write undoes the all-visible bit
  await q(`UPDATE i_orders SET note = note WHERE id = 1`);
  const dirty = await plan(sqlCovered);
  console.log('\nafter ONE update, heap fetches on the covered query:',
    dirty.match(/Heap Fetches: (\d+)/)?.[1], '(was',
    warm.match(/Heap Fetches: (\d+)/)?.[1] + ')');
}

// --- 2. partial indexes ----------------------------------------------------
line('2. partial indexes');
{
  await q(`DROP TABLE IF EXISTS p_docs`);
  await q(`CREATE TABLE p_docs AS
           SELECT g AS id,
                  'doc ' || g AS title,
                  CASE WHEN g % 100 = 0 THEN NULL
                       ELSE now() - (g || ' seconds')::interval END AS deleted_at,
                  (ARRAY['draft','published','archived'])[1 + g % 3] AS state
           FROM generate_series(1, 400000) g`);
  await q(`CREATE INDEX p_docs_full_idx ON p_docs (id)`);
  await q(`CREATE INDEX p_docs_live_idx ON p_docs (id) WHERE deleted_at IS NULL`);
  await q(`VACUUM ANALYZE p_docs`);
  console.log('rows:', (await q(`SELECT count(*)::int c FROM p_docs`)).rows[0].c,
    '| live (deleted_at IS NULL):', (await q(`SELECT count(*)::int c FROM p_docs WHERE deleted_at IS NULL`)).rows[0].c);
  console.log('full index :', await size('p_docs_full_idx'), '| partial index:', await size('p_docs_live_idx'));

  const matching = await plan(`SELECT * FROM p_docs WHERE deleted_at IS NULL ORDER BY id LIMIT 20`);
  console.log('\npredicate matches exactly    :', node1(matching), '→', time(matching), 'ms |', bufs(matching));

  const equiv = await plan(`SELECT * FROM p_docs WHERE deleted_at IS NOT DISTINCT FROM NULL ORDER BY id LIMIT 20`);
  console.log('an equivalent the planner CAN prove (IS NOT DISTINCT FROM NULL):', node1(equiv));
  const noPred = await plan(`SELECT * FROM p_docs ORDER BY id LIMIT 20`);
  console.log('no predicate at all          :', node1(noPred), '→', time(noPred), 'ms');
  const st = await plan(`SELECT * FROM p_docs WHERE state = 'published' AND deleted_at IS NULL LIMIT 20`);
  console.log('extra AND on top of predicate:', node1(st), '→', time(st), 'ms');

  // the predicate must be IMPLIED, and a parameter cannot be checked at plan time
  await q(`DROP INDEX p_docs_full_idx`);
  await q(`CREATE INDEX p_docs_pub_idx ON p_docs (id) WHERE state = 'published'`);
  await q(`ANALYZE p_docs`);
  const lit = await plan(`SELECT * FROM p_docs WHERE state = 'published' ORDER BY id LIMIT 20`);
  console.log("\nWHERE state = 'published' (literal) :", node1(lit), '→', time(lit), 'ms');
  const c = await pool.connect();
  await c.query(`PREPARE pp (text) AS SELECT * FROM p_docs WHERE state = $1 ORDER BY id LIMIT 20`);
  for (let i = 0; i < 7; i++) await c.query(`EXECUTE pp('published')`);
  const gen = (await c.query(`EXPLAIN (COSTS OFF) EXECUTE pp('published')`))
    .rows.map(r => r['QUERY PLAN']).join('\n');
  console.log('same via PREPARE/EXECUTE ($1), 8th run — the generic plan:');
  console.log(gen);
  await c.query(`DEALLOCATE pp`);
  c.release();

  // partial UNIQUE — the real reason most people reach for this
  await q(`DROP TABLE IF EXISTS p_slugs`);
  await q(`CREATE TABLE p_slugs (id int, slug text, deleted_at timestamptz)`);
  await q(`CREATE UNIQUE INDEX p_slugs_live_uq ON p_slugs (slug) WHERE deleted_at IS NULL`);
  await q(`INSERT INTO p_slugs VALUES (1,'about',now()), (2,'about',now()), (3,'about',NULL)`);
  console.log('\ntwo soft-deleted "about" rows plus one live one: inserted OK');
  try {
    await q(`INSERT INTO p_slugs VALUES (4,'about',NULL)`);
  } catch (e) { console.log('second LIVE "about" →', e.code, e.constraint, '|', e.message); }
}

// --- 3. expression indexes -------------------------------------------------
line('3. expression indexes');
{
  await q(`DROP TABLE IF EXISTS e_users`);
  await q(`CREATE TABLE e_users AS
           SELECT g AS id, 'User' || g || '@Example.COM' AS email,
                  (now() - (g || ' seconds')::interval)::timestamptz AS created_at
           FROM generate_series(1, 400000) g`);
  await q(`CREATE INDEX e_users_email_idx ON e_users (email)`);
  await q(`ANALYZE e_users`);
  const before = await plan(`SELECT * FROM e_users WHERE lower(email) = 'user12345@example.com'`);
  console.log('lower(email), plain index    :', node1(before), '→', time(before), 'ms');

  await q(`CREATE INDEX e_users_lower_email_idx ON e_users (lower(email))`);
  await q(`ANALYZE e_users`);
  const after = await plan(`SELECT * FROM e_users WHERE lower(email) = 'user12345@example.com'`);
  console.log('lower(email), expression idx :', node1(after), '→', time(after), 'ms');

  // it must match character for character
  const upper = await plan(`SELECT * FROM e_users WHERE upper(email) = 'USER12345@EXAMPLE.COM'`);
  console.log('upper(email) instead         :', node1(upper), '→', time(upper), 'ms');
  const bare = await plan(`SELECT * FROM e_users WHERE email = 'User12345@Example.COM'`);
  console.log('bare email (the other index) :', node1(bare), '→', time(bare), 'ms');

  // the immutability rule — the date expressions everybody reaches for first
  console.log('\n-- which date expressions may be indexed at all (created_at is timestamptz) --');
  await q(`ALTER TABLE e_users ADD COLUMN created_ts timestamp`);
  await q(`UPDATE e_users SET created_ts = created_at AT TIME ZONE 'UTC'`);
  const attempts = [
    ['(created_at::date)', `(created_at::date)`],
    ["((created_at AT TIME ZONE 'UTC')::date)", `((created_at AT TIME ZONE 'UTC')::date)`],
    ["(date_trunc('day', created_at))", `(date_trunc('day', created_at))`],
    ["(date_trunc('day', created_at, 'UTC'))", `(date_trunc('day', created_at, 'UTC'))`],
    ['(created_ts::date)  -- plain timestamp', `(created_ts::date)`],
    ['(age(created_at))', `(age(created_at))`],
  ];
  for (const [label, expr] of attempts) {
    try {
      await q(`CREATE INDEX e_try ON e_users (${expr})`);
      await q(`DROP INDEX e_try`);
      console.log(`  OK      ${label}`);
    } catch (e) { console.log(`  ${e.code}   ${label} → ${e.message}`); }
  }

  await q(`CREATE INDEX e_users_day_idx ON e_users ((date_trunc('day', created_at, 'UTC')))`);
  await q(`ANALYZE e_users`);
  const day = await plan(`SELECT count(*) FROM e_users
                          WHERE date_trunc('day', created_at, 'UTC') = date_trunc('day', now(), 'UTC')`);
  console.log('\ndate_trunc(...,\'UTC\'), expr idx:', node1(day), '→', time(day), 'ms');

  // expression indexes get their own statistics
  await q(`ANALYZE e_users`);
  console.log('\npg_stats rows for the expression indexes:');
  console.table((await q(`SELECT tablename, attname, n_distinct
                          FROM pg_stats WHERE tablename LIKE 'e_users%' AND attname NOT IN ('id','email','created_at')
                          ORDER BY 1,2`)).rows);
}

// --- 4. GIN: jsonb, arrays, full text -------------------------------------
line('4. GIN — jsonb, arrays, full text');
{
  await q(`DROP TABLE IF EXISTS g_items`);
  await q(`CREATE TABLE g_items AS
           SELECT g AS id,
                  jsonb_build_object('sku','sku-'||g,
                                     'tags', to_jsonb(ARRAY['t'||(g%50), 't'||(g%7)]),
                                     'price', (g%500)) AS doc,
                  ARRAY['t'||(g%50), 't'||(g%7)] AS tags,
                  'the quick brown fox number ' || g || ' jumps' AS body
           FROM generate_series(1, 300000) g`);
  await q(`ANALYZE g_items`);

  // selectivity decides whether GIN wins — measure BOTH ends, not just the flattering one
  const selective = `SELECT count(*) FROM g_items WHERE doc @> '{"sku": "sku-123456"}'`;  //      1 row
  const broad     = `SELECT count(*) FROM g_items WHERE doc @> '{"tags": ["t3"]}'`;        // ~48000 rows
  const selNo = await plan(selective), broadNo = await plan(broad);
  console.log('selective @>, no index  :', node1(selNo), '→', time(selNo), 'ms');
  console.log('broad     @>, no index  :', node1(broadNo), '→', time(broadNo), 'ms');

  await q(`CREATE INDEX g_items_doc_gin ON g_items USING gin (doc)`);
  await q(`VACUUM ANALYZE g_items`);
  const selYes = await plan(selective), broadYes = await plan(broad);
  console.log('selective @>, with GIN  :', node1(selYes), '→', time(selYes), 'ms |', bufs(selYes));
  console.log('broad     @>, with GIN  :', node1(broadYes), '→', time(broadYes), 'ms |', bufs(broadYes),
    '← 16% of the table; GIN is not a win here');
  console.log('  gin size:', await size('g_items_doc_gin'), '| heap:', await size('g_items'));

  // jsonb_path_ops is smaller but supports fewer operators
  await q(`CREATE INDEX g_items_doc_ops ON g_items USING gin (doc jsonb_path_ops)`);
  console.log('  jsonb_path_ops size:', await size('g_items_doc_ops'), '← smaller, but cannot serve ? / ?| / ?&');
  await q(`DROP INDEX g_items_doc_gin`);
  await q(`ANALYZE g_items`);
  const key = await plan(`SELECT count(*) FROM g_items WHERE doc ? 'discount'`);
  console.log("doc ? 'discount', only jsonb_path_ops present:", node1(key), '→', time(key), 'ms');
  await q(`CREATE INDEX g_items_doc_gin ON g_items USING gin (doc)`);
  await q(`VACUUM ANALYZE g_items`);
  const key2 = await plan(`SELECT count(*) FROM g_items WHERE doc ? 'discount'`);
  console.log("doc ? 'discount', default jsonb_ops present :", node1(key2), '→', time(key2), 'ms');

  // arrays
  await q(`CREATE INDEX g_items_tags_gin ON g_items USING gin (tags)`);
  await q(`VACUUM ANALYZE g_items`);
  const arr = await plan(`SELECT count(*) FROM g_items WHERE tags @> ARRAY['t3']`);
  console.log("\ntags @> ARRAY['t3']     :", node1(arr), '→', time(arr), 'ms |', bufs(arr));

  // full text
  await q(`CREATE INDEX g_items_body_fts ON g_items USING gin (to_tsvector('english', body))`);
  await q(`ANALYZE g_items`);
  const fts = await plan(`SELECT count(*) FROM g_items
                          WHERE to_tsvector('english', body) @@ to_tsquery('english','fox & 12345')`);
  console.log('full text @@            :', node1(fts), '→', time(fts), 'ms |', bufs(fts));

  // the GIN write cost
  console.log('\nGIN write cost — 20000 inserts:');
  for (const [label, drop] of [['with 4 GIN indexes', false], ['with none', true]]) {
    if (drop) await q(`DROP INDEX g_items_doc_gin, g_items_doc_ops, g_items_tags_gin, g_items_body_fts`);
    const t0 = process.hrtime.bigint();
    await q(`INSERT INTO g_items (id, doc, tags, body)
             SELECT 1000000+g, jsonb_build_object('sku','x'||g,'tags',to_jsonb(ARRAY['t'||(g%50)])),
                    ARRAY['t'||(g%50)], 'body ' || g
             FROM generate_series(1,20000) g`);
    console.log(` ${label.padEnd(20)}`, `${(Number(process.hrtime.bigint()-t0)/1e6).toFixed(0)} ms`);
  }
  console.log('gin_pending_list_limit:', (await q(`SHOW gin_pending_list_limit`)).rows[0].gin_pending_list_limit,
    '— GIN buffers inserts in a pending list, so the cost is deferred, not avoided');
}

// --- 5. pg_trgm makes LIKE '%x%' indexable ---------------------------------
line("5. pg_trgm — indexing LIKE '%x%'");
{
  await q(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  const sql = `SELECT count(*) FROM e_users WHERE email LIKE '%12345@Exam%'`;
  const before = await plan(sql);
  console.log('infix LIKE, btree only  :', node1(before), '→', time(before), 'ms |', bufs(before));

  await q(`CREATE INDEX e_users_email_trgm ON e_users USING gin (email gin_trgm_ops)`);
  await q(`ANALYZE e_users`);
  const after = await plan(sql);
  console.log('infix LIKE, gin_trgm_ops:', node1(after), '→', time(after), 'ms |', bufs(after));
  console.log('  trgm index size:', await size('e_users_email_trgm'), '| btree on same column:', await size('e_users_email_idx'));

  // ILIKE and similarity come along for free
  const ilike = await plan(`SELECT count(*) FROM e_users WHERE email ILIKE '%12345@exam%'`);
  console.log('ILIKE                   :', node1(ilike), '→', time(ilike), 'ms');
  // distance ordering is a GiST feature, not a GIN one
  const simGin = await plan(`SELECT email FROM e_users ORDER BY email <-> 'User12345@Example.COM' LIMIT 5`);
  console.log('<-> ordering, GIN trgm  :', node1(simGin), '→', time(simGin), 'ms');
  await q(`CREATE INDEX e_users_email_trgm_gist ON e_users USING gist (email gist_trgm_ops)`);
  await q(`ANALYZE e_users`);
  const simGist = await plan(`SELECT email FROM e_users ORDER BY email <-> 'User12345@Example.COM' LIMIT 5`);
  console.log('<-> ordering, GiST trgm :', node1(simGist), '→', time(simGist), 'ms');
  console.log('  gist trgm size:', await size('e_users_email_trgm_gist'));

  // trigrams are 3 characters: a 2-character pattern cannot use the index
  const two = await plan(`SELECT count(*) FROM e_users WHERE email LIKE '%99%'`);
  console.log("pattern shorter than 3  :", node1(two), '→', time(two), 'ms');
  console.log('trigrams of "abcd":', (await q(`SELECT show_trgm('abcd') AS t`)).rows[0].t);
}

await pool.end();
