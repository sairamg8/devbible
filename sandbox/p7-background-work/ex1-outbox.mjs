import pg from 'pg';
const pool = new pg.Pool({connectionString: 'postgres://postgres:devbible@127.0.0.1:55432/shop'});

await pool.query(`
  drop table if exists outbox, orders, emails_sent, jobs cascade;
  create table orders (id serial primary key, user_id int not null, total_cents bigint not null, created_at timestamptz default now());
  create table outbox (id bigserial primary key, topic text not null, payload jsonb not null, created_at timestamptz default now(), published_at timestamptz);
  create table emails_sent (id serial primary key, order_id int not null, idempotency_key text unique);
  create table jobs (id bigserial primary key, kind text not null, payload jsonb not null, run_at timestamptz default now(), attempts int default 0, locked_until timestamptz);
`);

// ---------- 1. dual write: the crash window ----------
let enqueued = 0;
const brokenEnqueue = async () => { throw new Error('redis unavailable'); };
try {
  const {rows} = await pool.query('insert into orders (user_id, total_cents) values ($1,$2) returning id', [7, 250000]);
  await brokenEnqueue(rows[0].id);   // crash here
  enqueued++;
} catch (e) { console.log('dual write: enqueue failed ->', e.message); }
console.log('dual write: orders =', (await pool.query('select count(*) from orders')).rows[0].count,
            '| jobs enqueued =', enqueued, '  <- the order exists and nothing will ever process it');

// ---------- 2. outbox: one transaction ----------
const client = await pool.connect();
try {
  await client.query('begin');
  const {rows} = await client.query('insert into orders (user_id, total_cents) values ($1,$2) returning id', [8, 99900]);
  await client.query('insert into outbox (topic, payload) values ($1,$2)', ['order.paid', {orderId: rows[0].id}]);
  await client.query('commit');
} finally { client.release(); }
console.log('outbox: orders =', (await pool.query('select count(*) from orders')).rows[0].count,
            '| outbox rows =', (await pool.query('select count(*) from outbox')).rows[0].count);

// rollback case: neither survives
const c2 = await pool.connect();
try {
  await c2.query('begin');
  const {rows} = await c2.query('insert into orders (user_id, total_cents) values ($1,$2) returning id', [9, 1]);
  await c2.query('insert into outbox (topic, payload) values ($1,$2)', ['order.paid', {orderId: rows[0].id}]);
  await c2.query('rollback');
} finally { c2.release(); }
console.log('outbox after rollback: orders =', (await pool.query('select count(*) from orders')).rows[0].count,
            '| outbox rows =', (await pool.query('select count(*) from outbox')).rows[0].count, ' <- neither, together');

// ---------- 3. relay ----------
const relayed = await pool.query(
  `update outbox set published_at = now()
   where id in (select id from outbox where published_at is null order by id for update skip locked limit 100)
   returning id, topic, payload`);
console.log('relay: published', relayed.rowCount, 'event(s):', JSON.stringify(relayed.rows[0].payload));

// ---------- 4. idempotency ----------
const sendEmailNaive = async (orderId) => pool.query('insert into emails_sent (order_id) values ($1)', [orderId]);
await sendEmailNaive(1); await sendEmailNaive(1);
console.log('naive job run twice -> emails_sent =', (await pool.query('select count(*) from emails_sent')).rows[0].count);

await pool.query('truncate emails_sent');
const sendEmailIdempotent = async (orderId) => pool.query(
  'insert into emails_sent (order_id, idempotency_key) values ($1,$2) on conflict (idempotency_key) do nothing',
  [orderId, `order-paid-email:${orderId}`]);
const r1 = await sendEmailIdempotent(1); const r2 = await sendEmailIdempotent(1);
console.log('idempotent job run twice -> rowCounts', r1.rowCount, r2.rowCount,
            '| emails_sent =', (await pool.query('select count(*) from emails_sent')).rows[0].count);

await pool.end();
