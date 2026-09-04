---
title: "@SpringBootTest finds your configuration by walking up the package tree until it meets a @SpringBootConfiguration, which is why moving a test class one package sideways can change what the test loads without changing a line of the test"
sidebar_label: "04 · @SpringBootTest"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Boot 4.1.1 reference *Testing → Testing Spring Boot
> Applications → Detecting Test Configuration* and *Excluding Test Configuration*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)),
> the Boot 4.1.0 javadoc for `SpringBootTest`, `SpringBootConfiguration`, `TestConfiguration`
> and `SpringBootApplication`, and the Spring Framework 7.0.x reference
> *Testing → TestContext framework → Context configuration*.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> **No sandbox** — Java source only.

**A slice is a small context assembled from a named list. `@SpringBootTest` is the opposite:
it finds your application's own configuration and loads all of it. The interesting part is the
word *finds*. You never tell `@SpringBootTest` which class configures your application; it goes
looking, using a rule that is simple, documented, and responsible for a whole family of failures
that look like they must be about something else.**

## The search

From the reference:

> *"If you are familiar with the Spring Test Framework, you may be used to using
> `@ContextConfiguration(classes=…)` in order to specify which Spring `@Configuration` to load.
> Alternatively, you might have often used nested `@Configuration` classes within your test.
> When testing Spring Boot applications, this is often not required. Spring Boot's `@*Test`
> annotations search for your primary configuration automatically whenever you do not
> explicitly define one."*

And the algorithm:

> *"The search algorithm works up from the package that contains the test until it finds a class
> annotated with `@SpringBootApplication` or `@SpringBootConfiguration`."*

Three consequences follow immediately, and all three bite:

1. **`@SpringBootApplication` is itself meta-annotated `@SpringBootConfiguration`.** That is why
   the search finds your main class without you doing anything.
2. **It works *up* from the test's package, never down and never sideways.** A test in
   `com.example.orders.web` finds `com.example.Application`. A test in
   `com.example.tests.orders` — a parallel test-only package tree — walks up to `com.example.tests`,
   then `com.example`, and finds it there too. But a test in `org.acme.orders` never will.
3. **The search stops at the first one it finds.** So the *nearest* `@SpringBootConfiguration`
   above your test wins, which is exactly how a test picks up a stray configuration class that
   somebody left in a test package years ago.

🔴 **The practical rule: keep your test class in the same package as the production class it
tests.** It is the convention Maven and Gradle layouts already push you toward, and it makes the
search a non-issue. Every problem in this section is a problem about tests placed somewhere
clever.

## Two `@SpringBootConfiguration`s is an error, not a merge

If the search finds more than one candidate, the context fails to load rather than picking one.
This is the failure behind the message people usually meet as *"Found multiple
@SpringBootConfiguration annotated classes"*, and it has one common cause: someone added a second
`@SpringBootApplication` class for a test, or a sample, or a second entry point.

The fix is to make the extra class not be a configuration candidate — use `@TestConfiguration`
instead, which is the annotation designed for exactly this.

## `@TestConfiguration` vs a nested `@Configuration` — the distinction that matters

```java
@SpringBootTest
class OrderServiceTest {

    @TestConfiguration
    static class Extras {
        @Bean Clock fixedClock() { return Clock.fixed(INSTANT, ZoneOffset.UTC); }
    }
}
```

The reference is explicit about what `@TestConfiguration` buys:

> *"Unlike a nested `@Configuration` class, which would be used **instead of** your application's
> primary configuration, a nested `@TestConfiguration` class is used **in addition to** your
> application's primary configuration."*

That is the whole difference, and it is a big one:

- A nested **`@Configuration`** class **replaces** the discovered configuration. Your application
  is not loaded at all. Tests written this way start fast and test something that is not your
  application.
- A nested **`@TestConfiguration`** class is **added** to it. Your application loads, and your
  extra beans go in on top.

`@TestConfiguration` is also **excluded from component scanning**, so a top-level
`@TestConfiguration` in your test sources will not accidentally be picked up by the application —
it only applies where it is nested in the test, or where you name it with
`@Import(Extras.class)`.

## `classes` — the escape hatch, and its cost

```java
@SpringBootTest(classes = {OrderService.class, PricingConfig.class})
class NarrowTest { }
```

Naming `classes` skips the search entirely and loads only what you name. It is occasionally the
right answer, and it has two costs worth stating before you reach for it:

1. **It is a hand-maintained list.** It drifts. A bean added to the application does not appear
   here, so the test keeps passing against a configuration that no longer resembles production.
2. **It is a distinct cache key.** Every distinct `classes` list is its own context
   ([05 · The context cache](05-the-context-cache.md)). Ten tests with ten hand-tuned lists are
   ten contexts, which is usually far more expensive than one shared full context would have been.

If the goal is a smaller context, a **slice** ([03](03-the-slices.md)) is the supported way to
get one, and it is shared with every other test using the same slice.

## What `@SpringBootTest` gives you that a slice does not

- **Your whole application's beans**, wired as production wires them — including the
  `@Component`s and `@ConfigurationProperties` that slices exclude.
- **AOP proxies actually applied**: `@Transactional`, `@Cacheable`, `@Async`, method security.
  This is the level at which those behaviours can be observed at all, because they are created by
  the container. (⚠️ With one important exception — a bean *override* bypasses proxying; see
  [06e · Overrides and AOP proxies](06e-overrides-and-aop-proxies.md).)
- **A real server, optionally.** Which server, and what that costs, is
  [04b · webEnvironment](04b-webenvironment.md).

## Gotchas and pitfalls

**★ Putting tests in a parallel package tree "to keep them tidy".**
`com.example.tests.orders` still walks up to `com.example`, so it usually works — until someone
adds a configuration class in the test tree, which is then found *first* because the search stops
at the nearest match. Same-package placement makes this impossible.

**★ Using a nested `@Configuration` and wondering why nothing is autowired.**
It *replaced* your application's configuration rather than adding to it. The application never
loaded. `@TestConfiguration` is the annotation you wanted.

**★ Adding a second `@SpringBootApplication` for a test fixture.**
The search then finds two candidates and fails. Any extra configuration a test needs should be
`@TestConfiguration`, which is deliberately not a candidate.

**★ Reaching for `classes = …` to speed a test up.**
It creates a bespoke context that will be cached separately from every other test's, so the suite
usually gets slower overall even though that one test got faster. Measure the suite, not the test.

**★ Assuming `@SpringBootTest` starts a web server.**
It does not, by default — `webEnvironment` defaults to `MOCK` and, in the reference's words,
*"Embedded servers are not started."* This is [04b](04b-webenvironment.md), and it is the single
most common misconception about the annotation.

**★ Expecting `@TestConfiguration` in test sources to apply everywhere.**
It is excluded from component scanning by design. It applies where it is nested inside the test
class, or where you `@Import` it explicitly. A top-level `@TestConfiguration` that nobody imports
does nothing at all, silently.

**★ Believing `@SpringBootTest` is "the integration test annotation".**
It is a context-loading annotation. It says nothing about databases, servers, or external
systems — a `@SpringBootTest` with every collaborator mocked is a slow unit test, and a
`@WebMvcTest` hitting a real Testcontainers database is not possible but people try. The level
you are testing at is a decision you make, not one the annotation makes
([10 · Choosing a level](10-choosing-a-level.md)).

## Interview questions

**★ How does `@SpringBootTest` know which configuration to load?**
It searches upward from the package containing the test class until it finds a class annotated
`@SpringBootConfiguration` — which `@SpringBootApplication` is meta-annotated with, so your main
class is normally found. The search stops at the first match, and finding two candidates is an
error rather than a merge.

**★ What breaks if you put your test in a different package tree from your application?**
If no `@SpringBootConfiguration` exists on the way up, the context fails to load with nothing
found. If one exists that you did not intend — a leftover configuration class in a test package —
it is found *first*, because the search stops at the nearest match, and your test silently loads
the wrong application.

**★ What is the difference between a nested `@Configuration` and a nested `@TestConfiguration`
in a test class?**
A nested `@Configuration` is used **instead of** your application's primary configuration, so the
application is not loaded. A nested `@TestConfiguration` is used **in addition to** it. That one
word is the whole difference, and choosing wrong produces a test that passes against an
application that was never started.

**★ Why is `@TestConfiguration` excluded from component scanning?**
So that a test-only configuration sitting in your test sources cannot be picked up by the
application's own scan and change production wiring. The cost is that it does nothing unless it
is nested in the test class or explicitly `@Import`ed — a top-level one that nobody imports fails
silently.

**★ When would you use `@SpringBootTest(classes = …)`?**
Rarely. It skips the search and loads only what you name, so it is a hand-maintained list that
drifts from production and a distinct context-cache entry that is shared with nothing. If the
goal is a smaller context, use a slice; if the goal is a different configuration, that is usually
a design question about the application rather than the test.

**★ Which behaviours can only be tested with a real context?**
Anything implemented by a container-created proxy: `@Transactional` rollback and propagation,
`@Cacheable`, `@Async`, `@Retryable`, method-level security. Construct the bean with `new` and
there is no proxy, so none of it happens. Note the exception — a bean *override* registers a bare
object as a manual singleton and is **not** proxied, which is [06e](06e-overrides-and-aop-proxies.md).

**★ Is `@SpringBootTest` an integration test?**
Not by itself. It is an instruction about which context to load. Whether the test is an
integration test depends on what it talks to — mock every collaborator and you have an expensive
unit test; add Testcontainers and a real server and you have a genuine end-to-end test. The
annotation does not make that decision for you.

{/* FOOTER */}
