---
title: "The three combinators are the easy half of a recursive generator — the half that decides what the property actually proves is the branching factor, the depth and the decision to re-admit the base case at every level, because those three numbers multiply into the size of every value generated and then into the cost of every shrink attempt"
sidebar_label: "05c7 · A recursive generator you would actually write"
sidebar_position: 29
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Recursive Arbitraries*,
> *Deterministic Recursion* and *Deterministic Recursion with recursive()*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); and the **jqwik 1.10.1 javadoc**
> for both `Arbitraries.recursive` overloads, `Arbitraries.oneOf`, `Arbitraries.maps` and
> `Arbitraries.just`
> ([jqwik.net](https://jqwik.net/docs/1.10.1/javadoc/net/jqwik/api/Arbitraries.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** Every quoted caveat below is from the guide
> or the javadoc; the arithmetic is arithmetic, not a measurement, and no figure here is the
> output of a run.

**[05c6](05c6-recursive-arbitraries.md) covered the machinery: `lazy`, `lazyOf` and `recursive`,
and the two entirely different stack overflows they exist to prevent. Knowing the machinery is
not the same as being able to write the generator, because once the recursion is safe the
remaining decisions are all about size — and size is where a recursive generator quietly stops
proving anything useful, or quietly makes the suite too slow to run. This page is the shape you
will actually write, with each of its numbers argued.**

## A JSON tree, bounded

The shape you will actually write, using deterministic recursion:

```java
sealed interface Json permits JsonNull, JsonBool, JsonNumber, JsonString, JsonArray, JsonObject {}

@Provide
Arbitrary<Json> jsonValues() {
    //  Depth 0 to 4: a generated value is a leaf, or up to four levels of nesting.
    //  Four is a deliberate number — see the arithmetic below.
    return Arbitraries.recursive(this::leaves, this::containers, 0, 4);
}

private Arbitrary<Json> leaves() {
    return Arbitraries.oneOf(
            Arbitraries.just(JsonNull.INSTANCE),          // immutable singleton: safe for just()
            Arbitraries.of(true, false).map(JsonBool::new),
            Arbitraries.bigDecimals()
                       .between(new BigDecimal("-1E6"), new BigDecimal("1E6"))
                       .ofScale(4).map(JsonNumber::new),
            Arbitraries.strings().ofMaxLength(20).map(JsonString::new));
}

private Arbitrary<Json> containers(Arbitrary<Json> inner) {
    Arbitrary<Json> arrays = inner.list().ofMaxSize(4).map(JsonArray::new);
    Arbitrary<Json> objects = Arbitraries
            .maps(Arbitraries.strings().alpha().ofMinLength(1).ofMaxLength(8), inner)
            .ofMaxSize(4)
            .map(JsonObject::new);
    //  leaves() is included here on purpose: without it every level below maxDepth is a
    //  container, and every generated value has exactly the same shape.
    return Arbitraries.oneOf(leaves(), arrays, objects);
}
```

Three decisions in that code and each one has a reason.

**`ofMaxSize(4)` and a depth of 4, because the product is exponential.** A container holding up
to four children, nested four deep, bounds the structure at 4⁴ = 256 leaves. Raise the size to
eight and the depth to six and the same arithmetic gives 8⁶ = 262,144 leaves — per generated
value, on a thousand tries, and then again for every candidate the shrinker evaluates. Recursive
generators are the fastest way to make a property suite unusable, and the two multipliers are
branching factor and depth.

**`leaves()` inside `containers`.** `recursive` applies the `recur` function a generated number
of times between `minDepth` and `maxDepth`, so without a leaf alternative in the recursive step,
every value at a given depth is a container all the way down and the generated structures are
near-identical. The guide observes the same effect on its own example: with deterministic
recursion *"the generated sentences will be very similar"*. Re-admitting the base case at each
level restores shape variety without giving up the depth bound.

**`Arbitraries.just(JsonNull.INSTANCE)`.** `just` hands every try the same instance, which is a
documented hazard for mutable values ([05a](05a-the-defaults-you-inherit.md)) and exactly right
for an immutable singleton.

## Where this connects

- Choosing between the alternatives at each level — `oneOf`, `frequencyOf` and their shrinking
  order — is [05c5 · Choosing among arbitraries](05c5-choosing-among-arbitraries.md).
- `Combinators.combine`, used inside every `recur` function above, is
  [05c · Composing arbitraries](05c-composing-arbitraries.md).
- Why a deeply nested counter-example is so much worse than a flat one, and what shrinking can
  do about it, is [06 · Shrinking](06-shrinking.md).
- The runtime bill a recursive generator hands you is [12 · The cost](12-the-cost.md).
- Container size defaults, which recursion multiplies rather than adds to, are
  [05a · The defaults nobody chooses](05a-the-defaults-you-inherit.md).
- Round-trip properties — parse then serialise — are the reason most people generate a
  recursive type in the first place, and they are
  [04 · Finding properties](04-finding-properties.md).

## Gotchas

**★ Deep recursion produces large values, and large values make everything downstream slower — including every shrink attempt.**
A `maxDepth` of 10 on the sentence example produces at most eleven words; a `maxDepth` of 1000
produces a string a thousand words long, on every one of a thousand tries, and then the shrinker
works its way down from there on failure. Recursive generators are the easiest way to make a
property suite unusably slow, and the depth bound is the only lever. This is the specific case
of the general runtime argument in [12 · The cost](12-the-cost.md).

**★ `recursive`'s second argument is a `Function` over `Arbitrary`, not over the generated value, and writing it the other way round produces an inference error that reads like a generics problem.**
The signature is
`recursive(Supplier<? extends Arbitrary<T>> base, Function<? super Arbitrary<T>, ? extends Arbitrary<T>> recur, int minDepth, int maxDepth)`.
People write `json -> new JsonArray(List.of(json))` — a function over values — because that is
what recursion looks like everywhere else in Java. It does not compile, and the message is about
type inference rather than about the mistake. The `recur` function receives the *generator for
the level below* and returns the *generator for this level*, which is why its body is full of
`combine` and `list()` rather than constructors.

## Interview questions

**★ A bounded `maxDepth` silently changes what the property proves, and nothing in the test says so.**
`Arbitraries.recursive(base, recur, 0, 4)` is a claim about your parser as much as about your
generator: it says the property has been checked against structures nested up to four deep and
says nothing whatsoever about five. That is usually the right trade — the alternative is a suite
that does not finish — but it is a limit that lives in one integer in a provider method, far from
the `@Property` that reads as though it checked everything. If the depth bound is load-bearing,
say so where the property is, not where the generator is: name it in the property's
`@Label`, or hoist it to a constant whose name is the argument (`MAX_NESTING_A_CLIENT_SENDS`).
The generator's job is to make the bound explicit; only you can make it honest.

**★ `Arbitraries.maps` cannot generate duplicate keys, so a round-trip property over a JSON object never sees the case most JSON parsers disagree about.**
The generated type is a `Map`, and a `Map` holds one value per key by construction. Real JSON
does not have that restriction — `{"a":1,"a":2}` is well-formed input that different parsers
resolve differently (last-wins, first-wins, or an error). Generating objects via
`Arbitraries.maps` therefore guarantees the property will never draw the input on which the
serialiser and the parser are most likely to disagree. If duplicate keys are in scope for what
you are testing, generate a `List` of pairs and build the serialised form from it, and keep the
`Map` version for the round-trip whose contract genuinely is map-shaped.

## Interview questions

**★ How do you bound the size of a recursive generator, and why is that more urgent than for a flat one?**
Two numbers, and both have to be set: the depth, through `Arbitraries.recursive(base, recur,
minDepth, maxDepth)` or through the base-case probability if you are stuck with the
probabilistic form, and the branching factor at each level, through `ofMaxSize` on whatever
collection the recursive step builds. It is more urgent than for a flat generator because the two
multiply rather than add — four children at four levels is 256 leaves, but eight children at six
levels is a quarter of a million, and that is per generated value across a thousand tries. There
is a second multiplier people forget: shrinking re-runs the property on candidate values, so an
expensive value is expensive again on every shrink attempt, which is exactly when you least want
to wait. A flat generator that is ten times too big costs you ten times; a recursive one that is
two levels too deep can cost you a thousand.

**★ You are writing a round-trip property for a JSON serialiser. Where does the generator go wrong first?**
In the alphabet, not in the recursion. The recursion part is mechanical —
`Arbitraries.recursive` with a bounded depth, containers built with `list()` and `maps()`, leaves
built with `oneOf` — and once it is bounded it tends to work. What goes wrong is that
`Arbitraries.strings()` with no configuration produces a documented default alphabet that
excludes some things a real payload contains and includes some things your parser may never have
seen, and jqwik never generates `null` unless you ask. So the property passes on a distribution
that is neither production traffic nor the adversarial edge of the format: no surrogate pairs, no
empty keys unless you allowed them, no duplicate keys because a `Map` cannot hold them, no
numbers outside the scale you set. The recursion is the part that looks hard and the character
set is the part that decides what the property proves — which is the general lesson from
[05a](05a-the-defaults-you-inherit.md) arriving in its most expensive form.

**★ Your recursive generator is correct and the property suite went from 4 seconds to 90. What do you change first, and what do you refuse to change?**
First I look at the two multipliers rather than at the number of tries, because tries are linear
and the generator is exponential: the branching factor set by `ofMaxSize` on whatever collection
the recursive step builds, and the depth set by `maxDepth`. Dropping a depth of 6 to 4 at a
branching factor of 4 takes the bound from 4,096 leaves to 256 — a sixteen-fold cut from one
character, and no loss of shape variety as long as the base case is re-admitted inside the
recursive step. Only after that would I look at `@Property(tries = …)`, and I would look at it
with suspicion, because cutting tries is the change that keeps the suite fast while quietly
reducing what it checks — the timing improves and so does nothing else. What I refuse to change
is the assumption filter: making the generator cheaper by discarding more generated values trades
a runtime problem for an exhaustion problem, and jqwik will tell you about that one only if you
are watching the discard ratio. The honest version of this fix is a smaller structure, not fewer
or more filtered attempts at a large one.

{/* FOOTER */}
