// Phase 4 page 05 — RETURNING, including the PostgreSQL 18 OLD/NEW aliases.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

console.log('server:', (await q('SHOW server_version')).rows[0].server_version);

await q(`DROP TABLE IF EXISTS r_items`);
await q(`CREATE TABLE r_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku text NOT NULL UNIQUE,
  qty int NOT NULL DEFAULT 0,
  price numeric(10,2),
  updated_at timestamptz NOT NULL DEFAULT now())`);
await q(`INSERT INTO r_items (sku, qty, price) VALUES
  ('a1', 5, '10.00'), ('a2', 3, '20.00'), ('a3', 0, '30.00')`);

// --- 1. OLD and NEW in RETURNING (PostgreSQL 18) ---------------------------
line('1. RETURNING old.* / new.* — new in PostgreSQL 18');
{
  try {
    const r = await q(`UPDATE r_items SET qty = qty + 10 WHERE sku = 'a1'
                       RETURNING old.qty AS was, new.qty AS now, new.qty - old.qty AS delta`);
    console.log('UPDATE ... RETURNING old/new →', r.rows[0]);
  } catch (e) { console.log('old/new →', e.code, e.message.split('\n')[0]); }

  // the pre-18 way of getting the previous value
  const legacy = await q(`UPDATE r_items i SET qty = i.qty + 10
                          FROM r_items o WHERE o.id = i.id AND i.sku = 'a2'
                          RETURNING o.qty AS was, i.qty AS now`);
  console.log('pre-18 self-join equivalent  →', legacy.rows[0]);
}

// --- 2. what each statement returns ----------------------------------------
line('2. INSERT / UPDATE / DELETE return which version of the row');
{
  const i = await q(`INSERT INTO r_items (sku, qty) VALUES ('b1', 1) RETURNING id, sku, qty, updated_at`);
  console.log('INSERT → the new row     :', i.rows[0]);
  const u = await q(`UPDATE r_items SET qty = 99 WHERE sku='b1' RETURNING id, qty`);
  console.log('UPDATE → the updated row :', u.rows[0]);
  const d = await q(`DELETE FROM r_items WHERE sku='b1' RETURNING id, sku, qty`);
  console.log('DELETE → the removed row :', d.rows[0]);
}

// --- 3. no match --------------------------------------------------------
line('3. when nothing matched');
{
  const r = await q(`UPDATE r_items SET qty = 1 WHERE sku = 'nope' RETURNING id`);
  console.log('rowCount:', r.rowCount, '| rows:', r.rows, '| command:', r.command);
}

// --- 4. ON CONFLICT DO NOTHING silently returns nothing --------------------
line('4. the ON CONFLICT DO NOTHING trap');
{
  const first = await q(`INSERT INTO r_items (sku, qty) VALUES ('c1', 1)
                         ON CONFLICT (sku) DO NOTHING RETURNING id`);
  console.log('first insert  → rowCount:', first.rowCount, 'rows:', first.rows);
  const again = await q(`INSERT INTO r_items (sku, qty) VALUES ('c1', 1)
                         ON CONFLICT (sku) DO NOTHING RETURNING id`);
  console.log('same row again→ rowCount:', again.rowCount, 'rows:', again.rows,
    '← the row exists, but you get no id');
  const fixed = await q(`INSERT INTO r_items (sku, qty) VALUES ('c1', 1)
                         ON CONFLICT (sku) DO UPDATE SET sku = EXCLUDED.sku
                         RETURNING id, (xmax = 0) AS was_insert`);
  console.log('DO UPDATE instead →', fixed.rows[0], '← always returns a row');
}

// --- 5. expressions and RETURNING * ----------------------------------------
line('5. expressions in RETURNING');
{
  const r = await q(`UPDATE r_items SET price = price * 1.1 WHERE sku = 'a3'
                     RETURNING id, price, round(price)::int AS rounded,
                               'sku:' || sku AS label`);
  console.log(r.rows[0]);
  const star = await q(`INSERT INTO r_items (sku, qty) VALUES ('d1', 7) RETURNING *`);
  console.log('RETURNING * →', Object.keys(star.rows[0]).join(', '));
}

// --- 6. multi-row RETURNING preserves nothing about order ------------------
line('6. RETURNING over many rows');
{
  const r = await q(`UPDATE r_items SET qty = qty + 1 WHERE qty < 100 RETURNING id, sku, qty`);
  console.log('rowCount:', r.rowCount);
  console.table(r.rows);
}

// --- 7. RETURNING inside a CTE ---------------------------------------------
line('7. RETURNING feeding another statement (CTE)');
{
  await q(`DROP TABLE IF EXISTS r_audit`);
  await q(`CREATE TABLE r_audit (item_id bigint, sku text, at timestamptz DEFAULT now())`);
  const r = await q(`
    WITH removed AS (
      DELETE FROM r_items WHERE sku = 'd1' RETURNING id, sku
    )
    INSERT INTO r_audit (item_id, sku) SELECT id, sku FROM removed RETURNING item_id, sku`);
  console.log('deleted and audited in one statement →', r.rows[0]);
}

await q(`DROP TABLE IF EXISTS r_items, r_audit`);
await pool.end();
