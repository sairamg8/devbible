// Phase 3 / 05, 09 — which ALTER TABLE operations rewrite the table?
// relfilenode changes iff the physical file was replaced.
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);

const ROWS = 200000;
const build = async () => {
  await q(`DROP TABLE IF EXISTS alt_t CASCADE`);
  await q(`CREATE TABLE alt_t (
    id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email  text NOT NULL,
    n      int  NOT NULL,
    amount numeric(12,2) NOT NULL DEFAULT 0,
    vc     varchar(50),
    ts     timestamptz NOT NULL DEFAULT now())`);
  await q(`INSERT INTO alt_t (email, n, amount, vc)
           SELECT 'u'||g||'@x.com', g, (g%1000)::numeric, 'v'||g
             FROM generate_series(1,${ROWS}) g`);
  await q(`ANALYZE alt_t`);
};
const node = async () =>
  (await q(`SELECT relfilenode FROM pg_class WHERE relname='alt_t'`)).rows[0].relfilenode;
const size = async () =>
  (await q(`SELECT pg_size_pretty(pg_total_relation_size('alt_t')) s`)).rows[0].s;

line(`1. rewrite or not? (${ROWS} rows)`);
const probe = async (label, sql) => {
  await build();
  const before = await node();
  const t0 = performance.now();
  let err = null;
  try { await q(sql); } catch (e) { err = `${e.code} ${e.message}`; }
  const ms = performance.now() - t0;
  const after = await node();
  const verdict = err ? 'ERROR' : (before === after ? 'no rewrite' : 'REWRITE');
  console.log(`${label.padEnd(46)} ${verdict.padEnd(11)} ${ms.toFixed(0).padStart(6)} ms  ${err ?? ''}`);
};

await probe('ADD COLUMN note text',                     `ALTER TABLE alt_t ADD COLUMN note text`);
await probe('ADD COLUMN flag bool NOT NULL DEFAULT false', `ALTER TABLE alt_t ADD COLUMN flag boolean NOT NULL DEFAULT false`);
await probe('ADD COLUMN d timestamptz DEFAULT now()',   `ALTER TABLE alt_t ADD COLUMN d timestamptz DEFAULT now()`);
await probe('ADD COLUMN u uuid DEFAULT gen_random_uuid()', `ALTER TABLE alt_t ADD COLUMN u uuid DEFAULT gen_random_uuid()`);
await probe('DROP COLUMN vc',                            `ALTER TABLE alt_t DROP COLUMN vc`);
await probe('RENAME COLUMN email TO mail',               `ALTER TABLE alt_t RENAME COLUMN email TO mail`);
await probe('ALTER COLUMN vc TYPE varchar(100)',         `ALTER TABLE alt_t ALTER COLUMN vc TYPE varchar(100)`);
await probe('ALTER COLUMN vc TYPE varchar(20)',          `ALTER TABLE alt_t ALTER COLUMN vc TYPE varchar(20)`);
await probe('ALTER COLUMN vc TYPE text',                 `ALTER TABLE alt_t ALTER COLUMN vc TYPE text`);
await probe('ALTER COLUMN n TYPE bigint',                `ALTER TABLE alt_t ALTER COLUMN n TYPE bigint`);
await probe('ALTER COLUMN amount TYPE numeric(14,2)',    `ALTER TABLE alt_t ALTER COLUMN amount TYPE numeric(14,2)`);
await probe('ALTER COLUMN n SET NOT NULL',               `ALTER TABLE alt_t ALTER COLUMN n SET NOT NULL`);
await probe('ALTER COLUMN amount SET DEFAULT 1',         `ALTER TABLE alt_t ALTER COLUMN amount SET DEFAULT 1`);
await probe('ADD CONSTRAINT chk CHECK (n > 0)',          `ALTER TABLE alt_t ADD CONSTRAINT chk CHECK (n > 0)`);
await probe('ADD CONSTRAINT chk CHECK (n>0) NOT VALID',  `ALTER TABLE alt_t ADD CONSTRAINT chk CHECK (n > 0) NOT VALID`);
await probe('SET LOGGED/UNLOGGED',                       `ALTER TABLE alt_t SET UNLOGGED`);

// --- 2. the safe NOT NULL sequence on a big table --------------------------
line('2. adding NOT NULL to an existing column: naive vs NOT VALID');
{
  await build();
  let t0 = performance.now();
  await q(`ALTER TABLE alt_t ALTER COLUMN vc SET NOT NULL`).catch((e) => console.log(e.code, e.message));
  console.log(`direct SET NOT NULL                     ${(performance.now()-t0).toFixed(0)} ms (full scan, ACCESS EXCLUSIVE throughout)`);

  await build();
  t0 = performance.now();
  await q(`ALTER TABLE alt_t ADD CONSTRAINT vc_nn CHECK (vc IS NOT NULL) NOT VALID`);
  const add = performance.now() - t0;
  t0 = performance.now();
  await q(`ALTER TABLE alt_t VALIDATE CONSTRAINT vc_nn`);
  const val = performance.now() - t0;
  console.log(`ADD CHECK ... NOT VALID                 ${add.toFixed(0)} ms (brief lock)`);
  console.log(`VALIDATE CONSTRAINT                     ${val.toFixed(0)} ms (SHARE UPDATE EXCLUSIVE — reads+writes continue)`);
}

// --- 3. identity vs serial -------------------------------------------------
line('3. GENERATED ALWAYS AS IDENTITY vs serial');
{
  await q(`DROP TABLE IF EXISTS id_a, id_b`);
  await q(`CREATE TABLE id_a (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, t text)`);
  await q(`CREATE TABLE id_b (id bigserial PRIMARY KEY, t text)`);
  for (const t of ['id_a', 'id_b']) {
    const {rows} = await q(
      `SELECT column_name, column_default, is_identity, identity_generation
         FROM information_schema.columns WHERE table_name=$1 AND column_name='id'`, [t]);
    console.log(t.padEnd(6), JSON.stringify(rows[0]));
  }
  for (const t of ['id_a', 'id_b']) {
    try {
      await q(`INSERT INTO ${t} (id, t) VALUES (999, 'manual')`);
      console.log(`${t}: manual id accepted`);
    } catch (e) { console.log(`${t}: manual id →`, e.code, e.message.split('\n')[0]); }
  }
  // dropping the table: does the sequence go too?
  await q(`DROP TABLE id_b`);
  const seqs = await q(`SELECT count(*)::int n FROM pg_class WHERE relkind='S' AND relname LIKE 'id_b%'`);
  console.log('sequence left after DROP TABLE id_b:', seqs.rows[0].n);
}

// --- 4. sequence gaps ------------------------------------------------------
line('4. where sequence gaps come from');
{
  await q(`DROP TABLE IF EXISTS gap_t`);
  await q(`CREATE TABLE gap_t (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, t text UNIQUE)`);
  await q(`INSERT INTO gap_t (t) VALUES ('a')`);
  const c = await pool.connect();
  await c.query('BEGIN');
  await c.query(`INSERT INTO gap_t (t) VALUES ('rolled-back')`);
  await c.query('ROLLBACK');
  c.release();
  try { await q(`INSERT INTO gap_t (t) VALUES ('a')`); } catch { /* unique violation */ }
  await q(`INSERT INTO gap_t (t) VALUES ('b')`);
  const {rows} = await q(`SELECT id, t FROM gap_t ORDER BY id`);
  console.table(rows);
  console.log('→ rollback and failed inserts both consume ids; sequences are non-transactional');
}

// --- 5. UNIQUE and NULLs ---------------------------------------------------
line('5. NULLs in a unique column');
{
  await q(`DROP TABLE IF EXISTS uq_t`);
  await q(`CREATE TABLE uq_t (a text, b text)`);
  await q(`CREATE UNIQUE INDEX uq_default ON uq_t (a)`);
  await q(`INSERT INTO uq_t (a) VALUES (NULL), (NULL), (NULL)`);
  console.log('default UNIQUE: 3 NULLs inserted →',
    (await q(`SELECT count(*)::int n FROM uq_t WHERE a IS NULL`)).rows[0].n, 'rows');
  await q(`DROP INDEX uq_default`);
  await q(`DELETE FROM uq_t`);
  await q(`CREATE UNIQUE INDEX uq_nnd ON uq_t (a) NULLS NOT DISTINCT`);
  await q(`INSERT INTO uq_t (a) VALUES (NULL)`);
  try {
    await q(`INSERT INTO uq_t (a) VALUES (NULL)`);
    console.log('NULLS NOT DISTINCT: second NULL accepted (unexpected)');
  } catch (e) { console.log('NULLS NOT DISTINCT: second NULL →', e.code, e.constraint); }
}

// --- 6. TEMP and UNLOGGED speed -------------------------------------------
line('6. logged vs unlogged vs temp — 100k inserts');
{
  const bench = async (label, ddl, name) => {
    await q(`DROP TABLE IF EXISTS ${name}`);
    await q(ddl);
    const t0 = performance.now();
    await q(`INSERT INTO ${name} (t) SELECT 'x'||g FROM generate_series(1,100000) g`);
    console.log(`${label.padEnd(22)} ${(performance.now()-t0).toFixed(0).padStart(6)} ms`);
    await q(`DROP TABLE IF EXISTS ${name}`);
  };
  await bench('LOGGED (normal)', `CREATE TABLE lg_t (t text)`, 'lg_t');
  await bench('UNLOGGED', `CREATE UNLOGGED TABLE ul_t (t text)`, 'ul_t');
}

// --- 7. deferrable constraints and circular FKs ---------------------------
line('7. circular foreign keys');
{
  await q(`DROP TABLE IF EXISTS c_a, c_b CASCADE`);
  await q(`CREATE TABLE c_a (id int PRIMARY KEY, b_id int)`);
  await q(`CREATE TABLE c_b (id int PRIMARY KEY, a_id int REFERENCES c_a(id))`);
  await q(`ALTER TABLE c_a ADD CONSTRAINT a_b_fk FOREIGN KEY (b_id) REFERENCES c_b(id)
           DEFERRABLE INITIALLY DEFERRED`);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`INSERT INTO c_a (id, b_id) VALUES (1, 1)`);   // c_b(1) does not exist yet
    await c.query(`INSERT INTO c_b (id, a_id) VALUES (1, 1)`);
    await c.query('COMMIT');
    console.log('deferred FK: both rows inserted inside one transaction — ok');
  } catch (e) { await c.query('ROLLBACK'); console.log('failed:', e.code, e.message); }
  c.release();

  // the same without DEFERRABLE
  await q(`DROP TABLE IF EXISTS c_c, c_d CASCADE`);
  await q(`CREATE TABLE c_c (id int PRIMARY KEY, d_id int)`);
  await q(`CREATE TABLE c_d (id int PRIMARY KEY, c_id int REFERENCES c_c(id))`);
  await q(`ALTER TABLE c_c ADD CONSTRAINT c_d_fk FOREIGN KEY (d_id) REFERENCES c_d(id)`);
  try {
    await q(`INSERT INTO c_c (id, d_id) VALUES (1, 1)`);
    console.log('immediate FK: accepted (unexpected)');
  } catch (e) { console.log('immediate FK →', e.code, e.message.split('\n')[0]); }
}

await q(`DROP TABLE IF EXISTS alt_t, gap_t, uq_t, id_a, c_a, c_b, c_c, c_d CASCADE`);
await pool.end();
