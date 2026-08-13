// Phase 3 topic 06 — closures: what is captured, the loop bug, and what stays alive.
// Run the heap section with: node --expose-gc ex6-closures.mjs
const line = (t) => console.log(`\n--- ${t} ---`);
const show = (l, v) => console.log(`  ${String(l).padEnd(48)} ${v}`);

line('a closure captures the VARIABLE, not the value at creation time');
function makeReader() {
  let x = 'first';
  const read = () => x;
  x = 'changed after the closure was created';
  return {read, set: (v) => { x = v; }};
}
const r = makeReader();
show('read() after x was reassigned', r.read());
r.set('set from outside');
show('read() after set()', r.read());

line('the classic var-in-a-loop bug');
const varFns = [];
for (var i = 0; i < 3; i++) varFns.push(() => i);
show('var loop: [f(), f(), f()]', JSON.stringify(varFns.map((f) => f())));
show('  and i after the loop', i);
const letFns = [];
for (let j = 0; j < 3; j++) letFns.push(() => j);
show('let loop: [f(), f(), f()]', JSON.stringify(letFns.map((f) => f())));
const iifeFns = [];
for (var k = 0; k < 3; k++) iifeFns.push(((captured) => () => captured)(k));
show('var + IIFE (the pre-ES6 fix)', JSON.stringify(iifeFns.map((f) => f())));

line('let in a for-loop: a NEW binding per iteration, not one shared');
const bindings = [];
for (let n = 0; n < 3; n++) { bindings.push(() => { n += 10; return n; }); }
show('each closure mutates its OWN n', JSON.stringify(bindings.map((f) => f())));
show('calling them again', JSON.stringify(bindings.map((f) => f())));

line('for-of and forEach never had the bug');
const ofFns = [];
for (const v of ['a', 'b', 'c']) ofFns.push(() => v);
show('for-of', JSON.stringify(ofFns.map((f) => f())));
const eachFns = [];
['a', 'b', 'c'].forEach((v) => eachFns.push(() => v));
show('forEach (v is a parameter, so per-call)', JSON.stringify(eachFns.map((f) => f())));

line('setTimeout with var — the interview favourite');
const order = [];
for (var t = 0; t < 3; t++) setTimeout(() => order.push(`var:${t}`), 0);
for (let u = 0; u < 3; u++) setTimeout(() => order.push(`let:${u}`), 0);
await new Promise((res) => setTimeout(res, 20));
show('after the timers fired', JSON.stringify(order));

line('private state — the counter factory');
function makeCounter(start = 0) {
  let count = start;
  return {inc: () => ++count, dec: () => --count, get: () => count};
}
const c1 = makeCounter();
const c2 = makeCounter(100);
c1.inc(); c1.inc(); c2.dec();
show('c1.get() after two inc', c1.get());
show('c2.get() after one dec from 100', c2.get());
show('count is reachable from outside?', 'count' in c1);
show('two counters share state?', c1.get() === c2.get());

line('closures share one scope when created together');
function makeShared() {
  let n = 0;
  return {a: () => ++n, b: () => ++n};
}
const s = makeShared();
s.a(); s.a(); s.b();
show('a() twice then b() — one shared n', s.b() - 1 + 1);
show('  final value via b()', s.b());

line('what a closure keeps alive — does an UNUSED variable stay in the context?');
// Both factories allocate an identical array in the same scope. The ONLY
// difference is whether the returned closure mentions it. If a closure captured
// its whole scope, both would retain the memory.
if (typeof global.gc !== 'function') {
  show('SKIPPED', 'needs node --expose-gc');
} else {
  const mb = () => { global.gc(); return Math.round(process.memoryUsage().heapUsed / 1048576); };

  // Plain JS objects, NOT a Uint8Array: a typed array's backing store is
  // external memory and does not show up in heapUsed at all — an earlier
  // version of this script measured +0 for that reason.
  const makeBig = () => Array.from({length: 300000}, (_, n) => ({n, tag: 'row'}));

  function ignoresBig() {
    const big = makeBig();
    big[0].n = 1;
    return () => 'I never mention big';
  }
  function usesBig() {
    const big = makeBig();
    big[0].n = 1;
    return () => big[0].n;             // the only difference
  }

  const base = mb();
  show('baseline heap', `${base} MB`);

  let held = [];
  for (let q = 0; q < 5; q++) held.push(ignoresBig());
  const afterIgnore = mb();
  show('5 closures that IGNORE a 300k-object array', `${afterIgnore} MB   (+${afterIgnore - base})`);
  held = null;
  mb();

  held = [];
  for (let q = 0; q < 5; q++) held.push(usesBig());
  const afterUse = mb();
  show('5 closures that USE a 300k-object array', `${afterUse} MB   (+${afterUse - base})`);
  show('  they still work', held[0]());
  held = null;
  const afterDrop = mb();
  show('after dropping those closures', `${afterDrop} MB   (+${afterDrop - base})`);
}

line('a closure over a loop variable holding the whole array alive');
function makeHandlers(rows) {
  return rows.map((row) => () => row.id);   // each closure holds ONE row
}
const rows = Array.from({length: 3}, (_, idx) => ({id: idx, payload: 'x'.repeat(10)}));
const handlers = makeHandlers(rows);
show('handlers.map(h => h())', JSON.stringify(handlers.map((h) => h())));

line('the stale-closure bug: a captured value that never updates');
function makeStale() {
  let value = 0;
  const snapshot = value;                 // captured ONCE, by value
  return {
    staleRead: () => snapshot,            // never changes
    liveRead: () => value,                // follows the variable
    bump: () => { value += 1; },
  };
}
const st = makeStale();
st.bump(); st.bump();
show('staleRead() after two bumps', st.staleRead());
show('liveRead() after two bumps', st.liveRead());
