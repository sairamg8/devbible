// param.mjs
import express from 'express';

const app = express();
const items = express.Router();

const db = new Map([['42', {id: '42', name: 'Widget'}]]);

items.param('id', (req, res, next, id) => {
  const row = db.get(id);
  if (!row) {
    res.status(404).json({error: 'not found'});
    return; // do not next()
  }
  req.item = row;
  next();
});

items.get('/:id', (req, res) => {
  res.json({item: req.item});
});

items.get('/:id/edit', (req, res) => {
  res.json({editing: req.item});
});

app.use('/items', items);

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('ok', await (await fetch(`${base}/items/42`)).json());
  console.log('edit', await (await fetch(`${base}/items/42/edit`)).json());
  console.log('missing', (await fetch(`${base}/items/99`)).status);
  server.close();
});
