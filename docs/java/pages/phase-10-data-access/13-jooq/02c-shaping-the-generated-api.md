---
title: "Forced types and the generation flags are how a mediocre generated API becomes a good one, by fixing the schema's bad decisions in one place instead of at every call site"
sidebar_label: "02c · Shaping the generated API"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *Matching of forced types*
> ([codegen-database-forced-types-matching](https://www.jooq.org/doc/latest/manual/code-generation/codegen-advanced/codegen-config-database/codegen-database-forced-types/codegen-database-forced-types-matching/)),
> *Forced types*
> ([codegen-database-forced-types](https://www.jooq.org/doc/latest/manual/code-generation/codegen-advanced/codegen-config-database/codegen-database-forced-types/)),
> *Generated POJOs*
> ([codegen-pojos](https://www.jooq.org/doc/latest/manual/code-generation/codegen-object-types/codegen-pojos/)),
> *Generated interfaces*
> ([codegen-interfaces](https://www.jooq.org/doc/latest/manual/code-generation/codegen-interfaces/))
> and *Custom data type bindings*
> ([custom-data-type-bindings](http://www.jooq.org/doc/latest/manual/code-generation/custom-data-type-bindings/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**A generated API is only as good as the schema it reflects, and real schemas contain
`char(1)` booleans, `varchar` enums, `numeric` money and columns whose type JDBC has no
representation for. Forced types are where you correct all of that — once, in configuration, so
the wrong type never reaches your code. The `<generate/>` flags are the other half: they decide
which artefacts exist at all, and their defaults are deliberately conservative in a way that
surprises everyone on their first run.**

## Forced types: fixing the schema's decisions in one place

A `<forcedType>` matches a set of database objects and overrides what the generator would have
inferred for them. It is the single highest-leverage element in the whole configuration,
because it operates on *every* use of the column simultaneously.

### Matching

The manual documents matching on name, on type, on nullability, on object kind, on priority,
and — the escape hatch — on the result of an arbitrary SQL query.

| Element | Matches on |
|---|---|
| `<includeExpression>` / `<excludeExpression>` | a regex over the object's qualified name |
| `<includeTypes>` / `<excludeTypes>` | a regex over the database type name |
| `<nullability>` | `NULL`, `NOT_NULL` or `ALL` |
| `<objectType>` | `ATTRIBUTE`, `COLUMN`, `ELEMENT`, `PARAMETER`, `SEQUENCE` or `ALL` |
| `<sql>` | a query returning the names of the objects to match |
| `<priority>` | which forced type wins when several match |

The manual's own example rewrites a column to `BOOLEAN` by name:

```xml
<forcedType>
  <name>BOOLEAN</name>
  <includeExpression>.*\.IS_VALID</includeExpression>
  <includeTypes>.*</includeTypes>
  <nullability>ALL</nullability>
  <objectType>ALL</objectType>
</forcedType>
```

The `<sql>` form is the one that reads as a trick and is genuinely the right answer on a large
legacy database — you ask the catalogue which columns have the problem rather than trying to
describe them with a regex. The manual's example finds Oracle columns whose default is `'Y'` or
`'N'`:

```xml
<forcedType>
  <userType>java.lang.Boolean</userType>
  <converter>com.example.YNBooleanConverter</converter>
  <sql>SELECT owner || '.' || table_name || '.' || column_name
       FROM all_tab_cols WHERE data_default IN ('Y', 'N')</sql>
</forcedType>
```

### The three things a forced type can do

**1 · Rewrite the type** (`<name>`). The column is still what it is in the database; jOOQ just
treats it as a different SQL type. A `numeric(1)` flag becomes `Field<Boolean>`. This works
where the two types are compatible enough that no conversion is needed.

**2 · Attach a converter** (`<userType>` + `<converter>`). A `Converter<T, U>` maps between the
database's Java type and yours, in both directions, at every read and write. `'Y'`/`'N'` becomes
`Boolean`. A `varchar` status becomes your `OrderStatus` enum. A `numeric` becomes a `Money`
value object.

This is the one that changes how a codebase feels. Without it, every query that touches
`active_yn` has a `"Y".equals(…)` next to it, and every insert has to remember which way round
the letters go — the exact class of repetition a generated API exists to abolish. With it, the
`Field` is a `Field<Boolean>` and the string never appears in application code again.

**3 · Attach a binding** (`<binding>`). A `Binding` goes a level below a converter and controls
how the value is written to a `PreparedStatement` and read from a `ResultSet`. You need it when
JDBC has no representation for the type at all — PostgreSQL's `hstore`, a PostGIS geometry, a
domain type. **[06c · jsonb, arrays and custom bindings](06c-jsonb-arrays-and-bindings.md)**
uses one.

The distinction is worth holding onto, because it is a common interview question and a common
implementation mistake: **a converter changes the Java type; a binding changes the JDBC
interaction.** If the driver can already move the value and you only dislike its Java shape,
you want a converter.

### Enums are the obvious first use

A `varchar` column holding `'PLACED'`, `'PAID'`, `'SHIPPED'` should be a Java enum in your code
and is not one by default. A forced type with an enum converter makes
`ORDERS.STATUS` a `Field<OrderStatus>`, and the payoff is immediate:
`ORDERS.STATUS.eq(OrderStatus.PAID)` compiles and `ORDERS.STATUS.eq("PAD")` does not.

Compare this with what JPA does for the same column — `@Enumerated`, and
**[the ordinal corruption trap](../06-jpa-hibernate-model/04-enums-ordinal-corruption.md)** that
comes with getting it wrong. jOOQ's version of that decision is made once, in the generator, and
is visible in the generated field's type rather than in an annotation on an entity.

## The `<generate/>` flags

Two defaults account for most first-run confusion:

- **`<records/>` defaults to `true`.** You get `OrdersRecord` whether you asked or not, because
  it is what `selectFrom(ORDERS)` returns.
- **`<pojos/>` defaults to `false`.** jOOQ does not write DTOs for you, on the view that most
  teams want their own — shaped by the query, not by the table.

When you do turn POJOs on, the shape matters on a modern JDK:

| Flag | What you get |
|---|---|
| `<pojos/>` | a mutable class per table: private fields, "a getter and a setter" per column |
| `<immutablePojos/>` | "final members and no setters" — everything through the constructor |
| `<pojosAsJavaRecordClasses/>` | POJOs generated as "(immutable) Java 16 record types" |
| `<pojosEqualsAndHashCode/>` | value-based `equals`/`hashCode` — equal when attributes match |
| `<pojosToString/>` | a generated `toString()` |
| `<interfaces/>` | an interface per table that records and POJOs implement |
| `<daos/>` | a CRUD DAO per table — **implies `pojos`** |
| `<recordsImplementingRecordN/>` | `Record1` … `Record22` degree typing; `false` since 3.19 |

**`pojosAsJavaRecordClasses` is the flag to know on JDK 25.** It collapses the old "generated
POJO versus hand-written DTO" argument for the table-shaped case: a `record` per table,
immutable, with value semantics, and no Lombok. The manual also notes generated POJOs carry
optional JPA annotations and optional JSR-303 validation annotations — a strange sight on a
library that is not an ORM, and present because those annotations are one of the ways jOOQ's
mapper locates columns. **[04 · Mapping results](04-mapping-results.md)** returns to that.

⚠️ **`<daos/>` is the one switch that pulls jOOQ towards being something it is not.** A
generated DAO gives you `findById`/`insert`/`update`/`delete` per table — a repository shaped by
the table rather than by the use case, which is exactly the shape
**[topic 05 argues against](../05-sql-first-access/12-testing-and-the-shape-of-a-repository.md)**.
The switch exists; using it is a decision, not a default.

## Gotchas

**★ Forced types match on the *qualified* name, so an unanchored regex matches more than you
meant.** `.*\.STATUS` hits a `status` column on every table in the schema, not just the one you
were thinking of. Include the table: `.*\.ORDERS\.STATUS`.

**★ A forced type with a converter changes the type at every call site at once.** That is the
point, and it is also a breaking change to your own code the moment you add one to an existing
project. Forced types are cheapest to introduce on day one and expensive on day four hundred.

**★ Two forced types matching the same column is resolved by `<priority>`, not by order.**
Relying on document order is a subtle way to get a mapping that changes when someone tidies the
XML.

**★ A converter is not validation.** If the column contains `'Y'`, `'N'` and one row of
`'y'` from 2014, the converter meets it at runtime, in whatever way you wrote it — silently
returning `false`, or throwing inside a fetch. Converters must handle the values the column
actually holds, not the ones the schema intended.

**★ A converter runs on writes too, and people forget the reverse direction.** A converter
written for reading only will compile, then insert the wrong thing. Both directions are part of
the contract.

**★ An enum converter freezes a set of values in Java that the database can still change.** A
new status inserted by a batch job or a DBA becomes a runtime failure at fetch time. That is a
real trade against `Field<String>`, and the same trade JPA's `@Enumerated` makes.

**★ `<daos/>` silently turns on `<pojos/>`.** The DAO API is expressed in POJOs, so asking for
one gets you the other. If the generated tree suddenly doubles in size, this is usually why.

**★ Enabling flags is cheap and disabling them is not.** Records, POJOs, interfaces, DAOs and
`RecordN` over a 200-table schema is a great deal of Java to compile on every build — and once
application code imports the generated POJOs, turning the flag off becomes a refactor.

**★ Generated POJOs are one per table, which is rarely the shape a query returns.** A join
projecting six columns from three tables maps to none of them. This is why most projects leave
`<pojos/>` off and map into their own records — see
**[04 · Mapping results](04-mapping-results.md)**.

**★ `<interfaces/>` exists mainly so a POJO and a record can be used interchangeably**, which is
a smaller benefit than it sounds unless you have code that genuinely accepts either. It is easy
to enable reflexively and then never use.

**★ A binding is more code than people expect.** It implements `Binding<T, U>` with `sql()`,
`register()`, `set()`, `get()` and their `SQLOutput`/`SQLInput` counterparts. It is the right
answer for `hstore`; it is not a five-minute job, and a converter is enough far more often.

## Interview questions

**★ A legacy table stores booleans as `char(1)` `'Y'`/`'N'`. How does jOOQ help?** A
`<forcedType>` matching those columns with `<userType>java.lang.Boolean</userType>` and a
`<converter>`. The generated field becomes `Field<Boolean>`, and the conversion happens once in
configuration rather than at every call site.

**★ What is the difference between a converter and a binding?** A converter maps between the
database's Java type and *your* Java type. A binding goes a level lower and controls how the
value is written to and read from JDBC — which is what you need for a type JDBC does not
represent at all, such as PostgreSQL's `hstore` or a PostGIS geometry.

**★ You have 40 columns across 12 tables that are all `char(1)` flags. Regex or SQL matching?**
SQL, if the naming is inconsistent. `<sql>` lets you query the catalogue for the columns with
the problem rather than trying to describe them with a pattern — which is both more reliable and
self-updating as the schema grows.

**★ How do you make a `varchar` status column a Java enum, and what do you lose?** A forced type
with an enum converter. What you lose is tolerance: any value in the column that is not in the
Java enum becomes a runtime failure when a row is fetched. That is the same trade JPA's
`@Enumerated(STRING)` makes, and it is worth making deliberately.

**★ Why does `<pojos/>` default to false when `<records/>` defaults to true?** Records are part
of the runtime API — a query has to return a typed row object. POJOs serve a mapping style jOOQ
does not require, and one most teams want to control themselves, so they are opt-in.

**★ What does `pojosAsJavaRecordClasses` change, and why does it matter more now than in 2019?**
It generates POJOs as immutable Java record types rather than getter/setter classes. On a modern
JDK that removes the reason most teams hand-wrote or Lombok-generated their table-shaped DTOs.

**★ Why would you deliberately not generate DAOs?** Because a DAO per table is a repository
shaped by the schema rather than the use case, and it reconstructs the CRUD-per-entity layer
SQL-first access exists to escape. They are fine for genuinely trivial tables and misleading as
a default architecture.

**★ You added a forced type and now 40 files do not compile. Is that a bug?** No — it is the
forced type working. The column's Java type changed everywhere at once, which is precisely what
you wanted; the cost is a one-off sweep, and it is why forced types are cheapest early.

**★ Two forced types both match `ORDERS.STATUS`. Which wins?** The one with the higher
`<priority>`. Relying on the order of elements in the XML is not the documented mechanism and
will change under you.

**★ Where does a converter run — in the database, in the driver, or in jOOQ?** In jOOQ, in
process, on the way out of the `ResultSet` and on the way into the `PreparedStatement`. The
database sees the original type, which means a converter cannot make a column filterable in a
way SQL does not already support.

**★ Is a forced type a substitute for fixing the schema?** No, and it is worth saying so out
loud: it hides a bad column type from Java while leaving it wrong for every other consumer, for
every report, and for anyone writing SQL by hand. It is the right tool for a schema you cannot
change and a workaround for one you can.

{/* FOOTER */}
