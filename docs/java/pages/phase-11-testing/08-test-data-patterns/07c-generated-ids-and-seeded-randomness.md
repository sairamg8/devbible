---
title: "UUID.randomUUID() is the right tool for uniqueness and a defect in an assertion, ThreadLocalRandom is untestable by construction because its javadoc says the seed cannot be modified, and the JDK 17 RandomGenerator interface has no seeded factory at all"
sidebar_label: "07c · Generated ids and seeded randomness"
sidebar_position: 50
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the JDK 25 javadoc for `java.util.UUID`
> ([UUID](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/UUID.html)),
> `java.util.Random`
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
> documented behaviour only, never a run, and no generated identifier is reproduced as if
> observed.

**The last piece of generated test data is the one nobody thinks of as generated: identifiers.
`UUID.randomUUID()` in a fixture is usually correct and in an assertion is always wrong;
`ThreadLocalRandom` in production code makes a class untestable by construction, and the javadoc
says why in one sentence; and the JDK 17 `RandomGenerator` interface — the modern replacement for
`Random` — has no seeded factory method, so obtaining a reproducible generator through it is not
the one-liner people expect. This chunk covers all three, plus the design question underneath
them: where an entity's id comes from.**

## `UUID.randomUUID()` — uniqueness, not arbitrariness

> *"Static factory to retrieve a type 4 (pseudo randomly generated) UUID. The `UUID` is generated
> using a cryptographically strong pseudo random number generator."*

That is the right tool for a **unique** value and the wrong one for an **arbitrary** value, and the
distinction decides every question about it.

**Correct use — per-test isolation:**

```java
String email = "customer-" + UUID.randomUUID() + "@example.test";
```

Two tests running against the same schema cannot collide on that, which removes a whole family of
order-dependent database failures without any coordination between tests. This is the single most
useful thing `randomUUID()` does in a test suite.

**Incorrect use — an assertion:**

```java
assertThat(saved.id()).isEqualTo(expectedId);   // where expectedId also came from randomUUID
```

Circular in the same way [07](07-faker-and-generated-data.md)'s generated-name assertion is: both
sides came from the same call. Assert that the *row exists under the id you were given*, or that
the id is non-null, or — better — assert on a business field and let the id be plumbing.

⚠️ **`randomUUID()` is not a seedable generator.** It draws from a cryptographically strong source,
so there is no "fixed seed" variant, and any test needing reproducible ids has to inject them
rather than generate them (see the last section).

### `nameUUIDFromBytes` — the deterministic sibling

> *"Static factory to retrieve a type 3 (name based) `UUID` based on the specified byte array."*

`UUID.nameUUIDFromBytes("order-1".getBytes(UTF_8))` gives the same UUID every time for the same
input. That is occasionally exactly what a fixture wants: stable, readable-in-origin ids that do
not collide across *different* names, without a hard-coded literal.

⚠️ Two limits before you reach for it. It is **not unique** — the same name always yields the same
UUID, so it removes the per-test isolation property that made `randomUUID()` useful. And type 3
UUIDs are MD5-based, so they are not a security primitive; do not use them where the value must be
unguessable.

## Ordering by a generated id

`UUID` implements `Comparable<UUID>`, and the javadoc defines the order:

> *"The first of two UUIDs is greater than the second if the most significant field in which the
> UUIDs differ is greater for the first UUID."*

That is a **total order with no relationship to insertion order**. A test that inserts three rows
with random UUID keys and then asserts they come back in insertion order is asserting something
false that happens to be true when the plan returns rows in physical order. It will pass for
months.

If insertion order matters, order by something that encodes it — a sequence, a created-at column
with a tiebreaker ([06h](06h-asserting-on-a-timestamp-you-did-not-choose.md)), or a
time-ordered UUID scheme. `randomUUID()` is version 4 and carries no timestamp;
[Phase 7 · UUID and randomness](../../phase-7-io-time-stdlib/07-uuid-and-randomness.md) covers the
versions and RFC 9562.

## `ThreadLocalRandom` is untestable by construction

> *"Like the global `Random` generator used by the `Math` class, a `ThreadLocalRandom` is
> initialized with an internally generated seed **that may not otherwise be modified**."*

And, on `setSeed(long)`:

> *"Throws `UnsupportedOperationException`. Setting seeds in this generator is not supported."*

The JDK is telling you, in the API, that anything built on `ThreadLocalRandom.current()` cannot be
made reproducible from the outside. That is a fine property for the job it was designed for —
*"Usages of this class should typically be of the form: `ThreadLocalRandom.current().nextX(...)`
(where `X` is `Int`, `Long`, etc). When all usages are of this form, it is never possible to
accidentally share a `ThreadLocalRandom` across multiple threads."* — and a design defect the
moment production behaviour depends on the values.

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
and `SecureRandom` all implement it, so production can pass whichever is appropriate and a test can
pass a seeded one. This is the same argument as
[06 · the clock is a constructor parameter](06-random-and-time.md), applied to a different global.

## Getting a seeded `RandomGenerator` is not the one-liner you expect

The obvious call does **not** take a seed:

> `RandomGenerator.of(String name)` — *"Returns an instance of `RandomGenerator` that utilizes the
> `name` algorithm."*

No overload accepts one. The seeded path goes through the factory:

> `RandomGeneratorFactory.create(long seed)` — *"Create an instance of `RandomGenerator` based on
> the algorithm chosen, and the provided seed. If the `RandomGenerator` doesn't support
> instantiation through a seed of type `long` then this method throws an
> `UnsupportedOperationException`."*

```java
RandomGenerator seeded =
    RandomGeneratorFactory.of("L64X128MixRandom").create(20260831L);
```

Three things to know before relying on that:

1. **`create(long)` can throw.** The javadoc says so explicitly for algorithms that do not support
   `long` seeding — `SecureRandom` and `ThreadLocalRandom` are both listed as algorithm names in
   the package summary's "Legacy" group, and neither is seedable in this sense.
2. **Do not use `getDefault()` when you want reproducibility.** *"Since algorithms will improve over
   time, there is no guarantee that this method will return the same algorithm over time."* Name the
   algorithm.
3. 🔴 **The cross-version reproducibility guarantee is documented for `java.util.Random` and,
   as far as I could verify, not for the LXM algorithms.** `Random`'s javadoc is unambiguous —
   *"If two instances of `Random` are created with the same seed, and the same sequence of method
   calls is made for each, they will generate and return identical sequences of numbers … Java
   implementations must use all the algorithms shown here for the class `Random`, for the sake of
   absolute portability of Java code."* — while the `java.util.random` package summary describes the
   LXM algorithms' properties without making an equivalent portability promise. The package summary
   does say *"Random (LCG) is the weakest of the available algorithms, and it is recommended that
   users migrate to newer algorithms"*, so the two pieces of advice pull in opposite directions.

**What to do with that:** for a *test* that must be reproducible on this JDK, in this build, a
seeded `L64X128MixRandom` is fine — reproducibility within a run and across runs of the same JVM is
what a test needs. For anything where a value must be identical across JDK versions — a recorded
expectation, a checked-in fixture, a distributed algorithm that must agree between nodes on
different runtimes — `java.util.Random` is the only one whose javadoc promises it, and a literal is
better than either.

## Where the id comes from: the domain or the boundary

Everything above is downstream of one design decision, and it is worth naming because it decides
how testable the whole aggregate is.

**Generated in the domain** — the entity assigns its own id at construction:

```java
record OrderId(UUID value) {
    static OrderId next() { return new OrderId(UUID.randomUUID()); }   // hidden global
}
```

That is `LocalDate.now()` again. The id is an input the caller cannot supply, so no test can name
the order it just created, and no fixture can pin one.

**Supplied at the boundary** — the application service generates and passes in:

```java
class OrderService {
    private final Supplier<OrderId> ids;                 // or an IdGenerator interface

    Order place(Basket basket) { return new Order(ids.get(), basket); }
}
```

Now a test passes `() -> new OrderId(UUID.fromString("00000000-0000-4000-8000-000000000001"))`,
the fixture reads as a fact, and assertions can name the id without being circular. Production
passes `OrderId::next`.

⚠️ There is a real counter-argument in a JPA codebase: database-generated identity keys mean the id
does not exist until flush, which has its own consequences for equality and batching
([Phase 10 · The identifier](../../phase-10-data-access/06-jpa-hibernate-model/06-the-identifier.md)).
Application-assigned UUIDs avoid that and cost index locality. That trade-off is a persistence
decision, not a testing one — but the testing consequence is worth putting on the scale, because an
id supplied at the boundary is the difference between a fixture that states its ids and one that
discovers them.

## Where this connects

- The rule about where generated values may appear:
  [07 · Faker and generated data](07-faker-and-generated-data.md).
- Seeds, and the two honest configurations: [07b · The seed discipline](07b-the-seed-discipline.md).
- The same "make the global a parameter" argument applied to time:
  [06 · Random and time](06-random-and-time.md).
- UUID versions, RFC 9562 and which generator is cryptographically strong:
  [Phase 7 · UUID and randomness](../../phase-7-io-time-stdlib/07-uuid-and-randomness.md).
- The flake catalogue: [14b · Time and determinism](../01-junit-5/14b-time-and-determinism.md).
- Property-based testing, which generates inputs on purpose and checks invariants:
  **10 · Property-based testing** *(not written yet)*.

## Gotchas

**★ Asserting on a value produced by `UUID.randomUUID()`.**
Both sides of the comparison came from the same call, so the assertion holds regardless of what the
code under test did. Assert that the row exists under the id you were handed, or assert on a
business field and treat the id as plumbing.

**★ `UUID.randomUUID()` cannot be seeded, so "just fix the seed" is not available.**
The javadoc says it is generated by "a cryptographically strong pseudo random number generator" —
there is no seeded overload. If a test needs a specific id, it must supply it, which means the id
has to be an input somewhere. That is a design change, not a test change.

**★ Ordering rows by a random UUID key and expecting insertion order.**
`UUID` is `Comparable`, and the order is lexicographic over the bit fields — unrelated to when the
row was inserted. The test passes while the plan happens to return physical order and fails after
an index is added. Order by a sequence or a timestamp with a tiebreaker.

**★ `nameUUIDFromBytes` used where uniqueness was the requirement.**
It is deterministic by design: the same name always yields the same UUID. That is the feature, and
it destroys the per-test isolation that `randomUUID()` was providing. Use it for stable fixture
ids, never for "a unique value per test".

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

**★ An entity that generates its own id in its constructor.**
Exactly the `LocalDate.now()` defect in a different costume: an input the caller cannot supply, so
no test can name the object it just created and no fixture can pin one. Supply the id at the
boundary through a `Supplier` or an `IdGenerator` interface; production passes the random one.

**★ Using a random id as the *only* thing distinguishing two fixture rows.**
If two rows differ only by a generated UUID, no assertion can say which is which without depending
on the generated value. Give fixture rows a distinguishing business field — a different name, a
different amount — and let the ids be uninteresting.

## Interview questions

**★ Is `UUID.randomUUID()` in a test a problem?**
Not by itself, and it solves a real one. As a source of *uniqueness* it is exactly right: a
per-test key that cannot collide with another test's data removes a whole family of
order-dependent database failures with no coordination between tests. It becomes a defect the
moment the value reaches an assertion, because both sides then came from the same call and the
comparison holds whatever the code did — and it becomes a different kind of defect if rows are
ordered by it, since UUID ordering is lexicographic over the bit fields and has no relationship to
insertion order. The distinction to hold is unique versus arbitrary: it is a good source of the
first and a bad source of the second.

**★ Why is `ThreadLocalRandom` in production code a testing problem?**
Because the API explicitly refuses the seam. Its javadoc says the generator "is initialized with an
internally generated seed that may not otherwise be modified", and `setSeed` is documented to throw
`UnsupportedOperationException`. So a class calling `ThreadLocalRandom.current().nextInt(...)` has
a hidden input that nothing outside it can control, and any test of behaviour that depends on the
value is testing whatever the JVM happened to produce. The fix is the same shape as injecting a
`Clock`: take a `RandomGenerator` parameter. Production can still pass `ThreadLocalRandom.current()`
— it implements the interface — so nothing is lost operationally, and the test can pass a seeded
generator.

**★ How do you obtain a seeded, reproducible generator through the JDK 17+ `RandomGenerator` API?**
Not through `RandomGenerator.of(name)`, which has no seed parameter. You go through
`RandomGeneratorFactory.of("L64X128MixRandom").create(seed)`, and you name the algorithm rather than
using `getDefault()`, because the javadoc warns that the default may change over time. Two caveats
worth stating: `create(long)` is documented to throw `UnsupportedOperationException` for algorithms
that do not support `long` seeding — `SecureRandom` and `ThreadLocalRandom` are in that category —
and the strong cross-implementation portability guarantee is written for `java.util.Random`, not,
as far as I could verify, for the LXM algorithms. So seeded LXM is right for reproducibility within
a build, and `Random` or a literal is right for anything that must survive a JDK upgrade.

**★ Where should an entity's identifier come from, and what does it cost either way?**
For testability, from the boundary: the application service holds a `Supplier<OrderId>` or an
`IdGenerator`, production passes the random implementation, and a test passes a fixed one. That
turns the id from something the test discovers into something the test states, which makes fixtures
readable and assertions non-circular. The counter-argument is persistence, not testing: database
identity generation defers the id to flush, which affects entity equality and batching, and
application-assigned UUIDs cost index locality compared with a sequence. Those are real trade-offs
and they belong to the data-access decision — but the testing consequence deserves a place on the
scale, because an entity that generates its own id in its constructor has the same defect as one
that calls `LocalDate.now()`.

**★ A test inserts three rows and asserts they come back in the order inserted. It has passed for a year and now fails. What happened?**
Almost certainly the sort key never encoded insertion order, and something changed the plan — a new
index, updated statistics, a version upgrade — so the engine stopped returning rows in physical
order. If the key is a random UUID, the ordering is lexicographic over the bit fields and unrelated
to time; if it is a timestamp, rows written in one transaction can tie
([06h](06h-asserting-on-a-timestamp-you-did-not-choose.md)). Either way the test was relying on an
accident. The fix is a real ordering: a sequence column, or a timestamp with a deterministic
tiebreaker, in the production query as well as the assertion.

**★ When is `SecureRandom` the right choice, and why not just use it everywhere?**
When someone benefits from predicting the value — session tokens, password-reset links, API keys,
anything an attacker would guess. Not everywhere, for three reasons: it cannot be seeded, so any
code built on it is unreproducible by construction; it can block on entropy in constrained
environments; and it is slower than the alternatives for bulk generation. For test data you want
either a seeded generator or a literal, and for high-volume non-security values `ThreadLocalRandom`
or an LXM algorithm behind a `RandomGenerator` parameter.

{/* FOOTER */}
