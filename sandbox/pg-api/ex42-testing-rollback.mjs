// Phase 9 page 16 — testing against a real PostgreSQL: per-test rollback, what
// rollback does not undo, the trap that makes the code under test see nothing,
// and how the reset strategies compare.
import pg from 'pg';

const URL = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: URL, max: 10});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const timed = async (n, fn) => {
  const ts = [];
  for (let i = 0; i < n; i++) {
    const t0 = process.hrtime.bigint();
    await fn();
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ts.sort((a, b) => a - b);
  return ts[Math.floor(ts.length / 2)];
};

await q(`DROP TABLE IF EXISTS x_users CASCADE`);
await q(`CREATE TABLE x_users (
  id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name  text NOT NULL)`);
const seedRows = 2000;
const seed = () => q(
  `INSERT INTO x_users (email, name)
   SELECT 'seed' || g || '@x.com', 'Seed ' || g FROM generate_series(1,$1) g`,
  [seedRows]);
await seed();
console.log(`seeded ${seedRows} baseline rows`);

// --- 1. the per-test transaction ------------------------------------------
line('1. BEGIN in beforeEach, ROLLBACK in afterEach');
{
  const runTest = async (name, body) => {
    const client = await pool.connect();          // beforeEach
    await client.query('BEGIN');
    try {
      await body(client);
    } finally {
      await client.query('ROLLBACK');             // afterEach
      client.release();
    }
  };

  const countAll = async () => (await q(
    `SELECT count(*)::int c FROM x_users`)).rows[0].c;

  console.log('rows before any test:', await countAll());
  await runTest('creates a user', async (db) => {
    await db.query(`INSERT INTO x_users (email, name) VALUES ($1,$2)`,
      ['t1@x.com', 'Test One']);
    const c = (await db.query(`SELECT count(*)::int c FROM x_users`)).rows[0].c;
    console.log('  inside test 1, visible rows:', c);
  });
  console.log('rows after test 1 :', await countAll());

  await runTest('creates the same user again', async (db) => {
    await db.query(`INSERT INTO x_users (email, name) VALUES ($1,$2)`,
      ['t1@x.com', 'Test One']);      // would be a 23505 if test 1 had persisted
    console.log('  test 2 inserted the same email with no conflict');
  });
  console.log('rows after test 2 :', await countAll());
}

// --- 2. what the rollback does NOT undo -----------------------------------
line('2. sequences are not transactional');
{
  const seq = (await q(
    `SELECT pg_get_serial_sequence('x_users','id') AS s`)).rows[0].s;
  const lastValue = async () => (await q(
    `SELECT last_value FROM ${seq}`)).rows[0].last_value;

  const before = await lastValue();
  const client = await pool.connect();
  await client.query('BEGIN');
  await client.query(`INSERT INTO x_users (email, name) VALUES ('seq@x.com','Seq')`);
  await client.query('ROLLBACK');
  client.release();
  const after = await lastValue();
  console.log('sequence last_value before:', before);
  console.log('sequence last_value after :', after);
  console.log('↑ the row is gone but the id was consumed — never assert on a literal id');
}

// --- 3. the trap: the code under test takes its own connection ------------
line('3. the code under test calls pool.query instead of the test client');
{
  // a repository written to take an executor — the testable shape
  const createUser = (db, email) =>
    db.query(`INSERT INTO x_users (email, name) VALUES ($1,'X') RETURNING id`, [email]);

  const client = await pool.connect();
  await client.query('BEGIN');
  await createUser(client, 'visible@x.com');

  const seenByTest = (await client.query(
    `SELECT count(*)::int c FROM x_users WHERE email='visible@x.com'`)).rows[0].c;
  const seenByPool = (await pool.query(
    `SELECT count(*)::int c FROM x_users WHERE email='visible@x.com'`)).rows[0].c;
  console.log('the test client sees it :', seenByTest);
  console.log('a pool connection sees  :', seenByPool);
  console.log('↑ uncommitted data is invisible to any other connection — so a service');
  console.log('  that grabs its own connection finds an empty database in every test');

  await client.query('ROLLBACK');
  client.release();
}

// --- 4. code that manages its own transaction ------------------------------
line('4. the code under test issues its own BEGIN/COMMIT');
{
  const client = await pool.connect();
  await client.query('BEGIN');                       // the test wrapper

  // service code, which believes it owns the transaction
  const service = async (db) => {
    await db.query('BEGIN');                         // nested — not a real nesting
    await db.query(`INSERT INTO x_users (email,name) VALUES ('svc@x.com','S')`);
    await db.query('COMMIT');                        // ← this commits the TEST's transaction
  };
  await service(client);

  const stillOpen = (await client.query(
    `SELECT count(*)::int c FROM pg_stat_activity
      WHERE pid = pg_backend_pid() AND state = 'idle in transaction'`)).rows[0].c;
  await client.query('ROLLBACK');                    // the wrapper's rollback: too late
  client.release();

  const survived = (await q(
    `SELECT count(*)::int c FROM x_users WHERE email='svc@x.com'`)).rows[0].c;
  console.log('rows the service wrote that survived the test rollback:', survived);
  console.log('↑ the inner COMMIT ended the outer transaction; the wrapper had nothing left to undo');
  await q(`DELETE FROM x_users WHERE email='svc@x.com'`);

  // the fix: the wrapper hands out a client whose BEGIN/COMMIT are savepoints
  const wrap = (db) => ({
    query: (text, params) => {
      if (text === 'BEGIN') return db.query('SAVEPOINT svc');
      if (text === 'COMMIT') return db.query('RELEASE SAVEPOINT svc');
      if (text === 'ROLLBACK') return db.query('ROLLBACK TO SAVEPOINT svc');
      return db.query(text, params);
    },
  });
  const c2 = await pool.connect();
  await c2.query('BEGIN');
  await service(wrap(c2));
  await c2.query('ROLLBACK');
  c2.release();
  const survived2 = (await q(
    `SELECT count(*)::int c FROM x_users WHERE email='svc@x.com'`)).rows[0].c;
  console.log('with BEGIN/COMMIT remapped to savepoints, surviving rows:', survived2);
}

// --- 5. reset strategies compared -----------------------------------------
line('5. how long each way of getting a clean database takes');
{
  const perTestRollback = async () => {
    const c = await pool.connect();
    await c.query('BEGIN');
    await c.query(`INSERT INTO x_users (email,name) VALUES ('m@x.com','M')`);
    await c.query('ROLLBACK');
    c.release();
  };
  const truncateAndReseed = async () => {
    await q(`TRUNCATE x_users RESTART IDENTITY CASCADE`);
    await seed();
    await q(`INSERT INTO x_users (email,name) VALUES ('m@x.com','M')`);
  };
  const deleteAndReseed = async () => {
    await q(`DELETE FROM x_users`);
    await seed();
    await q(`INSERT INTO x_users (email,name) VALUES ('m@x.com','M')`);
  };

  console.log(`median of 10 "tests", ${seedRows} seed rows each:`);
  console.log(`  transaction rollback   ${(await timed(10, perTestRollback)).toFixed(2).padStart(8)} ms`);
  console.log(`  TRUNCATE + reseed      ${(await timed(10, truncateAndReseed)).toFixed(2).padStart(8)} ms`);
  console.log(`  DELETE + reseed        ${(await timed(10, deleteAndReseed)).toFixed(2).padStart(8)} ms`);
  await q(`TRUNCATE x_users RESTART IDENTITY CASCADE`);
  await seed();
}

// --- 6. a fresh database per test file, from a template -------------------
line('6. CREATE DATABASE ... TEMPLATE, for tests that cannot share');
{
  await q(`DROP DATABASE IF EXISTS x_tmpl_test`);
  const ms = await timed(3, async () => {
    await q(`DROP DATABASE IF EXISTS x_tmpl_test`);
    await q(`CREATE DATABASE x_tmpl_test TEMPLATE template0`);
  });
  console.log(`CREATE DATABASE from template0   ${ms.toFixed(1)} ms`);
  await q(`DROP DATABASE IF EXISTS x_tmpl_test`);
  console.log('↑ per test FILE this is affordable; per test it is not');
}

// --- 7. parallel test files on one database interfere ---------------------
line('7. two test files truncating the same table in parallel');
{
  const testFile = async (tag, delayMs) => {
    await new Promise((r) => setTimeout(r, delayMs));
    await q(`TRUNCATE x_users RESTART IDENTITY CASCADE`);
    const mine = `${tag.toLowerCase()}@x.com`;
    await q(`INSERT INTO x_users (email,name) VALUES ($1,$2)`, [mine, tag]);
    await new Promise((r) => setTimeout(r, 40));      // the rest of the test body
    const {rows} = await q(`SELECT email FROM x_users ORDER BY email`);
    return {tag, mine, count: rows.length,
      emails: rows.map((r) => r.email).join(',')};
  };
  const [a, b] = await Promise.all([testFile('A', 0), testFile('B', 20)]);
  for (const r of [a, b]) {
    console.log(`file ${r.tag}: expected exactly ["${r.mine}"], ` +
      `saw ${r.count} row(s): [${r.emails}]` +
      (r.emails === r.mine ? '' : '   ← WRONG ROW'));
  }
  console.log('↑ a row-count assertion still passes, which is why this is missed:');
  console.log('  both files saw one row, but not the one they inserted');
}

await q(`DROP TABLE IF EXISTS x_users CASCADE`);
await pool.end();
