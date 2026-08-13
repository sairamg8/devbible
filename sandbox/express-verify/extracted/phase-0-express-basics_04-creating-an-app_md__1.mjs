// create-app.mjs
import express from 'express';

const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({ok: true});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/health`);
  console.log(res.status, await res.json());
  server.close();
});
