// Phase 9 pages 05, 12 — a transaction inside one request, and what happens when
// a service function is handed the pool instead of the transaction's client.
import pg from 'pg';

const URL = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: URL, max: 10});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

await q(`DROP TABLE IF EXISTS t_items, t_orders CASCADE`);
await q(`CREATE TABLE t_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ref text NOT NULL)`);
await q(`CREATE TABLE t_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_ref text NOT NULL,
  sku text NOT NULL)`);

const counts = async (label) => {
  const o = (await q(`SELECT count(*)::int c FROM t_orders`)).rows[0].c;
  const i = (await q(`SELECT count(*)::int c FROM t_items`)).rows[0].c;
  console.log(`${label.padEnd(34)} orders=${o} items=${i}`);
};
const truncate = () => q(`TRUNCATE t_orders, t_items`);

// Two repository functions. Both take an executor as their first argument —
// that is the whole propagation contract.
const insertOrder = (db, ref) =>
  db.query(`INSERT INTO t_orders (ref) VALUES ($1) RETURNING id`, [ref]);
const insertItem = (db, ref, sku) =>
  db.query(`INSERT INTO t_items (order_ref, sku) VALUES ($1,$2)`, [ref, sku]);

// --- 1. the shape that works ------------------------------------------------
line('1. BEGIN / COMMIT / ROLLBACK on one checked-out client');
{
  await truncate();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await insertOrder(client, 'ok-1');
    await insertItem(client, 'ok-1', 'sku-a');
    await client.query('COMMIT');
    console.log('committed');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await counts('after a clean commit:');
}

// --- 2. the same shape when the handler throws ------------------------------
line('2. an error mid-request rolls both writes back');
{
  await truncate();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await insertOrder(client, 'bad-1');
    await insertItem(client, 'bad-1', 'sku-a');
    throw new Error('payment declined');   // anything after the writes
    // eslint-disable-next-line no-unreachable
  } catch (e) {
    await client.query('ROLLBACK');
    console.log('rolled back because:', e.message);
  } finally {
    client.release();
  }
  await counts('after the rollback:');
}

// --- 3. THE BUG: one service gets the client, the other gets the pool -------
line('3. a service handed the pool instead of the client');
{
  await truncate();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await insertOrder(client, 'split-1');   // inside the transaction
    await insertItem(pool, 'split-1', 'sku-a');  // ← its OWN connection, autocommit
    throw new Error('payment declined');
    // eslint-disable-next-line no-unreachable
  } catch (e) {
    await client.query('ROLLBACK');
    console.log('rolled back because:', e.message);
  } finally {
    client.release();
  }
  await counts('after the "rollback":');
  console.log('↑ the order is gone, the item is not. Half the request committed.');
}

// --- 4. why no error was raised: they are different sessions ---------------
line('4. proof the two calls ran on different backends');
{
  await truncate();
  const client = await pool.connect();
  await client.query('BEGIN');
  const inTx = (await client.query(`SELECT pg_backend_pid() AS pid`)).rows[0].pid;
  const viaPool = (await pool.query(`SELECT pg_backend_pid() AS pid`)).rows[0].pid;
  console.log('pid inside the transaction :', inTx);
  console.log('pid of the pool.query call :', viaPool);
  console.log('same backend?', inTx === viaPool);
  const state = await pool.query(
    `SELECT state FROM pg_stat_activity WHERE pid = $1`, [inTx]);
  console.log('what the transaction backend looks like meanwhile:', state.rows[0].state);
  await client.query('ROLLBACK');
  client.release();
}

// --- 5. BEGIN on the pool itself -------------------------------------------
line('5. pool.query("BEGIN") — the transaction that is not one');
{
  // 5a. sequential, on an idle pool: every call happens to reuse one connection
  await truncate();
  const pid = (t) => pool.query(`SELECT pg_backend_pid() pid, $1::text step`, [t])
    .then((r) => `${r.rows[0].step}=${r.rows[0].pid}`);
  await pool.query('BEGIN');
  const a = await pid('begin-then');
  await insertOrder(pool, 'poolbegin-1');
  const b = await pid('insert-then');
  await pool.query('ROLLBACK');
  console.log('sequential pids:', a, b);
  await counts('5a sequential:');
  console.log('↑ it appears to work — an idle pool hands back the same connection each time');

  // 5b. the same code with concurrent traffic, which is what production has
  await truncate();
  await pool.query('BEGIN');
  await Promise.all(
    Array.from({length: 8}, (_, i) => insertOrder(pool, `concurrent-${i}`)));
  await pool.query('ROLLBACK');
  await counts('5b with 8 concurrent inserts:');
  console.log('↑ ROLLBACK undid only whatever shared the ROLLBACK\'s connection');
}

// --- 6. a nested service call that is allowed to fail ----------------------
line('6. SAVEPOINT so one optional step can fail without losing the request');
{
  await truncate();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await insertOrder(client, 'sp-1');

    await client.query('SAVEPOINT optional_step');
    try {
      await insertItem(client, 'sp-1', 'sku-a');
      await client.query(`INSERT INTO t_items (order_ref, sku) VALUES ($1, NULL)`, ['sp-1']);
      await client.query('RELEASE SAVEPOINT optional_step');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT optional_step');
      console.log('optional step failed with', e.code, '— rolled back to the savepoint');
    }

    await client.query('COMMIT');
    console.log('outer transaction still committed');
  } finally {
    client.release();
  }
  await counts('after savepoint recovery:');
}

// --- 7. what happens if you skip ROLLBACK TO after an error ---------------
line('7. carrying on after an error without ROLLBACK TO');
{
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      await client.query(`SELECT 1/0`);
    } catch (e) {
      console.log('first error :', e.code, e.message);
    }
    try {
      await client.query(`SELECT 1`);
    } catch (e) {
      console.log('next query  :', e.code, e.message);
    }
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

// --- 8. holding the transaction open across a slow external call -----------
line('8. an await inside the transaction that is not a query');
{
  await truncate();
  const client = await pool.connect();
  await client.query('BEGIN');
  await insertOrder(client, 'slow-1');

  const slowExternalCall = () => new Promise((r) => setTimeout(r, 1200));
  const t0 = Date.now();
  await slowExternalCall();          // e.g. a payment provider

  const txPid = (await client.query(`SELECT pg_backend_pid() pid`)).rows[0].pid;
  const st = await pool.query(
    `SELECT state,
            round(extract(epoch FROM now() - xact_start) * 1000)::int AS open_ms
       FROM pg_stat_activity WHERE pid = $1`, [txPid]);
  console.log(`after ${Date.now() - t0} ms of waiting on the external call:`);
  console.log('  backend state :', st.rows[0].state);
  console.log('  xact open for :', st.rows[0].open_ms, 'ms');
  await client.query('COMMIT');
  client.release();
  console.log('↑ that connection was unusable by anyone else for the whole call');
}

await q(`DROP TABLE IF EXISTS t_items, t_orders CASCADE`);
await pool.end();
