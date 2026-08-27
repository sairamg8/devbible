---
title: "first, last, element and singleElement navigate from a collection assert down to one element, and the type you land on decides whether the rest of the chain is a real assertion or an ObjectAssert that can barely say anything"
sidebar_label: "03f · Navigating to elements"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — the element-navigation and
> "satisfies" sections ([assertj.github.io/doc](https://assertj.github.io/doc/)) — and the
> `assertj-core` 3.27.7 API (`AbstractIterableAssert.first`, `last`, `element`,
> `singleElement`, `allSatisfy`, `anySatisfy`, `noneSatisfy`, `allMatch`, `anyMatch`,
> `noneMatch`, `org.assertj.core.api.InstanceOfAssertFactories`).
> JDK 25 · Spring Boot 4.1.0 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**[03e](03e-filtering-and-navigating.md) narrowed the collection to a subset. This chunk
narrows it to a single element, or asserts on every element in turn. Both moves have the
same hidden cost, and it is the one
[02 · assertThat and the chain](02-assertthat-basics.md) warned about: navigation changes
the assert type. Land on `ObjectAssert<T>` and `isEqualTo` is nearly all you have left —
`startsWith`, `isCloseTo` and every other type-specific assertion is gone, and the compiler
will not tell you what you lost.**

## Navigating to one element

```java
Iterable<TolkienCharacter> hobbits = list(frodo, sam, pippin);

assertThat(hobbits).first().isEqualTo(frodo);
assertThat(hobbits).element(1).isEqualTo(sam);
assertThat(hobbits).last().isEqualTo(pippin);
```

All three assert the collection is non-empty (and, for `element(i)`, long enough) before
navigating, so they fail with a message about the collection rather than an
`IndexOutOfBoundsException`. That is the whole reason to prefer them over
`assertThat(list.get(1))`.

### Keeping the type: `as(...)`

Bare `first()` gives you an `ObjectAssert`. To keep a real assertion API, pass an
`InstanceOfAssertFactory`:

```java
Iterable<String> hobbitsName = list("frodo", "sam", "pippin");

assertThat(hobbitsName).first(as(STRING))
                       .startsWith("fro")
                       .endsWith("do");
```

`as` and `STRING` are static imports from `Assertions` and
`InstanceOfAssertFactories`. The factory does two jobs at once: it asserts the element's
type, and it returns the assert for that type. `INTEGER`, `LIST`, `MAP`, `OPTIONAL`,
`LOCAL_DATE`, `THROWABLE` and many more exist; there is a `type(Class)` factory for your own
types.

### `singleElement`

> *"`singleElement` checks that the iterable has only one element and navigates to it"*

```java
Iterable<String> babySimpsons = list("Maggie");

assertThat(babySimpsons).singleElement(as(STRING))
                        .endsWith("gie");
```

This is the one to use whenever you expect exactly one result, and it is strictly better
than the two habits it replaces. `assertThat(list.get(0))` says nothing about size and
throws the wrong exception when the list is empty. `hasSize(1)` followed by
`assertThat(list.get(0))` says the right things but in two statements, and people delete the
first one during a refactor.

`singleElement()` is also the natural end of a filter — `filteredOn(...).singleElement()`
reads as "exactly one thing matched, and here is what must be true of it", which is a
genuinely strong assertion in one line.

## Asserting on every element

### `allSatisfy` / `anySatisfy` / `noneSatisfy` — assertions per element

```java
List<TolkienCharacter> hobbits = list(frodo, sam, pippin);

assertThat(hobbits).allSatisfy(character -> {
  assertThat(character.getRace()).isEqualTo(HOBBIT);
  assertThat(character.getName()).isNotEqualTo("Sauron");
});

assertThat(hobbits).anySatisfy(character -> {
  assertThat(character.getRace()).isEqualTo(HOBBIT);
  assertThat(character.getName()).isEqualTo("Sam");
});

assertThat(hobbits).noneSatisfy(character -> assertThat(character.getRace()).isEqualTo(ELF));
```

The consumer holds **assertions**, so when one fails the message is AssertJ's own — it names
the field, the expected value and the actual one, and it names the element it was looking at.

### `allMatch` / `anyMatch` / `noneMatch` — predicates per element

```java
assertThat(hobbits).allMatch(character -> character.getRace() == HOBBIT, "hobbits")
                   .anyMatch(character -> character.getName().contains("pp"))
                   .noneMatch(character -> character.getRace() == ORC);
```

These take a `Predicate`, and a predicate returns `false` without saying why. The optional
second argument — `"hobbits"` above — is a description of the predicate, and it is the only
thing standing between you and a failure message that says an element "did not match the
given predicate". **Supply it, every time.**

### Which of the two families to reach for

| | Reads as | On failure |
|---|---|---|
| `allSatisfy(a -> assertThat(a.x).isEqualTo(1))` | a block of assertions | names the field, expected and actual |
| `allMatch(a -> a.x == 1)` | a boolean | "did not match the given predicate" |
| `allMatch(a -> a.x == 1, "x is 1")` | a named boolean | "did not match the given predicate: x is 1" |

**Default to the `Satisfy` family.** The `Match` family exists for conditions that genuinely
are a single boolean and read better that way; the moment you want to know *why* an element
failed, you wanted `allSatisfy`.

Note also that `Satisfy`/`Match` say nothing about **order or size**, only about a property
holding element-by-element. Pairing them with `hasSize(n)` is what makes the claim complete.

## Gotchas

**★ `first()` without `as(...)` returns `ObjectAssert` and silently loses the API.**
`assertThat(names).first().startsWith("fro")` does not compile, which is the good case. The
bad case is `.isEqualTo(...)` — it compiles, and you never notice you gave up
`startsWith`, `containsIgnoringCase` and everything else. Use `first(as(STRING))`.

**★ `allSatisfy`, `noneSatisfy`, `allMatch` and `noneMatch` pass on an empty collection.**
Vacuous truth again — the same trap as [03e](03e-filtering-and-navigating.md)'s empty
filter, and it does not need a filter to happen. A repository method that returns nothing
makes every one of these pass. Pair them with `hasSize(n)` or `isNotEmpty()`.
`anySatisfy` and `anyMatch` are the exceptions: they fail on an empty collection, because
nothing can satisfy them.

**★ `element(2)` on a `Set` asserts on hash order.**
`element(int)` is positional, and a `HashSet` has no meaningful position. The assertion is
deterministic for a given JDK and set of elements and it is not asserting anything you
meant. Sort first, or assert with `containsOnly`.

**★ `allMatch` without a description gives a failure message with no information.**
"did not match the given predicate" plus the element. You are then debugging by reading the
lambda. The two-argument overload exists for exactly this; the one-argument overload is a
trap dressed as brevity.

**★ `hasSize(1)` + `get(0)` instead of `singleElement()`.**
Two statements where one will do, and the `hasSize(1)` is the one that gets deleted when
someone "simplifies" the test. `singleElement()` cannot be half-removed.

**★ `assertThat(list.get(0))` fails with the wrong exception.**
An empty list throws `IndexOutOfBoundsException` before AssertJ sees anything, so the report
is a Java error rather than an assertion failure that tells you the list was empty.
`first()` asserts non-emptiness first.

**★ A failing assertion inside `noneSatisfy` means the element *passed*.**
`noneSatisfy` inverts the consumer: an element that satisfies the assertions is a failure of
the overall assertion. Reading it quickly gets this backwards, particularly with several
assertions in the block, where "none of these elements satisfies all of this" is a weaker
statement than most people intend.

**★ `anySatisfy` reports only that nothing matched, plus the whole collection.**
Unlike `allSatisfy`, there is no single guilty element to name, so the message lists what it
looked at. On a large collection this is a wall of output. `filteredOn(...).singleElement()`
is usually a more precise way to say the same thing.

**★ `allSatisfy` on a large collection stops at the first failure.**
You get one failure, fix it, and find the next. For the "tell me everything that is wrong at
once" behaviour you want soft assertions —
**06 · Soft assertions** *(not written yet)*.

**★ Navigation methods on a `Stream` consume it.**
As everywhere in this topic; see
[03b · Element comparison and streams](03b-element-comparison-and-streams.md).

## Interview questions

**★ Why is `singleElement()` better than `hasSize(1)` followed by `get(0)`?**
It is one statement instead of two, so the size check cannot be removed independently of the
element check; it produces one coherent failure message whether the problem is the size or
the element; and it fails as an assertion rather than as an `IndexOutOfBoundsException` when
the collection is empty. Add `as(...)` and it also keeps the element's assertion API.

**★ What does `first()` return, and why does that matter?**
`ObjectAssert<T>` — so the chain after it has only the universal assertions: `isEqualTo`,
`isNotNull`, `isInstanceOf`, `satisfies`, and so on. Every type-specific assertion is gone.
`first(as(STRING))` takes an `InstanceOfAssertFactory`, asserts the type and returns
`StringAssert`, which is what you almost always wanted.

**★ When would you use `allMatch` rather than `allSatisfy`?**
When the condition really is one boolean and reads better as one — and then only with the
description overload, because a bare `Predicate` failure says "did not match the given
predicate" and nothing else. Anything with more than one condition, or where you will want
to know the actual value on failure, is `allSatisfy`.

**★ Your `allSatisfy` assertion passes. What have you actually proved?**
That no element violated the assertions in the block — which is also true when there are no
elements. Vacuous truth. You have proved the property holds for every element *and* you have
proved nothing about how many elements there were, so unless the test also asserts the size,
a repository that returns an empty list passes it.

**★ How do `anySatisfy` and `allSatisfy` differ on an empty collection?**
`allSatisfy` passes vacuously; `anySatisfy` fails, because no element exists to satisfy the
consumer. The same asymmetry holds for `allMatch` versus `anyMatch`, and it is worth knowing
because it means `anySatisfy` is the one of the pair that is safe against an empty result by
construction.

**★ What is wrong with `assertThat(someSet).element(2)`?**
`element(int)` is positional and a `HashSet` has no position — you are asserting on the
iteration order the hash table happens to produce, which is stable enough to pass and has
nothing to do with the behaviour under test. Either sort into a `List` first, or use an
order-independent assertion like `containsOnly`.

**★ You need to assert that exactly one order in a list is `FAILED` and that its retry count
is zero. Write it.**
`assertThat(orders).filteredOn(Order::isFailed).singleElement().extracting(Order::retries).isEqualTo(0)`
— or `singleElement().satisfies(o -> assertThat(o.retries()).isZero())` if more than one
property is involved. The `singleElement()` is doing two jobs: pinning the count at one and
navigating, so a second failed order breaks the test rather than being silently ignored.

{/* FOOTER */}
