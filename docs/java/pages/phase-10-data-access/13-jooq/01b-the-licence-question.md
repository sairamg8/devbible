---
title: "jOOQ is free for open-source databases and paid for commercial ones — the split is by database, not by feature, and it decides whether you can adopt it at all"
sidebar_label: "01b · The licence question"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ licensing page
> ([jooq.org/legal/licensing](https://www.jooq.org/legal/licensing)) and the jOOQ downloads
> and pricing page ([jooq.org/download/](https://www.jooq.org/download/)), which carries the
> per-edition database list, the per-edition Java version floor and the current prices; plus
> the Spring Boot 4.1 reference *SQL databases · Using jOOQ*
> ([docs.spring.io/spring-boot/reference/data/sql.html](https://docs.spring.io/spring-boot/reference/data/sql.html)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.0, PostgreSQL 18.

**jOOQ ships in four editions. The Open Source Edition is Apache-2.0 and free, and it works
with a fixed list of open-source databases — PostgreSQL and MySQL among them. If your
database is Oracle, SQL Server, DB2, Snowflake, BigQuery, Redshift, Aurora or CockroachDB,
you need a paid edition, priced per developer workstation per year. Nothing about the DSL,
the code generator or the runtime is withheld from the free edition; only the *dialects*
are. On this phase's stack — PostgreSQL 18 on JDK 25 — everything in topic 13 runs on the
free edition, and this page exists so you know that for certain rather than by hope.**

## Why this comes before the API

Most libraries you can evaluate first and license later. jOOQ inverts that, because the
licence is not a footnote about support tiers — it is a hard gate on which database you may
point it at. A team that spends a sprint building a jOOQ layer and then discovers that
their SQL Server reporting replica needs a Professional Edition seat for every developer has
wasted the sprint. Settle it on day one.

## The four editions

| Edition | Price (as listed 2026-08) | Licence | Java floor |
|---|---|---|---|
| **Open Source** | free | Apache-2.0 (runtime, meta, codegen) | **Java 21 and newer** |
| **Express** | €99 / developer / year | commercial | Java 11 and newer |
| **Professional** | €399 / developer / year | commercial | Java 11 and newer |
| **Enterprise** | €799 / developer / year | commercial | Java 8 and newer |

Two things in that table surprise people.

**The Java floor runs backwards.** The *free* edition has the *highest* Java requirement.
Paid editions are what you buy to keep jOOQ working on Java 8 or Java 11; the Open Source
Edition tracks recent Java and currently requires **Java 21 or newer**. Spring Boot's own
reference documentation states the same requirement in its jOOQ section. On JDK 25 this is a
non-issue — but on a legacy service still on Java 17, the free edition is not an option, and
that is the reverse of the usual open-core pattern.

**The price is per developer workstation, not per server.** jOOQ's licensing page puts it
plainly: *"One for every developer workstation which is used to write jOOQ code. Server
licenses are included."* So the cost scales with team size, not with deployment size — ten
developers and a thousand pods cost the same as ten developers and one pod.

Perpetual "Unlimited" plans never expire and include one year of maintenance (upgrades) and
support, renewable at your option; Monthly and Yearly subscriptions stop at the end of their
term.

## The split is by database

This is the part to memorise, because it is the actual decision.

**Open Source Edition** — free, and covers these at their *latest versions*:

> ClickHouse · Derby · DuckDB · Firebird · H2 · HSQLDB · MariaDB · MySQL · **PostgreSQL** ·
> SQLite · Trino · YugabyteDB

**Express Edition (€99)** adds Microsoft Access 2013+, Oracle Express Edition 18c+, and SQL
Server Express Edition 2012+ — plus support for *historic* versions of the databases above.

**Professional Edition (€399)** adds Oracle (all editions) 18c+ and SQL Server (all
editions) 2012+, and the cloud engines: Amazon Redshift, Aurora MySQL, Aurora PostgreSQL,
Azure SQL Database, Azure SQL Data Warehouse, CockroachDB and MemSQL/SingleStore.

**Enterprise Edition (€799)** adds BigQuery, Databricks, DB2 LUW 9.7+, Exasol, HANA,
Informix 12.10+, Snowflake, Spanner, Sybase ASE 15.5+, Sybase SQL Anywhere 12+, Teradata 16+
and Vertica 7.1+.

### Two traps hiding in that list

**★ "Latest versions" is a real constraint on the free edition, not marketing language.**
Historic-version support is itself a paid feature. The Open Source Edition targets current
releases of the databases it covers. If you are pinned to an old major of a supported
engine, check before assuming the free edition understands it.

**★ Aurora PostgreSQL is not PostgreSQL for licensing purposes.** Plain PostgreSQL is in the
free tier; Aurora PostgreSQL is listed under Professional. Same for CockroachDB and
YugabyteDB, which land on opposite sides of the line — Yugabyte is free, Cockroach is not.
If your "PostgreSQL" is actually a managed variant, read the list rather than the marketing.

The practical shape of it: **RDS PostgreSQL is PostgreSQL** and stays free, because it runs
stock PostgreSQL and reports itself as such. Aurora is a different engine with its own
dialect entry. Do not generalise from one to the other.

## What the licence does *not* restrict

Worth stating, because the fear is usually larger than the fact.

- **No feature is withheld from the free edition.** The DSL, the code generator, `MULTISET`,
  window functions, the parser, the transaction API, the Spring integration — all present.
  What you buy is *dialects*.
- **Your generated code is yours.** jOOQ's licensing page is explicit that the generator's
  output *"is not jOOQ API, but your own code"* and may be licensed however you like, while
  noting it *"makes use of jOOQ's internal APIs"* — so the generated tree can live in a
  closed-source repository without a licensing question, but it still needs jOOQ on the
  classpath to compile and run.
- **Apache-2.0 has no copyleft obligation.** Linking `org.jooq:jooq` into a proprietary
  application imposes no source-disclosure requirement — unlike, say, an LGPL or AGPL
  dependency. This is a genuine change from jOOQ's history and a common source of stale
  advice; verify against the licensing page rather than a ten-year-old thread.

## Where the licence leaks into the code

Two places, and both are quiet.

**Spring Boot's dialect auto-configuration.** Boot determines the `SQLDialect` for your
`DataSource` unless `spring.jooq.sql-dialect` is set, and falls back to `DEFAULT` if it
cannot. The reference documentation adds a caveat that matters here: *"Spring Boot can only
auto-configure dialects supported by the open source version of jOOQ."* On a commercial
edition against a commercial database, set the dialect yourself:

```properties
spring.jooq.sql-dialect=POSTGRES
```

`DEFAULT` is not an error — it is a lowest-common-denominator renderer that silently
declines to emit dialect-specific SQL. A query that should have rendered `DISTINCT ON` or a
`jsonb` operator will render something more portable and less good, or fail to render at
all. If dialect-specific features quietly stop working, this property is the first thing to
check.

**The `SQLDialect` enum itself.** The commercial editions ship a superset of dialect
constants. Code written against `SQLDialect.ORACLE` will not compile on the Open Source
Edition, so a project cannot casually downgrade editions once it references a paid dialect.

## Choosing an edition, honestly

The decision tree is short:

1. **What database does production run?** If it is on the Open Source list at a current
   version, take the free edition and stop. This phase's stack — PostgreSQL 18 — is here.
2. **Do you also generate against a second database?** A common shape is PostgreSQL in
   production and H2 in a test — both free. A shape that is *not* free is PostgreSQL in
   production and an Oracle legacy system read by the same service.
3. **Are you on Java 20 or older?** Then the free edition is out regardless of database, and
   Express is the cheapest way back in.
4. **Count developer workstations, not servers.** The €399 Professional seat is per
   developer per year. For a team of six that is a real but small line item; for a team of
   sixty it is a budget conversation before it is a technical one.

⚠️ Prices, edition boundaries and the Java floor are all things jOOQ has changed before —
the figures here are what jooq.org listed in **2026-08**. Treat them as the shape of the
model, and re-read the pricing page before committing money to it.

## Gotchas

**★ Deciding "we'll start on the free edition and buy a licence if we need Oracle later" is
more expensive than it sounds.** You will have written against a `SQLDialect` set that does
not include Oracle, and your generator configuration, your dialect-specific SQL and your
emulation assumptions will all have been tuned for one engine. The upgrade path is a
purchase plus a porting exercise.

**★ The Java floor is the free edition's, not jOOQ's.** Saying "jOOQ needs Java 21" is
wrong in general and right for the edition most people use. Say which edition you mean.

**★ Per-workstation licensing means contractors and CI count if they write jOOQ code.** The
licensing page's wording is *"every developer workstation which is used to write jOOQ
code"* — a build agent that only *compiles* is not writing code, but read the terms rather
than taking a page's summary of them as legal advice.

**★ An open-source project that depends on jOOQ pushes the licence question onto its
users.** If your library generates against PostgreSQL, a downstream user on Oracle inherits
your dependency and their own licensing problem. Libraries that want to stay engine-neutral
usually keep jOOQ out of their public API.

**★ Falling back to `SQLDialect.DEFAULT` is a silent degradation, not a failure.** Nothing
throws. You simply stop getting dialect-specific rendering, and the symptoms look like jOOQ
"not supporting" a feature it supports perfectly well.

**★ The Open Source Edition tracking only latest database versions cuts both ways.** It also
means the free edition is not a stable target — a jOOQ upgrade may drop support for a
database version you are still running, and the fix is either a database upgrade or a paid
edition.

## Interview questions

**★ Is jOOQ free?** For open-source databases, yes — Apache-2.0. PostgreSQL, MySQL, MariaDB,
H2, SQLite, DuckDB, Firebird, HSQLDB, Derby, ClickHouse, Trino and YugabyteDB are covered by
the free Open Source Edition. Oracle, SQL Server, DB2, Snowflake, BigQuery, Redshift, Aurora
and CockroachDB require a paid edition.

**★ What exactly do you pay for?** Dialect support, historic database versions, older Java
baselines, and commercial support. No DSL or code-generation feature is held back.

**★ How is jOOQ priced?** Per developer workstation per year — €99 Express, €399
Professional, €799 Enterprise as listed in 2026-08 — with server licences included.
Perpetual plans exist and bundle a year of maintenance.

**★ Your team is on Java 17 and PostgreSQL. Can you use the free edition?** No. The Open
Source Edition requires Java 21 or newer, so on Java 17 you would need Express or higher, or
you would need to move the service to a newer JDK first.

**★ Does jOOQ's licence affect the code your generator produces?** No. jOOQ states the
generated output is your own code, licensable however you wish — though it uses jOOQ's
internal APIs, so it only compiles and runs with jOOQ present.

**★ Why might a dialect-specific feature silently stop working after a configuration change?**
Because the `SQLDialect` fell back to `DEFAULT`. Spring Boot detects the dialect from the
`DataSource` and can only auto-detect dialects the open-source edition supports; setting
`spring.jooq.sql-dialect` explicitly removes the ambiguity.

**★ You are on RDS PostgreSQL and considering Aurora PostgreSQL. Any jOOQ implication?**
Yes — a licensing one. Stock PostgreSQL is in the free edition; Aurora PostgreSQL is listed
under Professional. The migration would turn a free dependency into a per-developer annual
cost.

**★ How would you present this to a team that has never paid for a library?** As a
per-developer cost compared against the alternative, which is not "free" but "`JdbcClient`
plus the schema-drift bugs jOOQ prevents". For a PostgreSQL shop the comparison never
arises, because the answer is free — which is why establishing the database first is the
whole conversation.

{/* FOOTER */}
