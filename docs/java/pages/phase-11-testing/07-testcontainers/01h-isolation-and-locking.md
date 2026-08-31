---
title: "Two engines, one set of isolation level names, and opposite answers — H2's REPEATABLE READ allows phantoms, its SERIALIZABLE does not serialize writes, and its SKIP LOCKED is documented as undefined for the query you would use it in"
sidebar_label: "01h · Isolation and locking"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **H2 2.x documentation** — *Advanced → Transaction Isolation*,
> *→ Multi-Version Concurrency Control (MVCC)* and *→ Lock Timeout*
> ([advanced.html](https://www.h2database.com/html/advanced.html)) and *Commands → `SELECT`*
> ([commands.html](https://www.h2database.com/html/commands.html)) — and the **PostgreSQL 18
> manual**, *Transaction Isolation*
> ([transaction-iso](https://www.postgresql.org/docs/18/transaction-iso.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, Testcontainers 2.0.5,
> **H2 2.4.240**, PostgreSQL JDBC 42.7.11, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker, no PostgreSQL and no sandbox on this machine.** Nothing here is a query log, a
> timing or a test run.

**[01g](01g-transactional-ddl-and-which-schema.md) asked what a transaction contains. This page
asks what it *protects*, and the answer is different on the two engines for the same level name.
Every entry here is invisible to a test with one connection — which is what a repository test has —
so this is the section of the catalogue with the largest gap between what a suite appears to cover
and what it can possibly have observed. What a violation or a conflict then *raises* is
[01h2](01h2-what-a-violation-raises.md).**
## Isolation and locking

### The levels do not mean the same thing

Both engines default to `READ COMMITTED`, and both say so. Past that they part company.

PostgreSQL:

> *"In PostgreSQL, you can request any of the four standard transaction isolation levels, but
> internally only three distinct isolation levels are implemented, i.e., PostgreSQL's Read
> Uncommitted mode behaves like Read Committed."*

H2 offers five named levels: `READ UNCOMMITTED`, `READ COMMITTED`, `REPEATABLE READ`, `SNAPSHOT`
and `SERIALIZABLE`.

| Level | PostgreSQL 18 | H2 2.4.240 |
|---|---|---|
| `READ UNCOMMITTED` | behaves as `READ COMMITTED` | dirty reads possible |
| `READ COMMITTED` | default; statement-level snapshot | default; dirty reads impossible |
| `REPEATABLE READ` | **phantoms impossible** (snapshot isolation) | **phantoms possible** |
| `SNAPSHOT` | no such level | dirty, non-repeatable and phantom reads impossible |
| `SERIALIZABLE` | true serializability via predicate locks (SSI) | **does not ensure serializable execution for writes** |

The `REPEATABLE READ` row is not a nuance. PostgreSQL:

> *"The table also shows that PostgreSQL's Repeatable Read implementation does not allow phantom
> reads."*

H2:

> *"Repeatable read — Dirty reads and non-repeatable reads aren't possible, phantom reads are
> possible."*

Two engines, one level name, opposite answers to "can a phantom happen here". A test asserting
that `@Transactional(isolation = Isolation.REPEATABLE_READ)` prevents a phantom passes on
PostgreSQL and is asserting a falsehood on H2 — or, more commonly, the test never gets written
because nobody thinks to test it, and the code ships assuming whichever engine the author
remembered.

And the `SERIALIZABLE` row is worse, because H2 tells you outright:

> *"Note that this isolation level in H2 currently doesn't ensure equivalence of concurrent and
> serializable execution of transactions that perform write operations."*

PostgreSQL's `SERIALIZABLE` monitors for anomalies and rolls one transaction back:

> *"detection of the conditions which could cause a serialization anomaly will trigger a
> serialization failure"*

with `ERROR: could not serialize access due to read/write dependencies among transactions`. If
you chose `SERIALIZABLE` to protect a business invariant, the H2 test that "proves" the invariant
holds is proving nothing whatsoever.


### `FOR UPDATE`, `SKIP LOCKED` and advisory locks

H2 does have the syntax: `FOR UPDATE [ NOWAIT | WAIT secondsNumeric | SKIP LOCKED ]`. What it
does not have is the guarantee the work-queue idiom relies on. H2's own note:

> *"Locking behavior for rows that were excluded from result using `OFFSET` / `FETCH` / `LIMIT` /
> `TOP` or `QUALIFY` is undefined, to avoid possible locking of excessive rows try to filter out
> unneeded rows with the `WHERE` criteria when possible."*

The canonical queue query is precisely that combination:

```sql
SELECT * FROM job WHERE state = 'READY'
ORDER BY created_at
FOR UPDATE SKIP LOCKED
FETCH FIRST 10 ROWS ONLY;
```

The syntax ports. The documented guarantee does not, and the H2 documentation says so in as many
words. A concurrency test for a job queue on H2 is a test of behaviour H2 declines to define.

H2 also has no equivalent of PostgreSQL's advisory locks — `pg_advisory_lock`,
`pg_try_advisory_xact_lock` and the rest do not appear in H2's function list. A leader election, a
cross-process mutex or a job de-duplication built on advisory locks cannot run under H2 at all, so
the test mocks it, so the mechanism has no test.

**The test that passes anyway:** every single-threaded one. Isolation is invisible to a test with
one connection, and one connection is what a repository test has. The tests that would catch any
of this are concurrency tests, and a concurrency test on H2 is a measurement of H2's lock manager.


## Gotchas

**★ H2's `REPEATABLE READ` allows phantom reads; PostgreSQL's does not.**
Both documentations say so in one line each — PostgreSQL, *"PostgreSQL's Repeatable Read
implementation does not allow phantom reads"*; H2, *"Repeatable read — Dirty reads and
non-repeatable reads aren't possible, phantom reads are possible."* Any test that asserts what an
isolation level prevents is asserting about a specific engine's implementation of that level's
*name*, and the two engines answer differently for the level people reach for most when they want
"a consistent view".

**★ H2's `SERIALIZABLE` does not serialize writes, and H2 says so.**
*"Note that this isolation level in H2 currently doesn't ensure equivalence of concurrent and
serializable execution of transactions that perform write operations."* If you chose
`SERIALIZABLE` to protect an invariant, an H2 test cannot corroborate that choice. PostgreSQL's
implementation is SSI with predicate locks and it will roll a transaction back with
`could not serialize access due to read/write dependencies among transactions` — which your code
has to be written to survive, and the H2 test never exercises that path because the path never
runs.

**★ PostgreSQL implements three distinct levels behind four names; H2 offers five.**
*"you can request any of the four standard transaction isolation levels, but internally only three
distinct isolation levels are implemented, i.e., PostgreSQL's Read Uncommitted mode behaves like
Read Committed."* So `@Transactional(isolation = READ_UNCOMMITTED)` is a no-op on PostgreSQL and
genuinely permits dirty reads on H2. And H2's `SNAPSHOT` has no PostgreSQL name at all — the
nearest equivalent is PostgreSQL's `REPEATABLE READ`, which *is* snapshot isolation. Two engines,
two different maps between names and behaviours.

**★ Losing a write race raises a rollback on PostgreSQL and a wait-then-timeout on H2.**
PostgreSQL at `REPEATABLE READ` or above: *"the repeatable read transaction will be rolled back
with the message `ERROR: could not serialize access due to concurrent update`."* H2: *"If multiple
connections concurrently try to lock or update the same row, the database waits until it can apply
the change, but at most until the lock timeout expires."* Optimistic-with-retry against
pessimistic-with-timeout. They are not the same failure and they do not want the same code around
them.

**★ H2's lock timeout is per-connection and configurable, which makes concurrency tests on H2 tune-able rather than correct.**
Because the failure is a timeout, a flaky H2 concurrency test can be made green by raising the lock
timeout. That looks like a fix and is a way of not finding out that PostgreSQL would have rolled
the transaction back instead of waiting. If you ever "fix" a concurrency test by increasing a
timeout, the test has stopped describing anything.

**★ `FOR UPDATE SKIP LOCKED` combined with `FETCH FIRST n ROWS` is documented as undefined on H2.**
*"Locking behavior for rows that were excluded from result using `OFFSET` / `FETCH` / `LIMIT` /
`TOP` or `QUALIFY` is undefined."* That combination is the entire work-queue idiom. The syntax
ports and the guarantee does not, which is the most dangerous shape a divergence can take — nothing
fails, nothing warns, and the behaviour you are relying on is explicitly not promised.

**★ H2 locks rows one at a time with a read-test-lock-reread loop, and says so.**
*"Rows are processed one by one. Each row is read, tested with `WHERE` criteria, locked, read again
and re-tested, because its value may be changed by concurrent transaction before lock
acquisition."* That is a different concurrency profile from PostgreSQL's, and it means the
*ordering* of which worker gets which row in a queue test is an artefact of H2's implementation.
Asserting on that ordering is asserting on an implementation detail of the wrong database.

**★ PostgreSQL advisory locks have no H2 equivalent, so the code that uses them has no test.**
`pg_advisory_lock`, `pg_try_advisory_xact_lock` and the rest are absent from H2's function list.
Leader election, cross-process mutexes and job de-duplication built on them get mocked out in
tests — and a mocked lock always grants, so the test proves the happy path and only the happy path.

**★ Isolation is invisible to a test with one connection, which is every repository test.**
This is the reason the whole section stays undiscovered. A `@DataJpaTest` has one transaction and
one connection; there is nothing for an isolation level to isolate it from. The tests that would
catch any of this are concurrency tests with two connections, and a concurrency test on H2 is a
measurement of H2's lock manager.

**★ `@Transactional(isolation = ...)` on a `@DataJpaTest` method may not do what you think, because the test itself owns the transaction.**
The test method is already inside a transaction that the TestContext framework opened and will roll
back. A nested service call with a different isolation level does not get one — isolation is a
property of the physical transaction, and there is only one. Testing isolation behaviour requires
two real connections and explicit transaction control, at which point you are writing a
concurrency test, and it belongs on the engine you deploy.

## Interview questions

**★ You have a test that asserts a `SERIALIZABLE` transaction prevents an invariant violation, and it passes on H2. What have you learned?**
Nothing about serializability. H2's documentation states that its `SERIALIZABLE` level *"currently
doesn't ensure equivalence of concurrent and serializable execution of transactions that perform
write operations"*. PostgreSQL implements it with predicate locks and Serializable Snapshot
Isolation, and its distinguishing behaviour is that it will *roll your transaction back* with a
serialization failure — which means the real question the test should be asking is whether your
code handles that rollback and retries. That behaviour does not occur on H2, so the retry path is
untested and, in most codebases where this comes up, absent.

**★ What does `REPEATABLE READ` mean, and why is that a trick question across engines?**
The SQL standard says it must prevent dirty reads and non-repeatable reads, and *may* permit
phantoms. H2 implements exactly the minimum: phantoms are possible. PostgreSQL implements it as
snapshot isolation, which is strictly stronger — its own manual says the implementation *"does not
allow phantom reads"* and calls it *"a stronger guarantee than is required by the SQL standard"*.
Both are conformant. So the level name tells you the floor, not the behaviour, and any code whose
correctness depends on the difference is depending on an engine, not on a standard.

**★ How would you actually test a work queue built on `FOR UPDATE SKIP LOCKED`?**
On the engine you deploy, with at least two real connections and explicit transaction control —
worker A takes a lock and holds it, worker B runs the same query and must not see the locked row.
That cannot be done inside a single `@DataJpaTest` transaction, and it cannot be done meaningfully
on H2, whose documentation states that locking behaviour for rows excluded by `FETCH`/`LIMIT` is
undefined — and `FETCH FIRST n ROWS` is exactly what a batch-claiming query uses. Assert on which
rows each worker *claims*, never on the order in which they claim them; the ordering is an
implementation detail on any engine.

**★ Your service uses advisory locks for leader election. How do you test it?**
Against PostgreSQL, because there is no other option — H2 has no advisory locks, so the only H2
test is one where the lock is mocked, and a mocked lock always grants. The test that matters is the
contention case: two application instances, two connections, one calls
`pg_try_advisory_lock` and succeeds, the other calls it and must get `false`. That test is
cheap on a container and impossible without one, which makes it one of the clearest examples of the
line [01b](01b-where-the-line-is.md) draws.

**★ A concurrency test is flaky and someone raises the lock timeout to fix it. What is your reaction?**
That the "fix" changed the subject. A timeout is H2's way of failing a write race; PostgreSQL's is
a rollback with a serialization failure. Raising the timeout makes the H2 test wait longer for a
lock it will now usually get, which is a statement about H2's lock manager and about the test
machine's scheduling. It says nothing about whether production will roll the transaction back, and
it removes the one signal that something concurrent is happening. If a concurrency test is flaky,
the first question is which engine it ran on and whether it had two real connections; timing is the
last thing to touch.

**★ Why is this section the one with the biggest gap between apparent and real coverage?**
Because a repository test has one connection, and isolation and locking are entirely about what
happens with two. A suite can have a hundred green data-layer tests and zero observations of
isolation behaviour — not weak observations, *zero*. So the coverage report says the transactional
service methods are covered, and the property those methods exist to guarantee has never been
exercised at all. That is a different failure from the rest of this catalogue: elsewhere the test
observed the wrong engine, here it observed nothing.

{/* FOOTER */}
