// error-mw.mjs
import express from 'express';

const app = express();
app.get('/boom', (req, res, next) => next(new Error('nope')));
app.use((req, res) => res.status(404).json({error: 'not found'}));
app.use((err, req, res, next) => {
  res.status(500).json({error: err.message});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/boom`)).json());
  server.close();
});
