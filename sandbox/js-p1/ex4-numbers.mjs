console.log('0.1 + 0.2          =', 0.1 + 0.2);
console.log('0.1 + 0.2 === 0.3  =', 0.1 + 0.2 === 0.3);
console.log('toFixed(20)        =', (0.1 + 0.2).toFixed(20));
console.log('EPSILON compare    =', Math.abs((0.1+0.2) - 0.3) < Number.EPSILON);
console.log('MAX_SAFE_INTEGER   =', Number.MAX_SAFE_INTEGER);
console.log('MSI + 1 === MSI + 2=', Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2);
console.log('9007199254740993   =', 9007199254740993);
console.log('big id from JSON   =', JSON.parse('{"id":9007199254740993}').id);
console.log('BigInt keeps it    =', JSON.parse('{"id":9007199254740993}', (k,v,ctx) => k==='id'? BigInt(ctx.source): v).id);

console.log('\n--- money the wrong way ---');
let wrong = 0; for (let i=0;i<10;i++) wrong += 0.1;
console.log('0.1 x10 summed     =', wrong, '| === 1?', wrong === 1);
const price = 19.99, qty = 3;
console.log('19.99 * 3          =', price * qty);
console.log('toFixed(2)         =', (price*qty).toFixed(2));
console.log('\n--- money the right way (minor units) ---');
const priceMinor = 1999;
console.log('1999 * 3           =', priceMinor * qty, '-> formatted',
  new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(priceMinor*qty/100));
console.log('\n--- toFixed rounding is not half-up ---');
for (const n of [1.005, 1.015, 1.025, 2.675, 8.345]) console.log(`  (${n}).toFixed(2) = ${n.toFixed(2)}`);
