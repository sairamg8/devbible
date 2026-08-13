console.log('--- % with negatives (remainder, NOT modulo) ---');
for (const [a,b] of [[7,3],[-7,3],[7,-3],[-7,-3]]) console.log(`  ${a} % ${b} = ${a % b}`);
console.log('  true modulo: ((-7 % 3) + 3) % 3 =', ((-7 % 3) + 3) % 3);
console.log('\n--- integer division ---');
console.log('  7 / 2 =', 7/2, '| Math.trunc =', Math.trunc(7/2), '| Math.floor(-7/2) =', Math.floor(-7/2), '| Math.trunc(-7/2) =', Math.trunc(-7/2));
console.log('\n--- ** is right-associative ---');
console.log('  2 ** 3 ** 2 =', 2 ** 3 ** 2, '(= 2**9, not 8**2=64)');
try { eval('-2 ** 2'); } catch(e) { console.log('  -2 ** 2 ->', e.constructor.name+':', e.message); }
console.log('  (-2) ** 2 =', (-2) ** 2);
console.log('\n--- increment ---');
let i = 5; console.log('  i++ returns', i++, 'then i =', i);
let j = 5; console.log('  ++j returns', ++j, 'then j =', j);
console.log('\n--- logical assignment short-circuits the WRITE ---');
const obj = { a: 1 };
let writes = 0;
const tracked = { get b() { return 1; }, set b(v) { writes++; } };
tracked.b ||= 2;   // b is 1 (truthy) -> no write
console.log('  ||= on truthy getter, writes =', writes);
tracked.b ??= 2;   // b is 1 (not nullish) -> no write
console.log('  ??= on non-nullish, writes  =', writes);
