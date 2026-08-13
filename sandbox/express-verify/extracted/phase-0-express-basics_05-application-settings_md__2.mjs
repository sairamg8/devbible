// harden-basics.mjs
import express from 'express';

const app = express();
app.disable('x-powered-by');
// app.set('trust proxy', 1);  // when behind one reverse proxy — Phase 9
// app.set('query parser', 'extended'); // only if you need nested query objects

console.log('x-powered-by', app.get('x-powered-by'));
