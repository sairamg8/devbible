---
title: "The three costs nobody puts in the adoption proposal are the team's SQL literacy, a licence that is decided by which database you run, and an exit price paid in generated code that depends on jOOQ's internals"
sidebar_label: "09b · The people and the exit"
sidebar_position: 32
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against jOOQ's licensing pages
> ([jooq.org/legal/licensing](https://www.jooq.org/legal/licensing),
> [jooq.org/download](https://www.jooq.org/download/)), the jOOQ 3.21 manual —
> *Different use cases for jOOQ*
> ([getting-started/use-cases](https://www.jooq.org/doc/latest/manual/getting-started/use-cases/))
> and the *jOOQ in 7 steps* tutorial's dependency section
> ([jooq-in-7-steps-step1](https://www.jooq.org/doc/latest/manual/getting-started/tutorials/jooq-in-7-steps/jooq-in-7-steps-step1/)).
> Prices and edition contents were read in **2026-08** and change; treat
> [01b](01b-the-licence-question.md) and jooq.org as the authority.
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**[09](09-the-cost.md) is the build's share of the invoice. This is the rest of it, and it is the
part that decides adoptions: a team that has to be able to read SQL in review, a licence whose price
is set by which database you run rather than which features you use, and an exit that is more
expensive than it looks because the generated code you were told is yours still depends on jOOQ's
internals to compile. Then the closing argument of the topic — what all of that actually buys.**

## Cost 4 — the team needs two literacies, not one

**The first is SQL**, and it is the one everybody names. jOOQ writes no query for you; it checks the
one you wrote. Hibernate's generated SQL is, for the ordinary cases, competent by default. A first
jOOQ query written by someone uncomfortable with joins is not — and nothing in the type system has
an opinion about a cartesian product.

**The second is jOOQ itself**, and it is the one nobody budgets for. Reviewing jOOQ is not reviewing
SQL; it is reviewing a Java expression tree that renders into SQL, and there is a specific list of
things a reviewer has to know before their approval means anything:

- **`noCondition()` is not an identity.** *"If your `noCondition()` is the only predicate left in a
  `WHERE` clause, there will not be any `WHERE` clause"* — [03b](03b-conditions-and-dynamic-sql.md).
  A dynamic search that returns the whole table is one missing default away.
- **`fetchOne` returns `null`, `fetchSingle` throws, `fetchAny` ignores extra rows** —
  [03e](03e-fetching.md). Choosing the wrong one turns a data problem into a `NullPointerException`
  three frames away.
- **Implicit joins choose `INNER` or `LEFT` from column nullability** — [03d](03d-implicit-joins.md).
  A path expression is a join, and which join it is was decided by the schema.
- **`store()` picks `INSERT` or `UPDATE` from the record's origin**, not from its content —
  [05b](05b-updatable-records.md).
- **Optimistic locking is off by default and its default mechanism issues `SELECT … FOR UPDATE`** —
  [05c](05c-optimistic-locking.md). The most counter-intuitive fact in the library.
- **Batch execution with one query and many bind sets has no type safety** — the manual says so
  outright, and it is the one place jOOQ's central promise is explicitly suspended
  ([05 · Writes](05-writes.md)).
- **`MULTISET` is emulated on PostgreSQL through JSONB aggregation** — [04b](04b-nested-collections-with-multiset.md).
  It is one query, and it is not free.
- **A `DEFAULT` dialect renders generic SQL** — [07](07-transactions-and-spring.md). The failure looks
  like a jOOQ bug and is a configuration mistake.

🔴 **That list is the real onboarding curve**, and it does not shorten with SQL experience. A strong
SQL developer meeting jOOQ for the first time will still write `fetchOne` where they meant
`fetchSingle`.

**Two practical consequences:**

- **One person who knows SQL is not a team that knows SQL.** If the reviews all route to one person,
  you have a bus factor, not a capability.
- **The review skill has to be built deliberately** — a house style for dynamic predicates, for
  fetch-method choice, for where SQL-shaped logic lives. Without it the codebase acquires eight
  dialects of jOOQ.

## Cost 5 — the licence is decided by your database, not your budget

The full treatment is [01b](01b-the-licence-question.md). What belongs in a cost discussion:

| Edition | Price (read 2026-08) | What it unlocks |
|---|---|---|
| Open Source | free, Apache-2.0 | ClickHouse, Derby, DuckDB, Firebird, H2, HSQLDB, MariaDB, MySQL, PostgreSQL, SQLite, Trino, YugabyteDB — **latest versions only** |
| Express | €99 / developer / year | Access, Oracle XE, SQL Server Express, plus historic database versions |
| Professional | €399 / developer / year | Oracle, SQL Server, Redshift, Aurora, Azure SQL, CockroachDB, SingleStore |
| Enterprise | €799 / developer / year | BigQuery, Databricks, DB2, Exasol, HANA, Informix, Snowflake, Spanner, Sybase, Teradata, Vertica |

**Four consequences that are easy to miss:**

1. **The split is by database, not by feature.** Window functions, `MULTISET` and the whole DSL are
   in the free edition. What you buy is a dialect.
2. 🔴 **The free edition has the *highest* Java floor** — *"Java 21 and newer"*, against Java 11 for
   Express and Professional and Java 8 for Enterprise. A project on Java 17 cannot use the free
   edition. This is backwards from everyone's intuition and it is checked at adoption time.
3. **"Latest DB versions only."** The free edition tracks current database releases; historic
   version support is a paid feature. A fleet still running an old major version is a licensing
   question, not just an upgrade question.
4. 🔴 **Only the Open Source Edition is on Maven Central.** The tutorial says it plainly —
   *"Note that only the jOOQ Open Source Edition is available from Maven Central"* — so a commercial
   edition means installing artefacts into an internal repository and keeping them there.

**And the build files encode the licence.** The groupId differs by edition *and* by Java baseline:
`org.jooq` for open source, `org.jooq.pro` for Java 17+, `org.jooq.pro-java-11`, `org.jooq.pro-java-8`,
and `org.jooq.trial` variants for evaluation. Changing edition or JDK baseline is a change to every
`pom.xml` and every generator configuration — and a trial groupId that reaches production is a
licensing incident rather than a build error.

The licence unit is *"One for every developer workstation which is used to write jOOQ code. Server
licenses are included."* — so the cost scales with the size of the team touching the data layer, not
with the size of the deployment.

## Cost 6 — what leaving costs

**The good news first**, from jOOQ's own licensing pages: the generator's output *"is not jOOQ API,
but your own code"*, and you may license it however you like.

🔴 **Read the sentence that follows, though: it *"makes use of jOOQ's internal APIs"*.** So the
generated tree is yours in the copyright sense and not portable in the practical one. Remove jOOQ
from the classpath and none of it compiles. "The generated code is yours" is a licensing statement,
not an exit strategy.

**What an exit actually involves:**

- **Every query is a Java expression tree, not text.** You cannot grep your SQL out of the codebase,
  because it does not exist until it renders.
- **You can render it.** `Query.getSQL()` and `getBindValues()` — the same pair the JPA bridge uses
  in [08e](08e-repairing-the-stale-context.md) — will hand you the statement and its parameters, so
  a mechanical extraction is possible. What you get back is a string you now own, with none of the
  compile-time checking that was the point.
- **Reads port more easily than writes.** A `SELECT` becomes a `JdbcClient` query and a `RowMapper`.
  `UpdatableRecord`, `store()`, the optimistic-locking settings and `MULTISET` mapping have no
  direct equivalent anywhere.
- **The build step is the easy part to remove** and the type safety is the hard part to replace,
  which is the same asymmetry in reverse.

### The lower-commitment version

jOOQ's own use-case page lists a variant that changes this arithmetic completely:

> *"Using jOOQ without the source code generator to build the basis of a framework for dynamic SQL
> execution"*

and

> *"Using jOOQ for SQL building and JDBC for SQL execution"*

**As a SQL builder without code generation you pay none of [09](09-the-cost.md)** — no build step,
no generated tree, no regeneration discipline — and you get composable, injection-safe, dialect-aware
SQL construction. What you give up is the entire compile-time schema check, which is the argument
[01 · What jOOQ is](01-what-jooq-is.md) is built on.

⚠️ **That is a real option and a poor default.** If the schema check is not why you are here, the
honest comparison is against `JdbcClient` and a text block
([Topic 05](../05-sql-first-access/README.md)), not against JPA.

## What the bill buys

**Worth paying when:**

- A *family* of queries — reporting, analytics, dynamic search — that JPQL cannot express.
- PostgreSQL features you actually use: `jsonb`, arrays, `DISTINCT ON`, window frames, CTEs.
- A schema that changes often, where a compile error beats a runtime one.
- Migrations already own the schema, and the team already reads SQL.
- An open-source database, so the licence is free and the JDK is 21 or newer anyway.

**Not worth paying when:**

- One awkward query. Write a native query.
- A CRUD application over a stable schema. That is JPA's case and Spring Data makes it small.
- A commercial database and no budget line, or a JDK below 21 and no budget line — the licence
  decides before the technology does.
- The team's SQL depth is one person.
- Nobody will own the regeneration discipline. A stale tree is worse than no tree
  ([09](09-the-cost.md)).

## The closing argument

**jOOQ is not a better ORM and it is not a nicer `JdbcTemplate`. It is a bet that your database
schema is the most stable, most authoritative thing in your system, and that turning it into a Java
API you compile against will catch more mistakes than it costs.** On a PostgreSQL service whose hard
problems are queries, whose migrations already own the schema, and whose team can read a window
function, that bet pays — and this topic has spent thirty-two chunks on the mechanism because the
mechanism is where the payment lands.

On a CRUD service over a stable schema, with a team that thinks in objects, the same bet costs a
build step, a generated tree, a regeneration discipline and two literacies, and returns very little.
**Both of those are correct engineering decisions, and the honest version of this topic is that the
question is never "is jOOQ good" — it is "is the hard part of this system a question you ask the
database, or a graph of objects you change".**

## Gotchas

**★ "Our team knows SQL" usually means one person does.** Check who would review a 40-line jOOQ
query at 2am. If the answer is a single name, the capability is a bus factor.

**★ The jOOQ-specific gotcha list is not shortened by SQL experience.** `noCondition` semantics,
`fetchOne` versus `fetchSingle`, implicit-join nullability rules and `store()`'s origin rule are
library knowledge, and a strong SQL developer meets every one of them for the first time.

**★ The free edition's Java floor is higher than the paid editions'.** Open Source requires
*"Java 21 and newer"*; Enterprise runs on Java 8. Every intuition about free-versus-paid is backwards
here, and it is the fastest way to discover you cannot adopt jOOQ at all.

**★ "Latest DB versions only" is a licence term, not a recommendation.** Historic database version
support is a paid feature. An estate on an older major version has a cost the free edition does not
cover.

**★ Only the open-source edition is on Maven Central.** A commercial edition needs artefacts
installed into an internal repository, which is an infrastructure commitment attached to a licence
purchase.

**★ The groupId encodes your edition and your JDK baseline.** `org.jooq`, `org.jooq.pro`,
`org.jooq.pro-java-11`, `org.jooq.pro-java-8`, `org.jooq.trial…`. A trial groupId that survives into
production is a licensing problem, and nothing in the build will tell you.

**★ Licences are per developer workstation, so the cost scales with the team.** *"Server licenses are
included"*, so a large deployment is cheap and a large team is not.

**★ "The generated code is yours" does not mean it is portable.** jooq.org says the output *"is not
jOOQ API, but your own code"* and, in the same breath, that it *"makes use of jOOQ's internal
APIs"*. Without jOOQ on the classpath it does not compile.

**★ Your SQL does not exist as text until it renders.** An exit, an audit, or a DBA asking "what
query is this" all go through `getSQL()`. Plan for that rather than discovering it during an
incident.

**★ Adopting jOOQ as a SQL builder without code generation is a different decision with a different
cost.** It removes the whole of [09](09-the-cost.md) and removes the compile-time check with it —
at which point the honest comparison is with `JdbcClient`, not with JPA.

**★ The decision is usually made by the database and the JDK before anyone opens the manual.**
Commercial database plus no budget, or JDK below 21 plus no budget, and the technical comparison
never happens. Establish those two facts first.

**★ Prices and edition contents change.** Everything in the table above was read in 2026-08. Re-read
jooq.org before you put a number in a proposal.

## Interview questions

**★ What does "the team must know SQL" actually mean in practice?** That every reviewer can judge a
join, a window frame and a predicate on sight, and that this is more than one person. jOOQ writes no
query for you — it checks the one you wrote — and Hibernate's default SQL is competent in a way a
first hand-written query may not be.

**★ Is SQL knowledge sufficient to review jOOQ?** No. There is a second literacy: `noCondition` is
not an identity, `fetchOne` returns `null` where `fetchSingle` throws, implicit joins pick `INNER`
or `LEFT` from nullability, `store()` decides insert-versus-update from the record's origin,
optimistic locking is off by default and its default mechanism takes a pessimistic lock, and batch
binding has no type safety at all.

**★ How is jOOQ licensed?** By database, not by feature. The Open Source Edition is Apache-2.0 and
covers PostgreSQL, MySQL, MariaDB, H2, SQLite and other open-source engines at their latest
versions. Express, Professional and Enterprise add commercial databases and historic version support
at a per-developer-workstation annual price.

**★ Which edition do you need for PostgreSQL 18 on JDK 25?** The free Open Source Edition. It covers
PostgreSQL and its Java floor is *"Java 21 and newer"*, which JDK 25 clears.

**★ What is the most counter-intuitive fact about jOOQ's editions?** The free edition has the
*highest* Java requirement. Open Source needs Java 21+, Express and Professional run on Java 11+, and
Enterprise goes back to Java 8 — the paid editions are what you buy backwards compatibility with.

**★ What changes in your build when you move to a commercial edition?** The groupId, everywhere —
`org.jooq` becomes `org.jooq.pro` or a Java-baseline variant — and the artefacts stop coming from
Maven Central, since *"only the jOOQ Open Source Edition is available from Maven Central"*. You need
an internal repository holding them.

**★ You own the generated code. Can you drop jOOQ and keep it?** No. jOOQ states that the output
*"is not jOOQ API, but your own code"* — a copyright statement — and also that it *"makes use of
jOOQ's internal APIs"*. Remove the dependency and the tree does not compile.

**★ How would you migrate off jOOQ?** Render each query with `getSQL()` and `getBindValues()`, port
it to `JdbcClient` with a `RowMapper`, and hand-write the parts with no equivalent —
`UpdatableRecord`, `store()`, optimistic-locking settings, `MULTISET` mapping. The mechanical part
is the SQL; the expensive part is that everything you get back is an unchecked string.

**★ What is "jOOQ as a SQL builder without code generation", and when is it right?** Using the DSL
for composable, injection-safe, dialect-aware SQL construction with no generator and no build step —
jOOQ's own documented use case. It is right when you want the query-building model and cannot or
will not take on the code generation, and it means comparing jOOQ with `JdbcClient` rather than with
JPA, because the compile-time schema check is gone.

**★ Give me the two facts that decide adoption before any technical comparison.** Which database you
run — that sets the licence — and which JDK you are on, because the free edition requires Java 21 or
newer. If either produces a bill nobody will pay, the technical merits never come up.

**★ Summarise when jOOQ is the right choice.** When the hard part of the system is questions you ask
the database rather than object graphs you mutate: a family of queries JPQL cannot express,
PostgreSQL features you actually use, a schema that changes often, migrations that already own it,
and a team that reads SQL. On an open-source database that combination costs nothing but the build
step and the discipline.

**★ And when it is the wrong one?** A CRUD application over a stable schema, one awkward query that a
native query would solve, a commercial database with no budget line, a JDK below 21, a team with one
SQL specialist, or an organisation that will not maintain the regeneration discipline — because a
stale generated tree is worse than never having had one.

{/* FOOTER */}
