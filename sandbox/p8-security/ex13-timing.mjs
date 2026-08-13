// Phase 8 page 16 — timing attacks: what is actually observable.
import crypto from 'node:crypto';
const line = (s) => console.log('\n== ' + s + ' ==');

line('timingSafeEqual basics');
const a = Buffer.from('correct-horse-battery-staple');
console.log('same        ->', crypto.timingSafeEqual(a, Buffer.from('correct-horse-battery-staple')));
console.log('different   ->', crypto.timingSafeEqual(a, Buffer.from('incorrect-orse-battery-stapl')));
try { crypto.timingSafeEqual(a, Buffer.from('short')); }
catch (e) { console.log('diff length ->', e.code, '|', e.message); }

line('the naive comparison leaks the matched prefix');
const secret = 'k'.repeat(64);
function naiveEqual(x, y) {
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}
for (const matched of [0, 16, 32, 48, 63]) {
  const guess = secret.slice(0, matched) + 'X'.repeat(64 - matched);
  const t = performance.now();
  for (let i = 0; i < 200000; i++) naiveEqual(secret, guess);
  console.log(`${String(matched).padStart(2)} chars match -> ${(performance.now() - t).toFixed(1)} ms / 200k`);
}

line('timingSafeEqual over the same inputs');
for (const matched of [0, 32, 63]) {
  const guess = Buffer.from(secret.slice(0, matched) + 'X'.repeat(64 - matched));
  const sb = Buffer.from(secret);
  const t = performance.now();
  for (let i = 0; i < 200000; i++) crypto.timingSafeEqual(sb, guess);
  console.log(`${String(matched).padStart(2)} chars match -> ${(performance.now() - t).toFixed(1)} ms / 200k`);
}

line('hash-then-compare: hides length as well');
function equalAnyLength(x, y) {
  const hx = crypto.createHash('sha256').update(x).digest();
  const hy = crypto.createHash('sha256').update(y).digest();
  return crypto.timingSafeEqual(hx, hy);
}
console.log('same         ->', equalAnyLength('abc', 'abc'));
console.log('diff length  ->', equalAnyLength('abc', 'a much longer value'), '(no throw)');

line('user enumeration: the timing side channel people actually exploit');
const stored = crypto.scryptSync('hunter2', crypto.randomBytes(16), 64, { N: 16384, r: 8, p: 1 });
function loginNaive(userExists, password) {
  const t = performance.now();
  if (!userExists) return { ok: false, ms: performance.now() - t };   // returns immediately
  crypto.scryptSync(password, crypto.randomBytes(16), 64, { N: 16384, r: 8, p: 1 });
  return { ok: false, ms: performance.now() - t };
}
console.log('unknown user ->', loginNaive(false, 'x').ms.toFixed(1), 'ms');
console.log('known user   ->', loginNaive(true, 'x').ms.toFixed(1), 'ms');

const DUMMY = crypto.scryptSync('dummy', Buffer.alloc(16), 64, { N: 16384, r: 8, p: 1 });
function loginFixed(userExists, password) {
  const t = performance.now();
  crypto.scryptSync(password, crypto.randomBytes(16), 64, { N: 16384, r: 8, p: 1 }); // always
  return { ok: false, ms: performance.now() - t };
}
console.log('fixed, unknown ->', loginFixed(false, 'x').ms.toFixed(1), 'ms');
console.log('fixed, known   ->', loginFixed(true, 'x').ms.toFixed(1), 'ms');
console.log('dummy hash bytes:', DUMMY.length);

line('what network jitter does to the signal');
const samples = [];
for (let i = 0; i < 5; i++) {
  const t = performance.now();
  await new Promise((r) => setTimeout(r, 1));
  samples.push(performance.now() - t);
}
console.log('5x setTimeout(1) ->', samples.map((s) => s.toFixed(2)).join(', '), 'ms  <- local, no network');
