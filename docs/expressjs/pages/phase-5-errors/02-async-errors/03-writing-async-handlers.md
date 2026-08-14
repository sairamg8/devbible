---
title: "Writing async handlers"
sidebar_label: "03 · Writing async handlers"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Seven habits that make the Express 5 guarantee actually cover your code — and
one thing no habit fixes, because Express and Node cannot cancel a running
handler at all.**

> Verified: 2026-08-14. The forwarding mechanism and its limits are established
> in chunks [01](01-what-is-forwarded.md) and
> [02](02-the-shapes-that-escape.md), read from **`router@2.2.0`**'s
> `lib/layer.js` in `sandbox/express-verify/node_modules/`. `AbortSignal.timeout`
> and `AbortSignal.any` are per the Node
> [`globals`](https://nodejs.org/api/globals.html#class-abortsignal)
> documentation. **No sandbox run backs this page and it carries no console
> block.** The habits are **this bible's guidance**, stated as such — Express
> prescribes none of them.

## 1 · `async` everywhere, and `await` everything

The guarantee attaches to the returned promise, so put everything on it. That
single rule subsumes most of the previous chunk:

```js
router.post('/orders', async (req, res) => {
  const order = await orders.create(req.validated, req.user.orgId);
  await audit.record('order.created', order.id, req.user.id);   // ← awaited
  res.status(201).location(`${req.baseUrl}/${order.id}`).json(present(order));
});
```

No `try`, no `next(err)`, no wrapper. A failure anywhere becomes a rejection of
the handler's promise, which the router turns into `next(err)`.

## 2 · Make the async boundary the module boundary

A handler that awaits a service, and a service that awaits a repository, gives
you one unbroken promise chain from the route to the driver. **The chain breaks
wherever someone drops back to a callback**, so promisify at the lowest level —
once, in the repository — rather than in each handler.

```js
// ✅ the callback lives in exactly one place
export const readTemplate = (name) => fs.promises.readFile(templatePath(name), 'utf8');
```

## 3 · `void … .catch(log)` for genuine fire-and-forget

If the caller truly must not wait, say so in a way a reader and a linter can both
see:

```js
void metrics.increment('order.created').catch(err =>
  logger.warn({err, requestId: req.id}, 'metric emit failed'));
```

`void` documents the intent; the `.catch` removes the crash; the request id keeps
it findable. **Anything that must actually happen belongs in a queue instead** —
a `.catch` gives you no retry and no visibility beyond a log line
([Node Phase 7](/docs/nodejs/pages/phase-7-background-work/)).

## 4 · Cancel with `AbortSignal`, not with a timeout middleware

An `AbortSignal` is the only mechanism that reaches the resource:

```js
router.get('/reports/:id', async (req, res) => {
  const signal = AbortSignal.any([
    AbortSignal.timeout(5_000),
    abortOnClientDisconnect(res),
  ]);

  const rows = await db.query(sql, params, {signal});
  res.json(rows);
});

function abortOnClientDisconnect(res) {
  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });
  return ac.signal;
}
```

🔴 **This is the thing no habit substitutes for.** Nothing in Express or Node
unwinds an in-flight `await` — there is no thread to kill. A timeout middleware
responds 503 and the handler carries on holding its pooled connection. Only the
resource can stop: a statement timeout at the database, an `AbortSignal` on a
`fetch`, a driver-level cancel
([Phase 9 · 06](../../phase-9-hardening/06-timeouts-and-secrets.md)).

Note the `res.on('close')` check on `writableEnded`, which distinguishes "the
client went away" from "we finished"
([Phase 0 · 03 · chunk 01](../../phase-0-express-basics/03-request-lifecycle/01-the-nine-stages.md)).

## 5 · Concurrency deliberately

```js
// sequential — two round trips, when the second does not need the first
const user = await getUser(id);
const orders = await getOrders(id);

// concurrent — one round trip's latency
const [user, orders] = await Promise.all([getUser(id), getOrders(id)]);
```

`Promise.all` is right when the calls are independent, and it comes with the
partial-failure subtlety from [chunk 02](02-the-shapes-that-escape.md): the first
rejection wins and the rest keep running. Share one `AbortSignal` across them so
the survivors are cancelled, and reach for `allSettled` when partial results are
genuinely acceptable.

**Do not fan out unboundedly.** `await Promise.all(ids.map(fetchOne))` with a
user-supplied `ids` array is an amplification attack with a valid content type —
which is why the array length belongs in the schema
([Phase 3 · 03 · chunk 03](../../phase-3-requests/03-size-limits/03-what-it-does-not-protect.md)).

## 6 · `finally` for cleanup, carefully

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const result = await doWork(client);
  await client.query('COMMIT');
  res.json(result);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});   // never mask the original
  throw err;
} finally {
  client.release();
}
```

Three rules in that block:

- **`finally` releases, it does not respond.** A `res.json` in a `finally` runs on
  the success path too, and double-sends.
- **A `catch` that does cleanup must not swallow the original error** — hence
  `throw err` at the end, and `.catch(() => {})` on the rollback so a failing
  rollback cannot replace the real error.
- **Never `return` from `finally`.** It discards a pending throw silently, which
  is a language footgun rather than an Express one.

## 7 · Check the response state before writing, late in a handler

Once a handler awaits anything, the client may have gone:

```js
const rows = await slowQuery();
if (res.writableEnded) return;        // client left; nothing to do
res.json(rows);
```

Cheap, and it stops a stack of confusing write-after-end errors in logs during
a traffic spike. It is not a substitute for cancellation — the query still ran.

## What still is not covered, and the net beneath it

Even with all seven, the shapes in [chunk 02](02-the-shapes-that-escape.md) can
reach the process. Two listeners, whose job is **to log before dying**, not to
continue:

```js
process.on('unhandledRejection', (reason) => {
  logger.fatal({reason}, 'unhandled rejection');
  throw reason;                       // let uncaughtException handle the exit
});

process.on('uncaughtException', (err) => {
  logger.fatal({err}, 'uncaught exception');
  shutdown(1);                        // drain, then exit
});
```

🔴 **Do not swallow these to "keep the process alive".** A process that has thrown
out of its call stack has unknown state — a half-open transaction, a lock never
released, a partially-mutated cache. Log, drain and exit; the supervisor restarts
you clean ([page 06](../06-not-found-and-process.md),
[Phase 10 · 06](../../phase-10-app-factory/06-shutdown-and-entrypoint.md)).

## Trade-off

Every habit here costs a little ceremony: an `await` where a bare call would
work, a `void … .catch` where nothing would, an `AbortSignal` threaded through
three layers. On a small internal service, most of it is over-engineering.

**What moves the line is scale and blast radius.** A floating promise on a
low-traffic admin tool is a log line nobody reads; on a public API it is a
restart loop. The two that are worth adopting unconditionally, because they cost
nothing per handler, are the **`no-floating-promises` lint rule** and the **two
process listeners**. The rest can follow the risk.

## Gotchas

**Symptom:** A `finally` block sends a response
**Cause:** `finally` runs on success too
**Fix:** Cleanup only in `finally`; respond in the success path

**Symptom:** A rollback failure replaces the real error in the logs
**Cause:** `await client.query('ROLLBACK')` threw inside the `catch`
**Fix:** `.catch(() => {})` on the rollback, and rethrow the original

**Symptom:** `Cannot write after end` during a traffic spike
**Cause:** The client disconnected while the handler was awaiting
**Fix:** `if (res.writableEnded) return` before a late write — and cancel the work
with an `AbortSignal` so it stops rather than merely being ignored

**Symptom:** A timeout middleware returns 503 and the database is still saturated
**Cause:** The timeout stopped the waiting, not the work. The handler still holds
its connection
**Fix:** A statement timeout at the database and an `AbortSignal` on outbound
calls; order timeouts inside-out

**Symptom:** One endpoint can make the service issue thousands of upstream calls
**Cause:** `Promise.all(ids.map(...))` over a user-supplied array
**Fix:** Cap the array length in the schema, and bound the concurrency

**Symptom:** The process keeps running after an `uncaughtException` and behaves
strangely
**Cause:** A listener that logs and returns, "to stay up"
**Fix:** Log, drain, exit. The state after an escaped throw is unknown

## Interview questions

**★ What is the single habit that makes Express 5's guarantee cover your code?**
Make every handler `async` and `await` everything inside it, so every failure is
on the promise the router attached to. Most of the escape shapes are just
"something was not on that promise".

**★ How do you actually cancel work when a request times out?**
With an `AbortSignal` passed to the resource — a database driver, `fetch`, a
stream. Nothing in Express or Node unwinds an in-flight `await`, so a timeout
middleware only stops the waiting; the query keeps its pooled connection until it
finishes.

**★ How should genuine fire-and-forget work be written?**
`void promise.catch(err => logger.warn({err, requestId: req.id}, '…'))` — `void`
documents the intent, the `catch` prevents the crash, the request id keeps it
findable. And if the work must actually happen, it belongs in a queue, because a
`.catch` gives you neither retry nor visibility.

**★ What should `process.on('uncaughtException')` do?**
Log and shut down cleanly. Not continue — a process that has thrown out of its
call stack has unknown state: a half-open transaction, an unreleased lock. Drain
in-flight requests and exit so the supervisor restarts you clean.

**Why not respond from a `finally` block?**
Because `finally` runs on the success path too, so it double-sends. `finally` is
for releasing resources; responding belongs on the success path.

**What is the cheapest defence against this whole class of bug?**
A `no-floating-promises` lint rule plus the two process listeners. Both are
one-off costs that apply across the codebase, unlike per-handler discipline,
which has to be re-applied by every author forever.

---

← Prev: [The four shapes that escape](02-the-shapes-that-escape.md) · Index: [Async errors](README.md) · Next topic → [Error response contract](../03-error-contract.md)
