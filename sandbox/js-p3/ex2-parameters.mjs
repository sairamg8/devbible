// Phase 3 topic 02 — parameters: defaults, rest, destructuring, arguments.
const line = (t) => console.log(`\n--- ${t} ---`);
const show = (l, v) => console.log(`  ${String(l).padEnd(46)} ${v}`);

line('defaults are evaluated at CALL time, left to right');
const calls = [];
const track = (n) => { calls.push(n); return n; };
function order(a = track('a'), b = track('b'), c = track('c')) { return [a, b, c]; }
order();
show('order() evaluation order', JSON.stringify(calls));
calls.length = 0;
order(1, undefined, 3);
show('order(1, undefined, 3) → evaluated', JSON.stringify(calls));
calls.length = 0;
order(1, null, 3);
show('order(1, null, 3) → evaluated', JSON.stringify(calls) + '  ← null does NOT trigger the default');
show('  and the values were', JSON.stringify(order(1, null, 3)));

line('a later default can read an earlier parameter — but not the reverse');
function rect(w, h = w * 2) { return [w, h]; }
show('rect(3)', JSON.stringify(rect(3)));
function broken(a = b, b = 2) { return [a, b]; }
try { broken(); } catch (e) { show('function broken(a = b, b = 2) → broken()', `${e.constructor.name}: ${e.message}`); }
show('broken(1) (a supplied, default never runs)', JSON.stringify(broken(1)));

line('a default is re-evaluated on EVERY call — the shared-default myth');
function pushTo(item, list = []) { list.push(item); return list; }
show('pushTo(1) then pushTo(2)', `${JSON.stringify(pushTo(1))} then ${JSON.stringify(pushTo(2))}`);
const shared = [];
function pushToShared(item, list = shared) { list.push(item); return list; }
pushToShared(1); pushToShared(2);
show('but a default referencing an OUTER array', JSON.stringify(shared));

line('defaults change .length and disable the simple-parameter fast path');
show('((a, b) => 0).length', ((a, b) => 0).length);
show('((a, b = 1) => 0).length', ((a, b = 1) => 0).length);
show('((a = 1, b) => 0).length', ((a = 1, b) => 0).length + '  ← counts up to the FIRST default');
show('((a, ...r) => 0).length', ((a, ...r) => 0).length + '  ← rest is not counted');
show('((a, {b}) => 0).length', ((a, {b}) => 0).length + '  ← destructuring IS counted');

line('arguments aliasing: NOT here — this file is an ES module, so it is strict');
function simple(a) { a = 99; return arguments[0]; }
show('simple(1): a = 99 then arguments[0]', simple(1) + '  ← unlinked: strict mode');
function withDefault(a, b = 2) { a = 99; return arguments[0]; }
show('withDefault(1): a = 99 then arguments[0]', withDefault(1) + '  ← unlinked: has a default');
show('all rows read 1 because a module is strict', 'see ex2b-arguments-sloppy.cjs for the aliased case');

line('arguments is not an array');
function args() {
  return {
    isArray: Array.isArray(arguments),
    type: Object.prototype.toString.call(arguments),
    hasMap: typeof arguments.map,
    viaFrom: Array.from(arguments).map((x) => x * 2),
    viaSpread: [...arguments].length,
  };
}
console.log(' ', args(1, 2, 3));
function callMap() { try { arguments.map((x) => x); } catch (e) { return `${e.constructor.name}: ${e.message}`; } }
show('arguments.map(x => x)', callMap(1, 2));

line('rest parameters');
function rest(first, ...others) { return {first, others, isArray: Array.isArray(others)}; }
console.log(' ', rest(1, 2, 3));
console.log(' ', rest(1));
try { eval('function bad(...a, b) {}'); } catch (e) { show('function bad(...a, b) {}', `${e.constructor.name}: ${e.message}`); }
try { eval('function bad2(...a = []) {}'); } catch (e) { show('function bad2(...a = []) {}', `${e.constructor.name}: ${e.message}`); }

line('destructured parameters, and the missing-argument crash');
function draw({x = 0, y = 0} = {}) { return [x, y]; }
show('draw()', JSON.stringify(draw()));
show('draw({x: 5})', JSON.stringify(draw({x: 5})));
function drawNoDefault({x = 0, y = 0}) { return [x, y]; }
try { drawNoDefault(); } catch (e) { show('drawNoDefault() with no = {}', `${e.constructor.name}: ${e.message}`); }

line('renaming and nesting while destructuring');
function req({body: {name: userName = 'anon'} = {}, headers: {auth} = {}} = {}) {
  return {userName, auth};
}
console.log(' ', req({body: {name: 'ada'}, headers: {auth: 'token'}}));
console.log(' ', req({}));
console.log(' ', req());

line('argument count is never enforced');
// NOTE: printed with util.inspect, not JSON.stringify — the latter turns
// `undefined` into `null` and would misreport the missing argument.
const {inspect} = await import('node:util');
function two(a, b) { return {a, b, argumentsLength: arguments.length}; }
show('two(1)', inspect(two(1)));
show('two(1, 2, 3, 4)', inspect(two(1, 2, 3, 4)));
show('  ↑ no error either way', 'JavaScript has no arity checking');

line('parameters are in their own scope, separate from the body');
function scopes(x, f = () => x) {
  var x = 'body';           // a NEW binding in the body scope
  return [x, f()];
}
show('scopes("param") → [body x, default closure x]', JSON.stringify(scopes('param')));
show('  ↑ the default closure kept the PARAMETER x', 'not the body var');

line('the TDZ applies inside the parameter list too');
try { eval('(function (a = a) {})()'); } catch (e) { show('(function (a = a) {})()', `${e.constructor.name}: ${e.message}`); }
