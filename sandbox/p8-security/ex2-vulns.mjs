import path from 'node:path';
// ---- ReDoS ----
const evil = /^(a+)+$/;
for (const n of [20, 24, 26, 28]) {
  const input = 'a'.repeat(n) + '!';
  const t = performance.now();
  evil.test(input);
  console.log(`/^(a+)+$/ on ${n} chars -> ${Math.round(performance.now()-t)} ms`);
}
const emailish = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z\-])+\.)+([a-zA-Z]{2,4})+$/;
const bad = 'a'.repeat(40) + '@' + 'b'.repeat(40);
let t = performance.now(); emailish.test(bad);
console.log(`a common "email regex" on a 81-char non-match -> ${Math.round(performance.now()-t)} ms`);
// safe alternative
t = performance.now(); /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(bad);
console.log(`linear regex, same input -> ${(performance.now()-t).toFixed(3)} ms`);

// ---- prototype pollution ----
const merge = (target, source) => {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] ??= {};
      merge(target[key], source[key]);
    } else target[key] = source[key];
  }
  return target;
};
const userInput = JSON.parse('{"__proto__": {"isAdmin": true}}');
merge({}, userInput);
console.log('after merge, ({}).isAdmin =', ({}).isAdmin, '<- every object in the process');
console.log('an unrelated object:', {name: 'ada'}.isAdmin);
delete Object.prototype.isAdmin;
// the guards
console.log('JSON.parse alone is safe:', Object.getPrototypeOf(JSON.parse('{"__proto__":{"x":1}}')) === Object.prototype);
const safe = Object.create(null);
console.log('Object.create(null) has no prototype:', Object.getPrototypeOf(safe));
console.log('structuredClone drops __proto__:', JSON.stringify(structuredClone(JSON.parse('{"__proto__":{"x":1}}'))));

// ---- path traversal ----
const ROOT = '/srv/app/uploads';
const naive = (name) => path.join(ROOT, name);
console.log('join with ../../../etc/passwd ->', naive('../../../etc/passwd'));
const safe2 = (name) => {
  const p = path.resolve(ROOT, name);
  if (p !== ROOT && !p.startsWith(ROOT + path.sep)) throw new Error('outside root');
  return p;
};
for (const attempt of ['report.pdf', '../../../etc/passwd', 'a/../../../../etc/shadow']) {
  try { console.log(`  ${attempt.padEnd(28)} -> ${safe2(attempt)}`); }
  catch (e) { console.log(`  ${attempt.padEnd(28)} -> rejected: ${e.message}`); }
}
console.log('prefix check without sep is bypassable:', path.resolve('/srv/app/uploads-evil/x').startsWith('/srv/app/uploads'));
