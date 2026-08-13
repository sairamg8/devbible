import express from 'express';

export function makeApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.post('/users', (req, res) => {
    if (!req.body?.name) return res.status(422).json({ error: 'name required' });
    res.status(201).location('/users/7').json({ id: 7, name: req.body.name });
  });
  return app;
}
