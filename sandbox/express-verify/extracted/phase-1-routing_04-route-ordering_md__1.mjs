// order.mjs
import express from 'express';

function withOrder(label, register) {
  const app = express();
  register(app);
  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const {port} = server.address();
      const text = await (
        await fetch(`http://127.0.0.1:${port}/users/export`)
      ).text();
      console.log(label, '→', text);
      server.close();
      resolve();
    });
  });
}

await withOrder('static first', (app) => {
  app.get('/users/export', (req, res) => res.send('export'));
  app.get('/users/:id', (req, res) => res.send('id=' + req.params.id));
});

await withOrder('param first', (app) => {
  app.get('/users/:id', (req, res) => res.send('id=' + req.params.id));
  app.get('/users/export', (req, res) => res.send('export'));
});
