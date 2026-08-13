// Phase 8 page 20 — node:crypto. Node 24.19.0.
import crypto from 'node:crypto';

const line = (t) => console.log(`\n=== ${t} ===`);
const bench = (label, fn, n) => {
  for (let i = 0; i < Math.min(n, 5_000); i++) fn();
  const t = performance.now();
  for (let i = 0; i < n; i++) fn();
  const ms = performance.now() - t;
  console.log(label.padEnd(34), `${ms.toFixed(1)} ms / ${n} = ${(ms * 1000 / n).toFixed(2)} µs`);
  return ms;
};

line('1. what is available');
console.log('crypto.constants.OPENSSL_VERSION_TEXT ->', process.versions.openssl);
console.log('hashes available ->', crypto.getHashes().length, '| ciphers ->', crypto.getCiphers().length);
console.log('has crypto.hash (one-shot) ->', typeof crypto.hash);
console.log('has webcrypto              ->', typeof crypto.webcrypto?.subtle);

line('2. hashing throughput, 1 KB input, 100k iterations');
const data = Buffer.alloc(1024, 'a');
for (const algo of ['md5', 'sha1', 'sha256', 'sha512', 'blake2b512']) {
  bench(`createHash('${algo}')`, () => crypto.createHash(algo).update(data).digest('hex'), 100_000);
}

line('3. crypto.hash() one-shot vs createHash');
bench('createHash sha256', () => crypto.createHash('sha256').update(data).digest('hex'), 200_000);
bench('crypto.hash sha256', () => crypto.hash('sha256', data, 'hex'), 200_000);
console.log('same digest ->',
  crypto.hash('sha256', data, 'hex') === crypto.createHash('sha256').update(data).digest('hex'));

line('4. a hash is not a MAC — anyone can compute it');
const secret = 'server-secret';
const msg = 'user=alice&role=user';
console.log('sha256(secret+msg) ->', crypto.hash('sha256', secret + msg, 'hex').slice(0, 32), '…');
console.log('  an attacker who learns `secret` forges freely; and SHA-2 is length-extendable,');
console.log('  so H(secret||msg) can be extended to H(secret||msg||pad||evil) WITHOUT the secret.');
const hmac = crypto.createHmac('sha256', secret).update(msg).digest('hex');
console.log('hmac-sha256        ->', hmac.slice(0, 32), '…  (not length-extendable)');
bench('createHmac sha256', () => crypto.createHmac('sha256', secret).update(data).digest('hex'), 100_000);

line('5. random: sources and speed');
console.log('randomUUID()      ->', crypto.randomUUID());
console.log('  version nibble  ->', crypto.randomUUID()[14], '(4) | variant ->', crypto.randomUUID()[19]);
console.log('randomBytes(16)   ->', crypto.randomBytes(16).toString('hex'));
bench('Math.random()', () => Math.random(), 1_000_000);
bench('crypto.randomUUID()', () => crypto.randomUUID(), 1_000_000);
bench('randomUUID({disableEntropyCache})', () => crypto.randomUUID({ disableEntropyCache: true }), 200_000);
bench('crypto.randomBytes(16) sync', () => crypto.randomBytes(16), 200_000);
{
  const buf = Buffer.alloc(16);
  bench('crypto.randomFillSync(buf)', () => crypto.randomFillSync(buf), 200_000);
  bench('webcrypto getRandomValues', () => crypto.webcrypto.getRandomValues(new Uint8Array(16)), 200_000);
}

line('6. async randomBytes uses the thread pool');
{
  const t = performance.now();
  await Promise.all(Array.from({ length: 8 }, () =>
    new Promise((res) => crypto.randomBytes(1_000_000, res))));
  console.log('8 × 1 MB async  ->', (performance.now() - t).toFixed(1), 'ms');
  const t2 = performance.now();
  for (let i = 0; i < 8; i++) crypto.randomBytes(1_000_000);
  console.log('8 × 1 MB sync   ->', (performance.now() - t2).toFixed(1), 'ms (blocking the loop)');
}

line('7. modulo bias, measured');
{
  const N = 3_000_000, RANGE = 100;
  // biased: take a byte, % 100. 256 = 2*100 + 56, so 0..55 appear 3x, 56..99 appear 2x.
  const biased = new Array(RANGE).fill(0);
  const bytes = crypto.randomBytes(N);
  for (let i = 0; i < N; i++) biased[bytes[i] % RANGE]++;
  const unbiased = new Array(RANGE).fill(0);
  for (let i = 0; i < N; i++) unbiased[crypto.randomInt(RANGE)]++;
  const stat = (a) => {
    const lo = Math.min(...a), hi = Math.max(...a), exp = N / RANGE;
    return `min ${lo} max ${hi} expected ${exp} spread ${((hi - lo) / exp * 100).toFixed(1)}%`;
  };
  console.log('byte % 100        ->', stat(biased));
  console.log('  bucket 0:', biased[0], ' bucket 99:', biased[99], '-> 0..55 are ~50% more likely');
  console.log('crypto.randomInt  ->', stat(unbiased));
  bench('crypto.randomInt(100)', () => crypto.randomInt(100), 500_000);
}

line('8. picking a token: entropy per encoding');
for (const [enc, bytes] of [['hex', 16], ['base64url', 16], ['hex', 32], ['base64url', 32]]) {
  const s = crypto.randomBytes(bytes).toString(enc);
  console.log(`randomBytes(${bytes}).toString('${enc}')`.padEnd(40),
    `${s.length} chars, ${bytes * 8} bits ->`, s);
}

line('9. UUIDv4 is 122 bits, not 128');
{
  const u = crypto.randomUUID().replace(/-/g, '');
  console.log('hex chars     ->', u.length, '(128 bits of field)');
  console.log('fixed bits    -> 4 for version + 2 for variant = 6, leaving 122 random');
  console.log('as a session id, 122 bits is plenty; as a *secret*, prefer randomBytes(32)');
}

line('10. encoding is not hashing, and neither is encryption');
const b64 = Buffer.from('hunter2').toString('base64');
console.log('base64      ->', b64, '-> reversible ->', Buffer.from(b64, 'base64').toString());
console.log('sha256      ->', crypto.hash('sha256', 'hunter2', 'hex').slice(0, 24), '… one-way, but FAST');
console.log('  fast is the problem for passwords: see page 01 (scrypt/argon2), not this page.');
