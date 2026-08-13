const empty = {};
const checks = [
  ['(empty?.a).b            ', () => (empty?.a).b],
  ['empty?.a.b              ', () => empty?.a.b],
  ['notDeclaredVar?.x       ', () => eval('notDeclaredVar?.x')],
  ['obj?.a = 1              ', () => eval('const o={}; o?.a = 1')],
  ['obj?[key]               ', () => eval('const o={}; o?["a"]')],
  ['delete empty?.a.b       ', () => eval('delete empty?.a.b')],
];
for (const [label, fn] of checks) {
  try { console.log(label, '-> ok, value =', fn()); }
  catch (e) { console.log(label, '->', e.constructor.name + ':', e.message.split('\n')[0]); }
}
console.log('\nmissing vs present-but-undefined:');
const a = { k: undefined }, b = {};
console.log('  a?.k =', a?.k, '| b?.k =', b?.k, '| hasOwn(a,"k") =', Object.hasOwn(a,'k'), '| hasOwn(b,"k") =', Object.hasOwn(b,'k'));
