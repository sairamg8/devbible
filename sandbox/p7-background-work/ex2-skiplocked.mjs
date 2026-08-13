import pg from 'pg';
const pool = new pg.Pool({connectionString: 'postgres://postgres:devbible@127.0.0.1:55432/shop', max: 6});
await pool.query('truncate jobs');
await pool.query(`insert into jobs (kind, payload) select 'resize', jsonb_build_object('n', g) from generate_series(1,20) g`);

const claim = async (workerId) => {
  const {rows} = await pool.query(`
    update jobs set locked_until = now() + interval '30 seconds', attempts = attempts + 1
    where id = (select id from jobs where run_at <= now()
                and (locked_until is null or locked_until < now())
                order by id for update skip locked limit 1)
    returning id, payload`);
  return rows[0] ?? null;
};

const taken = {A: [], B: [], C: []};
const worker = async (id) => {
  for (;;) {
    const job = await claim(id);
    if (!job) return;
    taken[id].push(job.id);
    await new Promise((r) => setTimeout(r, 5));
    await pool.query('delete from jobs where id = $1', [job.id]);
  }
};
const t0 = performance.now();
await Promise.all([worker('A'), worker('B'), worker('C')]);
console.log(`3 workers drained 20 jobs in ${Math.round(performance.now() - t0)} ms`);
console.log('A got', taken.A.length, '| B got', taken.B.length, '| C got', taken.C.length);
const all = [...taken.A, ...taken.B, ...taken.C];
console.log('total claims', all.length, '| unique', new Set(all).size, '<- no job was delivered twice');

// without SKIP LOCKED: workers serialise on the same row
await pool.query('truncate jobs');
await pool.query(`insert into jobs (kind, payload) select 'resize', jsonb_build_object('n', g) from generate_series(1,20) g`);
const claimBlocking = async () => {
  const {rows} = await pool.query(`
    update jobs set locked_until = now() + interval '30 seconds'
    where id = (select id from jobs order by id for update limit 1) returning id`);
  return rows[0] ?? null;
};
const t1 = performance.now();
await Promise.all([1,2,3].map(async () => {
  for (;;) { const j = await claimBlocking(); if (!j) return;
    await new Promise((r) => setTimeout(r, 5)); await pool.query('delete from jobs where id = $1', [j.id]); }
}));
console.log(`same 20 jobs WITHOUT skip locked: ${Math.round(performance.now() - t1)} ms`);

// visibility timeout: a crashed worker's job becomes claimable again
await pool.query('truncate jobs');
await pool.query(`insert into jobs (kind, payload, locked_until) values ('resize','{}', now() + interval '2 seconds')`);
console.log('locked job claimable now?', (await claim('X')) !== null);
await new Promise((r) => setTimeout(r, 2100));
const reclaimed = await claim('X');
console.log('after the lock expired ->', reclaimed ? `reclaimed job ${reclaimed.id}` : 'still locked');
const {rows: at} = await pool.query('select attempts from jobs limit 1');
console.log('attempts is now', at[0]?.attempts, '<- this is how you detect a poison job');
await pool.end();
