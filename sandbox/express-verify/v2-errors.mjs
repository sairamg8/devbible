import express from 'express';

const run = async (build, path = '/boom', opts = {}) => {
  const app = express();
  build(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const {port} = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, opts);
    const text = await res.text();
    return {status: res.status, text};
  } finally { server.close(); }
};

// 1. async throw reaches error middleware (Express 5)
console.log('async throw   :', await run((app) => {
  app.get('/boom', async () => { throw new Error('async boom'); });
  app.use((err, req, res, next) => res.status(500).json({error: err.message}));
}));

// 2. async throw with NO error middleware -> default handler
console.log('no err mw     :', await run((app) => {
  app.get('/boom', async () => { throw new Error('async boom'); });
}));

// 3. next(err)
console.log('next(err)     :', await run((app) => {
  app.get('/boom', (req, res, next) => next(new Error('nope')));
  app.use((err, req, res, next) => res.status(500).send(err.message));
}));

// 4. sync throw
console.log('sync throw    :', await run((app) => {
  app.get('/boom', () => { throw new Error('sync boom'); });
  app.use((err, req, res, next) => res.status(500).send(err.message));
}));

// 5. unmatched route -> 404 shape
console.log('404 default   :', await run((app) => { app.get('/x', (q,s)=>s.end()); }, '/nope'));
