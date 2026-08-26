---
title: "join fetch is the fix Hibernate calls the truly correct one — it makes the count 1, and it cannot be lazy, which is the whole trade"
sidebar_label: "8 · join fetch"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *A Short Guide to Hibernate 7*
> §8.4–8.6 *Association fetching*, *Batch fetching and subselect fetching* and
> *Join fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 user guide §17.8.4 *join fetch for association fetching*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Jakarta Persistence 3.2 specification's JPQL grammar
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**One clause turns 101 statements into 1. Hibernate's own documentation calls it
"the truly correct solution" and says you should "almost always" prefer it. It
also has three failure modes that each get their own chunk, and one property that
is not a bug but is the reason it cannot be the default: a join fetch cannot be
lazy, so you must know in advance that you want it.**

## The clause

```java
@Query("""
       select o from Order o
       left join fetch o.lines
       where o.placedAt > :cutoff
       """)
List<Order> findRecentWithLines(@Param("cutoff") Instant cutoff);
```

The user guide's definition is precise about what the two words do separately:

> *"A fetch join overrides the laziness of a given association, specifying that
> the association should be fetched with a SQL join."*

**`join` decides the SQL. `fetch` decides that the joined rows are used to
populate the association** rather than merely to filter. Drop `fetch` and you get
a join that restricts the result and leaves `o.lines` as lazy as it was — a
distinction that catches people constantly, because the query looks like it
should have worked.

### `join fetch` versus `left join fetch`

Also from the user guide, and it matters more than it looks:

> *"The join may be an inner or outer join. A `join fetch`, or, more explicitly,
> `inner join fetch`, only returns base entities with an associated entity. A
> `left join fetch`, or—for lovers of verbosity—`left outer join fetch`, returns
> all the base entities, including those which have no associated joined
> entity."*

So a plain `join fetch o.lines` **silently drops every order that has no lines**.
Your query returns 94 orders instead of 100 and the count assertion passes,
because it was a fetch problem you were fixing, not a row-count problem. Use
`left join fetch` unless you genuinely mean to filter.

## The SQL, and why it is one statement

The guide's worked example is a `Book` with a many-to-many `authors`. The HQL:

```java
List<Book> books = session
        .createSelectionQuery("from Book join fetch authors order by isbn")
        .getResultList();
```

and the single SQL statement it produces on PostgreSQL:

```sql
select b1_0.isbn, a1_0.books_isbn, a1_1.id, a1_1.bio, a1_1.name,
       b1_0.price, b1_0.published, b1_0.publisher_id, b1_0.title
from Book b1_0
join (Book_Author a1_0 join Author a1_1 on a1_1.id = a1_0.authors_id)
     on b1_0.isbn = a1_0.books_isbn
order by b1_0.isbn
```

Note the columns: **the parent's columns and the child's columns are in one
result set**. That is the entire mechanism. Hibernate reads the flat rows, groups
them by parent identifier, and assembles the object graph in memory — which is
also why the same parent appears on several rows and why
[chunk 8c](08c-duplicate-parents-and-distinct.md) exists.

The guide's verdict on the comparison with the alternatives:

> *"Join fetching, despite its non-lazy nature, is clearly more efficient than
> either batch or subselect fetching, and this is the source of our
> recommendation to avoid the use of lazy fetching."*

and, from the fetching overview:

> *"Of these, you should almost always use outer join fetching."*

## The four ways to ask for it

The guide enumerates them, and they are genuinely four different tools rather
than four spellings of one:

| Way | Where the decision lives | Chunk |
|---|---|---|
| `left join fetch` in HQL/JPQL | in the query text | this one |
| `From.fetch()` in a criteria query | in code, type-safe | below |
| a JPA `EntityGraph` | as a declarative plan attached to the call | [9](09-entity-graph.md) |
| a named fetch profile | as a named plan enabled for a session | [13](13-fetch-profiles.md) |

Its own recommendation: *"Typically, a query is the most convenient option."*

The criteria form of the same query:

```java
var builder = sessionFactory.getCriteriaBuilder();
var query   = builder.createQuery(Book.class);
var book    = query.from(Book.class);
book.fetch(Book_.authors);                       // ← fetch(), not join()
query.select(book);
query.orderBy(builder.asc(book.get(Book_.isbn)));
```

`Book_` is generated by the Hibernate Processor, so the attribute names are
checked at compile time — the reason to prefer criteria over a string when the
query is built dynamically.

## The property that is not a bug

> *"Unfortunately, by its very nature, join fetching simply can't be lazy. So to
> make use of join fetching, we must plan ahead."*

This is worth sitting with, because it explains why the best fix cannot be the
default. A join happens *when the query runs*. Laziness means deciding *after*
the query has run. Those are mutually exclusive, so join fetching requires you to
know what you need before you ask — which is precisely
[chunk 1b](01b-the-general-rule.md)'s rule restated as a mechanism.

Hence the guide's two tips that read as contradictory and are not:

> *"Avoid the use of lazy fetching, which is often the source of N+1 selects."*

> *"Most associations should be mapped for lazy fetching by default."*

Its own resolution: *"It's saying that you must explicitly specify eager fetching
for associations precisely when and where they are needed."* **Lazy in the
mapping, eager at the call site.** That sentence is the design principle behind
this entire topic, and
[18 · Fetching belongs to the call site](18-fetching-belongs-to-the-call-site.md) is its
long form.

What a fetch join breaks — duplicate parents, pagination, and more than one
collection — plus the rules about what is always safe, are
[chunk 8b](08b-what-a-fetch-join-breaks.md). The three failure modes then get a
chunk each: [8c](08c-duplicate-parents-and-distinct.md),
[8d](08d-pagination.md) and [8e](08e-multiplebagfetchexception.md).

## Gotchas

**⚠️ Writing `join` where you meant `join fetch`.**
The query runs, returns the right parents, and changes nothing about laziness —
so the N+1 is still there and you now also have a join. The two words do
different jobs: `join` is SQL, `fetch` is what populates the association.

**⚠️ Using `join fetch` instead of `left join fetch`.**
Inner semantics: parents with no children vanish from the result. Your list
endpoint quietly stops showing new orders that have no lines yet, and no test
that only checks the query count will catch it.

**⚠️ Expecting the criteria API's `join()` to fetch.**
`root.join(Order_.lines)` is a join; `root.fetch(Order_.lines)` is a fetch join.
The same trap as the HQL one, with the additional wrinkle that `fetch()` returns
a `Fetch` rather than a `Join`, so it cannot be used in a `where` clause — which
is the API telling you not to filter on it.

**⚠️ Adding `join fetch` to a `count` query.**
Spring Data derives a count query for paginated methods, and a fetch join in one
is meaningless at best and an error at worst. Supply an explicit `countQuery`
without the fetch.

**⚠️ Assuming a fetch join on a `@ManyToOne` removes an eager N+1 everywhere.**
It removes it for that query. Other queries returning the same entity still
resolve the eager association with secondary selects, because the mapping is
unchanged. That is [16 · `EAGER` is not a fix](16-eager-is-not-a-fix.md).

**⚠️ Expecting a fetch join to work on a derived-name repository method.**
A method like `findByStatus` has no query text to add the clause to. Either write
the `@Query`, or attach an `@EntityGraph` to the derived method —
[9g · Spring Data `@EntityGraph`](09g-spring-data-entitygraph.md), which exists
precisely for this.

**⚠️ Using a fetch join in a subquery.**
Disallowed, and the guide says why: "fetch joins are disallowed in subqueries,
where they would make no sense". A subquery produces values, not managed
entities, so there is nothing for the fetch to populate.

## Interview questions

**★ What does `join fetch` do that `join` does not?**
`join` produces a SQL join, which affects which parents come back and lets you
filter on the joined table — but it leaves the association exactly as lazy as the
mapping made it, so the N+1 is untouched. `fetch` is the part that says the
joined rows should be used to *populate* the association on the returned
entities. The user guide puts it as "a fetch join overrides the laziness of a
given association, specifying that the association should be fetched with a SQL
join". The practical consequence is that writing `join` where you meant `join
fetch` produces a query that looks like a fix, returns correct results, and still
issues one statement per parent afterwards — a genuinely confusing failure,
because everything about it looks right.

**★ Why should it almost always be `left join fetch`?**
Because a plain `join fetch` is an inner join, and an inner join drops every
parent that has no children. The user guide is explicit: an inner `join fetch`
"only returns base entities with an associated entity", whereas `left join fetch`
"returns all the base entities, including those which have no associated joined
entity". So the moment you switch a `findAll()` to `join fetch o.lines`, orders
with no lines silently disappear from the result. That is a correctness
regression introduced by a performance fix, and it is invisible to any test
written to check the query count rather than the row count. Use the outer form
unless the filtering is genuinely what you want.

**★ Why can't a fetch join be lazy, and why does that matter?**
Because a join happens at the moment the query executes, and laziness means
deciding after the query has executed — they are mutually exclusive by
construction. The guide says so directly: "by its very nature, join fetching
simply can't be lazy. So to make use of join fetching, we must plan ahead." It
matters because it explains why the best fix cannot be a default. Hibernate
cannot join `o.lines` on your behalf, because at query time nothing has expressed
an interest in `o.lines`; the information about what this unit of work needs
exists only in your head. That is the same reason the guide's two apparently
contradictory tips — avoid lazy fetching, and map most associations lazy —
resolve into one rule: lazy in the mapping, eager at the call site.

**★ What are the four ways to request eager fetching, and when would you pick
each?**
The guide lists them: a JPA `EntityGraph`, a named fetch profile, `left join
fetch` in HQL/JPQL, and `From.fetch()` in a criteria query — and it says
"typically, a query is the most convenient option". In practice: use `join fetch`
when you are already writing the query and the fetch plan is inherent to it; use
`From.fetch()` when the query is built dynamically and you want the attribute
names checked at compile time via the generated metamodel; use an `EntityGraph`
when you want the fetch plan attached to a *call* rather than baked into query
text, which is what lets one derived repository method be reused with different
plans; and use a fetch profile when the plan should apply across a whole session
or a set of queries rather than to one call. They are genuinely different tools,
not four spellings of the same thing.

**★ Why is a fetch join not allowed in a subquery?**
Because there is nothing for it to populate. A subquery produces values that the
enclosing query uses in a predicate — it does not return managed entities to the
caller — so "fetch this association onto the returned objects" has no referent.
Hibernate rejects it rather than silently ignoring the `fetch`, which is the
right call: silently degrading to a plain join would leave you with an N+1 and a
query that looked like it had been fixed. The guide's wording is that fetch joins
"are disallowed in subqueries, where they would make no sense", and the reasoning
generalises — a fetch clause is meaningful only where the query's result is the
thing being fetched onto.

---

← Prev: [7 · From a count to a call site](07-from-a-count-to-a-call-site.md) · Index: [08 · The N+1 problem](README.md) · Next → [8b · What it breaks](08b-what-a-fetch-join-breaks.md)
