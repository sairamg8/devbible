// Phase 6 pages 01-08 — GROUP BY and aggregates, count variants, HAVING, FILTER,
// json/array/string aggregates, window function basics, ranking, lag/lead.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 8});
pool.on('error', (e) => console.log('pool error event:', e.code, e.message));
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const err = (e) => `${e.code} ${e.message.split('\n')[0]}`;
const j = (v) => JSON.stringify(v);
const rows = async (sql, p) => j((await q(sql, p)).rows);
const tryq = async (label, sql) => {
  try {
    const r = await q(sql);
    console.log(`${label.padEnd(44)} ok  rows=${r.rowCount} ${j(r.rows.slice(0, 3))}`);
  } catch (e) { console.log(`${label.padEnd(44)} ->  ${err(e)}`); }
};
const planOf = async (sql) => {
  const p = (await q(`EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) ${sql}`)).rows.map(r => r['QUERY PLAN']).join('\n');
  return [p, Number(p.match(/Execution Time: ([\d.]+) ms/)?.[1])];
};
const node = (p) => p.split('\n').map(l => l.replace(/^\s*(->\s*)?/, ''))
  .filter(l => /Aggregate|WindowAgg|Sort|Scan|Join|CTE|Recursive|Unique|Limit|SubPlan|Memoize|Group/.test(l))
  .slice(0, 5).map(l => l.split('  (')[0]);
// best of N, warmed — one cold run then N timed
const timed = async (sql, n = 5) => {
  await q(sql);
  const ts = [];
  for (let i = 0; i < n; i++) ts.push((await planOf(sql))[1]);
  return Math.min(...ts).toFixed(2);
};

// --- fixture ----------------------------------------------------------------
await q(`DROP TABLE IF EXISTS agg_items, agg_orders, agg_customers, agg_events, agg_cat CASCADE`);
await q(`CREATE TABLE agg_customers (id int PRIMARY KEY, name text NOT NULL,
                                     country text, plan text)`);
await q(`CREATE TABLE agg_orders (id int PRIMARY KEY,
                                  customer_id int REFERENCES agg_customers(id),
                                  status text NOT NULL, total int,
                                  coupon text,
                                  placed_at timestamptz NOT NULL)`);
await q(`CREATE TABLE agg_items (id int PRIMARY KEY, order_id int REFERENCES agg_orders(id),
                                 sku text NOT NULL, qty int NOT NULL, unit int NOT NULL)`);
await q(`INSERT INTO agg_customers VALUES
  (1,'Ann','GB','pro'),(2,'Bob','US','free'),(3,'Cid','GB','pro'),
  (4,'Dee','IN','free'),(5,'Eve','US',NULL)`);
// total is NULLable on purpose: order 15 has no total yet. coupon is mostly NULL.
await q(`INSERT INTO agg_orders VALUES
  (10,1,'paid',     100, 'WELCOME', '2026-03-01 09:15+00'),
  (11,1,'open',      50, NULL,      '2026-03-03 14:40+00'),
  (12,2,'paid',     200, 'WELCOME', '2026-03-01 11:00+00'),
  (13,3,'cancelled',  0, NULL,      '2026-03-04 08:05+00'),
  (14,2,'paid',     200, 'SPRING',  '2026-03-05 16:20+00'),
  (15,4,'open',    NULL, NULL,      '2026-03-05 18:00+00')`);
await q(`INSERT INTO agg_items VALUES
  (100,10,'A',1,100),(101,10,'B',2,50),(102,11,'A',5,10),
  (103,12,'C',1,200),(104,14,'C',1,200)`);
console.log('fixture: 5 customers, 6 orders (Eve has none, order 15 total IS NULL), 5 items');

// --- 1. GROUP BY and the five aggregates ------------------------------------
line('1. GROUP BY collapses rows; aggregates fold each group');
console.log('per status              :', await rows(
  `SELECT status, count(*)::int AS n, sum(total)::int AS revenue,
          round(avg(total),2) AS avg_total, min(total) AS lo, max(total) AS hi
   FROM agg_orders GROUP BY status ORDER BY status`));
console.log('NULL is ignored by sum/avg/min/max, but counted by count(*):');
console.log('  open group has 2 rows, one with total NULL -> avg over 1 value');
console.log('whole table, no GROUP BY:', await rows(
  `SELECT count(*)::int AS n, sum(total)::int AS revenue, round(avg(total),2) AS avg FROM agg_orders`));
console.log('empty set               :', await rows(
  `SELECT count(*)::int AS n, sum(total) AS revenue, avg(total) AS avg
   FROM agg_orders WHERE status = 'refunded'`));
console.log('  count()=0 but sum()/avg() are NULL, not 0 - coalesce(sum(total),0) if you need 0');
console.log('avg type                :', await rows(
  `SELECT pg_typeof(avg(total)) AS avg_t, pg_typeof(sum(total)) AS sum_t,
          pg_typeof(count(*)) AS count_t FROM agg_orders`));
await tryq('select a non-grouped column', `SELECT status, total FROM agg_orders GROUP BY status`);
await tryq('group by the PK, select others',
  `SELECT o.id, o.status, count(i.id)::int FROM agg_orders o
   LEFT JOIN agg_items i ON i.order_id = o.id GROUP BY o.id`);
console.log('  functional dependency: grouping by a PK licenses every column of that table');
await tryq('GROUP BY ordinal', `SELECT status, count(*)::int FROM agg_orders GROUP BY 1`);
await tryq('GROUP BY output alias', `SELECT status AS s, count(*)::int FROM agg_orders GROUP BY s`);
await tryq('WHERE on an output alias', `SELECT status AS s, count(*)::int FROM agg_orders WHERE s = 'paid' GROUP BY 1`);
console.log('grouped by expression   :', await rows(
  `SELECT date_trunc('day', placed_at)::date AS day, count(*)::int AS n
   FROM agg_orders GROUP BY 1 ORDER BY 1`));

// --- big table for every timing below ---------------------------------------
line('big table: agg_events, 500k rows');
await q(`CREATE TABLE agg_events (id bigserial PRIMARY KEY, user_id int NOT NULL,
                                  kind text NOT NULL, amount int,
                                  created_at timestamptz NOT NULL)`);
console.time('seed 500k');
// kind is derived from g/5000, NOT g%4: with user_id = g%5000 and 4 dividing 5000,
// (g%4) would make kind a function of user_id — every user stuck on one kind — which
// silently confounds any query that groups or filters on both. g/5000 cycles all four
// kinds across each user's 100 events instead.
await q(`INSERT INTO agg_events (user_id, kind, amount, created_at)
         SELECT (g % 5000) + 1,
                (ARRAY['view','click','purchase','refund'])[((g / 5000) % 4) + 1],
                CASE WHEN g % 7 = 0 THEN NULL ELSE (g % 900) + 10 END,
                timestamptz '2026-01-01 00:00+00' + (g % 180) * interval '1 day'
                                                  + (g % 1440) * interval '1 minute'
         FROM generate_series(1, 500000) g`);
console.timeEnd('seed 500k');
await q(`ANALYZE agg_events`);
console.log('size                    :', await rows(
  `SELECT pg_size_pretty(pg_total_relation_size('agg_events')) AS total`));
console.log('null amounts            :', await rows(
  `SELECT count(*)::int AS total, count(amount)::int AS non_null FROM agg_events`));

line('1b. HashAggregate vs GroupAggregate');
{
  const [p1, t1] = await planOf(`SELECT kind, count(*) FROM agg_events GROUP BY kind`);
  console.log('4 groups                :', node(p1), `${t1} ms`);
  const [p2, t2] = await planOf(`SELECT user_id, count(*) FROM agg_events GROUP BY user_id`);
  console.log('5000 groups             :', node(p2), `${t2} ms`);
  await q(`SET work_mem = '64kB'`);
  const [p3, t3] = await planOf(`SELECT user_id, count(*) FROM agg_events GROUP BY user_id`);
  console.log('5000 groups, work_mem 64kB:', node(p3), `${t3} ms`);
  console.log('  low work_mem does not force a spilling hash agg - the planner re-costs and');
  console.log('  picks sort + GroupAggregate instead. Hash spill exists (PG13+) but loses here.');
  await q(`RESET work_mem`);
}

// --- 2. count(*) vs count(col) vs count(DISTINCT col) -----------------------
line('2. three counts, three questions');
console.log('on the small table      :', await rows(
  `SELECT count(*)::int AS star, count(total)::int AS total_nonnull,
          count(coupon)::int AS coupon_nonnull, count(DISTINCT coupon)::int AS coupons,
          count(DISTINCT status)::int AS statuses
   FROM agg_orders`));
console.log('  count(*) counts rows; count(col) counts non-NULL; count(DISTINCT col) ignores NULL too');
console.log('the LEFT JOIN trap      :', await rows(
  `SELECT c.name, count(*)::int AS wrong, count(o.id)::int AS right
   FROM agg_customers c LEFT JOIN agg_orders o ON o.customer_id = c.id
   GROUP BY c.name ORDER BY c.name`));
console.log('  Eve has no orders: count(*) says 1 (the extended NULL row), count(o.id) says 0');
console.log('count on 500k rows:');
console.log('  count(*)              :', await timed(`SELECT count(*) FROM agg_events`), 'ms');
console.log('  count(amount)         :', await timed(`SELECT count(amount) FROM agg_events`), 'ms');
console.log('  count(DISTINCT user_id):', await timed(`SELECT count(DISTINCT user_id) FROM agg_events`, 3), 'ms');
console.log('  count(DISTINCT amount) :', await timed(`SELECT count(DISTINCT amount) FROM agg_events`, 3), 'ms');
{
  const [p] = await planOf(`SELECT count(DISTINCT user_id) FROM agg_events`);
  console.log('  distinct plan         :', node(p));
  const [p2] = await planOf(`SELECT count(*) FROM (SELECT DISTINCT user_id FROM agg_events) s`);
  console.log('  DISTINCT subquery plan:', node(p2));
  console.log('  count(DISTINCT) via subquery:',
    await timed(`SELECT count(*) FROM (SELECT DISTINCT user_id FROM agg_events) s`, 3), 'ms');
}
console.log('multiple DISTINCTs      :', await rows(
  `SELECT count(DISTINCT user_id)::int AS users, count(DISTINCT kind)::int AS kinds FROM agg_events`));

// --- 3. HAVING vs WHERE ------------------------------------------------------
line('3. HAVING filters groups, WHERE filters rows');
console.log('WHERE then group        :', await rows(
  `SELECT customer_id, count(*)::int AS n, sum(total)::int AS spend
   FROM agg_orders WHERE status = 'paid' GROUP BY customer_id ORDER BY customer_id`));
console.log('HAVING on the aggregate :', await rows(
  `SELECT customer_id, count(*)::int AS n FROM agg_orders
   GROUP BY customer_id HAVING count(*) > 1 ORDER BY customer_id`));
await tryq('aggregate in WHERE', `SELECT customer_id FROM agg_orders WHERE count(*) > 1 GROUP BY customer_id`);
await tryq('HAVING an output alias', `SELECT customer_id, count(*) AS n FROM agg_orders GROUP BY customer_id HAVING n > 1`);
await tryq('HAVING a plain column', `SELECT customer_id, count(*) FROM agg_orders GROUP BY customer_id HAVING status = 'paid'`);
console.log('HAVING with no GROUP BY :', await rows(
  `SELECT count(*)::int AS n FROM agg_orders HAVING count(*) > 3`));
console.log('  no GROUP BY = one group over the whole table; HAVING can eliminate it entirely:');
console.log('  same, threshold 99    :', await rows(
  `SELECT count(*)::int AS n FROM agg_orders HAVING count(*) > 99`));
console.log('  ^ zero rows, not a row containing 6');
{
  const w = `SELECT user_id, count(*) FROM agg_events WHERE kind = 'purchase' GROUP BY user_id`;
  const h = `SELECT user_id, count(*) FROM agg_events GROUP BY user_id, kind HAVING kind = 'purchase'`;
  console.log('WHERE before grouping   :', await timed(w, 3), 'ms', node((await planOf(w))[0]));
  console.log('HAVING after grouping   :', await timed(h, 3), 'ms', node((await planOf(h))[0]));
}

// --- 4. FILTER (WHERE ...) --------------------------------------------------
line('4. FILTER — conditional aggregation without a CASE pile');
console.log('one pass, three counts  :', await rows(
  `SELECT count(*) FILTER (WHERE status = 'paid')::int      AS paid,
          count(*) FILTER (WHERE status = 'open')::int      AS open,
          count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
          sum(total) FILTER (WHERE status = 'paid')::int    AS paid_revenue
   FROM agg_orders`));
console.log('the CASE equivalent     :', await rows(
  `SELECT count(CASE WHEN status = 'paid' THEN 1 END)::int AS paid,
          sum(CASE WHEN status = 'paid' THEN total ELSE 0 END)::int AS paid_revenue
   FROM agg_orders`));
console.log('  NOT identical: sum(CASE .. ELSE 0) returns 0 for an empty set, FILTER returns NULL');
console.log('empty, FILTER vs CASE   :', await rows(
  `SELECT sum(total) FILTER (WHERE status = 'refunded') AS filt,
          sum(CASE WHEN status = 'refunded' THEN total ELSE 0 END) AS case_else0
   FROM agg_orders`));
console.log('count(*) vs count(col) under FILTER:', await rows(
  `SELECT count(*) FILTER (WHERE status = 'open')::int AS star,
          count(total) FILTER (WHERE status = 'open')::int AS col
   FROM agg_orders`));
console.log('per group               :', await rows(
  `SELECT c.country,
          count(*) FILTER (WHERE o.status = 'paid')::int AS paid,
          count(*) FILTER (WHERE o.status <> 'paid')::int AS other
   FROM agg_customers c JOIN agg_orders o ON o.customer_id = c.id
   GROUP BY c.country ORDER BY c.country`));
{
  const f = `SELECT count(*) FILTER (WHERE kind='purchase') AS p, count(*) FILTER (WHERE kind='refund') AS r FROM agg_events`;
  const c = `SELECT count(CASE WHEN kind='purchase' THEN 1 END) AS p, count(CASE WHEN kind='refund' THEN 1 END) AS r FROM agg_events`;
  const two = `SELECT (SELECT count(*) FROM agg_events WHERE kind='purchase') AS p,
                      (SELECT count(*) FROM agg_events WHERE kind='refund') AS r`;
  console.log('FILTER, 500k            :', await timed(f, 3), 'ms');
  console.log('CASE, 500k              :', await timed(c, 3), 'ms');
  console.log('two scalar subqueries   :', await timed(two, 3), 'ms  <- two scans');
}
await tryq('FILTER on a window function',
  `SELECT id, count(*) FILTER (WHERE status='paid') OVER () FROM agg_orders`);
await tryq('FILTER on a plain function', `SELECT upper(status) FILTER (WHERE true) FROM agg_orders`);

// --- 5. json / array / string aggregates ------------------------------------
line('5. shaping a payload in SQL');
console.log('string_agg              :', await rows(
  `SELECT c.country, string_agg(c.name, ', ' ORDER BY c.name) AS names
   FROM agg_customers c GROUP BY c.country ORDER BY c.country`));
console.log('array_agg               :', await rows(
  `SELECT o.id, array_agg(i.sku ORDER BY i.sku) AS skus
   FROM agg_orders o JOIN agg_items i ON i.order_id = o.id GROUP BY o.id ORDER BY o.id`));
console.log('array_agg over LEFT JOIN:', await rows(
  `SELECT o.id, array_agg(i.sku) AS skus
   FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
   WHERE o.id IN (13,10) GROUP BY o.id ORDER BY o.id`));
console.log('  order 13 has no items -> {NULL}, an array of one NULL, not an empty array');
console.log('the fix                 :', await rows(
  `SELECT o.id, array_remove(array_agg(i.sku), NULL) AS skus,
          coalesce(array_agg(i.sku) FILTER (WHERE i.id IS NOT NULL), '{}') AS via_filter
   FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
   WHERE o.id IN (13,10) GROUP BY o.id ORDER BY o.id`));
console.log('jsonb_agg of rows       :', await rows(
  `SELECT o.id, jsonb_agg(jsonb_build_object('sku', i.sku, 'qty', i.qty) ORDER BY i.sku) AS items
   FROM agg_orders o JOIN agg_items i ON i.order_id = o.id GROUP BY o.id ORDER BY o.id`));
console.log('jsonb_agg over LEFT JOIN:', await rows(
  `SELECT o.id, jsonb_agg(i.*) AS items
   FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
   WHERE o.id = 13 GROUP BY o.id`));
console.log('  -> [null]; jsonb_agg(i.*) FILTER (WHERE i.id IS NOT NULL) gives NULL, coalesce it to []');
console.log('fixed                   :', await rows(
  `SELECT o.id, coalesce(jsonb_agg(jsonb_build_object('sku', i.sku))
                         FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items
   FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
   WHERE o.id = 13 GROUP BY o.id`));
console.log('jsonb_object_agg        :', await rows(
  `SELECT jsonb_object_agg(status, n) AS by_status
   FROM (SELECT status, count(*)::int AS n FROM agg_orders GROUP BY status) s`));
console.log('one-query API payload   :', await rows(
  `SELECT jsonb_build_object(
            'id', c.id, 'name', c.name,
            'orders', coalesce(jsonb_agg(jsonb_build_object(
                'id', o.id, 'status', o.status, 'total', o.total
              ) ORDER BY o.id) FILTER (WHERE o.id IS NOT NULL), '[]'::jsonb)
          ) AS payload
   FROM agg_customers c LEFT JOIN agg_orders o ON o.customer_id = c.id
   WHERE c.id IN (1,5) GROUP BY c.id, c.name ORDER BY c.id`));
console.log('what pg gives JS for jsonb vs json vs text:');
{
  const r = await q(`SELECT jsonb_agg(id) AS jb, json_agg(id) AS js,
                            string_agg(id::text, ',') AS str, array_agg(id) AS arr
                     FROM agg_orders`);
  const v = r.rows[0];
  for (const k of ['jb', 'js', 'str', 'arr'])
    console.log(`  ${k.padEnd(4)} ${(typeof v[k]).padEnd(7)} ${Array.isArray(v[k]) ? 'array' : ''} ${j(v[k])}`);
}
console.log('agg ORDER BY vs no order:', await rows(
  `SELECT array_agg(status) AS unordered, array_agg(status ORDER BY id DESC) AS ordered
   FROM agg_orders`));
console.log('DISTINCT inside an aggregate:', await rows(
  `SELECT array_agg(DISTINCT status ORDER BY status) AS statuses FROM agg_orders`));

// --- 6. window functions ----------------------------------------------------
line('6. OVER() keeps the rows, GROUP BY does not');
console.log('GROUP BY                :', await rows(
  `SELECT customer_id, sum(total)::int AS spend FROM agg_orders
   WHERE total IS NOT NULL GROUP BY customer_id ORDER BY customer_id`));
console.log('OVER (PARTITION BY)     :', await rows(
  `SELECT id, customer_id, total, sum(total) OVER (PARTITION BY customer_id)::int AS cust_total
   FROM agg_orders WHERE total IS NOT NULL ORDER BY id`));
console.log('  same numbers, one row per ORDER retained');
console.log('OVER () whole result    :', await rows(
  `SELECT id, total, sum(total) OVER ()::int AS grand,
          round(100.0 * total / sum(total) OVER (), 1) AS pct
   FROM agg_orders WHERE total IS NOT NULL ORDER BY id`));
console.log('running total (ORDER BY):', await rows(
  `SELECT id, total, sum(total) OVER (ORDER BY id)::int AS running
   FROM agg_orders WHERE total IS NOT NULL ORDER BY id`));
await tryq('window function in WHERE',
  `SELECT id FROM agg_orders WHERE row_number() OVER (ORDER BY id) <= 2`);
await tryq('window function in HAVING',
  `SELECT customer_id, count(*) FROM agg_orders GROUP BY customer_id HAVING row_number() OVER () = 1`);
console.log('the fix: wrap it in a subquery:', await rows(
  `SELECT id FROM (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM agg_orders) s WHERE rn <= 2`));
console.log('windows run AFTER GROUP BY:', await rows(
  `SELECT status, count(*)::int AS n, sum(count(*)) OVER ()::int AS all_rows,
          round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
   FROM agg_orders GROUP BY status ORDER BY status`));
console.log('  count(*) inside a window OVER () - legal, and the usual way to get a percentage of total');
console.log('named WINDOW clause     :', await rows(
  `SELECT id, sum(total) OVER w ::int AS running, count(*) OVER w AS n
   FROM agg_orders WHERE total IS NOT NULL WINDOW w AS (ORDER BY id) ORDER BY id`));
{
  const one = `SELECT user_id, sum(amount) OVER (PARTITION BY user_id) FROM agg_events`;
  const two = `SELECT user_id, sum(amount) OVER (PARTITION BY user_id),
                      rank() OVER (PARTITION BY user_id ORDER BY amount) FROM agg_events`;
  const diff = `SELECT user_id, sum(amount) OVER (PARTITION BY user_id),
                       rank() OVER (PARTITION BY kind ORDER BY amount) FROM agg_events`;
  console.log('1 window                :', await timed(one, 3), 'ms', node((await planOf(one))[0]).slice(0, 3));
  console.log('2 compatible windows    :', await timed(two, 3), 'ms', node((await planOf(two))[0]).slice(0, 3));
  console.log('2 different partitions  :', await timed(diff, 3), 'ms', node((await planOf(diff))[0]).slice(0, 4));
  console.log('  each incompatible window frame costs another Sort + WindowAgg');
}

// --- 7. ranking -------------------------------------------------------------
line('7. row_number, rank, dense_rank, ntile');
await q(`CREATE TEMP TABLE agg_score (name text, team text, pts int)`);
await q(`INSERT INTO agg_score VALUES
  ('Ann','red',10),('Bob','red',10),('Cid','red',7),('Dee','red',5),
  ('Eve','blue',9),('Fay','blue',9),('Gil','blue',9)`);
console.log('ties, three ways        :', await rows(
  `SELECT name, pts,
          row_number() OVER (ORDER BY pts DESC)::int AS rn,
          rank()       OVER (ORDER BY pts DESC)::int AS rnk,
          dense_rank() OVER (ORDER BY pts DESC)::int AS dense,
          percent_rank() OVER (ORDER BY pts DESC)::numeric(4,2) AS pct_rank
   FROM agg_score WHERE team = 'red' ORDER BY pts DESC, name`));
console.log('all ties               :', await rows(
  `SELECT name, pts, row_number() OVER (ORDER BY pts DESC)::int AS rn,
          rank() OVER (ORDER BY pts DESC)::int AS rnk
   FROM agg_score WHERE team = 'blue' ORDER BY name`));
console.log('  row_number is arbitrary among peers - the order can change between runs');
console.log('ntile, 7 rows into 3    :', await rows(
  `SELECT name, pts, ntile(3) OVER (ORDER BY pts DESC)::int AS bucket
   FROM agg_score ORDER BY pts DESC, name`));
console.log('  7/3: buckets get 3,2,2 - the earlier buckets take the remainder');
console.log('ntile with fewer rows than buckets:', await rows(
  `SELECT name, ntile(10) OVER (ORDER BY pts)::int AS b FROM agg_score WHERE team='blue'`));
console.log('top-1 per group         :', await rows(
  `SELECT team, name, pts FROM (
     SELECT team, name, pts, row_number() OVER (PARTITION BY team ORDER BY pts DESC, name) AS rn
     FROM agg_score) s WHERE rn = 1 ORDER BY team`));
console.log('DISTINCT ON equivalent  :', await rows(
  `SELECT DISTINCT ON (team) team, name, pts FROM agg_score ORDER BY team, pts DESC, name`));
{
  await q(`CREATE INDEX agg_ev_user_amt ON agg_events (user_id, amount DESC)`);
  await q(`ANALYZE agg_events`);
  const rn = `SELECT user_id, id FROM (SELECT user_id, id,
                row_number() OVER (PARTITION BY user_id ORDER BY amount DESC NULLS LAST) rn
              FROM agg_events) s WHERE rn <= 3`;
  const don = `SELECT DISTINCT ON (user_id) user_id, id FROM agg_events
               ORDER BY user_id, amount DESC NULLS LAST`;
  const lat = `SELECT u.user_id, e.id FROM (SELECT DISTINCT user_id FROM agg_events) u
               CROSS JOIN LATERAL (SELECT id FROM agg_events e WHERE e.user_id = u.user_id
                                   ORDER BY amount DESC NULLS LAST LIMIT 3) e`;
  console.log('top-3/user, row_number :', await timed(rn, 3), 'ms', node((await planOf(rn))[0]).slice(0, 3));
  console.log('top-1/user, DISTINCT ON:', await timed(don, 3), 'ms', node((await planOf(don))[0]).slice(0, 2));
  console.log('top-3/user, LATERAL    :', await timed(lat, 3), 'ms', node((await planOf(lat))[0]).slice(0, 3));
}

// --- 8. lag / lead / first_value / last_value -------------------------------
line('8. reaching into neighbouring rows');
console.log('lag and lead            :', await rows(
  `SELECT id, total,
          lag(total)  OVER (ORDER BY id) AS prev,
          lead(total) OVER (ORDER BY id) AS next,
          total - lag(total) OVER (ORDER BY id) AS delta
   FROM agg_orders WHERE total IS NOT NULL ORDER BY id`));
console.log('lag with offset+default :', await rows(
  `SELECT id, total, lag(total, 2, -1) OVER (ORDER BY id) AS two_back
   FROM agg_orders WHERE total IS NOT NULL ORDER BY id`));
console.log('lag inside a partition  :', await rows(
  `SELECT customer_id, id, total, lag(total) OVER (PARTITION BY customer_id ORDER BY id) AS prev
   FROM agg_orders WHERE total IS NOT NULL ORDER BY customer_id, id`));
console.log('  lag() does NOT cross a partition boundary - first row of each partition is NULL');
console.log('first_value / last_value:', await rows(
  `SELECT id, total,
          first_value(total) OVER (ORDER BY id) AS first,
          last_value(total)  OVER (ORDER BY id) AS last_default_frame
   FROM agg_orders WHERE total IS NOT NULL ORDER BY id`));
console.log('  last_value returns the CURRENT row: the default frame ends at the current row');
console.log('last_value fixed        :', await rows(
  `SELECT id, total,
          last_value(total) OVER (ORDER BY id
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS last
   FROM agg_orders WHERE total IS NOT NULL ORDER BY id`));
console.log('nth_value               :', await rows(
  `SELECT id, nth_value(total, 2) OVER (ORDER BY id
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS second
   FROM agg_orders WHERE total IS NOT NULL ORDER BY id`));
console.log('lag over a gapless series (the day-over-day pattern):', await rows(
  `SELECT day::date, n, n - lag(n) OVER (ORDER BY day) AS change
   FROM (SELECT date_trunc('day', placed_at) AS day, count(*)::int AS n
         FROM agg_orders GROUP BY 1) d ORDER BY day`));
console.log('  2026-03-02 is missing entirely, so "change" compares 03-01 to 03-03');
await tryq('lag with a non-constant offset',
  `SELECT lag(total, id) OVER (ORDER BY id) FROM agg_orders`);
await tryq('lag without ORDER BY', `SELECT id, lag(total) OVER () FROM agg_orders`);
console.log('  legal, but the "previous row" is whatever order the scan happened to produce');

await pool.end();
console.log('\ndone');
