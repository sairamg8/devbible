---
title: "01 · Why unbounded parallelism breaks"
sidebar_label: "01 · Why unbounded breaks"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [Connection management in HTTP/1.x](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Connection_management_in_HTTP_1.x), [Evolution of HTTP § HTTP/2](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Evolution_of_HTTP), [429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429) — and Node.js [`http.Agent` § `maxSockets`](https://nodejs.org/api/http.html#agentmaxsockets). Documentation-validated; **no timings, no console blocks**.

```js
const results = await Promise.all(ids.map((id) => fetch(`/items/${id}`)));
```

With ten ids this is correct and idiomatic. With fifty thousand it is a bug — and it is the same
line of code, which is why it survives review.

🔴 **`Promise.all` does not start the work. `.map` does.** By the time `Promise.all` sees the
array, all fifty thousand requests have already been issued. `Promise.all` is only the
*join* — it decides how you wait, never how much runs at once.

## What actually breaks

| Layer | What gives |
|---|---|
| **The browser** | HTTP/1.1 connections per origin are capped — commonly **6** — so the rest queue in the network stack, invisibly |
| **HTTP/2** | one multiplexed connection, but the server caps concurrent **streams** (a settings value, often around 100) |
| **The server** | rate limits and **429**s, or simple overload — you are the traffic spike |
| **Node** | sockets and file descriptors — `EMFILE`, and `http.Agent`'s `maxSockets` defaults to `Infinity`, so nothing stops you |
| **Memory** | every promise, every response body and every result is alive at once |
| **The user** | one shared connection pool, so *everything else on the page* waits behind your fan-out |

⚠️ **The browser's queue makes this look like it works.** With a per-origin cap the requests do
not fail — they line up. The code appears correct in development against ten items, and in
production it holds the connection pool for minutes while the rest of the page starves.

**In Node there is no such safety net.** The default agent has no socket ceiling, so an
unbounded fan-out really does open every connection, and the failure is an `EMFILE` or a
dependency falling over rather than a slow queue.

## The failure mode nobody plans for: `Promise.all` is fail-fast

`Promise.all` rejects the moment **any** input rejects — and the other 49 999 requests **keep
running**. There is no cancellation, so:

- the work continues, consuming the connections and the target's capacity;
- their results are discarded, including the ones that succeeded;
- a later rejection among them has no handler attached
  ([08 · Rejections that vanish](../08-error-handling/02-rejections-that-vanish.md)).

🔴 **At scale, one failure in ten thousand throws away the other 9 999 successes.** That is
almost never what the caller wanted from a bulk operation. `Promise.allSettled` is the honest
combinator for bulk work — it waits for everything and reports each outcome — and the full
comparison is [10 · Combinators](../10-combinators/README.md).

## The three shapes, and how to choose

```js
// 1 · sequential — one at a time
for (const id of ids) results.push(await getItem(id));

// 2 · unbounded — all at once
const results = await Promise.all(ids.map(getItem));

// 3 · bounded — N at a time
const results = await mapLimit(ids, 6, getItem);
```

| | Sequential | Unbounded | **Bounded** |
|---|---|---|---|
| In flight | 1 | *n* | **N** |
| Total time | slowest possible | fastest, if nothing breaks | close to unbounded in practice |
| Load on the target | none | 🔴 a spike | **predictable** |
| Memory | one result | 🔴 everything | N in flight |
| Behaviour at *n* = 10 | fine | fine | fine |
| Behaviour at *n* = 50 000 | unusable | 🔴 breaks | **fine** |

🔴 **The choice is a property of *n*, not of the code.** A `Promise.all` over a fixed list of
three known requests is right and should stay. A `Promise.all` over "however many rows came
back" is a latent incident — the list will be small in every test you write and large exactly
once, in production.

**Sequential is not the safe default either.** It is the shape that turns a 200-item sync into
several minutes of wall clock, and it is the accidental result of `await` inside a `for` loop —
the waterfall covered in
[09 · Sequential vs parallel](../09-sequential-vs-parallel/README.md).

## Choosing N

There is no universal number, and any page that gives you one is guessing. What there *is* is a
short list of things that decide it:

| Constraint | What it implies |
|---|---|
| The API's documented rate limit | the ceiling — respect it, and honour `Retry-After` when you hit it |
| HTTP/1.1 to one origin from a browser | more than the per-origin cap buys nothing; the extra requests queue |
| HTTP/2 | the server's stream limit, not the browser's connection count |
| CPU-bound work in Node | the core count, and probably a worker pool rather than promises |
| Database connections | the **pool size** — exceeding it just makes requests wait for a connection |
| Memory per item | large payloads mean a smaller N regardless of the network |

**Start small and raise it deliberately.** A limit slightly below the target's capacity costs a
little latency; one above it costs errors, retries and — with the retry wrapper from
[15](../15-timeouts-retries-backoff/02-the-wrapper.md) — more load precisely when the service is
struggling.

⚠️ **Concurrency limiting and retries interact.** N concurrent workers each retrying up to three
times is a burst of 3N. Keep the retry inside the task so the pool's ceiling still holds, rather
than retrying the whole batch.

## What a limiter does not solve

**It is not backpressure.** A limiter bounds how many tasks run at once; it does nothing about
how many are *queued*. Push a million items into a pool of six and you still hold a million
items in memory, waiting. Producing work faster than it can be consumed is
**22 · Async work and backpressure** *(not written yet)*.

**It is not deduplication.** Two identical requests for the same key both occupy a slot. If the
same work can be requested twice, cache the in-flight promise by key.

**It is not fairness.** A simple pool processes in the order it pulls; a slow item blocks its
own worker and nothing else. If some tasks matter more than others, you need a priority queue,
and that is a different structure.

## Gotchas

**Symptom: a fan-out works on the test fixture and melts the API in production.**
Cause — the list length is data, and the test data was small.
Fix — bound it whenever the length is not a fixed, known-small number.

**Symptom: the whole page's requests stall while a bulk load runs.**
Cause — the fan-out saturated the browser's per-origin connection pool.
Fix — a limit at or below the per-origin cap, so other requests can interleave.

**Symptom: `EMFILE: too many open files` in Node.**
Cause — unbounded sockets or file handles; the default agent has no `maxSockets` ceiling.
Fix — bound the concurrency in code, and set `maxSockets` on the agent as a backstop.

**Symptom: one failed item threw away 9 999 successful results.**
Cause — `Promise.all` is fail-fast.
Fix — `Promise.allSettled`, or collect per-item outcomes in the pool itself.

**Symptom: after a bulk operation failed, requests kept arriving at the server for a while.**
Cause — `Promise.all` rejected, but the in-flight work was never cancelled.
Fix — thread an `AbortSignal` into every task ([14 · Cancellation](../14-cancellation/README.md)).

**Symptom: the concurrency limit is set but the burst is three times larger.**
Cause — each task retries, and the retries are not counted against the limit.
Fix — retry *inside* the task, so a slot covers all of its attempts.

**Symptom: memory grows even though only six requests run at a time.**
Cause — the queue, not the concurrency: every pending item is held.
Fix — stream or page the source instead of materialising it.

## Interview questions

**★ What is wrong with `await Promise.all(items.map(fetchOne))` for a large list?**
`.map` starts every request immediately; `Promise.all` only joins them. You get *n* concurrent
requests — rate limits, socket exhaustion, memory, and a saturated connection pool.

**★ Does `Promise.all` control concurrency?**
No. It controls how you wait. Concurrency was decided by whatever started the promises.

**★ What happens to the other promises when `Promise.all` rejects?**
They keep running. Nothing is cancelled, their results are discarded, and a later rejection may
end up unhandled. `allSettled` is the combinator for bulk work.

**★ How do you pick the concurrency limit?**
From the constraint that binds: the API's rate limit, the per-origin connection cap, the database
pool size, memory per item, or core count for CPU work. Start below it and raise deliberately.

**★ Why is sequential not a safe default?**
It is *n* round trips of latency. For a few hundred items that is minutes of wall clock for work
that could take seconds bounded.

**★ Is a concurrency limiter backpressure?**
No. It bounds what runs, not what is queued. A million queued items still sit in memory.

**How do retries interact with a concurrency limit?**
They multiply the burst unless the retry lives inside the task. One slot should cover an item and
all of its attempts.

---

[Topic index](./README.md) · [02 · The bounded pool](./02-the-bounded-pool.md) →
