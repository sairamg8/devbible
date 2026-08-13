// methods.mjs
import express from 'express';

const app = express();

app.get('/items', (req, res) => res.send('list'));
app.post('/items', (req, res) => res.send('create'));
app.put('/items/:id', (req, res) => res.send('replace'));
app.patch('/items/:id', (req, res) => res.send('patch'));
app.delete('/items/:id', (req, res) => res.send('delete'));
app.all('/ping', (req, res) => res.send(req.method));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;

  const postOnlyGet = await fetch(`${base}/items`, {method: 'POST'});
  console.log('POST /items', postOnlyGet.status, await postOnlyGet.text());

  const wrong = await fetch(`${base}/items`, {method: 'DELETE'});
  console.log('DELETE /items (no handler)', wrong.status);

  const ping = await fetch(`${base}/ping`, {method: 'OPTIONS'});
  console.log('all /ping OPTIONS', await ping.text());

  server.close();
});
