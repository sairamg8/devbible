---
title: "Concurrency and failure"
sidebar_label: "2 · Concurrency & failure"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span> · Chapter 2 of
[The checkout transaction](README.md)

> Verified: 2026-08 against PostgreSQL 17 documentation — transaction
> isolation, explicit locking and deadlocks, error codes 40001/40P01/23514.

## The problem

[Chunk 1](01-the-transaction.md) is correct in a quiet database. This chunk
defends it in a loud one: two buyers racing the last unit, overlapping carts
locking in different orders, crashes at every arrow of the sequence, and the
retry policy that ties it together.

## Two buyers, one unit

Both transactions reach the locking select for product 42 with `stock = 1`:

1. **A** acquires the row lock; **B blocks** at `for update` — not an error, a
   queue.
2. A checks `1 >= 1`, decrements, commits. Stock is 0.
3. B's select now returns — and here is the part worth being exact about:
   under `read committed` (the default, and this app's level), the locking
   select **re-evaluates against the newly committed row**. B sees
   `stock = 0`.
4. B's JavaScript check throws `OutOfStockError`; B's transaction rolls back;
   the buyer gets the friendly 409 (Phase 3 maps it).

Two safety nets sit behind that check, both deliberately redundant: if a code
path ever updated without locking first, `check (stock >= 0)` still rejects
the decrement (`23514`, mapped to the same user error) — the constraint is
the invariant, the lock is the fairness, the JS check is the friendliness.

## Why `read committed` and not `serializable`

`serializable` would let checkout drop the explicit locks — Postgres would
detect the stock race and abort one side with `40001`, which the app must
retry. The trade: every checkout needs a retry loop, aborts grow with
contention on *hot* rows (popular products are exactly that), and the failure
arrives at commit after all the work. Explicit `for update` pays a small,
predictable cost — waiting on a lock — exactly where contention exists, and
needs no retry for the common race. The
[MVCC phase](../../../../postgresql/pages/phase-11-mvcc/README.md) covers when
`serializable` is the better trade (invariants spanning rows you *don't*
touch); checkout's invariant lives in rows it locks, the case explicit
locking serves best.

## Deadlock, and the ordering rule

Cart A holds `{keyboard, desk}`, cart B holds `{desk, keyboard}`. Locked in
cart order, A takes keyboard and waits for desk, B takes desk and waits for
keyboard — deadlock; Postgres kills one after `deadlock_timeout` with
`40P01`. The fix is chunk 1's `order by ci.product_id … for update`: **every
transaction acquires product locks in ascending id order**, so lock graphs
cannot cycle. This is a *convention*, only as strong as its observance —
every future code path that locks multiple products (admin bulk stock
updates, Phase 2's reconciliation job) follows the same order, and the rule
is written in the data-layer chapter so it is findable, not tribal.

Deadlock can still occur against code that doesn't follow the rule (a manual
`psql` session, a bug). So the retry policy exists anyway:

```js
// db/tx.js — the retry wrapper checkout runs under (Phase 2 owns withTransaction)
const RETRYABLE = new Set(['40001', '40P01']);

export async function withRetry(fn, {attempts = 3} = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!RETRYABLE.has(err.code) || attempt >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 50 * attempt + Math.random() * 100));
    }
  }
}
// usage: withRetry(() => checkout(pool, payload))
```

The retry unit is **the whole transaction** — never a statement inside it: after
`40001`/`40P01` the transaction is dead, and the replay-safe design (the
idempotency claim is *inside* the retried function) is what makes blanket
retry correct. Backoff-with-jitter reasoning lives in the
[Node backoff page](../../../../nodejs/pages/phase-7-background-work/15-backoff-and-jitter.md).

## The crash map

What every failure point leaves behind — the table to internalize:

| Crash… | Committed state afterwards | Who repairs |
|---|---|---|
| Before the order insert | Nothing | Client retries with the same key |
| After insert, before commit | Nothing — the claim rolls back with the transaction | Client retries; key is free again |
| At commit (connection lost, answer unknown) | Either nothing or everything | Client retries; replay path returns the order if it committed |
| After commit, before the HTTP response | Everything, including outbox rows | Client retries → replay path; email/webhook were never at risk — the worker owes them regardless |
| Worker down for an hour | Orders and outbox rows accumulate | Worker drains on return; `processed_at is null` is the queue |

The rows in this table are the whole argument for the outbox: the side-effects
are *state*, not actions, so a crash can only delay them — never lose them.
The "answer unknown" row is why idempotency keys exist at all: it is the one
case the client genuinely cannot distinguish success from failure.

## Gotchas

- **Symptom:** under load, checkouts queue up behind one hot product and
  latency spikes. **Cause:** `for update` serializes buyers of the same
  product — that is its job; fairness has a queue. **Fix:** first check it
  matters (the queue clears at commit speed, single-digit ms each). If a
  flash-sale product genuinely needs more, `for update` on a *stock-bucket*
  row set (split one product's stock across N rows) trades complexity for
  parallelism — a named, deferred option, not a default.
- **Symptom:** `40P01` in production logs, rare. **Cause:** some path locked
  products in non-ascending order — the convention leaked. **Fix:** the retry
  already smoothed the user impact; grep the log's second statement for the
  path and fix its ordering. A deadlock is always a bug report about lock
  order somewhere.
- **Symptom:** a load test with `serializable` (someone "upgraded" safety)
  shows checkout failures at 10× the old rate. **Cause:** `40001` aborts on
  hot rows are the design behaviour of SSI under contention. **Fix:** this
  chapter's level choice was deliberate; revert, or keep serializable *and*
  accept the retry-rate budget. Isolation levels are trade-offs, not
  virtue levels.

## Interview questions

1. **★ Two customers race the last unit — walk through what each sees.** The
   answer is the four-step sequence above; the marker of understanding is
   step 3: `read committed`'s locking reads re-evaluate against the new
   committed version after the lock clears, so B sees 0, not the snapshot's 1.
2. **★ Why lock in ascending product-id order?** Deadlocks need a cycle in
   the waits-for graph; a global acquisition order makes cycles impossible.
   Any total order works — id is simply the one every table already has. The
   subtlety worth saying: the guarantee is only as global as the convention's
   adoption, hence the retry net stays.
3. **Why is retrying the whole transaction safe here, when "retry a
   non-idempotent write" is the classic mistake?** Because the transaction
   *is* idempotent by construction — its first write claims the idempotency
   key, so a retry either finds the key free (previous attempt rolled back:
   redo is correct) or claimed (previous attempt committed: replay path
   returns the original). The retry-safety analysis lives one level up in
   the [retry-safety concept](../../../../nodejs/pages/phase-7-background-work/14-retry-safe-failures.md).
4. **What would change if stock lived in Redis for speed?** The decrement
   leaves the transaction — a crash between Redis and Postgres now loses or
   double-counts stock, and the outbox can't help because Redis isn't in the
   commit. The honest versions are: keep stock in Postgres (this design), or
   move *reservation* to Redis with reconciliation accepting oversell. "Fast
   inventory" is a consistency decision wearing a performance costume.

---

← Prev: [The transaction](01-the-transaction.md) ·
Topic index: [The checkout transaction](README.md) ·
Next → [Money and time](../07-money-and-time.md)
