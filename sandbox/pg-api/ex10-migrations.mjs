// Phase 8 / 02, 06, 08, 13 — a real migration runner, and what it must handle.
import pg from 'pg';
import {mkdtemp, writeFile, readdir, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 10});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

// --- the runner (this is the code the page shows) --------------------------
const LOCK_KEY = 8675309;

async function migrate(pool, dir, {log = () => {}} = {}) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now(),
      checksum   text NOT NULL
    )`);

  const client = await pool.connect();
  const applied = [];
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);

    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const {rows} = await client.query('SELECT version, checksum FROM schema_migrations');
    const done = new Map(rows.map((r) => [r.version, r.checksum]));

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const sql = await readFile(join(dir, file), 'utf8');
      const checksum = (await import('node:crypto'))
        .createHash('sha256').update(sql).digest('hex').slice(0, 16);

      if (done.has(version)) {
        if (done.get(version) !== checksum) {
          throw new Error(`migration ${version} was edited after being applied`);
        }
        continue;
      }
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES ($1,$2)',
        [version, checksum]);
      applied.push(version);
      log(`applied ${version}`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return applied;
}

const reset = async () => {
  await q(`DROP TABLE IF EXISTS schema_migrations, mg_users, mg_orders CASCADE`);
};

// --- 1. first run, second run ---------------------------------------------
line('1. running the same migrations twice');
{
  await reset();
  const dir = await mkdtemp(join(tmpdir(), 'mig-'));
  await writeFile(join(dir, '001-users.sql'),
    `CREATE TABLE mg_users (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email text NOT NULL UNIQUE);`);
  await writeFile(join(dir, '002-orders.sql'),
    `CREATE TABLE mg_orders (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       user_id bigint NOT NULL REFERENCES mg_users(id), total numeric(12,2) NOT NULL);
     CREATE INDEX mg_orders_user_id_idx ON mg_orders (user_id);`);

  console.log('run 1 applied:', await migrate(pool, dir));
  console.log('run 2 applied:', await migrate(pool, dir));
  const {rows} = await q('SELECT version, checksum FROM schema_migrations ORDER BY version');
  console.table(rows);
}

// --- 2. a migration that fails halfway ------------------------------------
line('2. a failing migration');
{
  const dir = await mkdtemp(join(tmpdir(), 'mig-'));
  await writeFile(join(dir, '003-bad.sql'),
    `ALTER TABLE mg_users ADD COLUMN nickname text;
     ALTER TABLE mg_users ADD COLUMN nickname text;`);   // fails on the second
  try {
    await migrate(pool, dir);
  } catch (err) {
    console.log('threw:', err.code ?? '', err.message);
  }
  const cols = await q(`SELECT column_name FROM information_schema.columns
                        WHERE table_name='mg_users' ORDER BY ordinal_position`);
  console.log('mg_users columns after the failure:', cols.rows.map((r) => r.column_name).join(', '));
  const rec = await q(`SELECT count(*)::int n FROM schema_migrations WHERE version='003-bad'`);
  console.log('recorded in schema_migrations:', rec.rows[0].n);
}

// --- 3. editing a migration after it shipped ------------------------------
line('3. editing an applied migration');
{
  const dir = await mkdtemp(join(tmpdir(), 'mig-'));
  await writeFile(join(dir, '001-users.sql'),
    `CREATE TABLE mg_users (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email text NOT NULL UNIQUE, extra text);`);
  try {
    await migrate(pool, dir);
  } catch (err) {
    console.log('caught:', err.message);
  }
}

// --- 4. lexical vs numeric ordering ---------------------------------------
line('4. file ordering');
{
  const naive = ['1-a.sql', '2-b.sql', '10-c.sql', '11-d.sql'].sort();
  const padded = ['001-a.sql', '002-b.sql', '010-c.sql', '011-d.sql'].sort();
  console.log('unpadded .sort() →', naive.join(', '));
  console.log('padded   .sort() →', padded.join(', '));
  const ts = ['20260101120000-a.sql', '20260102090000-b.sql', '20251231235959-c.sql'].sort();
  console.log('timestamped      →', ts.join(', '));
}

// --- 5. concurrent runners ------------------------------------------------
line('5. two runners starting at once');
{
  await reset();
  const dir = await mkdtemp(join(tmpdir(), 'mig-'));
  await writeFile(join(dir, '001-users.sql'),
    `CREATE TABLE mg_users (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email text NOT NULL UNIQUE);`);
  const results = await Promise.allSettled(
    Array.from({length: 5}, () => migrate(pool, dir)));
  results.forEach((r, i) => console.log(
    `  runner ${i}:`, r.status === 'fulfilled'
      ? `applied [${r.value.join(', ')}]`
      : `${r.reason.code ?? ''} ${r.reason.message}`));
  const {rows} = await q('SELECT count(*)::int n FROM schema_migrations');
  console.log('rows in schema_migrations:', rows[0].n, '(must be 1)');
}

// --- 6. schema drift detection --------------------------------------------
line('6. drift check — does the live schema match what the code expects?');
{
  const expected = {
    mg_users: {id: 'bigint', email: 'text'},
  };
  const check = async () => {
    const problems = [];
    for (const [table, cols] of Object.entries(expected)) {
      const {rows} = await q(
        `SELECT column_name, data_type FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1`, [table]);
      const live = new Map(rows.map((r) => [r.column_name, r.data_type]));
      if (rows.length === 0) { problems.push(`table ${table} is missing`); continue; }
      for (const [col, type] of Object.entries(cols)) {
        if (!live.has(col)) problems.push(`${table}.${col} is missing`);
        else if (live.get(col) !== type)
          problems.push(`${table}.${col} is ${live.get(col)}, expected ${type}`);
      }
    }
    return problems;
  };
  console.log('matching schema →', (await check()).length === 0 ? 'ok' : await check());
  await q(`ALTER TABLE mg_users ALTER COLUMN email TYPE varchar(255)`);
  console.log('after a type change →', await check());
  await q(`ALTER TABLE mg_users DROP COLUMN email`);
  console.log('after a drop →', await check());
}

await reset();
await pool.end();
