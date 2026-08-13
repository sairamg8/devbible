// order-mw.mjs
import express from 'express';

const app = express();
const log = (label) => (req, res, next) => {
  req.trace = (req.trace || []).concat(label);
  next();
};

app.use(log('app'));

const api = express.Router();
api.use(log('router'));
api.get('/item', log('route'), (req, res) => {
  res.json({trace: req.trace});
});

app.use('/api', api);

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/api/item`)).json());
  server.close();
});
