// Phase 6 pages 09-16 — CTEs and inlining, data-modifying CTEs, subqueries,
// counting for pagination, ordered-set aggregates, window frames, recursive CTEs,
// GROUPING SETS / ROLLUP / CUBE.
// Depends on the fixture built by ex36-aggregation.mjs (agg_customers/orders/items,
// agg_events with 500k rows). Run that first.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 8});
pool.on('error', (e) => console.log('pool error event:', e.code, e.message));
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const err = (e) => `${e.code} ${e.message.split('\n')[0]}`;
const jj = (v) => JSON.stringify(v);
const rows = async (sql, p) => jj((await q(sql, p)).rows);
const tryq = async (label, sql) => {
  try { const r = await q(sql); console.log(`${label.padEnd(44)} ok  rows=${r.rowCount} ${jj(r.rows.slice(0, 3))}`); }
  catch (e) { console.log(`${label.padEnd(44)} ->  ${err(e)}`); }
};
const planOf = async (sql) => {
  const p = (await q(`EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) ${sql}`)).rows.map(r => r['QUERY PLAN']).join('\n');
  return [p, Number(p.match(/Execution Time: ([\d.]+) ms/)?.[1])];
};
const fullPlan = async (title, sql) => {
  console.log(`\n  -- ${title}`);
  await q(sql);
  const [p, t] = await planOf(sql);
  console.log(p.split('\n').map(l => '  ' + l).join('\n'));
};
const timed = async (sql, n = 3) => {
  await q(sql);
  const ts = [];
  for (let i = 0; i < n; i++) ts.push((await planOf(sql))[1]);
  return Math.min(...ts).toFixed(2);
};

const has = await q(`SELECT to_regclass('agg_events') IS NOT NULL AS ok`);
if (!has.rows[0].ok) { console.log('run ex36-aggregation.mjs first'); process.exit(1); }
console.log('using the ex36 fixture: agg_customers/agg_orders/agg_items + agg_events (500k)');

// --- 9. CTEs and the inlining rule ------------------------------------------
line('9. WITH — a name for a subquery, and whether it is a fence');
console.log('plain CTE               :', await rows(
  `WITH paid AS (SELECT * FROM agg_orders WHERE status = 'paid')
   SELECT customer_id, count(*)::int AS n, sum(total)::int AS spend
   FROM paid GROUP BY customer_id ORDER BY customer_id`));
console.log('chained CTEs            :', await rows(
  `WITH paid AS (SELECT * FROM agg_orders WHERE status = 'paid'),
        per_cust AS (SELECT customer_id, sum(total)::int AS spend FROM paid GROUP BY customer_id)
   SELECT c.name, p.spend FROM per_cust p JOIN agg_customers c ON c.id = p.customer_id
   ORDER BY p.spend DESC`));
await fullPlan('9a. CTE used once — inlined (PG12+), the WHERE reaches the scan',
  `WITH e AS (SELECT * FROM agg_events)
   SELECT count(*) FROM e WHERE kind = 'refund' AND amount > 800`);
await fullPlan('9b. same CTE marked MATERIALIZED — a fence, filter applied after',
  `WITH e AS MATERIALIZED (SELECT * FROM agg_events)
   SELECT count(*) FROM e WHERE kind = 'refund' AND amount > 800`);
console.log('  inlined :', await timed(
  `WITH e AS (SELECT * FROM agg_events) SELECT count(*) FROM e WHERE kind='refund' AND amount>800`), 'ms');
console.log('  MATERIALIZED :', await timed(
  `WITH e AS MATERIALIZED (SELECT * FROM agg_events) SELECT count(*) FROM e WHERE kind='refund' AND amount>800`), 'ms');
await fullPlan('9c. CTE referenced TWICE — materialized automatically',
  `WITH k AS (SELECT kind, count(*) AS n FROM agg_events GROUP BY kind)
   SELECT a.kind, a.n, b.n AS other FROM k a JOIN k b ON b.kind <> a.kind`);
await fullPlan('9d. ...forced back to inline with NOT MATERIALIZED (runs the CTE twice)',
  `WITH k AS NOT MATERIALIZED (SELECT kind, count(*) AS n FROM agg_events GROUP BY kind)
   SELECT a.kind, a.n, b.n AS other FROM k a JOIN k b ON b.kind <> a.kind`);
await tryq('CTE with a volatile function is never inlined',
  `WITH r AS (SELECT random() AS x) SELECT (SELECT x FROM r) = (SELECT x FROM r) AS same`);
console.log('  ^ true: a single-reference volatile CTE still gets materialized, so both reads see one value');

// --- 10. data-modifying CTEs ------------------------------------------------
line('10. data-modifying CTEs — one statement, several writes');
await q(`DROP TABLE IF EXISTS agg_archive, agg_audit CASCADE`);
await q(`CREATE TABLE agg_archive (LIKE agg_orders INCLUDING DEFAULTS)`);
await q(`CREATE TABLE agg_audit (id serial PRIMARY KEY, what text, order_id int, at timestamptz DEFAULT now())`);
console.log('before                  :', await rows(
  `SELECT count(*)::int AS orders FROM agg_orders`));
console.log('move cancelled to archive:', await rows(
  `WITH moved AS (DELETE FROM agg_orders WHERE status = 'cancelled' RETURNING *)
   INSERT INTO agg_archive SELECT * FROM moved RETURNING id, status`));
console.log('after                   :', await rows(
  `SELECT (SELECT count(*)::int FROM agg_orders) AS orders,
          (SELECT count(*)::int FROM agg_archive) AS archived`));
console.log('the snapshot rule — a sibling SELECT does NOT see the CTE write:');
console.log('  ', await rows(
  `WITH ins AS (INSERT INTO agg_audit (what, order_id) VALUES ('probe', 10) RETURNING id)
   SELECT (SELECT count(*)::int FROM agg_audit) AS visible_to_sibling,
          (SELECT count(*)::int FROM ins)       AS visible_via_returning`));
console.log('  after the statement   :', await rows(`SELECT count(*)::int AS audit_rows FROM agg_audit`));
console.log('upsert + audit in one   :', await rows(
  `WITH up AS (
     INSERT INTO agg_orders (id, customer_id, status, total, coupon, placed_at)
     VALUES (13, 3, 'cancelled', 0, NULL, '2026-03-04 08:05+00')
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
     RETURNING id, (xmax = 0) AS inserted)
   INSERT INTO agg_audit (what, order_id)
   SELECT CASE WHEN inserted THEN 'insert' ELSE 'update' END, id FROM up
   RETURNING what, order_id`));
await tryq('two CTEs writing the same row',
  `WITH a AS (UPDATE agg_orders SET total = 1 WHERE id = 10 RETURNING id),
        b AS (UPDATE agg_orders SET total = 2 WHERE id = 10 RETURNING id)
   SELECT (SELECT count(*) FROM a) AS a, (SELECT count(*) FROM b) AS b`);
console.log('  value now             :', await rows(`SELECT id, total FROM agg_orders WHERE id = 10`));
console.log('  ^ both UPDATEs ran against the same snapshot; one of them silently lost');
await q(`UPDATE agg_orders SET total = 100 WHERE id = 10`);
await tryq('a CTE nobody references still runs',
  `WITH dead AS (INSERT INTO agg_audit (what, order_id) VALUES ('unreferenced', 99) RETURNING id)
   SELECT 1 AS ignored`);
console.log('  audit rows            :', await rows(`SELECT what, order_id FROM agg_audit ORDER BY id`));

// --- 11. subqueries ---------------------------------------------------------
line('11. scalar, row, and correlated subqueries');
console.log('scalar subquery         :', await rows(
  `SELECT id, total, (SELECT round(avg(total),2) FROM agg_orders) AS avg_all
   FROM agg_orders WHERE total IS NOT NULL ORDER BY id LIMIT 3`));
await tryq('scalar subquery returning 2 rows',
  `SELECT id, (SELECT status FROM agg_orders) FROM agg_orders LIMIT 1`);
console.log('correlated subquery     :', await rows(
  `SELECT c.name, (SELECT count(*)::int FROM agg_orders o WHERE o.customer_id = c.id) AS n
   FROM agg_customers c ORDER BY c.name`));
console.log('  Eve gets 0, not NULL — count() over an empty set is 0');
console.log('correlated sum vs Eve   :', await rows(
  `SELECT c.name, (SELECT sum(o.total)::int FROM agg_orders o WHERE o.customer_id = c.id) AS spend
   FROM agg_customers c ORDER BY c.name`));
console.log('  but sum() over an empty set is NULL — the two aggregates differ here');
console.log('row constructor         :', await rows(
  `SELECT id, status, total FROM agg_orders WHERE (status, total) = ('paid', 200) ORDER BY id`));
console.log('IN / = ANY / EXISTS same answer:', await rows(
  `SELECT (SELECT count(*)::int FROM agg_customers WHERE id IN (SELECT customer_id FROM agg_orders)) AS in_,
          (SELECT count(*)::int FROM agg_customers WHERE id = ANY (SELECT customer_id FROM agg_orders)) AS any_,
          (SELECT count(*)::int FROM agg_customers c WHERE EXISTS (SELECT 1 FROM agg_orders o WHERE o.customer_id = c.id)) AS exists_`));
{
  const corr = `SELECT u.user_id, (SELECT count(*) FROM agg_events e WHERE e.user_id = u.user_id) AS n
                FROM (SELECT DISTINCT user_id FROM agg_events) u`;
  const grp  = `SELECT user_id, count(*) AS n FROM agg_events GROUP BY user_id`;
  console.log('correlated, 5000 probes :', await timed(corr), 'ms');
  console.log('one GROUP BY            :', await timed(grp), 'ms');
  await fullPlan('11a. the correlated plan — SubPlan re-executed per row', corr);
}
console.log('NOT IN with a NULL      :', await rows(
  `SELECT count(*)::int AS n FROM agg_customers
   WHERE id NOT IN (SELECT customer_id FROM agg_orders)`));
// NB: this narration used to claim "0 rows" and was stale — section 10 above deletes and
// re-inserts order 13, so by this point every customer except Eve has an order and the
// honest answer is 1. Now force a NULL customer_id into the subquery and watch it go to 0.
console.log('  ^ Eve is the only customer with no orders; no NULL customer_id yet. Now force one:');
await q(`INSERT INTO agg_orders VALUES (16, NULL, 'open', 5, NULL, '2026-03-06 10:00+00')`);
console.log('NOT IN, now with a NULL :', await rows(
  `SELECT count(*)::int AS n FROM agg_customers WHERE id NOT IN (SELECT customer_id FROM agg_orders)`));
console.log('NOT EXISTS, same data   :', await rows(
  `SELECT count(*)::int AS n FROM agg_customers c
   WHERE NOT EXISTS (SELECT 1 FROM agg_orders o WHERE o.customer_id = c.id)`));

// --- 12. counting for pagination -------------------------------------------
line('12. how much does "total: N" cost?');
console.log('exact count             :', await timed(`SELECT count(*) FROM agg_events WHERE kind='purchase'`), 'ms');
console.log('page only, limit 20     :', await timed(`SELECT id FROM agg_events WHERE kind='purchase' ORDER BY id LIMIT 20`), 'ms');
console.log('limit+1 has-more        :', await timed(`SELECT id FROM agg_events WHERE kind='purchase' ORDER BY id LIMIT 21`), 'ms');
console.log('count(*) OVER () + page :', await timed(
  `SELECT id, count(*) OVER ()::int AS total FROM agg_events WHERE kind='purchase' ORDER BY id LIMIT 20`), 'ms');
{
  const est = (await q(`EXPLAIN (FORMAT JSON) SELECT * FROM agg_events WHERE kind='purchase'`))
    .rows[0]['QUERY PLAN'][0].Plan['Plan Rows'];
  const actual = (await q(`SELECT count(*)::int n FROM agg_events WHERE kind='purchase'`)).rows[0].n;
  console.log(`planner estimate        : ${est} vs actual ${actual}  (${(est / actual * 100).toFixed(1)}%)`);
}
console.log('reltuples (free, stale) :', await rows(
  `SELECT reltuples::bigint AS reltuples, relpages FROM pg_class WHERE relname = 'agg_events'`));
console.log('the "exact up to a cap" hybrid:', await rows(
  `SELECT count(*)::int AS n, count(*) = 1000 AS capped
   FROM (SELECT 1 FROM agg_events WHERE kind='purchase' LIMIT 1000) s`));
console.log('the same, for a rare filter:', await rows(
  `SELECT count(*)::int AS n, count(*) = 1000 AS capped
   FROM (SELECT 1 FROM agg_events WHERE kind='refund' AND amount > 890 LIMIT 1000) s`));

// --- 13. ordered-set and boolean aggregates ---------------------------------
line('13. ordered-set aggregates and the boolean pair');
console.log('percentiles             :', await rows(
  `SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)::numeric, 2) AS p50_cont,
          percentile_disc(0.5) WITHIN GROUP (ORDER BY amount) AS p50_disc,
          round(percentile_cont(0.95) WITHIN GROUP (ORDER BY amount)::numeric, 2) AS p95,
          round(avg(amount), 2) AS mean
   FROM agg_events`));
console.log('cont vs disc on 4 values:', await rows(
  `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v) AS cont,
          percentile_disc(0.5) WITHIN GROUP (ORDER BY v) AS disc
   FROM (VALUES (1.0),(2.0),(3.0),(4.0)) t(v)`));
console.log('  cont interpolates (2.5), disc returns an actual value from the set (2.0)');
console.log('several percentiles, one pass:', await rows(
  `SELECT percentile_cont(ARRAY[0.5,0.9,0.99]) WITHIN GROUP (ORDER BY amount) AS p
   FROM agg_events`));
console.log('mode()                  :', await rows(
  `SELECT mode() WITHIN GROUP (ORDER BY kind) AS commonest FROM agg_events`));
console.log('bool_and / bool_or      :', await rows(
  `SELECT customer_id,
          bool_and(status = 'paid') AS all_paid,
          bool_or(status = 'paid')  AS any_paid,
          count(*) FILTER (WHERE status <> 'paid')::int AS unpaid
   FROM agg_orders GROUP BY customer_id ORDER BY customer_id`));
console.log('bool_and over an empty set:', await rows(
  `SELECT bool_and(status = 'paid') AS all_paid FROM agg_orders WHERE customer_id = 999`));
console.log('  NULL, not true — the vacuous-truth answer people expect from "all" is not what you get');
console.log('percentile ignores NULL :', await rows(
  `SELECT count(*)::int AS rows, count(amount)::int AS non_null,
          percentile_disc(1.0) WITHIN GROUP (ORDER BY amount) AS max_via_pct,
          max(amount) AS max_via_max
   FROM agg_events`));
console.log('hypothetical-set        :', await rows(
  `SELECT rank(150) WITHIN GROUP (ORDER BY amount) AS rank_of_150,
          percent_rank(150) WITHIN GROUP (ORDER BY amount)::numeric(6,4) AS pct
   FROM agg_events`));
console.log('per-group percentile    :', await rows(
  `SELECT kind, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)::numeric,1) AS p50
   FROM agg_events GROUP BY kind ORDER BY kind`));
console.log('percentile cost, 500k   :', await timed(
  `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY amount) FROM agg_events`), 'ms  <- must sort');
console.log('avg cost, 500k          :', await timed(`SELECT avg(amount) FROM agg_events`), 'ms');

// --- 14. frames -------------------------------------------------------------
line('14. frame clauses — what "the rows so far" actually means');
await q(`DROP TABLE IF EXISTS agg_tick CASCADE`);
await q(`CREATE TABLE agg_tick (id int PRIMARY KEY, day date, amt int)`);
await q(`INSERT INTO agg_tick VALUES
  (1,'2026-03-01',10),(2,'2026-03-01',20),(3,'2026-03-02',30),
  (4,'2026-03-03',40),(5,'2026-03-03',50),(6,'2026-03-04',60)`);
console.log('default frame is RANGE, and peers share a value:', await rows(
  `SELECT id, day, amt,
          sum(amt) OVER (ORDER BY day) AS range_default,
          sum(amt) OVER (ORDER BY day ROWS UNBOUNDED PRECEDING) AS rows_frame
   FROM agg_tick ORDER BY id`));
console.log('  rows 1 and 2 are peers on 2026-03-01: RANGE gives both 30, ROWS gives 10 then 30');
console.log('moving average, 3 rows  :', await rows(
  `SELECT id, amt, round(avg(amt) OVER (ORDER BY id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) AS ma3
   FROM agg_tick ORDER BY id`));
console.log('  the first two rows average over 1 and 2 rows — a partial window, not NULL');
console.log('centred frame           :', await rows(
  `SELECT id, amt, sum(amt) OVER (ORDER BY id ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) AS around
   FROM agg_tick ORDER BY id`));
console.log('RANGE with a value offset:', await rows(
  `SELECT id, day, amt,
          sum(amt) OVER (ORDER BY day RANGE BETWEEN '1 day' PRECEDING AND CURRENT ROW) AS last_2_days
   FROM agg_tick ORDER BY id`));
console.log('GROUPS frame            :', await rows(
  `SELECT id, day, amt, sum(amt) OVER (ORDER BY day GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW) AS two_days
   FROM agg_tick ORDER BY id`));
console.log('EXCLUDE CURRENT ROW     :', await rows(
  `SELECT id, amt,
          sum(amt) OVER (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS all_,
          sum(amt) OVER (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                         EXCLUDE CURRENT ROW) AS others
   FROM agg_tick ORDER BY id`));
console.log('EXCLUDE TIES / GROUP    :', await rows(
  `SELECT id, day, amt,
          count(*) OVER (ORDER BY day RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                         EXCLUDE GROUP)::int AS not_my_day
   FROM agg_tick ORDER BY id`));
await tryq('frame without ORDER BY',
  `SELECT sum(amt) OVER (ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM agg_tick`);
await tryq('RANGE offset without a single ORDER BY column',
  `SELECT sum(amt) OVER (ORDER BY day, id RANGE BETWEEN '1 day' PRECEDING AND CURRENT ROW) FROM agg_tick`);

// --- 15. recursive CTEs -----------------------------------------------------
line('15. WITH RECURSIVE — trees, paths and cycles');
await q(`DROP TABLE IF EXISTS agg_cat CASCADE`);
await q(`CREATE TABLE agg_cat (id int PRIMARY KEY, parent_id int REFERENCES agg_cat(id), name text)`);
await q(`INSERT INTO agg_cat VALUES
  (1,NULL,'root'),(2,1,'electronics'),(3,1,'books'),(4,2,'phones'),
  (5,2,'laptops'),(6,4,'android'),(7,4,'ios'),(8,3,'fiction')`);
console.log('descend from root       :', await rows(
  `WITH RECURSIVE t AS (
     SELECT id, parent_id, name, 0 AS depth, name::text AS path
     FROM agg_cat WHERE parent_id IS NULL
     UNION ALL
     SELECT c.id, c.parent_id, c.name, t.depth + 1, t.path || ' > ' || c.name
     FROM agg_cat c JOIN t ON c.parent_id = t.id)
   SELECT depth, path FROM t ORDER BY path`));
console.log('climb to the root       :', await rows(
  `WITH RECURSIVE up AS (
     SELECT id, parent_id, name FROM agg_cat WHERE id = 6
     UNION ALL
     SELECT c.id, c.parent_id, c.name FROM agg_cat c JOIN up ON up.parent_id = c.id)
   SELECT id, name FROM up`));
console.log('subtree aggregate       :', await rows(
  `WITH RECURSIVE sub AS (
     SELECT id FROM agg_cat WHERE id = 2
     UNION ALL SELECT c.id FROM agg_cat c JOIN sub ON c.parent_id = sub.id)
   SELECT count(*)::int AS nodes_including_self FROM sub`));
await fullPlan('15a. the plan — Recursive Union with a Worktable Scan',
  `WITH RECURSIVE t AS (
     SELECT id, 0 AS d FROM agg_cat WHERE parent_id IS NULL
     UNION ALL SELECT c.id, t.d+1 FROM agg_cat c JOIN t ON c.parent_id = t.id)
   SELECT count(*) FROM t`);
console.log('now introduce a cycle: 1 -> 8');
await q(`UPDATE agg_cat SET parent_id = 8 WHERE id = 1`);
await tryq('unguarded recursion with a cycle',
  `WITH RECURSIVE t AS (
     SELECT id, 0 AS d FROM agg_cat WHERE id = 1
     UNION ALL SELECT c.id, t.d+1 FROM agg_cat c JOIN t ON c.parent_id = t.id WHERE t.d < 40)
   SELECT count(*)::int AS rows_before_the_depth_guard_stopped_it FROM t`);
console.log('UNION (not ALL) dedupes and terminates:', await rows(
  `WITH RECURSIVE t AS (
     SELECT id FROM agg_cat WHERE id = 1
     UNION SELECT c.id FROM agg_cat c JOIN t ON c.parent_id = t.id)
   SELECT count(*)::int AS n FROM t`));
console.log('the CYCLE clause (PG 14+):', await rows(
  `WITH RECURSIVE t AS (
     SELECT id, name FROM agg_cat WHERE id = 1
     UNION ALL SELECT c.id, c.name FROM agg_cat c JOIN t ON c.parent_id = t.id)
   CYCLE id SET is_cycle USING path
   SELECT id, name, is_cycle FROM t ORDER BY id, is_cycle`));
console.log('the SEARCH clause       :', await rows(
  `WITH RECURSIVE t AS (
     SELECT id, name FROM agg_cat WHERE id = 2
     UNION ALL SELECT c.id, c.name FROM agg_cat c JOIN t ON c.parent_id = t.id)
   SEARCH DEPTH FIRST BY id SET ord
   SELECT id, name FROM t ORDER BY ord`));
await q(`UPDATE agg_cat SET parent_id = NULL WHERE id = 1`);
console.log('generate_series via recursion (and why you would not):', await rows(
  `WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i+1 FROM n WHERE i < 5)
   SELECT array_agg(i) AS xs FROM n`));
await tryq('recursive term referencing the CTE twice',
  `WITH RECURSIVE t AS (SELECT 1 AS i UNION ALL SELECT a.i+1 FROM t a, t b WHERE a.i < 3)
   SELECT count(*) FROM t`);
await tryq('aggregate in the recursive term',
  `WITH RECURSIVE t AS (SELECT 1 AS i UNION ALL SELECT max(i)+1 FROM t WHERE i < 3)
   SELECT count(*) FROM t`);
await tryq('no RECURSIVE keyword',
  `WITH t AS (SELECT 1 AS i UNION ALL SELECT i+1 FROM t WHERE i < 3) SELECT count(*) FROM t`);

// --- 16. GROUPING SETS / ROLLUP / CUBE --------------------------------------
line('16. several aggregations in one pass');
console.log('plain GROUP BY, 2 cols  :', await rows(
  `SELECT c.country, o.status, count(*)::int AS n
   FROM agg_orders o JOIN agg_customers c ON c.id = o.customer_id
   GROUP BY c.country, o.status ORDER BY 1,2`));
console.log('GROUPING SETS           :', await rows(
  `SELECT c.country, o.status, count(*)::int AS n
   FROM agg_orders o JOIN agg_customers c ON c.id = o.customer_id
   GROUP BY GROUPING SETS ((c.country, o.status), (c.country), ())
   ORDER BY 1 NULLS LAST, 2 NULLS LAST`));
console.log('ROLLUP is the same thing:', await rows(
  `SELECT c.country, o.status, count(*)::int AS n
   FROM agg_orders o JOIN agg_customers c ON c.id = o.customer_id
   GROUP BY ROLLUP (c.country, o.status) ORDER BY 1 NULLS LAST, 2 NULLS LAST`));
console.log('CUBE adds every combination:', await rows(
  `SELECT c.country, o.status, count(*)::int AS n
   FROM agg_orders o JOIN agg_customers c ON c.id = o.customer_id
   GROUP BY CUBE (c.country, o.status) ORDER BY 1 NULLS LAST, 2 NULLS LAST`));
console.log('row counts              :', await rows(
  `SELECT (SELECT count(*)::int FROM (SELECT 1 FROM agg_orders o JOIN agg_customers c ON c.id=o.customer_id GROUP BY c.country, o.status) s) AS plain,
          (SELECT count(*)::int FROM (SELECT 1 FROM agg_orders o JOIN agg_customers c ON c.id=o.customer_id GROUP BY ROLLUP (c.country, o.status)) s) AS rollup,
          (SELECT count(*)::int FROM (SELECT 1 FROM agg_orders o JOIN agg_customers c ON c.id=o.customer_id GROUP BY CUBE (c.country, o.status)) s) AS cube`));
console.log('telling a subtotal NULL from a data NULL:');
await q(`INSERT INTO agg_customers VALUES (6, 'Fox', NULL, 'free')`);
await q(`INSERT INTO agg_orders VALUES (17, 6, 'paid', 70, NULL, '2026-03-07 09:00+00')`);
console.log('  ', await rows(
  `SELECT c.country, count(*)::int AS n,
          GROUPING(c.country) AS is_subtotal,
          CASE WHEN GROUPING(c.country) = 1 THEN 'ALL' ELSE coalesce(c.country, '(none)') END AS label
   FROM agg_orders o JOIN agg_customers c ON c.id = o.customer_id
   GROUP BY ROLLUP (c.country) ORDER BY is_subtotal, c.country NULLS LAST`));
await fullPlan('16a. the plan — one scan, MixedAggregate',
  `SELECT kind, count(*) FROM agg_events GROUP BY CUBE (kind)`);
console.log('CUBE over 3 columns, 500k:', await timed(
  `SELECT kind, user_id % 10, amount % 3, count(*) FROM agg_events GROUP BY CUBE (kind, user_id % 10, amount % 3)`), 'ms');
console.log('the 3 separate GROUP BYs:', await timed(
  `SELECT kind, count(*) FROM agg_events GROUP BY kind`), '+',
  await timed(`SELECT user_id % 10, count(*) FROM agg_events GROUP BY 1`), '+',
  await timed(`SELECT amount % 3, count(*) FROM agg_events GROUP BY 1`), 'ms');
await tryq('GROUPING on a column not in any grouping set',
  `SELECT GROUPING(total) FROM agg_orders GROUP BY ROLLUP (status)`);

await pool.end();
console.log('\ndone');
