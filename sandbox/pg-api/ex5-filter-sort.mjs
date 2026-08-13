// Phase 9 / 02-04 and Phase 4 / 10 — dynamic WHERE, allowlists, ORDER BY.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible',
  max: 10,
});
const line = (t) => console.log(`\n=== ${t} ===`);
const q = (...a) => pool.query(...a);

await q(`DROP TABLE IF EXISTS fs_items CASCADE`);
await q(`
  CREATE TABLE fs_items (
    id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name     text NOT NULL,
    status   text NOT NULL,
    price    numeric(10,2),
    owner    text,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`);
await q(`
  INSERT INTO fs_items (name, status, price, owner) VALUES
    ('apple',   'active',  '10.00', 'ann'),
    ('Banana',  'active',  '30.00', 'bob'),
    ('cherry',  'archived','20.00', NULL),
    ('date',    'active',   NULL,   'ann'),
    ('Elderberry','active','20.00', NULL),
    ('fig',     'archived', '5.00', 'bob')
`);

// --- 1. can ORDER BY take a parameter? ------------------------------------
line('1. ORDER BY $1');
{
  const a = await q(`SELECT name FROM fs_items ORDER BY $1`, ['name']);
  console.log('ORDER BY $1 with "name" →', a.rows.map((r) => r.name).join(', '));
  const b = await q(`SELECT name FROM fs_items ORDER BY $1`, ['price']);
  console.log('ORDER BY $1 with "price" →', b.rows.map((r) => r.name).join(', '));
  console.log('identical:', JSON.stringify(a.rows) === JSON.stringify(b.rows),
    '— the parameter is a constant, not a column reference');
  try {
    await q(`SELECT name FROM fs_items WHERE status = $1 ORDER BY $2 DESC`, ['active', 'name']);
    console.log('...and it raises no error, so nothing tells you it did not work');
  } catch (e) {
    console.log('error:', e.code, e.message);
  }
}

// --- 2. what concatenating an identifier lets through ---------------------
line('2. concatenated ORDER BY — the injection');
{
  const listBad = (sortBy) => q(`SELECT id, name FROM fs_items ORDER BY ${sortBy} LIMIT 3`);
  console.log('?sort=name →', (await listBad('name')).rows.map((r) => r.name).join(', '));
  const attack = `name; DROP TABLE fs_items CASCADE; --`;
  try {
    const res = await listBad(attack);
    console.log(`?sort=${attack}`);
    console.log('  →', Array.isArray(res) ? `${res.length} statements executed` : res.command);
  } catch (e) {
    console.log('  →', e.code, e.message);
  }
  const {rows} = await q(`SELECT to_regclass('fs_items') AS still_there`);
  console.log('fs_items after that request:', rows[0].still_there ?? 'GONE');
}
// rebuild if it was dropped
await q(`
  CREATE TABLE IF NOT EXISTS fs_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL, status text NOT NULL,
    price numeric(10,2), owner text,
    created_at timestamptz NOT NULL DEFAULT now())
`);
{
  const {rows} = await q('SELECT count(*)::int AS n FROM fs_items');
  if (rows[0].n === 0) {
    await q(`
      INSERT INTO fs_items (name, status, price, owner) VALUES
        ('apple','active','10.00','ann'), ('Banana','active','30.00','bob'),
        ('cherry','archived','20.00',NULL), ('date','active',NULL,'ann'),
        ('Elderberry','active','20.00',NULL), ('fig','archived','5.00','bob')
    `);
    console.log('(table was dropped — rebuilt and reseeded)');
  }
}

// --- 3. a data value cannot do the same thing -----------------------------
line('3. the same payload as a parameter');
{
  const res = await q(`SELECT id, name FROM fs_items WHERE name = $1`,
    [`apple'; DROP TABLE fs_items; --`]);
  console.log('rows:', res.rowCount, '| table still there:',
    (await q(`SELECT to_regclass('fs_items') AS t`)).rows[0].t);
}

// --- 4. building predicates and params together ---------------------------
line('4. dynamic WHERE built alongside its parameter array');
{
  const buildList = (filters) => {
    const where = [];
    const params = [];
    if (filters.status) { params.push(filters.status); where.push(`status = $${params.length}`); }
    if (filters.owner)  { params.push(filters.owner);  where.push(`owner = $${params.length}`); }
    if (filters.minPrice != null) { params.push(filters.minPrice); where.push(`price >= $${params.length}`); }
    if (filters.q) { params.push(`%${filters.q}%`); where.push(`name ILIKE $${params.length}`); }
    const sql = `SELECT id, name, status, price, owner FROM fs_items` +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') + ` ORDER BY id`;
    return {sql, params};
  };

  for (const f of [{}, {status: 'active'}, {status: 'active', owner: 'ann'}, {q: 'an', minPrice: '10.00'}]) {
    const {sql, params} = buildList(f);
    const {rows} = await q(sql, params);
    console.log(`\nfilters ${JSON.stringify(f)}`);
    console.log('  sql:', sql.replace(/\s+/g, ' '));
    console.log('  params:', JSON.stringify(params));
    console.log('  rows:', rows.map((r) => r.name).join(', ') || '(none)');
  }
}

// --- 5. ILIKE and the wildcards inside user input -------------------------
line('5. wildcards inside the search term');
{
  const search = async (term) => {
    const {rows} = await q(`SELECT name FROM fs_items WHERE name ILIKE $1 ORDER BY id`, [`%${term}%`]);
    return rows.map((r) => r.name).join(', ') || '(none)';
  };
  console.log(`term "an"  →`, await search('an'));
  console.log(`term "%"   →`, await search('%'), '  ← matches everything');
  console.log(`term "_"   →`, await search('_'), '  ← matches everything');
  const escaped = async (term) => {
    const {rows} = await q(
      `SELECT name FROM fs_items WHERE name ILIKE $1 ESCAPE '\\' ORDER BY id`,
      [`%${term.replace(/[\\%_]/g, (c) => '\\' + c)}%`],
    );
    return rows.map((r) => r.name).join(', ') || '(none)';
  };
  console.log(`term "%" escaped →`, await escaped('%'));
  console.log(`term "_" escaped →`, await escaped('_'));
}

// --- 6. allowlisting the identifier ---------------------------------------
line('6. allowlist');
{
  const SORTABLE = {name: 'name', price: 'price', created: 'created_at'};
  const list = async (sortKey, dir) => {
    const col = SORTABLE[sortKey];
    if (!col) throw Object.assign(new Error(`unsortable field: ${sortKey}`), {status: 400});
    const order = dir === 'desc' ? 'DESC' : 'ASC';
    const {rows} = await q(`SELECT name FROM fs_items ORDER BY ${col} ${order}, id ASC LIMIT 4`);
    return rows.map((r) => r.name).join(', ');
  };
  console.log('sort=price asc  →', await list('price', 'asc'));
  console.log('sort=name desc  →', await list('name', 'desc'));
  try { await list('name; DROP TABLE fs_items; --', 'asc'); }
  catch (e) { console.log('sort=<payload>  → rejected before SQL:', e.status, e.message); }
}

// --- 7. quote_ident, when the identifier is genuinely dynamic -------------
line('7. format/quote_ident for a genuinely dynamic identifier');
{
  const {rows} = await q(`SELECT quote_ident($1) AS a, quote_ident($2) AS b, format('ORDER BY %I', $2) AS c`,
    ['name', 'name; DROP TABLE fs_items; --']);
  console.log(rows[0]);
}

// --- 8. NULL ordering defaults --------------------------------------------
line('8. where NULLs land');
{
  const show = async (clause) => {
    const {rows} = await q(`SELECT name, price FROM fs_items ORDER BY ${clause}, id`);
    return rows.map((r) => `${r.name}:${r.price ?? 'NULL'}`).join('  ');
  };
  console.log('price ASC              →', await show('price ASC'));
  console.log('price DESC             →', await show('price DESC'));
  console.log('price ASC NULLS FIRST  →', await show('price ASC NULLS FIRST'));
  console.log('price DESC NULLS LAST  →', await show('price DESC NULLS LAST'));
}

// --- 9. case and collation ------------------------------------------------
line('9. case sensitivity in ORDER BY');
{
  const {rows: db} = await q(`SELECT datcollate, datctype FROM pg_database WHERE datname = current_database()`);
  console.log('database collation:', db[0]);
  const plain = await q(`SELECT name FROM fs_items ORDER BY name`);
  console.log('ORDER BY name        →', plain.rows.map((r) => r.name).join(', '));
  const cbin = await q(`SELECT name FROM fs_items ORDER BY name COLLATE "C"`);
  console.log('ORDER BY name COLLATE "C" →', cbin.rows.map((r) => r.name).join(', '));
  const lower = await q(`SELECT name FROM fs_items ORDER BY lower(name)`);
  console.log('ORDER BY lower(name) →', lower.rows.map((r) => r.name).join(', '));
}

// --- 10. an unstable sort under pagination --------------------------------
line('10. ties + LIMIT/OFFSET without a tiebreaker');
{
  await q(`DROP TABLE IF EXISTS fs_tie`);
  await q(`CREATE TABLE fs_tie (id int primary key, grp int)`);
  await q(`INSERT INTO fs_tie SELECT g, g % 3 FROM generate_series(1, 30000) g`);
  await q(`ANALYZE fs_tie`);
  const page = async (offset) => {
    const {rows} = await q(`SELECT id FROM fs_tie ORDER BY grp LIMIT 5 OFFSET $1`, [offset]);
    return rows.map((r) => r.id);
  };
  const p1 = await page(0);
  const p1b = await page(0);
  console.log('page 1, run A:', p1.join(','));
  console.log('page 1, run B:', p1b.join(','));
  const seen = new Set();
  let dupes = 0;
  for (let off = 0; off < 100; off += 5) for (const id of await page(off)) {
    if (seen.has(id)) dupes++; else seen.add(id);
  }
  console.log(`paging 0→100 by 5 without a tiebreaker: ${seen.size} distinct ids, ${dupes} repeats`);
  const seen2 = new Set();
  let dupes2 = 0;
  for (let off = 0; off < 100; off += 5) {
    const {rows} = await q(`SELECT id FROM fs_tie ORDER BY grp, id LIMIT 5 OFFSET $1`, [off]);
    for (const r of rows) { if (seen2.has(r.id)) dupes2++; else seen2.add(r.id); }
  }
  console.log(`same, with ", id" as tiebreaker:        ${seen2.size} distinct ids, ${dupes2} repeats`);
  await q(`DROP TABLE fs_tie`);
}

// --- 11. index size: full vs partial --------------------------------------
line('11. full vs partial index size on the same column');
{
  await q(`DROP TABLE IF EXISTS fs_size`);
  await q(`CREATE TABLE fs_size (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
           email text NOT NULL, deleted_at timestamptz)`);
  await q(`INSERT INTO fs_size (email, deleted_at)
           SELECT 'u'||g||'@x.com', CASE WHEN g%10=0 THEN now() ELSE NULL END
           FROM generate_series(1,200000) g`);
  await q(`CREATE INDEX fs_size_full ON fs_size (email)`);
  await q(`CREATE INDEX fs_size_partial ON fs_size (email) WHERE deleted_at IS NULL`);
  const {rows} = await q(`SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) AS size
                          FROM pg_stat_user_indexes WHERE relname='fs_size' ORDER BY 1`);
  console.table(rows);
  await q(`DROP TABLE fs_size`);
}

await q(`DROP TABLE IF EXISTS fs_items CASCADE`);
await pool.end();
