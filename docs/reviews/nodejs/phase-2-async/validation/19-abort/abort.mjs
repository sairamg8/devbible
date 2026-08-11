import { setTimeout as sleep } from 'node:timers/promises';
const ac = new AbortController();
setTimeout(() => ac.abort(new Error('user cancelled')), 30);
try { await sleep(1000, null, { signal: ac.signal }); }
catch (e) { console.log('1 aborted →', e.name, '|', e.message, '| reason:', ac.signal.reason.message); }
const ac2 = new AbortController();
ac2.abort();
console.log('2 default reason →', ac2.signal.reason.name, '|', ac2.signal.reason.code);
try { await sleep(1000, null, { signal: AbortSignal.timeout(25) }); }
catch (e) { console.log('3 timeout →', e.name, '|', e.code); }
const user = new AbortController();
const combined = AbortSignal.any([user.signal, AbortSignal.timeout(5000)]);
setTimeout(() => user.abort(), 20);
try { await sleep(1000, null, { signal: combined }); }
catch (e) { console.log('4 any →', e.name, '| aborted:', combined.aborted); }
