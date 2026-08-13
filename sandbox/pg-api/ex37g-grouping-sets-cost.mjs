// Phase 6 page 16 — is "one pass" actually cheaper than several GROUP BYs?
//
// ex37 compared CUBE(a,b,c) at 710.66 ms against three separate GROUP BYs totalling
// ~171 ms and left it there, which reads as "GROUPING SETS is 4x slower". That is not a
// fair comparison: CUBE over 3 columns computes EIGHT grouping sets, the three separate
// queries compute three. This measures like for like — same three sets, one scan versus
// three scans — and only then compares against CUBE's full eight.
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
  return Math.min(...ts);
};
const buffersOf = async (sql) => {
  const [p] = await planOf(sql);
  return p.match(/Buffers: shared hit=(\d+)/)?.[1];
};

const has = await q(`SELECT to_regclass('agg_events') IS NOT NULL AS ok`);
if (!has.rows[0].ok) { console.log('run ex36-aggregation.mjs first'); process.exit(1); }
await q(`VACUUM (ANALYZE) agg_events`);

const A = `kind`, B = `user_id % 10`, C = `amount % 3`;

line('A. how many grouping sets does each form produce?');
const nsets = async (label, groupBy) => {
  const r = await q(
    `SELECT count(*)::int AS rows FROM (
       SELECT ${A} AS a, ${B} AS b, ${C} AS c, count(*) FROM agg_events GROUP BY ${groupBy}) s`);
  console.log(`${label.padEnd(40)} result rows = ${r.rows[0].rows}`);
};
await nsets('GROUP BY a, b, c (1 set)', `${A}, ${B}, ${C}`);
await nsets('GROUPING SETS ((a),(b),(c)) (3 sets)', `GROUPING SETS ((${A}),(${B}),(${C}))`);
await nsets('ROLLUP (a,b,c) (4 sets)', `ROLLUP (${A}, ${B}, ${C})`);
await nsets('CUBE (a,b,c) (8 sets)', `CUBE (${A}, ${B}, ${C})`);

line('B. like for like — the SAME three sets, one scan vs three scans');
const three = await timed(
  `SELECT ${A} AS a, ${B} AS b, ${C} AS c, count(*) FROM agg_events
   GROUP BY GROUPING SETS ((${A}),(${B}),(${C}))`);
const sep = [
  await timed(`SELECT ${A}, count(*) FROM agg_events GROUP BY 1`),
  await timed(`SELECT ${B}, count(*) FROM agg_events GROUP BY 1`),
  await timed(`SELECT ${C}, count(*) FROM agg_events GROUP BY 1`),
];
const sepTotal = sep.reduce((x, y) => x + y, 0);
console.log(`GROUPING SETS, 3 sets, one scan : ${three.toFixed(2)} ms   buffers=${await buffersOf(
  `SELECT ${A} AS a, ${B} AS b, ${C} AS c, count(*) FROM agg_events GROUP BY GROUPING SETS ((${A}),(${B}),(${C}))`)}`);
console.log(`three separate GROUP BYs        : ${sep.map((s) => s.toFixed(2)).join(' + ')} = ${sepTotal.toFixed(2)} ms`);
console.log(`  buffers for ONE of them       : ${await buffersOf(`SELECT ${A}, count(*) FROM agg_events GROUP BY 1`)} (x3 scans)`);
console.log(`  verdict: ${(sepTotal / three).toFixed(2)}x — one scan ${sepTotal > three ? 'WINS' : 'LOSES'}`);

line('C. now CUBE, which is doing 8 sets not 3');
const cube = await timed(
  `SELECT ${A}, ${B}, ${C}, count(*) FROM agg_events GROUP BY CUBE (${A}, ${B}, ${C})`);
console.log(`CUBE (8 sets)                   : ${cube.toFixed(2)} ms`);
console.log(`  per grouping set              : ${(cube / 8).toFixed(2)} ms`);
console.log(`  vs GROUPING SETS per set      : ${(three / 3).toFixed(2)} ms`);
console.log(`  vs separate GROUP BY per set  : ${(sepTotal / 3).toFixed(2)} ms`);
console.log('  ^ comparing CUBE against 3 separate GROUP BYs is comparing 8 answers to 3');

line('D. the plan — one scan feeding a MixedAggregate');
{
  const [p] = await planOf(
    `SELECT ${A}, ${B}, ${C}, count(*) FROM agg_events GROUP BY CUBE (${A}, ${B}, ${C})`);
  console.log(p.split('\n').filter((l) => /Aggregate|Hash Key|Group Key|Scan|Sort Method|Batches/.test(l))
    .map((l) => '  ' + l.trim()).join('\n'));
}

// E. The reason one scan loses: grouping sets are not parallelised. A plain GROUP BY gets
// a Gather with two workers; the MixedAggregate/HashAggregate over grouping sets does not.
// Three parallel scans beat one serial scan even though they read 3x the buffers — and
// every buffer here is a shared HIT, so this is CPU, not I/O.
line('E. why: the plain GROUP BY parallelises and the grouping-set version does not');
const shape = async (t, s) => {
  const [p] = await planOf(s);
  console.log(`\n  -- ${t}`);
  console.log(p.split('\n').filter((l) => /Gather|Workers|Aggregate|Scan|Hash Key|Group Key/.test(l))
    .map((l) => '    ' + l.trim()).join('\n'));
};
await shape('ONE separate GROUP BY', `SELECT ${A}, count(*) FROM agg_events GROUP BY 1`);
await shape('GROUPING SETS, the same three sets',
  `SELECT ${A} AS a, ${B} AS b, ${C} AS c, count(*) FROM agg_events
   GROUP BY GROUPING SETS ((${A}),(${B}),(${C}))`);

await pool.end();
console.log('\ndone');
