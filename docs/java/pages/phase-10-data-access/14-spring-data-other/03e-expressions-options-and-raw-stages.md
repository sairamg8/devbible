---
title: "Version 3.2 turned a misspelled property in a typed pipeline from an exception into an empty column, and `strictMapping` is the one-word option that gives the exception back"
sidebar_label: "03e · Expressions, options and raw stages"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *Aggregation Framework
> Support* — the projected-field reference rule and the 3.2 `strictMapping` note
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/aggregation-framework.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/aggregation-framework.html))
> and the `Aggregation` javadoc for `stage(String)` / `stage(Bson)`, *"Since: 4.0"*
> ([docs.spring.io/spring-data/mongodb/docs/current/api/…/aggregation/Aggregation.html](https://docs.spring.io/spring-data/mongodb/docs/current/api/org/springframework/data/mongodb/core/aggregation/Aggregation.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data MongoDB 5.1.0, MongoDB Java driver 5.8.0,
> MongoDB 8.

**Stages are the skeleton of a pipeline; expressions are what happens inside them, and
they are where the Java DSL is doing the most work and giving you the least protection. A
field reference that should have been a literal, a property name that no longer exists, and
a raw stage that opted out of mapping without telling you all produce the same symptom — a
result document with a field missing. This chunk is the three mechanisms behind that
symptom, and the option that turns one of them back into an error.**

## Expressions: the part that is not just field names

`group("customerId").sum("total")` covers the accumulators. Anything *computed* needs an
`AggregationExpression`, and Spring Data groups them into operator classes named after the
categories in the MongoDB manual — `ArithmeticOperators`, `ComparisonOperators`,
`ConditionalOperators`, `StringOperators`, `DateOperators`, `ArrayOperators`,
`ObjectOperators`, `SetOperators`, `AccumulatorOperators`:

```java
project()
    .and(ArithmeticOperators.valueOf("subtotal").add("shippingCost")).as("total")
    .and(ConditionalOperators.when(where("total").gte(100))
            .then("FREE").otherwise("STANDARD")).as("shipping")
    .and(DateOperators.dateOf("placedAt").toString("%Y-%m")).as("month");
```

`AggregationSpELExpression.expressionOf("…")` is the other route: a SpEL string compiled
into the equivalent expression document. It reads well for arithmetic and badly for
everything else, and it puts a string where the compiler could have been.

### The `$` rule, which the DSL half-hides

In the pipeline language a `$` prefix means *the value of this field*; no prefix means a
literal. The DSL adds the `$` for you in the places it knows about — `and("total")`,
`valueOf("subtotal")`, `group("customerId")`. That is convenient, and it is exactly why
the places it does *not* know about are dangerous: a raw string embedded in an expression
you assembled yourself, or a value passed to `then(…)`/`otherwise(…)`, is taken as a
literal. `then("FREE")` above stores the four characters `FREE`; `then("$shippingCode")`
would store the value of a field. Nothing distinguishes the two at the Java type level,
because both are `String`.

### A projection deletes names, not just data

> *"References to projected fields in later aggregation stages are valid only for the field
> names of included fields or their aliases (including newly defined fields and their
> aliases). Fields not included in the projection cannot be referenced in later aggregation
> stages."*

That is a pipeline-language rule, not a Spring Data one, and the DSL will happily let you
break it: `project("revenue")` followed by `sort(DESC, "orders")` compiles, ships, and
sorts on a field that no longer exists. Every stage after a `$project` sees only what the
projection let through.

## `AggregationOptions`, and the check that used to be on by default

```java
Aggregation pipeline = newAggregation(Order.class, match(…), group(…))
        .withOptions(AggregationOptions.builder()
                .allowDiskUse(true)
                .strictMapping()
                .build());
```

- **`allowDiskUse`** permits a stage to spill to disk instead of failing when it exceeds
  the server's in-memory limit for a pipeline stage. It is the programmatic twin of
  `@Meta(allowDiskUse = "true")` on a repository method, covered in
  [02b · `@Query` and `@Aggregation`](02b-query-and-aggregation.md).
- **`strictMapping`** restores an error that used to be the default:

> *"Changed in 3.2 referencing non-existent properties does no longer raise errors. To
> restore the previous behaviour use the `strictMapping` option of `AggregationOptions`."*

This is the most consequential sentence on the reference page. In a typed aggregation,
misspelling a property once produced an exception while the pipeline was being built; now
it produces a pipeline referencing a field that does not exist, which MongoDB treats as
missing rather than as an error. The result set comes back the right size with one column
blank.

**Turn `strictMapping` on for every typed pipeline.** It converts a whole class of silent
wrong answers back into loud failures, it costs nothing at runtime, and the only reason it
is not the default is backwards compatibility with pipelines that were relying on the old
laxity by accident.

⚠️ It does nothing for an **untyped** aggregation. There is no domain type to check
against, so there is nothing to be strict about — which is one more reason the typed form
is the default you should have to argue your way out of.

## Where the DSL stops

MongoDB ships operators faster than any wrapper can wrap them, and a stage added in the
current server release may have no factory method yet. The escape hatch is a raw stage:

```java
newAggregation(Order.class,
        match(where("status").is("SHIPPED")),
        stage("""
            { $setWindowFields: {
                partitionBy: '$customerId',
                sortBy: { placedAt: 1 },
                output: { running: { $sum: '$total',
                          window: { documents: ['unbounded', 'current'] } } } } }
            """));
```

The javadoc is explicit about the price, and it is the price of every raw escape hatch in
this topic:

> *"Creates a new `AggregationOperation` taking the given json value as is. Field mapping
> against a potential domain type or previous aggregation stages will not happen."*

So inside a `stage("…")` you are writing **stored** field names, not property names, even
in a typed aggregation, and even with `strictMapping` set. `stage(Bson)` is the same thing
built with the driver's builders instead of a string — better for anything assembled from
variables, because it does not require string-concatenating JSON.

Below that, `AggregationOperation` is an interface and `newAggregation` takes a list of
them, so a stage type you write yourself is a first-class member of a pipeline rather than
a workaround.

## Gotchas

**★ Since 3.2 a misspelled property in a typed pipeline is not an error.** It became a
reference to a non-existent field, which MongoDB treats as missing. `strictMapping` gives
the failure back and almost nobody sets it.

**★ `strictMapping` has no effect on an untyped aggregation.** Setting it there looks like
protection and provides none, because there is no type to check names against.

**★ A literal and a field reference are both `String` in the DSL.** `then("FREE")` stores
text; `then("$code")` stores the value of a field. The compiler cannot tell them apart, and
the error is a column full of the literal `$code` — or a column full of `FREE` where you
wanted the field.

**★ `project(…)` removes names from every later stage.** A `sort` or `match` after a
projection can only see included fields and their aliases. Sorting on a projected-away
field is accepted and does nothing useful.

**★ `stage("…")` opts out of all mapping, including in a typed aggregation.** Property
names inside a raw stage are stored field names. Mixing mapped stages and raw stages in one
pipeline means two naming conventions in one method, and the second one has no compiler
and no `strictMapping` behind it.

**★ A raw stage built by concatenating strings is an injection surface.** It is the same
argument as string-concatenated SQL: a value interpolated into pipeline JSON can add
operators. `stage(Bson)` with the driver's builders, or a parameterised stage built from
`Document` objects, keeps values as values.

**★ `$group` is memory-bound per stage, and the fix is a flag — which is the trap.**
`allowDiskUse(true)` makes a failing aggregation succeed slowly. It does not make it a good
idea; a grouping stage that needs disk usually wants an index and an earlier `match`
instead.

**★ `AggregationSpELExpression` moves a compile error to runtime.** The SpEL string is
parsed when the pipeline is built. It buys readable arithmetic and costs you every check
the operator classes would have given you.

**★ `ConditionalOperators.when(…)` takes a `Criteria`, which reads like a query and is
not one.** It becomes a `$cond` expression evaluated per document inside the pipeline, not
a filter with an index behind it. A conditional projection over a large collection is a
full scan wearing a familiar API.

## Interview questions

**★ Why does a misspelled property in a typed pipeline no longer throw?**
Because 3.2 changed the default: referencing non-existent properties stopped raising
errors. `AggregationOptions.builder().strictMapping()` restores the previous behaviour, and
on a typed pipeline there is no good reason to leave it off.

**★ What does `allowDiskUse` actually change?**
It permits a stage that exceeds the server's in-memory limit for a pipeline stage to spill
to disk instead of failing. It converts an error into a slow success — useful for a batch
report, a bad answer for anything on a request path.

**★ How do you use a pipeline stage Spring Data has no factory for?**
`Aggregation.stage(json)` or `stage(Bson)`, which passes the stage through as-is. The cost
is that field mapping against the domain type does not happen inside it, so you must write
stored field names, and `strictMapping` cannot help you there.

**★ Why does a projection restrict which fields later stages can use?**
Because `$project` defines the shape of the documents flowing onward — a field that is not
included does not exist downstream. The reference states it directly, and the Java DSL will
still let you reference a field you just projected away.

**★ How does the DSL decide whether a string is a field reference or a literal?**
By where you put it. Positions the DSL treats as field paths get the `$` added; positions
it treats as values do not. Since both are `String` in Java, the only defence is knowing
which builder method you are calling.

**★ When would you prefer `stage(Bson)` over `stage(String)`?**
Whenever any part of the stage comes from a variable. Building the stage with the driver's
document builders keeps values as values instead of interpolating them into JSON, which is
the same reason a `PreparedStatement` beats string concatenation.

**★ Is `ConditionalOperators.when(criteria)` a filter?**
No. It is an expression evaluated per document inside the pipeline and compiled to `$cond`.
It reuses the `Criteria` builder for syntax, which makes it look like a `$match` that could
use an index — it cannot.

{/* FOOTER */}
