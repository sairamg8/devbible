---
title: "Every jOOQ query starts from a DSLContext holding a Configuration, is assembled from static factory methods, and carries the degree of its projection in its own Java type"
sidebar_label: "03 · The DSL"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *The DSL and DSLContext API*
> ([sql-building/dsl](https://www.jooq.org/doc/latest/manual/sql-building/dsl/)),
> *DSLContext* ([sql-building/dsl-context](https://www.jooq.org/doc/latest/manual/sql-building/dsl-context/)),
> *QueryParts* ([sql-building/queryparts](https://www.jooq.org/doc/latest/manual/sql-building/queryparts/))
> and *Fetching* ([sql-execution/fetching](https://www.jooq.org/doc/latest/manual/sql-execution/fetching/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**There are exactly two things to understand before jOOQ's API stops looking like magic. `DSL` is
a bag of static factory methods that build query *parts* and knows nothing about your database.
`DSLContext` is a `DSL` that has been handed a `Configuration` — a dialect and a way to get a
connection — and can therefore also *execute* what you built. Once that split is clear, every
odd-looking import and every "why can I not call `fetch()` on this" answers itself.**

## `DSL` — the static factory that knows nothing

The manual calls `org.jooq.impl.DSL` *"the main class from where you will create all jOOQ
objects"*, and describes it as a *"static factory for table expressions, column expressions (or
'fields'), conditional expressions and many other QueryParts"*.

Nothing it returns is bound to a database. `DSL.field("total")`, `DSL.val(42)`,
`DSL.count()`, `DSL.select(...)` all produce **query parts** — values you can hold, pass around,
compose and inspect, exactly as **[01c · A tree, not a string](01c-the-dsl-is-a-tree.md)**
argued.

The manual's own recommendation is to static-import the whole class:

```java
import static org.jooq.impl.DSL.*;
```

That is what makes jOOQ code read like SQL rather than like Java, and it is why examples in every
jOOQ document look like they are calling functions out of thin air. They are — out of `DSL`.

**And the generated schema gets the same treatment**, from
**[02 · Code generation](02-code-generation.md)**:

```java
import static com.example.shop.db.Tables.*;
```

Two static imports, and `ORDER.CUSTOMER_ID` and `count()` sit side by side in the same
expression.

## `DSLContext` — the same thing, plus a `Configuration`

The manual: *"DSLContext references a `org.jooq.Configuration`, an object that configures jOOQ's
behaviour when executing queries."*

That `Configuration` is the whole of jOOQ's runtime state, and it is worth knowing what is in it
because everything you will ever want to customise lives there:

| In the `Configuration` | What it decides |
|---|---|
| `SQLDialect` | which SQL gets rendered |
| `Settings` | rendering and execution options |
| JDBC access — `Connection`, `DataSource` or `ConnectionProvider` | where statements go |
| R2DBC access — `Connection` or `ConnectionFactory` | the reactive equivalent |
| `ExecuteListenerProvider`, `ParseListenerProvider`, `RecordListenerProvider` | hooks around execution |
| `RecordMapperProvider` | how rows become your types |
| `FormattingProvider` | how results format themselves |

Two documented ways to get a `DSLContext`:

```java
// from a Configuration you already have
DSLContext create = DSL.using(configuration);

// from ad-hoc arguments — the overloads build a Configuration for you
DSLContext create = DSL.using(connection, SQLDialect.POSTGRES);
```

🔴 **The connection-lifecycle difference between those two is the one people get wrong.** The
manual is explicit: with a `DataSource`, *"jOOQ will internally fetch new Connections from your
DataSource, conveniently closing them again after query execution"*. With a single `Connection`,
it *"will be re-used for the whole lifecycle of your Configuration"* — jOOQ does not close it,
and it is yours to manage.

In a Spring application you construct neither by hand; Boot auto-configures a `DSLContext` bean
wired to the application `DataSource`, which is
**[07 · Transactions and Spring](07-transactions-and-spring.md)**.

## The anatomy of a query

```java
Result<Record3<Long, String, BigDecimal>> result =
    create.select(ORDER.ID, CUSTOMER.EMAIL, ORDER.TOTAL)
          .from(ORDER)
          .join(CUSTOMER).on(ORDER.CUSTOMER_ID.eq(CUSTOMER.ID))
          .where(ORDER.STATUS.eq("SHIPPED"))
          .orderBy(ORDER.PLACED_AT.desc())
          .limit(50)
          .fetch();
```

Four things are happening in that expression, and only one of them is SQL-shaped.

1. **`create` is the `DSLContext`.** The variable is conventionally named `create` or `dsl` in
   jOOQ's own documentation; it is the only object in the chain that can reach a database.
2. **Each call returns a new step type**, not a mutable builder. `select(...)` returns something
   you can call `from(...)` on; `from(...)` returns something you can call `join(...)` or
   `where(...)` on. The compiler is walking you through the grammar.
3. **The chain is a value until `fetch()`.** Everything up to that point built a tree. `fetch()`
   is where a connection is taken, SQL is rendered and a statement executes.
4. **The result type carries the projection.** `Record3<Long, String, BigDecimal>` is not
   decoration — it is what makes `result.get(0).value2()` a `String` at compile time.

### The clause order the DSL enforces is SQL's *written* order

You write `select` before `from` in jOOQ because you write `select` before `from` in SQL, even
though the database logically evaluates `FROM` first. jOOQ deliberately mirrors the written
syntax rather than the evaluation order, which is why the API is readable to anyone who knows SQL
and why a SQL snippet translates line by line.

The consequence is that **your IDE's autocomplete is a SQL grammar reference**. After `.from(…)`
the only methods offered are the clauses that may legally follow `FROM`. That is the same
type-safety argument as column names, applied to statement structure.

## Degrees: `Record1` to `Record22`

jOOQ's fetching chapter has a section titled *"Type safe records with degree less than 22"*, and
that number is the whole story:

- A projection of **1 to 22 columns** gets a typed `Record1<T1>` … `Record22<T1, …, T22>`, and
  `value1()` … `value22()` return the right Java types with no cast.
- A projection **wider than 22 columns** falls back to the untyped `Record`, where you address
  columns by field — `record.get(ORDER.TOTAL)` — which is still type-safe *per field*, just not
  positionally typed.

⚠️ **That is a limit of Java's generics, not of jOOQ.** There is no variadic generic in Java, so
every degree is a hand-written interface, and 22 is where jOOQ stopped. Nothing breaks past it;
you simply lose `valueN()`.

**`get(FIELD)` is the better habit anyway.** Positional accessors are brittle under a projection
change in a way field accessors are not, and the typed degree matters most where it is invisible:
in the *return type* of a method, where `Record3<Long, String, BigDecimal>` documents the shape
for the caller.

### `selectFrom` — the whole-table shortcut

```java
Result<OrderRecord> orders =
    create.selectFrom(ORDER)
          .where(ORDER.STATUS.eq("SHIPPED"))
          .fetch();
```

`selectFrom(TABLE)` projects every column of the table and gives you the **generated record type**
back — `OrderRecord`, not `RecordN`. That is the type with named accessors and, for a table with
a primary key, the one that can write itself back; see **[05 · Writes](05-writes.md)**.

⚠️ It is also `SELECT *`, with every cost `SELECT *` has ever had: you fetch columns you do not
need, and adding a column to the table changes what every such query transfers. Convenient for
"load this row and update it", wrong for a wide table you only need three columns from.

## Gotchas

**★ `DSL` and `DSLContext` are different types and the error message does not say so.** Calling
`DSL.select(...)` — the static one — gives you a query you cannot execute, because it has no
`Configuration`. The compile error is about a missing method, not about a missing connection, and
it sends people looking in the wrong place. Build executable queries from your `DSLContext`
instance.

**★ Two wildcard static imports can collide.** `DSL.*` and your generated `Tables.*` are both
wide, and a table named `KEY`, `NAME` or `VALUE` will shadow or be shadowed by a `DSL` factory
method. The fix is a specific import or a qualified reference, and the compile error is usually
clearer than the cause.

**★ A `DSLContext` built from a bare `Connection` never closes it.** The manual says the
connection *"will be re-used for the whole lifecycle of your Configuration"*. Build one of those
per request, forget to close it, and you have a connection leak jOOQ will not warn you about —
see **[Topic 02 · Connection pooling](../02-connection-pooling/README.md)** for what that costs.

**★ Nothing executes until a fetch or an `execute()`.** A query assigned to a variable and never
fetched is dead code that compiles, passes review and does nothing. This is the most common
first-week jOOQ bug, and it looks exactly like a database that "ignored the update".

**★ `select(...)` with no `from(...)` is legal.** `create.select(currentTimestamp()).fetch()` is a
valid `SELECT` with no table. That is a feature, and it also means forgetting `.from(…)` can
compile in cases where you expected it not to.

**★ Degree 22 is a ceiling on *typing*, not on columns.** Nothing fails at 23 columns; you get a
plain `Record`. People assume the query breaks and start splitting projections for no reason.

**★ `valueN()` accessors break silently under reordering.** Swap two columns in the projection and
`value2()` still compiles — with a different meaning — if the two happen to share a type.
A field accessor, `get(FIELD)`, cannot go wrong that way, which is why it is the one to teach.

**★ `selectFrom(TABLE)` is `SELECT *`.** It is easy to reach for because the return type is
nicer. On a table with a `text` column holding documents, it is also the reason a page got slow
and nobody could see a bad query in the logs — the query is fine, the projection is not.

**★ The `Configuration` is shared, and mutating it is not thread-safe in the way you hope.** The
right way to vary behaviour for one query is `configuration.derive(...)` to make a copy, not
setting a field on the one every thread is using.

**★ `SQLDialect.DEFAULT` renders SQL nobody's database speaks quite the way you expect.** If the
dialect is not set — or Boot could not detect it — you get generic SQL and mysterious failures on
PostgreSQL-specific expressions. Check the dialect before debugging the query.

**★ The step interfaces have names, and they leak into your code the moment you extract a
variable.** `SelectConditionStep<Record3<…>>` is what an extracted half-built query is typed as,
and it is ugly. `var` in JDK 25 handles it, and for a field you usually want to hold a
`Condition` or a `SelectFinalStep` instead of the intermediate.

## Interview questions

**★ What is the difference between `DSL` and `DSLContext`?** `DSL` is a static factory for query
parts and knows nothing about any database. `DSLContext` holds a `Configuration` — a dialect and
a connection source — and can therefore execute what it builds. Query parts from `DSL` are inert
values; queries from a `DSLContext` can be fetched.

**★ What does a jOOQ `Configuration` hold?** The `SQLDialect`, `Settings`, JDBC access
(`Connection`, `DataSource` or `ConnectionProvider`) or R2DBC access, the execute/parse/record
listener providers, a `RecordMapperProvider` and a `FormattingProvider`.

**★ What is the difference between passing `DSL.using` a `DataSource` and passing it a
`Connection`?** With a `DataSource`, jOOQ fetches a new connection per execution and closes it
afterwards. With a single `Connection` it reuses that one for the whole lifecycle of the
`Configuration` and never closes it — so the lifecycle is yours to manage, and that is where leaks
come from.

**★ Why do jOOQ examples static-import everything?** Because the manual recommends
`import static org.jooq.impl.DSL.*;`, and with the generated `Tables.*` alongside it, jOOQ code
reads as SQL rather than as nested factory calls. It is a readability decision, and it is also why
unfamiliar jOOQ code looks like it calls undefined functions.

**★ What are `Record1` to `Record22` and what happens at 23 columns?** They are typed record
interfaces carrying the degree of the projection, so `value1()` … `value22()` return correct Java
types with no cast. Beyond 22 you get the untyped `Record` and address columns by field. Nothing
breaks — Java simply has no variadic generics, so the interfaces stop being hand-written there.

**★ When does a jOOQ query actually hit the database?** At `fetch()`, `fetchOne()`, `execute()` or
one of their relatives. Everything before that builds a tree. A query built and never fetched
compiles and silently does nothing.

**★ Why does jOOQ make you write clauses in SQL's written order rather than its logical order?**
Because the API is designed to read like SQL, so a snippet translates line by line and
autocomplete after each clause offers only what may legally follow it. The type system is
enforcing the grammar, not just the column names.

**★ What does `selectFrom(TABLE)` give you that `select(...)` does not, and what does it cost?**
It gives you the generated record type — `OrderRecord`, with named accessors and, if the table has
a primary key, the ability to write itself back. It costs you `SELECT *`: every column, always,
including whatever gets added later.

**★ Why prefer `record.get(ORDER.TOTAL)` over `record.value3()`?** Because the field accessor
cannot be silently invalidated by reordering the projection. `value3()` keeps compiling with a new
meaning whenever the columns at positions three and four share a type, and that class of bug is
invisible in review.

**★ You extracted a half-built query to a variable and the type is unreadable. What is going on?**
Each fluent step has its own interface — `SelectSelectStep`, `SelectJoinStep`,
`SelectConditionStep` and so on — parameterised by the record type. That is the grammar being
encoded in types. Use `var`, or extract a `Condition` instead of a partial query.

**★ How would you customise jOOQ's behaviour for a single query without affecting others?** Derive
a copy of the `Configuration` and use it for that query. Mutating the shared `Configuration` other
threads are using is not the mechanism, however tempting the setter looks.

**★ Your PostgreSQL-specific expression renders as something PostgreSQL rejects. First check?**
The `SQLDialect`. If it is `DEFAULT` — never set, or not detected — jOOQ renders generic SQL, and
every dialect-specific feature degrades before you get to the interesting part of the query.

{/* FOOTER */}
