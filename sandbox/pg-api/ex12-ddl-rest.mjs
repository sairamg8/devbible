// Phase 3 / 03, 06, 10, 13, 15, 17, 19 — FK actions, drop/cascade, search_path,
// generated columns, COMMENT ON, inheritance vs partitioning.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

// --- 1. every ON DELETE action --------------------------------------------
line('1. ON DELETE actions');
{
  for (const action of ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT']) {
    await q(`DROP TABLE IF EXISTS fk_child, fk_parent CASCADE`);
    await q(`CREATE TABLE fk_parent (id int PRIMARY KEY)`);
    const def = action === 'SET DEFAULT' ? 'DEFAULT 0' : '';
    await q(`CREATE TABLE fk_child (
      id int PRIMARY KEY,
      parent_id int ${def} REFERENCES fk_parent(id) ON DELETE ${action})`);
    await q(`INSERT INTO fk_parent (id) VALUES (0), (1)`);
    await q(`INSERT INTO fk_child (id, parent_id) VALUES (10, 1)`);
    let result;
    try {
      await q(`DELETE FROM fk_parent WHERE id = 1`);
      const {rows} = await q(`SELECT id, parent_id FROM fk_child`);
      result = rows.length === 0 ? 'child row deleted' : `child.parent_id = ${rows[0].parent_id}`;
    } catch (e) { result = `${e.code} ${e.message.split('\n')[0]}`; }
    console.log(`ON DELETE ${action.padEnd(12)} → ${result}`);
  }
}

// --- 2. deferred RESTRICT vs NO ACTION ------------------------------------
line('2. RESTRICT vs NO ACTION — the difference only shows when deferred');
{
  for (const action of ['NO ACTION', 'RESTRICT']) {
    await q(`DROP TABLE IF EXISTS d_child, d_parent CASCADE`);
    await q(`CREATE TABLE d_parent (id int PRIMARY KEY)`);
    await q(`CREATE TABLE d_child (id int PRIMARY KEY, p int
             REFERENCES d_parent(id) ON DELETE ${action} DEFERRABLE INITIALLY DEFERRED)`);
    await q(`INSERT INTO d_parent (id) VALUES (1); INSERT INTO d_child VALUES (1,1);`);
    const c = await pool.connect();
    let out;
    try {
      await c.query('BEGIN');
      await c.query(`DELETE FROM d_parent WHERE id=1`);
      await c.query(`DELETE FROM d_child WHERE id=1`);   // fix it before commit
      await c.query('COMMIT');
      out = 'allowed — checked at COMMIT';
    } catch (e) { await c.query('ROLLBACK'); out = `${e.code} ${e.message.split('\n')[0]}`; }
    c.release();
    console.log(`${action.padEnd(10)} deferred → ${out}`);
  }
}

// --- 3. FK without an index on the referencing column ---------------------
line('3. deleting a parent when the child FK column is unindexed');
{
  await q(`DROP TABLE IF EXISTS ix_child, ix_parent CASCADE`);
  await q(`CREATE TABLE ix_parent (id int PRIMARY KEY)`);
  await q(`CREATE TABLE ix_child (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
           parent_id int REFERENCES ix_parent(id) ON DELETE CASCADE)`);
  await q(`INSERT INTO ix_parent SELECT g FROM generate_series(1,1000) g`);
  await q(`INSERT INTO ix_child (parent_id) SELECT (g%1000)+1 FROM generate_series(1,300000) g`);
  await q(`ANALYZE ix_parent; ANALYZE ix_child;`);

  let t0 = performance.now();
  await q(`DELETE FROM ix_parent WHERE id = 500`);
  const noIdx = performance.now() - t0;

  await q(`CREATE INDEX ix_child_parent_idx ON ix_child (parent_id)`);
  await q(`ANALYZE ix_child`);
  t0 = performance.now();
  await q(`DELETE FROM ix_parent WHERE id = 501`);
  const withIdx = performance.now() - t0;
  console.log(`DELETE parent, child FK unindexed: ${noIdx.toFixed(1)} ms`);
  console.log(`DELETE parent, child FK indexed:   ${withIdx.toFixed(1)} ms  (${(noIdx/withIdx).toFixed(0)}× faster)`);
}

// --- 4. DROP ... CASCADE / RESTRICT ---------------------------------------
line('4. DROP TABLE with dependents');
{
  await q(`DROP TABLE IF EXISTS dc_child, dc_parent CASCADE`);
  await q(`CREATE TABLE dc_parent (id int PRIMARY KEY)`);
  await q(`CREATE TABLE dc_child (id int, p int REFERENCES dc_parent(id))`);
  await q(`CREATE VIEW dc_view AS SELECT * FROM dc_parent`);
  try { await q(`DROP TABLE dc_parent`); }
  catch (e) { console.log('plain DROP  →', e.code, e.message.split('\n')[0]); }
  const r = await q(`DROP TABLE dc_parent CASCADE`);
  console.log('DROP CASCADE → succeeded; view still there?',
    (await q(`SELECT to_regclass('dc_view') v`)).rows[0].v ?? 'GONE');
  console.log('child table still there?',
    (await q(`SELECT to_regclass('dc_child') v`)).rows[0].v ?? 'GONE',
    '← CASCADE drops the constraint, not the child table');
  await q(`DROP TABLE IF EXISTS dc_child CASCADE`);
}

// --- 5. schemas and search_path -------------------------------------------
line('5. schemas as namespaces');
{
  await q(`DROP SCHEMA IF EXISTS tenant_a, tenant_b CASCADE`);
  await q(`CREATE SCHEMA tenant_a; CREATE SCHEMA tenant_b;`);
  await q(`CREATE TABLE tenant_a.items (id int, name text)`);
  await q(`CREATE TABLE tenant_b.items (id int, name text)`);
  await q(`INSERT INTO tenant_a.items VALUES (1,'from A')`);
  await q(`INSERT INTO tenant_b.items VALUES (1,'from B')`);
  const c = await pool.connect();
  for (const sp of ['tenant_a', 'tenant_b']) {
    await c.query(`SET search_path TO ${sp}`);
    const {rows} = await c.query(`SELECT name FROM items`);
    console.log(`search_path=${sp.padEnd(9)} → SELECT FROM items gives "${rows[0].name}"`);
  }
  await c.query(`SHOW search_path`).then((r) => console.log('current search_path:', r.rows[0].search_path));
  await c.query(`RESET search_path`);
  c.release();
  console.log('default search_path:', (await q(`SHOW search_path`)).rows[0].search_path);
}

// --- 6. generated columns -------------------------------------------------
line('6. generated columns');
{
  await q(`DROP TABLE IF EXISTS gen_t`);
  await q(`CREATE TABLE gen_t (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name text NOT NULL, last_name text NOT NULL,
    full_name text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    price numeric(12,2) NOT NULL, qty int NOT NULL,
    total numeric(14,2) GENERATED ALWAYS AS (price * qty) STORED)`);
  await q(`INSERT INTO gen_t (first_name,last_name,price,qty) VALUES ('Ada','Lovelace','9.99',3)`);
  console.table((await q(`SELECT full_name, total FROM gen_t`)).rows);
  try { await q(`INSERT INTO gen_t (first_name,last_name,price,qty,full_name) VALUES ('A','B','1',1,'X')`); }
  catch (e) { console.log('writing to a generated column →', e.code, e.message.split('\n')[0]); }
  try { await q(`CREATE TABLE gen_bad (a int, b int GENERATED ALWAYS AS (a * random()) STORED)`); }
  catch (e) { console.log('volatile expression →', e.code, e.message.split('\n')[0]); }
  const {rows} = await q(`SELECT is_generated, generation_expression FROM information_schema.columns
                          WHERE table_name='gen_t' AND column_name='total'`);
  console.log('catalog:', rows[0]);
}

// --- 7. COMMENT ON --------------------------------------------------------
line('7. COMMENT ON');
{
  await q(`COMMENT ON TABLE gen_t IS 'demo of generated columns'`);
  await q(`COMMENT ON COLUMN gen_t.total IS 'price * qty, maintained by the database'`);
  const {rows} = await q(`
    SELECT c.relname AS obj, obj_description(c.oid) AS table_comment,
           a.attname AS col, col_description(c.oid, a.attnum) AS column_comment
      FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
     WHERE c.relname='gen_t' AND a.attname='total'`);
  console.table(rows);
}

// --- 8. inheritance vs partitioning ---------------------------------------
line('8. table inheritance vs declarative partitioning');
{
  await q(`DROP TABLE IF EXISTS inh_child, inh_parent, part_t CASCADE`);
  await q(`CREATE TABLE inh_parent (id int PRIMARY KEY, region text)`);
  await q(`CREATE TABLE inh_child (CHECK (region='eu')) INHERITS (inh_parent)`);
  await q(`INSERT INTO inh_child VALUES (1,'eu')`);
  await q(`INSERT INTO inh_child VALUES (1,'eu')`);   // parent PK does NOT apply to child
  console.log('inheritance: duplicate id in child accepted →',
    (await q(`SELECT count(*)::int n FROM inh_child`)).rows[0].n, 'rows — parent PK is not inherited');
  console.log('SELECT from parent sees children:',
    (await q(`SELECT count(*)::int n FROM inh_parent`)).rows[0].n, 'rows');

  await q(`CREATE TABLE part_t (id int, region text, PRIMARY KEY (id, region)) PARTITION BY LIST (region)`);
  await q(`CREATE TABLE part_eu PARTITION OF part_t FOR VALUES IN ('eu')`);
  await q(`INSERT INTO part_t VALUES (1,'eu')`);
  try { await q(`INSERT INTO part_t VALUES (1,'eu')`); }
  catch (e) { console.log('partitioning: duplicate →', e.code, '— the key IS enforced'); }
  try { await q(`INSERT INTO part_t VALUES (2,'us')`); }
  catch (e) { console.log('no matching partition →', e.code, e.message.split('\n')[0]); }
}

await q(`DROP TABLE IF EXISTS gen_t, inh_child, inh_parent, part_t, ix_child, ix_parent, fk_child, fk_parent, d_child, d_parent CASCADE`);
await q(`DROP SCHEMA IF EXISTS tenant_a, tenant_b CASCADE`);
await pool.end();
