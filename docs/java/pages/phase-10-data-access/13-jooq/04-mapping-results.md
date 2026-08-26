---
title: "into(Class) tries three strategies in a fixed order, and knowing which one your type triggers is the difference between a mapping that survives a schema change and one that silently shifts columns"
sidebar_label: "04 · Mapping results"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *POJOs*
> ([sql-execution/fetching/pojos](https://www.jooq.org/doc/latest/manual/sql-execution/fetching/pojos/))
> and *Code generation — POJOs*
> ([codegen-pojos](https://www.jooq.org/doc/latest/manual/code-generation/codegen-object-types/codegen-pojos/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.0, PostgreSQL 18.

**A `Record` is a fine thing to hold inside a repository and a poor thing to return from one — it
is jOOQ's type, it knows about the database, and it drags the DSL into every layer above. So every
jOOQ codebase maps to something of its own, and jOOQ's `into(Class)` will do it for almost any
shape you hand it. The catch is that it decides *how* by inspecting your class, in a documented
order, and the strategy it lands on determines whether adding a column to the projection is
harmless or catastrophic.**

## The two entry points

```java
List<OrderSummary> list =
    create.select(ORDER.ID, ORDER.STATUS, ORDER.TOTAL)
          .from(ORDER)
          .fetchInto(OrderSummary.class);

// or, on a record you already have
OrderSummary one = record.into(OrderSummary.class);
```

`fetchInto(Class)` is `fetch()` plus `into(Class)` on every row. Every fetch method has an `into`
variant, so there is rarely a reason to map in a second pass — see
**[03e · Fetching](03e-fetching.md)**.

## The three strategies, in the order jOOQ tries them

This order is documented, and it is the thing to memorise:

1. **`@jakarta.persistence.Column` annotations, if present** — checked **first**, on fields,
   setters or getters.
2. **Best-match on a mutable POJO** — matching column names against members.
3. **Constructor mapping, for an immutable POJO.**

🔴 **The first one surprises people every time.** A DTO carrying JPA annotations — because it was
copied from an entity, or because someone annotated it for documentation — is mapped by those
annotations, not by its member names. That is usually what you want and occasionally the reason a
mapping "ignores" a rename.

### Mutable POJOs: best match

```java
public class OrderSummary {
    private Long id;
    private String status;
    private BigDecimal total;
    // getters and setters
}
```

Column `id` finds member `id`, `status` finds `status`, and so on. Names are matched, so
**projection order is irrelevant** and unmapped columns are simply not applied. This is the
forgiving strategy, and its cost is a no-arg constructor plus setters on a type you would rather
have been immutable.

### Immutable POJOs: constructor mapping, and the trap in it

```java
public record OrderSummary(Long id, String status, BigDecimal total) { }
```

A JDK record — or any class with no default constructor — is mapped **through its constructor**.
And here is the rule that matters:

🔴 **With no `@ConstructorProperties`, the projection order must match the constructor argument
order.** Not the names. The order.

```java
// MAPS CORRECTLY
create.select(ORDER.ID, ORDER.STATUS, ORDER.TOTAL).from(ORDER).fetchInto(OrderSummary.class);

// COMPILES, RUNS, AND IS WRONG if the types happen to line up
create.select(ORDER.STATUS, ORDER.ID, ORDER.TOTAL).from(ORDER).fetchInto(OrderSummary.class);
```

**Add `@java.beans.ConstructorProperties` and order stops mattering:**

```java
public record OrderSummary(Long id, String status, BigDecimal total) {
    @ConstructorProperties({"id", "status", "total"})
    public OrderSummary { }
}
```

With it, the manual says order no longer matters and **unmapped columns are ignored** — which also
means you can select extra columns for a `WHERE` or an `ORDER BY` without breaking the mapping.

⚠️ **Records are the natural DTO on JDK 25 and they are exactly the shape with this trap.** A
record's canonical constructor has a fixed parameter order, and reordering a projection is the
kind of edit that looks like formatting. Where the record's components are all distinct Java types
the mismatch throws; where two share a type — two `String`s, two `Long`s — it does not.

### Interfaces and abstract types

Handed an interface or an abstract type, jOOQ returns a `java.lang.reflect.Proxy` backed by a
`HashMap`. It is a genuine convenience for a read-only view type and it is worth knowing that is
what you have: a proxy, not an instance of anything you can pattern-match on, serialise naively,
or put in a `HashSet` expecting value equality.

## Generating the POJO instead of writing it

The generator can emit them, which removes the hand-maintenance problem entirely — from
**[02c · Shaping the generated API](02c-shaping-the-generated-api.md)**:

- `<pojos/>` defaults to **false**; turning it on emits a private field plus a getter and a setter
  per column.
- `immutablePojos` gives *"final members and no setters"*, with everything through the
  constructor.
- 🔴 **`pojosAsJavaRecordClasses` emits them as immutable Java record types** — which is the
  JDK-25-era answer, and it means the generated DTO and the schema cannot drift.
- `pojosEqualsAndHashCode` gives *"purely value-based"* equality; `pojosToString` gives a
  `toString`.

**The trade is the usual generated-code trade.** A generated POJO mirrors the table, including
columns your API should not expose. It is a good fit for internal boundaries and a poor fit for a
public response body.

## Writing back: the reverse direction

Mapping is not one-way. `create.newRecord(ORDER, myPojo)` builds an `OrderRecord` from your
object, and `record.store()` writes it — the subject of **[05 · Writes](05-writes.md)**. The
symmetry is convenient and it is also how a POJO with a stale primary key ends up updating a row
nobody expected.

## Gotchas

**★ `@jakarta.persistence.Column` wins over member names, and nobody remembers that.** A DTO
copied from an entity keeps its annotations, so jOOQ maps by them. Renaming a field then changes
nothing, and renaming the annotation value changes everything.

**★ Constructor mapping is positional without `@ConstructorProperties`.** Reordering a projection
— a two-second edit — silently reassigns columns whenever adjacent components share a type. This
is the single most dangerous thing on this page.

**★ Adding a column to a projection breaks an unannotated immutable POJO.** The constructor arity
no longer matches, so the mapping fails — noisily, which is the good case. Add
`@ConstructorProperties` and extra columns are ignored instead.

**★ A record with two `String` components is a positional bug waiting to happen.**
`record Person(String firstName, String lastName)` mapped from a projection selecting last name
first produces a person whose names are swapped, with no error anywhere.

**★ A mutable POJO needs a no-arg constructor, and Lombok's `@Builder` removes it.** `@Builder`
without `@NoArgsConstructor` leaves a class jOOQ cannot best-match and must map by constructor,
which switches you onto the positional strategy without warning.

**★ Two columns with the same name in one projection map unpredictably.** Alias one of them — the
same warning **[03c · Joins and aliasing](03c-joins-and-aliasing.md)** gives, arriving here as the
consequence.

**★ An aliased column maps by its alias, not by its origin.** `ORDER.TOTAL.as("amount")` maps to a
member called `amount`. That is the mechanism for adapting a schema name to an API name, and it is
also why removing an alias breaks a mapping that had nothing obviously to do with it.

**★ Type conversion happens on the way in and can throw at row level.** A `numeric` into an `int`
member, a `text` into an enum — the failure is per row, mid-fetch, and the partial result is
already gone.

**★ `into(Class)` on an interface gives you a `Proxy`, not a POJO.** `equals`, `hashCode`,
serialisation and anything reflective behave like a proxy, not like a value. Fine for a read-only
view, wrong as a map key.

**★ Nested objects are not mapped by this mechanism.** `into(Class)` maps a flat row onto a flat
type. A DTO with a child list needs `MULTISET` —
**[04b · Nested collections with MULTISET](04b-nested-collections-with-multiset.md)** — or an
explicit grouping pass.

**★ Generated POJOs mirror the table, including the columns you did not want in your API.** Using
them as response bodies is how an internal flag or an audit column ends up in a public payload.

**★ Mapping errors surface at runtime, and this is the one place jOOQ's compile-time promise does
not reach.** The query is checked; the mapping onto your own class is reflection. That is a good
reason to keep DTOs close to the query that fills them, and to have a test per projection shape.

## Interview questions

**★ In what order does `into(Class)` decide how to map?** `@jakarta.persistence.Column`
annotations first, if present; then best match by name on a mutable POJO; then constructor mapping
for an immutable one.

**★ What decides whether jOOQ uses setters or a constructor?** The shape of your class. A mutable
POJO with a no-arg constructor gets best-match by name; an immutable one — a record, or a class
without a default constructor — gets constructor mapping.

**★ Why is constructor mapping riskier than best-match mapping?** Because without
`@ConstructorProperties` it is *positional*. The projection order must match the constructor
argument order, and a reordering that keeps the types compatible produces wrong data with no
error.

**★ What does `@ConstructorProperties` change?** Order stops mattering — mapping goes by name —
and unmapped columns are ignored, so you may select extra columns for filtering or sorting without
breaking the mapping.

**★ You map into a `record Person(String first, String last)` and the names come back swapped.
Why?** Positional constructor mapping with a projection that selects them in the other order. Both
components are `String`, so nothing can detect the mismatch. `@ConstructorProperties` fixes it.

**★ Your DTO has JPA annotations left over from an entity. What happens?** jOOQ maps by those
annotations, because they are checked first — before member names. Usually harmless, occasionally
the reason a renamed field silently maps to the old column.

**★ How do you map a schema column onto a differently-named DTO field?** Alias the column in the
projection: `ORDER.TOTAL.as("amount")`. Mapping matches the alias.

**★ What do you get when you call `into(SomeInterface.class)`?** A `java.lang.reflect.Proxy`
backed by a `HashMap`. Convenient for a read-only view; not a value object, so treat its
`equals`/`hashCode` and serialisation accordingly.

**★ Should you let the generator produce your POJOs?** For internal boundaries, often yes —
especially `pojosAsJavaRecordClasses`, which keeps the DTO and the schema in step by construction.
For a public API, no: a generated POJO mirrors the table, including columns that should not leave
the service.

**★ Why should a `Record` not escape the repository?** Because it is jOOQ's type. Returning it
puts the DSL, the generated classes and the database's shape into every layer above, and the
compile-time argument for jOOQ becomes an argument for coupling.

**★ Can `into(Class)` map a parent with a list of children?** No. It maps a flat row onto a flat
type. Nested structures need `MULTISET` in the projection, or grouping the flat result yourself.

**★ Where does jOOQ's compile-time safety end in this chapter?** At the mapping. The query is
checked by the compiler; `into(Class)` is reflection over your class and fails at runtime. That is
the argument for one test per projection shape, and for keeping the DTO next to its query.

{/* FOOTER */}
