---
title: "Across a network the gap is enormous: the database constraint, not your SELECT, is what enforces uniqueness — and the queue documentation says outright that empty() does not promise get() will succeed"
sidebar_label: "02c · Databases, queues, and when LBYL clears"
sidebar_position: 124
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [`sqlite3` exceptions](https://docs.python.org/3.14/library/sqlite3.html#exceptions)
> (`IntegrityError`, `OperationalError`),
> [`queue`](https://docs.python.org/3.14/library/queue.html)
> (`qsize`, `empty`, `full`, `get`, `Empty`),
> [Glossary: `LBYL`](https://docs.python.org/3.14/glossary.html#term-LBYL).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run** — no database was
> queried to write this page.

**Every gap grows with the distance to the state. Between two bytecode instructions it
is nanoseconds; between two SQL statements it is a network round trip, and between a
health check and a request it is however long your connection pool takes. That is why
`SELECT`-then-`INSERT` produces the duplicate row it was written to prevent, and why the
`queue` module's own documentation refuses to let `empty()` mean anything: *"if `empty()`
returns `False` it doesn't guarantee that a subsequent call to `get()` will not block."*
The remedy in each case is the same shape as everywhere else — let the component that
owns the invariant enforce it, and translate its failure. And then the closing question
of this chunk: the large fraction of checks where none of this applies, and LBYL is
simply correct.**

## Databases: the constraint is the only real check

`SELECT` then `INSERT` is the same two-operation pattern with a network in the gap, and
under concurrency it produces exactly the duplicate row it was written to prevent.

```python
import sqlite3

# 🔴 LBYL across a connection boundary. Two statements, one gap.
def register_lbyl(conn, email: str) -> int:
    row = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if row is not None:
        raise EmailTaken(email)
    cur = conn.execute("INSERT INTO users (email) VALUES (?)", (email,))
    return cur.lastrowid

# The database owns the invariant, so let it enforce it and translate the failure.
def register(conn, email: str) -> int:
    try:
        cur = conn.execute("INSERT INTO users (email) VALUES (?)", (email,))
    except sqlite3.IntegrityError as exc:
        raise EmailTaken(email) from exc
    return cur.lastrowid
```

`sqlite3.IntegrityError` is documented as *"raised when the relational integrity of the
database is affected, e.g. a foreign key check fails"* — a `UNIQUE` constraint violation
is the same family. Note the shape of the correct version: the leap happens, the
database's failure is caught, and it is **translated** into a domain exception with
`raise ... from` so the original stays attached as the cause. Chaining, and why
`from exc` matters rather than a bare `raise`, is [topic
11's](../11-exceptions/06b-exception-chaining.md) subject.

⚠️ The LBYL version is not *useless* — for a friendly form response you may well want to
pre-check so you can render "that email is taken" next to the field without attempting a
write. The rule is that the pre-check is a **UX affordance, not the invariant**: the
constraint stays in the schema, the `except` stays in the code, and the `SELECT` is
allowed to be wrong.

## Where the race test says LBYL is fine

The gap only matters if something can write to the state. It cannot, when:

- **The value is a local** — a parameter, a freshly built object, a value you just
  computed. `if amount <= 0` cannot race with anything.
- **The object is immutable** — a `tuple`, a `str`, a frozen dataclass, an `int`. There
  is no interleaving that changes what a check on it means.
- **The data has one owner** — a dict built inside the function and never published, a
  structure protected by a lock you hold for the whole operation, or a single-threaded
  script with no subprocesses touching the same files.
- **The check is about your own request, not the world** — validating a payload's shape,
  a range, a length, an enum membership.

That is a large fraction of all real checks, and it is why "always EAFP" is as wrong as
"always LBYL". Ask which side of that list your state is on; the answer is usually
immediate.

## Queues and other "is it ready" checks

The `queue` documentation is unusually blunt about the value of a pre-check, and it is
worth reading as the general statement of the problem:

> `Queue.empty()` — *"Return `True` if the queue is empty, `False` otherwise. If `empty()`
> returns `True` it doesn't guarantee that a subsequent call to `put()` will not block.
> Similarly, if `empty()` returns `False` it doesn't guarantee that a subsequent call to
> `get()` will not block."*

> `Queue.qsize()` — *"Return the approximate size of the queue. Note, `qsize() > 0`
> doesn't guarantee that a subsequent `get()` will not block, nor will `qsize() < maxsize`
> guarantee that `put()` will not block."*

Note the word *approximate*: the library is telling you the look is not merely stale, it
was never exact. The leap has its own answer channel — `get(block=False)` *"return[s] an
item if one is immediately available, else raise[s] the `Empty` exception"* — so the
correct consumer loop asks the queue to do both at once.

```python
import queue

# 🔴 The check the docs disown, followed by a get that can still block forever.
def drain_broken(q: queue.Queue) -> list[str]:
    items = []
    while not q.empty():
        items.append(q.get())
    return items

# One operation. The exception is the "nothing there" answer, and it cannot be stale.
def drain(q: queue.Queue) -> list[str]:
    items = []
    while True:
        try:
            items.append(q.get_nowait())
        except queue.Empty:
            return items
```

The same reasoning covers every "is the remote thing ready" check: a TCP reachability
probe before a send, a `HEAD` before a `GET`, a "does the S3 key exist" before a
download, a token-expiry check before an API call. All of them look at one moment and act
in another, over a link whose latency is orders of magnitude larger than the gap between
two bytecodes. The operation is the only test that is not out of date, and its failure
arrives typed: `TimeoutError`, `ConnectionRefusedError`, an HTTP 404, a 401 that tells you
to refresh the token.

## Gotchas

**★ Symptom: duplicate rows in a table whose application code checks "does it exist"
everywhere.** Cause: `SELECT`-then-`INSERT` under concurrency; the gap spans a network
round trip, which is enormous compared with anything the interpreter does. Fix: a
`UNIQUE` constraint plus an `except IntegrityError` that translates it into a domain
error — the pre-check may stay for UX, but it is not what enforces uniqueness.

```python
try:
    cur = conn.execute("INSERT INTO users (email) VALUES (?)", (email,))
except sqlite3.IntegrityError as exc:
    raise EmailTaken(email) from exc
```

**★ Symptom: a consumer loop written with `while not q.empty()` occasionally hangs, or
exits while items are still arriving.** Cause: the documentation's own warning — `empty()`
does not predict `get()`, in either direction. Fix: `get_nowait()` (or `get(timeout=...)`)
inside `try`/`except queue.Empty`, which asks and takes in one operation.

**★ Symptom: a reachability probe passes and the request that follows fails.** Cause: the
probe and the request are separate connections; reachability at time T says nothing about
time T+ε, and the probe can be answered by a load balancer with no healthy backend behind
it. Fix: send, catch `OSError`/`TimeoutError`, retry with backoff. The send is the only
real reachability test.

**Symptom: `SELECT`-then-`UPDATE` loses one of two concurrent updates.** Cause:
read-modify-write across a network — both transactions read the old row and both write
their own version. Fix: make the database decide: an `UPDATE ... WHERE version = ?`
whose affected-row count of zero means "someone beat me", a `SELECT ... FOR UPDATE`, or a
single atomic statement (`UPDATE accounts SET balance = balance - ?`). No exception
handler around the pair fixes it, exactly as with the in-memory counter.

**Symptom: a "check the token has not expired, then call the API" wrapper still gets
401s.** Cause: the clock check is a look, and the token can be revoked, rotated or
rejected for reasons your expiry field cannot see. Fix: call, catch the 401, refresh once
and retry — and keep the expiry check only as an optimisation that avoids a doomed call,
never as the correctness mechanism.

**Symptom: a file-upload endpoint checks free disk space, then writes, then fails
mid-write.** Cause: the space was there when looked at and consumed by another writer.
Fix: write to a temporary file, handle `OSError` with `errno.ENOSPC`, and move it into
place on success; the partial file is discarded rather than served.

**Symptom: an idempotency check ("have we processed this webhook id?") lets a duplicate
through under retry storms.** Cause: `SELECT`-then-`INSERT` again, with the retry
providing the concurrency. Fix: the processed-ids table gets a primary key on the id, and
the insert's `IntegrityError` *is* the "already processed" signal — a check that cannot
be raced because the database performs it as part of the write.

**Symptom: a batch job "verifies the connection" at startup and then dies on the first
query an hour later.** Cause: a look at startup, a leap much later — the pool's
connections were recycled, the failover moved the primary, the credentials rotated. Fix:
treat every query as able to raise `OperationalError` — documented as *"errors that are
related to the database's operation, and not necessarily under the control of the
programmer"* — and reconnect on it rather than trusting a startup probe.

## Interview questions

**★ A colleague pre-checks for a duplicate email before inserting, and also has a
`UNIQUE` constraint. Is the pre-check wrong?**
Not necessarily — but it must be understood as a user-experience affordance, not as the
enforcement mechanism. It lets you render a friendly field-level error without attempting
a write. Under concurrency it will occasionally pass and the insert will still violate
the constraint, so the `except IntegrityError` path has to exist and has to translate the
error into the same domain exception. What *would* be wrong is dropping the constraint
because the code checks.

**★ Under what circumstances is an LBYL check provably race-free?**
When nothing else can reach the state between the check and the use: locals and
parameters, immutable objects, structures with a single non-concurrent owner, and checks
about the shape of your own inputs rather than about the world. That covers most argument
validation — which is why the honest rule is not "prefer EAFP" but "establish who owns
the state", because the answer then decides the style for you.

**★ Why does the `queue` documentation bother to say that `empty()` guarantees nothing?**
Because the natural way to write a consumer is `while not q.empty(): q.get()`, and that
is a two-operation LBYL pattern against state another thread owns. The docs close the
door on it explicitly in both directions — a `False` does not promise `get()` will not
block, and a `True` does not promise `put()` will not block — and give you the
single-operation alternative, `get_nowait()` raising `Empty`. It is the clearest
standard-library example of a check that exists only for reporting.

**How do you make "insert if absent" correct across concurrent requests?**
Push the decision into the store, so testing and acting are one operation. In SQL that is
a `UNIQUE` constraint with the violation caught and translated, or an `INSERT ... ON
CONFLICT DO NOTHING` / `MERGE` where the dialect offers it. In Python's own terms it is
the same move as `open(path, "x")` or `dict.setdefault`: one call that both decides and
acts, with a documented failure channel for the loser.

**The gap between two bytecodes is nanoseconds and races feel unlikely. Why do
network-mediated versions of the same pattern break so much sooner?**
Because the gap is the window, and probability scales with it. Two SQL statements are
separated by a round trip; a startup probe is separated from the first query by however
long startup takes. Anything sharing that state — another request, another worker, a
retry storm, a failover — gets the whole interval to act. It is the same defect as the
in-memory one, sampled often enough that it is guaranteed rather than rare.

**Where does retrying fit into all this?**
It is the operational half of EAFP. Once the operation is the check, its failure is a
typed, catchable event — which is exactly what a retry policy needs to distinguish
"transient, try again" (`OperationalError`, `TimeoutError`, a 503) from "permanent, do
not" (`IntegrityError`, a 400, a `ValueError`). LBYL gives you a boolean and no
taxonomy, so retry logic built on checks ends up retrying things that will never
succeed.

---

← Prev: [The filesystem and the atomic flag](02b-the-filesystem-and-the-atomic-flag.md) · Index: [EAFP vs LBYL](README.md) · Next → [Mappings: the decision table](03-mappings-the-decision-table.md)
