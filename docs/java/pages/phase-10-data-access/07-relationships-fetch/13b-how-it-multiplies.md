---
title: "One eager collection is a cost; two is a product, and a nested chain turns findById into a join across half the schema"
sidebar_label: "13b · How it multiplies"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §31.6.1 *Fetching
> associations*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 `MultipleBagFetchException` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/loader/MultipleBagFetchException.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/loader/MultipleBagFetchException.html))
> and the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Eager fetching does not add up. It multiplies. Two eager collections on one entity give
a result set that is the product of their sizes, not the sum. An eager association whose
target has its own eager associations expands transitively, with no depth limit in the
mapping and no way to see the total from any single class. This chunk is about how a
handful of individually-defensible annotations become a query nobody wrote.**

## Two collections at once: a product, not a sum

An entity with two eager collections:

```java
@Entity
public class Order {
    @OneToMany(mappedBy = "order", fetch = FetchType.EAGER)   // ⛔
    private Set<OrderLine> lines = new HashSet<>();

    @OneToMany(mappedBy = "order", fetch = FetchType.EAGER)   // ⛔
    private Set<OrderNote> notes = new HashSet<>();
}
```

If Hibernate satisfies both by joining, the result set has one row per **combination** of
line and note. An order with 20 lines and 10 notes produces 200 rows to build one `Order`
object with 30 children in it. Not 30 rows. 200.

The reason is elementary SQL: joining one parent to two independent child tables produces a
cross product between the children. The database has no way to return "these 20 and those
10" in a single flat result set; the only shape a row has is one value per column.

Hibernate's own guidance, in the fetching best-practice section, states the rule from the
query side:

> The `JOIN FETCH` directive is good for `@ManyToOne` and `OneToOne` associations, and for
> at most one collection (e.g. `@OneToMany` or `@ManyToMany`). If you need to fetch
> multiple collections, to avoid a Cartesian Product, you should use secondary queries […]

**At most one collection.** That is the constraint, and an eager mapping is a `JOIN FETCH`
you did not write and cannot remove.

Scale it and the arithmetic gets unpleasant fast. A page of 20 orders, each with 20 lines
and 10 notes, is 20 × 20 × 10 = 4,000 rows — carrying every order column repeated 200 times
— to build 20 objects.

## The `MultipleBagFetchException` wall

If the two collections are `List`s with no `@OrderColumn`, they are bags
(**[10b](10b-what-a-list-costs.md)**), and Hibernate does not produce a cross product at
all. It refuses.

The 7.4 javadoc for `org.hibernate.loader.MultipleBagFetchException` describes it as the
*"exception used to indicate that a query is attempting to simultaneously fetch multiple
bags"*, extending `HibernateException` and exposing `getBagRoles()` for *"the
collection-roles for the bags encountered"*.

A bag has no per-element identity, so when two bags arrive multiplied by a join, Hibernate
cannot distinguish a genuine duplicate element from a row that the join produced. Rather
than silently returning wrong contents, it throws.

⚠️ **You can reach this without writing a query.** Two `EAGER` `List` collections are
fetched by the same machinery, so a plain `findById` raises it. The failure appears at the
first request that loads the entity — which, if that entity is not on the startup path, may
be days after deployment.

**The mapping-level fix is to make them `Set`s**, which have identity and can be fetched
together (paying the cross product instead). The query-level fixes — separate queries,
`@BatchSize`, entity graphs — are **Topic 08 · The N+1 problem** *(not written yet)*.

## Transitive expansion: the chain nobody can see

The second multiplier is depth. Consider four entities, each with one perfectly reasonable
annotation:

```java
class OrderLine  { @ManyToOne Product product; }              // EAGER by default
class Product    { @ManyToOne Category category; }            // EAGER by default
class Category   { @ManyToOne Department department; }        // EAGER by default
class Department { @OneToMany(fetch = EAGER) Set<Product> products; }   // ⛔ written by someone
```

Load one `OrderLine`. You get the line, its product, that product's category, that
category's department, and **every product in that department** — each of which drags its
own category and department, and so on until the graph closes.

Nobody wrote that query. Four people wrote four annotations in four files, three of them by
writing nothing at all, since `@ManyToOne` is eager by default
(**[12](12-fetch-type-defaults.md)**).

**Two properties make this class of bug hard to find:**

1. **It is invisible from any one class.** `OrderLine` looks fine. `Product` looks fine.
   The expansion is a property of the graph, and no file contains the graph.
2. **It has no depth limit in the mapping.** JPA has no "fetch depth" setting that bounds
   it. The graph is followed until nothing new is reachable.

Now combine it with an eager collection anywhere in the chain and the row count multiplies
at that point too. A `findById` on one entity becomes a join across a substantial fraction
of the schema.

## The secondary-statement path multiplies differently

When Hibernate cannot or does not join, it issues follow-up statements — the *User Guide*'s
*"if you forget to `JOIN FETCH` an `EAGER` association […] Hibernate will initialize it with
a secondary statement"*. That does not multiply rows; it multiplies **statements**.

For a query returning N parents with an eager collection, that is N additional statements.
For two eager collections, 2N. For an eager association whose target has its own eager
association, the second level runs per row of the first.

So the two execution paths give you a choice between a wide result set and a large number of
round trips, and you do not make the choice. Either way, the growth is multiplicative in the
number of eager associations, not additive.

## What this means for how you read a mapping

The practical takeaway is a habit rather than a rule. **When you read `fetch = EAGER`, do
not ask "is this collection small?" Ask "what is reachable from here?"**

- What else does the target entity fetch eagerly?
- Does any of it lead back into a collection?
- How many entities can load this one — directly, or by being navigated to?

A collection of five is not the question. A collection of five whose elements each eagerly
load a category that eagerly loads a department that eagerly loads its products is.

## Gotchas

**Two eager collections produce a cross product, not a union.** 20 lines and 10 notes is
200 rows. The instinct that "it's only 30 extra rows" is wrong by an order of magnitude and
gets worse with size.

**Two eager `List` collections do not produce a cross product — they produce an exception.**
`MultipleBagFetchException`, at runtime, on the first load. Making them `Set`s converts a
hard failure into a silent performance problem, which is an improvement only if you then
stop fetching both.

**`DISTINCT` does not fix the cross product.** It de-duplicates the returned entities, not
the rows the database produced and shipped. Hibernate 6 changed how `distinct` interacts
with entity queries relative to Hibernate 5, so advice from the Hibernate 5 era about
`distinct` and fetch joins should be re-checked against the current documentation before it
is applied. The rows are still transferred either way.

**Pagination and a fetched collection do not combine.** A `LIMIT` applied to a result set
that has been multiplied by a join limits *rows*, not entities, so you get a partial
collection on the boundary entity. This is why Hibernate has historically had to paginate
such queries in memory. Both the problem and the fixes belong to **Topic 08 · The N+1
problem** *(not written yet)*.

**Transitive eager fetching has no depth limit you can configure.** There is no "max fetch
depth" for entity associations in JPA. The graph closure is the limit.

**An eager association inside a `@MappedSuperclass` multiplies across every subclass**, and
none of the subclasses show it.

**The cost is invisible in a unit test with three rows.** Every multiplier in this chunk is
proportional to data volume. A test fixture with two orders and one line each will never
reveal any of it.

## Interview questions

**★ Why do two eager collections on one entity produce a cross product?**
Because a single SQL result set is flat: one row per combination of joined children. Joining
a parent to two independent child tables gives every pairing of a row from each — 20 lines
and 10 notes become 200 rows, carrying the parent's columns 200 times, to build 30 child
objects. Hibernate's fetching guidance states the constraint from the query side: a fetch
join is fine for singular associations and for at most one collection, and fetching multiple
collections requires secondary queries to avoid a Cartesian product.

**★ What is `MultipleBagFetchException` and when can it happen without you writing a
query?**
It is the exception Hibernate raises when a fetch attempts to load two bag-typed
collections at once — the javadoc describes it as indicating a query attempting to
simultaneously fetch multiple bags, and it reports the collection roles involved. It happens
without a query when two `List` collections with no `@OrderColumn` are both mapped `EAGER`,
because a plain `find` then triggers the same fetch machinery. The underlying reason is that
a bag has no per-element identity, so Hibernate cannot tell a real duplicate from a row the
join multiplied, and it refuses rather than guessing.

**★ Explain how eager fetching expands transitively.**
An eager association is followed when the owning entity is loaded — and the target's own
eager associations are followed too, and so on. Since `@ManyToOne` and `@OneToOne` are
eager by default, a chain of three or four entities that nobody annotated at all is already
eagerly connected. Add one eager collection anywhere in the chain and the row count
multiplies at that point. The difficulty is that no single class shows the extent of it;
the expansion is a property of the graph, and JPA offers no depth limit to bound it.

**★ Does `DISTINCT` solve the cross-product problem?**
No. It removes duplicate entities from the result you receive; it does not stop the database
producing and transmitting the multiplied rows. The work has already been done by the time
de-duplication happens. It is also an area where Hibernate 6 changed behaviour relative to
Hibernate 5, so older guidance about `distinct` with fetch joins needs re-checking against
current documentation rather than being applied from memory.

**★ Why does none of this show up in tests?**
Because every multiplier here is proportional to data volume and to how many places load the
entity. A fixture with two parents and one child each produces two rows either way, and a
test that exercises one service method never sees the ninety other call sites that inherited
the fetch. The failure mode is specifically one that small, isolated tests cannot express —
which is why the mapping-level rule ("do not write `EAGER`") is worth more than any amount
of testing.

---

← Prev: [13 · EAGER on a collection](13-eager-on-a-collection.md) · Index: [Relationships and fetch types](README.md) · Next → [14 · What a lazy association is](14-what-a-lazy-association-is.md)
