import { test, before, after } from 'node:test';
import http from 'node:http';

let server;
before(() => new Promise((res, rej) => {
  server = http.createServer((q, s) => s.end('ok'));
  server.once('error', rej);
  server.listen(3456, '127.0.0.1', res);       // hardcoded port
}));
after(() => new Promise((r) => server.close(r)));
test('serves', async () => { await fetch('http://127.0.0.1:3456'); });
