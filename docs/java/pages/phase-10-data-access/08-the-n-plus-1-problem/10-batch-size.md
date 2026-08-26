---
title: "Batch fetching does not remove the extra queries — it divides them, turning N statements into N over k, and that is a different promise from every fix before it"
sidebar_label: "10 · @BatchSize"
sidebar_position: 35
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §12.8 *Batch
> fetching* and §A.7.1 `hibernate.default_batch_fetch_size`
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the `org.hibernate.annotations.BatchSize` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/annotations/BatchSize.html)),
> and *A Short Guide to Hibernate 7* §8.5 *Batch fetching and subselect fetching*
> ([docs.hibernate.org/orm/7.4/introduction](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Hibernate ORM 7.4.1, Spring Boot 4.1.0, PostgreSQL 18.

**Every fix so far has tried to make the extra queries *not happen* — by joining,
by planning the fetch, by changing the mapping. Batch fetching accepts that they
happen and makes there be fewer of them: instead of one select per parent, one
select per *group* of parents. It does not produce a single query and it is not
trying to. What it buys is the one thing a join cannot give you — it stays
lazy.**

## The mechanism

The `@BatchSize` javadoc states it exactly:

> *"When batch fetching is enabled, Hibernate is able to fetch multiple instances
> of an entity or collection in a single round trip to the database. Instead of a
> SQL select with just one primary key value in the `where` clause, the `where`
> clause contains a list of primary keys inside a SQL `in` condition. The primary
> key values to batch fetch are chosen from among the identifiers of unfetched
> entity proxies or collection roles associated with the session."*

Three things in that paragraph are load-bearing:

- **"a list of primary keys inside a SQL `in` condition"** — the fix is a wider
  `where` clause, not a join. No Cartesian product is possible, because the
  children are fetched by a separate statement.
- **"unfetched entity proxies or collection roles associated with the
  session"** — Hibernate does not know which parents you are *about* to touch. It
  batches whatever is currently unfetched in the persistence context. So the
  effectiveness depends on how many parents are sitting there, which is a
  property of the surrounding code, not of the annotation.
- **"entity or collection"** — it works for both, and they are configured in
  different places.

## N becomes ⌈N/k⌉

The user guide's §12.8 worked example is ten departments with
`@BatchSize(size = 5)` on the `employees` collection. Touching the first
department's collection triggers a select for **five** department ids; touching
the sixth triggers a second select for the remaining five. Two statements instead
of ten, and the guide says so: *"there are only two SQL statements used to fetch
the `Employee` entities associated with multiple `Department` entities … Without
`@BatchSize`, you'd run into a N + 1 query issue, so, instead of 2 SQL
statements, there would be 10 queries."*

So the arithmetic is:

| | statements |
|---|---|
| no fix | 1 + N |
| `@BatchSize(size = k)` | 1 + ⌈N/k⌉ |
| join fetch / entity graph | 1 |
| `@Fetch(SUBSELECT)` | 2 |

**⌈N/k⌉ is not 1, and that is the honest headline.** A page of 200 orders with
`k = 25` is nine statements, not one. Whether nine is fine depends entirely on
round-trip latency, which is the subject of
[chunk 10c](10c-choosing-a-batch-size.md).

## Where to put it

**On a collection** — batches *collections*, one per owner:

```java
@Entity
class Order {
    @OneToMany(mappedBy = "order")
    @BatchSize(size = 25)
    Set<OrderLine> lines;
}
```

The javadoc's wording for this placement: it "will initialize up to 5 unfetched
collections of `Product`s in each SQL select". Five owners' collections, not five
rows.

**On the entity class** — batches *proxies* of that entity, wherever they come
from:

```java
@Entity
@BatchSize(size = 100)
class Product { … }
```

"will initialize up to 100 unfetched `Product` proxies in each trip to the
database". This is the placement people forget, and it is the one that fixes the
`@ManyToOne` shape: a page of order lines each holding a lazy `product` proxy
resolves in ⌈N/100⌉ statements instead of N. Note that `@BatchSize` targets
`TYPE`, `METHOD` and `FIELD`, so both placements are the same annotation.

## Turning it on globally

Per the settings appendix: *"Specifies the default value for batch fetching. By
default, Hibernate only uses batch fetching for entities and collections
explicitly annotated `@BatchSize`."* And the introduction guide: *"Both batch
fetching and subselect fetching are disabled by default."*

```properties
# Spring Boot 4.1 — Hibernate properties pass through this prefix
spring.jpa.properties.hibernate.default_batch_fetch_size=25
```

```java
// plain Hibernate, per session
session.setFetchBatchSize(25);
```

🔴 **The global setting is the highest-value single line in this entire topic,
and it is the one most codebases do not have.** It applies to every lazy
association and every proxy in the application, it cannot produce a Cartesian
product, it cannot change a result set, and it converts every unfixed N+1 in the
codebase — including the ones nobody has found — from N statements to ⌈N/k⌉.

It is not a substitute for fixing the N+1s you know about. It is a floor under
the ones you do not.

## What it buys that a join cannot

The introduction guide names the property that matters:

> *"But batch fetching and subselect fetching have one important characteristic in
> common: they can be performed **lazily**."*

A join fetch has to be decided **before** the query runs. Batch fetching is
decided when you touch the association, which means:

- It **composes with pagination.** The driving query pages normally, because it
  has no join in it; the children are fetched afterwards, in batches, by id. This
  is the single largest practical advantage over
  [chunk 8d](08d-pagination.md)'s problem.
- It **composes with two collections.** Fetching `lines` and `shipments` by batch
  is two extra statements, not a Cartesian product, and no
  `MultipleBagFetchException` — [chunk 8e](08e-multiplebagfetchexception.md).
- It **works when you did not know what you would need.** Code that navigates
  conditionally cannot express a fetch plan up front; batching does not require
  one.

## What Hibernate's own documentation says about preferring it

Twice, in two guides, and both are worth quoting because they cut against the
enthusiasm the global setting deserves:

> *"However, although `@BatchSize` is better than running into an N + 1 query
> issue, most of the time, a DTO projection or a `JOIN FETCH` is a much better
> alternative since it allows you to fetch all the required data with a single
> query."* — user guide §12.8

> *"While batch fetching might mitigate problems involving N+1 selects, it won't
> solve them. The truly correct solution is to fetch associations using joins.
> Batch fetching (or subselect fetching) can only be the best solution in rare
> cases where outer join fetching would result in a cartesian product and a huge
> result set."* — introduction guide §8.5

**"Mitigate", not "solve".** Take both quotes at face value: batch fetching is the
right primary fix in a narrow set of cases — two collections, high fan-out with
pagination, unpredictable navigation — and the right *background* setting almost
everywhere.

## Gotchas

**⚠️ Reading ⌈N/k⌉ as "one query".**
It is not. A thousand parents at `k = 25` is forty-one statements. That may be
perfectly fine on a low-latency connection and catastrophic across a region
boundary. Batch fetching changes the *slope*, not the shape —
[chunk 10c](10c-choosing-a-batch-size.md).

**⚠️ Annotating the collection and forgetting the entity class.**
They fix different shapes. `@BatchSize` on `Order.lines` does nothing for a page
of `OrderLine`s each holding a lazy `product`; that needs `@BatchSize` on
`Product` itself, or the global setting. The `@ManyToOne` N+1 is the more common
one in practice and the one the collection annotation does not touch.

**⚠️ Assuming a batch size applies because you set the global property.**
It does, but an explicit `@BatchSize` on the association overrides it — so a
collection annotated `@BatchSize(size = 3)` years ago keeps its 3 after you set
the global to 50, and it will be the slow one nobody can explain.

**⚠️ Expecting batching to help when a lock mode is set.**
The user guide is explicit: *"When `LockModeType` is different from `NONE`
Hibernate will not execute a batch fetching so uninitialized entity proxies will
not be initialized."* A pessimistic-locking read path silently loses the
optimisation, and that is exactly the path where round trips are most expensive
because the locks are held for their duration.

**⚠️ Batching a collection whose elements are enormous.**
`k` collections per statement means the row count is `k × average children`. A
batch size of 100 on a collection averaging 500 children is a fifty-thousand-row
statement. The batch size bounds the *owners*, not the rows.

**⚠️ Believing it prevents `LazyInitializationException`.**
It does not. Batch fetching happens when the association is touched **inside** an
open session. Touch it after the session closes and you get the same exception
you always did — [chunk 15](15-open-in-view.md).

**⚠️ Assuming the batch is the parents you are iterating.**
Hibernate batches from the ids of unfetched proxies and collection roles
*associated with the session*. If your loop clears the session, or processes in
chunks, or the parents came from several queries, the batches are drawn from
whatever happens to be resident — which can be more than you expected, or fewer.

**⚠️ Adding `@BatchSize` and not re-measuring.**
The count changes from N+1 to ⌈N/k⌉+1, which is still not 1, and a test asserting
"fewer than 5 queries" passes for a page of 100 at `k = 25` and fails at `k = 10`
without any code change. Assert the actual number —
[chunk 6b](06b-asserting-the-count-in-a-test.md).

**⚠️ Using it to avoid deciding what an endpoint needs.**
It works well enough that it can hide an endpoint that loads four associations it
does not use, at ⌈N/k⌉ statements each. The count is small and the row volume is
not. Batching is a safety net, not a design.

## Interview questions

**★ What does `@BatchSize` actually do?**
It makes Hibernate fetch multiple unfetched proxies or collection roles in one
statement, by putting a list of primary keys in an `in` condition instead of a
single value. The keys are taken from the unfetched proxies and collection roles
associated with the session, so touching one association initialises up to `k` of
them at once. N+1 statements become 1 + ⌈N/k⌉.

**★ How is that different from a fetch join?**
A fetch join produces **one** statement and has to be decided before the query
runs; batch fetching produces ⌈N/k⌉ extra statements and is decided when you
touch the association. That laziness is the whole trade: batching composes with
pagination, composes with fetching several collections, and works when the code
does not know in advance what it will navigate — all things a join cannot do. The
cost is that it never gets to one statement.

**★ Where do you put it, and does the placement matter?**
Both placements matter and they fix different problems. On a collection, it
batches *collections* — up to `k` owners' collections per select — which fixes the
`@OneToMany` N+1. On the entity class, it batches *proxies of that entity*, which
fixes the `@ManyToOne` N+1 that the collection annotation does nothing for. It is
the same annotation; it targets `TYPE`, `METHOD` and `FIELD`.

**★ Is it on by default?**
No. The settings appendix says "by default, Hibernate only uses batch fetching for
entities and collections explicitly annotated `@BatchSize`", and the introduction
guide says batch and subselect fetching "are disabled by default". The global
switch is `hibernate.default_batch_fetch_size`, which in Spring Boot is
`spring.jpa.properties.hibernate.default_batch_fetch_size`; there is also
`session.setFetchBatchSize(k)` for a single session.

**★ Would you set the global property in a new service?**
Yes, and I would treat it as close to free. It cannot produce a Cartesian
product, it cannot change a result set, and it applies to every lazy association
including the N+1s nobody has found yet — turning them from N statements into
⌈N/k⌉. It is not a substitute for fixing the ones you know about; it is a floor
under the ones you do not.

**★ Hibernate's own docs are lukewarm about it. Why?**
Because it mitigates rather than solves. The user guide says "although
`@BatchSize` is better than running into an N + 1 query issue, most of the time,
a DTO projection or a `JOIN FETCH` is a much better alternative", and the
introduction guide says batching "won't solve" N+1 and is best "in rare cases
where outer join fetching would result in a cartesian product and a huge result
set". Both are right about a *known* N+1 on a *known* endpoint. Neither argues
against having it on globally as a background default, which is a different
question they do not address.

**★ When does batch fetching not work at all?**
When a lock mode other than `NONE` is in play — the user guide says Hibernate
"will not execute a batch fetching so uninitialized entity proxies will not be
initialized", because the lock mode of the queued proxies does not match. And it
does nothing outside an open session, so it does not prevent
`LazyInitializationException`; it only makes the initialisation cheaper when it
does happen.

**★ What is the failure mode of a batch size that is too large?**
The batch bounds owners, not rows. A batch size of 100 on a collection averaging
500 children asks for fifty thousand rows in one statement, which is a memory and
transfer problem the small statement count hides completely. Choosing `k` is a
real decision and it is about the *product* of `k` and the fan-out —
[chunk 10c](10c-choosing-a-batch-size.md).

---

← Prev: [9h · A graph is still a join](09h-a-graph-is-still-a-join.md) · Index: [08 · The N+1 problem](README.md) · Next → [10b · What the SQL looks like](10b-what-the-sql-looks-like.md)
