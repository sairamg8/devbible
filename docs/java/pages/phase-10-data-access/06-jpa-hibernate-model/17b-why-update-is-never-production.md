---
title: "update never drops, never narrows and never renames — so it cannot fail, and a schema it has been maintaining diverges from your mapping without ever telling you"
sidebar_label: "17b · Why update is never production"
sidebar_position: 37
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §31.1 *Schema management*
> and Appendix A.17
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the `AbstractSchemaValidator` source in Hibernate ORM 7.4
> ([github.com/hibernate/hibernate-orm, branch 7.4](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/tool/schema/internal/AbstractSchemaValidator.java))
> and the Spring Boot 4.1 reference *Data → SQL databases → Database initialization*
> ([docs.spring.io/spring-boot/reference/data/sql.html](https://docs.spring.io/spring-boot/reference/data/sql.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**`update` is not a migration tool that occasionally gets things wrong. It is a tool that
only ever adds, by design — so every schema change that is not purely additive leaves the
database in a state the mapping does not describe, and nothing reports it. The Hibernate
documentation says so in one sentence, and the interesting part is the sentence after it.**

## What the documentation says

The User Guide's performance chapter opens with schema management:

> Although Hibernate provides the `update` option for the `hibernate.hbm2ddl.auto`
> configuration property, **this feature is not suitable for a production environment**.
>
> An automated schema migration tool (e.g. Flyway, Liquibase) allows you to use any
> database-specific DDL feature (e.g. Rules, Triggers, Partitioned Tables). Every migration
> should have an associated script, which is stored on the Version Control System, along with
> the application source code.
>
> When the application is deployed on a production-like QA environment, and the deployment
> worked as expected, then pushing the deployment to a production environment should be
> straightforward since the latest schema migration was already tested.
>
> **You should always use an automatic schema migration tool and have all the migration
> scripts stored in the Version Control System.**

The second paragraph is the one people skip, and it is the real argument. `update` does not
merely risk getting a change wrong; it cannot express most of what a schema change is. It has
no vocabulary for a data backfill, a partial index, a partitioned table, a trigger, a check
constraint added after the fact, or a rename that preserves the rows.

## What `update` actually does, and does not

It compares the mapping against the live schema and issues DDL to close the gap **in one
direction only**:

| Change in your mapping | What `update` does |
|---|---|
| new entity | `create table` |
| new field | `alter table … add column` |
| new index or unique constraint | usually created |
| **removed field** | **nothing — the column stays** |
| **renamed field** | **adds the new column; the old one stays, with the data in it** |
| **narrowed type** (`varchar(255)` → `varchar(50)`) | **nothing** |
| **`nullable = false` on an existing column** | **nothing you can rely on** |
| **changed column type** | **nothing you can rely on** |
| dropped entity | nothing — the table stays |

Everything in bold is silent. There is no warning, no log line you would notice, and no
failure. The application starts and works, because a wider column and an extra column are
both compatible with the mapping. The divergence accumulates.

### The three shapes it produces

**Ghost columns.** A field renamed six months ago left `customer_name` behind next to
`customer_full_name`. It is still `not null` from when it mattered, so a new insert path that
does not populate it fails — a year later, in a different feature.

**Constraints that were never applied.** You added `nullable = false` and `unique = true` to
an existing field. `update` did not apply either, because existing rows might violate them.
Your mapping says the data is constrained; the database says nothing is. Every read path now
assumes an invariant the database is not enforcing.

**Environment drift.** Each environment's schema is the accumulated history of every version
that was ever deployed *there*. Staging and production are not the same database, and no
artefact describes either. A restored backup and a freshly `create`d schema are different
schemas.

## The one thing `update` cannot do, and that is the point

It cannot fail. A migration script that cannot be applied stops the deployment, loudly, in
CI, before production. That is the entire value of migrations, and `update`'s additive-only
design is exactly what removes it.

## `validate` — the value that is safe and tells you something

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate
```

`validate` runs no DDL. It compares the mapping against the live schema and throws
`SchemaManagementException` — failing startup — when they disagree. Used with a migration
tool it is an assertion: *the migrations produced the schema my mapping expects.*

The messages are worth recognising, because they come from `AbstractSchemaValidator` and are
formatted precisely:

- `Schema validation: missing table [<qualified table name>]`
- `Schema validation: missing column [<column>] in table [<table>]`
- `Schema validation: wrong column type encountered in column [<column>] in table [<table>];
  found [<actual> (Types#<CODE>)], but expecting [<expected> (Types#<CODE>)]`
- `Schema validation: missing sequence [<name>]`
- `Schema validation: sequence [<name>] defined inconsistent increment-size; found [<n>] but
  expecting [<m>]`
- ``Missing index named `<name>` on table `<table>` `` and ``Index mismatch - `<name>` on
  table `<table>` ``
- ``Missing unique constraint named `<name>` on table `<table>` `` and ``Unique-key mismatch -
  `<name>` on table `<table>` ``

⚠️ **The prefix is `Schema validation:` with a space** in 7.4. Older Hibernate wrote
`Schema-validation:` with a hyphen, and most search results still show the hyphen. If you are
grepping logs or asserting on messages, that difference matters.

The sequence-increment message is the one that catches people upgrading: it is the schema-side
half of the `allocationSize` contract argued in
[8 · `SEQUENCE` and `allocationSize`](08-sequence-and-allocationsize.md).

### What `validate` catches, and what it does not

**Catches:** missing tables, missing columns, wrong column types, missing sequences,
mismatched sequence increments, and — in 7.x — missing or mismatched indexes and unique
constraints.

**Does not catch:** extra tables and extra columns the mapping does not mention. That is
deliberate — a schema is allowed to contain things this application does not map — but it
means `validate` will happily approve a database full of the ghost columns `update` left
behind.

**Also does not catch:** nullability, check constraints, foreign keys, defaults, collation, or
anything about the data. `validate` is a shape check, not a correctness check.

## The arrangement that works

1. **The migration tool owns the schema.** Flyway or Liquibase, scripts in version control
   next to the code that needs them, applied on startup or by the deployment pipeline.
2. **`ddl-auto: none`** in every environment that has data you care about — or `validate`, for
   the assertion.
3. **`create-drop`** only where the database is disposable: an embedded database in a slice
   test, a local prototype.
4. **Generate the first script, do not write it.** Hibernate can write the DDL it *would*
   execute to a file via `jakarta.persistence.schema-generation.scripts.action` and
   `…scripts.create-target`, giving you a correct starting point that a human then owns.
5. **Test the migrations, not the generated schema.** Integration tests against a real
   database should run the same migrations production will.

The migration tool itself — Flyway's versioning, repeatable migrations, baselining an existing
database, and what a failed migration leaves behind — is **topic 11 · Migrations with
Flyway** *(not written yet)*.

## Gotchas

**★ `update` never drops a column, so a renamed field leaves both.** The old column keeps its
data and its constraints, and a `not null` on it will break an insert path added much later.

**★ `update` does not apply new `not null` or `unique` constraints to existing columns.** Your
mapping asserts an invariant the database is not enforcing, and nothing says so.

**★ `update` does not narrow a type.** Shortening a `varchar` in the mapping changes the
validation rule in Java and nothing in the database.

**★ A schema maintained by `update` differs per environment.** It is the accumulated history
of deployments to that environment, and there is no artefact describing it.

**★ `validate` does not detect extra columns.** So it will pass on a schema `update` has been
quietly corrupting for a year.

**★ `validate` says nothing about nullability, defaults, foreign keys or check constraints.**
It compares tables, columns, types, sequences, indexes and unique constraints — not the rest
of the schema's semantics.

**★ The message prefix changed to `Schema validation:` with a space.** Log greps and
assertions written against `Schema-validation:` will silently stop matching.

**★ `validate` fails startup, which is what you want and a surprise in a rolling deploy.** A
new version whose migration has not run yet will not start. That is the assertion working —
but it makes migration ordering part of your deployment design.

**★ Generating the initial migration from Hibernate is fine; regenerating it later is not.**
Once the script is in version control it is history, and history is not regenerated.

**★ `update` on a schema owned by a migration tool is the worst combination.** Two writers,
no coordination, and the migration tool's checksums will eventually disagree with what is
there.

## Interview questions

**★ Why is `ddl-auto: update` unsuitable for production?**
Because it only ever adds. It never drops, narrows, renames or retro-applies constraints, so
any non-additive change silently leaves the schema different from what the mapping describes
— and because it cannot fail, nothing tells you. The Hibernate documentation states plainly
that it "is not suitable for a production environment".

**★ Beyond the risk, what can `update` not express at all?**
Data backfills, renames that preserve data, partitioned tables, triggers, rules, partial
indexes, and any database-specific DDL. The documentation lists exactly these as the reason
to use a migration tool.

**★ What does `validate` do, and is it safe?**
It runs no DDL. It compares the mapping against the live schema at startup and throws a
`SchemaManagementException` on any mismatch. It is safe in production and is the right
startup assertion that your migrations produced the schema your mapping expects.

**★ What does `validate` miss?**
Extra tables and columns — it does not require the schema to be minimal — and everything
outside tables, columns, types, sequences, indexes and unique constraints: nullability, check
constraints, foreign keys, defaults, data.

**★ You renamed a field and deployed with `update`. What is in the database?**
Both columns. The new one, empty or newly populated, and the old one with all the historic
data and whatever constraints it had. Nothing was logged and nothing failed.

**★ How do you get an initial migration script for an existing mapping?**
Have Hibernate write the DDL it would execute to a file, using
`jakarta.persistence.schema-generation.scripts.action` with `…scripts.create-target`, and then
take ownership of that file as the first versioned migration. Generate once; edit by hand
thereafter.

**★ Can you run a migration tool and `update` together?**
You can, and you should not. Two independent writers to one schema with no coordination
between them, and the migration tool's checksums will eventually disagree with the state it
finds.

**★ What is the practical value of a migration failing?**
It stops a deployment in CI or staging instead of producing a subtly wrong production
schema. `update` is designed so that it cannot fail, which is precisely why it gives you no
signal.

---

← Prev: [17 · ddl-auto](17-ddl-auto.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [18 · Seeing what Hibernate does](18-seeing-what-hibernate-does.md)
