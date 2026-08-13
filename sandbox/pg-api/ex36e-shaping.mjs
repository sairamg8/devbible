// Phase 6 topic 05 — string_agg / array_agg / jsonb_agg / jsonb_object_agg.
// Depends on the ex36 fixture. Run ex36-aggregation.mjs first.
import pg from 'pg';

const pool = new pg.Pool({connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 4});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const jj = (v) => JSON.stringify(v);
const rows = async (sql) => jj((await q(sql)).rows);
const tryq = async (label, sql) => {
  try { const r = await q(sql); console.log(`${label.padEnd(48)} ok  ${jj(r.rows.slice(0, 3))}`); }
  catch (e) { console.log(`${label.padEnd(48)} ->  ${e.code} ${e.message.split('\n')[0]}`); }
};

line('E1. does an unordered array_agg follow insertion order?');
console.log('alone, nothing else in the query :', await rows(
  `SELECT array_agg(status) AS unordered FROM agg_orders`));
console.log('beside an ORDER BY aggregate     :', await rows(
  `SELECT array_agg(status) AS unordered, array_agg(status ORDER BY id DESC) AS ordered
   FROM agg_orders`));
console.log('  ^ if these two match, the unordered one inherited the other aggregate sort');
console.log('after an explicit sort           :', await rows(
  `SELECT array_agg(status) AS from_sorted_input FROM (SELECT status FROM agg_orders ORDER BY id DESC) s`));
console.log('  there is no ORDER-BY-less guarantee: put ORDER BY INSIDE the aggregate');

line('E2. string_agg');
console.log('basic                :', await rows(
  `SELECT string_agg(name, ', ' ORDER BY name) AS names FROM agg_customers`));
console.log('NULLs are skipped    :', await rows(
  `SELECT count(*)::int AS rows, count(coupon)::int AS non_null,
          string_agg(coupon, '|') AS joined FROM agg_orders`));
console.log('empty group          :', await rows(
  `SELECT string_agg(name, ',') AS s FROM agg_customers WHERE id > 99`));
console.log('  -> NULL, not the empty string. Use coalesce(string_agg(...), \'\') for \'\'');
console.log('a non-text delimiter :', await rows(
  `SELECT string_agg(id::text, E'\\n' ORDER BY id) AS lines FROM agg_orders WHERE id < 13`));
await tryq('string_agg over a non-text column', `SELECT string_agg(id, ',') FROM agg_orders`);

line('E3. array_agg');
console.log('nulls are KEPT       :', await rows(
  `SELECT array_agg(coupon ORDER BY id) AS with_nulls,
          array_length(array_agg(coupon), 1) AS len FROM agg_orders`));
console.log('  contrast with string_agg, which drops them');
console.log('array_remove / FILTER:', await rows(
  `SELECT array_remove(array_agg(coupon), NULL) AS removed,
          array_agg(coupon) FILTER (WHERE coupon IS NOT NULL) AS filtered
   FROM agg_orders`));
console.log('DISTINCT inside      :', await rows(
  `SELECT array_agg(DISTINCT status ORDER BY status) AS statuses FROM agg_orders`));
await tryq('DISTINCT with a different ORDER BY',
  `SELECT array_agg(DISTINCT status ORDER BY id) FROM agg_orders`);
console.log('what pg gives JS     :');
{
  const r = await q(`SELECT array_agg(id ORDER BY id) AS ints,
                            array_agg(status ORDER BY id) AS texts,
                            array_agg(placed_at ORDER BY id) AS stamps
                     FROM agg_orders WHERE id < 12`);
  for (const [k, v] of Object.entries(r.rows[0]))
    console.log(`  ${k.padEnd(7)} ${Array.isArray(v) ? 'Array' : typeof v} of ${typeof v[0]}  ${jj(v)}`);
}
console.log('multidimensional     :', await rows(
  `SELECT array_agg(ARRAY[id, total] ORDER BY id) AS pairs FROM agg_orders WHERE total IS NOT NULL AND id < 13`));

line('E4. json vs jsonb — what survives the round trip');
console.log('duplicate keys       :', await rows(
  `SELECT '{"a":1,"a":2}'::json  AS as_json,
          '{"a":1,"a":2}'::jsonb AS as_jsonb`));
console.log('key order + whitespace:', await rows(
  `SELECT '{"b":1, "a":2}'::json AS as_json, '{"b":1, "a":2}'::jsonb AS as_jsonb`));
console.log('  json keeps the text verbatim; jsonb parses, dedupes and reorders keys');
{
  const r = await q(`SELECT jsonb_agg(id) AS jb, json_agg(id) AS js,
                            string_agg(id::text, ',') AS str, array_agg(id) AS arr
                     FROM agg_orders`);
  console.log('  what pg hands JS:');
  for (const [k, v] of Object.entries(r.rows[0]))
    console.log(`    ${k.padEnd(4)} ${(typeof v).padEnd(7)} ${Array.isArray(v) ? 'array' : ''} ${jj(v)}`);
}

line('E5. building objects');
console.log('jsonb_build_object   :', await rows(
  `SELECT jsonb_build_object('id', id, 'status', status) AS o FROM agg_orders ORDER BY id LIMIT 2`));
console.log('to_jsonb of a row    :', await rows(
  `SELECT to_jsonb(o) AS o FROM agg_orders o ORDER BY id LIMIT 1`));
console.log('  every column, including the ones you did not want — pick with a subquery:');
console.log('to_jsonb of a subset :', await rows(
  `SELECT to_jsonb(x) AS o FROM (SELECT id, status FROM agg_orders ORDER BY id LIMIT 1) x`));
console.log('jsonb_object_agg     :', await rows(
  `SELECT jsonb_object_agg(status, n) AS by_status
   FROM (SELECT status, count(*)::int AS n FROM agg_orders GROUP BY status) s`));
await tryq('jsonb_object_agg with a NULL key',
  `SELECT jsonb_object_agg(coupon, id) FROM agg_orders`);
await tryq('jsonb_object_agg with duplicate keys',
  `SELECT jsonb_object_agg(status, id) FROM agg_orders`);
console.log('  ^ duplicates: last one wins, silently');

line('E6. the empty-array trap, end to end');
console.log('naked array_agg      :', await rows(
  `SELECT o.id, array_agg(i.sku) AS skus
   FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
   WHERE o.id IN (10,13) GROUP BY o.id ORDER BY o.id`));
console.log('naked jsonb_agg      :', await rows(
  `SELECT o.id, jsonb_agg(i.*) AS items
   FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
   WHERE o.id IN (10,13) GROUP BY o.id ORDER BY o.id`));
console.log('FILTER alone         :', await rows(
  `SELECT o.id, jsonb_agg(i.*) FILTER (WHERE i.id IS NOT NULL) AS items
   FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
   WHERE o.id IN (10,13) GROUP BY o.id ORDER BY o.id`));
console.log('  ^ NULL for order 13, not [] — FILTER makes the group empty, and jsonb_agg');
console.log('    over an empty group is NULL. coalesce is still required:');
console.log('FILTER + coalesce    :', await rows(
  `SELECT o.id, coalesce(jsonb_agg(jsonb_build_object('sku', i.sku, 'qty', i.qty)
                                   ORDER BY i.sku)
                         FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items
   FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
   WHERE o.id IN (10,13) GROUP BY o.id ORDER BY o.id`));

line('E7. a whole API payload in one query, two levels deep');
console.log(await rows(
  `SELECT jsonb_build_object(
     'id', c.id, 'name', c.name,
     'orders', coalesce(jsonb_agg(o.payload ORDER BY o.id) FILTER (WHERE o.id IS NOT NULL), '[]'::jsonb)
   ) AS customer
   FROM agg_customers c
   LEFT JOIN LATERAL (
     SELECT o.id, jsonb_build_object(
       'id', o.id, 'status', o.status, 'total', o.total,
       'items', coalesce(jsonb_agg(jsonb_build_object('sku', i.sku, 'qty', i.qty)
                                   ORDER BY i.sku)
                         FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb)
     ) AS payload
     FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
     WHERE o.customer_id = c.id
     GROUP BY o.id
   ) o ON true
   WHERE c.id IN (1, 5)
   GROUP BY c.id, c.name ORDER BY c.id`));

line('E8. one shaped query vs three flat ones — bytes on the wire');
{
  const one = await q(
    `SELECT jsonb_build_object('id', c.id, 'orders',
       coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'total', o.total))
                FILTER (WHERE o.id IS NOT NULL), '[]'::jsonb)) AS payload
     FROM agg_customers c LEFT JOIN agg_orders o ON o.customer_id = c.id
     GROUP BY c.id`);
  const flat1 = await q(`SELECT id, name, country, plan FROM agg_customers`);
  const flat2 = await q(`SELECT id, customer_id, status, total FROM agg_orders`);
  console.log('shaped   rows:', one.rowCount, ' JSON bytes:', JSON.stringify(one.rows).length);
  console.log('flat     rows:', flat1.rowCount + flat2.rowCount,
              ' JSON bytes:', JSON.stringify(flat1.rows).length + JSON.stringify(flat2.rows).length);
  console.log('  the shaped form still needs no client-side stitching; the flat one does');
}

await pool.end();
console.log('\ndone');
