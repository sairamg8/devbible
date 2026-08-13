// Phase 12 pages 09, 14, 16, 17 — extensions, partitioning, postgres_fdw and
// pgvector. pgvector is NOT in postgres:18-alpine, so topic 17 runs against a
// second container: podman run -d --name devbible-pg-vector \
//   -e POSTGRES_USER=devbible -e POSTGRES_PASSWORD=devbible -e POSTGRES_DB=devbible \
//   -p 55434:5432 docker.io/pgvector/pgvector:pg18
import pg from 'pg';

const MAIN = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const VEC  = 'postgres://devbible:devbible@127.0.0.1:55434/devbible';
const pool = new pg.Pool({connectionString: MAIN, max: 10});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const timed = async (client, n, sql, params) => {
  const ts = [];
  for (let i = 0; i < n; i++) {
    const t0 = process.hrtime.bigint();
    await client.query(sql, params);
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ts.sort((a, b) => a - b);
  return ts[Math.floor(ts.length / 2)];
};
const planOf = async (client, sql, re = /./) =>
  (await client.query(`EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) ${sql}`))
    .rows.map((r) => r['QUERY PLAN']).filter((l) => re.test(l))
    .map((l) => '    ' + l).join('\n');
const tryq = async (label, sql, client = pool) => {
  try { await client.query(sql); console.log(`${label.padEnd(46)} → OK`); }
  catch (e) { console.log(`${label.padEnd(46)} → ${e.code} ${e.message.split('\n')[0]}`); }
};

// ===========================================================================
// 09 · EXTENSIONS
// ===========================================================================

line('1. what is available vs what is installed');
{
  const r = await q(`
    SELECT name, default_version, coalesce(installed_version,'-') AS installed
      FROM pg_available_extensions
     WHERE name IN ('pg_trgm','pgcrypto','uuid-ossp','citext','pg_stat_statements',
                    'postgres_fdw','dblink','btree_gin','vector','hstore')
     ORDER BY name`);
  console.table(r.rows);
  console.log('↑ "available" means shipped with the server; installed_version means');
  console.log('  CREATE EXTENSION has been run IN THIS DATABASE');
  const cnt = await q(`SELECT count(*)::int c FROM pg_available_extensions`);
  console.log('total available in this image:', cnt.rows[0].c);
}

line('2. installing one, and what it brings');
{
  await tryq('CREATE EXTENSION pgcrypto', `CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  const objs = await q(`
    SELECT count(*)::int AS objects FROM pg_depend d
      JOIN pg_extension e ON e.oid = d.refobjid
     WHERE e.extname = 'pgcrypto' AND d.deptype = 'e'`);
  console.log('objects owned by pgcrypto:', objs.rows[0].objects);
  const where = await q(`
    SELECT e.extname, n.nspname AS schema, e.extversion
      FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
     ORDER BY e.extname`);
  console.table(where.rows);
  console.log('digest() now works:',
    (await q(`SELECT encode(digest('hello','sha256'),'hex') AS h`)).rows[0].h.slice(0, 24) + '…');
}

line('3. an extension is per-DATABASE, not per-cluster');
{
  await q(`DROP DATABASE IF EXISTS ext_probe`);
  await q(`CREATE DATABASE ext_probe`);
  const probe = new pg.Pool({connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/ext_probe'});
  const inProbe = await probe.query(
    `SELECT count(*)::int c FROM pg_extension WHERE extname='pgcrypto'`);
  console.log('pgcrypto present in the new database?', inProbe.rows[0].c === 1);
  await tryq('digest() in a database without the extension',
    `SELECT digest('x','sha256')`, probe);
  await probe.end();
}

line('4. dependencies and removal');
{
  // hstore, because nothing else in this database uses it. (citext would fail
  // the second check: ty_ci from ex34 still has a citext column.)
  await q(`DROP TABLE IF EXISTS ext_users`);
  await q(`CREATE EXTENSION IF NOT EXISTS hstore`);
  await q(`CREATE TABLE ext_users (id int PRIMARY KEY, attrs hstore)`);
  await tryq('DROP EXTENSION hstore with a column using it', `DROP EXTENSION hstore`);
  await q(`DROP TABLE ext_users`);
  await tryq('DROP EXTENSION hstore once nothing uses it', `DROP EXTENSION hstore`);

  // and how you find what is blocking a drop
  await q(`CREATE EXTENSION IF NOT EXISTS hstore`);
  await q(`CREATE TABLE ext_users (id int PRIMARY KEY, attrs hstore)`);
  const blockers = await q(`
    SELECT c.relname AS table_name, a.attname AS column_name
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_type t ON t.oid = a.atttypid
     WHERE t.typname = 'hstore' AND c.relkind = 'r'`);
  console.log('what depends on hstore:', JSON.stringify(blockers.rows));
  await q(`DROP TABLE ext_users`);
  await q(`DROP EXTENSION IF EXISTS hstore`);
}

// ===========================================================================
// 14 · PARTITIONING
// ===========================================================================

const N = 400_000;
line('5. a range-partitioned table, and pruning');
{
  await q(`DROP TABLE IF EXISTS p_events CASCADE`);
  await q(`CREATE TABLE p_events (
    id bigint GENERATED ALWAYS AS IDENTITY,
    occurred_at timestamptz NOT NULL,
    kind text NOT NULL,
    payload text NOT NULL
  ) PARTITION BY RANGE (occurred_at)`);
  for (const m of [1, 2, 3, 4]) {
    const mm = String(m).padStart(2, '0');
    const nx = String(m + 1).padStart(2, '0');
    await q(`CREATE TABLE p_events_2026_${mm} PARTITION OF p_events
             FOR VALUES FROM ('2026-${mm}-01') TO ('2026-${nx}-01')`);
  }
  await q(`CREATE TABLE p_events_default PARTITION OF p_events DEFAULT`);
  await q(`INSERT INTO p_events (occurred_at, kind, payload)
           SELECT timestamptz '2026-01-01' + (g % 120) * interval '1 day',
                  'k' || (g % 5), 'payload ' || g
             FROM generate_series(1,$1) g`, [N]);
  await q(`CREATE INDEX ON p_events (occurred_at)`);
  await q(`ANALYZE p_events`);

  const counts = await q(`
    SELECT c.relname, c.reltuples::bigint AS rows
      FROM pg_class c JOIN pg_inherits i ON i.inhrelid = c.oid
     WHERE i.inhparent = 'p_events'::regclass ORDER BY c.relname`);
  console.table(counts.rows);

  const pruned = `SELECT count(*) FROM p_events
                   WHERE occurred_at >= '2026-02-01' AND occurred_at < '2026-03-01'`;
  const all    = `SELECT count(*) FROM p_events WHERE kind = 'k1'`;
  console.log('\nwith the partition key in WHERE:');
  console.log(`  ${(await timed(pool, 3, pruned)).toFixed(1)} ms`);
  console.log(await planOf(pool, pruned, /Scan|Partitions/));
  console.log('\nwithout it — every partition is scanned:');
  console.log(`  ${(await timed(pool, 3, all)).toFixed(1)} ms`);
  console.log(await planOf(pool, all, /Append|Scan on p_events/));
}

line('6. the default partition, and ATTACH/DETACH');
{
  // the seed spans 120 days from 2026-01-01, so it all fits the four monthly
  // partitions and the default starts empty
  const def0 = await q(`SELECT count(*)::int c FROM p_events_default`);
  console.log('DEFAULT partition after the seed:', def0.rows[0].c, 'rows');
  await q(`INSERT INTO p_events (occurred_at, kind, payload) VALUES ('2030-01-01','k','x')`);
  const def1 = await q(`SELECT count(*)::int c FROM p_events_default`);
  console.log('after inserting a 2030 row      :', def1.rows[0].c,
    '← the default catches what no range covers');

  // now the same insert with NO default partition
  await q(`DELETE FROM p_events WHERE occurred_at = '2030-01-01'`);
  await q(`ALTER TABLE p_events DETACH PARTITION p_events_default`);
  await tryq('INSERT with no matching partition and no default',
    `INSERT INTO p_events (occurred_at, kind, payload) VALUES ('2030-01-01','k','x')`);
  await q(`ALTER TABLE p_events ATTACH PARTITION p_events_default DEFAULT`);

  const t0 = Date.now();
  await q(`ALTER TABLE p_events DETACH PARTITION p_events_2026_01`);
  console.log(`DETACH: ${Date.now() - t0} ms  (metadata only — the table still exists)`);
  const still = await q(`SELECT count(*)::int c FROM p_events_2026_01`);
  console.log('  detached table still holds its rows:', still.rows[0].c);
  await q(`ALTER TABLE p_events ATTACH PARTITION p_events_2026_01
           FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')`);
  console.log('  re-attached');

  // dropping old data is the real reason to partition by time
  const dropT0 = Date.now();
  await q(`DROP TABLE p_events_2026_01`);
  console.log(`DROP a whole partition: ${Date.now() - dropT0} ms  ← vs a DELETE of the same rows`);
  await q(`CREATE TABLE p_events_2026_01 PARTITION OF p_events
           FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')`);
}

line('7. an UPDATE that moves a row between partitions');
{
  const before = await q(`SELECT tableoid::regclass AS part, id FROM p_events
                           WHERE occurred_at >= '2026-02-01' AND occurred_at < '2026-02-02' LIMIT 1`);
  console.log('row lives in:', before.rows[0].part);
  await q(`UPDATE p_events SET occurred_at = '2026-03-15' WHERE id = $1`, [before.rows[0].id]);
  const after = await q(`SELECT tableoid::regclass AS part FROM p_events WHERE id = $1`,
    [before.rows[0].id]);
  console.log('after the UPDATE  :', after.rows[0].part, '← the row was moved');
  console.log('  (a partition-key UPDATE is a DELETE + INSERT under the covers)');
}

// ===========================================================================
// 16 · postgres_fdw
// ===========================================================================

line('8. postgres_fdw — a table on another server');
{
  await q(`DROP DATABASE IF EXISTS fdw_remote`);
  await q(`CREATE DATABASE fdw_remote`);
  const remote = new pg.Pool({connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/fdw_remote'});
  await remote.query(`CREATE TABLE r_customers (
    id int PRIMARY KEY, name text NOT NULL, region text NOT NULL)`);
  await remote.query(`INSERT INTO r_customers
    SELECT g, 'customer ' || g, 'region-' || (g % 10) FROM generate_series(1,50000) g`);
  await remote.query(`CREATE INDEX ON r_customers (region)`);
  await remote.query(`ANALYZE r_customers`);
  await remote.end();

  await q(`CREATE EXTENSION IF NOT EXISTS postgres_fdw`);
  await q(`DROP SERVER IF EXISTS remote_srv CASCADE`);
  await q(`CREATE SERVER remote_srv FOREIGN DATA WRAPPER postgres_fdw
           OPTIONS (host '127.0.0.1', port '5432', dbname 'fdw_remote')`);
  await q(`CREATE USER MAPPING FOR CURRENT_USER SERVER remote_srv
           OPTIONS (user 'devbible', password 'devbible')`);
  await q(`CREATE SCHEMA IF NOT EXISTS remote`);
  await q(`IMPORT FOREIGN SCHEMA public LIMIT TO (r_customers)
           FROM SERVER remote_srv INTO remote`);
  console.log('imported:', (await q(
    `SELECT foreign_table_name FROM information_schema.foreign_tables`)).rows);

  const cnt = await q(`SELECT count(*)::int c FROM remote.r_customers`);
  console.log('rows visible through the foreign table:', cnt.rows[0].c);
}

line('9. what gets pushed to the remote server');
{
  const pushed = `SELECT count(*) FROM remote.r_customers WHERE region = 'region-3'`;
  console.log(`filter on an indexed column   ${(await timed(pool, 3, pushed)).toFixed(1).padStart(8)} ms`);
  const v1 = await q(`EXPLAIN (VERBOSE, COSTS OFF) ${pushed}`);
  console.log(v1.rows.map((r) => '    ' + r['QUERY PLAN']).filter((l) => /Remote SQL|Foreign/.test(l)).join('\n'));

  // a local-only expression cannot be pushed down
  const notPushed = `SELECT count(*) FROM remote.r_customers
                      WHERE lower(region) = 'region-3' AND random() < 2`;
  console.log(`\nwith a VOLATILE local function ${(await timed(pool, 3, notPushed)).toFixed(1).padStart(8)} ms`);
  const v2 = await q(`EXPLAIN (VERBOSE, COSTS OFF) ${notPushed}`);
  console.log(v2.rows.map((r) => '    ' + r['QUERY PLAN']).filter((l) => /Remote SQL|Foreign|Filter/.test(l)).join('\n'));
  console.log('↑ compare the Remote SQL lines: the second pulls rows over and filters locally');

  await tryq('a transaction spanning local and foreign tables',
    `BEGIN; SELECT count(*) FROM remote.r_customers; COMMIT`);
  console.log('  ↑ works, but it is NOT two-phase commit — the remote commits separately');
}

await pool.end();

// ===========================================================================
// 17 · pgvector  (second container, port 55434)
// ===========================================================================

const vec = new pg.Pool({connectionString: VEC, max: 5});
line('10. pgvector — the type and the distance operators');
{
  const ver = await vec.query(`SELECT version()`);
  console.log('server:', ver.rows[0].version.split(' on ')[0]);
  await vec.query(`CREATE EXTENSION IF NOT EXISTS vector`);
  const ev = await vec.query(`SELECT extversion FROM pg_extension WHERE extname='vector'`);
  console.log('pgvector version:', ev.rows[0].extversion);

  const ops = await vec.query(`
    SELECT round(('[1,0,0]'::vector <-> '[0,1,0]'::vector)::numeric, 4) AS l2,
           round(('[1,0,0]'::vector <=> '[0,1,0]'::vector)::numeric, 4) AS cosine,
           round(('[1,0,0]'::vector <#> '[0,1,0]'::vector)::numeric, 4) AS neg_inner,
           round(('[1,0,0]'::vector <=> '[1,0,0]'::vector)::numeric, 4) AS cosine_same`);
  console.table(ops.rows);
  console.log('<-> L2 · <=> cosine · <#> negative inner product (negated so ASC = nearest)');

  await tryq('adding vectors of different dimensions',
    `SELECT '[1,2,3]'::vector + '[1,2]'::vector`, vec);
}

line('11. exact search vs an HNSW index');
{
  const DIMS = 384, ROWS = 50_000, CLUSTERS = 200;
  await vec.query(`DROP TABLE IF EXISTS v_docs`);
  await vec.query(`CREATE TABLE v_docs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                                        cluster_id int NOT NULL,
                                        embedding vector(${DIMS}))`);
  // CLUSTERED, not uniform. Uniformly random high-dimensional vectors are all
  // roughly equidistant, so "the 10 nearest" is noise and recall is meaningless.
  // Real embeddings cluster; this fixture does too.
  const t0 = Date.now();
  await vec.query(`
    WITH centroid AS (
      SELECT c AS cid,
             (SELECT array_agg(((c * 7919 + d * 104729) % 1000)::real / 1000 - 0.5)
                FROM generate_series(1,${DIMS}) d) AS base
        FROM generate_series(1,${CLUSTERS}) c)
    INSERT INTO v_docs (cluster_id, embedding)
    SELECT k.cid,
           (SELECT ('[' || string_agg((k.base[d] + (random() - 0.5) * 0.05)::real::text, ',') || ']')::vector
              FROM generate_series(1,${DIMS}) d)
      FROM generate_series(1,${ROWS}) g
      JOIN LATERAL (SELECT cid, base FROM centroid WHERE cid = 1 + (g % ${CLUSTERS})) k ON true`);
  console.log(`seeded ${ROWS} clustered ${DIMS}-dim vectors (${CLUSTERS} clusters) in ${Date.now() - t0} ms`);
  const sz = await vec.query(`SELECT pg_size_pretty(pg_relation_size('v_docs')) s`);
  console.log('table size:', sz.rows[0].s);

  const probe = (await vec.query(`SELECT embedding FROM v_docs WHERE id = 1`)).rows[0].embedding;
  const knn = `SELECT id, (embedding <-> $1) AS d FROM v_docs ORDER BY embedding <-> $1 LIMIT 10`;
  const shortPlan = async () => (await vec.query(
    `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT id FROM v_docs
       ORDER BY embedding <-> '${probe}' LIMIT 10`))
    .rows.map((r) => r['QUERY PLAN'])
    .filter((l) => /Scan|Sort Method|Limit/.test(l))
    .map((l) => '    ' + l.slice(0, 96)).join('\n');

  const exactMs = await timed(vec, 3, knn, [probe]);
  const exact = (await vec.query(knn, [probe])).rows;
  console.log(`\nexact scan (no index)  ${exactMs.toFixed(0).padStart(7)} ms`);
  console.log(await shortPlan());
  console.log(`  10th-nearest distance: ${Number(exact[9].d).toFixed(4)}`);

  const bt0 = Date.now();
  await vec.query(`CREATE INDEX v_docs_hnsw ON v_docs USING hnsw (embedding vector_l2_ops)`);
  console.log(`\nHNSW build: ${Date.now() - bt0} ms`);
  await vec.query(`ANALYZE v_docs`);
  const isz = await vec.query(`SELECT pg_size_pretty(pg_relation_size('v_docs_hnsw')) s`);
  console.log('index size:', isz.rows[0].s);

  const hnswMs = await timed(vec, 5, knn, [probe]);
  console.log(`HNSW search            ${hnswMs.toFixed(1).padStart(7)} ms   (${(exactMs / hnswMs).toFixed(0)}x faster)`);
  console.log(await shortPlan());

  const exactIds = exact.map((r) => String(r.id));
  console.log('\nrecall and result quality as ef_search rises:');
  for (const ef of [10, 40, 100, 400]) {
    const c = await vec.connect();
    await c.query(`SET hnsw.ef_search = ${ef}`);
    const rows = (await c.query(knn, [probe])).rows;
    const ms = await timed(c, 3, knn, [probe]);
    const ov = rows.filter((r) => exactIds.includes(String(r.id))).length;
    console.log(`  ef_search=${String(ef).padStart(3)} → recall ${String(ov).padStart(2)}/10 · ` +
      `10th distance ${Number(rows[9].d).toFixed(4)} · ${ms.toFixed(1)} ms`);
    c.release();
  }
  console.log('↑ HNSW is approximate, but on well-separated clusters it found the exact');
  console.log('  answer at every ef_search — so raising it bought only latency here.');
  console.log('  ef_search is the knob to raise when recall IS poor; it is not free.');
}

line('12. the dimension limit');
{
  await tryq('an index on a 2001-dimension vector', `
    DROP TABLE IF EXISTS v_big;
    CREATE TABLE v_big (e vector(2001));
    CREATE INDEX ON v_big USING hnsw (e vector_l2_ops)`, vec);
  console.log('  ↑ HNSW indexes cap at 2000 dimensions; the COLUMN may be larger');
  await vec.query(`DROP TABLE IF EXISTS v_big`);
}

await vec.query(`DROP TABLE IF EXISTS v_docs`);
await vec.end();

const cleanup = new pg.Pool({connectionString: MAIN});
await cleanup.query(`DROP TABLE IF EXISTS p_events CASCADE`);
await cleanup.query(`DROP SERVER IF EXISTS remote_srv CASCADE`);
await cleanup.query(`DROP SCHEMA IF EXISTS remote CASCADE`);
await cleanup.query(`DROP DATABASE IF EXISTS fdw_remote`);
await cleanup.query(`DROP DATABASE IF EXISTS ext_probe`);
await cleanup.end();
