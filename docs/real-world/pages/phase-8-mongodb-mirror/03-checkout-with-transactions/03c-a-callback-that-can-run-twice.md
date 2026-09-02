---
title: "Writing a callback that can run twice: what it may own, what must live outside it, and the control interface it has"
sidebar_label: "3c · A callback that can run twice"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Transactions in Applications](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)
> (the `TransientTransactionError` and `UnknownTransactionCommitResult` error
> labels, and the two retry loops the drivers implement),
> [Transactions](https://www.mongodb.com/docs/manual/core/transactions/),
> [Production Considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
> (`transactionLifetimeLimitSeconds`, `maxTransactionLockRequestTimeoutMillis`,
> write conflicts),
> [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)
> (*"Retryable writes … are not supported for … writes within a transaction"*);
> the **Node driver** —
> [Transactions](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/),
> [Limit Server Execution Time](https://www.mongodb.com/docs/drivers/node/current/connect/csot/),
> and `withTransaction` plus `MAX_WITH_TRANSACTION_TIMEOUT` in
> [`src/sessions.ts`](https://github.com/mongodb/node-mongodb-native/blob/main/src/sessions.ts).
> `mongodb` is **not** installed in this repo's `node_modules`, so every driver
> claim here comes from its published docs and its source on GitHub, not from a
> local declaration file.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Chunk 3](03-failure-retries-and-the-callback.md) established that the
transaction retry loop re-runs the whole callback and
[chunk 3b](03b-the-three-clocks.md) established how long it is allowed to keep
doing that. This chunk is the consequence for the code: a `withTransaction`
callback is not a block that executes once, it is a function the driver may
invoke several times with a fresh snapshot each pass, and every line of
[chunk 2's checkout](02-the-transaction.md) was written under that constraint.
The rule reduces to one sentence — **everything the callback derives it must
derive inside itself, and anything that cannot be rolled back must not happen
inside it at all** — and the rest of this page is what that sentence rules out.**

## The control interface is two words

`withTransaction` decides between commit and abort on exactly one signal:

> **Throw to abort. Return to commit.**

There is no third outcome to arrange, no status code to hand back, and nothing
to call. A normal return means the helper attempts `commitTransaction`; any
exception out of the callback means it calls `abortTransaction` and then
decides, from the error's labels, whether to run you again. That is the whole
interface, and its narrowness is why the checkout throws `OutOfStockError` and
`CartChangedError` rather than returning a failure object — a returned failure
would be committed.

The corollary is that the callback's error handling is not free-form. Chunk 2's
`catch` sits *outside* `withTransaction` for a reason, and chunk 2's insistence
that a `DuplicateKey` propagate rather than be handled in place is the same
reason wearing different clothes.

## What the callback may own, and what it may not

Three questions decide where a line of code belongs.

**Does a retry need a fresh copy of it?** Then it is derived inside. The order
id, the `items` array, the `now` timestamp, the recomputed `totalCents`, the
`short` list of out-of-stock products — every one of these is a value of *this
attempt*, and every one is declared inside the callback body in chunk 2.

**Can the database roll it back?** Then it may live inside. Writes carrying
`{session}` qualify and nothing else does. The two `outbox` inserts are inside
precisely because they are writes; the emails they stand for are not.

**Would running it twice be visible to anyone?** Then it belongs outside — or
in the outbox. Payment captures, emails, webhooks, cache purges, message
publishes, business metrics, and the `orders` re-read of the replay fast path
all fail this test, and all of them sit outside the callback in chunk 2.

A useful way to hold it: **the callback is a pure function of the snapshot,
whose only effect is session-scoped writes and whose only output is its return
value.** Deviations from that description are the bug list below.

## Gotchas

**★ Catching a transient error inside the callback breaks both loops.** The
tempting shape is a `try/catch` around the `claimStock` loop that logs and
continues. If the caught error was a write conflict, the server has already
aborted that transaction; the callback returns normally, `withTransaction`
attempts to commit a transaction that no longer exists, and the commit fails
with `NoSuchTransaction` — an error that carries no retry label, so the
customer gets a 500 for what was an ordinary lost race that the driver would
have retried into a correct answer. **Fix: never catch broadly inside the
callback.** Catch only the specific application errors you throw yourself, and
let everything else out.

```js
// wrong — swallows the write conflict, then commits a dead transaction
for (const line of cart.items) {
  try { await claimStock(db, {...line, session}); }
  catch (e) { log.warn(e); }
}

// right — only your own signal is handled, and it is handled by throwing
const short = [];
for (const line of cart.items) {
  const ok = await claimStock(db, {productId: line.productId, qty: line.qty, session});
  if (!ok) short.push(line.productId);
}
if (short.length) throw new OutOfStockError(short);
```

**★ Closure state declared outside the callback accumulates across retries.**
Move `const short = []` above the `withTransaction` call and the code still
compiles, still passes every single-threaded test, and produces a duplicated —
or wholly stale — list the moment a retry happens: attempt one pushes product
A, attempt two pushes A again because the snapshot moved, and the 409 names it
twice. The same defect with `const items = []`, with a `total` accumulator, or
with a `let orderId` minted outside so that a retry silently reuses the id of
an attempt that was rolled back. **Everything the callback derives, it must
derive inside itself**, which is why chunk 2 mints `orderId`, builds `items`,
computes `totalCents` and stamps `now` inside the callback body and returns the
result rather than assigning it outward.

**★ A side effect that is not a database write does not roll back.** An email,
a payment capture, a webhook, a cache invalidation or a Kafka publish placed
inside the callback happens once per *attempt*, and no abort undoes it. Three
retries, three emails; and the attempt that finally commits is not necessarily
the one whose side effect the customer received. This is not a new problem and
this app already solved it: the two `outbox` inserts in step 6 are inside the
transaction because they are writes that roll back, and the
[relay](../../phase-2-node-services/04-outbox-relay-and-email.md) performs the
actual side effect afterwards, outside any transaction, at-least-once with its
own idempotency. **If it cannot be rolled back, it does not belong in the
callback — it belongs in the outbox.**

**★ Metrics and logs inside the callback double-count, and the graph lies about
your throughput.** `metrics.increment('checkout.started')` at the top of the
callback counts attempts, not checkouts, so a contended hour shows a conversion
funnel that appears to leak customers who in fact bought. Instrument outside
the callback for business counters; instrument *inside* only for a deliberate
`checkout.txn.attempt` counter whose whole purpose is to measure the retry
rate. That counter is worth having: it is the first thing that moves when a
product goes viral, and it moves before any latency graph does.

**★ Do not use the callback's own error to decide whether to abort.**
`withTransaction` aborts on any throw and commits on any normal return. There
is no third outcome to arrange and no `session.abortTransaction()` to call
yourself inside the callback — calling it explicitly and then returning
normally leaves the helper committing an aborted transaction, the
`NoSuchTransaction` case again. **Throw to abort. Return to commit.** That is
the entire control interface.

**★ A retry re-reads the cart, so "nothing changed" is not a safe assumption
between attempts.** The snapshot is per attempt. Attempt one sees a cart of two
lines; the customer's second tab adds a third; attempt two sees three lines and
a larger total. This is why `expectedTotalCents` is compared inside the
callback rather than validated once by the caller — the check has to run
against the snapshot the order is actually built from, on every attempt.

**★ A one-shot resource consumed on the first attempt is empty on the second.**
The retry re-runs your JavaScript, not the request that carried it. A callback
that reads a Node stream, drains an async iterator, consumes a cursor obtained
outside itself, or reaches for an already-parsed-once request body works
perfectly on attempt one and sees nothing on attempt two — and because the
transient error is swallowed by the retry, the symptom is not an exception but a
checkout that quietly commits an empty `items` array. The rule is the same one
as for closure state: if the callback needs it, the callback obtains it, on
every pass. Chunk 2's `carts.findOne` and `products.find(...).toArray()` are
both inside the callback for this reason as much as for the snapshot's.

## Interview questions

**★ A checkout callback sends the confirmation email directly instead of
writing to the outbox. What is the sequence that produces two emails and no
order?** Attempt one reads the cart, sends the email, then loses a write
conflict on the last unit of product B. The email is already gone — nothing
about the abort recalls it. `withTransaction` re-runs the callback; attempt two
re-reads, sends a second email, and this time finds `stock: 0` for B, so
`claimStock` returns `false` and the callback throws `OutOfStockError`. The
transaction aborts for good, the customer gets a 409, and has two confirmation
emails for an order that does not exist. The outbox inserts avoid it precisely
because they are writes: they roll back with everything else, and the relay
sends only what committed.

**★ Where is the correct place for `new ObjectId()` in this checkout, and why
does it matter?** Inside the callback. An id minted outside is reused by every
attempt, so the order document of a rolled-back attempt and the one that
finally commits share an `_id` — harmless in isolation, but it makes the
`_id` a value that existed before the write and encourages code elsewhere to
have logged or returned it before the transaction committed. Inside the
callback, each attempt mints its own, only the committing attempt's id ever
escapes, and it escapes as the callback's return value — which driver 6 and
later hand straight back out of `withTransaction`.

**★ How would you convince yourself a checkout callback is safe to run twice,
without a replica set under contention?** Not by load-testing it — a retry is
rare enough that a passing test proves nothing. Read it instead, against three
mechanical checks. First, every identifier the callback uses is either a
parameter or declared inside the callback body: any `const` or `let` closed over
from the enclosing function is a defect unless it is genuinely immutable input.
Second, every awaited call inside the callback is either a collection method
carrying `{session}` or pure computation: an `await` on anything else — a
`fetch`, a mailer, a cache client, a second pool — is a side effect that will
not roll back. Third, the callback's result leaves as a `return` value, so that
nothing outside it can observe an attempt that was discarded. A callback that
passes all three can be invoked any number of times and only the committing
pass will ever have been visible, which is exactly the property the retry loop
assumes.

---

← Prev: [The three clocks](03b-the-three-clocks.md) ·
Index: [Checkout with transactions](README.md) ·
Next → [The four transaction options](04-write-concern-and-deployment.md)
