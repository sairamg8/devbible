---
title: "`@Query` on a MongoDB repository takes a JSON document, and its parameters are escaped so hard that you cannot smuggle an operator through one"
sidebar_label: "02b · @Query and @Aggregation"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *MongoDB-specific Query
> Methods* — the `@Query`, JSON-based query, SpEL expressions, `@Aggregation` and
> supported-return-types sections
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/repositories/query-methods.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/repositories/query-methods.html))
> and *Value Expressions*
> ([…/mongodb/value-expressions.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/value-expressions.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data MongoDB 5.1.0.

**When a derived method name is not enough, JPA gives you JPQL and MongoDB gives you a
query document written as a JSON string. That is a bigger difference than "another query
language", because the JSON is a template that Spring Data binds parameters into, and it
escapes those parameters deliberately: a `String` argument can never become a MongoDB
operator. The safety is the same safety a JDBC `PreparedStatement` gives you — and it
has the same consequence, that a query whose *structure* must vary cannot be expressed
this way at all.**

## The annotation and every attribute it carries

```java
public interface PersonRepository extends MongoRepository<Person, String> {

    @Query("{ 'firstname' : ?0 }")
    List<Person> findByThePersonsFirstname(String firstname);

    @Query(value = "{ 'firstname' : ?0 }", fields = "{ 'firstname' : 1, 'lastname' : 1 }")
    List<Person> findNamesByFirstname(String firstname);

    @Query(sort = "{ age : -1 }")
    List<Person> findByFirstname(String firstname);

    @Query(value = "{ 'firstname' : ?0 }", hint = "firstname-idx")
    List<Person> findByFirstnameUsingIndex(String firstname);

    @Query(value = "{ 'lastname' : ?0 }", count = true)
    long countByLastname(String lastname);

    @Query(value = "{ 'lastname' : ?0 }", delete = true)
    long deleteAllByLastname(String lastname);

    @Query(value = "{ 'lastname' : ?0 }", exists = true)
    boolean anyoneCalled(String lastname);
}
```

- **`value`** — the query document. `?0`, `?1`, … bind method parameters positionally.
- **`fields`** — a projection document. The reference notes the example above "returns
  only the `firstname`, `lastname` and `Id` properties of the `Person` objects" — `_id`
  comes back whether you asked for it or not, exactly as it does in the shell. Exclude
  it with `'_id' : 0` if you genuinely do not want it.
- **`sort`** — a static sort, applied alongside any `Sort` or `Pageable` argument.
- **`hint`** — names an index and overrides the server's own selection. There is also a
  standalone `@Hint("lastname-idx")` annotation that does the same thing.
- **`collation`** — e.g. `"en_US"`, for locale-aware comparison and case-insensitive
  matching performed by the *server* rather than by a regex.
- **`readPreference`** — e.g. `"nearest"`, `"secondaryPreferred"`. Also available as a
  standalone `@ReadPreference` on the method or on the interface.
- **`count`**, **`delete`**, **`exists`** — turn the query document into a count, a
  delete or an existence check rather than a find.

## The escaping rule, which is the point of the page

The reference states it in one sentence:

> String parameter values are escaped during the binding process, which means that it is
> not possible to add MongoDB specific operators through the argument.

So this does not do what a first reading suggests:

```java
@Query("{ 'age' : ?0 }")
List<Person> findByAgeExpression(String ageCriteria);   // called with "{ $gt : 30 }"
```

The argument binds as the literal string `"{ $gt : 30 }"`, and the query looks for
documents whose `age` field *equals that string* — which is to say, none. There is no
exception. The method returns an empty list, forever, and it survives code review
because it looks like it should work.

This is a feature, not a defect. It is the same reason a `PreparedStatement` parameter
cannot become SQL, and it is what makes `?0` binding injection-safe. If the *structure*
of the query genuinely has to vary, that is what `MongoTemplate` and a programmatically
built `Query` are for — see
**[03 · Where the repository stops and the template starts](03-mongotemplate.md)**.

## Value expressions, and the warning that comes with them

Spring Data does let you compute parts of the query at runtime with SpEL, written
`?#{…}`, where the method arguments are exposed as an array:

```java
@Query("{'lastname': ?#{[0]} }")
List<Person> findByQueryWithExpression(String param0);

@Query("{'id': ?#{ [0] ? {$exists : true} : [1] }}")
List<Person> findByQueryWithExpressionAndNestedObject(boolean param0, String param1);
```

That second example builds a different query *shape* depending on a boolean — exactly
what plain binding refuses to do. The reference attaches a warning, and it deserves
repeating in full:

> SpEL in query strings can be a powerful way to enhance queries. However, they can also
> accept a broad range of unwanted arguments. Make sure to sanitize strings before
> passing them to the query to avoid creation of vulnerabilities or unwanted changes to
> your query.

In short: `?0` is safe by construction; `?#{[0]}` is not. Treat a SpEL-built query
document the way you would treat string-concatenated SQL. The evaluation context is
extensible through `EvaluationContextExtension`, which is how you expose things like the
current principal to a query without threading them through every call site.

## `@Aggregation` on a repository method

An aggregation pipeline can be declared on the interface, so the common
group-and-count queries do not force you down to the template:

```java
@Aggregation("{ $group : { _id : $lastname, names : { $addToSet : $firstname } } }")
List<PersonAggregate> groupByLastnameAndFirstnames();

@Aggregation("{ $group : { _id : $lastname, names : { $addToSet : ?0 } } }")
List<PersonAggregate> groupByLastnameAnd(String property);

@Meta(allowDiskUse = "true")
@Aggregation("{ $group : { _id : $lastname, names : { $addToSet : $firstname } } }")
List<PersonAggregate> groupByLastnameAndFirstnamesAllowingDisk();
```

Accepted return types are a single value extracted from the result document, a domain
type, a `Stream<T>` you must close, `AggregationResults<T>` for the raw result, an
interface projection, or a `Slice<T>` when the method takes a `Pageable`.

🔴 The reference is explicit that **"the `Page` return type is not supported for
repository methods using `@Aggregation`"** — producing a `Page` means counting the full
result set, and counting a pipeline's output means running the pipeline twice.

`@Meta` is where the per-query server options live: `allowDiskUse` for pipelines that
exceed the in-memory stage limit, plus cursor batch size and max-time settings.

## Return types, and the two documented holes

Imperative repositories support `Optional<T>`, `T`, `List<T>`, `Page<T>` (needs a
`Pageable`), `Slice<T>`, `Stream<T>` (must be closed), `Window<T>` for keyset scrolling,
and `GeoResults<T>`/`GeoResult<T>` for geo queries. Reactive repositories return
`Mono<T>` and `Flux<T>`.

Two limitations are stated outright and are worth knowing before you design around them:

> The `Page` return type (as in `Mono<Page>`) is not supported by reactive repositories.

> We do not support referring to parameters that are mapped as `DBRef` in the domain
> class.

The second one is easy to hit on a model that leaned on `@DBRef`, and it is one of
several reasons the reference now steers people towards `@DocumentReference` instead.

## Gotchas

**★ Passing an operator document as a `String` parameter does nothing at all.** It is
escaped and matched literally. The failure mode is an empty result, not an exception.

**★ `?#{…}` SpEL undoes the escaping guarantee entirely.** Anything interpolated that
way *is* query structure. Sanitise it, or build the query with `Criteria` on the
template where the types make the shape explicit and reviewable.

**★ `fields` returns `_id` whether you list it or not.** If you were counting bytes on
the wire, count `_id` too.

**★ The query document is mapped against the domain type, so property names get
translated — but only property names.** A raw field name you invented and that maps to
no property is passed through unchanged and silently matches nothing. Keep `@Query`
documents written in terms of Java property names.

**★ `@Query(delete = true)` deletes and returns a count; it does not return the
documents.** If you need to see what you removed, that is `findAllAndRemove` on the
template, which is a different operation with a different number of round trips.

**★ Declaring `Page<T>` on an `@Aggregation` method is a startup failure, not a runtime
one.** That is the better outcome, but it surprises people who added the `Pageable`
first and the pipeline second.

**★ `@Meta(allowDiskUse = "true")` takes a String, not a boolean.** The attribute is
declared as a String so it can be left unset; passing the literal `"true"` is correct
and reads like a mistake.

**★ A `@Query` with a `sort` attribute and a `Pageable` with its own `Sort` both
apply.** They do not conflict loudly. Work out which one you meant rather than leaving
both in place.

**★ SpEL in a query string is evaluated on every invocation.** It is not compiled once
into a static document, so an expensive expression is an expensive expression on every
call.

**★ `count = true` and a `Pageable` are not the same mechanism.** `count = true` makes
*this* method a count. A `Page` return type runs the find and a *separate* count query
that Spring Data derives from the same criteria.

## Interview questions

**★ What does `@Query` contain on a MongoDB repository?**
A MongoDB query document written as JSON, with `?0`-style positional placeholders — not
JPQL and not SQL. Its `fields`, `sort`, `hint`, `collation`, `readPreference`, `count`,
`delete` and `exists` attributes cover most of what you would otherwise drop to the
template for.

**★ Can a method parameter contribute a MongoDB operator to a `@Query`?**
No. Parameter values are escaped during binding precisely so that they cannot, which is
what makes `?0` injection-safe. If the query's structure must vary, use SpEL — accepting
that you have taken on the sanitisation — or build it with `Criteria` on
`MongoTemplate`.

**★ Someone passes `"{ $gt : 30 }"` as a `String` argument and the method returns
nothing. What happened?**
It was escaped and matched as a literal string value, so no document's `age` field
equals it. Nothing failed; the query simply asked a different question from the one
intended.

**★ Why is `Page` not allowed on an `@Aggregation` method?**
`Page` requires a total count of matching results, and counting a pipeline's output
means running the pipeline. `Slice` is offered instead because it only needs to know
whether one more element exists.

**★ What is the security posture of `?0` versus `?#{[0]}`?**
`?0` is escaped and cannot alter the query's structure — it is the safe form. `?#{[0]}`
is SpEL, evaluated into the query document before parsing, so its input is code. The
reference explicitly tells you to sanitise anything you interpolate that way.

**★ How do you make one repository query use a specific index?**
`@Query(hint = "…")` or the standalone `@Hint("…")`. Both name an index and override the
server's selection, which is occasionally the only way to stop the planner picking a
worse one after a data-distribution change.

**★ What does `@Meta(allowDiskUse = "true")` do, and why is it a String?**
It permits an aggregation stage to spill to disk when it exceeds the server's in-memory
limit. It is a String so the attribute can be genuinely unset rather than defaulting to
`false` and overriding a server-side or template-level setting.

**★ Your reactive repository method wants to return `Mono<Page<Order>>`. Will it work?**
No — the reference states `Page` is not supported by reactive repositories, because
computing a total conflicts with the deferred, streaming result model. Return a `Flux`
and count separately if you truly need a total.

**★ Why does `@DBRef` interact badly with repository query methods?**
Referring to a `DBRef`-mapped parameter in a query method is documented as unsupported,
because resolving the reference would require a second lookup the query layer does not
perform. `@DocumentReference` is the newer mechanism and does not carry the same
restriction.

{/* FOOTER */}
