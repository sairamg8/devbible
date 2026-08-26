---
title: "Top, First, the Limit parameter and a static OrderBy are the four ways a method name can bound and order a result — and three of them are silently wrong without the fourth"
sidebar_label: "02e · Limiting and static ordering"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Defining Query
> Methods", sections "Limiting Query Results" and "Query Creation"
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html))
> and "Repository query keywords"
> ([query-keywords-reference.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-keywords-reference.html)),
> plus the PostgreSQL 18 manual, "LIMIT and OFFSET"
> ([queries-limit.html](https://www.postgresql.org/docs/18/queries-limit.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, PostgreSQL 18.

**A result limit belongs to the subject of the method name, not the predicate:
`findTop10By…` is a `find` with a bound on it. Spring Data gives you two ways to
express the bound — baked into the name with `Top`/`First`, or passed at runtime
as a `Limit` parameter — and the reference is explicit that the two must not be
mixed. What none of them give you is an order. A limit without an `ORDER BY` asks
the database for "some ten rows", and the database is entitled to answer
differently on Tuesday.**

## `Top` and `First` are the same keyword

> *"You can limit the results of query methods by using the `First` or `Top`
> keywords, which you can use interchangeably but may not be mixed with a `Limit`
> parameter. You can append an optional numeric value to `Top` or `First` to
> specify the maximum result size to be returned. If the number is left out, a
> result size of 1 is assumed."*

The store-neutral keyword table adds where they may appear: *"This keyword can
occur in any place of the subject between `find` (and the other keywords) and
`by`."*

The reference's own set of legal spellings, which is worth reading as a group
because each line teaches something different:

```java
List<User>  findByLastname(String lastname, Limit limit);
User        findFirstByOrderByLastnameAsc();
User        findTopByLastnameOrderByAgeDesc(String lastname);
Page<User>  queryFirst10ByLastname(String lastname, Pageable pageable);
Slice<User> findTop3By(Pageable pageable);
List<User>  findFirst10ByLastname(String lastname, Sort sort);
List<User>  findTop10ByLastname(String lastname, Pageable pageable);
```

- Line 2 has **no predicate at all** — `findFirstByOrderByLastnameAsc()` is a
  subject, an empty predicate and a static order. `By` with nothing after it is
  legal, and line 5 (`findTop3By`) shows the same thing with a parameter.
- Lines 4, 5 and 7 combine a limit with a `Pageable`; line 6 combines one with a
  `Sort`. All are supported.
- Line 1 is the runtime alternative and is the only one that does not name a
  number.

The reference adds two more affordances: *"The limiting expressions also support
the `Distinct` keyword… Also, for the queries that limit the result set to one
instance, wrapping the result into with the `Optional` keyword is supported."*

## The `Limit` parameter, and why it exists

`Top`/`First` bakes the number into the method name, so a caller that needs five
and a caller that needs fifty need two methods. The `Limit` parameter moves the
bound to the call site:

```java
List<Order> findByStatus(OrderStatus status, Limit limit);

repository.findByStatus(PLACED, Limit.of(20));
repository.findByStatus(PLACED, Limit.unlimited());
```

🔴 **It may not be combined with `Top`/`First`** — the reference says so directly,
and the failure is a bootstrap failure rather than one of the two silently
winning. It also may not be combined with a `Pageable`, which makes sense once
you see that a `Pageable` already carries a page size.

`Limit.unlimited()` is the neutral value, in the same family as
`Sort.unsorted()` and `Pageable.unpaged()`. Having one means a caller can pass a
bound conditionally without the repository growing a second method.

## Limiting interacts with paging in a specific way

> *"If pagination or slicing is applied to a limiting query pagination (and the
> calculation of the number of available pages), it is applied within the limited
> result."*

So `queryFirst10ByLastname(name, PageRequest.of(0, 3))` pages *within* ten rows,
not through the whole table: four pages at most, and `getTotalElements` reflects
the limited set. That is usually what "top 10, three at a time" means, and it is
never what someone expects who added `Top10` to an already-paged method to "make
it faster".

⚠️ **Adding `Top`/`First` to a paged finder changes the meaning of every page
number the caller already has.** It is not a performance tweak; it is a different
query.

## A limit without an order is not deterministic

This is not a Spring Data rule, it is a SQL one, and PostgreSQL states it plainly:

> *"When using `LIMIT`, it is important to use an `ORDER BY` clause that
> constrains the result rows into a unique order. Otherwise you will get an
> unpredictable subset of the query's rows."*

Two words there are load-bearing. **`ORDER BY`** — without one, "the first ten"
means whatever ten rows the plan produced first, which changes with the plan.
And **unique** — an `ORDER BY` on a non-unique column leaves ties unordered, so
`findTop10ByOrderByCreatedAtDesc` on a table where fifty rows share a timestamp
still has an arbitrary result.

🔴 **Every `Top`/`First` method needs an order, and that order should end in a
tiebreaker** — usually the primary key:

```java
List<Order> findTop10ByStatusOrderByPlacedAtDescIdDesc(OrderStatus status);
```

Ugly, and correct. The alternative is to pass the order in as a `Sort`, which
keeps the name short and moves the responsibility to the caller — where it is
easier to forget.

## Static ordering: `OrderBy…`

> *"You can apply static ordering by appending an `OrderBy` clause to the query
> method that references a property and by providing a sorting direction (`Asc`
> or `Desc`)."*

```java
List<Person> findByLastnameOrderByFirstnameAsc(String lastname);
List<Person> findByLastnameOrderByFirstnameDesc(String lastname);
```

The keyword table describes the modifier as *"Specify a static sorting order
followed by the property path and direction (e.g. `OrderByFirstnameAscLastnameDesc`)."*
— so several properties chain, each with its own direction.

A static order is the right choice when the order is part of the method's
meaning: "the ten most recent" is not a sorted list of orders, it is a different
concept. It is the wrong choice when the caller decides, which is what the
`Sort` parameter is for —
[05 · pageable and sort](05-pageable-and-sort.md).

⚠️ **The reference does not say what happens when a method has both a static
`OrderBy` and a `Sort` parameter.** Do not rely on either winning: pick one form
per method. If you need a default order that a caller can override, express the
default at the call site with `Sort` rather than in the name.

## Gotchas

**⚠️ `findTop10By…` with no `OrderBy` and no `Sort`.**
The database returns an arbitrary ten rows and is entitled to return different
ones after a vacuum, an index change or a plan flip. It usually looks stable in
development, because a small table is scanned in insertion order.

**⚠️ Ordering by a non-unique column and calling it deterministic.**
PostgreSQL's wording is "a unique order". Ties are unordered, so a `Top 10` over
a timestamp with duplicates can return a different tenth row each call — and in
a paging context that means rows appearing twice or never.

**⚠️ Forgetting that a missing number means one.**
`findTopByLastname` returns a single row, not "the top ones". If the return type
is `List<T>` it is a list of at most one, which reads like a bug at the call
site and is not.

**⚠️ Mixing `Top`/`First` with a `Limit` parameter.**
Explicitly disallowed. Fortunately it fails at bootstrap, so the only cost is
confusion about which one was meant to win.

**⚠️ Adding `Top10` to an already-paged method.**
Paging is then applied within the ten rows. Page 4 of a 3-per-page request is
empty, and the total element count is 10 regardless of the table. Nothing warns
you, because both features are working exactly as documented.

**⚠️ Baking a number into a method name that the caller wants to vary.**
`findTop5…` and `findTop50…` are two methods with identical bodies. That is what
the `Limit` parameter is for, and it also stops the number drifting away from the
UI constant that motivated it.

**⚠️ Assuming `Limit` and `Pageable` compose.**
They do not — a `Pageable` already carries a size. If you need "at most 100 rows,
paged 20 at a time", the limit is a property of the query you write, not a
parameter you add.

**⚠️ Writing a static `OrderBy` over a property that is later renamed.**
Just like a predicate token, it is an unchecked string reference. Renaming
`firstname` breaks `findByLastnameOrderByFirstnameAsc` at context startup, and
the method's name gives no hint that it depends on the field.

**⚠️ Using a static `OrderBy` on a column with no index and then adding a
limit.**
A top-N over an unindexed sort column is a sort of the whole matching set
followed by a discard of nearly all of it. The limit does not save the sort;
an index in the right order does. That argument is
[05c · sort is not free](05c-sort-is-not-free.md).

**⚠️ Reaching for `Distinct` together with a limit.**
Supported, but the interaction is worth thinking through: the distinct applies
before the limit, so "top 10 distinct" is not "distinct of the top 10". On a
query with a collection join those are very different results.

**⚠️ Using a static order to paper over a missing tiebreaker in a keyset
scheme.**
Deterministic ordering is a precondition for keyset pagination, not a nicety.
Without a unique final sort key, a keyset cursor can loop or skip —
[05b · offset pagination at depth](05b-offset-pagination-at-depth.md).

## Interview questions

**★ What is the difference between `Top` and `First`?**
Nothing. The reference says they are interchangeable. Both take an optional
number, and both may appear anywhere in the subject between the verb and the
`By`. Consistency within a codebase is the only reason to prefer one.

**★ What does `findTopByLastname` return?**
One row at most. If the number is omitted from `Top` or `First`, a result size of
1 is assumed. That is a documented default and a common misreading — the name
looks plural.

**★ When would you use a `Limit` parameter instead?**
When the bound belongs to the caller rather than to the method. `Top`/`First`
bakes a constant into the name, so two callers needing different bounds need two
methods; `Limit.of(n)` moves it to the call site, and `Limit.unlimited()` gives
you a neutral value so the bound can be conditional.

**★ Can you use both?**
No. The reference states that `First`/`Top` "may not be mixed with a `Limit`
parameter", and `Limit` cannot be combined with a `Pageable` either, since a
`Pageable` already carries a page size. All of these fail at bootstrap.

**★ What happens if you page a limited query?**
Pagination — including the page count — is applied within the limited result. A
`First10` finder paged three at a time yields at most four pages and a total of
ten. So adding a limit to a paged method silently redefines what every page
number means.

**★ Why does a `Top` query need an `ORDER BY`?**
Because without one the database is free to return any rows that satisfy the
predicate. PostgreSQL's manual says an `ORDER BY` is needed to constrain the rows
"into a unique order", or "you will get an unpredictable subset". The limit
selects from an ordering that does not exist unless you supply it.

**★ Is `ORDER BY createdAt DESC` enough for a top-10?**
Only if `createdAt` is unique. Ties are unordered, so rows sharing a timestamp
can swap places between calls. Adding the primary key as a final sort key makes
the order total, which is what "unique order" means and what any cursor-based
scheme requires.

**★ How do you express a static order in a method name?**
Append `OrderBy` plus the property and a direction — `OrderByFirstnameAsc` — and
chain more properties for a multi-column order, as in
`OrderByFirstnameAscLastnameDesc`. It is part of the name, so it is fixed for
every caller.

**★ Static `OrderBy` or a `Sort` parameter?**
Static when the order is part of the method's meaning — "the ten most recent"
is a different concept from "orders, sorted". A `Sort` parameter when the caller
decides. Do not put both on one method: the reference does not define how they
combine, so relying on it is relying on an implementation detail.

**★ Does a limit make an expensive sort cheap?**
No. If the sort column is unindexed, the database sorts the whole matching set
and then discards all but N. The limit reduces what crosses the wire, not what
the database does. An index in the sort's order is what makes a top-N cheap.

{/* FOOTER */}
