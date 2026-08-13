const values = [42, 'text', true, undefined, null, Symbol('s'), 10n, {}, [], function(){}, new Date(), /re/];
for (const v of values) {
  const label = typeof v === 'symbol' ? 'Symbol(s)' : typeof v === 'function' ? 'function(){}' : String(v);
  console.log(`typeof ${label.padEnd(22)} -> ${typeof v}`);
}
console.log('\nObject.prototype.toString distinguishes them:');
for (const v of [null, [], new Date(), /re/, {}]) {
  console.log('  ', String(Object.prototype.toString.call(v)));
}
