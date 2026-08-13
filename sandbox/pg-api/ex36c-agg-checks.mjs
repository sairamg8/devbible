// Phase 6 — targeted checks for claims made on the pages that the main scripts
// did not already produce. Run ex36-aggregation.mjs first (uses its fixture).
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

line('C1. what an UNCAST aggregate row looks like in JS');
{
  const r = await q(`SELECT count(*) AS n, sum(total) AS revenue, avg(total) AS avg,
                            min(total) AS lo, round(avg(total),2) AS rounded
                     FROM agg_orders WHERE id < 16`);
  console.log('rows[0]:', r.rows[0]);
  console.log('types  :', Object.fromEntries(Object.entries(r.rows[0]).map(([k, v]) => [k, typeof v])));
  console.log('n + 1  :', r.rows[0].n + 1);
}
{
  const r = await q(`SELECT count(*)::int AS n, sum(total)::int AS revenue,
                            avg(total)::float8 AS avg
                     FROM agg_orders WHERE id < 16`);
  console.log('cast   :', r.rows[0], Object.fromEntries(Object.entries(r.rows[0]).map(([k, v]) => [k, typeof v])));
}

line('C2. one row vs zero rows over an empty selection');
console.log('no GROUP BY :', await rows(`SELECT count(*)::int AS n, sum(total) AS revenue
                                         FROM agg_orders WHERE status = 'refunded'`));
console.log('with GROUP BY:', await rows(`SELECT status, count(*)::int AS n
                                          FROM agg_orders WHERE status = 'refunded' GROUP BY status`));

line('C3. avg vs avg(coalesce()) on the open group');
console.log(await rows(
  `SELECT status, count(*)::int AS rows, count(total)::int AS priced,
          round(avg(total),2) AS avg_of_known,
          round(avg(coalesce(total,0)),2) AS avg_null_as_zero
   FROM agg_orders WHERE id < 16 GROUP BY status ORDER BY status`));

line('C4. grouping by day — the three renderings');
console.log('::date        :', await rows(
  `SELECT date_trunc('day', placed_at)::date AS day, count(*)::int AS n
   FROM agg_orders WHERE id < 16 GROUP BY 1 ORDER BY 1`));
console.log('to_char       :', await rows(
  `SELECT to_char(date_trunc('day', placed_at), 'YYYY-MM-DD') AS day, count(*)::int AS n
   FROM agg_orders WHERE id < 16 GROUP BY 1 ORDER BY 1`));
console.log('AT TIME ZONE  :', await rows(
  `SELECT to_char(date_trunc('day', placed_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS local_day,
          count(*)::int AS n
   FROM agg_orders WHERE id < 16 GROUP BY 1 ORDER BY 1`));
console.log('session TimeZone:', await rows(`SHOW TimeZone`), ' client TZ:', process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone);

line('C5. NULL as a grouping key groups with itself');
console.log(await rows(
  `SELECT coupon, count(*)::int AS n FROM agg_orders WHERE id < 16
   GROUP BY coupon ORDER BY coupon NULLS LAST`));
console.log('  three NULL coupons collapse into ONE group, unlike NULL = NULL');

line('C6. two-column GROUP BY on the fixture');
console.log(await rows(
  `SELECT c.country, o.status, count(*)::int AS n
   FROM agg_orders o JOIN agg_customers c ON c.id = o.customer_id
   WHERE o.id < 16 GROUP BY c.country, o.status ORDER BY 1,2`));

line('C7. the ::int overflow the cast reintroduces');
await tryq('sum(...)::int over 500k amounts', `SELECT sum(amount)::int FROM agg_events`);
console.log('  as bigint  :', await rows(`SELECT sum(amount) AS s FROM agg_events`));
await tryq('count(*)::int on 500k', `SELECT count(*)::int FROM agg_events`);

line('C8. GROUP BY vs SELECT DISTINCT');
{
  const t = async (sql) => {
    await q(sql);
    const ts = [];
    for (let i = 0; i < 3; i++) {
      const p = (await q(`EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) ${sql}`)).rows.map(r => r['QUERY PLAN']).join('\n');
      ts.push(Number(p.match(/Execution Time: ([\d.]+) ms/)[1]));
    }
    const p = (await q(`EXPLAIN (COSTS OFF) ${sql}`)).rows.map(r => r['QUERY PLAN']).join(' | ');
    return `${Math.min(...ts).toFixed(2)} ms   ${p.split(' | ').slice(0, 2).join(' | ')}`;
  };
  console.log('GROUP BY user_id     :', await t(`SELECT user_id FROM agg_events GROUP BY user_id`));
  console.log('SELECT DISTINCT      :', await t(`SELECT DISTINCT user_id FROM agg_events`));
}

line('C9. ordinals, aliases and where each is legal');
// pinned to id < 16 / id < 6 so these match the 6-order, 5-customer fixture that
// topics 01-08 are written against (ex37 later adds orders 16,17 and customer 6).
await tryq('ORDER BY an output alias', `SELECT status AS s, count(*) AS n FROM agg_orders WHERE id < 16 GROUP BY 1 ORDER BY n DESC`);
await tryq('GROUP BY an expression alias', `SELECT total*2 AS dbl, count(*) FROM agg_orders WHERE id < 16 GROUP BY dbl`);
await tryq('GROUP BY an aggregate', `SELECT status, count(*) FROM agg_orders GROUP BY count(*)`);
await tryq('two tables, group by one PK',
  `SELECT c.id, c.name, count(o.id) FROM agg_customers c
   LEFT JOIN agg_orders o ON o.customer_id = c.id AND o.id < 16 WHERE c.id < 6 GROUP BY c.id`);
await tryq('...group by the OTHER table PK instead',
  `SELECT c.id, c.name, count(o.id) FROM agg_customers c
   LEFT JOIN agg_orders o ON o.customer_id = c.id GROUP BY o.id`);
await tryq('DISTINCT + GROUP BY together', `SELECT DISTINCT status, count(*) FROM agg_orders WHERE id < 16 GROUP BY status`);
await tryq('select a bare column with GROUP BY', `SELECT status, coupon, count(*) FROM agg_orders WHERE id < 16 GROUP BY status`);
await tryq('...wrapped in an aggregate instead', `SELECT status, min(coupon) AS a_coupon, count(*)::int FROM agg_orders WHERE id < 16 GROUP BY status ORDER BY status`);
await tryq('DISTINCT ON for a whole row per group',
  `SELECT DISTINCT ON (status) status, id, total FROM agg_orders WHERE id < 16 ORDER BY status, total DESC NULLS LAST`);

await pool.end();
console.log('\ndone');
