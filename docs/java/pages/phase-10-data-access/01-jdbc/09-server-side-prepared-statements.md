---
title: "Preparation is a server-side cache with a five-execution fuse and a plan you did not choose"
sidebar_label: "9 · Server-side prepared statements"
sidebar_position: 9
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
- **Batch work** — [chunk 17](18-batch-updates.md), where the statement is by
  definition reused.

And when it is not: a query executed once per connection, a query with skewed
parameter selectivity, and anything behind a transaction-mode pooler that does not
track prepared statements.

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

---

← Prev: [`IN` lists and `LIKE`](08-in-lists-and-like-patterns.md) · Index: [JDBC](README.md) · Next → [The generic plan cliff](10-the-generic-plan-cliff.md)
