import express from 'express';
import http from 'node:http';
const app = express();
app.get('/r', (req, res) => res.json({v: 3}));
app.put('/r', (req, res) => res.json({ok: true}));
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const {port} = server.address();
const req = (method, headers) => new Promise((resolve) => {
  const r = http.request({host: '127.0.0.1', port, path: '/r', method, headers}, (res) => {
    let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({status: res.statusCode, body: b}));
  }); r.end();
});
console.log('PUT If-Match stale :', await req('PUT', {'if-match': 'W/"nope"'}));
console.log('GET If-Match stale :', await req('GET', {'if-match': 'W/"nope"'}));
server.close();
