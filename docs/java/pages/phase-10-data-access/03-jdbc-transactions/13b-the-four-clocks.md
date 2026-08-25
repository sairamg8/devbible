---
title: "pg_stat_activity tells you whether a transaction is working, waiting or abandoned — and each one needs a different clock"
sidebar_label: "13b · Which clock, and how to tell"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §27.2.3 *pg_stat_activity*
> ([postgresql.org/docs/18/monitoring-stats.html](https://www.postgresql.org/docs/18/monitoring-stats.html)),
> the `lock_timeout`, `statement_timeout`, `transaction_timeout` and
> `idle_in_transaction_session_timeout` entries in *Client Connection Defaults*
> ([postgresql.org/docs/18/runtime-config-client.html](https://www.postgresql.org/docs/18/runtime-config-client.html)),
> and §25.1 *Routine Vacuuming*
> ([postgresql.org/docs/18/routine-vacuuming.html](https://www.postgresql.org/docs/18/routine-vacuuming.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**"The database is slow" is four different problems, and `pg_stat_activity`'s
`state` column separates them in one look. A backend that is `active` is doing
work — or waiting on a lock, which looks identical from the application side and
needs a different fix. A backend that is `idle in transaction` is doing nothing at
all while holding your locks and pinning your snapshot, and it is always a Java
bug. A backend that is `idle in transaction (aborted)` had a statement fail and
nobody rolled back. And a backend that is plain `idle` is a pooled connection
behaving correctly. Each state maps to a different timeout, and setting the wrong
one produces a service that fails just as often for a new reason.**

## The states, verbatim

The manual's definitions of `pg_stat_activity.state`:

| State | The manual's words |
|---|---|
| `starting` | *"The backend is in initial startup. Client authentication is performed during this phase."* |
| `active` | *"The backend is executing a query."* |
| `idle` | *"The backend is waiting for a new client command."* |
| `idle in transaction` | *"The backend is in a transaction, but is not currently executing a query."* |
| `idle in transaction (aborted)` | *"This state is similar to `idle in transaction`, except one of the statements in the transaction caused an error."* |
| `fastpath function call` | *"The backend is executing a fast-path function."* |
| `disabled` | *"This state is reported if `track_activities` is disabled in this backend."* |

🔴 **`idle` and `idle in transaction` are separated by one word and by everything
that matters.** `idle` is a healthy pooled connection between borrows: it holds no
locks, pins no snapshot, and costs nothing. `idle in transaction` is a connection
that opened a transaction and then went back to waiting on the client — so
somewhere in your Java, a thread is doing work between two statements while the
database holds everything open on its behalf.

## The columns that turn a state into a diagnosis

| Column | The manual's words |
|---|---|
| `xact_start` | *"Time when this process' current transaction was started, or null if no transaction is active."* |
| `query_start` | *"Time when the currently active query was started, or if `state` is not `active`, when the last query was started."* |
| `state_change` | *"Time when the `state` was last changed."* |
| `backend_xid` | *"Top-level transaction identifier of this backend, if any."* |
| `backend_xmin` | *"The current backend's `xmin` horizon."* |
| `wait_event_type` | *"The type of event for which the backend is waiting, if any; otherwise NULL."* |
| `wait_event` | *"Wait event name if backend is currently waiting, otherwise NULL."* |

Two derived quantities do most of the work:

- **`now() - xact_start`** — how long this *transaction* has been open. This is the
  number that matters for locks, snapshots and vacuum.
- **`now() - state_change`** while `state = 'idle in transaction'` — how long it has
  been abandoned.

⚠️ **`now() - query_start` is not transaction age.** A transaction that ran a fast
query and then sat idle for ten minutes has a recent `query_start` and an ancient
`xact_start`. Alerting on the wrong one hides exactly the case you care about.

## The diagnosis, and the clock each case needs

| What you see | What it means | The clock |
|---|---|---|
| `active`, `wait_event_type` is NULL, old `query_start` | genuinely executing — a slow query | `statement_timeout` |
| `active`, `wait_event_type` = `Lock` | **not working — blocked on somebody else's lock** | `lock_timeout` |
| `idle in transaction`, old `state_change` | a leaked or slow transaction; the client is not sending anything | `idle_in_transaction_session_timeout` |
| `idle in transaction (aborted)` | a statement failed and nothing rolled back | fix the Java; the same timeout catches it |
| `active` or idle-in-transaction, old `xact_start`, whole thing too long | a transaction that is simply too long overall | `transaction_timeout` |
| `idle`, large `backend_xmin`… | ⚠️ impossible — an `idle` backend has no transaction and no xmin horizon to hold | — |
| `idle` | a pooled connection between borrows | nothing; this is correct |

🔴 **The `active` + `wait_event_type = 'Lock'` row is the one people miss.** From
the application, a blocked statement and a slow statement are the same thing: a
`PreparedStatement.execute()` that has not returned. From `pg_stat_activity` they
are obviously different, and they need opposite fixes — one is a query to optimise,
the other is a transaction elsewhere holding a lock too long.

The GUCs themselves — their exact semantics, their interactions, whether each one
aborts a statement or terminates the session, and the SQLSTATE each produces — are
[server-side timeouts](../01-jdbc/22d-server-side-timeouts.md) in topic 01. This
page is only about choosing between them.

## The queries worth keeping

Transactions open longer than a minute, most abandoned first:

```sql
SELECT pid, state, now() - xact_start AS txn_age,
       now() - state_change           AS in_state,
       wait_event_type, wait_event, left(query, 120) AS last_query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
  AND now() - xact_start > interval '1 minute'
ORDER BY xact_start;
```

Who is blocking whom — `pg_blocking_pids` gives the answer directly:

```sql
SELECT pid, pg_blocking_pids(pid) AS blocked_by,
       now() - xact_start AS txn_age, left(query, 120) AS query
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;
```

The transaction holding back vacuum, which the vacuuming chapter tells operators to
look for by *"checking `pg_stat_activity` for rows where `age(backend_xid)` or
`age(backend_xmin)` is large"*:

```sql
SELECT pid, state, age(backend_xmin) AS xmin_age, now() - xact_start AS txn_age
FROM pg_stat_activity
WHERE backend_xmin IS NOT NULL
ORDER BY age(backend_xmin) DESC;
```

That last one is the [Repeatable Read report](06b-what-repeatable-read-still-cannot-promise.md)
cost made visible.

## `idle in transaction` is always a Java problem

The database cannot fix it, because from the server's point of view nothing is
wrong — it is waiting for a client that has not spoken. The causes are all on your
side, and they are a short list:

- **An HTTP call, a message publish or a file write between two statements.** The
  transaction is open for the duration of a network call you do not control.
  [Chunk 15](15-where-the-boundary-belongs.md) is about this.
- **A commit that never runs** because of an early `return`, a swallowed exception,
  or an exception path with no `rollback()`
  ([chunk 2](02-commit-rollback-and-the-shape-that-survives.md)).
- **Slow work in the JVM inside the boundary** — mapping, serialising, computing —
  while a locked row waits.
- **A connection returned to the pool mid-transaction**, which is the same thing
  with the additional problem that the leaked transaction now belongs to nobody.

`idle_in_transaction_session_timeout` is a *backstop*, not a fix. Its documentation
says as much about why it exists: *"this option can be used to ensure that idle
sessions do not hold locks for an unreasonable amount of time. Even when no
significant locks are held, an open transaction prevents vacuuming away
recently-dead tuples that may be visible only to this transaction; so remaining
idle for a long time can contribute to table bloat."*

⚠️ **The aborted variant is worse, not better.** `idle in transaction (aborted)` is
a transaction that already failed, so nothing it did will ever be kept — and it is
*still* holding locks and its snapshot until somebody ends it. It is pure cost.
See [chunk 10](10-the-aborted-transaction.md) for how a transaction gets there.

## The trade-off

| You gain | You pay |
|---|---|
| A stuck request fails fast instead of hanging | new error paths your code must handle |
| Leaked transactions are reaped automatically | sessions get terminated, and a pool must cope with that |
| Lock waits become a signal rather than a stall | a threshold that is too tight fails healthy work under load |
| A clear diagnosis from one view | `pg_stat_activity` needs privileges; a restricted role sees less |

## Gotchas

**⚠️ Alerting on `query_start` age when the problem is transaction age**
**Symptom:** monitoring shows nothing while a transaction has been open for twenty
minutes.
**Cause:** `query_start` is when the *last* query started. An idle-in-transaction
backend can have a recent one and an ancient `xact_start`.
**Fix:** alert on `now() - xact_start`, and separately on `now() - state_change`
for `idle in transaction`.

**⚠️ Treating `idle` as a problem**
**Symptom:** an operator sees dozens of `idle` backends and concludes the
application is leaking connections.
**Cause:** `idle` means "waiting for a new client command" — exactly what a pooled
connection looks like between borrows. It holds nothing.
**Fix:** the state to hunt is `idle in transaction`. `idle` counts are a pool-sizing
question, not a correctness one.

**⚠️ Diagnosing a lock wait as a slow query**
**Symptom:** weeks spent optimising a statement that is fast, and a `statement_timeout`
that fires on healthy traffic.
**Cause:** from JDBC, blocked and slow look identical. The distinguishing evidence
is `wait_event_type = 'Lock'` in `pg_stat_activity`.
**Fix:** check the wait event before optimising, and use `pg_blocking_pids()` to
find the transaction actually responsible.

**⚠️ Using `idle_in_transaction_session_timeout` as the fix rather than the
backstop**
**Symptom:** the alert stops firing, and requests now fail at `25P03` with sessions
terminated under them.
**Cause:** the timeout limits the damage; it does not shorten the transaction. The
underlying HTTP call or missing commit is still there.
**Fix:** set it as a floor *and* fix the boundary. Both, not either.

**⚠️ Ignoring `idle in transaction (aborted)` because "it already failed"**
**Symptom:** locks held and vacuum blocked by a transaction whose work is
guaranteed to be discarded.
**Cause:** an aborted transaction is still an open transaction. Ending it is the
only thing that releases anything.
**Fix:** the rollback-in-catch shape, so no path leaves a transaction unfinished.

**⚠️ Setting `transaction_timeout` without reading how it interacts**
**Symptom:** `statement_timeout` and `idle_in_transaction_session_timeout` stop
having any effect after `transaction_timeout` is introduced.
**Cause:** it is documented — if `transaction_timeout` is shorter than or equal to
either of them, the longer one is ignored.
**Fix:** treat it as the outermost bound and set the inner ones strictly smaller.
Detail in [server-side timeouts](../01-jdbc/22d-server-side-timeouts.md).

**⚠️ Enabling a session-terminating timeout without checking the pool**
**Symptom:** a burst of connection errors in the application when the timeout
fires, rather than a clean failure of the offending request.
**Cause:** `idle_in_transaction_session_timeout` and `transaction_timeout`
*terminate the session*, they do not merely abort the statement. The pool now holds
a dead connection.
**Fix:** make sure the pool validates connections on borrow, so a terminated session
is discarded rather than handed out.

## Interview questions

**★ What is the difference between `idle` and `idle in transaction`?**
`idle` means the backend is waiting for a new client command with no transaction
open — a pooled connection sitting between borrows, holding no locks and pinning no
snapshot. It is normal and costs nothing. `idle in transaction` means a transaction
is open and the backend is waiting for the client to send the next statement. That
one is holding every lock it has taken and pinning its snapshot, so it blocks other
writers and prevents vacuum from reclaiming row versions — and it is always caused
by the application: work happening in Java between two statements, or a commit that
never ran. The two states are one word apart and completely different problems.

**★ How do you tell a slow query from a blocked one?**
By the wait event. Both appear as `state = 'active'` and both look identical from
JDBC — a call that has not returned. But a genuinely executing statement has
`wait_event_type` of NULL, while one blocked on a lock reports `wait_event_type =
'Lock'`. That distinction decides the fix entirely: a slow query wants a plan or an
index and is bounded by `statement_timeout`, whereas a blocked one is not your
statement's fault at all — some other transaction is holding a lock too long, and
the bound you want is `lock_timeout`. `pg_blocking_pids(pid)` names the culprit
directly.

**★ Which timeout would you set for a transaction leak, and is it the fix?**
`idle_in_transaction_session_timeout`, and no, it is a backstop. It terminates a
session that has been idle inside an open transaction for too long, which stops the
damage spreading — the documentation says it exists so idle sessions do not hold
locks unreasonably long, and notes that even without significant locks an open
transaction prevents vacuuming recently-dead tuples and so contributes to bloat.
But the leak itself is a Java bug: an external call inside the transaction, a
missing commit, or an exception path with no rollback. Set the timeout as a floor
and fix the boundary; doing only the first makes the symptom quieter and turns it
into terminated sessions instead.

**★ Why is `now() - xact_start` a better alert than `now() - query_start`?**
Because it measures the thing that costs. Locks are held and the snapshot is pinned
for the whole transaction, not for the current statement, so a transaction that ran
a millisecond query and then sat idle for twenty minutes is doing real damage while
its `query_start` looks perfectly healthy. `query_start` is defined as when the
currently active query started, or — if the state is not `active` — when the last
query started, which is exactly the misleading value in this case. For
idle-in-transaction specifically, `now() - state_change` is also useful, because it
says how long it has been abandoned rather than how long it has existed.

**★ What is `backend_xmin` and why would you look at it?**
It is the backend's `xmin` horizon — the oldest transaction whose row versions this
backend might still need to see. Because MVCC leaves superseded row versions in
place until nothing can see them, a backend with an old `xmin` prevents vacuum from
reclaiming them, across the whole database rather than just its own tables. The
vacuuming chapter's remediation list tells operators to find long-running
transactions by checking `pg_stat_activity` for rows where `age(backend_xid)` or
`age(backend_xmin)` is large. In practice this is how a long Repeatable Read or
Serializable report shows up as somebody else's table bloat.

**★ A timeout terminates a session rather than aborting a statement. Why does that
matter to a pooled application?**
Because the pool is still holding a `Connection` object for a socket the server has
closed. `statement_timeout` and `lock_timeout` abort the statement and leave the
session alive, so the application sees an ordinary `SQLException` and the connection
is still usable after a rollback. `idle_in_transaction_session_timeout` and
`transaction_timeout` terminate the backend, so the next thing the pool hands out
is dead. The mitigation is on the pool side — validate connections on borrow so a
terminated session is discarded and replaced rather than served to the next request
as a confusing connection error.

---

← Prev: [13 · Deadlocks](13-deadlocks-and-timeouts.md) · Index: [Transactions at the JDBC level](README.md) · Next → [14 · What to retry](14-retrying-safely.md)
