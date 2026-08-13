import express from 'express';

const start = async (build) => {
  const app = express(); build(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  return {server, base: `http://127.0.0.1:${server.address().port}`};
};

// query parser default
{
  const {server, base} = await start((app) => {
    app.get('/q', (req, res) => res.json(req.query));
  });
  console.log('default parser:', express().get('query parser'));
  console.log('simple        :', await (await fetch(`${base}/q?a=1&a=2&a[b]=1`)).json());
  server.close();
}

// extended parser
{
  const {server, base} = await start((app) => {
    app.set('query parser', 'extended');
    app.get('/q', (req, res) => res.json(req.query));
  });
  console.log('extended      :', await (await fetch(`${base}/q?a=1&a=2&a[b]=1`)).json());
  server.close();
}

// double send
{
  const {server, base} = await start((app) => {
    app.get('/d', (req, res) => {
      res.send('first');
      try { res.send('second'); } catch (e) { console.log('double send   : caught ->', e.message); }
    });
  });
  const r = await fetch(`${base}/d`);
  console.log('double send   : client got ->', await r.text());
  server.close();
}

// Express 5 routing: wildcard and optional
for (const pattern of ['*', '/*splat', '/users/:id?', '/users/{:id}', '/files/*path']) {
  try { express().get(pattern, (q, s) => s.end()); console.log(`route ${JSON.stringify(pattern).padEnd(16)}: OK`); }
  catch (e) { console.log(`route ${JSON.stringify(pattern).padEnd(16)}: THROWS -> ${e.message}`); }
}
