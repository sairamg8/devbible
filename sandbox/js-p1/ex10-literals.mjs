console.log('Number("0xff") =', Number('0xff'), '| Number("0o755") =', Number('0o755'), '| Number("0b1010") =', Number('0b1010'));
console.log('parseInt("0o755") =', parseInt('0o755'), '| parseInt("0b1010") =', parseInt('0b1010'));
console.log('(255).toString(16) =', (255).toString(16), '| (493).toString(8) =', (493).toString(8));
for (const src of ['_1000','1000_','1._5','1__0']) {
  try { eval(src); console.log(`  ${src.padEnd(7)} -> ok`); }
  catch (e) { console.log(`  ${src.padEnd(7)} -> ${e.constructor.name}`); }
}
console.log('0xFFFFFFFFFFFFFFF safe? ', Number.isSafeInteger(0xFFFFFFFFFFFFFFF));
