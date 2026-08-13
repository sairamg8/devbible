// Phase 0 page 11 — PostgreSQL vs SQLite, measured side by side.
// SQLite comes from node:sqlite (built into Node 24), so no container is needed.
// Every difference here is caused for real: the same statement is sent to both
// engines and both answers are printed, including the errors.
import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 4,
});
const db = new DatabaseSync(':memory:');
const line = (t) => console.log(`\n=== ${t} ===`);

const PG = async (sql, params) => {
  try {
    const r = await pool.query(sql, params);
    const last = Array.isArray(r) ? r[r.length - 1] : r;
    return { ok: true, rows: last.rows, n: last.rowCount };
  } catch (e) { return { ok: false, err: `${e.code} ${e.message.split('\n')[0]}` }; }
};
const SQ = (sql, ...params) => {
  try {
    const s = db.prepare(sql);
    const rows = /^\s*(select|with)\b/i.test(sql) ? s.all(...params) : (s.run(...params), []);
    return { ok: true, rows };
  } catch (e) { return { ok: false, err: e.message.split('\n')[0] }; }
};
const show = (label, r) =>
  console.log(`  ${label.padEnd(10)} ${r.ok ? 'OK   ' + JSON.stringify(r.rows ?? []) : 'ERR  ' + r.err}`);

line('versions');
console.log('PostgreSQL:', (await pool.query('select version()')).rows[0].version);
console.log('SQLite    :', db.prepare('select sqlite_version() as v').get().v,
            '(node:sqlite, Node', process.version + ')');

// ------------------------------------------------------------ 1. type strictness
line('1. does the engine enforce column types?');
await PG(`drop table if exists t_types`);
await PG(`create table t_types (id int, qty integer)`);
SQ(`create table t_types (id int, qty integer)`);
show('postgres', await PG(`insert into t_types values (1, 'not-a-number')`));
show('sqlite', SQ(`insert into t_types values (1, 'not-a-number')`));
show('sqlite→', SQ(`select id, qty, typeof(qty) as type from t_types`));

// ------------------------------------------------------------ 2. length limits
line('2. is varchar(3) a limit or a suggestion?');
await PG(`drop table if exists t_len`);
await PG(`create table t_len (code varchar(3))`);
SQ(`create table t_len (code varchar(3))`);
show('postgres', await PG(`insert into t_len values ('abcdefgh')`));
show('sqlite', SQ(`insert into t_len values ('abcdefgh')`));
show('sqlite→', SQ(`select code, length(code) as len from t_len`));

// ------------------------------------------------------------ 3. booleans
line('3. is there a real boolean type?');
show('postgres', await PG(`select true as t, pg_typeof(true)::text as type`));
show('sqlite', SQ(`select true as t, typeof(true) as type`));

// ------------------------------------------------------------ 4. transactional DDL
line('4. can you roll back a CREATE TABLE?');
const c = await pool.connect();
await c.query('begin');
await c.query('create table t_ddl_rollback (id int)');
await c.query('rollback');
const pgGone = await PG(`select to_regclass('t_ddl_rollback') is null as gone`);
show('postgres', pgGone);
SQ(`begin`); SQ(`create table t_ddl_rollback (id int)`); SQ(`rollback`);
show('sqlite', SQ(`select count(*) = 0 as gone from sqlite_master where name = 't_ddl_rollback'`));
c.release();

// ------------------------------------------------------------ 5. identifier folding
line('5. what happens to an unquoted mixed-case identifier?');
await PG(`drop table if exists t_case`);
await PG(`create table t_case ("MixedCol" int, PlainCol int)`);
show('postgres', await PG(
  `select column_name from information_schema.columns where table_name='t_case' order by 1`));
SQ(`create table t_case ("MixedCol" int, PlainCol int)`);
show('sqlite', SQ(`select name from pragma_table_info('t_case') order by 1`));

// ------------------------------------------------------------ 6. concurrent writers
line('6. two concurrent writers');
await PG(`drop table if exists t_conc`);
await PG(`create table t_conc (id int primary key, v int)`);
await PG(`insert into t_conc values (1, 0)`);
const a = await pool.connect(), b = await pool.connect();
await a.query('begin'); await a.query('update t_conc set v = 1 where id = 1');
await b.query('begin');
const started = Date.now();
const bWait = b.query('update t_conc set v = 2 where id = 1');   // blocks on A's row lock
await new Promise((r) => setTimeout(r, 300));
console.log(`  postgres   B still waiting after 300 ms: ${Date.now() - started >= 300}`);
await a.query('commit'); await bWait; await b.query('commit');
console.log('  postgres   B proceeded once A committed → final v =',
            (await PG('select v from t_conc where id=1')).rows[0].v);
a.release(); b.release();

// scratch file stays INSIDE the project — never the host's /tmp
const CONC_DB = fileURLToPath(new URL('./tmp/sqlite-conc.db', import.meta.url));
rmSync(CONC_DB, {force: true});
const db2 = new DatabaseSync(CONC_DB);
const db3 = new DatabaseSync(CONC_DB);
db2.exec(`drop table if exists t_conc; create table t_conc (id int primary key, v int);
          insert into t_conc values (1,0)`);
db2.exec('begin immediate'); db2.exec('update t_conc set v = 1 where id = 1');
try {
  db3.exec('begin immediate');
  console.log('  sqlite     second writer got the lock (unexpected)');
} catch (e) {
  console.log('  sqlite     second writer →', e.message.split('\n')[0]);
}
db2.exec('commit'); db2.close(); db3.close();

// ------------------------------------------------------------ 7. right-hand types
line('7. what does the driver hand JavaScript?');
const pgRow = (await PG(`select 9007199254740993::bigint as big, 1.1::numeric as num,
                                now()::date as d, '{"a":1}'::jsonb as j`)).rows[0];
console.log('  postgres  ', Object.entries(pgRow)
  .map(([k, v]) => `${k}=${typeof v}:${v instanceof Date ? 'Date' : JSON.stringify(v)}`).join('  '));
// the bigint on its own: pg hands back a string, node:sqlite THROWS
const sqBig = SQ(`select 9007199254740993 as big`);
console.log('  sqlite     big  →', sqBig.ok ? JSON.stringify(sqBig.rows) : 'THROWS: ' + sqBig.err);
const sqRow = SQ(`select 1.1 as num, '2026-01-01' as d, '{"a":1}' as j`).rows[0];
console.log('  sqlite    ', Object.entries(sqRow)
  .map(([k, v]) => `${k}=${typeof v}:${JSON.stringify(v)}`).join('  '));
console.log('  sqlite     (no date type and no jsonb — both are just TEXT)');

// ------------------------------------------------------------ 8. concurrency ceiling
line('8. what the numbers actually are');
const pgMax = (await PG(`select setting from pg_settings where name='max_connections'`)).rows[0].setting;
console.log('  postgres   max_connections =', pgMax, '(process per connection)');
console.log('  sqlite     writers = 1 at a time (file lock); readers = many with WAL');

await pool.end();
db.close();
