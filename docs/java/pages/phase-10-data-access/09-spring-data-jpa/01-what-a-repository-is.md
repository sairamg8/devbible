---
title: "A Spring Data repository is an interface you never implement, and the object you actually call is a proxy the container assembles at startup out of a base class, your query methods and any fragments you supplied"
sidebar_label: "1 · What a repository is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — *Working with
> Spring Data Repositories* → "Core concepts" and "Creating Repository Instances"
> ([docs.spring.io/spring-data/jpa/reference/repositories/core-concepts.html](https://docs.spring.io/spring-data/jpa/reference/repositories/core-concepts.html),
> [create-instances.html](https://docs.spring.io/spring-data/jpa/reference/repositories/create-instances.html))
> and *Custom Repository Implementations*
> ([custom-implementations.html](https://docs.spring.io/spring-data/jpa/reference/repositories/custom-implementations.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> Jakarta Persistence 3.2.

**You write an interface with no body and inject it as if it were a bean, because
it *is* one: at startup Spring Data builds a proxy for every interface that
extends `Repository`, and that proxy dispatches each call to one of exactly three
things — a fragment you wrote, a query it derived or read off an annotation, or a
method on the base class `SimpleJpaRepository`. Nothing is decided at call time.
Everything the proxy will ever do is resolved while the context is starting, which
is why a typo in a method name is a startup failure and not a 3 a.m. one.**

## The declaration is the whole thing

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByCustomerIdAndStatus(Long customerId, OrderStatus status);
}
```

There is no `OrderRepositoryImpl`. There is no `@Repository` annotation needed,
no XML, no registration. Two type arguments — the entity and its identifier type
— and one method signature, and the application can now save orders, count them,
delete them by id, page through them and run that one query.

That is a lot of behaviour to get from eleven lines, and the reason it feels like
magic is that the interface names *what* without ever showing *how*. This page is
about the *how*, because a reader who knows what the container assembled can
predict the SQL, can explain a startup error, and can tell when Spring Data has
quietly stopped being the right tool.

## What the container actually builds

The reference is direct about the lifecycle: *"Repository instances are created
as regular Spring beans… By default, they are singleton scoped and eagerly
initialized. During startup, they interact with the JPA `EntityManager` for
verification and metadata analysis purposes."*

So for `OrderRepository` the container produces:

| Piece | What it is | Where it comes from |
|---|---|---|
| the bean you inject | a proxy implementing `OrderRepository` | generated |
| the CRUD behaviour | `SimpleJpaRepository<Order, Long>` | Spring Data JPA |
| `findByCustomerIdAndStatus` | a query execution built from the method name | derived at startup |
| anything `@Query`-annotated | a query execution built from the annotation's text | read at startup |
| anything from a fragment | your own class | you wrote it |

Each call on the proxy is routed to whichever of those claims the method. The
reference calls the non-base pieces *fragments*, and states the priority
explicitly: *"Custom implementations have a higher priority than the base
implementation and repository aspects."*

That single sentence is worth holding on to, because it explains a behaviour that
otherwise looks arbitrary — a fragment declaring `save` **replaces**
`SimpleJpaRepository.save` for that repository. The proxy is not "the base class,
plus extras"; it is an ordered list of candidates, and the base class is last.

## The composition order, written out

For any method invoked on the proxy, resolution goes:

1. **Fragments**, in the order they appear in the `extends` clause. The reference:
   *"Repositories may be composed of multiple custom implementations that are
   imported in the order of their declaration."*
2. **Query methods** — derived from the name, or declared with `@Query`, or found
   as a JPA named query.
3. **The base implementation**, `SimpleJpaRepository`.

Reading order matters here in a way that reads like a Java puzzle:

```java
interface OrderRepository extends JpaRepository<Order, Long>,
                                  AuditFragment,
                                  ArchiveFragment { }
```

If both `AuditFragment` and `ArchiveFragment` declare `void archive(Order o)`,
`AuditFragment`'s wins, because it is written first. The reference says this
ordering *"lets you override base repository and aspect methods and resolves
ambiguity if two fragments contribute the same method signature."* No warning, no
error — the declaration order in the `extends` clause is the tiebreak, and it is
invisible at the call site. The mechanics are in
[8 · custom implementations](08-custom-implementations.md).

## Everything is resolved at bootstrap, not at call time

This is the property that makes repositories worth trusting.

When the context starts, Spring Data walks every method on the interface and
works out what will answer it. A derived query is parsed against the entity's
metamodel then and there. A `@Query` string is handed to the provider's parser
then and there. If either fails, the application does not start.

```java
List<Order> findByCustmoerId(Long id);   // typo: no such property
```

That is a startup failure with a message naming the property it could not
resolve — not a `NullPointerException` in production three weeks later. The same
holds for a malformed JPQL string in `@Query`: Hibernate parses it during
bootstrap.

⚠️ **Two things are *not* validated at bootstrap.** A `nativeQuery = true` string
is SQL, and Spring Data does not have a database to check it against — see
[3b · native queries](03b-native-queries.md). And a property name inside a
`Sort` object is a runtime value, not part of the method signature, so a bad one
fails when the query runs — see [5c · sort is not free](05c-sort-is-not-free.md).

## When the verification happens

The reference documents a `BootstrapMode`, configurable on
`@EnableJpaRepositories`:

| Mode | Behaviour, in the reference's own words |
|---|---|
| `DEFAULT` | *"Repositories are instantiated eagerly unless explicitly annotated with `@Lazy`."* |
| `LAZY` | *"Implicitly declares all repository beans lazy and also causes lazy initialization proxies to be created… Repository instances will be initialized and verified upon first interaction."* |
| `DEFERRED` | *"Fundamentally the same mode of operation as `LAZY`, but triggering repository initialization in response to a `ContextRefreshedEvent` so that repositories are verified before the application has completely started."* |

The recommendations are equally direct: *"If you're not using asynchronous JPA
bootstrap stick with the default bootstrap mode"*, `DEFERRED` is *"a reasonable
default"* when JPA is bootstrapped asynchronously, and `LAZY` is *"a decent
choice for testing scenarios and local development."*

🔴 **`LAZY` trades the guarantee away.** The whole argument of the previous
section — that a broken query method is a startup failure — only holds while
repositories are verified at startup. Choosing `LAZY` to make the test suite boot
faster moves that failure to first call. `DEFERRED` exists precisely so you can
have asynchronous bootstrap *and* the guarantee.

## Gotchas

**⚠️ Expecting a class named after the *repository* to be picked up.**
The fragment mechanism matches a class named `<FragmentInterface>Impl` against a
*fragment interface* the repository extends — not against the repository
interface itself. A class called `OrderRepositoryImpl` implementing the whole of
`OrderRepository` is not the documented shape, and the documented shape is the
one in [8 · custom implementations](08-custom-implementations.md).

**⚠️ Two fragments declaring the same method and nobody noticing.**
Declaration order in the `extends` clause decides which one runs, silently.
Alphabetical order of imports does not enter into it, and neither does anything
visible at the call site. If two fragments could ever overlap, give the methods
different names rather than relying on the ordering rule.

**⚠️ Switching to `BootstrapMode.LAZY` to speed up tests, and losing the failure
guarantee everywhere.**
Set on `@EnableJpaRepositories` it applies to the whole application, not to a
test slice. A derived-query typo then survives startup and fails on first call —
which, for a rarely-hit endpoint, may be production. If you want the speed, use
`DEFERRED`, which still verifies before the application is considered started.

**⚠️ Treating the proxy as something you can cast to `SimpleJpaRepository`.**
It implements your interface and the Spring Data infrastructure interfaces. Code
that casts in order to reach an `EntityManager` is code that breaks on an
upgrade. If you need the `EntityManager`, inject it into a fragment — that is
what fragments are for.

**⚠️ Thinking eager initialization means the queries run at startup.**
It does not. The repository is *built* and its query methods are *validated*; no
query is executed. The startup cost is metamodel analysis and query parsing,
which is why a very large repository count shows up as a slow context refresh and
not as database load.

**⚠️ Putting `@Repository` on the interface and believing it does something.**
Spring Data registers the bean itself. The annotation is harmless, but a reader
who sees it may reasonably conclude it is what makes the interface work, and then
be baffled by the twenty interfaces that work without it. Exception translation —
the other thing `@Repository` is for — is already applied to repository proxies
by the infrastructure.

**⚠️ Adding a method to the interface and expecting a compile error when it is
wrong.**
The interface compiles fine; it is an interface. Every check Spring Data performs
on your method names happens at context startup. That is early enough to be
useful and late enough that a build which never starts a context — a pure unit
test run, a `mvn compile` — will not catch it.

**⚠️ Assuming a repository is stateless enough to inject anywhere.**
It is a singleton and it is thread-safe, but every method that touches the
database expects a transaction and a persistence context. Calling a repository
from a `@PostConstruct`, from a bean-initialisation path, or from a thread with
no transaction bound gives you behaviour covered in
[9 · transactions on repositories](09-transactions-on-repositories.md), and it is
not the behaviour you get from a controller.

## Interview questions

**★ You inject `OrderRepository` and there is no class implementing it. What are
you actually holding?**
A proxy created by Spring Data at context startup. It implements the interface
and routes every call to one of three things, in priority order: a fragment class
you wrote, a query method resolved from the method name or a `@Query` annotation,
or the base implementation `SimpleJpaRepository`. The routing table is fixed at
startup, so nothing is being decided per call.

**★ When is a derived query method validated?**
At bootstrap, when the repository bean is created. Spring Data parses the method
name against the entity's metamodel and builds the query; a property that does
not exist is a context-refresh failure. Under `BootstrapMode.LAZY` that moves to
first interaction, and under `DEFERRED` it happens on `ContextRefreshedEvent` —
before the application is considered started.

**★ Is anything on a repository *not* checked at startup?**
Yes, two things. A `nativeQuery = true` string is SQL and there is nothing to
validate it against without a database, so it fails at execution. And any
property name that arrives as data rather than as part of a signature — a `Sort`
built from a request parameter, for instance — is resolved when the query runs.

**★ What happens if two fragment interfaces declare the same method?**
The one listed first in the repository interface's `extends` clause wins.
Fragments are "imported in the order of their declaration" and have higher
priority than the base implementation, which is also how you override a base
method such as `save`. Nothing warns you, so overlapping fragment methods are
best avoided by naming rather than resolved by ordering.

**★ Does `@Repository` on the interface do anything?**
No. Spring Data registers the repository bean and applies exception translation
to the proxy regardless. The annotation is harmless and misleading, and I would
remove it, because a reader will otherwise assume it is load-bearing and
copy it onto interfaces where its absence would then look like a bug.

**★ What is the cost of having several hundred repositories?**
Context startup, not query load. Each repository is instantiated eagerly by
default, and startup "interacts with the JPA `EntityManager` for verification and
metadata analysis". Nothing is executed against the database. If that cost
becomes a problem the reference points at asynchronous JPA bootstrap plus
`BootstrapMode.DEFERRED`, which keeps the verification while moving it off the
critical path.

**★ Why would you ever choose `DEFERRED` over `LAZY`?**
Because `LAZY` gives up the startup guarantee and `DEFERRED` does not. Both defer
instantiation, but `DEFERRED` triggers it from `ContextRefreshedEvent`, so every
repository is still verified before the application reports itself started. The
only case for `LAZY` in the reference's own framing is local development and
testing, where a failure on first use is cheap.

**★ How does the proxy decide which of the three candidates answers a call?**
By an ordered lookup fixed at startup: fragments first, in declaration order;
then query methods, whether derived or annotated; then the base implementation.
Because fragments are first, a fragment can override a base method — the
reference's own example overrides `save`. That ordering is also the entire
mechanism behind "my custom `save` is not being called", which is almost always
a fragment that was never wired in rather than an ordering problem.

{/* FOOTER */}
