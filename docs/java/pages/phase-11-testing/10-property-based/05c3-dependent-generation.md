---
title: "flatMap is the only way to say that one generated value must exist before the arbitrary for the next one can be built, and because it is the only way it is also the operator people reach for when the dependency is imaginary — so the discipline is to write down what depends on what, and to find that most of the chain does not"
sidebar_label: "05c3 · Dependent generation"
sidebar_position: 25
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Flat Mapping*, *Flat
> Mapping with Tuple Types*, *Flat Mapping over Elements of Collection*, *Implicit Flat Mapping*
> and *Combining Arbitraries vs Flat Mapping*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** Every signature and warning below is
> quoted or paraphrased from the guide; none of it is the output of a run here.

**[05c](05c-composing-arbitraries.md) argued that `combine` is the default and `flatMap` is the
exception. This page is the exception: what `flatMap` does and the three shapes it takes — a
nested chain, a tuple, and a chain of named provider methods. The
recurring mistake it exists to prevent is a `@Provide` method that is four `flatMap` calls deep
because each value *happened to be generated after* the previous one, not because it depends on
it — an ordering mistaken for a dependency, paid for in worse shrinking on every failure
forever.**

## What `flatMap` actually does

`map` transforms a generated value. `flatMap` uses a generated value to *build the next
arbitrary*. The guide introduces it exactly that way:

> *"Similar as in the case of `Arbitrary.map(..)` there are situations in which you want to use
> a generated value in order to create another `Arbitrary` from it."*

Its first example generates lists whose strings are all the same length, which cannot be
expressed any other way — the length must be fixed before the string arbitrary exists:

```java
@Provide
Arbitrary<List<String>> listsOfEqualSizedStrings() {
    Arbitrary<Integer> integers2to5 = Arbitraries.integers().between(2, 5);
    return integers2to5.flatMap(stringSize -> {
        Arbitrary<String> strings = Arbitraries.strings()
                .withCharRange('a', 'z')
                .ofMinLength(stringSize).ofMaxLength(stringSize);
        return strings.list();
    });
}
```

> *"The provider method will create random lists of strings, but in each list the size of the
> contained strings will always be the same - between 2 and 5."*

That is the test for a real dependency, and it is sharper than "does one value use the other".
**Does the second `Arbitrary` — the generator, not the value — have to be different depending on
the first value?** Here it does: `ofMinLength(2)` and `ofMinLength(5)` are different generators.
In `combine(names, ages).as(Person::new)` the age generator is the same generator regardless of
the name, so there is no dependency and `combine` is correct.

## Tuple types: keeping the value you depended on

When the dependent value is generated inside the lambda, the property usually needs both. The
guide's canonical case is `String.substring(begin, end)` — `end` cannot exceed the string's
length, `begin` cannot exceed `end`:

```java
@Property
void substringLength(@ForAll("stringWithBeginEnd") Tuple3<String, Integer, Integer> stringBeginEnd) {
    String aString = stringBeginEnd.get1();
    int begin = stringBeginEnd.get2();
    int end = stringBeginEnd.get3();
    assertThat(aString.substring(begin, end).length()).isEqualTo(end - begin);
}

@Provide
Arbitrary<Tuple3<String, Integer, Integer>> stringWithBeginEnd() {
    Arbitrary<String> stringArbitrary = Arbitraries.strings()
            .withCharRange('a', 'z')
            .ofMinLength(2).ofMaxLength(20);
    return stringArbitrary
            .flatMap(aString -> Arbitraries.integers().between(0, aString.length())
                    .flatMap(end -> Arbitraries.integers().between(0, end)
                            .map(begin -> Tuple.of(aString, begin, end))));
}
```

The guide's own verdict on that shape:

> *"Mind the nested flat mapping, which is an aesthetic nuisance but nevertheless very useful."*

Two structural details worth copying. The innermost operation is a **`map`, not a `flatMap`** —
you stop flat-mapping the moment you are producing a value rather than a generator; writing
`flatMap` there would compile only if you wrapped the tuple in an arbitrary, and people do,
adding a dependency level for nothing. And the whole chain is a single expression with no
intermediate variables, which is why the next section exists.

## Implicit flat mapping: the same thing, readable

Since 1.5.2 a `@Provide` method may take `@ForAll` parameters of its own:

> *"You simply add a `@ForAll` parameter to your provider method, the value of which will be
> generated using standard parameter generation. Under the hood this uses this parameter's
> arbitrary and call `flatMap` on it."*

```java
@Provide
Arbitrary<String> simpleStrings() {
    return Arbitraries.strings().withCharRange('a', 'z').ofMinLength(2).ofMaxLength(20);
}

@Provide
Arbitrary<Tuple2<String, Integer>> stringWithEnd(@ForAll("simpleStrings") String aString) {
    return Arbitraries.integers().between(0, aString.length())
                      .map(end -> Tuple.of(aString, end));
}

@Provide
Arbitrary<Tuple3<String, Integer, Integer>> stringWithBeginEnd(
        @ForAll("stringWithEnd") Tuple2<String, Integer> stringWithEnd) {
    String aString = stringWithEnd.get1();
    int end = stringWithEnd.get2();
    return Arbitraries.integers().between(0, end)
                      .map(begin -> Tuple.of(aString, begin, end));
}
```

Three named methods instead of one three-deep lambda. **It is still flat mapping** — the guide's
sentence says so — so the shrinking cost is identical. What it buys is that each link now has a
name, and a named link can be reviewed: "does `stringWithEnd` really need the string, or does it
just want an integer?" is a question nobody asks of an anonymous lambda four levels down.

## Flat mapping over collection elements

`ListArbitrary` and `SetArbitrary` expose `flatMapEach`, the flat-mapping counterpart of
`mapEach`. The guide describes the pair as a mechanism to map *"over each element of a
collection and still keep the generated collection"*, and notes that `mapEach` is *"useful when
the mapping function needs access to all elements of the list to do its job"*.

The alternative people write instead is `list().flatMap(list -> …)` with the collection rebuilt
by hand inside the lambda — which throws away the list arbitrary's size configuration, its
`uniqueElements` constraint and much of its shrinking, all to avoid an API call they did not
know about.

## Where this connects

- `Combinators.combine`, filtering combinations and `flatAs` are
  [05c · Composing arbitraries](05c-composing-arbitraries.md).
- Optional parts and the builder route past the eight-parameter ceiling are
  [05c2 · Builders and optional parts](05c2-builders-and-optional-parts.md).
- The worked aggregate that puts one `flatMap` and three `combine`s in one generator, and a
  review checklist for `@Provide` methods, are
  [05c4 · A generator for an aggregate](05c4-a-generator-for-an-aggregate.md).
- Choosing between alternative arbitraries, and recursive structures, are
  [05c5 · Choosing among arbitraries](05c5-choosing-among-arbitraries.md); the recursive case is
  [05c6 · Recursive arbitraries](05c6-recursive-arbitraries.md).
- Why flat mapping shrinks worse — the mechanism, not the assertion — is
  [06 · Shrinking](06-shrinking.md).
- Why `Assume.that(index < list.size())` is the wrong way to express the same dependency is
  [05b2 · Filtering, assumptions and discards](05b2-filtering-assumptions-and-discards.md).
- The `@Provide` lookup rules that implicit flat mapping depends on are
  [05 · Generators](05-generators.md).

## Gotchas

**★ `flatMap` used for a dependency that does not exist silently costs you the minimal failing case, and nothing in the output says so.**
The guide is explicit that *"shrinking cannot be as aggressive"* with flat mapping, because the
second arbitrary was built from the first value and shrinking the first invalidates the second.
There is no warning, no report field and no exception — the property still fails, still shrinks,
and just shrinks to something less small than it could have. The tell in review is a `flatMap`
whose lambda ignores its parameter except to pass it through, which means the dependency was
imagined.

**★ A `@Provide` method with `@ForAll` parameters *is* a `flatMap`, so "I avoided flat mapping by using implicit flat mapping" is not a thing.**
The guide's own sentence is *"Under the hood this uses this parameter's arbitrary and call
`flatMap` on it."* The nesting disappears from the source; the shrinking behaviour does not
change at all. Implicit flat mapping is a readability win and nothing else, and a reviewer who
does not know that will wave through a chain of four provider methods that could have been one
`combine`.

**★ A `flatMap` where a `map` would do adds a dependency level for nothing, and the compiler is happy either way.**
The innermost step of a chain produces a *value*, so it is a `map`. Writing `flatMap` there
forces you to wrap the value — `Arbitraries.just(Tuple.of(...))` — which compiles, generates the
same values, and tells jqwik there is one more layer of derived generation than there really is.
It is the single most common way an otherwise-correct chain loses shrinking quality, because the
mistake is invisible: the outputs are identical.

**★ A `flatMap` chain returning a `Tuple3` puts the destructuring in the property body, where two components of the same type are trivially swapped.**
`stringBeginEnd.get2()` and `stringBeginEnd.get3()` are both `Integer` and nothing stops you
assigning them to the wrong locals. A property that silently swaps `begin` and `end` still runs,
still generates, and tests a different claim than the one its name states. Prefer a record over
a `Tuple` the moment two components share a type: `record Substring(String text, int begin, int
end)` cannot be destructured wrongly, and it gives the failure report a name instead of
`Tuple3`.

**★ `list().flatMap(list -> …)` and rebuilding the collection by hand throws away the list arbitrary's size, uniqueness and shrinking, and `flatMapEach` exists for exactly this.**
When the per-element arbitrary depends on the whole collection, the obvious move is to flat-map
the list and reassemble. `ListArbitrary.flatMapEach` and `SetArbitrary.flatMapEach` keep the
collection and its configuration. Not knowing they exist is the whole problem; they are two
lines in the guide, in a subsection most readers skip because the heading looks like an edge
case.

**★ `between(0, list.size() - 1)` on a possibly-empty list is an illegal range, not a discarded value.**
The single most common dependent generator is "a list and an index into it", and the empty list
is the case people forget. `Arbitraries.integers().between(0, -1)` is not a generator that
produces nothing; it is a broken generator, and the failure arrives as an exception during
generation which reads like a jqwik problem. Constrain the list with `ofMinSize(1)` in the outer
arbitrary, where the constraint belongs.

## Interview questions

**★ How would you generate a value that is only valid in the context of another generated value — say, an index into a generated list?**
`flatMap` on the list, returning a record containing both, because the property almost always
needs the list as well as the index. Concretely:
`lists.ofMinSize(1).flatMap(list -> Arbitraries.integers().between(0, list.size() - 1).map(i -> new Pick(list, i)))`.
The `ofMinSize(1)` is load-bearing rather than decorative: with an empty list the range becomes
`between(0, -1)`, which is not a generator that produces nothing but a broken one. The tempting
alternative is to generate a list and an unconstrained index and add
`Assume.that(index < list.size())`, and that is worse on two counts — it discards most inputs,
and the discards are concentrated on the large indices, so the property ends up testing index 0
far more often than anything else while the report cheerfully says a thousand tries.

**★ A colleague's `@Provide` method is four provider methods chained by `@ForAll` parameters. Is that better or worse than one nested `flatMap`?**
Better to read, identical to run. The guide is explicit that a `@ForAll` parameter on a provider
method is implemented by calling `flatMap` on that parameter's arbitrary, so the shrinking
characteristics are exactly those of the nested version — you have moved the nesting out of the
lambda and into the method structure. That is a genuine win, because a four-deep lambda is where
dependencies get invented by accident and never questioned. But I would use the improved
readability to ask the real question: of those four links, how many are real dependencies?
Usually one or two, and the rest collapse into a single `combine` that shrinks better than
either version.

**★ Give me a test for whether a dependency between two generated values is real.**
Ask whether the second *arbitrary* — the generator, not the value — would have to be different
depending on the first value. In jqwik's own example, a list of equal-length strings needs
`ofMinLength(2)` for one generated size and `ofMinLength(5)` for another, so the generator
genuinely differs and only `flatMap` can express it. Contrast `combine(names, ages)`: the age
generator is `integers().between(0, 130)` no matter what the name is, so there is no dependency
even though both values end up in the same object. The failure mode this test catches is the
common one — people flat-map because value B is *used with* value A, which is not the same thing
as B's generator being *determined by* A.

**★ Why does the innermost step of a `flatMap` chain use `map` rather than `flatMap`, and what happens if you get it wrong?**
Because at that point you are producing a value, not a generator. `flatMap` expects the lambda to
return an `Arbitrary`, so to use it there you have to wrap the result — typically
`Arbitraries.just(...)` — and that wrapping is not free: you have told jqwik there is another
layer of derived generation, and derived layers are the layers that shrink badly. What makes it
insidious is that nothing observable changes. The same values are generated, the property passes
and fails in the same places, and the only symptom is that the minimal failing case is a little
less minimal than it could have been — which nobody notices, because nobody sees the counterfactual.

{/* FOOTER */}
