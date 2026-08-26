---
title: "The three things a fetch join breaks, and the one rule that tells you in advance which queries are safe"
sidebar_label: "8b · What it breaks"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §17.8.4 *join fetch
> for association fetching*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Hibernate ORM 7.4 *A Short Guide to Hibernate 7* §8.6 *Join fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**A fetch join makes the statement count 1. It does that by flattening a graph
into a rectangle, and everything it breaks follows from that one fact. This chunk
is the catalogue and the rule; the three failure modes get a chunk each after
it.**

## What it breaks

Three things, each with its own chunk, listed here so you know what you are
signing up for:

1. **Duplicate parent rows.** The flat result set repeats the parent once per
   child. Hibernate 6 and later handle this for you, and almost everything
   written about it on the internet is now wrong — [chunk 8c](08c-duplicate-parents-and-distinct.md).
2. **Pagination.** This was the notorious limitation, and **Hibernate 7.4 fixed
   it** — [chunk 8d](08d-pagination.md).
3. **More than one collection at a time.** A Cartesian product, or a
   `MultipleBagFetchException` — [chunk 8e](08e-multiplebagfetchexception.md).

## What is always safe

The user guide's rules, which are the ones to memorise:

> *"it's perfectly safe to fetch several to-one associations in series or
> parallel in a single query, and a single series of nested fetch joins is also
> fine, but fetching multiple collections or to-many associations in parallel
> results in a Cartesian product at the database level, and might exhibit very
> poor performance."*

So this is fine — three to-ones and one chain:

```java
@Query("""
       select o from Order o
       left join fetch o.customer c
       left join fetch c.address
       left join fetch o.paymentMethod
       where o.id = :id
       """)
Optional<Order> findFullyLoaded(@Param("id") Long id);
```

and this is the shape to avoid — two collections side by side:

```java
// ⛔ Cartesian product, or MultipleBagFetchException
select o from Order o
  left join fetch o.lines
  left join fetch o.shipments
```

## One more rule, and it is a real trap

> *"HQL doesn't disallow it, but it's usually a bad idea to apply a restriction
> to a `join fetch`ed entity, since the elements of the fetched collection would
> be incomplete."*

```java
// ⛔ o.lines is now populated with ONLY the shipped lines,
//    and Hibernate will happily treat that partial collection as complete
select o from Order o
  left join fetch o.lines l
  where l.status = 'SHIPPED'
```

The order's `lines` collection now contains a subset, and nothing marks it as
partial. If that entity is modified and flushed, the persistence context may
conclude the missing lines were removed. The guide goes further and advises
against even naming the fetched alias: *"it's best to avoid even assigning an
identification variable to a fetched joined entity except for the purpose of
specifying a nested fetch join."*

If you need filtered children, that is a query returning children, not a parent
with a partial collection — which is
[12 · Projections and DTOs](12-projections-and-dtos.md)'s
argument again.

Finally: *"Fetch joins are disallowed in subqueries, where they would make no
sense."*

## The one rule

A to-one join adds **columns** to a row. A to-many join multiplies **rows**.
Everything else follows.

```
one Order, 3 lines, fetch-joined                one Order, 3 lines and 2 shipments
┌────────┬──────────┐                           ┌────────┬──────────┬───────────┐
│ order  │ line A   │                           │ order  │ line A   │ shipment 1│
│ order  │ line B   │  ← parent repeated 3×     │ order  │ line A   │ shipment 2│
│ order  │ line C   │                           │ order  │ line B   │ shipment 1│
└────────┴──────────┘                           │ order  │ line B   │ shipment 2│
                                                │ order  │ line C   │ shipment 1│
                                                │ order  │ line C   │ shipment 2│
                                                └────────┴──────────┴───────────┘
                                                        3 × 2 = 6 rows
```

Every failure below is one of those two facts biting.

## Gotchas

**⚠️ Adding a second collection fetch because the first one worked.**
Rows multiply rather than adding. Two collections of ten each on a hundred
parents is ten thousand rows, and if both are mapped as `List` without an
`@OrderColumn` you get an exception instead — [chunk 8e](08e-multiplebagfetchexception.md).

**⚠️ Reasoning about a fetch join in terms of statement count only.**
One statement is not automatically better than a hundred. A join fetch trades
round trips for result-set size, and when fan-out is large that trade goes the
wrong way. Count rows as well as statements.

**⚠️ Assuming `distinct` is needed for duplicate parents.**
It has not been since Hibernate 6, and adding it now sends a `DISTINCT` to the
database that does real work for no benefit — [chunk 8c](08c-duplicate-parents-and-distinct.md).

**⚠️ Assuming pagination and collection fetches are still incompatible.**
That was true through Hibernate 6 and early 7, and **7.4 fixed it**. Nearly every
article you will find on this is out of date — [chunk 8d](08d-pagination.md).

**⚠️ Filtering on the fetched alias to keep the result small.**
It produces a partial collection that Hibernate does not know is partial. See
[chunk 8](08-join-fetch.md); the guide advises against even naming the alias.

**⚠️ Chaining to-one fetches without watching the depth.**
A single series of nested fetch joins is documented as fine, but each level adds
a join, and `hibernate.max_fetch_depth` exists because deep graphs produce
unwieldy SQL. Fine is not the same as unbounded.

## Interview questions

**★ Why does fetching two collections in one query produce a Cartesian product?**
Because a to-many join multiplies rows rather than adding columns. Joining
`Order` to `lines` gives one row per line, with the order's columns repeated;
joining that result to `shipments` gives one row per (line, shipment) pair, again
with everything repeated. So an order with ten lines and eight shipments produces
eighty rows for a single order, and the database has to build, transfer and
Hibernate has to de-duplicate all of them — for eighteen child objects. The
totals are correct, because Hibernate assembles the graph by identity, but the
work is quadratic in the fan-out. That is why the user guide says fetching
multiple to-many associations in parallel "results in a Cartesian product at the
database level, and might exhibit very poor performance", while several to-one
fetches in parallel are perfectly safe.

**★ What is the difference between a to-one and a to-many fetch join, in terms of
the result set?**
A to-one fetch join widens the row: the associated entity's columns are appended
to the parent's, and the number of rows is unchanged. A to-many fetch join
lengthens the result: the parent's columns are repeated once per child, so N
parents with an average of M children give roughly N × M rows. That single
difference explains everything else — why several to-ones compose freely, why two
to-manys multiply, why duplicate parent rows appear only with collections, and
why pagination on a collection fetch was historically hard, since a database
`LIMIT` counts rows and rows are no longer parents.

**★ If a fetch join makes it one statement, when is it the wrong choice?**
When the result set it produces is worse than the round trips it saves. The
statement count is not the only cost: a join fetch repeats every parent column
once per child, so with high fan-out you move far more bytes than the N+1 version
did, and the database does more work assembling it. Hibernate's own guidance is
that batch fetching "can only be the best solution in rare cases where outer join
fetching would result in a cartesian product and a huge result set" — note that
this is framed as a rare case, so the default should still be the join. The other
wrong-choice cases are structural rather than about volume: two collections at
once, and a query where you need to filter the children, both of which a fetch
join cannot express correctly at all.

**★ Which of the three limitations still applies on Hibernate 7.4?**
Only one of the three in its original form. Duplicate parent rows were handled
from Hibernate 6, which de-duplicates fetch-join results in memory, so `distinct`
is no longer needed and should not be used for that purpose. Pagination with a
collection fetch join was fixed in 7.4, which now applies the limit inside the
SQL on any database supporting limits and offsets in subqueries — which is every
supported database except Sybase ASE. What remains is the multiple-collection
problem, and that one is not a limitation Hibernate can remove: it is arithmetic.
Joining two to-many associations multiplies their rows, and no amount of
implementation cleverness makes ten times eight anything other than eighty.

---

← Prev: [8 · join fetch](08-join-fetch.md) · Index: [08 · The N+1 problem](README.md) · Next → [8c · Duplicates and distinct](08c-duplicate-parents-and-distinct.md)
