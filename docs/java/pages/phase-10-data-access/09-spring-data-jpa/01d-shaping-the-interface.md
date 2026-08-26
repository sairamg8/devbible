---
title: "A repository interface is an API you are publishing to the rest of the application, and the default — extends JpaRepository — publishes everything"
sidebar_label: "1d · Shaping the interface"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Defining
> Repository Interfaces"
> ([definition.html](https://docs.spring.io/spring-data/jpa/reference/repositories/definition.html))
> and "Core concepts"
> ([core-concepts.html](https://docs.spring.io/spring-data/jpa/reference/repositories/core-concepts.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Jakarta Persistence 3.2.

**`extends JpaRepository<Order, Long>` is a decision to publish roughly two dozen
methods — including `deleteAllInBatch()`, `flush()` and `getReferenceById()` — to
every class that can inject the repository. The reference documents the
alternative in one short paragraph that almost nobody reads: extend the bare
`Repository` marker and copy in the signatures you actually want. They still
resolve to the base implementation; they simply are not part of the API any
more.**

## The default publishes everything

Look at what an ordinary declaration exposes:

```java
public interface OrderRepository extends JpaRepository<Order, Long> { }
```

That interface has `save`, `saveAll`, `findById`, `existsById`, `findAll`,
`findAllById`, `count`, `deleteById`, `delete`, `deleteAllById`, `deleteAll`
(twice), `findAll(Sort)`, `findAll(Pageable)`, `findOne(Example)`,
`findAll(Example)`, `findAll(Example, Sort)`, `count(Example)`,
`exists(Example)`, `flush`, `saveAndFlush`, `saveAllAndFlush`,
`deleteAllInBatch` (three overloads), `deleteAllByIdInBatch`,
`getReferenceById`, and three deprecated methods on top.

Some of those are things a service should never call.
`deleteAllInBatch()` empties the table in one statement with no cascades and no
lifecycle callbacks. `flush()` is a persistence-context detail that no caller of
a repository should be reasoning about. `findAll()` with no argument is an
unbounded read of a table that will one day be large.

None of that is an argument against `JpaRepository`. It is an argument that
choosing it is a *choice*, and one worth making deliberately for an aggregate
root that matters.

## Copying signatures

The reference documents this under "Fine-tuning repository definition": you may
extend the bare marker and declare only the methods you want, copying the
signatures from the CRUD interfaces.

```java
public interface OrderRepository extends Repository<Order, Long> {

    Optional<Order> findById(Long id);

    Order save(Order order);

    List<Order> findByCustomerIdAndStatus(Long customerId, OrderStatus status);

    Page<Order> findByStatus(OrderStatus status, Pageable pageable);
}
```

Four methods. `deleteAll` does not exist on the type, so no amount of
enthusiasm in a service can reach it.

`findById` and `save` are still answered by `SimpleJpaRepository` — copying the
signature is enough for the proxy to route there, because resolution is by
signature and not by which interface declared it. Nothing is reimplemented and
nothing is slower.

**You may also narrow return types while copying.** The reference notes that a
CRUD method returning `Iterable<T>` can be re-declared as `List<T>` or
`Collection<T>`. So `List<Order> findAll();` is a legal copy of
`Iterable<T> findAll()`.

## `@NoRepositoryBean` and shared base interfaces

The moment you want a base interface of your own, `Repository` being a marker
creates a problem: Spring Data will try to build a proxy for the base interface
too.

```java
@NoRepositoryBean
public interface BaseRepository<T, ID> extends Repository<T, ID> {

    Optional<T> findById(ID id);

    T save(T entity);

    Optional<T> findByPublicId(UUID publicId);
}

public interface OrderRepository extends BaseRepository<Order, Long> {

    List<Order> findByStatus(OrderStatus status);
}
```

The reference's wording: *"Make sure you add that annotation to all repository
interfaces for which Spring Data should not create instances at runtime."*

Two things to notice. First, **every** intermediate interface needs it, not just
the topmost — a three-level hierarchy needs it twice. Second, `findByPublicId` is
derived **per concrete repository**, against that repository's own entity: it is
declared once and parsed once for `Order`, once for `Customer`, and so on. A
generic base interface is therefore a real way to standardise a query across
entities, provided every entity that extends it actually has the property.

⚠️ **And that is the catch.** If one entity lacks `publicId`, its repository
fails at bootstrap with a message about an unresolvable property on a method that
is not written in that file. The declaration is inherited; the failure is not.

## `@RepositoryDefinition` — no `extends` at all

The reference offers an annotation as a third route:

```java
@RepositoryDefinition(domainClass = Order.class, idClass = Long.class)
public interface OrderRepository {

    Optional<Order> findById(Long id);

    List<Order> findByStatus(OrderStatus status);
}
```

The interface extends nothing and the two type arguments move into the
annotation. Functionally it is the copied-signatures approach with the marker
removed, and it is worth knowing mainly as evidence that nothing in the mechanism
depends on the marker interface — Spring Data needs the entity type and the id
type, and the `extends` clause is only one way of supplying them.

## When more than one Spring Data module is present

If the classpath carries Spring Data JPA and, say, Spring Data MongoDB, the
infrastructure has to decide which module owns each repository. The reference
gives two criteria:

1. The repository extends a module-specific type — `JpaRepository` for JPA.
2. The domain class carries a module-specific annotation — `@Entity` for JPA,
   `@Document` for MongoDB.

🔴 **This is the one case where extending bare `Repository` costs you
something.** A repository that extends only the marker, over a domain class that
carries both `@Entity` and `@Document`, is genuinely ambiguous, and the reference
warns against mixing those annotations on one class for exactly this reason. The
robust separation is by package, with
`@EnableJpaRepositories(basePackages = …)` scoping each module to its own.

In a single-store application — which is most of them — none of this applies and
the marker interface is free.

## Gotchas

**⚠️ Forgetting `@NoRepositoryBean` on a shared base interface.**
Startup fails with a message about a type Spring Data cannot resolve an entity
for, which reads as a mapping problem rather than a missing annotation. Every
intermediate interface in the hierarchy needs it — including one added later,
halfway down, by someone extracting common methods.

**⚠️ Declaring a derived query on a generic base interface that not every entity
supports.**
`findByPublicId` on `BaseRepository<T, ID>` is derived separately for each
concrete repository. The one entity without a `publicId` property fails at
bootstrap, and the method it names is declared in a different file from the
repository the message blames.

**⚠️ Assuming copying a signature reimplements it.**
It does not. Resolution is by signature; a copied `save` still routes to
`SimpleJpaRepository.save`. Copying costs a line of interface and nothing at
runtime, which is why the "it must be slower" objection to this pattern is
simply wrong.

**⚠️ Copying a signature slightly wrong.**
`Order findById(Long id)` — returning the entity rather than `Optional<Order>` —
is a legal query method and it changes the contract: the reference's return-type
table says a bare `T` returns `null` when nothing is found. You meant to expose a
CRUD method and you have declared a different one, with no warning.

**⚠️ Believing a narrow interface protects the database.**
It protects the *API*. Anyone can inject `EntityManager` directly, and a fragment
on the same repository can do anything at all. The narrow interface removes the
easy accident, not the deliberate act — and removing the easy accident is most of
the value.

**⚠️ Extending `JpaRepository` on a read-model repository.**
A projection-serving repository over a reporting view has no business exposing
`save` or `deleteAllInBatch`, and publishing them invites someone to write
through a read model. Extend `Repository` and copy the three read methods.

**⚠️ Adding a method to the shared base interface without checking every
implementor.**
The base interface is the one place in the codebase where one line changes the
API of thirty repositories at once, and where one line can fail thirty
bootstraps at once. It deserves the caution a shared abstract class gets and
usually does not receive one, because it looks like just an interface.

**⚠️ Relying on `@Entity` alone to disambiguate modules.**
It works, and it works only while nobody adds a second store annotation to the
same class for a caching or search integration. Package-scoped
`@EnableJpaRepositories(basePackages = …)` is the separation that does not depend
on nobody making a reasonable-looking change later.

## Interview questions

**★ How would you stop callers of a repository from using `deleteAll()`?**
Do not extend `JpaRepository`. Extend `Repository<Order, Long>` and copy in only
the signatures the application should have — `findById`, `save`, and the query
methods. They still resolve to `SimpleJpaRepository`; the method simply is not
part of the published interface. You can narrow return types while copying too,
turning an `Iterable<T>` into a `List<T>`.

**★ Does copying a signature cost anything at runtime?**
No. The proxy resolves methods by signature, so a copied `save` routes to the
base implementation exactly as an inherited one does. The only cost is a line of
interface, and the benefit is that the two dozen methods you did not copy are not
callable.

**★ What does `@NoRepositoryBean` do and where does it go?**
It tells Spring Data not to create an instance for that interface. It goes on
every intermediate repository interface in a hierarchy — the reference says "all
repository interfaces for which Spring Data should not create instances at
runtime" — because a generic base has no concrete entity to resolve against and
would otherwise fail at startup.

**★ What is the point of a generic base repository interface?**
Standardising a query or a policy across entities. A `findByPublicId` declared
once on `BaseRepository<T, ID>` is derived separately for each concrete
repository against its own entity, so one declaration gives every aggregate the
same lookup. The risk is symmetrical: one entity without the property fails at
bootstrap, blaming a method declared in another file.

**★ Is a narrow repository interface a security control?**
No. It is an API design control. `EntityManager` can be injected anywhere and a
fragment on the same repository can do anything, so a determined caller is not
stopped. What it stops is the accidental `deleteAll()` and the accidental
unbounded `findAll()`, which is where this class of bug actually comes from.

**★ How does Spring Data decide which module owns a repository when several are
on the classpath?**
Two criteria from the reference: the repository extends a module-specific type
such as `JpaRepository`, or the domain class carries a module-specific annotation
such as `@Entity`. A bare-marker repository over a class annotated for two stores
is ambiguous, which is the one situation where extending `JpaRepository` earns
its keep. Scoping by package with `@EnableJpaRepositories(basePackages = …)` is
the more robust separation.

**★ Can you declare a repository without extending anything?**
Yes — `@RepositoryDefinition(domainClass = …, idClass = …)` on a plain interface.
The entity type and id type move into the annotation. It behaves like the
copied-signatures approach and mostly serves as a reminder that the marker
interface is a lookup mechanism rather than a source of behaviour.

**★ Would you use a narrow interface everywhere?**
No — it is a cost, and most repositories do not repay it. I would use it where
the interface is genuinely an API: an aggregate root several teams touch, a read
model that must not be written through, and anything where `deleteAll()` existing
is a bad idea. Elsewhere `JpaRepository` is fine, as long as choosing it was a
decision rather than an autocomplete.

<!--FOOTER-->
