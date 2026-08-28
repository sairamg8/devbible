---
title: "The test pyramid is not a quota for how many tests of each kind you write — it is a statement about how many distinct Spring ApplicationContexts your suite is willing to load"
sidebar_label: "01 · The pyramid, honestly"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → Spring
> TestContext Framework → Context Management → Context Caching*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/caching.html))
> and the Spring Boot 4.1.0 reference *Testing → Testing Spring Boot Applications*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and quotes from the reference, never a
> fabricated test run.

**Every article about the test pyramid draws the same triangle and argues about the
labels. That argument is unresolvable and mostly pointless, because in a Spring codebase
the shape is decided by something concrete and measurable that the triangle never
mentions: how many distinct `ApplicationContext` instances your test suite loads, and how
big each one is. A suite of 3,000 tests that loads one context is fast. A suite of 300
tests that loads forty contexts is not. That is the whole topic, and everything from
[03 · The slices](03-the-slices.md) to
[06b · Overriding changes the cache key](06b-overriding-changes-the-cache-key.md) is a
consequence of it.**

## The shape, and where it came from

The test automation pyramid is an industry convention, not a Spring or JUnit concept.
It is usually attributed to Mike Cohn's *Succeeding with Agile* (2009), and the drawing
says: many fast, narrow tests at the base; fewer, wider tests in the middle; a handful of
end-to-end tests at the top.

⚠️ **What I could not confirm from the documentation:** no Spring, Spring Boot or JUnit
reference endorses, defines or ratios the pyramid. Anyone quoting "70/20/10" is quoting a
blog post, not a specification. Treat every specific ratio you have read — including the
ones in this topic's examples — as illustrative.

What *is* documented, and what the pyramid is really encoding, is cost. The Framework
reference calls context loading:

> *"the potentially time-consuming process of loading the context"*

and it says plainly why suites get slow:

> *"Since having a large number of application contexts loaded within a given test suite
> can cause the suite to take an unnecessarily long time to run, it is often beneficial to
> know exactly how many contexts have been loaded and cached."*

Read that twice. The cost driver named by the reference is **the number of contexts**, not
the number of tests. That is the sentence the pyramid is a folk approximation of.

## The four levels, stated in Spring terms

Forget "unit / integration / end-to-end". In a Spring Boot application there are exactly
four levels, distinguished by what the test starts:

| Level | What it starts | Annotation | What it can catch |
|---|---|---|---|
| 0 | Nothing. A JVM and your classes. | none — plain JUnit | Logic, branches, boundary conditions, invariants |
| 1 | A **partial** context: one layer's auto-configuration and a filtered component scan | `@WebMvcTest`, `@DataJpaTest`, `@JsonTest`, … | Wiring *within* one layer: mappings, serialisation, query derivation |
| 2 | A **full** context, no server | `@SpringBootTest` (default `webEnvironment = MOCK`) | Wiring across the whole application; configuration that only exists at runtime |
| 3 | A full context **plus a real server** and often real dependencies | `@SpringBootTest(webEnvironment = RANDOM_PORT)` + Testcontainers | Protocol, serialisation over the wire, real SQL, real transactions |

Each level costs strictly more than the one below it and catches strictly different bugs.
"Strictly different" is the part people get wrong: a level-3 test does not catch level-0
bugs *better*, it catches them *later, more slowly and with a worse error message*. A
null-handling branch that fails as an `AssertionError` on line 14 of a plain JUnit test
fails as an HTTP 500 with a 40-frame stack trace at level 3.

## Why the base has to be wide: the level-0 test starts no context at all

```java
// Level 0. No Spring. No context key. Nothing to cache, nothing to evict.
class OrderTotalTest {

    @Test
    void appliesTheDiscountBeforeTax() {
        var order = new Order(List.of(new Line("SKU-1", 2, Money.of("10.00"))));
        var total = new OrderTotal(new FlatDiscount(percent(10)), new Vat(percent(20)));

        assertThat(total.of(order)).isEqualTo(Money.of("21.60"));
    }
}
```

That test's cost is a constructor call. It contributes nothing to the context cache, so it
cannot make the suite slower for anyone else. You can have ten thousand of them. This is
the entire argument for a wide base, and [02](02-a-unit-test-needs-no-spring.md) makes it
in full.

## Why the top has to be narrow: level 3 does not share

A level-3 test does not merely cost a context. It costs a context **plus** an embedded
server bound to a port, plus — increasingly — a container. And because
`webEnvironment = RANDOM_PORT` starts a real server, the client and the server run on
different threads, which Boot's reference spells out as a behavioural difference, not just
a cost:

> *"However, as using this arrangement with either RANDOM_PORT or DEFINED_PORT implicitly
> provides a real servlet environment, the HTTP client and server run in separate threads
> and, thus, in separate transactions. Any transaction initiated on the server does not
> roll back in this case."*

So level 3 is where your test-isolation strategy stops working for free. See
[08 · Transactions in tests](08-transactions-in-tests.md).

## The inverted pyramid, and how a team gets there

Nobody decides to invert the pyramid. It happens one pull request at a time:

1. Someone needs a `UserService` in a controller test, so they replace `@WebMvcTest` with
   `@SpringBootTest` because "it just works".
2. Someone else copies that class as a template.
3. Six months later every test class carries `@SpringBootTest`, and half of them carry a
   `@MockitoBean` or a `@TestPropertySource` that is subtly different from the others'.
4. Each of those differences is a different context cache key
   ([05](05-the-context-cache.md)), so the suite loads a fresh application per handful of
   test classes.
5. The build takes twenty minutes, and the team concludes "Spring tests are slow".

Spring tests are not slow. *Thirty-eight distinct application contexts* are slow. The
diagnosis is in [09 · The twenty-minute suite](09-the-twenty-minute-suite.md) and the
one-line instrument that proves it is in [05](05-the-context-cache.md).

## The honest version of the pyramid

The pyramid is right about the shape and wrong about the reason. Here is the version worth
holding:

- **The base is wide because level-0 tests are free**, not because unit tests are morally
  superior. If a piece of logic can be tested without a context, testing it with one buys
  nothing and costs everyone.
- **The middle is where most real defects live**, because most real defects are wiring
  defects — a wrong `@RequestMapping`, a missing `@Transactional`, a JSON field that
  serialises as `null`. Slices exist to catch those cheaply.
- **The top is narrow because it is the only level that is not shared**, and because a
  level-3 failure is the hardest kind to diagnose.
- **The number to minimise is contexts, not tests.** Two hundred test classes sharing one
  context is a healthy suite. Twenty test classes with twenty contexts is not.

## What this topic owns, and what it hands off

This topic owns **level choice** and the Spring test context: slices, `@SpringBootTest`,
the context cache, bean overriding, test properties and transactions. It does **not** own:

- `MockMvc` / `MockMvcTester` request-building and response assertions —
  **06 · Web-layer tests with MockMvc** *(not written yet)*. This topic names `@WebMvcTest`
  as a level and stops.
- Testcontainers, `@ServiceConnection` and the singleton container pattern —
  **07 · Testcontainers** *(not written yet)*.
- Plain Mockito — stubbing, verification, strictness, `@Mock` and `@InjectMocks` — which is
  [04 · Mockito](../04-mockito/README.md). `@MockitoBean` and `@MockitoSpyBean` are
  Spring annotations and live here, in [06](06-bean-overriding.md).
- The JUnit engine itself, which is [01 · JUnit 5](../01-junit-5/README.md).

## Gotchas

**★ "We follow the test pyramid" is not a claim anyone can check, and it is usually false.**
The checkable version is: how many distinct contexts does the suite load? Set the
`org.springframework.test.context.cache` logging category to `DEBUG` and the framework
tells you. The reference documents exactly this:
*"To view the statistics for the underlying context cache, you can set the log level for
the `org.springframework.test.context.cache` logging category to `DEBUG`."* Until you have
that number, every discussion about the pyramid is aesthetics.

**★ Adding tests at the wrong level makes the suite slower for tests that are not yours.**
This is what makes level choice a shared concern rather than a personal style. A level-0
test costs its author. A new context costs every test that runs after it, and — once the
cache passes its default maximum size of 32 — evicts somebody else's context under LRU, so
that context has to be rebuilt.

**★ The pyramid does not say "no end-to-end tests".** It says few. A system with zero
level-3 tests has never proven that its application actually starts, that its SQL is valid
against the real dialect, or that its serialisation survives the wire. The gate for this
phase is deliberately "the service covered three ways", not "the service covered one way".

**★ Test count is a vanity metric and coverage is a floor, not a shape.** Neither number
tells you whether the tests are at the right level. A suite that is 95% covered entirely by
`@SpringBootTest` tests is worse than one at 80% with a wide level-0 base, because the first
cannot be run in under ten minutes and therefore is not run.

**★ Forked test JVMs silently delete the entire argument.** The context cache is a static
field. The reference: *"if tests run in separate processes, the static cache is cleared
between each test execution, which effectively disables the caching mechanism."* A Surefire
`forkMode` of `always` or `pertest` means every test class reloads its context, so pyramid
discipline buys you nothing. Check your build before you optimise your tests.

## Interview questions

**★ What actually makes a Spring Boot test suite slow?**
Loading application contexts, and specifically loading *many distinct* ones. The framework
caches a context under a key derived from its configuration and reuses it for every test
class with the same key, so the marginal cost of an extra test class that matches an
existing key is close to nothing. The marginal cost of a test class whose configuration
differs in any way — a different property, a different profile, a `@MockitoBean` the other
classes do not have — is a whole new context. The reference names the count of contexts, not
the count of tests, as the thing worth measuring.

**★ Someone argues that the pyramid is obsolete and you should write "integration tests
only, because they test what users care about". How do you answer?**
Two ways. First, on economics: integration tests are not free-riding on the same context —
each variation of configuration builds another one, so an integration-only suite grows
super-linearly in wall-clock time and eventually stops being run. Second, on diagnosis: a
failure at level 3 tells you the request returned 500. A failure at level 0 tells you which
branch of which method computed the wrong value. Both are true failures; only one of them
tells you where to look. The right response is not "no integration tests" — the phase gate
here demands them — it is "integration tests where integration is the risk".

**★ Why is "unit vs integration" a worse distinction than the four levels above?**
Because "unit" and "integration" are arguments about definitions and the four levels are
arguments about a fact. Nobody agrees on whether a test that touches two classes is still
a unit test; everyone agrees on what
`@SpringBootTest(webEnvironment = RANDOM_PORT)` starts. Framing the choice as "what does this test start?" makes it reviewable: you can
look at the annotation and know the cost.

**★ Is a test that uses Mockito automatically a unit test?**
No — and this confusion is the source of a lot of bad level choice. Mockito is a library
for building test doubles; it says nothing about whether a Spring context is loaded. A
`@SpringBootTest` with four `@MockitoBean` fields loads a full application context and is a
level-2 test that has had four of its beans replaced. Conversely a level-0 test may use no
mocks at all. The question that sorts tests into levels is "what does it start", not "what
does it fake".

**★ Your team's suite takes twenty minutes. What is the first thing you look at, before
changing a single test?**
Whether the build is forking a JVM per test class, and how many contexts get loaded. The
first is a two-line check in the Surefire or Gradle configuration and can invalidate every
other optimisation you were about to make. The second is one logging category at `DEBUG`.
Only after those two numbers exist is it worth arguing about which test should have been a
slice.

{/* FOOTER */}
