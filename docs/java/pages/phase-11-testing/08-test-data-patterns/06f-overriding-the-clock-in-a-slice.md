---
title: "Replacing the clock in a Spring slice is a bean-override decision, and the reflex answer is the wrong one: @TestBean supplies a real fixed clock, while @MockitoBean supplies a null-returning mock and will silently invent the bean your application forgot to declare"
sidebar_label: "06f · Overriding the clock in a slice"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the Spring Framework 7.0.x reference — *Testing → Annotations →
> `@TestBean`*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-testbean.html))
> and *`@MockitoBean` and `@MockitoSpyBean`*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-mockitobean.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, **Spring
> Framework 7.0.8**, JUnit Jupiter 6.0.3, Mockito 5.23.0. ⚠️ Boot 4 removed `@MockBean` and
> `@SpyBean`; the annotations are `@MockitoBean` and `@MockitoSpyBean` and they live in Spring
> Framework, in `org.springframework.test.context.bean.override.mockito`. **No sandbox** — Java
> source and documented configuration only, never a run.

**[06e](06e-the-clock-bean.md) declared the bean. This chunk replaces it for one test. Spring
Framework 7 gives you two mechanisms and they are not interchangeable here: `@TestBean` hands
the context a value you construct, which is exactly what a clock is; `@MockitoBean` hands it a
Mockito mock, which for a clock means `instant()` returns `null` — and, because its documented
strategy is `REPLACE_OR_CREATE`, it will create a `Clock` bean out of nothing if the slice never
saw one. That second behaviour is the reason this is a chunk and not a paragraph: it turns a
missing bean into a green test.**

## `@TestBean` — supply a value

> *"`@TestBean` is used on a non-static field in a test class to override a specific bean in the
> test's `ApplicationContext` with an instance provided by a factory method."*

> *"The associated factory method name is derived from the annotated field's name, or the bean
> name if specified. The factory method must be `static`, accept no arguments, and have a return
> type compatible with the type of the bean to override."*

That shape is precisely what a clock wants, because the replacement is a value you construct,
not behaviour you stub.

```java
@WebMvcTest(TrialController.class)
class TrialControllerTest {

    @TestBean
    Clock clock;                                   // the bean to override

    static Clock clock() {                         // method name derived from the field name
        return Clock.fixed(Instant.parse("2026-01-31T09:00:00Z"), ZoneOffset.UTC);
    }

    @Autowired MockMvcTester mvc;

    @Test
    void theTrialEndsOnTheSecondOfMarch() {
        // …assert on the response body, which contains a literal date
    }
}
```

If the factory method wants a different name, or the bean has a name of its own:

> *"To make things more explicit, or if you'd rather use a different name, the annotation allows
> for a specific method name to be provided via the `methodName` attribute."*

```java
@TestBean(name = "applicationClock", methodName = "fixedAtEndOfJanuary")
Clock clock;

static Clock fixedAtEndOfJanuary() {
    return Clock.fixed(Instant.parse("2026-01-31T09:00:00Z"), ZoneOffset.UTC);
}
```

Note the `name = "applicationClock"`: if you followed [06e](06e-the-clock-bean.md) and named the
bean method something other than `clock`, the override has to name the bean it is replacing.

A `MutableClock` ([06c](06c-the-clocks-a-test-passes.md)) works here too, and is how you advance
time inside a slice test — but keep a reference to it, because the field is typed `Clock`:

```java
@TestBean
Clock clock;

static MutableClock clock() {
    return new MutableClock(Instant.parse("2026-01-31T09:00:00Z"), ZoneOffset.UTC);
}

@Test
void expiresAfterThirtyDays() {
    ((MutableClock) clock).advance(Duration.ofDays(31));
    // …
}
```

⚠️ That cast is honest but ugly, and it hides a real hazard: the factory method is `static`, so
the same instance may be reused across the test class. Reset it in `@BeforeEach` with `setTo(...)`
rather than assuming a fresh one per method.

## `@MockitoBean Clock clock` — two failures

**First, it is `mock(Clock.class)` with extra ceremony.** Unstubbed methods return `null`, so the
first `LocalDate.now(clock)` inside the controller throws inside `java.time`, in a slice test,
with a stack trace mentioning neither your test nor the annotation.
[06d](06d-the-two-mocks-that-are-not-the-fix.md) has the full argument.

**Second, and worse, it will create a bean that does not exist:**

> *"The `@MockitoBean` annotation uses the `REPLACE_OR_CREATE` strategy for bean overrides. If a
> corresponding bean does not exist, a new bean will be created."*

Consider what that means in a `@WebMvcTest`, which deliberately restricts the context to web
concerns and does **not** pick up an arbitrary `@Configuration` class. If your `Clock` bean lives
in `TimeConfiguration`, the slice does not have it. `@MockitoBean Clock clock` does not fail —
it **creates** one, the context starts, and the test goes green against a wiring the application
does not have. The production context may have no `Clock` bean at all and fail on startup; this
test will never say so.

`@TestBean` does not behave that way: it overrides an existing bean, so a missing one is a
failure you meet the moment you write the test rather than the moment you deploy. If you have a
reason to keep `@MockitoBean` — you are mocking a genuine collaborator, not a clock — the
reference gives you the strict mode:

> *"You can switch to the `REPLACE` strategy by setting the `enforceOverride` attribute to
> `true`."*

⚠️ A third documented consequence, harmless for a clock but the reason the same reflex breaks
other overrides: because the strategy replaces the bean directly,

> *"bypassing the container's normal bean post-processing, the resulting mock is a bare object:
> it is never wrapped in a Spring AOP proxy, even if the original bean would have been — for
> example, due to `@Transactional`, `@Cacheable`, or `@Retryable`."*

[06e · Overrides and AOP proxies](../05-the-test-pyramid/06e-overrides-and-aop-proxies.md) covers
that case.

## Both mechanisms change the context cache key

The reference says the same thing about both annotations:

> *"Qualifiers, including the name of a field, are used to determine if a separate
> `ApplicationContext` needs to be created. If you are using this feature to mock or spy the same
> bean in several test classes, make sure to name the fields consistently to avoid creating
> unnecessary contexts."*

For a clock this bites hardest, because the clock is the bean *most* likely to be overridden in
many test classes. `Clock clock` in one class and `Clock fixedClock` in another build two cached
contexts for otherwise identical configuration, and the cost surfaces as "the suite got slower
and nobody knows why" ([05 · The context cache](../05-the-test-pyramid/05-the-context-cache.md)).

## The module-wide fixed clock

When *every* test in a module wants the same fixed clock, a shared `@TestConfiguration` avoids
the cache split entirely — one extra context shared by all of them, instead of one per field
spelling:

```java
@TestConfiguration(proxyBeanMethods = false)
class FixedClockConfiguration {

    static final Instant NOW = Instant.parse("2026-01-31T09:00:00Z");

    @Bean
    Clock applicationClock() {
        return Clock.fixed(NOW, ZoneOffset.UTC);
    }
}
```

```java
@WebMvcTest(TrialController.class)
@Import(FixedClockConfiguration.class)
class TrialControllerTest { … }
```

⚠️ A shared fixed clock is a **fixture**, with everything that implies. It is one date, chosen
once, and it quietly becomes load-bearing: a test "about" month-end passes because `NOW` happens
to be 31 January, and moving `NOW` breaks tests that never mentioned a date. It is right for
"nothing in this module reads the wall clock". It is not a substitute for a test stating the date
it is about — those still override locally, and the constant gives them a base to offset from.

## Where this connects

- Declaring the bean in the first place: [06e · The clock bean](06e-the-clock-bean.md).
- Why a mock is the wrong value: [06d · The two mocks that are not the fix](06d-the-two-mocks-that-are-not-the-fix.md).
- The values worth supplying: [06c · The clocks a test passes](06c-the-clocks-a-test-passes.md).
- Timestamps this override does not reach: [06g · The clocks you do not own](06g-the-clocks-you-do-not-own.md).
- The override mechanisms in general: [06 · Bean overriding](../05-the-test-pyramid/06-bean-overriding.md),
  [06d · @TestBean](../05-the-test-pyramid/06d-testbean.md) and
  [06b · Overriding changes the cache key](../05-the-test-pyramid/06b-overriding-changes-the-cache-key.md).
- What a slice excludes, which is why the missing bean happens:
  [03b · What a slice excludes](../05-the-test-pyramid/03b-what-a-slice-excludes.md).

## Gotchas

**★ `@MockitoBean Clock clock` creates a `Clock` bean when none exists.**
`REPLACE_OR_CREATE` is the documented default: *"If a corresponding bean does not exist, a new
bean will be created."* In a `@WebMvcTest` that never imported your `TimeConfiguration`, this
makes the test green against wiring the application does not have — and the first honest signal
is a failed deployment. Use `@TestBean`, or `@MockitoBean(enforceOverride = true)` if you must
mock.

**★ A mocked clock in a slice throws inside `java.time`, not inside your test.**
Unstubbed `instant()` and `getZone()` return `null`, so the controller's first calendar
conversion throws with a stack trace naming JDK classes and a Spring proxy. Nothing in that
trace points at the annotation that caused it.

**★ Inconsistent override field names across test classes.**
Documented: qualifiers *"including the name of a field"* participate in the decision to build a
separate `ApplicationContext`. `Clock clock` here and `Clock testClock` there is two cached
contexts for the same configuration. The clock is the most-overridden bean, so this is where the
cache fragments first.

**★ Forgetting that the `@TestBean` factory method must be `static` and take no arguments.**
The reference states both requirements. An instance method, or one taking a parameter, is not
found, and the failure is a context-startup error about the override rather than a compile error
— so it looks like a Spring problem rather than a signature problem.

**★ `@TestBean` on a bean the slice does not contain.**
Unlike `@MockitoBean`, `@TestBean` overrides an *existing* bean, so this fails. That is the
feature, not the bug: it is telling you the slice never had a `Clock`, which is exactly the fact
`@MockitoBean` would have concealed. Import the configuration that declares it.

**★ A `MutableClock` returned from a `static` `@TestBean` factory and mutated by several tests.**
The factory is static and the instance can outlive one test method. If one test advances it and
another assumes the starting instant, the suite becomes order-dependent — the failure
[05b · Tests that depend on each other](05b-tests-that-depend-on-each-other.md) describes. Reset it in
`@BeforeEach` with `setTo(...)`.

**★ A module-wide fixed clock treated as a substitute for choosing a date.**
It removes wall-clock non-determinism from the whole module, which is good, and makes every test
silently share one date, which is a hidden coupling: a month-end test passes because the shared
instant is 31 January, and changing the constant breaks tests that never mention a date. Tests
whose subject is a date state that date locally.

**★ Overriding the clock and expecting everything else to agree.**
The `Clock` bean governs the timestamps your Java code produces. It has no effect on
`DEFAULT now()` columns, database triggers, Hibernate's `@CreationTimestamp`, or when
`@Scheduled` fires — [06g](06g-the-clocks-you-do-not-own.md) is entirely about that gap.

**★ Reaching for `@MockitoBean` because "that's the annotation we use for overrides".**
It is the right reflex for a collaborator you want to control and the wrong one for a value you
want to supply. The question that separates them: *would I ever want to `verify()` this?* If no,
you want `@TestBean`.

**★ Writing `@MockBean` out of habit.**
It does not exist in Boot 4 — `@MockBean` and `@SpyBean` were removed and replaced by
`@MockitoBean` and `@MockitoSpyBean`, which now live in Spring Framework at
`org.springframework.test.context.bean.override.mockito`. Every blog post about Spring test
slices predating Boot 3.4 is stale on exactly this point.

## Interview questions

**★ How do you replace the clock in a `@WebMvcTest`, and why not `@MockitoBean`?**
`@TestBean` on a `Clock` field, with a `static`, no-argument factory method whose name matches the
field, returning `Clock.fixed(...)`. That supplies a real clock — a JDK value — rather than a
mock. `@MockitoBean` fails twice: the mock's `instant()` and `getZone()` return `null`, so the
first calendar conversion throws inside `java.time`; and because its documented strategy is
`REPLACE_OR_CREATE`, if the slice never imported the configuration declaring the `Clock` bean,
the annotation creates one and the test passes against a wiring that does not exist in
production.

**★ What is the practical difference between `REPLACE` and `REPLACE_OR_CREATE`?**
`REPLACE` requires the bean to be there and fails if it is not; `REPLACE_OR_CREATE` — the
`@MockitoBean` default — creates it silently. For a collaborator that a slice legitimately does
not contain, creating it is a convenience. For a bean the *application* is supposed to declare,
it is a hole: the test stops being able to tell you that the application's wiring is incomplete.
`@MockitoBean(enforceOverride = true)` switches to `REPLACE`, and `@TestBean` is `REPLACE`
behaviour by construction.

**★ Your suite got slower after several test classes started overriding the clock. What happened?**
Almost certainly context-cache fragmentation. The reference states that qualifiers, *including
the name of the annotated field*, are part of the decision about whether a separate
`ApplicationContext` is needed — so `Clock clock` in one class and `Clock testClock` in another
produce two cached contexts for otherwise identical configuration. The clock is the most commonly
overridden bean, so it fragments first. Fix it by naming the field identically everywhere, or by
moving the fixed clock into one shared `@TestConfiguration` the classes import.

**★ When would you prefer a shared `@TestConfiguration` clock to a per-class `@TestBean`?**
When the goal is "nothing in this module reads the wall clock" rather than "this test is about a
particular date". The shared configuration gives one context for the whole module instead of one
per field name, and it makes the default explicit in a single file. The moment a test's subject
*is* a date — month end, leap day, a boundary — it should override locally and say so, because
depending on a shared constant means the test's meaning lives in another file and changing that
constant breaks tests that never mentioned a date.

**★ You inherited a test using `@MockBean Clock clock`. What do you change, and why twice?**
Twice, because there are two separate problems. The name is the first: `@MockBean` was removed in
Boot 4, so on this stack it must become `@MockitoBean` from
`org.springframework.test.context.bean.override.mockito` — that is a mechanical rename. The
second is the real one: it should not be a mock at all. Replace it with `@TestBean` and a static
factory returning `Clock.fixed(...)`, which removes the null-returning stub, removes the
possibility of the annotation inventing a bean the application never declared, and lets you
delete whatever `when(clock.instant())` stubbing was holding the old test together.

{/* FOOTER */}
