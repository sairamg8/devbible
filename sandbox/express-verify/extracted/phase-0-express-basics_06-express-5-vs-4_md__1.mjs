// path-break.mjs
import express from 'express';

const app = express();

function tryPath(label, path) {
  try {
    app.get(path, (req, res) => res.end('ok'));
    console.log(label, '→ accepted');
  } catch (err) {
    console.log(label, '→ THREW:', err.message.split('\n')[0]);
  }
}

tryPath("app.get('*')", '*');
tryPath("app.get('/*splat')", '/*splat');
tryPath("app.get('/user/:id?')", '/user/:id?');
