---
title: "ddl-auto has more values than the four everybody knows, Spring Boot's default depends on what database you connected to, and the word create means two different things depending on which property you set it on"
sidebar_label: "17 · ddl-auto"
sidebar_position: 36
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* Appendix A.17 *Schema
> tooling settings* — A.17.4, A.17.10, A.17.12, A.17.14, A.17.18
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the `org.hibernate.tool.schema.Action` source in Hibernate ORM 7.4
> ([github.com/hibernate/hibernate-orm, branch 7.4](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/tool/schema/Action.java)),
> the Spring Boot 4.1 reference *Data → SQL databases*
> ([docs.spring.io/spring-boot/reference/data/sql.html](https://docs.spring.io/spring-boot/reference/data/sql.html))
> and Spring Boot's `HibernateProperties` and `HibernateDefaultDdlAutoProvider` sources
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-hibernate/src/main/java/org/springframework/boot/hibernate/autoconfigure/HibernateProperties.java)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**`spring.jpa.hibernate.ddl-auto` is, in Spring Boot's own words, "a shortcut for the
`hibernate.hbm2ddl.auto` property". That property asks Hibernate to run its schema tooling
against your database as the `SessionFactory` starts. It is genuinely useful for tests and
prototypes, genuinely dangerous everywhere else, and it has an ambiguity in its value names
that has cost people their data.**

## Every value

`Action` in the Hibernate 7.4 source is the enumeration behind both properties. Its
constants, and the strings that select them through `hibernate.hbm2ddl.auto`:

| Value | Constant | What runs at startup |
|---|---|---|
| `none` | `NONE` | nothing |
| `validate` | `VALIDATE` | compare the mapping against the live schema and fail if they disagree |
| `update` | `UPDATE` | alter the schema towards the mapping — additively only |
| `create` | `CREATE` | **drop the schema, then create it** |
| `create-only` | `CREATE_ONLY` | create without dropping first |
| `drop` | `DROP` | drop the schema |
| `create-drop` | `CREATE_DROP` | drop and create at startup, drop again at shutdown |
| `populate` | `POPULATE` | run the load scripts only — since 7.0 |
| `synchronize` | `SYNCHRONIZE` | synchronise sequences with the data in tables — since 7.2 |

`VALIDATE`, `UPDATE`, `CREATE_DROP`, `TRUNCATE`, `POPULATE` and `SYNCHRONIZE` are all
annotated in the source as "not defined by JPA" — they are Hibernate's, not the
specification's.

⚠️ **`TRUNCATE` exists as a constant but has no configuration string.** It appears in neither
`getExternalHbm2ddlName()` nor `getExternalJpaName()` in the 7.4 source, so there is no value
you can put in `ddl-auto` to select it. It is reachable only through the
`SchemaManagementTool` API.

## 🔴 `create` means two different things

This is the one to remember, and the Hibernate source flags it itself, in an `@apiNote` on
the `Action` enum:

> There is an ambiguity surrounding the value `"create"` here. The old-school Hibernate
> configuration interprets this as the action `CREATE`, which **drops the schema before
> recreating it**. The JPA standard interprets it to mean the action `CREATE_ONLY` which
> **does not first drop the schema**.

Laid out:

| String | via `hibernate.hbm2ddl.auto` (`ddl-auto`) | via `jakarta.persistence.schema-generation.database.action` |
|---|---|---|
| `create` | `CREATE` — **drop and recreate** | `CREATE_ONLY` — create only |
| `drop-and-create` | *(not a value here)* | `CREATE` — drop and recreate |
| `create-only` | `CREATE_ONLY` | *(not a value here)* |
| `create-drop` | `CREATE_DROP` | *(not a value here)* |
| `none` / `drop` | same in both | same in both |

So `spring.jpa.hibernate.ddl-auto=create` **drops your tables**. The identical string on the
JPA-standard property does not. If you have ever seen a team argue about whether "create"
destroys data, this is why both sides had evidence.

Hibernate resolves a value by trying the JPA names first, then the hbm2ddl names, then the
enum constant names, and throws `IllegalArgumentException: Unrecognized JPA schema management
action setting: '…'` for anything else — so a typo fails loudly at startup, which is the one
merciful part of this.

## What Spring Boot actually sets

Two things are worth knowing, and neither is obvious from the property name.

**The default is computed from your `DataSource`.** Boot's `HibernateProperties` documents it
as: "Defaults to `create-drop` when using an embedded database and no schema manager was
detected. Otherwise, defaults to `none`." The logic in
`HibernateDefaultDdlAutoProvider#getDefaultDdlAuto` is exactly that — not embedded → `none`;
embedded but a schema manager (Flyway, Liquibase) is present → `none`; embedded and
unmanaged → `create-drop`.

So the behaviour changes when you swap H2 for PostgreSQL in a profile, and it changes again
the day you add Flyway. Both are the right defaults and both are surprising the first time.

**Precedence, in the order Boot checks it:**

1. `hibernate.hbm2ddl.auto` set explicitly under `spring.jpa.properties.*` — wins outright.
2. `spring.jpa.hibernate.ddl-auto`.
3. If `jakarta.persistence.schema-generation.database.action` is set, Boot sets nothing and
   lets the JPA-standard property take effect.
4. Otherwise the computed default above.

⚠️ Rule 1 is a real trap: a `spring.jpa.properties.hibernate.hbm2ddl.auto` left in a
properties file silently overrides every `spring.jpa.hibernate.ddl-auto` you set afterwards,
including in a profile.

And a small detail with a visible consequence: when the resolved value is `none`, Boot
*removes* `hibernate.hbm2ddl.auto` from the properties it hands Hibernate rather than setting
it to `"none"`. The outcome is identical — Hibernate's own documented default for
`hibernate.hbm2ddl.auto` is `"none"` (Appendix A.17.12) — but the property will be absent
from any dump of the effective configuration, which makes "is it off?" harder to answer than
it should be.

## Which value belongs where

| Context | Value | Why |
|---|---|---|
| local prototype, schema not yet designed | `create-drop` | fastest loop; nothing to lose |
| unit / slice tests on an embedded database | `create-drop` | already the Boot default there |
| integration tests against a real PostgreSQL | `none` + migrations | the tests should exercise the schema you ship |
| CI | `none` + migrations, then `validate` | proves the migrations produce the mapped schema |
| staging and production | 🔴 **`none`** | the schema is the migration tool's, and nothing else's |

`validate` deserves its own line: it is the only value that is safe in production and it is
the only one that tells you something. It runs no DDL and fails startup when the mapping and
the schema disagree. What it catches, what it misses, and the exact messages it produces are
[17b · Why `update` is never production](17b-why-update-is-never-production.md).

## The setting that decides whether a failure is loud

`hibernate.hbm2ddl.halt_on_error` — Appendix A.17.18 — "When enabled, specifies that the
schema migration tool should halt on any error, terminating the bootstrap process."
**Default: `false`.**

So by default a DDL statement that fails during `update` or `create` does not stop startup.
The application comes up with a schema that is partly what you asked for, which is a worse
state than either extreme. If you are going to run schema tooling at all, turn this on.

Two more that change what "the schema" means:
`hibernate.hbm2ddl.create_namespaces` (A.17.14, default `false`) decides whether the
schema/catalog itself is created; `jakarta.persistence.sql-load-script-source` (A.17.10) names
a script run after the schema is exported or truncated — the JPA-standard replacement for
`hibernate.hbm2ddl.import_files`, which the documentation says is "now preferred".

## Gotchas

**★ `ddl-auto=create` drops your tables.** Under `hibernate.hbm2ddl.auto` the string `create`
maps to `Action.CREATE`, which the source documents as "Drop and then recreate the schema".
`create-only` is the one that does not drop.

**★ The same string on the JPA-standard property does the opposite.** `create` there means
`CREATE_ONLY`; drop-and-recreate is spelled `drop-and-create`. Copying a value between the
two properties changes what it does.

**★ Boot's default depends on the `DataSource` and on whether Flyway or Liquibase is
present.** Adding a migration tool changes the default from `create-drop` to `none` on an
embedded database, which will look like the tool "stopped creating the schema".

**★ `spring.jpa.properties.hibernate.hbm2ddl.auto` beats `spring.jpa.hibernate.ddl-auto`.**
A stray line in a base properties file overrides every profile.

**★ When the value resolves to `none`, Boot omits the property entirely.** It is not visible
in the effective configuration, so absence does not mean unset.

**★ Failures during schema tooling do not stop startup by default.**
`hibernate.hbm2ddl.halt_on_error` is `false`, so a half-applied schema is the default failure
mode.

**★ `TRUNCATE` cannot be selected through `ddl-auto`.** The enum constant exists; no
configuration string maps to it in 7.4.

**★ `create-drop` drops on shutdown — if it gets a shutdown.** A `kill -9`, a container
killed by the orchestrator, or a JVM crash leaves the schema behind, and the next start
begins by dropping it. Nothing about this is durable cleanup.

**★ Schema tooling runs against whatever the `DataSource` points at.** A misconfigured
profile pointing a `create-drop` test at a shared database is one property away, and there is
no confirmation step.

**★ A typo throws at startup, which is the good case.** `IllegalArgumentException:
Unrecognized JPA schema management action setting` beats silently doing nothing.

## Interview questions

**★ What does `spring.jpa.hibernate.ddl-auto` actually do?**
It sets `hibernate.hbm2ddl.auto`, which asks Hibernate's schema management tooling to perform
an action against the database as the `SessionFactory` is built — validate, update, create,
drop, or nothing.

**★ What are the values?**
`none`, `validate`, `update`, `create`, `create-only`, `create-drop`, `drop`, and — newer —
`populate` and `synchronize`. Only `none`, `create`, `drop` and (as `drop-and-create`) the
drop-and-recreate action are defined by JPA; the rest are Hibernate's.

**★ Does `create` drop existing tables?**
Through `ddl-auto`, yes: it maps to `Action.CREATE`, documented as "drop and then recreate the
schema". Through the JPA-standard `jakarta.persistence.schema-generation.database.action`, no
— there `create` means `CREATE_ONLY`. The Hibernate source calls this out as an ambiguity.

**★ What is Spring Boot's default?**
`create-drop` for an embedded database with no schema manager detected, and `none` otherwise.
So it depends on the `DataSource` and on whether Flyway or Liquibase is on the classpath.

**★ If both `spring.jpa.hibernate.ddl-auto` and
`spring.jpa.properties.hibernate.hbm2ddl.auto` are set, which wins?**
The raw `hibernate.hbm2ddl.auto` property. Boot checks the existing property map first and
returns that value before it looks at its own shortcut.

**★ Which value is acceptable in production?**
`none`, with the schema owned by a migration tool. `validate` is also safe — it runs no DDL —
and is worth adding as a startup assertion that the deployed schema matches the mapping.

**★ Why does the application still start after a DDL error?**
Because `hibernate.hbm2ddl.halt_on_error` defaults to `false`. Enable it if you run schema
tooling at all, so a partial schema is a startup failure rather than a runtime mystery.

**★ You set `ddl-auto=none` and Hibernate still is not the problem — how do you check it is
really off?**
Do not look for the property in the effective configuration: Boot removes
`hibernate.hbm2ddl.auto` entirely when the value resolves to `none`, and Hibernate's own
default for it is `none` anyway. Check the resolved `spring.jpa.hibernate.ddl-auto`, any
`spring.jpa.properties.hibernate.hbm2ddl.auto`, and whether
`jakarta.persistence.schema-generation.database.action` is set.

---

← Prev: [16c · Beyond @Version](16c-beyond-version.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [17b · Why update is never production](17b-why-update-is-never-production.md)
