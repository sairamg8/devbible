import pg from 'pg';
const pool = new pg.Pool({connectionString: 'postgres://postgres:devbible@127.0.0.1:55432/shop'});
let running = 0, maxConcurrent = 0, runs = 0;
const job = async () => { running++; maxConcurrent = Math.max(maxConcurrent, running); runs++;
  await new Promise((r) => setTimeout(r, 250)); running--; };
await new Promise((resolve) => { const id = setInterval(job, 100);
  setTimeout(() => { clearInterval(id); resolve(); }, 1000); });
await new Promise((r) => setTimeout(r, 400));
console.log(`setInterval(100) + a 250 ms job -> ${runs} runs, up to ${maxConcurrent} at once <- overlap`);

running = 0; maxConcurrent = 0; runs = 0; let skipped = 0;
let busy = false;
const guarded = async () => { if (busy) { skipped++; return; } busy = true;
  running++; maxConcurrent = Math.max(maxConcurrent, running); runs++;
  await new Promise((r) => setTimeout(r, 250)); running--; busy = false; };
await new Promise((resolve) => { const id = setInterval(guarded, 100);
  setTimeout(() => { clearInterval(id); resolve(); }, 1000); });
await new Promise((r) => setTimeout(r, 400));
console.log(`with an overlap guard -> ${runs} runs, max ${maxConcurrent} at once, ${skipped} ticks skipped`);

// across processes an in-memory flag is useless — a lock in shared state is not
const tryLock = async (name) => {
  const {rows} = await pool.query('select pg_try_advisory_lock(hashtext($1)) as got', [name]);
  return rows[0].got;
};
const a = await tryLock('nightly-report');
const c2 = await pool.connect();
const {rows} = await c2.query('select pg_try_advisory_lock(hashtext($1)) as got', ['nightly-report']);
console.log(`instance A got the lock: ${a} | instance B got the lock: ${rows[0].got} <- only one runs`);
c2.release(); await pool.end();
