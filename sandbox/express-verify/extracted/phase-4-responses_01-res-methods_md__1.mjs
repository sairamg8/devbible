// res-methods.mjs
import express from 'express';

const app = express();
app.get('/j', (req, res) => res.status(201).json({created: true}));
app.get('/s', (req, res) => res.status(200).send('plain'));
app.get('/r', (req, res) => res.redirect(302, '/j'));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('json', (await fetch(`${base}/j`)).status, await (await fetch(`${base}/j`)).json());
  console.log('send', await (await fetch(`${base}/s`)).text());
  const r = await fetch(`${base}/r`, {redirect: 'manual'});
  console.log('redirect', r.status, r.headers.get('location'));
  server.close();
});
