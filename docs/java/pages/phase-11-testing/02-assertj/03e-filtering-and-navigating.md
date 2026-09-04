---
title: "Filtering narrows the collection under test before you assert on it, and the reason it is dangerous is that a filter which matches nothing leaves an empty list that satisfies almost every assertion you were about to make"
sidebar_label: "03e · Filtering"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — "Filtering elements of an
> Iterable or array" ([assertj.github.io/doc](https://assertj.github.io/doc/)) and the
> `Condition` section — and the `assertj-core` 3.27.7 API
> (`AbstractIterableAssert.filteredOn` overloads, `filteredOnNull`,
> `filteredOnAssertions`, `org.assertj.core.api.filter.Filters`,
> `org.assertj.core.api.Condition`).
> JDK 25 · Spring Boot 4.1.1 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**A collection assertion answers a question about a whole collection. Often the question you
actually have is about a *part* of it — the hobbits in the fellowship, the failed orders, the
rows for one customer. `filteredOn` narrows the collection and hands you an assert on the
result, which keeps the assertion honest about what it is checking. The trap is structural
and it catches everyone once: filtering to nothing produces an empty list, and an empty list
passes `doesNotContain`, `allSatisfy`, `allMatch`, `noneMatch` and `hasSizeLessThan`
cheerfully. The filter must itself be asserted.**

## Four ways to say which elements you mean

### By predicate

The form to reach for by default:

> *"You specify the filter condition using simple predicate, best expressed with a lambda."*

```java
assertThat(fellowshipOfTheRing).filteredOn(character -> character.getName().contains("o"))
                               .containsOnly(aragorn, frodo, legolas, boromir);
```

Compile-checked, refactor-safe, and it reads as the sentence you meant.

### By property or field name

> *"First you specify the property/field name to filter on and then its expected value."*

```java
assertThat(fellowshipOfTheRing).filteredOn("race", HOBBIT)
                               .containsOnly(sam, frodo, pippin, merry);
```

Nested paths work, resolved the same way `extracting` resolves them — see
[03d · Extracting by name](03d-extracting-by-name.md), and note that everything said there
about reflection, private fields and refactoring applies here unchanged:

```java
assertThat(fellowshipOfTheRing).filteredOn("race.name", "Man")
                               .containsOnly(aragorn, boromir);
```

There are operators for the name form, from `org.assertj.core.api.filter.Filters` —
`not`, `in`, `notIn`:

```java
assertThat(fellowshipOfTheRing).filteredOn("race", not(HOBBIT))
                               .containsOnly(gandalf, boromir, aragorn, gimli, legolas);
```

### By `Condition`

Two spellings of one thing:

> *"Filter the iterable/array under test keeping only elements matching the given
> `Condition`. Two methods are available: `being(Condition)` and `having(Condition)`. They
> do the same job - pick the one that makes your code more readable!"*

```java
Condition<Player> mvpStats = new Condition<Player>(player -> {
    return player.pointsPerGame() > 20 &&
           (player.assistsPerGame() >= 8 || player.reboundsPerGame() >= 8);
  }, "mvp");

// noah does not have more than 20 ppg
assertThat(players).filteredOn(mvpStats)
                   .containsOnly(rose, lebron);
```

The gain over a raw lambda is the **description** — `"mvp"` — which the failure message can
name. `being` and `having` are identical in behaviour; the choice is grammatical (`being`
an mvp, `having` mvp stats).

### By nested assertions

When the criterion is itself several assertions:

```java
assertThat(hobbits).filteredOnAssertions(hobbit -> assertThat(hobbit.age).isLessThan(34))
                   .containsOnly(frodo, pippin);
```

An element is kept when the assertions inside the consumer pass, and dropped when they
throw. That last clause is worth restating plainly: **inside `filteredOnAssertions`, a
failing assertion is not a test failure — it is a `false`.** This is the only place in
AssertJ where an assertion failure is swallowed by design, and it is why the method is
easy to misread.

### And the null case

```java
assertThat(hobbits).filteredOnNull("name")
                   .singleElement()
                   .isEqualTo(mysteriousHobbit);
```

`filteredOnNull(name)` keeps the elements whose named property or field is `null` — the
inverse of what `filteredOn("name", null)` would tempt you to write.

## 🔴 The empty-filter trap

This is the one thing on the page to remember:

```java
// the field is called "status", not "state" — the filter matches nothing
assertThat(orders).filteredOn("state", FAILED)
                  .allSatisfy(order -> assertThat(order.getRetries()).isZero());
```

Filtering to nothing gives an empty list, and `allSatisfy` on an empty list passes
vacuously. So do `allMatch`, `noneMatch`, `noneSatisfy`, `doesNotContain`,
`doesNotContainAnyElementsOf` and every `hasSizeLessThan`. The test is green and asserts
nothing whatever — the exact failure mode
[02b · Assertions that assert nothing](02b-assertions-that-assert-nothing.md) is about, made
easier to reach because the filter and the assertion are on the same line.

The fix is one extra assertion, and it costs nothing:

```java
assertThat(orders).filteredOn("state", FAILED)
                  .isNotEmpty()                       // or hasSize(3) — better still
                  .allSatisfy(order -> assertThat(order.getRetries()).isZero());
```

`hasSize(n)` beats `isNotEmpty()` because it pins the filter's result as well as its
non-emptiness — a filter that starts matching six rows instead of three is a real change and
you want to hear about it.

## Filtering versus the alternatives

Three ways to assert about a subset, and they are not equivalent:

| | What it asserts | What a mismatch tells you |
|---|---|---|
| `filteredOn(p).containsOnly(a, b)` | the matching elements are exactly `a` and `b` | which elements the filter produced, as a list |
| `contains(a, b)` | `a` and `b` are somewhere in the whole collection | that one was missing — nothing about the rest |
| `allSatisfy(...)` after filtering | every matching element satisfies the assertions | the first element that failed, and how |

Prefer `filteredOn(...).containsOnly(...)` when you know the exact subset, because it fails
both when something expected is absent **and** when something unexpected matched. `contains`
fails only on the first.

⚠️ Filtering does not change the source. `assertThat(list).filteredOn(...)` builds a new
`List` and asserts on that; `list` is untouched, and the original assert is not resumable
from the filtered one — the chain has moved.

Narrowing all the way down to **one** element — `first`, `last`, `element(i)`,
`singleElement` — and asserting element-by-element with `allSatisfy` / `anySatisfy` /
`noneSatisfy` is [03f · Navigating to elements](03f-navigating-to-elements.md).

## Gotchas

**★ A filter that matches nothing passes almost everything.**
The central trap. `allSatisfy`, `allMatch`, `noneMatch`, `noneSatisfy`, `doesNotContain` and
`hasSizeLessThan` are all vacuously true on an empty list. Always follow a filter with
`hasSize(n)` or at minimum `isNotEmpty()`.

**★ `filteredOn("name", value)` is reflective and invisible to a rename.**
Same three costs as `extracting("name")` — no compile-time check, private fields readable by
default, and the failure is an introspection error at runtime rather than a build break. The
predicate form has none of them.

**★ Inside `filteredOnAssertions`, a failing assertion means "exclude", not "fail".**
Assertions there are being used as a boolean. Someone reading the test quickly will assume a
failing `assertThat(hobbit.age).isLessThan(34)` fails the test; it silently drops the
element instead, and the surviving assertion may still pass.

**★ `filteredOnNull("name")` and `filteredOn("name", null)` are not the same thought.**
Use the dedicated method. Passing `null` as the expected value to the two-argument form
invites a resolution question you do not want to be relying on.

**★ A `Condition` without a good description degrades every failure message.**
The description string is the whole reason to use `Condition` over a lambda. `new
Condition<>(p -> ..., "condition")` throws away the benefit; name what the condition means.

**★ Chaining a second `filteredOn` narrows the already-narrowed list.**
Which is usually intended, and occasionally is not — the second filter's field names are
resolved against the element type, not the original collection, and a filter applied to an
empty result stays empty and silent.

**★ Filtering hides the size of the source collection from the failure message.**
Once you have filtered, the failure reports the filtered list. A test that fails because the
repository returned 0 rows and a test that fails because it returned 40 rows none of which
matched produce the same message. Assert the source's size separately when the source's size
is part of what you are testing.

**★ `filteredOn` on a `Stream` consumes it.**
Everything in
[03b · Element comparison and streams](03b-element-comparison-and-streams.md) about one-shot
sources applies: the stream is consumed to build the filtered list, and the original
`assertThat(stream)` cannot be reused.

**★ Filtering by an enum field with the name form compares with `equals`.**
Fine for enums. Not fine for a value type whose `equals` you have not checked — the same
question [02c · Equality vs identity](02c-equality-identity-and-comparators.md) raises, now
buried inside a filter where it is much harder to see.

**★ Using a filter to work around a test that is doing too much.**
Three filters and three `containsOnly` calls in one method is three tests wearing a coat.
The failure message will name one of them and you will not know which of the three
behaviours broke.

## Interview questions

**★ What is the single biggest risk of `filteredOn`, and how do you defend against it?**
A filter that matches nothing yields an empty list, and an empty list satisfies
`allSatisfy`, `allMatch`, `noneMatch`, `doesNotContain` and every "at most" size assertion
vacuously. The test goes green while asserting nothing. Defend with `hasSize(n)` — or at
minimum `isNotEmpty()` — immediately after the filter, before the real assertion.

**★ When would you use `filteredOn(Condition)` rather than `filteredOn(Predicate)`?**
When the criterion has a name worth putting in the failure message, or when the same
criterion is reused across tests. A `Condition` carries a description that AssertJ can
report; a bare lambda reports nothing about what it was looking for. `being` and `having`
are the same method with different grammar — pick whichever reads.

**★ What does `filteredOnAssertions` do when an assertion inside it fails?**
It excludes that element. The assertions are used as a predicate, so a failure is caught and
turned into "does not match" rather than propagating as a test failure. It is the only place
in AssertJ where a failing assertion is swallowed by design, which makes it the one to read
twice.

**★ Why prefer the predicate form over `filteredOn("fieldName", value)`?**
The same three reasons as `extracting`: the predicate is checked by the compiler so a rename
updates or breaks it, it needs no reflection, and it can only reach what the class publishes
— the name form reads private fields by default. The name form earns its place when there is
no accessor, or when the elements are `Map`s.

**★ `filteredOn(p).containsOnly(a, b)` versus `contains(a, b)` — what is the difference in
what they guarantee?**
`contains` says `a` and `b` are somewhere in the collection and says nothing about anything
else. `filteredOn(p).containsOnly(a, b)` says the elements matching `p` are exactly `a` and
`b` — so it also fails when a third element unexpectedly starts matching. The second is a
much stronger claim, which is why it is the one to reach for when you know the subset.

**★ You filter and then assert `hasSize(3)`. What have you actually pinned?**
That exactly three elements of the source satisfy the filter. Not which three — for that you
need `containsOnly` or `containsExactly` — and not anything about the source's total size,
which the filtered assertion no longer reports. If the source returning 0 rows and the source
returning 40 non-matching rows should be distinguishable failures, assert the source's size
too.

{/* FOOTER */}
