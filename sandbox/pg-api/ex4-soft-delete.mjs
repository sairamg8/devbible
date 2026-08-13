// Phase 9 / 09 — hard vs soft delete. Every claim on the page comes from here.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible',
  max: 10,
});
const line = (t) => console.log(`\n=== ${t} ===`);
const q = (...a) => pool.query(...a);

await q(`DROP TABLE IF EXISTS sd_orders, sd_users CASCADE`);
await q(`
  CREATE TABLE sd_users (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email      text NOT NULL,
    name       text NOT NULL,
    deleted_at timestamptz
  )
`);
await q(`
  CREATE TABLE sd_orders (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES sd_users(id) ON DELETE CASCADE,
    total   numeric(12,2) NOT NULL
  )
`);

// --- 1. hard delete: what comes back, and what it takes with it ------------
line('1. hard delete with RETURNING');
{
  const {rows: [u]} = await q(
    `INSERT INTO sd_users (email, name) VALUES ($1,$2) RETURNING id`,
    ['hard@x.com', 'Hard'],
  );
  await q(`INSERT INTO sd_orders (user_id, total) VALUES ($1,$2), ($1,$3)`, [u.id, '10.00', '20.00']);
  const before = await q(`SELECT count(*)::int AS n FROM sd_orders WHERE user_id = $1`, [u.id]);
  const del = await q(`DELETE FROM sd_users WHERE id = $1 RETURNING id, email, name`, [u.id]);
  const after = await q(`SELECT count(*)::int AS n FROM sd_orders WHERE user_id = $1`, [u.id]);
  console.log('rowCount:', del.rowCount, '| returned:', del.rows[0]);
  console.log('orders before:', before.rows[0].n, '→ after:', after.rows[0].n, '(ON DELETE CASCADE)');

  const missing = await q(`DELETE FROM sd_users WHERE id = $1 RETURNING id`, [999999]);
  console.log('deleting a row that is not there → rowCount:', missing.rowCount, '| rows:', missing.rows);
}

// --- 2. soft delete: the UPDATE, and what does NOT happen -----------------
line('2. soft delete');
{
  const {rows: [u]} = await q(
    `INSERT INTO sd_users (email, name) VALUES ($1,$2) RETURNING id`,
    ['soft@x.com', 'Soft'],
  );
  await q(`INSERT INTO sd_orders (user_id, total) VALUES ($1,$2)`, [u.id, '99.00']);
  const del = await q(
    `UPDATE sd_users SET deleted_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, email, deleted_at`,
    [u.id],
  );
  console.log('rowCount:', del.rowCount, '| deleted_at set:', del.rows[0].deleted_at instanceof Date);
  const again = await q(
    `UPDATE sd_users SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [u.id],
  );
  console.log('deleting the same row twice → rowCount:', again.rowCount, '(idempotent)');
  const orders = await q(`SELECT count(*)::int AS n FROM sd_orders WHERE user_id = $1`, [u.id]);
  console.log('orphaned orders still visible:', orders.rows[0].n, '— no cascade fires on an UPDATE');
}

// --- 3. the unique-constraint collision ------------------------------------
line('3. re-registering a soft-deleted email');
{
  await q(`CREATE UNIQUE INDEX sd_users_email_key ON sd_users (email)`);
  await q(`INSERT INTO sd_users (email, name) VALUES ($1,$2)`, ['dup@x.com', 'First']);
  await q(`UPDATE sd_users SET deleted_at = now() WHERE email = $1`, ['dup@x.com']);
  try {
    await q(`INSERT INTO sd_users (email, name) VALUES ($1,$2)`, ['dup@x.com', 'Second']);
    console.log('plain unique index: re-registration allowed');
  } catch (e) {
    console.log('plain unique index →', e.code, e.constraint, '|', e.detail);
  }

  await q(`DROP INDEX sd_users_email_key`);
  await q(`CREATE UNIQUE INDEX sd_users_live_email_key ON sd_users (email) WHERE deleted_at IS NULL`);
  const ins = await q(
    `INSERT INTO sd_users (email, name) VALUES ($1,$2) RETURNING id, email`,
    ['dup@x.com', 'Second'],
  );
  console.log('partial unique index → re-registration ok:', ins.rows[0]);
  const both = await q(
    `SELECT count(*)::int AS n FROM sd_users WHERE email = $1`, ['dup@x.com'],
  );
  console.log('rows now holding that email:', both.rows[0].n, '(1 live, 1 tombstoned)');
}

// --- 4. the forgotten filter ----------------------------------------------
line('4. the query everyone forgets to change');
{
  const all = await q(`SELECT count(*)::int AS n FROM sd_users`);
  const live = await q(`SELECT count(*)::int AS n FROM sd_users WHERE deleted_at IS NULL`);
  console.log('SELECT count(*)            →', all.rows[0].n);
  console.log('... WHERE deleted_at IS NULL →', live.rows[0].n);
}

// --- 5. does the partial index actually get used at scale? ----------------
line('5. partial index on a realistic table');
{
  await q(`DROP TABLE IF EXISTS sd_big`);
  await q(`
    CREATE TABLE sd_big (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      email text NOT NULL,
      deleted_at timestamptz
    )
  `);
  // 200k rows, 10% soft-deleted
  await q(`
    INSERT INTO sd_big (email, deleted_at)
    SELECT 'u' || g || '@x.com',
           CASE WHEN g % 10 = 0 THEN now() ELSE NULL END
      FROM generate_series(1, 200000) g
  `);
  await q(`ANALYZE sd_big`);

  const plan = async (label, sql) => {
    const {rows} = await q(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`);
    const text = rows.map((r) => r['QUERY PLAN']).join('\n');
    const node = text.split('\n')[0].trim();
    const exec = text.match(/Execution Time: ([\d.]+) ms/)?.[1];
    const buffers = text.match(/Buffers: shared hit=(\d+)(?: read=(\d+))?/)?.[0];
    console.log(`${label}\n   ${node}\n   ${buffers} | Execution Time: ${exec} ms`);
  };

  await plan('no index:', `SELECT * FROM sd_big WHERE deleted_at IS NULL AND email = 'u12345@x.com'`);

  await q(`CREATE INDEX sd_big_email_idx ON sd_big (email)`);
  await q(`ANALYZE sd_big`);
  await plan('full index on (email):',
    `SELECT * FROM sd_big WHERE deleted_at IS NULL AND email = 'u12345@x.com'`);

  await q(`DROP INDEX sd_big_email_idx`);
  await q(`CREATE INDEX sd_big_live_email_idx ON sd_big (email) WHERE deleted_at IS NULL`);
  await q(`ANALYZE sd_big`);
  await plan('partial index WHERE deleted_at IS NULL:',
    `SELECT * FROM sd_big WHERE deleted_at IS NULL AND email = 'u12345@x.com'`);

  const sizes = await q(`
    SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) AS size
      FROM pg_stat_user_indexes WHERE relname = 'sd_big' ORDER BY 1
  `);
  console.table(sizes.rows);

  // does the planner still use the partial index if the query omits the predicate?
  const {rows} = await q(
    `EXPLAIN (FORMAT TEXT) SELECT * FROM sd_big WHERE email = 'u12345@x.com'`,
  );
  console.log('query without the deleted_at predicate →', rows[0]['QUERY PLAN'].trim());
}

await q(`DROP TABLE IF EXISTS sd_orders, sd_users, sd_big CASCADE`);
await pool.end();
