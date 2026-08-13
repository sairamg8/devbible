// spa.mjs — pattern measured on Express 5.2.1
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-'));
fs.writeFileSync(path.join(dir, 'index.html'), '<html>hi</html>');

const app = express();
app.get('/api/ping', (req, res) => res.json({ok: true}));
app.use(express.static(dir));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(dir, 'index.html'));
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('api', await (await fetch(`${base}/api/ping`)).json());
  console.log('spa', (await (await fetch(`${base}/app/route`)).text()).slice(0, 20));
  server.close();
  fs.rmSync(dir, {recursive: true});
});
