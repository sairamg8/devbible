---
title: "Promise combinators"
sidebar_label: "09 · Combinators"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Four ways to wait for several promises. Picking the wrong one is how a single
slow dependency takes down a page that should have degraded gracefully.**

## The four, side by side

| | Settles when | On rejection | Returns |
|---|---|---|---|
| **`all`** | All fulfil | **Rejects immediately** on the first failure | array of values |
| **`allSettled`** | All settle | Never rejects | array of `{status, value \| reason}` |
| **`race`** | First to **settle** | Rejects if the first to settle rejected | that value or reason |
| **`any`** | First to **fulfil** | Rejects only if *all* reject, with `AggregateError` | that value |

The distinction that matters: `race` cares about the first to **settle**;
`any` cares about the first to **succeed**.

## All four, running

```js
// comb.mjs
import { setTimeout as sleep } from 'node:timers/promises';
const ok   = (v, ms) => sleep(ms).then(() => v);
const fail = (e, ms) => sleep(ms).then(() => { throw new Error(e); });

console.log('--- all: rejects on first failure ---');
try { await Promise.all([ok('a', 50), fail('boom', 20), ok('c', 10)]); }
catch (e) { console.log('caught:', e.message); }

console.log('--- allSettled: never rejects ---');
const settled = await Promise.allSettled([ok('a', 20), fail('boom', 10)]);
console.log(settled.map(r => r.status === 'fulfilled' ? `ok:${r.value}` : `err:${r.reason.message}`));

console.log('--- race: first to SETTLE, success or failure ---');
try { console.log('race won by:', await Promise.race([ok('slow', 50), fail('fast-fail', 10)])); }
catch (e) { console.log('race rejected with:', e.message); }

console.log('--- any: first to FULFILL, ignores rejections ---');
console.log('any won by:', await Promise.any([fail('nope', 10), ok('winner', 30)]));

console.log('--- any: all reject → AggregateError ---');
try { await Promise.any([fail('e1', 10), fail('e2', 20)]); }
catch (e) { console.log(e.constructor.name, '| errors:', e.errors.map(x => x.message)); }
```

```console
$ node comb.mjs
--- all: rejects on first failure ---
caught: boom
--- allSettled: never rejects ---
[ 'ok:a', 'err:boom' ]
--- race: first to SETTLE, success or failure ---
race rejected with: fast-fail
--- any: first to FULFILL, ignores rejections ---
any won by: winner
--- any: all reject → AggregateError ---
AggregateError | errors: [ 'e1', 'e2' ]
```

## Choosing

**`Promise.all` — "I need all of these, and any failure makes the whole thing
pointless."** A page that needs the user, their cart and the tax rate: if the cart
fails there is nothing to render.

```js
const [user, cart, taxRate] = await Promise.all([loadUser(id), loadCart(id), loadTax(region)]);
```

**`Promise.allSettled` — "collect everything, report what worked."** Fan-out where
partial success is a real answer: a dashboard of six widgets, a batch job over a
thousand records.

```js
const results = await Promise.allSettled(widgets.map(w => w.load()));
const failed = results.filter(r => r.status === 'rejected');
if (failed.length) log.warn(`${failed.length} widgets failed`, failed.map(f => f.reason));
```

**`Promise.race` — timeouts, and "whichever answers first."**

```js
// A timeout, though AbortSignal.timeout() is usually better
const result = await Promise.race([
  slowCall(),
  sleep(2000).then(() => { throw new Error('timed out'); }),
]);
```

**`Promise.any` — redundancy.** Three mirrors, two of which may be down; take the
first that actually works.

```js
const data = await Promise.any([fetchFrom(mirrorA), fetchFrom(mirrorB), fetchFrom(mirrorC)]);
```

## The part everyone gets wrong: nothing is cancelled

**`all` rejecting does not stop the other promises.** `race` resolving does not
stop the losers. There is no cancellation in the promise model — the other work
keeps running to completion, and its result is discarded.

```js
// leak.mjs — the timeout "wins" but the slow call keeps going
const slow = sleep(300).then(() => { console.log('slow call finished anyway'); return 'late'; });
try {
  await Promise.race([slow, sleep(50).then(() => { throw new Error('timeout'); })]);
} catch (e) { console.log('race threw:', e.message); }
await sleep(400);
```

```console
$ node leak.mjs
race threw: timeout
slow call finished anyway
```

Consequences:

- A "timed out" HTTP request still holds its socket until it completes.
- A racing database query still occupies a pool connection.
- Under load these accumulate, and the timeout that was meant to protect you makes
  resource exhaustion worse.

**The fix is `AbortSignal`**, which propagates a real cancellation into the
underlying operation. `race` is a way to stop *waiting*; it is not a way to stop
*working*. Covered in [cancellation](19-abortcontroller.md).

## Rejections in `all` are not lost

A common worry — if `all` rejects on the first failure, do the other rejections
become unhandled and crash the process?

```js
// floating2.mjs
const p1 = sleep(10).then(() => { throw new Error('first'); });
const p2 = sleep(20).then(() => { throw new Error('second'); });
try { await Promise.all([p1, p2]); } catch (e) { console.log('caught only:', e.message); }
await sleep(50);
console.log('still alive');
```

```console
$ node floating2.mjs
caught only: first
still alive
exit code 0
```

No crash. `Promise.all` attaches handlers to every input, so later rejections count
as handled. You only see the first one — the others are silently swallowed, which
is its own hazard when you are debugging.

Use `allSettled` when you need to see every failure.

## Gotchas

**Symptom:** One slow call makes an entire endpoint slow, even though the data is
optional
**Cause:** `Promise.all` waits for the slowest and fails on any error.
**Fix:** `allSettled`, and render what succeeded.

**Symptom:** A timeout fires but the resource is still held
**Cause:** `Promise.race` stops the waiting, not the work.
**Fix:** Pass an `AbortSignal` into the operation.

**Symptom:** Only one error is visible when several things failed
**Cause:** `Promise.all` reports the first rejection and discards the rest.
**Fix:** `allSettled` and inspect every `rejected` entry.

**Symptom:** `Promise.any` threw something that is not your error
**Cause:** When every input rejects it throws an `AggregateError`; the individual
errors are on `.errors`.
**Fix:** `catch (e) { e.errors.forEach(...) }`.

**Symptom:** `Promise.all` over thousands of items exhausts connections
**Cause:** It starts everything at once. `all` is not a concurrency limiter.
**Fix:** A bounded pool — [concurrency control](14-concurrency-control.md).

## Interview questions

**★ What is the difference between `Promise.race` and `Promise.any`?**
`race` settles with the first promise to **settle**, so a fast rejection makes it
reject. `any` settles with the first to **fulfil**, ignoring rejections, and only
rejects if all of them do — with an `AggregateError` carrying every reason. Use
`race` for timeouts, `any` for redundant sources.

**★ When would you use `allSettled` over `all`?**
When partial success is meaningful: a dashboard of independent widgets, a batch
job, any fan-out where one failure should not discard the other results.
`allSettled` never rejects, so you inspect each entry's `status` yourself.

**★ Does `Promise.race` cancel the losing promises?**
No. Promises have no cancellation. The losers keep running to completion and their
results are discarded, so a raced timeout still holds its socket or connection.
Real cancellation requires threading an `AbortSignal` into the underlying
operation.

**★ If `Promise.all` rejects, do the other rejections become unhandled?**
No. `all` attaches handlers to every input, so later rejections are considered
handled and will not crash the process. They are silently discarded — which is why
`allSettled` is better when you need to see them all.

**Why is `Promise.all` over 10,000 items dangerous?**
It starts all 10,000 immediately. It is a waiting primitive, not a concurrency
limiter, so it will open every socket or connection at once and exhaust the pool,
the file descriptor limit, or the remote service's rate limit.

---

← Prev: [async and await](08-async-await.md) · Next → [Sequential vs parallel](10-sequential-vs-parallel.md)
