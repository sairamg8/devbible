// Phase 3 topic 04 — arrow functions: what they lack, and where that helps or hurts.
const line = (t) => console.log(`\n--- ${t} ---`);
const show = (l, v) => console.log(`  ${String(l).padEnd(48)} ${v}`);
const fail = (l, fn) => { try { show(l, fn()); } catch (e) { show(l, `${e.constructor.name}: ${e.message}`); } };

line('an arrow has no this — it resolves through the scope chain');
const obj = {
  label: 'obj',
  good() { const inner = () => this.label; return inner(); },
  bad: () => (typeof this === 'undefined' ? 'undefined (module this)' : String(this)),
  nestedTwice() { return (() => (() => this.label)())(); },
};
show('method containing an arrow', obj.good());
show('arrow used AS the method', obj.bad());
show('arrows nested two deep', obj.nestedTwice());

line('this in an arrow is FIXED at creation — call/apply/bind cannot change it');
function makeArrow() { return () => (this === undefined ? 'undefined' : this.tag); }
const arrow = makeArrow.call({tag: 'creator'});
show('arrow()', arrow());
show('arrow.call({tag:"other"})', arrow.call({tag: 'other'}) + '  ← call ignored');
show('arrow.apply({tag:"other"})', arrow.apply({tag: 'other'}) + '  ← apply ignored');
show('arrow.bind({tag:"other"})()', arrow.bind({tag: 'other'})() + '  ← bind ignored');
show('but bind still returns a function', typeof arrow.bind({}));

line('the four missing pieces');
const A = () => {};
show('A.prototype', String(A.prototype));
fail('new A()', () => { new A(); return 'no error'; });
show('A.hasOwnProperty("prototype")', A.hasOwnProperty('prototype'));
function F() {}
show('a declaration: typeof F.prototype', typeof F.prototype);
fail('arguments at module scope inside an arrow', () => { const f = () => arguments.length; return f(1, 2); });
function outer() { const inner = () => arguments.length; return inner(9, 9, 9, 9); }
show('arrow inside a function reading arguments', outer(1, 2) + '  ← the OUTER call count, not its own');
const withRest = (...args) => args.length;
show('the fix: (...args) => args.length, called with 4', withRest(1, 2, 3, 4));

line('arrows are still functions in every other respect');
const named = (a, b) => a + b;
show('typeof', typeof named);
show('named.name', JSON.stringify(named.name));
show('named.length', named.length);
show('instanceof Function', named instanceof Function);
show('Object.getPrototypeOf(arrow) === Function.prototype', Object.getPrototypeOf(named) === Function.prototype);
show('named.call(null, 1, 2) still passes ARGS', named.call(null, 1, 2));

line('implicit return, and the object-literal trap');
const ret1 = (n) => n * 2;
show('n => n * 2', ret1(4));
const wrong = (n) => { value: n };
show('n => { value: n }   ← parsed as a BLOCK', String(wrong(4)));
const right = (n) => ({value: n});
show('n => ({ value: n }) ← parenthesised', JSON.stringify(right(4)));

line('the object-literal trap: one property parses, two do not');
const rows = [{id: 1, name: 'ada'}, {id: 2, name: 'linus'}];
const {inspect} = await import('node:util');   // JSON.stringify would print undefined as null
show('rows.map(r => { id: r.id })  ← one label', inspect(rows.map((r) => { id: r.id })));
fail('rows.map(r => { id: r.id, name: r.name })', () => { eval('rows.map((r) => { id: r.id, name: r.name })'); return 'parsed'; });
show('rows.map(r => ({ id: r.id, name: r.name }))', JSON.stringify(rows.map((r) => ({id: r.id, name: r.name}))));

line('a concise arrow body cannot hold a statement');
fail('eval("(n) => if (n) 1")', () => { eval('(n) => if (n) 1'); return 'parsed'; });
fail('eval("() => return 1")', () => { eval('() => return 1'); return 'parsed'; });

line('no super, no new.target');
class Base { greet() { return 'base'; } }
class Child extends Base {
  viaArrow = () => super.greet() + ' via arrow field';
  viaMethod() { const a = () => super.greet(); return a() + ' via arrow in method'; }
}
const c = new Child();
show('super inside an arrow class FIELD', c.viaArrow());
show('super inside an arrow in a method', c.viaMethod());
function target() { return new.target === undefined ? 'undefined' : new.target.name; }
show('new.target in a function, called plainly', target());
show('new.target in a function, called with new', (() => { let r; function T() { r = new.target?.name; } new T(); return r; })());
fail('eval("const a = () => new.target")', () => { eval('const a = () => new.target; a();'); return 'parsed and ran'; });

line('arrows are not constructible, but ARE callable — generators/async differ');
const asyncArrow = async () => 1;
show('async () => 1 returns', Object.prototype.toString.call(asyncArrow()));
fail('eval("const g = *() => {}")', () => { eval('const g = *() => {};'); return 'parsed'; });
show('there is no generator arrow', 'function* only');

line('prototype methods vs class-field arrows: shared or per-instance');
class WithMethod { m() { return 1; } }
class WithField { m = () => 1; }
const m1 = new WithMethod(), m2 = new WithMethod();
const f1 = new WithField(), f2 = new WithField();
show('two instances, prototype method: m1.m === m2.m', m1.m === m2.m);
show('two instances, field arrow: f1.m === f2.m', f1.m === f2.m);
show('is the method on the prototype?', 'm' in Object.getPrototypeOf(m1));
show('is the field on the prototype?', 'm' in Object.getPrototypeOf(f1));
show('own keys of a prototype-method instance', JSON.stringify(Object.keys(m1)));
show('own keys of a field-arrow instance', JSON.stringify(Object.keys(f1)));
show('JSON.stringify of the field-arrow instance', JSON.stringify(f1) + '  ← functions are skipped');
