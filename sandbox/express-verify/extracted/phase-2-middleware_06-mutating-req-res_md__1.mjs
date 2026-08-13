// attach.mjs
import express from 'express';

const app = express();

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  req.ctx = {started: Date.now()};
  next();
});

app.use((req, res, next) => {
  res.on('finish', () => {
    const ms = Date.now() - req.ctx.started;
    console.log(req.requestId, req.method, req.url, res.statusCode, ms + 'ms');
  });
  next();
});

app.get('/t', (req, res) => {
  res.json({requestId: req.requestId});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log('body', await (await fetch(`http://127.0.0.1:${port}/t`)).json());
  server.close();
});
