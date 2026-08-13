import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from './app.mjs';

let server, base;

before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
  console.log(`  ephemeral port: ${port}`);
});

after(() => new Promise((r) => server.close(r)));

test('GET /users/1', async () => {
  const res = await fetch(`${base}/users/1`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.deepStrictEqual(await res.json(), { id: 1, name: 'Ada' });
});

test('POST /users creates and returns Location', async () => {
  const res = await fetch(`${base}/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Grace' }),
  });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('location'), '/users/2');
  assert.deepStrictEqual(await res.json(), { id: 2, name: 'Grace' });
});

test('POST /users rejects a missing name', async () => {
  const res = await fetch(`${base}/users`, { method: 'POST', body: '{}' });
  assert.equal(res.status, 422);
});
