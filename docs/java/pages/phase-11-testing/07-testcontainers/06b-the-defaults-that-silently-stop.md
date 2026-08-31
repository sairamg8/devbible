---
title: "Two of Boot's five schema mechanisms are conditional on the database being embedded, so the moment you replace H2 with a container they stop running — and neither of them logs that it declined, which is why the first symptom is a missing relation in a query nobody changed"
sidebar_label: "06b · The defaults that silently stop"
sidebar_position: 62
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against Spring Boot's **Database Initialization** how-to
> ([docs.spring.io](https://docs.spring.io/spring-boot/how-to/data-initialization.html)) and its
> **Testcontainers** reference
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html)), and
> the **Testcontainers 2.0.5** JDBC support page
> ([java.testcontainers.org](https://java.testcontainers.org/modules/databases/jdbc/)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Testcontainers 2.0.5, JUnit Jupiter 6.0.3, Flyway 12.4.0.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — the page carries Java source and documented configuration only.

**[06](06-schema-and-data.md) covered the three mechanisms you reach for deliberately. These are
the two you never configured, that were silently building your schema the whole time you were on
H2, and that stop the instant you follow [01](01-passed-on-h2-proves-nothing.md)'s advice. Neither
of them fails. Neither logs a warning. Both simply decline, and the error you get is
`relation "orders" does not exist` from a query that has not changed in a year — which is why this
pair costs an afternoon rather than a minute.**

## 4 · `schema.sql` and `data.sql` — 🔴 silently disabled on a container

This is the mechanism that produces the confused bug report, because it is the one every
getting-started guide uses and it stops working the moment you follow this topic's advice. Boot's
own words:

> *"By default, SQL database initialization is only performed when using an embedded in-memory
> database."*

A Testcontainers PostgreSQL is not an embedded in-memory database. **So `schema.sql` and `data.sql`
do not run, no warning is logged that they were skipped, and the first symptom is a missing
relation in a query.** The fix is one property:

```properties
# src/test/resources/application-test.properties
spring.sql.init.mode=always
```

Set it to `always` to initialize *"irrespective of its type"*, or `never` to *"disable
initialization"*. The default locations are `optional:classpath*:schema.sql` and
`optional:classpath*:data.sql` — note `optional:`, which is the other half of the silence: a
missing file is not an error either.

The ordering rule matters if you also use JPA:

> *"Script-based `DataSource` initialization is performed, by default, before any JPA
> `EntityManagerFactory` beans are created."*

So `data.sql` runs *before* Hibernate has built anything. If you wanted Hibernate to create the
schema and then `data.sql` to fill it, you need to invert that:

> *"if you want script-based `DataSource` initialization to be able to build upon the schema
> creation performed by Hibernate, set `spring.jpa.defer-datasource-initialization` to `true`.
> This will defer data source initialization until after any `EntityManagerFactory` beans have
> been created and initialized."*

🔴 **And if you have Flyway or Liquibase, do not use these at all.** Boot is explicit, and it is a
deprecation notice as well as advice:

> *"If you are using a higher-level database migration tool, like Flyway or Liquibase, you should
> use them alone to create and initialize the schema. Using the basic `schema.sql` and `data.sql`
> scripts alongside Flyway or Liquibase is not recommended and support will be removed in a future
> release."*

## 5 · `ddl-auto` — 🔴 also silently disabled on a container

The same shape of trap, one layer down. `spring.jpa.hibernate.ddl-auto` takes *"`none`, `validate`,
`update`, `create`, and `create-drop`"*, and the default is conditional:

> *"If an embedded database is identified and no schema manager (Flyway or Liquibase) has been
> detected, `ddl-auto` defaults to `create-drop`. In all other cases, it defaults to `none`."*

Read that twice against what you have just built. On H2 with no Flyway, Hibernate was quietly
creating your entire schema from the entity classes and you never configured anything. Move to a
container and the *same configuration* means `none` — no schema, no error at startup, and a
failure in the first query instead.

That default is correct, and the right response is almost never to set `create-drop`. It is to run
the real migrations (mechanism 1) and set:

```properties
spring.jpa.hibernate.ddl-auto=validate
```

which turns the mapping-versus-schema mismatch into a startup failure with a useful message
instead of a runtime one with a bad message. Phase 10 argues this at length in
[07b · Validate, not update](../../phase-10-data-access/11-flyway-migrations/07b-validate-not-update.md).

⚠️ One related switch, because it surprises people who set `create`: *"a file named `import.sql`
in the root of the classpath is executed on startup if Hibernate creates the schema from scratch
(that is, if the `ddl-auto` property is set to `create` or `create-drop`)"*. So `import.sql` is
another file that silently does nothing the moment `ddl-auto` is `validate` or `none`.


## The order everything actually fires in

For a `@SpringBootTest` with a container, migrations and JPA:

1. **Container starts.** The image's entrypoint runs `/docker-entrypoint-initdb.d` (fresh data
   directory only).
2. **Testcontainers runs `withInitScript` scripts**, in order — *"before your code is given a
   connection"*.
3. Spring's context starts. `@ServiceConnection` contributes the `ConnectionDetails` beans; the
   `DataSource` is built.
4. **Flyway / Liquibase migrate.**
5. **`schema.sql` then `data.sql`** — if `spring.sql.init.mode` allows it, and before the
   `EntityManagerFactory` unless `spring.jpa.defer-datasource-initialization` is `true`.
6. **`EntityManagerFactory` is created**; `ddl-auto` acts, and `import.sql` runs if it created the
   schema from scratch.
7. Your test class's `@Sql` scripts and `@BeforeEach` run — see
   **06c · Keeping tests independent** *(not written yet)*.

Steps 2 and 4 are the two you should be using. Steps 1, 5 and 6 are the ones that look like they
are working and are not.


## Gotchas

**★ `schema.sql` stops running the moment you switch from H2 to a container, and nothing says so.**
Boot only performs SQL initialization *"when using an embedded in-memory database"* by default, and
the default script locations are `optional:`, so neither the skipped initialization nor a missing
file produces a message. Set `spring.sql.init.mode=always` if you genuinely want them — or better,
move the schema into migrations.

**★ `ddl-auto` stops creating your schema at the same moment, for the same reason.**
`create-drop` is the default only for an embedded database *with no schema manager detected*; in
*"all other cases, it defaults to `none`"*. Teams hit both this and the `schema.sql` gotcha in the
same commit and conclude Testcontainers is broken.

**★ Setting `ddl-auto=create-drop` to "fix" it throws away the point of the exercise.**
You now have a real PostgreSQL running a schema that Hibernate invented, which is not the schema
you deploy. Every migration bug is invisible, and a column your migrations never added still works
in the test. Use `validate` against real migrations.

**★ `import.sql` only runs when Hibernate creates the schema from scratch.**
Which means it silently stops working the moment somebody sensibly moves `ddl-auto` to `validate`.

**★ Mixing `data.sql` with Flyway is not merely discouraged, it is being removed.**
*"support will be removed in a future release"*. Anything you build on that combination is
scheduled work.

**★ `spring.jpa.defer-datasource-initialization=true` is the fix for exactly one situation and a
trap in every other.**
It is for `ddl-auto` building the schema and `data.sql` filling it. If migrations own the schema,
deferring initialization just moves the wrong thing later.

## Interview questions

**★ A repository test passed on H2 and fails against a Testcontainers PostgreSQL with "relation does
not exist". Nothing about the schema changed. Why?**
Because two of Boot's schema mechanisms are conditional on the database being embedded. SQL
initialization from `schema.sql` only runs *"when using an embedded in-memory database"* by
default, and `ddl-auto` only defaults to `create-drop` for an embedded database with no schema
manager — otherwise `none`. On H2 one of those was silently building the schema; on a container
neither does, and neither logs that it declined.

**★ In what order do migrations, `data.sql` and `ddl-auto` run?**
Container init script first (before any connection is handed out), then the Spring context builds
the `DataSource`, then Flyway/Liquibase migrate, then `schema.sql` and `data.sql` if enabled —
*"before any JPA `EntityManagerFactory` beans are created"* unless
`spring.jpa.defer-datasource-initialization` is `true` — then the `EntityManagerFactory` is created
and `ddl-auto` acts, running `import.sql` if it built the schema from scratch.

**★ Your team uses Flyway. Somebody adds a `data.sql` for test fixtures. What do you say in review?**
That Boot recommends against it and that the support is going away: *"you should use them alone to
create and initialize the schema… support will be removed in a future release."* Test fixtures
belong in `@Sql` scripts, a repeatable migration scoped to the test profile, or builders — not in
the application's own initialization path.

**★ Why is `ddl-auto=validate` the right setting for a Testcontainers repository test?**
Because it makes the test check the thing you actually want checked — that the entity mappings
match the schema the migrations produced — and it fails at context startup with a specific message
instead of at query time with a vague one. `create-drop` would replace the real schema with
Hibernate's idea of it and hide every migration defect.

{/* FOOTER */}
