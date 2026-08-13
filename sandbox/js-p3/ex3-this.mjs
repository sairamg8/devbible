// Phase 3 topic 03 — `this`: the four binding rules, resolved at CALL time.
const line = (t) => console.log(`\n--- ${t} ---`);
const show = (l, v) => console.log(`  ${String(l).padEnd(50)} ${v}`);
const tag = (v) => (v === undefined ? 'undefined' : v === globalThis ? 'globalThis' : JSON.stringify(v));

line('rule 4 (default): a plain call — module code is strict');
function plain() { return tag(this); }
show('plain()', plain());
show('this at module top level', tag(this) + '  ← undefined in an ES module');
show('globalThis is still reachable', typeof globalThis);

line('rule 3 (implicit): this is whatever is LEFT OF THE DOT');
const counter = {
  label: 'counter',
  value: 0,
  read() { return this === undefined ? 'undefined' : this.label; },
};
show('counter.read()', counter.read());
const nested = {label: 'outer', inner: {label: 'inner', read() { return this.label; }}};
show('nested.inner.read()  ← only the LAST dot counts', nested.inner.read());

line('the lost-this bug: extracting a method drops the receiver');
const loose = counter.read;
try { show('const loose = counter.read; loose()', loose()); }
catch (e) { show('const loose = counter.read; loose()', `${e.constructor.name}: ${e.message}`); }
try { show('setTimeout-style: passing the method as a value', [counter.read].map((f) => f())[0]); }
catch (e) { show('setTimeout-style: passing the method as a value', `${e.constructor.name}: ${e.message}`); }

line('same function, four receivers — this is not a property of the function');
function whoAmI() { return this === undefined ? 'undefined' : this.name; }
const a = {name: 'a', who: whoAmI};
const b = {name: 'b', who: whoAmI};
show('a.who()', whoAmI.call(a));
show('b.who()', whoAmI.call(b));
show('whoAmI()', whoAmI());
show('whoAmI.call({name: "adhoc"})', whoAmI.call({name: 'adhoc'}));

line('rule 2 (explicit): call / apply / bind');
show('whoAmI.call({name:"c"})', whoAmI.call({name: 'c'}));
show('whoAmI.apply({name:"d"})', whoAmI.apply({name: 'd'}));
const bound = whoAmI.bind({name: 'e'});
show('whoAmI.bind({name:"e"})()', bound());
show('a bound function re-bound', bound.call({name: 'IGNORED'}) + '  ← bind wins, permanently');
show('bound.name', JSON.stringify(bound.name));
show('bound.length (whoAmI takes 0)', bound.length);

line('rule 1 (new) beats everything below it');
function Person(name) { this.name = name; }
const bp = Person.bind({name: 'bound-target'});
const madeWithNew = new bp('from-new');
show('new (Person.bind({name:"bound-target"}))("from-new")', JSON.stringify(madeWithNew.name));
show('  ↑ new overrode the bind', 'the bound this was discarded, the arg was not');

line('precedence, measured in one object');
function report() { return this.tag; }
const target = {tag: 'implicit', report};
const boundToExplicit = report.bind({tag: 'bound'});
show('target.report()                     implicit', target.report());
show('target.report.call({tag:"explicit"}) explicit', target.report.call({tag: 'explicit'}));
show('boundToExplicit()                    bound', boundToExplicit());
show('boundToExplicit.call({tag:"x"})      bound wins', boundToExplicit.call({tag: 'x'}));

line('rule 0 (lexical): an arrow has no this of its own');
const withArrow = {
  label: 'withArrow',
  method() { const arrow = () => (this === undefined ? 'undefined' : this.label); return arrow(); },
  arrowAsMethod: () => (typeof this === 'undefined' ? 'undefined (module this)' : 'something'),
};
show('method() containing an arrow', withArrow.method());
show('an arrow used AS the method', withArrow.arrowAsMethod());
try { const A = () => {}; new A(); } catch (e) { show('new (arrow)', `${e.constructor.name}: ${e.message}`); }

line('callbacks: which array methods hand you a thisArg');
const collector = {
  factor: 10,
  viaThisArg(nums) { return nums.map(function (n) { return n * this.factor; }, this); },
  viaArrow(nums) { return nums.map((n) => n * this.factor); },
  broken(nums) { return nums.map(function (n) { return n * this.factor; }); },
};
show('map(fn, thisArg)', JSON.stringify(collector.viaThisArg([1, 2])));
show('map(arrow)', JSON.stringify(collector.viaArrow([1, 2])));
try { show('map(function) with no thisArg', JSON.stringify(collector.broken([1, 2]))); }
catch (e) { show('map(function) with no thisArg', `${e.constructor.name}: ${e.message}`); }
// Which iteration methods actually accept a thisArg? Probe rather than assert:
// call each with a marker object and see whether the callback received it.
const marker = {marker: true};
const probes = {
  forEach: (arr, cb) => arr.forEach(cb, marker),
  map: (arr, cb) => arr.map(cb, marker),
  filter: (arr, cb) => arr.filter(cb, marker),
  some: (arr, cb) => arr.some(cb, marker),
  every: (arr, cb) => arr.every(cb, marker),
  find: (arr, cb) => arr.find(cb, marker),
  findIndex: (arr, cb) => arr.findIndex(cb, marker),
  flatMap: (arr, cb) => arr.flatMap(cb, marker),
  reduce: (arr, cb) => arr.reduce(cb, marker),
  sort: (arr, cb) => [...arr].sort(cb),
};
for (const [name, run] of Object.entries(probes)) {
  let got = 'never called';
  run([1, 2], function () { got = this === marker ? 'thisArg honoured' : `this = ${this === undefined ? 'undefined' : typeof this}`; return 1; });
  show(`Array.prototype.${name}`, got);
}

line('class bodies are always strict — the same loss, a clearer error');
class Service {
  constructor() { this.name = 'service'; }
  read() { return this.name; }
  readBound = () => this.name;
}
const svc = new Service();
show('svc.read()', svc.read());
const detached = svc.read;
try { show('const detached = svc.read; detached()', detached()); }
catch (e) { show('const detached = svc.read; detached()', `${e.constructor.name}: ${e.message}`); }
const detachedField = svc.readBound;
show('a class FIELD arrow survives detaching', detachedField());

line('what new actually does, step by step');
function Widget(id) { this.id = id; }
Widget.prototype.describe = function () { return `widget ${this.id}`; };
const w = new Widget(7);
show('new Widget(7) → this is a fresh object', JSON.stringify(w));
show('linked to Widget.prototype', Object.getPrototypeOf(w) === Widget.prototype);
function Returns() { this.a = 1; return {b: 2}; }
show('a constructor returning an OBJECT', JSON.stringify(new Returns()) + '  ← the return wins');
function ReturnsPrimitive() { this.a = 1; return 42; }
show('a constructor returning a PRIMITIVE', JSON.stringify(new ReturnsPrimitive()) + '  ← ignored');
