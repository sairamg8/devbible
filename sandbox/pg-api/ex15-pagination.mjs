// Phase 4 page 03 — LIMIT / OFFSET. Deep-offset cost, keyset comparison, drift.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

// median of n runs, ms
const timed = async (n, fn) => {
  const ts = [];
  for (let i = 0; i < n; i++) {
    const t0 = process.hrtime.bigint();
    await fn();
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ts.sort((a, b) => a - b);
  return ts[Math.floor(ts.length / 2)];
};

const N = 500_000;
await q(`DROP TABLE IF EXISTS p_rows`);
await q(`CREATE TABLE p_rows (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now())`);
await q(`INSERT INTO p_rows (name)
         SELECT 'row ' || g FROM generate_series(1,$1) g`, [N]);
await q(`ANALYZE p_rows`);
console.log(`seeded ${N} rows`);

// --- 1. how OFFSET scales with depth ---------------------------------------
line('1. SELECT ... ORDER BY id LIMIT 20 OFFSET n');
{
  for (const off of [0, 1_000, 10_000, 100_000, 499_980]) {
    const ms = await timed(5, () =>
      q(`SELECT id, name FROM p_rows ORDER BY id LIMIT 20 OFFSET $1`, [off]));
    console.log(`OFFSET ${String(off).padStart(6)}   ${ms.toFixed(2).padStart(8)} ms`);
  }
}

// --- 2. what the plan says it is doing -------------------------------------
line('2. EXPLAIN ANALYZE at OFFSET 499980');
{
  const r = await q(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
    SELECT id, name FROM p_rows ORDER BY id LIMIT 20 OFFSET 499980`);
  console.log(r.rows.map(x => '  ' + x['QUERY PLAN']).join('\n'));
}

// --- 3. keyset at the same depth -------------------------------------------
line('3. keyset: WHERE id > $1 ORDER BY id LIMIT 20');
{
  const last = (await q(`SELECT id FROM p_rows ORDER BY id OFFSET 499979 LIMIT 1`)).rows[0].id;
  const ms = await timed(5, () =>
    q(`SELECT id, name FROM p_rows WHERE id > $1 ORDER BY id LIMIT 20`, [last]));
  console.log(`keyset at the same depth   ${ms.toFixed(2).padStart(8)} ms  (after id=${last})`);
  const r = await q(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
    SELECT id, name FROM p_rows WHERE id > $1 ORDER BY id LIMIT 20`, [last]);
  console.log(r.rows.map(x => '  ' + x['QUERY PLAN']).join('\n'));
}

// --- 4. the count(*) that powers "page 1 of N" -----------------------------
line('4. cost of the total count');
{
  const ms = await timed(3, () => q(`SELECT count(*)::int FROM p_rows`));
  console.log(`SELECT count(*)                ${ms.toFixed(2).padStart(8)} ms`);
  const est = await q(`SELECT reltuples::bigint AS est FROM pg_class WHERE relname='p_rows'`);
  const ms2 = await timed(3, () =>
    q(`SELECT reltuples::bigint FROM pg_class WHERE relname='p_rows'`));
  console.log(`planner estimate (reltuples)   ${ms2.toFixed(2).padStart(8)} ms  → ${est.rows[0].est}`);
}

// --- 5. drift: a concurrent insert shifts every later page ------------------
line('5. OFFSET drift under a concurrent write');
{
  await q(`DROP TABLE IF EXISTS p_feed`);
  await q(`CREATE TABLE p_feed (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text)`);
  await q(`INSERT INTO p_feed (name) SELECT 'item ' || g FROM generate_series(1,20) g`);

  const page = async (off) => (await q(
    `SELECT name FROM p_feed ORDER BY id DESC LIMIT 5 OFFSET $1`, [off])).rows.map(r => r.name);

  const p1 = await page(0);
  console.log('page 1        :', p1.join(', '));
  await q(`INSERT INTO p_feed (name) VALUES ('item 21 — arrived between pages')`);
  const p2 = await page(5);
  console.log('page 2 (after):', p2.join(', '));
  const overlap = p2.filter(n => p1.includes(n));
  console.log(`repeated across the page boundary: ${overlap.length ? overlap.join(', ') : '(none)'}`);

  // keyset does not drift
  const k1 = await q(`SELECT id, name FROM p_feed ORDER BY id DESC LIMIT 5`);
  await q(`INSERT INTO p_feed (name) VALUES ('item 22 — arrived between pages')`);
  const k2 = await q(`SELECT name FROM p_feed WHERE id < $1 ORDER BY id DESC LIMIT 5`,
    [k1.rows.at(-1).id]);
  const kNames = k1.rows.map(r => r.name);
  const kOverlap = k2.rows.map(r => r.name).filter(n => kNames.includes(n));
  console.log('keyset page 2 :', k2.rows.map(r => r.name).join(', '));
  console.log(`repeated with keyset: ${kOverlap.length ? kOverlap.join(', ') : '(none)'}`);
}

// --- 6. LIMIT without ORDER BY has no defined order ------------------------
line('6. LIMIT without ORDER BY');
{
  await q(`DROP TABLE IF EXISTS p_noorder`);
  await q(`CREATE TABLE p_noorder AS SELECT g AS id FROM generate_series(1,50) g`);
  const a = (await q(`SELECT id FROM p_noorder LIMIT 5`)).rows.map(r => r.id);
  await q(`UPDATE p_noorder SET id = id WHERE id = 1`);  // rewrite one tuple
  const b = (await q(`SELECT id FROM p_noorder LIMIT 5`)).rows.map(r => r.id);
  console.log('before update:', a.join(','));
  console.log('after  update:', b.join(','), a.join(',') === b.join(',') ? '(same)' : '← ORDER CHANGED');
}

await q(`DROP TABLE IF EXISTS p_rows, p_feed, p_noorder`);
await pool.end();
