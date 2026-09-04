---
title: "H2 in PostgreSQL mode supports `on conflict do nothing` and not `do update` — which is why testing hand-written PostgreSQL SQL against it proves nothing"
sidebar_label: "12f · The real database"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the H2 2.x *Features → Compatibility Modes* page
> ([h2database.com/html/features.html](https://www.h2database.com/html/features.html)),
> the PostgreSQL 18 manual — *`INSERT … ON CONFLICT`* and *PostgreSQL Error Codes*
> ([sql-insert](https://www.postgresql.org/docs/18/sql-insert.html),
> [errcodes-appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html))
> and the Spring Framework 7.0 reference *Data Access → JDBC Core Classes*
> ([docs.spring.io/.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, PostgreSQL 18, H2 2.x.

**The argument for SQL-first, in [chunk 10](10-when-sql-first-beats-an-entity.md), was
seven queries that use PostgreSQL and not SQL-in-general: `on conflict do update`,
`for update skip locked`, `returning`, `with recursive`, `websearch_to_tsquery`.
Running those against an embedded database is not a weaker test — for most of them it
is not a test at all, because the statement either fails to parse or means something
else. If the queries were worth hand-writing, the database under the test has to be
the one you deploy.**

## What "PostgreSQL mode" actually is

H2 supports eleven compatibility modes — REGULAR, STRICT, LEGACY, DB2, Derby, HSQLDB,
MS SQL Server, MariaDB, MySQL, Oracle and PostgreSQL — and the PostgreSQL one is a
list of behavioural adjustments to H2's own engine, not an implementation of
PostgreSQL. The documented list is short enough to read in full, and these are the
entries that touch anything in this topic:

- "`LIMIT` / `OFFSET` clauses are supported."
- "Legacy `SERIAL` and `BIGSERIAL` data types are supported."
- "**`ON CONFLICT DO NOTHING` is supported in `INSERT` statements.**"
- "The system columns `ctid` and `oid` are supported."
- "`GROUP BY` clause can contain 1-based positions of expressions from the `SELECT`
  list."
- "`UPDATE` with `FROM` is partially supported."

🔴 **`ON CONFLICT DO NOTHING` is on the list and `ON CONFLICT DO UPDATE` is not.** The
upsert from [chunk 10](10-when-sql-first-beats-an-entity.md) — the one whose entire
point is `do update set value = daily_metric.value + excluded.value returning value` —
is the single most valuable query in that chunk and the one an H2 test cannot express.

Nothing in the list mentions `returning`, `for update skip locked`, `jsonb`, array
types, `date_trunc`, `distinct on`, `generate_series`, full-text search or `::` casts.
That is not proof each one is absent, and I have not verified them individually — the
point is the opposite one. **The compatibility list is an enumeration of adjustments,
so anything not on it is H2's own behaviour**, and a test whose subject is
PostgreSQL-specific SQL cannot be run on an engine whose PostgreSQL support is a
documented list of exceptions.

## The things a different engine changes that are not syntax

Even where a statement parses, three layers below it differ, and each one is something
an earlier chunk of this topic told you to rely on:

- **SQLSTATE values and the exception you catch.** `23505` becoming
  `DuplicateKeyException`, and `55P03`, `25P02` and `0A000` arriving as
  `UncategorizedSQLException`, are PostgreSQL class codes
  ([chunk 6c](06c-what-to-catch-on-postgresql.md)). A different engine has a different
  mapping, so a test that asserts on the translated exception is asserting about the
  engine under the test.
- **Driver behaviour.** `Statement.RETURN_GENERATED_KEYS` becoming `RETURNING *` — and
  therefore `KeyHolder.getKey()` throwing — is pgJDBC, not SQL
  ([chunk 8](08-writes-and-generated-keys.md)). So is `getErrorCode()` always being
  zero. Neither is reproducible on another driver, in either direction.
- **The planner.** Any query written because a particular index would be used is
  untested on an engine with a different planner and different indexes.

**[The fixture and the real database](../04-spring-transactional/20j-the-fixture-and-the-real-database.md)**
makes the same argument from the transactional side — locking, isolation, deferred
constraints and timeouts. Between the two lists there is very little of a real
repository left that an in-memory database can honestly test.

Which leaves the practical question: how do you put a real PostgreSQL under a test
without a database on every developer's machine and a fixture nobody maintains? That
is [chunk 12g](12g-testcontainers-and-serviceconnection.md), and on Boot 4.1 the
answer is one annotation with no arguments.

## Gotchas

**"It is PostgreSQL mode, so it behaves like PostgreSQL" reads the documentation
backwards.** The mode is an enumeration of *adjustments* — the page lists what changes
relative to H2's regular behaviour. Everything not on that list is unchanged H2. So
the right question is never "does H2 support this?", it is "is this on the list?", and
for most of what makes a hand-written PostgreSQL query worth writing, it is not.

**A green `on conflict do nothing` test creates confidence about `do update` that is
not warranted.** The two clauses look like variants of one feature and only one of
them is supported. The upsert-with-accumulate — `do update set value =
daily_metric.value + excluded.value returning value` — is where the concurrency
guarantee lives ([chunk 10](10-when-sql-first-beats-an-entity.md)), and it is the half
that cannot run.

**`ResultSetMetaData` differs in PostgreSQL mode, and reflective mappers read
metadata.** The documented behaviour: "For aliased columns,
`ResultSetMetaData.getColumnName()` returns the alias name and `getTableName()` returns
`null`." Every automatic mapper matches on column labels
([chunk 3d](03d-automatic-mappers.md)), so a mapping that works under one engine's
metadata rules is not evidence about the other's — particularly for a query full of
`as` aliases, which is most reporting SQL.

**`NUMERIC` and `DECIMAL` without parameters are treated as `DECFLOAT` in H2's
PostgreSQL mode.** Money columns declared without precision therefore have different
arithmetic and different scale from PostgreSQL's `numeric`, and a `BigDecimal`
assertion is sensitive to scale ([chunk 12e](12e-wiring-the-test.md)). A rounding test
that passes on the embedded engine says nothing about the real one.

**`EXTRACT` with `DOW` returns 0–6 with Sunday as 0 in this mode**, which happens to
match PostgreSQL — and is exactly the kind of coincidence that makes the whole
approach feel safer than it is. One matching behaviour on a list of documented
adjustments is not a general guarantee, and a report grouped by day of week is
engine-dependent either way.

**A misspelt column name is caught by *any* engine, which is why in-memory tests feel
useful.** They do catch the cheapest class of error. What they cannot catch is the
class the SQL was written to exploit — and the cheap class is also the one a connected
IDE catches for free ([chunk 12c](12c-where-the-sql-lives.md)), so it is not worth much
in a suite.

**An assertion on the translated exception is an assertion about the engine.**
`assertThatThrownBy(...).isInstanceOf(DuplicateKeyException.class)` passes or fails
based on the SQLSTATE the engine raised and the translator's mapping for it
([chunk 6c](06c-what-to-catch-on-postgresql.md)). On the wrong engine it is testing a
mapping you do not deploy — and the failure mode is a *green* test, since most engines
do use `23505` for a unique violation while differing on everything around it.

**Nothing about a plan survives the change of engine.** An index-only scan, a partial
index, a query rewritten so the planner can use a `btree` on `(customer_id,
placed_at)` — none of that is being exercised, so a test suite on an embedded database
gives no signal at all about the reason the query was hand-written in the first place.

**A passing test on the wrong engine is worse than no test.** It occupies the slot in
everyone's mind where "this query is covered" lives. Where a real engine is not
available for some queries, it is better to say so — leave those queries uncovered and
visible — than to cover them against something else.

**H2's `DATABASE_TO_LOWER` cannot be changed after the database is created**, per the
documentation: "Do not change value of `DATABASE_TO_LOWER` after creation of
database." In a suite where the URL is assembled from properties, an inconsistent
value between two test configurations produces identifier-case failures that look like
typos in the SQL.

## Interview questions

**★ Why not test a PostgreSQL repository against H2?**
Because the SQL is the thing under test and H2 is a different implementation of it. H2
offers a PostgreSQL compatibility mode, but that mode is a documented list of
adjustments to H2's own engine — it supports `ON CONFLICT DO NOTHING`, and `DO UPDATE`
is not on the list, so the upsert that motivated writing SQL by hand cannot be tested
there at all. The same applies to `returning`, `skip locked`, `jsonb` and full-text
search. Below the syntax there are the SQLSTATE codes the exception translation keys
on, the driver behaviours around generated keys, and the planner. If the queries were
worth hand-writing, they were worth hand-writing *for PostgreSQL*, and a test on
another engine is testing a different program.

**★ What exactly is a compatibility mode?**
A set of behavioural adjustments to the host engine, documented as a list. H2 has
eleven of them — DB2, Derby, HSQLDB, MS SQL Server, MariaDB, MySQL, Oracle, PostgreSQL
and three of its own — and the PostgreSQL one changes things like rounding on
float-to-integer conversion, `LOG(x)` being base 10, `LIMIT`/`OFFSET` acceptance,
`SERIAL` support and `ON CONFLICT DO NOTHING`. It is not an emulation and does not
claim to be. The practical consequence is that you cannot reason about it by asking
"is this standard-ish SQL?" — you have to check the list, and the list is short.

**★ Is there any remaining role for an embedded database?**
A narrow one. It is fine for code where the SQL is entirely generic — `insert`,
`select … where`, `update … where` on plain columns — and where the test is really
about wiring rather than about the query. But that is exactly the code you would not
have written by hand in the first place; the whole SQL-first argument is about queries
an ORM cannot express. So in a SQL-first codebase the embedded database ends up
testing the least interesting half and giving false confidence about the other half,
which is why I would rather have five container tests than fifty in-memory ones.

**★ How do you decide which tests need the real engine?**
I would put the line at the SQL, not at the layer. Any query using a PostgreSQL
clause — `on conflict`, `returning`, `skip locked`, `distinct on`, a `jsonb` operator,
full-text search, a recursive CTE — needs the real engine, because the clause is the
subject. So does anything asserting on a translated exception, anything about
generated keys, and anything whose point is that a particular index gets used. What is
left is usually thin enough that the honest answer is to run the whole repository
suite against a container and stop maintaining two configurations.

**★ Someone says the in-memory suite catches real bugs. Are they wrong?**
No, but the bugs it catches are the cheap ones — a misspelt column, a missing table, a
mapper bound to the wrong name. Those are worth catching, and a connected IDE catches
most of them at the moment you type them if the SQL lives in a `.sql` file. What
worries me is the second-order effect: a green suite makes "this query is covered"
true in everyone's head, and the queries it cannot exercise are precisely the ones with
the concurrency guarantees. I would rather leave a query visibly uncovered than cover
it against an engine we do not deploy.

---

← Prev: [12e · Wiring the test](12e-wiring-the-test.md) · Index: [05 · SQL-first access](README.md) · Next → [12g · Testcontainers](12g-testcontainers-and-serviceconnection.md)
