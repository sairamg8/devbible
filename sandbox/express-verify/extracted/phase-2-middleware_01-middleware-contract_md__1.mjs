// contract.mjs
import express from 'express';

const app = express();

app.use((req, res, next) => {
  req.seen = ['A'];
  next();
});

app.use((req, res, next) => {
  req.seen.push('B');
  next();
});

app.get('/t', (req, res) => {
  res.json({seen: req.seen});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/t`)).json());
  server.close();
});
