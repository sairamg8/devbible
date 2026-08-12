---
title: "Async testing done right — the await you forgot"
sidebar_label: "06 · Async testing"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. This page corrects a widely repeated claim —
> see below.

**The runner decides a test is over when the function it called settles.** Everything
that happens after that point is, from the runner's perspective, someone else's
problem. A missing `await` moves your assertion into that window.

## The widely repeated claim, and what actually happens

The folklore is that a forgotten `await` makes a test **pass silently**. On Node 24.19.0
that is **not true**, and the real behaviour is more useful to know:

```js
async function chargeCard() { throw new Error('gateway declined'); }

test('charges the card', async () => {
  const result = chargeCard();     // missing await
  assert.ok(result);               // a Promise is truthy — this passes
});
```

```console
✔ charges the card (1.6ms)
ℹ Error: Test "charges the card" generated asynchronous activity after the test ended.
  This activity created the error "Error: gateway declined" and would have caused the
  test to fail, but instead triggered an unhandledRejection event.
✖ trap2-alone.test.mjs (98.8ms)
ℹ tests 2
ℹ pass 1
ℹ fail 1
$ echo $?
1
```

Read that carefully, because three things are happening:

1. **The test itself reports `✔`.** Green tick, in the list, next to your other passes.
2. **The file reports `✖`** and the run exits **1**. Node noticed the orphaned
   rejection and attributed it to the file rather than the test.
3. The message names the test — so it is diagnosable, if you read past the ticks.

So CI does fail. But a developer scanning green ticks in a terminal sees a passing test,
and the failure is attached to a *file*, not a line. That is the trap: not silence,
**misattribution**.

## When it really is silent

Add a `catch` and every diagnostic disappears:

```js
test('handles a failure', async () => {
  const p = chargeCard();
  p.catch(() => {});               // swallowed
  assert.ok(true);
});
```

```console
✔ handles a failure (0.5ms)
ℹ pass 1
ℹ fail 0
```

No warning, no file failure, exit 0. Any `.catch()` intended to "keep the test tidy"
also deletes the runner's only evidence. The same applies to an assertion inside a
callback that never runs.

## The three correct shapes

```js
// 1. await it
test('rejects on a declined card', async () => {
  await assert.rejects(chargeCard, {message: 'gateway declined'});
});

// 2. return the promise — the runner awaits the return value
test('rejects on a declined card', () => {
  return assert.rejects(chargeCard, {message: 'gateway declined'});
});

// 3. await the call, assert on the caught error
test('rejects on a declined card', async () => {
  const err = await chargeCard().catch((e) => e);
  assert.equal(err.message, 'gateway declined');
});
```

All three verified passing. Shape 3 is the one to reach for when you want to assert on
several fields of a structured error:

```js
const err = await repo.create({sku: 'A'}).catch((e) => e);
assert.equal(err.code, '23505');
assert.equal(err.constraint, 'orders_sku_key');
```

## Never use `try/catch` to test a rejection

```js
// ✗ passes when nothing throws at all
test('rejects', async () => {
  try {
    await chargeCard();
  } catch (err) {
    assert.equal(err.message, 'gateway declined');
  }
});
```

If `chargeCard` stops throwing — the exact regression this test exists to catch — the
`catch` block never runs, no assertion executes, and the test passes. `assert.rejects`
fails with `Missing expected rejection` instead, which is the whole point.

If you must use `try/catch`, put an `assert.fail()` after the awaited call.

## Testing a callback API

Wrap it in a promise rather than using a `done` callback:

```js
import {promisify} from 'node:util';

test('reads the fixture', async () => {
  const data = await promisify(legacyRead)('fixture.json');
  assert.equal(data.version, 2);
});
```

`node:test` does support a callback argument, but a callback test that never calls
`done` fails only on timeout — a 30-second failure telling you nothing. Promises fail
immediately with a real stack.

## Timeouts

An async test that hangs blocks the suite. Bound it:

```js
test('finishes quickly', {timeout: 2000}, async () => { /* … */ });
```

```bash
node --test --test-timeout=5000
```

There is no default timeout in `node:test`, so an awaited promise that never settles
hangs until CI kills the job. Set `--test-timeout` in CI as a matter of course.

## Don't sleep — control the clock

```js
// ✗ slow and still racy
await new Promise((r) => setTimeout(r, 1100));
assert.equal(cache.get('k'), undefined);
```

```js
// ✅ instant and deterministic
test('the entry expires after an hour', (t) => {
  t.mock.timers.enable({apis: ['setTimeout', 'Date']});
  cache.set('k', 'v', {ttlMs: 3_600_000});
  t.mock.timers.tick(3_599_999);
  assert.equal(cache.get('k'), 'v');
  t.mock.timers.tick(1);
  assert.equal(cache.get('k'), undefined);
});
```

Full treatment on [page 07](./07-mocking.md).

## Concurrency inside a test

`Promise.all` in a test is fine and often the point — but assert on the *result*, not on
ordering:

```js
test('bulk insert is atomic', async () => {
  const results = await Promise.allSettled(
    skus.map((sku) => repo.create({sku})),
  );
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
});
```

`Promise.all` rejects on the first failure and leaves the rest running — which is
exactly the "asynchronous activity after the test ended" case. `allSettled` waits for
all of them.

## Gotchas

**Symptom:** A test shows `✔` but the run exits 1 and the *file* shows `✖`
**Cause:** A promise settled after the test function returned — a missing `await`.
**Fix:** Read the `generated asynchronous activity after the test ended` message; it
names the test. Add the `await`.

**Symptom:** A test genuinely passes when the code under test is broken
**Cause:** The orphaned promise was `.catch()`-ed, deleting the evidence.
**Fix:** Remove the swallowing `catch`; use `assert.rejects` or
`await fn().catch(e => e)`.

**Symptom:** A rejection test passes after the code stopped throwing
**Cause:** `try/catch` with the assertion inside `catch`, which never ran.
**Fix:** `await assert.rejects(...)`, or `assert.fail()` after the awaited call.

**Symptom:** The suite hangs on one test
**Cause:** An unsettled promise and no default timeout.
**Fix:** `--test-timeout=5000`, or `{timeout: …}` on the test.

**Symptom:** A callback test fails after 30 s with no useful message
**Cause:** `done` was never called on an error path.
**Fix:** `promisify` the API and await it.

**Symptom:** Intermittent "activity after the test ended" from a passing test
**Cause:** `Promise.all` rejected early, leaving siblings in flight.
**Fix:** `Promise.allSettled` when you need every one to finish.

## Interview questions

**★ What happens if you forget `await` on an async assertion?**
On Node 24.19.0 the test still prints `✔`, but the runner detects the late rejection,
prints `generated asynchronous activity after the test ended`, marks the **file**
failed and exits 1. It is misattribution rather than silence — and it becomes true
silence if the promise is `.catch()`-ed.

**★ Why is `try/catch` the wrong way to test a rejection?**
If the code stops throwing, the `catch` block never executes, no assertion runs, and
the test passes — failing exactly when it should alert you. `assert.rejects` reports
`Missing expected rejection`.

**★ How do you assert on several fields of a rejected error?**
`const err = await fn().catch(e => e)` then assert on `err.code`, `err.constraint` and
so on. A matcher function passed to `assert.rejects` also works, but it must
`return true` or the assertion fails even when the checks pass.

**★ Does `node:test` have a default timeout?**
No. An unsettled promise hangs until CI kills the job, so set `--test-timeout` in CI or
`{timeout}` per test.

**How do you test that something expires after an hour without waiting an hour?**
`t.mock.timers.enable({apis: ['setTimeout', 'Date']})` and `tick()` past the boundary —
and tick to one millisecond *before* it first, so you prove the boundary rather than
just the far side of it.

**Why prefer `Promise.allSettled` over `Promise.all` in a test?**
`all` rejects on the first failure and leaves siblings running past the end of the
test, which triggers the late-activity failure. `allSettled` waits for every one and
lets you assert on the mix of outcomes.

---

← Prev: [05 · API testing](./05-api-testing.md) ·
Next → [07 · Mocking](./07-mocking.md)
