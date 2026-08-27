---
title: "An ORDER BY is either answered by a b-tree index in the right direction or paid for by sorting every matching row, and because every Pageable is an ORDER BY with a LIMIT that difference is what decides whether a paginated endpoint survives the table growing"
sidebar_label: "05c2 · What the ORDER BY costs"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 18 "Indexes and `ORDER BY`"
> ([postgresql.org](https://www.postgresql.org/docs/18/indexes-ordering.html)) and
> the Spring Data JPA 4.1 reference — "Defining Query Methods"
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**[05c](05c-sort-is-not-free.md) answered whether a `Sort` is legal. This chunk answers
what it costs — a different question with a different owner. The Java-side API says
nothing about it, and the answer is decided by an index you either created deliberately
or did not.**

## What the sort costs at the database

Everything above is about whether the query *compiles*. None of it says what the sort
costs, and the API deliberately does not: `ORDER BY` is the database's problem.

PostgreSQL's rule is short. Only one index type can hand back rows already in order:

> *"Of the index types currently supported by PostgreSQL, only B-tree can produce
> sorted output — the other index types return matching rows in an unspecified,
> implementation-dependent order."*

So a GIN index on a `jsonb` column or a GiST index on a geometry can filter for you
and can never sort for you. If your `ORDER BY` is to be satisfied by an index, that
index is a b-tree.

And the direction is part of the match, not an afterthought:

> *"By default, B-tree indexes store their entries in ascending order with nulls last
> (table TID is treated as a tiebreaker column among otherwise equal entries). This
> means that a forward scan of an index on column `x` produces output satisfying
> `ORDER BY x` (or more verbosely, `ORDER BY x ASC NULLS LAST`). The index can also be
> scanned backward, producing output satisfying `ORDER BY x DESC`…"*

> *"You can adjust the ordering of a B-tree index by including the options `ASC`,
> `DESC`, `NULLS FIRST`, and/or `NULLS LAST` when creating the index…"*

A single-column sort is therefore always satisfiable in either direction from one
plain index. A **multi-column** sort is not: `ORDER BY created_at DESC, id ASC` cannot
be read from an index on `(created_at, id)` in either direction, because neither a
forward nor a backward scan produces that combination. That index has to be created as
`(created_at DESC, id ASC)`.

## When the sort is worth an index, and when it is not

> *"For a query that requires scanning a large fraction of the table, an explicit sort
> is likely to be faster than using an index because it requires less disk I/O due to
> following a sequential access pattern. Indexes are more useful when only a few rows
> need be fetched."*

That is the honest answer to "should I index for the sort": not always. A report that
reads most of the table and orders it will sort, and that is the right plan.

The case that *does* justify the index is exactly the one a repository method usually
is:

> *"An important special case is `ORDER BY` in combination with `LIMIT n`: an explicit
> sort will have to process all the data to identify the first n rows, but if there is
> an index matching the `ORDER BY`, the first n rows can be retrieved directly, without
> scanning the remainder at all."*

🔴 **Every `Pageable` is an `ORDER BY` with a `LIMIT`.** With a matching index the
first page is a handful of index entries; without one, the database sorts every row
the `WHERE` clause matched in order to return twenty of them — on every request, for
every page. This is the single largest difference between a pagination endpoint that
stays fast and one that degrades as the table grows, and nothing in the Java code
shows which one you have.

## The sort has to be a total order, or the pages lie

Two rows with the same `created_at` have no defined relative order. The database is
free to return them differently between two executions of the same query, and page 2
can then repeat a row that page 1 already showed, or skip one entirely — the
mechanism [05b](05b-offset-pagination-at-depth.md) describes.

The fix is a tiebreaker on something unique:

```java
Sort sort = Sort.by(Sort.Direction.DESC, "createdAt")
        .and(Sort.by(Sort.Direction.ASC, "id"));
```

This is not optional for a paginated endpoint, and it is what the keyset predicate in
[05b2](05b2-keyset-filtering-and-scrolling.md) is built on: keyset pagination cannot
even be expressed without a unique last column.

## Sorting by an aliased expression is checked, not cheap

Case (4) above — `Sort.by("fn_len")` against `LENGTH(u.firstname) as fn_len` — passes
validation because the alias is referenceable. At the database it is still an
expression computed per row, so no plain index on `firstname` satisfies it. If that
sort matters, the index has to be on the expression itself
(`CREATE INDEX … ON users (length(firstname))`) and the expression in the query has to
match it exactly.

## Gotchas

**★ Only a b-tree can return rows in order.** A GIN or GiST index that makes your
`WHERE` clause fast does nothing at all for your `ORDER BY`.

**★ A mixed-direction multi-column sort needs a matching mixed-direction index.**
`ORDER BY a DESC, b ASC` is not satisfied by an index on `(a, b)` in either scan
direction. Create it as `(a DESC, b ASC)`.

**★ `NULLS FIRST`/`NULLS LAST` is part of the match too.** PostgreSQL's default is
`ASC NULLS LAST`; a `Sort` that asks for nulls first on an ascending column will not
be answered by the default index.

**★ Not every sort deserves an index.** Reading a large fraction of the table and
sorting it sequentially is often the cheaper plan — the documentation says so. The
index pays for itself when a `LIMIT` means only a few rows are actually fetched.

**★ Every `Pageable` is `ORDER BY` + `LIMIT`, which is precisely the case where the
index pays.** Missing it does not fail; it just sorts the whole matched set on every
page request.

**★ A sort without a unique tiebreaker makes pagination non-deterministic.** Equal
values have no defined order, so rows can repeat or disappear between pages of the
same result set.

**★ An aliased expression sorts correctly and slowly.** Validation passes; the
expression is still computed per row unless there is an expression index that matches
it exactly.

**★ The `COUNT(…)` query behind a `Page` does not carry the sort.** Ordering a count
would be meaningless, so an expensive sort costs you on the data query only — but it
costs you there on every single page request.

## Interview questions

**★ Which index types can satisfy an `ORDER BY` in PostgreSQL?**
Only b-tree. The others return matching rows in an unspecified order, so they can help
the `WHERE` clause and never the sort.

**★ Does one index on `(a, b)` serve `ORDER BY a DESC, b ASC`?**
No. A forward scan gives `a ASC, b ASC` and a backward scan gives `a DESC, b DESC`.
A mixed-direction sort needs an index declared with those directions.

**★ When is *not* having an index for the sort the right answer?**
When the query reads a large fraction of the table anyway — an explicit sequential
sort does less disk I/O than following an index. The index matters when a `LIMIT`
means only a few rows are fetched.

**★ Why does pagination change that answer?**
Because a `Pageable` is always `ORDER BY` with a `LIMIT`, and that is the documented
special case: with a matching index the first n rows are retrieved directly, without
scanning the rest.

**★ Why must a paginated sort include a unique column?**
Because rows with equal sort values have no defined relative order, so the database may
return them differently between requests — and then a row can appear on two pages or on
none.

**★ You sort by an aliased expression and it is slow. What is wrong?**
Nothing is wrong with the query; the expression is evaluated per row and no ordinary
column index applies. It needs an expression index that matches the expression exactly,
or the sort needs to move to a stored column.

**★ How would you find out whether your sort is using an index?**
`EXPLAIN` the SQL Hibernate emitted: an index scan feeding the `LIMIT` directly means
the order came from the index, while a `Sort` node above the scan means every matched
row was sorted to produce the page.

{/* FOOTER */}
