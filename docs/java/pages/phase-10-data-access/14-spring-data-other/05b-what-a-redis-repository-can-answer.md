---
title: "A Redis repository can answer equality and nothing else, its `Sort` runs in your JVM after everything has been loaded, and a finder on an unindexed property has no set to read"
sidebar_label: "05b · What a Redis repository can answer"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data Redis 4.1 reference *Redis Repositories* —
> *Secondary Indexes*
> ([docs.spring.io/spring-data/redis/reference/redis/redis-repositories/indexes.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/indexes.html))
> and *Queries and Query Methods*
> ([…/redis-repositories/queries.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/queries.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data Redis 4.1.0, Spring Data KeyValue 4.1.0,
> Lettuce 7.5.2, Redis 8.

**The derived-query parser is shared code: `findByFirstnameAndLastname` is parsed by the
same machinery whether the store is Postgres, MongoDB or Redis. What differs is what the
executor can do with the result, and on Redis the answer is startlingly narrow. There is no
index scan, no range, no ordering, no cursor over a sorted structure — there are only sets
of ids, one per distinct indexed value, and set intersection. Everything the parser will
happily accept beyond that either fails, or is done in your application's memory after
loading the whole result.**

## An index is a set per value

Mark a property `@Indexed` and every save adds the entity's id to a set named for the
value:

```java
@RedisHash("people")
public class Person {

  @Id String id;
  @Indexed String firstname;
  String lastname;
  Address address;
}
```

The reference states the maintenance contract:

> *"Values are written to the according indexes on every save and are removed when objects
> are deleted or expire."*

Nested properties index by their path — the reference shows `SADD people:address.city:tear`
for an indexed `city` inside an embedded `Address` — and properties inside maps and lists
index too.

Three consequences follow directly from "a set per distinct value", and none of them is
signposted by the API:

1. **Cardinality is key count.** An indexed `email` on ten million people is ten million
   Redis keys, each a set with one member. An indexed `status` with four values is four
   sets. The first is a memory disaster; the second is what indexes here are for.
2. **Only equality is expressible.** A set named for a value can be looked up by that
   value. There is no ordering between sets, so no `Between`, no `GreaterThan`, no
   `StartingWith`, no `Like`.
3. **Indexes have no statistics and no planner.** Nothing chooses between two indexes,
   because the execution is always the same: intersect the sets you named.

Booleans get a documented spelling of the same mechanism: `IsTrue` reads `…:alive:1` and
`IsFalse` reads `…:alive:0` — two sets, not a flag.

### `@GeoIndexed`, which is a different mechanism

A `Point` property annotated `@GeoIndexed` is stored with `GEOADD` and queried with
`GEORADIUS`, which is a real Redis data structure rather than a synthesised set. It comes
with a documented restriction:

> *"It is **not** possible to combine `near` and `within` with other criteria."*

A geo predicate is the whole query or it is not usable.

### Indexing something you cannot annotate

```java
@Configuration
@EnableRedisRepositories(indexConfiguration = MyIndexConfiguration.class)
public class ApplicationConfig {

  public static class MyIndexConfiguration extends IndexConfiguration {

    @Override
    protected Iterable<IndexDefinition> initialConfiguration() {
      return Collections.singleton(
          new SimpleIndexDefinition("people", "firstname"));
    }
  }
}
```

Same effect, declared centrally. Useful for a type you do not own, and useful when you want
the set of indexes in one reviewable place rather than scattered across annotations —
which, given that every index is a per-save write cost, is a reasonable thing to want.

### The one that removes a whole design

> *"Indexes cannot be resolved on References."*

An entity linked with `@Reference` contributes nothing to any index. `findByAddressCity`
works when `Address` is embedded in the hash and cannot work when it is referenced. In
practice this means: **if you want to query by it, embed it** — which is the same modelling
pressure MongoDB applies, arriving from a different direction.

## What the parser accepts and how it executes

| Keyword | Execution |
|---|---|
| `Is`, `Equals` | read one index set |
| `And` | `SINTER` over the sets |
| `Or` | `SUNION` over the sets |
| `IsTrue` / `IsFalse` | read the `…:1` / `…:0` set |
| `Top`, `First` | limit applied to the result |
| `Near`, `Within` (geo) | `GEORADIUS`, and not combinable |

That is the entire vocabulary. `findByLastnameAndFirstname` becomes a `SINTER` of two sets
and then an `HGETALL` per surviving id — which means **the number of round trips is
proportional to the number of matches**, because there is no server-side join between the
index and the hashes.

The reference states the return-type restriction plainly:

> *"Query methods for Redis repositories support only queries for entities and collections
> of entities with paging."*

No projections, no aggregate return types, no `Stream` of a DTO. An entity, a collection of
entities, or a page of them.

And it states the precondition as an instruction rather than a promise:

> *"Please make sure properties used in finder methods are set up for indexing."*

⚠️ The page tells you to ensure the property is indexed; it does not document what happens
when it is not. Mechanically there is no set for the executor to read, so there is nothing
to intersect — but this bible will not assert a specific exception or a specific empty
result it has not verified. Treat "is this property `@Indexed`?" as the first question when
a Redis finder returns something unexpected, and write a test that asserts a known match is
found rather than assuming a wrong query would be loud.

## `Sort` happens in your JVM, after everything is loaded

This is the sentence that should change how you use these repositories:

> *"Redis itself does not support in-flight sorting when retrieving hashes or sets.
> Therefore, Redis repository query methods construct a `Comparator` that is applied to the
> result before returning results as `List`."*

Follow it through. `findByStatus(String status, Pageable page)` with a sort:

1. read the index set for the status — every matching id;
2. load every matching entity;
3. build a `Comparator` and sort them **in the application's heap**;
4. return the requested page.

Page 1 of 20 and page 500 of 20 do the same work. A `Pageable` on a Redis repository is not
a way to avoid loading the result — it is a way to avoid *returning* it. Every cost argument
in [09 · Offset pagination at depth](../09-spring-data-jpa/05b-offset-pagination-at-depth.md)
understates the problem here, because in SQL the database at least did the sorting.

**If you need ordering, you are describing a sorted set, and a sorted set is not something
a `CrudRepository` will give you.** That is the subject of
[05e · A data-structure server behind a repository](05e-a-data-structure-server-behind-a-repository.md).

## The escape hatch

`RedisCallback` gives you the connection and lets you issue whatever commands the query
actually needs:

```java
List<byte[]> ids = redisTemplate.execute((RedisCallback<List<byte[]>>) connection ->
        connection.zSetCommands()
                  .zRevRange("leaderboard".getBytes(), 0, 9)
                  .stream().toList());
```

Once you are here you are writing Redis, not Spring Data, and the byte-array surface in
[06 · RedisTemplate](06-redistemplate.md) is what you are writing it against.

## Gotchas

**★ Only equality is expressible.** No `Between`, `GreaterThan`, `Like`, `StartingWith` or
`Containing` against an index. The derived-query parser knows those keywords from other
stores; the Redis executor has no set to read for them.

**★ A high-cardinality `@Indexed` property is one Redis key per distinct value.** An indexed
email or user id turns one entity type into millions of single-member sets, each with its
own overhead, and there is no warning at any point.

**★ Every index is paid on every write, forever, whether or not any query uses it.** An
`@Indexed` added for a finder that was later deleted keeps costing an `SADD` per save. The
annotation is the only record that it exists.

**★ Indexes are not resolved on references.** A `@Reference` property is invisible to
indexing, so a finder that navigates into it cannot work. If you must query it, embed it.

**★ Geo predicates cannot be combined with anything.** `Near` and `Within` are the whole
query. "Nearby and active" is two queries and an intersection you perform yourself.

**★ `Sort` and `Pageable` are applied in your JVM after loading every match.** A page deep
in a large result costs exactly as much as the first page, plus the sort. This is the most
expensive misunderstanding on this page.

**★ Matching N entities costs roughly N round trips.** The index gives you ids; the hashes
are fetched separately. There is no server-side join, and pipelining is the only thing
between you and N sequential commands.

**★ Return types are limited to entities and collections of entities.** The projection
interfaces and DTO constructors that make Spring Data JPA repositories pleasant are not
available, so "read only two fields" is not expressible.

**★ Index sets can outlive the entities they point at.** Deletion and expiry are supposed to
remove entries, but an expiry that happens while the application is down does not — the
mechanism, and the reason, are in
[05d · Expiry and the phantom copy](05d-expiry-and-the-phantom-copy.md). A stale id in an
index set makes a query return a match whose hash no longer exists.

**★ `Or` is `SUNION` over sets that may be large.** Two broad predicates joined by `Or` can
union most of the keyspace before a single entity has been loaded.

**★ Nothing here is a query planner, so nothing improves as the data grows.** The execution
of a finder is fixed at parse time. There is no plan to inspect, no `EXPLAIN`, and no
statistics that could make a different choice.

## Interview questions

**★ How does a Redis repository execute `findByFirstnameAndLastname`?**
It reads the index set for each value, intersects them with `SINTER`, and then loads each
surviving id's hash. Two set reads and one `HGETALL` per match — with no server-side join
between the two halves.

**★ Why can a Redis repository not do a range query?**
Because an index is a set named after a value, and sets have no order relative to one
another. There is nothing to scan between two bounds. A range query in Redis needs a sorted
set, which the repository abstraction does not create.

**★ What does `Sort` cost on a Redis repository?**
Everything. The reference says Redis does not support in-flight sorting for hashes and
sets, so the repository loads the whole result and applies a `Comparator` in the JVM. A
`Pageable` therefore reduces what is returned, not what is read.

**★ What is the memory risk of `@Indexed`?**
One Redis key per distinct value. On a high-cardinality property that is one key per entity
— millions of small sets, each with per-key overhead, in a store whose whole point is that
it lives in RAM.

**★ Why does `findByAddressCity` stop working when you change `Address` to a
`@Reference`?**
Because indexes cannot be resolved on references. Only the pointer is stored with the
entity, so the referenced object's properties never reach the indexing machinery.

**★ What return types can a Redis query method have?**
An entity, or a collection of entities, with paging. The reference states that restriction
directly. Interface and DTO projections are not part of this executor.

**★ A finder returns nothing and the data is definitely there. What do you check first?**
Whether the property is `@Indexed`. The reference's instruction is to make sure properties
used in finder methods are set up for indexing — without an index there is no set for the
executor to read. The second check is whether the value was written before the index was
added, because indexes are built on save, not retroactively.

**★ How do you query something the repository cannot express?**
`RedisCallback` — you get the connection and issue the commands yourself, typically against
a sorted set or a stream you maintain deliberately. At that point the repository is holding
your entities and something else is holding your access paths, which is worth being honest
about in the design.

**★ Why is there no `EXPLAIN` equivalent here?**
Because there is no plan. The derived method name determines the commands at parse time,
and they never change. Performance work on a Redis repository is modelling work, not query
tuning.

{/* FOOTER */}
