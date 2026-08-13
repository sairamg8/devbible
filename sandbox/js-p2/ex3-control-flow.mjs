console.log('--- switch uses === ---');
function classify(v) { switch (v) { case 1: return 'number 1'; case '1': return 'string 1'; default: return 'no match'; } }
console.log('  classify(1)   =', classify(1), '| classify("1") =', classify('1'), '| classify(true) =', classify(true));
console.log('  switch(NaN) matches case NaN?', (()=>{ switch(NaN){ case NaN: return 'yes'; default: return 'no'; } })());
console.log('\n--- case block scope ---');
try { eval('switch(1){ case 1: let x = 1; break; case 2: let x = 2; break; }'); }
catch (e) { console.log('  duplicate let across cases ->', e.constructor.name+':', e.message); }
console.log('\n--- loops: which support break / await ---');
const arr = [1,2,3];
let out = [];
for (const n of arr) { if (n === 2) break; out.push(n); }
console.log('  for..of break works:', out);
out = []; arr.forEach(n => { if (n === 2) return; out.push(n); });
console.log('  forEach "return" only skips:', out);
console.log('\n--- for..in walks the prototype chain ---');
const base = { inherited: 1 };
const child = Object.create(base); child.own = 2;
console.log('  for..in keys:', (()=>{ const k=[]; for (const key in child) k.push(key); return k; })());
console.log('  Object.keys :', Object.keys(child));
console.log('  for..in on array gives STRING indices:', (()=>{ const k=[]; for (const i in ['a','b']) k.push(typeof i + ':' + i); return k; })());
console.log('\n--- labelled break ---');
outer: for (const a of [1,2]) { for (const b of [1,2]) { if (b===2) continue outer; console.log(`  visit ${a},${b}`); } }
console.log('\n--- ASI hazards ---');
for (const src of ['function f(){ return\n  {a:1} }; JSON.stringify(f())',
                   'const a = 1\nconst b = 2\n;[a,b].forEach(()=>{})']) {
  try { console.log('  ok ->', eval(src)); } catch (e) { console.log('  ->', e.constructor.name+':', e.message); }
}
