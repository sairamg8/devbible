const s = 'café🛒';
console.log('string            :', s);
console.log('.length (UTF-16)  :', s.length);
console.log('[...s].length     :', [...s].length);
console.log('Segmenter graphemes:', [...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(s)].length);
const family = '👨‍👩‍👧';
console.log('\nfamily emoji      :', family, '| .length', family.length, '| spread', [...family].length,
  '| graphemes', [...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(family)].length);
console.log('naive slice(0,2)  :', JSON.stringify('🛒cart'.slice(0,2)), '<- one full emoji, 2 code units');
console.log('broken slice(0,1) :', JSON.stringify('🛒cart'.slice(0,1)), '<- half a surrogate pair');
console.log('café NFC vs NFD   :', 'café' === 'café', '| after normalize:', 'café'.normalize() === 'café'.normalize());

console.log('\n--- Symbol ---');
const id1 = Symbol('id'), id2 = Symbol('id');
console.log('Symbol("id") === Symbol("id") :', id1 === id2);
const o = { [id1]: 'a', visible: 'b' };
console.log('Object.keys hides symbols     :', Object.keys(o));
console.log('JSON.stringify drops symbols  :', JSON.stringify(o));
console.log('getOwnPropertySymbols finds it:', Object.getOwnPropertySymbols(o).length);
console.log('Symbol.for is global registry :', Symbol.for('app') === Symbol.for('app'));
try { '' + id1; } catch (e) { console.log('implicit string coercion throws:', e.constructor.name + ':', e.message); }
console.log('String(sym) works             :', String(id1));

console.log('\n--- BigInt ---');
console.log('10n + 20n        :', 10n + 20n);
try { console.log(1n + 1); } catch (e) { console.log('1n + 1 throws     :', e.constructor.name + ':', e.message); }
console.log('1n == 1          :', 1n == 1, '| 1n === 1:', 1n === 1);
console.log('5n / 2n (truncates):', 5n / 2n);
try { JSON.stringify({v: 1n}); } catch (e) { console.log('JSON.stringify    :', e.constructor.name + ':', e.message); }
