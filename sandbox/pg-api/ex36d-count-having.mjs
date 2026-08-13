// Phase 6 topics 02-04 — count variants, HAVING, FILTER: the measurements the main
// scripts did not cover. Depends on the ex36 fixture (agg_* tables, agg_events 500k).
import pg from 'pg';

const pool = new pg.Pool({connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 4});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const jj = (v) => JSON.stringify(v);
const rows = async (sql) => jj((await q(sql)).rows);
const tryq = async (label, sql) => {
  try { const r = await q(sql); console.log(`${label.padEnd(46)} ok  rows=${r.rowCount} ${jj(r.rows.slice(0, 3))}`); }
  catch (e) { console.log(`${label.padEnd(46)} ->  ${e.code} ${e.message.split('\n')[0]}`); }
};
const planOf = async (sql) => {
  const p = (await q(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) ${sql}`)).rows.map(r => r['QUERY PLAN']).join('\n');
  return [p, Number(p.match(/Execution Time: ([\d.]+) ms/)[1])];
};
const timed = async (label, sql, n = 3) => {
  await q(sql);
  const runs = [];
  for (let i = 0; i < n; i++) runs.push((await planOf(sql))[1]);
  const [p] = await planOf(sql);
  const top = p.split('\n').filter(l => /Aggregate|Scan|Sort|Gather|Unique|Group/.test(l))
    .map(l => l.trim().replace(/^->\s*/, '').split('  (')[0]).slice(0, 3).join(' / ');
  const buf = p.match(/Buffers: shared hit=(\d+)/)?.[1] ?? '?';
  console.log(`${label.padEnd(34)} ${Math.min(...runs).toFixed(2).padStart(8)} ms  buffers=${String(buf).padEnd(6)} ${top}`);
};

line('D1. count(*) vs count(1) vs count(col) — is the folklore true?');
await timed('count(*)',        `SELECT count(*) FROM agg_events`);
await timed('count(1)',        `SELECT count(1) FROM agg_events`);
await timed('count(id)',       `SELECT count(id) FROM agg_events`);
await timed('count(amount)',   `SELECT count(amount) FROM agg_events`);
console.log('values           :', await rows(
  `SELECT count(*)::int AS star, count(1)::int AS one,
          count(id)::int AS pk, count(amount)::int AS nullable FROM agg_events`));
{
  const [p] = await planOf(`SELECT count(*) FROM agg_events`);
  console.log('\n  count(*) plan:');
  console.log(p.split('\n').map(l => '  ' + l).join('\n'));
}

line('D2. count(DISTINCT) over more than one column');
console.log('two columns as a row  :', await rows(
  `SELECT count(DISTINCT (kind, user_id % 3))::int AS pairs FROM agg_events`));
await tryq('count(DISTINCT a, b) without parens', `SELECT count(DISTINCT kind, user_id) FROM agg_events`);
console.log('null inside the row   :', await rows(
  `SELECT count(*)::int AS rows, count(DISTINCT (status, coupon))::int AS pairs,
          count(DISTINCT status)::int AS statuses
   FROM agg_orders WHERE id < 16`));

line('D3. counting under join fan-out');
console.log('no join               :', await rows(
  `SELECT count(*)::int AS orders, sum(total)::int AS revenue FROM agg_orders WHERE id < 16`));
console.log('joined to items       :', await rows(
  `SELECT count(*)::int AS rows, count(DISTINCT o.id)::int AS distinct_orders,
          sum(o.total)::int AS inflated_revenue,
          sum(DISTINCT o.total)::int AS distinct_sum_also_wrong
   FROM agg_orders o JOIN agg_items i ON i.order_id = o.id WHERE o.id < 16`));
console.log('  count(DISTINCT o.id) survives fan-out; sum() does not, and sum(DISTINCT) is');
console.log('  not a fix - it collapses two orders that happen to share a total');
console.log('the correct shape     :', await rows(
  `SELECT count(*)::int AS orders, sum(o.total)::int AS revenue,
          sum(i.items)::int AS item_rows
   FROM agg_orders o
   LEFT JOIN LATERAL (SELECT count(*)::int AS items FROM agg_items i WHERE i.order_id = o.id) i ON true
   WHERE o.id < 16`));

line('D4. count(*) vs count(col) across a LEFT JOIN, in full');
console.log(await rows(
  `SELECT c.name,
          count(*)::int          AS star,
          count(o.id)::int       AS orders,
          count(o.total)::int    AS priced_orders,
          coalesce(sum(o.total),0)::int AS spend
   FROM agg_customers c LEFT JOIN agg_orders o ON o.customer_id = c.id AND o.id < 16
   WHERE c.id < 6 GROUP BY c.name ORDER BY c.name`));

line('D5. FILTER vs count(col) vs CASE — do they agree?');
console.log(await rows(
  `SELECT count(*) FILTER (WHERE total IS NOT NULL)::int AS via_filter,
          count(total)::int                             AS via_count_col,
          count(CASE WHEN total IS NOT NULL THEN 1 END)::int AS via_case,
          sum(CASE WHEN total IS NOT NULL THEN 1 ELSE 0 END)::int AS via_sum_case
   FROM agg_orders WHERE id < 16`));
console.log('on an EMPTY set       :', await rows(
  `SELECT count(*) FILTER (WHERE total > 0)::int AS cnt_filter,
          sum(total) FILTER (WHERE total > 0)    AS sum_filter,
          sum(CASE WHEN total > 0 THEN total ELSE 0 END) AS sum_case_else0
   FROM agg_orders WHERE status = 'refunded'`));
console.log('  over ZERO rows even sum(CASE..ELSE 0) is NULL - the ELSE only fires per row.');
console.log('  contrast with ex36 section 4, where 6 rows existed and none matched: there');
console.log('  sum(CASE..ELSE 0) returned 0 and sum() FILTER returned NULL.');

line('D6. HAVING vs WHERE — same answer, different work');
await timed('WHERE kind=purchase, group',
  `SELECT user_id, count(*) FROM agg_events WHERE kind = 'purchase' GROUP BY user_id`);
await timed('group by both, HAVING kind',
  `SELECT user_id, count(*) FROM agg_events GROUP BY user_id, kind HAVING kind = 'purchase'`);
await timed('HAVING count(*) > 50',
  `SELECT user_id, count(*) FROM agg_events GROUP BY user_id HAVING count(*) > 50`);
console.log('rows returned    :', await rows(
  `SELECT (SELECT count(*)::int FROM (SELECT user_id FROM agg_events GROUP BY user_id) s) AS all_groups,
          (SELECT count(*)::int FROM (SELECT user_id FROM agg_events GROUP BY user_id HAVING count(*) > 50) s) AS kept`));

line('D7. HAVING edge cases');
// pinned to id < 16 to match the 6-order fixture topics 01-08 are written against
await tryq('HAVING with no GROUP BY, true',  `SELECT count(*)::int FROM agg_orders WHERE id < 16 HAVING count(*) > 3`);
await tryq('HAVING with no GROUP BY, false', `SELECT count(*)::int FROM agg_orders WHERE id < 16 HAVING count(*) > 99`);
await tryq('HAVING a grouped column',        `SELECT status, count(*)::int FROM agg_orders WHERE id < 16 GROUP BY status HAVING status <> 'paid'`);
await tryq('HAVING an ungrouped column',     `SELECT status, count(*) FROM agg_orders WHERE id < 16 GROUP BY status HAVING coupon IS NULL`);
await tryq('HAVING an output alias',         `SELECT status, count(*) AS n FROM agg_orders WHERE id < 16 GROUP BY status HAVING n > 1`);
await tryq('WHERE with an aggregate',        `SELECT status FROM agg_orders WHERE count(*) > 1 GROUP BY status`);
await tryq('HAVING referencing a DIFFERENT aggregate',
  `SELECT status, count(*)::int AS n FROM agg_orders WHERE id < 16 GROUP BY status HAVING sum(total) > 100`);
console.log('  ^ legal: HAVING may use any aggregate, not only the ones in the select list');

await pool.end();
console.log('\ndone');
