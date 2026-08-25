---
title: "Set, subselect, or stop loading the graph — three fixes with very different costs, and the popular one optimises the wrong metric"
sidebar_label: "8e2 · The three ways out"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *A Short Guide to Hibernate 7*
> §8.6 *Join fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 user guide §3.9.11 *Bags* and §31.6 *Fetching*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the `org.hibernate.annotations.FetchMode` javadoc in the Hibernate 7.4
> source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/annotations/FetchMode.java)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**The exception in [chunk 8e](08e-multiplebagfetchexception.md) has three
answers. Almost everyone takes the first, which removes the message and leaves
the Cartesian product in place. This chunk is what each one actually costs.**

## Fix 1 · Change one collection to `Set`

```java
@Entity
class Order {
    @OneToMany(mappedBy = "order") Set<OrderLine> lines;
    @OneToMany(mappedBy = "order") Set<Shipment>  shipments;
}
```

The exception goes away because sets de-duplicate. **The Cartesian product does
not.** The database still builds and transfers 6 rows for one order, and 10 × 8 =
80 for a busier one. With two collections of a hundred each you are moving ten
thousand rows to deliver two hundred objects.

So this fix is right when **both collections are small and bounded** — an order's
lines and its two or three shipments — and wrong when either can grow.

Three costs to weigh before taking it:

**`Set` changes `hashCode()` behaviour.** Hibernate materialises a set into a
hash-based collection, so every element's `hashCode()` runs during loading. If
that `hashCode()` dereferences an association, you have just created a new N+1 —
see [chunk 4e](04e-lazy-columns-and-hashcode.md). Fix `equals`/`hashCode` in the
same commit.

**`Set` loses ordering.** If the UI relies on insertion order, add `@OrderBy` to
restore a defined order at the database.

**`Set` changes semantics.** If two identical child rows are meaningful — two
line items for the same SKU — a `Set` will silently collapse them unless
`equals` distinguishes them by id. This is a data bug, and it is the reason this
fix is not universally safe.

## Fix 2 · Do not fetch both — subselect or batch the second

Keep the types, fetch one collection, and let the other resolve in a separate
statement.

```java
@Entity
class Order {
    @OneToMany(mappedBy = "order")
    List<OrderLine> lines;                       // fetch-joined in the query

    @OneToMany(mappedBy = "order")
    @Fetch(FetchMode.SUBSELECT)                  // ← one extra select, all parents
    List<Shipment> shipments;
}
```

```java
@Query("select o from Order o left join fetch o.lines where o.placedAt > :cutoff")
List<Order> findRecent(@Param("cutoff") Instant cutoff);
```

Two statements total, regardless of how many orders come back — and **no
Cartesian product at all**, because the two collections are never joined
together. The guide recommends exactly this shape:

> *"There's one interesting case where join fetching becomes inefficient: when we
> fetch two many-valued associations in parallel. … Joining both collections in a
> single query would result in a cartesian product of tables, and a large SQL
> result set. Subselect fetching comes to the rescue here, allowing us to fetch
> books using a join, and royaltyStatements using a single subsequent select."*

`@BatchSize` is the alternative with the same shape — see
**chunk 10** *(not written yet)* and **chunk 11** *(not written yet)* for how to choose
between them.

## Which fix, and why the second is usually better

| | `Set` | subselect / batch |
|---|---|---|
| Statements | 1 | 2 |
| Rows transferred | **N × M** (product) | N + M (sum) |
| Changes the domain model | yes | no |
| Risk of collapsing real duplicates | yes | no |
| Interacts with `hashCode()` | yes | no |
| Works with pagination | see [8d](08d-pagination.md) | yes |

**The `Set` fix optimises the metric that is not the problem.** You reach for it
because the exception mentioned bags, so bags feel like the issue — but the
exception was a symptom of the Cartesian product, and `Set` only makes the
product representable. Trading one statement for a quadratic result set is a bad
trade at any meaningful fan-out.

Take `Set` when both collections are genuinely small and you want the single
round trip. Take subselect or batch otherwise, which is most of the time.

## Fix 3 · The one that is usually actually right

Ask whether you needed the entity graph at all. A query that must fetch an order,
all its lines and all its shipments is usually assembling a response — and a
response is a query, not a graph. Two projections, or one query returning a flat
row set that you assemble, avoids the entire problem class and loads only the
columns the response contains. That is **chunk 12** *(not written yet)*.

---

← Prev: [8d2 · Paginating before 7.4](08d2-paginating-on-older-versions.md) · Index: [The N+1 problem](README.md)
