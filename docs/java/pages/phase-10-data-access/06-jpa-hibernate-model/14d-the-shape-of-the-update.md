---
title: "Hibernate writes every column in the UPDATE, not just the one you changed — and the annotation that fixes that trades one kind of cost for another"
sidebar_label: "14d · The shape of the UPDATE"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §6.10 *Modifying
> managed/persistent state*, §6.10.1 *Dynamic updates*, §3.14 `@DynamicInsert`, §11.1.1
> *Versionless optimistic locking* and §13 *Batching*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and the `org.hibernate.annotations.DynamicUpdate` javadoc in the Hibernate 7.4 source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/tree/7.4)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**Dirty checking decides *whether* to write. It does not decide *what* the statement looks
like. By default Hibernate writes an `UPDATE` that sets every mapped column except the
identifier, regardless of how many of them actually changed — and it does that on purpose,
for two reasons that are worth more than the wasted columns in most systems.**

## The default: all columns

The User Guide states it flatly in §6.10:

> By default, when you modify an entity, all columns but the identifier are being set
> during update.

So for a four-column `Product`, changing one field produces a statement of the shape
`update Product set description=?, name=?, price_cents=?, quantity=? where id=?` — four
parameters bound, three of them to the values already in the row.

That looks wasteful, and the first reaction is always to reach for `@DynamicUpdate`.
Before you do, read the two reasons the default exists, because they are not
rationalisations.

### Reason one: one statement string, cached

> it allows you to better benefit from JDBC `Statement` caching.

An entity with a fixed `UPDATE` has exactly **one** update statement string for its
lifetime. The driver and the database each parse and plan it once and reuse the plan. With
dynamic updates, the statement text depends on which fields happen to be dirty, so an
entity with *n* updatable columns has up to 2ⁿ − 1 distinct statements. On PostgreSQL,
where the server-side prepared-statement cache is per connection and bounded — see
[topic 05 · 5b · `IN` lists and the statement cache](../05-sql-first-access/05b-in-lists-and-the-statement-cache.md)
— that variety is not free.

### Reason two: batching

> it allows you to enable batch updates even if multiple entities modify different
> properties.

JDBC batching requires the same `PreparedStatement`. Update a thousand `Product`s, each
touching a different field, and with the fixed statement they all go into one batch. With
`@DynamicUpdate` they fragment into as many batches as there are distinct dirty-field
combinations. For a bulk job this is usually a far larger cost than the extra columns.

The batching chapter's advice about `hibernate.jdbc.batch_size` — "an integer between 10
and 50" — assumes statements that can actually share a batch.

### The cost the default does carry

> However, there is also one downside to including all columns in the SQL `UPDATE`
> statement. If you have multiple indexes, the database might update those redundantly
> even if you don't actually modify all column values.

That is the real argument on the other side, and it is a database-side one: index
maintenance, and on some engines trigger and audit noise, for columns whose values did not
change. On a wide table with many indexes, or with row-level auditing triggers that fire
per changed column, it matters.

## `@DynamicUpdate`

```java
@Entity
@DynamicUpdate
class Product {
    @Id Long id;
    String name;
    String description;
    @Column(name = "price_cents") Integer priceCents;
    Integer quantity;
}
```

Now changing only the price produces `update Product set price_cents=? where id=?`. The
User Guide's summary: "The dynamic update allows you to set just the columns that were
modified in the associated entity."

**Where it genuinely helps:**

- A wide table — dozens of columns — where any given operation touches two or three.
- A table carrying large values (`text`, `jsonb`, `bytea`) that would otherwise be
  rewritten in full on every unrelated change.
- A table with many indexes, where redundant index maintenance is measurable.
- Row-level auditing or triggers that key off which columns appear in the statement.
- Concurrency: a narrower `SET` clause reduces the window in which two transactions
  writing different fields of the same row conflict at the application level. It does
  **not** change row-level locking — both statements still lock the row.

**Where it hurts:**

- Bulk writes, because batching fragments.
- Statement-cache pressure on entities with many updatable columns.
- Reasoning: the SQL you see in a log for one code path is not the SQL another code path
  emits for the same entity.

`@DynamicInsert` is the same idea for `INSERT`: §3.14's example omits attributes that are
`null` so that database column defaults apply, which is the one thing a full `INSERT`
cannot do.

## When `@DynamicUpdate` stops being optional

Versionless optimistic locking requires it. Both variants of
`@OptimisticLocking` come with the same instruction in the User Guide:

> When using `OptimisticLockType.ALL`, you should also use `@DynamicUpdate` because the
> `UPDATE` statement must take into consideration all the entity property values.

> When using `OptimisticLockType.DIRTY`, you should also use `@DynamicUpdate` because the
> `UPDATE` statement must take into consideration all the dirty entity property values […]

That whole mechanism is [16c · Beyond `@Version`](16c-beyond-version.md); the point here
is that `@DynamicUpdate` is a prerequisite for it rather than an independent tuning
choice.

## The other lever: `updatable = false`

`@Column(updatable = false)` removes a column from the `SET` clause permanently, for every
statement, without changing the statement's stability. It is the right tool for a value
that is genuinely write-once — a `created_at`, a natural key, an immutable foreign key.

It is the wrong tool for "I do not want to write this right now", because it fails
silently: the field is still mapped, still compared, still able to make the entity dirty,
and an assignment to it simply never reaches the database.

| | `@Transient` | `@Column(updatable = false)` | `@DynamicUpdate` |
|---|---|---|---|
| in the snapshot? | no | yes | yes |
| can make the entity dirty? | no | yes (via other fields) | yes |
| in the `SET` clause? | n/a | never | only when dirty |
| statement string stable? | n/a | yes | no |

## Gotchas

**★ `@DynamicUpdate` defeats JDBC batching for mixed workloads.** Entities dirty in
different fields cannot share a `PreparedStatement`. If you turned on `batch_size` and
then added `@DynamicUpdate`, you may have undone it — and neither setting complains.

**★ The default `UPDATE` rewrites large columns you did not touch.** A `text` or `jsonb`
column is re-sent in full on every update of that row. On a wide row this is the strongest
single argument for `@DynamicUpdate`, and it is a network and WAL cost, not a CPU one.

**★ `@DynamicUpdate` is per entity, not per operation.** You cannot ask for it on one
service method. If the same entity is both hot-path-narrow and bulk-wide, you are choosing
which one to optimise for.

**★ It does not reduce the number of statements, only their width.** Dirty checking still
produces one `UPDATE` per dirty entity. If your problem is a thousand statements rather
than a thousand wide statements, this annotation is not the fix — a bulk JPQL `update` is,
with the persistence-context consequences described in
[15d · Reading your own writes](15d-reading-your-own-writes.md).

**★ `@Column(updatable = false)` silently drops assignments.** No exception, no warning.
Code that sets the field and expects it to persist will pass its own in-memory assertions
and fail against the database.

**★ A `null`-valued column is still written by the default `UPDATE`.** Setting a field to
`null` and setting it to the same value it already held are both "all columns" as far as
the statement is concerned — the difference is only whether dirty checking fired at all.

**★ `@DynamicInsert` and column defaults interact.** Without it, an `INSERT` binds `null`
explicitly and the database default never applies. With it, the column is omitted and the
default does. If you have ever wondered why a `DEFAULT now()` column came out `null`, this
is usually why.

**★ Statement-cache churn is invisible in application metrics.** The extra parsing happens
in the driver and the database. Nothing in Hibernate's own statistics reports it, so the
cost of `@DynamicUpdate` on a wide entity has to be looked for on the database side.

## Interview questions

**★ Why does Hibernate update every column by default when it knows which one changed?**
Two documented reasons: a single stable statement string benefits from JDBC and database
statement caching, and identical statements can be batched even when different entities
changed different fields. The trade-off it accepts is redundant index maintenance and
rewriting values that did not change.

**★ When would you add `@DynamicUpdate`?**
On a wide table where a typical operation touches a small subset of columns, especially
when some of those columns are large or heavily indexed — and when the workload is
transactional rather than bulk. Also when you use versionless optimistic locking, where
the User Guide requires it.

**★ What does `@DynamicUpdate` cost?**
Statement-string variety: up to 2ⁿ − 1 distinct statements for *n* updatable columns,
which pressures the statement cache and fragments JDBC batches. It also makes the SQL for
an entity path-dependent, which complicates reading logs.

**★ Is `@Column(updatable = false)` a way to stop dirty checking on a field?**
No. The attribute stays mapped and stays in the snapshot; only the `SET` clause changes.
The entity can still be dirty, and an assignment to that field is silently discarded. To
keep a value out of dirty checking entirely, it must not be mapped.

**★ You enabled `hibernate.jdbc.batch_size` and throughput did not improve on an
`@DynamicUpdate` entity. Why?**
Because entities dirty in different columns produce different statements and cannot share
a batch. Batching needs the same `PreparedStatement`; dynamic updates guarantee it varies.

**★ What does `@DynamicInsert` buy you that a normal `INSERT` cannot?**
Database column defaults. A full `INSERT` binds every column, so a `null` field is written
as `null` and the `DEFAULT` clause never fires. `@DynamicInsert` omits the null attributes,
letting the default apply.

**★ Does a narrower `UPDATE` reduce lock contention?**
Not at the row level — both statements take the same row lock. What it reduces is
application-level conflict: with versionless `DIRTY` locking, two transactions changing
different columns of the same row can both succeed, which they cannot when every column is
in the `WHERE` clause.

---

← Prev: [14c · What counts as a change](14c-what-counts-as-a-change.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [14e · What dirty checking costs](14e-what-dirty-checking-costs.md)
