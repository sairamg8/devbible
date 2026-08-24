---
title: "Preparation is a server-side cache with a five-execution fuse and a plan you did not choose"
sidebar_label: "9 · Server-side prepared statements"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the pgJDBC documentation *Server Prepared
> Statements* (jdbc.postgresql.org/documentation/server-prepare/) and
> *Connection Parameters* (jdbc.postgresql.org/documentation/use/), and the
> PostgreSQL 18 manual *PREPARE* — Notes, and *Query Planning →
> `plan_cache_mode`* (postgresql.org/docs/18/sql-prepare.html). JDK 25,
> JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**`PreparedStatement` is one Java word covering two entirely different things,
and conflating them causes a specific and hard-to-diagnose production problem.
The Java object is a *client-side* thing: it holds SQL with placeholders and lets
you bind values. A *server-side* prepared statement is a named, parsed, planned
statement living in a PostgreSQL backend, reused across executions. pgJDBC does
not create the second one immediately. It counts executions, and on the *sixth*
— the documented `prepareThreshold` default is 5 — it switches over. From that
point PostgreSQL may stop planning per execution and start reusing one generic
plan, and if your data is skewed the generic plan can be dramatically worse than
the one you were getting. The symptom is the worst kind: a query that is fast
five times and slow forever after, on the same parameters, with no deploy.**

## What the driver actually does

pgJDBC's documentation describes the mechanism precisely. It **"employs an
internal counter tracking statement executions"**, and when that counter reaches
`prepareThreshold` — default **5** — the driver **transitions to creating a named
statement and using the Prepare and Execute protocol**. Before that it uses the
extended query protocol with a temporary **"unnamed statement"**.

So there are three states, not two:

| Executions | What travels | What the server keeps |
|---|---|---|
| simple protocol (`preferQueryMode=simple`) | one Query message, values interpolated by the driver | nothing |
| 1 to `prepareThreshold` − 1, extended | Parse (unnamed) + Bind + Execute | nothing between calls |
| ≥ `prepareThreshold`, extended | Bind + Execute against a **named** statement | the parsed, planned statement |

🔴 **Two things follow immediately.** First, the win is real but bounded: you save
the parse and (sometimes) the plan, not a round trip — the extended protocol
already pipelines Parse/Bind/Execute. Second, **preparation is per *physical
connection***. A pooled application has as many copies of a named statement as it
has connections, and a connection cycled by `maxLifetime` loses them and starts
counting from zero again.

⚠️ **The counter is on the connection's cache keyed by SQL text**, not on your
Java object. Creating a fresh `PreparedStatement` for the same SQL on the same
connection continues the count; changing the SQL text by one character starts a
new one. That is the second reason
[a generated `IN` list is expensive](08-in-lists-and-like-patterns.md) — every
list size is a different text and none of them ever reaches the threshold.

## Setting the threshold

Three levels, all documented:

```java
// 1 — the URL, for the whole connection
"jdbc:postgresql://db:5432/shop?prepareThreshold=1"

// 2 — programmatically, per connection
((org.postgresql.PGConnection) c.unwrap(PGConnection.class)).setPrepareThreshold(1);

// 3 — per statement
((org.postgresql.PGStatement) ps).setPrepareThreshold(0);   // never prepare
```

`prepareThreshold=1` prepares on the first execution. `0` — per the driver's
configuration documentation — disables server-side preparation for that statement.
Use `unwrap` rather than a direct cast: in a pooled application the object you
hold is a proxy, and the cast fails.

## When preparation is worth having

- **A hot query executed thousands of times per connection** — the parse saving is
  small per call and large in aggregate.
- **A complex query with an expensive plan** — a many-way join where planning is a
  significant fraction of execution.
- **Batch work** — [chunk 19](19-batch-updates.md), where the statement is by
  definition reused.

And when it is not: a query executed once per connection, a query with skewed
parameter selectivity, and anything behind a transaction-mode pooler that does not
track prepared statements.

## The client-side cache, which is the half nobody configures

The execution counter does not live on your Java object, so something has to
hold it. That something is a **per-connection cache of statements keyed by SQL
text**, and pgJDBC documents its two limits: **`preparedStatementCacheQueries`
(default `256`, the number of queries known to pgJDBC), and
`preparedStatementCacheSizeMiB` (default `5`, that is the client side cache size
in megabytes per connection)**.

Both are per connection, so a pool of ten multiplies the memory by ten, and both
are LRU: when a statement is evicted, its counter goes with it.

🔴 **Eviction is the failure nobody diagnoses.** An application with more than
256 distinct SQL texts in rotation — which is not many, once you count every
repository method, every migration-era variant and every generated `IN` list —
can evict statements faster than they reach the threshold. The symptom is
*nothing*: no error, no warning, just server-side preparation that never
happens and a statement cache that is pure overhead. The tell is a large,
diverse SQL surface plus no measurable difference when you set
`prepareThreshold=1`.

⚠️ **Raising the cache is not free.** `preparedStatementCacheSizeMiB` is
client-side heap, per connection, and the named statements it implies are
server-side memory in each backend. Raising both across a large pool is a real
memory decision, not a tuning knob to turn up by reflex.

## What invalidates a prepared statement

A named statement lives exactly as long as its session. The PostgreSQL manual is
unambiguous:

> *Prepared statements only last for the duration of the current database
> session. When the session ends, the prepared statement is forgotten, so it must
> be recreated before being used again. This also means that a single prepared
> statement cannot be used by multiple simultaneous database clients; however,
> each client can create their own prepared statement to use.*

Three things end one early, and pgJDBC documents how it handles each:

| Event | What happens | What the driver does |
|---|---|---|
| `DEALLOCATE` / `DISCARD ALL` | the server forgets the statement | *"The driver does understand top-level DEALLOCATE/DISCARD commands, and it invalidates client-side cache as well"* |
| `SET search_path` | the same SQL text may now resolve to different tables | *"It watches for `search_path` changes and invalidates its prepared statement cache so the next execution re-prepares against the new path"* |
| DDL on a referenced table | the cached plan's result type may no longer match | the server raises `cached plan must not change result type` |

🔴 **That third row is a real outage shape and it deserves its name.** A
migration adds or retypes a column while the service is running. Connections
opened before the migration still hold named statements planned against the old
shape, and the next execution fails with **`cached plan must not change result
type`** — SQLState `0A000`. It is not a bug in your query; it is a statement
prepared against a schema that no longer exists.

⚠️ **Note the interaction with pooling that makes it survive a deploy.** Because
preparation is per physical connection and a pool holds connections for
`maxLifetime` (HikariCP's default is 30 minutes), the errors can start *after* a
migration finishes and continue in a decaying trickle as connections cycle — long
enough that people correlate it with the wrong deploy.

The mitigations, in the order worth trying:

1. **Let connections cycle.** A `maxLifetime` shorter than your migration window
   makes the problem self-healing.
2. **`prepareThreshold=0`** on the connection, which turns off server-side
   preparation entirely — the blunt instrument, and correct for a service whose
   schema changes often relative to its query volume.
3. **`autosave=conservative`.** pgJDBC's own documentation describes the
   automatic savepoint mechanism as the way to recover statements invalidated
   this way — and warns in the same breath that **`autosave` might result in
   severe performance issues for long transactions**. Take that warning at face
   value; it is the driver's authors describing their own feature.

⚠️ **The multi-tenant version of the same bug** is `search_path` switching
between schemas whose tables have different shapes. pgJDBC invalidates its cache
on a `SET search_path` it can see — a top-level one it parsed. A `search_path`
changed by other means (a function, a connection-level `options` parameter, a
pooler) is one it cannot see.

## The trade-off

Preparation trades planning time for plan quality, and the trade is only good when
the plan does not depend on the values. That is the whole judgement in one
sentence, and it is the subject of the next chunk: a query whose best plan is the
same for every parameter loses nothing and saves parsing, while a query whose best
plan depends on the value can be made dramatically worse. You cannot tell which
you have by reading the Java.

## Gotchas

**⚠️ Expecting preparation to be shared across the pool**
**Symptom:** a statement cache that seems far less effective than the hit-rate
arithmetic suggests.
**Cause:** preparation is per physical connection; ten connections mean ten copies
and ten independent counters.
**Fix:** none needed — just size expectations correctly, and remember that
`maxLifetime` resets them.

**⚠️ Casting to `PGConnection` on a pooled connection**
**Symptom:** `ClassCastException` on a line that works in a test using the driver
directly.
**Cause:** the pool hands you a proxy.
**Fix:** `c.unwrap(PGConnection.class)`.

**⚠️ Assuming `prepareThreshold` is about your Java object's lifetime**
**Symptom:** code that carefully caches `PreparedStatement` objects and sees no
change, or that recreates them and expects to reset something.
**Cause:** the counter lives on the connection, keyed by SQL text.
**Fix:** stop managing the objects; manage the SQL text — same text, same
connection, and the count accumulates by itself.

**⚠️ More distinct SQL texts than the statement cache holds**
**Symptom:** `prepareThreshold` tuning that changes nothing, and preparation that
apparently never happens.
**Cause:** `preparedStatementCacheQueries` defaults to 256 per connection; beyond
that, LRU eviction discards statements — and their counters — before they reach
the threshold.
**Fix:** reduce the number of distinct texts first (the fixed-arity `IN` list
trick from [chunk 8](08-in-lists-and-like-patterns.md) is exactly this), and only
then consider raising the cache, which costs heap per connection and server
memory per backend.

**⚠️ A migration deploys and errors start minutes later**
**Symptom:** `cached plan must not change result type` (SQLState `0A000`) on a
query that has not been touched, appearing after the migration succeeded and
fading over the next half hour.
**Cause:** connections opened before the DDL still hold named statements planned
against the old column shape, and they live until `maxLifetime` retires them.
**Fix:** short-term, cycle the pool; long-term, either `prepareThreshold=0` on a
service whose schema moves often, or `autosave=conservative` with its documented
performance caveat.

**⚠️ Setting `search_path` in a way the driver cannot see**
**Symptom:** the same result-type error in a multi-tenant application, on
connections that switch schema per request.
**Cause:** pgJDBC invalidates its cache when it observes a top-level `SET
search_path`; a path changed inside a function, or by a pooler, is invisible to
it.
**Fix:** set the path with a plain statement the driver parses, or qualify table
names and stop switching paths at all.

## Interview questions

**★ What is the difference between a `PreparedStatement` and a server-side
prepared statement?**
The Java object is client-side: it holds SQL with `?` placeholders and lets you
bind typed values, and it gives you injection safety through the protocol's
separation of Parse and Bind. A server-side prepared statement is a named,
already-parsed and already-planned statement stored in a PostgreSQL backend
process and reused by name. pgJDBC creates the second lazily: its documented
default is to count executions and switch to a named statement once
`prepareThreshold`, default 5, is reached. So you get injection safety from the
first execution and plan caching only later, and the two are frequently confused
because Java gives them one name.

**★ Is server-side preparation shared across a connection pool?**
No. A prepared statement lives in the backend process serving one physical
connection, so a pool of ten connections holds ten independent copies, each with
its own execution counter. That has three consequences worth knowing: the benefit
scales with executions *per connection*, not total; a connection retired by
`maxLifetime` throws its prepared statements away and starts counting from zero;
and a transaction-mode connection pooler in front of PostgreSQL breaks the
assumption entirely, because consecutive transactions from one client can land on
different server connections.

**★ When is server-side preparation clearly worth it, and when clearly not?**
Worth it when the same SQL runs many times on the same connection and the best
plan does not depend on the parameter values: primary-key lookups, equality on a
high-cardinality column, and anything inside a batch job. Not worth it when a
statement executes once per connection, because you pay the bookkeeping and never
reuse; when the predicate's selectivity varies wildly by value, because the
generic plan is the risk described above; and behind a transaction-mode pooler
that does not track prepared statements. The one-line test is whether you would be
comfortable if the planner picked a single plan for all future values — if not,
you want custom plans.

**★ What does `cached plan must not change result type` mean and how do you get
rid of it?**
It means a server-side prepared statement was planned against a table shape that
has since changed — almost always a migration that added, dropped or retyped a
column while the service was running. The statement is per session, so the error
only appears on connections that were already open and had already crossed the
prepare threshold; connections opened after the migration are fine. That is why
it starts *after* a successful deploy and decays over the next `maxLifetime`
window instead of failing everything at once, and why it is so often blamed on
the wrong change. The fixes in order: let the pool cycle, which makes it
self-healing; set `prepareThreshold=0` if the schema moves often relative to
query volume; or use `autosave=conservative`, which pgJDBC documents for exactly
this recovery and warns can cause severe performance issues on long transactions.
The same error appears in multi-tenant applications that switch `search_path`
between schemas with different table shapes.

**★ Where does the execution counter actually live, and why does that matter?**
On the connection, in a cache keyed by SQL text — not on the `PreparedStatement`
object. Three consequences follow. Creating a fresh `PreparedStatement` for the
same SQL on the same connection continues the count, so caching the Java objects
buys you nothing on this axis. Changing the SQL text by a single character starts
a new count, which is why generated `IN` lists of varying arity never prepare.
And the cache is bounded — 256 queries and 5 MiB per connection by default — so
an application with a wide, diverse SQL surface can evict statements before they
ever reach the threshold, giving you all of the bookkeeping and none of the
benefit, silently.

---

← Prev: [8 · `IN` lists and `LIKE`](08-in-lists-and-like-patterns.md) · Index: [JDBC](README.md) · Next → [10 · The generic plan cliff](10-the-generic-plan-cliff.md)
