// params.mjs
import express from 'express';

const app = express();

app.get('/users/:userId/books/:bookId', (req, res) => {
  res.json({params: req.params, path: req.path});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(
    `http://127.0.0.1:${port}/users/u1/books/b9?verbose=1`,
  );
  console.log(await res.json());
  server.close();
});
