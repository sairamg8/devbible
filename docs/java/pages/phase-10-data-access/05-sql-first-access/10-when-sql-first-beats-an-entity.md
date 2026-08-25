---
title: "Seven queries where SQL-first is not a preference — the entity route is either impossible or an order of magnitude more work"
sidebar_label: "10 · When SQL wins"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual — *Aggregate Functions*,
> *WITH Queries (Common Table Expressions)*, *INSERT … ON CONFLICT*, *The Locking
> Clause* and *Text Search Functions and Operators*
> ([postgresql.org/docs/18/](https://www.postgresql.org/docs/18/index.html)) —
> and the Spring Framework 7.0 reference *Data Access → JDBC Core Classes*
> ([docs.spring.io/.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)).
> JDK 25, Spring Framework 7.0.8, PostgreSQL 18.

**[Chunk 1](01-why-sql-first-exists.md) argued the shape: an entity models your
domain, a result set models your question. This chunk is the practical version —
seven queries you will meet in a real service where the entity route is either
impossible or so much more work that nobody defends it. The point is not that ORMs
are bad. It is that these seven are recognisable, and recognising them is the whole
skill.**

## 1 · An aggregate with no home table

```sql
select date_trunc('month', placed_at) as month,
       count(*)                       as orders,
       sum(total)                     as revenue,
       avg(total)                     as average_order
from orders
where status = 'COMPLETED' and placed_at >= :from
group by 1
order by 1;
```

There is no `MonthlyRevenue` table, so there is no entity. Every ORM answer to this
is a DTO projection — a class that exists only to receive query results — which is
an admission that the query result and the entity are different things. Once you
have accepted a result-shaped class, the only remaining question is whether you
write the SQL or a query DSL writes it for you.

**Verdict: SQL-first, unambiguously.** The record *is* the mapping.

## 2 · A list screen over a wide table

Forty columns, three of them `jsonb`, one a `text` body. The screen shows four.

```sql
select id, title, author_name, updated_at
from article
where workspace_id = :workspace
order by updated_at desc
limit 50;
```

An entity query fetches the row, because the entity *is* the row — including the
`jsonb` and the body, fifty times, so that four columns can be rendered. The
transfer cost is real and it is invisible in the code.

**Verdict: SQL-first**, and the win grows with the width of the table. On a
six-integer-column table it is a wash and you should use whatever is already there.

## 3 · A bulk state change

```sql
update orders
   set status = 'ARCHIVED', archived_at = now()
 where status = 'COMPLETED' and placed_at < :cutoff;
```

One statement. The database never materialises the rows in your process. The entity
version selects every matching row, constructs an object for each, mutates a field,
and lets the flush issue one `UPDATE` per object — so a hundred thousand row change
becomes a hundred thousand statements plus a hundred thousand objects on the heap.

⚠️ **JPQL has a bulk update form**, and it has its own hazard: it bypasses the
persistence context, so objects already loaded keep their old values. That is a
real trap and it belongs to **Topic 06 · The JPA/Hibernate model** *(not written
yet)*. The relevant point here is that even the ORM's answer to this problem is
"send a statement", which is what SQL-first does by default.

**Verdict: SQL-first**, and check the row count ([chunk 8](08-writes-and-generated-keys.md)).

## 4 · Draining a work queue

```sql
select id, payload
from job
where status = 'PENDING'
order by created_at
limit 10
for update skip locked;
```

`SKIP LOCKED` deliberately returns an inconsistent view — the rows nobody else has
claimed — which is precisely what makes a table usable as a queue. The reasoning is
**[`NOWAIT`, `SKIP LOCKED` and scope](../03-jdbc-transactions/12b-nowait-skip-locked-and-scope.md)**.

Some ORMs can express a pessimistic lock mode with a skip-locked hint, and some
cannot; either way you are writing a database-specific instruction and hoping the
generated SQL preserves it. If the locking clause is the point of the query, own the
query.

**Verdict: SQL-first.**

## 5 · Upsert

```sql
insert into daily_metric (day, metric, value)
values (:day, :metric, :value)
on conflict (day, metric)
do update set value = daily_metric.value + excluded.value
returning value;
```

One statement, atomic, no read-modify-write race, and it hands back the new value.
The entity version is: load, decide, insert or update, hope nobody raced you, and
add a retry for the `DuplicateKeyException` when somebody did.

**Verdict: SQL-first.** `ON CONFLICT` is a concurrency primitive, not a convenience.

## 6 · A hierarchy

```sql
with recursive subtree as (
    select id, parent_id, name, 1 as depth
    from category where id = :root
  union all
    select c.id, c.parent_id, c.name, s.depth + 1
    from category c join subtree s on c.parent_id = s.id
)
select id, parent_id, name, depth from subtree order by depth, name;
```

One statement returns the whole subtree with its depth. The entity version walks
`getChildren()` recursively, which is one query per node — the N+1 problem in its
purest form (**Topic 08 · The N+1 problem**, *not written yet*) — and there is no
fetch-join depth that fixes an arbitrary-depth tree.

**Verdict: SQL-first**, and this one is not close.

## 7 · Ranked search

```sql
select id, title,
       ts_rank(search_vector, websearch_to_tsquery('english', :q)) as rank
from article
where search_vector @@ websearch_to_tsquery('english', :q)
order by rank desc
limit 20;
```

`rank` is a computed column that exists only in this result, the `@@` operator has
no portable equivalent, and the whole query is tuned around a GIN index. There is
nothing here an entity mapping can help with.

**Verdict: SQL-first.**

## The decision, compressed

| Ask | If yes | If no |
|---|---|---|
| Is a row of the result a row of a table? | maybe an entity | **SQL** |
| Does the result contain computed or aggregated columns? | **SQL** | — |
| Are you loading rows only to write them straight back changed? | **SQL** (one statement) | — |
| Does the query use a database feature with no ORM equivalent? | **SQL** | — |
| Are you going to modify the objects and save them? | **entity** | — |
| Does the operation traverse an aggregate and enforce invariants? | **entity** | — |

The last two rows are the ones people forget when they discover how pleasant
`JdbcClient` is. What you give up is [chunk 10b](10b-what-you-give-up.md), and it is
not nothing.

## Gotchas

**"It is a report" is not a licence to skip parameter binding.** Every query in this
chunk takes parameters, and every one of them is bound. A report assembled by string
concatenation because "only admins can see it" is still an injection, and admin
pages are a favourite target precisely because they are trusted.

**Bulk `UPDATE` and a loaded persistence context do not mix.** If the same
transaction has JPA entities loaded for rows your `UPDATE` just changed, those
objects are now stale and will be flushed with their old values — overwriting your
bulk change. That is the subject of [chunk 11](11-mixing-both.md) and it is the
sharpest trap in this topic.

**A recursive CTE with no depth guard can run away.** A cycle in the data — a
category whose ancestor is itself — makes `union all` recurse forever. Add a depth
limit in the recursive term, or use `union` (which deduplicates) if the semantics
allow, or track the visited path in an array column. This is a data problem, but it
arrives as a query that never returns.

**`SKIP LOCKED` requires a transaction and a short one.** The rows are locked until
the transaction ends, so a worker that claims ten jobs and then spends four minutes
processing them holds those locks for four minutes. Claim, mark, commit; then
process. The concurrency budget argument is
**[Where the boundary belongs](../03-jdbc-transactions/15-where-the-boundary-belongs.md)**.

**A hand-written query is a maintenance obligation you have to actually meet.** The
reason to own the SQL is that its plan matters. That is only true if someone
re-examines it when the schema, the indexes or the data volume change. Otherwise you
have the cost of SQL-first with none of the benefit.

**Choosing SQL for one query does not mean choosing it for the aggregate it belongs
to.** These seven are queries, not modules. A codebase where orders are written
through entities and reported on through `JdbcClient` is normal and correct.

## Interview questions

**★ Give three queries where you would not use JPA.**
An aggregate report — `group by` with `sum` and `count` — because there is no entity
for the result and forcing one means shipping every contributing row to the JVM. A
bulk state change such as archiving every completed order older than a year, because
one `UPDATE … WHERE` runs entirely in the database whereas the entity route selects
every row into memory and issues a statement per object. And a recursive query over
a hierarchy, because walking `getChildren()` is one query per node at arbitrary
depth and no fetch join fixes an unbounded tree. A fourth I would add is anything
using `ON CONFLICT` or `FOR UPDATE SKIP LOCKED`, where the database-specific clause
*is* the point of the query.

**★ Why is `INSERT … ON CONFLICT` better than checking and then inserting?**
Because check-then-insert is a race, and `ON CONFLICT` is atomic. Between your
`SELECT` and your `INSERT`, another transaction can insert the same key; you then get
a `DuplicateKeyException` and have to retry, or you silently overwrite. `ON
CONFLICT DO UPDATE` performs the whole decision inside one statement, under the
index's own uniqueness guarantee, and `RETURNING` hands back the resulting row. For
a counter — a daily metric, a rate-limit bucket — it also removes the read entirely:
one statement, one round trip, no lost updates.

**★ Someone wants to add a dashboard to a JPA codebase. What do you advise?**
Add a `JdbcClient` and a record per query, and leave the entities alone. The
dashboard's results are aggregates with no corresponding table, so any JPA answer
ends in a DTO projection anyway — at which point you are choosing between writing
the SQL and having a DSL write it. Writing it yourself means the plan is visible and
tunable, which matters for exactly this kind of query. The one thing to be careful
about is not to run those reads inside a transaction that also has entities loaded
and modified, which is the flush-ordering trap.

**★ How do you decide, per repository method?**
One question first: is a row of the result a row of a table? If not — computed
columns, aggregates, joins that produce a new shape — it is SQL. If it is, the
second question is what you intend to do with the object. If you are going to modify
it and save it, an entity earns its keep: dirty checking, cascade and optimistic
locking are real work you would otherwise write. If you are going to render it and
throw it away, a record from a projection is less machinery and less to go wrong.
Bulk writes and database-specific clauses are SQL regardless.

**★ Is there a query where you would *prefer* the entity even though SQL would
work?**
Yes — loading an aggregate root to change it. Take an order with its lines, where
the business rules are "recalculate the total when a line changes" and "you cannot
remove the last line". With entities you load it, apply the rule in Java, and let
dirty checking work out which rows to write. With SQL you load it, apply the rule,
and then decide by hand which lines are new, changed and deleted, and issue those
statements in the right order. That diffing is exactly what an ORM does for you, and
writing it yourself is where the bugs are.

**★ What is the cost of a recursive CTE going wrong?**
A query that does not return. `union all` in the recursive term does not
deduplicate, so a cycle in the data recurses until something runs out — memory,
disk, or a statement timeout if you set one. It is a good argument for the layered
timeouts of
**[Setting the timeouts](../01-jdbc/22e-setting-the-timeouts.md)**: the server-side
`statement_timeout` is the only one that stops the database doing the work, as
opposed to stopping you waiting for it. The structural fix is a depth column with a
bound in the recursive term, or `union` if duplicate rows are acceptable.

---

← Prev: [9 · The connection](09-transactions-and-the-connection.md) · Index: [SQL-first access](README.md) · Next → [10b · What you give up](10b-what-you-give-up.md)
