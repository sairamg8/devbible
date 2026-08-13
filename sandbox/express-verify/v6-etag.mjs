import express from 'express';
import http from 'node:http';

const app = express();
app.get('/json', (req, res) => res.json({a: 1}));
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const {port} = server.address();

const req = (headers = {}) => new Promise((resolve) => {
  http.get({host: '127.0.0.1', port, path: '/json', headers}, (res) => {
    let body = ''; res.on('data', (c) => (body += c));
    res.on('end', () => resolve({status: res.statusCode, etag: res.headers.etag, body}));
  });
});

const a = await req();
console.log('1st          :', a.status, a.etag, JSON.stringify(a.body));
const b = await req({'if-none-match': a.etag});
console.log('if-none-match:', b.status, JSON.stringify(b.body));
const c = await req({'if-none-match': 'W/"nope"'});
console.log('wrong etag   :', c.status, JSON.stringify(c.body));
console.log('app etag set :', JSON.stringify(app.get('etag')));
server.close();
