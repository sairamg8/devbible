// json-parse.mjs
import express from 'express';

const app = express();
app.use(express.json());
app.post('/echo', (req, res) => res.json({body: req.body}));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;

  let res = await fetch(`${base}/echo`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({a: 1}),
  });
  console.log('json', await res.json());

  res = await fetch(`${base}/echo`, {
    method: 'POST',
    headers: {'content-type': 'text/plain'},
    body: JSON.stringify({a: 1}),
  });
  console.log('wrong type', await res.json());

  server.close();
});
