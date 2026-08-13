// anatomy.mjs
import express from 'express';

const app = express();
app.post('/echo', (req, res) => {
  res.json({
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    hasCookieParser: typeof req.cookies,
  });
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(
    `http://127.0.0.1:${port}/echo?x=1`,
    {
      method: 'POST',
      headers: {'content-type': 'application/json', cookie: 'a=b'},
      body: '{"hi":true}',
    },
  );
  console.log(await res.json());
  server.close();
});
