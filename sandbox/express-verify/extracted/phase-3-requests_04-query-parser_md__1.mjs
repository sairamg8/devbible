// query-simple.mjs
import express from 'express';

const app = express();
console.log('default', app.get('query parser'));
app.get('/q', (req, res) => res.json(req.query));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const u = `http://127.0.0.1:${port}/q?a=1&a=2&a[b]=1`;
  console.log(await (await fetch(u)).json());
  server.close();
});
