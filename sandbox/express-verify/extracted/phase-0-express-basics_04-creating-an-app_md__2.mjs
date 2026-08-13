// create-server.mjs
import express from 'express';
import http from 'node:http';

const app = express();
app.get('/health', (req, res) => res.json({ok: true}));

const server = http.createServer(app);
server.listen(0, () => {
  console.log('port', server.address().port);
  server.close();
});
