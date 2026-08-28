---
title: "The reference introduces @DirtiesContext with the words in the unlikely case, and that phrase is the whole guidance — every routine use of it is a test admitting it mutates shared state, paying for a full context rebuild to hide the fact rather than fixing it"
sidebar_label: "05b · What evicts it"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Context Caching*
> ([caching](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/caching.html))
> and *Testing → Annotations → `@DirtiesContext`*
> ([annotation-dirtiescontext](https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-dirtiescontext.html));
> all enum values and quoted sentences read from those two pages.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> **No sandbox** — no suite was run and no timings appear on this page.

**[05](05-the-context-cache.md) was about how contexts get *created* — a key with ten
components, and how carelessly it fragments. This chunk is the other direction: how a context
leaves the cache. There is exactly one deliberate mechanism, `@DirtiesContext`, and the
reference's own framing of it is the most useful sentence on the subject.**

## What the reference actually says

> *"**In the unlikely case** that a test corrupts the application context and requires reloading
> (for example, by modifying a bean definition or the state of an application object), you can
> annotate your test class or test method with `@DirtiesContext`. This instructs Spring to remove
> the context from the cache and rebuild the application context before running the next test
> that requires the same application context."*

Two things to take from it.

**"In the unlikely case."** The framework's authors expect this to be rare. It is not a hygiene
measure, not a good-practice default, and not something to sprinkle on tests that feel
interdependent. A codebase where `@DirtiesContext` appears on a dozen classes is telling you
something about those classes, not about Spring.

**"Remove the context from the cache and rebuild."** The eviction is not free and it is not
local. The next class needing that configuration pays the full startup cost again — and against
the caching benefit the same page describes:

> *"This means that the setup cost for loading an application context is incurred only once (per
> test suite), and subsequent test execution is much faster."*

`@DirtiesContext` is the annotation that switches that sentence off.

## The modes, in full

Class level, via `classMode`:

| `ClassMode` | Effect |
|---|---|
| `BEFORE_CLASS` | Dirty the context **before** the current test class |
| `AFTER_CLASS` | Dirty the context **after** the current test class — **the default** |
| `BEFORE_EACH_TEST_METHOD` | Dirty **before every method** in the class |
| `AFTER_EACH_TEST_METHOD` | Dirty **after every method** in the class |

Method level, via `methodMode`:

| `MethodMode` | Effect |
|---|---|
| `BEFORE_METHOD` | Dirty before this test |
| `AFTER_METHOD` | Dirty after this test — **the default** |

```java
@DirtiesContext(classMode = BEFORE_CLASS)
class FreshContextTests {
    // some tests that require a new Spring container
}

@DirtiesContext                     // classMode = AFTER_CLASS, the default
class ContextDirtyingTests {
    // some tests that result in the Spring container being dirtied
}

@DirtiesContext(methodMode = BEFORE_METHOD)
@Test
void testProcessWhichRequiresFreshAppCtx() {
    // some logic that requires a new Spring container
}
```

🔴 **The per-method modes are the expensive ones by a wide margin.**
`classMode = AFTER_EACH_TEST_METHOD` on a class with 20 tests starts **20 contexts**. If that
context is a full `@SpringBootTest`, this single annotation can outweigh every other cost in the
suite. It is occasionally correct — a test that genuinely reconfigures the container per method —
and it is far more often a blunt fix for state leaking between methods, which is a `@BeforeEach`
problem.

## Before or after — a real distinction, not a preference

`AFTER_*` says *"I broke it, clean up behind me."* `BEFORE_*` says *"someone else may have broken
it, give me a clean one."*

They cost the same and they mean opposite things. `BEFORE_CLASS` in particular is a defensive
annotation: it does not stop this class dirtying the context for the next one, it only protects
*this* class from whatever came before. If you find yourself needing it, the interesting question
is which earlier test is doing the dirtying — and that test is the one to fix.

## `hierarchyMode` — only relevant with a context hierarchy

For tests using `@ContextHierarchy`:

| `HierarchyMode` | Effect |
|---|---|
| `EXHAUSTIVE` | Clear the cache exhaustively, **including all other context hierarchies that share an ancestor context** — the default |
| `CURRENT_LEVEL` | Clear only the current level |

```java
class ExtendedTests extends BaseTests {

    @Test
    @DirtiesContext(hierarchyMode = CURRENT_LEVEL)
    void test() {
        // some logic that results in the child context being dirtied
    }
}
```

⚠️ The default is the aggressive one. `EXHAUSTIVE` reaches sideways into *other* hierarchies that
merely share an ancestor, so in a suite built on a shared parent context one `@DirtiesContext`
can evict far more than the class it is written on. If you use context hierarchies and dirty a
child, `CURRENT_LEVEL` is usually what you meant.

Most Boot codebases have no context hierarchy at all, in which case this attribute never matters.

## The other ways a context leaves the cache — neither of them deliberate

1. **LRU eviction.** The cache is *"bounded with a default maximum size of 32"*, and *"Whenever
   the maximum size is reached, a least recently used (LRU) eviction policy is used to evict and
   close stale contexts."* Configurable via the JVM system property
   `spring.test.context.cache.maxSize`. Your context can vanish because 32 others were created
   after it — nothing to do with your test.
2. **A new JVM.** The cache is static, so forking clears it. Covered in [05](05-the-context-cache.md).

Neither is something you asked for, and both look identical from inside a test: a context start
you did not expect.

## What to do instead, almost every time

`@DirtiesContext` treats a symptom whose cause is nearly always one of these:

- **A mutated singleton.** A test sets a field on a bean and never restores it. Fix: restore it in
  `@AfterEach`, or stop mutating it — inject a value instead of setting one.
- **A static field or a cache.** Fix: clear it in `@AfterEach`. Static state is the problem
  ([topic 01 · 12e](../01-junit-5/12e-shared-state-under-parallelism.md) catalogues the whole
  family).
- **Test data left in a database.** Fix: this is not a context problem at all. Rolling the context
  back does nothing to rows. See [08 · Transactions in tests](08-transactions-in-tests.md).
- **A bean you wanted stubbed differently per class.** Fix: `@MockitoBean` — which has its own
  cost, and it is a cache-key cost rather than a rebuild-every-time cost
  ([06b](06b-overriding-changes-the-cache-key.md)).
- **`MockReset`.** Mockito bean overrides reset **automatically after each test method** by
  default (`MockReset.AFTER`), so "my mock remembered the last test's stubbing" is not a reason to
  dirty a context. See [06 · Bean overriding](06-bean-overriding.md).

## Gotchas and pitfalls

**★ Adding `@DirtiesContext` to fix a flaky suite.**
It usually works, which is the trap. It has converted "a test mutates shared state" into "we pay
a context rebuild to hide that a test mutates shared state", and the mutation is still there,
still able to bite in a differently-ordered run.

**★ `classMode = AFTER_EACH_TEST_METHOD` on a `@SpringBootTest` class.**
One context per test method. On a 20-test class this can dominate the entire suite's runtime.
Check for it first when a suite is slow and the context count is high.

**★ Assuming `@DirtiesContext` resets your database.**
It closes and rebuilds an `ApplicationContext`. Rows in a real database are untouched; only an
embedded database recreated per context appears to be reset, and then only as a side effect.

**★ Assuming `@DirtiesContext` resets your mocks.**
Unnecessary — `@MockitoBean` defaults to `MockReset.AFTER`, so mocks are reset after each test
method already.

**★ Forgetting the default is `AFTER_CLASS`.**
A bare `@DirtiesContext` on a class evicts *after* it runs. If your intent was "give me a clean
context to start with", you wrote the opposite of what you meant and the annotation protects the
*next* class rather than this one.

**★ Ignoring `hierarchyMode` when you do have a hierarchy.**
The default `EXHAUSTIVE` clears other hierarchies that share an ancestor, so the blast radius is
larger than the class it is written on.

**★ Diagnosing an unexpected context start as `@DirtiesContext`.**
It could equally be LRU eviction at 32 entries, or forking. The cache DEBUG logging from
[05](05-the-context-cache.md) distinguishes them; guessing does not.

## Interview questions

**★ What does `@DirtiesContext` do?**
It marks the `ApplicationContext` as dirtied, so the framework removes it from the cache and
closes it. The next test requiring the same configuration metadata gets a freshly built container.
The reference frames it as being for *"the unlikely case that a test corrupts the application
context"* — for example by changing a bean definition or the state of a singleton.

**★ What does it cost?**
A full context rebuild for the next test that needs that configuration. The caching mechanism
exists precisely so that *"the setup cost for loading an application context is incurred only
once (per test suite)"*; `@DirtiesContext` opts out of that for the affected configuration.

**★ What are the class modes and which is the default?**
`BEFORE_CLASS`, `AFTER_CLASS`, `BEFORE_EACH_TEST_METHOD` and `AFTER_EACH_TEST_METHOD`. The default
is `AFTER_CLASS`. At method level the modes are `BEFORE_METHOD` and `AFTER_METHOD`, defaulting to
`AFTER_METHOD`.

**★ Why is `AFTER_EACH_TEST_METHOD` dangerous?**
It rebuilds the context after every test method in the class — 20 tests means 20 context starts.
On a `@SpringBootTest` that one annotation can cost more than the rest of the suite combined, and
it is usually being used to paper over per-method state leakage that a `@AfterEach` would fix
for free.

**★ A colleague adds `@DirtiesContext` because tests fail when run together. What do you say?**
That it will work and that it is the wrong fix. Something is mutating shared state — a singleton
field, a static, a cache, or rows in a database — and the annotation buys a rebuild to conceal it.
Find the mutation: the same defect will resurface under parallel execution or a different order,
where a context rebuild does not save you.

**★ Does `@DirtiesContext` reset your mocks or your database?**
Neither, meaningfully. Mockito bean overrides already reset after each test method by default
(`MockReset.AFTER`). A real database is entirely unaffected — closing a context does not delete
rows. Only an embedded database that is recreated along with the context appears to reset, and
that is incidental.

**★ What is `hierarchyMode` for?**
Only for `@ContextHierarchy` tests. `EXHAUSTIVE`, the default, clears the cache exhaustively
including other hierarchies that share an ancestor context; `CURRENT_LEVEL` clears only the
current level. If you dirty a child context in a suite built on a shared parent, the default
evicts far more than you intended.

**★ Name two ways a context leaves the cache that nobody asked for.**
LRU eviction once the 32-entry bound is reached — configurable with the
`spring.test.context.cache.maxSize` JVM system property — and starting a new JVM, since the cache
is static and forking gives every process an empty one.

{/* FOOTER */}
