// factory.mjs
import express from 'express';

function requireHeader(name) {
  return function requireHeaderMiddleware(req, res, next) {
    if (!req.get(name)) {
      res.status(400).send('missing ' + name);
      return;
    }
    next();
  };
}

const app = express();
app.get('/x', requireHeader('x-api-key'), (req, res) => res.send('ok'));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('no key', (await fetch(`${base}/x`)).status);
  console.log(
    'key',
    await (
      await fetch(`${base}/x`, {headers: {'x-api-key': '1'}})
    ).text(),
  );
  server.close();
});
