---
title: "The repository interface over MongoDB and over Redis looks exactly like the one over Postgres, and almost nothing underneath it is the same"
sidebar_label: "01 · One idiom, many stores"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data Commons 4.1 reference *Working with Spring
> Data Repositories* — Core concepts, Defining repository interfaces, Query methods
> ([docs.spring.io/spring-data/mongodb/reference/repositories.html](https://docs.spring.io/spring-data/mongodb/reference/repositories.html)),
> the Spring Data MongoDB 5.1 reference
> ([docs.spring.io/spring-data/mongodb/reference/](https://docs.spring.io/spring-data/mongodb/reference/index.html)),
> the Spring Data Redis 4.1 reference
> ([docs.spring.io/spring-data/redis/reference/](https://docs.spring.io/spring-data/redis/reference/index.html)),
> the Spring Boot 4.1 *Working with NoSQL Technologies* chapter
> ([docs.spring.io/spring-boot/reference/data/nosql.html](https://docs.spring.io/spring-boot/reference/data/nosql.html)),
> and the published POMs of `spring-boot-dependencies:4.1.0`
> ([repo1.maven.org](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.0/spring-boot-dependencies-4.1.0.pom))
> and `spring-data-bom:2026.0.0`
> ([repo1.maven.org](https://repo1.maven.org/maven2/org/springframework/data/spring-data-bom/2026.0.0/spring-data-bom-2026.0.0.pom)).
> JDK 25, Spring Boot 4.1.0, Spring Data Commons 4.1.0, Spring Data MongoDB 5.1.0,
> Spring Data Redis 4.1.0.

**Spring Data gives MongoDB and Redis the same repository idiom you already know from
JPA: an interface, no implementation, `findByLastnameAndFirstname` derived from the
method name. That similarity is real and it is shallow. What carries across is the
*shape* of the API — the interface hierarchy, the method-name parser, projections,
`Sort` and `Pageable`, the exception hierarchy. What does not carry across is everything
that makes JPA feel the way it feels: there is no persistence context, no dirty
checking, no JPQL, no cascade, and "transaction" means something different in each
store. A reader who assumes the familiar interface implies the familiar semantics will
write code that compiles, reads fine in review, and silently does the wrong thing.**

## The interface really is the same

Three repositories, three completely different storage engines:

```java
// Postgres, via Spring Data JPA
public interface CustomerRepository extends CrudRepository<Customer, Long> {
    List<Customer> findByLastnameAndFirstname(String lastname, String firstname);
}

// MongoDB, via Spring Data MongoDB
public interface OrderRepository extends MongoRepository<Order, String> {
    List<Order> findByStatusAndPlacedAtAfter(String status, Instant since);
}

// Redis, via Spring Data Redis
public interface SessionRepository extends CrudRepository<UserSession, String> {
    List<UserSession> findByUserId(String userId);
}
```

Nobody writes an implementation for any of the three. Spring Data creates the proxy at
startup, parses each method name, and dispatches to a module-specific query executor.
The `CustomerRepository` and `SessionRepository` declarations differ only in the type
arguments — and one of them ends up as SQL against a relational engine, the other as
`SINTER` against a Redis set.

That is the whole appeal, and it is a genuine one. It is also the source of every
mistake on the rest of this page.

## What actually carries across — the parts that live in Spring Data Commons

The shared code is one artifact: `spring-data-commons`. Everything below is defined
there, not in the store module, which is exactly why it behaves identically everywhere.

**The interface hierarchy.** `Repository<T, ID>` is the marker. `CrudRepository`,
`ListCrudRepository`, `PagingAndSortingRepository` and `ListPagingAndSortingRepository`
are the ready-made supersets. `MongoRepository` extends `PagingAndSortingRepository` and
`CrudRepository`; a Redis repository normally just extends `CrudRepository` directly.

**Query derivation from the method name.** The parser that splits
`findByLastnameAndFirstname` into a subject and a predicate tree is shared. So is the
keyword vocabulary — `And`, `Or`, `Is`, `Between`, `In`, `StartingWith`, `IgnoreCase`,
`OrderBy…Desc`, `findFirst10By…`. ⚠️ **Which keywords a module actually supports is not
shared**, and the Redis list is very short. See
[05b · What Redis repositories can and cannot answer](05b-what-a-redis-repository-can-answer.md).

**Projections.** Interface and class-based projections, closed and open, `@Value`-driven
open projections, dynamic projections via a generic `<T> List<T> findByX(String x,
Class<T> type)` method — all defined once in commons and available in every module.

**Paging and sorting types.** `Sort`, `Pageable`, `PageRequest`, `Page`, `Slice`,
`Window` and keyset scrolling are commons types. ⚠️ **Whether a module can honour them
cheaply is another matter** — a `Page` needs a count, and a count means a second round
trip to a store that may not be able to do it well.

**Query by Example.** `Example`, `ExampleMatcher` and the fluent `FetchableFluentQuery`
API work over MongoDB and Redis, not just JPA.

**Custom implementations.** The `XxxRepositoryCustom` + `XxxRepositoryImpl` fragment
mechanism, and the `@NoRepositoryBean` base-interface trick, are identical everywhere.

**The exception hierarchy.** Every module translates its driver's failures into
`org.springframework.dao.DataAccessException` subtypes —
`DuplicateKeyException`, `OptimisticLockingFailureException`,
`DataAccessResourceFailureException`. A service layer that catches
`DuplicateKeyException` genuinely does not care whether the constraint was a Postgres
unique index or a MongoDB `_id` collision.

**The auditing annotations.** `@CreatedDate`, `@LastModifiedDate`, `@CreatedBy`,
`@LastModifiedBy` and the `AuditorAware` bean, enabled per module with
`@EnableMongoAuditing` or `@EnableRedisRepositories`-adjacent configuration.

**Domain events.** `@DomainEvents` and `@AfterDomainEventPublication` on the aggregate,
published when the repository saves it.

## The annotation that is *not* the one you are used to

`@Id` is the trap that catches people on their first Mongo entity. There are two
annotations with that name and they are not interchangeable:

```java
import jakarta.persistence.Id;              // JPA — the specification's annotation
import org.springframework.data.annotation.Id;   // Spring Data Commons
```

MongoDB and Redis entities use the **Spring Data Commons** one. So do
`org.springframework.data.annotation.Transient`, `Version` and `PersistenceCreator`.
Import `jakarta.persistence.Id` on a `@Document` class and the mapping layer sees no
identifier at all — it falls back to a property literally named `id` if there is one,
and if there is not, you get an entity whose id is never populated. Nothing fails at
compile time and nothing fails at startup.

⚠️ This bites hardest in a codebase that already has JPA entities, because the IDE's
auto-import will happily pick whichever `Id` it saw last.

## The versions, and the release-train trap

The single most common way to get a Spring Data version wrong is to quote the **release
train** name as if it were a module version. Spring Boot 4.1.0's dependency management
imports `org.springframework.data:spring-data-bom:2026.0.0` — that string is the train,
not a module. The modules inside that train carry their own, deliberately divergent
numbers:

| Module | Version in Boot 4.1.0 |
|---|---|
| `spring-data-commons` | **4.1.0** |
| `spring-data-jpa` | **4.1.0** |
| `spring-data-redis` | **4.1.0** |
| `spring-data-keyvalue` | **4.1.0** |
| `spring-data-mongodb` | **5.1.0** |
| `spring-data-cassandra` | 5.1.0 |
| `spring-data-elasticsearch` | 6.1.0 |
| `spring-data-neo4j` | 8.1.0 |

Spring Data MongoDB is a full major version ahead of Spring Data JPA and Spring Data
Redis, and always has been out of step — the modules version independently and only the
train ties them together. The driver and client versions Boot 4.1.0 manages alongside
them are the MongoDB Java driver **5.8.0**, Lettuce **7.5.2.RELEASE** and Jedis
**7.4.1**.

The practical consequence: **when you search for documentation, search for the module
version, not the train.** "Spring Data 2026.0.0 `@DocumentReference`" finds nothing
useful; "Spring Data MongoDB 5.1 `@DocumentReference`" finds the reference page.

## Where the properties live, and why MongoDB's moved

Boot 4 relocated the MongoDB **connection** properties out of the `spring.data`
namespace. The mapping and repository ones stayed. That split is not intuitive and it is
worth memorising:

```properties
# connection — spring.mongodb.*   (moved in Boot 4)
spring.mongodb.uri=mongodb://user:secret@mongo-a:27017,mongo-b:27017/shop?replicaSet=rs0
spring.mongodb.database=shop
spring.mongodb.ssl.enabled=true

# Spring Data behaviour — still spring.data.mongodb.*
spring.data.mongodb.auto-index-creation=false
spring.data.mongodb.field-naming-strategy=com.example.SnakeCaseFieldNaming
spring.data.mongodb.repositories.type=imperative

# Redis did NOT move — everything is still under spring.data.redis.*
spring.data.redis.host=localhost
spring.data.redis.port=6379
spring.data.redis.client-type=lettuce
spring.data.redis.repositories.enabled=true
```

Boot auto-configures a `MongoClient`, a `MongoDatabaseFactory` and a `MongoTemplate` for
MongoDB, and a `RedisConnectionFactory`, a `RedisTemplate` and a `StringRedisTemplate`
for Redis. Repositories are enabled by classpath scanning from the auto-configuration
packages, so `@EnableMongoRepositories` is only needed to point the scan somewhere else.
Lettuce is the default Redis client; Jedis is opt-in.

## Gotchas

**★ A `spring.data.mongodb.uri` line in a Boot 4 application is silently ignored.**
It is not a recognised property any more, so it binds to nothing, produces no failure,
and the application connects to `localhost:27017` instead of your cluster. This is the
single most likely thing to break on a 3.x → 4.x upgrade of a Mongo service. The
`spring-boot-properties-migrator` dependency reports it; nothing else will.

**★ `@Id` from `jakarta.persistence` on a `@Document` class compiles, starts, and
produces documents with no identifier mapping.** Two annotations, one name, no
diagnostic.

**★ Quoting the release-train version to a colleague, a bug report or a search engine
wastes everyone's time.** `2026.0.0` is not the version of anything you can depend on
directly except the BOM itself.

**★ `CrudRepository` over Redis and `CrudRepository` over Postgres are the same
interface with wildly different cost profiles.** `findAll()` on a JPA repository is one
query the database plans. `findAll()` on a Redis repository reads the keyspace SET and
then fetches every hash. The method signature tells you nothing about that.

**★ Assuming a repository interface makes the store swappable.** It does not. The
derived-query vocabulary differs, `@Query` takes a different language in every module,
the id semantics differ, and the transaction guarantees differ. The interface being
portable is not the same as the code being portable.

**★ Adding both `spring-boot-starter-data-mongodb` and
`spring-boot-starter-data-redis` and then declaring a plain `CrudRepository` with no
store-specific hint.** With two repository modules on the classpath, Spring Data has to
guess which one owns the interface. It resolves this by looking at the entity's
annotations — `@Document` versus `@RedisHash` — so an entity that carries neither, or
both, is a startup failure. Put each store's repositories in its own package and give
each `@Enable…Repositories` an explicit `basePackages`.

**★ `spring.data.redis.repositories.enabled` defaults to `true`.** Adding the Redis
starter for caching or pub/sub alone still turns the repository infrastructure on, and
it will scan for `@RedisHash` types. Set it to `false` if you are not using repositories.

## Interview questions

**★ Spring Data repositories look the same over JPA, MongoDB and Redis. What is actually
shared?**
The `spring-data-commons` artifact: the `Repository`/`CrudRepository`/
`PagingAndSortingRepository` hierarchy, the method-name query parser and its keyword
vocabulary, projections, `Sort`/`Pageable`/`Page`/`Slice`/`Window`, Query by Example,
the custom-fragment mechanism, the `DataAccessException` hierarchy, auditing and domain
events. Everything from the query executor downwards is per-module.

**★ Can you swap Spring Data JPA for Spring Data MongoDB by changing one interface's
supertype?**
No, and believing you can is the trap. You would also have to change the entity
annotations, replace every JPQL `@Query` with a MongoDB JSON one, remove every cascade
and every relationship mapping, stop relying on dirty checking, and re-examine every
transaction boundary. The interface declaration is the only part that ports.

**★ Which `@Id` do you use on a MongoDB document?**
`org.springframework.data.annotation.Id`. `jakarta.persistence.Id` is a JPA annotation
and the MongoDB mapping layer does not look for it.

**★ What version of Spring Data MongoDB does Spring Boot 4.1.0 manage?**
5.1.0. The train is `2026.0.0`, and the sibling modules are on 4.1.0 — the module
numbers diverged from each other long ago and the train name is not a version you can
quote for any individual artifact.

**★ Why does Spring Data MongoDB carry a higher major version than Spring Data JPA?**
Because the modules release independently and take breaking changes on their own
schedule; MongoDB's module has had more of them. They are only coordinated in the sense
that a release train pins one compatible set.

**★ Where does the MongoDB connection URI go in Spring Boot 4?**
`spring.mongodb.uri`. The `spring.data.mongodb.*` namespace still exists but now holds
only Spring Data behaviour — `auto-index-creation`, `field-naming-strategy`,
`gridfs.*`, `repositories.type`. Redis kept everything under `spring.data.redis.*`.

**★ You add the Redis starter purely for caching. What repository infrastructure gets
switched on?**
All of it — `spring.data.redis.repositories.enabled` defaults to `true`, so Spring Data
scans for `@RedisHash` entities and builds the repository factory. Harmless if you have
none, but it is not free at startup and it is worth turning off explicitly.

**★ Two repository modules are on the classpath and a repository extends plain
`CrudRepository`. How does Spring Data decide which module owns it?**
From the domain type's annotations — `@Document` means MongoDB, `@RedisHash` means
Redis. An unannotated or doubly-annotated entity is ambiguous, and the fix is to scope
each `@Enable…Repositories` to its own base package rather than to rely on detection.

**★ Which of `Page`, `Slice` and `Window` should you reach for on a store that cannot
count cheaply?**
`Slice` or `Window`. `Page` carries a total element count, which forces a second query;
`Slice` only asks whether there is a next page, and `Window` supports keyset scrolling.
The types are shared across modules precisely so this choice is available everywhere.

<!--FOOTER-->
