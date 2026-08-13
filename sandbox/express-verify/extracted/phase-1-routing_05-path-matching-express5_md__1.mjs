// path-v5.mjs
import express from 'express';

const app = express();

function tryReg(label, path) {
  try {
    app.get(path, (req, res) => res.end('ok'));
    console.log(label, '→ accepted');
  } catch (err) {
    console.log(label, '→ THREW:', err.message.split('\n')[0]);
  }
}

tryReg("'*'", '*');
tryReg("'/*splat'", '/*splat');
tryReg("'/user/:id?'", '/user/:id?');
tryReg("'/users/:userId'", '/users/:userId');
