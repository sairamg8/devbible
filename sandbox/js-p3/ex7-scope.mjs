// Phase 3 topic 07 — lexical scope, the scope chain, var vs let/const, shadowing.
const line = (t) => console.log(`\n--- ${t} ---`);
const show = (l, v) => console.log(`  ${String(l).padEnd(50)} ${v}`);
const fail = (l, fn) => { try { show(l, fn()); } catch (e) { show(l, `${e.constructor.name}: ${e.message}`); } };

line('scope is decided by WHERE code is written, not where it is called');
const scopeVar = 'module';
function definedHere() { return scopeVar; }
function callsIt() { const scopeVar = 'inside callsIt'; return definedHere(); }
show('callsIt() — dynamic scope would say "inside callsIt"', callsIt());
show('  lexical scope says', 'module');

line('the scope chain: inner sees outer, never the reverse');
const level0 = 'L0';
function outer() {
  const level1 = 'L1';
  function middle() {
    const level2 = 'L2';
    function inner() { return [level0, level1, level2].join(' < '); }
    return inner();
  }
  return middle();
}
show('inner() reaching three levels up', outer());
fail('outer trying to read an inner variable', () => { function o() { function i() { const hidden = 1; return hidden; } i(); return hidden; } return o(); });

line('var is FUNCTION scoped; let/const are BLOCK scoped');
function scopes() {
  if (true) { var v = 'var'; let l = 'let'; const c = 'const'; }
  const out = [`v=${v}`];
  try { out.push(`l=${l}`); } catch (e) { out.push(`l → ${e.constructor.name}`); }
  try { out.push(`c=${c}`); } catch (e) { out.push(`c → ${e.constructor.name}`); }
  return out.join('  ');
}
show('after an if-block', scopes());

function loopScope() {
  for (var a = 0; a < 1; a++) { /* empty */ }
  for (let b = 0; b < 1; b++) { /* empty */ }
  let msg = `a=${a}`;
  try { msg += `  b=${b}`; } catch (e) { msg += `  b → ${e.constructor.name}`; }
  return msg;
}
show('after two loops', loopScope());

line('blocks are scopes; objects are NOT');
{ const blockOnly = 'in a block'; show('inside the block', blockOnly); }
fail('outside the block', () => { return blockOnly; });
const holder = {inside: 'a property'};
fail('an object literal does not create a scope', () => { return inside; });

line('shadowing: an inner binding hides an outer one');
const shadowed = 'outer';
function shadows() { const shadowed = 'inner'; return shadowed; }
show('inner value', shadows());
show('outer value is untouched', shadowed);
function partial() {
  const stages = [];
  const name = 'fn-level';
  stages.push(name);
  { const name = 'block-level'; stages.push(name); }
  stages.push(name);
  return stages.join(' → ');
}
show('entering and leaving a shadowing block', partial());

line('shadowing a PARAMETER');
function shadowParam(x) { { const x = 'shadowed'; } return x; }
show('shadowParam("arg")', shadowParam('arg'));
fail('let x in the same scope as parameter x', () => { eval('(function (x) { let x = 1; })'); return 'parsed'; });
fail('var x in the same scope as parameter x', () => { eval('(function (x) { var x = 1; return x; })')('arg'); return 'parsed (var is allowed)'; });

line('redeclaration rules');
fail('let a; let a;', () => { eval('let dup; let dup;'); return 'parsed'; });
fail('var a; var a;', () => { eval('var dup2; var dup2;'); return 'parsed — var allows it'; });
fail('let a; var a;', () => { eval('let dup3; var dup3;'); return 'parsed'; });
fail('const without an initialiser', () => { eval('const noInit;'); return 'parsed'; });
fail('reassigning a const', () => { eval('const cc = 1; cc = 2;'); return 'parsed'; });

line('const is not immutable — only the BINDING is fixed');
const arr = [1, 2];
arr.push(3);
show('const arr = [1,2]; arr.push(3)  ← mutation OK', JSON.stringify(arr));
fail('const a2 = [1]; a2 = []  ← rebinding', () => { eval('const a2 = [1]; a2 = [];'); return 'parsed'; });
const frozen = Object.freeze({a: 1});
fail('Object.freeze({a:1}) then frozen.a = 99', () => { frozen.a = 99; return JSON.stringify(frozen); });
show('  ↑ strict mode throws; sloppy fails silently', 'see ex7b-scope-sloppy.cjs');
show('the frozen object is unchanged', JSON.stringify(frozen));
const nested = Object.freeze({inner: {a: 1}});
nested.inner.a = 99;
show('freeze is SHALLOW: nested.inner.a = 99', JSON.stringify(nested));

line('the global scope: var at TOP LEVEL of a module');
show('this file is an ES module', 'top-level var does NOT become a global');
var moduleVar = 'declared with var at module top level';
show('globalThis.moduleVar', String(globalThis.moduleVar));
show('the binding itself is fine', moduleVar);
show('see ex7b-scope-sloppy.cjs for script scope', 'CommonJS wraps in a function');

line('an undeclared assignment: ReferenceError in strict, global in sloppy');
fail('undeclaredName = 1 (module = strict)', () => { eval('undeclaredName = 1'); return 'assigned'; });

line('closures over block scope inside a loop body');
const fns = [];
for (let i = 0; i < 3; i++) { const doubled = i * 2; fns.push(() => doubled); }
show('const inside the loop body', JSON.stringify(fns.map((f) => f())));
