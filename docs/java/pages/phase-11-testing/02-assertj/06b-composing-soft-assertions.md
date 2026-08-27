---
title: "assertAlso lets a helper method contribute its failures to the caller's single report, and the same feature makes it possible to leave an instance undrained — which discards its failures exactly as forgetting assertAll does"
sidebar_label: "06b · Composing and misusing soft assertions"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the `assertj-core` **3.27.7** sources on GitHub
> (tag `assertj-build-3.27.7`) — the class javadoc of
> [`SoftAssertions`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/SoftAssertions.java)
> and the `assertAlso` / `assertAll` / `assertSoftly` declarations on
> `SoftAssertionsProvider`.
> JDK 25 · Spring Boot 4.1.0 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**[06](06-soft-assertions.md) covered the mechanism and the one fatal mistake. This chunk is
the composition API — how a helper method contributes assertions to the caller's report
instead of throwing on its own — and the judgement call underneath the whole feature, which
is that soft assertions make it comfortable to write a test that is really several tests.**

## Composing: `assertAlso`

> *"You can also compose several soft assertions together using the
> `SoftAssertionsProvider#assertAlso(AssertionErrorCollector)` method"*

```java
public SoftAssertions check_kitchen() {
  SoftAssertions softly = new SoftAssertions();
  softly.assertThat(mansion.kitchen()).as("Kitchen").isEqualTo("clean");
  return softly;
}

@Test
public void host_dinner_party_where_nobody_dies() {
  // ... assertions on softly ...
  SoftAssertions kitchen = check_kitchen();
  softly.assertAlso(kitchen);

  SoftAssertions library = check_library();
  softly.assertAlso(library);

  softly.assertAll();
}
```

This is how a helper method contributes assertions to the caller's report instead of
throwing on its own. It is genuinely useful for a shared "check the invariants of an order"
routine — and it is also a way to end up with three `SoftAssertions` instances in flight
and a reader who cannot tell which one the final `assertAll()` drains.

## When soft assertions are the wrong answer

- **When the assertions depend on each other.** `isNotNull()` followed by `hasSize(3)` is
  not a candidate: soft assertions run all of them, so the second will throw an
  actual `NullPointerException` rather than report a failure. Hard-assert the precondition,
  soft-assert the rest.
- **When the test is cheap to rerun.** The whole argument is about the cost of a second run.
  A pure unit test does not have that cost.
- **When there are five soft assertions about five unrelated behaviours.** That is five
  tests wearing a coat, and soft assertions make it comfortable enough to keep writing.
  Reporting all five failures at once is a smaller win than having five tests whose names
  say which behaviour broke.

## Gotchas

**★ `assertAlso` with several instances in flight.**
Three `SoftAssertions` objects and one `assertAll()` is easy to get wrong: an instance that
is never `assertAlso`'d and never drained silently discards its failures. Same failure mode
as forgetting `assertAll()`, one level less visible.

**★ Soft assertions in a loop.**
`for (Order o : orders) softly.assertThat(o.total()).isPositive();` reports every bad row,
which is a real benefit — and produces a hundred failures for a hundred bad rows. Add
`as("order %s", o.id())` or the report is unusable.

**★ Expecting a specific exception type.**
`assertSoftly` documents `MultipleFailuresError` *"if possible"* and `SoftAssertionError`
otherwise. A test or CI parser that keys on one of the two types is depending on which
libraries are on the classpath.

**★ Using soft assertions to avoid deciding what the test is about.**
The comfortable case: eleven soft assertions covering everything the method touched. The
test now fails for eleven reasons and its name can only describe one of them. Soft
assertions are for one behaviour with several observable facets, not for a survey.

## Interview questions

**★ When are soft assertions the wrong tool?**
When the assertions depend on each other — they do not short-circuit, so a null check
followed by a dereference throws a real exception and abandons the collected failures. When
the test is cheap to rerun, since the whole argument is about not paying for a second
expensive run. And when the block is really several tests, in which case the right fix is
several tests.

**★ What does `assertAlso` do?**
It merges another soft-assertion instance's collected failures into this one, so a helper
method can contribute assertions to the caller's single report rather than throwing on its
own. The risk is an instance that is never merged and never drained, whose failures are
discarded exactly as if `assertAll()` had been forgotten.

**★ How do soft assertions relate to JUnit's `assertAll`?**
Same goal, different ergonomics. `assertAll` takes executables and wraps their failures in a
`MultipleFailuresError`; soft assertions proxy the fluent API so the assertions read
normally. AssertJ's `assertSoftly` reports as `MultipleFailuresError` too where the classpath
allows. The practical difference is that `assertAll` cannot be forgotten — it is the call
that runs the assertions — while `assertAll()` on a soft-assertions instance can be, and
that asymmetry is the whole hazard.

{/* FOOTER */}
