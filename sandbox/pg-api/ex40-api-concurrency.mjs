// Phase 9 pages 11, 13, 14 — the three ways a request handles a second request
// arriving at the same time: a version column, a row lock, an idempotency key.
import pg from 'pg';

const URL = 'postgres://devbible:devbible@127.0.0.1:55432/devbible';
const pool = new pg.Pool({connectionString: URL, max: 30});
const q = (...a) => pool.query(...a);
const line = (t) => console.log(`\n=== ${t} ===`);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

await q(`DROP TABLE IF EXISTS c_payments, c_accounts CASCADE`);
await q(`CREATE TABLE c_accounts (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner   text NOT NULL,
  balance int  NOT NULL,
  version int  NOT NULL DEFAULT 1)`);
const seed = async () => {
  await q(`TRUNCATE c_accounts RESTART IDENTITY CASCADE`);
  await q(`INSERT INTO c_accounts (owner, balance) VALUES ('ada', 100)`);
};

// ===========================================================================
// 13 · OPTIMISTIC CONCURRENCY
// ===========================================================================

// --- 1. no version column: the second write silently wins ------------------
line('1. read-modify-write with no guard, two requests at once');
{
  await seed();
  const request = async (add) => {
    const c = await pool.connect();
    try {
      const {rows} = await c.query(`SELECT balance FROM c_accounts WHERE id = 1`);
      await new Promise((r) => setTimeout(r, 50));      // think time in the handler
      await c.query(`UPDATE c_accounts SET balance = $1 WHERE id = 1`,
        [rows[0].balance + add]);
      return 'ok';
    } finally { c.release(); }
  };
  console.log('both requests returned:', await Promise.all([request(10), request(20)]));
  console.log('balance:', (await q(`SELECT balance FROM c_accounts WHERE id=1`)).rows[0].balance,
    '← 100 + 10 + 20 = 130 expected');
}

// --- 2. the version column turns it into a detectable conflict -------------
line('2. UPDATE ... WHERE id = $1 AND version = $2');
{
  await seed();
  const request = async (add) => {
    const c = await pool.connect();
    try {
      const {rows} = await c.query(
        `SELECT balance, version FROM c_accounts WHERE id = 1`);
      await new Promise((r) => setTimeout(r, 50));
      const r = await c.query(
        `UPDATE c_accounts SET balance = $1, version = version + 1
          WHERE id = 1 AND version = $2`,
        [rows[0].balance + add, rows[0].version]);
      return r.rowCount === 1 ? 'ok' : `conflict (rowCount=${r.rowCount})`;
    } finally { c.release(); }
  };
  console.log('both requests returned:', await Promise.all([request(10), request(20)]));
  const row = (await q(`SELECT balance, version FROM c_accounts WHERE id=1`)).rows[0];
  console.log('final row:', row);
  console.log('↑ one write applied, the other was REFUSED rather than lost');
}

// --- 3. rowCount 0 is ambiguous --------------------------------------------
line('3. what rowCount = 0 does not tell you');
{
  await seed();
  const gone = await q(
    `UPDATE c_accounts SET balance = 1, version = version + 1
      WHERE id = 999 AND version = 1`);
  const stale = await q(
    `UPDATE c_accounts SET balance = 1, version = version + 1
      WHERE id = 1 AND version = 42`);
  console.log('row does not exist  → rowCount', gone.rowCount);
  console.log('version was stale   → rowCount', stale.rowCount);
  console.log('↑ identical results, but one is a 404 and the other a 409');
  const probe = await q(
    `SELECT version FROM c_accounts WHERE id = $1`, [1]);
  console.log('a second SELECT distinguishes them: found version =',
    probe.rows[0]?.version ?? '(no row)');
}

// --- 4. the retry loop ------------------------------------------------------
line('4. retrying the conflicted request');
{
  await seed();
  const withRetry = async (add, tries = 5) => {
    for (let attempt = 1; attempt <= tries; attempt++) {
      const c = await pool.connect();
      try {
        const {rows} = await c.query(
          `SELECT balance, version FROM c_accounts WHERE id = 1`);
        await new Promise((r) => setTimeout(r, 20));
        const r = await c.query(
          `UPDATE c_accounts SET balance = $1, version = version + 1
            WHERE id = 1 AND version = $2`,
          [rows[0].balance + add, rows[0].version]);
        if (r.rowCount === 1) return `ok on attempt ${attempt}`;
      } finally { c.release(); }
      await new Promise((r) => setTimeout(r, 10 * attempt));   // backoff
    }
    return 'gave up';
  };
  console.log(await Promise.all([withRetry(10), withRetry(20), withRetry(30)]));
  console.log('balance:', (await q(`SELECT balance FROM c_accounts WHERE id=1`)).rows[0].balance,
    '← 100 + 10 + 20 + 30 = 160 expected');
}

// ===========================================================================
// 14 · SELECT ... FOR UPDATE
// ===========================================================================

// --- 5. the pessimistic version of the same handler ------------------------
line('5. SELECT ... FOR UPDATE serialises the two requests');
{
  await seed();
  const request = async (add) => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const {rows} = await c.query(
        `SELECT balance FROM c_accounts WHERE id = 1 FOR UPDATE`);
      await new Promise((r) => setTimeout(r, 50));
      await c.query(`UPDATE c_accounts SET balance = $1 WHERE id = 1`,
        [rows[0].balance + add]);
      await c.query('COMMIT');
      return 'ok';
    } catch (e) { await c.query('ROLLBACK'); return e.code;
    } finally { c.release(); }
  };
  console.log('both requests returned:', await Promise.all([request(10), request(20)]));
  console.log('balance:', (await q(`SELECT balance FROM c_accounts WHERE id=1`)).rows[0].balance,
    '← no retry needed, and nothing was lost');
}

// --- 6. how long the lock is actually held --------------------------------
line('6. lock held across the slow work vs lock taken last');
{
  await seed();
  // (a) the lock spans the slow step
  const holdLong = async () => {
    const c = await pool.connect();
    const t0 = Date.now();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT balance FROM c_accounts WHERE id = 1 FOR UPDATE`);
      await new Promise((r) => setTimeout(r, 100));   // slow work inside the lock
      await c.query(`UPDATE c_accounts SET balance = balance + 1 WHERE id = 1`);
      await c.query('COMMIT');
    } finally { c.release(); }
    return Date.now() - t0;
  };
  // (b) the slow work happens first, the lock is taken only to write
  const holdShort = async () => {
    const c = await pool.connect();
    const t0 = Date.now();
    try {
      await new Promise((r) => setTimeout(r, 100));   // slow work outside the lock
      await c.query('BEGIN');
      await c.query(`SELECT balance FROM c_accounts WHERE id = 1 FOR UPDATE`);
      await c.query(`UPDATE c_accounts SET balance = balance + 1 WHERE id = 1`);
      await c.query('COMMIT');
    } finally { c.release(); }
    return Date.now() - t0;
  };
  const N = 8;
  let t0 = Date.now();
  await Promise.all(Array.from({length: N}, holdLong));
  const longWall = Date.now() - t0;
  await seed();
  t0 = Date.now();
  await Promise.all(Array.from({length: N}, holdShort));
  const shortWall = Date.now() - t0;
  console.log(`${N} concurrent requests, 100 ms of work each`);
  console.log(`  lock held across the work : ${longWall} ms total`);
  console.log(`  lock taken only to write  : ${shortWall} ms total`);
  console.log(`  ratio: ${(longWall / shortWall).toFixed(1)}x`);
}

// --- 7. not waiting: NOWAIT and SKIP LOCKED --------------------------------
line('7. NOWAIT and SKIP LOCKED instead of queueing');
{
  await seed();
  const holder = await pool.connect();
  await holder.query('BEGIN');
  await holder.query(`SELECT balance FROM c_accounts WHERE id = 1 FOR UPDATE`);

  const other = await pool.connect();
  try {
    await other.query(`SELECT balance FROM c_accounts WHERE id = 1 FOR UPDATE NOWAIT`);
    console.log('NOWAIT      : got the lock — unexpected');
  } catch (e) {
    console.log('NOWAIT      :', e.code, e.message);
  }
  const skipped = await other.query(
    `SELECT id FROM c_accounts WHERE id = 1 FOR UPDATE SKIP LOCKED`);
  console.log('SKIP LOCKED :', `${skipped.rowCount} rows — the locked row is simply not returned`);

  const t0 = Date.now();
  await other.query(`SET lock_timeout = '300ms'`);
  try {
    await other.query(`SELECT balance FROM c_accounts WHERE id = 1 FOR UPDATE`);
  } catch (e) {
    console.log('lock_timeout:', e.code, e.message, `after ${Date.now() - t0} ms`);
  }
  await other.query(`RESET lock_timeout`);
  other.release();
  await holder.query('ROLLBACK');
  holder.release();
}

// ===========================================================================
// 11 · IDEMPOTENT WRITES
// ===========================================================================

await q(`CREATE TABLE c_payments (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idempotency_key text UNIQUE,
  account_id      bigint NOT NULL,
  amount          int NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now())`);

// --- 8. the double submit with no key --------------------------------------
line('8. the same POST twice, no idempotency key');
{
  await q(`TRUNCATE c_payments RESTART IDENTITY`);
  const post = () => q(
    `INSERT INTO c_payments (account_id, amount) VALUES (1, 500) RETURNING id`);
  const [a, b] = await Promise.all([post(), post()]);
  console.log('created ids:', a.rows[0].id, b.rows[0].id);
  console.log('rows now   :', (await q(`SELECT count(*)::int c FROM c_payments`)).rows[0].c,
    '← the customer was charged twice');
}

// --- 9. ON CONFLICT DO NOTHING and its RETURNING trap ----------------------
line('9. ON CONFLICT DO NOTHING ... RETURNING');
{
  await q(`TRUNCATE c_payments RESTART IDENTITY`);
  const post = (key) => q(
    `INSERT INTO c_payments (idempotency_key, account_id, amount)
     VALUES ($1, 1, 500)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id, created_at`, [key]);
  const first = await post('key-abc');
  const second = await post('key-abc');
  console.log('first  → rowCount', first.rowCount, 'row', first.rows[0]);
  console.log('second → rowCount', second.rowCount, 'row', second.rows[0]);
  console.log('↑ the retry gets NO row back, so the handler cannot answer 200 with the payment');
}

// --- 10. DO UPDATE so the retry gets the original row ----------------------
line('10. ON CONFLICT DO UPDATE returns the stored row');
{
  await q(`TRUNCATE c_payments RESTART IDENTITY`);
  const post = (key) => q(
    `INSERT INTO c_payments (idempotency_key, account_id, amount)
     VALUES ($1, 1, 500)
     ON CONFLICT (idempotency_key)
       DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
     RETURNING id, created_at, (xmax = 0) AS was_inserted`, [key]);
  const first = await post('key-abc');
  const second = await post('key-abc');
  console.log('first  →', first.rows[0]);
  console.log('second →', second.rows[0]);
  console.log('same id?', first.rows[0].id === second.rows[0].id,
    '· was_inserted distinguishes the create from the replay');
}

// --- 11. two identical POSTs racing ---------------------------------------
line('11. 10 identical POSTs fired at once');
{
  await q(`TRUNCATE c_payments RESTART IDENTITY`);
  const post = (key) => q(
    `INSERT INTO c_payments (idempotency_key, account_id, amount)
     VALUES ($1, 1, 500)
     ON CONFLICT (idempotency_key)
       DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
     RETURNING id, (xmax = 0) AS was_inserted`, [key])
    .then((r) => r.rows[0]).catch((e) => ({error: e.code}));
  const results = await Promise.all(
    Array.from({length: 10}, () => post('key-race')));
  const inserted = results.filter((r) => r.was_inserted === true).length;
  const replays = results.filter((r) => r.was_inserted === false).length;
  const errors = results.filter((r) => r.error).length;
  console.log(`inserted=${inserted} replays=${replays} errors=${errors}`);
  console.log('distinct ids:', new Set(results.map((r) => r.id)).size);
  console.log('rows in table:', (await q(`SELECT count(*)::int c FROM c_payments`)).rows[0].c);
}

// --- 12. the same race with DO NOTHING, which is where 23505 appears -------
line('12. the same race using plain INSERT (no ON CONFLICT)');
{
  await q(`TRUNCATE c_payments RESTART IDENTITY`);
  const post = (key) => q(
    `INSERT INTO c_payments (idempotency_key, account_id, amount)
     VALUES ($1, 1, 500) RETURNING id`, [key])
    .then((r) => ({id: r.rows[0].id})).catch((e) => ({error: e.code}));
  const results = await Promise.all(
    Array.from({length: 10}, () => post('key-race-2')));
  const ok = results.filter((r) => r.id).length;
  const dup = results.filter((r) => r.error === '23505').length;
  console.log(`succeeded=${ok} duplicate-key=${dup}`);
  console.log('↑ the unique index is what makes it safe; ON CONFLICT only decides the response');
}

await q(`DROP TABLE IF EXISTS c_payments, c_accounts CASCADE`);
await pool.end();
