console.log('--- ?? vs || on falsy-but-valid values ---');
for (const v of [0, '', false, null, undefined, NaN]) {
  const label = v === '' ? "''" : Object.is(v, NaN) ? 'NaN' : String(v);
  console.log(`  value ${label.padEnd(10)} ||-> ${String(v || 'FALLBACK').padEnd(10)} ??-> ${String(v ?? 'FALLBACK')}`);
}
console.log('\n--- defaults only fire on undefined ---');
const f = (qty = 1) => qty;
console.log('  f(undefined) =', f(undefined), '| f(null) =', f(null), '| f(0) =', f(0), '| f() =', f());
const { a = 'dflt' } = { a: null };   console.log('  destructuring default with null:', a);
const { b = 'dflt' } = { b: undefined }; console.log('  destructuring default with undefined:', b);

console.log('\n--- NaN ---');
console.log('  NaN === NaN        :', NaN === NaN);
console.log('  isNaN("abc")       :', isNaN('abc'), '<- coerces first');
console.log('  Number.isNaN("abc"):', Number.isNaN('abc'), '<- no coercion');
console.log('  [NaN].includes(NaN):', [NaN].includes(NaN), '| [NaN].indexOf(NaN):', [NaN].indexOf(NaN));
console.log('  new Set([NaN,NaN]).size:', new Set([NaN, NaN]).size);

console.log('\n--- deep equality by JSON, and where it breaks ---');
const j = (x) => JSON.stringify(x);
console.log('  key order matters  :', j({a:1,b:2}) === j({b:2,a:1}));
console.log('  undefined dropped  :', j({a: undefined}), 'vs', j({}));
console.log('  Date -> string     :', j({d: new Date(0)}));
console.log('  Map/Set lost       :', j({m: new Map([[1,2]]), s: new Set([1])}));
console.log('  NaN/Infinity -> null:', j({n: NaN, i: Infinity}));

console.log('\n--- Object.is, -0, Infinity ---');
console.log('  0 === -0            :', 0 === -0, '| Object.is(0,-0):', Object.is(0, -0));
console.log('  1/0 =', 1/0, '| -1/0 =', -1/0, '| 0/0 =', 0/0);
console.log('  Math.round(-0.2)    :', Math.round(-0.2), '| is it -0?', Object.is(Math.round(-0.2), -0));
console.log('  [-0].includes(0)    :', [-0].includes(0), '| [-0].indexOf(0):', [-0].indexOf(0));

console.log('\n--- wrappers ---');
const prim = 'abc', wrapped = new String('abc');
console.log('  typeof              :', typeof prim, '/', typeof wrapped);
console.log('  prim == wrapped     :', prim == wrapped, '| === :', prim === wrapped);
console.log('  Boolean(new Boolean(false)) :', Boolean(new Boolean(false)), '<- object, always truthy');
console.log('\n--- numeric literals ---');
console.log('  1_000_000 =', 1_000_000, '| 0b1010 =', 0b1010, '| 0o755 =', 0o755, '| 0xff =', 0xff, '| 1e3 =', 1e3);
