---
title: "What a JPQL string buys you is grouping, real joins, aggregates and constructor expressions — what it does not buy you is any change to how JPA treats the objects that come back"
sidebar_label: "03b · What JPQL buys you"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html));
> Jakarta Persistence 3.2 §4 (the query language, constructor expressions);
> Hibernate ORM 7.4 User Guide, "A Guide to Hibernate Query Language"
> ([HQL](https://docs.jboss.org/hibernate/orm/7.0/querylanguage/html_single/Hibernate_Query_Language.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Two lists decide whether `@Query` is the right tool. The first is what the
query language can say that a method name cannot — and it is short enough to
memorise. The second is everything that is unchanged by writing the query
yourself: the results are still managed entities, lazy associations are still
lazy, the persistence context still snapshots everything it hands you, and the
SQL is still Hibernate's. People reach for `@Query` expecting the second list to
be shorter than it is, and are then surprised that a hand-written query has an
N+1 in it.**

## What you actually gain over a derived name

The list is short and each item is a thing the method-name grammar simply cannot
express:

| JPQL gives you | The derived-name grammar |
|---|---|
| `where a = ?1 and (b = ?2 or c = ?3)` | no grouping — splits on `Or` first |
| `left join` and `left join fetch` | path navigation is always an inner join |
| `group by` with `having` | subject keywords are select/count/exists/delete only |
| a subquery, `exists`, `in (subquery)` | no syntax at all |
| `lower(…)`, arithmetic, `case when` | only `IgnoreCase`, only as `upper(…)` |
| a constructor expression | returns entities or, at best, `Object[]` |
| `order by` on an expression | `Sort.by("length(firstname)")` throws |

The last two are the ones that change how an application is written rather than
just how a query is spelled. A constructor expression —
`select new com.example.OrderRow(o.id, o.placedAt, c.name) from Order o join o.customer c`
— returns a list of DTOs and no managed entities at all, which is the subject of
[06 · projections](06-projections.md).

## Text blocks, and why the formatting matters

The query is a string, so it is invisible to every tool that would otherwise help
you. A Java text block (`"""`) is the difference between a query you can read in
a diff and one that arrives as a single 300-character line:

```java
@Query("""
        select o
        from Order o
        where o.status = :status
          and o.total >= :minimum
        """)
List<Order> byStatusAndMinimum(OrderStatus status, Money minimum);
```

⚠️ **Watch the whitespace at the joins between lines.** JPQL does not care about
newlines, but string concatenation does: `"select o from Order o" + "where …"`
produces `Order owhere` and fails at startup. Text blocks make that class of bug
impossible, which is reason enough to use them everywhere.

## What `@Query` does *not* change

It is still JPA. Everything the persistence context does, it still does:

- **The results are managed entities** (unless you projected), so they are in the
  first-level cache, they are dirty-checked, and modifying one inside the
  transaction writes an `update` at flush —
  [06 · dirty checking](../06-jpa-hibernate-model/14-dirty-checking.md).
- **Lazy associations are still lazy.** A `join` in the query filters; it does not
  fetch. Writing `join o.customer c` and then reading `order.getCustomer().getName()`
  in a loop is still N+1 — the fix is `join fetch`, and that argument belongs to
  [08 · join fetch](../08-the-n-plus-1-problem/08-join-fetch.md).
- **The provider still owns the SQL.** JPQL is compiled by Hibernate; what reaches
  PostgreSQL is Hibernate's rendering of it, not your string.

## Gotchas

**⚠️ Treating `join` as `join fetch`.**
The most common misreading of a JPQL string in review. `join` affects which rows
come back; `join fetch` affects which objects come back initialised. A query with
`join` and a template that walks the association is the textbook N+1, and the
query looks like it already solved it.

**⚠️ Concatenating query fragments with `+`.**
Missing spaces at the seams — `"select o from Order o" + "where …"` becomes
`Order owhere` — and a query that can only be read by re-running the
concatenation in your head. It also tempts the next person to concatenate a
*value*, which is a SQL-injection hole in a place nobody looks for one.

**⚠️ Trying to make the query conditional.**
`@Query` is a compile-time constant; there is no supported way to add a predicate
only when a filter was supplied. The moment you want that, you are past the
annotation and into [07 · specifications](07-specifications-and-criteria.md).
Reaching for `String.format` in a custom implementation instead is how injection
arrives in a JPA codebase.

**⚠️ Assuming JPQL is portable to any provider.**
It is portable in the sense that entity and field names are provider-independent.
It is not portable in the sense of "any function you can name": HQL accepts
constructs standard JPQL does not, and Hibernate 6 and 7 tightened several of
them. A query written against Hibernate's leniency runs only on Hibernate.

**⚠️ Putting `limit` in the JPQL string.**
Hibernate's HQL has `limit`/`offset`, but the Spring-Data-aware way to limit a
query method is `Pageable`, a `Limit` parameter, or a `Top`/`First` keyword.
Spring Data will add its own paging on top of a query that already limits itself,
and the result is not the query you wrote —
[05 · pageable and sort](05-pageable-and-sort.md).

**⚠️ Returning entities from a report query.**
Every entity returned joins the persistence context and is snapshotted for dirty
checking. On ten thousand rows that are rendered once and discarded, the whole
cost is waste — and it is cost that grows with the result, not with the work.
[06 · projections](06-projections.md).

**⚠️ Writing a constructor expression with the short class name.**
JPQL requires the fully-qualified name in `select new …` unless your provider
offers a shortcut. Hibernate can resolve an imported or auto-imported name, but
the portable spelling is the FQN, and the failure is at startup with a message
about an unknown class rather than about your query.

**⚠️ Selecting several fields and typing the return as the entity.**
`select o.id, o.total from Order o` returns `Object[]`, not `Order`. If the
method says `List<Order>`, the failure is a `ClassCastException` at the call
site, not at startup, because the parse succeeded.

**⚠️ Believing a `left join` makes the association loaded.**
It does not; only `fetch` does. A `left join` on a collection additionally
multiplies the parent rows, which is a separate problem with its own fix —
[08 · duplicate parents and `distinct`](../08-the-n-plus-1-problem/08c-duplicate-parents-and-distinct.md).

**⚠️ Adding `distinct` reflexively to fix duplicates.**
It changes the SQL and, on a fetch join, it changes what the provider does with
the rows. It is a real fix for one specific cause and a performance tax
everywhere else. Understand which one you have before typing it — the reference
itself warns that `distinct` "can be tricky and not always producing the results
you expect".

**⚠️ Forgetting that the text block's indentation is part of the string.**
Java strips the common prefix, so the query text is clean — but a stray tab or a
closing `"""` further left than the content changes what is stripped. Harmless
for JPQL, and a real difference if you ever compare query strings in a test.

## Interview questions

**★ What can JPQL express that a derived method name cannot?**
Grouping with parentheses, `left join`, `group by`/`having` with aggregates,
subqueries and `exists`, functions and arithmetic on a column, constructor
expressions, and ordering by an expression. Each of those has no token in the
method-name grammar, so each is a reason the name has to give way.

**★ What is the difference between `join` and `join fetch`?**
`join` makes an association available for filtering and projection; it does not
initialise it. `join fetch` additionally loads the associated entities as part of
the result, so navigating them afterwards issues no further queries. A query with
`join` followed by a loop over the association is a normal N+1.

**★ Can a query method return something that is not an entity?**
Yes — a single scalar, an `Object[]` for several selected values, an aggregate,
or a DTO built by a constructor expression (`select new com.example.Row(…)`).
Spring Data layers interface and class projections on top of that, which is
usually the nicer spelling of the same thing.

**★ Does writing the query yourself avoid the persistence context?**
No. Selected entities are managed, cached in the context, and dirty-checked
exactly as they would be from any other query method. Only projecting away from
the entity — a constructor expression or a Spring Data projection — avoids that,
and that is a decision about the return type, not about `@Query`.

**★ Why is building a JPQL string at runtime a bad idea?**
Because the safe version of it already exists. Concatenation loses the
startup-time parse (the string is different on every call), invites value
interpolation and therefore injection, and produces a query nobody can read in a
diff. A `Specification` composes the same predicates with the provider doing the
rendering.

**★ You need the ten most recent orders. Where does the limit go?**
Not in the JPQL. Use a `Pageable`, a `Limit` parameter, or a `Top10` keyword in
the method name, so that Spring Data controls the paging and the count query. A
`limit` inside the string is invisible to that machinery and can end up combined
with it.

**★ Is JPQL portable across databases? Across JPA providers?**
Across databases, largely yes — the provider renders the SQL. Across providers,
only to the extent that you stayed inside the specification. Hibernate's HQL is a
superset, and the more of it you use the more your "JPA" application is a
Hibernate application.

**★ A JPQL query returns each parent five times. What happened?**
It joined a collection, so the row set multiplied by the number of children, and
each parent appeared once per child row. The fix depends on why: `distinct` on a
plain join, a `Set` or the provider's de-duplication on a fetch join, or a second
query. The full argument is in topic 08.

**★ Why prefer a text block for the query?**
Because the query is a string and therefore invisible to every tool that would
normally help. A text block gives you line-by-line diffs, no seam bugs from
concatenation, and a shape a reviewer can read against the SQL it will produce.
There is no runtime difference at all — it is purely a legibility argument, which
for an unchecked string is the argument that matters.

**★ You wrote `select o.id, o.total from Order o` and typed the method
`List<Order>`. When do you find out?**
At the call site, as a `ClassCastException`, because the query parsed perfectly
well — it just does not return what you claimed. The parse check at startup
validates the query language, not the agreement between the query and the Java
signature.

{/* FOOTER */}
