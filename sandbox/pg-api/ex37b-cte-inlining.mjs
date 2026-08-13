// Phase 6 page 09 — isolates WHICH conditions actually stop a CTE being inlined.
// ex37 showed `(SELECT x FROM r) = (SELECT x FROM r)` returning true and labelled it
// "a single-reference volatile CTE is still materialized" — but that query references r
// TWICE, so the multiple-reference rule alone explains it. Volatility was never isolated.
// Here the evidence is the plan itself: an inlined CTE has NO "CTE <name>" node.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 4});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

const plan = async (sql) => (await q(`EXPLAIN (COSTS OFF) ${sql}`)).rows.map(r => r['QUERY PLAN']).join('\n');

// An inlined CTE leaves no trace: the planner folds it into the outer query, so there is
// no "CTE name" line and no "CTE Scan". A fenced one shows both.
const inlined = async (label, sql) => {
  try {
    const p = await plan(sql);
    const fenced = /^\s*CTE \w+/m.test(p);
    console.log(`${label.padEnd(52)} ${fenced ? 'MATERIALIZED (fenced)' : 'inlined'}`);
    return p;
  } catch (e) { console.log(`${label.padEnd(52)} ->  ${e.code} ${e.message.split('\n')[0]}`); }
};

const has = await q(`SELECT to_regclass('agg_events') IS NOT NULL AS ok`);
if (!has.rows[0].ok) { console.log('run ex36-aggregation.mjs first'); process.exit(1); }

line('A. what decides inlining — one variable at a time');
await inlined('1 reference, plain',
  `WITH e AS (SELECT * FROM agg_events) SELECT count(*) FROM e WHERE kind='refund'`);
await inlined('2 references, plain',
  `WITH e AS (SELECT kind FROM agg_events) SELECT (SELECT count(*) FROM e), (SELECT count(*) FROM e)`);
await inlined('2 references, NOT MATERIALIZED',
  `WITH e AS NOT MATERIALIZED (SELECT kind FROM agg_events) SELECT (SELECT count(*) FROM e), (SELECT count(*) FROM e)`);
await inlined('1 reference, MATERIALIZED',
  `WITH e AS MATERIALIZED (SELECT * FROM agg_events) SELECT count(*) FROM e WHERE kind='refund'`);
await inlined('1 reference, VOLATILE function in the target list',
  `WITH r AS (SELECT random() AS x FROM agg_events) SELECT count(*) FROM r WHERE x >= 0`);
await inlined('1 reference, STABLE function (now())',
  `WITH r AS (SELECT now() AS t FROM agg_events) SELECT count(*) FROM r WHERE t IS NOT NULL`);
await inlined('1 reference, VOLATILE in WHERE',
  `WITH r AS (SELECT id FROM agg_events WHERE random() < 0.5) SELECT count(*) FROM r`);
await inlined('1 reference, data-modifying',
  `WITH d AS (INSERT INTO agg_audit (what, order_id) VALUES ('probe2', 1) RETURNING id) SELECT count(*) FROM d`);
await inlined('1 reference, contains LIMIT',
  `WITH e AS (SELECT * FROM agg_events ORDER BY id LIMIT 10) SELECT count(*) FROM e WHERE kind='refund'`);
await inlined('recursive, 1 reference',
  `WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i+1 FROM n WHERE i < 5) SELECT count(*) FROM n`);

line('B. the volatile question ex37 could not answer');
// Referenced ONCE, but the value read twice from the outer query. If the CTE were
// inlined, random() would be re-evaluated per reference and the two would differ.
console.log('1 reference, value compared to itself:',
  JSON.stringify((await q(`WITH r AS (SELECT random() AS x) SELECT x = x AS same FROM r`)).rows));
console.log('2 references (the ex37 query)        :',
  JSON.stringify((await q(`WITH r AS (SELECT random() AS x) SELECT (SELECT x FROM r) = (SELECT x FROM r) AS same`)).rows));
console.log('2 refs, NOT MATERIALIZED             :',
  JSON.stringify((await q(`WITH r AS NOT MATERIALIZED (SELECT random() AS x)
                           SELECT (SELECT x FROM r) = (SELECT x FROM r) AS same`)).rows));
console.log('  ^ if NOT MATERIALIZED runs it twice, two independent random() values -> false');

line('C. does inlining change the answer? (it must not)');
console.log('LIMIT inside an inlined CTE stays a LIMIT:', JSON.stringify((await q(
  `WITH e AS (SELECT id FROM agg_events ORDER BY id LIMIT 10)
   SELECT count(*)::int AS n FROM e WHERE id > 5`)).rows));
console.log('  10 rows survive the CTE, then the filter -> 5, NOT "first 10 rows with id>5"');

line('D. the fence people actually rely on: OFFSET 0');
await inlined('1 reference, OFFSET 0 (the pre-12 idiom)',
  `WITH e AS (SELECT * FROM agg_events OFFSET 0) SELECT count(*) FROM e WHERE kind='refund'`);

// E. "no CTE node" is NOT the same as "the filter reached the scan". The detector above
// only answers the first question. These four plans answer the second, and two of them
// disagree with the one-word verdict — which is the whole point of printing them.
line('E. the plans behind the verdicts');
const show = async (t, s) => {
  try { console.log(`\n  -- ${t}\n` + (await plan(s)).split('\n').map(l => '    ' + l).join('\n')); }
  catch (e) { console.log(`\n  -- ${t}\n    -> ${e.code} ${e.message.split('\n')[0]}`); }
};
await show('plain single-reference CTE — filter reaches the scan, plan goes parallel',
  `WITH e AS (SELECT * FROM agg_events) SELECT count(*) FROM e WHERE kind='refund'`);
await show('volatile CTE + NOT MATERIALIZED — can the hint override volatility?',
  `WITH r AS NOT MATERIALIZED (SELECT random() AS x FROM agg_events) SELECT count(*) FROM r WHERE x >= 0`);
await show('OFFSET 0 — no CTE node, but the filter is stuck above a Subquery Scan',
  `WITH e AS (SELECT * FROM agg_events OFFSET 0) SELECT count(*) FROM e WHERE kind='refund'`);
await show('LIMIT inside the CTE — filter sits above the Limit, so semantics are preserved',
  `WITH e AS (SELECT * FROM agg_events ORDER BY id LIMIT 10) SELECT count(*) FROM e WHERE kind='refund'`);

// F. scope and placement — what a CTE name is visible to, and where WITH may be attached.
line('F. scope and placement');
const tryq = async (label, sql) => {
  try { const r = await q(sql); console.log(`${label.padEnd(52)} ok  ${JSON.stringify(r.rows.slice(0, 3))}`); }
  catch (e) { console.log(`${label.padEnd(52)} ->  ${e.code} ${e.message.split('\n')[0]}`); }
};
await tryq('a later CTE sees an earlier one',
  `WITH a AS (SELECT 1 AS x), b AS (SELECT x + 1 AS y FROM a) SELECT y FROM b`);
await tryq('an earlier CTE sees a later one (forward reference)',
  `WITH a AS (SELECT y FROM b), b AS (SELECT 1 AS y) SELECT * FROM a`);
await tryq('WITH RECURSIVE allows the forward reference',
  `WITH RECURSIVE a AS (SELECT y FROM b), b AS (SELECT 1 AS y) SELECT * FROM a`);
await tryq('a CTE name shadows a real table',
  `WITH agg_customers AS (SELECT 99 AS id, 'shadow' AS name) SELECT id, name FROM agg_customers`);
await tryq('two CTEs with the same name',
  `WITH a AS (SELECT 1 AS x), a AS (SELECT 2 AS x) SELECT * FROM a`);
await tryq('a sibling CTE referenced from the recursive term of another',
  `WITH RECURSIVE seed AS (SELECT 1 AS i),
        n AS (SELECT i FROM seed UNION ALL SELECT i+1 FROM n WHERE i < 3)
   SELECT count(*)::int AS n FROM n`);
await tryq('WITH attached to an UPDATE',
  `WITH pick AS (SELECT id FROM agg_orders ORDER BY id LIMIT 1)
   UPDATE agg_orders SET total = total WHERE id IN (SELECT id FROM pick) RETURNING id`);
await tryq('WITH attached to a DELETE',
  `WITH none AS (SELECT id FROM agg_orders WHERE false)
   DELETE FROM agg_orders WHERE id IN (SELECT id FROM none) RETURNING id`);
await tryq('a CTE referenced inside a scalar subquery in the target list',
  `WITH k AS (SELECT count(*)::int AS n FROM agg_orders) SELECT (SELECT n FROM k) AS orders`);
await tryq('CTE column aliases declared on the name',
  `WITH t (a, b) AS (SELECT 1, 2) SELECT a + b AS sum FROM t`);
await tryq('wrong number of column aliases',
  `WITH t (a, b, c) AS (SELECT 1, 2) SELECT * FROM t`);

await pool.end();
console.log('\ndone');
