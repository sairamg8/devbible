---
title: "06 · Async iterators"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of), [`async function*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*), [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) and [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream). Documentation-validated.

**A synchronous `next()` cannot say "wait".** It must return `{ value, done }` on the
spot, so a source that has to reach the network before it knows whether there is another
value needs a different protocol — the same handshake with a promise in the middle.

| | Sync | Async |
|---|---|---|
| Iterable | `[Symbol.iterator]()` | `[Symbol.asyncIterator]()` |
| Iterator | `next()` → `{ value, done }` | `next()` → **`Promise<{ value, done }>`** |
| Loop | `for...of` | **`for await...of`** |
| Producer | `function*` | **`async function*`** |

```js
async function* poll(url, ms) {
  while (true) {
    yield await (await fetch(url)).json();
    await new Promise((r) => setTimeout(r, ms));
  }
}

for await (const state of poll("/status", 5000)) {
  render(state);
  if (state.finished) break;      // stops the loop AND the polling — it is pull-based
}
```

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`for await...of` and the async protocol](./01-for-await-of.md)** | Where the loop may appear, the `asyncIterator`→`iterator` fallback and how sync iterables get awaited, **sequential by design** and when that is the wrong choice, error handling and MDN's **skipped-`finally` trap**, `return()` being awaited on early exit, and `ReadableStream`'s locking and `preventCancel` |
| 2 | **[Writing async generators](./02-writing-async-generators.md)** | What `async function*` returns, `yield` on a promise versus `yield await`, making a class async-iterable, **async cleanup in `finally` with `AbortController`**, backpressure for free and why push sources need a queue, and the four places an async generator is the wrong tool |

## The three that catch people

```js
for await (const url of urls) await fetch(url);   // SEQUENTIAL — probably not what you wanted
function* g() { try { yield Promise.reject(e); } finally { cleanup(); } }  // finally SKIPPED
for await (const c of stream) break;              // the stream is cancelled by default
```

## Phase gate

You are done with this topic when you can say what `for await...of` does to a plain array
of promises, explain why `break`ing the loop also stops an async generator's work, and
choose correctly between `for await...of` and `Promise.all` for a given set of requests.

## Where this connects

- [05 · Generators](../05-generators/README.md) — the synchronous half; everything about suspension, one-shot objects and `finally` carries over
- [04 · The iteration protocols](../04-iteration-protocols/README.md) — the sync protocols this mirrors
- **07 · Paginating an API with an async generator** *(not written yet)* — the pattern this topic exists to make possible
- [Phase 7 · 09 · Sequential vs parallel](../../phase-7-async/09-sequential-vs-parallel/README.md) — the choice `for await...of` quietly makes for you
- [Phase 7 · 07 · `async`/`await`](../../phase-7-async/07-async-await/README.md) — the `await` half, on its own
- [Phase 7 · 08 · Error handling](../../phase-7-async/08-error-handling/README.md) — where a rejection surfaces, and what `try/catch` catches

---

Start → [`for await...of` and the async protocol](./01-for-await-of.md)
