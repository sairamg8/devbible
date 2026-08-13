// Phase 3 / 01, 04, 06, 16 — CHECK semantics, defaults, relationships, temp tables.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

// --- 1. CHECK and three-valued logic --------------------------------------
line('1. does a CHECK constraint reject NULL?');
{
  await q(`DROP TABLE IF EXISTS ck_t`);
  await q(`CREATE TABLE ck_t (id int, age int CHECK (age >= 18))`);
  const tryIns = async (v) => {
    try { await q(`INSERT INTO ck_t (id, age) VALUES (1, $1)`, [v]); return 'accepted'; }
    catch (e) { return `${e.code} ${e.constraint}`; }
  };
  console.log('age = 20   →', await tryIns(20));
  console.log('age = 10   →', await tryIns(10));
  console.log('age = NULL →', await tryIns(null), '  ← CHECK passes on NULL (unknown is not false)');
  console.log('rows now:', (await q(`SELECT count(*)::int n FROM ck_t`)).rows[0].n);
}

// --- 2. multi-column CHECK and NULL ---------------------------------------
line('2. a CHECK across two columns');
{
  await q(`DROP TABLE IF EXISTS ck2`);
  await q(`CREATE TABLE ck2 (starts date, ends date, CHECK (ends > starts))`);
  for (const [s, e] of [['2026-01-01','2026-02-01'], ['2026-02-01','2026-01-01'], [null,'2026-01-01']]) {
    try { await q(`INSERT INTO ck2 VALUES ($1,$2)`, [s, e]); console.log(`(${s}, ${e}) → accepted`); }
    catch (err) { console.log(`(${s}, ${e}) →`, err.code, err.constraint); }
  }
}

// --- 3. DEFAULT evaluation time -------------------------------------------
line('3. when is a DEFAULT evaluated?');
{
  await q(`DROP TABLE IF EXISTS df_t`);
  await q(`CREATE TABLE df_t (id int, created timestamptz DEFAULT now(), tag text DEFAULT 'new')`);
  const c = await pool.connect();
  await c.query('BEGIN');
  await c.query(`INSERT INTO df_t (id) VALUES (1)`);
  await new Promise((r) => setTimeout(r, 150));
  await c.query(`INSERT INTO df_t (id) VALUES (2)`);
  await c.query('COMMIT');
  c.release();
  const {rows} = await q(`SELECT id, created FROM df_t ORDER BY id`);
  console.log('two inserts 150ms apart in ONE transaction:');
  rows.forEach((r) => console.log('  id', r.id, r.created.toISOString()));
  console.log('same timestamp?', rows[0].created.getTime() === rows[1].created.getTime(),
    '← now() is transaction start time, not statement time');
  const st = await q(`SELECT now() = statement_timestamp() AS same, clock_timestamp() IS NOT NULL AS c`);
  console.log('outside a transaction, now() == statement_timestamp():', st.rows[0].same);
}

// --- 4. explicit NULL vs DEFAULT ------------------------------------------
line('4. inserting NULL explicitly does not use the DEFAULT');
{
  await q(`DELETE FROM df_t`);
  await q(`INSERT INTO df_t (id, tag) VALUES (1, DEFAULT)`);
  await q(`INSERT INTO df_t (id, tag) VALUES (2, NULL)`);
  console.table((await q(`SELECT id, tag FROM df_t ORDER BY id`)).rows);
}

// --- 5. relationships: 1-1, 1-N, N-N --------------------------------------
line('5. modelling the three relationships');
{
  await q(`DROP TABLE IF EXISTS r_post_tags, r_profiles, r_posts, r_tags, r_users CASCADE`);
  await q(`CREATE TABLE r_users (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email text NOT NULL UNIQUE)`);
  // 1-1: UNIQUE on the FK is what makes it one-to-one
  await q(`CREATE TABLE r_profiles (
    user_id bigint PRIMARY KEY REFERENCES r_users(id) ON DELETE CASCADE,
    bio text)`);
  // 1-N
  await q(`CREATE TABLE r_posts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES r_users(id) ON DELETE CASCADE,
    title text NOT NULL)`);
  await q(`CREATE INDEX r_posts_user_id_idx ON r_posts (user_id)`);
  // N-N
  await q(`CREATE TABLE r_tags (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL UNIQUE)`);
  await q(`CREATE TABLE r_post_tags (
    post_id bigint NOT NULL REFERENCES r_posts(id) ON DELETE CASCADE,
    tag_id  bigint NOT NULL REFERENCES r_tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id))`);

  const {rows:[u]} = await q(`INSERT INTO r_users (email) VALUES ('a@x.com') RETURNING id`);
  await q(`INSERT INTO r_profiles (user_id, bio) VALUES ($1,'hi')`, [u.id]);
  try { await q(`INSERT INTO r_profiles (user_id, bio) VALUES ($1,'again')`, [u.id]); }
  catch (e) { console.log('second profile for same user →', e.code, '← PRIMARY KEY on the FK enforces 1-1'); }

  const {rows:[p]} = await q(`INSERT INTO r_posts (user_id,title) VALUES ($1,'t') RETURNING id`, [u.id]);
  const {rows:[t1]} = await q(`INSERT INTO r_tags (name) VALUES ('sql') RETURNING id`);
  await q(`INSERT INTO r_post_tags VALUES ($1,$2)`, [p.id, t1.id]);
  try { await q(`INSERT INTO r_post_tags VALUES ($1,$2)`, [p.id, t1.id]); }
  catch (e) { console.log('duplicate tag on a post →', e.code, '← composite PK enforces it'); }

  // which direction does the composite PK index serve?
  await q(`INSERT INTO r_tags (name) SELECT 'tag'||g FROM generate_series(2,20000) g`);
  await q(`INSERT INTO r_posts (user_id,title) SELECT $1,'p'||g FROM generate_series(2,20000) g`, [u.id]);
  await q(`INSERT INTO r_post_tags (post_id, tag_id)
           SELECT p.id, t.id FROM r_posts p JOIN r_tags t ON t.id = p.id ON CONFLICT DO NOTHING`);
  await q(`ANALYZE r_post_tags`);
  const plan = async (sql) => (await q(`EXPLAIN ${sql}`)).rows.map(r=>r['QUERY PLAN']).join(' | ');
  console.log('rows in join table:', (await q(`SELECT count(*)::int n FROM r_post_tags`)).rows[0].n);
  console.log('WHERE post_id = $1 →', (await plan(`SELECT * FROM r_post_tags WHERE post_id = 500`)).split('|')[0].trim());
  console.log('WHERE tag_id  = $1 →', (await plan(`SELECT * FROM r_post_tags WHERE tag_id = 500`)).split('|')[0].trim());
  await q(`CREATE INDEX r_post_tags_tag_idx ON r_post_tags (tag_id)`);
  await q(`ANALYZE r_post_tags`);
  console.log('after adding (tag_id) index →', (await plan(`SELECT * FROM r_post_tags WHERE tag_id = 500`)).split('|')[0].trim());
}

// --- 6. TEMPORARY and UNLOGGED --------------------------------------------
line('6. TEMP and UNLOGGED');
{
  const bench = async (label, ddl, name) => {
    await q(`DROP TABLE IF EXISTS ${name}`);
    await q(ddl);
    const t0 = performance.now();
    await q(`INSERT INTO ${name} (t) SELECT 'x'||g FROM generate_series(1,100000) g`);
    console.log(`${label.padEnd(24)} ${(performance.now()-t0).toFixed(0).padStart(6)} ms`);
    await q(`DROP TABLE IF EXISTS ${name}`);
  };
  await bench('LOGGED', `CREATE TABLE lg2 (t text)`, 'lg2');
  await bench('UNLOGGED', `CREATE UNLOGGED TABLE ul2 (t text)`, 'ul2');

  // TEMP tables are per-session and invisible elsewhere
  const c = await pool.connect();
  await c.query(`CREATE TEMP TABLE tmp_t (t text)`);
  await c.query(`INSERT INTO tmp_t VALUES ('only here')`);
  console.log('temp table visible on its own session:',
    (await c.query(`SELECT count(*)::int n FROM tmp_t`)).rows[0].n, 'row');
  const other = await pool.connect();
  try { await other.query(`SELECT * FROM tmp_t`); console.log('visible on another session (unexpected)'); }
  catch (e) { console.log('from another pooled connection →', e.code, e.message.split('\n')[0]); }
  other.release();
  const sch = await c.query(`SELECT nspname FROM pg_namespace WHERE oid = pg_my_temp_schema()`);
  console.log('temp schema for this session:', sch.rows[0].nspname);
  c.release();
}

await q(`DROP TABLE IF EXISTS ck_t, ck2, df_t, r_post_tags, r_profiles, r_posts, r_tags, r_users CASCADE`);
await pool.end();
