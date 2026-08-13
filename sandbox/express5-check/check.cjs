const express = require('express');
console.log('express', require('express/package.json').version);

// 1. does app.get('*') still work?
const app = express();
try { app.get('*', (req, res) => res.end('splat')); console.log("app.get('*')      -> accepted"); }
catch (e) { console.log("app.get('*')      -> THREW:", e.message.split('\n')[0]); }
try { app.get('/*splat', (req, res) => res.end('ok')); console.log("app.get('/*splat')-> accepted"); }
catch (e) { console.log("app.get('/*splat')-> THREW:", e.message.split('\n')[0]); }
try { app.get('/user/:id?', (req,res)=>res.end('ok')); console.log("app.get('/:id?')  -> accepted"); }
catch (e) { console.log("app.get('/:id?')  -> THREW:", e.message.split('\n')[0]); }

// 2. default query parser
const app2 = express();
console.log("default 'query parser' setting =", JSON.stringify(app2.get('query parser')));
console.log("default 'etag' =", JSON.stringify(app2.get('etag')), "| 'x-powered-by' =", app2.get('x-powered-by'), "| 'trust proxy' =", app2.get('trust proxy'));

const app3 = express();
app3.get('/q', (req, res) => res.json({ query: req.query, isArray: Array.isArray(req.query.a) }));
const srv = app3.listen(0, '127.0.0.1', async () => {
  const p = srv.address().port;
  for (const qs of ['a=1&a=2', 'a[b]=1', 'a[]=1&a[]=2']) {
    const r = await fetch(`http://127.0.0.1:${p}/q?${qs}`);
    console.log(qs.padEnd(12), '->', await r.text());
  }
  // 3. cookies without cookie-parser
  const app4 = express();
  app4.get('/c', (req, res) => res.json({ cookies: req.cookies ?? null, hasResCookie: typeof res.cookie }));
  const s4 = app4.listen(0, '127.0.0.1', async () => {
    const r = await fetch(`http://127.0.0.1:${s4.address().port}/c`, { headers: { Cookie: 'sid=1' } });
    console.log('cookies w/o cookie-parser ->', await r.text());
    s4.close(); srv.close();
  });
});
