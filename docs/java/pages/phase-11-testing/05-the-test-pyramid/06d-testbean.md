---
title: "@TestBean is the override nobody uses and most teams should — it swaps in an object you wrote rather than a mock you configure, which turns per-test stubbing into a shared, reviewable, compilable test double that the context cache can actually amortise"
sidebar_label: "06d · @TestBean"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Bean Overriding in Tests* and *Testing → Annotations → `@TestBean`*
> ([annotation-testbean](https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-testbean.html));
> the factory-method rules and the cross-class `#` syntax are read from that reference.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> **No sandbox** — Java source only.

**The third override, from `org.springframework.test.context.bean.override.convention`. It is
convention-based rather than Mockito-based: instead of generating a mock, it calls a **static
factory method you wrote** and puts the result in the context. It is the least-used of the three
and the one that most often should have been used, because a hand-written double is a thing you
can name, test, share and compile against — and a mock is a thing you re-configure in every class
that needs it.**

## The mechanism

```java
@SpringBootTest
class OrderFlowTest {

    @TestBean ExchangeRates exchangeRates;                 // ← overridden

    static ExchangeRates exchangeRates() {                 // ← the factory, by convention
        return new FixedExchangeRates(Map.of("USD", 0.79));
    }
}
```

The rules for the factory method:

- it must be **`static`**
- it must take **no arguments**
- its return type must be **compatible with the field's type**
- by default it is **named after the field** — field `exchangeRates`, method `exchangeRates()`

The strategy is **`REPLACE_OR_CREATE`**, the same as `@MockitoBean` — so it carries the same
caveat: it will create a bean if none matched, and a typo produces a passing test against an
object your application never uses.

## Naming the method explicitly

```java
@TestBean(methodName = "fixedRates") ExchangeRates exchangeRates;

static ExchangeRates fixedRates() { ... }
```

And — the genuinely useful form — **pointing at a method in another class entirely**, with a `#`
separator and a fully-qualified class name:

```java
@TestBean(methodName = "org.example.testing.TestDoubles#fixedExchangeRates")
ExchangeRates exchangeRates;
```

🔴 **This is the feature that makes `@TestBean` worth knowing.** One `TestDoubles` class holds
your project's test doubles, every test class points at the same factory method, and the double
itself is ordinary reviewable Java. Compare with the mock equivalent, where the same stubbing is
retyped in every test class that needs it and drifts silently as the real implementation changes.

## Why you would choose it over `@MockitoBean`

**1 · The double is real code.** It compiles against the interface, so when the interface changes,
the double fails to compile — loudly, at build time. A mock does not: `given(rates.for("USD"))`
just stops matching, and the test either fails obscurely or passes for the wrong reason.

**2 · It has behaviour, not answers.** An in-memory `ExchangeRates` that actually converts is
usable by twenty tests without configuration. A mock has to be told what to return in each one,
so twenty tests carry twenty stubbing blocks that all encode the same assumption.

**3 · It can be tested itself.** A double you wrote can have a contract test proving it behaves
like the real thing. That technique is exactly topic 04's
[12b · What a fake costs](../04-mockito/12b-what-a-fake-costs.md), and it is what stops a double
drifting into fiction.

**4 · One shared factory means one cache key.** This is the quiet one. Twenty classes each with
their own `@MockitoBean` field produce distinct cache keys and, potentially, many contexts
([06b](06b-overriding-changes-the-cache-key.md)). Twenty classes pointing at the *same*
cross-class factory method with the same field name produce the same key, and share one context.

## Why you would not

- **A one-off error path.** `doThrow(...)` on a mock is one line; a hand-written double that can
  be told to fail is a class. For a single test asserting a fallback, the mock is right.
- **You need to verify an interaction.** `@TestBean` gives you a plain object with no recording.
  If the assertion is "we called it exactly once with these arguments", that is `@MockitoBean` or
  `@MockitoSpyBean` — or, better, an assertion on the observable outcome instead.
- **The collaborator is trivial and the test is one of a kind.** Not everything deserves a double.

## The honest summary

`@MockitoBean` is right for *"this collaborator should not run here"*. `@TestBean` is right for
*"this collaborator should behave predictably here, and in twenty other places, in a way somebody
can read"*. Most codebases have a handful of collaborators in the second category — a clock, a
rates table, an ID generator, a feature-flag source — and mock them per class anyway, which is
how a suite ends up with forty stubbing blocks encoding one decision.

Fixing a clock is the canonical example, and it is the same argument
[topic 01 · 14b](../01-junit-5/14b-time-and-determinism.md) makes about determinism from the
JUnit side: injecting a fixed `Clock` beats stubbing `Instant.now()` in every test.

## Gotchas and pitfalls

**★ A non-`static` factory method.**
The method must be `static`. An instance method cannot be called before the context is built.

**★ A factory method that takes arguments.**
Not supported — no arguments. If the double needs configuration, build it inside the method.

**★ Relying on the naming convention and then renaming the field.**
The default factory-method name *is* the field name. Rename the field and the convention silently
stops matching. `methodName` makes the link explicit and survives renames.

**★ Forgetting `REPLACE_OR_CREATE` applies here too.**
`@TestBean` will create a bean if none matched, so a wrong type or a slice that never had the bean
gives you a passing test against something the application does not consult.

**★ Expecting to `verify()` a `@TestBean`.**
It is a plain object. There is no Mockito recording. If you need interaction verification, use a
spy or a mock — or restructure so the outcome is observable.

**★ Writing a fresh double in every test class.**
That gives up the two best properties — one shared, reviewable implementation, and one shared
context cache key. Put it in a `TestDoubles` class and point at it with the `#` syntax.

**★ Letting a hand-written double drift from the real implementation.**
This is the standing risk with fakes and it has a standing answer: run one shared contract test
suite against both. [12b · What a fake costs](../04-mockito/12b-what-a-fake-costs.md).

## Interview questions

**★ What is `@TestBean` and how does it differ from `@MockitoBean`?**
It is a convention-based bean override: instead of generating a Mockito mock, it calls a static,
no-argument factory method you wrote and registers the result as the bean. Same
`REPLACE_OR_CREATE` strategy, entirely different philosophy — a real object with real behaviour
rather than a mock configured per test.

**★ What are the rules for the factory method?**
Static, no arguments, a return type compatible with the annotated field, and by default named
after the field. `methodName` overrides the name, and it accepts a fully-qualified
`com.example.Class#method` form to point at a method in a different class.

**★ Why would you prefer a `@TestBean` to a mock?**
Because the double is compiled code: it fails to build when the interface changes, where a mock
just stops matching. Because it has behaviour, so many tests can use it with no per-test
configuration. Because it can itself be contract-tested against the real implementation. And
because one shared factory produces one cache key, where per-class mocks fragment the context
cache.

**★ When is a mock still the right choice?**
For a one-off error path — `doThrow` is one line against a class you would otherwise write — and
whenever the assertion is about an *interaction* rather than a result, since a `@TestBean` is a
plain object with no recording.

**★ What is the risk of a hand-written double, and what is the standard mitigation?**
Drift: the double keeps behaving the way the real thing used to. The mitigation is a shared
abstract contract test run against both the real implementation and the double, so the double
cannot silently diverge.

**★ Does `@TestBean` avoid the context-cache cost of an override?**
Not by itself — it is still a `contextCustomizer` and still part of the key. What it avoids is
*fragmentation*: many test classes pointing at the same cross-class factory with the same field
name produce the same key and share one context, where per-class mocks with differing fields
produce many.

{/* FOOTER */}
