// object-graph.mjs
import express from 'express';
import http from 'node:http';

const app = express();
const users = express.Router();

users.get('/', (req, res) => {
  res.json({mountpath: req.baseUrl, path: req.path});
});

app.use('/users', users);

const server = http.createServer(app);
server.listen(0, async () => {
  const {port} = server.address();
  const r = await fetch(`http://127.0.0.1:${port}/users`);
  console.log(await r.json());
  console.log('server is http.Server:', server instanceof http.Server);
  console.log('app === users?', app === users);
  server.close();
});
