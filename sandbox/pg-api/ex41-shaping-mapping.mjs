// Phase 9 pages 15, 17, 18 — building the response shape in SQL vs in JS,
// created_at/updated_at by trigger vs by hand, and snake_case → camelCase.
import pg from 'pg';

const URL = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: URL, max: 10});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const timed = async (n, fn) => {
  const ts = [];
  for (let i = 0; i < n; i++) {
    const t0 = process.hrtime.bigint();
    await fn();
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ts.sort((a, b) => a - b);
  return ts[Math.floor(ts.length / 2)];
};

const ORDERS = 5000, PER = 5;
await q(`DROP TABLE IF EXISTS s_items, s_orders CASCADE`);
await q(`CREATE TABLE s_orders (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_name text NOT NULL,
  order_total   numeric(10,2) NOT NULL,
  placed_at     timestamptz NOT NULL DEFAULT now())`);
await q(`CREATE TABLE s_items (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id  bigint NOT NULL REFERENCES s_orders(id),
  sku       text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  qty        int NOT NULL)`);
await q(`INSERT INTO s_orders (customer_name, order_total)
         SELECT 'customer ' || g, (g % 900 + 10)::numeric
           FROM generate_series(1,$1) g`, [ORDERS]);
await q(`INSERT INTO s_items (order_id, sku, unit_price, qty)
         SELECT o.id, 'sku-' || i, (i * 3 + 1)::numeric, i
           FROM s_orders o, generate_series(1,$1) i`, [PER]);
await q(`CREATE INDEX s_items_order_id_idx ON s_items(order_id)`);
await q(`ANALYZE s_orders, s_items`);
console.log(`seeded ${ORDERS} orders x ${PER} items = ${ORDERS * PER} item rows`);

// ===========================================================================
// 15 · SHAPE IN SQL vs IN JS
// ===========================================================================

// --- 1. the four ways to build {order, items[]} ---------------------------
line('1. the same nested payload, four ways');
{
  // (a) one query, shaped entirely in SQL
  const inSql = async () => (await q(
    `SELECT o.id, o.customer_name, o.order_total,
            coalesce(jsonb_agg(jsonb_build_object(
              'sku', i.sku, 'qty', i.qty, 'unitPrice', i.unit_price)
              ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items
       FROM s_orders o LEFT JOIN s_items i ON i.order_id = o.id
      GROUP BY o.id`)).rows;

  // (b) one flat join, grouped in JS
  const flatJoin = async () => {
    const {rows} = await q(
      `SELECT o.id, o.customer_name, o.order_total,
              i.sku, i.qty, i.unit_price
         FROM s_orders o LEFT JOIN s_items i ON i.order_id = o.id
        ORDER BY o.id, i.id`);
    const out = new Map();
    for (const r of rows) {
      let o = out.get(r.id);
      if (!o) out.set(r.id, o = {
        id: r.id, customer_name: r.customer_name, order_total: r.order_total, items: []});
      if (r.sku !== null) o.items.push({sku: r.sku, qty: r.qty, unitPrice: r.unit_price});
    }
    return [...out.values()];
  };

  // (c) two queries, joined in JS
  const twoQueries = async () => {
    const orders = (await q(
      `SELECT id, customer_name, order_total FROM s_orders`)).rows;
    const items = (await q(
      `SELECT order_id, sku, qty, unit_price FROM s_items
        WHERE order_id = ANY($1) ORDER BY id`, [orders.map((o) => o.id)])).rows;
    const byOrder = new Map(orders.map((o) => [o.id, {...o, items: []}]));
    for (const i of items) byOrder.get(i.order_id).items.push(
      {sku: i.sku, qty: i.qty, unitPrice: i.unit_price});
    return [...byOrder.values()];
  };

  // (d) N+1 — one query per order
  const nPlusOne = async () => {
    const orders = (await q(
      `SELECT id, customer_name, order_total FROM s_orders LIMIT 500`)).rows;
    for (const o of orders) {
      o.items = (await q(
        `SELECT sku, qty, unit_price FROM s_items WHERE order_id = $1`, [o.id])).rows;
    }
    return orders;
  };

  // variants, to find out WHERE the SQL-shaping time actually goes
  const inSqlNoOrder = async () => (await q(
    `SELECT o.id, o.customer_name, o.order_total,
            coalesce(jsonb_agg(jsonb_build_object(
              'sku', i.sku, 'qty', i.qty, 'unitPrice', i.unit_price))
              FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items
       FROM s_orders o LEFT JOIN s_items i ON i.order_id = o.id
      GROUP BY o.id`)).rows;
  const inSqlJson = async () => (await q(
    `SELECT o.id, o.customer_name, o.order_total,
            coalesce(json_agg(json_build_object(
              'sku', i.sku, 'qty', i.qty, 'unitPrice', i.unit_price))
              FILTER (WHERE i.id IS NOT NULL), '[]'::json) AS items
       FROM s_orders o LEFT JOIN s_items i ON i.order_id = o.id
      GROUP BY o.id`)).rows;

  const a = await inSql(), b = await flatJoin(), c = await twoQueries();
  console.log('row counts back from the driver:');
  console.log(`  (a) jsonb_agg in SQL  : ${a.length} rows`);
  console.log(`  (b) flat join         : ${ORDERS * PER} rows → ${b.length} objects`);
  console.log(`  (c) two queries       : ${ORDERS} + ${ORDERS * PER} rows → ${c.length} objects`);

  console.log('\nsame data, but not the same types:');
  console.log('  (a) items[0]:', JSON.stringify(a[0].items[0]));
  console.log('  (b) items[0]:', JSON.stringify(b[0].items[0]));
  console.log('  ↑ unitPrice is a JSON number through jsonb, a string as a column');

  console.log('\nmedian of 5 runs:');
  console.log(`  (a) jsonb_agg in SQL       ${(await timed(5, inSql)).toFixed(1).padStart(8)} ms`);
  console.log(`  (a2) same, no ORDER BY     ${(await timed(5, inSqlNoOrder)).toFixed(1).padStart(8)} ms`);
  console.log(`  (a3) json_agg not jsonb    ${(await timed(5, inSqlJson)).toFixed(1).padStart(8)} ms`);
  console.log(`  (b) flat join + JS         ${(await timed(5, flatJoin)).toFixed(1).padStart(8)} ms`);
  console.log(`  (c) two queries + JS       ${(await timed(5, twoQueries)).toFixed(1).padStart(8)} ms`);
  const n1 = await timed(3, nPlusOne);
  console.log(`  (d) N+1, 500 orders        ${n1.toFixed(1).padStart(8)} ms  (${(n1 / 500 * ORDERS).toFixed(0)} ms extrapolated to ${ORDERS})`);

  // is the cost server-side or transfer? ask the server what it spent.
  console.log('\nserver-side time only (EXPLAIN ANALYZE execution time):');
  for (const [label, text] of [
    ['(a) jsonb_agg', `SELECT o.id, coalesce(jsonb_agg(jsonb_build_object(
        'sku', i.sku, 'qty', i.qty, 'unitPrice', i.unit_price) ORDER BY i.id)
        FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb)
      FROM s_orders o LEFT JOIN s_items i ON i.order_id = o.id GROUP BY o.id`],
    ['(b) flat join', `SELECT o.id, i.sku, i.qty, i.unit_price
      FROM s_orders o LEFT JOIN s_items i ON i.order_id = o.id ORDER BY o.id, i.id`],
  ]) {
    const r = await q(`EXPLAIN (ANALYZE, TIMING OFF, COSTS OFF) ${text}`);
    const exec = r.rows.map((x) => x['QUERY PLAN'])
      .find((l) => l.startsWith('Execution Time'));
    console.log(`  ${label.padEnd(16)} ${exec}`);
  }

  // and how many bytes each shape puts on the wire
  const bytes = async (text, params = []) => (await q(
    `SELECT sum(pg_column_size(t.*))::bigint AS b FROM (${text}) t`, params)).rows[0].b;
  console.log('\napproximate payload size:');
  console.log('  (a) jsonb rows :', await bytes(
    `SELECT o.id, coalesce(jsonb_agg(jsonb_build_object(
       'sku', i.sku, 'qty', i.qty, 'unitPrice', i.unit_price))
       FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items
     FROM s_orders o LEFT JOIN s_items i ON i.order_id = o.id GROUP BY o.id`), 'bytes');
  console.log('  (b) flat rows  :', await bytes(
    `SELECT o.id, i.sku, i.qty, i.unit_price
     FROM s_orders o LEFT JOIN s_items i ON i.order_id = o.id`), 'bytes');
}

// --- 2. the empty-children trap -------------------------------------------
line('2. jsonb_agg over a LEFT JOIN with no children');
{
  await q(`INSERT INTO s_orders (customer_name, order_total) VALUES ('no items', 0)`);
  const naive = await q(
    `SELECT o.id, jsonb_agg(jsonb_build_object('sku', i.sku)) AS items
       FROM s_orders o LEFT JOIN s_items i ON i.order_id = o.id
      WHERE o.customer_name = 'no items' GROUP BY o.id`);
  const fixed = await q(
    `SELECT o.id, coalesce(jsonb_agg(jsonb_build_object('sku', i.sku))
              FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items
       FROM s_orders o LEFT JOIN s_items i ON i.order_id = o.id
      WHERE o.customer_name = 'no items' GROUP BY o.id`);
  console.log('plain jsonb_agg      :', JSON.stringify(naive.rows[0].items));
  console.log('with FILTER+coalesce :', JSON.stringify(fixed.rows[0].items));
  console.log('↑ the first one serialises to a one-element array containing null');
  await q(`DELETE FROM s_orders WHERE customer_name = 'no items'`);
}

// --- 3. what the driver hands back for each shape -------------------------
line('3. types coming back from jsonb vs from columns');
{
  const j = (await q(
    `SELECT jsonb_build_object('total', o.order_total, 'placed', o.placed_at) AS payload
       FROM s_orders o WHERE o.id = 1`)).rows[0].payload;
  const c = (await q(
    `SELECT order_total, placed_at FROM s_orders WHERE id = 1`)).rows[0];
  console.log('through jsonb :', j, '→', typeof j.total, '/', typeof j.placed);
  console.log('as columns    :', c, '→', typeof c.order_total, '/', c.placed_at.constructor.name);
  console.log('↑ jsonb flattens numeric to a JSON number and timestamptz to a string;');
  console.log('  as columns, numeric stays a string and timestamptz becomes a Date');
}

// ===========================================================================
// 17 · created_at / updated_at
// ===========================================================================

line('4. trigger vs application code for updated_at');
{
  await q(`DROP TABLE IF EXISTS s_trig, s_app CASCADE`);
  for (const t of ['s_trig', 's_app']) {
    await q(`CREATE TABLE ${t} (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await q(`INSERT INTO ${t} (name) SELECT 'r' || g FROM generate_series(1,20000) g`);
  }
  await q(`CREATE OR REPLACE FUNCTION s_touch() RETURNS trigger AS $$
           BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql`);
  await q(`CREATE TRIGGER s_trig_touch BEFORE UPDATE ON s_trig
           FOR EACH ROW EXECUTE FUNCTION s_touch()`);

  // the path the ORM knows about
  const before = (await q(`SELECT updated_at FROM s_trig WHERE id=1`)).rows[0].updated_at;
  await q(`UPDATE s_trig SET name = 'via app' WHERE id = 1`);
  const after = (await q(`SELECT updated_at FROM s_trig WHERE id=1`)).rows[0].updated_at;
  console.log('trigger table, UPDATE that never mentions updated_at:');
  console.log('  changed?', before.getTime() !== after.getTime());

  const beforeA = (await q(`SELECT updated_at FROM s_app WHERE id=1`)).rows[0].updated_at;
  await q(`UPDATE s_app SET name = 'via app' WHERE id = 1`);   // e.g. a psql fix-up
  const afterA = (await q(`SELECT updated_at FROM s_app WHERE id=1`)).rows[0].updated_at;
  console.log('app-managed table, the same UPDATE:');
  console.log('  changed?', beforeA.getTime() !== afterA.getTime(), '← the stamp is now a lie');

  console.log('\ncost of the trigger, 20 000 single-row UPDATEs:');
  const ms1 = await timed(3, () => q(
    `UPDATE s_trig SET name = name || 'x' WHERE id <= 20000`));
  const ms2 = await timed(3, () => q(
    `UPDATE s_app SET name = name || 'x', updated_at = now() WHERE id <= 20000`));
  console.log(`  BEFORE UPDATE trigger  ${ms1.toFixed(1).padStart(8)} ms`);
  console.log(`  SET updated_at = now() ${ms2.toFixed(1).padStart(8)} ms`);
  console.log(`  trigger overhead: ${(ms1 / ms2).toFixed(2)}x`);
}

line('5. now() is the transaction timestamp, not the statement timestamp');
{
  const c = await pool.connect();
  await c.query('BEGIN');
  const a = (await c.query(`SELECT now() AS n, clock_timestamp() AS ct`)).rows[0];
  await new Promise((r) => setTimeout(r, 300));
  const b = (await c.query(`SELECT now() AS n, clock_timestamp() AS ct`)).rows[0];
  await c.query('COMMIT');
  c.release();
  console.log('now()            same across the transaction?', a.n.getTime() === b.n.getTime());
  console.log('clock_timestamp() same?', a.ct.getTime() === b.ct.getTime(),
    `(moved ${b.ct.getTime() - a.ct.getTime()} ms)`);
  console.log('↑ every row written in one transaction shares an updated_at — usually what you want');
}

// ===========================================================================
// 18 · snake_case → camelCase
// ===========================================================================

line('6. the three places the rename can happen');
{
  const N = 20000;
  // (a) aliased in SQL
  const inSql = async () => (await q(
    `SELECT id, customer_name AS "customerName", order_total AS "orderTotal",
            placed_at AS "placedAt"
       FROM s_orders LIMIT $1`, [N])).rows;
  // (b) mapped in JS, per row, explicitly
  const explicitMap = async () => {
    const {rows} = await q(
      `SELECT id, customer_name, order_total, placed_at FROM s_orders LIMIT $1`, [N]);
    return rows.map((r) => ({
      id: r.id, customerName: r.customer_name,
      orderTotal: r.order_total, placedAt: r.placed_at}));
  };
  // (c) mapped in JS, generically, by rewriting every key
  const genericMap = async () => {
    const {rows} = await q(
      `SELECT id, customer_name, order_total, placed_at FROM s_orders LIMIT $1`, [N]);
    const camel = (s) => s.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
    return rows.map((r) => Object.fromEntries(
      Object.entries(r).map(([k, v]) => [camel(k), v])));
  };

  const a = await inSql(), b = await explicitMap(), c = await genericMap();
  console.log('sample (a):', a[0]);
  console.log('sample (c):', c[0]);
  console.log('all three identical?',
    JSON.stringify(a[0]) === JSON.stringify(b[0]) &&
    JSON.stringify(b[0]) === JSON.stringify(c[0]));
  console.log(`\nmedian of 5 runs over ${N} rows:`);
  console.log(`  (a) alias in SQL     ${(await timed(5, inSql)).toFixed(1).padStart(8)} ms`);
  console.log(`  (b) explicit JS map  ${(await timed(5, explicitMap)).toFixed(1).padStart(8)} ms`);
  console.log(`  (c) generic JS map   ${(await timed(5, genericMap)).toFixed(1).padStart(8)} ms`);
}

line('7. what a quoted alias costs you afterwards');
{
  try {
    await q(`SELECT customer_name AS "customerName" FROM s_orders
              WHERE customerName = 'customer 1' LIMIT 1`);
  } catch (e) {
    console.log('unquoted reference to the alias →', e.code, e.message);
  }
  try {
    await q(`SELECT customer_name AS "customerName" FROM s_orders
              ORDER BY customerName LIMIT 1`);
  } catch (e) {
    console.log('ORDER BY the unquoted alias    →', e.code, e.message);
  }
  const ok = await q(`SELECT customer_name AS "customerName" FROM s_orders
                       ORDER BY "customerName" LIMIT 1`);
  console.log('ORDER BY "customerName"        → ok:', ok.rows[0]);
}

await q(`DROP TABLE IF EXISTS s_items, s_orders, s_trig, s_app CASCADE`);
await q(`DROP FUNCTION IF EXISTS s_touch()`);
await pool.end();
