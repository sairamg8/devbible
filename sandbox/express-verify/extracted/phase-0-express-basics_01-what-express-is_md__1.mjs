// what-express-is.mjs
import express from 'express';

const app = express();

console.log('express export is a function:', typeof express === 'function');
console.log('app is a function (request listener):', typeof app === 'function');
console.log('app.handle exists:', typeof app.handle === 'function');
