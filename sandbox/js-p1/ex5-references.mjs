let a = 5, b = a; b++;
console.log('primitives copied:      a =', a, ' b =', b);
const cart1 = { items: ['sku-1'] };
const cart2 = cart1; cart2.items.push('sku-2');
console.log('objects shared:         cart1.items =', cart1.items);
const shallow = { ...cart1 }; shallow.items.push('sku-3');
console.log('spread is SHALLOW:      cart1.items =', cart1.items);
const deep = structuredClone(cart1); deep.items.push('sku-4');
console.log('structuredClone deep:   cart1.items =', cart1.items, '| clone =', deep.items);
console.log('\nequality is by identity:');
console.log('  {a:1} === {a:1}        ', {a:1} === {a:1});
console.log('  [1,2] === [1,2]        ', [1,2] === [1,2]);
const same = cart1; console.log('  same reference         ', same === cart1);
console.log('\nconst protects the binding, not the value:');
const frozenish = { qty: 1 }; frozenish.qty = 99;
console.log('  mutated through const  ', frozenish);
try { eval('const c = {}; c = {}'); } catch (e) { console.log('  reassign throws        ', e.constructor.name + ':', e.message); }
const frozen = Object.freeze({ qty: 1, nested: { qty: 1 } });
try { frozen.qty = 99; } catch (e) { console.log('  freeze: top level throws', e.constructor.name); }
frozen.nested.qty = 99;   // NOT frozen — freeze is shallow
console.log('  freeze is SHALLOW      ', JSON.stringify(frozen));
