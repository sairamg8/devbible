// raw.mjs
import express from 'express';

const app = express();
app.post(
  '/hook',
  express.raw({type: '*/*', limit: '1mb'}),
  (req, res) => {
    res.json({
      isBuffer: Buffer.isBuffer(req.body),
      len: req.body.length,
    });
  },
);

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/hook`, {
    method: 'POST',
    body: 'payload-bytes',
  });
  console.log(await res.json());
  server.close();
});
