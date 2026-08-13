import crypto from 'node:crypto';
import {scrypt as scryptCb, timingSafeEqual, randomUUID, randomBytes, createHmac} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt = promisify(scryptCb);

// ---- password hashing cost ----
const pw = 'correct horse battery staple';
const salt = randomBytes(16);
for (const N of [2**14, 2**15, 2**16, 2**17]) {
  const t = performance.now();
  await scrypt(pw, salt, 64, {N, r: 8, p: 1, maxmem: 256 * 1024 * 1024});
  console.log(`scrypt N=${N.toString().padStart(6)} (2^${Math.log2(N)}) -> ${Math.round(performance.now()-t)} ms`);
}
// naive hashes, for contrast
for (const algo of ['md5', 'sha1', 'sha256']) {
  const t = performance.now();
  for (let i = 0; i < 100000; i++) crypto.createHash(algo).update(pw).digest('hex');
  console.log(`${algo.padEnd(7)} x100000 -> ${Math.round(performance.now()-t)} ms  (${Math.round(100000/((performance.now()-t)/1000)).toLocaleString()}/s)`);
}

// ---- timingSafeEqual ----
const a = Buffer.from('a'.repeat(32)), b = Buffer.from('a'.repeat(32)), c = Buffer.from('b'.repeat(32));
console.log('timingSafeEqual same:', timingSafeEqual(a, b), '| diff:', timingSafeEqual(a, c));
try { timingSafeEqual(Buffer.from('short'), Buffer.from('longer value')); }
catch (e) { console.log('different lengths ->', e.code, '|', e.message); }

// naive compare leaks position
const secret = 'a'.repeat(64);
const timeCompare = (guess) => {
  const t = process.hrtime.bigint();
  for (let i = 0; i < 20000; i++) { let ok = true; for (let j = 0; j < secret.length; j++) if (secret[j] !== guess[j]) { ok = false; break; } }
  return Number(process.hrtime.bigint() - t) / 1e6;
};
console.log('naive compare, 0 chars match:', timeCompare('b'.repeat(64)).toFixed(1), 'ms');
console.log('naive compare, 32 chars match:', timeCompare('a'.repeat(32)+'b'.repeat(32)).toFixed(1), 'ms');
console.log('naive compare, 63 chars match:', timeCompare('a'.repeat(63)+'b').toFixed(1), 'ms');

// ---- randomness ----
console.log('randomUUID:', randomUUID(), '| v', randomUUID()[14]);
console.log('randomBytes(32).base64url:', randomBytes(32).toString('base64url'));
console.log('Math.random is NOT a CSPRNG:', Math.random());
const t2 = performance.now(); for (let i=0;i<100000;i++) randomUUID(); 
console.log(`randomUUID x100000 -> ${Math.round(performance.now()-t2)} ms`);

// ---- HMAC ----
const sig = createHmac('sha256', 'webhook-secret').update('{"orderId":42}').digest('hex');
console.log('HMAC-SHA256:', sig);
