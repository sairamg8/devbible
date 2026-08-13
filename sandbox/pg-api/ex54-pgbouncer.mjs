// Phase 13 page 07 — connection limits and PgBouncer: what transaction pooling
// actually multiplexes, and which session features it breaks.
//
// Setup (PgBouncer 1.25.2, host network, transaction mode, pool size 5):
//   podman run -d --name devbible-pgbouncer --network=host \
//     -e DB_HOST=127.0.0.1 -e DB_PORT=55432 -e DB_USER=devbible \
//     -e DB_PASSWORD=devbible -e DB_NAME=devbible -e POOL_MODE=transaction \
//     -e MAX_CLIENT_CONN=100 -e DEFAULT_POOL_SIZE=5 -e AUTH_TYPE=scram-sha-256 \
//     -e LISTEN_PORT=6432 -e ADMIN_USERS=devbible -e MAX_PREPARED_STATEMENTS=0 \
//     docker.io/edoburu/pgbouncer:latest
//
// Runtime ~3 min: section 2 deliberately waits out the default 120 s
// query_wait_timeout rather than lowering it, because that default is the finding.
import pg from 'pg';

const DIRECT = {host: '127.0.0.1', port: 55432, database: 'devbible', user: 'devbible', password: 'devbible'};
const VIA    = {...DIRECT, port: 6432};
const line = (t) => console.log(`\n=== ${t} ===`);
const show = (l, v) => console.log(`${l.padEnd(46)} ${v}`);

// pgbouncer CLOSES a client it has timed out, and pg re-emits that as an 'error'
// event. Without a handler the process dies before the later sections run.
const mkClient = (cfg) => {
  const c = new pg.Client(cfg);
  c.on('error', () => {});
  return c;
};

const admin = new pg.Pool(DIRECT);
admin.on('error', () => {});
const backendPid = async (c) => (await c.query('SELECT pg_backend_pid() AS p')).rows[0].p;

line('0. versions and the two paths');
console.log((await admin.query(`SELECT current_setting('server_version') AS server`)).rows[0]);
{
  const c = mkClient(VIA); await c.connect();
  show('through pgbouncer, server sees', `backend pid ${await backendPid(c)}`);
  await c.end();
}

line('1. 40 clients through a pool of 5 — sequential vs concurrent');
const clients = [];
for (let i = 0; i < 40; i++) { const c = mkClient(VIA); await c.connect(); clients.push(c); }
show('client connections opened', clients.length);

// sequential: each query finishes before the next begins
const seqPids = new Set();
for (const c of clients) seqPids.add(await backendPid(c));
show('40 queries run one after another → pids', seqPids.size);

// concurrent: 40 queries in flight at once, each holding its server connection
const conc = await Promise.allSettled(clients.map((c) =>
  c.query('SELECT pg_sleep(0.25), pg_backend_pid() AS p')));
const concPids = new Set(conc.filter((r) => r.status === 'fulfilled').map((r) => r.value.rows[0].p));
show('40 queries all in flight at once → pids', concPids.size);
show('  (default_pool_size is 5)', `${conc.filter((r) => r.status === 'rejected').length} failed`);
console.log((await admin.query(`SELECT count(*) AS server_conns FROM pg_stat_activity
                                 WHERE datname='devbible' AND backend_type='client backend'`)).rows[0]);
console.log('↑ the server connection is held only while a statement or transaction is');
console.log('  running. 40 idle clients cost ONE; 40 simultaneous queries cost at most');
console.log('  the pool size, and the rest wait their turn.');

line('2. what happens when open transactions exceed the pool size');
const txClients = clients.slice(0, 7);
const results = [];
await Promise.all(txClients.map(async (c, i) => {
  const t0 = process.hrtime.bigint();
  try {
    await c.query('BEGIN');
    const pid = await backendPid(c);
    results.push({i, pid, waited_ms: +(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0)});
  } catch (e) {
    results.push({i, error: `${e.code} ${e.message.split('\n')[0]}`,
                  waited_ms: +(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0)});
  }
}));
results.sort((a, b) => a.i - b.i).forEach((r) => console.log('  ', JSON.stringify(r)));
console.log('↑ five clients got a server connection; the rest waited and then failed with');
console.log('  query_wait_timeout (08P01). A client inside a transaction PINS its server');
console.log('  connection until COMMIT/ROLLBACK — which is why one idle-in-transaction bug');
console.log('  takes down every other client behind the same pool.');
for (const c of txClients) { try { await c.query('ROLLBACK'); } catch {} }

line('3. what does NOT survive transaction pooling');
const a = mkClient(VIA); await a.connect();
await a.query(`SET application_name = 'set-outside-tx'`);
show('SET outside a transaction, then read back',
  (await a.query(`SELECT current_setting('application_name') AS v`)).rows[0].v);
await a.query('BEGIN');
await a.query(`SET LOCAL application_name = 'set-local-inside-tx'`);
show('SET LOCAL inside the same transaction',
  (await a.query(`SELECT current_setting('application_name') AS v`)).rows[0].v);
await a.query('COMMIT');
show('after COMMIT, on the next statement',
  (await a.query(`SELECT current_setting('application_name') AS v`)).rows[0].v);
console.log('↑ whether a plain SET survives depends on which server connection you land');
console.log('  on next — it is not yours between transactions. SET LOCAL is the safe form.');

line('4. session-level advisory locks through a transaction pool');
const l1 = mkClient(VIA); await l1.connect();
const l2 = mkClient(VIA); await l2.connect();
await l1.query('SELECT pg_advisory_lock(918273)');
show('client 1 took a session advisory lock', `on pid ${await backendPid(l1)}`);
const got = await l2.query('SELECT pg_try_advisory_lock(918273) AS got');
show('client 2 pg_try_advisory_lock', got.rows[0].got);
show('  client 2 is on pid', await backendPid(l2));
console.log((await admin.query(`SELECT count(*) AS holders FROM pg_locks WHERE locktype='advisory'`)).rows[0]);
console.log('↑ if client 2 got the lock, the two clients were on DIFFERENT server');
console.log('  connections; if it did not, they shared one. Either way the result is');
console.log('  luck, not logic: session advisory locks are unusable behind transaction');
console.log('  pooling. pg_advisory_xact_lock() is the form that works.');
await l1.query('SELECT pg_advisory_unlock_all()');
await l2.query('SELECT pg_advisory_unlock_all()');
await l1.end(); await l2.end();

line('5. LISTEN / NOTIFY');
const listener = mkClient(VIA); await listener.connect();
let delivered = 0;
listener.on('notification', () => delivered++);
await listener.query('LISTEN p13_channel');
const notifier = mkClient(VIA); await notifier.connect();
await notifier.query(`NOTIFY p13_channel, 'hello'`);
await new Promise((r) => setTimeout(r, 800));
show('notifications delivered through pgbouncer', delivered);
const dl = mkClient(DIRECT); await dl.connect();
let direct = 0;
dl.on('notification', () => direct++);
await dl.query('LISTEN p13_direct');
const dn = mkClient(DIRECT); await dn.connect();
await dn.query(`NOTIFY p13_direct, 'hello'`);
await new Promise((r) => setTimeout(r, 800));
show('the same test connected directly', direct);
await listener.end(); await notifier.end(); await dl.end(); await dn.end();

line('6. named prepared statements (max_prepared_statements = 0)');
const p1 = mkClient(VIA); await p1.connect();
try {
  await p1.query({name: 'p13_stmt', text: 'SELECT $1::int AS n', values: [1]});
  show('first execute of a named statement', 'OK');
  for (let i = 0; i < 30; i++) await p1.query({name: 'p13_stmt', text: 'SELECT $1::int AS n', values: [i]});
  show('30 more executes of the same name', 'OK');
} catch (e) { show('named prepared statement', `${e.code} ${e.message.split('\n')[0]}`); }
await p1.end();

line('7. the admin console — SHOW POOLS / SHOW STATS');
const adm = mkClient({...VIA, database: 'pgbouncer'});
try {
  await adm.connect();
  const pools = await adm.query('SHOW POOLS');
  console.log(pools.rows.filter((r) => r.database === 'devbible')
    .map((r) => ({db: r.database, cl_active: r.cl_active, cl_waiting: r.cl_waiting,
                  sv_active: r.sv_active, sv_idle: r.sv_idle, pool_mode: r.pool_mode})));
  const st = await adm.query('SHOW STATS');
  console.log(st.rows.filter((r) => r.database === 'devbible')
    .map((r) => ({db: r.database, total_query_count: r.total_query_count,
                  avg_query_time_us: r.avg_query_time})));
  await adm.end();
} catch (e) { show('admin console', `${e.code ?? ''} ${e.message.split('\n')[0]}`); }

line('8. latency cost of the extra hop');
const bench = async (cfg, label) => {
  const c = mkClient(cfg); await c.connect();
  for (let i = 0; i < 50; i++) await c.query('SELECT 1');      // warm
  const ts = [];
  for (let i = 0; i < 400; i++) {
    const t0 = process.hrtime.bigint();
    await c.query('SELECT 1');
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ts.sort((x, y) => x - y);
  show(label, `median ${ts[200].toFixed(3)} ms · p95 ${ts[380].toFixed(3)} ms`);
  await c.end();
};
await bench(DIRECT, 'direct to postgres');
await bench(VIA, 'through pgbouncer');

line('9. connection establishment cost — what pooling really saves');
const connectCost = async (cfg, label) => {
  const ts = [];
  for (let i = 0; i < 30; i++) {
    const t0 = process.hrtime.bigint();
    const c = mkClient(cfg); await c.connect(); await c.query('SELECT 1'); await c.end();
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ts.sort((x, y) => x - y);
  show(label, `median ${ts[15].toFixed(2)} ms`);
};
await connectCost(DIRECT, 'connect+query+close, direct');
await connectCost(VIA, 'connect+query+close, via pgbouncer');

for (const c of clients) await c.end();
await admin.end();
