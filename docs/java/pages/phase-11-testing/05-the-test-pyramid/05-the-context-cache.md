---
title: "Spring caches an ApplicationContext across test classes and keys that cache on ten configuration parameters, so the number that decides your suite's runtime is not how many tests you have — it is how many distinct combinations of those ten your test classes managed to produce"
sidebar_label: "05 · The context cache"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Context Management → Context Caching*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/caching.html))
> and *Context Failure Threshold*
> ([failure-threshold](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/failure-threshold.html));
> the ten cache-key components and the caching statistics instruction are quoted from that
> reference verbatim.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> **No sandbox** — no suite was run and no timings appear on this page.

**Starting a Spring context is the expensive thing your test suite does. Running a test is not.
So the runtime of a Spring test suite is very nearly a function of one number — how many distinct
contexts it starts — and that number is decided by a cache key you have never looked at. This is
the highest-leverage page in the topic: a suite that starts 40 contexts and one that starts 4 can
contain exactly the same tests.**

## The cache exists and it is shared across classes

The TestContext framework caches loaded contexts in a **static** cache, keyed by configuration.
Two test classes with identical configuration get the *same* `ApplicationContext` instance —
not an equivalent one, the same one. That is why a `@BeforeAll` that mutates a bean in one class
can be observed by another, and why bean state leaking between test classes is a real category of
bug rather than a theoretical one.

The cache is **not** per class, per package or per run configuration. It is per unique key, for
the lifetime of the JVM.

## 🔴 The key — all ten components, quoted

> *"The TestContext framework uses the following configuration parameters to build the context
> cache key:"*
>
> - `locations`
> - `classes`
> - `contextInitializerClasses`
> - **`contextCustomizers`** — *"this includes `@DynamicPropertySource` methods, bean overrides
>   (such as `@TestBean`, `@MockitoBean`, `@MockitoSpyBean` etc.), as well as various features
>   from Spring Boot's testing support."*
> - `contextLoader`
> - `parent`
> - `activeProfiles`
> - `propertySourceDescriptors`
> - `propertySourceProperties`
> - `resourceBasePath`

Read that fourth bullet twice. **A `@MockitoBean` is part of the cache key.** Adding one mock to
one test class gives that class its own context, separate from every other class that loads the
same application. That is the single most expensive line people write without knowing it, and it
gets its own chunk: [06b · Overriding changes the cache key](06b-overriding-changes-the-cache-key.md).

The practical reading of the other nine:

- **`classes` / `locations`** — a different `@SpringBootTest(classes = …)` list is a different
  context. Hand-tuned lists fragment the cache.
- **`activeProfiles`** — `@ActiveProfiles("test")` on some classes and not others is two contexts.
  The *set* matters, and the framework treats profiles as an unordered set, so ordering them
  differently does not fragment.
- **`propertySourceProperties`** — inlined properties, and 🔴 **compared as strings** (below).
- **`contextLoader` / `parent` / `resourceBasePath`** — rarely what you are varying, but a slice
  and a `@SpringBootTest` differ in loader and bootstrapper, so they never share a context.

## 🔴 Inlined properties are compared as strings, not as values

From the reference on `@TestPropertySource`:

> *"the exact strings you provide will be used to determine the key for the context cache … you
> must ensure that you define inlined properties consistently."*

So these two classes get **two contexts**:

```java
@SpringBootTest(properties = "app.mode=fast")     // class A
@SpringBootTest(properties = "app.mode = fast")   // class B — one space, one extra context
```

Same property, same value, same behaviour, twice the startup. Nothing warns you. The only defence
is convention: pick one spelling and apply it everywhere, or better, put shared test properties in
`application-test.yml` and share a profile instead of inlining them per class.

## 🔴 Bean-override names fragment it too

From the `@MockitoBean` documentation:

> *"Qualifiers (including field names) determine if a separate `ApplicationContext` is needed"*

Two test classes that mock **the same bean** into **differently named fields** get **two
contexts**:

```java
@MockitoBean PaymentGateway paymentGateway;   // class A
@MockitoBean PaymentGateway gateway;          // class B — different field name, new context
```

This is not a documented trap so much as a documented mechanism with a surprising consequence,
and it is a genuinely good reason to standardise field names across a codebase.

## The cache is bounded, and eviction is worse than a miss

> *"bounded with a default maximum size of 32"*

It is **LRU**, and the size is set with `spring.test.context.cache.maxSize`. Once a suite produces
more than 32 distinct contexts, contexts start being evicted and later re-created — so a suite can
pay for the *same* context several times in one run. This is the point at which suite runtime
stops being merely bad and becomes non-linear.

If you have more than 32 distinct configurations, raising `maxSize` treats the symptom. The
disease is 32 distinct configurations.

## Seeing what is actually happening

You do not have to guess how many contexts your suite starts. The reference tells you exactly how
to find out:

> *"To view the statistics … set the log level for the `org.springframework.test.context.cache`
> logging category to `DEBUG`."*

```properties
logging.level.org.springframework.test.context.cache=DEBUG
```

The statistics report hit count, miss count, size and the maximum. **Run this before optimising
anything.** A miss count near your test-class count means almost nothing is being shared, and
that number tells you more about your suite's runtime than any profiler will.

## 🔴 Forking destroys the cache entirely

> *"if tests run in separate processes, the static cache is cleared between each test execution,
> which effectively disables the caching mechanism."*

The cache is a static field. A new JVM has an empty one. So a Surefire configuration with
`forkMode` of `always` or `pertest` — or `forkCount` with a low `reuseForks` — means **every test
class starts its own context from scratch**, and every optimisation on this page is worth nothing.

This is worth checking first when a suite is inexplicably slow, because it is a build
configuration nobody remembers making, often added years earlier to work around a static-state
problem that has since been fixed.

## Context failure threshold — the fast fail you want

Since Framework 6.1 there is a failure threshold, default **1**. Once a context configuration has
failed to load, the next test class with the same configuration gets

> *"an immediate `IllegalStateException`"*

rather than another attempt. The property is `spring.test.context.failure.threshold`.

This is a good default and worth knowing about, because the symptom — a stack trace that names
`IllegalStateException` instead of the actual configuration error — reads as a different failure
from the real one. **The real error is in the first failure, higher up the log.** Do not debug the
threshold exception.

## The attack order, when a suite is too slow

1. **Check for forking.** If the build forks per class, nothing else matters.
2. **Turn on the cache DEBUG logging** and read the miss count. That is your context count.
3. **Find what varies.** Group your test classes by the ten key components; the answer is nearly
   always bean overrides, inlined properties, or `classes = …` lists.
4. **Consolidate.** One shared test profile, one consistent property spelling, mocks pushed down
   into slices or replaced by real test doubles.
5. **Only then** look at the tests themselves.

[09 · The twenty-minute suite](09-the-twenty-minute-suite.md) works this through end to end.

## Gotchas and pitfalls

**★ Assuming each test class gets a fresh context.**
It does not. Identical configuration means the identical instance, so a mutated singleton is
visible in the next class. This is the origin of "it passes alone and fails in the suite".

**★ Adding one `@MockitoBean` and losing the shared context.**
Bean overrides are a cache-key component. That class now starts its own application. Multiply by
the number of classes that each mock one thing differently.

**★ Inlining the same property with different whitespace.**
`key=value` and `key = value` are different strings and therefore different contexts. Nothing
reports it.

**★ Raising `maxSize` to fix a slow suite.**
It stops the thrashing and leaves you starting the same number of contexts. Worth doing as a
stopgap; worthless as a fix.

**★ Reading `IllegalStateException` from the failure threshold as the bug.**
It is the second symptom. The first context-load failure, earlier in the log, has the real cause.

**★ Forking per test class to isolate static state.**
It works and it disables the context cache completely. The static state is the thing to fix;
forking hides it at the cost of the single largest performance mechanism the framework has.

**★ Optimising test bodies before counting contexts.**
Test execution is usually a rounding error next to context startup. Count first.

**★ Assuming two slices of the same type share a context.**
Only if all ten key components match. Two `@WebMvcTest` classes with different `@MockitoBean`
fields do not.

## Interview questions

**★ What makes a Spring test suite slow?**
Starting contexts, almost always. Individual test execution is cheap; a context start builds a
connection pool, a Hibernate `SessionFactory`, and every bean in your application. So the runtime
tracks the number of *distinct* contexts, not the number of tests, and that count is set by the
cache key.

**★ What is in the context cache key?**
Ten things: `locations`, `classes`, `contextInitializerClasses`, `contextCustomizers`,
`contextLoader`, `parent`, `activeProfiles`, `propertySourceDescriptors`,
`propertySourceProperties` and `resourceBasePath`. The one people are surprised by is
`contextCustomizers`, which includes `@DynamicPropertySource` methods and every bean override —
`@MockitoBean`, `@MockitoSpyBean`, `@TestBean`.

**★ Two test classes mock the same bean. Do they share a context?**
Only if the override is configured identically — and that includes the **field name**, because
qualifiers, field names among them, participate in deciding whether a separate context is needed.
`@MockitoBean PaymentGateway paymentGateway` and `@MockitoBean PaymentGateway gateway` are two
contexts.

**★ Is the context cache per class or per JVM?**
Per JVM — it is a static cache, bounded at 32 entries by default and evicting least-recently-used.
Which means it is also destroyed by forking: if the build starts a new JVM per test class, the
cache is empty every time and effectively disabled.

**★ How do you find out how many contexts your suite starts?**
Set `org.springframework.test.context.cache` to `DEBUG`. The framework logs cache statistics —
hits, misses, size, maximum size. The miss count is the number of contexts started. Do this before
any other optimisation, because it turns an argument into a number.

**★ Your suite starts 50 contexts and the cache holds 32. What happens?**
Eviction, and then re-creation. Contexts that were dropped get built again later in the run, so
the suite pays for some contexts more than once. Raising `maxSize` stops the thrashing but you are
still starting 50; the fix is to stop producing 50 distinct configurations.

**★ Why do the exact characters of an inlined property matter?**
Because `propertySourceProperties` is part of the key and is compared as the literal strings you
supplied. The reference is explicit that *"the exact strings you provide will be used"* and that
you must define them consistently. `key=value` and `key = value` produce two contexts for one
configuration.

**★ What is the context failure threshold and why would you care?**
Since Framework 6.1, once a context configuration has failed to load, subsequent test classes with
the same configuration fail immediately with an `IllegalStateException` instead of retrying —
default threshold 1, configurable with `spring.test.context.failure.threshold`. You care because
the exception you *see* is not the error you need; the original load failure is earlier in the log.

{/* FOOTER */}
