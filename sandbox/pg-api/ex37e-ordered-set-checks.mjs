// Phase 6 page 13 — claims made on the ordered-set pages that ex37 did not establish.
//
// ex37 printed `mode() -> click` with no distribution alongside it, which reads as a fact
// about the data. It is not: the fixture ties all four kinds at exactly 125000, so mode()
// is reporting a sort order, not a frequency. That needed proving rather than asserting,
// and so did the every()/bool_and alias and the percentile_disc(0.0) = min() shorthand.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 4});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const rows = async (sql, p) => JSON.stringify((await q(sql, p)).rows);

const has = await q(`SELECT to_regclass('agg_events') IS NOT NULL AS ok`);
if (!has.rows[0].ok) { console.log('run ex36-aggregation.mjs first'); process.exit(1); }

line('A. mode() reports a sort order when the input is tied');
console.log('kind counts:', await rows(
  `SELECT kind, count(*)::int AS n FROM agg_events GROUP BY kind ORDER BY n DESC, kind`));
console.log('mode()     :', await rows(
  `SELECT mode() WITHIN GROUP (ORDER BY kind) AS commonest FROM agg_events`));
console.log('  ^ all four tied at 125000; mode() returned the alphabetically first');
console.log('mode() with the order reversed:', await rows(
  `SELECT mode() WITHIN GROUP (ORDER BY kind DESC) AS commonest FROM agg_events`));
console.log('  ^ same data, different answer — proof the tie is broken by the ordering');
console.log('mode() on a genuine winner   :', await rows(
  `SELECT mode() WITHIN GROUP (ORDER BY k) AS commonest
   FROM (VALUES ('zeta'),('zeta'),('alpha')) t(k)`));
console.log('  ^ zeta wins on frequency despite sorting last, so mode() is not just min()');
console.log('mode() over an empty set     :', await rows(
  `SELECT mode() WITHIN GROUP (ORDER BY kind) AS commonest FROM agg_events WHERE false`));

line('B. every() is an alias for bool_and');
console.log(await rows(
  `SELECT bool_and(status = 'paid') AS bool_and, every(status = 'paid') AS every,
          bool_and(status = 'paid') IS NOT DISTINCT FROM every(status = 'paid') AS identical
   FROM agg_orders`));

line('C. percentile_disc at the extremes equals min/max');
console.log(await rows(
  `SELECT percentile_disc(0.0) WITHIN GROUP (ORDER BY amount) AS p0,
          min(amount) AS min,
          percentile_disc(1.0) WITHIN GROUP (ORDER BY amount) AS p100,
          max(amount) AS max
   FROM agg_events`));

line('D. bool_and over an empty set, and the coalesce fix');
console.log(await rows(
  `SELECT bool_and(status = 'paid') AS raw,
          coalesce(bool_and(status = 'paid'), true) AS coalesced
   FROM agg_orders WHERE customer_id = 999`));

await pool.end();
console.log('\ndone');
