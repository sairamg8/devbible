---
title: "Below 7.4 you page the ids first and fetch the graph second — and the forgotten order by in step two is the bug everyone writes"
sidebar_label: "8d2 · Paginating before 7.4"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the *Guide to Hibernate Query Language* §4.5.1
> *Limits and offsets*
> ([docs.hibernate.org/orm/7.4/querylanguage/html_single/](https://docs.hibernate.org/orm/7.4/querylanguage/html_single/Hibernate_Query_Language.html)),
> the *7.4 Migration Guide*
> ([docs.hibernate.org/orm/7.4/migration-guide/migration-guide.html](https://docs.hibernate.org/orm/7.4/migration-guide/migration-guide.html))
> and the Spring Data JPA 4.1 reference *JPA Query Methods*
> ([docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**[Chunk 8d](08d-pagination.md) is the good news. This is what to do if you are
not on 7.4 yet — which, given how recent it is, is most readers — and what the
pattern you will find in existing code is actually doing.**

## What to do on each version

| Your Hibernate | Pagination + collection fetch join |
|---|---|
| 5.x | ⛔ in-memory limit, `HHH000104`. Use the two-query pattern below. |
| 6.x, 7.0–7.3 | ⛔ in-memory limit, `HHH90003004` at WARN. Two-query pattern. |
| **7.4+ on PostgreSQL** | ✅ works, limit applied in SQL |
| 7.4+ on Sybase ASE | ⛔ still in-memory |

### The two-query pattern, for anything before 7.4

Still worth knowing — you will meet it in every codebase written before this
year, and it is the correct fix on an older version:

```java
// 1. page the PARENT IDS only — no fetch join, so LIMIT counts orders
@Query("select o.id from Order o where o.placedAt > :cutoff order by o.placedAt desc")
Page<Long> findRecentIds(@Param("cutoff") Instant cutoff, Pageable pageable);

// 2. fetch the full graph for exactly those ids — no limit, so no conflict
@Query("select distinct o from Order o left join fetch o.lines where o.id in :ids")
List<Order> findAllWithLinesByIdIn(@Param("ids") List<Long> ids);
```

Two round trips instead of one, but bounded — and the first query is cheap
because it selects one indexed column.

⚠️ The `order by` must be repeated in the second query, or the ids come back in
whatever order the `in` list happens to produce.

**On 7.4 you no longer need this**, and replacing it with a single paginated
fetch join is a real simplification. Do check the version before you do — the
whole point of this chunk is that the answer changed recently.

### The alternative that works on every version

Do not fetch-join at all; page the parents and let batch fetching resolve the
collection:

```java
Page<Order> page = orders.findByPlacedAtAfter(cutoff, pageable);   // no fetch join
// @BatchSize(size = 25) on Order.lines, or hibernate.default_batch_fetch_size
```

The limit is unambiguous because no join multiplies rows, and the collections
come back in a small number of batched selects rather than one per order. This is
[10 · `@BatchSize`](10-batch-size.md)'s central argument — that batch fetching's real
virtue is composability — and pagination is the clearest case of it.

## Gotchas

**⚠️ Forgetting `order by` in the second query.**
An `in` list does not preserve the order of its arguments. The page comes back
correctly filtered and arbitrarily sorted, which presents as a pagination bug and
is not one. Repeat the sort in both queries.

**⚠️ Sorting on a column that is not unique, without a tiebreaker.**
`order by o.placedAt desc` with duplicate timestamps gives an unstable order
across pages, so a row can appear on two consecutive pages or on neither. Add the
primary key as a final sort key — true of offset pagination generally, but the
two-query pattern makes it easier to miss because the sort appears twice.

**⚠️ Passing an unbounded id list to the second query.**
The list is the page size, so it is bounded by construction — unless somebody
reuses the second method elsewhere with a larger collection. PostgreSQL handles
large `in` lists, but the prepared-statement plan cache does not love a parameter
count that varies on every call; see
[Topic 01 · JDBC](../01-jdbc/README.md) on `in` lists and the generic plan.

**⚠️ Using `Page` rather than `Slice` when you do not need a total.**
`Page` runs an extra `count` query on every call. If the UI only needs "is there
a next page", `Slice` avoids it entirely — a free saving that has nothing to do
with fetch joins and is worth taking while you are here.

**⚠️ Applying the pattern to a to-one association.**
It is not needed. To-one fetch joins add columns rather than multiplying rows, so
the limit still counts parents and pagination was never broken for them. Only
collection fetches had this problem.

**⚠️ Keeping the pattern after upgrading to 7.4.**
Nothing breaks — it still works — but you are paying two round trips for
something that is now one, and carrying the `order by` trap for no reason. Sweep
for it as part of the upgrade.

**⚠️ Reaching for it when batch fetching would do.**
If the page is small and the collection is modest, simply not fetch-joining and
letting `@BatchSize` resolve the collections is simpler than either pattern: one
query for the page, a couple for the collections, no unit mismatch anywhere.

## Interview questions

**★ How do you paginate a query that needs a collection, on Hibernate 6?**
With the two-query pattern. The first query pages the parent *ids* only, with no
fetch join, so the `LIMIT` counts orders rather than joined rows — and it is
cheap, because it selects a single indexed column. The second query fetches the
full graph for exactly those ids with `where o.id in :ids` and no limit at all,
so there is no unit mismatch to resolve. That gives two bounded round trips
instead of one unbounded one. The detail that catches people is the `order by`:
it must be repeated in the second query, because an `in` list does not preserve
the order of its arguments, so without it the page is correctly filtered and
arbitrarily sorted.

**★ Is there an approach that works on every version?**
Yes — do not fetch-join at all. Page the parents with an ordinary derived or
`@Query` method, and let batch fetching resolve the collections, either with
`@BatchSize` on the association or `hibernate.default_batch_fetch_size` globally.
Because no join multiplies rows, the limit is unambiguous and pagination is
simply pagination; the collections then come back in a handful of batched selects
rather than one per parent. It is not as few round trips as a single fetch join,
but it is a fixed small number rather than a function of the page size, it needs
no query rewriting, and it composes with everything. Pagination is the clearest
case for batch fetching's real virtue, which is that it does not interact badly
with anything.

**★ Why does the `in` list not preserve order, and how do you handle that?**
Because `in` is a set-membership predicate, not an ordering instruction — SQL is
under no obligation to return rows in the order the values appeared, and
PostgreSQL will return them in whatever order the plan produces, typically index
or heap order. The fix is to repeat the `order by` in the second query, using the
same sort expression as the first. If the sort is expensive or complex, the
alternative is to re-sort in Java by the id list's position, which is exact and
avoids a second sort at the database — but it only works because the page is
small, so it is a deliberate trade rather than a general technique.

**★ Why does this problem not arise for `@ManyToOne` fetch joins?**
Because a to-one join adds columns to a row rather than multiplying rows. Fetch
joining `o.customer` gives exactly one row per order, with the customer's columns
appended, so `LIMIT 10` still means ten orders and pagination behaves normally.
The whole difficulty came from collections making the row count diverge from the
entity count. That is a useful distinction to carry generally: to-one fetches
compose freely with limits, sorting, `distinct` and each other, while to-many
fetches interact with all of them, and almost every documented restriction on
fetch joins is really a restriction on to-many fetches.

---

← Prev: [8d · Pagination](08d-pagination.md) · Index: [08 · The N+1 problem](README.md) · Next → [8e · MultipleBagFetchException](08e-multiplebagfetchexception.md)
