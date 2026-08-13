// Phase 4 pages 18 & 19 — generate_series, VALUES, unnest.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const show = async (sql, p) => console.table((await q(sql, p)).rows);

console.log('TZ:', Intl.DateTimeFormat().resolvedOptions().timeZone,
            '| server TimeZone:', (await q('SHOW TimeZone')).rows[0].TimeZone);

// --- 1. gap filling: the reason generate_series matters --------------------
line('1. gap filling a daily report');
{
  await q(`DROP TABLE IF EXISTS s_events`);
  await q(`CREATE TABLE s_events (id bigint GENERATED ALWAYS AS IDENTITY, at date, kind text)`);
  await q(`INSERT INTO s_events (at, kind) VALUES
    ('2026-03-01','click'), ('2026-03-01','click'), ('2026-03-03','view'),
    ('2026-03-06','click'), ('2026-03-06','view'), ('2026-03-06','view')`);

  console.log('plain GROUP BY — missing days simply do not exist:');
  await show(`SELECT at, count(*)::int AS n FROM s_events GROUP BY at ORDER BY at`);

  console.log('LEFT JOIN a generated series — every day present:');
  await show(`
    SELECT d::date AS day, count(e.id)::int AS n
    FROM generate_series(date '2026-03-01', date '2026-03-07', interval '1 day') d
    LEFT JOIN s_events e ON e.at = d::date
    GROUP BY d ORDER BY d`);
}

// --- 2. the date → JS Date trap --------------------------------------------
line('2. how a date column reaches JavaScript');
{
  const r = await q(`SELECT d::date AS d
                     FROM generate_series(date '2026-01-01', date '2026-01-03', interval '1 day') d`);
  console.log('default parser  →', r.rows.map(x => x.d.toISOString()).join(' | '));
  console.log('  ↑ 2026-01-01 became the previous day in UTC — local midnight, shifted');

  const t = await q(`SELECT to_char(d, 'YYYY-MM-DD') AS d
                     FROM generate_series(date '2026-01-01', date '2026-01-03', interval '1 day') d`);
  console.log('to_char         →', t.rows.map(x => x.d).join(' | '));

  pg.types.setTypeParser(1082, v => v);          // 1082 = date
  const p = await q(`SELECT d::date AS d
                     FROM generate_series(date '2026-01-01', date '2026-01-03', interval '1 day') d`);
  console.log('setTypeParser   →', p.rows.map(x => x.d).join(' | '));
}

// --- 3. steps, descending, non-integer -------------------------------------
line('3. step arguments');
{
  const one = async (sql) => (await q(sql)).rows.map(r => Object.values(r)[0]).join(', ');
  console.log('generate_series(1,10,3)      →', await one(`SELECT * FROM generate_series(1,10,3)`));
  console.log('generate_series(5,1,-2)      →', await one(`SELECT * FROM generate_series(5,1,-2)`));
  console.log('generate_series(5,1)         →', await one(`SELECT * FROM generate_series(5,1)`) || '(no rows)');
  console.log('generate_series(1,2,0.5)     →', await one(`SELECT * FROM generate_series(1::numeric,2,0.5)`));
  try { await q(`SELECT * FROM generate_series(1,10,0)`); }
  catch (e) { console.log('step of 0                    →', e.code, e.message.split('\n')[0]); }
  const h = await q(`SELECT count(*)::int n FROM generate_series(
    timestamptz '2026-03-01 00:00+00', timestamptz '2026-03-02 00:00+00', interval '1 hour')`);
  console.log('hourly buckets over one day  →', h.rows[0].n, 'rows (both endpoints included)');
}

// --- 4. WITH ORDINALITY ----------------------------------------------------
line('4. WITH ORDINALITY — keeping the input order');
{
  await show(`SELECT * FROM unnest(ARRAY['c','a','b']) WITH ORDINALITY AS t(val, pos)`);
}

// --- 5. unnest with several arrays -----------------------------------------
line('5. unnest over several arrays');
{
  await show(`SELECT * FROM unnest(ARRAY[10,20], ARRAY['x','y']) AS t(n, s)`);
  console.log('mismatched lengths — the short one is padded with NULL:');
  await show(`SELECT * FROM unnest(ARRAY[1,2,3], ARRAY['a']) AS t(n, s)`);
  console.log('unnest in the SELECT list instead of FROM:');
  await show(`SELECT unnest(ARRAY[1,2]) AS a, unnest(ARRAY['x','y']) AS b`);
}

// --- 6. VALUES as a standalone table ---------------------------------------
line('6. VALUES as a table');
{
  await show(`SELECT * FROM (VALUES (1,'a'),(2,'b')) AS t(id, label)`);
  const types = await q(`SELECT pg_typeof(id)::text AS id_type, pg_typeof(label)::text AS label_type
                         FROM (VALUES (1,'a')) AS t(id, label)`);
  console.log('inferred types →', types.rows[0]);
  console.log('joining a VALUES list against a real table:');
  await q(`DROP TABLE IF EXISTS s_items`);
  await q(`CREATE TABLE s_items (sku text PRIMARY KEY, name text)`);
  await q(`INSERT INTO s_items VALUES ('a1','Widget'),('a2','Gadget')`);
  await show(`SELECT i.sku, i.name, v.price
              FROM s_items i JOIN (VALUES ('a1', 10.0), ('a2', 20.0)) AS v(sku, price)
              ON v.sku = i.sku ORDER BY i.sku`);
}

// --- 7. unnest as the bulk-parameter bridge --------------------------------
line('7. unnest: N rows through a fixed number of parameters');
{
  await q(`DROP TABLE IF EXISTS s_bulk`);
  await q(`CREATE TABLE s_bulk (sku text, name text, qty int)`);
  const rows = Array.from({length: 5000}, (_, i) => ({sku: `s${i}`, name: `Item ${i}`, qty: i}));

  const r = await q(
    `INSERT INTO s_bulk (sku, name, qty)
     SELECT * FROM unnest($1::text[], $2::text[], $3::int[]) RETURNING sku`,
    [rows.map(r => r.sku), rows.map(r => r.name), rows.map(r => r.qty)]);
  console.log(`inserted ${r.rowCount} rows using exactly 3 parameters`);
  console.log('the multi-row VALUES equivalent would need', rows.length * 3, 'parameters',
    `(ceiling is 65535 → max ${Math.floor(65535 / 3)} rows)`);

  // unnest also drives a bulk UPDATE
  const u = await q(
    `UPDATE s_bulk b SET qty = v.qty
     FROM unnest($1::text[], $2::int[]) AS v(sku, qty)
     WHERE b.sku = v.sku`,
    [['s1', 's2', 's3'], [111, 222, 333]]);
  console.log('bulk UPDATE via unnest → rowCount:', u.rowCount);
}

await q(`DROP TABLE IF EXISTS s_events, s_items, s_bulk`);
await pool.end();
