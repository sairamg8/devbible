---
title: "07.2 · Making it production-worthy"
sidebar_label: "02 · Making it production-worthy"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`async function*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*), [`for await...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) and [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After). Documentation-validated.

The generator in [07.1](./01-the-pattern.md) is correct and would be a reasonable thing to
ship. Four things separate it from one you can leave running against a real API:
**cancellation, rate limits, bounded results, and knowing what a failure halfway through
actually means.**

## Cancellation, all the way down

Breaking the loop stops *future* requests, but the request already in flight keeps going
until it completes. Thread an `AbortSignal` through and abort it in `finally` — which
`for await...of` awaits ([06.1](../06-async-iterators/01-for-await-of.md)):

```js
async function* paginate(url, { signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", abort, { once: true });

  let next = url;
  try {
    while (next) {
      const res = await fetch(next, { signal: controller.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const page = await res.json();
      yield* page.items;
      next = page.next;
    }
  } finally {
    controller.abort();                                   // covers break, throw and return
    signal?.removeEventListener("abort", abort);
  }
}
```

Three properties worth naming:

- **`break` aborts the in-flight request**, because `return()` is inserted at the suspended
  `yield` and unwinds through `finally`.
- **An external `signal`** — a component unmounting, a newer search superseding this one —
  aborts it from outside.
- **`finally` runs on the error path too**, so a failure on page 4 does not leave page 5's
  request hanging.

A per-request timeout composes with this: `AbortSignal.timeout(ms)` gives a signal that
aborts itself, and `AbortSignal.any([a, b])` combines them.

## Rate limits and retries

A paginating loop is exactly the shape that trips rate limiters, because it issues request
after request as fast as the server answers. Handle `429` explicitly, using the server's
own `Retry-After` header rather than a guess:

```js
async function fetchPage(url, signal) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { signal });
    if (res.status !== 429 || attempt >= 5) return res;
    const after = Number(res.headers.get("Retry-After")) || 2 ** attempt;
    await new Promise((r) => setTimeout(r, after * 1000));
  }
}
```

`Retry-After` is *"delay-seconds"* or an HTTP date; the numeric form is what APIs
overwhelmingly send. Retrying only `429` and 5xx is deliberate — **retrying a `400` or a
`404` just repeats a request that will never succeed.** The general policy (jitter, caps,
which errors are retryable) is **Phase 17 · 08 · Retry with backoff, jitter and an
`AbortSignal`** *(not written yet)*.

Two smaller things in the same family: request the **largest page size the API allows**,
since halving the number of round trips is the cheapest optimisation available; and if the
API publishes remaining-quota headers, read them and slow down before you are throttled
rather than after.

## Bounding the result

Callers frequently want "the first 50 matching", and the generator makes that free — but
only if nothing greedy is in the way:

```js
const first50 = await Array.fromAsync(
  Iterator.from(paginate(url)).take(50),      // sync helpers do not apply to async iterators
);
```

⚠️ **That line is wrong**, and it is worth seeing why: `Iterator.prototype` helpers are
**synchronous**. As of this writing the async equivalents are not something to rely on, so
bound it in the loop instead:

```js
let n = 0;
for await (const item of paginate(url)) {
  use(item);
  if (++n >= 50) break;              // stops paging immediately
}
```

Or give the generator the limit, which keeps the call sites honest:

```js
async function* paginate(url, { maxItems = Infinity, maxPages = 1000 } = {}) { /* … */ }
```

**Prefer bounding in the generator when the limit is a safety rail** (never fetch more than
N pages) and in the consumer when it is a business rule (show the first 50).

## What a mid-stream failure means

This is the part people skip, and it is the part that shows up in production. When page 4
fails, **the consumer has already processed pages 1–3.** The rejection surfaces at the
consumer's `await` and the generator is finished — there is no resume.

Decide, explicitly, which of these you want:

| Semantics | How |
|---|---|
| **All or nothing** | Collect with `Array.fromAsync` and only commit after it resolves |
| **Partial progress is fine** | Process as you go; on error, report how far you got |
| **Resumable** | Yield the cursor alongside items (or expose the page-level generator) so the caller can restart from it |

```js
let lastCursor;
try {
  for await (const { item, cursor } of paginateWithCursor(url)) {
    process(item);
    lastCursor = cursor;
  }
} catch (err) {
  report(err, { resumeFrom: lastCursor });   // restartable, and it says where
}
```

**Idempotency matters here.** If processing an item has side effects, a resume will re-run
some of them unless the work is keyed by item id.

## Testing it

An async generator is unusually easy to test, because the only thing it touches is the
function you inject:

```js
async function* paginate(url, { fetchFn = fetch } = {}) { /* … */ }

const pages = [
  { items: [1, 2], next: "/p2" },
  { items: [3],    next: null  },
];
const fakeFetch = async () => ({ ok: true, json: async () => pages.shift() });

await Array.fromAsync(paginate("/p1", { fetchFn: fakeFetch }));   // [1, 2, 3]
```

Worth covering: the last page terminating, an empty first page, a short page, a repeated
cursor hitting the guard, a `break` after the first item issuing exactly one request, and a
non-2xx page rejecting.

## Should it page at all?

Push back on this one occasionally. **If the caller always ends up with every record, the
paging loop is a slow re-implementation of an export endpoint.** A bulk endpoint, a
server-side aggregate, or letting the server filter is usually better than pulling ten
thousand rows into a browser tab. The async generator is the right tool for *consuming*
pagination the API imposes — not a reason to fetch more than the client needs
(**Phase 12 · 13 · What belongs on the server** *(not written yet)*).

And when several independent resources need paging at once, the generator does not make
that concurrent: each one is sequential in itself. Run several generators under a
concurrency limit — **Phase 7 · 16 · Concurrency limiting** *(not written yet)*.

## Gotchas

**Symptom:** The in-flight request continued after `break`
**Cause:** No `AbortController`; closing the iterator does not cancel a `fetch`.
**Fix:** Abort in a `finally` block — `for await...of` awaits the returned promise.

**Symptom:** `429` responses were treated as data
**Cause:** `fetch` does not reject on HTTP status, and `res.json()` on an error body often
"works".
**Fix:** Branch on `res.status` before parsing; honour `Retry-After`.

**Symptom:** A retry loop hammered the API on a `404`
**Cause:** Retrying every failure rather than the retryable ones.
**Fix:** Retry `429` and 5xx only; fail fast on 4xx.

**Symptom:** `.take(n)` threw on the async generator
**Cause:** `Iterator.prototype` helpers are synchronous.
**Fix:** Count and `break` in the loop, or pass a `maxItems` option.

**Symptom:** A failure on page 4 left the database half-updated
**Cause:** Partial-progress semantics were never chosen — they were inherited.
**Fix:** Collect first and commit once, or make the work idempotent and resumable from a
yielded cursor.

**Symptom:** The pagination worked in tests and hung against the real API
**Cause:** The fake always terminated; the real server repeated a cursor or returned an
empty page with a `next`.
**Fix:** Keep the max-pages and repeated-cursor guards from
[07.1](./01-the-pattern.md), and test both cases.

**Symptom:** It is far slower than the same job on the server
**Cause:** Sequential round trips, small pages, and possibly the wrong place to do the work
at all.
**Fix:** Ask for the largest allowed page size; consider a bulk endpoint or server-side
filtering.

## Interview questions

**★ How do you cancel an in-flight page fetch when the consumer stops?**
Create an `AbortController` inside the generator, pass its signal to `fetch`, and call
`abort()` in a `finally` around the yields. `break` triggers the iterator's `return()`,
which unwinds through `finally`, and `for await...of` awaits that promise before exiting.

**★ What happens to already-processed items when page 4 fails?**
They stay processed. The rejection surfaces at the consumer's `await` and the generator is
finished. You have to choose the semantics deliberately — collect-then-commit for
all-or-nothing, or yield the cursor so the caller can resume.

**★ How do you handle rate limiting inside a paginating generator?**
Detect `429`, wait for the interval the server names in `Retry-After` (falling back to
exponential backoff), and retry only that request. Retry `429` and 5xx; do not retry 4xx.
Also request the largest page size allowed, which reduces the number of round trips.

**★ How do you limit the results to the first N without fetching everything?**
Count in the loop and `break`, or give the generator a `maxItems` option. Do **not** reach
for `Iterator.prototype.take` — those helpers are synchronous and do not apply to async
iterators.

**How would you test a paginating async generator?**
Inject the fetch function and drive it with scripted pages: last-page termination, empty
and short pages, a repeated cursor hitting the guard, an early `break` issuing exactly one
request, and a non-2xx page rejecting.

**When is paginating on the client the wrong design?**
When the client ends up with every record anyway. That is a bulk endpoint or a server-side
aggregate, not a loop. The generator is for consuming pagination the API imposes.

---

← Prev [The pattern](./01-the-pattern.md) · [Topic index](./README.md)
