console.log('--- logical operators return OPERANDS, not booleans ---');
console.log("  'a' && 'b'      =", JSON.stringify('a' && 'b'));
console.log("  0 && 'b'        =", JSON.stringify(0 && 'b'));
console.log("  '' || 'fallback'=", JSON.stringify('' || 'fallback'));
console.log("  null ?? 0       =", JSON.stringify(null ?? 0));
console.log("  0 ?? 'f'        =", JSON.stringify(0 ?? 'f'));
console.log('\n--- ?? cannot be mixed with || or && unparenthesised ---');
for (const src of ['null ?? 1 || 2', '(null ?? 1) || 2', 'null ?? (1 || 2)', 'true && 1 ?? 2']) {
  try { console.log(`  ${src.padEnd(20)} = ${eval(src)}`); }
  catch (e) { console.log(`  ${src.padEnd(20)} -> ${e.constructor.name}`); }
}
console.log('\n--- optional chaining ---');
const user = { profile: { name: 'A' }, getName() { return 'A'; } };
const empty = {};
console.log('  user?.profile?.name      =', user?.profile?.name);
console.log('  empty?.profile?.name     =', empty?.profile?.name);
console.log('  empty.profile?.name      =', empty.profile?.name);
try { empty.profile.name; } catch (e) { console.log('  empty.profile.name       ->', e.constructor.name+':', e.message); }
console.log('  user.getName?.()         =', user.getName?.());
console.log('  user.missing?.()         =', user.missing?.());
try { user.notAFunction?.(); } catch(e){ console.log('  err', e.message); }
const nf = { notAFunction: 42 };
try { nf.notAFunction?.(); } catch (e) { console.log('  nf.notAFunction?.()      ->', e.constructor.name+':', e.message, '<- ?. does NOT protect this'); }
console.log('\n--- short-circuit stops the whole chain ---');
let called = 0; const side = () => { called++; return 1; };
const r = empty?.a?.[side()];
console.log('  empty?.a?.[side()] =', r, '| side() called', called, 'times');
