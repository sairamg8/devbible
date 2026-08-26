---
title: "Two completely different things are called validate — Flyway compares the history table against the files, Hibernate compares the mapping against the live schema — and it is the pair of them, not either one, that closes the loop on drift"
sidebar_label: "07b · Validate, not update"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Flyway *Validate* command reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/commands/validate)),
> the *Validate Migration Naming* setting
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/flyway-validate-migration-naming-setting-277579041.html)),
> Spring Boot 4.1's `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayProperties.java))
> and the Hibernate 7.4 schema-validation behaviour recorded in
> [06 · `update` is never production](../06-jpa-hibernate-model/17b-why-update-is-never-production.md).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18, Hibernate ORM 7.4.1.

**[06 · `ddl-auto`](../06-jpa-hibernate-model/17-ddl-auto.md) and
[06 · why `update` is never production](../06-jpa-hibernate-model/17b-why-update-is-never-production.md)
have already settled that Hibernate must not maintain the schema and that `validate` is the value
to use instead. This page picks up at the next question: what does that assertion actually
guarantee once Flyway is the thing building the schema? The answer needs care, because two tools in
the same startup sequence both have a command called `validate` and they compare different pairs of
things.**

## Three artefacts, two comparisons, one gap

There are three descriptions of your schema in play, and each pair of them could in principle be
compared:

```
                    ┌─────────────────┐
                    │  the entities   │
                    └────────┬────────┘
                             │  ← Hibernate `ddl-auto: validate`
                             │    (mapping vs LIVE SCHEMA)
                    ┌────────┴────────┐
                    │  the live       │
                    │  schema         │
                    └────────┬────────┘
                             ┆  ← NOBODY CHECKS THIS
                    ┌────────┴────────┐
                    │  the migration  │
                    │  files          │
                    └────────┬────────┘
                             │  ← Flyway `validate`
                             │    (files vs HISTORY TABLE)
                    ┌────────┴────────┐
                    │  the history    │
                    │  table          │
                    └─────────────────┘
```

| Command | Compares | Fails on |
|---|---|---|
| **Flyway `validate`** | migration **files** ↔ **history table** | checksum, description or type mismatch; missing, pending or ignored migrations |
| **Hibernate `validate`** | **entities** ↔ **live schema** | missing table, missing column, wrong column type, missing or mismatched sequence, index or unique constraint |

🔴 **Neither compares the migration files against the live schema.** That is the gap, and it is the
one that matters: a hand-run `ALTER TABLE` is invisible to Flyway (the history table is
unchanged and self-consistent, per [03c](03c-reading-the-history.md)) and invisible to Hibernate
unless it happens to contradict a mapping.

## Why the pair is stronger than either alone

Run them together and the gap narrows considerably, because they fail in different directions.

- **Flyway alone** proves the migrations that ran are the migrations in the repository. It proves
  nothing about the schema — [04c](04c-where-the-comparison-does-not-run.md) makes that point in
  full.
- **Hibernate alone** proves the schema matches the mapping. It proves nothing about *how* the
  schema got that way, so a database built by `update` passes.
- **Together**, the chain is: *the repository's migrations are what ran* **and** *the resulting
  schema is what the code expects*. Neither link on its own says anything useful about the other
  end.

And the chain only holds because of the ordering guarantee from
[07 · Boot integration](07-boot-integration.md): `DatabaseInitializationDependencyConfigurer` makes
the `EntityManagerFactory` depend on the Flyway initializer, so Hibernate validates a schema Flyway
has finished with. Without that edge, a validation failure could just be a race.

```yaml
spring:
  flyway:
    validate-on-migrate: true      # the default — leave it
  jpa:
    hibernate:
      ddl-auto: validate
```

## What still gets through

Being honest about the residue is the point of drawing the triangle:

| Not caught | By which |
|---|---|
| an `ALTER TABLE` run by hand that the mapping does not contradict | both |
| extra tables and columns the entities do not mention | Hibernate — deliberately |
| nullability, foreign keys, check constraints, defaults, collation | Hibernate |
| anything at or below the applied baseline | Flyway |
| a Java migration's body being rewritten | Flyway ([04b](04b-the-edits-nothing-catches.md)) |
| a changed placeholder value in a versioned migration | Flyway ([04b](04b-the-edits-nothing-catches.md)) |
| data of any kind | both |

The extra-columns row is worth dwelling on. Hibernate ignores columns the mapping does not name —
correctly, because a schema may serve more than one application. But it means a database that
`update` maintained for two years, full of the columns `update` never dropped, passes `validate`
cleanly on the day you switch. **Adopting `validate` does not clean anything up; it freezes the
current shape and asserts it from then on.**

Closing the remaining gap needs a schema comparison — a diff between the live schema and one built
by replaying the migrations into an empty database. That is a job for the pipeline, and it is what
**11 · Testing migrations** *(not written yet)* is about.

## `validate-on-migrate` and the `validate` command are not the same thing

- **`validate-on-migrate`** (default `true`) makes `migrate` validate first. Under Boot this is
  what turns a mismatch into a **startup failure**, which is the behaviour you want: the
  application does not start and then misbehave.
- **The `validate` command** is the same check run on its own, from the CLI or a build plugin —
  useful in a pipeline stage before anything is deployed.

Running `validate` in CI against a copy of production, *before* the deploy, converts a startup
failure into a build failure. That is a strictly better place to find out.

## The setting almost nobody sets: `validate-migration-naming`

Boot's default is **`false`**, and the consequence is unintuitive:

> *"Whether to validate migrations and callbacks whose scripts do not obey the correct naming
> convention."*

With it off, **a file whose name does not parse is silently ignored.** `V12_Add_index.sql` with one
underscore instead of two is not a migration; it is a file in a directory. Nothing runs it, nothing
mentions it, and `info` does not list it — the deployment reports complete success having applied
nothing.

```yaml
spring:
  flyway:
    validate-migration-naming: true
```

⚠️ **Turning it on is a one-line change with a real risk attached**: any legacy file sitting in a
migration location that has never been a migration — a `README.txt`, an old `.sql.bak` — becomes a
startup failure. Do it, and do it on a day you can look at what it finds.

## Diagnosing a validation failure, in order

The two failures look similar in a startup log and have completely different causes.

**If Flyway failed** — the message names a migration version and says *checksum mismatch*,
*not resolved locally* or *not applied to database* — the problem is between the repository and the
history table. [04](04-checksums-and-immutability.md) and
[04e](04e-when-repair-is-the-right-answer.md) have the decision procedure.

**If Hibernate failed** — the message begins `Schema validation:` — the migrations ran and the
schema they produced is not what the entities expect. Three causes, in likelihood order:

1. **An entity changed without a migration.** Somebody added a field. This is the common case and
   the fix is a migration.
2. **The migration ran but did something different from what the entity expects** — a column named
   with the wrong case, a type that maps differently, a sequence with a different increment.
3. **The database is not the one you think it is.** An old environment, a stale URL, a container
   that was never recreated.

⚠️ **Reaching for `ddl-auto: update` to make it go away puts you back where
[06](../06-jpa-hibernate-model/17b-why-update-is-never-production.md) started**, and worse: the
schema now has a change no migration describes, so the next fresh environment will not have it.

## Gotchas

**★ Two different tools have a command called `validate` and they compare different pairs.** Flyway
compares files with the history table; Hibernate compares the mapping with the live schema. A
sentence like "validation passed" is ambiguous until you say which.

**★ Nothing compares the migration files against the live schema.** That is the gap both tools
leave, and it is where hand-run DDL lives.

**★ Hibernate's `validate` ignores extra tables and columns.** Deliberate, and it means a database
full of the residue `update` left behind passes cleanly on day one.

**★ Adopting `validate` freezes the current shape rather than fixing it.** It asserts what is there
now; it does not tell you the schema is *right*.

**★ Hibernate's check is a shape check.** Nullability, foreign keys, check constraints, defaults
and collation are outside it entirely.

**★ The pairing only works because of Boot's dependency edge.** Without
`@DependsOnDatabaseInitialization` on the `EntityManagerFactory`, a validation failure could be a
race rather than a disagreement.

**★ `validate-on-migrate` defaults to `true` and should stay that way.** It is what makes a
mismatch a startup failure instead of a runtime surprise.

**★ Running the `validate` command in CI moves the failure earlier.** A build failure against a
production copy beats a startup failure during a deploy.

**★ `validate-migration-naming` defaults to `false`, so a misnamed migration is silently ignored.**
One underscore instead of two and the file is not a migration at all, with no message anywhere.

**★ Turning `validate-migration-naming` on can fail startup on files that were never migrations.**
Anything in a migration location that does not parse becomes an error.

**★ A Flyway failure and a Hibernate failure need different diagnoses.** The prefix tells you
which: a version number and *mismatch* is Flyway; `Schema validation:` is Hibernate.

**★ Switching to `update` to clear a validation failure creates schema no migration describes.**
The next fresh environment will not have it, and nothing will report the difference.

**★ `ddl-auto: none` is defensible; `update` is not.** Choosing `none` gives up the assertion,
which is a real cost but an honest one. `update` gives up the assertion *and* changes the schema.

## Interview questions

**★ There are two things called `validate` in a Boot service using Flyway. What does each compare?**
Flyway's compares the migration files against the schema history table — checksums, descriptions,
types, and which migrations are missing or pending. Hibernate's `ddl-auto: validate` compares the
entity mapping against the live schema — tables, columns, types, sequences and, in 7.x, indexes and
unique constraints.

**★ What does neither of them check?**
The migration files against the live schema. That gap is where a hand-run `ALTER TABLE` lives:
Flyway's history table is unchanged and self-consistent, and Hibernate only notices if the change
happens to contradict a mapping.

**★ Why run both rather than one?**
Because they fail in different directions and the chain is only useful complete: Flyway proves what
ran is what is in the repository, Hibernate proves the resulting schema matches the code. Either
alone tells you nothing about the other end.

**★ What makes that pairing reliable rather than a race?**
Boot's `DatabaseInitializationDependencyConfigurer` adds an explicit `dependsOn` from the
`EntityManagerFactory` to the Flyway initializer, so `migrate()` has finished before Hibernate
looks at the schema.

**★ You switch a legacy application from `update` to `validate` and it starts cleanly. Is the
schema correct?**
Not established. Hibernate ignores tables and columns the mapping does not mention, so all the
residue `update` left behind is invisible. `validate` asserts the current shape from now on; it
does not audit it.

**★ Hibernate validation fails after a deployment. How do you diagnose it?**
Confirm it is Hibernate rather than Flyway — the message starts `Schema validation:`. Then, in
order: an entity changed without a migration, a migration that did something subtly different from
what the entity expects, or the application is pointed at a database you did not mean.

**★ Somebody fixes a validation failure by setting `ddl-auto: update`. What is wrong with that?**
It applies a schema change that no migration describes, so the next fresh environment will not have
it and nothing will report the difference. It also re-adopts every problem with `update` — it never
drops, never narrows and never renames.

**★ What does `validate-migration-naming` do, and why is its default surprising?**
It decides whether a file that does not obey the naming convention is an error. The default is
`false`, so a misnamed file is silently not a migration — no error, no listing in `info`, and a
deployment that reports success having applied nothing.

**★ Why not turn it on everywhere immediately?**
Because anything in a migration location that has never parsed — a stray text file, an old backup —
becomes a startup failure. It is the right setting; it just needs to be turned on with somebody
watching.

**★ Where is the best place to run Flyway's `validate`?**
In CI, against a copy of production, before anything deploys. `validate-on-migrate` will catch it
at startup anyway, but a build failure is a much better place to learn about it than a rolling
deployment.

**★ Is `ddl-auto: none` ever the right choice with Flyway?**
Yes, and it is defensible in a way `update` never is — it simply gives up the assertion. The reason
to prefer `validate` is that the assertion is nearly free and catches the single most common
mistake, which is an entity changing without a migration.

**★ How would you close the gap neither tool covers?**
Compare the live schema against one built by replaying the migrations into an empty database, as a
pipeline step. That is the only check that catches drift the mapping does not happen to contradict.

{/* FOOTER */}
