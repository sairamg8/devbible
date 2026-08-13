// hang.mjs
import express from 'express';

const app = express();
app.use((req, res, next) => {
  if (req.url.startsWith('/hang')) return; // bug
  next();
});
app.get('/ok', (req, res) => res.send('ok'));

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log('ok', await (await fetch(`http://127.0.0.1:${port}/ok`)).text());
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 200);
  try {
    await fetch(`http://127.0.0.1:${port}/hang`, {signal: ac.signal});
  } catch {
    console.log('hang: client aborted (server never responded)');
  }
  server.close();
});
