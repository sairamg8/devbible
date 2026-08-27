---
title: "Keyset filtering replaces skip-N with a where clause on the last row's sort values, which is the only form of pagination whose cost does not grow with the page number — and Spring Data's Scroll API implements it for every kind of query method except a @Query"
sidebar_label: "05b2 · Keyset filtering and scrolling"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods", section "Scrolling Large Query Results" and its Keyset-Filtering
> subsection
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)),
> and the "Consuming Large Query Results" table in "Defining Query Methods"
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html));
> PostgreSQL 18 "Row and Array Comparisons"
> ([functions-comparisons](https://www.postgresql.org/docs/18/functions-comparisons.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Keyset filtering asks "the rows after this one" instead of "skip this many
rows", which turns a scan-and-discard into an index seek. Spring Data implements
it as the Scroll API — `Window`, `ScrollPosition`, `WindowIterator` — and the
implementation is careful in ways worth copying even when you write the predicate
by hand: it appends the primary key so the ordering is unique, it treats positions
as exclusive, and it documents three constraints that will otherwise produce
wrong answers rather than errors. It also has one hard limitation that decides
API design: it does not work with a `@Query`.**

## Keyset filtering: ask a different question

Instead of "skip 100,000 rows in this order", keyset pagination asks "the next 20
rows after the row with these key values". The offset disappears and so does its
cost:

> "Keyset-Filtering approaches result subset retrieval by leveraging built-in
> capabilities of your database aiming to reduce the computation and I/O
> requirements for individual queries. This approach maintains a set of keys to
> resume scrolling by passing keys into the query, effectively amending your
> filter criteria."

and, on the mechanics:

> "To run the query, reconstruction rewrites the criteria clause to include all
> sort fields and the primary key so that the database can leverage potential
> indexes to run the query. The database needs only constructing a much smaller
> result from the given keyset position without the need to fully materialize a
> large result and then skipping results until reaching a particular offset."

In Spring Data this is the Scroll API:

```java
interface UserRepository extends Repository<User, Long> {

    Window<User> findFirst10ByLastnameOrderByFirstname(String lastname,
                                                       KeysetScrollPosition position);
}
```

```java
WindowIterator<User> users = WindowIterator
        .of(position -> repository.findFirst10ByLastnameOrderByFirstname("Doe", position))
        .startingAt(ScrollPosition.keyset());

while (users.hasNext()) {
    User u = users.next();
    // consume
}
```

`WindowIterator` exists because hand-rolling the loop is repetitive — the
reference notes that consuming `Window` instances directly *"requires quite a few
conditionals to reach optimum database round-trips"*.

## The constraints, all four of them

The Scroll API is not a drop-in replacement, and the reference is unusually
explicit about why:

1. **The keys must be non-nullable.** *"Keyset-Filtering requires the keyset
   properties (those used for sorting) to be non-nullable. This limitation applies
   due to the store specific `null` value handling of comparison operators as well
   as the need to run queries against an indexed source. Keyset-Filtering on
   nullable properties will lead to unexpected results."* Not "will fail" —
   *"unexpected results"*, which is worse.
2. **There must be an index matching the sort.** *"Keyset-Filtering works best
   when your database contains an index that matches the sort fields, hence a
   static sort works well."* Without it you have swapped an expensive skip for an
   expensive scan.
3. **The sort keys must be in the result.** *"Scroll queries applying
   Keyset-Filtering require to the properties used in the sort order to be
   returned by the query, and these must be mapped in the returned entity. You can
   use interface and DTO projections, however make sure to include all properties
   that you've sorted by to avoid keyset extraction failures."* A projection that
   omits the sort key breaks the scroll rather than the projection.
4. **Uniqueness is handled for you.** *"The keyset query mechanism amends your
   sort order by including the primary key (or any remainder of composite primary
   keys) to ensure each query result is unique."* So you sort by what you care
   about and the tiebreaker is added.

⚠️ **Two `ScrollPosition` factory methods look identical and are not:**
*"There is a difference between `ScrollPosition.offset()` and
`ScrollPosition.offset(0L)`. The former indicates the start of scroll operation,
pointing to no specific offset whereas the latter identifies the first element (at
position `0`) of the result. Given the `exclusive` nature of scrolling, using
`ScrollPosition.offset(0)` skips the first element and translate to an offset of
`1`."* Positions are exclusive — results start *after* the given position.

## 🔴 The constraint that decides your design

**Scrolling does not work with `@Query`.** *"Scrolling with String-based query
methods is not yet supported"*, and it is *"also not supported using stored
`@Procedure` query methods"*. It works with derived queries, Query by Example and
Querydsl.

So if your paged query is complex enough to need a declared JPQL string — and
deep-paged queries usually are — the Scroll API is not available and you write the
keyset predicate yourself:

```java
@Query("""
        select o from Order o
        where o.customer.id = :customerId
          and (o.placedAt < :lastPlacedAt
               or (o.placedAt = :lastPlacedAt and o.id < :lastId))
        order by o.placedAt desc, o.id desc
        """)
List<Order> pageAfter(Long customerId, Instant lastPlacedAt, Long lastId, Limit limit);
```

That predicate is the manual form of what keyset filtering generates: the sort
columns, then the primary key as the tiebreaker. ⚠️ **PostgreSQL can express it
far more neatly as a row comparison — `(o.placed_at, o.id) < (?, ?)`, which also
matches a composite index cleanly — but JPQL has no row-constructor syntax, so the
tidy version is a native query.** The expanded `or` form above is portable and is
what you write when you want to stay in JPQL.

## What to do when the UI insists on page numbers

Keyset pagination cannot answer "jump to page 400", because it has no notion of
page 400. Three honest options:

- **Change the interface.** Infinite scroll, "load more", or a cursor in the API.
  This is the right answer when the data is a feed.
- **Cap the depth.** Allow offset paging for the first N pages and require a
  filter beyond that. Most users who reach page 50 wanted a search box.
- **Keep offset paging and make it cheap.** Narrow the query with a filter, ensure
  the sort is fully indexed, and accept the cost — a covering index over the sort
  columns turns the skip into an index-only scan, which is much cheaper than a
  heap scan even though it is still linear in the offset.

⚠️ **And drop the total.** `Page` at depth is the worst combination available: a
count over the whole matching set plus an offset scan, on every request.

## Gotchas

**⚠️ Keyset scrolling on a nullable sort property.**
Documented to produce unexpected results rather than an error — comparison
semantics for `null` differ by store and the index cannot help. Sort keys must be
non-nullable, which is a modelling requirement, not a query one.

**⚠️ Projecting away a sort key in a scroll query.**
The keyset is extracted from the returned rows, so a projection that omits a sort
property breaks the extraction. The reference calls this out precisely because the
projection looks correct in isolation — it selects everything the caller uses.

**⚠️ Keyset scrolling without a matching index.**
The rewritten `where` clause is only fast if an index supports it. Without one you
have exchanged a linear skip for a linear scan and gained nothing but complexity
and a cursor in your API.

**⚠️ Sorting dynamically in a keyset scroll.**
Every sort order needs its own index for this to be worth doing. The reference
notes keyset filtering works best with a static sort for exactly that reason;
exposing arbitrary per-request sorting on a scrolled endpoint quietly requires an
index per option.

**⚠️ Using `ScrollPosition.offset(0)` to start at the beginning.**
It starts *after* element zero, because positions are exclusive.
`ScrollPosition.offset()` — no argument — is the start of a scroll.

**⚠️ Designing a cursor API on top of a `@Query`.**
Scrolling is not supported for string-based query methods, nor for stored
`@Procedure` methods. Find that out at design time, not after publishing the
endpoint, and plan on hand-writing the keyset predicate if the query needs JPQL.

**⚠️ Writing the keyset predicate as a plain `<` on the sort column.**
Rows sharing that value are skipped or repeated at every page boundary. The
tiebreaker on the primary key is not optional, and it is exactly what the
framework's own implementation appends for you.

**⚠️ Getting the direction wrong in one half of the predicate.**
`placedAt < :last or (placedAt = :last and id > :lastId)` compiles, runs, and
walks in two directions at once. The comparison direction must match the sort
direction in every branch, and this is the single most common hand-rolled keyset
bug.

**⚠️ Exposing the keyset to the client without validating it.**
It is a set of column values that goes into a `where` clause. Being bound rather
than interpolated means it is not injection, but a client can hand you any values
it likes and read from anywhere in the ordering — which matters when the ordering
is over something like a per-tenant sequence.

**⚠️ Keeping a cursor across a sort change.**
A keyset encodes a position in a specific ordering. Change the sort and the old
cursor means nothing; the results will be neither an error nor correct. Cursors
should carry the ordering they belong to, or be invalidated when it changes.

**⚠️ Assuming keyset pagination gives you a total.**
It does not, and cannot without a separate count. That is usually acceptable —
feeds and exports do not need one — but it is a product conversation, not a
technical detail to discover during implementation.

**⚠️ Hand-rolling the loop instead of using `WindowIterator`.**
The reference notes that consuming `Window` instances directly needs several
conditionals to get the round-trips right. The utility exists because that loop is
written wrong more often than it is written right.

## Interview questions

**★ What is keyset pagination?**
Replacing "skip N rows" with "the rows after this key". The sort values of the
last row seen are passed back in and become part of the `where` clause, so the
database can use an index to jump straight to the position instead of producing
and discarding everything before it.

**★ What does Spring Data's keyset implementation add to your sort?**
The primary key, or the remaining parts of a composite key, so the ordering is
unique and each row can be positioned unambiguously. You supply the sort you care
about; it supplies the tiebreaker.

**★ What are the requirements for keyset scrolling?**
Non-nullable sort properties, an index matching the sort, and the sort properties
present in the returned rows — including in any projection. Nullable keys are
documented to give unexpected results rather than an error, which makes it a
correctness constraint rather than a performance one.

**★ Why does a projection break a scroll query?**
Because the keyset is extracted from the result rows. If the sort properties are
not in the projection, there is nothing to extract the next position from, and the
reference warns about "keyset extraction failures" specifically.

**★ Can you use scrolling with a `@Query`?**
No — scrolling is not supported for string-based query methods, or for stored
procedure methods. Derived queries, Query by Example and Querydsl support it. With
a JPQL string you write the keyset predicate yourself.

**★ Write that predicate.**
Order by the sort column and the id, then filter `sortCol < :last or (sortCol =
:last and id < :lastId)`, with every comparison in the same direction as the sort.
PostgreSQL's row comparison `(sortCol, id) < (:last, :lastId)` says the same thing
and matches a composite index more cleanly, but JPQL has no row-constructor
syntax, so that form needs a native query.

**★ What is the difference between `ScrollPosition.offset()` and
`ScrollPosition.offset(0L)`?**
The first means "the start of a scroll, no specific position"; the second
identifies the element at position zero. Because positions are exclusive, starting
at `offset(0)` skips the first element and behaves like an offset of one.

**★ What does `WindowIterator` do for you?**
It removes the conditionals around "is there another window, and what position do
I resume from". The reference is explicit that consuming `Window` instances
directly requires several checks to get optimal round-trips, which is the loop
people write incorrectly.

**★ The product wants "page 400 of 8,000". What do you say?**
That keyset pagination cannot express it, and that offset pagination can but will
be slow and inconsistent. Then offer the alternatives: change the interaction to a
feed, cap the depth and require a filter beyond it, or keep offsets with a fully
indexed sort and no total — and ask who actually goes to page 400.

**★ How would you migrate an existing offset-paged endpoint?**
Add the keyset-capable ordering and the index first, then introduce a cursor
parameter alongside the page parameter and have the client prefer it. The old
parameter can keep serving shallow pages while the deep traffic — which is where
all the cost was — moves to the cursor.

**★ Does keyset pagination make the result stable?**
Much more stable, yes: positions are by value, so an insert before your position
does not shift the window. It is not a snapshot — a row you have already passed
can still be edited or deleted — but the duplicate-and-skip behaviour of offset
paging is gone.

**★ When would you not use it?**
When the traversal is shallow, when the sort must vary per request and you cannot
index every option, when the sort keys are nullable and cannot be made otherwise,
or when the product genuinely needs random access to page N. In those cases a
capped offset with a good index is the honest answer.

{/* FOOTER */}
