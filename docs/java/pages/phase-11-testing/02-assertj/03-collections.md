---
title: "The contains family is eight assertions that differ along three axes — order, extra elements and duplicates — and the failure message you get is the one your choice earned"
sidebar_label: "03 · Collection assertions"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — "Iterable and array
> assertions", section "Checking iterables/arrays content"
> ([assertj.github.io/doc](https://assertj.github.io/doc/#assertj-core-group-contains)) —
> and the `assertj-core` 3.27.7 sources (`org.assertj.core.error.ShouldContain`,
> `ShouldContainExactly`, `ShouldContainExactlyInAnyOrder`, `ShouldContainOnly`,
> `Assertions.assertThat(Stream)`).
> JDK 25 · Spring Boot 4.1.0 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**Collections are where a good assertion library earns its licence, because a wrong
collection can be wrong in four independent ways — missing elements, extra elements, wrong
order, wrong multiplicity — and a single boolean `equals` collapses all four into "not
equal". AssertJ's `contains` family names each combination, and because each has its own
error class, each failure tells you which of the four went wrong. Picking the loosest one
that compiles is how you end up with a green test over a broken query.**

## The eight, and what each one actually promises

This table is the documentation's own, verbatim:

| Assertion | Description |
|---|---|
| `contains` | *"Verifies that the actual iterable/array contains the given values in any order"* |
| `containsOnly` | *"Verifies that the actual group contains only the given values and nothing else in any order and ignoring duplicates (i.e. once a value is found, its duplicates are also considered found)"* |
| `containsExactly` | *"Verifies that the actual iterable/array contains exactly the given values and nothing else in order"* |
| `containsExactlyInAnyOrder` | *"Verifies that the actual iterable/array contains exactly the given values and nothing else in any order"* |
| `containsSequence` | *"Verifies that the actual group contains the given sequence in the correct order and without extra values between the sequence values"* |
| `containsSubsequence` | *"Verifies that the actual group contains the given subsequence in the correct order possibly with other values between them"* |
| `containsOnlyOnce` | *"Verifies that the actual iterable/array contains the given values only once"* |
| `containsAnyOf` | *"Verifies that the actual iterable/array contains at least one of the given values (like an or operator on the given values)"* |

Read down the three axes rather than memorising eight names:

- **Order** — only `containsExactly`, `containsSequence` and `containsSubsequence` care.
- **Extra elements** — only the `only`/`exactly` family rejects them. `contains` is a
  subset check and will happily pass over a list with a thousand unexpected rows in it.
- **Duplicates** — this is the axis everyone misses. `containsOnly` explicitly ignores
  them: *"once a value is found, its duplicates are also considered found"*.
  `containsExactlyInAnyOrder` does not.

That last distinction is the whole reason both exist:

```java
List<String> actual = List.of("a", "a", "b");

assertThat(actual).containsOnly("a", "b");                 // passes — duplicates ignored
assertThat(actual).containsExactlyInAnyOrder("a", "b");    // fails   — one "a" unexpected
assertThat(actual).containsExactlyInAnyOrder("a", "a", "b"); // passes
```

A de-duplication bug — a join that fans out, a `flatMap` that double-counts — is invisible
to `containsOnly` and caught by `containsExactlyInAnyOrder`. If you have ever shipped a
duplicated-row defect that had a passing test, this is very likely why. The N+1 and
fan-out mechanics behind that class of bug are in
[Phase 10 · The N+1 problem](../../phase-10-data-access/08-the-n-plus-1-problem/README.md).

## Every one of them has its own failure message

This is the payoff, and it is worth seeing the templates. `ShouldContain` — the subset
check — reports only what is missing:

```java
super("%nExpecting " + groupTypeDescription.getGroupTypeName()
      + ":%n  %s%nto contain:%n  %s%nbut could not find the following "
      + groupTypeDescription.getElementTypeName()
      + ":%n  %s%n%s", actual, expected, notFound, comparisonStrategy);
```

`ShouldContainExactlyInAnyOrder` reports both directions, because both are possible:

```java
super("%n" +
      "Expecting actual:%n" +
      "  %s%n" +
      "to contain exactly in any order:%n" +
      "  %s%n" +
      "elements not found:%n" +
      "  %s%n" +
      "and elements not expected:%n" +
      "  %s%n%s", actual, ...);
```

`ShouldContainExactly` has four templates — one for "some missing and some unexpected", one
for missing only, one for unexpected only, and one for the case where the *contents* are
right and only the order is wrong:

```java
super("%n" +
      "Expecting actual:%n" +
      "  %s%n" +
      "to contain exactly (and in same order):%n" +
      "  %s%n", ...);
// ... and for the order-only case, an index-by-index report:
sb.append("but there were differences at these indexes");
sb.append(format("  - element at index %d: expected \"%s\" but was \"%s\"%n", ...));
```

That last one is why `containsExactly` is worth the extra strictness: when the only thing
wrong is the ordering, you get the differing indexes rather than a dump of two lists to
diff by eye. There is even a printing cap on it — `Configuration.MAX_INDICES_FOR_PRINTING`,
after which the message appends *"(only showing the first %d mismatches)"*.

## `containsExactly` on a `Set` is a trap, not an assertion

`containsExactly` asserts iteration order. A `HashSet`'s iteration order is unspecified and
depends on hash codes and capacity — it is stable for a given JVM and a given set of
elements, which is exactly what makes this dangerous: the test passes locally, passes in
CI, and then someone adds an element or changes a `hashCode` and the order rearranges.

```java
Set<String> roles = user.roles();               // a HashSet

assertThat(roles).containsExactly("ADMIN", "USER");          // do not
assertThat(roles).containsExactlyInAnyOrder("ADMIN", "USER"); // do
```

The rule: **use `containsExactly` when the type guarantees an order** — `List`,
`LinkedHashSet`, `TreeSet`, an array, a `Stream` from an ordered source, a query result
with an `ORDER BY`. Use `containsExactlyInAnyOrder` for `HashSet`, `HashMap.values()`, and
anything that came back from a `Collectors.toSet()`.

And the converse: if a repository method returns a `List` because the order is part of the
contract, `containsExactlyInAnyOrder` is the wrong assertion — it stops testing the
`ORDER BY` you wrote.

## The `...ElementsOf` variants

Every assertion above has a sibling that takes an `Iterable` instead of varargs:

> *"the assertions above have a variant accepting an iterable/array argument, ex:
> `containsExactly(E…)` and `containsExactlyElementsOf(Iterable)`"*

`containsExactlyElementsOf`, `containsExactlyInAnyOrderElementsOf`, `containsAnyElementsOf`,
`containsOnlyElementsOf`, `hasSameElementsAs`. Reach for them when your expected values are
already in a collection — spreading them with `toArray` loses the element type and can
silently select an overload you did not want.

## What the next three chunks add

This chunk is about *which* elements are there. The remaining questions get their own
pages because each has its own failure modes: how an element is *compared* and what happens
to one-shot sources like `Stream` is
[03b · Element comparison and streams](03b-element-comparison-and-streams.md); pulling
fields out of elements before asserting is [03c · extracting](03c-extracting.md); narrowing
to a subset or to a single element is
[03e · Filtering and navigating](03e-filtering-and-navigating.md).

## Gotchas

**★ `contains` is a subset check and passes over any amount of unexpected data.**
`assertThat(results).contains(expectedOrder)` is green when the query returned that order
plus five hundred others. If "and nothing else" is part of the requirement, the assertion
is `containsExactlyInAnyOrder` or `containsOnly`.

**★ `containsOnly` ignores duplicates; `containsExactlyInAnyOrder` does not.**
The docs say so verbatim: *"once a value is found, its duplicates are also considered
found"*. `containsOnly` cannot catch a fan-out bug. This is the single most consequential
distinction in the family.

**★ `containsExactly` on a `HashSet` asserts hash order.**
It will pass consistently until the element set or a `hashCode` changes, then fail in a way
that looks like flakiness and is not. `containsExactlyInAnyOrder` for unordered types.

**★ `containsExactlyInAnyOrder` on a `List` throws away the ordering guarantee you wrote an
`ORDER BY` for.**
The mirror mistake. If the order is part of the contract, assert it.

**★ `containsSequence` and `containsSubsequence` are not synonyms.**
`containsSequence` requires the elements to be *consecutive*; `containsSubsequence` allows
others in between. Choosing the wrong one gives you either a test that fails on an
unrelated insertion or one that passes when the elements are scattered.

**★ `hasSize(n)` and nothing else lets every wrong element through.**
See [02b · Assertions that assert nothing](02b-assertions-that-assert-nothing.md).
`containsExactly` asserts size, contents and order in a single assertion with a better
message.

**★ Very large collections are truncated in the failure message.**
`MaxElementsForPrinting` defaults to 1000 and index mismatch reporting has its own cap.
A message that appears to stop mid-list has not lost your data; it has hit a configured
threshold.

**★ `containsOnlyOnce` is about the *actual*, not the expected.**
It verifies that each given value appears exactly once in the actual iterable. It is the
targeted duplicate-detector when you do not want to pin the whole contents.

## Interview questions

**★ What is the difference between `containsOnly` and `containsExactlyInAnyOrder`?**
Duplicates. Both require that the actual contains the given values and nothing else, in any
order — but `containsOnly` treats duplicates as already found, so `["a","a","b"]` satisfies
`containsOnly("a","b")`. `containsExactlyInAnyOrder` compares multiplicities, so the same
actual fails against `("a","b")` and passes against `("a","a","b")`. If you are testing a
query that can fan out, only the second one can catch it.

**★ Why is `containsExactly` on a `Set` almost always wrong?**
Because it asserts iteration order, and for a `HashSet` iteration order is an
implementation detail of the hash function and the table capacity. It is deterministic for
a given set of elements on a given JVM, so the test passes reliably — until someone adds an
element, changes a `hashCode`, or the table resizes, and then the order rearranges and the
test fails for a reason unrelated to the change. `containsExactlyInAnyOrder` states what
you actually mean.

**★ You have a repository method with an `ORDER BY` and a test using
`containsExactlyInAnyOrder`. What is wrong?**
The test does not test the `ORDER BY`. Somebody can delete the sort clause and the suite
stays green. If the ordering is part of the method's contract — and an `ORDER BY` in the
query says it is — the assertion has to be `containsExactly`.

**★ Why does AssertJ have eight `contains` variants instead of one that takes flags?**
Because each variant has its own failure message. A single parameterised assertion would
have to produce a generic report; separate error classes let `containsExactly` report the
differing *indexes* when only the order is wrong, `containsExactlyInAnyOrder` report
missing and unexpected elements separately, and `contains` report only what was missing.
The API surface is the price of the diagnostics.

**★ Your test asserts `contains(a, b)` on a result that should have exactly two elements.
What can go wrong in production that this test cannot see?**
Anything additive. A join that fans out and returns each row twice, a missing `DISTINCT`, a
filter that stopped filtering, a second tenant's rows leaking into the query. `contains` is
a subset check, so all of those pass. This is the exact class of defect that reaches
production with a green suite.

{/* FOOTER */}
