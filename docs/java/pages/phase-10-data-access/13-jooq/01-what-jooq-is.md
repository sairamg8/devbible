---
title: "jOOQ makes your database schema a Java API, so a wrong column name is a compile error rather than something a user finds"
sidebar_label: "01 · What jOOQ is"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *SQL building*
> ([jooq.org/doc/latest/manual/sql-building/](https://www.jooq.org/doc/latest/manual/sql-building/)),
> *Code generation*
> ([jooq.org/doc/latest/manual/code-generation/](https://www.jooq.org/doc/latest/manual/code-generation/))
> — and the jOOQ downloads page for the current release
> ([jooq.org/download/](https://www.jooq.org/download/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.0, PostgreSQL 18.

**jOOQ runs a code generator over your real schema and emits a Java class per table and a
typed constant per column. You then write SQL — genuinely SQL, clause for clause — out of
those constants instead of out of a string. Rename a column and the build breaks in every
query that used it, at the moment you rename it, on the machine of whoever pulled the
migration. That single property is the whole product; everything else jOOQ does is in
service of it.**

## The one thing a string-based API can never do

Topic 05 argues the SQL-first case at length and lands on `JdbcClient` — you write the SQL
you want, you map the result yourself, nothing is hidden. That argument is correct and this
topic does not repeat it; see
**[10 · When SQL-first beats an entity](../05-sql-first-access/10-when-sql-first-beats-an-entity.md)**.

What that page cannot fix is that the SQL is a `String`:

```java
List<Order> late = jdbcClient
        .sql("""
             select o.id, o.placed_at, o.total_cents, c.display_name
             from orders o join customer c on c.id = o.customer_id
             where o.status = :status and o.placed_at < :cutoff
             """)
        .param("status", "PENDING")
        .param("cutoff", cutoff)
        .query(Order.class)
        .list();
```

Every identifier in there — `orders`, `o.placed_at`, `total_cents`, `c.display_name`,
`o.customer_id` — is invisible to `javac`. So is the fact that `status` is a `varchar` and
`placed_at` a `timestamptz`. The compiler sees one string literal and two named parameters
of static type `Object`.

Now someone lands a migration that renames `total_cents` to `total_minor_units`, or drops
`customer.display_name` in favour of `given_name` and `family_name`. The project compiles.
Every test that does not touch this query passes. The failure surfaces the first time this
code path executes against the migrated database — in CI if you are lucky, in production if
the query lives behind a rarely-used report.

**jOOQ's proposition is that this class of failure should not be possible.**

## Three parts, and only one of them is a library you call

People say "jOOQ" and mean any of three things. Keeping them apart makes the rest of this
topic much easier.

| Part | Artifact | When it runs | What it is |
|---|---|---|---|
| The **code generator** | `org.jooq:jooq-codegen` (usually via `jooq-codegen-maven`) | at build time | reads a schema, writes `.java` files |
| The **DSL** | `org.jooq:jooq` | at compile time | a fluent API mirroring the SQL grammar |
| The **runtime** | `org.jooq:jooq` | at runtime | renders for a dialect, binds, executes over JDBC, maps the result |

The generated code is the bridge between them. It is *your* source tree — package name and
directory of your choosing — and it is what makes the DSL specific to your database instead
of generic. Topic **[02 · Code generation](02-code-generation.md)** is entirely about it.

There is no fourth part. There is **no persistence context, no session, no first-level
cache, no dirty checking and no lazy loading.** A jOOQ query is a query.

## What a query looks like

Given `customer` and `orders` tables, the generator produces `Tables.CUSTOMER` and
`Tables.ORDERS`, each with a typed field per column. A query then reads like the SQL it is:

```java
import static com.example.db.Tables.CUSTOMER;
import static com.example.db.Tables.ORDERS;

@Repository
class OrderQueries {

    private final DSLContext dsl;

    OrderQueries(DSLContext dsl) { this.dsl = dsl; }

    List<LateOrder> lateOrders(OrderStatus status, OffsetDateTime cutoff) {
        return dsl
            .select(ORDERS.ID, ORDERS.PLACED_AT, ORDERS.TOTAL_CENTS, CUSTOMER.DISPLAY_NAME)
            .from(ORDERS)
            .join(CUSTOMER).on(CUSTOMER.ID.eq(ORDERS.CUSTOMER_ID))
            .where(ORDERS.STATUS.eq(status.name()))
            .and(ORDERS.PLACED_AT.lt(cutoff))
            .orderBy(ORDERS.PLACED_AT)
            .fetchInto(LateOrder.class);
    }
}
```

`DSLContext` is the entry point — Spring Boot auto-configures one and wires it to your
`DataSource`, which **[07 · Transactions and Spring](07-transactions-and-spring.md)**
covers. The static imports are the convention: `ORDERS.PLACED_AT` reads far better than
`Tables.ORDERS.PLACED_AT` twenty times in a file.

Read that method again and notice what is *not* there. No `@Query`. No JPQL. No entity. No
mapping annotations. No `RowMapper`. The SQL is the SQL, and it is checked.

## What the compiler now catches

Four separate things, and it is worth being precise, because people over-claim here.

**Identifiers.** `ORDERS.TOTAL_CENTS` is a field on a generated class. Drop the column,
regenerate, and every reference stops compiling. This is the headline.

**Column types.** `ORDERS.PLACED_AT` is declared `TableField<OrdersRecord, OffsetDateTime>`
for a `timestamptz`. `.lt(cutoff)` accepts only an `OffsetDateTime` or an expression of that
type. Passing a `String` does not compile; comparing a `numeric` column to a `LocalDate`
does not compile.

**Query structure.** The DSL is a chain of interfaces — `SelectFromStep`, `SelectJoinStep`,
`SelectConditionStep` and so on — each exposing only the methods legal at that point in the
grammar. You cannot write `.where(…).from(…)`, because after `where` the returned type has
no `from`. Whole categories of syntax error become unrepresentable.

**Arity and result types.** `.select(A, B, C)` returns a `Record3<…>` whose three type
parameters are the three column types. `.fetchOne(ORDERS.ID)` gives you a `Long`, not an
`Object`. Project three columns and destructure four and that is a compile error.

### What it does *not* catch

Be honest about this in an interview, because the naive answer is wrong.

- **Semantic mistakes.** Joining on the wrong but correctly typed column compiles perfectly.
  `on(CUSTOMER.ID.eq(ORDERS.ID))` is two `Long`s; jOOQ is content.
- **Cardinality.** A join that fans out and inflates a `SUM` is valid SQL and valid jOOQ.
  Topic 05's
  **[03b · The fan-out problem](../05-sql-first-access/03b-the-fan-out-problem.md)** is
  exactly as relevant here as it is there.
- **Performance.** Nothing in the DSL tells you a predicate is unindexable.
- **Runtime SQL errors.** A projection that violates `GROUP BY` rules, a division by zero, a
  unique-constraint violation — all still runtime failures. jOOQ does not have a planner.
- **Staleness of the generated code itself.** If nobody regenerated after the migration, the
  constants describe yesterday's schema and everything compiles happily. This is the single
  most important operational risk in adopting jOOQ, and
  **[02d · Generating from migrations](02d-generating-from-migrations.md)** exists to
  remove it.

## Gotchas

**★ "Type-safe SQL" is often heard as "SQL that cannot be wrong".** It is not. It is SQL
whose *identifiers and types* cannot be wrong. A join on the wrong key, a missing `GROUP BY`
column, a predicate that kills an index — jOOQ has nothing to say about any of them.

**★ The generated code is the truth about the schema *as of the last generator run*, not as
of now.** Every guarantee on this page is conditional on that run being recent. A team that
regenerates by hand, occasionally, has bought a false sense of safety and paid a build step
for it.

**★ `jooq` and `jooq-codegen` are different dependencies with different lifetimes.** The
runtime belongs in `<dependencies>`; the generator belongs in the build plugin's own
`<dependencies>` block. Putting the generator on the application classpath ships a code
generator to production.

**★ `select()` with no arguments is legal and means `SELECT *`.** It returns an untyped
`Record`, which quietly opts you out of the arity checking that is half the reason you are
here. `selectFrom(ORDERS)` is different and better — it returns a typed `OrdersRecord`.

**★ jOOQ's `Record` is not `java.lang.Record`.** `org.jooq.Record` predates Java records by
a decade. In a file that imports both you will need a fully-qualified name, and compiler
messages mentioning "Record" become ambiguous to read.

**★ Static-importing `DSL.*` alongside your own utility class is a common first-day compile
failure.** `DSL` exports several hundred static methods including `count`, `max`, `min`,
`sum`, `field`, `value`, `name` and `row`. Ambiguity errors from that collision are noisy
and unhelpful.

**★ The DSL mirrors SQL, so it inherits SQL's semantics — including three-valued logic.**
`.eq(null)` renders `= null`, which is never true, exactly as in SQL. Java intuition says it
should match; SQL says it should not. Use `.isNull()`.

**★ Nothing about jOOQ makes a bad schema good.** It reflects what is there. Generating over
a schema with no foreign keys yields no join-path metadata; generating over `text` columns
that hold numbers yields `String` fields; generating over a schema whose tables are named
`t1`…`t9` yields constants named `T1`…`T9`. jOOQ's guarantees are exactly as strong as the
schema's.

## Interview questions

**★ What does jOOQ actually generate, and from what?** A Java class per table, sequence, key
and index, plus a record class per table, generated at build time by running a code
generator against a real database's metadata or a parsed DDL script. The output is your
source, in your package, in your build.

**★ Is jOOQ an ORM?** No — and **[01c · Not an ORM](01c-the-dsl-is-a-tree.md)** takes that
apart. It maps result sets onto objects on the way out; it does not manage objects.

**★ What classes of bug does the type safety eliminate, and what classes does it not?**
Eliminates misspelled or renamed identifiers, wrong-typed comparisons, malformed clause
order and wrong projection arity. Does not eliminate wrong join keys, fan-out, missing
indexes, bad transaction boundaries, or a generated tree that is out of date.

**★ Your team already uses `JdbcClient` happily. What concrete problem would adopting jOOQ
solve?** Schema drift. The failure `JdbcClient` cannot address is a migration that renames or
drops a column while a query string still refers to it — nothing fails until that query runs.
With jOOQ the build fails on the machine of the person who pulled the migration.

**★ If jOOQ checks the SQL at compile time, why can a jOOQ query still throw?** Because
compilation checks the shape of the statement, not the state of the data or the plan of the
database. Constraint violations, deadlocks, timeouts, division by zero and `GROUP BY`
violations are all runtime events.

**★ Which part of jOOQ runs in production?** Only `org.jooq:jooq` — the DSL and runtime —
plus your generated sources compiled into the artifact. The generator is a build-time tool.

**★ What happens to a jOOQ codebase if someone drops a column and nobody regenerates?**
Nothing, until they do. The stale constants keep compiling and the query fails at runtime
against the real database — the exact failure mode jOOQ was adopted to prevent. Which is why
generation must be wired into the build, not run by hand.

{/* FOOTER */}
