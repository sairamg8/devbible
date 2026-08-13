import express from 'express';
const start = async (build) => {
  const app = express(); build(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  return {server, base: `http://127.0.0.1:${server.address().port}`};
};

const {server, base} = await start((app) => {
  app.get('/json', (req, res) => res.json({a: 1}));
  app.get('/send-str', (req, res) => res.send('hello'));
  app.get('/send-obj', (req, res) => res.send({a: 1}));
  app.get('/send-buf', (req, res) => res.send(Buffer.from('bin')));
  app.get('/status', (req, res) => res.sendStatus(418));
  app.get('/nocontent', (req, res) => res.status(204).end());
  app.get('/redirect', (req, res) => res.redirect('/json'));
});

for (const p of ['/json', '/send-str', '/send-obj', '/send-buf', '/status', '/nocontent']) {
  const r = await fetch(`${base}${p}`, {redirect: 'manual'});
  console.log(`${p.padEnd(11)} ${r.status}  ct=${r.headers.get('content-type')}  etag=${r.headers.get('etag')}  xpb=${r.headers.get('x-powered-by')}`);
}
const rr = await fetch(`${base}/redirect`, {redirect: 'manual'});
console.log(`/redirect   ${rr.status}  location=${rr.headers.get('location')}`);

// conditional request -> 304
const first = await fetch(`${base}/json`);
const etag = first.headers.get('etag');
const second = await fetch(`${base}/json`, {headers: {'if-none-match': etag}});
console.log(`conditional  ${second.status} (etag ${etag}) bodyLen=${(await second.text()).length}`);
server.close();
