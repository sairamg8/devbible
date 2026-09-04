---
title: "The jOOQ code generator reads your real schema and emits a Java API from it, which inverts the direction every ORM points in"
sidebar_label: "02 · Code generation"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *Code generation*
> ([jooq.org/doc/latest/manual/code-generation/](https://www.jooq.org/doc/latest/manual/code-generation/)),
> *Configuration and setup of the generator*
> ([codegen-configuration](http://www.jooq.org/doc/latest/manual/code-generation/codegen-configuration/)),
> *Generated records*
> ([codegen-records](https://www.jooq.org/doc/latest/manual/code-generation/codegen-object-types/codegen-records/))
> and the *jOOQ in 7 steps* tutorial
> ([step 3](https://www.jooq.org/doc/latest/manual/getting-started/tutorials/jooq-in-7-steps/jooq-in-7-steps-step3/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**The generator connects to a schema, reads its catalogue, and writes a Java class for every
table, column, key, index and sequence it finds. From that moment your schema is a Java API:
`ORDERS.PLACED_AT` is a `TableField<OrdersRecord, OffsetDateTime>` that exists because a
`placed_at timestamptz` column exists. Delete the column, regenerate, and the code that used
it stops compiling. That is the entire value proposition of jOOQ, and everything else in this
topic is downstream of it.**

## The arrow points the other way

Both JPA and jOOQ have a Java model and a database schema, and both need them to agree. They
disagree completely about which one is the original.

In JPA, the **entity is the model**. You write `@Entity class Order`, and the schema is
something you arrange to match — by hand in a migration, or by letting
**[`ddl-auto`](../06-jpa-hibernate-model/17-ddl-auto.md)** derive it, which
**[is never what you do in production](../06-jpa-hibernate-model/17b-why-update-is-never-production.md)**.
The mismatch between the two is discovered when a query runs.

In jOOQ, the **schema is the model** and the Java is derived. There is nothing to keep in
sync, because one side is generated from the other. A schema change your code has not caught
up with is not a runtime surprise; it is a build failure.

This is worth stating plainly, because it settles an argument that stays open elsewhere. "Who
owns the schema, the developers or the DBA?" is a live question in a JPA codebase. Under jOOQ
it is settled by construction: the database owns it, and Java reads it.

## Where the generator gets a schema from

The generator's `<database>` element names a dialect implementation from `jooq-meta`, which the
manual describes as classes named `org.jooq.meta.[database].[database]Database`. For this
phase's spine that is `org.jooq.meta.postgres.PostgresDatabase`, pointed at a live PostgreSQL
server through a `<jdbc>` block.

There are three practical sources, and the choice matters more than it first appears:

| Source | `<database><name>` | What it needs at build time |
|---|---|---|
| A live database | `org.jooq.meta.postgres.PostgresDatabase` | a reachable server with the schema applied |
| SQL DDL script files | `org.jooq.meta.extensions.ddl.DDLDatabase` | the `.sql` files, and nothing else |
| A Liquibase changelog | `org.jooq.meta.extensions.liquibase.LiquibaseDatabase` | the changelog, and nothing else |

A live database is the highest-fidelity option — it is the actual catalogue, including
everything a parser might not understand. It is also the one that makes your build depend on a
server being up, which is the objection people raise first and the reason
**[02d · Generating from migrations](02d-generating-from-migrations.md)** exists.

⚠️ The extension-based sources live in a separate artifact, `org.jooq:jooq-meta-extensions`,
not in `jooq-meta` itself.

## What it emits

Run the generator over a schema and you get a source tree with a predictable shape. Using a
`public` schema containing `orders` and `customer`, and a target package of `com.example.db`:

```
com/example/db/
├── Public.java                     the schema, as a class
├── Tables.java                     static references to every table
├── Keys.java                       primary keys, unique keys, foreign keys
├── Indexes.java                    indexes
├── Sequences.java                  sequences
├── tables/
│   ├── Orders.java                 the table, and its columns as fields
│   └── Customer.java
└── tables/records/
    ├── OrdersRecord.java           one row of orders, typed
    └── CustomerRecord.java
```

The manual's own tutorial shows exactly this arrangement — a schema class, table classes under
`<package>.tables`, and record classes under `<package>.tables.records`.

### The table class is where the type safety lives

A generated table class holds one `TableField` per column, and the second type parameter of
each is the Java type the column maps to:

```java
public class Orders extends TableImpl<OrdersRecord> {

    public static final Orders ORDERS = new Orders();

    public final TableField<OrdersRecord, Long>           ID;
    public final TableField<OrdersRecord, Long>           CUSTOMER_ID;
    public final TableField<OrdersRecord, String>         STATUS;
    public final TableField<OrdersRecord, Long>           TOTAL_CENTS;
    public final TableField<OrdersRecord, OffsetDateTime> PLACED_AT;

    public Orders as(String alias) { /* … */ }
    // …plus getPrimaryKey(), getReferences(), getIndexes()
}
```

Three things follow from those signatures, and they are the three things people mean when they
say "type-safe SQL":

1. **`ORDERS.TOTAL_CENTS.eq("paid")` does not compile.** `eq` on a `Field<Long>` takes a
   `Long`. What would have been a runtime type error in a SQL string is a red squiggle.
2. **`ORDERS.PLACED_AT` is `OffsetDateTime`, not `Object`.** The mapping from `timestamptz` to
   a JDK time type was decided once, by the generator, from the actual column type — not
   repeated in every `RowMapper` the way **[topic 05](../05-sql-first-access/03-rowmapper.md)**
   has to.
3. **The field only exists if the column does.** This is the one that catches real bugs: a
   rename in a migration turns every reference into a compile error, all at once, in a list
   your IDE can walk.

### The record class is one row, typed

`OrdersRecord` is generated as an `UpdatableRecord` because `orders` has a primary key. The
manual is precise: every table and view generates a `TableRecord` implementation, "or
`org.jooq.UpdatableRecord` if there's a primary key". A view, a table with no primary key, or a
generator configured to ignore keys yields the plain `TableRecord`, and the difference is not
cosmetic — `store()`, `update()`, `delete()` and `refresh()` are `UpdatableRecord` methods.
**[05 · Writes](05-writes.md)** uses them.

⚠️ **`recordsImplementingRecordN` defaults to `false` from jOOQ 3.19 onwards.** The `Record1` …
`Record22` interfaces give a record its *degree* in the type system, and the manual's note on
the flag is that turning it on "may impact compilation speeds". If degree typing is not there,
this default is why, and it changed deliberately.

### The `Tables` class is what you static-import

`Tables.java` collects a `public static final` reference to each table, which is why jOOQ code
reads the way it does:

```java
import static com.example.db.Tables.CUSTOMER;
import static com.example.db.Tables.ORDERS;
import static org.jooq.impl.DSL.*;
```

Those two import styles — the generated `Tables` and the static `DSL` — are the whole ceremony.
Everything after them looks like SQL because the identifiers *are* the schema's identifiers.

## The loop this buys you

The reason to accept a build step is a single workflow, worth writing out because it is what
actually changes day to day:

1. Someone writes a migration renaming `orders.total_cents` to `orders.total_minor_units`.
2. The generator runs as part of the build.
3. `ORDERS.TOTAL_CENTS` no longer exists.
4. **Every** call site fails to compile — the repository, a report, a test fixture, that one
   admin endpoint nobody remembers.
5. You fix them, and the build goes green when you have found all of them.

Compare the same rename under `JdbcClient`: the SQL strings still compile. They fail at
runtime, one endpoint at a time, in whatever order users happen to hit them, possibly weeks
apart. **[Topic 05's own case for SQL-first](../05-sql-first-access/01-why-sql-first-exists.md)**
does not include a way out of that, because for strings there is not one.

⚠️ The loop only holds if step 2 is real. A generated source tree checked into git and
regenerated "when someone remembers" gives you all of the build cost and none of the guarantee.

## Gotchas

**★ The generated code is a snapshot, and the guarantee is only as good as the last run.**
Everything above assumes the generator ran against the current schema. If it did not, the
compiler is faithfully checking your queries against a schema that no longer exists — and
checking them *confidently*. This is the biggest way teams get less out of jOOQ than they paid
for.

**★ Generating from a live database makes your build need a database.** For a team that
usually means everyone needs the same one, or a local one they keep migrated. It is a real
operational cost, and the reason the DDL and container routes exist.

**★ Regenerating is not a merge — the output directory is overwritten.** Anything hand-edited
in a generated file is gone on the next run, which is obvious right up until someone "just
fixes" a mapping there and it works for a week.

**★ A view generates a `TableRecord`, not an `UpdatableRecord`.** So does a table with no
primary key. Code written against `store()` will not compile for those, which is correct
behaviour presenting as a confusing error message.

**★ `recordsImplementingRecordN` being `false` by default since 3.19 changes what old examples
compile to.** Blog posts and Stack Overflow answers from before that assume `Record1<…>` degree
typing is present. If you are copying one and the types do not line up, check the flag before
doubting yourself.

**★ Generated sources under `target/generated-sources` are invisible until the IDE is told
about them.** Maven's build helper or the plugin's own source registration usually handles it;
when it does not, you get thousands of "cannot resolve symbol" errors in an editor while the
command-line build is perfectly green.

**★ PostgreSQL folds unquoted identifiers to lower case, and jOOQ generates from what is
actually stored.** A table created as `"OrderItem"` with quotes is genuinely named `OrderItem`,
and the generated Java reflects that. Mixed-case identifiers in the schema produce mixed-case
awkwardness in the generated code forever.

**★ Two schemas with a table of the same name collide at the static import.** `Tables.ORDERS`
exists once per generated schema package; importing both is an ambiguity the compiler will make
you resolve by qualifying. This is a good problem — it is the schema's ambiguity, surfaced.

**★ A column type jOOQ does not recognise does not fail the build — it degrades.** Unknown or
vendor-specific types map to something generic rather than stopping generation, so the type
safety quietly weakens for exactly the columns where you most wanted it. Forced types and
custom bindings are the fix, in
**[02b · Configuring the generator](02b-configuring-the-generator.md)**.

**★ A schema with no comments generates code with no Javadoc.** jOOQ propagates table and
column comments into the generated source. Teams discover the value of `COMMENT ON COLUMN`
about a week after adopting jOOQ, and it is a genuinely good side effect.

**★ Generation time is proportional to the schema, not to your usage of it.** A 400-table
legacy database generates 400 tables' worth of Java even if you query nine of them, and that
cost lands on every build until someone writes an `<includes/>`.

## Interview questions

**★ What is the source of truth in a jOOQ project, and how does that differ from JPA?** The
database schema. jOOQ derives Java from it; JPA derives, or at least expects, the schema to
match hand-written entities. The consequence is that schema/code divergence is a compile error
under jOOQ and a runtime error under JPA.

**★ Walk me through what the generator produces for a single table.** A table class holding a
`TableField` per column typed to that column's Java type; a record class implementing
`UpdatableRecord` if there is a primary key or `TableRecord` if not; entries in the generated
`Keys` and `Indexes` classes; and a static reference in `Tables`. Optionally a POJO, an
interface and a DAO.

**★ Why is `ORDERS.PLACED_AT` typed when a `JdbcClient` column name is not?** Because the
generator read the catalogue and knew the column's SQL type, so it could emit
`TableField<OrdersRecord, OffsetDateTime>`. A string-based API has no such moment — the type is
asserted at the mapping site, by hand, every time.

**★ Name the three ways to feed the generator a schema and say when each is right.** A live
JDBC connection: highest fidelity, needs a running server. DDL script files via `DDLDatabase`:
no server, but limited to syntax jOOQ's parser understands. A Liquibase changelog: same trade,
driven by an existing migration tool. A migration-driven throwaway container is the fourth
practical route, and is really the first one with the server made disposable.

**★ Someone renames a column in a migration. What happens under JPA, `JdbcClient` and jOOQ?**
JPA: the entity's `@Column` stops matching, and the failure appears when the query runs — or is
masked until a specific code path executes. `JdbcClient`: the SQL string still compiles and
fails at runtime, one call site at a time. jOOQ: the field disappears and every call site fails
to compile at once.

**★ What is the failure mode of checking generated code into version control?** It works, and
it is a legitimate choice — but only if regeneration is enforced. If it is a manual step, the
compiler validates queries against a stale schema while giving every appearance of safety,
which is worse than not having the check at all.

**★ Why is `<records/>` on by default when most generation flags are not?** Because records are
part of the runtime API rather than a convenience: `selectFrom(ORDERS)` has to return something
typed, so `OrdersRecord` is not really optional. Everything shaped for *your* code — POJOs,
DAOs, interfaces — is opt-in.

**★ What does the generator do about a table with no primary key?** It generates it, with a
`TableRecord` rather than an `UpdatableRecord`. You can still select, insert and delete against
it with explicit statements; what you lose is the record-level `store()`/`update()` API, which
needs a key to identify the row.

**★ Does the generated code depend on the database being reachable at runtime?** No. Generation
is a build-time activity; the generated classes are plain Java describing a schema. At runtime
only `org.jooq:jooq` and a `DataSource` are involved.

**★ Your build passes locally and fails in CI with "cannot find symbol ORDERS".** Almost
certainly the generator did not run in CI, or ran against a different schema — an unmigrated
container, a stale checked-in tree, or a profile that skips the plugin. It is the loop's step 2
missing, and it is the most common jOOQ CI failure.

{/* FOOTER */}
