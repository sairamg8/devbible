// Phase 3 topic 07 — the scope facts that need sloppy mode / a non-module file.
const show = (l, v) => console.log(`  ${String(l).padEnd(50)} ${v}`);

console.log('\n--- silent failures that strict mode turns into errors ---');
const frozen = Object.freeze({a: 1});
frozen.a = 99;
show('sloppy: frozen.a = 99 (no throw)', JSON.stringify(frozen) + '  ← silently ignored');

undeclaredName = 'created without any keyword';
show('sloppy: undeclaredName = ... ', JSON.stringify(undeclaredName));
show('  and it landed on globalThis', JSON.stringify(globalThis.undeclaredName));
show('  ↑ this is the accidental-global bug', 'strict mode makes it a ReferenceError');

console.log('\n--- CommonJS top level is NOT the global scope ---');
var cjsVar = 'declared with var at CJS top level';
show('globalThis.cjsVar', String(globalThis.cjsVar));
show('  because CommonJS wraps the file', 'in a function(exports, require, module, __filename, __dirname)');
show('the binding still works locally', cjsVar);

console.log('\n--- a real <script> global, simulated ---');
// In a browser <script> (not type=module), top-level var DOES become a global.
// The closest observable equivalent here is an indirect eval, which runs in
// global scope rather than the module/CJS wrapper.
(0, eval)('var trulyGlobal = "set via indirect eval";');
show('indirect eval: globalThis.trulyGlobal', JSON.stringify(globalThis.trulyGlobal));
show('  that is what a browser <script> var does', 'and what a module var does NOT');

console.log('\n--- with() — why it is banned in strict mode ---');
const obj = {a: 1};
try {
  eval('with (obj) { show("sloppy: inside with(obj), a is", a); }');
} catch (e) {
  show('sloppy: with (obj) { … }', `${e.constructor.name}: ${e.message}`);
}
try {
  eval('"use strict"; with (obj) { void a; }');
} catch (e) {
  show('strict: with (obj) { … }', `${e.constructor.name}: ${e.message}`);
}
show('why it is banned', 'the scope chain becomes unknowable until runtime');
