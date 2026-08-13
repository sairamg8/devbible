import pg from 'pg';
const pool = new pg.Pool({connectionString: 'postgres://postgres:devbible@127.0.0.1:55432/shop', max: 4});
const A = await pool.connect(), B = await pool.connect();
console.log('A pid', (await A.query('select pg_backend_pid() p')).rows[0].p,
            '| B pid', (await B.query('select pg_backend_pid() p')).rows[0].p);
const got = async (c) => (await c.query("select pg_try_advisory_lock(hashtext('nightly-report')) as got")).rows[0].got;
console.log('instance A got the lock:', await got(A));
console.log('instance B got the lock:', await got(B), '<- only one instance runs the nightly job');
await A.query("select pg_advisory_unlock(hashtext('nightly-report'))");
console.log('after A unlocks, B gets it:', await got(B));
A.release(); B.release(); await pool.end();
