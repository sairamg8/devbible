import http from 'node:http';

const users = new Map([[1, { id: 1, name: 'Ada' }]]);

export function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/users/1') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(users.get(1)));
    }
    if (req.method === 'POST' && url.pathname === '/users') {
      let body = '';
      req.on('data', (c) => { body += c; });
      return req.on('end', () => {
        const { name } = JSON.parse(body || '{}');
        if (!name) { res.writeHead(422, { 'content-type': 'application/json' }); return res.end('{"error":"name required"}'); }
        const id = users.size + 1;
        users.set(id, { id, name });
        res.writeHead(201, { 'content-type': 'application/json', location: `/users/${id}` });
        res.end(JSON.stringify({ id, name }));
      });
    }
    res.writeHead(404).end();
  });
}
