---
title: "extracting turns a comparison of objects into a comparison of values, and the choice between one extractor, several, and flatExtracting is the choice of how much association between the fields survives"
sidebar_label: "03c · extracting"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — "Extracting elements values"
> ([assertj.github.io/doc](https://assertj.github.io/doc/#assertj-core-group-extracting)) —
> and the `assertj-core` 3.27.7 sources (`AbstractIterableAssert.extracting` overloads,
> `AbstractIterableAssert.flatExtracting`, `AbstractObjectAssert.extracting`,
> `org.assertj.core.configuration.Configuration.ALLOW_EXTRACTING_PRIVATE_FIELDS`,
> `PropertyOrFieldSupport.getSimpleValue`).
> JDK 25 · Spring Boot 4.1.1 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**Building expected domain objects just to assert on a list of them is, in the
documentation's own word, "tedious" — and worse, it means your assertion depends on the
element type's `equals`. `extracting` pulls out the fields you actually care about and
asserts on those instead, turning a comparison of objects into a comparison of values. The
cost is in the overload you pick: the `Function` forms are compile-checked and refactor-safe,
the `String` forms are reflective, resolve to `ObjectAssert` and will read a private field
without asking.**

## The problem it solves

The documentation states it plainly:

> *"Let's say you have called some service and got a list (or an array) of
> TolkienCharacter, to check the results you have to build the expected TolkienCharacters,
> that can be quite tedious!"*

and shows the workaround people write by hand:

```java
// extract the names ...
List<String> names = fellowshipOfTheRing.stream().map(TolkienCharacter::getName).collect(toList());
// ... and finally assert something
assertThat(names).contains("Boromir", "Gandalf", "Frodo", "Legolas");
```

> *"This is too much work (even with the stream API)"*

So AssertJ does the mapping for you, inside the chain, and keeps the collection assertion's
failure message.

## One value per element

```java
// same thing with a lambda which is type safe and refactoring friendly:
assertThat(fellowshipOfTheRing).extracting(TolkienCharacter::getName)
                               .contains("Boromir", "Gandalf", "Frodo", "Legolas");
```

`map` is an alias of `extracting` and does exactly the same thing; use whichever reads
better to your team, but use one consistently.

## Several values per element: tuples

```java
import static org.assertj.core.api.Assertions.tuple;

assertThat(fellowshipOfTheRing).extracting(TolkienCharacter::getName,
                                           tolkienCharacter -> tolkienCharacter.age,
                                           tolkienCharacter -> tolkienCharacter.getRace().getName())
                               .contains(tuple("Boromir", 37, "Man"),
                                         tuple("Sam", 38, "Hobbit"),
                                         tuple("Legolas", 1000, "Elf"));
```

This is the single highest-value pattern in the whole topic. `extracting(...).containsExactly(tuple(...), ...)`
asserts the size, the contents, the order and the specific fields of a result set in one
assertion, with a failure that prints the tuples — which is exactly what you want from a
repository test.

⚠️ Note the overload boundary. `extracting(Function<? super ELEMENT, V>)` — one function —
returns a list of `V`. `extracting(Function<? super ELEMENT, ?>... extractors)` — two or
more — returns a list of `Tuple`. Java resolves a single-argument call to the non-varargs
overload, so passing one function gives you values, not one-element tuples. Passing two
gives you tuples and your expected values must be `tuple(...)` too.

## Flattening: `flatExtracting`

When the extracted value is itself a collection, `extracting` gives you a list of lists.
`flatExtracting` (alias `flatMap`) gives you one flat list:

```java
assertThat(reallyGoodPlayers).flatExtracting(BasketBallPlayer::getTeamMates)
                             .contains(pippen, kukoc, jabbar, worthy);

// if you use extracting instead of flatExtracting the result would be a list of list of
// players so the assertion becomes:
assertThat(reallyGoodPlayers).extracting("teamMates")
                             .contains(list(pippen, kukoc), list(jabbar, worthy));
```

The documentation notes the alias has one hole: *"You can use flatMap in place of
flatExtracting (except for the variant taking a String)"*.

There is a second, less obvious use — flattening several single-valued extractors instead of
building tuples:

```java
assertThat(fellowshipOfTheRing).flatExtracting(TolkienCharacter::getName,
                                               tc -> tc.getRace().getName())
                               .contains("Frodo", "Hobbit", "Legolas", "Elf");
```

Be careful with this one. It interleaves all the values into a single flat list, so it
cannot tell you that *Frodo* is the hobbit — only that "Frodo" and "Hobbit" are both in
there somewhere. Tuples preserve the association; flattening destroys it.

The `String`-named overloads — what they cost you, how AssertJ resolves the name, and
`extracting` on a single object — are in
[03d · Extracting by name](03d-extracting-by-name.md).

## Gotchas

**★ One extractor gives values, two give tuples — and the failure message changes shape
accordingly.**
`extracting(f)` resolves to the single-`Function` overload; `extracting(f, g)` resolves to
the varargs one and produces `Tuple` elements. Your expected values must match, and mixing
them up produces a confusing "expecting Tuple, was String" style failure.

**★ `flatExtracting` with multiple extractors destroys the association between fields.**
`flatExtracting(name, race)` produces a flat list where "Frodo" and "Hobbit" are unrelated
entries. It cannot detect that the wrong race is attached to the wrong character. Use
tuples when the association matters.

**★ `extracting(...).containsExactly(...)` inherits every trap from
[03 · Collection assertions](03-collections.md).**
Extraction preserves the source's iteration order, so extracting from a `HashSet` and
asserting `containsExactly` is still asserting hash order.

**★ A `Tuple` mismatch prints the tuples, not the original objects.**
That is usually the point — but if you extracted the wrong fields, the message will be a
confident report about values you did not mean to assert. Extraction narrows what a failure
can tell you as well as what it checks.

**★ Extracting a lazily-loaded association inside a `@DataJpaTest` triggers the load.**
`extracting(Order::customer)` is a getter call, and outside a session it is a
`LazyInitializationException` rather than an assertion failure. See
[Phase 10 · Lazy loading](../../phase-10-data-access/10-lazy-loading/README.md).

## Interview questions

**★ What is the difference between `extracting` with two functions and `flatExtracting` with
two functions?**
`extracting(f, g)` produces one `Tuple` per element, preserving which value came from which
element and which position. `flatExtracting(f, g)` interleaves all the values into one flat
list, losing the association entirely. The tuple form can assert that Frodo is a hobbit; the
flat form can only assert that "Frodo" and "Hobbit" both appear.

**★ You extract three fields and use `containsExactlyInAnyOrder(tuple(...), ...)`. What does
this assertion actually guarantee?**
That the result set has exactly as many elements as you listed tuples, and that each
element's three extracted values match one of the tuples with correct multiplicity, in any
order. It does not guarantee anything about the fields you did not extract, and it does not
guarantee ordering. It is a strong assertion in the dimensions you named and completely
silent in every other, which is why choosing which fields to extract is a design decision,
not a mechanical one.

**★ What does `extracting` do to your failure messages, for better and for worse?**
For better: the failure prints values and tuples rather than objects whose `toString` may be
unhelpful, and it prints exactly the dimensions you said you cared about. For worse: it can
only ever report on the extracted values, so a wrong object with the right two fields
produces no failure at all, and a failure gives you no information about the fields you left
out. Extraction is a lens; it narrows the view in both directions.

{/* FOOTER */}
