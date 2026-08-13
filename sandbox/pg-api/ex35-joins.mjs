// Phase 5 pages 01-13 — inner/left/outer joins, semi and anti joins, N-N, cross,
// ON vs USING vs NATURAL, self joins, LATERAL, set operations, aliasing, expression joins.
import pg from 'pg';

const CS = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: CS, max: 8});
pool.on('error', (e) => console.log('pool error event:', e.code, e.message));
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const err = (e) => `${e.code} ${e.message.split('\n')[0]}`;
const tryq = async (label, sql) => {
  try { const r = await q(sql); console.log(`${label.padEnd(46)} ok  rows=${r.rowCount} ${JSON.stringify(r.rows.slice(0,2))}`); }
  catch (e) { console.log(`${label.padEnd(46)} ->  ${err(e)}`); }
};
const rows = async (sql) => JSON.stringify((await q(sql)).rows);
const plan = async (sql) => {
  const p = (await q(`EXPLAIN (ANALYZE, COSTS OFF) ${sql}`)).rows.map(r => r['QUERY PLAN']).join('\n');
  const join = p.split('\n').map(l => l.replace(/^\s*(->\s*)?/, ''))
    .find(l => /Join|Nested Loop|Hash|Merge|WindowAgg|Append|SubPlan|Materialize|Seq Scan|Index/.test(l)) ?? '?';
  return [join.split('  (')[0], p.match(/Execution Time: ([\d.]+) ms/)?.[1]];
};

// --- fixture ----------------------------------------------------------------
await q(`DROP TABLE IF EXISTS j_order_items, j_orders, j_customers, j_tags,
                              j_post_tags, j_posts, j_emp, j_prices CASCADE`);
await q(`CREATE TABLE j_customers (id int PRIMARY KEY, name text NOT NULL, country text)`);
await q(`CREATE TABLE j_orders (id int PRIMARY KEY, customer_id int REFERENCES j_customers(id),
                                status text NOT NULL, total int NOT NULL,
                                created_at timestamptz NOT NULL DEFAULT now())`);
await q(`CREATE TABLE j_order_items (id int PRIMARY KEY, order_id int REFERENCES j_orders(id),
                                     sku text NOT NULL, qty int NOT NULL)`);
await q(`INSERT INTO j_customers VALUES
  (1,'Ann','GB'),(2,'Bob','US'),(3,'Cid','GB'),(4,'Dee','IN')`);   // Dee has no orders
// fixed timestamps, not now(): every console block below must be stable across runs
await q(`INSERT INTO j_orders VALUES
  (10,1,'paid',100,     '2026-03-01 09:15+00'),
  (11,1,'open',50,      '2026-03-03 14:40+00'),
  (12,2,'paid',200,     '2026-03-01 11:00+00'),
  (13,3,'cancelled',0,  '2026-03-04 08:05+00')`);
await q(`INSERT INTO j_order_items VALUES
  (100,10,'A',1),(101,10,'B',2),(102,11,'A',5),(103,12,'C',1)`);   // order 13 has no items

// --- 1. INNER JOIN ----------------------------------------------------------
line('1. INNER JOIN — only matching pairs survive');
console.log('customers                :', await rows(`SELECT count(*)::int AS n FROM j_customers`));
console.log('orders                   :', await rows(`SELECT count(*)::int AS n FROM j_orders`));
console.log('INNER JOIN rows          :', await rows(
  `SELECT c.name, o.id AS order_id FROM j_customers c JOIN j_orders o ON o.customer_id = c.id ORDER BY o.id`));
console.log('  Dee (no orders) is gone, Ann appears TWICE - one row per matching pair');

console.log('row multiplication:', await rows(
  `SELECT count(*)::int AS joined_rows FROM j_orders o JOIN j_order_items i ON i.order_id = o.id`));
console.log('  4 orders x their items = 4 item rows; the ORDER total would be double-counted:');
console.log('  naive sum :', await rows(
  `SELECT sum(o.total)::int AS wrong FROM j_orders o JOIN j_order_items i ON i.order_id = o.id`));
console.log('  correct   :', await rows(`SELECT sum(total)::int AS right FROM j_orders`));

// --- 2. LEFT JOIN and the WHERE bug ----------------------------------------
line('2. LEFT JOIN — and the WHERE clause that silently makes it an INNER JOIN');
console.log('LEFT JOIN                :', await rows(
  `SELECT c.name, o.id AS order_id FROM j_customers c LEFT JOIN j_orders o ON o.customer_id = c.id ORDER BY c.id, o.id`));
console.log('filter in WHERE          :', await rows(
  `SELECT c.name, o.id FROM j_customers c LEFT JOIN j_orders o ON o.customer_id = c.id
   WHERE o.status = 'paid' ORDER BY c.id`));
console.log('  ^ Dee vanished: WHERE on the right table drops the NULL-extended rows');
console.log('filter in ON             :', await rows(
  `SELECT c.name, o.id FROM j_customers c LEFT JOIN j_orders o
     ON o.customer_id = c.id AND o.status = 'paid' ORDER BY c.id`));
console.log('  ^ Dee and Cid kept, with NULL - the filter belongs in ON');
console.log('IS NULL to find non-matches:', await rows(
  `SELECT c.name FROM j_customers c LEFT JOIN j_orders o ON o.customer_id = c.id
   WHERE o.id IS NULL`));
console.log('count trap:', await rows(
  `SELECT count(*)::int AS count_star, count(o.id)::int AS count_col
   FROM j_customers c LEFT JOIN j_orders o ON o.customer_id = c.id`));

// --- 3. semi and anti joins -------------------------------------------------
line('3. semi and anti joins — EXISTS, IN, NOT IN, NOT EXISTS');
console.log('EXISTS (semi join)       :', await rows(
  `SELECT c.name FROM j_customers c WHERE EXISTS (SELECT 1 FROM j_orders o WHERE o.customer_id = c.id) ORDER BY c.id`));
console.log('IN (also a semi join)    :', await rows(
  `SELECT c.name FROM j_customers c WHERE c.id IN (SELECT customer_id FROM j_orders) ORDER BY c.id`));
console.log('NOT EXISTS (anti join)   :', await rows(
  `SELECT c.name FROM j_customers c WHERE NOT EXISTS (SELECT 1 FROM j_orders o WHERE o.customer_id = c.id)`));

// now introduce a NULL into the subquery column and watch NOT IN break
await q(`INSERT INTO j_orders VALUES (14, NULL, 'open', 5, '2026-03-05 16:20+00')`);
console.log('after adding an order with customer_id = NULL:');
console.log('  NOT EXISTS             :', await rows(
  `SELECT c.name FROM j_customers c WHERE NOT EXISTS (SELECT 1 FROM j_orders o WHERE o.customer_id = c.id)`));
console.log('  NOT IN                 :', await rows(
  `SELECT c.name FROM j_customers c WHERE c.id NOT IN (SELECT customer_id FROM j_orders)`));
console.log('  ^ NOT IN returned NOTHING - one NULL poisoned the whole predicate');
console.log('  NOT IN with NULLs filtered:', await rows(
  `SELECT c.name FROM j_customers c WHERE c.id NOT IN (SELECT customer_id FROM j_orders WHERE customer_id IS NOT NULL)`));

// the plans differ
{
  await q(`DROP TABLE IF EXISTS j_big_a, j_big_b`);
  await q(`CREATE TABLE j_big_a AS SELECT g AS id, 'a'||g AS v FROM generate_series(1,200000) g`);
  await q(`CREATE TABLE j_big_b AS SELECT g*2 AS a_id FROM generate_series(1,100000) g`);
  await q(`ALTER TABLE j_big_a ADD PRIMARY KEY (id)`);
  await q(`CREATE INDEX ON j_big_b (a_id)`);
  await q(`VACUUM ANALYZE j_big_a, j_big_b`);
  for (const [label, sql] of [
    ['EXISTS    ', `SELECT count(*) FROM j_big_a a WHERE EXISTS (SELECT 1 FROM j_big_b b WHERE b.a_id = a.id)`],
    ['IN        ', `SELECT count(*) FROM j_big_a a WHERE a.id IN (SELECT a_id FROM j_big_b)`],
    ['JOIN+DISTINCT', `SELECT count(*) FROM (SELECT DISTINCT a.id FROM j_big_a a JOIN j_big_b b ON b.a_id = a.id) s`],
    ['NOT EXISTS', `SELECT count(*) FROM j_big_a a WHERE NOT EXISTS (SELECT 1 FROM j_big_b b WHERE b.a_id = a.id)`],
    ['NOT IN    ', `SELECT count(*) FROM j_big_a a WHERE a.id NOT IN (SELECT a_id FROM j_big_b)`],
  ]) {
    const [node, t] = await plan(sql);
    console.log(`${label}: ${node.padEnd(34)} ${t} ms`);
  }
}

// --- 4/5. multi-table and N-N ----------------------------------------------
line('4. multi-table joins and the N-N join table');
await q(`CREATE TABLE j_posts (id int PRIMARY KEY, title text)`);
await q(`CREATE TABLE j_tags (id int PRIMARY KEY, name text)`);
await q(`CREATE TABLE j_post_tags (post_id int REFERENCES j_posts(id), tag_id int REFERENCES j_tags(id),
                                   PRIMARY KEY (post_id, tag_id))`);
await q(`INSERT INTO j_posts VALUES (1,'First'),(2,'Second'),(3,'Untagged')`);
await q(`INSERT INTO j_tags VALUES (1,'sql'),(2,'node'),(3,'unused')`);
await q(`INSERT INTO j_post_tags VALUES (1,1),(1,2),(2,1)`);
console.log('three-table join         :', await rows(
  `SELECT p.title, t.name FROM j_posts p
     JOIN j_post_tags pt ON pt.post_id = p.id
     JOIN j_tags t ON t.id = pt.tag_id ORDER BY p.id, t.id`));
console.log('posts with their tags aggregated:', await rows(
  `SELECT p.title, coalesce(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '{}') AS tags
   FROM j_posts p LEFT JOIN j_post_tags pt ON pt.post_id = p.id
                  LEFT JOIN j_tags t ON t.id = pt.tag_id
   GROUP BY p.id, p.title ORDER BY p.id`));
console.log('  ^ LEFT JOIN + FILTER keeps the untagged post with an empty array');
console.log('posts having ALL of a set of tags:', await rows(
  `SELECT p.title FROM j_posts p JOIN j_post_tags pt ON pt.post_id = p.id
   WHERE pt.tag_id IN (1,2) GROUP BY p.id, p.title HAVING count(DISTINCT pt.tag_id) = 2`));

// --- 6. RIGHT and FULL ------------------------------------------------------
line('6. RIGHT and FULL OUTER');
console.log('RIGHT JOIN               :', await rows(
  `SELECT c.name, o.id FROM j_orders o RIGHT JOIN j_customers c ON o.customer_id = c.id ORDER BY c.id, o.id`));
console.log('FULL OUTER               :', await rows(
  `SELECT c.name, o.id FROM j_customers c FULL OUTER JOIN j_orders o ON o.customer_id = c.id
   WHERE c.id IS NULL OR o.id IS NULL ORDER BY c.id NULLS LAST, o.id`));
console.log('  ^ only the unmatched rows from both sides: Dee has no order, order 14 has no customer');

// --- 7. CROSS JOIN ----------------------------------------------------------
line('7. CROSS JOIN — deliberate and accidental');
console.log('deliberate cross join    :', await rows(
  `SELECT count(*)::int AS n FROM j_customers CROSS JOIN generate_series(1,3)`));
console.log('the accidental form (comma, no condition):', await rows(
  `SELECT count(*)::int AS n FROM j_customers c, j_orders o`));
console.log('  4 customers x 5 orders = 20 rows and no error at all');
console.log('a real use - a calendar spine:', await rows(
  `SELECT c.name, d::date AS day FROM j_customers c
   CROSS JOIN generate_series('2026-01-01'::date,'2026-01-02'::date,'1 day') d
   WHERE c.id <= 2 ORDER BY c.id, day`));
// the complete gap-filling shape: spine CROSS JOINed, facts LEFT JOINed onto it.
// Ann has orders on 03-01 and 03-03, so 03-02 is the gap the spine must still report.
console.log('gap-filled report (Ann, 03-01..03-04):', await rows(
  `SELECT c.name, to_char(d,'YYYY-MM-DD') AS day,
          count(o.id)::int AS orders, coalesce(sum(o.total),0)::int AS revenue
   FROM j_customers c
   CROSS JOIN generate_series('2026-03-01'::date,'2026-03-04'::date,'1 day') d
   LEFT JOIN j_orders o ON o.customer_id = c.id AND o.created_at::date = d::date
   WHERE c.id = 1 GROUP BY c.id, c.name, d ORDER BY d`));
console.log('  same query with count(*) instead of count(o.id):', await rows(
  `SELECT to_char(d,'YYYY-MM-DD') AS day, count(*)::int AS wrong_orders
   FROM j_customers c
   CROSS JOIN generate_series('2026-03-01'::date,'2026-03-04'::date,'1 day') d
   LEFT JOIN j_orders o ON o.customer_id = c.id AND o.created_at::date = d::date
   WHERE c.id = 1 GROUP BY d ORDER BY d`));

// --- 8. ON vs USING vs NATURAL ---------------------------------------------
line('8. ON vs USING vs NATURAL');
console.log('ON      :', await rows(
  `SELECT c.id AS c_id, o.id AS o_id FROM j_customers c JOIN j_orders o ON o.customer_id = c.id ORDER BY o.id LIMIT 2`));
await q(`DROP TABLE IF EXISTS j_u1, j_u2`);
await q(`CREATE TABLE j_u1 (id int, name text, created_at date)`);
await q(`CREATE TABLE j_u2 (id int, label text, created_at date)`);
await q(`INSERT INTO j_u1 VALUES (1,'one','2026-01-01'),(2,'two','2026-01-02')`);
await q(`INSERT INTO j_u2 VALUES (1,'ONE','2026-06-01'),(2,'TWO','2026-01-02')`);
console.log('USING (id) collapses the join column:', await rows(
  `SELECT * FROM j_u1 JOIN j_u2 USING (id) ORDER BY id`));
console.log('NATURAL JOIN silently also joins on created_at:', await rows(
  `SELECT * FROM j_u1 NATURAL JOIN j_u2`));
console.log('  ^ one row instead of two - NATURAL matched every same-named column');
console.log('SELECT * with ON keeps BOTH id columns:', await rows(
  `SELECT * FROM j_u1 a JOIN j_u2 b ON a.id = b.id ORDER BY a.id LIMIT 1`));

// --- 9. self joins ----------------------------------------------------------
line('9. self joins — hierarchies');
await q(`CREATE TABLE j_emp (id int PRIMARY KEY, name text, manager_id int REFERENCES j_emp(id))`);
await q(`INSERT INTO j_emp VALUES (1,'Root',NULL),(2,'Mid',1),(3,'Leaf',2),(4,'Leaf2',2)`);
console.log('employee + manager       :', await rows(
  `SELECT e.name AS employee, m.name AS manager FROM j_emp e LEFT JOIN j_emp m ON m.id = e.manager_id ORDER BY e.id`));
console.log('recursive full chain     :', await rows(
  `WITH RECURSIVE chain AS (
     SELECT id, name, manager_id, 1 AS depth, name::text AS path FROM j_emp WHERE manager_id IS NULL
     UNION ALL
     SELECT e.id, e.name, e.manager_id, c.depth+1, c.path||' > '||e.name
     FROM j_emp e JOIN chain c ON e.manager_id = c.id)
   SELECT depth, path FROM chain ORDER BY path`));

// --- 10. LATERAL ------------------------------------------------------------
line('10. LATERAL — top-N per group');
console.log('without LATERAL you need a window or a correlated subquery.');
console.log('top 1 item per order     :', await rows(
  `SELECT o.id AS order_id, i.sku, i.qty
   FROM j_orders o
   CROSS JOIN LATERAL (SELECT sku, qty FROM j_order_items x WHERE x.order_id = o.id
                       ORDER BY qty DESC LIMIT 1) i
   ORDER BY o.id`));
console.log('  ^ CROSS JOIN LATERAL dropped orders with no items (13 and 14)');
console.log('LEFT JOIN LATERAL keeps them:', await rows(
  `SELECT o.id AS order_id, i.sku
   FROM j_orders o
   LEFT JOIN LATERAL (SELECT sku FROM j_order_items x WHERE x.order_id = o.id
                      ORDER BY qty DESC LIMIT 1) i ON true
   ORDER BY o.id`));
{
  await q(`DROP TABLE IF EXISTS j_lat`);
  await q(`CREATE TABLE j_lat (grp int, v int)`);
  await q(`INSERT INTO j_lat SELECT g%500, g FROM generate_series(1,200000) g`);
  await q(`CREATE INDEX ON j_lat (grp, v DESC)`);
  await q(`VACUUM ANALYZE j_lat`);
  const grps = `(SELECT DISTINCT grp FROM j_lat) g`;
  const [n1, t1] = await plan(
    `SELECT g.grp, l.v FROM ${grps} CROSS JOIN LATERAL (SELECT v FROM j_lat x WHERE x.grp=g.grp ORDER BY v DESC LIMIT 3) l`);
  const [n2, t2] = await plan(
    `SELECT grp, v FROM (SELECT grp, v, row_number() OVER (PARTITION BY grp ORDER BY v DESC) rn FROM j_lat) s WHERE rn <= 3`);
  console.log(`top-3-per-group via LATERAL      : ${n1.padEnd(30)} ${t1} ms`);
  console.log(`top-3-per-group via row_number() : ${n2.padEnd(30)} ${t2} ms`);
  console.log('  ^ CONFOUNDED: the LATERAL side also has to derive DISTINCT grp from the');
  console.log('    same 200k rows. Re-run it with a real 500-row dimension table:');
  await q(`DROP TABLE IF EXISTS j_grp`);
  await q(`CREATE TABLE j_grp AS SELECT DISTINCT grp FROM j_lat`);
  await q(`ALTER TABLE j_grp ADD PRIMARY KEY (grp)`);
  await q(`VACUUM ANALYZE j_grp`);
  const [n3, t3] = await plan(
    `SELECT g.grp, l.v FROM j_grp g CROSS JOIN LATERAL (SELECT v FROM j_lat x WHERE x.grp=g.grp ORDER BY v DESC LIMIT 3) l`);
  console.log(`  LATERAL off a real group table : ${n3.padEnd(30)} ${t3} ms`);
}

// --- 11. set operations -----------------------------------------------------
line('11. UNION / INTERSECT / EXCEPT');
console.log('UNION (dedupes)          :', await rows(`SELECT 1 UNION SELECT 1 UNION SELECT 2`));
console.log('UNION ALL (keeps dupes)  :', await rows(`SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 2`));
console.log('INTERSECT                :', await rows(
  `SELECT id FROM j_customers INTERSECT SELECT customer_id FROM j_orders ORDER BY 1`));
console.log('EXCEPT                   :', await rows(
  `SELECT id FROM j_customers EXCEPT SELECT customer_id FROM j_orders ORDER BY 1`));
await tryq('UNION with mismatched column counts', `SELECT 1 UNION SELECT 1, 2`);
await tryq('UNION with incompatible types', `SELECT 1 UNION SELECT 'abc'`);
console.log('UNION takes column names from the FIRST branch:', await rows(
  `SELECT 1 AS first_name UNION ALL SELECT 2`));
{
  await q(`DROP TABLE IF EXISTS j_u`);
  await q(`CREATE TABLE j_u AS SELECT g FROM generate_series(1,300000) g`);
  await q(`VACUUM ANALYZE j_u`);
  const [n1, t1] = await plan(`SELECT g FROM j_u UNION SELECT g FROM j_u`);
  const [n2, t2] = await plan(`SELECT g FROM j_u UNION ALL SELECT g FROM j_u`);
  console.log(`UNION over 2 x 300k rows     : ${n1.padEnd(24)} ${t1} ms`);
  console.log(`UNION ALL over the same rows : ${n2.padEnd(24)} ${t2} ms`);
}

// --- 12. alias discipline ---------------------------------------------------
line('12. aliases and ambiguous columns');
await tryq('unqualified column present in both tables',
  `SELECT id FROM j_customers c JOIN j_orders o ON o.customer_id = c.id`);
await tryq('qualified, unambiguous',
  `SELECT c.id FROM j_customers c JOIN j_orders o ON o.customer_id = c.id LIMIT 1`);
await tryq('alias used in WHERE (not allowed)',
  `SELECT total * 2 AS doubled FROM j_orders WHERE doubled > 100`);
await tryq('alias used in ORDER BY (allowed)',
  `SELECT total * 2 AS doubled FROM j_orders ORDER BY doubled DESC LIMIT 1`);
await tryq('alias used in GROUP BY (allowed)',
  `SELECT status AS s, count(*) FROM j_orders GROUP BY s`);
await tryq('referring to the old table name after aliasing',
  `SELECT j_customers.id FROM j_customers c LIMIT 1`);

// --- 13. joining on expressions and ranges ---------------------------------
line('13. joining on an expression, and on a range');
await q(`CREATE TABLE j_prices (sku text, valid tstzrange, price int)`);
await q(`INSERT INTO j_prices VALUES
  ('A', tstzrange('2026-01-01','2026-06-01'), 100),
  ('A', tstzrange('2026-06-01','2027-01-01'), 120),
  ('B', tstzrange('2026-01-01','2027-01-01'), 50)`);
await q(`DROP TABLE IF EXISTS j_sales`);
await q(`CREATE TABLE j_sales (id int, sku text, sold_at timestamptz)`);
await q(`INSERT INTO j_sales VALUES (1,'A','2026-03-15'),(2,'A','2026-09-15'),(3,'B','2026-03-15')`);
console.log('range join (price at time of sale):', await rows(
  `SELECT s.id, s.sku, p.price FROM j_sales s
   JOIN j_prices p ON p.sku = s.sku AND p.valid @> s.sold_at ORDER BY s.id`));

await q(`DROP TABLE IF EXISTS j_x, j_y`);
await q(`CREATE TABLE j_x AS SELECT g AS id, upper('code'||g) AS code FROM generate_series(1,200000) g`);
await q(`CREATE TABLE j_y AS SELECT g AS id, 'code'||g AS code FROM generate_series(1,200000) g`);
await q(`CREATE INDEX ON j_x (code)`);
await q(`CREATE INDEX ON j_y (code)`);
await q(`VACUUM ANALYZE j_x, j_y`);
let [n, t] = await plan(`SELECT count(*) FROM j_x x JOIN j_y y ON lower(x.code) = y.code`);
console.log(`join on lower(x.code)            : ${n.padEnd(30)} ${t} ms`);
await q(`CREATE INDEX j_x_lower ON j_x (lower(code))`);
await q(`ANALYZE j_x`);
[n, t] = await plan(`SELECT count(*) FROM j_x x JOIN j_y y ON lower(x.code) = y.code`);
console.log(`same join with an expression index: ${n.padEnd(30)} ${t} ms`);
console.log('  ^ the index changes nothing: every row of both tables is needed anyway');

// where the expression index DOES pay: a small driving side, so the planner can
// probe instead of hashing all 200k rows.
await q(`DROP TABLE IF EXISTS j_small`);
await q(`CREATE TABLE j_small AS SELECT 'code'||g AS code FROM generate_series(1,50) g`);
await q(`VACUUM ANALYZE j_small`);
[n, t] = await plan(`SELECT count(*) FROM j_small s JOIN j_x x ON lower(x.code) = s.code`);
console.log(`50-row driving side, expr index    : ${n.padEnd(30)} ${t} ms`);
await q(`DROP INDEX j_x_lower`);
await q(`ANALYZE j_x`);
[n, t] = await plan(`SELECT count(*) FROM j_small s JOIN j_x x ON lower(x.code) = s.code`);
console.log(`same 50 rows, index dropped        : ${n.padEnd(30)} ${t} ms`);

await pool.end();
