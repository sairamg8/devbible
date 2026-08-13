import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { makeApp } from './express-app.mjs';

const app = makeApp();   // never .listen()ed

test('supertest boots the app on an ephemeral port for you', async () => {
  const res = await request(app).get('/health').expect(200);
  assert.deepStrictEqual(res.body, { ok: true });
});

test('supertest chained expectations', async () => {
  await request(app)
    .post('/users')
    .send({ name: 'Grace' })
    .expect('Content-Type', /json/)
    .expect('Location', '/users/7')
    .expect(201, { id: 7, name: 'Grace' });
});

test('a failed expectation shows the diff', async () => {
  await assert.rejects(
    () => request(app).post('/users').send({}).expect(201),
    (e) => { console.log('  supertest error:', e.message.split('\n')[0]); return true; },
  );
});
