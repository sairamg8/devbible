// Follow-ups to ex1: the empty-params multi-statement case, and how hard the
// CREATE TABLE IF NOT EXISTS boot race has to be pushed before it actually fails.
import pg from 'pg';

const url = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const line = (t) => console.log(`\n=== ${t} ===`);

// --- A. does query(sql, []) really take the simple-query path? -------------
line('A. multi-statement with an empty params array');
{
  const pool = new pg.Pool({connectionString: url, max: 2});
  await pool.query('DROP TABLE IF EXISTS multi_c, multi_d');
  const res = await pool.query('CREATE TABLE multi_c (id int); CREATE TABLE multi_d (id int);', []);
  console.log('empty array →', Array.isArray(res) ? `array of ${res.length}` : res.command);
  const {rows} = await pool.query(
    `select tablename from pg_tables where tablename like 'multi_%' order by 1`,
  );
  console.log('created:', rows.map((r) => r.tablename).join(', ') || '(none)');

  await pool.query('DROP TABLE IF EXISTS multi_e, multi_f');
  try {
    await pool.query('CREATE TABLE multi_e (id int); CREATE TABLE multi_f (id int);', ['x']);
  } catch (err) {
    console.log('non-empty array →', err.code, '|', err.message);
  }
  const after = await pool.query(
    `select tablename from pg_tables where tablename like 'multi_%' order by 1`,
  );
  console.log('after non-empty:', after.rows.map((r) => r.tablename).join(', ') || '(none)');
  await pool.query('DROP TABLE IF EXISTS multi_c, multi_d, multi_e, multi_f');
  await pool.end();
}

// --- B. the boot race, pushed ---------------------------------------------
line('B. CREATE TABLE IF NOT EXISTS race — 20 connections, 25 rounds');
{
  const pool = new pg.Pool({connectionString: url, max: 20});
  const errors = new Map();
  let ok = 0;
  for (let round = 0; round < 25; round++) {
    await pool.query('DROP TABLE IF EXISTS race_demo');
    const workers = Array.from({length: 20}, () =>
      pool
        .query('CREATE TABLE IF NOT EXISTS race_demo (id int, tag text)')
        .then(() => {
          ok++;
        })
        .catch((e) => {
          const key = `${e.code} ${e.message}`;
          errors.set(key, (errors.get(key) ?? 0) + 1);
        }),
    );
    await Promise.all(workers);
  }
  console.log('succeeded:', ok, 'of', 20 * 25);
  if (errors.size === 0) console.log('errors: (none)');
  else for (const [k, v] of errors) console.log(`  ${v}× ${k}`);
  await pool.query('DROP TABLE IF EXISTS race_demo');
  await pool.end();
}

// --- C. same, but each worker also inserts a seed row ----------------------
// The "lazy startup" pattern in the wild is create-then-seed, which is where the
// real damage shows up even when the CREATE itself survives.
line('C. create-then-seed at boot, 20 workers');
{
  const pool = new pg.Pool({connectionString: url, max: 20});
  await pool.query('DROP TABLE IF EXISTS boot_seed');
  const boot = (n) =>
    pool
      .query('CREATE TABLE IF NOT EXISTS boot_seed (id int, tag text)')
      .then(() => pool.query(`INSERT INTO boot_seed (id, tag) VALUES ($1, $2)`, [n, 'admin']))
      .then(() => 'ok')
      .catch((e) => `${e.code} ${e.message}`);
  const results = await Promise.all(Array.from({length: 20}, (_, i) => boot(i)));
  const bad = results.filter((r) => r !== 'ok');
  console.log('ok:', results.length - bad.length, '| failed:', bad.length);
  const {rows} = await pool.query(`select count(*)::int as seeded from boot_seed`);
  console.log('rows in boot_seed after "idempotent" startup:', rows[0].seeded);
  await pool.query('DROP TABLE IF EXISTS boot_seed');
  await pool.end();
}
