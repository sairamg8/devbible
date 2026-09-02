---
title: "What each part of the checkout transaction is doing, and the crash map that says who repairs what"
sidebar_label: "2b · What each part is doing"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
> (*"Transactions either apply all data changes or roll back the changes"*;
> *"Until a transaction commits, the data changes made in the transaction are
> not visible outside the transaction"*),
> [Drivers API](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)
> (*"each operation in the transaction must pass the session to each operation"*),
> [Production Considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
> (write conflicts, stale reads),
> [Transactions and Operations](https://www.mongodb.com/docs/manual/core/transactions-operations/);
> the **Node driver** —
> [Transactions](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/)
> and the `withTransaction` JSDoc in
> [`src/sessions.ts`](https://github.com/mongodb/node-mongodb-native/blob/main/src/sessions.ts).
> `mongodb` is **not** installed in this repo's `node_modules`, so the driver
> claims are from its published docs and source, not a local declaration file.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Chunk 2](02-the-transaction.md) showed the code; this chunk reads it line by
line. `withSession` owns the session's lifetime, `withTransaction` owns the
retry, `snapshot` read concern decides what the callback can see, and the guard
in the stock filter is what turns a write conflict into a correct answer. It
ends with Phase 1's crash map re-run against MongoDB — one row changed, and
that row is the subject of the next chunk.**

## What each part is doing

**`client.withSession` owns the session's lifetime.** A transaction lives on a
session; the manual: *"Transactions are associated with a session"* and *"If a
session ends and it has an open transaction, the transaction aborts."* Starting
the session by hand means remembering `endSession()` in a `finally`; the
`withSession` helper does it, and — driver 6 and later — returns what the
callback returns, so the transaction's result flows straight out.

**Every operation carries `{session}`.** This is the rule the driver docs state
in bold — *"You must pass the session to the operations"* — and the driver's own
JSDoc is blunter about what happens otherwise: an operation without the explicit
session *"will not be part of the transaction"*. There is no error. The write
commits on its own, immediately, and survives the abort. It is the Mongo
equivalent of Phase 2's `pool.query` inside a `tx`, and it is easier to write
because the call looks identical with the option missing.

**The reads use the transaction's snapshot, and the snapshot is stale by
design.** The manual is explicit:

> *"Read operations inside a transaction can return old data, which is known as
> a stale read. Read operations inside a transaction are not guaranteed to see
> writes performed by other committed transactions or non-transactional writes."*
> — [Production Considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)

So `found[i].priceCents` and `cart.items` are the values as of the snapshot,
which is exactly right for a price snapshot, and would be exactly wrong for a
stock check. The stock is therefore never *checked* — it is claimed, by the
guarded write from chunk 1, with the session attached.

**The guarded write inside a transaction becomes a write conflict.** Two
transactions both snapshot `stock: 1` and both run `{$gte: 1}` + `$inc: -1`.
The first to commit wins. The second's update targets a document that has
changed since its snapshot, and the manual says what happens:

> *"If a transaction is in progress and a write outside the transaction modifies
> a document that an operation in the transaction later tries to modify, the
> transaction aborts because of a write conflict."*

The same rule applies between two transactions. The loser's transaction aborts
with a `TransientTransactionError` label, `withTransaction` runs the callback
again from the top, the new snapshot shows `stock: 0`, the guard matches
nothing, and the buyer gets `OutOfStockError` — a clean 409. That retry is the
subject of **chunk 3** *(not written yet)*, and it is why the
callback has to be written the way it is.

**The claims are sequential.** Not for lock ordering — there is none — but
because the driver forbids anything else: *"Running operations in parallel is
not supported during a transaction. The use of `Promise.all`, `Promise.allSettled`,
`Promise.race`, etc to parallelize operations inside a transaction is undefined
behaviour."* A `for…of` with `await` is the whole answer.

**`expectedTotalCents` is the authorised amount.** Phase 3 authorised the card
for the cart total *before* calling this function. If the cart changed in
between — a second tab added a line, or the retry in chunk 3 re-read a cart that
grew — the transaction must not quietly charge a different amount than was
authorised. Comparing the recomputed total to the authorised one turns that into
`CartChangedError`, which the endpoint maps to a 409 and a fresh authorisation.
Postgres did not need this because `for update` froze the cart's product rows;
nothing here freezes the cart, so the invariant moves into the callback.

## The crash map, revisited

Phase 1's table survives with one row changed:

| Crash… | Committed state afterwards | Who repairs |
|---|---|---|
| Before the transaction starts | Nothing | Client retries with the same key |
| Inside the callback, any point | Nothing — every write with `{session}` is provisional | `withTransaction` retries if transient, else the client does |
| At commit, answer unknown | Either nothing or everything | The driver retries the commit; failing that, the client's replay finds the order or does not |
| After commit, before the response | Everything, including both outbox documents | Client retries → step 0 answers from the index |
| Worker down | Orders and outbox documents accumulate | The [relay](../../phase-2-node-services/04-outbox-relay-and-email.md) drains on return |

The "answer unknown" row is the one that grew a mechanism: Phase 1 left it
entirely to the client's replay, whereas the driver now retries the commit
itself first. Chunk 3 is about what that mechanism costs.

## Gotchas

**★ One operation without `{session}` commits outside the transaction and
survives the abort — silently.** The driver's JSDoc: an operation not given the
explicit session *"will not be part of the transaction"*. In this function that
is one missing option on `claimStock`, and the failure mode is stock decremented
for an order that was rolled back — the exact leak the transaction was
introduced to stop. The defence is structural: `claimStock` takes `session` as
a named argument and passes it unconditionally, and every collection call in
the callback is written with the option in the same position so a missing one
is visible in review.

**★ The stock guard is not redundant inside the transaction.** It is tempting
to read `p.stock` from the snapshot in step 2 and skip the `$gte`. The manual's
stale-read rule means that value can be a lie by the time the write runs; the
write-conflict mechanism would still abort a transaction whose document changed
underneath it, but only because the *write* touched the document — and the
retry would then re-run a JavaScript check against a fresh snapshot. The guard
makes the correctness independent of the check: even if the check is deleted
in a refactor, the filter cannot decrement below zero.

**★ The validator fires inside the transaction and its error is not transient.**
An order document that violates
[chapter 01's `$jsonSchema`](../01-modeling-the-store/06-constraints-that-vanish.md)
— `qty: 0`, a missing `name` on a line — fails the insert with a document
validation error, `withTransaction` does not retry it, and the request becomes
a 500. That is correct: it is a programmer error, and the validation boundary
is supposed to make it unreachable. Do not map it to a 4xx "to be safe" — a
validation failure here means the checkout code is building bad documents.

**★ `withTransaction`'s return value changed across driver majors.** Driver 6
and later return the callback's value — the docs: *"These methods return the
value that the callback returns."* Older code that ignored the return and read
results out of closure variables still works, but it is now the *wrong* shape
for chunk 3, where closure variables are the thing that goes stale across
retries. Return the result; do not stash it.

## Interview questions

**★ Two customers race the last unit inside transactions. Walk through what
each sees.** Both snapshot `stock: 1`. Both run the guarded `$inc` with their
session. The first to reach the write proceeds; the second targets a document
the first has modified and aborts with a write conflict carrying the
`TransientTransactionError` label. The driver re-runs the second callback from
the top; its new snapshot shows `stock: 0`; its guard matches nothing;
`claimStock` returns `false`; the callback throws `OutOfStockError`; the
customer gets a 409 naming the product. Nobody waited on a lock and nothing
oversold — but the loser's callback ran twice, which is the fact chunk 3 is
built on.

**★ Phase 1 read the cart under `for update`. What replaced the lock?** Nothing
replaced it; the invariant it protected moved. The lock froze the product rows
so the prices and stock read were the ones written. Here the prices come from
the snapshot — fine, they are a snapshot by definition — and the stock is
claimed by a guarded write, not read. The cart itself is not frozen, so "the
total we authorised is the total we are committing" is checked explicitly with
`expectedTotalCents`, where Postgres got it as a side effect of the lock.

---

← Prev: [The transaction](02-the-transaction.md) ·
**Overview** *(not written yet)* ·
Next → **Failure, retries and the callback** *(not written yet)*
