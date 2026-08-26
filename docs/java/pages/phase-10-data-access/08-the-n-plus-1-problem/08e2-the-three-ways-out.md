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

`@BatchSize` is the alternative with the same shape: it fetches the second
collection with a batch of owner ids instead of a subselect, so it costs ⌈N/k⌉
extra statements rather than one, and it never re-executes the driving query.
[Chunk 10](10-batch-size.md) is batch fetching in full and
[chunk 11](11-subselect.md) is subselect fetching; the choice between them is the
comparison table in [chunk 11](11-subselect.md).

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
columns the response contains. That is
[chunk 12](12-projections-and-dtos.md), and the case for it as the *default* for
any read-only endpoint is [chunk 12d](12d-the-entity-was-never-the-model.md).

Changing a collection's type is a change to the domain model, and it has its own
list of consequences. They are large enough to need two chunks of their own:
[8e3](08e3-what-set-costs-the-model.md) for what it does to equality and
`hashCode`, and [8e4](08e4-ordering-and-the-call-sites.md) for ordering,
`@OrderColumn` and every positional call site.

## Gotchas

**⚠️ Reading the disappearance of the exception as the disappearance of the
problem.**
This is the whole failure mode of fix 1, and it is worth stating twice. The
exception is a *guard*, not the fault. `MultipleBagFetchException` fires because
Hibernate cannot index two bags off one Cartesian product; a `Set` can be built
from that product, so the guard stops firing and the product ships. Nothing in
the test suite changes colour. The only thing that tells you is the row count —
see [chunk 6](06-count-do-not-read.md).

**⚠️ Forgetting that `@Fetch` is Hibernate's, not JPA's.**
`org.hibernate.annotations.Fetch` and `FetchMode.SUBSELECT` have no Jakarta
Persistence 3.2 equivalent. Taking fix 2 ties that mapping to Hibernate. That is
usually fine — you already depend on Hibernate for a dozen other things — but a
codebase that is deliberately provider-neutral has to reach for batch fetching or
a projection instead.

**⚠️ Treating `@Fetch(SUBSELECT)` as a per-query decision.**
It is not. It is attached to the **collection role**, so *every* query in the
application that later touches `order.shipments` pays a subselect, including the
one that loads a single order by id and would have been happier with one small
select. Fix 2 is a global statement about a collection wearing the costume of a
local fix.

**⚠️ Applying `@Fetch(SUBSELECT)` on top of an expensive driving query.**
The subselect works by re-executing the original query inside an `IN` predicate —
the user guide's §12.11 example shows the `Department` query reappearing verbatim
as `where e.department_id in (select … from Department …)`. If the driving query
is a five-way join with a leading-wildcard `LIKE`, the database plans and runs
that shape twice. The guide's own reassurance is that "the execution of the
subselect is likely to be relatively inexpensive, since the data should already
be cached by the database" — *likely* and *cached* are the two words to
interrogate before relying on it.

**⚠️ Assuming the exception only applies to `EAGER` collections.**
Both collections in the failing query can be mapped `LAZY`. What fails is the
*query* that fetch-joins two bags, whether the fetch join came from `join fetch`,
from a criteria `fetch()`, or from an entity graph naming two collections. The
mapping's fetch type is not what decides it.

**⚠️ Putting `@Fetch(JOIN)` on the second collection to "make it fetch too".**
The `@Fetch` javadoc is explicit: "join fetching is incompatible with lazy
fetching, and so `@Fetch(JOIN)` implies `fetch=EAGER`, overriding any
explicitly-specified `fetch=LAZY` setting." Two bags both fetched by join is
exactly the query that raised the exception — so this asks for the failure
permanently, at every call site, instead of at one.

**⚠️ Fixing it in the entity when the problem was in one query.**
All three of `Set`, `@OrderColumn` and `@Fetch(SUBSELECT)` are *mapping* changes
made in response to *one* query, and every other query in the application
inherits them. When a single endpoint needs both collections, the change that
matches the blast radius is a per-query one — a second query, an entity graph, or
a projection — not a permanent alteration to the model.

## Interview questions

**★ Why does changing one collection from `List` to `Set` make
`MultipleBagFetchException` go away?**
Because a `Set` is not a bag. A bag is Hibernate's name for an unordered
collection that permits duplicates and carries no index — the mapping you get
from a plain `List` with no `@OrderColumn`. When two bags are fetch-joined in one
query the result is a Cartesian product, and Hibernate has no per-row key telling
it which product row belongs to which position of which collection, so it
refuses. A `Set` has an answer to that question: it de-duplicates, so the same
product row arriving twice is simply absorbed. Hibernate can build the result, so
it does. The refusal was never about the *number* of collections; it was about
being unable to reconstruct them.

**★ Does that fix the underlying problem?**
No, and this is the point of the whole chunk. The Cartesian product is still
computed by the database, still transferred over the wire, and still parsed by
the driver — the `Set` only makes it *representable* in Java. Ten lines and eight
shipments is eighty rows delivered to build eighteen objects. What changed is
that you no longer get told. A team that "solved" the exception this way has
converted a loud failure into a silent quadratic, which is the worse of the two
states, because the second one is found in production and the first one was found
the first time the query ran.

**★ So when *is* the `Set` fix the right one?**
When both collections are small and bounded by something real — an order has at
most a few dozen lines and two or three shipments, and that is a fact about the
domain, not an observation about today's data. Then the product is a few dozen
rows, one round trip beats two, and you take it. The judgement is not "is this
data small now"; it is "is there anything preventing this data from becoming
large". If the answer is no, the `Set` will eventually be the incident.

**★ What does `@Fetch(FetchMode.SUBSELECT)` actually do?**
The `FetchMode.SUBSELECT` javadoc defines it as "use a secondary select with a
subselect that re-executes an initial query to load all instances of the related
entity or collection at once, at some point after the initial query is executed".
So when you touch any one of those collections, Hibernate initialises *all* of
them, for every owner associated with the persistence context, in one statement —
and it identifies those owners by re-running the query that loaded them inside an
`IN` subquery, rather than by listing their ids. Two statements total regardless
of how many parents came back, and no Cartesian product, because the two
collections are never joined to each other.

**★ What is the cost of that, and when would it bite?**
The driving query runs twice. On a cheap indexed lookup that is nearly free and
the second execution will usually hit the database's own cache. On an expensive
query — a wide join, a full scan, a text search, anything whose plan was already
the thing you were worried about — you have doubled the expensive part to save
the cheap part. It is also, per the same javadoc, "currently only available for
collections and many-valued associations", so it is not an option for a
`@ManyToOne`.

**★ Why is `@Fetch(SUBSELECT)` a mapping-level decision, and why does that
matter?**
Because the annotation goes on the association, not on the query, and it governs
the collection *role* for the whole application. The endpoint you were fixing
gets its two statements; so does the endpoint that loads one order by id and
touches `shipments`, which now issues a subselect re-running a single-row query
instead of a trivial select. It matters because the scope of the change and the
scope of the problem do not match — a symptom that recurs across every fix in
this part, and the reason a per-query fix is preferable whenever one exists.

**★ You need three collections off the same aggregate in one endpoint. What do
you do?**
Not three fetch joins — that is a triple product, and with sets it does not even
have the courtesy to fail. The realistic answers are: fetch the one with the
largest fan-out by join and let the other two resolve by batch or subselect; or
join-fetch none of them and let all three batch; or, most often, stop treating it
as an aggregate load at all and issue three focused queries or projections that
each return exactly the shape the response needs. The number three is itself the
signal — an endpoint asking for three collections is usually assembling a
document, and a document is a query result, not an object graph.

**★ How would you choose between `Set`, subselect, and a projection?**
By fan-out and by blast radius. If both collections are bounded small, `Set` and
one round trip. If either is unbounded and you genuinely need entities — because
you are about to modify them — subselect or batch, accepting that the setting is
global. If you are only reading, and the output is JSON or a report, a
projection: it avoids the persistence context, avoids dirty checking, avoids the
`equals`/`hashCode` question entirely, and loads only the columns the response
contains. In practice the third case is the majority of endpoints that hit this
exception, which is why fix 3 is listed last and used first.

**★ Why does the Hibernate documentation single out subselect fetching for
exactly this case?**
Because it is the one case where the guide's own general advice — "you should
almost always use outer join fetching" — stops applying. *A Short Guide to
Hibernate 7* §8.6 says join fetching becomes inefficient "when we fetch two
many-valued associations in parallel", that joining both "would result in a
cartesian product of tables, and a large SQL result set", and that "subselect
fetching comes to the rescue here". It is a deliberate, narrow exception to the
join-first rule, which is why quoting it out of context — as an argument for
subselect fetching generally — misreads the guide badly.

**★ How would you verify that whichever fix you took actually worked?**
Not by the absence of the exception, which is what got everyone into this. Count
the statements and count the rows: assert the query count in a test
([chunk 6b](06b-asserting-the-count-in-a-test.md)) and look at the row count the
driving query returns. `Set` should show one statement and a row count that is
the product of the two collection sizes; subselect should show two statements and
row counts that are the *sum*. If you took `Set` and the row count is the product
and the product is large, the fix silenced the messenger.

---

← Prev: [8e · MultipleBagFetchException](08e-multiplebagfetchexception.md) · Index: [08 · The N+1 problem](README.md) · Next → [8e3 · What Set costs the model](08e3-what-set-costs-the-model.md)
