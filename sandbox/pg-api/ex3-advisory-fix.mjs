// Does an advisory lock actually fix the ex2/B race under the same pressure?
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible',
  max: 20,
});

const errors = new Map();
let ok = 0;
const t0 = performance.now();

for (let round = 0; round < 25; round++) {
  await pool.query('DROP TABLE IF EXISTS race_demo');
  const boot = async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [4242]);
      await client.query('CREATE TABLE IF NOT EXISTS race_demo (id int, tag text)');
      await client.query('COMMIT');
      ok++;
    } catch (e) {
      await client.query('ROLLBACK');
      const key = `${e.code} ${e.message}`;
      errors.set(key, (errors.get(key) ?? 0) + 1);
    } finally {
      client.release();
    }
  };
  await Promise.all(Array.from({length: 20}, boot));
}

const ms = performance.now() - t0;
console.log('succeeded:', ok, 'of', 20 * 25, `in ${ms.toFixed(0)} ms`);
if (errors.size === 0) console.log('errors: (none)');
else for (const [k, v] of errors) console.log(`  ${v}× ${k}`);

await pool.query('DROP TABLE IF EXISTS race_demo');
await pool.end();
