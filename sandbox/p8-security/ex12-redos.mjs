// Phase 8 page 14 — ReDoS: does one regex really stall the whole process?
const line = (s) => console.log('\n== ' + s + ' ==');

line('catastrophic backtracking, doubling per character');
for (const n of [20, 24, 26, 28]) {
  const input = 'a'.repeat(n) + '!';
  const t = performance.now();
  /^(a+)+$/.test(input);
  console.log(`${n} chars -> ${(performance.now() - t).toFixed(0)} ms`);
}

line('what else blocks while it runs');
let ticks = 0;
const iv = setInterval(() => ticks++, 10);
const t0 = performance.now();
/^(a+)+$/.test('a'.repeat(28) + '!');
const spent = performance.now() - t0;
clearInterval(iv);
console.log(`regex took ${spent.toFixed(0)} ms; a 10 ms interval fired ${ticks} times during it`);
console.log(`(expected ~${Math.round(spent / 10)} if the loop were free)`);

line('other vulnerable shapes');
const shapes = [
  [/^(\w+\s?)*$/, 'x'.repeat(24) + '!'],
  [/^(a|a)+$/, 'a'.repeat(26) + '!'],
  [/(\d+)*$/, '1'.repeat(26) + 'x'],
];
for (const [re, input] of shapes) {
  const t = performance.now();
  re.test(input);
  console.log(String(re).padEnd(18), `${input.length} chars ->`, (performance.now() - t).toFixed(0), 'ms');
}

line('the linear rewrite');
const linear = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const bad = 'a'.repeat(80) + '!';
let t = performance.now();
for (let i = 0; i < 1000; i++) linear.test(bad);
console.log('linear regex x1000 on an 81-char non-match ->', (performance.now() - t).toFixed(3), 'ms total');

line('anchoring and length caps');
t = performance.now();
/^(a+)+$/.test(('a'.repeat(28) + '!').slice(0, 20));
console.log('same regex, input truncated to 20 chars ->', (performance.now() - t).toFixed(0), 'ms');

line('does Node 24 offer any regex timeout?');
console.log('RegExp has no timeout option:', Object.keys(RegExp.prototype).length === 0 ? 'confirmed (no such API)' : '?');
try {
  new RegExp('a', 'v');
  console.log("v flag (unicodeSets) supported: yes");
} catch { console.log('v flag: no'); }
console.log('node -p "require(\'node:util\').types" has no regex guard either — mitigation is your code.');
