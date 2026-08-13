// Phase 3 topic 03 — the two `this` facts that need a CommonJS / sloppy file.
const show = (l, v) => console.log(`  ${String(l).padEnd(50)} ${v}`);

console.log('\n--- module top-level `this` differs by module system ---');
show('CJS: this === module.exports', this === module.exports);
show('CJS: this', JSON.stringify(this));
show('(an ES module gives undefined here)', 'see ex3-this.mjs');

console.log('\n--- sloppy mode: default binding is globalThis, not undefined ---');
function sloppy() { return this === globalThis; }
show('sloppy(): this === globalThis', sloppy());
function strictFn() { 'use strict'; return this; }
show('strict fn(): this', String(strictFn()));

console.log('\n--- why strict is the improvement ---');
function sloppyWrite() { this.accidentalGlobal = 'leaked'; }
sloppyWrite();
show('sloppy: this.accidentalGlobal = ... created', JSON.stringify(globalThis.accidentalGlobal));
function strictWrite() { 'use strict'; this.count = 0; }
try { strictWrite(); } catch (e) { show('strict: this.count = 0 throws', `${e.constructor.name}: ${e.message}`); }
