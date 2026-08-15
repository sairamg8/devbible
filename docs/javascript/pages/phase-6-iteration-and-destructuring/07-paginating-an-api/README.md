---
title: "07 · Paginating an API with an async generator"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`async function*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*), [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of), [`Link`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Link) (RFC 8288), [`Array.fromAsync`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fromAsync) and [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). Documentation-validated.

**The caller wants items; the API gives pages; nobody knows how many pages there are.**
That mismatch is what an async generator is for, and this is the pattern worth stealing —
the one place where [06 · Async iterators](../06-async-iterators/README.md) pays for
itself immediately.

```js
async function* paginate(url) {
  let next = url;
  while (next) {
    const res = await fetch(next);
    const page = await res.json();
    yield* page.items;                 // items, not pages
    next = page.next;
  }
}

for await (const order of paginate("/api/orders")) {
  if (order.id === wanted) break;      // page 3 is never requested
}
```

Paging lives in one place, the consumer keeps control, and nothing is fetched that nobody
asked for.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The pattern](./01-the-pattern.md)** | What it replaces and why (`fetchAll`, callbacks, cursor-at-the-call-site), the **three paging styles** — cursor, offset and the `Link` header — the termination condition for each, the max-pages and repeated-cursor guards, yielding items versus pages, and `Array.fromAsync` when you do want all of it |
| 2 | **[Making it production-worthy](./02-making-it-production-worthy.md)** | Threading an `AbortSignal` so `break` cancels the in-flight request, `429` and `Retry-After`, bounding results (and why `Iterator.prototype.take` does **not** apply), **what a mid-stream failure means for work already done**, testing by injecting `fetch`, and when paging on the client is the wrong design |

## The three that go wrong

```js
while (items.length) { … }                 // wrong end signal — some APIs page past empty
for await (const x of paginate(url)) break; // in-flight request keeps running without an AbortController
const all = await Array.fromAsync(page);    // if every caller does this, the laziness bought nothing
```

## Phase gate

You are done with this topic when you can write a paginating async generator for a
cursor API and a `Link`-header API, say exactly when each stops, and explain what has and
has not happened when page 4 rejects.

## Where this connects

- [06 · Async iterators](../06-async-iterators/README.md) — the protocol this is built on, and where `break`-then-`finally` cleanup is specified
- [05 · Generators](../05-generators/README.md) — `yield*`, laziness, and one-shot objects
- [Phase 11 · 01 · `fetch`](../../phase-11-network-storage/01-fetch/README.md) — `res.ok`, headers, and why a 404 is not a rejection
- [Phase 7 · 09 · Sequential vs parallel](../../phase-7-async/09-sequential-vs-parallel/README.md) — paging is sequential on purpose; concurrency belongs across resources, not within one
- **Phase 17 · 08 · Retry with backoff, jitter and an `AbortSignal`** *(not written yet)* — the retry policy this sketches

---

Start → [The pattern](./01-the-pattern.md)
