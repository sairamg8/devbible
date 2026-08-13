// Phase 4 page 13 — does MERGE support RETURNING on PostgreSQL 18?
// The page says seven times that it does not. Fable's corpus review claims it does,
// and that RETURNING + merge_action() arrived in PG17. Settle it on the server.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 4,
});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const attempt = async (label, sql, params) => {
  try {
    const r = await q(sql, params);
    const last = Array.isArray(r) ? r[r.length - 1] : r;
    console.log(`${label.padEnd(46)} → OK`);
    return last;
  } catch (e) {
    console.log(`${label.padEnd(46)} → ${e.code} ${e.message.split('\n')[0]}`);
    return null;
  }
};

line('server version');
console.log((await q('select version()')).rows[0].version);
console.log('server_version_num =', (await q('show server_version_num')).rows[0].server_version_num);

line('fixture');
await q(`drop table if exists m_target, m_source`);
await q(`create table m_target (id int primary key, qty int, note text)`);
await q(`create table m_source (id int primary key, qty int)`);
await q(`insert into m_target values (1, 10, 'existing'), (2, 20, 'existing'), (3, 30, 'to-delete')`);
await q(`insert into m_source values (1, 111), (2, 222), (4, 444)`);
console.log('target:', (await q('select * from m_target order by id')).rows);
console.log('source:', (await q('select * from m_source order by id')).rows);

// ---------------------------------------------------------------- the claim
line('1. plain MERGE ... RETURNING');
const r1 = await attempt('MERGE ... RETURNING id, qty', `
  merge into m_target t
  using m_source s on t.id = s.id
  when matched then update set qty = s.qty
  when not matched then insert (id, qty, note) values (s.id, s.qty, 'inserted')
  returning t.id, t.qty, t.note
`);
if (r1) console.table(r1.rows);

line('2. merge_action() in RETURNING');
await q(`drop table if exists m_target`);
await q(`create table m_target (id int primary key, qty int, note text)`);
await q(`insert into m_target values (1, 10, 'existing'), (2, 20, 'existing'), (3, 30, 'to-delete')`);
const r2 = await attempt('RETURNING merge_action(), t.id, t.qty', `
  merge into m_target t
  using m_source s on t.id = s.id
  when matched and s.qty > 200 then delete
  when matched then update set qty = s.qty
  when not matched then insert (id, qty, note) values (s.id, s.qty, 'inserted')
  returning merge_action(), t.id, t.qty, t.note
`);
if (r2) console.table(r2.rows);

line('3. does merge_action() work outside a MERGE?');
await attempt('select merge_action()', `select merge_action()`);

line('4. OLD/NEW aliases in a MERGE RETURNING (PG18 feature)');
await q(`drop table if exists m_target`);
await q(`create table m_target (id int primary key, qty int, note text)`);
await q(`insert into m_target values (1, 10, 'existing'), (2, 20, 'existing')`);
const r4 = await attempt('RETURNING old.qty, new.qty', `
  merge into m_target t
  using m_source s on t.id = s.id
  when matched then update set qty = s.qty
  when not matched then insert (id, qty, note) values (s.id, s.qty, 'inserted')
  returning merge_action() as action, old.qty as was, new.qty as now
`);
if (r4) console.table(r4.rows);

line('5. rowCount and per-action counts from the driver');
await q(`drop table if exists m_target`);
await q(`create table m_target (id int primary key, qty int, note text)`);
await q(`insert into m_target values (1, 10, 'existing'), (2, 20, 'existing'), (3, 30, 'to-delete')`);
const r5 = await q(`
  merge into m_target t
  using m_source s on t.id = s.id
  when matched and s.qty > 200 then delete
  when matched then update set qty = s.qty
  when not matched then insert (id, qty, note) values (s.id, s.qty, 'inserted')
  returning merge_action() as action
`);
console.log('rowCount =', r5.rowCount, '(rows affected by ALL actions)');
const byAction = r5.rows.reduce((a, r) => (a[r.action] = (a[r.action] || 0) + 1, a), {});
console.log('per-action counts derived from merge_action():', byAction);

line('6. what the command tag says (no RETURNING)');
await q(`drop table if exists m_target`);
await q(`create table m_target (id int primary key, qty int, note text)`);
await q(`insert into m_target values (1, 10, 'existing'), (2, 20, 'existing'), (3, 30, 'to-delete')`);
const r6 = await q(`
  merge into m_target t
  using m_source s on t.id = s.id
  when matched and s.qty > 200 then delete
  when matched then update set qty = s.qty
  when not matched then insert (id, qty, note) values (s.id, s.qty, 'inserted')
`);
console.log('command =', r6.command, ' rowCount =', r6.rowCount,
            ' → the tag does NOT break down insert/update/delete');

line('7. WHEN NOT MATCHED BY SOURCE (PG17)');
await q(`drop table if exists m_target`);
await q(`create table m_target (id int primary key, qty int, note text)`);
await q(`insert into m_target values (1, 10, 'existing'), (2, 20, 'existing'), (3, 30, 'orphan')`);
const r7 = await attempt('WHEN NOT MATCHED BY SOURCE THEN DELETE', `
  merge into m_target t
  using m_source s on t.id = s.id
  when matched then update set qty = s.qty
  when not matched by source then delete
  returning merge_action() as action, t.id
`);
if (r7) console.table(r7.rows);

await q(`drop table if exists m_target, m_source`);
await pool.end();
