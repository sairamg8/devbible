---
title: "Deadline propagation — one AbortSignal, threaded through"
sidebar_label: "13 · Deadline propagation"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**.

**When a request is cancelled, everything it started should stop.** Otherwise the user
who closed the tab is still costing you a database connection, three outbound calls and
a worker slot — and under load, the work you are doing for people who left crowds out
the work for people who stayed.

## One signal, everything it started

```js
const ac = new AbortController();

const child = async (name) => {
  try { await scheduler.wait(2000, {signal: ac.signal}); return `${name} finished`; }
  catch { return `${name} cancelled`; }
};

const all = Promise.all([child('db'), child('cache'), child('webhook')]);
setTimeout(() => ac.abort(new Error('client disconnected')), 100);
console.log(await all);
console.log('abort reason:', ac.signal.reason.message);
```

```console
[ 'db cancelled', 'cache cancelled', 'webhook cancelled' ]
abort reason: client disconnected
```

One `abort()`, three cancellations, and **the reason travelled with it**.
`ac.abort(reason)` accepts any value and surfaces it as `signal.reason` — pass an
`Error` and the cancellation carries a message you can log and act on, instead of a
bare `AbortError` with no context.

## The threading rule

The signal is a parameter, like any other. It goes through every layer:

```js
// handler
app.get('/orders/:id/summary', async (req, res) => {
  const signal = AbortSignal.any([
    AbortSignal.timeout(2000),                    // the budget — page 12
    toAbortSignal(req),                           // the client went away
  ]);
  try {
    res.json(await buildSummary(req.params.id, {signal}));
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') return;  // nobody is listening
    throw err;
  }
});

// service
async function buildSummary(orderId, {signal}) {
  const order = await orders.findById(orderId, {signal});
  const [shipping, recommendations] = await Promise.all([
    shippingApi.quote(order, {signal}),
    recommender.for(order, {signal}),
  ]);
  return {order, shipping, recommendations};
}

// repository
async function findById(id, {signal}) {
  return pool.query({text: 'select … where id = $1', values: [id]}, {signal});
}
```

**`AbortSignal.any([...])`** composes sources: a timeout *and* client disconnect *and*
a shutdown signal, whichever fires first. That is how a single `signal` parameter
carries several independent reasons to stop.

Detecting the client leaving:

```js
function toAbortSignal(req) {
  const ac = new AbortController();
  req.on('close', () => { if (!req.readableEnded) ac.abort(new Error('client disconnected')); });
  return ac.signal;
}
```

The `readableEnded` check matters — `close` fires on normal completion too, and
aborting then would cancel work that already succeeded.

## What actually honours a signal

Passing a signal to something that ignores it is worse than not passing it, because the
code reads as if cancellation works.

| Honours `signal` | Notes |
|---|---|
| `fetch` | Aborts the request, frees the socket |
| `scheduler.wait` / `timers/promises` | Rejects and clears the timer |
| `fs/promises` reads and writes | Between chunks, not mid-syscall |
| `stream.pipeline` | Destroys the stream |
| `events.once` | Rejects the waiter |
| **Your own async functions** | **Only if you check** |

That last row is the one people miss. A loop is not cancellable unless it says so:

```js
for (const item of items) {
  signal.throwIfAborted();          // one line; without it the loop runs to completion
  await process(item, {signal});
}
```

And cancellation is cooperative, not preemptive: a **synchronous** block cannot be
interrupted at all. A 4-second `JSON.parse` will finish regardless of how many signals
fire, because nothing else runs while it does
([Phase 0](../phase-0-runtime-model/)).

`pg` accepts a signal on a query, but note what cancellation means there: the client
stops waiting, and the server keeps executing unless `statement_timeout` cancels it
([page 12](./12-timeout-budgets.md)). Aborting is not the same as stopping the work.

## Where propagation ends

**At the queue.** A cancelled request must not cancel a job it already enqueued — the
work still needs doing; nobody is waiting for the *reply*, which is different. The
signal bounds the request, not the consequences.

**At anything already committed.** Cancelling after a charge succeeded does not
un-charge it. If cancellation could leave the system inconsistent, do not cancel there
— use the budget check *before* the irreversible step
([page 12](./12-timeout-budgets.md)), not an abort in the middle of it.

**At the process boundary**, unless you carry it. A signal is an in-process object. To
cancel across services you send something — a `cancelled_at`, a message, a deadline
header the callee enforces itself. This is what gRPC deadlines do and what HTTP does
not give you for free.

## Shutdown is the same mechanism

The signal that cancels a request and the one that stops a worker are the same tool:

```js
const shutdownController = new AbortController();
process.on('SIGTERM', () => shutdownController.abort(new Error('SIGTERM')));

// every long wait in the process is cancellable by it
await scheduler.wait(backoffMs, {signal: shutdownController.signal});
```

That one line is why a shutdown does not have to wait out a 30-second backoff sleep
([page 11](./11-graceful-shutdown.md)).

## Gotchas

**Symptom:** Load stays high after users abandon requests
**Cause:** No cancellation — work continues for clients that are gone.
**Fix:** Abort on `req` close, thread the signal down.

**Symptom:** `AbortError` fills the logs as if it were a failure
**Cause:** Cancellation treated as an error.
**Fix:** Catch `AbortError`/`TimeoutError` at the boundary and return quietly; log at
debug.

**Symptom:** The signal is passed but nothing cancels
**Cause:** The called function ignores it, or the loop never checks.
**Fix:** `signal.throwIfAborted()` in loops; verify each library actually supports it.

**Symptom:** Cancelling did not stop the database work
**Cause:** Client-side abort only.
**Fix:** `statement_timeout` server-side.

**Symptom:** A cancelled request also cancelled its queued job
**Cause:** The signal was passed into the enqueue path.
**Fix:** Propagation stops at the queue.

**Symptom:** `close` aborts requests that completed successfully
**Cause:** `close` fires on normal completion too.
**Fix:** Check `req.readableEnded` before aborting.

**Symptom:** Nothing cancels a long synchronous block
**Cause:** Cancellation is cooperative; sync code cannot be interrupted.
**Fix:** Chunk the work, or move it to a worker thread.

## Interview questions

**★ What is deadline propagation?**
Passing one cancellation signal through every layer of an operation so that when the
deadline passes or the client disconnects, everything that operation started stops.
Measured: one `abort()` cancelled three concurrent children, and the reason —
`client disconnected` — travelled with it via `signal.reason`.

**★ How do you combine a timeout with client disconnect?**
`AbortSignal.any([AbortSignal.timeout(ms), clientGoneSignal])` — it fires on whichever
happens first, so a single `signal` parameter carries every reason to stop.

**★ Does passing a signal guarantee cancellation?**
No. It is cooperative. `fetch`, timers, streams and `fs/promises` honour it; your own
functions only do if they call `signal.throwIfAborted()` or pass it further down. A
synchronous block cannot be interrupted at all.

**★ Where should propagation stop?**
At the queue — a cancelled request should not cancel work that still needs doing — and
at anything already committed. Check the remaining budget before an irreversible step
rather than aborting in the middle of one.

**How do you cancel across a process boundary?**
You cannot pass a signal; you have to send something the other side enforces — a
deadline header, a cancellation message, or a `cancelled_at` the callee checks. gRPC
has deadlines built in; plain HTTP does not.

**What does `signal.reason` give you?**
Whatever you passed to `abort()`. Pass an `Error` and the cancellation carries a
message and stack you can log, instead of an undifferentiated `AbortError` that could
mean a timeout, a disconnect or a shutdown.

---

← Prev: [Timeout budgets](./12-timeout-budgets.md) · Next → [Retry only safe, transient failures](./14-retry-safe-failures.md)
