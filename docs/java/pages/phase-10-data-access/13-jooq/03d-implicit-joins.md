---
title: "Implicit path joins let you dereference a foreign key like a Java property, and unlike an ORM's lazy proxy they add a join to the one query rather than issuing another"
sidebar_label: "03d · Implicit joins"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *Implicit JOIN*
> ([select-statement/implicit-join](https://www.jooq.org/doc/latest/manual/sql-building/sql-statements/select-statement/implicit-join/))
> and *Joined tables*
> ([table-expressions/joined-tables](https://www.jooq.org/doc/latest/manual/sql-building/table-expressions/joined-tables/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**`BOOK.author().FIRST_NAME` looks exactly like the `book.getAuthor().getFirstName()` an ORM would
give you, and it is the opposite thing. There is no proxy, no session, no second query and no
`LazyInitializationException` waiting for you outside a transaction. jOOQ notices the path while
rendering, adds the join to the statement it is about to send, and sends one statement. This is
jOOQ's answer to the ergonomics people leave SQL for, and it gives up none of the SQL.**

## The syntax

Generated tables carry a **navigation method** per foreign key. The manual states the naming rule
plainly: *"The navigation method names are: The parent table name (or child table name,
respectively), if there is only one foreign key between child table and parent table."*

```java
create.select(
          BOOK.TITLE,
          BOOK.author().FIRST_NAME,
          BOOK.author().LAST_NAME,
          BOOK.language().CD)
      .from(BOOK)
      .where(BOOK.author().LAST_NAME.eq("Coelho"))
      .fetch();
```

`BOOK` is the only table in the `FROM` clause. The two joins to `author` and `language` are
produced by jOOQ because the paths were used — in the projection *and* in the `WHERE` clause,
which is the part that surprises people the first time.

**Paths chain.** `ORDER.customer().address().COUNTRY` is three tables in a query whose `from()`
names one.

## Which join type you get, and why that is not an implementation detail

The manual is specific, and the rule is driven entirely by **nullability**:

| Path | Join generated |
|---|---|
| to-one segment, **non-nullable** parent | `INNER JOIN` |
| to-one segment, **nullable** parent | `LEFT JOIN` |
| implicit **to-many** path not declared in `FROM` | `LEFT JOIN` |

These defaults are **overridable through `Settings`**.

🔴 **The consequence is that your schema's `NOT NULL` constraints change your query's row count.**
A nullable `book.author_id` yields a left join, so books with no author survive with nulls in the
author columns. Make the column `NOT NULL` and the same Java now renders an inner join. That is
the correct behaviour — an inner join is only safe when the parent must exist — but it means a
migration adding `NOT NULL` silently changes what several queries return, and no Java changed.

⚠️ **Contrast that with JPA**, where the fetch-type and the join type are decided by mapping
annotations rather than by the constraint — see
**[Topic 07 · Relationships and fetch types](../07-relationships-fetch/README.md)**. jOOQ takes
its answer from the database because the database is the thing that knows.

## To-one since 3.11, to-many since 3.19

*"From jOOQ 3.11 onwards, this syntax is supported for to-one relationship navigation, and from
jOOQ 3.19 also for to-many relationship navigation."*

That matters when reading anything written about jOOQ before 3.19 — a great deal of the "implicit
joins are only for parents" advice online is simply out of date, and on 3.21 the child direction
works too.

⚠️ **To-many implicit paths generate a `LEFT JOIN`, which means fan-out.** Navigating from a
parent to a collection multiplies parent rows exactly as an explicit join would. Implicit syntax
does not make a to-many join safe; it makes it shorter. The projection-level answer is `MULTISET`
— **[04b · Nested collections with MULTISET](04b-nested-collections-with-multiset.md)**.

## Why this is not lazy loading, and the distinction is the whole point

The syntax is deliberately ORM-shaped, so it is worth being precise about the differences:

- **One query, always.** The path is resolved during SQL rendering. There is no second statement,
  so there is no N+1 to accumulate — the failure mode
  **[Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md)** is entirely about.
- **No session, so no detachment.** The result is a plain record. Navigating it after the
  transaction ends is meaningless because there is nothing left to navigate; the columns are
  already in your hands. The exception [Topic 10 · Lazy-loading pitfalls](../10-lazy-loading/README.md)
  exists to explain has no counterpart here.
- **The cost is visible in the SQL.** An implicit join appears in the rendered statement, in
  `EXPLAIN`, and in the query log. A lazy proxy's cost appears as a separate statement somewhere
  else entirely, which is why it hides.
- **You cannot navigate what you did not select.** There is no mechanism to fetch more later. That
  is a restriction, and it is also the reason the performance of a jOOQ query is a property of the
  query rather than of what the caller does with the result afterwards.

## Two documented limitations

1. **An implicit path cannot itself produce a join in `FROM`.** The manual: *"it is not possible
   to write things like `FROM book IMPLICIT JOIN book.author`"*. Paths are used where columns are
   used; they are not a `FROM`-clause construct.
2. **`VisitListener` SPI implementations cannot observe implicitly joined tables**, because those
   tables are added after SQL generation has completed. If you have tooling built on
   `VisitListener` — an auditing or multi-tenancy interceptor, say — it will not see them, and
   that is a correctness problem for the interceptor, not a cosmetic one.

## Gotchas

**★ A path in `where(...)` adds a join even though it produces no output column.** People expect
paths in the projection to join and paths in the predicate to be free. Both join. Filtering on
`BOOK.author().LAST_NAME` joins `author` whether or not you select a single column from it.

**★ Nullability decides the join type, so a schema migration can change your result set.** Adding
`NOT NULL` to a foreign key turns left joins into inner joins across every query using that path.
Nothing in Java changes and nothing in review shows it.

**★ The navigation method name depends on there being exactly one foreign key between the two
tables.** With two — `billing_address_id` and `shipping_address_id` — the simple parent-table name
is not available, and code written against a single-key schema breaks when the second key is
added.

**★ To-many paths fan out silently.** They read like a property access and behave like a join. A
count over a query using a to-many path counts join rows, not parent rows, and the number looks
plausible.

**★ Repeating the same path does not repeat the join, but a *different* alias of it does.** jOOQ
deduplicates identical paths. Two distinct paths that happen to reach the same table are two
joins, which is correct and occasionally surprising in the rendered SQL.

**★ `VisitListener`-based tooling is blind to these joins.** Row-level security, tenant filters or
audit interceptors implemented on that SPI will not see the implicitly joined tables. If your
security model depends on inspecting the query, implicit joins are a hole in it.

**★ The rendered SQL is longer than the Java, which makes review asymmetric.** A one-line change
adding a path can add two joins. The diff looks trivial; the plan does not. This is the honest
downside of the ergonomics.

**★ Implicit joins do not replace explicit ones for anything conditional.** You cannot express
"join only when this parameter is present" through a path — the path is either used or not, and
the decision is made by which columns you referenced. Dynamic joins need explicit joins.

**★ A path used only inside a `MULTISET` subquery joins in the subquery, not the outer one.** That
is right, and it means the same path text in two places can render two very different plans.

**★ `Settings` can override the join types, and doing so globally is a large hammer.** Forcing all
paths to `LEFT JOIN` makes non-nullable paths produce a plan the optimiser handles worse, for
uniformity nobody asked for.

**★ Advice written before jOOQ 3.19 says to-many paths do not exist.** They do, since 3.19. A lot
of accumulated Stack Overflow wisdom on this feature predates that release.

**★ The path syntax makes jOOQ code look like JPA code to a reviewer skimming it.** That is fine
until someone "optimises" it by adding a fetch strategy that does not exist here, or worries about
a session that is not involved. Worth a comment the first time it appears in a codebase.

## Interview questions

**★ What is an implicit join in jOOQ?** Dereferencing a foreign key through a generated navigation
method — `BOOK.author().FIRST_NAME` — which causes jOOQ to add the corresponding join to the
statement while rendering it. The `FROM` clause names only the starting table.

**★ How are the navigation methods named?** After the parent table (or child table, for the
to-many direction), when there is exactly one foreign key between the two tables. More than one
key and you need a disambiguated form.

**★ Which join type does an implicit path produce?** Inner join for a to-one segment with a
non-nullable parent, left join for a to-one segment with a nullable parent, and left join for a
to-many path not declared in the `FROM` clause. All overridable through `Settings`.

**★ Why does nullability decide the join type?** Because an inner join is only safe when the parent
row must exist. jOOQ takes the answer from the schema's constraint rather than from an annotation,
which is also why a `NOT NULL` migration can change what an untouched query returns.

**★ How is this different from an ORM's lazy loading?** It is one query, resolved at render time,
with no session, no proxy and no possibility of a second statement. There is no N+1 and no
detached-entity exception; equally, there is no fetching more later.

**★ Does using a path in the `WHERE` clause add a join?** Yes. Any use of the path adds the join,
whether or not a column from the joined table appears in the projection.

**★ Since when do to-many paths work?** jOOQ 3.19. To-one navigation has been available since
3.11. Material written between those releases says to-many is unsupported, and on 3.21 that is
wrong.

**★ What is the danger of a to-many implicit path?** It fans out. The syntax reads like a property
access and behaves like a join, so parent rows are multiplied, and any aggregate over the result
counts join rows.

**★ Can you write `FROM book IMPLICIT JOIN book.author`?** No — the manual states that explicitly.
Paths are used where columns are used; they are not a `FROM`-clause construct.

**★ Why can a `VisitListener` not see implicitly joined tables?** Because they are added after SQL
generation completes. Any tooling built on that SPI — multi-tenancy filters, audit interceptors —
will not observe them, which can be a real security gap rather than a missing log line.

**★ Your query started returning fewer rows after a migration and no Java changed. What would you
check first?** Whether a foreign key used by an implicit path became `NOT NULL`, turning a left
join into an inner join and dropping the rows with no parent.

**★ When must you fall back to an explicit join?** Whenever the join itself is conditional, when
you need a join type the nullability rule does not give you for that path, when two foreign keys
make the path ambiguous, or when you need an alias — a self-join cannot be expressed as a path.

{/* FOOTER */}
