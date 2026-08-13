// Phase 8 / 01 — creating tables from Node with raw pg.
// Q: does DDL through the driver work, is it transactional, and what breaks?
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible',
  max: 5,
});

const line = (t) => console.log(`\n=== ${t} ===`);

// --- 1. plain DDL through the driver ---------------------------------------
line('1. CREATE TABLE via client.query');
{
  const client = await pool.connect();
  await client.query('DROP TABLE IF EXISTS ddl_demo CASCADE');
  const res = await client.query(`
    CREATE TABLE ddl_demo (
      id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      email  text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'active'
    )
  `);
  console.log('command:', res.command, '| rowCount:', res.rowCount, '| fields:', res.fields.length);
  client.release();
}

// --- 2. can DDL take $1 parameters? ----------------------------------------
line('2. parameterised identifier in DDL');
try {
  await pool.query('CREATE TABLE $1 (id int)', ['nope_demo']);
} catch (err) {
  console.log('code:', err.code, '| message:', err.message);
  console.log('position:', err.position, '| severity:', err.severity);
}

// --- 3. transactional DDL: does a failed migration leave debris? -----------
line('3. transactional DDL — rollback after a good CREATE');
{
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TABLE tx_demo_a (id int)');
    await client.query('CREATE TABLE tx_demo_b (id int)');
    await client.query('CREATE TABLE tx_demo_a (id int)'); // deliberate failure
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.log('failed on:', err.code, err.message);
  }
  const {rows} = await client.query(
    `select tablename from pg_tables where tablename like 'tx_demo%' order by 1`,
  );
  console.log('tables surviving the rollback:', rows.length === 0 ? '(none)' : rows);
  client.release();
}

// --- 4. multi-statement in one query() -------------------------------------
line('4. several statements in one query() call');
{
  const res = await pool.query(
    `CREATE TABLE multi_a (id int); CREATE TABLE multi_b (id int);`,
  );
  console.log('returned:', Array.isArray(res) ? `array of ${res.length}` : res.command);
  try {
    await pool.query(`CREATE TABLE multi_c (id int); CREATE TABLE multi_d (id int);`, []);
  } catch (err) {
    console.log('with a params array →', err.code, '|', err.message);
  }
  await pool.query('DROP TABLE IF EXISTS multi_a, multi_b');
}

// --- 5. two processes racing CREATE TABLE IF NOT EXISTS at boot ------------
line('5. concurrent CREATE TABLE IF NOT EXISTS (the lazy-startup pattern)');
{
  await pool.query('DROP TABLE IF EXISTS race_demo');
  const boot = (n) =>
    pool
      .query('CREATE TABLE IF NOT EXISTS race_demo (id int, tag text)')
      .then(() => `worker ${n}: ok`)
      .catch((e) => `worker ${n}: ${e.code} ${e.message}`);
  const results = await Promise.all([boot(1), boot(2), boot(3), boot(4), boot(5)]);
  results.forEach((r) => console.log(' ', r));
}

// --- 6. the same race, serialised behind an advisory lock ------------------
line('6. same race behind pg_advisory_xact_lock');
{
  await pool.query('DROP TABLE IF EXISTS race_demo');
  const boot = async (n) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [42]);
      await client.query('CREATE TABLE IF NOT EXISTS race_demo (id int, tag text)');
      await client.query('COMMIT');
      return `worker ${n}: ok`;
    } catch (e) {
      await client.query('ROLLBACK');
      return `worker ${n}: ${e.code} ${e.message}`;
    } finally {
      client.release();
    }
  };
  const results = await Promise.all([boot(1), boot(2), boot(3), boot(4), boot(5)]);
  results.forEach((r) => console.log(' ', r));
}

// --- 7. what the driver reports back about the new table -------------------
line('7. reading the schema back');
{
  const {rows} = await pool.query(
    `select column_name, data_type, is_nullable, column_default
       from information_schema.columns
      where table_name = 'ddl_demo'
      order by ordinal_position`,
  );
  console.table(rows);
}

await pool.query('DROP TABLE IF EXISTS ddl_demo, race_demo CASCADE');
await pool.end();
