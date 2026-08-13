console.log('--- delete ---');
const o = { a: 1, b: 2 };
console.log('  delete o.a returns:', delete o.a, '| o =', JSON.stringify(o));
console.log('  delete missing key :', delete o.zzz);
const arr = [1,2,3];
delete arr[1];
console.log('  delete arr[1] -> ', JSON.stringify(arr), '| length still', arr.length, '| 1 in arr =', 1 in arr);
console.log('  arr.map over hole:', JSON.stringify(arr.map(x => x)) , '<- hole preserved');
const frozen = Object.freeze({ x: 1 });
try { delete frozen.x; } catch(e){ console.log('  delete frozen prop ->', e.constructor.name); }
console.log('  delete on a var    ->', (()=>{ try { return eval('var q=1; delete q'); } catch(e){ return e.constructor.name; } })());

console.log('\n--- in ---');
console.log('  "a" in {a:1}       =', 'a' in {a:1});
console.log('  "toString" in {}   =', 'toString' in {}, '<- walks prototype chain');
console.log('  Object.hasOwn({},"toString") =', Object.hasOwn({}, 'toString'));
console.log('  0 in [1,2]         =', 0 in [1,2], '| 5 in [1,2] =', 5 in [1,2]);
console.log('  "length" in []     =', 'length' in []);

console.log('\n--- void ---');
console.log('  void 0             =', void 0, '| void 0 === undefined =', void 0 === undefined);
console.log('  void "anything"    =', void 'anything');

console.log('\n--- comma ---');
console.log('  (1, 2, 3)          =', (1, 2, 3));
let calls = []; const f = (n) => { calls.push(n); return n; };
const r = (f(1), f(2), f(3));
console.log('  all evaluated:', JSON.stringify(calls), '| result =', r);
