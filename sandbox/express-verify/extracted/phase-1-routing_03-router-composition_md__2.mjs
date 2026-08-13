// nested.mjs
import express from 'express';

const comments = express.Router({mergeParams: true});
comments.get('/:commentId', (req, res) => {
  res.json(req.params);
});

const app = express();
app.use('/posts/:postId/comments', comments);

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(
    `http://127.0.0.1:${port}/posts/1/comments/2`,
  );
  console.log(await res.json());
  server.close();
});
