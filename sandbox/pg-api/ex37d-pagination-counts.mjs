// Phase 6 page 12 — what "total: N" costs, and the alternatives to paying it.
//
// Split out of ex37 because that script's "exact up to a cap" demo used
// kind='refund' AND amount > 890 as its supposedly rare filter — which matches well over
// 1000 rows, so BOTH cases came back capped:true and the uncapped branch was never shown.
// Here the rare filter is rare enough to prove the point.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 4});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const jj = (v) => JSON.stringify(v);
const rows = async (sql, p) => jj((await q(sql, p)).rows);

const planOf = async (sql) => {
  const p = (await q(`EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) ${sql}`))
    .rows.map((r) => r['QUERY PLAN']).join('\n');
  return [p, Number(p.match(/Execution Time: ([\d.]+) ms/)?.[1])];
};
const timed = async (sql, n = 5) => {
  await q(sql);
  const ts = [];
  for (let i = 0; i < n; i++) ts.push((await planOf(sql))[1]);
  return Math.min(...ts).toFixed(2);
};

const has = await q(`SELECT to_regclass('agg_events') IS NOT NULL AS ok`);
if (!has.rows[0].ok) { console.log('run ex36-aggregation.mjs first'); process.exit(1); }
await q(`VACUUM (ANALYZE) agg_events`);   // stable visibility map, per ex37c's lesson

line('A. the four ways to answer "is there a next page?"');
console.log('exact count             :', await timed(
  `SELECT count(*) FROM agg_events WHERE kind='purchase'`), 'ms');
console.log('page only, limit 20     :', await timed(
  `SELECT id FROM agg_events WHERE kind='purchase' ORDER BY id LIMIT 20`), 'ms');
console.log('limit+1 has-more        :', await timed(
  `SELECT id FROM agg_events WHERE kind='purchase' ORDER BY id LIMIT 21`), 'ms');
console.log('count(*) OVER () + page :', await timed(
  `SELECT id, count(*) OVER ()::int AS total FROM agg_events WHERE kind='purchase' ORDER BY id LIMIT 20`), 'ms');

line('B. why count(*) OVER () is the expensive one');
{
  const [p] = await planOf(
    `SELECT id, count(*) OVER ()::int AS total FROM agg_events WHERE kind='purchase' ORDER BY id LIMIT 20`);
  console.log(p.split('\n').filter((l) => /WindowAgg|Limit|Sort|Scan|rows=/.test(l))
    .slice(0, 6).map((l) => '  ' + l.trim()).join('\n'));
  console.log('  ^ the WindowAgg must see every matching row before it can emit the first one');
}

line('C. the planner already has an estimate, for free');
{
  const est = (await q(`EXPLAIN (FORMAT JSON) SELECT * FROM agg_events WHERE kind='purchase'`))
    .rows[0]['QUERY PLAN'][0].Plan['Plan Rows'];
  const actual = (await q(`SELECT count(*)::int n FROM agg_events WHERE kind='purchase'`)).rows[0].n;
  console.log(`planner estimate        : ${est} vs actual ${actual}  (${(est / actual * 100).toFixed(1)}%)`);
}
console.log('reltuples (whole table) :', await rows(
  `SELECT reltuples::bigint AS reltuples, relpages FROM pg_class WHERE relname = 'agg_events'`));

line('D. exact up to a cap — BOTH branches, which ex37 never showed');
const capped = async (label, where) => {
  const r = await rows(
    `SELECT count(*)::int AS n, count(*) = 1000 AS capped
     FROM (SELECT 1 FROM agg_events WHERE ${where} LIMIT 1000) s`);
  const t = await timed(`SELECT count(*) FROM (SELECT 1 FROM agg_events WHERE ${where} LIMIT 1000) s`);
  const exact = await timed(`SELECT count(*) FROM agg_events WHERE ${where}`);
  console.log(`${label.padEnd(34)} ${r}  capped-scan ${t} ms vs exact ${exact} ms`);
};
await capped('common filter (kind=purchase)', `kind='purchase'`);
await capped('the ex37 "rare" filter', `kind='refund' AND amount > 890`);
console.log('  ^ both capped: that second filter matches far more than 1000 rows');
console.log('  how many, really     :', await rows(
  `SELECT count(*)::int AS n FROM agg_events WHERE kind='refund' AND amount > 890`));
await capped('genuinely rare (amount = 909)', `kind='refund' AND amount = 909`);
console.log('  ^ under the cap: capped=false, and n is an exact count');

line('E. what the client is told');
console.log('a page payload built from limit+1:', await rows(
  `WITH page AS (SELECT id FROM agg_events WHERE kind='purchase' ORDER BY id LIMIT 21)
   SELECT (SELECT count(*)::int FROM page) > 20 AS has_more,
          (SELECT jsonb_agg(id) FROM (SELECT id FROM page ORDER BY id LIMIT 20) t) IS NOT NULL AS rows_present`));

await pool.end();
console.log('\ndone');
