---
title: "Reviewing a Spring test means reviewing its level before its content, because a test at the wrong level is either paying for a context it does not need or asserting on something it structurally cannot observe — and both of those pass review as easily as they pass the build"
sidebar_label: "11 · The checklist"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 — every claim in the lists below is argued and sourced in the chunk it
> links to, and this page adds no new claims of its own. Sources are the Spring Framework 7.0.x
> and Spring Boot 4.1.1 references as cited in each chunk.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0.
> **No sandbox** — no suite was run.

**The closing chunk of the topic, meant to be used rather than read. A Spring test has a property
ordinary code review does not prepare you for: the two most expensive mistakes — wrong level, and
an override that silently changed what is being tested — both produce a test that passes, looks
reasonable and costs the team every day. Every line below links to the chunk that argues it.**

## The three questions, if you only have two minutes

1. **What is this test's assertion about?** If a value the code computes, it should be a
   constructor call and no Spring ([02](02-a-unit-test-needs-no-spring.md),
   [10](10-choosing-a-level.md)).
2. **What did this test's configuration do to the context cache?** Every override, inlined property
   and dynamic property source is a key component ([05](05-the-context-cache.md),
   [06b](06b-overriding-changes-the-cache-key.md)).
3. **Could this test still fail?** An override that removed the advice under test, or a rollback
   that removed the commit under test, leaves an assertion with nothing behind it
   ([06e](06e-overrides-and-aop-proxies.md), [08b](08b-what-rollback-hides.md)).

## Is it at the right level?

- ☐ The assertion is about **one** thing, and the level owns that thing ([10](10-choosing-a-level.md))
- ☐ A `@SpringBootTest` here is testing something no slice could observe ([04](04-springboottest.md))
- ☐ It is **not** a `@SpringBootTest` with most collaborators mocked — that is a slow unit test
  ([10](10-choosing-a-level.md))
- ☐ It is **not** a "unit test" of a repository with a mocked `EntityManager`, which cannot see the
  query, mapping or constraints ([10](10-choosing-a-level.md))
- ☐ If a slice, it is the slice that matches the *claim*, not the technology
  ([03c](03c-the-slice-catalogue.md))
- ☐ Awkwardness at level 0 was treated as a design signal, not a reason to escalate
  ([02](02-a-unit-test-needs-no-spring.md))

## What did it cost the context cache?

- ☐ Bean overrides are shared, not per-class — a base class or a shared configuration
  ([06b](06b-overriding-changes-the-cache-key.md))
- ☐ Mock field names match the project convention — a rename is a new context
  ([06b](06b-overriding-changes-the-cache-key.md))
- ☐ Inlined properties are spelled the project's way; `key=value` and `key = value` are two contexts
  ([07](07-test-properties-and-profiles.md))
- ☐ `@ActiveProfiles` is applied uniformly, not on a handful of classes
  ([07b](07b-profiles-and-dynamic-properties.md))
- ☐ `@DynamicPropertySource` is not repeated per class — a singleton container or
  `@ServiceConnection` instead ([07b](07b-profiles-and-dynamic-properties.md))
- ☐ No hand-maintained `@SpringBootTest(classes = …)` list ([04](04-springboottest.md))
- ☐ No `@DirtiesContext` — and if there is, the mutation it conceals has been named
  ([05b](05b-what-evicts-it.md))

## Do the overrides still leave something to test?

- ☐ The overridden bean is **not** the one carrying the advice under test — a `REPLACE` override
  has no `@Transactional`, `@Cacheable`, `@Retryable` or method security at all
  ([06e](06e-overrides-and-aop-proxies.md))
- ☐ `enforceOverride = true` where a silently-created bean would go unnoticed
  ([06](06-bean-overriding.md))
- ☐ A `@MockitoSpyBean` on a `@Cacheable` method is stubbed through
  `AopTestUtils.getUltimateTargetObject`, not through the injected proxy
  ([06e](06e-overrides-and-aop-proxies.md))
- ☐ No `Mockito.reset(...)` in an `@AfterEach` — `MockReset.AFTER` is already the default
  ([06](06-bean-overriding.md))
- ☐ A collaborator used identically by many tests is a `@TestBean` with a shared factory rather
  than a mock re-stubbed everywhere ([06d](06d-testbean.md))
- ☐ `@MockBean` / `@SpyBean` appear nowhere — they were removed in Boot 4
  ([06](06-bean-overriding.md))
- ☐ Imports come from `org.springframework.test.context.bean.override.*`, not a Boot package
  ([06](06-bean-overriding.md))

## Is the transaction story honest?

- ☐ `@Transactional` carries no `isolation`, `timeout`, `readOnly`, `rollbackFor` or
  `noRollbackFor` — all unsupported and silently ignored ([08](08-transactions-in-tests.md))
- ☐ Fixture data is inserted in `@BeforeEach`, not `@BeforeAll`, which runs outside the transaction
  and is never rolled back ([08](08-transactions-in-tests.md))
- ☐ 🔴 No `assertTimeoutPreemptively` anywhere near a `@Transactional` test — its body runs on
  another thread and **commits** ([08b](08b-what-rollback-hides.md))
- ☐ A `RANDOM_PORT` test does not rely on `@Transactional` for cleanup, and its actual cleanup
  strategy is written down ([04b](04b-webenvironment.md), [08b](08b-what-rollback-hides.md))
- ☐ Nothing asserts on `@TransactionalEventListener`, a deferred constraint, or what a second
  connection sees, inside a rolled-back test ([08b](08b-what-rollback-hides.md))
- ☐ `@Commit`, if present, is deliberate and the test owns its cleanup
  ([08](08-transactions-in-tests.md))
- ☐ Nothing asserts on a database-generated ID or sequence value
  ([08b](08b-what-rollback-hides.md))

## Is the slice configured, or just widened?

- ☐ No `@ComponentScan` on a slice test ([03b](03b-what-a-slice-excludes.md))
- ☐ No `@OverrideAutoConfiguration(enabled = true)` ([03b](03b-what-a-slice-excludes.md))
- ☐ `@Import` names components, not configuration classes that drag in their whole graph
  ([03b](03b-what-a-slice-excludes.md))
- ☐ No attempt to combine two slice annotations — explicitly unsupported
  ([03](03-the-slices.md))
- ☐ `@AutoConfigureTestDatabase(replace = NONE)` is absent — the `NON_TEST` default already
  recognises a Testcontainers datasource, and `NONE` is the less safe option
  ([03c](03c-the-slice-catalogue.md))
- ☐ Slice imports are the Boot 4 packages, not the Boot 3 ones ([03c](03c-the-slice-catalogue.md))

## Reviewing the suite, not the test

- ☐ Someone has run the cache statistics and knows the context count
  ([09](09-the-twenty-minute-suite.md))
- ☐ The build does not fork per test class ([05](05-the-context-cache.md),
  [09](09-the-twenty-minute-suite.md))
- ☐ The context count is comfortably under 32, so nothing is being evicted and rebuilt
  ([05](05-the-context-cache.md))
- ☐ Parallel execution, if enabled, was turned on *after* consolidation, not instead of it
  ([09](09-the-twenty-minute-suite.md))
- ☐ There is one integration test of the transaction boundary, not twenty
  ([10](10-choosing-a-level.md))

## The four sentences worth memorising

1. **A slice excludes your `@Component`s on purpose**, and the intended reply is a mock, not a
   `@ComponentScan` ([03b](03b-what-a-slice-excludes.md)).
2. **Every override, property string and dynamic source is a cache key component** — including the
   mock's field name ([05](05-the-context-cache.md), [06b](06b-overriding-changes-the-cache-key.md)).
3. **A `REPLACE` override is a bare object with no AOP advice**, so the annotation you were testing
   is not there any more ([06e](06e-overrides-and-aop-proxies.md)).
4. **A thread boundary destroys the rollback guarantee** — preemptive timeouts and real servers
   both commit ([04b](04b-webenvironment.md), [08b](08b-what-rollback-hides.md)).

## Interview questions

**★ What do you look at first when reviewing a Spring test?**
Its level. A test at the wrong level either pays for a context it does not need or asserts on
something it structurally cannot observe, and both pass review and the build. The question is what
the assertion is about, not what the code touches.

**★ What is the most expensive mistake a reviewer can let through?**
An override that removed the thing under test. A `REPLACE`-strategy override registers a bare
object with no AOP advice, so a test asserting that `@Retryable` retries, against a
`@MockitoBean`-overridden bean, asserts nothing and goes green.

**★ What is the cheapest large win available in most Spring suites?**
Consolidating cache keys — one shared base class carrying the overrides and properties, consistent
mock field names, one spelling for inlined properties. It is nearly free and it is usually worth
more than every test-level optimisation combined.

**★ Which single line in a test file should make you stop and read carefully?**
`assertTimeoutPreemptively`, in any class that is or might be `@Transactional`. Its body runs on
another thread, outside the test-managed transaction, so its writes commit while the test's empty
transaction rolls back cleanly.

**★ How do you review a test suite rather than a test?**
Ask for the context count from the cache DEBUG statistics, check whether the build forks, and
compare the count against the 32-entry cache bound. Those three facts explain most of a suite's
runtime and none of them are visible in any individual test.

**★ A test has `@SpringBootTest` and six `@MockitoBean` fields. What do you say in review?**
That it is a unit test wearing an integration test's costume: everything real has been replaced, so
the context starts an application in order not to use it, and its six overrides give it a cache key
nothing else shares. The assertion almost certainly belongs at level 0 with a constructor call.

{/* FOOTER */}
