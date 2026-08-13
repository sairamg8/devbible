// Phase 13 page 02 — where a database secret actually leaks: the server log,
// pg_stat_activity, the driver's own objects, and error handling.
// Nothing here changes server config permanently: log_statement is SET per session.
import pg from 'pg';

const URL = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: URL, max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const show = (label, v) => console.log(`${label.padEnd(46)} ${v}`);

line('1. what the driver keeps in memory after you hand it a URL');
const p = new pg.Pool({connectionString: 'postgres://u:sup3rs3cret@127.0.0.1:55432/devbible'});
show('pool.options.password', JSON.stringify(p.options.password));
show('pool.options.connectionString', JSON.stringify(p.options.connectionString));
show('JSON.stringify(pool.options) contains it?',
  JSON.stringify(p.options).includes('sup3rs3cret'));
show('util.inspect depth 3 contains it?',
  (await import('node:util')).inspect(p, {depth: 3}).includes('sup3rs3cret'));
console.log('↑ the password survives on the object. Any log line that dumps the pool,');
console.log('  or a crash reporter serialising config, ships the credential with it.');
await p.end();

line('2. does a connection error carry the password?');
const bad = new pg.Client({connectionString: 'postgres://nope:sup3rs3cret@127.0.0.1:55432/devbible'});
try { await bad.connect(); } catch (e) {
  show('err.message', e.message);
  show('err.code', e.code);
  show('message contains password?', e.message.includes('sup3rs3cret'));
  show('JSON.stringify(err) contains password?', JSON.stringify(e).includes('sup3rs3cret'));
  show('inspect(err) contains password?',
    (await import('node:util')).inspect(e, {depth: 4}).includes('sup3rs3cret'));
}
const bad2 = new pg.Client({connectionString: 'postgres://u:sup3rs3cret@127.0.0.1:1/devbible'});
try { await bad2.connect(); } catch (e) {
  show('ECONNREFUSED err.message', e.message);
  show('  contains password?', (await import('node:util')).inspect(e, {depth: 4}).includes('sup3rs3cret'));
}

line('3. pg_stat_activity — what other sessions can read');
const c = new pg.Client({connectionString: URL, application_name: 'p13-secrets'});
await c.connect();
await c.query(`SELECT pg_sleep(0)`);
// a statement with an inline secret, still visible while it runs
c.query(`SELECT pg_sleep(1.5), 'inline-secret-abc123' AS token`).catch(()=>{});
await new Promise((r) => setTimeout(r, 300));
console.log((await q(`SELECT application_name, state, left(query, 60) AS query
                        FROM pg_stat_activity
                       WHERE application_name = 'p13-secrets'`)).rows);
console.log('↑ any role with pg_read_all_stats (or superuser) reads the query text of');
console.log('  every session. A secret inlined into SQL is readable while it runs.');
console.log((await q(`SELECT rolname FROM pg_roles
                       WHERE pg_has_role(rolname, 'pg_read_all_stats', 'member')
                         AND rolcanlogin ORDER BY 1`)).rows);

line('4. a parameter is NOT the query text');
await new Promise((r) => setTimeout(r, 1400));
c.query(`SELECT pg_sleep(1.5), $1::text AS token`, ['param-secret-xyz789']).catch(()=>{});
await new Promise((r) => setTimeout(r, 300));
console.log((await q(`SELECT left(query, 60) AS query FROM pg_stat_activity
                       WHERE application_name = 'p13-secrets'`)).rows);
console.log('↑ pg_stat_activity shows $1, not the value. Parameters keep secrets out of');
console.log('  the query text — the same mechanism that stops SQL injection.');
await new Promise((r) => setTimeout(r, 1400));

line('5. the server log, with log_statement = all for this session only');
const logger = new pg.Client({connectionString: URL, application_name: 'p13-logtest'});
await logger.connect();
await logger.query(`SET log_statement = 'all'`);
await logger.query(`SET log_min_duration_statement = 0`);
const stamp = Date.now();
await logger.query(`SELECT 'INLINE_${stamp}' AS leaked`);           // inline literal
await logger.query(`SELECT $1::text AS safe`, [`PARAM_${stamp}`]);   // bound parameter
await logger.query(`ALTER ROLE p13_app PASSWORD 'PLAINTEXT_${stamp}'`).catch((e)=>console.log(e.code));
await logger.end();
await new Promise((r) => setTimeout(r, 600));

const {execSync} = await import('node:child_process');
const log = execSync(`podman logs --since 60s devbible-pg 2>&1 | tail -40`).toString();
const hit = (needle) => log.split('\n').filter((l) => l.includes(needle));
show(`INLINE_${stamp} in server log`, hit(`INLINE_${stamp}`).length + ' line(s)');
hit(`INLINE_${stamp}`).slice(0, 2).forEach((l) => console.log('   ' + l.slice(0, 120)));
show(`PARAM_${stamp} (bound value) in log`, hit(`PARAM_${stamp}`).length + ' line(s)');
hit(`PARAM_${stamp}`).slice(0, 2).forEach((l) => console.log('   ' + l.slice(0, 120)));
show(`PLAINTEXT_${stamp} (the password) in log`, hit(`PLAINTEXT_${stamp}`).length + ' line(s)');
hit(`PLAINTEXT_${stamp}`).slice(0, 2).forEach((l) => console.log('   ' + l.slice(0, 140)));
console.log((await q(`SHOW log_parameter_max_length`)).rows[0]);
console.log((await q(`SHOW log_parameter_max_length_on_error`)).rows[0]);

line('6. what the password_encryption verifier hides, and what it does not');
console.log((await q(`SELECT rolname, left(rolpassword, 22) AS stored
                        FROM pg_authid WHERE rolname = 'p13_app'`)).rows[0]);
console.log('↑ the stored verifier is not the password we just set — but the ALTER ROLE');
console.log('  statement that set it is in the log above, in plaintext.');

line('7. URL encoding: a password with special characters');
for (const pw of ['p@ss', 'p/ss', 'p#ss', 'p:ss', 'p ss']) {
  const u = `postgres://devbible:${pw}@127.0.0.1:55432/devbible`;
  try {
    const parsed = new pg.Client({connectionString: u});
    show(`raw "${pw}" → user / password`,
      `${JSON.stringify(parsed.user)} / ${JSON.stringify(parsed.password)}`);
  } catch (e) {
    show(`raw "${pw}" → THROWS`, `${e.code} ${e.message} · input: ${e.input}`);
  }
}
show('encodeURIComponent("p@ss")', encodeURIComponent('p@ss'));
const enc = new pg.Client({connectionString: `postgres://devbible:${encodeURIComponent('p@ss')}@127.0.0.1:55432/devbible`});
show('encoded → parsed password', JSON.stringify(enc.password));

line('8. the safe read of your own connection identity');
console.log((await q(`SELECT current_user, current_database(),
                             inet_server_addr()::text AS server,
                             current_setting('is_superuser') AS is_superuser,
                             current_setting('application_name') AS app`)).rows[0]);
console.log('↑ log THIS at boot instead of the connection string. It answers "which');
console.log('  database, as whom" without carrying a credential into the log.');

await c.end();
await pool.end();
