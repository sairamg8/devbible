---
title: "A seed you did not print is a failure you cannot reproduce, and a seed you hard-coded is a fixed fixture with extra steps — those are the only two honest configurations, and choosing between them is choosing what the generated data is for"
sidebar_label: "07b · The seed discipline"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the Datafaker documentation *Basic usage*
> ([datafaker.net](https://www.datafaker.net/documentation/usage/)) and *Getting started*
> ([datafaker.net](https://www.datafaker.net/documentation/getting-started/)); the JDK 25
> javadoc for `java.util.Random`
> ([Random](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Random.html)).
> ⚠️ The Datafaker documentation states that seeding makes instantiation "predictable"; it does
> **not** state that a given seed yields the same values across Datafaker versions, and no such
> guarantee is claimed here. Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring
> Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3, AssertJ 3.27.7. Datafaker is **not**
> managed by the Boot BOM. **No sandbox** — Java source and documented behaviour only, never a
> run, and no generated value is reproduced as if observed.

**[07](07-faker-and-generated-data.md) drew the line: generated data in fields nobody asserts on.
This chunk is about the property that decides whether crossing that line is recoverable. An
unseeded generator produces a failure whose input is nowhere in the report; a seeded one produces
a fixture that only looks varied. Both are defensible and they are defensible for opposite
reasons, so the mistake is not picking one — it is not knowing which one you picked.**

## What Datafaker documents about seeding

> *"To generate a more predictable random result, it's possible to provide a seed value to the
> Faker."*

```java
Faker faker = new Faker(new Random(0));
```

> *"when providing a seed, the instantiation of Fake objects will always happen in a predictable
> way, which can be handy for generating results multiple times."*

Read that sentence carefully, because it is narrower than people assume. It says that *given this
`Faker`, seeded this way, the sequence of calls produces the same sequence of values*. The
underlying `java.util.Random` backs that up with a much stronger, explicitly portable guarantee:

> *"If two instances of `Random` are created with the same seed, and the same sequence of method
> calls is made for each, they will generate and return identical sequences of numbers. In order
> to guarantee this property, particular algorithms are specified for the class `Random`. Java
> implementations must use all the algorithms shown here for the class `Random`, for the sake of
> absolute portability of Java code."*

⚠️ That portability guarantee is about `Random`'s **numbers**, not about Datafaker's **values**.
The mapping from a random `long` to `"Marisol Kertzmann"` is Datafaker's data files and
algorithms, and nothing in its documentation promises those are stable across versions. So a
seeded `Faker` is reproducible *within a version*, which is what a test needs, and is **not** a
safe basis for anything recorded to disk. That is the mechanism behind
[07](07-faker-and-generated-data.md)'s golden-file rule.

The same sentence has a second consequence: reproducibility requires *"the same sequence of method
calls"*. Add one `faker.name().firstName()` to a builder and every value drawn after it shifts.
A seeded suite is therefore reproducible for a given commit, not across commits — which is fine,
and worth knowing before someone treats a seeded value as a stable expectation.

## Configuration A — random seed, printed

The generator varies every run, and the run tells you what it chose. This is the configuration
that gets the benefit [07](07-faker-and-generated-data.md) calls the strongest one — surfacing
accidental dependencies on a specific literal — without the failure mode that gives it a bad name.

```java
class FakerExtension implements BeforeEachCallback, TestWatcher {

    private static final Namespace NS = Namespace.create(FakerExtension.class);

    @Override
    public void beforeEach(ExtensionContext context) {
        long seed = Long.getLong("test.faker.seed", new SecureRandom().nextLong());
        context.getStore(NS).put("seed", seed);
        context.getStore(NS).put("faker", new Faker(new Random(seed)));
    }

    @Override
    public void testFailed(ExtensionContext context, Throwable cause) {
        Long seed = context.getStore(NS).get("seed", Long.class);
        System.err.printf("%s failed with -Dtest.faker.seed=%d%n",
                          context.getDisplayName(), seed);
    }
}
```

Three things make that worth the twenty lines:

1. **The seed is chosen per test method**, so one failing test does not require re-running the
   whole suite to reproduce.
2. **The failure names the exact flag** that reproduces it. A developer copies one line.
3. **`-Dtest.faker.seed=…` pins it**, which is how you convert an intermittent failure into a
   deterministic one before you start debugging.

The extension mechanics — `Namespace`, the `Store`, `TestWatcher` — belong to
[10i · The store hierarchy](../01-junit-5/10i-the-store-hierarchy.md) and
[10h · Keeping state](../01-junit-5/10h-keeping-state.md); the point here is only that the seed
must reach the report, and JUnit gives you the hook.

⚠️ `TestWatcher.testFailed` is the reliable place for this. Printing the seed unconditionally in
`beforeEach` floods a passing build with noise nobody reads, and a line nobody reads is not a
record.

## Configuration B — fixed seed, and the honesty it requires

```java
private static final Faker FAKER = new Faker(new Random(20260831L));
```

This is reproducible, quiet, and — say it plainly — **a fixed fixture with extra steps**. Every
run produces the same names in the same order. The suite no longer explores anything; it has a set
of hard-coded values that happen to be spelled as a generator call.

That is a legitimate choice, and it beats a hand-written literal in exactly one respect: the values
still *look* arbitrary, so nobody is tempted to assert on them. It buys the readability half of
[07](07-faker-and-generated-data.md)'s argument and abandons the discovery half.

What it must not do is pretend to be Configuration A. The tells that a team has confused them:

- a fixed seed *and* a "flaky Faker test" ticket — impossible, so something else is
  non-deterministic and the seed is masking the search;
- a fixed seed *and* an argument that "generation gives us coverage" — it gives one point, chosen
  once, at random, and never revisited;
- a fixed seed on a `static final` field shared across a suite that runs in parallel, where the
  *draw order* is then non-deterministic even though the seed is not.

That last one is the real trap and it deserves its own paragraph.

## A shared seeded `Faker` under parallel execution is not deterministic

`new Faker(new Random(seed))` is one generator with one advancing state. If it is a `static final`
field and the suite runs in parallel ([12 · Parallel execution](../01-junit-5/12-parallel-execution.md)),
the *interleaving* of draws across threads varies run to run — so test A gets different values on
different runs even though the seed never changed. The seed is fixed; the sequence each test sees
is not.

Worse, `java.util.Random` is thread-safe but contended — the javadoc says so, and recommends
`ThreadLocalRandom` *"in multithreaded designs"*, which cannot be seeded at all
([07c](07c-generated-ids.md)). So the shared instance is both
non-reproducible and a contention point.

**The fix is one `Faker` per test**, created in `@BeforeEach` or by an extension, seeded from a
per-test seed. Then the draw sequence a test sees depends only on that test's own calls, and
parallelism changes nothing.

```java
class OrderServiceTest {

    private Faker faker;

    @BeforeEach
    void seedFaker(TestInfo info) {
        long seed = info.getDisplayName().hashCode();     // deterministic per test, distinct
        faker = new Faker(new Random(seed));
    }
}
```

That variant — deriving the seed from the test's identity — gives per-test determinism without a
global constant and without cross-test coupling. It is the middle option people usually want when
they say "seeded".

## Choosing, in one question

> **Do you want this suite to find inputs you did not think of?**

- **Yes** → Configuration A. Random per run, seed printed on failure, seed pinnable by flag. Accept
  that a failure may appear once and that you must be able to reproduce it in one command.
- **No** → Configuration B, or a per-test derived seed. Say so in a comment, and stop describing the
  data as "random" in conversation, because it is not.

And if the honest answer is "I want it to find inputs I did not think of, *and* I want an
assertion stronger than one example" — that is property-based testing, not Faker
(**10 · Property-based testing** *(not written yet)*).

## Where this connects

- The rule that decides where generated values may appear:
  [07 · Faker and generated data](07-faker-and-generated-data.md).
- Seeded JDK generators, `RandomGenerator`, and generated ids:
  [07c · Generated ids](07c-generated-ids.md).
- Where per-test state lives in JUnit: [10h · Keeping state](../01-junit-5/10h-keeping-state.md).
- Random test *ordering*, which prints its seed for exactly this reason:
  [11b · Random order](../01-junit-5/11b-random-order.md).
- The flake catalogue this belongs to: [14b · Time and determinism](../01-junit-5/14b-time-and-determinism.md).

## Gotchas

**★ An unseeded generator whose failing input is nowhere in the report.**
You get an assertion diff and no way to reconstruct the input, which is a worse position than
having no test. It is entirely preventable with a `TestWatcher` that prints the seed on failure,
and any team running Faker without one has accepted a permanent debugging tax.

**★ A fixed seed described in conversation as "random data".**
Configuration B explores nothing: the same values every run, chosen once. It is a fixed fixture
whose only advantage is that the values look arbitrary enough that nobody asserts on them. Call it
what it is, or someone will cite "we use random data" as coverage.

**★ A shared `static final Faker` under parallel execution.**
The seed is fixed and the *interleaving* is not, so each test sees a different slice of the
sequence on each run — non-reproducible with a fixed seed, which is the most confusing possible
state. One `Faker` per test, seeded per test.

**★ A shared `Random` as a contention point.**
`java.util.Random` is documented as thread-safe but *"the concurrent use of the same
`java.util.Random` instance across threads may encounter contention and consequent poor
performance"*. In a parallel suite a single shared generator is both wrong and slow.

**★ Adding one generator call to a builder and expecting seeded values to hold.**
Reproducibility requires *"the same sequence of method calls"*. Insert a `firstName()` at the top
of a builder and every subsequent draw shifts, so a seeded suite is reproducible for a given
commit, not across commits. Anything that recorded a seeded value as an expectation now fails for
no semantic reason.

**★ Treating a seeded value as stable across Datafaker versions.**
`java.util.Random`'s number sequence is guaranteed portable by the javadoc; the *mapping* from
those numbers to names, addresses and companies is Datafaker's data and is not documented as
stable. An upgrade can change every value a seed produces. This is why seeded generation must
never back a golden file.

**★ Printing the seed on every test rather than on failure.**
A passing build that prints a line per test trains everyone to ignore the output, so the one line
that mattered is invisible. `TestWatcher.testFailed` is the hook; use it.

**★ Seeding with a constant like `0` copied from the documentation.**
Harmless in itself, and it makes every project's "random" data identical, which quietly means
every project exercises the same handful of shapes. If you are going to fix a seed, fix a distinct
one, and treat rotating it as a deliberate act with a changelog entry.

**★ Deriving a per-test seed from something that is not stable.**
`hashCode()` of a display name is stable within a JVM and across runs for a `String`, which is what
you want. A seed derived from `System.nanoTime()` is Configuration A without the printing; a seed
derived from an object's identity hash is different every run and not reproducible at all.

**★ Adding Datafaker to `compile` scope.**
It is a test dependency. In `compile` it ships to production, it is reachable from application
code, and someone will eventually use it to generate a default value in a constructor, at which
point production behaviour is non-deterministic. `<scope>test</scope>`.

**★ Treating the Datafaker version as managed by Spring Boot.**
It is not in `spring-boot-dependencies`, so nothing pins it for you and nothing warns you when it
moves. Pin it explicitly in your own dependency management, and remember that an upgrade can change
the values a given seed produces.

## Interview questions

**★ Your team uses Faker and a test fails once a fortnight in CI. What is the first thing you change?**
Not the test — the reporting. Without the seed there is no input to reason about, so the first
change is a JUnit extension that creates the `Faker` from a per-test seed and prints that seed in
`TestWatcher.testFailed`, together with a system property that pins it. That converts an
intermittent failure into a one-command reproduction, and it is a permanent improvement rather than
a fix for one incident. Only then is it worth asking whether the generator is under-constrained
(producing values the domain forbids) or whether it found a genuine assumption in the production
code.

**★ What does a fixed seed actually buy you, and what does it cost?**
It buys reproducibility and quiet: the same values every run, no intermittent failures from the
data. It costs the entire discovery benefit — the suite now exercises exactly one point in the
input space, chosen once, at random, and never revisited. So a fixed seed turns generated data into
a fixed fixture whose only remaining advantage over literals is that the values look arbitrary, so
nobody is tempted to assert on them. That is a real advantage and a modest one, and the important
thing is to say out loud which of the two configurations you are in, because teams routinely claim
the benefits of one while running the other.

**★ You have a fixed seed and the test is still flaky. What is going on?**
Something other than the seed is non-deterministic, and the most likely candidate is a shared
`Faker` under parallel execution: one generator, one advancing state, and an interleaving of draws
across threads that varies run to run. Each test therefore sees a different slice of the sequence
even though the seed never changed. The fix is one `Faker` per test method, seeded per test — and
while you are there, note that `java.util.Random`'s javadoc warns that concurrent use of one
instance also causes contention, so the shared generator was a performance problem as well as a
correctness one. If that is not it, the usual suspects are the clock, iteration order and shared
database rows.

**★ Is a seeded Faker safe to use in a golden-file test?**
No, and the reason is specific. `java.util.Random`'s javadoc guarantees that a given seed yields
the same *numbers* on every Java implementation — it says implementations must use the specified
algorithms "for the sake of absolute portability". But Datafaker's mapping from those numbers to
names and addresses is its own data and code, and its documentation promises only that seeded
instantiation is "predictable"; nothing states that the mapping is stable across versions. So a
library upgrade can rewrite every value in the golden file with no semantic change, and the review
step the file exists for is destroyed. Golden files take literals.

**★ Where should the `Faker` instance live?**
Per test, created in `@BeforeEach` or by an extension, and seeded from a seed that is either
recorded (Configuration A) or derived deterministically from the test's identity. A `static final`
field is the tempting default and it is the one that breaks under parallel execution, couples tests
through a shared advancing state, and makes it impossible to report a per-test seed. If builders
need one, pass it in or have the builder ask an extension-provided instance rather than reaching
for a global.

{/* FOOTER */}
