// Phase 3 topic 02 — the arguments-aliasing case that ONLY happens in sloppy
// mode. A .cjs file with no 'use strict' is the only place left to see it:
// ES modules and class bodies are always strict.
const show = (l, v) => console.log(`  ${String(l).padEnd(46)} ${v}`);

console.log('\n--- sloppy mode (.cjs, no "use strict") ---');

function simple(a) { a = 99; return arguments[0]; }
show('simple(1): a = 99 then arguments[0]', simple(1) + '  ← ALIASED');

function writeThrough(a) { arguments[0] = 42; return a; }
show('writeThrough(1): arguments[0] = 42 then a', writeThrough(1) + '  ← aliasing goes both ways');

function withDefault(a, b = 2) { a = 99; return arguments[0]; }
show('withDefault(1): a = 99 then arguments[0]', withDefault(1) + '  ← NOT aliased: has a default');

function withRest(a, ...r) { a = 99; return arguments[0]; }
show('withRest(1): a = 99 then arguments[0]', withRest(1) + '  ← NOT aliased: has rest');

function withDestructuring({v}, b) { b = 99; return arguments[1]; }
show('withDestructuring({v:1}, 1): b = 99', withDestructuring({v: 1}, 1) + '  ← NOT aliased: destructured param');

function strictFn(a) { 'use strict'; a = 99; return arguments[0]; }
show('strictFn(1): a = 99 then arguments[0]', strictFn(1) + '  ← NOT aliased: strict');

console.log('\n--- what disables aliasing, summarised ---');
show('any default, rest, or destructured param', 'the whole parameter list becomes non-simple');
show('and a non-simple list is', 'never aliased, even in sloppy mode');
