import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

test('mock.fn — calls, arguments, return', (t) => {
  const send = t.mock.fn((to, body) => `sent:${to}`);
  send('ada@example.com', 'hi');
  send('bob@example.com', 'yo');

  assert.equal(send.mock.callCount(), 2);
  assert.deepStrictEqual(send.mock.calls[0].arguments, ['ada@example.com', 'hi']);
  assert.equal(send.mock.calls[0].result, 'sent:ada@example.com');
  assert.equal(send.mock.calls[0].error, undefined);
});

const mailer = {
  send(to) { throw new Error('real SMTP call!'); },
};

test('mock.method — replaces on a real object, auto-restored', (t) => {
  t.mock.method(mailer, 'send', () => 'ok');
  assert.equal(mailer.send('x'), 'ok');
  assert.equal(mailer.send.mock.callCount(), 1);
});

test('after the previous test, the real method is back', () => {
  assert.throws(() => mailer.send('x'), /real SMTP call/);
  assert.equal(mailer.send.mock, undefined);
});

test('mockImplementationOnce', (t) => {
  const fn = t.mock.fn(() => 'default');
  fn.mock.mockImplementationOnce(() => 'first');
  assert.equal(fn(), 'first');
  assert.equal(fn(), 'default');
});

test('mock timers — setTimeout under control', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let fired = false;
  setTimeout(() => { fired = true; }, 60_000);
  assert.equal(fired, false);
  t.mock.timers.tick(59_999);
  assert.equal(fired, false);
  t.mock.timers.tick(1);
  assert.equal(fired, true);
});

test('mock timers — Date', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2020-01-01T00:00:00Z') });
  assert.equal(new Date().toISOString(), '2020-01-01T00:00:00.000Z');
  t.mock.timers.tick(86_400_000);
  assert.equal(new Date().toISOString(), '2020-01-02T00:00:00.000Z');
});

test('real clock is back', () => {
  assert.ok(Date.now() > 1.7e12);
});
