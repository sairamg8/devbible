// Follow-up to ex8: unnest beat COPY at 10k rows. Where is the crossover?
import pg from 'pg';
import {from as copyFrom} from 'pg-copy-streams';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';

const pool = new pg.Pool({
  connectionString: 'postgres://devbible:devbible@127.0.0.1:55432/devbible', max: 5});
const q = (...a) => pool.query(...a);

const reset = async () => {
  await q(`DROP TABLE IF EXISTS scale_users`);
  await q(`CREATE TABLE scale_users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL, name text NOT NULL, score int NOT NULL)`);
};

for (const N of [10000, 100000, 500000]) {
  const emails = Array.from({length: N}, (_, i) => `s${i}@x.com`);
  const names  = Array.from({length: N}, (_, i) => `User ${i}`);
  const scores = Array.from({length: N}, (_, i) => i % 100);

  await reset();
  let t0 = performance.now();
  await q(`INSERT INTO scale_users (email, name, score)
           SELECT * FROM unnest($1::text[], $2::text[], $3::int[])`, [emails, names, scores]);
  const un = performance.now() - t0;

  await reset();
  t0 = performance.now();
  const client = await pool.connect();
  const stream = client.query(copyFrom(
    `COPY scale_users (email, name, score) FROM STDIN WITH (FORMAT csv)`));
  await pipeline(Readable.from(function* () {
    for (let i = 0; i < N; i++) yield `${emails[i]},${names[i]},${scores[i]}\n`;
  }()), stream);
  client.release();
  const cp = performance.now() - t0;

  const heap = (process.memoryUsage().heapUsed / 1048576).toFixed(0);
  console.log(`N=${String(N).padStart(6)}  unnest ${un.toFixed(0).padStart(6)} ms   COPY ${cp.toFixed(0).padStart(6)} ms   ` +
              `${un < cp ? 'unnest' : 'COPY'} wins by ${(Math.max(un,cp)/Math.min(un,cp)).toFixed(1)}×   heap ${heap} MB`);
}
await q(`DROP TABLE IF EXISTS scale_users`);
await pool.end();
