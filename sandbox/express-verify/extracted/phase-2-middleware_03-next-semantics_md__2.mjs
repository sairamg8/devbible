// next-err.mjs
import express from 'express';

const app = express();
app.get('/e', (req, res, next) => next(new Error('nope')));
app.use((err, req, res, next) => {
  res.status(500).send(err.message);
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/e`)).text());
  server.close();
});
