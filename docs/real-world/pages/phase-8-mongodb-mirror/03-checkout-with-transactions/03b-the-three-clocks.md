---
title: "Three clocks bound the retries, and the honest answer to a lost commit is a re-read"
sidebar_label: "3b · The three clocks"
sidebar_position: 5
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

**The retry loops of [chunk 3](03-failure-retries-and-the-callback.md) do not
run forever, and the limit that stops them is not one number. Three clocks are
ticking against every checkout — one in the driver, one on the server, one this
code sets itself — and they belong to three different components with three
different failure modes. This chunk lays them out, shows the single modern lever
that replaces reasoning about all three, and then finishes the `catch` block
chunk 2 left open: what to tell the client when `withTransaction` gives up, and
why the honest answer to a lost commit is a re-read rather than a guess.**

## Timeouts: three clocks, and they are not the same clock

There are three limits in play and they belong to three different components.
Confusing them produces "the transaction hung for two minutes" bug reports that
are really "your callback was retried four hundred times".

**1 · `MAX_WITH_TRANSACTION_TIMEOUT` — 120 seconds, in the driver.** The Node
driver's `withTransaction` will not start a *new* attempt once 120 seconds have
elapsed since the helper was entered; the constant is
`MAX_WITH_TRANSACTION_TIMEOUT` in `src/sessions.ts` and the behaviour is
documented as retrying "for 120 seconds". It bounds both loops. When it
expires, the last error is rethrown — so a checkout that has been losing write
conflicts for two minutes fails with a write-conflict error, not with a
distinct "gave up" error.

**2 · `transactionLifetimeLimitSeconds` — 60 seconds, on the server.** A single
attempt that runs longer than this is aborted server-side with a transient
error, which the driver then retries. Note the relationship: the driver's
budget is twice the server's per-attempt limit, so a callback slow enough to
hit the server limit gets roughly one more go and then stops.

**3 · `maxCommitTimeMS` — set by us, per transaction.** Chunk 2's
`TXN_OPTIONS` sets `5_000`. It caps the commit alone, which is where the
`w: 'majority'` wait happens; without it a partitioned secondary set can hold a
commit open far longer than any HTTP client is prepared to wait.

Driver 6 added a fourth, better lever — **`timeoutMS`** (client-side operation
timeout, CSOT). Set on the client, the session or the transaction, it becomes
the single deadline for the whole operation including its retries, and
supersedes the 120-second constant. If you are starting fresh on driver 6 or
later, prefer it: one number that means "this checkout has this long", rather
than three numbers whose interaction you have to reason about.

```js
// the same transaction under CSOT: one deadline, retries included
return await client.withSession({defaultTimeoutMS: 10_000}, (session) =>
  session.withTransaction(callback, {
    readConcern: {level: 'snapshot'},
    writeConcern: {w: 'majority'},
    readPreference: 'primary',
  }),
);
```

Note that `maxCommitTimeMS` and `timeoutMS` are mutually exclusive on the same
transaction — the driver rejects a transaction that sets both.

## When it gives up

`withTransaction` exhausting its budget is not an application error and must
not be mapped to a 4xx. The checkout did not happen — no order, no stock
claimed, no outbox row — so the honest answer to the client is that the server
could not complete the request, and the honest instruction is to try again with
the same idempotency key.

```js
// db/mongo/checkout.js — the catch from chunk 2, completed
} catch (err) {
  if (err?.code === 11000) {                       // lost the replay race
    const won = await orders.findOne({idempotencyKey},
      {projection: {status: 1, totalCents: 1}});
    if (won) return {order: toOrder(won), replay: true};
  }
  if (err?.hasErrorLabel?.('UnknownTransactionCommitResult')) {
    // the driver already retried the commit and still does not know.
    // The order may exist. Do not guess — say so, and let the replay decide.
    const maybe = await orders.findOne({idempotencyKey},
      {projection: {status: 1, totalCents: 1}});
    if (maybe) return {order: toOrder(maybe), replay: true};
    const e = new Error('checkout outcome unknown'); e.code = 'RETRY_LATER'; throw e;
  }
  if (err?.hasErrorLabel?.('TransientTransactionError')) {
    const e = new Error('checkout contended out'); e.code = 'RETRY_LATER'; throw e;
  }
  throw err;
}
```

The endpoint maps `RETRY_LATER` to **503 with a `Retry-After`**, and the same
idempotency key makes the client's retry safe: it either finds the order at
step 0 and returns it as a replay, or it does the checkout for the first time.
This is the same contract
[Phase 3's checkout endpoint](../../phase-3-express-api/07-the-checkout-endpoint.md)
already publishes, reached by a different route.

Note the ordering inside that `catch`. The `UnknownTransactionCommitResult`
branch re-reads before deciding, because that label genuinely means *maybe it
committed*, and the unique index on `idempotencyKey` makes the re-read
authoritative. Every idempotency-key design pays off exactly here: the one
failure mode a distributed commit cannot resolve for you is resolved by asking
the database whether the thing you tried to write is there.

## Gotchas

**★ Wrapping `withTransaction` in your own retry loop multiplies the budget.**
A `for (let i = 0; i < 5; i++)` around the helper produces up to ten minutes of
retrying against a request the client abandoned after thirty seconds, and it
retries application errors the inner loop deliberately refused to retry. The
helper *is* the retry loop. If you need a different policy, change
`timeoutMS`; if you need to retry after it gives up, that is the client's
replay with the same idempotency key, not a loop inside the handler.

**★ An HTTP request that has already timed out leaves the transaction running.**
Nothing about the client disconnecting cancels the callback; the driver keeps
retrying for its full budget, and the checkout may commit long after the
customer saw a gateway timeout and pressed the button again. With the
idempotency key, that second press is a replay and the outcome is still
correct — but only because the key exists. Set `timeoutMS` a little *below* the
API gateway's timeout so the database gives up before the client does, and the
customer's retry meets a settled state rather than a race.

## Interview questions

**★ The commit fails with `UnknownTransactionCommitResult` and the driver's
retries also fail. Did the checkout happen?** Unknown, and the code must not
pretend otherwise. That label means the commit's outcome was never observed —
it may be durable on a majority of the replica set right now. The only
authoritative answer is to ask the database, which is what the unique index on
`idempotencyKey` makes possible: re-read the order by key. If it is there the
transaction committed and the request is answered as a replay; if it is not,
return 503 and let the client retry with the same key, which is safe in either
direction. Guessing "it probably failed" and returning a 500 is how a customer
is charged for an order the system claims does not exist.

**★ Your handler wraps `withTransaction` in a three-attempt loop "for
resilience". Name two things that get worse.** First, the budget multiplies:
the helper already retries for up to 120 seconds, so three of them is up to six
minutes of work for a request no client is still waiting on, and every one of
those attempts costs the database real contention. Second, the outer loop has
no idea about labels, so it retries the errors the inner loop deliberately
refused to retry — `OutOfStockError` and `CartChangedError` get re-run three
times, turning an immediate, correct 409 into a slow one, and re-executing the
whole read path each time to reach the same conclusion.

**★ What does `withTransaction` throw when it exhausts its 120 seconds?** The
last error it saw, not a distinct timeout error. A checkout that has been
losing write conflicts for two minutes fails with a write-conflict error
carrying `TransientTransactionError` — the same error it would have retried a
millisecond earlier. Application code therefore cannot distinguish "contended
once" from "contended for two minutes" by the error alone, which is a second
reason to keep an attempt counter: the error tells you the kind of failure, and
only your own metric tells you the scale.

---

← Prev: [Two loops and two labels](03-failure-retries-and-the-callback.md) ·
**Overview** *(not written yet)* ·
Next → [A callback that can run twice](03c-a-callback-that-can-run-twice.md)
