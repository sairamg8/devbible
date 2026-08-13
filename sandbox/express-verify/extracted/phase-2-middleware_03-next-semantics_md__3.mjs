// double.mjs
import express from 'express';

const app = express();
app.get('/d', (req, res, next) => {
  res.send('first');
  next(); // bug
});
app.use((req, res) => {
  try {
    res.send('second');
  } catch (err) {
    console.log('error:', err.message);
  }
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log('body:', await (await fetch(`http://127.0.0.1:${port}/d`)).text());
  server.close();
});
