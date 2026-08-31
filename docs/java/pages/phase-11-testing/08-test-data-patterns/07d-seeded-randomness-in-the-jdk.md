---
title: "ThreadLocalRandom's javadoc says outright that its seed may not be modified and setSeed throws, so any class built on it is untestable by construction — and the JDK 17 RandomGenerator interface that replaces Random has no seeded factory method at all"
sidebar_label: "07d · Seeded randomness in the JDK"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the JDK 25 javadoc for `java.util.Random`
> ([Random](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Random.html)),
> `java.util.concurrent.ThreadLocalRandom`
> ([ThreadLocalRandom](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ThreadLocalRandom.html)),
> `java.util.random.RandomGenerator`
> ([RandomGenerator](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/random/RandomGenerator.html)),
> `java.util.random.RandomGeneratorFactory`
> ([RandomGeneratorFactory](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/random/RandomGeneratorFactory.html))
> and the `java.util.random` package summary
> ([package-summary](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/random/package-summary.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, AssertJ 3.27.7. **No sandbox** — Java source and
> documented behaviour only, never a run, and no generated value is reproduced as if observed.

**[07c](07c-generated-ids.md) dealt with identifiers. This chunk deals with the generator behind
them, and with the one JDK class whose javadoc explicitly forecloses testability. The argument is
the same one [06](06-random-and-time.md) made about the clock — make the global a parameter — but
the API surface is messier than people expect: `RandomGenerator.of(name)` takes no seed, the
seeded route can throw, and the strong cross-version reproducibility guarantee is written for the
algorithm the package summary tells you to stop using.**

## `ThreadLocalRandom` is untestable by construction

> *"Like the global `Random` generator used by the `Math` class, a `ThreadLocalRandom` is
> initialized with an internally generated seed **that may not otherwise be modified**."*

And, on `setSeed(long)`:

> *"Throws `UnsupportedOperationException`. Setting seeds in this generator is not supported."*

The JDK is telling you, in the API, that anything built on `ThreadLocalRandom.current()` cannot be
made reproducible from the outside. That is a fine property for the job it was designed for —

> *"Usages of this class should typically be of the form:
> `ThreadLocalRandom.current().nextX(...)` (where `X` is `Int`, `Long`, etc). When all usages are
> of this form, it is never possible to accidentally share a `ThreadLocalRandom` across multiple
> threads."*

— and a design defect the moment production *behaviour* depends on the values it produces.

```java
// untestable: no seam, and the API forbids one
String code = "P-" + ThreadLocalRandom.current().nextInt(100_000, 999_999);
```

```java
// testable: the source is a parameter, exactly like the Clock in 06
class PromoCodes {
    private final RandomGenerator random;
    PromoCodes(RandomGenerator random) { this.random = random; }

    String next() { return "P-" + random.nextInt(100_000, 999_999); }
}
```

`RandomGenerator` is the right parameter type: `Random`, `SplittableRandom`, `ThreadLocalRandom`
and `SecureRandom` all appear as algorithm names in the package summary's "Legacy" group and all
implement the interface, so **production loses nothing** — it can still pass
`ThreadLocalRandom.current()` — while a test can pass a seeded generator. This is the clock
argument applied to a different global, and it costs the same one constructor parameter.

## Getting a seeded `RandomGenerator` is not the one-liner you expect

The obvious call does **not** take a seed:

> `RandomGenerator.of(String name)` — *"Returns an instance of `RandomGenerator` that utilizes the
> `name` algorithm."*

There is no overload that accepts one. The seeded path goes through the factory:

> `RandomGeneratorFactory.create(long seed)` — *"Create an instance of `RandomGenerator` based on
> the algorithm chosen, and the provided seed. If the `RandomGenerator` doesn't support
> instantiation through a seed of type `long` then this method throws an
> `UnsupportedOperationException`."*

```java
RandomGenerator seeded =
    RandomGeneratorFactory.of("L64X128MixRandom").create(20260831L);
```

Three things to know before relying on that.

**1 · `create(long)` can throw.** The javadoc says so explicitly for algorithms that do not support
`long` seeding, and `RandomGeneratorFactory.of(name)` itself throws `IllegalArgumentException`
*"if the named algorithm is not found"*. `SecureRandom` and `ThreadLocalRandom` are both listed as
algorithm names in the package summary and neither is seedable in this sense.

**2 · Do not use `getDefault()` when you want reproducibility.**

> *"Since algorithms will improve over time, there is no guarantee that this method will return the
> same algorithm over time."*

That is documented for both `RandomGenerator.getDefault()` and `RandomGeneratorFactory.getDefault()`,
and `RandomGenerator.getDefault()`'s javadoc adds that *"The default implementation selects
L32X64MixRandom"* — a statement about today, not a contract. Name the algorithm.

**3 · 🔴 The cross-version reproducibility guarantee is documented for `java.util.Random` and, as
far as I could verify, not for the LXM algorithms.** `Random`'s javadoc is unambiguous:

> *"If two instances of `Random` are created with the same seed, and the same sequence of method
> calls is made for each, they will generate and return identical sequences of numbers. In order to
> guarantee this property, particular algorithms are specified for the class `Random`. Java
> implementations must use all the algorithms shown here for the class `Random`, for the sake of
> absolute portability of Java code."*

The `java.util.random` package summary describes the LXM algorithms' mathematical properties
without making an equivalent portability promise — and it simultaneously advises moving away from
`Random`: *"Random (LCG) is the weakest of the available algorithms, and it is recommended that
users migrate to newer algorithms."* The two pieces of advice pull in opposite directions, and it
is worth knowing which one applies to your case.

**What to do with that:** for a *test* that must be reproducible on this JDK, in this build, a
seeded `L64X128MixRandom` is fine — reproducibility within a run and across runs of the same JVM is
exactly what a test needs, and it is the better algorithm. For anything where a value must be
identical across JDK versions — a recorded expectation, a checked-in fixture, a distributed
algorithm that must agree between nodes on different runtimes — `java.util.Random` is the only one
whose javadoc promises it, and a literal is better than either.

## The algorithm names you can rely on being present

The package summary lists the algorithms that *"must be found with the current version of Java
SE"*: the LXM family (`L32X64MixRandom`, `L64X128MixRandom`, `L64X128StarStarRandom`,
`L64X256MixRandom`, `L64X1024MixRandom`, `L128X128MixRandom`, `L128X256MixRandom`,
`L128X1024MixRandom`), the Xoroshiro/Xoshiro pair (`Xoroshiro128PlusPlus`, `Xoshiro256PlusPlus`),
and the legacy group (`Random`, `SplittableRandom`, `SecureRandom`, `ThreadLocalRandom`).

`RandomGeneratorFactory` also exposes capability predicates — `isJumpable()`, `isSplittable()`,
`isDeprecated()` — which matter if you are selecting an algorithm programmatically. For a test
fixture you are not; you are naming one constant string.

## Where this connects

- Identifiers, and where an entity's id should come from: [07c · Generated ids](07c-generated-ids.md).
- Seeds, printing them, and the two honest configurations:
  [07b · The seed discipline](07b-the-seed-discipline.md).
- The same "make the global a parameter" argument applied to time:
  [06 · Random and time](06-random-and-time.md).
- Which generator is cryptographically strong, and RFC 9562:
  [Phase 7 · UUID and randomness](../../phase-7-io-time-stdlib/07-uuid-and-randomness.md).
- Unseeded randomness as a flake:
  [14b · Time and determinism](../01-junit-5/14b-time-and-determinism.md).

## Gotchas

**★ `ThreadLocalRandom.current()` inside production code you need to test.**
The javadoc states the seed *"may not otherwise be modified"* and that `setSeed` throws
`UnsupportedOperationException`. There is no seam and the API refuses to add one. Take a
`RandomGenerator` parameter instead; `ThreadLocalRandom` still implements it, so production loses
nothing.

**★ Expecting `RandomGenerator.of(name)` to take a seed.**
It does not — there is no such overload. The seeded route is
`RandomGeneratorFactory.of(name).create(seed)`, and that `create(long)` is documented to throw
`UnsupportedOperationException` for algorithms that do not support `long` seeding.

**★ `RandomGeneratorFactory.getDefault()` in anything that must be reproducible.**
Documented: *"Since algorithms will improve over time, there is no guarantee that this method will
return the same algorithm over time."* A JDK upgrade can silently change the algorithm and every
value your seed produces. Name the algorithm explicitly.

**★ Assuming an LXM algorithm's seeded sequence is portable across JDK versions.**
`java.util.Random`'s javadoc promises exactly that for `Random` — implementations "must use all the
algorithms shown here … for the sake of absolute portability". I could not find an equivalent
promise for `L64X128MixRandom` and the rest, so do not build a checked-in expectation on one.
Within a build, seeded LXM is fine and preferable; across versions, use a literal.

**★ `SecureRandom` used as a test fixture source.**
It is the right choice when a value must be unguessable and the wrong one for test data: it cannot
be reproduced, it may block on entropy in a constrained environment, and it is slower. Reserve it
for the production paths that need it and let tests use a seeded generator or a literal.

**★ A misspelled algorithm name, which fails at runtime rather than compile time.**
`RandomGeneratorFactory.of(name)` throws `IllegalArgumentException` *"if the named algorithm is not
found"*. The names are strings, so a typo survives compilation and surfaces as a test-setup failure
that reads like a classpath problem. Put the name in one constant.

**★ Sharing one seeded generator across a parallel suite.**
The same defect as a shared `Faker` ([07b](07b-the-seed-discipline.md)): the seed is fixed but the
interleaving of draws across threads is not, so each test sees a different slice on each run. And
`java.util.Random`'s javadoc warns separately that *"the concurrent use of the same
`java.util.Random` instance across threads may encounter contention and consequent poor
performance"*. One generator per test.

**★ Switching a class from `Random` to `RandomGenerator` and expecting the same values.**
The interface change is source-compatible; the *algorithm* is not the same unless you keep passing
a `Random`. Any test that recorded values produced by `new Random(seed)` will fail against a seeded
LXM generator, and correctly so — those expectations were pinned to an algorithm, which is why they
should not have been recorded.

**★ Using `Math.random()` anywhere in code under test.**
It delegates to a single global `Random` that nothing can seed or replace — the same defect as
`ThreadLocalRandom` with fewer redeeming properties, since it also has the contention problem.
There is no case where it is preferable to an injected `RandomGenerator`.

## Interview questions

**★ Why is `ThreadLocalRandom` in production code a testing problem?**
Because the API explicitly refuses the seam. Its javadoc says the generator "is initialized with an
internally generated seed that may not otherwise be modified", and `setSeed` is documented to throw
`UnsupportedOperationException`. So a class calling `ThreadLocalRandom.current().nextInt(...)` has
a hidden input that nothing outside it can control, and any test of behaviour that depends on the
value is testing whatever the JVM happened to produce. The fix is the same shape as injecting a
`Clock`: take a `RandomGenerator` parameter. Production can still pass
`ThreadLocalRandom.current()` — it implements the interface — so nothing is lost operationally, and
the test can pass a seeded generator.

**★ How do you obtain a seeded, reproducible generator through the JDK 17+ `RandomGenerator` API?**
Not through `RandomGenerator.of(name)`, which has no seed parameter. You go through
`RandomGeneratorFactory.of("L64X128MixRandom").create(seed)`, naming the algorithm rather than
using `getDefault()`, because the javadoc warns that the default may change over time. Two caveats
worth stating: `create(long)` is documented to throw `UnsupportedOperationException` for algorithms
that do not support `long` seeding — `SecureRandom` and `ThreadLocalRandom` are in that category —
and the strong cross-implementation portability guarantee is written for `java.util.Random`, not,
as far as I could verify, for the LXM algorithms. So seeded LXM is right for reproducibility within
a build, and `Random` or a literal is right for anything that must survive a JDK upgrade.

**★ The package summary says to migrate off `Random`, but `Random` is the only one with a portability guarantee. How do you reconcile that?**
By separating the two things the advice is about. The migration advice is about *quality*: `Random`
is a 48-bit LCG with a short period, and the package summary calls it "the weakest of the available
algorithms". The portability guarantee is about *reproducibility across implementations*, which
`Random`'s javadoc states in the strongest terms because the algorithm is specified in the
documentation itself. Almost all code needs the first and not the second: a promo-code generator, a
jitter calculation, a shuffling routine want a good generator, and nothing checks their values
against a recording. The narrow set of cases that need the second — a value written into a golden
file, a hash-partitioning scheme that must agree between nodes on different JDKs — should usually
not be using a general-purpose PRNG at all.

**★ When is `SecureRandom` the right choice, and why not just use it everywhere?**
When someone benefits from predicting the value — session tokens, password-reset links, API keys,
anything an attacker would guess. Not everywhere, for three reasons: it cannot be seeded, so any
code built on it is unreproducible by construction; it can block on entropy in constrained
environments; and it is slower than the alternatives for bulk generation. For test data you want
either a seeded generator or a literal, and for high-volume non-security values
`ThreadLocalRandom` or an LXM algorithm behind a `RandomGenerator` parameter.

**★ A colleague injects `Random` rather than `RandomGenerator`. Does it matter?**
A little, and in the same direction as `Clock` versus `InstantSource`
([06b](06b-what-to-inject.md)). `Random` is a concrete class pinned to one specific 48-bit LCG, so
the parameter type over-specifies: production cannot pass `SplittableRandom` for forked parallel
work, cannot pass `SecureRandom` where the value must be unguessable, and cannot pass a better LXM
algorithm later without touching every signature. `RandomGenerator` is the interface all of them
implement, and it costs nothing to depend on. The one case for `Random` in the signature is code
that genuinely requires the documented cross-implementation sequence, and that requirement should
be written down where the parameter is declared.

{/* FOOTER */}
