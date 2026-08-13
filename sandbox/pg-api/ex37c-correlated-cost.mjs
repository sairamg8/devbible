// Phase 6 page 11 — the cost of a correlated subquery, measured deterministically.
//
// Why this script exists: two runs of ex37 gave 136.85 ms and 889.41 ms for the SAME
// correlated query. Neither was wrong — the plan flipped between an Index Only Scan
// (Heap Fetches: 0) and a Bitmap Heap Scan reading 500000 heap blocks, depending on
// whether the visibility map happened to be set at the time. Quoting either number
// without controlling for that would be publishing a coin flip.
//
// So: VACUUM to set the visibility map, measure; then dirty the table so the map is
// stale, measure again. Both numbers are real and the page reports both.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 4});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

const planOf = async (sql) => {
  const p = (await q(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) ${sql}`))
    .rows.map((r) => r['QUERY PLAN']).join('\n');
  return [p, Number(p.match(/Execution Time: ([\d.]+) ms/)?.[1])];
};
const timed = async (sql, n = 3) => {
  await q(sql);
  const ts = [];
  for (let i = 0; i < n; i++) ts.push((await planOf(sql))[1]);
  return Math.min(...ts).toFixed(2);
};
// The scan node and its heap cost, which is the whole difference between the two states.
const scanFacts = (p) =>
  p.split('\n')
    .filter((l) => /Index Only Scan|Bitmap Heap Scan|Heap Fetches|Heap Blocks|Seq Scan|loops=5000/.test(l))
    .map((l) => '    ' + l.trim())
    .join('\n');

const has = await q(`SELECT to_regclass('agg_events') IS NOT NULL AS ok`);
if (!has.rows[0].ok) { console.log('run ex36-aggregation.mjs first'); process.exit(1); }

const CORR = `SELECT u.user_id, (SELECT count(*) FROM agg_events e WHERE e.user_id = u.user_id) AS n
              FROM (SELECT DISTINCT user_id FROM agg_events) u`;
const GRP = `SELECT user_id, count(*) AS n FROM agg_events GROUP BY user_id`;

const measure = async (label) => {
  const corr = await timed(CORR);
  const grp = await timed(GRP);
  const [p] = await planOf(CORR);
  console.log(`\n  ${label}`);
  console.log(`    correlated (5000 probes) : ${corr} ms`);
  console.log(`    one GROUP BY             : ${grp} ms`);
  console.log(`    ratio                    : ${(corr / grp).toFixed(1)}x`);
  console.log(scanFacts(p));
  return {corr: Number(corr), grp: Number(grp)};
};

line('A. visibility map SET (freshly vacuumed) — the best case for the correlated form');
await q(`VACUUM (ANALYZE) agg_events`);
const clean = await measure('after VACUUM');

line('B. visibility map STALE — one write is enough to lose the index-only scan');
// Touching rows across the whole table clears all-visible on the pages it dirties.
await q(`UPDATE agg_events SET amount = amount WHERE id % 500 = 0`);
await q(`ANALYZE agg_events`);
const dirty = await measure('after touching 1 row in every 500');

line('C. the point');
console.log(`  correlated: ${clean.corr} ms clean -> ${dirty.corr} ms stale  (${(dirty.corr / clean.corr).toFixed(1)}x worse)`);
console.log(`  GROUP BY  : ${clean.grp} ms clean -> ${dirty.grp} ms stale`);
console.log('  The GROUP BY barely moves: it reads the heap once either way.');
console.log('  The correlated form swings, because 5000 probes each pay the heap cost.');

// Restore the good state so a later ex37 run is not measuring a table this script dirtied.
await q(`VACUUM (ANALYZE) agg_events`);
await pool.end();
console.log('\ndone');
