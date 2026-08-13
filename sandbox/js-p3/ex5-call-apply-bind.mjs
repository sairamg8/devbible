// Phase 3 topic 05 — call, apply, bind: explicit this, borrowing, partial application.
const line = (t) => console.log(`\n--- ${t} ---`);
const show = (l, v) => console.log(`  ${String(l).padEnd(48)} ${v}`);
const fail = (l, fn) => { try { show(l, fn()); } catch (e) { show(l, `${e.constructor.name}: ${e.message}`); } };

line('the three, side by side');
function describe(greeting, punctuation) { return `${greeting}, ${this.name}${punctuation}`; }
const user = {name: 'ada'};
show('describe.call(user, "hi", "!")', describe.call(user, 'hi', '!'));
show('describe.apply(user, ["hi", "!"])', describe.apply(user, ['hi', '!']));
show('describe.bind(user)("hi", "!")', describe.bind(user)('hi', '!'));
show('describe.bind(user, "hi")("!")   ← partial', describe.bind(user, 'hi')('!'));
show('bind returns a NEW function each time', describe.bind(user) === describe.bind(user));
show('call/apply invoke immediately; bind returns', typeof describe.bind(user));

line('what a non-object thisArg becomes');
function what() { return `${typeof this}:${this === undefined ? 'undefined' : this === globalThis ? 'globalThis' : Object.prototype.toString.call(this)}`; }
show('call(undefined)  in a module (strict)', what.call(undefined));
show('call(null)       in a module (strict)', what.call(null));
show('call(42)         in a module (strict)', what.call(42));
show('call("str")      in a module (strict)', what.call('str'));
show('  ↑ strict mode does NOT box primitives', 'see ex5b for the sloppy contrast');

line('apply spreads an array-like — the old max() trick');
const nums = [5, 1, 9, 3];
show('Math.max.apply(null, nums)', Math.max.apply(null, nums));
show('Math.max(...nums)  ← modern', Math.max(...nums));
const big = Array.from({length: 200000}, (_, i) => i);
fail('Math.max.apply(null, 200k-element array)', () => Math.max.apply(null, big));
fail('Math.max(...200k-element array)', () => Math.max(...big));
show('reduce has no such limit', big.reduce((a, b) => (b > a ? b : a), -Infinity));

line('borrowing array methods from array-likes');
const arrayLike = {0: 'a', 1: 'b', length: 2};
show('[].slice.call(arrayLike)', JSON.stringify(Array.prototype.slice.call(arrayLike)));
show('[].map.call(arrayLike, s => s.toUpperCase())', JSON.stringify(Array.prototype.map.call(arrayLike, (s) => s.toUpperCase())));
show('Array.from(arrayLike)  ← modern', JSON.stringify(Array.from(arrayLike)));
show('[].join.call("abc", "-")  ← strings too', Array.prototype.join.call('abc', '-'));
fail('[].push.call({length: 0}) then read length', () => { const o = {length: 0}; Array.prototype.push.call(o, 'x'); return JSON.stringify(o); });

line('the real type check — why toString.call is still used');
const vals = [[], {}, null, undefined, 42, 'x', new Date(0), /re/, new Map(), () => {}];
for (const v of vals) {
  show(`Object.prototype.toString.call(${String(v).slice(0, 12) || 'the value'})`, Object.prototype.toString.call(v));
}
show('typeof [] vs typeof null', `${typeof []} / ${typeof null}`);

line('bind: permanence, name, length, and prototype');
function greet(a, b, c) { return [this?.tag, a, b, c].join('|'); }
const bound = greet.bind({tag: 'T'}, 1);
show('bound.name', JSON.stringify(bound.name));
show('bound.length (greet.length is 3, 1 bound)', bound.length);
show('greet.length', greet.length);
show('bound.call({tag: "OTHER"}, 2, 3)', bound.call({tag: 'OTHER'}, 2, 3) + '  ← this ignored, args appended');
const twice = bound.bind({tag: 'AGAIN'}, 99);
show('bound.bind({tag:"AGAIN"}, 99)()', twice() + '  ← this still T, args still accumulate');
show('bound.hasOwnProperty("prototype")', bound.hasOwnProperty('prototype'));

line('bind + new: the bound this is dropped, bound ARGS are not');
function Point(x, y) { this.x = x; this.y = y; }
const BoundPoint = Point.bind({ignored: true}, 10);
const p = new BoundPoint(20);
show('new (Point.bind({...}, 10))(20)', JSON.stringify(p));
show('instanceof Point', p instanceof Point);
show('  ↑ prototype chain survives binding', Object.getPrototypeOf(p) === Point.prototype);

line('losing and restoring a method — the practical case');
const logger = {prefix: '[app]', log(msg) { return `${this.prefix} ${msg}`; }};
show('logger.log("ok")', logger.log('ok'));
const detached = logger.log;
fail('const detached = logger.log; detached("ok")', () => detached('ok'));
show('detached.call(logger, "ok")', detached.call(logger, 'ok'));
const rebound = logger.log.bind(logger);
show('const rebound = logger.log.bind(logger)', rebound('ok'));
show('rebound === logger.log.bind(logger)', rebound === logger.log.bind(logger) + '  ← identity is NOT stable');

line('call vs apply vs spread: which is fastest here');
// The argument VARIES with the loop counter so V8 cannot constant-fold the
// direct call while leaving .call/.apply unfolded — that confound made the
// direct row look ~6x faster than it is. Each variant does identical work and
// the checksums must match.
function sum3(a, b, c) { return a + b + c; }
const N = 3_000_000;
const bench = (label, fn) => {
  for (let i = 0; i < 1000; i++) fn(i); // warm
  const t = process.hrtime.bigint();
  let acc = 0;
  for (let i = 0; i < N; i++) acc += fn(i);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  show(label, `${ms.toFixed(1)} ms   (checksum ${acc})`);
};
const scratch = [0, 2, 3];
bench('direct sum3(i, 2, 3)', (i) => sum3(i, 2, 3));
bench('sum3.call(null, i, 2, 3)', (i) => sum3.call(null, i, 2, 3));
bench('sum3.apply(null, [i, 2, 3])', (i) => sum3.apply(null, [i, 2, 3]));
bench('sum3.apply(null, reused array)', (i) => { scratch[0] = i; return sum3.apply(null, scratch); });
bench('sum3(...[i, 2, 3])', (i) => sum3(...[i, 2, 3]));
const preBound = sum3.bind(null);
bench('preBound(i, 2, 3)  [bind done once]', (i) => preBound(i, 2, 3));
bench('sum3.bind(null)(i, 2, 3)  [bind per call]', (i) => sum3.bind(null)(i, 2, 3));
