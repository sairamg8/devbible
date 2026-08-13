// route-chain.mjs
import express from 'express';

const app = express();

app
  .route('/book')
  .get((req, res) => res.send('get book'))
  .post((req, res) => res.send('post book'))
  .put((req, res) => res.send('put book'));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('GET', await (await fetch(`${base}/book`)).text());
  console.log(
    'POST',
    await (await fetch(`${base}/book`, {method: 'POST'})).text(),
  );
  server.close();
});
