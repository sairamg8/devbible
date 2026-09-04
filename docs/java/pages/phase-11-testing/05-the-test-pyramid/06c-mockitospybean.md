---
title: "@MockitoSpyBean is the only override that keeps your real bean — it wraps rather than replaces — which makes it the honest choice when you want to observe a collaborator without faking it, and the dishonest one when it is being used to avoid admitting the test does not know what it is asserting"
sidebar_label: "06c · @MockitoSpyBean"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Bean Overriding in Tests*
> ([bean-overriding](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/bean-overriding.html))
> and *Testing → Annotations → `@MockitoSpyBean`*
> ([annotation-mockitobean](https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-mockitobean.html)),
> with spy semantics cross-checked against Mockito 5.23.0.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, Mockito 5.23.0.
> **No sandbox** — Java source only.

**Of the three bean overrides, this is the only one that keeps your application's real object.
`@MockitoBean` throws your bean away and puts a mock in its place; `@TestBean` swaps in something
you built; `@MockitoSpyBean` takes the bean the container created and **wraps** it. Everything
distinctive about it — what it can do, what it refuses to do, and why it fails differently from
its siblings — follows from that one word.**

## `WRAP`, and what it forbids

From the strategy table in [06](06-bean-overriding.md):

> `WRAP` — *"Retrieves the original bean and wraps it."*

Contrast `@MockitoBean`'s `REPLACE_OR_CREATE`, which will invent a bean when none matched. `WRAP`
has nothing to wrap unless a bean exists, so:

🔴 **`@MockitoSpyBean` requires exactly one candidate bean and throws when there is not one.**

That is a *feature*, and it is the reason a spy bean is in some ways safer than a mock bean: the
failure mode where you override a bean that does not exist, and the test passes anyway against a
mock the application never consults ([06](06-bean-overriding.md)), simply cannot happen here.

## What it is for

```java
@SpringBootTest
class OrderFlowTest {

    @MockitoSpyBean NotificationSender notificationSender;   // the REAL sender, wrapped

    @Autowired OrderService orders;

    @Test
    void notifiesTheCustomerOnce() {
        orders.place(anOrder());

        verify(notificationSender).send(argThat(msg -> msg.recipient().equals("a@b.com")));
    }
}
```

Nothing is faked. The real `NotificationSender` runs, doing whatever it really does; the spy
merely records that it was called and with what. That is the honest use: **you want the real
behaviour and you also want to assert on an interaction** — a call that has no observable return
value, a side effect at the edge of the system, a "did we actually publish that event" question.

The second legitimate use is **stubbing exactly one method of an otherwise real bean**, usually to
force an error path that is hard to provoke:

```java
@MockitoSpyBean PricingService pricing;

@Test
void fallsBackWhenPricingFails() {
    doThrow(new PricingUnavailable()).when(pricing).quote(any());

    assertThat(orders.place(anOrder()).total()).isEqualTo(FALLBACK_TOTAL);
}
```

## 🔴 `doReturn`, never `when`, on a spy

This is Mockito semantics rather than Spring's, and it is the single most common spy bug:

```java
when(pricing.quote(order)).thenReturn(TEN);   // ❌ CALLS THE REAL quote() while stubbing
doReturn(TEN).when(pricing).quote(order);     // ✅ never calls the real method
```

`when(spy.method())` has to *evaluate* `spy.method()` to hand Mockito a value, and on a spy the
real method runs — with whatever side effects, exceptions or database writes it has. The
`doReturn(...).when(spy)` form never invokes it. Topic 04 argues this in full at
[08d · Stubbing a spy](../04-mockito/08d-stubbing-a-spy.md).

## What it cannot do

🔴 **It cannot spy a scoped proxy.** A bean declared
`@Scope(proxyMode = ScopedProxyMode.TARGET_CLASS)` cannot be wrapped by `@MockitoSpyBean`; the
attempt throws. The scoped proxy is itself an indirection whose whole job is to resolve a
different target per scope, and wrapping it would mean wrapping the indirection rather than the
bean.

**It converts a non-singleton to a singleton**, as every bean override does. So spying a
prototype bean gives you one instance for the whole context, and per-instance behaviour is no
longer observable.

**Its own `WRAP` behaviour interacts with AOP differently from the other two**, and in a way that
produces one genuinely nasty bug involving `@Cacheable`. That is
[06e · Overrides and AOP proxies](06e-overrides-and-aop-proxies.md), and it is worth reading
before you spy any bean that carries `@Transactional`, `@Cacheable` or `@Retryable`.

## Resetting, and the cache

Both inherited from the general mechanism ([06](06-bean-overriding.md)):

- **`reset` defaults to `MockReset.AFTER`** — the spy's recorded interactions and any stubbing are
  cleared after each test method. You do not need `Mockito.reset()` and you do not need
  `@DirtiesContext`.
- **The override is part of the context cache key** — a class with a `@MockitoSpyBean` gets its own
  `ApplicationContext`, and the field name participates. Same cost, same fix, as
  [06b](06b-overriding-changes-the-cache-key.md).

## When it is the wrong tool

A spy bean is often reached for when the real question is "what is this test about?".

- **Spying to assert on an internal method call** is testing your own implementation. Rename the
  method and a passing test goes red without any behaviour changing. Topic 04's
  [10 · Never mock the class under test](../04-mockito/10-never-mock-the-class-under-test.md)
  makes the general argument; a spy on a collaborator you own is the same mistake at one remove.
- **Spying to stub out slowness** means the collaborator does not belong in this test. That is a
  `@MockitoBean`, or a slice that excludes it, or a different level entirely
  ([10 · Choosing a level](10-choosing-a-level.md)).
- **Spying because you are not sure the real thing works** is two tests wearing one coat. Test the
  collaborator directly, then mock it here.

The honest test for whether a spy is right: **would the assertion still make sense if the real
method ran?** If yes, spy. If you need to stop it running, you wanted a mock.

## Gotchas and pitfalls

**★ `when(spy.foo())` on a spy bean.**
The real `foo()` executes during stub setup — sending the real email, writing the real row. Use
`doReturn(...).when(spy).foo()`.

**★ Expecting `@MockitoSpyBean` to create a bean that is missing.**
It cannot. `WRAP` needs exactly one existing candidate and throws otherwise. This is stricter than
`@MockitoBean` and it is the better default for that reason.

**★ Spying a `@Scope(proxyMode = TARGET_CLASS)` bean.**
Throws. The scoped proxy is an indirection, not the bean.

**★ Spying a bean and then wondering why `@Cacheable` behaves strangely.**
The interaction between overrides and AOP proxies is real and specific. Read
[06e](06e-overrides-and-aop-proxies.md) before debugging it.

**★ Calling `Mockito.reset(spy)` in an `@AfterEach`.**
Redundant — `MockReset.AFTER` is the default. Harmless, but it suggests whoever wrote it did not
know what the annotation guarantees, which is worth correcting in review.

**★ Adding a spy bean and losing the shared context.**
It is a cache-key component like any other override. One spy, one new application context.

**★ Using a spy to verify an interaction you could have asserted on directly.**
If the operation has an observable outcome — a returned value, a stored row, an emitted event you
can read — assert on the outcome. Verification of a call is a weaker claim than an assertion on a
result, and it couples the test to the shape of the call.

**★ Spying a prototype-scoped bean and expecting per-instance behaviour.**
Any override makes it a singleton for the context.

## Interview questions

**★ What is the difference between `@MockitoBean` and `@MockitoSpyBean`?**
Strategy. `@MockitoBean` uses `REPLACE_OR_CREATE` — your bean is discarded and a Mockito mock takes
its place, and one is created if no bean matched. `@MockitoSpyBean` uses `WRAP` — the container's
real bean is retrieved and wrapped, so real methods run unless you stub them, and there must be
exactly one candidate or it throws.

**★ Why is `@MockitoSpyBean` in one respect safer than `@MockitoBean`?**
Because `WRAP` cannot invent a bean. `@MockitoBean`'s default `enforceOverride = false` will
silently create one when nothing matched, giving you a green test against a mock the application
never uses. A spy bean fails loudly instead.

**★ Why must you use `doReturn` rather than `when` to stub a spy?**
`when(spy.method())` evaluates `spy.method()` in order to pass its result to `when`, and on a spy
that invokes the real method — with all its side effects — before any stubbing is registered.
`doReturn(value).when(spy).method()` routes around the real invocation entirely.

**★ Can you spy on a scoped proxy?**
No. A bean with `@Scope(proxyMode = ScopedProxyMode.TARGET_CLASS)` cannot be wrapped by
`@MockitoSpyBean` and the attempt throws, because the scoped proxy is an indirection that resolves
a per-scope target rather than being the bean itself.

**★ When is a spy bean the right choice rather than a mock?**
When you want the real behaviour *and* an assertion about an interaction — typically a side effect
with no observable return, like a notification being sent or an event published. Or when you need
to force a single method into an error path that is otherwise hard to provoke. The test: would the
assertion still make sense if the real method ran? If not, you wanted a mock.

**★ Do you need to reset a spy bean between tests?**
No. `reset` defaults to `MockReset.AFTER`, so recorded interactions and stubbing are cleared after
every test method.

**★ Does a spy bean affect the context cache?**
Yes, exactly as any other bean override does — it is a `contextCustomizer` and therefore part of
the cache key, including the field name as a fallback qualifier. A class with a spy bean gets its
own `ApplicationContext`.

{/* FOOTER */}
