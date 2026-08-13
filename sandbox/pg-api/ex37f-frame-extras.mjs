// Phase 6 page 14 — the frame-clause cases ex37 named but did not measure.
//
// ex37's EXCLUDE demo is labelled "EXCLUDE TIES / GROUP" but only runs EXCLUDE GROUP, so
// TIES and NO OTHERS were never shown. All four exclusions differ, and the difference
// between GROUP and TIES is exactly whether the current row survives.
// Also covers the running-total shorthand and what a frame does to a partition boundary.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 4});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const rows = async (sql, p) => JSON.stringify((await q(sql, p)).rows);
const tryq = async (label, sql) => {
  try { const r = await q(sql); console.log(`${label.padEnd(46)} ok  ${JSON.stringify(r.rows.slice(0, 3))}`); }
  catch (e) { console.log(`${label.padEnd(46)} ->  ${e.code} ${e.message.split('\n')[0]}`); }
};

// agg_tick is built by ex37 section 14; rebuild it here so this script stands alone.
await q(`DROP TABLE IF EXISTS agg_tick CASCADE`);
await q(`CREATE TABLE agg_tick (id int PRIMARY KEY, day date, amt int)`);
await q(`INSERT INTO agg_tick VALUES
  (1,'2026-03-01',10),(2,'2026-03-01',20),(3,'2026-03-02',30),
  (4,'2026-03-03',40),(5,'2026-03-03',50),(6,'2026-03-04',60)`);

line('A. all four EXCLUDE options, over the whole partition');
// NB: a named window that already carries a frame cannot have EXCLUDE bolted on at the
// reference site — `OVER (w EXCLUDE ...)` is a 42601 syntax error. Each frame is spelled
// out in full instead.
const FRAME = 'ORDER BY day RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING';
console.log(await rows(
  `SELECT id, to_char(day,'MM-DD') AS day, amt,
          count(*) OVER (${FRAME})                       AS no_exclude,
          count(*) OVER (${FRAME} EXCLUDE CURRENT ROW)   AS excl_current,
          count(*) OVER (${FRAME} EXCLUDE GROUP)         AS excl_group,
          count(*) OVER (${FRAME} EXCLUDE TIES)          AS excl_ties,
          count(*) OVER (${FRAME} EXCLUDE NO OTHERS)     AS excl_no_others
   FROM agg_tick
   ORDER BY id`));
console.log('  GROUP drops the row AND its peers; TIES drops the peers but KEEPS the row');
console.log('  (so TIES = GROUP + 1 wherever the row has peers, and NO OTHERS is the default)');

line('B. the running-total shorthand');
console.log(await rows(
  `SELECT id, amt,
          sum(amt) OVER (ORDER BY id) AS default_frame,
          sum(amt) OVER (ORDER BY id ROWS UNBOUNDED PRECEDING) AS explicit_rows,
          sum(amt) OVER (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS spelled_out
   FROM agg_tick ORDER BY id`));
console.log('  ^ identical here because id is unique: with no peers, RANGE and ROWS agree');

line('C. a frame never crosses a partition boundary');
console.log(await rows(
  `SELECT id, day, amt,
          sum(amt) OVER (PARTITION BY day ORDER BY id
                         ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) AS within_day
   FROM agg_tick ORDER BY id`));
console.log('  ^ rows 3 and 6 are alone in their day, so their "neighbours" frame is just themselves');

line('D. frame edge cases and errors');
await tryq('FOLLOWING before PRECEDING (invalid order)',
  `SELECT sum(amt) OVER (ORDER BY id ROWS BETWEEN 1 FOLLOWING AND 1 PRECEDING) FROM agg_tick`);
await tryq('a frame that is entirely in the future',
  `SELECT id, sum(amt) OVER (ORDER BY id ROWS BETWEEN 1 FOLLOWING AND 2 FOLLOWING) FROM agg_tick`);
await tryq('negative offset',
  `SELECT sum(amt) OVER (ORDER BY id ROWS BETWEEN -1 PRECEDING AND CURRENT ROW) FROM agg_tick`);
await tryq('RANGE offset on a text ORDER BY column',
  `SELECT sum(amt) OVER (ORDER BY to_char(day,'MM-DD') RANGE BETWEEN '1 day' PRECEDING AND CURRENT ROW) FROM agg_tick`);
// Guessed this would be rejected; it is not. row_number() is defined over the partition
// and ignores the frame entirely — PostgreSQL accepts the clause and silently disregards
// it, which is worse than an error for anyone who thinks the frame is doing something.
await tryq('frame on a ranking function (accepted, ignored)',
  `SELECT row_number() OVER (ORDER BY id ROWS UNBOUNDED PRECEDING) FROM agg_tick`);
console.log('  ^ compare: the same ranking with a deliberately silly frame gives identical output');
await tryq('...same ranking, absurd frame',
  `SELECT row_number() OVER (ORDER BY id ROWS BETWEEN 1 FOLLOWING AND 2 FOLLOWING) FROM agg_tick`);

await pool.end();
console.log('\ndone');
