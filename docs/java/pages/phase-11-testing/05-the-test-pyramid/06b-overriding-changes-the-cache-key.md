---
title: "One @MockitoBean gives that test class an ApplicationContext of its very own, and because the field name acts as a qualifier, two classes mocking the same bean into fields named differently get two contexts for one logical configuration"
sidebar_label: "06b · Overriding changes the cache key"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Context Caching*
> ([caching](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/caching.html))
> — the cache-key component list and its `contextCustomizers` gloss — and *Testing → Annotations
> → `@MockitoBean`*
> ([annotation-mockitobean](https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-mockitobean.html))
> for the statement about qualifiers and separate contexts.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, Mockito 5.23.0.
> **No sandbox** — no suite was run and no timings appear on this page.

**This is the most expensive line in Spring testing that nobody knows they are writing.
[06](06-bean-overriding.md) covered what a bean override *does*. This chunk is what it *costs*,
and the cost is not the mock — mocks are free. The cost is that the override is part of the
context cache key, so the test class that declares it stops sharing a context with everything
else.**

## The sentence

From the cache-key component list in [05](05-the-context-cache.md), the fourth component:

> **`contextCustomizers`** — *"this includes `@DynamicPropertySource` methods, bean overrides
> (such as `@TestBean`, `@MockitoBean`, `@MockitoSpyBean` etc.), as well as various features from
> Spring Boot's testing support."*

Bean overrides are cache-key components. So:

```java
@SpringBootTest
class OrderFlowTest { }                          // context A

@SpringBootTest
class PaymentFlowTest { }                        // context A — shared, free

@SpringBootTest
class ShippingFlowTest {
    @MockitoBean CarrierClient carrierClient;    // context B — a whole new application
}
```

`ShippingFlowTest` did not get "context A plus a mock". It got a **different context**, built from
scratch: connection pool, Hibernate, every bean in your application. One annotation.

## 🔴 And the field name counts

From the `@MockitoBean` documentation:

> *"Qualifiers (including field names) determine if a separate `ApplicationContext` is needed"*

Which combines with the selection rule from [06](06-bean-overriding.md) — *"In the absence of a
`@Qualifier` annotation, the name of the annotated field will be used as a fallback qualifier"* —
to produce this:

```java
class ShippingTest {
    @MockitoBean CarrierClient carrierClient;    // context B
}

class TrackingTest {
    @MockitoBean CarrierClient carrier;          // context C — same bean, same mock, new context
}
```

**Same type, same intent, same behaviour, two contexts.** Nothing warns you. The only visible
symptom is a slow suite, and the cause is a variable name.

This is a genuinely good, concrete reason to have a naming convention for mock fields: name the
field after the bean, always, everywhere.

## How this compounds

The arithmetic is unforgiving because it is combinatorial, not additive. Consider a suite of 30
`@SpringBootTest` classes:

- **No overrides anywhere** → 1 context. Every class shares it.
- **Every class mocks the same one bean, field named identically** → 2 contexts: the plain one and
  the one-mock one. Still fine.
- **Each class mocks a different combination of collaborators** → **one context per distinct
  combination.** Not per mock — per *set*. A class mocking `{A, B}` shares nothing with a class
  mocking `{A}` or `{A, B, C}`.

Thirty classes each mocking their own two or three collaborators can easily produce twenty-plus
distinct contexts, at which point you are also near the **32-entry LRU bound** and the suite starts
evicting and rebuilding contexts it will need again ([05](05-the-context-cache.md)).

This is how a Spring test suite gets to twenty minutes without anyone writing a slow test.

## Making it visible

Do not reason about this — measure it, with the logging category from
[05](05-the-context-cache.md):

```properties
logging.level.org.springframework.test.context.cache=DEBUG
```

Then read the **miss count**. If it is close to your test-class count, almost nothing is being
shared, and bean overrides are the first place to look — they are the most common cause and by far
the easiest to fix.

## The fixes, in order of value

**1 · Use a slice instead of mocking.**
The best override is the one you do not need. A `@WebMvcTest` does not contain your `@Service`
at all ([03b](03b-what-a-slice-excludes.md)), so mocking it there is expected and the slice's own
context is shared with every other `@WebMvcTest` that mocks the same set. The expensive pattern is
`@SpringBootTest` **plus** mocks — a full application context, fragmented.

**2 · Standardise on one shared configuration.**
If several classes need the same mocks, put them on a common base class or a shared
`@TestConfiguration`, so all of them produce the *identical* key and share one context:

```java
@SpringBootTest
@MockitoBean(types = ExternalPaymentGateway.class)
abstract class IntegrationTestBase { }

class OrderFlowTest extends IntegrationTestBase { }
class RefundFlowTest extends IntegrationTestBase { }   // same key, same context
```

**3 · Name mock fields consistently.**
Free, and it removes the accidental fragmentation entirely.

**4 · Consider a real test double instead.**
A hand-written in-memory implementation registered once in a shared `@TestConfiguration` is part
of that configuration and therefore part of *one* key, shared by everyone using it — rather than
a per-class override. This is the trade [12 · Mocks vs fakes](../04-mockito/12-mocks-vs-fakes.md)
argues from the Mockito side, and the context cache is an argument for fakes that the mocking
literature never mentions.

## Gotchas and pitfalls

**★ Believing the cost of a mock is the mock.**
A Mockito mock costs microseconds. The context it forces Spring to build costs seconds, and you
pay it once per distinct configuration — sometimes more, once eviction starts.

**★ Renaming a mock field during a refactor.**
`carrierClient` → `carrier` splits one context into two. It is invisible in review and invisible
in the test output.

**★ Adding "just one more mock" to an existing test class.**
The set changed, so the key changed. That class no longer shares with the classes it used to
share with, and it has created a new configuration that only it uses.

**★ Assuming mocks in *different* classes of the same set are still separate contexts.**
They are not, and this is the good news: identical override sets with identical names share a
context. That is what makes fix #2 work.

**★ Raising `spring.test.context.cache.maxSize` when the count exceeds 32.**
It stops the thrashing and you still start every one of those contexts. Reduce the count.

**★ Using `@MockitoBean` on a slice test and worrying about this.**
Much less of a problem: slice contexts are small and start fast, and the mock is usually
*required* because the slice excluded the bean. The pathology is `@SpringBootTest` plus per-class
mocks.

**★ Forgetting `@DynamicPropertySource` is in the same bullet.**
It is also a `contextCustomizer`. A test class with its own `@DynamicPropertySource` method has
its own context for the same reason — which matters for Testcontainers wiring
([07 · Testcontainers](../07-testcontainers/01-passed-on-h2-proves-nothing.md)).

## Interview questions

**★ Why does adding a `@MockitoBean` slow down a test suite?**
Because bean overrides are part of the context cache key — they are `contextCustomizers`, which
the reference explicitly says includes `@TestBean`, `@MockitoBean` and `@MockitoSpyBean`. The
class declaring the override no longer shares a context with classes that do not, so Spring builds
a second full application context for it.

**★ Two test classes mock the same bean. Do they share a context?**
Only if the overrides are configured identically — including the **field name**, because qualifiers
and field names determine whether a separate `ApplicationContext` is needed, and an unqualified
override falls back to the field name as its qualifier. `@MockitoBean CarrierClient carrierClient`
and `@MockitoBean CarrierClient carrier` are two contexts.

**★ Does the number of contexts grow with the number of mocks?**
It grows with the number of distinct *combinations*. A class mocking `{A, B}` shares nothing with
one mocking `{A}` or `{A, B, C}`. That is why fragmentation is combinatorial and why suites cross
the 32-entry cache bound so easily.

**★ How would you diagnose this in a real codebase?**
Set `org.springframework.test.context.cache` to `DEBUG` and read the cache statistics. A miss
count near the number of test classes means nothing is being shared. Then group the classes by
their override sets — the groups are your contexts.

**★ How do you fix it without giving up mocks?**
Push the mocking down into slices, where the bean was excluded anyway and the context is small;
or hoist a shared set of overrides onto a common base class so many classes produce one identical
key; or replace a per-class mock with a real test double registered once in a shared
`@TestConfiguration`, which becomes part of a single configuration rather than a per-class
override.

**★ What else lands in the same cache-key bullet as bean overrides?**
`@DynamicPropertySource` methods, and *"various features from Spring Boot's testing support"* —
all grouped under `contextCustomizers`. So a per-class `@DynamicPropertySource` fragments the
cache exactly as a per-class mock does.

{/* FOOTER */}
