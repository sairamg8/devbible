const t = (label, src) => { try { console.log(`  ${label.padEnd(30)} -> ${JSON.stringify(eval(src))}`); } catch(e){ console.log(`  ${label.padEnd(30)} -> ${e.constructor.name}: ${e.message.split('\n')[0]}`); } };
console.log('--- statement vs expression position ---');
t('{} + []  (statement)', '{} + []');
t('({}) + [] (expression)', '({}) + []');
t('function(){}  (statement)', 'function(){}');
t('(function(){ return 1 })()', '(function(){ return 1 })()');
t('!function(){ return 1 }()', '!function(){ return 1 }()');
console.log('\n--- ASI: return + newline ---');
t('return with newline', '(function(){ return\n {a:1} })()');
t('return same line', '(function(){ return {a:1} })()');
console.log('\n--- the five dangerous line starts ---');
const cases = [
  ['( leading', 'const a = 1\n(function(){})()'],
  ['[ leading', 'const b = 1\n[1,2].forEach(()=>{})'],
  ['` leading', 'const c = "x"\n`tpl`'],
  ['+ leading', 'let d = 1\n+2'],
  ['- leading', 'let e = 1\n-2'],
  ['/ leading', 'let f = 1\n/re/.test("x")'],
];
for (const [label, src] of cases) t(label, src);
console.log('\n--- no ASI before ++ on the next line ---');
t('x NL ++ NL y', 'let x=1, y=1; x\n++\ny; JSON.stringify([x,y])');
