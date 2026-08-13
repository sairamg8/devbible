// double-res.mjs
import express from 'express';

const app = express();
app.get('/d', (req, res, next) => {
  res.json({a: 1});
  next();
});
app.use((req, res) => {
  try {
    res.json({b: 2});
  } catch (err) {
    console.log('error:', err.message);
  }
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log('body', await (await fetch(`http://127.0.0.1:${port}/d`)).json());
  server.close();
});
