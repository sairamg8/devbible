// Phase 12 page 13 — the SERVER side of LISTEN/NOTIFY. The driver mechanics
// (listener must be a Client, delivery on COMMIT, dedup, 8000-byte payload,
// nothing durable, reconnecting) are already measured in ex22 and written up in
// phase 7. This covers what belongs to the database: NOTIFY from a trigger,
// pg_notify with a dynamic channel, channel-name folding, and the queue.
import pg from 'pg';

const URL = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: URL, max: 10});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// --- 1. NOTIFY from a trigger ---------------------------------------------
line('1. a trigger that notifies on write');
{
  await q(`DROP TABLE IF EXISTS n_orders CASCADE`);
  await q(`CREATE TABLE n_orders (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                                  status text NOT NULL)`);
  await q(`CREATE OR REPLACE FUNCTION n_announce() RETURNS trigger AS $$
           BEGIN
             PERFORM pg_notify('orders', json_build_object(
               'op', TG_OP, 'id', NEW.id, 'status', NEW.status)::text);
             RETURN NULL;
           END $$ LANGUAGE plpgsql`);
  await q(`CREATE TRIGGER n_announce_t AFTER INSERT OR UPDATE ON n_orders
           FOR EACH ROW EXECUTE FUNCTION n_announce()`);

  const listener = await pool.connect();
  const got = [];
  listener.on('notification', (n) => got.push(n));
  await listener.query(`LISTEN orders`);

  await q(`INSERT INTO n_orders (status) VALUES ('open')`);
  await q(`UPDATE n_orders SET status = 'shipped' WHERE id = 1`);
  await wait(250);
  console.log('notifications received:', got.length);
  for (const n of got) console.log('  channel=%s payload=%s', n.channel, n.payload);
  listener.release();
}

// --- 2. one transaction, many rows ----------------------------------------
line('2. what a bulk write produces');
{
  const listener = await pool.connect();
  const got = [];
  listener.on('notification', (n) => got.push(n));
  await listener.query(`LISTEN orders`);

  await q(`INSERT INTO n_orders (status)
           SELECT 'bulk' FROM generate_series(1,500)`);
  await wait(400);
  console.log('rows inserted: 500 → notifications delivered:', got.length);
  console.log('↑ a row-level trigger notifies per ROW; identical payloads would be');
  console.log('  folded, but these differ by id so every one is delivered');

  // the same write announced once, from a STATEMENT trigger
  await q(`DROP TRIGGER n_announce_t ON n_orders`);
  await q(`CREATE OR REPLACE FUNCTION n_announce_stmt() RETURNS trigger AS $$
           BEGIN PERFORM pg_notify('orders', 'batch changed'); RETURN NULL; END $$
           LANGUAGE plpgsql`);
  await q(`CREATE TRIGGER n_announce_s AFTER INSERT ON n_orders
           FOR EACH STATEMENT EXECUTE FUNCTION n_announce_stmt()`);
  got.length = 0;
  await q(`INSERT INTO n_orders (status) SELECT 'bulk2' FROM generate_series(1,500)`);
  await wait(300);
  console.log('\nsame 500 rows via a STATEMENT trigger → notifications:', got.length);
  listener.release();
}

// --- 3. NOTIFY vs pg_notify, and channel names ----------------------------
line('3. channel names are identifiers');
{
  const listener = await pool.connect();
  const got = [];
  listener.on('notification', (n) => got.push(n.channel));
  await listener.query(`LISTEN myorders`);          // unquoted → folded to lower

  await q(`NOTIFY myorders, 'a'`);
  await q(`NOTIFY MyOrders, 'b'`);                  // unquoted, folds to myorders
  await q(`SELECT pg_notify('myorders', 'c')`);     // function form: exact string
  await q(`SELECT pg_notify('MyOrders', 'd')`);     // NOT folded — different channel
  await wait(300);
  console.log('channels received:', JSON.stringify(got));
  console.log('↑ NOTIFY folds an unquoted channel name like any identifier;');
  console.log('  pg_notify() takes a string and does NOT fold it');

  // pg_notify is also the only form that takes a computed channel
  await listener.query(`LISTEN tenant_7`);
  await q(`SELECT pg_notify('tenant_' || $1::text, 'scoped')`, [7]);
  await wait(200);
  console.log('after a computed channel name:', JSON.stringify(got));
  listener.release();
}

// --- 4. the queue -----------------------------------------------------------
line('4. the notification queue');
{
  const usage = async (client = pool) => (await client.query(
    `SELECT to_char(pg_notification_queue_usage() * 100, 'FM0.000000') AS pct`)).rows[0].pct;
  console.log('queue usage now:', await usage(), '% of the 8 GB queue');

  // an idle listener means the queue cannot be truncated past its position
  const idle = await pool.connect();
  await idle.query(`LISTEN slowchan`);
  const c = await pool.connect();
  await c.query('BEGIN');
  for (let i = 0; i < 2000; i++) {
    await c.query(`SELECT pg_notify('slowchan', repeat('x', 200))`);
  }
  console.log('2000 x 200-byte notifications, still uncommitted:', await usage(c), '%');
  await c.query('ROLLBACK');
  c.release();
  await wait(200);
  console.log('after ROLLBACK                              :', await usage(), '%');
  console.log('↑ ~400 kB against an 8 GB queue is far too small to move the needle.');
  console.log('  The queue is not a practical limit for normal use — it becomes one');
  console.log('  only when a listener stops consuming and writers keep notifying,');
  console.log('  at which point NOTIFY errors. Not demonstrated here: filling 8 GB.');
  idle.release();
}

// --- 5. what a listener misses --------------------------------------------
line('5. nothing is durable');
{
  const listener = await pool.connect();
  const got = [];
  listener.on('notification', (n) => got.push(n.payload));
  await listener.query(`LISTEN gap`);
  await q(`NOTIFY gap, 'before'`);
  await wait(200);

  await listener.query(`UNLISTEN gap`);
  await q(`NOTIFY gap, 'while not listening'`);
  await wait(200);
  await listener.query(`LISTEN gap`);
  await q(`NOTIFY gap, 'after'`);
  await wait(200);

  console.log('payloads received:', JSON.stringify(got));
  console.log('↑ the middle one is gone forever — there is no replay, no backlog');
  listener.release();
}

await q(`DROP TABLE IF EXISTS n_orders CASCADE`);
await q(`DROP FUNCTION IF EXISTS n_announce(), n_announce_stmt()`);
await pool.end();
