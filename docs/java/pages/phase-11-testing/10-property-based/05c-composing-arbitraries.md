---
title: "Combinators.combine assembles a domain aggregate from up to eight independent arbitraries and shrinks every part independently, and choosing it over flatMap wherever the dependency is not real is the single decision that decides how good your minimal failing cases are"
sidebar_label: "05c · Composing arbitraries"
sidebar_position: 23
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Combining
> Arbitraries*, *Combining Arbitraries with combine*, *Combining Arbitraries vs Flat Mapping*,
> *Filtering Combinations* and *Flat Combination*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); and the **jqwik 1.10.1
> javadoc** for `net.jqwik.api.Combinators`
> ([jqwik.net](https://jqwik.net/docs/1.10.1/javadoc/net/jqwik/api/Combinators.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** Every signature, default and warning
> below is quoted or paraphrased from the guide and the javadoc; none of it is the output of a
> run here.

**[05](05-generators.md) gave you one arbitrary per type. [05b](05b-constraining-generation.md)
narrowed each one. Neither gets you an `Order` — a real domain object is three to eight
generated parts assembled into one value, and jqwik gives you two mechanisms for that.
`Combinators.combine` takes parts that do not depend on each other and shrinks all of them
independently and aggressively; `flatMap` takes a generated value and builds the *next*
arbitrary out of it, which is the only way to express a real dependency and, by the guide's own
words, cannot shrink as well. Almost everyone learns `flatMap` first, uses it everywhere, and
then wonders why their minimal failing cases are not minimal. This page is the `combine` side
of that decision; [05c3](05c3-dependent-generation.md) is the `flatMap` side.**

## The one decision: is the dependency real?

Ask it of every pair of generated values you are about to assemble.

- **No dependency** — a customer name and an order total are independent; any name goes with
  any total. Use `Combinators.combine`.
- **Real dependency** — a substring's `end` index cannot exceed the string's length, so you
  must generate the string before you can choose the index. Use `flatMap`
  ([05c3](05c3-dependent-generation.md)).
- **Weak dependency** — the two values are independent except that a few combinations are
  invalid. Use `combine(...).filter(...).as(...)`, which stays in the combine world.

The guide states the cost of getting this wrong, in the section *Combining Arbitraries vs Flat
Mapping*, having just shown that a `combine` can always be rewritten as nested `flatMap`:

> *"This approach has two disadvantages, though: The more arbitraries you combine, the more
> nesting of flat maps will you need. This does not only look ugly, but it's also hard to
> understand. Since flat mapping is about the dependency of one arbitrary on values generated
> by another, shrinking cannot be as aggressive. That means that in many cases using
> `combine(..)` will lead to better shrinking behaviour than nested `flatMap(..)` calls."*

And, immediately after, the limit of `combine`:

> *"The drawback of `combine` is that it cannot replace `flatMap` in all situations. If there
> is a real dependency between arbitraries, you cannot just combine them. Unless filtering
> combinations can take care of the dependency."*

That is the whole decision procedure, and it is worth writing into a review checklist:
**a `flatMap` in a `@Provide` method needs a one-line comment saying what depends on what.**
If nobody can write that comment, it should have been a `combine`.

## `Combinators.combine`: independent parts

The shape is `combine(a1, …, aN).as((v1, …, vN) -> new Thing(...))`. From the guide:

```java
@Provide
Arbitrary<Person> validPeople() {
    Arbitrary<String> names = Arbitraries.strings().withCharRange('a', 'z')
        .ofMinLength(3).ofMaxLength(21);
    Arbitrary<Integer> ages = Arbitraries.integers().between(0, 130);
    return Combinators.combine(names, ages)
        .as((name, age) -> new Person(name, age));
}
```

The javadoc records the arity: there are overloads for 2 through 8 arbitraries, returning
`Combinators.Combinator2` through `Combinators.Combinator8`, each evaluated with `.as(...)`.
The guide states the ceiling and three ways past it:

> *"The `Combinators.combine` method accepts up to 8 parameters of type `Arbitrary`. If you
> need more you have a few options: Consider to group some parameters into an object of their
> own and change your design; Generate inbetween arbitraries e.g. of type `Tuple` and combine
> those in another step; Introduce a build for your domain object and combine them in this
> way."*

There is a fourth the guide's prose does not mention but the javadoc does: an overload
`combine(List<? extends Arbitrary<T>> listOfArbitraries)` returning a
`Combinators.ListCombinator<T>` — *"Combine a list of arbitraries into one"* — for the case
where the parts are homogeneous and their number is not known at compile time.

⚠️ Take the first of the guide's three options seriously. Eight is not a limit jqwik imposes to
annoy you; a domain object needing nine independently-varying constructor arguments is telling
you something, and the generator is the first place that pressure shows up. This is the same
argument as **test data builders** in topic 08 arriving from a different direction.

## Filtering combinations: the weak dependency

When most combinations are valid and a few are not, you do not need `flatMap`. Insert a
`filter` between `combine` and `as`:

```java
@Provide
Arbitrary<String> digitPairsWithoutTwins() {
    Arbitrary<Integer> digits = Arbitraries.integers().between(0, 9);
    return Combinators.combine(digits, digits)
                      .filter((first, second) -> first != second)
                      .as((first, second) -> first + "" + second);
}
```

Note that the predicate takes the *parts*, not the assembled value — that is the point of
putting the filter before `as`, and it is why this stays cheap. The discard economics from
[05b2](05b2-filtering-assumptions-and-discards.md) apply unchanged: this filter rejects one
combination in ten, which is fine; a filter that rejects nine in ten is not, and the ten
thousand trial cliff is still there.

## `flatAs`: combining, then depending

`Combinators` has a `flatAs` terminal that combines several arbitraries and then uses their
values to build a further arbitrary. The guide shows it and then, in the same section, shows
you not to use it:

```java
@Provide
Arbitrary<String> fullName() {
    IntegerArbitrary firstNameLength = Arbitraries.integers().between(2, 10);
    IntegerArbitrary lastNameLength = Arbitraries.integers().between(2, 10);
    return Combinators.combine(firstNameLength, lastNameLength).flatAs((fLength, lLength) -> {
        Arbitrary<String> firstName = Arbitraries.strings().alpha().ofLength(fLength);
        Arbitrary<String> lastName = Arbitraries.strings().alpha().ofLength(fLength);
        return Combinators.combine(firstName, lastName).as((f, l) -> f + " " + l);
    });
}

@Provide
Arbitrary<String> fullName2() {
    Arbitrary<String> firstName = Arbitraries.strings().alpha().ofMinLength(2).ofMaxLength(10);
    Arbitrary<String> lastName = Arbitraries.strings().alpha().ofMinLength(2).ofMaxLength(10);
    return Combinators.combine(firstName, lastName).as((f, l) -> f + " " + l);
}
```

> *"Often, however, there's an easier way to achieve the same goal which does not require the
> flat combination of arbitraries: … This is not only easier to understand but it usually
> improves shrinking."*

Look closely at the first version and you will also spot `fLength` used for both names — a
copy-paste bug that is in the published guide and that the second version cannot express. That
is not a cheap shot at the docs; it is the argument. Generating a length and then generating a
string of that length is a dependency you invented, and inventing dependencies creates places
for bugs to hide.

## Where this connects

- The arbitraries being combined here, and the defaults they carry, are
  [05 · Generators](05-generators.md) and
  [05a · The defaults nobody chooses](05a-the-defaults-you-inherit.md).
- `Builders.withBuilder`, `withProbability` and aggregates with optional parts are
  [05c2 · Builders and optional parts](05c2-builders-and-optional-parts.md).
- `flatMap` and implicit flat mapping are
  [05c3 · Dependent generation](05c3-dependent-generation.md).
- A worked aggregate generator and a checklist for reviewing one are
  [05c4 · A generator for an aggregate](05c4-a-generator-for-an-aggregate.md).
- `oneOf`, `frequencyOf` and the recursive constructions — `lazy`, `lazyOf`, `recursive` — are
  [05c5 · Choosing among arbitraries](05c5-choosing-among-arbitraries.md); the recursive case is
  [05c6 · Recursive arbitraries](05c6-recursive-arbitraries.md).
- Why a `filter` between `combine` and `as` is cheap and a `filter` on the assembled value is
  not is [05b2 · Filtering, assumptions and discards](05b2-filtering-assumptions-and-discards.md).
- Why `flatMap` shrinks worse, in mechanism rather than in assertion, is
  [06 · Shrinking](06-shrinking.md).
- The aggregate-building argument from the non-property side — builders, object mothers,
  fixtures — is [08 · Test data patterns](../08-test-data-patterns/README.md).

## Gotchas

**★ `Combinators.combine` stops at 8 arbitraries and the compile error names an overload, not the limit.**
The javadoc has `combine` overloads for 2 through 8 returning `Combinator2` through
`Combinator8`; a ninth argument fails to resolve. The error a developer sees is "no suitable
method found", which reads like a type problem. The fix is one of the guide's three: group some
parts into their own object, build an intermediate `Tuple`, or switch to
`Builders.withBuilder`. The `List` overload only helps when every part has the same type.

**★ `.filter(...)` on a `Combinator` takes the parts; `.filter(...)` on the resulting `Arbitrary` takes the assembled object, and only one of them is cheap.**
`Combinators.combine(a, b).filter((x, y) -> …).as(...)` rejects a *combination* before the
object is built. `Combinators.combine(a, b).as(...).filter(order -> …)` builds the object and
then throws it away. Both compile, both read almost identically in a diff, and the second one
does construction work on every rejected candidate — plus it makes the shrinker re-run your
constructor on every shrink candidate too.

**★ The guide's own `flatAs` example generates both names from `fLength`, which is exactly the class of bug flat combination invites.**
`Arbitraries.strings().alpha().ofLength(fLength)` appears twice in the published sample, so
`lLength` is generated and discarded. That mistake cannot be made in the `combine` version three
lines below it, because there is no intermediate length to mix up. When a construction is so
easy to get wrong that the reference documentation gets it wrong, prefer the construction that
does not have the failure mode.

**★ `combine(List<Arbitrary<T>>)` erases arity, so the `ListCombinator` hands you a `List<T>` you have to index by position.**
It is the right tool for "N arbitraries of the same type, N known at run time", and the wrong
tool for "seven fields that happen to be `String`". In the second case you now assemble the
object with `values.get(0)`, `values.get(3)` and so on, and the compiler cannot tell you that
you swapped the postcode and the city. Use it only when the parts are genuinely a homogeneous
sequence.

**★ The `as(...)` lambda runs once per generated value *and* once per shrink candidate, so an expensive or side-effecting assembly step is multiplied twice over.**
`as` is not a cheap projection you write once; it is the constructor call jqwik makes for every
try and then again for every candidate the shrinker evaluates. A lambda that hits a database,
reads a file, or calls a validating factory that throws is therefore paying that cost across
the whole run, and it is the reason a generator can dominate a property's runtime while looking
trivial. Keep `as` to construction, and put anything that can fail into the property body where
a failure means something.

**★ `Combinators.combine(digits, digits)` uses the same arbitrary twice, which is fine; `Arbitraries.just(mutableThing)` twice is not.**
Reusing an `Arbitrary` reference in two positions of a `combine` is correct — arbitraries are
generator *descriptions*, and each position generates independently. What is not safe is reusing
a *value*: `Arbitraries.just(oneList)` in two positions hands both positions the same list
instance, so a property that mutates one sees it in the other. That is the same trap
[05a](05a-the-defaults-you-inherit.md) records for `just`, and combining makes it easier to hit
because the two positions look independent.

**★ When do you use `Combinators.combine` and when do you use `flatMap`?**
`combine` when the parts are independent, `flatMap` when one part has to exist before the
arbitrary for the next part can be built. The example that makes it concrete is
`String.substring(begin, end)`: you cannot choose a legal `end` until you know the string's
length, so the string has to be generated first and the index arbitrary constructed inside the
lambda — that is a real dependency and only `flatMap` expresses it. A person's name and age have
no such relationship, so combining them is both clearer and strictly better, because the guide
states that flat mapping cannot shrink as aggressively: the second arbitrary was derived from
the first value, so shrinking the first one invalidates the second and the shrinker has less
room. The practical rule I use in review is that every `flatMap` should carry a comment naming
what depends on what; if the comment cannot be written, it should have been a `combine`.

**★ Two generated values must never be equal. Where do you put that rule, and why not in an `Assume.that`?**
Between `combine` and `as`, as a `filter` on the parts — the guide's own `digitPairsWithoutTwins`
shape. That rejects the combination before the object is constructed and before the property
body runs, so it costs one re-roll of the dice and nothing else. `Assume.that(first != second)`
inside the property produces the same logical result and pays for it three times over: the
object is built, the property is entered, the try is discarded, and the discard counts against
`maxDiscardRatio`. With ten digits the rejection rate is one in ten and either would survive;
with a domain where collisions are common, the assumption version starts failing the property
with an exhaustion error while the filter version keeps working. The general rule from
[05b2](05b2-filtering-assumptions-and-discards.md) holds: reject as early in the pipeline as the
constraint allows.

**★ The guide demonstrates `flatAs` and then immediately shows a version that does not need it. When would you actually reach for it?**
Rarely, and only when the *shape* of the second stage genuinely depends on the values of the
first — for instance, generating a matrix where you must pick a row count and a column count
before you can build an arbitrary of rows of exactly that width. The guide's own example is not
that: it generates two lengths and then two strings of those lengths, which is identical to just
generating two strings with a min and max length, and the guide says so — *"This is not only
easier to understand but it usually improves shrinking."* The mental check I apply is whether
the first-stage values appear in the final object at all. In the `fullName` example they do not;
they are scaffolding, and scaffolding you have to generate is scaffolding that has to shrink.
When the first-stage values *are* part of the result — a dimension you later assert on — `flatAs`
or a plain `flatMap` returning a record is the honest structure.

{/* FOOTER */}
