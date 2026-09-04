---
title: "Claim the work before you do it: the decision to perform an irreversible side effect can be made atomic even when the side effect cannot, and what is left is a choice between at-most-once and at-least-once that you make on purpose"
sidebar_label: "05e · Claim, then leap"
sidebar_position: 135
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [`sqlite3` — `Cursor.rowcount`](https://docs.python.org/3.14/library/sqlite3.html#sqlite3.Cursor.rowcount),
> [`sqlite3` — Transaction control](https://docs.python.org/3.14/library/sqlite3.html#sqlite3-controlling-transactions)
> (the connection context manager commits or rolls back),
> [Glossary: `LBYL`](https://docs.python.org/3.14/glossary.html#term-LBYL).
> SQL is SQLite dialect except where labelled PostgreSQL; **no database was queried** —
> documentation-validated, **no sandbox run**. Target: **Python 3.14**.

**[05d](05d-irreversible-leaps.md) left one problem open: the pre-check in front of a
capture handles almost every bad call and none of the races. The repair is not a better
check — it is to notice that although you cannot make "send an email" atomic, you can make
*the decision to send it* atomic, because that decision lives in a database you control. A
conditional `UPDATE` or an `INSERT` against a primary key is a test-and-set the store
performs as part of the write, so the loser finds out by `rowcount == 0` rather than by
racing. What remains after that is not a bug to fix but a trade to choose: claim first and
risk losing a receipt, or send first and risk sending it twice.**

## Claim, then leap

The residual race is closed by making the *decision to act* a single atomic operation, and
only then acting. The pattern has two steps and they must be in this order: claim the work
in the store, then perform the side effect.

```python
from datetime import datetime, timezone


def send_receipt(conn, order_id: str, mailer) -> bool:
    """Claim the receipt, then send it. Returns False if someone else claimed it."""
    now = datetime.now(timezone.utc).isoformat()
    with conn:                                        # one transaction, then commit
        cur = conn.execute(                           # SQLite dialect
            "INSERT OR IGNORE INTO receipts_sent (order_id, sent_at) VALUES (?, ?)",
            (order_id, now),
        )
        if cur.rowcount == 0:
            return False                              # already claimed: do not re-send
    mailer.send_receipt(order_id)                     # side effect OUTSIDE the transaction
    return True
```

`receipts_sent.order_id` is the primary key, so the claim is the database's own
test-and-set; PostgreSQL spells it `INSERT ... ON CONFLICT DO NOTHING`. This is the same
move as `open(path, "x")` and `dict.setdefault` — one operation that both decides and
acts — applied to the decision rather than to the side effect, because the side effect
itself cannot be made atomic.

The same shape for the capture, where the claim is a conditional `UPDATE`:

```python
def capture_payment(conn, order_id: str, gateway) -> Capture | None:
    with conn:
        cur = conn.execute(
            """UPDATE orders SET captured_at = ?
                WHERE id = ? AND status = 'authorized' AND captured_at IS NULL""",
            (datetime.now(timezone.utc).isoformat(), order_id),
        )
        if cur.rowcount == 0:
            raise NotCapturable(order_id, "not authorized, or already captured")
        row = conn.execute(
            "SELECT auth_token, amount_cents FROM orders WHERE id = ?", (order_id,)
        ).fetchone()
    return gateway.capture(row[0], row[1], idempotency_key=order_id)
```

The `WHERE` clause contains the pre-conditions from the LBYL version, and `rowcount == 0`
is how a failed pre-condition reports itself — a check that **cannot** be raced, because
the database evaluated it as part of the write.

🔴 **And now the trade you have actually made, stated honestly.** Claim-then-leap is
*at-most-once*: if the process dies after the commit and before `gateway.capture`, the
order is marked captured and no money moved. Reversing the order gives *at-least-once*:
the money moves and a crash before the mark means a second attempt charges again. There
is no arrangement of two systems that gives exactly-once, and the three real answers are:

1. **At-most-once plus reconciliation** — claim first, and run a job that finds claimed-
   but-unconfirmed rows and finishes or releases them.
2. **At-least-once plus provider idempotency** — leap first, carrying a key the provider
   deduplicates on (`idempotency_key=order_id` above), so the retry is *the same
   operation* rather than a second one.
3. **An outbox** — commit the intent as a row in the same transaction as the business
   change, and let a worker perform the side effect and mark it done, retrying with the
   key from (2).

Option 2 is why the table at the top of this chunk lists an idempotency-keyed `POST` under
EAFP: the key is what converts an irreversible leap into a retryable one, which is a far
stronger fix than any pre-check.

## Gotchas

**★ Symptom: two identical charges on one card, seconds apart, after a user double-clicked
or a client retried a timeout.** Cause: an irreversible leap with no claim step — both
requests read the same `AUTHORIZED` order, both passed the check, both captured. Fix: make
the transition the claim, and pass an idempotency key so even a retry of the *same* request
cannot charge twice.

```python
with conn:
    cur = conn.execute(
        "UPDATE orders SET captured_at = ? WHERE id = ? AND captured_at IS NULL",
        (now, order_id),
    )
    if cur.rowcount == 0:
        raise AlreadyCaptured(order_id)
gateway.capture(token, amount_cents, idempotency_key=order_id)
```

**★ Symptom: forty thousand customers receive the same receipt twice after a deploy or a
worker restart.** Cause: the batch had a single "sent" flag written at the end, so a crash
at recipient 25,000 re-sent the first 25,000 on restart. Fix: claim **per recipient**, not
per batch — the unit of idempotency must be the unit of the side effect.

```python
for order_id in pending_order_ids(conn):
    if send_receipt(conn, order_id, mailer):     # claims one row, then sends one mail
        log.info("receipt sent", extra={"order_id": order_id})
```

**★ Symptom: a rollback "un-sends" nothing, and customers hold receipts for orders that do
not exist.** Cause: the mail was sent inside the transaction, so a later failure rolled back
the database and left the side effect standing. Fix: commit the claim first and perform the
side effect after the transaction closes — or record an outbox row inside the transaction
and let a worker send it.

```python
with conn:
    conn.execute("INSERT INTO outbox (kind, payload) VALUES ('receipt', ?)", (order_id,))
    conn.execute("UPDATE orders SET status = 'captured' WHERE id = ?", (order_id,))
# a separate worker drains `outbox` and sends, retrying with an idempotency key
```

**★ Symptom: a retry after a gateway timeout charges the customer twice, even though the
first response never arrived.** Cause: an *ambiguous* failure — the network failed, not the
operation, so "did it happen" is unknowable from your side. Fix: never retry a money
movement without an idempotency key the provider honours; where none exists, reconcile by
querying the provider for the key before retrying, and treat "unknown" as "do not retry
automatically".

**Symptom: the connection pool is exhausted and throughput collapses whenever the payment
gateway is slow.** Cause: the transaction (or lock) was held across the network call, so
every in-flight capture pins a connection for the gateway's latency. Fix: claim inside the
transaction, commit, and leap outside it — the shape `send_receipt` above uses deliberately.

**Symptom: two workers both process the same job because the claim used
`SELECT ... WHERE claimed_at IS NULL` followed by an `UPDATE`.** Cause: the claim was
itself written as LBYL — a read, then a write, with a gap. Fix: claim with a single
conditional statement and read the affected-row count; the `WHERE` clause is the check.

```python
with conn:
    cur = conn.execute(
        "UPDATE jobs SET claimed_at = ?, worker = ? WHERE id = ? AND claimed_at IS NULL",
        (now, worker_id, job_id),
    )
claimed = cur.rowcount == 1        # nobody else can also see 1
```

**Symptom: claimed jobs accumulate forever after a worker is killed.** Cause: at-most-once
with no reconciliation — the claim outlived the process that made it. Fix: store a claim
*expiry*, and let the reclaim be another conditional update; the job returns to the pool
without anyone deleting a row by hand.

```python
with conn:
    conn.execute(
        "UPDATE jobs SET claimed_at = NULL, worker = NULL "
        "WHERE claimed_at IS NOT NULL AND claimed_at < ?",
        (stale_before,),
    )
```

## Interview questions

**★ How do you send an email exactly once?**
You do not; two systems with a network between them cannot agree on "exactly once", and any
design claiming to is hiding which side of the trade it picked. You choose: claim the
receipt then send (at-most-once — a crash in the gap loses a receipt, and a reconciliation
job finds claimed-but-unsent rows), or send then mark (at-least-once — a crash in the gap
sends twice). The mitigation that makes at-least-once acceptable is a deduplication key the
provider honours, or an outbox row committed with the business change and drained by a
worker. What is *not* acceptable is a batch-level flag, because its failure mode is
duplicating everything up to the crash point.

**Where does the pre-check go once you know the state is shared?**
Into the write. `if order.status is AUTHORIZED` becomes
`WHERE id = ? AND status = 'authorized'`, and "the check failed" becomes `rowcount == 0`.
That is the general repair for every LBYL check on shared state, and it is the same idea as
`open(path, "x")` or `dict.setdefault`: one operation that both decides and acts, so no gap
exists to race. The Python-level `if` that remains — on the rowcount — is a check on a
*local* integer, which the ownership test clears trivially.

**Why must the side effect happen outside the transaction?**
Two reasons, and both bite in production. First, correctness: a transaction can roll back
and an email cannot, so a side effect inside it can survive a failure that erased the
reason for it. Second, capacity: the transaction holds a connection and, depending on the
statement, row locks — pinning both for the duration of a third party's latency turns a
slow gateway into an exhausted pool and a site-wide outage. Claim inside, commit, leap
outside; if the leap must be guaranteed, make the claim an outbox row and let a worker do
the leap.

**A colleague proposes wrapping the whole capture in `try`/`except Exception` and retrying
three times. What do you say?**
That retrying an operation with a side effect requires knowing whether the side effect
happened, and `except Exception` deliberately discards that information. A timeout means
"unknown", not "failed" — the charge may well have gone through, and a blind retry is how
one authorisation becomes three. The fix is to make the operation idempotent at the
provider with a stable key derived from the order, and only then retry; where the provider
offers no key, the retry must be a reconciliation (ask the provider what happened for this
order) rather than a repeat of the call.

**What makes an atomic claim different from an LBYL check, given both are conditions?**
Where the condition is evaluated. `if order.captured_at is None` is evaluated by your
process against a value copied out of the database some milliseconds ago; `WHERE captured_at
IS NULL` is evaluated by the database, inside the same statement that performs the write,
against the row as it exists at that instant. The first is a claim about the past that a
concurrent writer can invalidate; the second cannot be invalidated because there is no
interval between the test and the effect. This is exactly the `open(path, "x")` idea —
[the filesystem and the atomic flag](02b-the-filesystem-and-the-atomic-flag.md) — moved
from the filesystem to a table.

**Why is `rowcount == 0` a better failure channel than an exception here?**
Because it is not a failure of the *system*, it is the answer to a question you asked: did
I win the claim? Nothing went wrong when another worker got there first, so an exception
would be over-stating it — and a handler around a conditional `UPDATE` would also catch
genuine database faults you must not treat as "someone else claimed it". Where the caller
does want an exception, translate explicitly (`if cur.rowcount == 0: raise
AlreadyCaptured(order_id)`), which keeps the two meanings separate.

---

← Prev: [Irreversible leaps](05d-irreversible-leaps.md) · Index: [EAFP vs LBYL](README.md) · Next → [The asymmetry](05f-the-asymmetry.md)
