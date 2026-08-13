const cart = [
  { sku: 'TSHIRT-M', qty: 2, priceMinor: 49900 },
  { sku: 'MUG-01',   qty: 1, priceMinor: 24900 },
];
console.table(cart);
console.group('checkout');
console.log('items:', cart.length);
console.groupEnd();
console.time('total');
const total = cart.reduce((s, i) => s + i.qty * i.priceMinor, 0);
console.timeEnd('total');
console.log('total minor units:', total);
console.count('render'); console.count('render');
console.assert(total > 0, 'total must be positive');
console.dir({ a: { b: { c: { d: 1 } } } }, { depth: null });
console.error('this goes to stderr');
