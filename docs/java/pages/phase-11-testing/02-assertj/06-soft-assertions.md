---
title: "Soft assertions collect every failure instead of stopping at the first, and the price is a stateful object with one fatal failure mode — forget assertAll and the test passes no matter how many assertions inside it failed"
sidebar_label: "06 · Soft assertions"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the `assertj-core` **3.27.7** sources on GitHub
> (tag `assertj-build-3.27.7`) — the class javadoc of
> [`SoftAssertions`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/SoftAssertions.java)
> and
> [`AutoCloseableSoftAssertions`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/AutoCloseableSoftAssertions.java),
> and the `assertSoftly` / `assertAll` / `assertAlso` declarations on
> `SoftAssertionsProvider`; plus the AssertJ Core documentation
> ([assertj.github.io/doc](https://assertj.github.io/doc/)).
> JDK 25 · Spring Boot 4.1.0 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**A test that stops at its first failed assertion tells you one thing about a run that may
have gone wrong in five ways. Soft assertions collect them all and report them together —
the same argument JUnit's own `assertAll` makes
([04b · assertAll](../01-junit-5/04b-assertall.md)), with a fluent API instead of a list of
lambdas. The mechanism is proxying, and the proxy is exactly why the feature has a failure
mode nothing else in AssertJ has: an assertion that fails silently.**

## The argument, in the library's own words

The `SoftAssertions` javadoc makes the case with a murder mystery, and it is worth reading
because it is the actual justification:

```java
@Test
public void host_dinner_party_where_nobody_dies() {
  Mansion mansion = new Mansion();
  mansion.hostPotentiallyMurderousDinnerParty();
  assertThat(mansion.guests()).as("Living Guests").isEqualTo(7);
  assertThat(mansion.kitchen()).as("Kitchen").isEqualTo("clean");
  assertThat(mansion.library()).as("Library").isEqualTo("clean");
  assertThat(mansion.revolverAmmo()).as("Revolver Ammo").isEqualTo(6);
  assertThat(mansion.candlestick()).as("Candlestick").isEqualTo("pristine");
  assertThat(mansion.colonel()).as("Colonel").isEqualTo("well kempt");
  assertThat(mansion.professor()).as("Professor").isEqualTo("well kempt");
}
```

> *"Oh no! A guest has been murdered! But where, how, and by whom?"*
>
> *"Unfortunately frameworks like JUnit halt the test upon the first failed assertion.
> Therefore, to collect more evidence, we'll have to rerun the test (perhaps after attaching
> a debugger or modifying the test to skip past the first assertion). Given that hosting
> dinner parties takes a long time, this seems rather inefficient."*

That last clause is the real criterion. **Soft assertions are worth it in proportion to how
expensive the arrange-and-act was.** A pure unit test that fails, gets fixed and re-runs in
two milliseconds does not need them. A `@SpringBootTest` that starts a context, or a
Testcontainers test that starts PostgreSQL, absolutely does — every rerun costs seconds and
you would rather learn all four problems at once.

## The explicit form

```java
SoftAssertions softly = new SoftAssertions();
softly.assertThat(mansion.guests()).as("Living Guests").isEqualTo(7);
softly.assertThat(mansion.kitchen()).as("Kitchen").isEqualTo("clean");
softly.assertThat(mansion.library()).as("Library").isEqualTo("clean");
softly.assertThat(mansion.candlestick()).as("Candlestick").isEqualTo("pristine");
softly.assertThat(mansion.professor()).as("Professor").isEqualTo("well kempt");
softly.assertAll();
```

and the report the javadoc documents this producing:

```
org.assertj.core.api.SoftAssertionError: The following 4 assertions failed:
1) [Living Guests] expected:<[7]> but was:<[6]>
2) [Library] expected:<'[clean]'> but was:<'[messy]'>
3) [Candlestick] expected:<'[pristine]'> but was:<'[bent]'>
4) [Professor] expected:<'[well kempt]'> but was:<'[bloodied and disheveled]'>
```

Four failures, one run. The `as(...)` descriptions are what make the list readable, and the
javadoc says so directly:

> *"It is recommended to use `AbstractAssert#as(String, Object...)` so that the multiple
> failed assertions can be easily distinguished from one another."*

Without them you get four "expected 7 but was 6" lines and no idea which is which. With
soft assertions, `as(...)` stops being decoration and becomes structural — see
[09 · describedAs and failure messages](09-describedas-and-messages.md).

⚠️ On the thrown type: `assertSoftly`'s declaration documents
`@throws MultipleFailuresError if possible or SoftAssertionError if any proxied assertion
objects threw an AssertionError`. So on a modern setup with opentest4j on the classpath —
which is any JUnit 5 or 6 project — you get `MultipleFailuresError`, the same type
`assertAll` produces, and IDEs render it as a list. `SoftAssertionError` is the fallback,
and it is the type the javadoc's older example prints.

## 🔴 Forget `assertAll()` and the test passes

This is the whole reason to read this page. From the javadoc:

> *"Note that because SoftAssertions is stateful you should use a new instance of
> SoftAssertions per test method. Also, if you forget to call `assertAll()` at the end of
> your test, the test **will pass** even if any assertion objects threw exceptions (because
> they're proxied, remember?). So don't forget."*

The emphasis is the library's own. `softly.assertThat(x).isEqualTo(y)` does not throw when
it fails — it records. A test with twenty soft assertions and no `assertAll()` is a test
that cannot fail, and it looks completely normal:

```java
@Test
void the_order_is_correct() {
  SoftAssertions softly = new SoftAssertions();
  softly.assertThat(order.total()).isEqualTo(new BigDecimal("42.00"));
  softly.assertThat(order.status()).isEqualTo(CONFIRMED);
  softly.assertThat(order.lines()).hasSize(3);
  // ← no assertAll(). Green forever.
}
```

It is the same family of defect as
[02b · Assertions that assert nothing](02b-assertions-that-assert-nothing.md), and it is the
worst member of that family, because here the assertions are real, correct, and *executed* —
only their results are discarded.

**The conclusion the rest of this topic follows: do not write the explicit form.** Use one of
the three shapes below, all of which call `assertAll()` for you.

## Three ways to not forget

### `assertSoftly` — a lambda

> *"You can also use the static method assertSoftly. the assertAll method will be called
> automatically after the lambda function completes."*

```java
SoftAssertions.assertSoftly(softly -> {
  softly.assertThat(mansion.guests()).as("Living Guests").isEqualTo(7);
  softly.assertThat(mansion.kitchen()).as("Kitchen").isEqualTo("clean");
  softly.assertThat(mansion.library()).as("Library").isEqualTo("clean");
  softly.assertThat(mansion.candlestick()).as("Candlestick").isEqualTo("pristine");
  softly.assertThat(mansion.professor()).as("Professor").isEqualTo("well kempt");
});
```

The braces make the scope visible and the `assertAll()` cannot be omitted, because it is not
yours to write. **This is the form to reach for when you are not using the extension.**

### `AutoCloseableSoftAssertions` — try-with-resources

> *"A version of `SoftAssertions` that uses try-with-resources statement to automatically
> call `SoftAssertions#assertAll()` so that you don't forget to."*

```java
try (AutoCloseableSoftAssertions softly = new AutoCloseableSoftAssertions()) {
  softly.assertThat(mansion.guests()).as("Living Guests").isEqualTo(7);
  softly.assertThat(mansion.kitchen()).as("Kitchen").isEqualTo("clean");
}
```

Same guarantee, different syntax. It reads oddly — a try-with-resources whose resource is
not a resource — and the lambda form usually reads better. Worth knowing because you will
meet it in existing code.

### The JUnit Jupiter extension

The best of the three when you have more than one test doing this, and the subject of
[06c · The soft-assertions extension](06c-soft-assertions-extension.md).

Composing several soft-assertion instances with `assertAlso`, and the cases where soft
assertions are the wrong answer, are in
[06b · Composing and misusing soft assertions](06b-composing-soft-assertions.md).

## Gotchas

**★ 🔴 Forgetting `assertAll()` makes the test unfailable.**
The library's own javadoc says the test *"will pass"*. Every soft assertion is proxied and
records rather than throws. This is the single most dangerous thing in this topic, and the
reason to use `assertSoftly`, `AutoCloseableSoftAssertions` or the extension rather than the
raw `new SoftAssertions()`.

**★ Reusing one `SoftAssertions` instance across test methods.**
It is stateful, and the javadoc says to use a new instance per test method. A field
initialised once and shared accumulates failures across tests, and the test that finally
calls `assertAll()` reports another test's failures as its own.

**★ Soft assertions without `as(...)` descriptions.**
Four indistinguishable "expected 7 but was 6" lines. The javadoc explicitly recommends
`as(...)` for exactly this reason. Descriptions are optional in ordinary assertions and
close to mandatory in soft ones.

**★ A soft assertion that must not run when a previous one failed.**
Soft assertions do not short-circuit. `softly.assertThat(order).isNotNull()` followed by
`softly.assertThat(order.total())` throws a real `NullPointerException` on the second line,
which aborts the test and hides the collected failures. Hard-assert preconditions first.

**★ Mixing `assertThat` and `softly.assertThat` in the same block.**
A static-import `assertThat` inside a soft block throws immediately and abandons everything
collected so far. It is a one-character difference and it is easy to reintroduce during an
edit.

**★ Navigating from a soft assertion.**
Chained navigation — `extracting`, `first()`, `cause()` — returns a proxied assert too, so
the chain works, but a failure mid-chain means the rest of the chain runs against whatever
the proxy returned. Prefer flat soft assertions over deep chains inside a soft block.

## Interview questions

**★ What happens if you forget to call `assertAll()`?**
The test passes, regardless of how many soft assertions failed. Soft assertions are proxies
that record failures instead of throwing, so with nothing to drain the recorded failures they
are simply discarded. The javadoc states it in bold. It is the reason the raw
`new SoftAssertions()` form should not be written by hand.

**★ Which form would you use, and why?**
`SoftAssertions.assertSoftly(softly -> { ... })` when the class has one or two such tests,
because the `assertAll()` is not mine to forget and the lambda's braces make the scope
obvious. `SoftAssertionsExtension` with `@InjectSoftAssertions` once several tests in the
class need it, because it removes the boilerplate entirely.

**★ Can you share a `SoftAssertions` instance between test methods?**
No. It is stateful and the javadoc says to use a new instance per test method. A shared
instance accumulates failures across tests, so whichever test drains it reports failures
that belong to another test — and under a per-method lifecycle a field is fresh anyway,
which quietly hides the mistake until someone adds `@TestInstance(PER_CLASS)`.

**★ Why are `as(...)` descriptions more important with soft assertions than without?**
Because the report is a numbered list of failures with no source lines to distinguish them.
The javadoc recommends `as(...)` explicitly for this. In an ordinary assertion the stack
trace tells you which line failed; in a soft report you have only what the description says.

{/* FOOTER */}
