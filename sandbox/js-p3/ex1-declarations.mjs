// Phase 3 topic 01 — declarations vs expressions vs arrow functions.
// Every claim on the page comes from this output.
const line = (t) => console.log(`\n--- ${t} ---`);
const show = (l, v) => console.log(`  ${String(l).padEnd(44)} ${v}`);

line('hoisting: a declaration is usable before its line');
console.log('  declared() before the declaration:', declared());
function declared() { return 'works'; }

try { expressed(); } catch (e) { show('expressed() before the const', `${e.constructor.name}: ${e.message}`); }
const expressed = function () { return 'works'; };
show('expressed() after the const', expressed());

try { arrowed(); } catch (e) { show('arrowed() before the const', `${e.constructor.name}: ${e.message}`); }
const arrowed = () => 'works';

line('var-assigned function expression: hoisted, but as undefined');
try { varFn(); } catch (e) { show('varFn() before the assignment', `${e.constructor.name}: ${e.message}`); }
var varFn = function () { return 'works'; };
show('typeof varFn before assignment was', 'undefined → calling it is a TypeError, not a ReferenceError');

line('.name — what shows up in a stack trace');
const anon = function () {};
const named = function theRealName() {};
const arrow = () => {};
const obj = {method() {}, prop: function () {}, arrowProp: () => {}};
show('const anon = function(){}', JSON.stringify(anon.name));
show('const named = function theRealName(){}', JSON.stringify(named.name));
show('const arrow = () => {}', JSON.stringify(arrow.name));
show('{ method(){} }', JSON.stringify(obj.method.name));
show('{ prop: function(){} }', JSON.stringify(obj.prop.name));
show('{ arrowProp: () => {} }', JSON.stringify(obj.arrowProp.name));
show('(function(){}).name  (never assigned)', JSON.stringify((function () {}).name));
show('new Function().name', JSON.stringify(new Function().name));
show('anon.bind(null).name', JSON.stringify(anon.bind(null).name));

line('the named function expression binds its own name INSIDE only');
const fact = function inner(n) { return n <= 1 ? 1 : n * inner(n - 1); };
show('inner(5) called through the const', fact(5));
try { inner(3); } catch (e) { show('inner(3) from outside', `${e.constructor.name}: ${e.message}`); }

line('what a real stack trace shows for each form');
const trace = (fn) => { try { fn(); } catch (e) { return e.stack.split('\n')[1].trim(); } };
show('anonymous expression', trace(function () { throw new Error('x'); }));
show('named expression', trace(function myNamedFn() { throw new Error('x'); }));
show('arrow assigned to a const', trace(() => { throw new Error('x'); }));

line('arrow functions: what they do NOT have');
const A = () => {};
show('A.prototype', String(A.prototype));
show('typeof A.prototype', typeof A.prototype);
try { new A(); } catch (e) { show('new A()', `${e.constructor.name}: ${e.message}`); }
function F() {}
show('F.prototype (a declaration)', typeof F.prototype);
show('new F() works', String(new F() instanceof F));
show('A.length / F.length', `${A.length} / ${F.length}`);

line('arguments');
function withArgs() { return arguments.length; }
show('function declaration: arguments.length', withArgs(1, 2, 3));
const arrowArgs = () => {
  try { return arguments.length; } catch (e) { return `${e.constructor.name}: ${e.message}`; }
};
show('arrow at module scope: arguments', String(arrowArgs(1, 2, 3)));
function outerHasArgs() {
  const inner = () => arguments.length;   // closes over the OUTER arguments
  return inner(9, 9, 9, 9);
}
show('arrow inside a function: arguments.length', outerHasArgs(1, 2));
show('  ↑ it saw the OUTER call args (2), not its own', '4 args passed to inner');

line('block-scoped function declarations');
{
  function inBlock() { return 'block'; }
  show('called inside the block', inBlock());
}
show('typeof inBlock outside the block (module/ESM)', typeof inBlock);

line('a declaration after a return is still hoisted');
function afterReturn() {
  return hoisted();
  function hoisted() { return 'reached'; }
}
show('function declared after return', afterReturn());

line('toString round trip');
show('arrow.toString()', (() => 1).toString());
show('method shorthand toString()', ({m() { return 1; }}).m.toString());
try { eval('(' + ({m() { return 1; }}).m.toString() + ')'); show('eval of the shorthand source', 'parsed'); }
catch (e) { show('eval of the shorthand source', `${e.constructor.name}: ${e.message}`); }
try { eval('(' + (function f() { return 1; }).toString() + ')'); show('eval of a function-expression source', 'parsed'); }
catch (e) { show('eval of a function-expression source', `${e.constructor.name}: ${e.message}`); }
