// Phase 7 pages 08,09,10,11,12 — type parsing, custom parsers, prepared, timeouts.
import pg from 'pg';

const URL = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const line = (t) => console.log(`\n=== ${t} ===`);
const pool = new pg.Pool({connectionString: URL, max: 5});
const q = (...a) => pool.query(...a);

// --- 1. what every common type becomes in JavaScript -----------------------
line('1. default type mapping');
{
  const r = await q(`SELECT
    true                                   AS bool,
    42::int2                               AS int2,
    42::int4                               AS int4,
    9007199254740993::int8                 AS int8,
    1.5::float4                            AS float4,
    1.5::float8                            AS float8,
    '10.00'::numeric(10,2)                 AS numeric,
    'txt'::text                            AS text,
    '2026-08-12'::date                     AS date,
    '2026-08-12 13:45'::timestamp          AS timestamp,
    '2026-08-12 13:45+00'::timestamptz     AS timestamptz,
    '1 day 2 hours'::interval              AS interval,
    '{"a":1}'::json                        AS json,
    '{"a":1}'::jsonb                       AS jsonb,
    ARRAY['x','y']                         AS text_array,
    ARRAY[1,2]                             AS int_array,
    '\\xdeadbeef'::bytea                    AS bytea,
    '11111111-1111-1111-1111-111111111111'::uuid AS uuid,
    NULL::int                              AS null_int`);
  const row = r.rows[0];
  for (const f of r.fields) {
    const v = row[f.name];
    const ctor = v === null ? 'null' : v.constructor?.name ?? typeof v;
    console.log(`${f.name.padEnd(12)} oid ${String(f.dataTypeID).padEnd(5)} → ${String(typeof v).padEnd(8)} ${ctor.padEnd(17)} ${JSON.stringify(v)?.slice(0,40)}`);
  }
}

// --- 2. the precision reason int8 is a string ------------------------------
line('2. why bigint arrives as a string');
{
  const r = await q(`SELECT 9007199254740993::int8 AS big`);
  const asString = r.rows[0].big;
  console.log('as returned (string) :', asString);
  console.log('Number(...)          :', Number(asString), '← wrong, 9007199254740993 is unrepresentable');
  console.log('BigInt(...)          :', BigInt(asString).toString(), '← exact');
  console.log('MAX_SAFE_INTEGER     :', Number.MAX_SAFE_INTEGER);
}

// --- 3. overriding parsers -------------------------------------------------
line('3. pg.types.setTypeParser');
{
  const before = (await q(`SELECT 123::int8 AS n, '10.50'::numeric AS m, '2026-08-12'::date AS d`)).rows[0];
  console.log('defaults →', before, '| date is a JS Date:', before.d instanceof Date);

  pg.types.setTypeParser(20, v => BigInt(v));      // int8
  pg.types.setTypeParser(1700, v => Number(v));    // numeric
  pg.types.setTypeParser(1082, v => v);            // date → keep the string

  const after = (await q(`SELECT 123::int8 AS n, '10.50'::numeric AS m, '2026-08-12'::date AS d`)).rows[0];
  console.log('overridden →', {n: after.n.toString() + 'n', m: after.m, d: after.d},
    '| typeof m:', typeof after.m, '| typeof d:', typeof after.d);
  console.log('  ↑ setTypeParser is PROCESS-WIDE and affects every pool and query');

  // per-query alternative: cast in SQL instead
  const cast = (await q(`SELECT (123::int8)::int AS n, to_char('2026-08-12'::date,'YYYY-MM-DD') AS d`)).rows[0];
  console.log('per-query casts →', cast, '| typeof n:', typeof cast.n);

  // restore defaults for the rest of the script
  pg.types.setTypeParser(20, v => v);
  pg.types.setTypeParser(1700, v => v);
  pg.types.setTypeParser(1082, pg.types.getTypeParser(1082, 'text'));
}

// --- 4. prepared statements ------------------------------------------------
line('4. named (prepared) statements');
{
  const c = await pool.connect();
  await c.query(`DROP TABLE IF EXISTS p_t`);
  await c.query(`CREATE TABLE p_t (id int PRIMARY KEY, v text)`);
  await c.query(`INSERT INTO p_t SELECT g, 'v'||g FROM generate_series(1,5000) g`);
  await c.query(`ANALYZE p_t`);

  const named = {name: 'find-p', text: 'SELECT v FROM p_t WHERE id = $1', values: [1]};
  await c.query(named);
  const listed = await c.query(
    `SELECT name, statement, generic_plans, custom_plans FROM pg_prepared_statements`);
  console.log('pg_prepared_statements →', listed.rows);

  const runs = 8;
  for (let i = 1; i <= runs; i++) await c.query({...named, values: [i]});
  const after = await c.query(
    `SELECT name, generic_plans, custom_plans FROM pg_prepared_statements WHERE name='find-p'`);
  console.log(`after ${runs} more executions →`, after.rows[0],
    '← PostgreSQL switches to a generic plan around the 6th execution');

  // timing: named vs unnamed, same statement
  const time = async (fn, n = 2000) => {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < n; i++) await fn(i % 5000 + 1);
    return Number(process.hrtime.bigint() - t0) / 1e6;
  };
  const unnamedMs = await time(i => c.query('SELECT v FROM p_t WHERE id = $1', [i]));
  const namedMs   = await time(i => c.query({name: 'bench-p', text: 'SELECT v FROM p_t WHERE id = $1', values: [i]}));
  console.log(`2000 queries — unnamed ${unnamedMs.toFixed(0)} ms | named ${namedMs.toFixed(0)} ms`);

  // the trap: a named statement is per-connection and its text is fixed
  try {
    await c.query({name: 'find-p', text: 'SELECT id FROM p_t WHERE id = $1', values: [1]});
  } catch (e) { console.log('reusing a name with different text →', e.message.split('\n')[0]); }
  // hold BOTH clients at once so they are genuinely different sessions
  const other = await pool.connect();
  const pidA = (await c.query('SELECT pg_backend_pid() AS p')).rows[0].p;
  const pidB = (await other.query('SELECT pg_backend_pid() AS p')).rows[0].p;
  const onOther = await other.query(
    `SELECT count(*)::int n FROM pg_prepared_statements WHERE name='find-p'`);
  console.log(`session A pid ${pidA} prepared 'find-p'; session B pid ${pidB} sees`,
    onOther.rows[0].n, '← prepared statements are per-SESSION, not per-pool');
  other.release();
  c.release();
}

// --- 5. timeouts -----------------------------------------------------------
line('5. which timeout does what');
{
  // statement_timeout — server side, cancels the query
  const c1 = await pool.connect();
  await c1.query(`SET statement_timeout = '200ms'`);
  const t0 = process.hrtime.bigint();
  try { await c1.query(`SELECT pg_sleep(2)`); }
  catch (e) {
    console.log(`statement_timeout → ${e.code} ${e.message.split('\n')[0]} after ${(Number(process.hrtime.bigint()-t0)/1e6).toFixed(0)} ms`);
  }
  await c1.query(`SET statement_timeout = 0`);
  console.log('  connection still usable after cancel →', (await c1.query('SELECT 1 AS ok')).rows[0].ok);
  c1.release();

  // query_timeout — client side
  const p2 = new pg.Pool({connectionString: URL, query_timeout: 200});
  const t1 = process.hrtime.bigint();
  try { await p2.query(`SELECT pg_sleep(2)`); }
  catch (e) {
    console.log(`query_timeout     → ${e.message.split('\n')[0]} after ${(Number(process.hrtime.bigint()-t1)/1e6).toFixed(0)} ms`);
  }
  const stillRunning = await q(
    `SELECT count(*)::int n FROM pg_stat_activity WHERE query LIKE 'SELECT pg_sleep(2)%' AND state='active'`);
  console.log('  server-side query still running?', stillRunning.rows[0].n > 0 ? 'YES' : 'no');
  await p2.end();

  // idle_in_transaction_session_timeout — the server TERMINATES the connection
  const c3 = await pool.connect();
  let evented = null;
  c3.on('error', e => { evented = e; });   // without this the process crashes
  await c3.query(`SET idle_in_transaction_session_timeout = '200ms'`);
  await c3.query('BEGIN');
  await new Promise(r => setTimeout(r, 500));
  console.log('idle_in_transaction → arrived as an "error" EVENT:',
    evented && `${evented.severity} ${evented.code} ${evented.message}`);
  try { await c3.query('SELECT 1'); }
  catch (e) { console.log('  next query on it   →', e.message.split('\n')[0]); }
  c3.release(true);
  console.log('  ↑ a FATAL kills the connection; pg emits "error" on the Client.');
  console.log('    Unhandled, that is an uncaught exception — pool.on("error") is mandatory.');
}

// --- 6. one query, one statement -------------------------------------------
line('6. multi-statement behaviour');
{
  const multi = await q(`SELECT 1 AS a; SELECT 2 AS b`);
  console.log('no params  → Array of', multi.length, 'results; last:', multi.at(-1).rows);
  try {
    const empty = await q(`SELECT 1 AS a; SELECT 2 AS b`, []);
    console.log('empty array→ no error;', Array.isArray(empty) ? `Array of ${empty.length}` : 'single result',
      '← [] still uses the simple protocol');
  } catch (e) { console.log('empty array→', e.code, e.message.split('\n')[0]); }
  try { await q(`SELECT $1::int AS a; SELECT 2 AS b`, [1]); }
  catch (e) { console.log('with params→', e.code, e.message.split('\n')[0]); }

  // implicit transaction: a multi-statement string is one transaction
  await q(`DROP TABLE IF EXISTS m_t`);
  await q(`CREATE TABLE m_t (i int)`);
  try { await q(`INSERT INTO m_t VALUES (1); INSERT INTO m_t VALUES ('bad');`); }
  catch (e) { console.log('2nd statement failed →', e.code); }
  console.log('rows in m_t after the failure:',
    (await q(`SELECT count(*)::int n FROM m_t`)).rows[0].n,
    '← the whole string was one implicit transaction');
}

await q(`DROP TABLE IF EXISTS p_t, m_t`);
await pool.end();
