// Phase 4 page 07 — UPDATE: join updates, duplicate sources, lost updates.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

const reset = async () => {
  await q(`DROP TABLE IF EXISTS u_items`);
  await q(`CREATE TABLE u_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku text NOT NULL UNIQUE, name text NOT NULL,
    qty int NOT NULL DEFAULT 0, price numeric(10,2))`);
  await q(`INSERT INTO u_items (sku,name,qty,price) VALUES
    ('a1','Widget',5,'10.00'), ('a2','Gadget',3,'20.00'), ('a3','Doohickey',0,'30.00')`);
};
await reset();

// --- 1. the missing WHERE --------------------------------------------------
line('1. UPDATE with no WHERE');
{
  const r = await q(`UPDATE u_items SET qty = 0`);
  console.log('UPDATE u_items SET qty = 0  → rowCount:', r.rowCount, '← every row, no warning');
  await reset();
}

// --- 2. UPDATE ... FROM, clean 1:1 source ----------------------------------
line('2. UPDATE ... FROM with a unique source');
{
  await q(`DROP TABLE IF EXISTS u_prices`);
  await q(`CREATE TABLE u_prices (sku text, new_price numeric(10,2))`);
  await q(`INSERT INTO u_prices VALUES ('a1','11.50'), ('a2','21.50')`);
  const r = await q(`UPDATE u_items i SET price = p.new_price
                     FROM u_prices p WHERE p.sku = i.sku
                     RETURNING i.sku, i.price`);
  console.table(r.rows);
  console.log('rowCount:', r.rowCount, '← a3 had no source row and was left alone');
}

// --- 3. duplicate source rows: silently arbitrary --------------------------
line('3. UPDATE ... FROM when the source has duplicates');
{
  await q(`DROP TABLE IF EXISTS u_dup`);
  await q(`CREATE TABLE u_dup (sku text, new_price numeric(10,2))`);
  await q(`INSERT INTO u_dup VALUES ('a1','100.00'), ('a1','200.00'), ('a1','300.00')`);
  const r = await q(`UPDATE u_items i SET price = d.new_price
                     FROM u_dup d WHERE d.sku = i.sku
                     RETURNING i.sku, i.price`);
  console.log('3 candidate values for one row →  rowCount:', r.rowCount, '| result:', r.rows);
  console.log('  ↑ no error: one source row wins arbitrarily, the others are discarded');

  // MERGE refuses the same input
  await q(`DROP TABLE IF EXISTS u_t`);
  await q(`CREATE TABLE u_t (id int PRIMARY KEY, v numeric(10,2))`);
  await q(`INSERT INTO u_t VALUES (1, 0)`);
  try {
    await q(`MERGE INTO u_t t USING (VALUES (1,100),(1,200)) AS s(id,v) ON t.id = s.id
             WHEN MATCHED THEN UPDATE SET v = s.v`);
  } catch (e) { console.log('the same input through MERGE →', e.code, e.message.split('\n')[0]); }
}

// --- 4. multi-column SET ---------------------------------------------------
line('4. setting several columns at once');
{
  const r = await q(`UPDATE u_items SET (name, qty) = ('Renamed', 42) WHERE sku = 'a3'
                     RETURNING sku, name, qty`);
  console.log('SET (a,b) = (...)      →', r.rows[0]);
  const s = await q(`UPDATE u_items i SET (name, qty) =
                       (SELECT upper(name), qty * 2 FROM u_items WHERE id = i.id)
                     WHERE sku = 'a1' RETURNING sku, name, qty`);
  console.log('SET (a,b) = (SELECT …) →', s.rows[0]);
}

// --- 5. the lost update ----------------------------------------------------
line('5. read-modify-write vs an in-place increment');
{
  await q(`UPDATE u_items SET qty = 0 WHERE sku='a1'`);
  const readModifyWrite = async () => {
    const {rows} = await q(`SELECT qty FROM u_items WHERE sku='a1'`);
    await new Promise(r => setTimeout(r, 5));            // the window
    await q(`UPDATE u_items SET qty = $1 WHERE sku='a1'`, [rows[0].qty + 1]);
  };
  await Promise.all(Array.from({length: 20}, readModifyWrite));
  console.log('20× SELECT-then-UPDATE →', (await q(`SELECT qty FROM u_items WHERE sku='a1'`)).rows[0].qty,
    '← expected 20');

  await q(`UPDATE u_items SET qty = 0 WHERE sku='a1'`);
  await Promise.all(Array.from({length: 20}, () =>
    q(`UPDATE u_items SET qty = qty + 1 WHERE sku='a1'`)));
  console.log('20× UPDATE SET qty = qty + 1 →', (await q(`SELECT qty FROM u_items WHERE sku='a1'`)).rows[0].qty,
    '← expected 20');
}

// --- 6. partial update without clobbering ----------------------------------
line('6. PATCH semantics: only the fields that were sent');
{
  const patch = async (sku, fields) => (await q(
    `UPDATE u_items SET name = COALESCE($2, name), qty = COALESCE($3, qty)
     WHERE sku = $1 RETURNING sku, name, qty`,
    [sku, fields.name ?? null, fields.qty ?? null])).rows[0];
  console.log('before      :', (await q(`SELECT sku,name,qty FROM u_items WHERE sku='a2'`)).rows[0]);
  console.log('patch {qty} :', await patch('a2', {qty: 99}));
  console.log('patch {name}:', await patch('a2', {name: 'Only the name'}));
  console.log('  ↑ COALESCE cannot express "set this column to NULL"');
}

await q(`DROP TABLE IF EXISTS u_items, u_prices, u_dup, u_t`);
await pool.end();
