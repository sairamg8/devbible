---
title: "Adopting Flyway on a database that already exists is a five-step procedure whose whole difficulty is one decision — whether the first migration describes the schema you already have or only the changes from now on"
sidebar_label: "06b · Adopting it on an existing database"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's `DbBaseline`
> ([DbBaseline.java](https://github.com/flyway/flyway/blob/main/flyway-core/src/main/java/org/flywaydb/core/internal/command/DbBaseline.java)),
> the *Baseline On Migrate* setting
> ([documentation.red-gate.com](https://documentation.red-gate.com/fd/flyway-baseline-on-migrate-setting-277578942.html)),
> the *Baseline* command reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/commands/baseline)),
> and Spring Boot 4.1's `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayProperties.java)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**The mechanics of [06](06-baselining.md) are easy. The decision underneath them is not, and it is
made once: does your migration set describe the *whole* schema, so that an empty database can be
built from it, or only the changes from today onward? Choosing the second is faster and it
permanently gives up the ability to create a fresh environment from the repository — which is most
of why you wanted migrations. Choose deliberately, and write down which one you chose.**

## The decision, before any commands

| | **Option A — capture the schema** | **Option B — start from today** |
|---|---|---|
| `V1` contains | the whole existing schema, dumped and tidied | nothing; the first file is your next change |
| Empty database | ✅ can be built from the repository | ⛔ cannot, ever |
| Existing database | baselined so `V1` does not re-run | baselined at the current version |
| Effort | a day, sometimes more | an hour |
| Test databases | real, from migrations | must come from a production dump |
| Reversible later? | — | ⚠️ only by doing option A afterwards |

**Option A is the one to take unless you have a specific reason not to.** Option B is a permanent
trade: from then on, "build a fresh database" means "restore a dump", so every test environment
depends on a copy of production, and [11 · Testing migrations](11-testing-migrations.md) becomes
much harder.

## The procedure, option A

### 1. Capture the schema as SQL, with no data

`pg_dump --schema-only` produces the DDL for everything. The output is a starting point, not a
migration — it carries `SET` statements, ownership, `search_path` manipulation and comments that do
not belong in a repository file.

```
V1__Existing_schema.sql        <- the tidied dump; must be runnable against an empty database
V2__Add_customer_region.sql    <- the first genuinely new change
```

⚠️ **Strip the environment out of it.** Owners, tablespaces, database names and any `CREATE
DATABASE` are per-environment facts; leaving them in means `V1` only works on the machine it was
dumped from. Extensions (`CREATE EXTENSION IF NOT EXISTS …`) usually do belong.

### 2. Prove `V1` builds an empty database

This is the step that makes option A worth anything, and it is the step people skip. Run `V1`
against a genuinely empty database and compare the result to the original schema. Until that has
been done, `V1` is a plausible file rather than a verified one.

⚠️ **Compare, do not eyeball.** A dump-and-diff of both schemas is the only check that catches the
constraint that did not come across or the default that was rendered differently.

### 3. Baseline every existing database at `1`

Because `V1` describes what they already contain:

```yaml
spring:
  flyway:
    baseline-version: 1
    baseline-description: "Existing schema as of 2026-08"
```

Run `baseline` once per environment — production, staging, and any long-lived developer database.
An empty database gets no baseline at all: it runs `V1` for real.

⚠️ **This is the one moment the two paths diverge permanently**, and it is worth being explicit
about it in the runbook: baselined databases will never execute `V1`, and fresh ones always will.
Both are correct, and they are verified to agree only as far as step 2 established.

### 4. Turn validation on and leave it on

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate
```

Flyway's own `validate-on-migrate` is already `true` by default. Pairing it with Hibernate's
schema validation is what turns the adoption into an ongoing guarantee rather than a one-off tidy
— [07b · Validate, not update](07b-validate-not-update.md) argues that in full, and
[06 · The JPA/Hibernate model](../06-jpa-hibernate-model/17-ddl-auto.md) has already established why
`update` is never the answer.

### 5. Write down the baseline version

In the repository, next to the migrations. The `BASELINE` row is the authoritative record, but it
lives in each database rather than in the repository, and six months later nobody will remember why
`V1` does not run in production.

## `baseline-on-migrate`: convenient, and the documentation warns about it

> *"Whether to automatically call baseline when migrate is executed against a non-empty schema with
> no schema history table."* … *"Only migrations above `baselineVersion` will then be applied."*

🔴 And the warning, verbatim:

> *"Be careful when enabling this as it removes the safety net that ensures Flyway does not migrate
> the wrong database in case of a configuration mistake!"*

That sentence describes a real failure and it is worth spelling out. With `baseline-on-migrate:
true`, an application that starts against **the wrong database** — a stale URL, a copy-pasted
secret, a `docker-compose` pointing at a neighbouring service's volume — finds a non-empty schema
with no history table, writes a baseline into it, and reports success. Without the setting, the
same mistake is a startup failure, which is exactly what you want.

It also silently creates the verification boundary from
[04c](04c-where-the-comparison-does-not-run.md): everything up to `baseline-version` stops being
compared, on a database nobody consciously baselined.

**Where it is defensible:** ephemeral environments created from a template that already has a
schema, where the alternative is an extra bootstrap step and the blast radius is a container that
lives for twenty minutes. **Where it is not:** anywhere the database outlives the deployment.

⚠️ **Its interaction with `baseline-version` is the sharp edge.** The default is `1`, so
`baseline-on-migrate: true` with no explicit version baselines at `1` and then applies `V2` onward
to a schema it knows nothing about. If you enable it at all, set the version explicitly.

## Gotchas

**★ The real decision is whether the repository can build an empty database, and it is permanent.**
Starting from today is an hour's work and gives up fresh environments forever.

**★ A `pg_dump --schema-only` is a starting point, not a migration.** Ownership, tablespaces,
`SET` statements and database names are environment facts that must come out.

**★ `V1` is unverified until it has actually built an empty database and been compared.** This is
the step that makes option A worth the effort and the one that gets skipped.

**★ Eyeballing the dump is not comparing it.** Use a schema diff; the things that go missing are
constraints and defaults, which do not stand out in a five-hundred-line file.

**★ Baseline every long-lived database, including developer ones.** A developer database that was
never baselined will try to run `V1` against a schema that already has it.

**★ Do not baseline an empty database.** It needs to run `V1` for real, and baselining it means it
never will.

**★ `baseline-on-migrate` will silently adopt the wrong database.** The documentation's own warning
says it removes the safety net that stops Flyway migrating a database it was never meant to see.

**★ `baseline-on-migrate` with the default `baseline-version: 1` baselines at `1` and then applies
`V2` onward.** If you enable it, set the version explicitly or it will do something arbitrary.

**★ Baselining is per database, and it is easy to miss one.** The environment nobody remembers —
an old QA box, a personal copy — is the one that fails months later.

**★ Record the baseline version in the repository.** The authoritative copy lives in each database's
`BASELINE` row, which is exactly where nobody looks.

**★ Adoption is the last moment the two build paths are cheap to reconcile.** After it, the
baselined database and the replayed one drift with every migration nobody tested from empty.

**★ `V1` describing the whole schema does not mean `V1` may ever be edited.** It is an applied
migration like any other from the moment it ships — [04](04-checksums-and-immutability.md) applies
to it in full.

## Interview questions

**★ How do you introduce Flyway to a database that already has forty tables?**
Capture the existing schema as `V1`, prove it builds an empty database and compare, then `baseline`
every existing database at version `1` so `V1` never re-runs there. New migrations start at `V2`.
Then turn on `ddl-auto: validate` and leave Flyway's `validate-on-migrate` at its default.

**★ What is the alternative, and what does it cost?**
Baseline at the current version and let the first migration be your next change. It takes an hour
instead of a day, and it permanently removes the ability to build a database from the repository —
so every test environment has to come from a production dump.

**★ Why must you prove `V1` builds an empty database?**
Because that is the only thing that makes the two paths equivalent. Baselined databases never run
`V1`; fresh ones only ever run `V1`. If `V1` does not actually reproduce the schema, the two
diverge from day one and nothing will report it.

**★ What do you have to strip out of a `pg_dump --schema-only`?**
Anything that is a property of the environment rather than the schema: ownership, tablespaces,
`CREATE DATABASE`, connection-level `SET` statements. Extensions usually stay, because they are a
real requirement of the schema.

**★ Which databases do you baseline?**
Every one that already has the schema — production, staging, and any long-lived developer or QA
database. Not empty ones: those must run `V1` for real.

**★ What is `baseline-on-migrate` and why is it dangerous?**
It baselines automatically when `migrate` finds a non-empty schema with no history table. The
documentation warns that it removes the safety net against migrating the wrong database: point an
application at a database it should never have seen and, instead of failing, it adopts it.

**★ Is there any case where `baseline-on-migrate` is reasonable?**
Ephemeral environments built from a template that already carries a schema, where the database
lives for minutes and the alternative is an extra bootstrap step. Never where the database outlives
the deployment.

**★ What is the trap in combining `baseline-on-migrate` with the default settings?**
`baseline-version` defaults to `1`, so it baselines at `1` and applies `V2` onward to a schema
nobody described. If the setting is enabled at all, the version has to be explicit.

**★ Six months after adoption, how does anyone know why `V1` never runs in production?**
Only if it was written down. The authoritative record is the `BASELINE` row in each database, which
is not in the repository and not in any log anybody reads — so the adoption decision belongs in a
file next to the migrations.

**★ You adopted with option B and now want fresh test databases. What is involved?**
Doing option A late: capture the current schema as a migration that can build an empty database,
verify it, and arrange for existing databases to skip it. It is the same work, done with more
migrations already in the history — which is what baseline migrations
([06c](06c-baseline-migrations-and-collapsing-history.md)) are for.

**★ Can `V1` be edited after adoption if you find something missing from the dump?**
No — it is an applied migration everywhere it ran. The correction is `V2`, or `V3` if `V2` is
already taken. The fact that `V1` was generated rather than hand-written does not exempt it.

{/* FOOTER */}
