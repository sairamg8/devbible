// malformed.mjs
import express from 'express';

const app = express();
app.use(express.json());
app.post('/echo', (req, res) => res.json(req.body));
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    type: err.type,
    message: err.message,
  });
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/echo`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: '{not json',
  });
  console.log(res.status, await res.json());
  server.close();
});
