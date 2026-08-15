---
title: "06.2 · Writing async generators"
sidebar_label: "02 · Writing async generators"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`async function*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*), [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) and [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols). Documentation-validated.

`async function*` is the two halves of this phase joined together: **`await` for the
waiting, `yield` for the sequence.** MDN puts it exactly that way — it *"empowers you to
handle asynchronous tasks ergonomically with `await`, while leveraging the lazy nature of
generator functions."*

```js
async function* poll(url, ms) {
  while (true) {
    const res = await fetch(url);        // await — the async half
    yield await res.json();              // yield — the sequence half
    await new Promise((r) => setTimeout(r, ms));
  }
}

for await (const state of poll("/status", 5000)) {
  render(state);
  if (state.finished) break;             // stops the loop AND the polling
}
```

That `break` is the whole argument for async generators. The producer is **pull-based**:
it does not run again until the consumer asks, so stopping the consumer stops the work.
A `setInterval` polling loop keeps firing whether anyone is listening or not.

## What you get back

MDN: *"Each time an async generator function is called, it returns a new `AsyncGenerator`
object, which conforms to the async iterator protocol"* — meaning it implements
`Symbol.asyncIterator`, and *"every call to `next()` returns a `Promise` that resolves to
the iterator result object"*.

```js
const gen = poll("/status", 1000);
gen.next().then((res) => res);   // { value: …, done: false }
```

Everything from [05 · Generators](../05-generators/README.md) still holds: calling it runs
no code, the object is its own iterator, it is **one-shot**, and `return()`/`throw()`
work — with the difference that they return promises too.

## Yielding a promise

You rarely need `yield await x` — `yield x` on a promise already does the right thing.
MDN: *"When a promise is yielded, the iterator result promise's eventual state will match
that of the yielded promise. The `value` property of an async generator's resolved result
will not be another promise."*

```js
async function* foo() {
  yield Promise.reject(new Error("failed"));
}

foo().next().catch((e) => e);   // Error: failed
```

**This is the fix for the `finally` trap in
[06.1](./01-for-await-of.md).** In a *sync* generator, a yielded rejected promise rejects
outside the generator and skips its `finally`. In an *async* generator the rejection is
part of the generator's own result, so the machine unwinds properly and `finally` runs.
`yield await x` and `yield x` behave the same for the consumer; write `yield await x` only
when you want the generator itself to see the failure at that line.

## Making any object async-iterable

Same shape as the sync version — an `async *` method under the async key:

```js
class Feed {
  constructor(client) { this.client = client; }
  async *[Symbol.asyncIterator]() {
    let cursor;
    do {
      const page = await this.client.fetch({ cursor });
      yield* page.items;                 // delegate to a sync iterable
      cursor = page.next;
    } while (cursor);
  }
}

for await (const item of new Feed(client)) { /* … */ }
```

Because the method is a generator function, **each `for await...of` gets a fresh
iterator** — the restartability rule from
[04.2](../04-iteration-protocols/02-making-your-own-object-iterable.md) is unchanged. The
paging pattern this sketches is its own topic, **07 · Paginating an API with an async
generator** *(not written yet)*.

## Cleanup that can itself be async

`for await...of` calls `return()` on early exit *and awaits the promise it returns*
([06.1](./01-for-await-of.md)). Inside an async generator, `return()` behaves like a
`return` at the suspended `yield`, so `finally` runs — and it may `await`:

```js
async function* rows(db) {
  const conn = await db.connect();
  try {
    let cursor = await conn.query();
    while (cursor.hasMore) yield await cursor.next();
  } finally {
    await conn.close();          // awaited by the loop before it exits
  }
}
```

Pair it with an `AbortController` when the underlying work is cancellable:

```js
async function* stream(url) {
  const controller = new AbortController();
  const res = await fetch(url, { signal: controller.signal });
  try {
    for await (const chunk of res.body) yield chunk;
  } finally {
    controller.abort();          // stop the request when the consumer walks away
  }
}
```

**This is the capability the sync protocol simply does not have.** A sync iterator's
`return()` cannot wait for anything.

## Backpressure, for free

A pull-based producer cannot outrun its consumer — it is suspended at the `yield` until
`next()` is called again. That is backpressure without a buffer, a queue or a pause/resume
API, and it is why async iteration suits streams and paginated sources so well.

The flip side: **a push source does not convert for free.** Events, WebSocket messages and
callbacks arrive whether or not anyone has called `next()`, so bridging them into an async
iterator needs a queue and a decision about what to do when the consumer falls behind —
buffer, drop, or apply backpressure upstream. That design belongs with
**Phase 7 · 22 · Async work and backpressure** *(not written yet)*, and the queue itself is
**Phase 17 · 07 · A concurrency-limited task queue** *(not written yet)*.

## Where an async generator is the wrong tool

- **A fixed set of independent requests.** `Promise.all(items.map(fn))` is clearer and
  concurrent; an async generator would serialise them
  ([Phase 7 · 09](../../phase-7-async/09-sequential-vs-parallel/README.md)).
- **One value.** That is a promise. Do not wrap a single `await` in a generator.
- **Fan-out work you want overlapping.** Async iteration is sequential by construction;
  concurrency has to be built *inside* a stage, not expected from the loop.
- **A consumer that needs the whole result anyway.** If the first thing you do is collect
  it into an array, the laziness bought nothing — though `Array.fromAsync` exists for
  exactly that collect step when you do want it.

## Gotchas

**Symptom:** `SyntaxError` on `await` inside `function*`
**Cause:** A plain generator is synchronous.
**Fix:** `async function*`, consumed with `for await...of`.

**Symptom:** The generator's `finally` never ran when a sync generator yielded a rejected
promise
**Cause:** The documented sync-generator case — the rejection happens outside the
generator.
**Fix:** Make it an `async function*`; there, a yielded rejection is part of the
generator's own result.

**Symptom:** `for await...of` over an async generator was slower than expected
**Cause:** It is sequential — each `next()` is awaited before the next begins.
**Fix:** Batch inside the generator (`yield*` a page of results, fetch the next page
concurrently), or use `Promise.all` if the work is independent.

**Symptom:** Polling kept running after the consumer stopped
**Cause:** The loop `break`ed but the producer was push-based (`setInterval`), not the
generator.
**Fix:** Put the delay *inside* the async generator so the pull drives it, and cancel in
`finally`.

**Symptom:** The async generator was consumed twice and the second pass was empty
**Cause:** One-shot, exactly like a sync generator object.
**Fix:** Expose `async *[Symbol.asyncIterator]()` on an object, or call the function again.

**Symptom:** A request kept running after `break`
**Cause:** Nothing cancelled it — closing the iterator does not cancel a `fetch`.
**Fix:** `AbortController`, aborted in the generator's `finally` block, which the loop
awaits.

**Symptom:** `value` came back as a promise
**Cause:** Expected only from a *sync* iterator; an async generator resolves it — *"the
`value` property of an async generator's resolved result will not be another promise."*
**Fix:** If you are seeing promises, the source is a sync generator — use `for await...of`
or await the value.

## Interview questions

**★ What does `async function*` give you that `function*` does not?**
`await` inside the body, and a `next()` that returns a promise. It lets a lazily-produced
sequence come from an asynchronous source — pages, streams, polls — while keeping the
pull-based, stop-when-you-stop behaviour of a generator.

**★ What is the difference between `yield x` and `yield await x` when `x` is a promise?**
For the consumer, nothing: MDN says the result promise's state matches the yielded
promise's, and `value` is never itself a promise. The difference is where a rejection is
observed — with `yield await x` it throws inside the generator, so the generator's own
`try/catch` can handle it.

**★ Why do async generators give you backpressure?**
Because they are pull-based: the body is suspended at `yield` until the consumer calls
`next()`. A slow consumer simply means the producer runs less often — no buffering, no
queue, no explicit pause/resume.

**★ How do you clean up when a `for await...of` loop breaks early?**
Put the cleanup in a `finally` around the yields. The loop calls the iterator's `return()`
on early exit and **awaits** the promise it returns, so asynchronous cleanup — closing a
connection, aborting a request — completes before the loop exits.

**When would you use `Promise.all` instead of an async generator?**
When the work is a known, independent set and you want it concurrent. Async iteration is
sequential; it is the right choice for ordered, open-ended or early-exiting consumption,
not for fan-out.

**Can you convert an event stream into an async iterator?**
Yes, but not for free — events push, iterators pull, so you need a queue between them plus
a policy for a consumer that falls behind (buffer, drop or push back upstream).

---

← Prev [`for await...of` and the async protocol](./01-for-await-of.md) ·
[Topic index](./README.md)
