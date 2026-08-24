---
title: "The only timeout that stops the database working is the one the database enforces"
sidebar_label: "22d · The server's own timeouts"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the PostgreSQL 18 manual *Client Connection Defaults*
> (postgresql.org/docs/18/runtime-config-client.html), *Error Codes*
> (.../errcodes-appendix.html) and *Server Signaling Functions*
> (.../functions-admin.html), and the pgJDBC *Connection Parameters*
> documentation (jdbc.postgresql.org/documentation/use/). JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**Every timeout in the JVM stops *you waiting*. PostgreSQL's five own timeouts are
the only ones that stop the backend *working* — and all five ship disabled. A
database whose administrators have not set `statement_timeout` will happily run a
query for a week for a client that disconnected on the first day. Two of the five
abort a statement and leave the session alive; three terminate the session
outright, which in a pooled application means a connection that looks healthy in
the pool and fails on the next borrow. Getting that difference right is most of
the operational work; the scopes you can set them at, and the order the layers
have to be in, are [setting the timeouts](22e-setting-the-timeouts.md).**

## Five GUCs, all off by default, all milliseconds without a unit

| GUC | What it aborts | The manual's own words |
|---|---|---|
| `statement_timeout` | the statement | "Abort any statement that takes more than the specified amount of time." |
| `lock_timeout` | the statement, but only while waiting for a lock | "Abort any statement that waits longer than the specified amount of time while attempting to acquire a lock on a table, index, row, or other database object. The time limit applies separately to each lock acquisition attempt." |
| `transaction_timeout` | **the session** | "Terminate any session that spans longer than the specified amount of time in a transaction." |
| `idle_in_transaction_session_timeout` | **the session** | "Terminate any session that has been idle (that is, waiting for a client query) within an open transaction for longer than the specified amount of time." |
| `idle_session_timeout` | **the session** | "Terminate any session that has been idle… but not within an open transaction, for longer than the specified amount of time." |

Every one of them carries the same sentence about units and defaults: "If this
value is specified without units, it is taken as milliseconds. A value of zero
(the default) disables the timeout."

🔴 **`statement_timeout` is measured from arrival, not from execution.** The
manual: "The timeout is measured from the time a command arrives at the server
until it is completed by the server." And in the protocol JDBC actually uses, "in
extended query protocol, the timeout starts running when any query-related message
(Parse, Bind, Execute, Describe) arrives, and it is canceled by completion of an
Execute or Sync message." So planning time, parse time and bind time all count
against it — which matters for a first execution of a complex query, and matters
again when a generic plan is being built ([chunk 8](10-the-generic-plan-cliff.md)).

⚠️ **Multiple statements in one simple-query message are timed separately.** "If
multiple SQL statements appear in a single simple-query message, the timeout is
applied to each statement separately. (PostgreSQL versions before 13 usually
treated the timeout as applying to the whole query string.)" A semicolon-separated
script is therefore bounded per statement, not overall — which is not the bound
most people think they are setting.

## Three interactions the manual states outright

- **`lock_timeout` must be strictly smaller than `statement_timeout` to mean
  anything.** "Note that if `statement_timeout` is nonzero, it is rather pointless
  to set `lock_timeout` to the same or larger value, since the statement timeout
  would always trigger first."
- **`transaction_timeout` swallows the other two when it is shorter or equal.**
  "If `transaction_timeout` is shorter or equal to
  `idle_in_transaction_session_timeout` or `statement_timeout` then the longer
  timeout is ignored."
- **Prepared transactions escape it entirely.** "Prepared transactions are not
  subject to this timeout." A `PREPARE TRANSACTION` orphaned by a crashed
  coordinator holds its locks and blocks vacuum until somebody resolves it by
  hand; monitor `pg_prepared_xacts`, because nothing on this page will.

## Aborting a statement and terminating a session are not the same event

This is the distinction that decides what your pool has to do afterwards, and it
is visible in the SQLState:

| Cause | SQLState | Condition name | Session afterwards |
|---|---|---|---|
| `statement_timeout` fired | `57014` | `query_canceled` | alive, transaction aborted |
| `Statement.cancel()` / `pg_cancel_backend` | `57014` | `query_canceled` | alive, transaction aborted |
| `lock_timeout` fired | `55P03` | `lock_not_available` | alive, transaction aborted |
| `idle_in_transaction_session_timeout` | `25P03` | `idle_in_transaction_session_timeout` | **terminated** |
| `transaction_timeout` | `25P04` | `transaction_timeout` | **terminated** |
| `idle_session_timeout` | `57P05` | `idle_session_timeout` | **terminated** |
| `pg_terminate_backend` / shutdown | `57P01` | `admin_shutdown` | **terminated** |

🔴 **The first three leave a live session with an aborted transaction**, and
PostgreSQL will reject every subsequent statement on it with `25P02`,
`in_failed_sql_transaction`, until the transaction ends. Returning such a
connection to the pool without a `rollback()` poisons the next borrower with an
error that has nothing to do with what they did — the same class of bug as leaving
session state behind ([chunk 4](04-connection-is-expensive.md)).

⚠️ **The last four leave a corpse in the pool.** A terminated session is invisible
to a JDBC client until the socket is next used, so the pool hands out a connection
that looks idle and healthy. The manual warns about this explicitly for
`idle_session_timeout`:

> "Be wary of enforcing this timeout on connections made through
> connection-pooling software or other middleware, as such a layer may not react
> well to unexpected connection closure. It may be helpful to enable this timeout
> only for interactive sessions, perhaps by applying it only to particular users."

Take that warning at face value for `idle_session_timeout` — the manual itself
notes "an idle session without a transaction imposes no large costs on the
server". But **do not** generalise it to
`idle_in_transaction_session_timeout`, where what is being prevented is genuinely
worse: "an open transaction prevents vacuuming away recently-dead tuples that may
be visible only to this transaction; so remaining idle for a long time can
contribute to table bloat." Enable that one, and make the pool's `maxLifetime`
shorter than it.

## Gotchas

**⚠️ No server-side timeout at all**
**Symptom:** the client-side dashboards look healthy and the database is running
queries for clients that disconnected minutes ago.
**Cause:** all five GUCs default to zero, meaning disabled. A database nobody
configured has no bound of any kind.
**Fix:** at minimum, `ALTER ROLE <app> SET statement_timeout` and
`idle_in_transaction_session_timeout`. This is the floor, not the tuning.

**⚠️ Writing `5000` and meaning five seconds**
**Symptom:** a timeout that appears never to fire.
**Cause:** GUCs are milliseconds when written without a unit suffix, so `5000` is
five seconds — but `300000` is five minutes and reads like nothing. In the client
layers the same magnitudes mean different things.
**Fix:** always write the suffix in SQL: `'5s'`, `'2min'`, `'250ms'`.

**⚠️ `lock_timeout` set equal to or above `statement_timeout`**
**Symptom:** lock waits report as generic statement timeouts, so contention and
slowness are indistinguishable in the logs.
**Cause:** the manual says it plainly — "the statement timeout would always
trigger first".
**Fix:** make `lock_timeout` strictly smaller. `55P03` and `57014` then become two
signals with two different remedies: retry the lock, or fix the query.

**⚠️ `transaction_timeout` silently disabling the others**
**Symptom:** `statement_timeout` appears to have stopped working shortly after
`transaction_timeout` was introduced.
**Cause:** documented — if `transaction_timeout` is shorter than or equal to
`idle_in_transaction_session_timeout` or `statement_timeout`, "the longer timeout
is ignored".
**Fix:** treat `transaction_timeout` as the outermost of the three and set it
strictly larger, or accept that it is now the only one that fires.

**⚠️ Relying on `transaction_timeout` to clean up two-phase commit**
**Symptom:** a prepared transaction left by a crashed coordinator holding locks
and blocking vacuum indefinitely.
**Cause:** "Prepared transactions are not subject to this timeout."
**Fix:** monitor `pg_prepared_xacts` and resolve them explicitly with `COMMIT
PREPARED` or `ROLLBACK PREPARED`.

**⚠️ Not rolling back after `57014` or `55P03`**
**Symptom:** the next request on that pooled connection fails with an error about
a failed transaction block, in code that did nothing wrong.
**Cause:** the statement was aborted but the transaction is still open and in the
aborted state; every subsequent statement returns `25P02`.
**Fix:** roll back in a `finally` on every error path before the connection goes
back to the pool ([chunk 14](17-resource-handling.md)).

**⚠️ Enabling `idle_session_timeout` on the pool's connections**
**Symptom:** apparently random failures after quiet periods, from a pool handing
out sessions the server already terminated.
**Cause:** the manual's warning about pooling middleware not reacting well to
unexpected connection closure — and the note that an idle session outside a
transaction costs the server little anyway.
**Fix:** apply it to interactive roles, not to the application role. Use
`idle_in_transaction_session_timeout` for the application, since what that one
prevents is real bloat.

**⚠️ Forgetting that planning counts**
**Symptom:** a tight `statement_timeout` that fires on the first execution of a
complex query and never again.
**Cause:** the timeout runs "from the time a command arrives at the server", and
in extended query protocol it starts at Parse/Bind/Execute/Describe — so planning
is inside the budget.
**Fix:** size the bound for a cold plan, or warm the plan deliberately, and read
[the generic plan cliff](10-the-generic-plan-cliff.md) before assuming repeat
executions cost the same.

**⚠️ `maxLifetime` longer than the server's idle timeouts**
**Symptom:** intermittent failures on the first query of a request, after quiet
periods.
**Cause:** the server terminated the session while it sat in the pool and the pool
never noticed.
**Fix:** `maxLifetime` strictly below `idle_in_transaction_session_timeout` and
`idle_session_timeout`, plus `tcpKeepAlive=true`.

## Interview questions

**★ Why is a server-side `statement_timeout` mandatory when the client already has
one?**
Because the client's timeout does not stop the work. A PostgreSQL backend does not
watch its client socket while executing; it notices a disconnected client the next
time it tries to write results, which for a long aggregate can be many minutes.
So a client timeout leaves the query running, holding its snapshot and its locks
and consuming CPU, while the application retries and adds another one. Only
`statement_timeout` — enforced by the backend itself, measured from the moment the
command arrives — actually aborts the statement, and it works whether the client
is slow, disconnected, crashed or rescheduled onto another node. The client-side
timeout is the convenience; the server-side one is the protection.

**★ What is the difference between a timeout that aborts a statement and one that
terminates a session?**
`statement_timeout` and `lock_timeout` abort the statement: you get an error —
`57014` or `55P03` — the session stays alive, and after a rollback the connection
is reusable. `transaction_timeout`, `idle_in_transaction_session_timeout` and
`idle_session_timeout` terminate the session outright, so the connection is dead.
That difference is what your pool cares about. An aborted statement is a normal
error to handle; a terminated session is a connection the pool still believes it
owns, which looks healthy sitting idle and fails on the next borrow — the manual
warns about exactly this, advising caution when enforcing `idle_session_timeout`
on connections made through pooling middleware. The client-side mitigations are a
`maxLifetime` shorter than the server's idle bounds, plus `tcpKeepAlive`.

**★ Why does `lock_timeout` need to be smaller than `statement_timeout`?**
Two reasons, one documented and one operational. The documented one: the manual
notes that if `statement_timeout` is nonzero it is "rather pointless" to set
`lock_timeout` to the same or a larger value, because the statement timeout would
always fire first — so the setting simply has no effect. The operational one is
about diagnosis. A statement that gave up waiting for a lock and a statement that
was genuinely too slow are different problems with different fixes, and they are
only distinguishable if `lock_timeout` fires first: `55P03` `lock_not_available`
tells you there is contention, probably from a long transaction or a DDL
statement, whereas `57014` tells you the query itself needs work. Collapsing them
into one SQLState throws away the signal.

**★ Does `statement_timeout` include planning time?**
Yes, and that catches people out on a first execution. The manual says the timeout
"is measured from the time a command arrives at the server until it is completed
by the server", and for the extended query protocol that JDBC uses it "starts
running when any query-related message (Parse, Bind, Execute, Describe) arrives,
and it is canceled by completion of an Execute or Sync message". So parse and plan
time are inside the budget. The visible symptom is a tight timeout that fires the
first time a complex query is executed on a connection and never again once a
plan is cached — which also interacts with server-side prepared statements and the
switch to a generic plan after several executions.

**★ How does a semicolon-separated batch of statements interact with
`statement_timeout`?**
Each statement gets its own budget, not the batch. The manual is explicit: "If
multiple SQL statements appear in a single simple-query message, the timeout is
applied to each statement separately", and notes that this changed — "PostgreSQL
versions before 13 usually treated the timeout as applying to the whole query
string." So a five-second `statement_timeout` in front of a script of twenty
statements bounds nothing at five seconds; the worst case is a hundred. If you
need a bound on the whole unit of work, `transaction_timeout` is the GUC that
expresses it, remembering that it terminates the session rather than aborting a
statement and that it suppresses the other timeouts when it is the shorter value.

**★ All five of these default to zero. Is that a sensible default?**
It is a defensible one for a general-purpose database and a dangerous one for a
service. PostgreSQL cannot know whether a given statement is a checkout query that
should never exceed a second or a nightly report that legitimately runs for
hours, and a database that aborted long queries by default would break every
analytics and maintenance workload on first contact. So the shipped posture is "no
opinion". The consequence is that every one of the five bounds is opt-in, and the
common production failure is not a badly chosen value but no value at all —
`statement_timeout` unset, `idle_in_transaction_session_timeout` unset, and
therefore a database that will run a query indefinitely for a client that has long
since gone. The right response is not to set them globally, which the manual warns
against, but to set them per role so that each workload's bound reflects that
workload.

**★ Two of these timeouts can fire on a statement that is not doing anything
wrong. Which, and what should the application do?**
`lock_timeout` and, indirectly, `statement_timeout` while a statement is blocked
behind someone else's lock. Both produce an error on a statement that may be
perfectly written and simply unlucky in its timing — a `SELECT … FOR UPDATE`
behind a long transaction, or any DML behind an `ALTER TABLE` waiting on an
`ACCESS EXCLUSIVE` lock. That makes them the timeouts most worth retrying, and it
is why keeping `lock_timeout` strictly below `statement_timeout` matters: `55P03`
`lock_not_available` is a clean signal that the statement is retryable after a
backoff, whereas `57014` on its own does not distinguish "too slow" from "waited
too long". Retry `55P03` with jitter and a small cap; treat a repeated `57014` as
a query or an index to fix, not a thing to retry harder.

---
<!--FOOTER-->
