---
title: "In a Spring codebase the test pyramid is not a quota for how many tests of each kind you write — it is a statement about how many distinct ApplicationContexts your suite is willing to load, and almost every page in this topic is a consequence of that one number"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.x** reference (TestContext framework:
> context caching, context pausing, bean overriding, property sources, dynamic property sources,
> transaction management) and the **Spring Boot 4.1.0** reference and *Test Auto-configuration
> Annotations* appendix; each chunk names the exact pages it used.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Spring Framework 7.0.8**, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> **No sandbox** — these pages carry Java source and quotations from the reference, never a
> fabricated test run, container log or timing.

**A suite of 3,000 tests that loads one context is fast. A suite of 300 tests that loads forty
contexts is not. That sentence is the topic. Everything else here — which slice to choose, what a
`@MockitoBean` costs, why a space in a property string builds a second application, why a
rolled-back test cannot see a deferred constraint — follows from taking it seriously.**

The topic runs in two halves. The first is **what each level can observe**: no Spring at all, a
slice, a full context, a real server. The second is **what each level costs**, which turns out to
be governed by a cache key with ten components, several of which do not look like configuration
decisions at all — a mock's field name, the whitespace in an inlined property, a
`@DynamicPropertySource` method repeated on twelve classes.

⚠️ **One thing stated as uncertain, deliberately.** No Spring, Boot or JUnit reference defines,
endorses or gives ratios for the test pyramid. It is an industry convention, usually credited to
Mike Cohn's *Succeeding with Agile* (2009), and any 70/20/10 split you have seen is blog material.
[01](01-the-pyramid-and-the-honest-version.md) says so and pivots to the claim the documentation
*does* support.

🔴 **The Boot 4 warning that applies to this whole topic.** `@MockBean` and `@SpyBean` were
**removed**, not deprecated, and their replacements moved out of Boot into Spring Framework. The
slice annotations changed package. Nearly every article, answer and generated snippet about Spring
testing is stale on exactly these points — [06](06-bean-overriding.md) and
[03c](03c-the-slice-catalogue.md) are the two pages to read before trusting anything you find
elsewhere.

**22 chunks, ~4,800 lines.** Read in order; each chunk links to the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The pyramid, honestly](01-the-pyramid-and-the-honest-version.md)** | <span className="db-tier t-understand">Understand</span> | The shape is really about context count, and nobody's documentation defines the ratios |
| 2 | **[A unit test needs no Spring](02-a-unit-test-needs-no-spring.md)** | <span className="db-tier t-understand">Understand</span> | The fastest test calls a constructor — and whether it can is a design decision you already made |
| 3 | **[The slices](03-the-slices.md)** | <span className="db-tier t-understand">Understand</span> | Five meta-annotations: switch auto-configuration off, name a short list back on |
| 4 | **[What a slice excludes](03b-what-a-slice-excludes.md)** | <span className="db-tier t-understand">Understand</span> | The package in the missing-bean message tells you which of two mechanisms excluded it |
| 5 | **[The slice catalogue](03c-the-slice-catalogue.md)** | <span className="db-tier t-understand">Understand</span> | All 20, their new Boot 4 packages, and the H2 advice that expired |
| 6 | **[@SpringBootTest](04-springboottest.md)** | <span className="db-tier t-understand">Understand</span> | It searches *up* the package tree, stops at the first match, and errors on two |
| 7 | **[webEnvironment](04b-webenvironment.md)** | <span className="db-tier t-understand">Understand</span> | `MOCK` starts no server — and a real one ends your rollback guarantee |
| 8 | **[The context cache](05-the-context-cache.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 The biggest lever on suite runtime: ten key components, and how they fragment |
| 9 | **[What evicts it](05b-what-evicts-it.md)** | <span className="db-tier t-understand">Understand</span> | `@DirtiesContext`, and why the reference says *"in the unlikely case"* |
| 10 | **[Context pausing](05c-context-pausing.md)** | <span className="db-tier t-understand">Understand</span> | New in Framework 7.0 — a cached context is a *started* application |
| 11 | **[Bean overriding](06-bean-overriding.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 `@MockBean` is gone; three strategies; the override that invents a bean |
| 12 | **[Overriding changes the cache key](06b-overriding-changes-the-cache-key.md)** | <span className="db-tier t-understand">Understand</span> | The mock is free; the second application context is not — and the field name counts |
| 13 | **[@MockitoSpyBean](06c-mockitospybean.md)** | <span className="db-tier t-understand">Understand</span> | The only override that keeps your real bean, and `doReturn` not `when` |
| 14 | **[@TestBean](06d-testbean.md)** | <span className="db-tier t-understand">Understand</span> | A double that fails to compile when the interface changes |
| 15 | **[Overrides and AOP proxies](06e-overrides-and-aop-proxies.md)** | <span className="db-tier t-master">Master</span> | 🔴 `REPLACE` deletes the advice; `WRAP` keeps it and poisons a `@Cacheable` stub |
| 16 | **[Test properties](07-test-properties-and-profiles.md)** | <span className="db-tier t-understand">Understand</span> | Six-level precedence, and the exact characters become the cache key |
| 17 | **[Profiles and dynamic properties](07b-profiles-and-dynamic-properties.md)** | <span className="db-tier t-understand">Understand</span> | A `Supplier`, not a value — and the registrar bean for what the annotation cannot reach |
| 18 | **[Transactions in tests](08-transactions-in-tests.md)** | <span className="db-tier t-understand">Understand</span> | Rolled back by default, and most `@Transactional` attributes do nothing |
| 19 | **[What rollback hides](08b-what-rollback-hides.md)** | <span className="db-tier t-master">Master</span> | 🔴 A thread boundary commits behind your back; the commit phase goes untested |
| 20 | **[The twenty-minute suite](09-the-twenty-minute-suite.md)** | <span className="db-tier t-understand">Understand</span> | An ordered procedure, because steps 1 and 2 can undo everything after them |
| 21 | **[Choosing a level](10-choosing-a-level.md)** | <span className="db-tier t-understand">Understand</span> | Decided by the assertion, never by the call graph |
| 22 | **[The checklist](11-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | Reviewing a test's level before its content |

## The six things this topic is really about

1. **Context count is the suite's runtime.** Test execution is a rounding error next to context
   startup, so the only number that matters is how many *distinct* contexts you start
   ([05](05-the-context-cache.md), [09](09-the-twenty-minute-suite.md)).
2. **Things that are not configuration decisions fragment the cache anyway.** A mock's field name,
   a space in `key = value`, a per-class `@DynamicPropertySource`. None of them look like
   performance choices and all of them build a second application
   ([06b](06b-overriding-changes-the-cache-key.md), [07](07-test-properties-and-profiles.md)).
3. **An override can silently delete the thing under test.** `REPLACE` registers a bare object with
   no AOP advice, so a test asserting that `@Retryable` retries has nothing left to assert on and
   goes green ([06e](06e-overrides-and-aop-proxies.md)).
4. **A thread boundary destroys the rollback guarantee.** `assertTimeoutPreemptively` and a real
   server both run your work on another thread, where it commits, while the test's empty transaction
   rolls back ([04b](04b-webenvironment.md), [08b](08b-what-rollback-hides.md)).
5. **Slices exclude your beans on purpose.** The missing `@Service` is the feature; the intended
   reply is a mock, not a `@ComponentScan` ([03b](03b-what-a-slice-excludes.md)).
6. **The level follows from the assertion.** If what would have to break is your code, it is a unit
   test; if it is Spring's code, you need the level that configures that part of Spring
   ([10](10-choosing-a-level.md)).

## Where this connects

- **[01 · JUnit 5](../01-junit-5/README.md)** owns the engine. Two of its chunks are the other half
  of arguments made here: [13b · Thread modes](../01-junit-5/13b-thread-modes.md) names Spring's
  transaction management as the reason `SAME_THREAD` exists, and
  [12e · Shared state under parallelism](../01-junit-5/12e-shared-state-under-parallelism.md)
  catalogues the mutations `@DirtiesContext` conceals.
- **[04 · Mockito](../04-mockito/01-what-a-mock-is-for.md)** owns plain Mockito — stubbing,
  verification, captors, strictness. This topic owns Mockito *in a Spring context*:
  `@MockitoBean`, `@MockitoSpyBean` and what the container does to them.
- **06 · MockMvc** *(in progress)* owns the web layer in detail. This topic names the web slice and
  hands off.
- **[07 · Testcontainers](../07-testcontainers/01-passed-on-h2-proves-nothing.md)** owns real
  dependencies. [03c](03c-the-slice-catalogue.md) here carries the Boot 4 change that alters its
  central argument: `@DataJpaTest` no longer swaps a `@ServiceConnection` datasource for H2.
- **Phase 10 · Data access** owns the ORM consequences of a rolled-back test transaction. This
  topic owns the test-level decision and links there rather than repeating it.

{/* FOOTER */}
