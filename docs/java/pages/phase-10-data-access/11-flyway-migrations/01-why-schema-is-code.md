---
title: "the schema is the one part of your application that survives every deployment, so it is the one part that most needs a reviewed, ordered, replayable history — and a migration tool is nothing more than that history plus a table that remembers where you got to"
sidebar_label: "01 · Why schema is code"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Redgate Flyway documentation *Migrations*
> ([documentation.red-gate.com/fd/migrations-271585107.html](https://documentation.red-gate.com/fd/migrations-271585107.html)),
> *Versioned migrations*
> ([documentation.red-gate.com/fd/versioned-migrations-273973333.html](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html)),
> the Hibernate ORM 7.4 *User Guide* §31.1 *Schema management*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and the Spring Boot 4.1 how-to *Use a Higher-level Database Migration Tool*
> ([docs.spring.io/spring-boot/how-to/data-initialization.html](https://docs.spring.io/spring-boot/how-to/data-initialization.html)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**Your Java code is thrown away and replaced on every deploy. Your database is not — it is the
same rows, carried forward, one version to the next, for years. That asymmetry is the whole
argument: a change to code is a replacement and a change to schema is an *edit applied in
place*, so it needs an order, an exactly-once guarantee, and a record of what was actually
done. A migration tool is those three things and almost nothing else.**

## Where topic 06 left this

[17 · `ddl-auto`](../06-jpa-hibernate-model/17-ddl-auto.md) and
[17b · Why `update` is never production](../06-jpa-hibernate-model/17b-why-update-is-never-production.md)
finished the case against letting Hibernate maintain your schema. The short version of what
they established, because this topic starts from it rather than repeating it:

- `hibernate.hbm2ddl.auto=update` only ever **adds**. It never drops a column, never narrows a
  type, never renames, and never retro-applies a `not null` or a `unique` to existing rows.
- Because it only adds, it **cannot fail** — and a schema change that cannot fail gives you no
  signal at all.
- Hibernate's own User Guide says it plainly: *"this feature is not suitable for a production
  environment"*, followed immediately by *"You should always use an automatic schema migration
  tool and have all the migration scripts stored in the Version Control System."*

So the question this topic answers is the next one: **what does that tool have to do, and what
does it feel like to live with?**

## Three properties, and everything else is detail

Strip a migration tool down and it guarantees exactly three things.

**Ordered.** Changes apply in a defined sequence. `V3` cannot run before `V2`, because `V3`
adds an index on a column `V2` created. Order is not a nicety; it is the only thing that makes
a chain of edits meaningful.

**Exactly once.** A change that has already been applied to this database is not applied again.
Restarting the service must not re-run `V2`. Ten pods starting at once must not run `V7` ten
times.

**Recorded.** The database itself carries the record of what has been applied to it. Not a wiki
page, not a Jira ticket, not somebody's memory — a table, in the same database, updated in the
same breath as the change.

The third is what makes the first two possible, and it is why every migration tool's first act
against a new database is to create a bookkeeping table. Flyway's is called
`flyway_schema_history`, and it is
[03 · The history table](03-the-history-table.md).

## What "schema is code" actually commits you to

The phrase gets used loosely. Concretely, it means five things, and each of them is a habit
rather than a tool feature.

**1. The change lives in the repository, next to the code that needs it.** The `ALTER TABLE`
that adds `orders.cancelled_at` is in the same pull request as the `Order.cancelledAt` field
and the endpoint that sets it. A reviewer sees all three at once.

**2. It is reviewed like code.** Somebody other than the author reads the DDL before it runs
anywhere. This is the single highest-value part of the whole practice and it is the part teams
skip, because a `.sql` file looks like configuration rather than logic.

**3. It is immutable once applied.** A migration that has run somewhere is history. You do not
edit history; you add to it. This is enforced, not merely encouraged — see
[04 · Checksums and immutability](04-checksums-and-immutability.md).

**4. Every environment gets the same sequence.** Your laptop, CI, staging and production run
identical files in identical order. A schema is then reproducible from nothing, which means a
new environment is a `migrate` away rather than an archaeology project.

**5. It rolls forward.** The fix for a bad migration is another migration, not an undo. This
is a genuine design decision and it is discussed where it belongs, in
[04 · Checksums and immutability](04-checksums-and-immutability.md) — but it is worth naming
early because it surprises people arriving from tools that promise rollback.

## The diff nobody reviewed

Here is the failure this practice exists to prevent, in the order it actually happens.

Someone adds a field to an entity. `ddl-auto` is `update` in the development profile, so the
column appears on their laptop and the feature works. The pull request contains Java only —
there is no schema artefact to review, because the schema change was a side effect of running
the application. It merges.

Staging has `ddl-auto: update` too, so it works there. Production has `ddl-auto: none`, because
somebody sensible set it that way years ago. The deploy goes out and every write to that table
fails with a column that does not exist.

Now the fix is applied by hand, at speed, by whoever has production credentials, at the moment
of maximum pressure. Nothing records what they typed. Six months later a second environment is
built from the migration history and does not match production, and nobody can say why.

Every step of that is normal. None of it involves anybody being careless. It is a process
failure, and the process fix is that **a schema change is an artefact in the repository or it
does not exist.**

## What Flyway is

Flyway is a migration runner: it finds migration files, works out which have not been applied
to this database, applies the missing ones in order, and records each one in the history table.
The rest of it — placeholders, callbacks, baselines, repeatable migrations — is refinement
around that loop.

Two things about the shape of it on this stack matter from the first line of the build file.

**Flyway is split into a core plus per-database modules.** Spring Boot's how-to is explicit:
*"In-memory and file-based databases are supported by the `spring-boot-starter-flyway` starter.
Other cases require also a database-specific module. For example, use
`org.flywaydb:flyway-database-postgresql` with PostgreSQL"*. Forgetting the second dependency
is one of the most common first-run failures, and it is
[02b · Where migrations live](02b-where-they-live.md)'s problem as much as this one's.

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-flyway</artifactId>
</dependency>
<dependency>
  <groupId>org.flywaydb</groupId>
  <artifactId>flyway-database-postgresql</artifactId>
</dependency>
```

**Migrations are plain SQL by default.** Not a DSL, not XML, not YAML. The file you write is
the SQL your database will execute, which means everything your database can do is available
to you — partial indexes, `GENERATED ... AS IDENTITY`, extensions, partitioning, `COMMENT ON`
— and nothing has to be expressible in an abstraction layer first.

```sql
-- V4__add_cancelled_at_to_orders.sql
ALTER TABLE orders
    ADD COLUMN cancelled_at timestamptz;

CREATE INDEX idx_orders_cancelled_at
    ON orders (cancelled_at)
    WHERE cancelled_at IS NOT NULL;
```

That partial index is the point. It is one line of PostgreSQL and there is no version of
`ddl-auto` that will ever produce it.

## Liquibase, in two sentences

Liquibase is the other mainstream JVM migration tool and Spring Boot auto-configures it just as
readily. Its distinguishing choice is a **database-independent changelog** — changesets
authored in XML, YAML or JSON that Liquibase translates into each vendor's DDL, with automatic
rollback statements generated for the subset of change types it understands.

That is a real trade and not a wrong one: you gain portability across engines and generated
rollbacks, you pay in an abstraction layer between you and the SQL you are actually running.
If your schema is going to use PostgreSQL-specific features — and if you have read
[04 · PostgreSQL has three levels](../03-jdbc-transactions/04-postgresql-has-three-levels.md)
you already know it will — the abstraction is a cost without a benefit. This topic teaches
Flyway. Liquibase is not taught here beyond this paragraph.

## Where migrations run from

There are two defensible answers and this topic will come back to both.

**On application startup**, which is what Spring Boot gives you for free: Flyway runs inside the
application context, before anything that touches the database is built. Simple, no extra
moving parts, and it is what almost everyone does.

**From the deployment pipeline**, as a separate step before any new instance starts: the Flyway
command line or Maven plugin runs `migrate`, and the application itself has `spring.flyway.
enabled: false`. More moving parts, but the migration is a deployment stage with its own
success or failure rather than something hidden inside a pod's startup.

Boot's arrangement, and why it guarantees migrations finish before Hibernate looks at the
schema, is [07 · Boot integration](07-boot-integration.md). What changes when there are ten
instances rather than one is [09 · Many instances, one database](09-many-instances-one-database.md).

## Gotchas

**★ A migration tool does not stop you from writing a destructive migration.** It guarantees
order, exactly-once and a record. It has no opinion about whether `DROP TABLE customers` is a
good idea. The review step is what protects you, and the tool cannot supply it.

**★ Adding Flyway silently changes Hibernate's `ddl-auto` default.** Boot computes the default
from the `DataSource` *and* from whether a schema manager is on the classpath. On an embedded
database the default goes from `create-drop` to `none` the moment Flyway appears — so tests
that relied on Hibernate creating the schema stop having a schema. Full precedence table in
[17 · `ddl-auto`](../06-jpa-hibernate-model/17-ddl-auto.md).

**★ The starter alone is not enough for PostgreSQL.** `spring-boot-starter-flyway` covers
in-memory and file-based databases; PostgreSQL needs `org.flywaydb:flyway-database-postgresql`
as well.

**★ "Schema is code" fails at the review step long before it fails at the tool.** A team can
have Flyway wired perfectly and still merge unreviewed DDL, which produces exactly the outage
the tool was adopted to prevent — just with a better audit trail of who caused it.

**★ Migrations in the repository do not make the schema reproducible on their own.** They make
it reproducible *from empty*. A database that predates Flyway needs baselining first, or the
first `migrate` will refuse to run — [06 · Baselining](06-baselining.md).

**★ Rolling forward is a constraint, not a limitation you can configure away.** Undo migrations
exist but are a paid-edition feature and, by the documentation's own admission, work poorly for
data. Designing as though rollback is available is the mistake.

**★ A schema change and the code that needs it are one deployment unit in the repository and
two events in production.** They are applied at different moments and both orders happen. That
is the entire subject of [08 · Migrating a live service](08-migrating-a-live-service.md), and
it is the part people discover the hard way.

**★ The migration tool owns the schema completely, or it does not own it at all.** A single
hand-run `ALTER TABLE` in production puts the database into a state no migration sequence
produces, and every later environment silently diverges from it.

## Interview questions

**★ Why can't Hibernate manage the schema in production?**
Because `ddl-auto: update` is additive only: it never drops, narrows, renames or retro-applies
constraints, so any non-additive change leaves the database describing something other than the
mapping — silently, because an additive tool cannot fail. Hibernate's own User Guide says it is
"not suitable for a production environment" and tells you to use a migration tool instead.

**★ What does a migration tool actually guarantee?**
Three things: changes apply in a defined order, each applies exactly once per database, and the
database itself records what was applied, when, and whether it succeeded. Everything else is
convenience on top.

**★ Why does the record live in the database rather than in the repository?**
Because the question being answered is "what has been applied *to this database*", and each
database has a different answer. The repository knows what exists; only the database knows what
has run. That is also why a restored backup carries its own history with it and is consistent
by construction.

**★ Flyway or Liquibase?**
Liquibase abstracts the change into a database-independent changelog and can generate rollbacks
for the change types it models; Flyway runs the SQL you wrote. If you need to target several
engines from one changelog, Liquibase's abstraction earns its cost. If you are on one engine
and want its specific features — partial indexes, `CREATE INDEX CONCURRENTLY`, extensions — the
abstraction is a layer between you and the thing you are trying to say.

**★ Why is "roll forward" the default philosophy?**
Because a migration that failed halfway did not necessarily leave a state any script can
mechanically reverse, and because reversing a schema change often cannot reverse the data change
that came with it. Dropping a column you added is easy; restoring the rows you deleted is not.
The safe general answer is a new migration that moves forward to a correct state.

**★ Where should migrations be executed from — the application or the pipeline?**
Application startup is Boot's default and is right for most services: one moving part, and
migrations are guaranteed to have run before anything queries. A separate pipeline step is
better when the migration is long, when you want it to be an explicit deployment gate with its
own failure, or when the application's database user should not hold DDL rights.

**★ Your teammate says migrations make the schema reproducible. What is the caveat?**
Reproducible *from empty*, and only if nobody has ever touched the schema outside the tool. A
database that existed before Flyway was adopted, or that has had a manual fix applied to it, is
not described by the migration sequence, and the divergence will not announce itself.

**★ What is the single most valuable part of adopting a migration tool?**
That the schema change becomes a reviewable artefact in a pull request. The ordering and the
bookkeeping are what the tool does; the review is what prevents the outage, and it is only
possible because the change is now a file somebody wrote deliberately.

<!--FOOTER-->
