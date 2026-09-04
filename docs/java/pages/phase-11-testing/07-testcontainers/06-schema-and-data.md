---
title: "A container starts empty, and there are five different mechanisms that can put a schema in it — this half is the three you choose deliberately, and the first of them is the only one that tests the schema you actually deploy"
sidebar_label: "06 · Schema and data"
sidebar_position: 39
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5** sources at tag `2.0.5`
> ([`JdbcDatabaseContainer`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/jdbc/src/main/java/org/testcontainers/containers/JdbcDatabaseContainer.java),
> [`PostgreSQLContainer`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/postgresql/src/main/java/org/testcontainers/postgresql/PostgreSQLContainer.java)),
> the Testcontainers **JDBC support** page
> ([java.testcontainers.org](https://java.testcontainers.org/modules/databases/jdbc/)), Spring Boot's
> **Database Initialization** how-to
> ([docs.spring.io](https://docs.spring.io/spring-boot/how-to/data-initialization.html)) and its
> **Testcontainers** reference
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Testcontainers 2.0.5, JUnit Jupiter 6.0.3, Flyway 12.4.0, PostgreSQL JDBC 42.7.11.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — the page carries Java source and documented configuration only.

**The container starts and you have a running PostgreSQL with no tables in it. Everything after
that is a choice, and it is a choice most people make by accident: they copy a `schema.sql` out of
a tutorial, it works on H2, it does nothing at all against the container, and the failure surfaces
as `relation "orders" does not exist` from a query they did not write. There are five mechanisms
that can populate a container and they run at five different moments. **This chunk is the three
you reach for on purpose. [06b](06b-the-defaults-that-silently-stop.md) is the other two — the
ones that were doing the work on H2 and quietly stop the instant the database stops being
embedded, which is exactly what [01](01-passed-on-h2-proves-nothing.md) told you to make it do.**


## The five mechanisms, in the order you should consider them

| # | Mechanism | Runs | Owned by |
|---|---|---|---|
| 1 | **Your real migrations** (Flyway / Liquibase) | during Boot's context startup | your application |
| 2 | **`withInitScript(...)`** / `TC_INITSCRIPT` | after the container starts, **before any connection is handed out** | Testcontainers |
| 3 | **The image's own `/docker-entrypoint-initdb.d`** | inside the container, on **first** data-directory init | the image |
| 4 | **Boot's `schema.sql` / `data.sql`** — [06b](06b-the-defaults-that-silently-stop.md) | during context startup, before the `EntityManagerFactory` | Spring Boot |
| 5 | **Hibernate `ddl-auto`** — [06b](06b-the-defaults-that-silently-stop.md) | during `EntityManagerFactory` creation | Hibernate |

🔴 **Number 1 is the answer for a repository or migration test, and the other four exist for the
cases where it is not.** The reason is the same argument the whole topic rests on: a test that runs
your real migrations is testing the schema you deploy. A test that builds its schema some other way
is testing a schema that exists nowhere else, and the two drift the moment somebody writes a
migration and forgets to update the fixture.


## 1 · Your real migrations — the default answer

If the application uses Flyway or Liquibase, do nothing. Boot runs the migrations against whatever
`DataSource` it has, and with `@ServiceConnection` that `DataSource` points at the container. There
is no extra wiring, and the test now covers the migrations as well as the queries.

```java
@SpringBootTest
class OrderRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @Autowired OrderRepository orders;

    @Test
    void findsByCustomer() {
        // the schema here was built by src/main/resources/db/migration — the real thing
    }
}
```

🔴 Note the container type is written **`PostgreSQLContainer`, with no `<>`** — see
[02](02-what-testcontainers-is.md) for why every 1.x sample you will find writes
`` `PostgreSQLContainer<>` `` and why that now resolves to a deprecated shim.

**Phase 10 owns the migration-testing story in full** and this page does not repeat it. Go there
for the detail:

- [11 · Testing migrations](../../phase-10-data-access/11-flyway-migrations/11-testing-migrations.md)
  — what a migration test is actually for
- [11b · Wiring the container](../../phase-10-data-access/11-flyway-migrations/11b-wiring-the-container.md)
  — the precedence rule that makes `@ServiceConnection` outrank `spring.datasource.url`
- 🔴 [11c · The slice that skips your migrations](../../phase-10-data-access/11-flyway-migrations/11c-the-slice-that-skips-your-migrations.md)
  — **read this one.** `@DataJpaTest` does not import Flyway's auto-configuration at all, so in the
  slice most people reach for first, the migrations silently do not run and Hibernate builds the
  schema from the entities instead. That is a test comparing Hibernate's output against Hibernate.
- [11d · What the test should assert](../../phase-10-data-access/11-flyway-migrations/11d-what-the-test-should-assert.md)

## 2 · `withInitScript` — Testcontainers' own hook

`JdbcDatabaseContainer` carries three overloads, and the field behind them is a `List`, so scripts
are ordered:

```java
public SELF withInitScript(String initScriptPath)          // "Sets a script for initialization."
public SELF withInitScripts(String... initScriptPaths)     // "an ordered array of scripts"
public SELF withInitScripts(Iterable<String> initScriptPaths)
```

The timing is the part worth knowing, and the documentation states it plainly:

> *"Testcontainers can run an init script after the database container is started, but before your
> code is given a connection to it."*

**Before your code is given a connection.** That is earlier than anything Spring does, which makes
it the right tool for the things that must exist before the application context comes up at all —
an extension, a role, a second database, a `search_path`, a tablespace:

```java
@Container
@ServiceConnection
static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine")
        .withInitScript("db/testcontainers/extensions.sql");
```

```sql
-- src/test/resources/db/testcontainers/extensions.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

⚠️ **This is not where your schema belongs.** An init script that creates tables is mechanism 1's
job done worse — a second copy of the schema, in the test source tree, that nothing keeps in step
with the migrations. Use it for what migrations legitimately cannot do because they run *after* the
database is already serving connections.

### The JDBC-URL form, for tests with no Spring at all

There is a second way to reach all of this that involves no container object in your code. Insert
`tc:` after `jdbc:` and the Testcontainers JDBC driver starts the container for you:

```
jdbc:tc:postgresql:18-alpine:///databasename
```

> *"Note that the hostname, port and database name will be ignored; you can leave these as-is or
> set them to any value."*

The URL takes parameters that map onto the same mechanisms:

| Parameter | What it does |
|---|---|
| `TC_INITSCRIPT` | runs a classpath script — `?TC_INITSCRIPT=somepath/init_postgres.sql`; the `file:` prefix reads from disk instead: `?TC_INITSCRIPT=file:src/main/resources/init_postgres.sql` |
| `TC_INITFUNCTION` | calls your Java instead of a script — `?TC_INITFUNCTION=com.example.Fixtures::seed`, which must be *"a public static method which takes a `java.sql.Connection` as its only parameter"* |
| `TC_DAEMON` | 🔴 keeps the container alive: *"By default database container is being stopped as soon as last connection is closed."* |
| `TC_TMPFS` | *"Container can have `tmpfs` mounts for storing data in host memory"* — `?TC_TMPFS=/testtmpfs:rw` |
| `TC_REUSABLE` | the URL form of the reuse opt-in — see **05b · Reuse** *(not written yet)* |

🔴 **`TC_DAEMON` is the one that bites.** The JDBC-URL mode ties the container's life to the
connection pool, so a test that closes its last connection between methods gets a *fresh* database
next time — schema gone, data gone. That is a genuinely useful default for a
one-connection-per-test tool and a baffling one inside a Spring application that opens and closes
pooled connections constantly. If you are using Spring at all, prefer the container object and
`@ServiceConnection`; the URL form is for JDBC-level tests, migration tools invoked directly, and
tooling that only knows how to take a connection string.

## 3 · The image's entrypoint scripts

The official `postgres` image runs anything it finds in `/docker-entrypoint-initdb.d` when it
initialises a fresh data directory. Testcontainers can put files there:

```java
static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine")
        .withCopyFileToContainer(
                MountableFile.forClasspathResource("db/seed.sql"),
                "/docker-entrypoint-initdb.d/01-seed.sql");
```

Two properties make this different from mechanism 2, and both are traps:

- **It runs only on a fresh data directory.** Combine it with container reuse (**05b · Reuse**
  *(not written yet)*) and it runs once, ever, on the first run — subsequent runs skip it entirely
  because the data directory already exists.
- **It is the image's contract, not Testcontainers'.** `/docker-entrypoint-initdb.d` is a
  PostgreSQL-image convention; MySQL's image uses the same path, most other images use nothing of
  the sort. Reach for it only when you need behaviour the image's own entrypoint provides — the
  common real case is a `POSTGRES_INITDB_ARGS` locale or an encoding that must be set at `initdb`
  time and cannot be changed afterwards.

## Where this continues

[06b · The defaults that silently stop](06b-the-defaults-that-silently-stop.md) takes mechanisms 4
and 5 — `schema.sql`/`data.sql` and `ddl-auto` — and the order in which every one of the five
actually fires. Both of those were building your schema on H2 without being configured, and both
decline to do it against a container **without logging that they declined**, which is why the
symptom is a missing relation rather than a message.

## Gotchas

**★ `@DataJpaTest` does not import Flyway's auto-configuration at all.**
So the slice most people reach for first runs no migrations, falls back to Hibernate's schema, and
produces a passing test that checked Hibernate against Hibernate. Phase 10's
[11c](../../phase-10-data-access/11-flyway-migrations/11c-the-slice-that-skips-your-migrations.md)
is the full treatment; it is the single most common way a Testcontainers test proves nothing.

**★ An init script that creates tables is a second schema nobody maintains.**
It will be correct on the day it is written and wrong on the day somebody adds a migration. Init
scripts are for what has to exist *before* the application connects — extensions, roles,
`search_path`, a second database. Tables belong in migrations.

**★ `TC_DAEMON` defaults to false, so the JDBC-URL form drops the database when the last connection
closes.**
*"By default database container is being stopped as soon as last connection is closed."* With a
connection pool that legitimately empties, you get a new, empty database mid-suite. This is why the
URL form and Spring are a poor fit for each other.

**★ `/docker-entrypoint-initdb.d` runs only on a fresh data directory, which makes it and container
reuse mutually hostile.**
Enable reuse and the seed runs once, on the first run of the day, and never again — so the suite
passes on a clean machine and fails on yours, or the reverse.

**★ `withInitScript` replaces nothing; `withInitScripts` is ordered.**
The backing field is a `List`, so the plural form runs in the order you give. Calling the singular
form twice is a configuration smell — say what you mean with the plural.

**★ The default database name, user and password are all `test`, and the default *tag* is ancient.**
`PostgreSQLContainer` carries `9.6.12` as its default tag constant, and 2.0 *dropped the module
default constructors* precisely so you cannot get it by accident. Always name the image, and pin it
to the major version you deploy — `postgres:18-alpine`, never `postgres:latest`, or your test
changes engine underneath you on an unrelated day.

**★ An init script failure can look like a startup timeout rather than a SQL error.**
The script runs between container start and the first connection, so its failure surfaces at
whatever the surrounding machinery reports — which is why `withStartupTimeoutSeconds` and
`withConnectTimeoutSeconds` exist as separate knobs: *"Set startup time to allow, including image
pull time"* versus *"time to allow for the database to start and establish an initial connection"*.

## Interview questions

**★ What are the ways to get a schema into a Testcontainers database, and which should you use?**
Real migrations run by Boot at startup; Testcontainers' `withInitScript`; the image's
`/docker-entrypoint-initdb.d`; Boot's `schema.sql`/`data.sql`; and Hibernate's `ddl-auto`. Use the
migrations, because that is the schema you actually deploy and it keeps itself in step. The others
are for what migrations cannot do or for tests that are not about the schema.

**★ When is `withInitScript` the right tool?**
For what must exist before the application context connects and that migrations therefore cannot
create — extensions like `pgcrypto`, roles, a `search_path`, a second database, encoding set at
`initdb` time. It runs *"after the database container is started, but before your code is given a
connection to it"*, which is earlier than anything Spring does.

**★ What does `jdbc:tc:postgresql:18-alpine:///mydb` do, and what is the catch?**
The Testcontainers JDBC driver starts a container for that image and connects to it; the host, port
and database name in the URL are ignored. The catch is `TC_DAEMON` — by default *"database
container is being stopped as soon as last connection is closed"*, so with a pooled `DataSource`
that legitimately drains, the database and everything in it disappears mid-suite.

**★ Why should the schema not live in an init script?**
Because it becomes a second copy of the schema in the test tree that nothing keeps in step with the
migrations. It is correct on the day it is written and drifts silently thereafter, and the drift
shows up as a test that passes against a schema production does not have.

**★ What is the difference between `TC_INITSCRIPT` and `TC_INITFUNCTION`?**
`TC_INITSCRIPT` runs a SQL file, from the classpath or, with a `file:` prefix, from disk.
`TC_INITFUNCTION` calls your Java instead — *"a public static method which takes a
`java.sql.Connection` as its only parameter"* — which is what you want when the fixture needs logic
rather than statements.

**★ Why does `/docker-entrypoint-initdb.d` interact badly with container reuse?**
The image runs those scripts only when it initialises a fresh data directory. A reused container
already has one, so the seed runs on the very first run and never again — which is a test that
passes or fails depending on how recently the developer restarted Docker.

**★ Why does `PostgreSQLContainer` have no no-arg constructor any more?**
Testcontainers 2.0 dropped the module default constructors, so you must name the image. The class
still carries an old default-tag constant, and pinning the image explicitly is what stops a test
from silently running on a different engine version than the one you deploy.

{/* FOOTER */}

{/* FOOTER */}
