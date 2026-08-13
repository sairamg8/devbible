import http from 'node:http';
import {Queue, Worker} from 'bullmq';
const connection = {host: '127.0.0.1', port: 56379};
const q = new Queue('thumbs', {connection});
await q.obliterate({force: true}).catch(() => {});

const resize = () => { const t = Date.now(); while (Date.now() - t < 120) {} };  // 120 ms of CPU

const server = http.createServer(async (req, res) => {
  if (req.url === '/sync') { resize(); res.end('done'); }
  else { await q.add('resize', {url: req.url}); res.statusCode = 202; res.end('accepted'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const hit = async (path, n) => {
  const lat = [];
  const t0 = performance.now();
  await Promise.all(Array.from({length: n}, async () => {
    const s = performance.now();
    await fetch(`http://127.0.0.1:${port}${path}`).then((r) => r.text());
    lat.push(performance.now() - s);
  }));
  lat.sort((a, b) => a - b);
  return {total: Math.round(performance.now() - t0), p50: Math.round(lat[Math.floor(n*0.5)]), p95: Math.round(lat[Math.floor(n*0.95)])};
};
console.log('10 concurrent /sync  ', await hit('/sync', 10));
console.log('10 concurrent /queued', await hit('/queued', 10));

const w = new Worker('thumbs', async () => { resize(); }, {connection, concurrency: 2});
await new Promise((r) => setTimeout(r, 1500));
console.log('worker drained:', await q.getJobCounts('completed', 'waiting'));
await w.close(); await q.close(); server.close();

// ---------- concurrency limiting ----------
let inflight = 0, peak = 0;
const call = async (i) => {
  inflight++; peak = Math.max(peak, inflight);
  await new Promise((r) => setTimeout(r, 20));
  inflight--;
  return i;
};
peak = 0;
await Promise.all(Array.from({length: 200}, (_, i) => call(i)));
console.log('Promise.all over 200 items -> peak in-flight', peak);

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({length: limit}, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}
peak = 0;
const t2 = performance.now();
await mapLimit(Array.from({length: 200}, (_, i) => i), 8, call);
console.log(`mapLimit(8) over 200 items -> peak in-flight ${peak}, ${Math.round(performance.now()-t2)} ms`);

// ---------- thundering herd ----------
const simulate = (jitter) => {
  const buckets = new Map();
  for (let client = 0; client < 500; client++) {
    let delay = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const backoff = 100 * 2 ** (attempt - 1);
      delay += jitter ? Math.random() * backoff : backoff;
    }
    const b = Math.floor(delay / 100) * 100;
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]);
};
const noJ = simulate(false), yesJ = simulate(true);
console.log('no jitter :', noJ.map(([b, c]) => `${b}ms:${c}`).join(' '), '<- every client, same instant');
console.log('full jitter:', yesJ.map(([b, c]) => `${b}ms:${c}`).join(' '), `<- max bucket ${Math.max(...yesJ.map(e=>e[1]))}`);
process.exit(0);
