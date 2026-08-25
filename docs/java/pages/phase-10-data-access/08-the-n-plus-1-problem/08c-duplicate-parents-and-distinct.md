---
title: "Since Hibernate 6 you must NOT write distinct to remove duplicate parents — Hibernate does it for you, and the keyword now only costs you a DISTINCT in SQL"
sidebar_label: "8c · Duplicates and distinct"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *A Guide to Hibernate Query
> Language* §4.3.1 *Duplicate removal*
> ([docs.hibernate.org/orm/7.4/querylanguage/html_single/](https://docs.hibernate.org/orm/7.4/querylanguage/html_single/Hibernate_Query_Language.html)),
> the Hibernate ORM 7.4 user guide §17.8.4
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and `org.hibernate.cfg.QuerySettings` in the Hibernate 7.4 source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/cfg/QuerySettings.java)).
> JDK 25, Hibernate ORM 7.4.1, PostgreSQL 18.

**🔴 This is the single most out-of-date piece of received wisdom in this topic.
Almost every article, answer and tutorial about fetch joins tells you to write
`select distinct`. On Hibernate 6 and later that advice is wrong — the
de-duplication happens without it, and adding the keyword sends a real `DISTINCT`
to the database that does real work for nothing.**

## The problem it used to solve

A collection fetch join flattens the graph into a rectangle
([chunk 8b](08b-what-a-fetch-join-breaks.md)). One order with three lines is
three rows, with the order's columns repeated on each.

Hibernate reads those rows and assembles the graph by identity: one `Order`
instance, one `lines` collection, three `OrderLine` instances. That part has
always worked. What used to leak was the *list* Hibernate handed back — the same
`Order` reference appearing three times in the returned `List<Order>`.

So people wrote `select distinct o` to collapse them, and the whole ecosystem
learned that as the rule.

## What Hibernate 6 changed

The HQL guide states the current behaviour in two sentences that are worth
reading carefully, because both halves matter:

> *"**As of Hibernate 6, duplicate results arising from the use of `join fetch`
> are automatically removed by Hibernate in memory**, after reading the database
> results and materializing entity instances as Java objects. It's no longer
> necessary to remove duplicate results explicitly, and, in particular,
> `distinct` should not be used for this purpose."*

**"`distinct` should not be used for this purpose."** That is not a suggestion
that it is unnecessary; it is an instruction not to do it.

And the guide is equally clear about what the keyword now means:

> *"The `distinct` keyword helps remove duplicate results from the query result
> list. **Its only effect is to add `distinct` to the generated SQL.**"*

## So what does writing it now cost you

`select distinct o from Order o left join fetch o.lines` becomes:

```sql
select distinct o1_0.id, o1_0.reference, o1_0.placed_at,
                l1_0.order_id, l1_0.id, l1_0.sku, l1_0.quantity, l1_0.unit_price
from orders o1_0
left join order_line l1_0 on o1_0.id = l1_0.order_id
```

Look at what `DISTINCT` is being asked to do there. It must de-duplicate across
**every selected column of both tables** — and because the child columns are in
the select list, every row is already unique. So:

- The database must sort or hash the entire result set to establish uniqueness.
- It removes **nothing**, because no two rows are identical.
- On PostgreSQL 18 this typically means an extra sort or hash-aggregate step over
  the whole result, in service of zero rows eliminated.

**You pay for a de-duplication that cannot fire, to solve a problem Hibernate
already solved in memory.** That is the whole argument, and it is why the guide
says not to.

## `passDistinctThrough` is gone

The Hibernate 5 mitigation was a hint,
`hibernate.query.passDistinctThrough = false`, which told Hibernate to apply
`distinct` to the Java list but not pass it through to SQL — exactly the
behaviour that is now the default and unconditional.

I grepped `org.hibernate.cfg.QuerySettings` in the 7.4 source: **there is no
`distinct` setting of any kind in it.** The hint is gone, because the behaviour
it enabled is no longer optional. If you find it in a codebase, it is dead
configuration from a Hibernate 5 migration and can be removed.

## When `distinct` is still correct

The keyword is not deprecated — it does a real job, just not this one. Use it
when you want the *database* to de-duplicate rows, which is a scalar concern:

```java
// ✅ correct: genuinely duplicated scalar values
@Query("select distinct o.status from Order o")
List<OrderStatus> distinctStatuses();

// ✅ correct: a join used for filtering, projecting one column
@Query("""
       select distinct c.lastName from Customer c
       join c.orders o
       where o.placedAt > :cutoff
       """)
List<String> namesOfRecentBuyers(@Param("cutoff") Instant cutoff);
```

In both cases the duplicates are genuine duplicate *values*, `DISTINCT` will
actually eliminate rows, and doing it in the database means fewer rows on the
wire. The guide's own example of a legitimate use is the same shape:
`select distinct author from Publisher as pub join pub.books as book join
book.authors as author where pub.id = :pid` — a join used to navigate, projecting
one entity, where the same author genuinely appears many times.

**The test: would `DISTINCT` actually remove rows at the database?** If the
select list contains the child's columns, it cannot, and you are paying for
nothing. If you are projecting a scalar or a single entity that a join genuinely
duplicated, it can, and you should.

## What this means for reading older material

Anything written before roughly 2022 about fetch joins will tell you to use
`distinct`, and much written since repeats it. When you encounter that advice,
the question to ask is which Hibernate version it targets:

| Version | Duplicate parents in the list | What to write |
|---|---|---|
| Hibernate 5 | present | `select distinct` + `passDistinctThrough=false` |
| Hibernate 6, 7 | removed automatically | nothing |

Removing a now-pointless `distinct` from an existing query is a safe change on
6 or later, and one of the cheapest performance wins available in a legacy
codebase — with the one caveat below.

⚠️ **Check whether the `distinct` was doing a second job.** A query that projects
a scalar, or that joins for filtering without fetching, may be relying on it
genuinely. Read the select list before deleting the keyword.

## Gotchas

**⚠️ Adding `distinct` to a fetch-join query on Hibernate 6 or 7.**
The de-duplication already happened in memory. All you have added is a `DISTINCT`
over every column of both tables, which the database must evaluate and which
removes nothing. It is a pure cost.

**⚠️ Removing `distinct` from a query that projects a scalar.**
Different job entirely. `select distinct o.status` genuinely needs it, and
deleting it changes the result. Look at the select list, not at whether the query
contains `fetch`.

**⚠️ Carrying `hibernate.query.passDistinctThrough` forward from a Hibernate 5
migration.**
It no longer exists in `QuerySettings`. Unrecognised query hints are ignored
rather than rejected — Hibernate logs *"Ignoring unrecognized query hint"* — so
it will sit in your configuration doing nothing and implying something.

**⚠️ Assuming the duplicates were never there.**
They still arrive from the database — the flat result set genuinely contains the
parent once per child. What changed is that Hibernate removes them from the list
it returns. The row count over the wire is unaffected, which is why fan-out still
matters for choosing between a join and a batch.

**⚠️ Using `distinct` to fix a wrong row count from a `join` without `fetch`.**
If a plain join is duplicating your parents, the duplicates are a symptom of
joining a to-many for filtering. The fix is usually `exists` or `in`, not
`distinct` — a semi-join expresses "has at least one matching child" without
multiplying rows in the first place.

**⚠️ Expecting `Collectors.toSet()` or `.distinct()` in Java to be a substitute.**
They de-duplicate by `equals`/`hashCode`, which on an entity may dereference an
association and issue a query per element —
[chunk 4e](04e-lazy-columns-and-hashcode.md). Hibernate's own de-duplication is
by persistence identity and costs nothing.

## Interview questions

**★ Do you need `select distinct` with a collection fetch join?**
Not since Hibernate 6, and you should not use it. The HQL guide states that
duplicate results arising from `join fetch` "are automatically removed by
Hibernate in memory, after reading the database results and materializing entity
instances as Java objects", and adds that "`distinct` should not be used for this
purpose". The reason it is actively harmful rather than merely redundant is the
guide's other statement about the keyword: its only effect is to add `distinct`
to the generated SQL. So on a fetch-join query you are asking the database to
de-duplicate across every selected column of both tables — which, because the
child's columns are in the select list, makes every row unique, so the operation
sorts or hashes the whole result set and eliminates nothing.

**★ Where did the duplicates come from in the first place?**
From the shape of the result set. A collection fetch join is a SQL join, so an
order with three lines comes back as three rows with the order's columns repeated
on each. Hibernate assembles those into one `Order` with a three-element
collection — that has always worked correctly. What leaked in older versions was
the returned `List`, which contained the same `Order` reference three times,
because Hibernate emitted one list element per result row. Hibernate 6 changed
that to de-duplicate by persistence identity after materialisation. Worth noting
what did *not* change: the database still returns the same number of rows, so the
data volume on the wire is unaffected, which is why fan-out still matters when
choosing between a fetch join and batch fetching.

**★ What was `hibernate.query.passDistinctThrough` and where is it now?**
It was a Hibernate 5 hint that let you write `distinct` in HQL — because you
needed it to de-duplicate the Java list — without that `distinct` being passed
through to the generated SQL, where it would have been an expensive no-op. In
other words it decoupled the two jobs the keyword was doing. It is gone in
Hibernate 6 and later, and I confirmed its absence by grepping
`org.hibernate.cfg.QuerySettings` in the 7.4 source, where there is no
distinct-related setting at all. It disappeared because the behaviour it enabled
became unconditional: the in-memory de-duplication always happens, and `distinct`
always means only "add `DISTINCT` to the SQL". If you find the property in a
configuration file it is dead weight from a Hibernate 5 migration — and it will
not error, because Hibernate logs unrecognised query hints and ignores them.

**★ When is `distinct` still the right thing to write?**
When the duplicates are genuine duplicate *values* and the database can actually
eliminate rows. Projecting a scalar over a join is the clearest case —
`select distinct c.lastName from Customer c join c.orders o where …` — because
the join multiplies rows and the projection then makes many of them identical, so
`DISTINCT` removes real rows and reduces what crosses the wire. The guide's own
example is the same shape with an entity: `select distinct author from Publisher
pub join pub.books book join book.authors author where pub.id = :pid`. The test
that settles it in either direction is to ask whether `DISTINCT` could remove any
row at the database. If the select list includes a fetched child's columns, every
row is already unique and the answer is no.

**★ You inherit a codebase full of `select distinct … join fetch` queries on
Hibernate 7. What do you do?**
Remove the `distinct` from the ones that fetch collections, because on 6 and
later it buys nothing and costs a sort or hash over the entire result set at the
database. It is one of the cheapest available wins in a legacy codebase. The one
piece of care needed is to read each select list rather than pattern-matching on
the presence of `fetch`: a query that projects a scalar, or that joins for
filtering without fetching, may genuinely need the keyword, and deleting it there
changes the result. It is also worth checking for
`hibernate.query.passDistinctThrough` in the configuration at the same time and
removing it, since it is a strong indication the codebase was written against
Hibernate 5 and that other stale assumptions — pagination with fetch joins in
particular — are likely present too.

**★ If Hibernate de-duplicates by identity, does that mean `equals` on the entity
matters?**
No, and that distinction is worth being clear about. Hibernate's de-duplication
uses *persistence identity* — within one persistence context there is exactly one
Java object per (entity type, primary key), so the three rows for one order
resolve to the same instance and the duplicates are removed by reference. Your
`equals` and `hashCode` are not consulted, and no association is dereferenced.
That contrasts sharply with de-duplicating in Java: `Collectors.toSet()` or
`Stream.distinct()` over entities call `hashCode` and `equals` on every element,
which on an entity with a generated `hashCode` will dereference associations and
can issue a query per element. So Hibernate's version is both free and safe, and
the hand-rolled Java version is neither.

---

← Prev: [8b · What it breaks](08b-what-a-fetch-join-breaks.md) · Index: [The N+1 problem](README.md) · Next → [8d · Pagination](08d-pagination.md)
