---
title: "pgJDBC can do the savepoint dance for you — but `autosave=always` changes what your application means, not just how robust it is"
sidebar_label: "10b · autosave"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the pgJDBC connection-parameter documentation for
> `autosave` and `cleanupSavepoints`
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/))
> and the PostgreSQL 18 `SAVEPOINT` reference page
> ([postgresql.org/docs/18/sql-savepoint.html](https://www.postgresql.org/docs/18/sql-savepoint.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**[Chunk 10](10-the-aborted-transaction.md) ended with the savepoint as the only
escape from an aborted transaction. pgJDBC will write that dance for you, through
a connection parameter called `autosave`. It has three values and they are not
three points on a scale: `conservative` fixes one narrow class of **driver**
failure and leaves your application errors alone, while `always` intercepts
everything — which sounds strictly better and is actually a change to what your
code means. A loop that was implicitly safe because the first failure stopped
everything becomes a loop that commits partial results.**

## pgJDBC's `autosave`: the driver doing it for you

pgJDBC can insert the savepoint dance automatically. The connection parameter is
`autosave`, documented as *"specifies what the driver should do if a query
fails"*, with three values:

| Value | pgJDBC's documentation |
|---|---|
| `never` **(default)** | *"no savepoint dance is made ever."* |
| `always` | *"JDBC driver sets a savepoint before each query, and rolls back to that savepoint in case of failure."* |
| `conservative` | *"savepoint is set for each query, however the rollback is done only for rare cases like 'cached statement cannot change return type' or 'statement XXX is not valid' so JDBC driver rolls back and retries"* |

And a companion parameter, `cleanupSavepoints` (default `false`): *"determines if
the `SAVEPOINT` created in autosave mode is released prior to the statement"*,
justified as *"to avoid running out of shared buffers on the server in the case
where 1000's of queries are performed"*.

### What `conservative` is actually for

Read its documentation again — it names two specific errors: *"cached statement
cannot change return type"* and *"statement XXX is not valid"*. Those are the
failures you get when a **server-side prepared statement's plan is invalidated** by
a schema change while the driver still holds it
([server-side prepared statements](../01-jdbc/09-server-side-prepared-statements.md)).

🔴 **So `conservative` is not a general error-recovery mode. It is a targeted fix
for one class of driver-level failure** — the kind that is nobody's application
bug and is recoverable by simply retrying the statement. It leaves your application
errors alone, which means `25P02` still cascades for a constraint violation. That
is usually what you want.

### The honest cost of `always`

`autosave=always` means a `SAVEPOINT` before **every** statement. Be clear about
what that buys and what it costs.

| | |
|---|---|
| ✅ Buys | any failed statement no longer poisons the transaction — every error stays local |
| ❌ Costs | an extra round trip per statement, plus a live savepoint per statement unless `cleanupSavepoints=true` |
| ❌ Costs | the resource problem `cleanupSavepoints` exists to prevent, on long transactions |
| 🔴 Costs | **it hides errors by design** — a constraint violation no longer stops the transaction, so code that was relying on the abort to halt a bad unit of work now carries on |

That last row is the one that should decide it. Turning on `autosave=always` is a
**semantic** change to your application, not a robustness setting. A loop that was
implicitly safe because the first failure stopped everything becomes a loop that
commits partial results.

⚠️ **Use `always` deliberately and locally, on a connection or a `DataSource`
dedicated to work that genuinely wants per-statement isolation** — a bulk importer
that records rejects, for example. Do not set it globally to make a `25P02` in the
logs go away, because the `25P02` was telling you about a real error underneath.

## Gotchas
**⚠️ Enabling `autosave=always` globally to stop seeing `25P02`**
**Symptom:** the errors disappear from the logs and partial data starts appearing
in the database.
**Cause:** it is a semantic change. Failures that used to stop a unit of work now
leave it running with one statement missing.
**Fix:** fix the underlying error, or scope `always` to a specific `DataSource`
whose work genuinely wants per-statement isolation.

**⚠️ Turning on `autosave=always` without `cleanupSavepoints=true`**
**Symptom:** a long transaction that issues many statements degrades or fails on
the server side, in a way that did not happen before the parameter was set.
**Cause:** `always` leaves a live savepoint per statement. pgJDBC's own
documentation for `cleanupSavepoints` says releasing them early exists "to avoid
running out of shared buffers on the server in the case where 1000's of queries are
performed".
**Fix:** if you enable `always`, enable `cleanupSavepoints` with it — or keep the
transactions short enough that it does not matter.

**⚠️ Reaching for `always` when the real problem is a prepared-statement
invalidation**
**Symptom:** intermittent "cached statement cannot change return type" or
"statement XXX is not valid" after a migration runs, and someone enables `always`
to make them stop.
**Cause:** those are exactly the failures `conservative` was written for, and it
handles them without touching application-level errors.
**Fix:** use `conservative`. It is the narrower, safer instrument for that
symptom.

**⚠️ Assuming `autosave` retries the statement**
**Symptom:** a statement fails, the transaction stays healthy, and the developer
expects the work to have happened anyway.
**Cause:** for `always` the documentation says the driver "rolls back to that
savepoint in case of failure" — it undoes, it does not re-run. Only
`conservative`'s narrow case describes the driver rolling back *and retrying*.
**Fix:** your code still has to handle the `SQLException`. `autosave` only
guarantees the *next* statement will be allowed to run.

## Interview questions
**★ What does pgJDBC's `autosave` parameter do, and should you turn it on?**
It makes the driver do the savepoint dance for you. `never` is the default and does
nothing. `always` sets a savepoint before every query and rolls back to it on
failure. `conservative` also sets one per query but only rolls back for a narrow set
of driver-level problems — its documentation names "cached statement cannot change
return type" and "statement XXX is not valid", which are the symptoms of a
server-side prepared statement whose plan was invalidated by a schema change.
`conservative` is a reasonable thing to enable, because it fixes a class of failure
that is not an application bug. `always` should be scoped deliberately: it costs a
round trip and a live savepoint per statement, and more importantly it changes your
application's semantics, because failures that used to stop a unit of work no longer
do.

**★ Why is `conservative` safer than `always` even though it does less?**
Because the two are aimed at different things. `conservative` sets a savepoint per
query but only rolls back for a narrow set of driver-level failures — its
documentation names "cached statement cannot change return type" and "statement XXX
is not valid", which are what you get when a server-side prepared statement's plan
is invalidated by a schema change. Those are not application bugs and are safely
recoverable by retrying, so intercepting them changes nothing about your program's
meaning. `always` intercepts *everything*, including your constraint violations, so
a failure that used to stop a unit of work no longer does. Less capability, but no
semantic surprise.

**★ When would you genuinely want `autosave=always`?**
When per-statement isolation is the actual requirement rather than a workaround. A
bulk importer that must load ten thousand rows, record the ones that were rejected,
and commit the rest is the clean case — every row is independent, a failure is data
to report rather than a reason to stop, and the alternative is writing the savepoint
loop by hand. Scope it to a `DataSource` dedicated to that job, pair it with
`cleanupSavepoints=true`, and do not put it on the application's main pool, where it
would quietly convert real failures into partial writes.

---

← Prev: [10 · The aborted transaction](10-the-aborted-transaction.md) · Index: [Transactions at the JDBC level](README.md) · Next → [11 · Read-only transactions](11-read-only-transactions.md)
