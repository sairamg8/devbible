// Phase 9 pages 08, 10 — partial updates (COALESCE vs a built SET list) and
// keyset pagination on a real sort key (tuple comparison + matching index).
import pg from 'pg';

const URL = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: URL, max: 10});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
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

// ===========================================================================
// 08 · PARTIAL UPDATES
// ===========================================================================

await q(`DROP TABLE IF EXISTS k_profiles CASCADE`);
await q(`CREATE TABLE k_profiles (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name     text NOT NULL,
  bio      text,
  city     text,
  nickname text,
  updated_at timestamptz NOT NULL DEFAULT now())`);
await q(`INSERT INTO k_profiles (name, bio, city, nickname)
         VALUES ('Ada','Mathematician','London','Countess')`);

line('1. COALESCE cannot express "clear this field"');
{
  const patchCoalesce = async (id, f) => (await q(
    `UPDATE k_profiles SET name = COALESCE($2, name), bio = COALESCE($3, bio),
                           city = COALESCE($4, city), nickname = COALESCE($5, nickname)
      WHERE id = $1 RETURNING name, bio, city, nickname`,
    [id, f.name ?? null, f.bio ?? null, f.city ?? null, f.nickname ?? null])).rows[0];

  console.log('start          :', (await q(
    `SELECT name,bio,city,nickname FROM k_profiles WHERE id=1`)).rows[0]);
  console.log('PATCH {city}   :', await patchCoalesce(1, {city: 'Paris'}));
  console.log('PATCH {nickname: null} — the client is asking to clear it:');
  console.log('               :', await patchCoalesce(1, {nickname: null}));
  console.log('↑ unchanged. "absent" and "explicitly null" are the same value in JS,');
  console.log('  and COALESCE reads both as "keep what is there"');
}

line('2. a built SET list distinguishes absent from null');
{
  const COLUMNS = new Set(['name', 'bio', 'city', 'nickname']);   // the allowlist
  const patchDynamic = async (id, fields) => {
    const sets = [], params = [id];
    for (const [k, v] of Object.entries(fields)) {
      if (!COLUMNS.has(k)) throw new Error(`not updatable: ${k}`);
      params.push(v);
      sets.push(`${k} = $${params.length}`);
    }
    if (!sets.length) return null;                     // nothing to do
    return (await q(
      `UPDATE k_profiles SET ${sets.join(', ')}, updated_at = now()
        WHERE id = $1 RETURNING name, bio, city, nickname`, params)).rows[0];
  };
  console.log('PATCH {nickname: null}:', await patchDynamic(1, {nickname: null}));
  console.log('PATCH {}              :', await patchDynamic(1, {}));
  try {
    await patchDynamic(1, {'id = 1; DROP TABLE k_profiles; --': 'x'});
  } catch (e) {
    console.log('PATCH with a crafted key →', e.message);
  }
  console.log('↑ the key is checked against the allowlist; only the VALUE is a parameter');
}

line('3. what each form actually writes — HOT updates');
{
  await q(`DROP TABLE IF EXISTS k_hot`);
  await q(`CREATE TABLE k_hot (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    a text, b text, c text) WITH (fillfactor = 70)`);
  await q(`INSERT INTO k_hot (a,b,c)
           SELECT 'a'||g, 'b'||g, 'c'||g FROM generate_series(1,5000) g`);
  await q(`CREATE INDEX k_hot_b_idx ON k_hot(b)`);
  await q(`VACUUM ANALYZE k_hot`);

  // one dedicated connection: pg_stat_force_next_flush only flushes ITS backend
  const c = await pool.connect();
  const stats = async () => {
    await c.query(`SELECT pg_stat_force_next_flush()`);
    return (await c.query(
      `SELECT n_tup_upd, n_tup_hot_upd FROM pg_stat_user_tables
        WHERE relname = 'k_hot'`)).rows[0];
  };
  const step = async (label, sql, params) => {
    const before = await stats();
    await c.query(sql, params);
    const after = await stats();
    const upd = Number(after.n_tup_upd) - Number(before.n_tup_upd);
    const hot = Number(after.n_tup_hot_upd) - Number(before.n_tup_hot_upd);
    console.log(`  ${label.padEnd(46)} updated ${String(upd).padStart(4)}, HOT ${String(hot).padStart(4)}`);
    return {upd, hot};
  };

  console.log('index on b; fillfactor 70. 2500 rows per statement:');
  await step('COALESCE form, b keeps its own value',
    `UPDATE k_hot SET a = COALESCE($1,a), b = COALESCE($2,b), c = COALESCE($3,c)
      WHERE id <= 2500`, ['newA1', null, null]);
  await step('built SET list, only the unindexed column a',
    `UPDATE k_hot SET a = $1 WHERE id > 2500`, ['newA1']);
  await step('the indexed column b actually changes',
    `UPDATE k_hot SET b = $1 WHERE id <= 2500`, ['newB']);
  console.log('↑ naming an indexed column in SET does not defeat HOT — only changing');
  console.log('  its VALUE does. PostgreSQL compares values, not the text of the clause.');
  c.release();
}

line('4. a PATCH that changes nothing still writes a row version');
{
  const r1 = await q(`UPDATE k_profiles SET city = city WHERE id = 1`);
  console.log('SET city = city                     → rowCount', r1.rowCount);
  const r2 = await q(
    `UPDATE k_profiles SET city = $2 WHERE id = $1 AND city IS DISTINCT FROM $2`,
    [1, (await q(`SELECT city FROM k_profiles WHERE id=1`)).rows[0].city]);
  console.log('... AND city IS DISTINCT FROM $2    → rowCount', r2.rowCount);
  console.log('↑ the first made a dead tuple for no reason; the second skipped the write,');
  console.log('  but now rowCount 0 means "no change needed", not "not found"');
}

line('5. merging into a jsonb column instead');
{
  await q(`DROP TABLE IF EXISTS k_doc`);
  await q(`CREATE TABLE k_doc (id int PRIMARY KEY, data jsonb NOT NULL)`);
  await q(`INSERT INTO k_doc VALUES (1, '{"city":"London","nickname":"Countess"}')`);
  const merge = async (patch) => (await q(
    `UPDATE k_doc SET data = data || $1::jsonb WHERE id = 1 RETURNING data`,
    [JSON.stringify(patch)])).rows[0].data;
  console.log('merge {city}          :', await merge({city: 'Paris'}));
  console.log('merge {nickname:null} :', await merge({nickname: null}));
  console.log('↑ null is stored as a JSON null, not "absent" — removing needs the - operator');
  console.log('remove with data - key:', (await q(
    `UPDATE k_doc SET data = data - 'nickname' WHERE id = 1 RETURNING data`)).rows[0].data);
}

// ===========================================================================
// 10 · KEYSET PAGINATION ON A REAL SORT KEY
// ===========================================================================

const N = 500_000;
await q(`DROP TABLE IF EXISTS k_events`);
await q(`CREATE TABLE k_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL,
  title      text NOT NULL)`);
// deliberately not unique: many rows share a created_at, which is the whole point
await q(`INSERT INTO k_events (created_at, title)
         SELECT timestamptz '2026-01-01' + ((g % 5000) * interval '1 minute'),
                'event ' || g
           FROM generate_series(1,$1) g`, [N]);
await q(`CREATE INDEX k_events_created_id_idx ON k_events (created_at DESC, id DESC)`);
await q(`ANALYZE k_events`);
console.log(`\nseeded ${N} events across 5000 distinct timestamps ` +
  `(${N / 5000} rows per timestamp)`);

line('6. OFFSET vs keyset at the same depth');
{
  const PAGE = 20, DEEP = 499_980;
  const offsetPage = () => q(
    `SELECT id, created_at, title FROM k_events
      ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`, [PAGE, DEEP]);
  const cursorRow = (await q(
    `SELECT created_at, id FROM k_events
      ORDER BY created_at DESC, id DESC LIMIT 1 OFFSET $1`, [DEEP - 1])).rows[0];
  const keysetPage = () => q(
    `SELECT id, created_at, title FROM k_events
      WHERE (created_at, id) < ($1, $2)
      ORDER BY created_at DESC, id DESC LIMIT $3`,
    [cursorRow.created_at, cursorRow.id, PAGE]);

  console.log(`OFFSET ${DEEP}  ${(await timed(5, offsetPage)).toFixed(2).padStart(8)} ms`);
  console.log(`keyset at same depth  ${(await timed(5, keysetPage)).toFixed(2).padStart(8)} ms`);
  for (const [label, fn] of [['OFFSET', offsetPage], ['keyset', keysetPage]]) {
    const sql = label === 'OFFSET'
      ? `SELECT id FROM k_events ORDER BY created_at DESC, id DESC LIMIT ${PAGE} OFFSET ${DEEP}`
      : `SELECT id FROM k_events WHERE (created_at, id) < ('${cursorRow.created_at.toISOString()}', ${cursorRow.id})
           ORDER BY created_at DESC, id DESC LIMIT ${PAGE}`;
    const r = await q(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) ${sql}`);
    console.log(`\n${label} plan:`);
    console.log(r.rows.map((x) => '  ' + x['QUERY PLAN']).join('\n'));
  }
}

line('7. the row-constructor form vs writing the comparison out by hand');
{
  const cur = (await q(
    `SELECT created_at, id FROM k_events
      ORDER BY created_at DESC, id DESC LIMIT 1 OFFSET 250000`)).rows[0];
  const tuple = () => q(
    `SELECT id FROM k_events WHERE (created_at, id) < ($1,$2)
      ORDER BY created_at DESC, id DESC LIMIT 20`, [cur.created_at, cur.id]);
  const expanded = () => q(
    `SELECT id FROM k_events
      WHERE created_at < $1 OR (created_at = $1 AND id < $2)
      ORDER BY created_at DESC, id DESC LIMIT 20`, [cur.created_at, cur.id]);
  const t = await tuple(), e = await expanded();
  console.log('same rows?', JSON.stringify(t.rows) === JSON.stringify(e.rows));
  console.log(`row constructor  ${(await timed(5, tuple)).toFixed(2).padStart(8)} ms`);
  console.log(`expanded OR form ${(await timed(5, expanded)).toFixed(2).padStart(8)} ms`);
  for (const [label, sql] of [
    ['row constructor', `SELECT id FROM k_events
       WHERE (created_at, id) < ('${cur.created_at.toISOString()}', ${cur.id})
       ORDER BY created_at DESC, id DESC LIMIT 20`],
    ['expanded OR', `SELECT id FROM k_events
       WHERE created_at < '${cur.created_at.toISOString()}'
          OR (created_at = '${cur.created_at.toISOString()}' AND id < ${cur.id})
       ORDER BY created_at DESC, id DESC LIMIT 20`],
  ]) {
    const r = await q(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF) ${sql}`);
    const plan = r.rows.map((x) => x['QUERY PLAN']);
    console.log(`\n${label}:`);
    console.log(plan.filter((l) =>
      /Scan|Index Cond|Filter|Buffers|Rows Removed/.test(l))
      .map((l) => '  ' + l.trim()).join('\n'));
  }
}

line('8. paging right through, keyset vs OFFSET');
{
  const PAGE = 20;
  let PAGES = 50;
  const walkKeyset = async () => {
    let cur = null, seen = 0;
    for (let p = 0; p < PAGES; p++) {
      const {rows} = cur
        ? await q(`SELECT id, created_at FROM k_events WHERE (created_at,id) < ($1,$2)
                    ORDER BY created_at DESC, id DESC LIMIT $3`, [cur.created_at, cur.id, PAGE])
        : await q(`SELECT id, created_at FROM k_events
                    ORDER BY created_at DESC, id DESC LIMIT $1`, [PAGE]);
      if (!rows.length) break;
      cur = rows[rows.length - 1];
      seen += rows.length;
    }
    return seen;
  };
  const walkOffset = async () => {
    let seen = 0;
    for (let p = 0; p < PAGES; p++) {
      const {rows} = await q(
        `SELECT id FROM k_events ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
        [PAGE, p * PAGE]);
      if (!rows.length) break;
      seen += rows.length;
    }
    return seen;
  };
  for (const p of [50, 500, 2000]) {
    PAGES = p;
    const k = await timed(3, walkKeyset);
    const o = await timed(3, walkOffset);
    console.log(`${String(p).padStart(4)} pages of ${PAGE} ` +
      `(deepest offset ${String((p - 1) * PAGE).padStart(6)}):  ` +
      `keyset ${k.toFixed(0).padStart(5)} ms   OFFSET ${o.toFixed(0).padStart(5)} ms   ` +
      `${(o / k).toFixed(1)}x`);
  }
  PAGES = 50;
  console.log(`(both walks returned ${await walkKeyset()} rows at 50 pages)`);
}

line('9. the traps: mixed directions and a nullable sort column');
{
  const cur = (await q(
    `SELECT created_at, id FROM k_events
      ORDER BY created_at DESC, id DESC LIMIT 1 OFFSET 100`)).rows[0];
  // the tuple form encodes ONE direction for the whole tuple
  const mixed = await q(
    `SELECT id, created_at FROM k_events WHERE (created_at, id) < ($1,$2)
      ORDER BY created_at DESC, id ASC LIMIT 5`, [cur.created_at, cur.id]);
  const correct = await q(
    `SELECT id, created_at FROM k_events
      WHERE created_at < $1 OR (created_at = $1 AND id > $2)
      ORDER BY created_at DESC, id ASC LIMIT 5`, [cur.created_at, cur.id]);
  console.log('ORDER BY created_at DESC, id ASC with the tuple form:');
  console.log('  ids:', mixed.rows.map((r) => r.id).join(','));
  console.log('  hand-written comparison for the same order:');
  console.log('  ids:', correct.rows.map((r) => r.id).join(','));
  console.log('  same?', JSON.stringify(mixed.rows) === JSON.stringify(correct.rows));
  console.log('↑ (a,b) < (x,y) means "DESC on both"; a mixed sort needs the expanded form');

  await q(`ALTER TABLE k_events ADD COLUMN archived_at timestamptz`);
  await q(`UPDATE k_events SET archived_at = created_at WHERE id % 2 = 0`);
  const nulls = await q(
    `SELECT count(*)::int c FROM k_events WHERE (archived_at, id) < ($1, $2)`,
    [new Date('2030-01-01'), 10_000_000]);
  const total = await q(`SELECT count(*)::int c FROM k_events`);
  console.log(`\nnullable sort column: comparison matched ${nulls.rows[0].c} of ${total.rows[0].c} rows`);
  console.log('↑ every row with a NULL key is silently excluded — the page walk stops early');
}

await q(`DROP TABLE IF EXISTS k_events, k_profiles, k_hot, k_doc CASCADE`);
await pool.end();
