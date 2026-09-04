---
title: "You do not apologise for a money movement: in front of a leap that cannot be retried the pre-check earns its place even though it is stale the moment it passes, and the residual race is closed by claiming the work before doing it"
sidebar_label: "05d · Irreversible leaps"
sidebar_position: 134
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [Glossary: `LBYL`, `EAFP`](https://docs.python.org/3.14/glossary.html#term-LBYL),
> [`sqlite3` — `Cursor.rowcount`](https://docs.python.org/3.14/library/sqlite3.html#sqlite3.Cursor.rowcount)
> and [`sqlite3` exceptions](https://docs.python.org/3.14/library/sqlite3.html#exceptions),
> [`Path.mkdir(exist_ok=True)`](https://docs.python.org/3.14/library/pathlib.html#pathlib.Path.mkdir).
> SQL shown is SQLite and PostgreSQL dialect as labelled; **no database was queried** —
> documentation-validated, **no sandbox run**. Target: **Python 3.14**.

**Every argument against LBYL in this topic reduces to one claim: the leap is a better
test than the look, so make the leap and handle its failure. That claim quietly assumes
the failed leap is *free* — that you can throw the attempt away and try again. Charge a
card, send forty thousand receipts, `DROP` a column or `POST` to a partner's webhook and
the assumption is gone: the failed attempt is now a fact in someone else's system. In
front of an operation like that the pre-check is right, and it is right *even though it is
stale the moment it passes*, because it converts almost every bad call into a domain error
before the irreversible thing happens. What it does not do is close the race — that is
what claiming the work before doing it is for.**

## The axis is retryability, not reversibility

"Reversible" is the wrong word and it misclassifies the most dangerous cases. A refund is
a perfectly good reverse of a charge in accounting terms, and it is still a second line on
a stranger's bank statement and a support ticket. The question that decides the style is
narrower: **if this operation fails or is repeated, can I discard the attempt and try
again with no observable consequence?**

| Operation | Repeat it | Style |
|---|---|---|
| `Path(p).mkdir(parents=True, exist_ok=True)` | idempotent by construction | EAFP — the flag *is* the check |
| a cache read, an HTTP `GET`, a `SELECT` | free | EAFP |
| `INSERT ... ON CONFLICT DO NOTHING` (PostgreSQL) | idempotent | EAFP — catch nothing, the store decides |
| `PUT`/`POST` carrying an idempotency key the provider honours | safe | EAFP, *because* the key made it safe |
| `Path(p).unlink(missing_ok=True)` | idempotent | EAFP |
| a payment capture with no idempotency key | 🔴 double charge | LBYL, then claim |
| an email, SMS or push notification | 🔴 cannot be un-sent | LBYL, then claim |
| a hard `DELETE` with no soft-delete column | 🔴 gone | LBYL, and a rowcount guard |
| `ALTER TABLE ... DROP COLUMN` | 🔴 restore from backup | LBYL, and a human |
| a webhook `POST` into a partner's system | 🔴 they have already reacted | LBYL, then claim |

The right-hand column is the whole recommendation of this chunk, and note what the top
half says: **most operations are in it.** EAFP is the default because most leaps are
retryable. The exceptions are exactly the ones where a mistake is expensive enough to be
worth two operations.

## The pre-check in front of an irreversible leap

```python
from enum import Enum


class OrderStatus(Enum):
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    CANCELLED = "cancelled"


def capture_payment(order, gateway) -> Capture:
    if order.status is not OrderStatus.AUTHORIZED:
        raise NotCapturable(order.id, order.status)
    if order.captured_at is not None:
        raise AlreadyCaptured(order.id, order.captured_at)
    if order.amount_cents != order.authorization.amount_cents:
        raise AmountMismatch(
            order.id, order.amount_cents, order.authorization.amount_cents
        )
    return gateway.capture(order.authorization.token, order.amount_cents)
```

**The honest ownership audit, which every LBYL example in this chunk owes you:** `order`
was loaded from the database. It is shared state. Another request, a support tool or a
retry can capture, cancel or amend that order between the `if` and the `gateway.capture`
call, so all three checks are claims about the past — exactly the defect
[the race between look and leap](02-the-race-between-look-and-leap.md) is about.

That does not make them pointless, and this is the distinction the "always EAFP" reading
misses. There are two populations of bad calls:

- **The overwhelming majority** — a double-click, a stale browser tab, a buggy caller, a
  cancelled order — are wrong *before* the check runs. The `if` catches all of these and
  produces `NotCapturable` with the order id and the status, which is a 409 and a useful
  log line.
- **The residual** — the order changed *inside the gap* — is a genuine race, and no
  arrangement of `if`s fixes it.

EAFP would leave the first population to be discovered by the gateway, which answers with
its own vocabulary (a declined card, an HTTP 422, a provider error code) after the call
has already been made. The check is worth two operations because the leap costs money and
the look costs a comparison.

The residual race — the order that changed *inside* the gap — is closed by claiming the
work before doing it, which is [05e](05e-claim-then-leap.md).

## Gotchas

**Symptom: a staging `DELETE` removed every row because a filter variable was `None` and
the `WHERE` clause matched everything.** Cause: an irreversible statement with no guard on
its blast radius. Fix: run it in a transaction and make the *expected* row count part of
the check — a mismatch rolls back.

```python
with conn:                                    # rolls back if this block raises
    cur = conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    if cur.rowcount > MAX_SESSIONS_PER_USER:
        raise TooManyRowsAffected(f"refusing to delete {cur.rowcount} sessions")
```

**Symptom: an operation is "safe to retry" in the runbook and produces duplicates in
practice.** Cause: idempotency was assumed rather than implemented — the endpoint accepts a
key but the provider ignores it, or the key is regenerated per attempt (a fresh `uuid4()`
inside the retry loop). Fix: derive the key from the *business* identity of the work, not
from the attempt.

```python
idempotency_key = f"capture:{order_id}"      # stable across every retry
```

**★ Symptom: a destructive migration ran against the wrong database, and the only way back
is a restore.** Cause: an irreversible statement whose target was supplied by an
environment variable nobody re-read. Fix: make the script look before it leaps, at
something only the intended database can answer, and refuse otherwise — this is LBYL on
state that is shared but changes on a scale of months, which is the one class of shared
state a check genuinely covers.

```python
EXPECTED_FINGERPRINT = "orders-service-prod"


def guard_target(conn) -> None:
    row = conn.execute("SELECT value FROM deployment_meta WHERE key = 'name'").fetchone()
    if row is None or row[0] != EXPECTED_FINGERPRINT:
        raise WrongDatabase(f"expected {EXPECTED_FINGERPRINT}, found {row and row[0]!r}")
```

**Symptom: the user is shown "provider error 51: insufficient funds" instead of a message
your product wrote.** Cause: no pre-check, so the first component to notice the problem was
the gateway, and its vocabulary reached the surface. Fix: check the conditions you can
state in your own domain *before* the leap, and reserve the provider's errors for what only
the provider knows.

```python
if order.status is not OrderStatus.AUTHORIZED:
    raise NotCapturable(order.id, order.status)   # your words, your fields, a 409
```

## Interview questions

**★ "You do not apologise for a money movement." What does that mean mechanically?**
That EAFP's core assumption — a failed leap can be discarded and retried — does not hold
for the operation, so making the leap in order to test it is not a cheap experiment but a
side effect in someone else's system. Concretely: the check runs first because a
`NotCapturable` error costs a comparison and a 409, while discovering the same fact from
the gateway costs a real authorisation attempt, a provider error, possibly a hold on the
customer's card and a support ticket. It is not that exceptions are unsuitable — the
mechanism you end up with still raises — it is that the *test* must not be the operation.

**★ Is reversibility or retryability the right axis, and why does it matter?**
Retryability. Reversibility is about whether you can construct a compensating action, and
almost everything is reversible in that weak sense: a charge can be refunded, a `DELETE`
can be restored from a backup, an email can be followed by an apology. None of that makes
the attempt free, because the compensation is *observable* — the customer sees two lines on
a statement. Retryability asks the operational question: if I do this twice, or fail
halfway, does anything outside my process notice? If the answer is no, EAFP; if it is yes,
check first and claim.

**★ If the pre-check is stale the instant it passes, why write it at all?**
Because it addresses a different population of failures from the race. Almost every bad
capture request is bad *before* the check runs — a cancelled order, a stale tab, a
double-click, a caller with the wrong id — and the `if` turns all of those into a domain
error with domain data before any money moves. The race is the residual: the order changed
inside the gap. The correct posture is to do both, and to know which mechanism handles
which: the `if` for the common case and the message quality, the atomic claim for the race.
Deleting the check because it does not close the race throws away the part that was
working.

**Which class of shared state does a pre-check genuinely cover?**
State that changes on a timescale far longer than the gap. A deployment fingerprint, a
schema version, a feature flag read at boot, the identity of the database you are connected
to — these are shared in principle and effectively static in practice, so a check on them is
not meaningfully stale by the time the next statement runs. That is why a destructive
migration guard is sound while a balance check is not: both look at shared state, but only
one of them looks at state something else is actively writing. The question to ask is never
"is this state shared" alone; it is "what is the rate of change relative to my gap".

---

← Prev: [The quiet boundaries](05c-the-quiet-boundaries.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [Claim, then leap](05e-claim-then-leap.md)
