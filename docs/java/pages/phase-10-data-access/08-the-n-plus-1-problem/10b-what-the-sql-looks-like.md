---
title: "On PostgreSQL a batch is one array parameter, not a variable-length IN list — which quietly retires the most-repeated piece of batch-fetching folklore"
sidebar_label: "10b · What the SQL looks like"
sidebar_position: 36
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against *A Short Guide to Hibernate 7* §8.5 *Batch fetching
> and subselect fetching* — including the generated PostgreSQL SQL it prints
> ([docs.hibernate.org/orm/7.4/introduction](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 user guide §12.8 *Batch fetching* and §A.16.11
> `hibernate.query.in_clause_parameter_padding`
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> and the `org.hibernate.annotations.BatchSize` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/annotations/BatchSize.html)).
> JDK 25, Hibernate ORM 7.4.1, PostgreSQL 18, pgJDBC 42.7.x.

**Almost everything written about `@BatchSize` says Hibernate rounds the batch up
to the next power of two so the statement text stays cacheable. That describes a
*different, opt-in setting* about `IN` predicates in queries — and on PostgreSQL
it is moot anyway, because Hibernate 7 passes the whole batch as a single SQL
array parameter, so the statement text never varies in the first place.**

## The two shapes

The **generic** form, which the user guide's §12.8 example prints — ten
departments, `@BatchSize(size = 5)`:

```sql
SELECT e.department_id, e.id, e.name
FROM   Employee e
WHERE  e.department_id IN (0, 2, 3, 4, 5);

SELECT e.department_id, e.id, e.name
FROM   Employee e
WHERE  e.department_id IN (6, 7, 8, 9, 1);
```

The **PostgreSQL** form, from the introduction guide's §8.5, for the same idea:

```sql
select a1_0.books_isbn, a1_1.id, a1_1.bio, a1_1.name
from Book_Author a1_0
    join Author a1_1 on a1_1.id = a1_0.authors_id
where a1_0.books_isbn = any (?)
```

And the guide says exactly why they differ:

> *"The SQL for batch fetching looks slightly different depending on the
> database. Here, on PostgreSQL, Hibernate passes a batch of primary key values
> as a SQL ARRAY."*

🔴 **`= any (?)` is one bind parameter.** The batch — five ids, twenty-five ids,
one id — is a single array value. The statement text is identical for every
batch, so there is exactly one entry in the prepared-statement cache and one
entry in the database's plan cache, regardless of how full the batch is.

## What this retires

The folklore goes: *"Hibernate pads the `IN` list up to the next power of two so
that a partly-full batch produces the same SQL as a full one, and the statement
cache still hits."*

That behaviour is real. It is **`hibernate.query.in_clause_parameter_padding`**,
documented in the settings appendix §A.16.11 as a setting that has existed since
5.2:

> *"Determines how parameters occurring in a SQL `IN` predicate are expanded. By
> default, the `IN` predicate expands to include sufficient bind parameters to
> accommodate the specified arguments. However, for database systems supporting
> execution plan caching, there's a better chance of hitting the cache if the
> number of possible `IN` clause parameter list lengths is smaller. When this
> setting is enabled, we expand the number of bind parameters to an integer power
> of two: 4, 8, 16, 32, 64. Thus, if 5, 6, or 7 arguments are bound to a
> parameter, a SQL statement with 8 bind parameters in the `IN` clause will be
> used, and `null` will be bound to the left-over parameters."*

Three corrections follow, and all three are things you will read the opposite of:

1. **It is a setting, not `@BatchSize` behaviour.** Nothing in the `@BatchSize`
   javadoc or §12.8 says the batch loader rounds anything.
2. **It is opt-in.** The appendix describes the default as "the `IN` predicate
   expands to include sufficient bind parameters to accommodate the specified
   arguments" and describes the padding as what happens "when this setting is
   enabled".
3. **It is about `IN` predicates in your queries**, which is where it earns its
   keep — a repository method taking `Collection<Long> ids` produces a different
   statement for every distinct list length, and that is a genuine plan-cache
   problem the padding solves.

## So do you want the padding setting?

For **batch fetching on PostgreSQL**: it is irrelevant. There is no
variable-length list to pad.

For **`IN` predicates you wrote yourself** — `where o.id in :ids` — it is worth
considering:

```properties
spring.jpa.properties.hibernate.query.in_clause_parameter_padding=true
```

The trade is honest and small. You bind up to `2 × n − 1` parameters instead of
`n`, with `null` in the extras, in exchange for at most a handful of distinct
statement shapes instead of one per list length. On a query called with lists of
1 to 100 ids, that is 7 shapes instead of 100.

⚠️ **Check the semantics of the `null`s.** The appendix says "null will be bound
to the left-over parameters". `id IN (1, 2, NULL, NULL)` is true for 1 and 2 and
unknown for everything else, so it does not match extra rows — but if you have
written a predicate where `NULL` in a list is not inert, verify it. This is one
of the few places SQL's three-valued logic is doing something on your behalf.

## The last partial batch

On PostgreSQL there is nothing to say: the last batch is a shorter array in the
same statement.

⚠️ On a database where Hibernate builds a literal `IN` list, the 7.4
documentation I could find does not describe how a partial batch is expressed —
whether the list is shortened, padded with repeated keys, or padded with nulls.
I am not going to guess. If you are on a database without array-valued
parameters and statement-cache pressure matters to you, that is a thing to
establish for your dialect rather than to assume from an article about a
different one.

## Why the statement shape matters at all

Two caches sit behind it, and they are different things:

- **The JDBC prepared-statement cache** (HikariCP over pgJDBC): keyed by SQL
  text, per connection. A new text is a new `PreparedStatement`, a new parse, and
  eviction pressure on everything else in that connection's cache.
- **The database's own plan cache.** PostgreSQL caches plans per prepared
  statement; a statement seen once and then never again is planned once and
  discarded.

A stable statement text means both caches hit. That is the entire argument, and
on PostgreSQL the array form gives it to you for batch fetching without any
setting at all.

## Gotchas

**⚠️ Repeating the power-of-two claim about `@BatchSize`.**
It is about `hibernate.query.in_clause_parameter_padding`, it is opt-in, and it
is a query-level setting. Saying "Hibernate rounds your batch size up to 8" in a
code review is confidently wrong on two counts.

**⚠️ Choosing a power-of-two batch size for cache reasons.**
`@BatchSize(size = 16)` is not better than `size = 25` because 16 is a power of
two. Pick `k` for round trips and row volume — [chunk 10c](10c-choosing-a-batch-size.md) —
not for a padding behaviour that is a different setting and, on PostgreSQL, is
not in play.

**⚠️ Enabling padding globally without looking at your `IN` predicates.**
It changes every `IN` predicate in the application, binding `null`s into lists
you wrote. The default behaviour is inert with nulls, but a hand-written
predicate that treats a `NULL` element as meaningful will behave differently.

**⚠️ Assuming the array form applies on every database.**
The guide says the SQL "looks slightly different depending on the database" and
names PostgreSQL specifically for the array. Do not carry a conclusion about
PostgreSQL's statement-shape stability to another dialect without checking.

**⚠️ Reading a statement count and forgetting the row count.**
Two statements sounds better than ten. Two statements each returning
`k × fan-out` rows can move far more data than ten small ones. Batch fetching's
risk lives entirely in the row column — [chunk 6](06-count-do-not-read.md).

**⚠️ Counting the batch statements as "the query".**
A monitoring dashboard that groups by statement text sees *one* batch statement
with a high execution count, not ⌈N/k⌉ separate queries. That is convenient for
plan caching and misleading for attribution: the slow endpoint and the batch
statement look unrelated because the statement is shared by every endpoint that
touches that association.

**⚠️ Expecting the ids in the batch to be the ones you are iterating.**
They are drawn from unfetched proxies and collection roles in the session, so the
array can contain parents from an earlier query in the same transaction. That is
usually a bonus and occasionally a surprise when a batch is larger than the loop
you were watching.

**⚠️ Treating a wide array parameter as free on the wire.**
Ten thousand ids in one array is one statement and a large parameter. Drivers and
servers have limits, and a very large batch size can turn a round-trip saving
into a parameter-size problem. This is another reason `k` is a real decision.

## Interview questions

**★ What does the SQL for a batch fetch actually look like?**
Generically, the collection or entity select with `where fk in (?, ?, ?, …)` —
the `@BatchSize` javadoc describes it as "a list of primary keys inside a SQL
`in` condition", and the user guide's §12.8 example prints two statements with
five ids each for ten departments at `size = 5`. On PostgreSQL, Hibernate 7 uses
`where fk = any (?)` and passes the batch as a **SQL array**, which the
introduction guide states explicitly — one bind parameter, one statement text,
regardless of batch fill.

**★ Does Hibernate pad the batch to a power of two?**
Not as part of batch fetching. That is
`hibernate.query.in_clause_parameter_padding`, a separate setting that has
existed since 5.2, is **opt-in**, and applies to `IN` predicates generally. Its
documented behaviour is to expand the bind-parameter count "to an integer power
of two: 4, 8, 16, 32, 64" and bind `null` to the leftovers. Attributing it to
`@BatchSize` is the most commonly repeated error about batch fetching, and on
PostgreSQL it is doubly irrelevant because the array form means there is no
variable-length list to pad.

**★ Why would anyone want that padding?**
Because a query with `where id in :ids` produces a distinct SQL text for every
distinct list length, and each text is a separate prepared statement and a
separate cached plan. A method called with 1 to 100 ids generates 100 statement
shapes. Padding reduces that to seven. The cost is up to twice as many bind
parameters, filled with `null`, which is inert in an `IN` predicate.

**★ Why does statement text stability matter?**
Two caches. The JDBC prepared-statement cache is keyed by SQL text per
connection, so a new text means a parse and eviction pressure; and the database
plans per prepared statement, so a text seen once is planned and discarded. Stable
text means both hit. On PostgreSQL, batch fetching gets that for free through the
array parameter.

**★ How does a partial batch appear?**
On PostgreSQL, as a shorter array in the same statement — nothing changes. On a
dialect where Hibernate emits a literal `IN` list, I could not find a statement in
the 7.4 documentation describing whether the list is shortened or padded, and I
would not assert one. It is worth establishing for your dialect if statement-cache
pressure is something you are actually measuring.

**★ Should the batch size be a power of two?**
No, and believing it should is a symptom of the padding confusion. Choose `k`
from round-trip cost and from `k × fan-out` row volume. A batch size of 25 is not
worse than 16 for any cache reason, and 16 is not better than 25 for any reason
at all.

**★ You see one batch statement in your monitoring with a very high execution
count. What does that tell you?**
That the association is batch-fetched and that the statement is shared across
every endpoint that touches it. It tells you almost nothing about *which*
endpoint is generating the executions, because the text is identical for all of
them — which is the price of the plan-cache benefit. Attribution has to come from
tracing or from per-request query counts, not from grouping by statement text.

---

← Prev: [10 · @BatchSize](10-batch-size.md) · Index: [08 · The N+1 problem](README.md) · Next → [10c · Choosing a batch size](10c-choosing-a-batch-size.md)
