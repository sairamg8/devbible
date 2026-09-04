---
title: "Records.mapping and ad-hoc converters give you compile-time-checked mapping instead of reflection, and choosing between an ad-hoc converter and a forced type is a question of how many queries share the problem"
sidebar_label: "04c · Mappers and converters"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *RecordMapper*
> ([fetching/recordmapper](https://www.jooq.org/doc/latest/manual/sql-execution/fetching/recordmapper/)),
> *Ad-hoc Converter*
> ([fetching/ad-hoc-converter](https://www.jooq.org/doc/latest/manual/sql-execution/fetching/ad-hoc-converter/))
> and *Matching of forced types*
> ([codegen-database-forced-types-matching](https://www.jooq.org/doc/latest/manual/code-generation/codegen-advanced/codegen-config-database/codegen-database-forced-types/codegen-database-forced-types-matching/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**`into(Class)` is reflection, and reflection is where jOOQ's compile-time promise stops — that is
the closing argument of [04 · Mapping results](04-mapping-results.md). This page is the other
half: the mapping mechanisms that the compiler *can* check, and the conversion mechanisms that let
a column arrive in your own type rather than the database's. Both are small APIs, and together
they are what makes a jOOQ read layer feel finished rather than half-typed.**

## `RecordMapper` — a callback with a type

`org.jooq.RecordMapper` is the functional interface behind every mapping in jOOQ. The manual
frames it as wanting *"to write callbacks that map records from your select statement results in
order to do some processing"*, and you can implement it directly:

```java
List<String> labels =
    create.select(ORDER.ID, ORDER.STATUS)
          .from(ORDER)
          .fetch(r -> r.value1() + " · " + r.value2());
```

Every fetch method takes one. That alone removes most reasons to fetch into a `Result` and then
stream over it.

## `Records.mapping` — the constructor reference version

`org.jooq.Records` is the utility the manual points at for the common case: *"Use Java 16 record
types as simple DTOs"*, mapped with `fetch(Records.mapping(Book::new))`.

```java
record OrderSummary(Long id, String status, BigDecimal total) { }

List<OrderSummary> orders =
    create.select(ORDER.ID, ORDER.STATUS, ORDER.TOTAL)
          .from(ORDER)
          .fetch(Records.mapping(OrderSummary::new));
```

🔴 **This is the mapping to prefer, and the reason is the compiler.** `Records.mapping` takes a
constructor *reference*, so the projection's degree and its column types are checked against the
constructor's arity and parameter types **at compile time**. Add a fourth column to the projection
and it stops compiling. Change `ORDER.TOTAL` to a `String` column and it stops compiling.

Compare that with `fetchInto(OrderSummary.class)`, which does the same job by reflection and fails
at runtime. Both are supported and idiomatic; only one of them tells you before you deploy.

⚠️ **It is still positional** — `Records.mapping` matches by position, exactly like the
constructor-mapping strategy in 04. The difference is that a *mismatch* is a compile error rather
than silent misassignment, unless the reordered components share a type.

## Ad-hoc converters: `convertFrom` and `convertTo`

The manual defines an ad-hoc converter as a way to *"attach an ad-hoc converter to some column,
just for a single query or a few local queries"* — without touching generated code.

**`convertFrom` converts *from the database*.** The manual's own example:

```java
Result<Record2<Integer, Language>> result =
create.select(LANGUAGE.ID, LANGUAGE.CD.convertFrom(Language.class, Language::valueOf))
      .from(LANGUAGE)
      .fetch();
```

**`convertTo` converts *to the database*:**

```java
Result<Record2<Integer, Language>> result =
create.insertInto(LANGUAGE)
      .columns(LANGUAGE.ID, LANGUAGE.CD.convertTo(Language.class, Language::name))
      .values(5, Language.it)
      .execute();
```

**The one-argument `convertFrom(Function)` form is what nests a `MULTISET`**, and the manual gives
it verbatim: `multiset(...).as("books").convertFrom(r -> r.map(Records.mapping(Book::new)))` —
which is exactly the shape
**[04b · Nested collections with MULTISET](04b-nested-collections-with-multiset.md)** uses. The
manual's own comment on it is that this *"provides strong type-checking compared to reflective
mapping alternatives"*.

Note the direction asymmetry: `convertFrom` only handles reads, `convertTo` only handles writes. A
column you both read and write in your own type needs both — or a forced type.

## Ad hoc, or forced type? The decision

Both put the same converter in front of the same column. They differ in scope:

| | Ad-hoc converter | Forced type |
|---|---|---|
| Where it is declared | at the query, per column | in the generator configuration |
| Scope | this query, or a few | **every** query, everywhere |
| Generated column type | unchanged | **becomes your type** |
| Cost of changing it | edit one query | regenerate, recompile everything |
| Right when | one query needs a different view of a column | the column *is* that type, always |

🔴 **The default answer is the forced type**, and it is worth stating firmly because ad-hoc
converters are easier to reach for. If `language.cd` is always a `Language`, then having the
generated `Field` typed as `Field<String>` is a lie your codebase has to correct at every call
site. Fix it once in `<forcedTypes>` — **[02c · Shaping the generated API](02c-shaping-the-generated-api.md)** —
and the whole codebase inherits it.

Ad-hoc converters are for the genuine exceptions: a query that wants a column in an unusual shape,
a migration period where two representations coexist, a report that needs a different parse.

## Going global: `RecordMapperProvider`

If you want *all* mapping to go through your own mechanism — a mapping library, a Jackson
`ObjectMapper`, your own conventions — the hook is a `RecordMapperProvider` on the
`Configuration`. It replaces the default `into(Class)` behaviour globally.

There is a matching `ConverterProvider` for type conversion. Both are the right answer when a
policy applies across a codebase, and the wrong answer when one query is unusual — a global hook
installed for a local problem is how the mapping behaviour of a codebase becomes something nobody
can predict from reading a query.

**Types JDBC cannot represent at all** — PostGIS geometries, `hstore` — are a different mechanism
again: an `org.jooq.Binding`, registered as a forced type. That is
**[06c · JSONB, arrays and bindings](06c-jsonb-arrays-and-bindings.md)**.

## Gotchas

**★ `fetchInto(Class)` and `fetch(Records.mapping(...))` look equivalent and are not.** The first
is reflection and fails at runtime; the second is a constructor reference and fails at compile
time. Preferring the second costs nothing and moves a whole class of bug earlier.

**★ `Records.mapping` is positional.** It matches projection position to constructor parameter.
The compiler catches most mismatches, and it cannot catch a swap of two same-typed components.

**★ `convertFrom` does not help your writes and `convertTo` does not help your reads.** Attaching
one and assuming the column now round-trips in your type is a common half-fix; the other direction
silently keeps the database type.

**★ An ad-hoc converter applies to the column *in that query only*.** Copy the query, forget the
converter, and the second copy returns the raw type. That duplication is the argument for a forced
type.

**★ A converter that throws takes the whole fetch with it.** Conversion happens per row during
fetching, so a single unparseable value fails the query, and the rows already read are gone.
`Language::valueOf` on a column containing an unexpected code is exactly this.

**★ A forced type changes the generated API, so introducing one is a compile sweep.** That is the
good version of the news — every affected call site is shown to you — but it is not a small
change, and it lands across the codebase at once.

**★ A global `RecordMapperProvider` makes every query's mapping behaviour non-local.** Someone
reading a repository method cannot tell how the mapping works without knowing the configuration.
Use it for a policy, never for a special case.

**★ Records.mapping with a record whose components you later reorder is a silent break if the
types line up.** Records make reordering feel safe because the names travel with the components —
but the mapping does not use the names.

**★ `convertFrom(Class, Function)` and `convertFrom(Function)` are different overloads.** The
two-argument form declares the target type; the one-argument form infers it from the lambda, and
is what the `MULTISET` idiom uses. Mixing them up produces an inference error that reads as
unrelated.

**★ Converters run on the client, so they cannot be used in predicates.** Converting a column to an
enum does not let the database filter on your enum; the `WHERE` clause still sees the database's
representation. A forced type does not change that either.

**★ A `RecordMapper` capturing mutable state is a landmine in a lazy fetch.** With `fetchLazy()` or
`stream()` the mapper runs as rows are consumed, potentially far from where it was written, and
anything it captured is still captured.

**★ Mapping into a nested tree by hand where a `MULTISET` would do is the usual overuse of this
API.** Converters are for *values*; nested structure is a projection problem.

## Interview questions

**★ What is a `RecordMapper`?** The functional interface every jOOQ mapping goes through — a
callback taking a record and returning whatever you want. Every fetch method accepts one, so
mapping happens during fetching rather than in a second pass.

**★ Why prefer `fetch(Records.mapping(OrderSummary::new))` over
`fetchInto(OrderSummary.class)`?** Because the constructor reference lets the compiler check the
projection's degree and column types against the constructor. `fetchInto` does the same work by
reflection and fails at runtime.

**★ Is `Records.mapping` name-based or positional?** Positional. The compiler catches arity and
type mismatches, but not a reordering of two components that share a type.

**★ What do `convertFrom` and `convertTo` do?** `convertFrom` converts a column's value coming
*from* the database into your type; `convertTo` converts your value going *to* the database. They
are separate, so a column you read and write in your own type needs both.

**★ How does an ad-hoc converter turn a `MULTISET` into a `List` of your record?**
`multiset(...).convertFrom(r -> r.map(Records.mapping(Book::new)))` — the manual's own idiom. The
column's Java type becomes the list of your type, and the outer mapping then sees a matching
shape.

**★ Ad-hoc converter or forced type — how do you choose?** By scope. If the column *is* that type
everywhere, use a forced type: the generated API changes once and everything inherits it. If one
query wants an unusual view of a column, use an ad-hoc converter.

**★ What is the cost of introducing a forced type into an existing codebase?** A regeneration and a
compile sweep across every call site that used the old type. That is exactly the visibility you
want, and it is not a small or quiet change.

**★ When would you install a `RecordMapperProvider`?** When a mapping *policy* applies across the
whole codebase — your own conventions, or an external mapping library. Never for one awkward
query, because it makes every query's behaviour depend on configuration a reader cannot see.

**★ Can you filter on a converted type in the `WHERE` clause?** No. Conversion happens on the
client, so predicates are still expressed in the database's representation. A forced type changes
the Java type, not what SQL the database evaluates.

**★ A converter throws on one row. What happens to the query?** It fails. Conversion runs per row
during fetching, so one bad value takes the whole fetch, and the rows already read are discarded.

**★ How do you handle a PostgreSQL type JDBC cannot represent at all?** Not with a converter — with
an `org.jooq.Binding`, registered as a forced type in the generator, so jOOQ knows how to read and
write it at the JDBC level.

**★ Where does mapping belong in a jOOQ codebase — in the query or in a layer above?** In the
query. Fetching straight into the DTO keeps the projection and its target next to each other, so a
change to one is visibly a change to the other, and no `Record` escapes the repository.

{/* FOOTER */}
