---
title: "06.1 · `for await...of` and the async protocol"
sidebar_label: "01 · `for await...of` and the async protocol"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of), [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) and [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream). Documentation-validated.

**The synchronous iterator protocol has no way to say "wait".** `next()` must return
`{ value, done }` right now, so a source that has to go to the network, a disk or a
socket before it knows whether there is a next value cannot use it. The async protocols
are the same two-step handshake from
[04 · The iteration protocols](../04-iteration-protocols/README.md) with a promise in the
middle:

| | Sync | Async |
|---|---|---|
| Iterable method | `[Symbol.iterator]()` | `[Symbol.asyncIterator]()` |
| Iterator method | `next()` → `{ value, done }` | `next()` → **`Promise<{ value, done }>`** |
| Consumed by | `for...of`, spread, destructuring | **`for await...of`** |

**Only the wrapper changes.** `done`, `value`, `return()`, early exit and one-shot-ness
all behave exactly as before.

## `for await...of`

MDN: it *"creates a loop iterating over async iterable objects as well as sync
iterables. This statement can only be used in contexts where `await` can be used, which
includes inside an async function body and in a module"* — that second half being
top-level `await`.

```js
for await (const chunk of source) {
  handle(chunk);       // runs after each value settles
}
```

Each turn of the loop awaits the promise from `next()` before the body runs, and awaits
the body's own `await`s before asking for the next value. **The loop is strictly
sequential**, which is the point when order matters and the trap when it does not — see
below.

## It also accepts *sync* iterables, and awaits their values

This is the part people do not expect. MDN's example:

```js
function* generator() {
  yield 0;
  yield 1;
  yield Promise.resolve(2);
  yield Promise.resolve(3);
  yield 4;
}

for await (const num of generator()) console.log(num);
// 0, 1, 2, 3, 4        ← promises resolved

for (const numOrPromise of generator()) console.log(numOrPromise);
// 0, 1, Promise { 2 }, Promise { 3 }, 4
```

The lookup rule is a fallback chain: *"it first gets the iterable's
`[Symbol.asyncIterator]()` method and calls it… If the `@asyncIterator` method does not
exist, it then looks for a `[Symbol.iterator]()` method… The sync iterator returned is
then wrapped into an async iterator by wrapping every object returned from the `next()`,
`return()`, and `throw()` methods into a resolved or rejected promise, with the `value`
property resolved if it's also a promise."*

**So `for await...of` over an array of promises works**, and awaits each in turn:

```js
for await (const res of urls.map((u) => fetch(u))) { /* one at a time, in order */ }
```

## Sequential by design — and when that is wrong

The loop above starts every `fetch` immediately (the `map` runs first) but *processes*
them one at a time. Where the requests are created inside the loop, they are also
**issued** one at a time:

```js
for await (const url of urls) {
  const res = await fetch(url);       // request N+1 does not start until N finishes
}

const all = await Promise.all(urls.map((u) => fetch(u)));   // concurrent
```

**Neither is "better".** Sequential is correct when each step depends on the last, when
you must not hammer a rate-limited API, or when you want to stop early. `Promise.all` is
correct when the requests are independent and you want them overlapping
([Phase 7 · 09 · Sequential vs parallel](../../phase-7-async/09-sequential-vs-parallel/README.md)).
Choosing `for await...of` for concurrent work is a common and quiet performance mistake.

## Errors, and the `finally` trap

A rejection surfaces at the `await` point, so ordinary `try/catch` works:

```js
try {
  for await (const x of source) use(x);
} catch (err) {
  // a rejected next(), a rejected yielded promise, or a throw in the body
}
```

But MDN flags one genuinely surprising case — a **sync** generator that yields a rejected
promise:

> "Be aware of yielding rejected promises from a sync generator. In such cases,
> `for await...of` throws when consuming the rejected promise and DOESN'T CALL `finally`
> blocks within that generator."

```js
function* g() {
  try {
    yield Promise.reject(new Error("failed"));
  } finally {
    console.log("called finally");   // NOT reached under for await...of
  }
}
```

The rejection happens **outside** the generator — the loop awaited a value the generator
had already handed over and considered done with — so the generator is never resumed and
its `finally` never runs. MDN's own fix is to await inside a plain `for...of` instead:

```js
for (const p of g()) console.log(await p);   // now `finally` DOES run
```

**The rule that avoids this entirely: do not yield promises from a sync generator.** Use
an `async function*`, where `yield` and rejection are inside the same machine.

## Early exit still closes the iterator

MDN: *"If the `for await...of` loop exited early (e.g., a `break` statement is
encountered or an error is thrown), the `return()` method of the iterator is called to
perform any cleanup. The returned promise is awaited before the loop exits."*

**The awaiting is the new part.** An async iterator's cleanup may itself be asynchronous —
closing a file, cancelling a request — and the loop waits for it before moving on. Wrapping
your yields in `try { … } finally { … }` inside an async generator therefore gives you
reliable *async* cleanup, which the sync protocol cannot offer.

`ReadableStream` makes this concrete. MDN: it *"implements the async iterable protocol"*,
and *"while iterating, the stream is locked to prevent other consumers from acquiring a
reader (attempting to iterate over a stream that is already locked will throw a
`TypeError`). This lock is released when the loop exits."* Note the default:

> "By default, exiting the loop will also cancel the stream, so that it can no longer be
> used. To continue to use a stream after exiting the loop, pass `{ preventCancel: true }`
> to the stream's `values()` method"

```js
for await (const chunk of stream.values({ preventCancel: true })) break;
// the stream is still usable here
```

## What is async iterable

There is no long list yet — this protocol is for sources, not collections. In practice:

- **`ReadableStream`** — including `(await fetch(url)).body`, where supported
- **Async generator objects** — anything from an `async function*`
- **Anything you write** with `[Symbol.asyncIterator]()`
- **Sync iterables**, by the fallback rule above — arrays, `Set`s, generators

Node's streams and several platform APIs expose the protocol too; check the specific
documentation rather than assuming, since support for async iteration on browser
`ReadableStream` arrived later than the rest of the streams API.

## Gotchas

**Symptom:** `SyntaxError` on `for await` at the top level of a script
**Cause:** It *"can only be used in contexts where `await` can be used"* — an async
function body or a module.
**Fix:** Wrap it in an `async` function, or make the file a module.

**Symptom:** `for await...of` over independent requests was slow
**Cause:** The loop is sequential — each iteration awaits before the next begins.
**Fix:** `Promise.all(items.map(fn))` when the work is independent; keep the loop when
order, rate limits or early exit matter.

**Symptom:** A sync generator's `finally` never ran under `for await...of`
**Cause:** MDN's documented case — yielding a **rejected promise** from a sync generator
throws outside the generator, so it is never resumed.
**Fix:** Use an `async function*`, or `for (const p of gen()) await p`.

**Symptom:** `for...of` over an async source gave `Promise { … }` values
**Cause:** `for...of` does not await anything.
**Fix:** `for await...of`, or `await` inside the loop body.

**Symptom:** `TypeError` when iterating a `ReadableStream` a second time
**Cause:** Iterating locks the stream, and exiting the loop cancels it by default.
**Fix:** `stream.values({ preventCancel: true })`, or `stream.tee()` for two consumers.

**Symptom:** A `break` out of `for await...of` left work running
**Cause:** `return()` is called and awaited, but only cleans up what the iterator's own
`finally`/`return` handles.
**Fix:** Put the cancellation in the iterator (an `AbortController`, a `finally` block) —
the loop will await it.

## Interview questions

**★ What is the difference between `for...of` and `for await...of`?**
`for await...of` awaits each result. It prefers `[Symbol.asyncIterator]()`, falls back to
`[Symbol.iterator]()` and wraps that sync iterator's results in promises, resolving
`value` if it is itself a promise. It may only appear where `await` is allowed.

**★ What does an async iterator's `next()` return?**
A **promise** that resolves to `{ value, done }` — not the object directly. That is the
only structural difference from the sync protocol.

**★ Is `for await...of` concurrent?**
No, it is strictly sequential: each iteration awaits before the next begins. For
independent work, use `Promise.all` over a `map`. Sequential is right when steps depend on
each other, when a rate limit applies, or when you want to stop early.

**★ Why can a sync generator's `finally` block be skipped by `for await...of`?**
Because a yielded **rejected promise** rejects *outside* the generator — it had already
handed the value over — so the generator is never resumed and never unwinds. MDN documents
this and recommends `for (const p of gen()) await p` instead. Better still, use an
`async function*`.

**What happens when you `break` out of a `for await...of`?**
The iterator's `return()` is called for cleanup and **the promise it returns is awaited**
before the loop exits — so asynchronous cleanup completes.

**How do you read a `fetch` response body as a stream?**
`for await (const chunk of response.body)` where async iteration on `ReadableStream` is
supported. Iterating locks the stream and, by default, cancels it on exit; pass
`{ preventCancel: true }` to `values()` to keep using it.

---

[Topic index](./README.md) · Next → [Writing async generators](./02-writing-async-generators.md)
