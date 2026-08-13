// Is the case-sensitive ORDER BY in ex5/9 real PostgreSQL behaviour, or an
// artefact of postgres:18-alpine (musl libc has near-stub locale support)?
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible',
  max: 4,
});
const q = (...a) => pool.query(...a);

console.log('=== what this server actually offers ===');
console.log((await q(`SHOW server_version`)).rows[0]);
console.log((await q(`SELECT datcollate, datctype, datlocprovider FROM pg_database WHERE datname=current_database()`)).rows[0]);
const {rows: provs} = await q(`
  SELECT collprovider, count(*)::int AS n FROM pg_collation GROUP BY 1 ORDER BY 1`);
console.log('collation providers present (c=libc, i=icu, b=builtin):', provs);

await q(`DROP TABLE IF EXISTS coll_demo`);
await q(`CREATE TABLE coll_demo (name text)`);
await q(`INSERT INTO coll_demo VALUES ('apple'),('Banana'),('cherry'),('Date'),('elderberry')`);

const show = async (label, clause) => {
  try {
    const {rows} = await q(`SELECT name FROM coll_demo ORDER BY ${clause}`);
    console.log(label.padEnd(34), rows.map((r) => r.name).join(', '));
  } catch (e) {
    console.log(label.padEnd(34), `${e.code} ${e.message}`);
  }
};

console.log('\n=== the same five names, different collations ===');
await show('default (database collation)', 'name');
await show('COLLATE "C"', 'name COLLATE "C"');
await show('COLLATE "en_US.utf8"', 'name COLLATE "en_US.utf8"');
await show('COLLATE "und-x-icu"', 'name COLLATE "und-x-icu"');
await show('COLLATE "en-US-x-icu"', 'name COLLATE "en-US-x-icu"');
await show('lower(name)', 'lower(name)');

// a case-insensitive, accent-sensitive collation via ICU, if available
console.log('\n=== a nondeterministic ICU collation (case-insensitive equality) ===');
try {
  await q(`DROP COLLATION IF EXISTS ci`);
  await q(`CREATE COLLATION ci (provider = icu, locale = 'und-u-ks-level2', deterministic = false)`);
  await show('COLLATE ci', 'name COLLATE ci');
  const {rows} = await q(`SELECT 'Apple' = 'apple' COLLATE ci AS ci_equal, 'Apple' = 'apple' AS default_equal`);
  console.log('equality:', rows[0]);
} catch (e) {
  console.log('ICU collation unavailable here:', e.code, e.message);
}

await q(`DROP TABLE coll_demo`);
await pool.end();
