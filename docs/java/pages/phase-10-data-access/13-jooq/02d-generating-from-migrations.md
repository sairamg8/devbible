---
title: "Generating from your migration scripts with DDLDatabase needs no server at all, at the cost of everything jOOQ's parser and an in-memory H2 cannot represent"
sidebar_label: "02d · Generating from migrations"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *DDLDatabase*
> ([codegen-ddl](https://www.jooq.org/doc/latest/manual/code-generation/codegen-ddl/))
> and *Configuration and setup of the generator*
> ([codegen-configuration](http://www.jooq.org/doc/latest/manual/code-generation/codegen-configuration/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.0, PostgreSQL 18.

**Generating against a database somebody's laptop happens to be running is the version of jOOQ
that gives the tool a bad reputation: the build is not reproducible, CI needs a server nobody
owns, and "works on my machine" acquires a new and worse meaning. The fix is to generate from
the artefact that already defines the schema — the migration scripts — so that a fresh clone
with no database produces exactly the same Java as everyone else's.**

## The problem with a shared development database

The obvious first setup points `<jdbc>` at a development server. It works immediately, and it
fails in four ways that are all invisible on day one.

- **The build stops being reproducible.** Two developers on different branches, or the same
  developer before and after a colleague's migration, generate different Java from the same
  commit.
- **CI needs the database.** Which means credentials in the pipeline, network access from the
  runner, and a build that fails when someone else is mid-migration.
- **Nobody can build offline.** A new joiner cannot compile the project until they have a
  provisioned database, which is a poor first hour.
- **The schema and the migrations can silently diverge.** Someone runs a `CREATE INDEX` by hand,
  the generator sees it, and the code depends on something no migration will ever create in
  production.

Every route below fixes all four by making the migration scripts the input.

⚠️ **Migrations themselves belong to another topic.** The tool, its file naming, its versioning
and its failure modes are **Topic 11 · Migrations with Flyway** *(not written yet)*. This page
is only about how the generator consumes them.

## Route 1 · `DDLDatabase` — no server at all

`DDLDatabase` reads SQL DDL script files directly. The manual is explicit about the mechanism,
and it is worth knowing rather than treating as magic: jOOQ **parses the scripts with its own
SQL parser and applies them to an in-memory H2 database**, then reverse-engineers that H2
instance as if it were your database.

```xml
<database>
  <name>org.jooq.meta.extensions.ddl.DDLDatabase</name>
  <properties>
    <property>
      <key>scripts</key>
      <value>src/main/resources/db/migration/*.sql</value>
    </property>
    <property>
      <key>sort</key>
      <value>flyway</value>
    </property>
    <property>
      <key>unqualifiedSchema</key>
      <value>none</value>
    </property>
  </properties>
</database>
```

The properties that matter:

| Property | What it does |
|---|---|
| `scripts` | ant-style pattern selecting the DDL files |
| `sort` | `semantic`, `alphanumeric`, `flyway` or `none` — the order scripts are applied in |
| `defaultNameCase` | `as_is`, `upper` or `lower` |
| `unqualifiedSchema` | `public` or `none` — what an unqualified object belongs to |
| `parseIgnoreComments` | default `true`, with `parseIgnoreCommentStart` / `Stop` |
| `logExecutedQueries` / `logExecutionResults` | diagnostics while getting it working |

**`sort` set to `flyway` is the one to remember**, because migration files are ordered by
version, not alphabetically, and `V10__` sorts before `V2__` under the alphanumeric default.

Requires `org.jooq:jooq-meta-extensions` on the plugin's classpath.

### The limitation, and it is a real one

Two things follow from "parsed by jOOQ, applied to H2":

1. **The DDL must be syntax jOOQ's parser can represent.** Vendor-specific PostgreSQL syntax
   the parser does not model will fail the script.
2. **The schema replica is H2, not PostgreSQL.** Anything PostgreSQL-only that survives parsing
   still has to exist in H2 for the reverse-engineering step to see it.

For a schema of tables, columns, keys and indexes this is fine and the route is excellent. For
a schema using PostgreSQL's more interesting features — exclusion constraints, partitioning,
custom operators, extensions — you will meet the edges.

jOOQ provides an escape hatch for the statements that cannot pass:

```sql
-- [jooq ignore start]
CREATE EXTENSION IF NOT EXISTS postgis;
-- [jooq ignore stop]
```

⚠️ That is an escape hatch with a price: whatever you skip is invisible to the generator, so
columns depending on it are missing or mistyped in the generated API.

## When this route is right

It is the right default for a large number of projects, and the reasons are all about the
build rather than about jOOQ:

- **A clean clone compiles with no network, no Docker and no credentials.** That is the
  strongest single argument, and it is worth a lot on a project people join.
- **It is the fastest of the routes** — no container to pull, no server to wait for.
- **It cannot drift**, because there is no database anyone could have altered by hand.

It stops being right the moment your schema depends on PostgreSQL features the parser or H2
cannot hold. That threshold arrives sooner than people expect on a schema using `jsonb`
constraints, partitioning, extensions or exclusion constraints, and the alternatives are in
**[02e · Generating from a real database](02e-generating-from-a-real-database.md)**.

## Gotchas

**★ `sort` defaults to something that is not migration order.** Flyway versions are not
alphanumerically ordered — `V10__` sorts before `V2__` — so `DDLDatabase` with the default sort
applies your migrations in the wrong sequence and fails on a column that does not exist yet.
Set `sort` to `flyway`.

**★ `DDLDatabase` builds an H2 replica, so H2's limits become your generator's limits.** This is
the single fact people miss, and it explains almost every "why does this DDL not work" question
about the route. It is not that jOOQ dislikes your SQL; it is that the intermediate database
does.

**★ `-- [jooq ignore start]` hides the statement from the generator, not just from the parser.**
Whatever you skipped does not exist as far as the generated API is concerned. Skipping a
`CREATE TABLE` to get the build green means that table has no Java class, and the compile error
that follows is the honest one.

**★ The ignore markers are comments, and `parseIgnoreComments` defaults to `true`.** If you have
customised the comment handling — or your migration tool strips comments — the markers stop
working and the failure is a parse error on a statement you thought was excluded.

**★ Repeatable migrations and `sort` interact badly if you are not careful.** Flyway's `R__`
scripts run after versioned ones, every time. A sort that does not understand that ordering can
apply a repeatable view definition before the table it selects from exists.

**★ Undo or rollback scripts in the same directory get applied as if they were migrations.** The
`scripts` pattern is a glob, and it has no idea that `U3__drop_orders.sql` was meant to be
conditional. Scope the pattern, or keep those scripts elsewhere.

**★ `unqualifiedSchema` decides whether your objects land in `public` or in nothing**, and
getting it wrong produces a generated schema with the right tables under the wrong parent —
which shows up as import paths that do not match anyone's expectations.

**★ Data-manipulation statements in your migrations run too.** Seed `INSERT`s are executed
against the throwaway H2 instance, which is usually harmless and occasionally slow, and will
fail outright if they use PostgreSQL syntax the parser does not model.

**★ The migration history table gets generated unless you exclude it.** If a script in your
pattern creates it, `DDLDatabase` sees it like any other table.
`<excludes>flyway_schema_history</excludes>` belongs in every configuration regardless of route.

**★ A schema that generates fine under `DDLDatabase` can still be wrong.** The route proves the
DDL parses, not that PostgreSQL would accept it. It is a weaker check than running the
migrations for real, and that difference is exactly the gap route 3 closes.

**★ Switching from `DDLDatabase` to a real database later is not free.** Columns whose type the
H2 replica approximated may generate differently, and the change lands as a compile sweep.
Treat the switch as a change worth reading the diff of.

## Interview questions

**★ Why is generating against a shared development database a bad idea?** The build stops being
reproducible, CI needs a server and credentials, a fresh clone cannot compile offline, and
manual changes to that database silently become dependencies of your code. Generating from
migrations fixes all four.

**★ How does `DDLDatabase` work internally?** It parses your DDL scripts with jOOQ's own SQL
parser and applies them to an in-memory H2 database, then reverse-engineers that H2 instance as
if it were the real schema.

**★ What limitation does that mechanism create?** Two. The DDL must be syntax jOOQ's parser can
represent, and the resulting schema must be something H2 can hold. PostgreSQL-only features run
out at one of those two points.

**★ Your `DDLDatabase` generation fails on a migration that runs fine in production. First
thing you check?** Whether the statement is PostgreSQL syntax jOOQ's parser does not model, and
whether the scripts are being applied in migration order — `sort` set to `flyway` rather than
the alphanumeric default.

**★ What does `sort=flyway` do and why does it matter?** It orders the scripts by Flyway version
semantics rather than alphabetically. It matters because `V10__` sorts before `V2__`
alphanumerically, so the default order applies migration 10 before migration 2 and the schema
falls apart.

**★ What are the `[jooq ignore start]` / `[jooq ignore stop]` markers for, and what do they
cost?** They tell the parser to skip statements it cannot handle — a `CREATE EXTENSION`, a
vendor-specific `ALTER`. The cost is that everything skipped is invisible to the generator, so
any column or type that depended on it is missing or mistyped in the generated API.

**★ Which artifact do you need on the classpath for `DDLDatabase`?**
`org.jooq:jooq-meta-extensions` — it is not part of `jooq-meta`, and the missing-class error you
get without it does not obviously say so.

**★ The team wants offline builds and uses only plain SQL DDL. What do you recommend?**
`DDLDatabase`. No server, no container runtime, no network; it is the fastest of the routes, and
for a schema of tables, columns, keys and indexes its limitations never bite.

**★ Does generating from migration scripts guarantee your code matches production?** No. It
guarantees your Java matches your migration scripts. Whether the real database matches those
scripts is a deployment discipline question that no code generator can answer.

**★ When would you move off this route?** When the schema starts depending on PostgreSQL
features the parser or H2 cannot represent — extensions, partitioning, exclusion constraints,
richer `jsonb` usage — because at that point the generated API is an approximation of the schema
rather than a reflection of it.

{/* FOOTER */}
