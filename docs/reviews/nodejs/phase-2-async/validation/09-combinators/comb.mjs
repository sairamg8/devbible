const delay = (ms, v, fail) => new Promise((res, rej) => setTimeout(() => fail ? rej(new Error(v)) : res(v), ms));
const r1 = await Promise.allSettled([delay(10,'a'), delay(5,'b',true)]);
console.log('allSettled', r1.map(x => x.status));
try { await Promise.all([delay(10,'a'), delay(5,'b',true)]); } catch(e) { console.log('all reject', e.message); }
const race = await Promise.race([delay(30,'slow'), delay(5,'fast')]);
console.log('race', race);
try { await Promise.any([delay(5,'x',true), delay(5,'y',true)]); } catch(e) { console.log('any AggregateError', e.name); }
