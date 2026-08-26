---
title: "The jOOQ DSL builds a syntax tree rather than a string, which is why predicates compose safely and why jOOQ is not an ORM"
sidebar_label: "01c · A tree, not a string"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *SQL building*
> ([jooq.org/doc/latest/manual/sql-building/](https://www.jooq.org/doc/latest/manual/sql-building/)),
> *Plain SQL*
> ([jooq.org/doc/latest/manual/sql-building/plain-sql/](https://www.jooq.org/doc/latest/manual/sql-building/plain-sql/))
> and *Fetching POJOs*
> ([jooq.org/doc/latest/manual/sql-execution/fetching/pojos/](https://www.jooq.org/doc/latest/manual/sql-execution/fetching/pojos/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.0, PostgreSQL 18.

**Every jOOQ expression you write builds an object — a `Field`, a `Condition`, a `Table`, a
`Select` — and the statement is a tree of those objects that gets rendered to text only at
execution. That is the difference between jOOQ and a query builder that concatenates
strings, and it is where the practical benefits live: predicates are values you can compose,
bind values are never spliced into SQL, and the same tree can render for a different
dialect. It is also why jOOQ stops where it does — it models statements, not objects, so
there is no persistence context and nothing that writes an `UPDATE` on your behalf.**

## Rendering happens last

When you write `ORDERS.STATUS.eq(status.name())`, nothing textual happens. jOOQ constructs a
`Condition` holding a reference to a `TableField` and a **bind value**. When you finally call
`.fetch()`, the runtime walks the tree, emits `orders.status = ?` for the configured dialect,
and binds the value through JDBC's `PreparedStatement`.

Four consequences follow directly, and they are the reason to prefer this over string
assembly.

### 1 · SQL injection is structurally impossible for values

There is no escaping step, because there is nothing to escape. A `String` you pass to
`.eq(…)` becomes a parameter, never text. You cannot forget to parameterise something,
because the API gives you no way to interpolate it in the first place.

The exception is the deliberate escape hatch — `DSL.field(String)`, `DSL.table(String)`,
`DSL.condition(String)` — which does pass text through. jOOQ's own manual calls this "plain
SQL" and it accepts bind placeholders (`{0}`, `{1}`) precisely so you do not have to
concatenate:

```java
Condition nearby = DSL.condition(
        "{0} <-> {1} < {2}",
        STORE.LOCATION, DSL.val(point), DSL.val(radiusMetres));
```

Interpolating a user-supplied value into that first string would reintroduce every injection
risk you came here to avoid. Treat plain SQL as the one place the guarantees do not hold.

### 2 · Predicates are values, so dynamic filtering stops being string surgery

This is the benefit teams notice first in real code.

```java
List<Condition> filters = new ArrayList<>();
filters.add(ORDERS.TENANT_ID.eq(tenantId));

if (status != null)   filters.add(ORDERS.STATUS.eq(status.name()));
if (minTotal != null) filters.add(ORDERS.TOTAL_CENTS.ge(minTotal));
if (since != null)    filters.add(ORDERS.PLACED_AT.ge(since));

return dsl.selectFrom(ORDERS)
          .where(DSL.and(filters))
          .orderBy(ORDERS.PLACED_AT.desc())
          .limit(pageSize)
          .offset(pageSize * page)
          .fetch();
```

Written against `JdbcClient`, that is a `StringBuilder`, a parallel parameter map that must
stay in step with it, and a bug waiting for the day someone forgets a leading space before
`and`. Here the `List<Condition>` and the bind values are the same objects, so they cannot
drift apart. The same trick works for `ORDER BY` (`List<OrderField<?>>`), for projections
(`List<SelectFieldOrAsterisk>`) and for joins.

When every filter is absent the list is empty, and jOOQ has a documented answer for that
case: **`DSL.noCondition()`**, a pseudo-identity for both `AND` and `OR` that renders nothing
at all. jOOQ's manual recommends it over `trueCondition()` for exactly this, because a query
padded with `and 1 = 1` is unpleasant for whoever has to read the statement in production.
⚠️ Its own caveat, from the same page: *"`noCondition()` does not act as an identity"* — if
it is the only predicate left, there is no `WHERE` clause at all, regardless of whether you
were combining with `AND` or with `OR`. For `AND` that is what you want; for `OR` it is the
opposite of what you want, and you should reduce with `falseCondition()` instead.

### 3 · The same tree renders for a different dialect

The tree is dialect-neutral; the renderer is not. jOOQ knows what PostgreSQL 18 supports and
what H2 supports, and where a feature is missing it emulates rather than fails. That is the
mechanism behind the PostgreSQL-specific expressions starting at
**[06 · Window functions](06-postgres-specifics.md)**, and also the reason a `MULTISET` query
works on databases with no `MULTISET` type.

It is not magic portability. An emulation exists or it does not, and where it does not, jOOQ
says so at render time. But the failure is explicit rather than a dialect-specific runtime
error from the database.

### 4 · A query is an inspectable value

```java
Select<?> query = dsl.selectFrom(ORDERS).where(ORDERS.TENANT_ID.eq(tenantId));

String sql = query.getSQL();                  // the rendered statement
List<Object> binds = query.getBindValues();   // the parameters
```

Two practical uses. First, logging and diagnostics — you can render a statement without
running it. Second, and more usefully, **a jOOQ query can be unit-tested with no database at
all**: build the query, render it, assert on the string. That is a cheap way to pin down that
a complex dynamic filter produces the SQL you meant, and it is not available to you when the
query is a runtime-assembled string.

⚠️ `getSQL()` renders bind *placeholders* by default, not values. There are render modes that
inline values, and they exist for diagnostics — never build a statement that way and execute
it.

## jOOQ is not an ORM, and refusing to be one is the design

The name contains "Object Oriented Querying", which has confused people for fifteen years.
jOOQ maps **result sets to objects**; it does not map **objects to a database**.

Concretely, none of the following exist:

- **an identity map** — two queries for the same row give you two unrelated objects, and
  `==` between them is false;
- **automatic change tracking** — mutating an object you fetched writes nothing, ever;
- **lazy loading** — so there is no `LazyInitializationException`, no open-session-in-view
  question, and no **[N+1 problem](../08-the-n-plus-1-problem/README.md)** arising by
  accident from a getter;
- **cascade rules, orphan removal or a flush order** — the statements execute in the order
  you write them;
- **a second-level cache**;
- **a dialect of its own** — there is no JPQL equivalent to learn, because the DSL *is* SQL.

Read that list as a feature. Every entry is a mechanism that has to be understood, tuned and
occasionally fought in a JPA codebase; the phase's topics 06, 07, 08 and 10 exist because
those mechanisms are subtle. jOOQ's answer is to not have them.

The mirror image is what you give up, and it is not small: **there is no aggregate you load,
mutate in Java, and let something else work out the `UPDATE` for.** Every write is a
statement you write. **[08 · jOOQ vs JPA](08-jooq-vs-jpa.md)** takes that trade seriously
rather than declaring a winner.

### The one place jOOQ looks ORM-ish, and why it is not

Generated `UpdatableRecord`s have `store()`, `insert()`, `update()`, `delete()` and
`refresh()` methods, and they do track which fields you changed since the record was fetched
so that `store()` can emit an `UPDATE` touching only those columns. That looks like dirty
checking and it is worth naming the difference: the tracking is **per record object and
explicit** — nothing scans anything at commit time, nothing flushes on your behalf, and
nothing happens unless you call `store()`. **[05 · Writes](05-writes.md)** covers it.

## Where it sits next to `JdbcClient`

Both are SQL-first. The difference is a build step and what it buys.

| | `JdbcClient` (topic 05) | jOOQ |
|---|---|---|
| SQL lives in | a Java text block or a `.sql` file | Java expressions |
| Wrong column name | fails at runtime | fails at compile time |
| Dynamic predicates | string assembly | `Condition` objects |
| Dialect portability | yours to manage | rendered per dialect |
| Result mapping | `RowMapper` / `DataClassRowMapper` | `fetchInto`, `Record`, `MULTISET` |
| Nested collections | two queries and a manual join | one query with `MULTISET` |
| Testing the SQL | needs a database | can assert on the rendered string |
| Build cost | none | a generator run, a generated source tree |
| Reading a raw query | trivial, it is SQL | needs jOOQ fluency |
| Licence | Apache-2.0, part of Spring | **[edition-dependent](01b-the-licence-question.md)** |

The honest summary: **jOOQ is `JdbcClient` with a compiler attached and a price** — a build
step, a generated source tree, and a team that has to learn one more API.

## Gotchas

**★ Plain SQL is where every guarantee stops.** `DSL.field("…")` is unchecked, unparsed and
passed through to the dialect. It is the right tool for a PostgreSQL operator jOOQ has not
modelled, and the wrong tool for anything you were too impatient to look up. Use the `{0}`
placeholders; never concatenate.

**★ A `Condition` built against one table is not scoped to that table.** Nothing stops you
adding `CUSTOMER.NAME.eq(…)` to a query that never joins `customer`. jOOQ will render it and
PostgreSQL will reject the statement at runtime. The type system checks column *types*, not
whether the column is in scope.

**★ `noCondition()` is not an identity, whatever it looks like.** jOOQ documents this
directly: if a `noCondition()` ends up the only predicate in a `WHERE` clause, the clause
disappears. Combined with `AND` that is harmless; combined with `OR` it turns "match nothing"
into "match everything", which is a data-leak-shaped bug on a multi-tenant table. Reduce
`OR` chains with `falseCondition()`, whose identity behaviour is defined.

**★ `trueCondition()` and `falseCondition()` are the real identities — `TRUE` for `AND`,
`FALSE` for `OR`.** They are correct and they are ugly, because they render literally. That
readability cost is the whole reason `noCondition()` exists, and the reason the manual
recommends it for dynamic SQL.

**★ `getSQL()` is not the statement the database sees if inline rendering is on.** Render
modes change the output. A logged statement with values inlined is a diagnostic artefact, not
proof of what executed.

**★ Building a query is cheap; building it in a loop is not free.** Each expression allocates
objects. This never matters for a request-scoped query and does matter if you construct
thousands of conditions per call — an easy thing to do when generating a large `IN` list one
`or` at a time instead of using `.in(collection)`.

**★ "jOOQ has no lazy loading" is not the same as "jOOQ cannot N+1".** You can absolutely
write a loop that runs one query per row. The difference is that it is visible in your code
rather than triggered by a getter — the failure is loud, not silent.

**★ `UpdatableRecord.store()` looks like `persist()` and is not.** It runs a statement
immediately. There is no unit of work to flush, no ordering guarantee across records beyond
the order you call them, and no cascade to children.

**★ Two objects fetched for the same row are unrelated.** Any code that relies on JPA's
identity map — comparing with `==`, or mutating one reference and expecting another to see
it — is silently wrong under jOOQ. Equality is value equality on the record's fields.

## Interview questions

**★ What does "the DSL is a tree" actually mean in practice?** Each call constructs an object
rather than appending text, and rendering happens once at execution. Practically: bind values
cannot be injected, conditions are composable values, one tree renders for many dialects, and
a query can be rendered and asserted on without a database.

**★ How do you build a search endpoint with five optional filters in jOOQ?** Collect
`Condition` objects in a list as each filter is present, then `where(DSL.and(list))`, using
`DSL.noCondition()` for the absent ones — it renders nothing, so the statement stays readable.
Watch the documented caveat that `noCondition()` is not an identity when it is the last
predicate standing.

**★ Why does jOOQ offer `noCondition()` when `trueCondition()` already exists?** Because
`trueCondition()` renders. A dynamic query with eight optional filters, seven of them absent,
produces seven `1 = 1` predicates that anyone reading the statement in production has to
mentally discard. `noCondition()` emits nothing at all.

**★ Can a jOOQ query be SQL-injected?** Not through the DSL — values become bind parameters.
It can through plain SQL (`DSL.field(String)`, `DSL.condition(String)`) if you concatenate
user input into the fragment instead of using its bind placeholders.

**★ How would you test a complicated dynamic jOOQ query without a database?** Build the
`Select`, call `getSQL()` and `getBindValues()`, and assert on them. This checks that the
filter logic produced the statement you intended, which is usually the part that is wrong.

**★ Is jOOQ an ORM? Justify the answer.** No. It has no identity map, no change tracking at
commit, no lazy loading, no cascades, no flush and no second-level cache. It maps result sets
onto objects on the way out, which is the "OQ" half of the name, not the "OR" half.

**★ jOOQ has no lazy loading — does that mean N+1 is impossible?** No. It means N+1 cannot
happen *by accident from a getter*. A loop that queries per row still queries per row; you
just have to have written it.

**★ `UpdatableRecord.store()` tracks changed fields. Is that dirty checking?** Only in the
narrow sense that the record remembers which of its own fields you set. There is no
persistence context scanning objects at flush time and no automatic write — nothing happens
until you call `store()`.

**★ What is lost by moving a query from `JdbcClient` to jOOQ?** Immediate readability for
anyone who knows SQL but not jOOQ, the ability to paste the query straight into `psql`, and
the option of keeping SQL in `.sql` files that a DBA can review. Those are real, and topic
**[09 · The cost](09-the-cost.md)** does not pretend otherwise.

**★ Both `JdbcClient` and jOOQ are SQL-first. What is the one-sentence difference?** jOOQ
turns the SQL into Java expressions checked by the compiler against a generated model of the
real schema; `JdbcClient` leaves it as an opaque string.

{/* FOOTER */}
