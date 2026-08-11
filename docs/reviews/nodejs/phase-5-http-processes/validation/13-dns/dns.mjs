import dns from 'node:dns/promises';
const t0=Date.now();
try {
  const a = await dns.lookup('localhost');
  console.log('lookup localhost', a, 'ms', Date.now()-t0);
  const t1=Date.now();
  const b = await dns.resolve4('one.one.one.one');
  console.log('resolve4', b[0], 'ms', Date.now()-t1);
} catch(e) { console.log(e); }
