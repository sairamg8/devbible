// Phase 8 / 03-04-09 — seeding, bulk insert strategies, COPY FROM STDIN.
// Four ways to load the same 10 000 rows, timed on the same table.
import pg from 'pg';
import {from as copyFrom} from 'pg-copy-streams';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible',
  max: 5,
});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

const N = 10000;
const rows = Array.from({length: N}, (_, i) => ({
  email: `bulk${i}@x.com`,
  name: `User ${i}`,
  score: i % 100,
}));

const reset = async () => {
  await q(`DROP TABLE IF EXISTS bulk_users`);
  await q(`CREATE TABLE bulk_users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL, name text NOT NULL, score int NOT NULL)`);
};
const count = async () => (await q(`SELECT count(*)::int n FROM bulk_users`)).rows[0].n;
const time = async (label, fn) => {
  await reset();
  const t0 = performance.now();
  await fn();
  const ms = performance.now() - t0;
  console.log(`${label.padEnd(34)} ${ms.toFixed(0).padStart(7)} ms   rows=${await count()}`);
  return ms;
};

line(`1. loading ${N} rows, four ways`);

// (a) one INSERT per row, each its own implicit transaction
const a = await time('per-row INSERT (autocommit)', async () => {
  for (const r of rows) {
    await q(`INSERT INTO bulk_users (email, name, score) VALUES ($1,$2,$3)`,
      [r.email, r.name, r.score]);
  }
});

// (b) same, but all inside one transaction
const b = await time('per-row INSERT (one transaction)', async () => {
  const c = await pool.connect();
  await c.query('BEGIN');
  for (const r of rows) {
    await c.query(`INSERT INTO bulk_users (email, name, score) VALUES ($1,$2,$3)`,
      [r.email, r.name, r.score]);
  }
  await c.query('COMMIT');
  c.release();
});

// (c) multi-row VALUES, batched (parameter limit is 65535)
const c_ = await time('multi-row VALUES (batch 1000)', async () => {
  for (let i = 0; i < rows.length; i += 1000) {
    const batch = rows.slice(i, i + 1000);
    const vals = [];
    const params = [];
    batch.forEach((r) => {
      params.push(r.email, r.name, r.score);
      vals.push(`($${params.length - 2},$${params.length - 1},$${params.length})`);
    });
    await q(`INSERT INTO bulk_users (email, name, score) VALUES ${vals.join(',')}`, params);
  }
});

// (d) unnest — one statement, three array parameters, any number of rows
const d = await time('INSERT ... SELECT unnest (1 stmt)', async () => {
  await q(
    `INSERT INTO bulk_users (email, name, score)
     SELECT * FROM unnest($1::text[], $2::text[], $3::int[])`,
    [rows.map((r) => r.email), rows.map((r) => r.name), rows.map((r) => r.score)],
  );
});

// (e) COPY FROM STDIN
const e = await time('COPY FROM STDIN', async () => {
  const client = await pool.connect();
  const stream = client.query(copyFrom(
    `COPY bulk_users (email, name, score) FROM STDIN WITH (FORMAT csv)`));
  const src = Readable.from(rows.map((r) => `${r.email},${r.name},${r.score}\n`));
  await pipeline(src, stream);
  client.release();
});

console.log('\nrelative to COPY:');
for (const [label, ms] of [['per-row autocommit', a], ['per-row in tx', b],
                           ['multi-row VALUES', c_], ['unnest', d], ['COPY', e]]) {
  console.log(`  ${label.padEnd(22)} ${(ms / e).toFixed(1)}×`);
}

// --- 2. the parameter limit -----------------------------------------------
line('2. how many parameters can one statement take?');
{
  await reset();
  const tryN = async (n) => {
    const vals = [], params = [];
    for (let i = 0; i < n; i++) {
      params.push(`p${i}@x.com`, `N${i}`, i);
      vals.push(`($${params.length - 2},$${params.length - 1},$${params.length})`);
    }
    try {
      await q(`INSERT INTO bulk_users (email, name, score) VALUES ${vals.join(',')}`, params);
      return `ok (${n * 3} params)`;
    } catch (err) {
      return `${err.code ?? ''} ${err.message}`.trim();
    }
  };
  console.log('21845 rows →', await tryN(21845));
  await reset();
  console.log('21846 rows →', await tryN(21846));
}

// --- 3. seeding idempotently ----------------------------------------------
line('3. ON CONFLICT DO NOTHING vs a bare INSERT');
{
  await q(`DROP TABLE IF EXISTS seed_roles`);
  await q(`CREATE TABLE seed_roles (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug text NOT NULL UNIQUE, label text NOT NULL)`);
  const seed = `INSERT INTO seed_roles (slug, label)
                VALUES ('admin','Admin'), ('user','User')
                ON CONFLICT (slug) DO NOTHING`;
  const r1 = await q(seed);
  const r2 = await q(seed);
  const r3 = await q(seed);
  console.log('run 1 rowCount:', r1.rowCount, '| run 2:', r2.rowCount, '| run 3:', r3.rowCount);
  console.log('rows in table:', (await q(`SELECT count(*)::int n FROM seed_roles`)).rows[0].n);

  // does DO NOTHING still burn identity values?
  const ids = await q(`SELECT id FROM seed_roles ORDER BY id`);
  console.log('ids:', ids.rows.map((r) => r.id).join(', '));
  const seqname = (await q(`SELECT pg_get_serial_sequence('seed_roles','id') AS s`)).rows[0].s;
  const nextval = await q(`SELECT last_value FROM ${seqname}`);
  console.log('sequence last_value after 3 runs:', nextval.rows[0].last_value,
    '← identity is consumed even when ON CONFLICT skips the row');

  try {
    await q(`INSERT INTO seed_roles (slug, label) VALUES ('admin','Admin')`);
  } catch (err) {
    console.log('bare re-INSERT →', err.code, err.constraint);
  }
}

// --- 4. resetting between test runs ---------------------------------------
line('4. reset strategies, 10 000 rows');
{
  const prep = async () => {
    await reset();
    await q(`INSERT INTO bulk_users (email, name, score)
             SELECT 'r'||g||'@x.com', 'N'||g, g%100 FROM generate_series(1,${N}) g`);
  };
  const t = async (label, sql) => {
    await prep();
    const t0 = performance.now();
    await q(sql);
    console.log(`${label.padEnd(34)} ${(performance.now() - t0).toFixed(1).padStart(7)} ms  rows left=${await count()}`);
  };
  await t('DELETE FROM', 'DELETE FROM bulk_users');
  await t('TRUNCATE', 'TRUNCATE bulk_users');
  await t('TRUNCATE ... RESTART IDENTITY', 'TRUNCATE bulk_users RESTART IDENTITY');

  // transaction rollback per test
  await prep();
  const c = await pool.connect();
  const t0 = performance.now();
  await c.query('BEGIN');
  await c.query(`INSERT INTO bulk_users (email,name,score) VALUES ('t@x.com','T',1)`);
  await c.query('ROLLBACK');
  console.log(`${'BEGIN/ROLLBACK per test'.padEnd(34)} ${(performance.now() - t0).toFixed(1).padStart(7)} ms  rows left=${await count()}`);
  c.release();

  // does TRUNCATE reset identity by itself?
  await prep();
  await q('TRUNCATE bulk_users');
  const r = await q(`INSERT INTO bulk_users (email,name,score) VALUES ('after@x.com','A',1) RETURNING id`);
  console.log('id after plain TRUNCATE:', r.rows[0].id, '← identity NOT reset');
  await q('TRUNCATE bulk_users RESTART IDENTITY');
  const r2 = await q(`INSERT INTO bulk_users (email,name,score) VALUES ('after2@x.com','A',1) RETURNING id`);
  console.log('id after RESTART IDENTITY:', r2.rows[0].id);
}

await q(`DROP TABLE IF EXISTS bulk_users, seed_roles`);
await pool.end();
