// routers.mjs
import express from 'express';

const users = express.Router();
users.get('/', (req, res) => {
  res.json({baseUrl: req.baseUrl, path: req.path, url: req.url});
});
users.get('/:id', (req, res) => {
  res.json({id: req.params.id, baseUrl: req.baseUrl});
});

const app = express();
app.use('/api/users', users);

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log(await (await fetch(`${base}/api/users`)).json());
  console.log(await (await fetch(`${base}/api/users/7`)).json());
  server.close();
});
