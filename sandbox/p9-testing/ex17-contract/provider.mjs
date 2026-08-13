import http from 'node:http';
export function createProvider({ drift = false } = {}) {
  return http.createServer((req, res) => {
    if (req.url === '/users/1') {
      const body = drift
        ? { id: 1, name: 'Ada', email: 'ada@example.com', created_at: '2026-01-01T00:00:00Z' }  // renamed
        : { id: 1, name: 'Ada', email: 'ada@example.com', createdAt: '2026-01-01T00:00:00Z' };
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(body));
    }
    res.writeHead(404).end();
  });
}
