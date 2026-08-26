---
title: "Common table expressions give a query's intermediate steps names, recursive ones walk a hierarchy in a single statement, and DISTINCT ON is the PostgreSQL shortcut jOOQ deliberately spells backwards"
sidebar_label: "06b · CTEs and DISTINCT ON"
sidebar_position: 22
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *WITH clause*
> ([sql-statements/with-clause](https://www.jooq.org/doc/latest/manual/sql-building/sql-statements/with-clause/)),
> *WITH RECURSIVE clause*
> ([with-recursive-clause](http://www.jooq.org/doc/latest/manual/sql-building/sql-statements/with-recursive-clause/))
> and *SELECT DISTINCT ON*
> ([select-clause-distinct-on](https://www.jooq.org/doc/latest/manual/sql-building/sql-statements/select-statement/select-clause/select-clause-distinct-on/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.0, PostgreSQL 18.

**Two PostgreSQL features that change what a single query can do. A CTE turns a query with three
nested subqueries into three named steps read top to bottom — and in its recursive form walks a
tree without a loop in Java. `DISTINCT ON` answers "the latest row per group" without a window
function or a self-join. Both are ordinary expressions in jOOQ, and one of them has a syntax
surprise you will meet in the first five minutes.**

## The `WITH` clause

A CTE is declared with a name, optionally with explicit column names, and a query:

```java
CommonTableExpression<?> recent =
    name("recent").fields("customer_id", "last_order")
                  .as(select(ORDER.CUSTOMER_ID, max(ORDER.PLACED_AT))
                          .from(ORDER)
                          .groupBy(ORDER.CUSTOMER_ID));

create.with(recent)
      .select(CUSTOMER.EMAIL, recent.field("last_order"))
      .from(CUSTOMER)
      .join(recent).on(CUSTOMER.ID.eq(recent.field("customer_id", Long.class)))
      .fetch();
```

**`name(...).fields(...).as(...)` is the whole construction**, and `DSLContext.with(...)` is where
it attaches. The manual's own minimal example is
`name("t1").fields("f1", "f2").as(select(val(1), val("a")))`.

**Naming the columns is worth doing every time.** Without `fields(...)` the CTE's columns take
their names from the inner projection, which means an expression column gets whatever the database
decided to call it, and `recent.field("max")` is a guess.

⚠️ **The type-safety caveat from
[03c · Joins and aliasing](03c-joins-and-aliasing.md) applies here in full.** Reaching into a CTE
is a `field(...)` lookup, not a generated constant. `field("name", Long.class)` at least tells the
compiler what you expect on the way out.

## Recursive CTEs

`withRecursive(...)` is the version that walks a hierarchy — a category tree, an org chart, a
bill of materials — in one statement:

```java
CommonTableExpression<?> tree =
    name("tree").fields("id", "parent_id", "depth")
        .as(select(CATEGORY.ID, CATEGORY.PARENT_ID, val(0))
                .from(CATEGORY)
                .where(CATEGORY.PARENT_ID.isNull())
            .unionAll(
            select(CATEGORY.ID, CATEGORY.PARENT_ID,
                   field(name("tree", "depth"), Integer.class).plus(1))
                .from(CATEGORY)
                .join(name("tree"))
                .on(CATEGORY.PARENT_ID.eq(field(name("tree", "id"), Long.class)))));

create.withRecursive(tree).selectFrom(table(name("tree"))).fetch();
```

**The structure is always the same:** an anchor query, `UNION ALL`, and a recursive query that
joins back to the CTE's own name. That self-reference is why the CTE's columns must be named — the
recursive half has nothing else to refer to.

🔴 **This is the query that replaces the "load the parent, then load its children, then…" loop.**
It is the hierarchy equivalent of the N+1 argument in
**[Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md)**, and it is not expressible
in JPQL at all.

⚠️ **A recursive CTE with no termination condition runs until something stops it.** A cycle in the
data — a category that is its own ancestor — is an infinite recursion. A depth column with a
bound, or PostgreSQL's cycle detection, is not optional on user-editable hierarchies.

## `DISTINCT ON`, and the keyword order

PostgreSQL's `DISTINCT ON` keeps the first row per group according to the `ORDER BY`. It is the
shortest way to write "the latest order per customer", and it is PostgreSQL-only.

```java
create.select(BOOK.LANGUAGE_ID, BOOK.TITLE)
      .distinctOn(BOOK.LANGUAGE_ID)
      .from(BOOK)
      .orderBy(BOOK.LANGUAGE_ID, BOOK.TITLE)
      .fetch();
```

🔴 **Look at where `distinctOn` sits: *after* the projection, not before it.** The manual explains
why — *"the order of keywords had to be inversed as the PostgreSQL syntax cannot be easily
reproduced in jOOQ's internal DSL"*. In SQL you write `SELECT DISTINCT ON (language_id) language_id,
title`; in jOOQ you write the projection first and then say what it is distinct on. This is one of
the very few places where the DSL does not mirror the written SQL order, and it exists for a
concrete reason rather than by oversight.

**`distinctOn` implicitly enforces `DISTINCT`** — you do not add both.

⚠️ **`DISTINCT ON` without a matching `ORDER BY` returns an arbitrary row per group.** The `ORDER
BY` must lead with the same expressions as the `DISTINCT ON`, and the columns after that are what
decide *which* row survives. Omit them and you get a row, deterministically undefined.

## `DISTINCT ON` or a window function?

Both answer "one row per group". The comparison is worth having explicitly:

| | `DISTINCT ON` | `ROW_NUMBER()` filtered to 1 |
|---|---|---|
| Portability | **PostgreSQL only** | standard SQL |
| Query shape | one flat query | needs a derived table or CTE |
| Reads as | "one per group, this order" | "rank, then take the first" |
| Beyond the first row | cannot | change `le(1)` to `le(3)` |

**Use `DISTINCT ON` when you want exactly one and you are on PostgreSQL; use the window function
when you want N, or when the query may have to run elsewhere.**

## Gotchas

**★ `distinctOn` comes after the projection in jOOQ and before it in SQL.** Documented and
deliberate, and it still reads wrong the first ten times. It also means copying SQL from a psql
session into jOOQ is not a straight transliteration for this one clause.

**★ `DISTINCT ON` with no `ORDER BY` gives an arbitrary row.** The clause picks the *first* row per
group, and "first" is meaningless without an order. Development data makes it look deterministic.

**★ The `ORDER BY` must start with the `DISTINCT ON` expressions.** PostgreSQL enforces this, so
the failure is a runtime error rather than a silently wrong answer — the good kind of failure.

**★ Reaching into a CTE is a string lookup unless you keep the field objects.** `recent.field("x")`
returns `null` for a typo. Declaring the CTE's fields with `fields(...)` and holding onto typed
`Field` references is the version that survives a rename.

**★ A CTE in PostgreSQL 12 and later can be inlined rather than materialised.** That changed the
old "a CTE is an optimisation fence" advice, which is still repeated everywhere. Explicit
`MATERIALIZED` / `NOT MATERIALIZED` keywords exist in PostgreSQL; **whether the current jOOQ DSL
exposes them directly was not confirmed for this page** — plain SQL templating always can.

**★ A recursive CTE with a cycle in the data does not terminate.** Any hierarchy users can edit
will eventually contain a cycle. A bounded depth column, or PostgreSQL's cycle detection, is part
of the query and not an optional extra.

**★ The recursive half must reference the CTE by name, not by a generated table.** That means
`field(name("tree", "id"), Long.class)` and similar — untyped territory in the middle of an
otherwise typed query, and worth a comment.

**★ `UNION` instead of `UNION ALL` in a recursive CTE silently changes the semantics.** `UNION`
deduplicates, which can mask a cycle rather than fixing it, and costs a sort on every iteration.

**★ Naming a CTE the same as a real table shadows it inside the query.** Legal SQL, extremely
confusing, and jOOQ will not warn you because both are just names by that point.

**★ A CTE used once is often just a subquery with a better name — and that is fine.** Readability
is a legitimate reason. Adding four CTEs because they feel tidy, when a single join would do, is
how a query gains a plan nobody can predict.

**★ `DISTINCT ON` is not portable and neither is a query built on it.** If dialect portability is
a stated goal for the project, this clause quietly ends it.

**★ A recursive CTE returning a large tree returns every node.** There is no lazy expansion; the
whole result set exists. On a deep hierarchy that is a memory decision, and a depth bound is often
the answer.

## Interview questions

**★ How do you build a CTE in jOOQ?** `name("x").fields(...).as(select(...))` gives you a
`CommonTableExpression`, and `create.with(cte)` attaches it to the statement.

**★ Why declare the CTE's column names explicitly?** Because otherwise the columns take names from
the inner projection, so an expression column gets whatever the database calls it, and every
`field("...")` lookup afterwards is a guess.

**★ What is the structure of a recursive CTE?** An anchor query, `UNION ALL`, and a recursive query
that joins back to the CTE by its own name. `withRecursive(...)` in jOOQ.

**★ What does a recursive CTE replace in an ORM codebase?** The load-the-children loop —
a hierarchy walked in Java one level at a time, which is an N+1 by another name. JPQL cannot
express the recursive query at all.

**★ What happens if the hierarchy contains a cycle?** The recursion does not terminate. Any tree
users can edit will eventually have one, so a bounded depth column or cycle detection is part of
the query, not a refinement.

**★ Why is `UNION ALL` rather than `UNION` used in a recursive CTE?** Because `UNION` deduplicates
on every iteration — a sort you did not ask for — and it can mask a cycle instead of exposing it.

**★ What does `DISTINCT ON` do?** Keeps the first row per group, where "first" is decided by the
`ORDER BY`. It is the shortest way to write "the latest row per key", and it is PostgreSQL-only.

**★ Why does jOOQ put `distinctOn` after the projection?** Because, in the manual's words, the
keyword order *"had to be inversed as the PostgreSQL syntax cannot be easily reproduced in jOOQ's
internal DSL"*. It is one of the only places where the DSL does not mirror written SQL order.

**★ Do you need `distinct()` as well as `distinctOn(...)`?** No — `distinctOn` implicitly enforces
`DISTINCT`.

**★ `DISTINCT ON` or `ROW_NUMBER()` — how do you choose?** `DISTINCT ON` for exactly one row per
group on PostgreSQL, in one flat query. `ROW_NUMBER()` when you want more than one per group, or
when the query must be portable — at the cost of a derived table.

**★ Is a CTE an optimisation fence in PostgreSQL?** Not since version 12, which allows inlining;
the fence advice predates that and is still widely repeated. Explicit `MATERIALIZED` and `NOT
MATERIALIZED` keywords exist for when the choice matters.

**★ Where does jOOQ's type safety weaken in a CTE-heavy query?** At every reference into the CTE.
Inside, everything is typed; from outside, it is a `field(...)` lookup by name, and in the
recursive half you are referencing the CTE's own name rather than a generated table.

{/* FOOTER */}
