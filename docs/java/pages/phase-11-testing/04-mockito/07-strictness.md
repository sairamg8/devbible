---
title: "STRICT_STUBS is not a linting preference — it is Mockito reporting that a stub nobody used is a claim about the code that has quietly stopped being true, and the two exceptions it throws answer two completely different questions about how your test has drifted"
sidebar_label: "07 · Strictness"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> §40 (*"stricter Mockito"*) and §46 (`Mockito.lenient()`), the
> [`Strictness`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/quality/Strictness.java)
> and [`Mock`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mock.java)
> javadoc, and the bodies of `StrictnessSelector`, `DefaultStubbingLookupListener`,
> `UniversalTestListener` and `Reporter` in `mockito-core/src/main/java/org/mockito/internal/`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — every exception string on this
> page is assembled from `Reporter`'s own source, never from a console.

**A stub is a claim: "when the code under test asks this collaborator for X, it gets Y." If the
test passes and nothing ever asked, one of two things is true — the claim was always wrong, or
the code changed and nobody told the test. `STRICT_STUBS` exists to make the difference between
those a build failure rather than an archaeology exercise. It is the default for
`MockitoExtension`, which is why adding the extension to an old class can turn a green suite
red. This chunk is how strictness is configured and what it throws;
[07b · Living with strict stubs](07b-living-with-strict-stubs.md) is the two cases where it
deliberately says nothing, and the `@BeforeEach` stub that sends most teams reaching for the
wrong lever.**

## The default is set in a constructor, not a config file

```java
public MockitoExtension() {
    this(Strictness.STRICT_STUBS);
}
```

That is the whole mechanism. Writing `@ExtendWith(MockitoExtension.class)` opts you into strict
stubbing, which is why adding the extension to an old test class can turn a green suite red
without a single line of production code changing. **The extension changes your tests'
behaviour, not just their boilerplate** — [02 · Creating mocks](02-creating-mocks.md) makes the
same point about how you get a mock at all.

## 🔴 There are two `Strictness` enums and they do not have the same values

This is the detail that makes half the blog posts on the subject subtly wrong.

| Type | Values |
|---|---|
| `org.mockito.quality.Strictness` | `LENIENT`, `WARN`, `STRICT_STUBS` — **three** |
| `org.mockito.Mock.Strictness` (nested in the annotation) | `TEST_LEVEL_DEFAULT`, `LENIENT`, `WARN`, `STRICT_STUBS` — **four** |

The nested one exists only for `@Mock(strictness = …)`, added in 4.6.1, and its extra value
`TEST_LEVEL_DEFAULT` means *"do not override the test-level setting"* — it is the "inherit"
option, not a fourth degree of strictness. If you are counting degrees of strictness, there are
three. If you are reading the `@Mock` attribute, there are four. They are different types and
they are not interchangeable.

What the three degrees actually do:

- **`LENIENT`** — no stubbing checks at all. Unused stubs pass, argument mismatches pass.
- **`WARN`** — mismatches and unused stubs are printed to the console and nothing fails.
  Useful for exactly one thing: taking a legacy suite's temperature before you commit to
  fixing it.
- **`STRICT_STUBS`** — unused stubs fail the class, argument mismatches fail immediately.

## Where strictness is resolved, in order

From `StrictnessSelector`'s own javadoc:

> *"1st — strictness configured when declaring stubbing; 2nd — strictness configured at mock
> level; 3rd — strictness configured at test level (rule, mockito session)"*

So the narrowest declaration wins, which is what you want: one lenient stub does not make the
class lenient, and one lenient mock does not make the suite lenient.

```java
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)   // 3rd — test level
class OrderServiceTest {

    @Mock(strictness = Mock.Strictness.STRICT_STUBS) // 2nd — mock level, overrides the above
    private PricingGateway pricing;

    @Test
    void appliesTheDiscount() {
        lenient().when(pricing.rateFor(GOLD)).thenReturn(RATE);  // 1st — stubbing level, wins
    }
}
```

⚠️ **`@MockitoSettings` is found by walking *up* the `ExtensionContext` chain**, so a setting on
an outer class reaches every `@Nested` class inside it. That is convenient and it is also how a
`LENIENT` setting someone added to an enclosing class three years ago silently disarms a nested
class written last week — see [06c · Nesting: lifecycle and
limits](../01-junit-5/06c-nesting-lifecycle-and-limits.md) for the same inheritance shape on the
JUnit side.

And note that `MockitoSettings.strictness()` **itself defaults to `STRICT_STUBS`**. A bare
`@MockitoSettings` with no attribute changes nothing at all. It looks like a knob being turned;
it is a no-op.

## 🔴 `lenient()` on a setting is deprecated — use `strictness(…)`

At 5.23.0 both of these are `@Deprecated`:

```java
mock(Foo.class, withSettings().lenient());   // deprecated
@Mock(lenient = true) Foo foo;               // deprecated
```

The replacements are `withSettings().strictness(Strictness.LENIENT)` and
`@Mock(strictness = Mock.Strictness.LENIENT)`. **Most material you will find online still
teaches the deprecated form**, because it predates 4.6.1. The static `Mockito.lenient()` used at
the stubbing site — `lenient().when(...)` — is *not* deprecated and remains the right tool for
a single stub.

## The two exceptions answer two different questions

`STRICT_STUBS` throws two things, and conflating them is the reason people describe strict
stubbing as noisy.

### `PotentialStubbingProblem` — thrown *during* the test

"You stubbed this method with these arguments, and the code just called it with different ones."
It fires at the moment of the call, so the stack trace points at the production line that made
the call. This is a genuine early-failure feature: without it, the call returns the unstubbed
default ([03e · Unstubbed defaults](03e-unstubbed-defaults.md)) and you debug a `null` three
frames later.

### `UnnecessaryStubbingException` — thrown *after* the class

"These stubs were never matched by anything." It is a report about the whole test class, which
is why the message lists locations rather than pointing at one line.

## Gotchas

**★ Adding `@ExtendWith(MockitoExtension.class)` to an old test class turns it red.**
The no-arg constructor sets `STRICT_STUBS`. Nothing in production changed; the extension simply
started enforcing claims the tests were already making. Fix the stubs rather than reaching for
`LENIENT` — the failures are a free audit you only get once.

**★ Writing a bare `@MockitoSettings` and expecting it to loosen something.**
`MockitoSettings.strictness()` already defaults to `STRICT_STUBS`, so the annotation with no
attribute is a no-op that reads like a configuration change.

**★ Putting `@MockitoSettings(strictness = LENIENT)` on an outer class.**
It is found by walking up the `ExtensionContext` chain, so every `@Nested` class inside inherits
it — including ones written years later by people who never saw the annotation.

**★ Using `@Mock(lenient = true)` or `withSettings().lenient()`.**
Both are `@Deprecated` at 5.23.0 in favour of the `strictness(…)` forms. Compiles, works, and
will be the first thing flagged in review by anyone who has read the changelog.

**★ Confusing `org.mockito.quality.Strictness` with `Mock.Strictness`.**
Four values in one, three in the other, and `TEST_LEVEL_DEFAULT` exists only in the nested enum.
An import of the wrong one does not compile, which is the good case; quoting the wrong list in a
design document is the bad one.

**★ Using `WARN` as a permanent setting.**
It prints and never fails, so in a CI log nobody reads it is indistinguishable from `LENIENT`.
It is a migration tool with a deadline, not a policy.

## Interview questions

**★ What is `MockitoExtension`'s default strictness, and where is it set?**
`STRICT_STUBS`, in the extension's own no-argument constructor:
`public MockitoExtension() { this(Strictness.STRICT_STUBS); }`. It is not read from a properties
file or a system property, which is why adding the extension is itself a behavioural change.

**★ Name the values of `Strictness`.**
`LENIENT`, `WARN`, `STRICT_STUBS` — three, in `org.mockito.quality`. If the question means the
`@Mock` attribute, that is the nested `Mock.Strictness` with a fourth value,
`TEST_LEVEL_DEFAULT`, meaning "inherit the test-level setting" rather than a degree of its own.

**★ What is the difference between `PotentialStubbingProblem` and `UnnecessaryStubbingException`?**
The first fires **during** the test, when the code calls a stubbed method with arguments no
stubbing matches — its stack trace points at the production call site. The second fires **after
the class**, listing stubbings nothing ever matched. One is "you called it differently than you
said"; the other is "you said something nobody asked about".

**★ Is `WARN` a reasonable setting for a large legacy suite?**
As a migration step with a date on it, yes — it surfaces the scale of the problem without
blocking anyone. As a permanent setting, no: it never fails a build, so in a CI log nobody reads
it is operationally identical to `LENIENT`, with the added cost of noise.

**★ Why is `@Mock(lenient = true)` a review comment now?**
It is `@Deprecated` at 5.23.0, superseded by `@Mock(strictness = Mock.Strictness.LENIENT)`. The
deprecated form still works, so nothing forces the change — which is exactly why it survives in
codebases and in tutorials.

{/* FOOTER */}
