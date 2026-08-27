---
title: "An aggregation pipeline built in Java is an ordered list of stage objects, and the type argument you are not required to supply is the only thing that checks your field names"
sidebar_label: "03d · Aggregation from Java"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *Aggregation Framework
> Support*
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/aggregation-framework.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/aggregation-framework.html))
> and the `Aggregation` class javadoc for the `newAggregation` and `previousOperation`
> signatures
> ([docs.spring.io/spring-data/mongodb/docs/current/api/…/aggregation/Aggregation.html](https://docs.spring.io/spring-data/mongodb/docs/current/api/org/springframework/data/mongodb/core/aggregation/Aggregation.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data MongoDB 5.1.0, MongoDB Java driver 5.8.0,
> MongoDB 8.

**A `@Query` document is a filter. An aggregation pipeline is a program: match, group,
reshape, join, and hand back rows that need not resemble any document in the collection.
Spring Data models it as an ordered list of `AggregationOperation` objects, which is a
faithful translation — a pipeline really is an ordered list of stages, and the Java DSL
adds nothing to it except the possibility of checking your field names against a domain
type. That check is opt-in, and this chunk is mostly about what happens when you skip it.**

## The DSL is a list of stages, and nothing more

> *"An `Aggregation` represents a MongoDB `aggregate` operation and holds the description
> of the aggregation pipeline instructions."*

> *"Aggregations are created by invoking the appropriate `newAggregation(…)` static factory
> method of the `Aggregation` class, which takes a list of `AggregateOperation` and an
> optional input class."*

Everything reads better with the static import, and every example below assumes it:

```java
import static org.springframework.data.mongodb.core.aggregation.Aggregation.*;
```

```java
record RevenueByCustomer(String customerId, BigDecimal revenue, int orders) {}

TypedAggregation<Order> pipeline = newAggregation(Order.class,
        match(where("status").is("SHIPPED").and("placedAt").gte(since)),
        group("customerId")
                .sum("total").as("revenue")
                .count().as("orders"),
        project("revenue", "orders").and("customerId").previousOperation(),
        sort(Sort.Direction.DESC, "revenue"),
        limit(20));

AggregationResults<RevenueByCustomer> results =
        mongo.aggregate(pipeline, RevenueByCustomer.class);

List<RevenueByCustomer> top = results.getMappedResults();
```

Read that as five stages in order, because that is exactly what the server receives. The
DSL is not a query planner and it does not reorder anything: if you put `sort` before
`match`, the server sorts the whole collection and then throws most of it away.

`previousOperation()` is the Java spelling of the `_id` a `$group` produces. The group key
lands in `_id`, and a later stage that wants to call it `customerId` again has to say so —
the javadoc describes the method as *"A pointer to the previous `AggregationOperation`"*.
Forgetting it is the single most common reason a pipeline returns objects whose key field
is null: the value is in the result, under `_id`, and the target type has no such property.

## Typed and untyped, and why it matters more than it looks

> *"A `TypedAggregation`, just like an `Aggregation`, holds the instructions of the
> aggregation pipeline and a reference to the input type, that is used for mapping domain
> properties to actual document fields."*

Two things come from that input type. First, the collection name:

> *"Note that, if you provide an input class as the first parameter to the `newAggregation`
> method, the `MongoTemplate` derives the name of the input collection from this class.
> Otherwise, if you do not not specify an input class, you must provide the name of the
> input collection explicitly. If both an input class and an input collection are
> provided, the latter takes precedence."*

Second, and far more valuable: **property names in the pipeline are translated into stored
field names.** A property mapped with `@Field("ts")` can be written as `placedAt` in a
typed pipeline and arrives at the server as `ts`. In an untyped pipeline it arrives as
`placedAt`, matches nothing, and the stage quietly produces nothing. That renaming
mechanism is the subject of
[02c · Documents and identifiers](02c-documents-and-mapping.md); the point here is that it
only runs when the aggregation knows the type.

```java
// untyped: you own the collection name AND the stored field names
Aggregation raw = newAggregation(
        match(where("ts").gte(since)),
        group("customerId").sum("total").as("revenue"));

AggregationResults<Document> results = mongo.aggregate(raw, "orders", Document.class);
```

Untyped is the right choice for a genuinely dynamic pipeline over a collection with no
domain class, and for `$out`/`$merge` pipelines whose output type is unrelated to the
input type. It is the wrong choice for a pipeline over an entity you have mapped, and the
failure mode is silence rather than an exception.

## The stage vocabulary

The `Aggregation` class carries a static factory for essentially the whole pipeline
language: `match`, `group`, `project`, `sort`, `sortByCount`, `limit`, `skip`, `unwind`,
`lookup`, `graphLookup`, `facet`, `bucket`, `bucketAuto`, `addFields`, `set`, `unset`,
`count`, `sample`, `redact`, `replaceRoot`, `geoNear`, `merge`, `out`, `unionWith` and
`setWindowFields`. The names match the `$`-prefixed operators one for one, which is
deliberate: **this DSL is not an abstraction over the pipeline language, it is a
transcription of it**, and the MongoDB section of this bible
([`docs/mongodb`](../../../../mongodb/README.md)) owns what each stage means.

Two of them behave differently from the rest and are worth naming here:

- **`unwind(field, preserveNullAndEmptyArrays)`** — the two-argument form exists because
  the default drops documents whose array is empty or missing. A count that mysteriously
  falls after adding an `unwind` is this, not a bug in the match.
- **`out` and `merge`** — these *write*. A pipeline ending in `$out` replaces a collection;
  `$merge` upserts into one. They must be the last stage, and running one against
  production while iterating on a query in a scratch class is a real way to lose data.

## Results

> *"`AggregationResults` is the container for the result of an aggregate operation. It
> provides access to the raw aggregation result, in the form of a `Document` to the mapped
> objects and other information about the aggregation."*

`getMappedResults()` gives you `List<T>`; the raw `Document` view is there for the shapes
your target type does not cover. The target type is mapped by the same converter that maps
entities, so a `record` with matching component names works — and a component whose name
does not appear in the output document is simply null, never a failure.

`mongo.aggregateStream(pipeline, TargetType.class)` returns a `CloseableIterator<T>` over a
server-side cursor for results that do not fit in memory, with the same obligation to close
it as any cursor in
[03c · Fluent API and bulk writes](03c-fluent-api-and-bulk-writes.md).

Expressions, `AggregationOptions` and the escape hatch for stages the DSL has no factory
for are in
[03e · Expressions, options and raw stages](03e-expressions-options-and-raw-stages.md).

## Gotchas

**★ An untyped aggregation does no field-name mapping at all.** `@Field`-renamed
properties, `_id` versus `id`, and any custom naming strategy are all yours to spell
correctly. The pipeline is accepted, matches nothing, and returns an empty list — which
reads exactly like "no data yet".

**★ Forgetting `previousOperation()` after a `group` leaves the key in `_id`.** The mapped
result has a null where the group key should be, and nothing anywhere reports a problem.

**★ Stage order is your responsibility, not the planner's.** `match` before `sort` before
`limit`. A pipeline that sorts first sorts the entire collection; nothing in the DSL warns
you, and on a small dev dataset it is imperceptible.

**★ `unwind` drops documents with an empty or missing array unless you ask it not to.**
`unwind(field, true)` preserves them. A join-like pipeline that silently loses the parents
without children is this and only this.

**★ A pipeline ending in `$out` or `$merge` writes.** `out` replaces the whole target
collection. There is no dry-run mode, and the same code that felt like a read in
development is a destructive write in production.

**★ The mapped result type is matched by name and is null-tolerant.** A `record` whose
component does not appear in the output is populated with null rather than rejected, so
renaming a projection alias silently blanks a column instead of failing.

**★ `aggregateStream` holds a server-side cursor open.** Same rule as `stream()`: close it,
and do not let the iterator escape the method that opened it.

**★ Aggregations do not participate in the repository's `Page` machinery.** Counting the
full pipeline means executing it a second time, which is why `Page` is refused on
`@Aggregation` methods (see
[02b · `@Query` and `@Aggregation`](02b-query-and-aggregation.md)) and why `skip`/`limit`
in a pipeline gives you a slice, not a page.

**★ A read preference that permits a secondary changes what the aggregation sees, not just
how fast it is.** A reporting pipeline reading a lagging secondary returns numbers that
were true a moment ago. That is often acceptable and it is never automatically acceptable.

**★ `$lookup` is a join and is priced like one.** The DSL makes it one line, which removes
every visual cue that you have asked a document database to do the thing it was designed
not to do. If a pipeline's `$lookup` is on a hot path, the modelling decision behind it is
the real subject.

## Interview questions

**★ What is the difference between `Aggregation` and `TypedAggregation`?**
The input type. `TypedAggregation` derives the collection name from the class and maps
property names to stored field names through the mapping metadata. Untyped does neither:
you pass the collection name and you write field names exactly as they are stored.

**★ You added `@Field("ts")` to a property and one aggregation started returning nothing.
Why?**
That aggregation was untyped, so `placedAt` went to the server unchanged and matched no
field. Nothing errors, because a reference to a non-existent field is "missing" to MongoDB,
not "invalid".

**★ After a `$group` your mapped results have a null id. What is missing?**
The group key is in `_id`. Either project it back to the name your result type expects with
`.and("customerId").previousOperation()`, or declare the component as `id`.

**★ When is an untyped aggregation the right choice?**
When there is no domain class — an ad-hoc report over a collection you do not map, a
pipeline assembled from stage descriptions at runtime, or an `$out`/`$merge` pipeline whose
output shape is unrelated to the input type.

**★ How do you page an aggregation?**
You do not, in the `Page` sense. `skip` and `limit` give you a slice; a total requires
running a second `$count` pipeline. That is the same reason `Page` is rejected as a return
type on `@Aggregation` repository methods, and the same reason offset paging over a large
result is expensive here for exactly the reasons it is expensive in SQL.

**★ Why is a scratch class that iterates on a pipeline dangerous?**
A pipeline ending in `$out` replaces a collection every time it runs, and `$merge` upserts.
Exploration and destruction look identical in this API — the difference is one stage at the
end of a list.

**★ Does the DSL optimise anything?**
No. It builds the document the server receives, in the order you wrote the stages. Every
piece of pipeline-ordering advice from the MongoDB manual applies unchanged, because there
is no layer in between that could apply it for you.

{/* FOOTER */}
