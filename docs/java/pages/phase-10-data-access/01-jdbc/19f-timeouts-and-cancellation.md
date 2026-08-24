---
title: "The client timeout covers the whole batch and the server timeout restarts on every entry, and neither of them is a deadline"
sidebar_label: "19f · Timeouts and cancellation"
sidebar_position: 19.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Statement`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> the PostgreSQL 18 manual §20.11 *Client Connection Defaults*
> ([postgresql.org/docs/18/runtime-config-client.html](https://www.postgresql.org/docs/18/runtime-config-client.html)),
> §55.2.3 *Extended Query* and §55.2.8 *Canceling Requests in Progress*
> ([postgresql.org/docs/18/protocol-flow.html](https://www.postgresql.org/docs/18/protocol-flow.html)),
> the pgJDBC *Connection Parameters* documentation
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/))
> and `PGProperty`, and the pgJDBC 42.7.x source for `PgStatement` and
> `QueryExecutorImpl`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)). JDK 25,
> JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no timings, no console
> output.

**A batch is the one place where the client's timeout and the server's timeout
disagree about what a "statement" is, and the disagreement is total. pgJDBC arms
a single timer around the whole `executeBatch` call — the specification calls the
granularity "implementation defined" and the driver picks the batch — so a value
tuned for one statement starts cancelling healthy work as the batch grows.
PostgreSQL's `statement_timeout` does the opposite: under the extended protocol
it restarts on every Parse, Bind, Execute or Describe, so it never sees the batch
as one unit and a ten-thousand-entry load can run for an hour under a
five-second setting. And when a timeout does fire, nothing is aborted locally:
pgJDBC opens a *second connection* to send a CancelRequest, which the manual
describes as possibly having no effect at all and impossible to confirm. So
`setQueryTimeout` is a strong hint, `statement_timeout` is per entry, and the
only client-side control that actually stops something is `socketTimeout`, which
destroys the connection.**


## The timeout covers the whole batch

The `setQueryTimeout` javadoc explicitly declines to decide:

> "In the case of `Statement` batching, it is implementation defined as to whether
> the time-out is applied to individual SQL commands added via the `addBatch`
> method or to the entire batch of SQL commands invoked by the `executeBatch`
> method."

pgJDBC settles it: `internalExecuteBatch` calls `startTimer()` once, immediately
before handing the whole array to the query executor, and `killTimerTask()` in
the `finally`. **The timeout is for the entire batch.** So `setQueryTimeout(5)`
on a ten-thousand-row batch is not "five seconds per row", it is a cancel of the
whole thing — and the larger the batch, the more likely a timeout sized for a
single statement fires on work that was progressing fine. `executeBatch` declares
`SQLTimeoutException` for exactly this.

## `statement_timeout` counts the opposite way

The server has its own timeout, and for a pipelined batch it has the **opposite
granularity** to `setQueryTimeout`. From the manual:

> "The timeout is measured from the time a command arrives at the server until it
> is completed by the server. … In extended query protocol, the timeout starts
> running when any query-related message (Parse, Bind, Execute, Describe)
> arrives, and it is canceled by completion of an Execute or Sync message."

So `statement_timeout` restarts for every entry in the batch, while
`setQueryTimeout` runs once for all of them. A batch of ten thousand quick
inserts can run for an hour under `statement_timeout = '5s'` without ever
tripping it, and be killed at five seconds by `setQueryTimeout(5)`. They are not
two spellings of the same protection and neither substitutes for the other.

The one that genuinely bounds a whole batch on the server side is
`transaction_timeout`, which "terminate[s] any session that spans longer than the
specified amount of time in a transaction" and "applies both to explicit
transactions (started with `BEGIN`) and to an implicitly started transaction
corresponding to a single statement" — which includes the implicit transaction
block a batch opens under autocommit ([chunk 19](19-batch-updates.md)).

| Timeout | Where | Default | What it bounds for a batch |
|---|---|---|---|
| `setQueryTimeout(n)` | client, per `Statement` | none | the **whole** `executeBatch` call |
| `socketTimeout` | client, connection | `0` (off) | one socket read — "The timeout value in seconds max(2147484) used for socket read operations" |
| `statement_timeout` | server, session | `0` (off) | **each** Parse/Bind/Execute, restarting per entry |
| `transaction_timeout` | server, session | `0` (off) | the whole transaction, explicit or implicit |
| `lock_timeout` | server, session | `0` (off) | each individual lock wait |
| `idle_in_transaction_session_timeout` | server, session | `0` (off) | the client thinking between chunks |

⚠️ **The manual says of three of these that "setting … in `postgresql.conf` is
not recommended because it would affect all sessions."** They belong on the bulk
connection, set with `SET`, or via the pgJDBC `options` parameter — not globally.

🔴 **`idle_in_transaction_session_timeout` is the one that catches chunked
loaders**, because the shape in [chunk 19e](19e-sizing-a-batch.md) does client
work — reading, parsing, mapping — between `executeBatch` calls while a
transaction is open. Its purpose is exactly that: "to ensure that idle sessions
do not hold locks for an unreasonable amount of time."

## Cancelling is best-effort, and a batch makes that worse

`setQueryTimeout` does not abort anything locally. pgJDBC arms a timer task and,
when it fires, sends PostgreSQL a **CancelRequest** — a message that travels on a
brand-new second connection and that the manual describes as having no guarantee
of effect. The mechanism, the cancel key, the race it cannot avoid and the
`cancelSignalTimeout` budget are all worked in
[chunk 22f](22f-how-cancellation-works.md); this chunk is only what changes when
the thing being cancelled is a batch.

Three consequences, and each is specific to batching:

- **A timeout needs a spare connection.** Cancelling requires opening one. A bulk
  job that has taken every connection in the pool — the usual shape, because
  batching is what you do when you have a lot of work — is the case where the
  cancel cannot be sent at all.
- **`setQueryTimeout` is a request, not a deadline.** A batch can and does exceed
  it, because the timer only asks the server to stop. If you need a real bound on
  a batch, it is `transaction_timeout` on the server side.
- **`socketTimeout` is the only client control that is not best-effort** — it
  abandons the socket rather than asking politely. That makes it the backstop for
  a wedged connection, and it is exactly why it must be set longer than any batch
  you intend to succeed. Set it below your batch duration and you will kill
  healthy bulk jobs ([chunk 22c](22c-pgjdbc-timeout-properties.md)).

## Gotchas

**⚠️ Sizing `setQueryTimeout` as if it were per statement**
**Symptom:** large batches cancelled at exactly the timeout while small ones with
the same SQL are fine.
**Cause:** pgJDBC starts one timer for the whole `executeBatch` call.
**Fix:** scale the timeout with the batch size, or — better — fix the batch size
and keep the timeout as a genuine ceiling on the unit of work.


**⚠️ Believing `statement_timeout` protects you from a long batch**
**Symptom:** a batch runs for an hour on a connection with
`statement_timeout = '5s'`.
**Cause:** under the extended protocol the server's timer starts on each
query-related message and is "canceled by completion of an Execute or Sync
message", so it restarts per entry.
**Fix:** use `transaction_timeout` for a whole-batch server-side bound, and
`setQueryTimeout` for a whole-call client-side one.


**⚠️ Treating `setQueryTimeout` as a hard deadline**
**Symptom:** a batch that overran its timeout and completed anyway, or a timeout
that fires with no effect.
**Cause:** the driver's timer issues a PostgreSQL CancelRequest over a *new*
connection, and the manual says the signal "might or might not have any effect"
and the frontend "has no direct way to tell whether a cancel request has
succeeded".
**Fix:** treat it as a strong hint. Use `socketTimeout` as the real backstop, and
size it above any batch you expect to succeed.


**⚠️ A `socketTimeout` shorter than a legitimate batch**
**Symptom:** long batches fail with a connection error rather than a SQL error,
and the connection is destroyed rather than returned to the pool.
**Cause:** `socketTimeout` bounds one socket read, and a batch's reply does not
arrive until the server has worked through the pipeline.
**Fix:** raise it on the bulk `DataSource`, or bound the work instead by chunking
so no single read waits that long.


**⚠️ Setting the server timeouts in `postgresql.conf`**
**Symptom:** unrelated sessions start failing after a bulk-load tuning change.
**Cause:** the manual warns for `statement_timeout`, `lock_timeout` and
`transaction_timeout` that "setting [it] in `postgresql.conf` is not recommended
because it would affect all sessions."
**Fix:** set them per session on the bulk connection — `SET`, or the pgJDBC
`options` connection parameter.


**⚠️ A chunked loader idling with the transaction open**
**Symptom:** the session is terminated partway through a long load, or the table
bloats during it.
**Cause:** the loop does client-side work between `executeBatch` calls while a
transaction is open, which is exactly what
`idle_in_transaction_session_timeout` exists to kill and what prevents cleanup of
recently-dead tuples.
**Fix:** commit before doing slow client work, or read ahead so the transaction
is only open while writing.


## Interview questions

**★ Does `setQueryTimeout` apply to each statement in a batch or to the whole
thing?**
The specification refuses to say: the javadoc calls it "implementation defined"
and tells you to consult your driver. pgJDBC applies it to the whole batch —
`internalExecuteBatch` calls `startTimer()` once before submitting the entire
array and kills it in a `finally`. The practical consequence is that a timeout
tuned for a single statement starts cancelling batches as they grow, and the
cancellation looks like a database problem when it is a configuration mismatch.
This is one of the strongest arguments for a fixed chunk size: if every batch is
a thousand rows, one timeout value is meaningful for all of them, whereas an
unbounded batch makes the timeout a function of input size.


**★ Which timeout actually bounds a batch, and why is that a trick question?**
Because the client one and the server one have opposite granularity. pgJDBC's
`setQueryTimeout` arms a single timer around the whole `executeBatch` call, so it
bounds the batch. PostgreSQL's `statement_timeout` under the extended query
protocol "starts running when any query-related message (Parse, Bind, Execute,
Describe) arrives, and it is canceled by completion of an Execute or Sync
message" — so it restarts for every entry and never sees the batch as one unit. A
ten-thousand-entry batch of fast inserts sails past a five-second
`statement_timeout` and dies instantly under a five-second `setQueryTimeout`. If
you want a server-side bound on the whole thing, `transaction_timeout` is the one
that covers "an implicitly started transaction corresponding to a single
statement" as well as explicit ones, which is what a batch opens under autocommit.


**★ What actually happens when a query timeout fires?**
Not what most people picture. pgJDBC's timer task calls `cancel()`, which sends a
PostgreSQL CancelRequest — and per the protocol documentation that means "the
frontend opens a new connection to the server", because the backend is not
reading the existing one while it works. Three things follow. It needs a spare
connection and a working network, and pgJDBC bounds the attempt with
`cancelSignalTimeout`, default ten seconds. It is explicitly best-effort: "the
cancellation signal might or might not have any effect", and "the frontend has no
direct way to tell whether a cancel request has succeeded" — it still has to wait
for the backend's reply. And so `setQueryTimeout` is not a deadline; it improves
the odds. The only client-side control that is not a request is `socketTimeout`,
which abandons the socket, kills the connection, and takes it out of the pool.


---

**Continue:** [19g · Locks, deadlocks and the long transaction](19g-locks-and-long-transactions.md)

---
<!--FOOTER-->
