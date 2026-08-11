---
title: "Sequential vs parallel await"
sidebar_label: "10 · Sequential vs parallel"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). Every timing below is a real
> measurement from the script shown.

**The most common performance bug in Node applications, and the easiest to fix.
Three independent calls that should take 300ms take 900ms because someone wrote
`await` three times.**

## The bug

```js
// seq.mjs
import { setTimeout as sleep } from 'node:timers/promises';
const fetchUser = async (id) => { await sleep(300); return { id }; };

const t1 = Date.now();
const a = await fetchUser(1);
const b = await fetchUser(2);
const c = await fetchUser(3);
console.log('sequential:', Date.now() - t1, 'ms');

const t2 = Date.now();
const [x, y, z] = await Promise.all([fetchUser(1), fetchUser(2), fetchUser(3)]);
console.log('parallel  :', Date.now() - t2, 'ms');
```

```console
$ node seq.mjs
sequential: 902 ms
parallel  : 301 ms
```

**Three times slower for nothing.** The three calls do not depend on each other —
the second does not need the first's result — so waiting for each in turn is pure
waste.

## The test: does this line need the previous line's value?

That is the whole decision.

```js
// ❌ Sequential — but nothing here depends on anything else
const user = await loadUser(id);
const settings = await loadSettings(id);
const flags = await loadFlags(id);

// ✅ Parallel — all three start at once
const [user, settings, flags] = await Promise.all([
  loadUser(id),
  loadSettings(id),
  loadFlags(id),
]);
```

```js
// ✅ Sequential, and correctly so — each genuinely needs the one before
const user = await loadUser(id);
const org  = await loadOrg(user.orgId);       // needs user
const perms = await loadPerms(org.planId);    // needs org
```

Real code is usually a mix. Group what is independent, then await the groups:

```js
const [user, taxRate] = await Promise.all([loadUser(id), loadTax(region)]);
const cart = await loadCart(user.cartId);                 // needs user
const [items, coupons] = await Promise.all([              // both need cart
  loadItems(cart.id),
  loadCoupons(cart.id),
]);
```

## The `for` loop that should have been `Promise.all`

```js
// loop.mjs
const ids = [1, 2, 3, 4, 5];
const load = async (id) => { await sleep(200); return id * 10; };

let t = Date.now();
const slow = [];
for (const id of ids) slow.push(await load(id));
console.log('for-of with await :', Date.now() - t, 'ms', slow);

t = Date.now();
const fast = await Promise.all(ids.map(load));
console.log('map + Promise.all:', Date.now() - t, 'ms', fast);
```

```console
$ node loop.mjs
for-of with await : 1003 ms [ 10, 20, 30, 40, 50 ]
map + Promise.all: 201 ms [ 10, 20, 30, 40, 50 ]
```

Identical results, five times the speed. `map` + `Promise.all` also preserves
order — the output array matches the input order regardless of which finished
first.

**But do not reach for it blindly.** `Promise.all` over an array starts *every*
item at once. Five is fine; five thousand is an outage. Past a few dozen you need
a bounded pool — [concurrency control](14-concurrency-control.md).

## Starting early without `Promise.all`

Sometimes you want to kick work off, do something else, then collect:

```js
// Start both immediately — promises are eager
const userPromise = loadUser(id);
const cartPromise = loadCart(id);

renderShell();                    // synchronous work happens while both are in flight

const user = await userPromise;
const cart = await cartPromise;
```

This is parallel, despite the two separate `await`s, because **both promises were
created before either was awaited**. Creating a promise starts the work; `await`
only decides when you block on it.

The trap: if `loadUser` rejects before you reach `await cartPromise`, and
`cartPromise` also rejects, you get an unhandled rejection. `Promise.all` avoids
that by attaching handlers to everything up front — which is why it is the safer
default.

## When sequential is right

Parallel is not automatically better:

- **A dependency chain.** Each step needs the last. No choice.
- **Rate limits.** Hammering an API with 50 parallel requests earns a 429.
- **Write ordering.** Two updates to the same row must not race.
- **Memory.** 1,000 parallel file reads hold 1,000 buffers at once.

The goal is not "always parallel" — it is "parallel wherever there is no reason not
to be."

## Gotchas

**Symptom:** An endpoint's latency equals the sum of its dependencies
**Cause:** Sequential `await` on independent calls.
**Fix:** `Promise.all`. Latency drops to the slowest single call.

**Symptom:** `await` inside `forEach` does not wait
**Cause:** `forEach` ignores the returned promise.
**Fix:** `for...of` for sequential, `map` + `Promise.all` for parallel.

**Symptom:** `Promise.all` over a large array exhausts connections or memory
**Cause:** It starts everything simultaneously.
**Fix:** A bounded pool.

**Symptom:** Unhandled rejection when awaiting pre-started promises separately
**Cause:** One rejected before its `await` was reached, with no handler attached.
**Fix:** `Promise.all`, or attach `.catch()` at creation time.

**Symptom:** Parallelising made it slower
**Cause:** The work is CPU-bound, not I/O-bound — there is one thread, so parallel
promises do not help.
**Fix:** Worker threads. See [CPU-bound work](22-cpu-bound-work.md).

## Interview questions

**★ What is wrong with three consecutive `await`s on independent calls?**
Each one blocks until the previous finishes, so the total is the sum of all three
rather than the maximum. Since none of them needs the others' results, they should
start together with `Promise.all` and the total becomes the slowest single call.

**★ How do you decide between sequential and parallel?**
Ask whether the line needs the previous line's value. If yes, sequential is
required. If no, they are independent and should run concurrently. Most real
functions are a mix — group the independent calls and await the groups in order.

**★ Why does `map` + `Promise.all` preserve order?**
`Promise.all` resolves to an array positionally matching its input, regardless of
completion order. The third item is always at index 2 even if it finished first.

**★ Are these two the same?** `const a = await x(); const b = await y();` versus
`const p = x(); const q = y(); const a = await p; const b = await q;`
No. In the first, `y()` is not called until `x()` resolves — sequential. In the
second, both are started immediately and the awaits only collect results —
parallel. Promises are eager, so creation is what starts the work.

**When is parallel the wrong choice?**
Dependency chains, rate-limited APIs, writes that must be ordered, and anything
where holding all the results at once costs too much memory. It is also useless
for CPU-bound work, since there is only one thread.

---

← Prev: [Promise combinators](09-combinators.md) · Next → [Error handling with async/await](11-error-handling.md)
