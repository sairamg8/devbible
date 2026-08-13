// query.mjs
import express from 'express';

const app = express();
// default query parser on Express 5.2.1 is "simple"
app.get('/search', (req, res) => res.json(req.query));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const u =
    `http://127.0.0.1:${port}/search?a=1&a=2&a[b]=1&q=hello%20world`;
  console.log(await (await fetch(u)).json());
  server.close();
});
