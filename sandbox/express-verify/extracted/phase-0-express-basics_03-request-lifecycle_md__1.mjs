// lifecycle.mjs
import express from 'express';

const app = express();

app.use((req, res, next) => {
  console.log('1 middleware', req.method, req.url);
  next();
});

app.get('/ok', (req, res) => {
  console.log('2 handler');
  res.status(200).json({ok: true});
});

app.use((req, res) => {
  console.log('3 404');
  res.status(404).json({error: 'not found'});
});

app.use((err, req, res, next) => {
  console.log('4 error', err.message);
  res.status(500).json({error: err.message});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('status', (await fetch(`${base}/ok`)).status);
  console.log('status', (await fetch(`${base}/missing`)).status);
  server.close();
});
