---
title: "async and await"
sidebar_label: "08 · async and await"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Promises with the plumbing hidden. The one thing to internalise: `await` yields
to the microtask queue, not to the event loop.**

## What the keywords actually do

`async` on a function does two things: it makes the function return a promise, and
it permits `await` inside.

```js
// basics.mjs
async function get() { return 42; }
async function fail() { throw new Error('boom'); }

console.log(get());                       // a Promise, not 42
console.log(await get());                 // 42
console.log(await get().then(v => v + 1)); // async functions are just promises

try { await fail(); } catch (e) { console.log('threw →', e.message); }
```

```console
$ node basics.mjs
Promise { 42 }
42
43
threw → boom
```

A `return` inside an `async` function fulfils its promise; a `throw` rejects it.
That is the whole mapping — `async`/`await` adds no new capability over promises,
only readable syntax for the same machinery.

## `await` yields to microtasks, not to the loop

The single most consequential detail:

```js
// awaits.cjs
console.log('1');
(async () => {
  console.log('2 — body runs synchronously up to the first await');
  await null;                       // yields here
  console.log('4 — resumed as a microtask');
})();
setTimeout(() => console.log('5 — a whole loop phase later'), 0);
console.log('3');
```

```console
$ node awaits.cjs
1
2 — body runs synchronously up to the first await
3
4 — resumed as a microtask
5 — a whole loop phase later
```

Two lessons in that output:

- **An async function body runs synchronously until the first `await`.** Calling it
  is not "scheduling it for later" — the code before the first `await` executes
  immediately, on the current stack.
- **The resumption is a microtask**, so it happens before any timer or I/O. The
  event loop never got a turn between `3` and `4`.

Which is why `await` is not a yield. A loop that awaits already-resolved values
never lets the loop run:

```js
// no-yield.mjs — this still blocks the loop
for (const item of tenMillionItems) {
  await process(item);        // if process() is synchronous inside, nothing yields
}
```

The fix is a real phase yield — `await setImmediate()` from
`node:timers/promises`. See [page 04](04-setimmediate-vs-settimeout.md) and
[CPU-bound work](22-cpu-bound-work.md).

## `await` accepts any thenable — including non-promises

```js
// thenable.mjs
console.log(await 42);                                  // 42 — wrapped, still costs a microtask
console.log(await { then(res) { res('custom thenable'); } });
```

```console
$ node thenable.mjs
42
custom thenable
```

`await someValue` on a non-promise still defers to a microtask. That is occasionally
useful (`await null` as a cheap yield to microtasks) and occasionally a surprise in
hot code.

## Where `async`/`await` beats chaining

Branching and intermediate values are where `.then` gets ugly and `await` stays
flat:

```js
// Readable with await
async function checkout(userId) {
  const user = await loadUser(userId);
  if (!user.active) return { status: 'inactive' };

  const cart = await loadCart(userId);
  const total = await price(cart, user.discountTier);   // needs BOTH earlier values
  return { status: 'ok', total };
}
```

The same thing with `.then` requires either nesting or threading an accumulator
object through every step, because each stage needs values from two stages back.

**But note the cost in that example:** `loadUser` and `loadCart` do not depend on
each other and are still sequential. That is the most common performance bug in
async code, and it has its own page —
[sequential vs parallel](10-sequential-vs-parallel.md).

## Top-level `await`

In an ES module you can `await` outside any function:

```js
// tla.mjs
const config = JSON.parse(await readFile('config.json', 'utf8'));
export const port = config.port;
```

Everything importing this module waits for it. That is the feature and the cost —
see [Phase 1](../phase-1-modules/01-esm.md). It also makes the module impossible
to `require()` from CommonJS.

## Gotchas

**Symptom:** An async function's early code runs sooner than expected
**Cause:** The body runs synchronously up to the first `await`. Calling an async
function is not deferring it.
**Fix:** Expected behaviour. If you need it deferred, `await null` first, or
schedule it.

**Symptom:** Adding `await` inside a hot loop did not make the server responsive
**Cause:** `await` yields to the microtask queue, which drains before the loop
advances.
**Fix:** `await setImmediate()` from `node:timers/promises`.

**Symptom:** `await` inside `forEach` does nothing
**Cause:** `Array.prototype.forEach` ignores the returned promise, so the callback
is fire-and-forget.
**Fix:** `for...of` for sequential, `Promise.all(items.map(fn))` for parallel. See
[anti-patterns](17-promise-antipatterns.md).

**Symptom:** A function marked `async` returns a promise where callers expected a
value
**Cause:** `async` always wraps the return value in a promise.
**Fix:** Await it at the call site, or do not mark the function `async` if it has
nothing to await.

**Symptom:** `SyntaxError: await is only valid in async functions`
**Cause:** `await` used at top level in a CommonJS file, where top-level await
does not exist.
**Fix:** Convert to ESM, or wrap in an async IIFE.

## Interview questions

**★ What does `await` actually yield to?**
The microtask queue. The async function body runs synchronously up to the first
`await`, then the continuation is queued as a microtask. It does not give the
event loop a chance to run timers or I/O, which is why awaiting in a loop over
synchronous work still blocks the thread.

**★ What does marking a function `async` do?**
It makes the function return a promise — fulfilled with the return value, rejected
with anything thrown — and allows `await` inside. It adds no capability beyond
promises; it is syntax over the same machinery.

**★ Does calling an async function defer its work?**
No. Everything before the first `await` runs synchronously on the calling stack.
Only the code after the first `await` is deferred.

**★ Why does `await` inside `forEach` not work?**
`forEach` ignores its callback's return value, so the promises are never awaited —
the loop finishes immediately and the async work floats. Use `for...of` for
sequential execution or `map` with `Promise.all` for parallel.

**Can you `await` a non-promise?**
Yes — it is wrapped and still resumes on the microtask queue, so it costs one
microtask tick. `await null` is a common idiom for yielding to microtasks
specifically.

---

← Prev: [Promise states and chaining](07-promise-states.md) · Next → [Promise combinators](09-combinators.md)
