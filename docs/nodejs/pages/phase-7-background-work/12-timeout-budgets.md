---
title: "Timeout budgets — every outbound call bounded"
sidebar_label: "12 · Timeout budgets"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**, against a local server that never responds.

**Every call that leaves your process needs a deadline, and the deadline must shrink as
it propagates.** Without the first, one slow dependency exhausts your process. Without
the second, a chain of three "5-second timeouts" is a 15-second request.

## `fetch` has no timeout

This is the one people are surprised by. Node's `fetch` will wait as long as the
server keeps the socket open — there is no default request timeout, and a server that
accepts your connection and never replies holds it indefinitely.

```js
await fetch(slowUrl);        // still waiting, minutes later
```

```js
const t = performance.now();
try {
  await fetch(slowUrl, {signal: AbortSignal.timeout(300)});
} catch (err) {
  console.log(`aborted after ${Math.round(performance.now() - t)} ms:`, err.name);
}
```

```console
aborted after 306 ms: TimeoutError | The operation was aborted due to timeout
```

`AbortSignal.timeout(ms)` is the built-in — no library, no manual `setTimeout` and
`clearTimeout`, and the timer does not keep the event loop alive. Catch it by
`err.name === 'TimeoutError'`, distinct from `AbortError` when something else aborted
([page 13](./13-deadline-propagation.md)).

## The budget

A fixed timeout per call is the beginner version, and it composes badly: three calls at
5 s each is a 15-second request. A **budget** is one deadline for the whole operation,
and each step gets whatever is left.

```js
class Budget {
  constructor(ms) { this.deadline = Date.now() + ms; }
  get remaining() { return Math.max(0, this.deadline - Date.now()); }
  signal() { return AbortSignal.timeout(this.remaining); }
  expired() { return this.remaining === 0; }
}
```

```console
budget starts at 500 ms
after a 200 ms step, downstream gets 300 ms
second call aborted after 301 ms (not a fresh 500)
```

**301 ms, not 500.** The second call inherited what was left rather than starting over.
That is the property that makes end-to-end latency bounded: whatever the call graph
does, the operation cannot exceed its budget.

```js
async function checkout(orderId, budget = new Budget(2000)) {
  const order = await db.findOrder(orderId, {signal: budget.signal()});
  if (budget.expired()) throw new Error('budget exhausted before charging');

  const charge = await payments.charge(order, {signal: budget.signal()});
  await queue.add('send-receipt', {orderId});     // not on the budget — it is a job
  return charge;
}
```

Note the last line. Queued work is deliberately outside the budget — that is the point
of [page 01](./01-sync-vs-background.md).

## Choosing the numbers

Work **inwards from the user**, never outwards from the dependency.

1. What is the acceptable end-to-end latency? Say **2 s**.
2. Subtract your own overhead and a safety margin: **~1.8 s** to spend.
3. Divide across the calls the request actually makes, giving the critical ones more.
4. Anything that does not fit the budget is not a request-path call. Queue it.

Two rules that keep this honest:

**A caller's timeout must exceed the callee's.** If your service allows 2 s and calls a
dependency with a 3 s timeout, the client gives up first and your work is wasted while
still holding resources. Timeouts must decrease going down the stack.

**Retries live inside the budget, not outside it.** "3 attempts × 2 s" is a 6-second
request unless the budget stops it. Check `budget.remaining` before every retry
([page 15](./15-backoff-and-jitter.md)):

```js
if (budget.remaining < 200) throw new Error('no time left to retry');
```

## Everything needs one, not just `fetch`

| Call | How to bound it |
|---|---|
| `fetch` | `signal: AbortSignal.timeout(ms)` |
| PostgreSQL | `statement_timeout` on the connection, server-side |
| PostgreSQL connect | `connectionTimeoutMillis` on the pool |
| MongoDB | `serverSelectionTimeoutMS`, `socketTimeoutMS` |
| Redis | `connectTimeout`, `commandTimeout` |
| A whole job | `AbortSignal.timeout` threaded through the handler |
| Your HTTP server | `server.requestTimeout`, `server.headersTimeout` |

The database row matters most, and
[Phase 6, page 03](../phase-6-data-access/03-driver-lifecycle.md) measured why:
`statement_timeout` is enforced by the server and actually cancels the query, while
`query_timeout` is client-side only — the client stops waiting and **the server keeps
running the query**. A client-side timeout that leaves work running is not a timeout;
it is a leak with a nicer error message.

## What a timeout does not do

**It does not stop the work.** The remote server is still processing your request; the
row may still be written. A timed-out write is in an unknown state, which is precisely
why [page 14](./14-retry-safe-failures.md) insists that retrying it requires
idempotency.

**It is not a circuit breaker.** Timeouts bound one call. When a dependency is fully
down, every request still pays the full timeout, and at any real traffic level that
fills the process with waiting requests. Bounding is necessary; failing fast after N
consecutive failures is the next step.

**It does not free the resource by itself.** Aborting a `fetch` releases the socket,
but a checked-out database connection is only released by your `finally`.

## Gotchas

**Symptom:** Requests hang forever against one dependency
**Cause:** `fetch` has no default timeout.
**Fix:** `AbortSignal.timeout(ms)` on every outbound call.

**Symptom:** p99 is the sum of every dependency's worst case
**Cause:** Independent per-call timeouts, no budget.
**Fix:** One deadline for the operation; each step gets the remainder.

**Symptom:** The client gave up but the server is still working
**Cause:** The caller's timeout is shorter than the callee's.
**Fix:** Timeouts must shrink going down the stack; propagate the deadline.

**Symptom:** The query keeps running after the timeout
**Cause:** `query_timeout` is client-side only.
**Fix:** `statement_timeout`, which the server enforces.

**Symptom:** "3 retries with a 2 s timeout" produces 6-second requests
**Cause:** Retries outside the budget.
**Fix:** Check remaining budget before each retry.

**Symptom:** Timeouts made an outage worse
**Cause:** Every request pays the full timeout against a dead dependency.
**Fix:** Add a circuit breaker; shed load rather than queue it.

**Symptom:** A job hangs and holds a worker slot until it stalls
**Cause:** No timeout inside the job handler.
**Fix:** Bound the handler with its own signal.

## Interview questions

**★ Does `fetch` have a default timeout in Node?**
No. It waits as long as the socket stays open. `AbortSignal.timeout(ms)` is the
built-in fix — measured, `AbortSignal.timeout(300)` aborted after 306 ms with a
`TimeoutError`.

**★ What is a timeout budget and why is it better than per-call timeouts?**
One deadline for the whole operation, with each step receiving the time remaining
rather than a fresh allowance. Measured: after a 200 ms step of a 500 ms budget, the
next call was given 300 ms and aborted at 301 ms. Per-call timeouts add up — three
5-second calls is a 15-second request.

**★ How do you pick timeout values?**
Inwards from the user: acceptable end-to-end latency, minus overhead, divided across
the calls the request makes. A caller's timeout must always exceed its callee's, so
timeouts shrink going down the stack. Anything that does not fit becomes a job.

**★ What does a timeout not tell you?**
Whether the work happened. The remote side may have completed after you stopped
waiting, so a timed-out write is in an unknown state — which is why retrying it safely
requires idempotency.

**Why is `statement_timeout` better than `query_timeout`?**
`statement_timeout` is enforced by PostgreSQL and cancels the query. `query_timeout` is
client-side: the client stops waiting while the server keeps executing, so the load
remains and the connection is tied up.

**Are timeouts enough to protect against a dependency outage?**
No. Every request still pays the full timeout, so at load the process fills with
waiting requests. Timeouts bound a call; a circuit breaker stops making the call at
all after repeated failures.

---

← Prev: [Graceful worker shutdown](./11-graceful-shutdown.md) · Next → [Deadline propagation](./13-deadline-propagation.md)
