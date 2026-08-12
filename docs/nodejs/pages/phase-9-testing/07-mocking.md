---
title: "Mocking — mock.fn, mock.method and mock timers"
sidebar_label: "07 · Mocking"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**.

**`node:test` has a mocking API built in.** `mock.fn` for functions you pass around,
`mock.method` for methods on an object you cannot pass around, and `mock.timers` for
time. No dependency, no configuration.

## `t.mock` versus the top-level `mock`

This distinction decides whether your mocks leak, so take it first.

```js
import {test, mock} from 'node:test';   // top-level: you restore it
                                        // t.mock:    restored for you
```

Measured:

```js
const clock = {now() { return 'REAL'; }};

test('top-level mock.method', () => {
  mock.method(clock, 'now', () => 'FAKE');
  assert.equal(clock.now(), 'FAKE');
});

test('is it restored?', () => {
  console.log('  clock.now() =', clock.now());   // FAKE  ← leaked
});
```

```console
  clock.now() = FAKE
```

With `t.mock` the next test sees the real method again, and `obj.method.mock` is
`undefined`:

```js
test('mock.method — auto-restored', (t) => {
  t.mock.method(mailer, 'send', () => 'ok');
  assert.equal(mailer.send('x'), 'ok');
});

test('the real method is back', () => {
  assert.throws(() => mailer.send('x'), /real SMTP call/);
  assert.equal(mailer.send.mock, undefined);
});
```

Both verified. **Use `t.mock` unless you have a specific reason not to** — and if you
use the top-level `mock`, call `mock.restoreAll()` in `afterEach` yourself.

## `mock.fn` — a function you can interrogate

```js
test('notifies every subscriber once', (t) => {
  const send = t.mock.fn((to, body) => `sent:${to}`);

  notifyAll(['ada@example.com', 'bob@example.com'], 'hi', send);

  assert.equal(send.mock.callCount(), 2);
  assert.deepStrictEqual(send.mock.calls[0].arguments, ['ada@example.com', 'hi']);
  assert.equal(send.mock.calls[0].result, 'sent:ada@example.com');
  assert.equal(send.mock.calls[0].error, undefined);
});
```

Each entry in `mock.calls` carries `arguments`, `result`, `error`, `target` and
`this`. The implementation passed to `mock.fn` is optional — with none, it returns
`undefined` and only records.

Vary the behaviour per call:

```js
const fetchRate = t.mock.fn(() => 1.10);            // default
fetchRate.mock.mockImplementationOnce(() => { throw new Error('timeout'); });

assert.throws(fetchRate);        // first call
assert.equal(fetchRate(), 1.10); // subsequent calls
```

Both verified. `mock.resetCalls()` clears the record without changing the
implementation; `mock.restore()` puts the original back.

## `mock.method` — for objects you do not control

```js
test('retries a failed send', async (t) => {
  const send = t.mock.method(mailer, 'send');
  send.mock.mockImplementationOnce(() => { throw new Error('smtp down'); });

  await deliverWithRetry(mailer, message);

  assert.equal(send.mock.callCount(), 2);
});
```

Called with two arguments it **spies** — the original still runs and calls are recorded.
With a third argument it **stubs**. Spying is the safer default when the real behaviour
is harmless.

`t.mock.getter` and `t.mock.setter` do the same for accessor properties.

## Mock timers

The reason tests that "wait a second" should not exist.

```js
test('the entry expires after an hour', (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});

  let fired = false;
  setTimeout(() => { fired = true; }, 60_000);

  assert.equal(fired, false);
  t.mock.timers.tick(59_999);
  assert.equal(fired, false);     // one ms before — still not fired
  t.mock.timers.tick(1);
  assert.equal(fired, true);
});
```

Verified. Ticking to one millisecond **before** the boundary and then over it is what
makes this a test of the boundary rather than of the far side of it.

Freeze the clock too:

```js
test('stamps the created date', (t) => {
  t.mock.timers.enable({apis: ['Date'], now: new Date('2020-01-01T00:00:00Z')});
  assert.equal(new Date().toISOString(), '2020-01-01T00:00:00.000Z');

  t.mock.timers.tick(86_400_000);
  assert.equal(new Date().toISOString(), '2020-01-02T00:00:00.000Z');
});
```

Available `apis`: `setTimeout`, `setInterval`, `setImmediate`, `Date`, and the
`node:timers` and `node:timers/promises` equivalents. Enable only what you need —
faking `Date` when you meant `setTimeout` breaks any logging in the code under test.

Other controls: `t.mock.timers.runAll()` fires every pending timer immediately;
`t.mock.timers.reset()` restores the real ones early. With `t.mock` both happen
automatically at the end of the test, and the real clock was verified back afterwards.

**Mock timers and real I/O do not mix.** If the code under test awaits a database
query while `setTimeout` is faked, the query's own internal timeouts are faked too.
Fake time for pure logic; use a real (short) delay or restructure for anything doing
I/O.

## Mocking `fetch`

`fetch` is a global, so `mock.method` reaches it:

```js
test('maps an upstream 500 to a 502', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    new Response('upstream boom', {status: 500}));

  const err = await callUpstream().catch((e) => e);
  assert.equal(err.status, 502);
});
```

Fine for a unit test of your error mapping. For anything about the *request* — headers,
retries, timeouts — prefer a real ephemeral server ([page 05](./05-api-testing.md)); a
stubbed `fetch` cannot tell you that your `AbortSignal` works.

## Gotchas

**Symptom:** A stub is still active in the next test
**Cause:** The top-level `mock` was used; only `t.mock` auto-restores. Reproduced.
**Fix:** Use `t.mock`, or `mock.restoreAll()` in `afterEach`.

**Symptom:** `obj.method.mock` is `undefined` mid-test
**Cause:** Reading it after `restore()`, or on a method that was never mocked.
**Fix:** Keep the handle returned by `mock.method` and use that.

**Symptom:** The whole suite hangs after enabling mock timers
**Cause:** Real I/O is awaited while its timers are faked, so nothing ever fires.
**Fix:** Enable only the APIs you need, and do not fake time around real I/O.

**Symptom:** A test asserts a timer fired but nothing happened
**Cause:** `tick()` was called with less than the delay, or the timer was scheduled
before `enable()`.
**Fix:** Enable first, then schedule; tick the full duration.

**Symptom:** Timestamps in logs jump to 1970
**Cause:** `apis: ['Date']` without a `now`.
**Fix:** Pass `now: new Date(...)`.

**Symptom:** The mock records zero calls
**Cause:** The code under test captured the original reference before the mock replaced
it — a module-scope `const send = mailer.send`.
**Fix:** Call through the object, or inject the dependency
([page 04](./04-testable-code.md)).

## Interview questions

**★ What is the difference between `t.mock` and the top-level `mock`?**
`t.mock` restores everything it touched when the test ends; the top-level `mock` does
not. Measured: a top-level `mock.method` was still returning the fake in the following
test. Use `t.mock`, or `mock.restoreAll()` in `afterEach`.

**★ How do you test something that happens in an hour?**
`t.mock.timers.enable({apis: ['setTimeout']})` then `tick()`. Tick to one millisecond
before the boundary and assert it has *not* fired, then tick once more — otherwise you
have tested that an hour is "sometime later", not that it is an hour.

**★ What does `mock.fn` record?**
`callCount()` and a `calls` array where each entry has `arguments`, `result`, `error`,
`this` and `target`. `mockImplementationOnce` varies behaviour per call;
`resetCalls()` clears history without changing behaviour.

**★ When is `mock.method` spying rather than stubbing?**
With two arguments it spies — the original runs and calls are recorded. A third
argument replaces the implementation. Spy when the real behaviour is harmless; you get
observability without changing what happens.

**Why might a mock record zero calls even though the code ran?**
The code captured the original function reference before the mock was installed. Mocks
replace a property on an object; a copied reference is unaffected. Call through the
object or inject the dependency.

**When should you not mock `fetch`?**
When the test is about the request rather than the response mapping — headers, retries,
timeouts, aborts. A stub returns whatever you tell it, so it cannot show that your
timeout handling works. Use a real ephemeral server.

---

← Prev: [06 · Async testing](./06-async-testing.md) ·
Next → [08 · Module mocking](./08-module-mocking.md)
