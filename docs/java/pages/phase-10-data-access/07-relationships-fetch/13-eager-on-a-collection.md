---
title: "EAGER on a collection is a time bomb because it is a decision made once, in one file, that every present and future call site is forced to obey"
sidebar_label: "13 · EAGER on a collection"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §31.6.1 *Fetching
> associations*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 *Introduction* §3.20 *Many-to-many* and §5.6 *Proxies and lazy
> fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the Jakarta Persistence 3.2 `FetchType` javadoc
> ([.../fetchtype](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/fetchtype)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**`@OneToMany(fetch = FetchType.EAGER)` is not "one slow query". It is a permanent,
non-negotiable clause added to every query that ever loads this entity, written by
somebody who was looking at one use case. It is a time bomb in the precise sense: it is
harmless when it is written, it becomes armed as the data grows and the codebase spreads,
and it goes off somewhere far away from where it was planted.**

## What the annotation actually commits you to

```java
@Entity
public class Publisher {
    @OneToMany(mappedBy = "publisher", fetch = FetchType.EAGER)   // ⛔
    private Set<Book> books = new HashSet<>();
}
```

The `FetchType` javadoc defines `EAGER` as *"a requirement on the persistence provider
runtime that data must be eagerly fetched"*. A requirement — not a hint, not a default, not
a preference. So from this line onwards:

- `em.find(Publisher.class, id)` loads every book.
- `SELECT p FROM Publisher p WHERE p.name = :name` loads every book of every match.
- A `@ManyToOne Publisher` on some other entity, itself loaded eagerly or navigated to,
  loads every book.
- A Spring Data `findAll()` on a page of 20 publishers loads every book of all 20.
- A JSON serialisation, a health check, an admin screen, a nightly job — every one of them.

And the 7.4 *User Guide* states the part that makes it permanent:

> The `EAGER` fetching strategy cannot be overwritten on a per query basis, so the
> association is always going to be retrieved even if you don't need it.

**There is no opt-out.** No query hint, no repository method, no service call can say "not
this time". `LAZY` can be upgraded to eager at any call site that wants it — a fetch join,
an entity graph, an explicit initialise. `EAGER` cannot be downgraded anywhere. That is the
asymmetry from **[12](12-fetch-type-defaults.md)**, and it is the whole reason this
particular annotation is dangerous rather than merely suboptimal.

## Why "a collection" makes it categorically worse

An eager `@ManyToOne` fetches **one** row. It is wasteful and bounded.

An eager `@OneToMany` fetches **however many rows exist**. The mapping contains no upper
limit, and neither does the table.

That is the difference between a mistake with a cost and a mistake with an unbounded cost.
A `Publisher` with 12 books today is a publisher with 40,000 books after four years of
imports. Nothing about the annotation changes; the query it forces goes from trivial to
catastrophic. **The bomb is not the annotation. The bomb is the annotation plus time.**

And there is no `WHERE` clause available. `findById` on that publisher does not fetch "the
recent books" or "the first page of books" — the mapping says the collection, so the
collection is what it fetches. A mapped collection has nowhere to put a filter; that is
**[5 · Bidirectional @OneToMany](05-one-to-many-bidirectional.md)**'s argument for not
mapping large collections at all, and eager fetching removes even the option of ignoring
them.

## The two ways it is executed, neither of which you choose

The *User Guide* describes both:

> Moreover, if you forget to `JOIN FETCH` an `EAGER` association in a JPQL query, Hibernate
> will initialize it with a secondary statement, which in turn can lead to N+1 query
> issues.

So an eager collection is satisfied either by **joining** it into the query — inflating the
result set, one row per child — or by a **secondary statement per parent row**, which is
the N+1 problem arriving from a mapping annotation.

Which one you get depends on how the entity was loaded, and you have no say in it. Both are
bad in different ways:

- The join path multiplies rows. Twenty publishers with two hundred books each is four
  thousand rows to build twenty objects.
- The secondary-statement path multiplies statements. Twenty publishers is twenty-one
  queries.

🔴 **Both of those have fixes, and none of the fixes are mine to give.** Fetch joins,
`@EntityGraph`, `@BatchSize` and DTO projections are **Topic 08 · The N+1 problem** *(not
written yet)*. What belongs here is the mapping decision that avoids needing them: do not
write `EAGER`.

## The `@ManyToMany` case, where Hibernate uses the word "never"

The *Introduction* is not usually absolutist. Here it is:

> We don't usually map collections with `fetch=EAGER`, since that usually leads to poor
> performance and fetching of unnecessary data. But this is especially clear in the case of
> many-to-many associations. We don't much employ the word "never" when it comes to
> object/relational mappings, but here we will: never write `@ManyToMany(fetch=EAGER)`
> unless you're deliberately looking for trouble.

A many-to-many is worse because the fetch spans three tables, and because both sides are
collections — so an eager one on each side gives you a graph that expands in both
directions from any entry point.

## How it gets written in the first place

Worth naming, because the pattern repeats and none of the causes are stupidity.

**"It was throwing `LazyInitializationException`."** Somebody read the collection after the
transaction ended, got an exception, and made the mapping eager to stop it. It works. It
also loads the collection for every other caller forever. The real fix is to fetch what the
operation needs inside the transaction, or to return a DTO —
[Topic 10 · Lazy-loading pitfalls](../10-lazy-loading/README.md).

**"The controller needs it for JSON."** One endpoint serialises the graph, so the mapping
was changed to make the graph available. Now every endpoint pays. See
**[16 · Serialising an entity graph](16-serialising-an-entity-graph.md)**.

**"It's only ever a handful of rows."** True at the time. The mapping does not record the
assumption, nobody re-checks it, and the data grows.

**"Two queries seemed worse than one."** For one entity, eager fetching genuinely is one
query instead of two. For a list of entities it is a join that multiplies rows or N+1
statements. The intuition is right for the case in front of you and wrong for the general
case — which is exactly the trap of putting a fetch decision in the mapping.

## What to do instead, at the mapping level

**Leave collections `LAZY`.** It is already the default for `@OneToMany` and `@ManyToMany`
— so the correct action is usually *not writing anything*.

**Decide fetching per operation, not per mapping.** The service method that needs the books
asks for them; the ninety that do not, do not pay. Which mechanism you use is Topic 08's.

**Ask whether the collection should be mapped at all.** If it is large enough that eager
fetching was tempting, it is large enough that a paged repository query is the honest
answer.

## Gotchas

**`EAGER` cannot be overridden per query.** This is the single fact to carry away. Every
other property of the annotation follows from it.

**An eager collection is loaded even when you only wanted to check a scalar field.**
`publisher.getName()` after a `findById` has already paid for every book.

**Eager collections compose with each other and with eager singular associations.** One
eager collection on an entity that is itself the target of an eager `@ManyToOne` elsewhere
means loading the far entity drags the whole collection along. Nobody wrote that
combination; two independent annotations did.

**`EAGER` on two `List` collections is a documented startup-to-runtime failure.** They are
bags, and fetching two bags at once raises `MultipleBagFetchException` —
**[13b](13b-how-it-multiplies.md)**.

**Adding `EAGER` to fix an exception replaces a visible bug with an invisible one.** The
`LazyInitializationException` was telling you something true about your transaction
boundaries. Silencing it in the mapping keeps the design error and adds a performance one.

**A second-level cache does not rescue an eager collection.** It can serve the rows without
hitting the database, but you still materialise every entity, on every load, into the
persistence context.

**`EAGER` in a `@MappedSuperclass` or a base entity applies to every subclass.** One
annotation, many entities, each paying independently — and the mapping is not visible in
any of the classes a developer is likely to open.

## Interview questions

**★ Why is `fetch = EAGER` on a collection described as a time bomb rather than just a
slow mapping?**
Because of when the cost arrives. When it is written, the collection is small and the
mapping is harmless — that is why it survives review. The cost grows with the data and
spreads with the codebase, since every new call site that loads the entity inherits the
fetch without knowing it. And it cannot be defused locally: Hibernate's documentation
states that the eager strategy cannot be overridden on a per-query basis, so no caller can
opt out. The problem detonates somewhere far from where it was planted, in code whose
author never saw the annotation.

**★ What is the asymmetry between `EAGER` and `LAZY` that makes this so one-sided?**
`LAZY` is a floor and `EAGER` is a ceiling. A lazy association can be upgraded at any call
site that wants the data — join fetch it, use an entity graph, initialise it explicitly. An
eager association cannot be downgraded anywhere. So a wrong `LAZY` costs one query at one
call site, fixable there; a wrong `EAGER` costs a query at every call site and is fixable
only by editing the entity, which means retesting everything that touches it.

**★ How is an eager collection actually loaded?**
One of two ways, chosen by the provider rather than by you. If the query that loaded the
parent joined the collection, it comes back in the same result set — with one row per
child, so the result set is multiplied. If it did not, Hibernate issues a secondary
statement to initialise the collection, per parent row, which is the N+1 problem. The user
guide states exactly that: forgetting to `JOIN FETCH` an eager association means Hibernate
initialises it with a secondary statement, which can lead to N+1 queries.

**★ Why is an eager collection worse than an eager `@ManyToOne`?**
Because it is unbounded. A `@ManyToOne` fetches one row — wasteful but with a known
ceiling. A `@OneToMany` fetches every matching row, and the mapping contains no limit and
no `WHERE` clause. A collection that is small today is not small in three years, and
nothing about the annotation changes to reflect that.

**★ Someone made a collection eager because of a `LazyInitializationException`. What do you
tell them?**
That the exception was correct and the fix was not. The exception says the code read an
association after the persistence context that owned it was gone, which is a transaction
boundary problem. Making the collection eager makes that particular read succeed and
charges every other caller for it forever, including callers that never touch the
collection. The honest fixes are to fetch what the operation needs inside the transaction,
or to return a DTO carrying exactly the data the caller needs.

**★ Hibernate's documentation uses the word "never" about one specific eager mapping. Which
one, and why that one?**
`@ManyToMany(fetch = EAGER)`. The introduction says it does not much use the word "never"
about object/relational mappings and is using it there. Many-to-many is the worst case
because the fetch spans three tables, and because both sides are collections — so eager
fetching from either direction expands the graph, and combining it with any other eager
collection produces a result set that is the product of the collection sizes rather than
their sum.

---

← Prev: [12 · The fetch defaults](12-fetch-type-defaults.md) · Index: [Relationships and fetch types](README.md) · Next → [13b · How it multiplies](13b-how-it-multiplies.md)
