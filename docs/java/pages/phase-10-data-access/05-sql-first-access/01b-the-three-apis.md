---
title: "Spring keeps the ceremony and hands you back the two decisions — and since 6.1 there is one fluent API for both parameter styles"
sidebar_label: "1b · The three APIs"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access →
> Data Access with JDBC*
> ([docs.spring.io/spring-framework/reference/data-access/jdbc.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc.html))
> and *JDBC Core Classes*
> ([.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)),
> and the `JdbcClient` javadoc
> ([.../simple/JdbcClient.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/jdbc/core/simple/JdbcClient.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**Spring's JDBC support does not hide your SQL, translate it, or generate it — it
takes the resource handling, the loop and the exception plumbing, and leaves you the
statement and the shape of a row. There are three entry points to it, they are layers
rather than rivals, and in a Spring 7 service you should be writing the newest one.**

## What SQL-first is not

**It is not raw JDBC.** Everything in this topic sits on top of the JDBC covered
in **[Topic 01 · JDBC](../01-jdbc/README.md)**. `PreparedStatement`, bind
parameters, the cursor model, `SQLException` — all of that is still underneath;
you simply stop typing it. If you have not read that topic, read it first: this
one assumes it, and the most confusing behaviours here are JDBC behaviours wearing
a Spring costume.

**It is not "no mapping".** You still convert a `ResultSet` row into a Java object.
The difference is *where* the mapping is declared: per query, next to the query,
instead of once per table.

**It is not an anti-ORM position.** The most common real architecture uses both in
the same service, often in the same transaction — entities for the write model
where identity and cascade earn their keep, SQL for reads that are not entity
shaped. **[Chunk 11](11-mixing-both.md)** is entirely about doing that safely,
because there is exactly one trap in it and it is a sharp one.

## What Spring actually contributes

Spring's own documentation states the division of labour as a table. Reproduced
from the *Data Access with JDBC* page:

| Action | Spring | You |
|---|---|---|
| Define connection parameters | | ✔ |
| Open the connection | ✔ | |
| Specify the SQL statement | | ✔ |
| Declare parameters and provide parameter values | | ✔ |
| Prepare and run the statement | ✔ | |
| Set up the loop to iterate through the results (if any) | ✔ | |
| Do the work for each iteration | | ✔ |
| Process any exception | ✔ | |
| Handle transactions | ✔ | |
| Close the connection, the statement, and the result set | ✔ | |

Read that column of ticks carefully, because it is the whole product. **You keep
the two things that are decisions — the SQL and the shape of a row. Spring takes
the ten things that are ceremony.** Nothing about the SQL is hidden, abstracted,
generated or translated. It is your string, sent as written.

## Three APIs, one idea

Spring has accumulated three entry points for this, and they are layers rather
than rivals:

| API | Since | Placeholders | What it is |
|---|---|---|---|
| `JdbcTemplate` | Spring 1.0 | `?` positional | The original. Everything else delegates to it |
| `NamedParameterJdbcTemplate` | Spring 2.0 | `:name` | Wraps a `JdbcTemplate`, rewrites `:name` into `?` |
| `JdbcClient` | Spring 6.1 | both | A fluent facade over the other two |

The `JdbcClient` javadoc is explicit that it is a facade, not a replacement:

> "A fluent `JdbcClient` with common JDBC query and update operations, supporting
> JDBC-style positional as well as Spring-style named parameters with a convenient
> unified facade for JDBC `PreparedStatement` execution."

and that it delegates to `JdbcTemplate` and `NamedParameterJdbcTemplate`, pointing
you back at those for batch inserts and stored procedure calls.

🔴 **In a new Spring Framework 7 / Boot 4.1 service, write `JdbcClient`.** It is
the current API, it covers both parameter styles, and it makes the empty-result
case explicit instead of exceptional. `JdbcTemplate` is not deprecated and never
will be — it is what `JdbcClient` runs on — but it is the layer you reach *down*
to, not the one you start from. [Chunk 2](02-jdbctemplate.md) covers it anyway,
in detail, because you will read a lot of it and because two of `JdbcClient`'s
sharper edges are only explicable in terms of it.

## Gotchas

**Choosing SQL-first for a query does not mean choosing it for the application.**
The unit of the decision is one repository method, not the service, not the
module, and certainly not the project. A codebase that is 90% Spring Data JPA and
10% `JdbcClient` for its reports is not inconsistent; it is correct.

**"I want the exact SQL" is a claim you have to keep.** The reason to hand-write a
query is that its plan matters to you. That is only true if somebody looks at the
plan when the query or the data changes. A hand-written query nobody has reviewed
in two years has all the maintenance cost of SQL-first and none of the benefit.

## Interview questions

**★ Is SQL-first access an alternative to JPA or a complement to it?**
A complement, and in most real services both are present. They optimise different
things. JPA gives you identity, dirty checking, cascading and lazy traversal,
which are exactly what a write model wants: load an aggregate, change it, let the
framework work out the statements. SQL-first gives you an exact statement and a
per-query result shape, which is what a read model wants. The natural split is
writes and domain behaviour through entities, reports and list screens through
SQL. The decision is per repository method. The one thing you must know before
mixing them in a single transaction is the flush-ordering trap, which is that a
`JdbcTemplate` query issued inside a JPA transaction does not trigger the
persistence context to flush.

**★ If `JdbcClient` just delegates to `JdbcTemplate`, why does it exist?**
Because the two older APIs split along a line that was never a real distinction —
positional parameters in one class, named parameters in another — and application
code had to pick a class before it had picked a query style. `JdbcClient` unifies
them behind one fluent chain, and its javadoc says so directly: a "unified facade"
supporting "JDBC-style positional as well as Spring-style named parameters". The
second reason is the result specification. `JdbcTemplate` encodes "how many rows do
I expect" in the *method name* you chose, so `queryForObject` throws when there are
none. `JdbcClient` moves that decision to the end of the chain, where `.single()`,
`.optional()` and `.list()` are three visibly different intentions over the same
query.

**★ Does using `JdbcTemplate` mean giving up transactions?**
No, and this is the most common misconception about SQL-first access.
`JdbcTemplate` obtains its connection through `DataSourceUtils`, which is aware of
a connection already bound to the current thread by Spring's transaction
management. So a `JdbcTemplate` call inside a `@Transactional` method runs on the
transaction's connection and participates fully — commit and rollback cover it.
[Chunk 9](09-transactions-and-the-connection.md) works through the mechanism, and
**[Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md)**
owns the transaction semantics themselves.

---

← Prev: [1 · Why SQL-first exists](01-why-sql-first-exists.md) · Index: [05 · SQL-first access](README.md) · Next → [2 · `JdbcTemplate`](02-jdbctemplate.md)
