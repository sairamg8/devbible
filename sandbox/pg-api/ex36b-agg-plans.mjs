// Phase 6 — full EXPLAIN text for the plans the pages quote, with the index state
// controlled explicitly. Run ex36-aggregation.mjs first: this reuses agg_events.
//
// WHY THIS SCRIPT EXISTS SEPARATELY: ex36 creates agg_ev_user_amt part-way through
// (section 7), so its section 1b/2 numbers are from a world WITHOUT that index while
// anything measured after is WITH it. Comparing across that boundary would be
// confounded. Here each block states which index state it ran in.
import pg from 'pg';

const pool = new pg.Pool({connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 4});
const q = (...a) => pool.query(...a);
const show = async (title, sql) => {
  console.log(`\n--- ${title}`);
  console.log('  ' + sql.trim().replace(/\n\s+/g, '\n  '));
  await q(sql);
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const p = (await q(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) ${sql}`))
      .rows.map(r => r['QUERY PLAN']).join('\n');
    runs.push([Number(p.match(/Execution Time: ([\d.]+) ms/)[1]), p]);
  }
  runs.sort((a, b) => a[0] - b[0]);
  console.log(runs[0][1]);
  console.log(`  [best of 3: ${runs[0][0].toFixed(2)} ms | all: ${runs.map(r => r[0].toFixed(1)).join(', ')}]`);
};

await q(`DROP INDEX IF EXISTS agg_ev_user_amt`);
await q(`ANALYZE agg_events`);
console.log('###########  PART 1 — no index on (user_id, amount)  ###########');

await show('A. 4 groups over 500k', `SELECT kind, count(*) FROM agg_events GROUP BY kind`);
await show('B. 5000 groups over 500k', `SELECT user_id, count(*) FROM agg_events GROUP BY user_id`);
await q(`SET work_mem = '64kB'`);
await show('C. 5000 groups, work_mem = 64kB', `SELECT user_id, count(*) FROM agg_events GROUP BY user_id`);
await q(`RESET work_mem`);
await show('D. count(DISTINCT user_id)', `SELECT count(DISTINCT user_id) FROM agg_events`);
await show('E. the DISTINCT-subquery rewrite',
  `SELECT count(*) FROM (SELECT DISTINCT user_id FROM agg_events) s`);
await show('F. one window', `SELECT user_id, sum(amount) OVER (PARTITION BY user_id) FROM agg_events`);
await show('G. two windows, same partition',
  `SELECT user_id, sum(amount) OVER (PARTITION BY user_id),
          rank() OVER (PARTITION BY user_id ORDER BY amount) FROM agg_events`);
await show('H. two windows, different partitions',
  `SELECT user_id, sum(amount) OVER (PARTITION BY user_id),
          rank() OVER (PARTITION BY kind ORDER BY amount) FROM agg_events`);
await show('I. top-3 per user with row_number',
  `SELECT user_id, id FROM (SELECT user_id, id,
     row_number() OVER (PARTITION BY user_id ORDER BY amount DESC NULLS LAST) rn
   FROM agg_events) s WHERE rn <= 3`);
// J without the index is 5000 correlated scans of a 500k table. Cap it rather than
// wait it out - the timeout IS the result worth reporting.
{
  const sql = `SELECT u.user_id, e.id FROM (SELECT DISTINCT user_id FROM agg_events) u
   CROSS JOIN LATERAL (SELECT id FROM agg_events e WHERE e.user_id = u.user_id
                       ORDER BY amount DESC NULLS LAST LIMIT 3) e`;
  console.log('\n--- J. top-3 per user with LATERAL  [no index]');
  console.log('  ' + sql.trim().replace(/\n\s+/g, '\n  '));
  const c = await pool.connect();
  try {
    await c.query(`SET statement_timeout = '30s'`);
    const t0 = Date.now();
    const p = (await c.query(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) ${sql}`))
      .rows.map(r => r['QUERY PLAN']).join('\n');
    console.log(p);
    console.log(`  [completed in ${Date.now() - t0} ms]`);
  } catch (e) {
    console.log(`  -> ${e.code} ${e.message.split('\n')[0]}  (statement_timeout = 30s)`);
    const p = (await c.query(`EXPLAIN (COSTS ON) ${sql}`)).rows.map(r => r['QUERY PLAN']).join('\n');
    console.log('  estimated plan (no ANALYZE - it does not finish):');
    console.log(p.split('\n').map(l => '  ' + l).join('\n'));
  } finally { await c.query(`RESET statement_timeout`); c.release(); }
}

console.log('\n\n###########  PART 2 — same queries WITH agg_ev_user_amt (user_id, amount DESC)  ###########');
await q(`CREATE INDEX agg_ev_user_amt ON agg_events (user_id, amount DESC)`);
await q(`ANALYZE agg_events`);
console.log('index size:', (await q(`SELECT pg_size_pretty(pg_relation_size('agg_ev_user_amt')) s`)).rows[0].s);

await show('B2. 5000 groups over 500k', `SELECT user_id, count(*) FROM agg_events GROUP BY user_id`);
await q(`SET work_mem = '64kB'`);
await show('C2. 5000 groups, work_mem = 64kB', `SELECT user_id, count(*) FROM agg_events GROUP BY user_id`);
await q(`RESET work_mem`);
await show('D2. count(DISTINCT user_id)', `SELECT count(DISTINCT user_id) FROM agg_events`);
await show('E2. the DISTINCT-subquery rewrite',
  `SELECT count(*) FROM (SELECT DISTINCT user_id FROM agg_events) s`);
await show('F2. one window', `SELECT user_id, sum(amount) OVER (PARTITION BY user_id) FROM agg_events`);
await show('I2. top-3 per user with row_number',
  `SELECT user_id, id FROM (SELECT user_id, id,
     row_number() OVER (PARTITION BY user_id ORDER BY amount DESC NULLS LAST) rn
   FROM agg_events) s WHERE rn <= 3`);
await show('J2. top-3 per user with LATERAL',
  `SELECT u.user_id, e.id FROM (SELECT DISTINCT user_id FROM agg_events) u
   CROSS JOIN LATERAL (SELECT id FROM agg_events e WHERE e.user_id = u.user_id
                       ORDER BY amount DESC NULLS LAST LIMIT 3) e`);

console.log('\n\n###########  PART 3 — counting for pagination  ###########');
await show('K. exact count', `SELECT count(*) FROM agg_events WHERE kind = 'purchase'`);
await show('L. count(*) OVER () alongside the page',
  `SELECT id, count(*) OVER ()::int AS total FROM agg_events WHERE kind = 'purchase'
   ORDER BY id LIMIT 20`);
await show('M. limit+1 has-more probe',
  `SELECT id FROM agg_events WHERE kind = 'purchase' ORDER BY id LIMIT 21`);

console.log('\n--- N. the planner estimate, read out of EXPLAIN (no ANALYZE)');
for (const sql of [`SELECT * FROM agg_events`,
                   `SELECT * FROM agg_events WHERE kind = 'purchase'`,
                   `SELECT * FROM agg_events WHERE kind = 'purchase' AND amount > 500`]) {
  const p = (await q(`EXPLAIN (FORMAT JSON) ${sql}`)).rows[0]['QUERY PLAN'][0].Plan;
  const actual = (await q(`SELECT count(*)::int n FROM (${sql}) s`)).rows[0].n;
  console.log(`  est=${String(p['Plan Rows']).padEnd(7)} actual=${String(actual).padEnd(7)} err=${(p['Plan Rows'] / actual).toFixed(2)}x  ${sql}`);
}
console.log('  reltuples:', (await q(
  `SELECT reltuples::bigint AS reltuples, relpages FROM pg_class WHERE relname='agg_events'`)).rows[0]);

await pool.end();
console.log('\ndone');
