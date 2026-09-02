---
title: "Checkout with transactions — the one path in this app that needs one, and everything it costs"
sidebar_label: "Overview"
sidebar_position: 0
---

> The counterpart of
> [Phase 1 · 06 — the checkout transaction](../../phase-1-database/06-the-checkout-transaction/README.md).
> Same five changes, same idempotency key, same crash map — over four
> collections instead of five tables, and with a retry mechanism Postgres did
> not have. MongoDB transactions as a *feature* belong to the
> [MongoDB section](../../../../mongodb/README.md); this chapter is the
> **decisions** one application made with them.

**Prerequisites:** [chapter 01](../01-modeling-the-store/README.md) (the document
model, the unique indexes, the constraints that vanished),
[chapter 02](../02-the-catalog/README.md) (the repository shape), and Phase 1's
checkout chapter, which every chunk here compares itself against.

## The argument in one line

**Most of this app's writes need no transaction; checkout needs one; and the
price of the one is that your callback may run more than once.**

Chunk 1 removes the transaction from the stock decrement entirely — a single
guarded `$inc` is atomic on its own, which is more than the Postgres original
could say for the same operation. Chunk 2 puts a transaction back for the one
place a multi-write invariant actually exists. Chunks 3–3c are the consequence
of that decision, and chunks 4–4b are its configuration and its deployment bill.

| # | Chunk | Tier | What it settles |
|---|---|---|---|
| 1 | **[The stock decrement](01-the-stock-decrement.md)** | <span className="db-tier t-master">Master</span> | The guarded `$inc` needs no transaction — and a lost response is retried exactly once, which `UPDATE … SET stock = stock - 1` never was |
| 2 | **[The transaction](02-the-transaction.md)** | <span className="db-tier t-understand">Understand</span> | The five changes that stand or fall together, why the order is still inserted first, and the unique index still doing the replay guard's job |
| 3 | **[What each part is doing](02b-what-each-part-is-doing.md)** | <span className="db-tier t-understand">Understand</span> | The code read line by line, the stale-read rule, and Phase 1's crash map re-run with one row changed |
| 4 | **[Two loops and two labels](03-failure-retries-and-the-callback.md)** | <span className="db-tier t-master">Master</span> | 🔴 `TransientTransactionError` re-runs the **callback**; `UnknownTransactionCommitResult` re-sends the **commit** — and a write inside a transaction is not a retryable write |
| 5 | **[The three clocks](03b-the-three-clocks.md)** | <span className="db-tier t-master">Master</span> | The driver's 120 s, the server's 60 s, our `maxCommitTimeMS` — and `timeoutMS`, the one lever that replaces reasoning about all three |
| 6 | **[A callback that can run twice](03c-a-callback-that-can-run-twice.md)** | <span className="db-tier t-master">Master</span> | 🔴 Throw to abort, return to commit — what the callback may own, and why an email inside it sends twice for an order that never existed |
| 7 | **[The four transaction options](04-write-concern-and-deployment.md)** | <span className="db-tier t-master">Master</span> | Every field of `TXN_OPTIONS` justified: snapshot reads, majority commits, primary routing, a bounded commit |
| 8 | **[The deployment requirement](04b-the-deployment-requirement.md)** | <span className="db-tier t-master">Master</span> | A replica set is not a topology preference — and a standalone dev database removes three guarantees while warning about one |

## What Phase 1 had that this does not

**A lock.** `SELECT … FOR UPDATE` froze the product rows, and every invariant
that depended on "the values I read are the values I am writing against" got
that for free. Nothing here freezes anything, so each of those invariants had to
be re-established explicitly:

| Phase 1 got it from | Here it comes from |
|---|---|
| the row lock, for stock | the `$gte` guard in the update filter — [chunk 1](01-the-stock-decrement.md) |
| the row lock, for prices | the transaction's snapshot — [chunk 2b](02b-what-each-part-is-doing.md) |
| the row lock, for the cart total | an explicit `expectedTotalCents` comparison — [chunk 2](02-the-transaction.md) |
| blocking, under contention | retrying, under contention — [chunk 3](03-failure-retries-and-the-callback.md) |

The last row is the one that changes how code is *written* rather than what it
does, and it is why three of the eight chunks are about the retry.

## What this chapter has that Phase 1 did not

- **Retryable writes** on the single-document path — a lost response to
  `claimStock` is resolved by the server, not guessed at by the client.
- **A commit retry** for the "answer unknown" case, which Phase 1 left entirely
  to the client's replay.
- **One less collection in the unit of commit**, because `order_items` is inside
  the order document.

## Where this connects

The endpoint and its contract are
[Phase 3 · the checkout endpoint](../../phase-3-express-api/07-the-checkout-endpoint.md),
which does not learn which database answered. The side effects owed by a
committed order are drained by
[Phase 2's outbox relay](../../phase-2-node-services/04-outbox-relay-and-email.md) —
unchanged, and the reason no email is ever sent from inside a transaction
callback. The document shapes are settled in
[chapter 01](../01-modeling-the-store/README.md); the indexes that make these
queries and the unique replay guard work are derived in **chapter 05**
*(not written yet)*.

---

← Prev: [The catalog on MongoDB](../02-the-catalog/README.md) ·
Index: [Phase 8 overview](../README.md) ·
Next → [The dashboard on the aggregation pipeline](../04-the-dashboard/README.md)
