---
title: "Sharing one container across the suite buys you startup time and sells you two things in exchange — a database whose rows outlive every test class, and a lifecycle that Spring's context cache does not know about, which is the specific reason Spring Boot 4.1 tells you to stop using @Container and manage containers as beans instead"
sidebar_label: "05a3 · The cost of sharing"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Boot 4.1.0 reference** at
> [tag `v4.1.0`](https://github.com/spring-projects/spring-boot/tree/v4.1.0),
> `documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/testing/testcontainers.adoc`
> — every Boot sentence below is quoted verbatim from it — and the **Testcontainers 2.0.5** sources
> ([tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)),
> `modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/{Testcontainers,TestcontainersExtension}.java`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine** — nothing below is a container log, a timing or a
> test run.

**[05](05-the-singleton-pattern.md) showed how to start one container for the whole suite.
This chunk is the bill. Two items on it: a database whose contents survive every test class, and a
container lifecycle that Spring's `ApplicationContext` cache cannot see — the second of which is why
Boot 4.1's own documentation now steers you away from `@Container` entirely.**

## 🔴 The context cache does not know your container stopped

This is the failure that makes the naive `@Container` worse than merely slow, and Boot states it
plainly:

> *"When using the JUnit extension, container instances are stopped after the test class has run
> (for static fields) or after each test method (for non-static fields). This can cause issues when
> used with Spring Boot tests, as Spring's TestContext Framework may cache the `ApplicationContext`
> beyond that point and reuse it for another test class or method with the same configuration. If
> the cached application context contains beans that depend on a container that has already been
> stopped, later tests or bean destruction callbacks may fail. For this reason, you should prefer
> managing containers as Spring beans or importing container declarations when the application
> context should remain usable for as long as it is cached."*

Read the two lifecycles side by side and the collision is obvious:

| | Owned by | Ends when |
|---|---|---|
| a static `@Container` | the JUnit extension's `ExtensionContext.Store` | the test class finishes |
| the `ApplicationContext` | Spring's `TestContext` framework cache | the JVM ends, or the cache evicts it |

Two test classes with the *same* merged configuration share one cached context — that is the whole
point of the cache, and it is [05 · The context cache](../05-the-test-pyramid/05-the-context-cache.md)'s
subject. So class A starts a container, builds a context containing a `DataSource` pointed at that
container's mapped port, finishes, and the extension stops the container. Class B then reuses the
cached context — including that `DataSource`, including its connection pool — against a port that no
longer has anything behind it. The failure surfaces as a connection error inside a bean, not as
anything that mentions containers, and it can equally surface as a *destruction* failure when the
cache is finally cleared and a pool tries to close connections to a container that is gone.

Boot's second warning is about ordering rather than caching, and it applies even within one class:

> *"Having containers managed by Testcontainers instead of as Spring beans provides no guarantee of
> the order in which beans and containers will shutdown. It can happen that containers are shutdown
> before the beans relying on container functionality are cleaned up. This can lead to exceptions
> being thrown by client beans, for example, due to loss of connection."*

### Why the singleton dodges it

The singleton pattern never stops the container, so a cached context can never outlive it. That is
not a coincidence — it is the property that makes the pattern safe with Spring, and it is worth
stating explicitly because it is the strongest argument for the pattern over a plain static
`@Container`. Everything Boot warns about above is a *stop* that happens too early; the singleton
has no stop at all.

### 🔴 But container-as-a-bean is the modern answer

Be clear about the ordering of the two ideas. **The singleton pattern is the older solution and it
still works. Managing containers as Spring beans is what Boot 4.1 recommends**, and it solves the
same problem from the other end — instead of outliving the cache, the container is *part* of what
the cache holds:

> *"Container beans are created and started before all other beans."*
>
> *"Container beans are stopped after the destruction of all other beans."*
>
> *"Container beans are created and started once per application context managed by Spring's
> TestContext Framework."*
>
> *"Container beans are stopped as part of the TestContext Framework's standard application context
> shutdown process. When the application context gets shutdown, the containers are shutdown as well.
> This usually happens after all tests using that specific cached application context have finished
> executing. It may also happen earlier, depending on the caching behavior configured in the
> TestContext Framework."*
>
> *"A single test container instance can, and often is, retained across execution of tests from
> multiple test classes."*

That last sentence is the point: a container bean is *already* shared across test classes, for
exactly as long as the context that owns it is cached — so you get the sharing the singleton was
invented for, plus correct shutdown ordering, without a static field. The mechanics belong to
[04 · @ServiceConnection](04-serviceconnection.md) and to
[05a](05a-holders-interfaces-and-wiring.md)'s `@ImportTestcontainers` section.

⚠️ **One consequence people miss:** a container bean's lifetime is tied to a *cache key*. Anything
that changes the merged context configuration — a different `@MockitoBean`, a different active
profile, a different `properties` attribute — produces a second context and therefore a **second
container**. [05b · What evicts it](../05-the-test-pyramid/05b-what-evicts-it.md) is the catalogue
of what changes that key, and it is required reading before you conclude that container-as-a-bean
means one container.

## What is shared when the container is shared

One container means one database for every test class in the JVM. Everything a test writes is
visible to every test that runs after it, across class boundaries, in whatever order the engine
chose ([topic 01 · 11 · Execution order](../01-junit-5/11-execution-order.md)). The symptoms are
familiar: a test that passes alone and fails in the suite, a count assertion that drifts as the
suite grows, a unique-constraint violation the second time a class runs in the same JVM.

There are four honest strategies and each buys something different.

**1 · Roll back every test.** `@Transactional` on the test class makes Spring roll back at the end
of each test method, so nothing is committed and the next test sees a clean database.

- *Costs:* it hides anything that only happens at commit — deferred constraints, `AFTER` triggers,
  flush ordering — and it is useless for code that manages its own transactions or spans threads.
  [08 · Transactions in tests](../05-the-test-pyramid/08-transactions-in-tests.md) and
  [08b · What rollback hides](../05-the-test-pyramid/08b-what-rollback-hides.md) are the full
  treatment; do not re-derive it here.

**2 · Truncate between tests.** A `@BeforeEach` or `@AfterEach` that empties the tables:
`TRUNCATE TABLE a, b, c RESTART IDENTITY CASCADE`.

- *Costs:* you must enumerate the tables, and the list rots the moment somebody adds one. Deleting
  everything also deletes reference data your migrations inserted, so you either exclude those
  tables by name — another list that rots — or re-seed after truncating. `RESTART IDENTITY` resets
  sequences, which makes generated ids predictable; leaving it off makes them keep climbing, which
  is more realistic and less assertable.

**3 · A fresh schema (or database) per test class.** Create `test_<something>` on the shared
container, point the class's `DataSource` at it, run migrations into it.

- *Costs:* migrations run once per schema rather than once per suite, which is the expensive part of
  a Flyway-backed project; and each variant needs its own `DataSource` configuration, which means
  its own context cache key, which means the context cache benefit shrinks. It buys real isolation
  and is the right answer for tests that alter the schema.

**4 · Unique data per test.** Every test generates its own keys — a random tenant id, a UUID email —
and asserts only on rows it created.

- *Costs:* you can never assert on a global count or on "the only row in the table", and the
  discipline has to hold for every author forever. It is the cheapest strategy at runtime and the
  most fragile socially.

🔴 Which one to use, and the mechanics of each, belong to
[06 · Schema and data](06-schema-and-data.md) — specifically
[06d · The rollback strategy](06d-the-rollback-strategy.md),
[06e · Truncating between tests](06e-truncating-between-tests.md) and
[06f · SQL scripts and unique data](06f-sql-scripts-and-unique-data.md) — and to the Flyway topic,
which already covers testing migrations against a container in detail:
[11 · Testing migrations](../../phase-10-data-access/11-flyway-migrations/11-testing-migrations.md),
[11b · Wiring the container](../../phase-10-data-access/11-flyway-migrations/11b-wiring-the-container.md)
and [11b2 · Making it fast](../../phase-10-data-access/11-flyway-migrations/11b2-making-it-fast.md).
**Read those rather than inventing a fifth strategy here.**

⚠️ Two of these four strategies stop working the moment the suite runs in parallel, and the
extension's own javadoc has something to say about parallel execution that the documentation site
does not — [05a4 · Parallel execution](05a4-parallel-execution.md).

## Gotchas

**★ A static `@Container` plus `@SpringBootTest` is the documented broken combination.**
The extension stops the container when the class ends; the context cache keeps the context, and its
`DataSource`, alive for the next class with the same configuration. Boot's own words are that
*"later tests or bean destruction callbacks may fail"*. Either never stop the container (the
singleton) or let Spring own it (a container bean).

**★ The failure does not mention containers.**
It arrives as a connection refusal from a pool, or as an exception during context shutdown, one or
more test classes *after* the class that stopped the container. If a suite is failing in a class
that looks innocent, ask what ran before it and what it shared.

**★ Container beans are one per context, not one per suite.**
Boot says *"created and started once per application context"*. Two different cache keys means two
containers. Anything that changes the merged configuration — an extra `@MockitoBean`, a different
profile, an extra `properties` entry — forks the context and forks the container.

**★ Believing the singleton makes the context cache irrelevant.**
It removes the *stopped-container* failure, not the cache. Your test classes still need the same
merged configuration to share a context, and a base class with a `@DynamicPropertySource` is what
gives them one.

**★ Truncating tables also deletes what your migrations seeded.**
Reference data inserted by a Flyway migration is just rows. `TRUNCATE … CASCADE` removes it and the
next test sees an empty lookup table. Either exclude those tables or re-seed after truncation — and
whichever you choose, it is now a list that must be maintained.

**★ `TRUNCATE` without `RESTART IDENTITY` leaves sequences climbing.**
That is often what you want, because it is what production looks like — but it makes any assertion
on a specific generated id order-dependent, which in a shared-container suite means suite-order
dependent.

**★ Asserting on a global row count in a shared database.**
`assertThat(repository.count()).isEqualTo(3)` is a promise that no other test class ever inserts into
that table. It holds until someone adds one, and then it fails in a file nobody touched.

**★ Schema-per-class quietly costs you the context cache.**
Each schema needs its own `DataSource` URL, which usually arrives via `@DynamicPropertySource` or a
property override, which changes the context cache key. You have traded container startups for
context builds; measure which one your suite actually spends time on before assuming it is a win.

## Interview questions

**★ Why does Spring Boot 4.1 recommend against `@Container` in a `@SpringBootTest`?**
Because the two lifecycles do not line up. The JUnit extension stops a static container when the
test class finishes, but Spring's TestContext framework caches the `ApplicationContext` beyond that
point and reuses it for the next class with the same configuration. The cached context still holds
beans — a `DataSource`, a connection pool — pointing at a container that no longer exists, so later
tests or destruction callbacks fail. Boot's recommendation is to manage containers as Spring beans
or to import container declarations instead.

**★ How does the singleton pattern avoid that, and is it still the recommended approach?**
It avoids it by never stopping the container, so a cached context can never outlive it. It is still
correct and still widely used, but it is the older answer: Boot 4.1 recommends container beans,
which tie the container's lifecycle to the context that uses it — started before all other beans,
stopped after the destruction of all other beans, and shut down with the context.

**★ If containers are Spring beans, how many containers does a suite start?**
One per application context, in Boot's words *"created and started once per application context
managed by Spring's TestContext Framework"*. Test classes that share a context cache key share the
container; test classes that fork the key — through a bean override, a profile, an extra property —
get their own. So the count is the number of distinct contexts, not the number of test classes and
not one.

**★ A test passes on its own and fails in the suite. Walk through the diagnosis.**
It is order-dependent, which in a shared-container suite almost always means shared database state:
another class committed rows that break a count, a unique constraint or an assumption about "the
only row". Confirm by running the two classes together in isolation, then decide on an isolation
strategy — rollback, truncation, schema per class, or unique data per test — rather than adding an
`@Order` and moving on.

**★ Compare transactional rollback and truncation as isolation strategies.**
Rollback is per test method, needs no table list, and costs nothing at runtime, but it hides
everything that happens at commit — deferred constraints, `AFTER` triggers, flush ordering — and
does not cover code that manages its own transactions. Truncation actually commits and then cleans
up, so it tests the real path, but you must maintain a table list, you delete migration-seeded
reference data along with the test data, and it is unusable under parallel execution.

**★ You switch from a singleton to container beans and your suite starts three Postgres containers instead of one. Why?**
Because container beans are per application context, and you have three distinct context cache keys.
Look for the things that fork a key: a `@MockitoBean` present in some classes and not others, a
different set of `properties`, a different active profile, a different set of auto-configuration
excludes. The container count follows the context count.

{/* FOOTER */}
