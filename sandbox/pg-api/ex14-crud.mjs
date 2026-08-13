// Phase 4 — CRUD and DML. Every claim on the phase-4 pages comes from here.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const show = async (sql, p) => console.table((await q(sql, p)).rows);

await q(`DROP TABLE IF EXISTS c_items CASCADE`);
await q(`CREATE TABLE c_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  qty int,
  price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now())`);
await q(`INSERT INTO c_items (sku,name,qty,price) VALUES
  ('a1','Widget',5,'10.00'), ('a2','Gadget',NULL,'20.00'),
  ('a3','doohickey',3,NULL), ('a4','Widget Pro',0,'30.00')`);

// --- 1. IS DISTINCT FROM vs != --------------------------------------------
line('1. NULL comparison: != vs IS DISTINCT FROM');
{
  const a = await q(`SELECT count(*)::int n FROM c_items WHERE qty != 5`);
  const b = await q(`SELECT count(*)::int n FROM c_items WHERE qty IS DISTINCT FROM 5`);
  console.log(`WHERE qty != 5             → ${a.rows[0].n} rows`);
  console.log(`WHERE qty IS DISTINCT FROM 5 → ${b.rows[0].n} rows  ← includes the NULL row`);
  const eq = await q(`SELECT (NULL = NULL) AS eq, (NULL IS NOT DISTINCT FROM NULL) AS idf`);
  console.log('NULL = NULL →', eq.rows[0].eq, '| NULL IS NOT DISTINCT FROM NULL →', eq.rows[0].idf);
}

// --- 2. LIKE / ILIKE / regex ----------------------------------------------
line('2. pattern matching');
{
  const t = async (label, sql) => console.log(label.padEnd(34),
    (await q(sql)).rows.map(r => r.name).join(', ') || '(none)');
  await t(`LIKE 'W%'`,        `SELECT name FROM c_items WHERE name LIKE 'W%' ORDER BY id`);
  await t(`ILIKE 'w%'`,       `SELECT name FROM c_items WHERE name ILIKE 'w%' ORDER BY id`);
  await t(`~ '^[Ww]idget'`,   `SELECT name FROM c_items WHERE name ~ '^[Ww]idget' ORDER BY id`);
  await t(`~* 'widget'`,      `SELECT name FROM c_items WHERE name ~* 'widget' ORDER BY id`);
  await t(`IN ('a1','a3')`,   `SELECT name FROM c_items WHERE sku IN ('a1','a3') ORDER BY id`);
  await t(`NOT IN (a1, NULL)`,`SELECT name FROM c_items WHERE sku NOT IN ('a1', NULL) ORDER BY id`);
  console.log('  ↑ NOT IN with a NULL in the list returns NOTHING');
  await t(`BETWEEN 3 AND 5`,  `SELECT name FROM c_items WHERE qty BETWEEN 3 AND 5 ORDER BY id`);
}

// --- 3. RETURNING on every DML --------------------------------------------
line('3. RETURNING');
{
  const ins = await q(`INSERT INTO c_items (sku,name,qty,price) VALUES ('b1','New',1,'5.00')
                       RETURNING id, sku, created_at`);
  console.log('INSERT   →', ins.rows[0]);
  const upd = await q(`UPDATE c_items SET qty = qty + 1 WHERE sku='b1' RETURNING id, qty`);
  console.log('UPDATE   →', upd.rows[0]);
  const del = await q(`DELETE FROM c_items WHERE sku='b1' RETURNING id, sku`);
  console.log('DELETE   →', del.rows[0]);
  const none = await q(`UPDATE c_items SET qty=1 WHERE sku='nope' RETURNING id`);
  console.log('no match →  rowCount:', none.rowCount, 'rows:', none.rows);
}

// --- 4. ON CONFLICT -------------------------------------------------------
line('4. INSERT ... ON CONFLICT');
{
  const up = async (sku, name) => {
    const r = await q(
      `INSERT INTO c_items (sku,name,qty,price) VALUES ($1,$2,1,'1.00')
       ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, sku, name, (xmax = 0) AS was_insert`, [sku, name]);
    return r.rows[0];
  };
  console.log('new row   →', await up('c9','Fresh'));
  console.log('conflict  →', await up('c9','Updated'));
  console.log('  ↑ xmax = 0 distinguishes an insert from an update');
  const dn = await q(`INSERT INTO c_items (sku,name) VALUES ('c9','Ignored')
                      ON CONFLICT (sku) DO NOTHING RETURNING id`);
  console.log('DO NOTHING on conflict → rowCount:', dn.rowCount, '(RETURNING gives nothing)');
  try {
    await q(`INSERT INTO c_items (sku,name) VALUES ('c9','x') ON CONFLICT (name) DO NOTHING`);
  } catch (e) { console.log('conflict target with no unique index →', e.code, e.message.split('\n')[0]); }
  await q(`DELETE FROM c_items WHERE sku='c9'`);
}

// --- 5. UPDATE ... FROM ---------------------------------------------------
line('5. UPDATE ... FROM (join update)');
{
  await q(`DROP TABLE IF EXISTS c_price_updates`);
  await q(`CREATE TABLE c_price_updates (sku text, new_price numeric(10,2))`);
  await q(`INSERT INTO c_price_updates VALUES ('a1','11.50'), ('a2','21.50')`);
  const r = await q(`UPDATE c_items i SET price = u.new_price
                     FROM c_price_updates u WHERE u.sku = i.sku
                     RETURNING i.sku, i.price`);
  console.table(r.rows);
  console.log('rowCount:', r.rowCount);
}

// --- 6. logical processing order ------------------------------------------
line('6. logical query processing order');
{
  try { await q(`SELECT price * qty AS total FROM c_items WHERE total > 10`); }
  catch (e) { console.log('alias in WHERE  →', e.code, e.message.split('\n')[0]); }
  const ok = await q(`SELECT price * qty AS total FROM c_items WHERE price * qty > 10 ORDER BY total DESC NULLS LAST LIMIT 2`);
  console.log('alias in ORDER BY works →', ok.rows.map(r=>r.total).join(', '));
}

// --- 7. DISTINCT ON -------------------------------------------------------
line('7. DISTINCT ON');
{
  await q(`DROP TABLE IF EXISTS c_events`);
  await q(`CREATE TABLE c_events (user_id int, at timestamptz, kind text)`);
  await q(`INSERT INTO c_events VALUES
    (1,'2026-01-01','login'),(1,'2026-01-03','logout'),(1,'2026-01-02','click'),
    (2,'2026-01-05','login'),(2,'2026-01-04','click')`);
  console.log('latest event per user:');
  await show(`SELECT DISTINCT ON (user_id) user_id, at, kind
              FROM c_events ORDER BY user_id, at DESC`);
  try { await q(`SELECT DISTINCT ON (user_id) * FROM c_events ORDER BY at`); }
  catch (e) { console.log('ORDER BY not matching DISTINCT ON →', e.code, e.message.split('\n')[0]); }
}

// --- 8. MERGE -------------------------------------------------------------
line('8. MERGE');
{
  await q(`DROP TABLE IF EXISTS c_target, c_source`);
  await q(`CREATE TABLE c_target (id int PRIMARY KEY, v text)`);
  await q(`CREATE TABLE c_source (id int, v text)`);
  await q(`INSERT INTO c_target VALUES (1,'old'),(2,'keep')`);
  await q(`INSERT INTO c_source VALUES (1,'new'),(3,'add'),(2,NULL)`);
  const r = await q(`
    MERGE INTO c_target t USING c_source s ON t.id = s.id
    WHEN MATCHED AND s.v IS NULL THEN DELETE
    WHEN MATCHED THEN UPDATE SET v = s.v
    WHEN NOT MATCHED THEN INSERT (id, v) VALUES (s.id, s.v)`);
  console.log('MERGE command:', r.command, '| rowCount:', r.rowCount);
  await show(`SELECT * FROM c_target ORDER BY id`);
}

// --- 9. expressions -------------------------------------------------------
line('9. expressions');
{
  await show(`SELECT
    COALESCE(qty, 0) AS qty0,
    GREATEST(qty, 2) AS g, LEAST(qty, 2) AS l,
    CASE WHEN qty IS NULL THEN 'unknown' WHEN qty = 0 THEN 'out' ELSE 'in stock' END AS state,
    name || ' (' || sku || ')' AS label,
    concat_ws(' / ', name, sku, qty) AS cws
    FROM c_items ORDER BY id LIMIT 4`);
  const n = await q(`SELECT ('x' || NULL) AS concat_null, concat('x', NULL) AS concat_fn`);
  console.log('|| with NULL →', JSON.stringify(n.rows[0].concat_null),
              '| concat() →', JSON.stringify(n.rows[0].concat_fn));
}

// --- 10. string functions -------------------------------------------------
line('10. string functions');
{
  await show(`SELECT
    lower('MiXeD') AS lower, btrim('  pad  ') AS btrim,
    substring('abcdef' FROM 2 FOR 3) AS substr,
    split_part('a-b-c','-',2) AS split,
    format('%s has %I = %L', 'row', 'col', 'val') AS fmt,
    left('abcdef',3) AS l, right('abcdef',3) AS r,
    length('héllo') AS len, octet_length('héllo') AS bytes`);
}

// --- 11. date/time --------------------------------------------------------
line('11. date/time functions');
{
  await show(`SELECT
    date_trunc('month', timestamptz '2026-08-12 13:45:00+00') AS month,
    extract(dow FROM date '2026-08-12')::int AS dow,
    to_char(timestamptz '2026-08-12 13:45:00+00','YYYY-MM-DD HH24:MI') AS formatted,
    age(timestamptz '2026-08-12', timestamptz '2025-05-01') AS age,
    (date '2026-08-12' + interval '1 month')::date AS plus_month`);
}

// --- 12. generate_series / VALUES / unnest --------------------------------
line('12. generate_series, VALUES, unnest');
{
  await show(`SELECT g, g*g AS sq FROM generate_series(1,4) g`);
  await show(`SELECT * FROM (VALUES (1,'a'),(2,'b')) AS t(id, label)`);
  await show(`SELECT * FROM unnest(ARRAY[10,20], ARRAY['x','y']) AS t(n, s)`);
  await show(`SELECT d::date FROM generate_series(date '2026-01-01', date '2026-01-04', interval '1 day') d`);
}

// --- 13. tuple comparison -------------------------------------------------
line('13. row constructors / tuple comparison');
{
  const cmp = await q(`SELECT ((1,'b') < (1,'c')) AS lt, ((2,'a') < (1,'z')) AS lt2`);
  console.log(`(1,'b') < (1,'c') →`, cmp.rows[0].lt, `| (2,'a') < (1,'z') →`, cmp.rows[0].lt2);
  await q(`ANALYZE c_events`);
  const plan = await q(`EXPLAIN SELECT * FROM c_events WHERE (at, user_id) > (timestamptz '2026-01-02', 1) ORDER BY at, user_id LIMIT 2`);
  console.log('keyset predicate plan:', plan.rows[0]['QUERY PLAN'].trim());
  await show(`SELECT user_id, at FROM c_events
              WHERE (at, user_id) > (timestamptz '2026-01-02', 1)
              ORDER BY at, user_id LIMIT 3`);
  const nullrow = await q(`SELECT ((1,NULL) < (1,2)) AS r`);
  console.log(`(1,NULL) < (1,2) →`, nullrow.rows[0].r, '← NULL in a row constructor gives NULL');
}

// --- 14. TRUNCATE vs DELETE transactionality ------------------------------
line('14. TRUNCATE is transactional');
{
  await q(`DROP TABLE IF EXISTS c_trunc`);
  await q(`CREATE TABLE c_trunc (id int)`);
  await q(`INSERT INTO c_trunc SELECT generate_series(1,100)`);
  const c = await pool.connect();
  await c.query('BEGIN');
  await c.query('TRUNCATE c_trunc');
  console.log('inside tx after TRUNCATE:', (await c.query(`SELECT count(*)::int n FROM c_trunc`)).rows[0].n);
  await c.query('ROLLBACK');
  c.release();
  console.log('after ROLLBACK:', (await q(`SELECT count(*)::int n FROM c_trunc`)).rows[0].n,
    '← TRUNCATE rolls back, unlike most engines');
}

await q(`DROP TABLE IF EXISTS c_items, c_events, c_target, c_source, c_price_updates, c_trunc CASCADE`);
await pool.end();
