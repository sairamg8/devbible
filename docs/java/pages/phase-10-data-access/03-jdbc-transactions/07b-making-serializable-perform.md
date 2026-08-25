---
title: "Making SERIALIZABLE perform is mostly about giving SSI less to track — and the retry loop is not optional"
sidebar_label: "7b · Living with Serializable"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.2.3 *Serializable
> Isolation Level*, including the performance-recommendation list and the
> unique-constraint note
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)),
> and the `SET TRANSACTION` reference page for `DEFERRABLE`
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18. No sandbox: no console output, no timings.

**Serializable's cost is not CPU. It is the abort rate, and the abort rate is
mostly a function of how much SSI has to track and how coarsely it is forced to
track it. The manual publishes a list of recommendations for this, and it is worth
treating as a checklist rather than as prose — because two of its items say that a
query *plan* change can raise your failure rate without a line of application code
changing. Alongside that sit two rules that are not about performance at all: data
read in a Serializable transaction is not valid until that transaction commits,
and there is no version of this level that works without a generalized retry
path.**

## Two rules that are not negotiable

### Data you read is not valid until you commit

> When relying on Serializable transactions to prevent anomalies, it is important
> that any data read from a permanent user table not be considered valid until the
> transaction which read it has successfully committed. This is true even for
> read-only transactions ... In all other cases applications must not depend on
> results read during a transaction that later aborted; instead, they should retry
> the transaction until it succeeds.

🔴 **This is a constraint on your Java, not on your SQL.** If your transaction
reads a value, calls an external system with it, and *then* commits — and the
commit fails at `40001` — you have already acted on data the database has now
declared invalid, and the external call cannot be retried away. It is the
strongest possible argument for the rule in
[chunk 15](15-where-the-boundary-belongs.md): side effects belong outside the
transaction, after a successful commit.

### The retry path must be generalized

> It is important that an environment which uses this technique have a generalized
> way of handling serialization failures (which always return with an SQLSTATE
> value of '40001'), because it will be very hard to predict exactly which
> transactions might contribute to the read/write dependencies and need to be
> rolled back to prevent serialization anomalies.

**Generalized** — one retry boundary every transaction passes through, not a
`catch` block per call site. You cannot know in advance which units of work will
be picked as the loser of a cycle, so you cannot decide in advance which ones need
the loop. [Chunk 14](14-retrying-safely.md) is the shape.

## What Serializable buys, and why it can be the cheaper option

> The guarantee that any set of successfully committed concurrent Serializable
> transactions will have the same effect as if they were run one at a time means
> that if you can demonstrate that a single transaction, as written, will do the
> right thing when run by itself, you can have confidence that it will do the
> right thing in any mix of Serializable transactions, even without any information
> about what those other transactions might do, or it will not successfully commit.

**Correctness becomes a single-transaction property.** You review one unit of work
in isolation and you are done — no reasoning about interleavings, no enumerating
which other endpoints touch the same rows. In a codebase where several teams write
transactions against shared tables, that is a large reduction in the amount of
thinking required, and it is bought with an abort rate instead of with analysis.

The manual also makes the direct performance argument: *"balanced against the cost
and blocking involved in use of explicit locks and `SELECT FOR UPDATE` or `SELECT
FOR SHARE`, Serializable transactions are the best performance choice for some
environments."* Explicit locks are not free either — they block, and blocking is
often more expensive than an abort you can retry in milliseconds.

## The manual's checklist, item by item

These are the manual's own recommendations, with what each one means for the Java
side.

**1 · Declare transactions `READ ONLY` when possible.** A read-only Serializable
transaction may release its SIRead locks early, and the manual says such
transactions "will often be able to establish that fact at startup and avoid
taking any predicate locks". Less tracking, fewer false conflicts. See
[chunk 11](11-read-only-transactions.md).

**2 · Control the number of active connections, using a connection pool if
needed.** *"This is always an important performance consideration, but it can be
particularly important in a busy system using Serializable transactions."* More
concurrent Serializable transactions means more overlapping read sets and more
chances to form a cycle. **Connection pooling here is a correctness-adjacent
tuning knob, not just a resource one** — see **Topic 02 — Connection pooling**
*(not written yet)*.

**3 · Don't put more into a single transaction than needed for integrity
purposes.** A bigger transaction reads more, so it takes more predicate locks and
overlaps more transactions. Every extra `SELECT` inside the boundary widens the
target.

**4 · Don't leave connections dangling "idle in transaction" longer than
necessary.** The manual names the tool: *"the configuration parameter
`idle_in_transaction_session_timeout` may be used to automatically disconnect
lingering sessions."* This is [chunk 13b](13b-the-four-clocks.md).

**5 · Eliminate explicit locks, `SELECT FOR UPDATE`, and `SELECT FOR SHARE` where
no longer needed due to the protections automatically provided by Serializable
transactions.** ⚠️ This one is routinely missed during a migration to Serializable.
Locks that were there to prevent a race the level now handles are pure cost:
blocking, disk access, and deadlock risk that SSI does not have.

**6 · Predicate-lock memory.** *"When the system is forced to combine multiple
page-level predicate locks into a single relation-level predicate lock because the
predicate lock table is short of memory, an increase in the rate of serialization
failures may occur. You can avoid this by increasing
`max_pred_locks_per_transaction`, `max_pred_locks_per_relation`, and/or
`max_pred_locks_per_page`."*

**7 · Sequential scans.** *"A sequential scan will always necessitate a
relation-level predicate lock. This can result in an increased rate of
serialization failures. It may be helpful to encourage the use of index scans by
reducing `random_page_cost` and/or increasing `cpu_tuple_cost`. Be sure to weigh
any decrease in transaction rollbacks and restarts against any overall change in
query execution time."*

🔴 **Items 6 and 7 together are the reason Serializable can degrade without a code
change.** A relation-level predicate lock means "this transaction read the whole
table", so *any* write to that table by a concurrent transaction is a potential
dependency. A table that grew past the point where the planner prefers a
sequential scan, or a workload that outgrew the predicate-lock table, will start
producing `40001` from application code that did not change. **If your abort rate
jumps, look at plans and at `pg_locks` before you look at your own diff.**

## Gotchas
**⚠️ Acting on read data before the commit returns**
**Symptom:** an email is sent, a payment is captured, or a message is published for
a transaction that then aborts at `40001` and is retried — so it happens twice, or
happens for a state that never existed.
**Cause:** the manual's rule that data read from a permanent table is not valid
until the reading transaction commits.
**Fix:** no side effects inside the transaction. Collect what must happen, commit,
then do it.

**⚠️ The abort rate jumps after a data-volume change, with no code change**
**Symptom:** `40001` rates climb on a stable release, correlated with table growth
or a statistics refresh.
**Cause:** a plan flipped to a sequential scan, which always takes a relation-level
predicate lock, so every concurrent write to that table is now a potential
dependency. Or the predicate-lock table ran short of memory and finer locks were
promoted to coarser ones.
**Fix:** check the plan and `pg_locks` first. The manual's levers are
`random_page_cost` / `cpu_tuple_cost` to encourage index scans, and
`max_pred_locks_per_transaction` / `_per_relation` / `_per_page` for the memory.

**⚠️ Keeping the old `SELECT ... FOR UPDATE` after moving to Serializable**
**Symptom:** the migration to Serializable makes throughput *worse*, not better.
**Cause:** the explicit locks are still there, still blocking and still capable of
deadlock, doing a job SSI now does without blocking.
**Fix:** the manual's item 5 — remove locks that exist only to prevent races the
level now handles. Keep the ones that serialise something deliberately.

**⚠️ Assuming more concurrency is free**
**Symptom:** the connection pool is enlarged to handle load and the `40001` rate
rises superlinearly.
**Cause:** more concurrent Serializable transactions means more overlapping read
sets and more opportunities to form a dependency cycle. The manual singles this out
as "particularly important in a busy system using Serializable transactions".
**Fix:** treat pool size as a concurrency-control setting at this level, not just a
throughput one.

## Interview questions
**★ What is the argument for using Serializable everywhere?**
That it turns correctness into a single-transaction property. If you can show one
unit of work is correct when run alone, the guarantee is that it is correct in any
mix of concurrent Serializable transactions — or it will not commit. You stop
having to reason about interleavings with code you did not write. The manual makes
this argument directly and pairs it with two conditions: you need a generalized
failure-handling path, and you accept the monitoring overhead plus the cost of
restarting aborted transactions. It also notes this can be the best performance
choice in some environments, because you drop the explicit locks and
`SELECT FOR UPDATE` that a lower level would have needed — and those block, which
an abort does not.

**★ How would you reduce the serialization failure rate on a Serializable
workload?**
Follow the manual's list. Declare read-only transactions `READ ONLY`, because they
can often avoid taking predicate locks altogether. Keep transactions small — every
extra read widens the read set and the overlap. Control the number of active
connections, because more concurrent Serializable transactions means more chances
to form a cycle. Do not leave sessions idle in transaction; there is a timeout for
it. Delete explicit locks and `SELECT FOR UPDATE` that the level has made
redundant. Then the two infrastructure levers: raise the `max_pred_locks_*`
settings so page-level locks are not promoted to relation-level for lack of
memory, and encourage index scans over sequential scans, since a sequential scan
always takes a relation-level predicate lock.

**★ Why can a plan change increase the abort rate?**
Because the granularity of predicate locking follows the plan. An index scan takes
locks on the tuples or pages it actually touched; a sequential scan always takes a
relation-level predicate lock, which is effectively "I read this entire table". At
relation level, any concurrent write anywhere in that table is a candidate
dependency, so the chance of a detected cycle rises sharply. The same promotion
happens for a different reason when the predicate-lock table runs short of memory
and finer locks are combined into coarser ones. Both mean an application can start
failing at `40001` with no change to its own code — which is why plans and
`pg_locks` are the first place to look, not the diff.

**★ You get "could not serialize access due to read/write dependencies among
transactions" in production. What do you do first?**
Nothing urgent — it is the level working. Confirm the retry path caught it and the
transaction succeeded on a later attempt; the thing to alert on is the rate, or
retries exhausted, not the individual failure. If the rate is genuinely high, do
not start by reading the aborted transaction's code looking for a conflicting
pair, because the conflict is a cycle among a group and there may be no pair to
find. Look instead for the write-skew shape in the workload, check whether any
participating query is doing a sequential scan, and check whether predicate locks
are being promoted to relation level. Then work the manual's checklist: read-only
declarations, smaller transactions, fewer active connections.

---

← Prev: [7 · Serializable and SSI](07-serializable-and-ssi.md) · Index: [Transactions at the JDBC level](README.md) · Next → [7c · DEFERRABLE and its limits](07c-deferrable-and-the-limits.md)
