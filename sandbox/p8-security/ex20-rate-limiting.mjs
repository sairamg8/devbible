// Phase 8 page 21 — rate limiting and brute-force protection. Node 24.19.0, Redis 7 on :6399.
import http from 'node:http';
import { createClient } from 'redis';

const line = (t) => console.log(`\n=== ${t} ===`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

line('1. fixed window lets through 2× the limit at the boundary');
{
  const LIMIT = 5, WINDOW = 1000;
  const counts = new Map();
  const allow = (key, now) => {
    const bucket = Math.floor(now / WINDOW);
    const k = `${key}:${bucket}`;
    const n = (counts.get(k) ?? 0) + 1;
    counts.set(k, n);
    return n <= LIMIT;
  };
  // 5 requests at the end of window 0, 5 at the start of window 1
  const base = 10_000;                       // synthetic clock, ms
  let allowed = 0;
  for (const t of [960, 970, 980, 990, 999, 1000, 1010, 1020, 1030, 1040]) {
    if (allow('ip', base + t)) allowed++;
  }
  console.log(`limit ${LIMIT}/s, 10 requests spanning 80 ms across a window edge -> allowed ${allowed}`);
  console.log('  the limit was 5 per second; 10 got through inside 80 ms');
}

line('2. sliding window fixes it');
{
  const LIMIT = 5, WINDOW = 1000;
  const hits = new Map();
  const allow = (key, now) => {
    const arr = (hits.get(key) ?? []).filter((t) => t > now - WINDOW);
    arr.push(now);
    hits.set(key, arr);
    return arr.length <= LIMIT;
  };
  const base = 10_000;
  let allowed = 0;
  for (const t of [960, 970, 980, 990, 999, 1000, 1010, 1020, 1030, 1040]) {
    if (allow('ip', base + t)) allowed++;
  }
  console.log(`same traffic, sliding window -> allowed ${allowed}`);
}

line('3. token bucket allows a burst on purpose');
{
  const RATE = 5, BURST = 10;               // 5/s sustained, 10 in reserve
  let tokens = BURST, last = 10_000;
  const allow = (now) => {
    tokens = Math.min(BURST, tokens + ((now - last) / 1000) * RATE);
    last = now;
    if (tokens >= 1) { tokens -= 1; return true; }
    return false;
  };
  let burst = 0;
  for (let i = 0; i < 15; i++) if (allow(10_000)) burst++;
  console.log(`15 requests in the same millisecond -> allowed ${burst} (the bucket)`);
  let steady = 0;
  for (let i = 0; i < 10; i++) if (allow(10_000 + 1000 + i * 200)) steady++;
  console.log(`then 10 requests over 2 s          -> allowed ${steady} (refill rate)`);
}

line('4. the in-memory Map grows without bound');
{
  const counts = new Map();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 200_000; i++) counts.set(`203.0.113.${i}`, { n: 1, reset: Date.now() + 60_000 });
  const after = process.memoryUsage().heapUsed;
  console.log('200k distinct keys ->', ((after - before) / 1024 / 1024).toFixed(1), 'MB retained');
  console.log('  an attacker rotating source IPs fills this; a bare Map has no eviction');
}

line('5. per-process counters do not add up');
{
  const LIMIT = 10;
  const procs = [0, 0, 0, 0];               // 4 workers, each its own Map
  let allowed = 0;
  for (let i = 0; i < 40; i++) {
    const w = i % 4;                        // round-robin load balancing
    if (++procs[w] <= LIMIT) allowed++;
  }
  console.log(`limit ${LIMIT}/window per process, 4 processes -> effective limit ${allowed}`);
}

line('6. Redis: INCR + EXPIRE, and the race in the naive version');
{
  const redis = createClient({ url: 'redis://127.0.0.1:6399' });
  await redis.connect();
  await redis.flushAll();

  // naive: INCR then EXPIRE as two commands
  const naive = async (key) => {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 60);
    return n;
  };
  await naive('naive:ip');
  console.log('after first INCR, ttl ->', await redis.ttl('naive:ip'), 's');
  console.log('  if the process dies between INCR and EXPIRE, ttl stays -1 and the key never resets:');
  await redis.set('orphan', '1');           // simulate: INCR happened, EXPIRE did not
  console.log('  orphaned key ttl ->', await redis.ttl('orphan'), '(-1 = no expiry, blocked forever)');

  // atomic version
  const script = `
    local n = redis.call('INCR', KEYS[1])
    if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
    return { n, redis.call('PTTL', KEYS[1]) }
  `;
  const sha = await redis.scriptLoad(script);
  const atomic = (key, windowMs) => redis.evalSha(sha, { keys: [key], arguments: [String(windowMs)] });
  const [n1, ttl1] = await atomic('atomic:ip', 60_000);
  console.log('atomic script -> count', n1, 'ttl', ttl1, 'ms  (one round trip, no window)');

  line('7. what the limiter itself costs');
  const t1 = performance.now();
  for (let i = 0; i < 2_000; i++) await atomic('bench:ip', 60_000);
  const seq = performance.now() - t1;
  console.log(`2000 sequential checks -> ${seq.toFixed(1)} ms = ${(seq / 2000).toFixed(3)} ms each`);
  const t2 = performance.now();
  await Promise.all(Array.from({ length: 2_000 }, () => atomic('bench2:ip', 60_000)));
  const pipe = performance.now() - t2;
  console.log(`2000 pipelined         -> ${pipe.toFixed(1)} ms = ${(pipe / 2000).toFixed(3)} ms each`);

  line('8. fail open or fail closed?');
  await redis.quit();
  try {
    await atomic('after:quit', 1000);
  } catch (e) {
    console.log('limiter call after Redis is gone ->', e.constructor.name + ':', e.message.slice(0, 60));
    console.log('  catching this and allowing = fail open (available, unprotected)');
    console.log('  catching this and 503      = fail closed (protected, offline)');
  }
}

line('9. the key is the whole design');
{
  const server = http.createServer((req, res) => {
    res.end(JSON.stringify({
      socket: req.socket.remoteAddress,
      xff: req.headers['x-forwarded-for'] ?? null,
      firstHop: (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || null,
    }));
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const get = async (h) => (await (await fetch(`http://127.0.0.1:${port}/`, { headers: h })).json());
  console.log('no header        ->', JSON.stringify(await get({})));
  console.log('spoofed header   ->', JSON.stringify(await get({ 'x-forwarded-for': '1.2.3.4' })));
  console.log('  a client that sets X-Forwarded-For gets a fresh bucket per request');
  server.close();
}

line('10. 429 needs Retry-After to be actionable');
{
  const server = http.createServer((req, res) => {
    res.writeHead(429, {
      'retry-after': '30',
      'ratelimit-limit': '100',
      'ratelimit-remaining': '0',
      'ratelimit-reset': '30',
    }).end(JSON.stringify({ error: 'rate limited' }));
  });
  await new Promise((r) => server.listen(0, r));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/`);
  console.log('status', res.status, '->', JSON.stringify(Object.fromEntries(
    [...res.headers].filter(([k]) => k.startsWith('rate') || k === 'retry-after'))));
  server.close();
}

line('11. account lockout is a denial-of-service primitive');
{
  const failures = new Map();
  const LOCK_AFTER = 5;
  const attempt = (user, ok) => {
    const n = failures.get(user) ?? 0;
    if (n >= LOCK_AFTER) return 'LOCKED';
    if (!ok) { failures.set(user, n + 1); return 'fail'; }
    failures.delete(user); return 'ok';
  };
  for (let i = 0; i < 5; i++) attempt('victim@example.com', false);
  console.log('attacker made 5 wrong guesses, then the real user logs in ->',
    attempt('victim@example.com', true));
  console.log('  a hard lock lets anyone lock any account they can name');
}
