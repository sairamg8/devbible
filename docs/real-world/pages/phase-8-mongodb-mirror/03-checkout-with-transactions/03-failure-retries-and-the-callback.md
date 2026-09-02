---
title: "The callback may run more than once: two retry loops, two error labels, and the guarantee a transaction takes away"
sidebar_label: "3 · Two loops and two labels"
sidebar_position: 4
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

**The convenience of `withTransaction` is that it retries for you. The cost is
that the function you hand it is not a block of code that runs once — it is a
callback the driver is allowed to invoke again, from the top, with a fresh
snapshot. This chunk is the machinery: the two independent retry loops, the two
error labels that drive them, and the guarantee
[chunk 1](01-the-stock-decrement.md) promised would be withdrawn once the write
moved inside a transaction. [Chunk 3b](03b-the-three-clocks.md) takes the
budget those loops run against; [chunk 3c](03c-a-callback-that-can-run-twice.md)
takes what re-running does to the code you wrote.**

## Two loops, not one

`withTransaction` is not a single retry loop with a single condition. The
manual describes two, and they retry different things for different reasons:

| Loop | Trigger | What re-runs | Why it is safe |
|---|---|---|---|
| **Transaction retry** | the error carries `TransientTransactionError` | **the entire callback, from the first line** | nothing the callback wrote was committed; the transaction is discarded whole |
| **Commit retry** | the commit fails with `UnknownTransactionCommitResult` | **only `commitTransaction`** | committing an already-committed transaction is a no-op, so re-sending it is idempotent |

Reading them in the wrong order is the source of most of the confusion about
this API. The commit loop does **not** re-run the callback — it re-sends one
command. The transaction loop does **not** re-send a commit — it throws away
everything and starts the business logic again. A single failed checkout can go
through both: the callback runs three times because of write conflicts, then
the commit is re-sent twice because the primary stepped down while answering.

The manual states the labels as the contract, not the specific error codes:

> *"The transaction as a whole can be retried if the error has the
> `TransientTransactionError` label"* … *"if the commit operation encounters an
> error, the driver retries the commit if the error has the
> `UnknownTransactionCommitResult` label."*
> — [Transactions in Applications](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)

That is why application code should branch on `err.hasErrorLabel('…')` and
never on a list of numeric codes. The set of codes that carry a label is a
server implementation detail and has changed across releases; the label is the
published interface.

## What actually earns each label

**`TransientTransactionError`** is attached to failures where nothing was
committed and re-running is genuinely a fresh attempt. In this app's checkout,
in descending order of how often you will see it:

- **A write conflict** — the guarded `$inc` in `claimStock` targeted a product
  document another transaction has modified since the snapshot. This is the
  common one, and on a hot product under load it is the *only* one you will
  see. Chunk 2b's race walkthrough ends here: the loser's callback re-runs, its
  new snapshot shows `stock: 0`, and the guard correctly returns `false`.
- **A primary step-down or election** mid-transaction. The session's
  transaction lived on one primary; there is now a different one.
- **The server's own runtime limit** expiring the transaction —
  `transactionLifetimeLimitSeconds`, default **60 seconds**, after which the
  server aborts a transaction whether or not the client is still working.
- **A lock request that could not be granted.** MongoDB does not block a
  transaction indefinitely waiting for a lock; it waits
  `maxTransactionLockRequestTimeoutMillis`, **5 ms by default**, and then fails.
  This is a deliberate design choice and it is the reason contention here
  surfaces as retries rather than as the long lock waits Phase 1's
  `for update` produced.

**`UnknownTransactionCommitResult`** is attached to a commit whose *answer* was
lost, not a commit that is known to have failed: a network error while the
commit was in flight, a step-down while committing, or a write concern that
could not be satisfied in time. The transaction may well be durable already.
This is precisely the "answer unknown" row of
[chunk 2b's crash map](02b-what-each-part-is-doing.md) — the row that grew a
mechanism relative to Phase 1, because the driver now retries the commit before
the client's replay ever gets involved.

**Neither label is attached to a plain application failure**, and that is the
property the checkout code leans on. `OutOfStockError`, `CartChangedError`, the
empty-cart error and the `DuplicateKey` from a lost replay race are ordinary
exceptions thrown out of the callback: `withTransaction` aborts the
transaction, does not retry, and rethrows. A 409 must not be retried nine times
before the customer sees it, and it is not.

## Writes inside a transaction are not retryable writes

[Chunk 1](01-the-stock-decrement.md) ended on a promise, and this is it. A
standalone `claimStock` gets the retryable-writes guarantee: the driver
re-sends the update after a lost response and the server recognises the retry,
so the `$inc` is applied exactly once. The manual withdraws that inside a
transaction:

> *"Retryable writes … are not supported for … writes within a transaction."*
> — [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)

The replacement is not weaker, but it operates at a different granularity. An
individual write inside the transaction is never re-sent on its own; the
failure surfaces as a transient error and the **whole transaction** is retried.
The unit of exactly-once moves up from the write to the transaction, which is
what you wanted anyway — a checkout half re-applied is worse than a checkout
retried whole. What it costs is the subject of
[chunk 3c](03c-a-callback-that-can-run-twice.md): the retry now re-executes your
JavaScript, not just one command on the wire.

## Gotchas

**★ `withTransaction` has no backoff, and a hot product is a thundering herd.**
The transaction retry loop re-runs immediately on a transient error; there is
no sleep and no jitter between attempts. Fifty buyers racing the last units of
one product will therefore re-execute their callbacks against each other as
fast as the network allows, each attempt re-reading the cart and the products
before losing the same guarded `$inc` again. Nothing is incorrect, and the
throughput is poor. The mitigation is chunk 1's design, not a driver setting:
the standalone guarded `$inc` needs no transaction at all, so the only thing
that should ever contend on a hot product document is a *multi-line* checkout.
Where a single product genuinely is the whole business — a ticket drop — the
answer is to move the contention off one document (a reservation collection, a
sharded counter), not to tune the retry.

**★ `hasErrorLabel` is a method on the error, and it is not always there.** A
`TypeError` thrown by your own code inside the callback is a plain `Error` with
no such method, so `err.hasErrorLabel('…')` throws while you are handling an
error and buries the original stack. Use the optional call —
`err?.hasErrorLabel?.('TransientTransactionError')` — as the `catch` above
does.

## Interview questions

**★ Why can the driver retry a commit but not an arbitrary write inside a
transaction?** Because commit is idempotent and an interior write is not, at
that granularity. Re-sending `commitTransaction` for a transaction that already
committed is a no-op the server recognises; the only ambiguity the label
signals is whether the *first* attempt landed, and re-sending resolves it.
An interior write has no such property — the transaction it belonged to may
have been aborted, so re-sending the single write would apply it outside the
unit it was supposed to be atomic with. The retry granularity therefore moves
up to the whole transaction, which is why the callback, and not one command,
is what re-runs.

**★ Why does branching on error codes rather than labels rot?** Because the
labels are the published contract and the codes are not. The manual specifies
the two labels and tells drivers to attach them; which underlying codes carry
them — write conflict, lock timeout, step-down, the runtime limit, plus
whatever a future release adds — is a server implementation detail. Code that
matches on `112` handles today's write conflict and silently stops retrying the
day a new transient condition ships with a different code, and it will fail as
a mysterious increase in 500s rather than as a compile error.

**★ Under contention, why does MongoDB show retries where Postgres showed
waiting?** Because MongoDB does not queue a transaction behind a lock for any
meaningful length of time —
`maxTransactionLockRequestTimeoutMillis` defaults to **5 ms**, after which the
request fails with a transient error and the whole transaction is re-run. Phase
1's `select … for update` did the opposite: the second transaction blocked
until the first committed, then proceeded with the fresh row. Same contention,
two strategies — Postgres pays it in latency inside one attempt, MongoDB pays
it in repeated attempts. That is the mechanical reason the callback has to be
re-runnable in the first place, and the reason a hot-document design that was
merely slow on Postgres becomes a retry storm here.

---

← Prev: [What each part is doing](02b-what-each-part-is-doing.md) ·
Index: [Checkout with transactions](README.md) ·
Next → [The three clocks](03b-the-three-clocks.md)
