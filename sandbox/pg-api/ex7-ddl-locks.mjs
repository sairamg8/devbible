// Phase 8 / 01 chunk 2 — what lock does DDL take, and what does it block?
// The classic production incident: a short ALTER queues behind a long read and
// then blocks every read that arrives after it.
import pg from 'pg';

const url = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: url, max: 10});
const q = (...a) => pool.query(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const line = (t) => console.log(`\n=== ${t} ===`);

await q(`DROP TABLE IF EXISTS lk_items`);
await q(`CREATE TABLE lk_items (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text)`);
await q(`INSERT INTO lk_items (name) SELECT 'n'||g FROM generate_series(1,1000) g`);

// --- 1. which lock does each statement take? ------------------------------
line('1. lock modes actually taken');
{
  const probe = async (label, sql) => {
    const c = await pool.connect();
    await c.query('BEGIN');
    await c.query(sql);
    const {rows} = await c.query(
      `SELECT mode FROM pg_locks l JOIN pg_class c ON c.oid = l.relation
        WHERE c.relname = 'lk_items' AND l.pid = pg_backend_pid()`,
    );
    console.log(label.padEnd(28), rows.map((r) => r.mode).join(', '));
    await c.query('ROLLBACK');
    c.release();
  };
  await probe('SELECT', 'SELECT count(*) FROM lk_items');
  await probe('INSERT', `INSERT INTO lk_items (name) VALUES ('x')`);
  await probe('ALTER TABLE ADD COLUMN', 'ALTER TABLE lk_items ADD COLUMN note text');
  await probe('CREATE INDEX', 'CREATE INDEX lk_tmp_idx ON lk_items (name)');
}

// --- 2. does ADD COLUMN with a default rewrite the table? -----------------
line('2. ADD COLUMN ... DEFAULT — rewrite or not?');
{
  const relfile = async () =>
    (await q(`SELECT relfilenode FROM pg_class WHERE relname='lk_items'`)).rows[0].relfilenode;
  const before = await relfile();
  await q(`ALTER TABLE lk_items ADD COLUMN flag boolean NOT NULL DEFAULT false`);
  const after = await relfile();
  console.log('relfilenode before:', before, '→ after:', after);
  console.log(after === before ? 'no table rewrite' : 'TABLE REWRITTEN');
  await q(`ALTER TABLE lk_items DROP COLUMN flag`);
}

// --- 3. the lock queue pile-up --------------------------------------------
line('3. a long read, then an ALTER, then more reads');
{
  const stamp = (t0) => `${String(Math.round(performance.now() - t0)).padStart(5)} ms`;
  const t0 = performance.now();

  // A: a long-running read holds ACCESS SHARE for 3 s
  const reader = (async () => {
    const c = await pool.connect();
    await c.query('BEGIN');
    await c.query('SELECT count(*) FROM lk_items');
    console.log(`${stamp(t0)}  A: long read started, holds ACCESS SHARE`);
    await sleep(3000);
    await c.query('COMMIT');
    console.log(`${stamp(t0)}  A: long read committed`);
    c.release();
  })();

  await sleep(300);

  // B: a "one second" migration
  const alterer = (async () => {
    const c = await pool.connect();
    console.log(`${stamp(t0)}  B: ALTER TABLE issued`);
    await c.query('ALTER TABLE lk_items ADD COLUMN note2 text');
    console.log(`${stamp(t0)}  B: ALTER TABLE done`);
    c.release();
  })();

  await sleep(300);

  // C, D: ordinary reads that arrive *after* the ALTER
  const readers = [1, 2].map((n) =>
    (async () => {
      const c = await pool.connect();
      console.log(`${stamp(t0)}  C${n}: plain SELECT issued`);
      await c.query('SELECT count(*) FROM lk_items');
      console.log(`${stamp(t0)}  C${n}: plain SELECT returned`);
      c.release();
    })(),
  );

  await sleep(600);
  const {rows} = await q(`
    SELECT count(*)::int AS waiting FROM pg_stat_activity
     WHERE wait_event_type = 'Lock' AND datname = current_database()`);
  console.log(`${stamp(t0)}  sessions waiting on a lock: ${rows[0].waiting}`);

  await Promise.all([reader, alterer, ...readers]);
  await q(`ALTER TABLE lk_items DROP COLUMN IF EXISTS note2`);
}

// --- 4. lock_timeout as the seatbelt --------------------------------------
line('4. lock_timeout');
{
  const c = await pool.connect();
  await c.query('BEGIN');
  await c.query('SELECT count(*) FROM lk_items'); // holds ACCESS SHARE

  const c2 = await pool.connect();
  try {
    await c2.query(`SET lock_timeout = '500ms'`);
    await c2.query('ALTER TABLE lk_items ADD COLUMN note3 text');
    console.log('ALTER succeeded (unexpected)');
  } catch (e) {
    console.log('with lock_timeout=500ms →', e.code, '|', e.message);
  }
  c2.release();
  await c.query('ROLLBACK');
  c.release();
}

await q(`DROP TABLE IF EXISTS lk_items`);
await pool.end();
