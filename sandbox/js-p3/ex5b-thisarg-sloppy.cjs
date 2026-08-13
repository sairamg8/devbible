// Phase 3 topic 05 — thisArg coercion differs between strict and sloppy mode.
// Needs a .cjs file: an ES module is always strict, so it cannot show boxing.
const show = (l, v) => console.log(`  ${String(l).padEnd(48)} ${v}`);
function what() {
  return `${typeof this} ${this === undefined ? '(undefined)' : this === globalThis ? '(globalThis)' : Object.prototype.toString.call(this)}`;
}
function whatStrict() {
  'use strict';
  return `${typeof this} ${this === undefined ? '(undefined)' : this === globalThis ? '(globalThis)' : Object.prototype.toString.call(this)}`;
}

console.log('\n--- sloppy mode: primitives are BOXED, null/undefined become globalThis ---');
for (const [label, v] of [['undefined', undefined], ['null', null], ['42', 42], ['"str"', 'str'], ['true', true]]) {
  show(`what.call(${label})`, what.call(v));
}

console.log('\n--- strict mode: the thisArg is passed through untouched ---');
for (const [label, v] of [['undefined', undefined], ['null', null], ['42', 42], ['"str"', 'str'], ['true', true]]) {
  show(`whatStrict.call(${label})`, whatStrict.call(v));
}

console.log('\n--- the practical consequence ---');
function addOne() { this.count = (this.count || 0) + 1; return this.count; }
addOne.call(42);
addOne.call(42);
show('sloppy: addOne.call(42) twice', 'each call boxes a NEW Number, so count is always 1');
show('  second call returned', addOne.call(42));
