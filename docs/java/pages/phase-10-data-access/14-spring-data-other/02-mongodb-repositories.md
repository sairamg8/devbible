---
title: "A MongoDB repository derives the same method names JPA does, and its keyword vocabulary has two entries a relational schema cannot even express"
sidebar_label: "02 · MongoDB repositories"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *MongoDB-specific Query
> Methods*
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/repositories/query-methods.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/repositories/query-methods.html)),
> *MongoDB Repositories*
> ([…/mongodb/repositories/repositories.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/repositories/repositories.html))
> and *Repository query keywords*
> ([…/repositories/query-keywords-reference.html](https://docs.spring.io/spring-data/mongodb/reference/repositories/query-keywords-reference.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data MongoDB 5.1.0, MongoDB Java driver 5.8.0.

**`MongoRepository<T, ID>` extends `PagingAndSortingRepository` and `CrudRepository`, so
everything you know about deriving `findByStatusAndPlacedAtAfter` from a method name
works unchanged — the parser is the shared one from Spring Data Commons. What changes is
the vocabulary it can compile down to. Two keywords have no relational equivalent at
all: `Exists`, which asks whether a *field is present in the document*, and the
geo-spatial `Near`/`Within` pair. And several keywords that look identical to their JPA
counterparts have a completely different cost, because on MongoDB they become regular
expressions.**

## What `MongoRepository` gives you over `CrudRepository`

```java
public interface OrderRepository extends MongoRepository<Order, String> {
}
```

On top of the commons methods it adds MongoDB-flavoured ones: `insert(S entity)` and
`insert(Iterable<S>)` — which fail on a duplicate `_id` rather than overwriting, unlike
`save` — plus `findAll(Sort)`, `findAll(Pageable)` and the Query-by-Example methods.

You do not have to use it. A repository over MongoDB can extend plain `CrudRepository`
or `ListCrudRepository` if you want a narrower surface, and doing so is a reasonable
default: `MongoRepository.findAll()` returning the entire collection is rarely a method
you want visible on a service-facing interface.

## Derived queries

```java
public interface OrderRepository extends MongoRepository<Order, String> {

    List<Order> findByStatus(String status);

    List<Order> findByStatusAndPlacedAtAfter(String status, Instant since);

    List<Order> findByCustomerIdOrderByPlacedAtDesc(String customerId);

    List<Order> findTop10ByStatusOrderByTotalDesc(String status);

    Optional<Order> findByReference(String reference);

    long countByStatus(String status);

    boolean existsByReference(String reference);

    Slice<Order> findByStatus(String status, Pageable pageable);
}
```

The keyword set is broad and close to the JPA one: comparison (`After`, `Before`,
`GreaterThan`, `GreaterThanEqual`, `LessThan`, `LessThanEqual`, `Between`, `In`,
`NotIn`), null handling (`IsNull`, `IsNotNull`), string matching (`Like`,
`StartingWith`, `EndingWith`, `Containing`, `NotContaining`, `NotLike`, `Regex`),
booleans (`IsTrue`, `IsFalse`), `Exists`, `IgnoreCase`, and the geo-spatial `Near` and
`Within`.

### The two that have no relational analogue

**`Exists`** maps to MongoDB's `$exists` — a test for whether the *field is present in
the document at all*. A relational schema cannot pose that question: every row has every
column, and the closest thing is `IS NULL`, which is a different assertion. In a
document store, "the field is absent" and "the field is present and null" are distinct
states, and a query that conflates them will be wrong on one of them.

**`Near` and `Within`** compile to `$near`, `$nearSphere` and `$geoWithin`:

```java
List<Person> findByLocationNear(Point location, Distance distance);
List<Person> findByLocationWithin(Circle circle);
List<Person> findByLocationWithin(Box box);
List<Person> findByLocationWithin(Polygon polygon);
List<Person> findByLocationWithin(GeoJsonPolygon polygon);
```

The reference notes that "Using a `Distance` with a `Metric` causes a `$nearSphere`
(instead of a plain `$near`) clause to be added" — so a `Distance` constructed with
`Metrics.KILOMETERS` and one constructed without a metric ask the server two different
questions, on a flat plane and on a sphere respectively.

Geo methods can return `GeoResults<T>` or `GeoResult<T>`, which wrap each hit with its
computed distance. Those are the only repository return types in the whole of Spring
Data that a JPA repository has no equivalent for.

## Collation and read preference belong on the method

Two MongoDB concerns that JPA has nowhere to put are first-class on a repository method:

```java
public interface PersonRepository extends CrudRepository<Person, String> {

    // server-side, locale-aware comparison — not a regex
    @Query(collation = "en_US")
    List<Person> findByFirstname(String firstname);

    // collation can also be a parameter
    List<Person> findByLastname(String lastname, Collation collation);

    // route this one query away from the primary
    @ReadPreference("secondaryPreferred")
    List<Person> findWithReadPreferenceAnnotationByLastname(String lastname);
}
```

`@ReadPreference` can also sit on the interface, applying to every method on it.

## Gotchas

**★ Derived query methods use the *property* name, not the stored field name.** If a
property carries `@Field("ln")`, the method is still `findByLastname`, and Spring Data
maps it to `ln` for you. Writing `findByLn` fails at startup with a property-not-found
error — which is the good outcome, because it fails loudly.

**★ `Like` and `Containing` compile to a regular expression.** Unlike SQL's `LIKE`,
which a planner can sometimes serve from an index prefix, an unanchored MongoDB regex is
a collection scan. `StartingWith` is the one that can use an index, because it anchors
at `^`.

**★ `IgnoreCase` is also a regex, and a worse one.** A case-insensitive regex cannot use
an ordinary index at all. The scalable answer is a collation with a case-insensitive
strength *plus an index created with the same collation* — server-side work an index can
support. `@Query(collation = "en_US")` is how you ask for it from a repository.

**★ A `Page<T>` return type costs an extra round trip.** `Page` carries
`getTotalElements()`, and MongoDB has to run a count to produce it. On a large
collection with a selective filter, that count can dominate the request. Use `Slice<T>`
when the caller only needs "is there more", or `Window<T>` for keyset scrolling.

**★ A `Stream<T>` return type holds a cursor open on the server.** It must be closed —
try-with-resources or an explicit `.close()` — and consumed inside the session that
opened it. Forgetting leaks server-side, where you will not notice it locally.

**★ `Exists` as a keyword and `existsBy…` as a subject are entirely different
questions.** `existsByReference(String)` asks whether a *document* matches;
`findByNicknameExists(boolean)` asks whether the *field is present*. The two read almost
identically and mean nothing like each other.

**★ Querying a field that is absent from most documents with `IsNull` will miss them.**
`IsNull` maps to a match on `null`, and in MongoDB a missing field and a `null` field
are different. If your model lets a field be absent, `Exists` is the keyword you wanted.

**★ `findAll()` on a `MongoRepository` reads the whole collection.** It is inherited
from `CrudRepository` and it looks harmless on an interface. There is no `LIMIT` in
sight and no query planner to warn you.

**★ Sorting on an unindexed field can fail rather than just be slow.** The server
enforces a memory limit on in-memory sorts and errors out past it. A relational database
would spill to disk; MongoDB refuses. `allowDiskUse` exists for aggregations, not for
find-with-sort.

**★ `@ReadPreference("secondaryPreferred")` buys throughput and gives up read-your-
writes.** A secondary is eventually consistent with the primary. Putting the annotation
on the whole interface rather than one method is how a "save then immediately read it
back" flow starts intermittently returning stale data.

## Interview questions

**★ Which derived-query keywords exist on MongoDB that have no JPA equivalent, and
why?**
`Exists`, because a document store distinguishes "field absent" from "field present and
null" and a fixed relational schema cannot; and the geo-spatial `Near`/`Within`, because
JPA has no geometry model. Everything else in the vocabulary is shared code from Spring
Data Commons.

**★ Your repository method is `findByLastname` but the field in MongoDB is `ln`. Does it
work?**
Yes, provided the property is annotated `@Field("ln")`. Derived queries are expressed in
terms of Java property names and the mapping layer translates them. Naming the method
`findByLn` fails at startup instead, which is the behaviour you want.

**★ What is the difference between `insert` and `save` on a `MongoRepository`?**
`insert` fails if a document with the same `_id` already exists; `save` overwrites it.
`save` is the upsert-flavoured one, which is also why it is dangerous on a partially
populated object — see
**[03 · Where the repository stops and the template starts](03-mongotemplate.md)**.

**★ `findByNameIgnoreCase` on a ten-million-document collection is slow. Why, and what
is the fix?**
It becomes a case-insensitive regular expression, and no ordinary index can serve one.
The fix is a collation with a case-insensitive strength and an index created with that
same collation, requested from the repository via `@Query(collation = "…")`.

**★ When would you return `Slice` instead of `Page`?**
Whenever the caller does not need a total count. `Page` forces a second count query;
`Slice` fetches one extra element to decide whether a next page exists. On a document
store with a large collection that difference is often the whole cost of the request.

**★ What do `GeoResults` and `GeoResult` carry that a plain `List` does not?**
The computed distance for each hit, and for `GeoResults` the average distance across
them. They are the only repository return types with no JPA counterpart.

**★ A `Distance` with and without a `Metric` behave differently. How?**
Without a metric the query becomes `$near`, treating coordinates as points on a plane.
With a metric it becomes `$nearSphere`, treating them as points on a sphere. On real
geographic data the plane version is wrong.

**★ Why might you extend `CrudRepository` rather than `MongoRepository`?**
To keep `findAll()` and the other whole-collection methods off the interface. Narrower
supertypes are a design choice available in every Spring Data module, and it matters
more on a store where a full scan has no planner to complain about it.

{/* FOOTER */}
