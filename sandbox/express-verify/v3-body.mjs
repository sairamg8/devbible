import express from 'express';

const start = async (build) => {
  const app = express(); build(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  return {server, base: `http://127.0.0.1:${server.address().port}`};
};

// body size limit
{
  const {server, base} = await start((app) => {
    app.use(express.json({limit: '1kb'}));
    app.post('/', (req, res) => res.json({ok: true}));
    app.use((err, req, res, next) => res.status(err.status || 500)
      .json({type: err.type, message: err.message, status: err.status}));
  });
  const res = await fetch(`${base}/`, {method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({pad: 'x'.repeat(2000)})});
  console.log('size limit    :', res.status, await res.json());
  server.close();
}

// req.body without a parser
{
  const {server, base} = await start((app) => {
    app.post('/echo', (req, res) => res.json({body: req.body ?? null, typeofBody: typeof req.body}));
  });
  const res = await fetch(`${base}/echo`, {method: 'POST',
    headers: {'content-type': 'application/json'}, body: '{"a":1}'});
  console.log('no parser     :', await res.json());
  server.close();
}

// express.raw
{
  const {server, base} = await start((app) => {
    app.post('/hook', express.raw({type: '*/*'}), (req, res) =>
      res.json({isBuffer: Buffer.isBuffer(req.body), len: req.body.length}));
  });
  const res = await fetch(`${base}/hook`, {method: 'POST', body: 'hello, webhook'});
  console.log('express.raw   :', await res.json());
  server.close();
}

// malformed JSON
{
  const {server, base} = await start((app) => {
    app.use(express.json());
    app.post('/', (req, res) => res.json({ok: true}));
    app.use((err, req, res, next) => res.status(err.status || 500)
      .json({type: err.type, status: err.status, message: err.message.split('\n')[0]}));
  });
  const res = await fetch(`${base}/`, {method: 'POST',
    headers: {'content-type': 'application/json'}, body: '{bad json'});
  console.log('bad json      :', res.status, await res.json());
  server.close();
}
