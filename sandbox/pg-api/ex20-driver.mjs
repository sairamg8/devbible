// Phase 7 pages 01,03,05,06,07,13 — wiring, config, result object, errors, lifecycle.
import pg from 'pg';
import { parse } from 'pg-connection-string';

const URL = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const line = (t) => console.log(`\n=== ${t} ===`);

// --- 1. what a connection string parses into -------------------------------
line('1. connection string vs config object');
{
  console.log('parse(url) →', parse(URL));
  const withOpts = parse(
    'postgres://u:p@host:5432/db?sslmode=require&application_name=api&connect_timeout=5');
  console.log('query params →', {
    ssl: withOpts.ssl, application_name: withOpts.application_name,
    connect_timeout: withOpts.connect_timeout});
}

// --- 2. nothing connects until the first query -----------------------------
line('2. when the connection actually opens');
{
  const pool = new pg.Pool({connectionString: URL, application_name: 'devbible-ex20'});
  console.log('after new Pool()      → totalCount:', pool.totalCount, 'idleCount:', pool.idleCount);
  await pool.query('SELECT 1');
  console.log('after first query     → totalCount:', pool.totalCount, 'idleCount:', pool.idleCount);

  const seen = await pool.query(
    `SELECT application_name, state FROM pg_stat_activity WHERE pid = pg_backend_pid()`);
  console.log('what the server sees  →', seen.rows[0]);
  await pool.end();
}

// --- 3. a bad host fails at query time, not construction -------------------
line('3. where connection errors surface');
{
  const bad = new pg.Pool({connectionString: 'postgres://x:y@127.0.0.1:1/none',
    connectionTimeoutMillis: 1000});
  console.log('constructed a pool to a dead port — no error yet');
  try { await bad.query('SELECT 1'); }
  catch (e) { console.log('first query →', e.code ?? e.name, '|', e.message.split('\n')[0]); }
  await bad.end();

  // localhost vs 127.0.0.1 — the trap recorded in the handoff
  const v6 = new pg.Pool({connectionString: 'postgres://devbible:devbible@localhost:55432/devbible',
    connectionTimeoutMillis: 1500});
  try { await v6.query('SELECT 1'); console.log('localhost → connected'); }
  catch (e) { console.log('localhost →', e.code ?? e.name, '|', e.message.split('\n')[0]); }
  await v6.end();
}

const pool = new pg.Pool({connectionString: URL, max: 3});
const q = (...a) => pool.query(...a);

await q(`DROP TABLE IF EXISTS w_users CASCADE`);
await q(`CREATE TABLE w_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  age int CHECK (age >= 0),
  name text NOT NULL)`);
await q(`CREATE TABLE w_orders (
  id int PRIMARY KEY, user_id bigint NOT NULL REFERENCES w_users(id))`);
await q(`INSERT INTO w_users (email, age, name) VALUES ('a@x.com', 30, 'Ann')`);

// --- 4. the result object --------------------------------------------------
line('4. what a Result actually contains');
{
  const r = await q(`SELECT id, email, age FROM w_users`);
  console.log('keys           :', Object.keys(r).join(', '));
  console.log('command        :', r.command, '| rowCount:', r.rowCount);
  console.log('fields         :', r.fields.map(f => `${f.name}:${f.dataTypeID}`).join(', '));
  console.log('rows           :', r.rows);

  for (const sql of [
    `INSERT INTO w_users (email, age, name) VALUES ('b@x.com', 1, 'Bee')`,
    `UPDATE w_users SET age = 2 WHERE email = 'b@x.com'`,
    `DELETE FROM w_users WHERE email = 'b@x.com'`,
    `CREATE TEMP TABLE tmp_x (i int)`,
  ]) {
    const x = await q(sql);
    console.log(`${sql.split(' ').slice(0,2).join(' ').padEnd(14)} → command: ${String(x.command).padEnd(7)} rowCount: ${x.rowCount}`);
  }
  const none = await q(`SELECT * FROM w_users WHERE 1=0`);
  console.log('SELECT no rows → rowCount:', none.rowCount, '| rows:', none.rows,
    '| fields still present:', none.fields.length);

  // several statements in one call → array of Results
  const multi = await q(`SELECT 1 AS a; SELECT 2 AS b`);
  console.log('multi-statement → Array.isArray:', Array.isArray(multi),
    '| length:', multi.length, '| last rows:', multi.at(-1).rows);

  // duplicate column names across a join: the row object keeps only the last
  await q(`DROP TABLE IF EXISTS z_a, z_b`);
  await q(`CREATE TABLE z_a (id int, name text)`);
  await q(`CREATE TABLE z_b (id int, name text)`);
  await q(`INSERT INTO z_a VALUES (1,'from_a')`);
  await q(`INSERT INTO z_b VALUES (99,'from_b')`);
  const dup = await q(`SELECT * FROM z_a, z_b`);
  console.log('SELECT * across a join → fields:', dup.fields.map(f => f.name).join(', '));
  console.log('  row object           :', dup.rows[0], '← two columns silently lost');
  const asArray = await q({text: `SELECT * FROM z_a, z_b`, rowMode: 'array'});
  console.log('  same, rowMode:array  :', asArray.rows[0], '← nothing lost');
  await q(`DROP TABLE z_a, z_b`);
}

// --- 5. the error object ---------------------------------------------------
line('5. PostgreSQL errors as JS objects');
{
  const cases = [
    ['unique violation',   `INSERT INTO w_users (email, age, name) VALUES ('a@x.com', 1, 'Dup')`],
    ['not-null violation', `INSERT INTO w_users (email, age, name) VALUES ('c@x.com', 1, NULL)`],
    ['check violation',    `INSERT INTO w_users (email, age, name) VALUES ('d@x.com', -5, 'Neg')`],
    ['fk violation',       `INSERT INTO w_orders (id, user_id) VALUES (1, 99999)`],
    ['undefined column',   `SELECT nope FROM w_users`],
    ['invalid text input', `SELECT * FROM w_users WHERE id = 'abc'`],
    ['syntax error',       `SELCT 1`],
    ['undefined table',    `SELECT * FROM no_such_table`],
    ['division by zero',   `SELECT 1/0`],
  ];
  for (const [label, sql] of cases) {
    try { await q(sql); console.log(label.padEnd(20), '→ (no error!)'); }
    catch (e) {
      console.log(label.padEnd(20), '→', e.code,
        '| constraint:', e.constraint ?? '-',
        '| column:', e.column ?? '-',
        '| table:', e.table ?? '-');
      if (label === 'unique violation') {
        console.log('   full shape:', JSON.stringify({
          name: e.name, code: e.code, severity: e.severity, detail: e.detail,
          schema: e.schema, table: e.table, constraint: e.constraint,
          position: e.position, routine: e.routine}, null, 0));
      }
    }
  }
}

// --- 6. connect / release --------------------------------------------------
line('6. pool.connect and release');
{
  console.log('pool max = 3');
  const a = await pool.connect(); const b = await pool.connect(); const c = await pool.connect();
  console.log('3 clients checked out → idle:', pool.idleCount, 'total:', pool.totalCount,
    'waiting:', pool.waitingCount);
  const pending = pool.query('SELECT 1');           // must wait
  await new Promise(r => setTimeout(r, 100));
  console.log('a 4th query queued    → waitingCount:', pool.waitingCount);
  a.release(); b.release(); c.release();
  await pending;
  console.log('after release         → idle:', pool.idleCount, 'waiting:', pool.waitingCount);

  // release(true) destroys the connection instead of returning it
  const d = await pool.connect();
  const before = pool.totalCount;
  d.release(true);
  await new Promise(r => setTimeout(r, 50));
  console.log(`release(true) → totalCount ${before} → ${pool.totalCount} (connection destroyed)`);
}

// --- 7. pool.end -----------------------------------------------------------
line('7. pool.end');
{
  const p2 = new pg.Pool({connectionString: URL, max: 2});
  const slow = p2.query(`SELECT pg_sleep(0.3), 'finished' AS s`);
  const t0 = process.hrtime.bigint();
  await p2.end();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`end() waited ${ms.toFixed(0)} ms for the in-flight query`);
  console.log('in-flight result      :', (await slow).rows[0].s);
  try { await p2.query('SELECT 1'); }
  catch (e) { console.log('query after end()     →', e.message.split('\n')[0]); }
  try { await p2.end(); console.log('second end()          → resolved (idempotent)'); }
  catch (e) { console.log('second end()          →', e.message.split('\n')[0]); }
}

// --- 8. configuration sources and precedence -------------------------------
line('8. where configuration comes from');
{
  const env = {...process.env};
  Object.assign(process.env, {PGHOST: '127.0.0.1', PGPORT: '55432',
    PGUSER: 'devbible', PGPASSWORD: 'devbible', PGDATABASE: 'devbible'});
  const p1 = new pg.Pool();
  console.log('new Pool() with no args, env only →',
    (await p1.query(`SELECT current_database() AS db, current_user AS usr`)).rows[0]);
  await p1.end();
  process.env = env;

  // precedence when both are supplied
  const p2 = new pg.Pool({connectionString: URL, database: 'postgres'});
  console.log('connectionString + database:"postgres" →',
    (await p2.query(`SELECT current_database() AS db`)).rows[0],
    '← the connection string wins');
  await p2.end();

  // options are passed straight to the server
  const p3 = new pg.Pool({connectionString: URL,
    options: '-c search_path=public,pg_catalog -c statement_timeout=1234'});
  console.log('options passthrough →',
    (await p3.query('SHOW search_path')).rows[0],
    (await p3.query('SHOW statement_timeout')).rows[0]);
  await p3.end();

  // password may be a (possibly async) function — evaluated per connection
  let calls = 0;
  const p4 = new pg.Pool({host: '127.0.0.1', port: 55432, user: 'devbible',
    database: 'devbible', password: async () => { calls++; return 'devbible'; }});
  await p4.query('SELECT 1'); await p4.query('SELECT 1');
  console.log(`password function called ${calls}× for 2 queries on 1 connection`);
  await p4.end();

  for (const m of ['disable', 'prefer', 'require', 'verify-full']) {
    console.log(`sslmode=${m.padEnd(11)} → ssl:`, JSON.stringify(parse(`postgres://u:p@h:5432/d?sslmode=${m}`).ssl));
  }
}

await q(`DROP TABLE IF EXISTS w_orders, w_users CASCADE`);
await pool.end();
