// Phase 4 page 11 — DELETE: USING, FK actions, batching, dead tuples.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

// --- 1. no WHERE -----------------------------------------------------------
line('1. DELETE with no WHERE');
{
  await q(`DROP TABLE IF EXISTS d_all`);
  await q(`CREATE TABLE d_all AS SELECT g AS id FROM generate_series(1,10) g`);
  const r = await q(`DELETE FROM d_all`);
  console.log('DELETE FROM d_all → rowCount:', r.rowCount, '← every row');
}

// --- 2. DELETE ... USING (join delete) -------------------------------------
line('2. DELETE ... USING');
{
  await q(`DROP TABLE IF EXISTS d_items, d_banned`);
  await q(`CREATE TABLE d_items (id int PRIMARY KEY, sku text, name text)`);
  await q(`CREATE TABLE d_banned (sku text)`);
  await q(`INSERT INTO d_items VALUES (1,'a1','Keep'),(2,'a2','Drop'),(3,'a3','Drop')`);
  await q(`INSERT INTO d_banned VALUES ('a2'),('a3')`);
  const r = await q(`DELETE FROM d_items i USING d_banned b
                     WHERE b.sku = i.sku RETURNING i.id, i.sku`);
  console.log('rowCount:', r.rowCount, '| removed:', r.rows.map(x => x.sku).join(', '));
  console.log('left:', (await q(`SELECT sku FROM d_items`)).rows.map(x => x.sku).join(', '));

  // the subquery equivalent
  await q(`INSERT INTO d_items VALUES (4,'a4','Drop me')`);
  const s = await q(`DELETE FROM d_items WHERE sku IN (SELECT 'a4') RETURNING sku`);
  console.log('subquery form → removed', s.rows.map(x => x.sku).join(', '));
}

// --- 3. what a foreign key does to a DELETE --------------------------------
line('3. foreign-key actions');
{
  for (const action of ['RESTRICT', 'NO ACTION', 'CASCADE', 'SET NULL']) {
    await q(`DROP TABLE IF EXISTS d_child, d_parent`);
    await q(`CREATE TABLE d_parent (id int PRIMARY KEY)`);
    await q(`CREATE TABLE d_child (
      id int PRIMARY KEY,
      parent_id int ${action === 'SET NULL' ? '' : 'NOT NULL'}
        REFERENCES d_parent(id) ON DELETE ${action})`);
    await q(`INSERT INTO d_parent VALUES (1)`);
    await q(`INSERT INTO d_child VALUES (10, 1)`);
    try {
      const r = await q(`DELETE FROM d_parent WHERE id = 1`);
      const child = await q(`SELECT id, parent_id FROM d_child`);
      console.log(`ON DELETE ${action.padEnd(9)} → deleted ${r.rowCount}, child rows now:`,
        JSON.stringify(child.rows));
    } catch (e) {
      console.log(`ON DELETE ${action.padEnd(9)} → ${e.code} ${e.message.split('\n')[0]}`);
    }
  }
}

// --- 4. deleting in batches ------------------------------------------------
line('4. DELETE does not take LIMIT');
{
  await q(`DROP TABLE IF EXISTS d_big`);
  await q(`CREATE TABLE d_big (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, junk text)`);
  await q(`INSERT INTO d_big (junk) SELECT repeat('x',100) FROM generate_series(1,200000)`);
  try { await q(`DELETE FROM d_big LIMIT 100`); }
  catch (e) { console.log('DELETE ... LIMIT 100 →', e.code, e.message.split('\n')[0]); }

  const t0 = process.hrtime.bigint();
  const one = await q(`DELETE FROM d_big WHERE id <= 100000`);
  const ms1 = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`one DELETE of ${one.rowCount} rows      ${ms1.toFixed(0)} ms (one transaction, one lock window)`);

  let total = 0, batches = 0;
  const t1 = process.hrtime.bigint();
  for (;;) {
    const r = await q(`DELETE FROM d_big WHERE ctid IN
                       (SELECT ctid FROM d_big ORDER BY id LIMIT 10000)`);
    if (r.rowCount === 0) break;
    total += r.rowCount; batches++;
  }
  const ms2 = Number(process.hrtime.bigint() - t1) / 1e6;
  console.log(`${batches} batched deletes of ${total} rows ${ms2.toFixed(0)} ms (each commits separately)`);
}

// --- 5. dead tuples and space ----------------------------------------------
line('5. what DELETE leaves behind (deleting HALF the rows)');
{
  await q(`DROP TABLE IF EXISTS d_space`);
  await q(`CREATE TABLE d_space (id bigint, junk text)`);
  await q(`INSERT INTO d_space SELECT g, repeat('x',200) FROM generate_series(1,200000) g`);
  const size = async () => (await q(
    `SELECT pg_size_pretty(pg_total_relation_size('d_space')) s`)).rows[0].s;
  const dead = async () => {
    // the stats collector is asynchronous; give it a moment to report
    for (let i = 0; i < 20; i++) {
      const r = await q(`SELECT n_dead_tup, n_live_tup FROM pg_stat_user_tables WHERE relname='d_space'`);
      if (r.rows[0] && Number(r.rows[0].n_dead_tup) > 0) return r.rows[0];
      await new Promise(res => setTimeout(res, 250));
    }
    return (await q(`SELECT n_dead_tup, n_live_tup FROM pg_stat_user_tables WHERE relname='d_space'`)).rows[0];
  };
  console.log('after insert 200k     :', await size());

  // delete every other row, so dead tuples are spread through the file
  const d = await q(`DELETE FROM d_space WHERE id % 2 = 0`);
  console.log(`after DELETE of ${d.rowCount}:`, await size(), '| stats:', JSON.stringify(await dead()));
  await q(`VACUUM d_space`);
  console.log('after VACUUM          :', await size(),
    '← unchanged: space is marked reusable in place, not returned to the OS');
  await q(`VACUUM FULL d_space`);
  console.log('after VACUUM FULL     :', await size(),
    '← rewritten and shrunk, but takes ACCESS EXCLUSIVE');

  // contrast: when EVERY row goes, VACUUM can truncate the trailing empty pages
  await q(`DROP TABLE IF EXISTS d_space2`);
  await q(`CREATE TABLE d_space2 (id bigint, junk text)`);
  await q(`INSERT INTO d_space2 SELECT g, repeat('x',200) FROM generate_series(1,200000) g`);
  const size2 = async () => (await q(
    `SELECT pg_size_pretty(pg_total_relation_size('d_space2')) s`)).rows[0].s;
  console.log('\ncontrast — delete ALL rows, then VACUUM:');
  console.log('  after insert 200k   :', await size2());
  await q(`DELETE FROM d_space2`);
  await q(`VACUUM d_space2`);
  console.log('  after DELETE+VACUUM :', await size2(),
    '← here VACUUM *can* truncate, because every trailing page became empty');
}

await q(`DROP TABLE IF EXISTS d_all, d_items, d_banned, d_child, d_parent, d_big, d_space, d_space2`);
await pool.end();
