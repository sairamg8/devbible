---
title: "The moment an argument source contains a loop, a filter or a computed expected value, nobody can say what the suite actually checked — and if the order is unstable the report's invocation index stops identifying anything at all"
sidebar_label: "09c · The source that grew logic"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide, "Customizing Display Names" and
> "`@MethodSource`"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)).
> ⚠️ The guide states no requirement that an argument source be deterministic or ordered; the
> argument that it must be is derived from the documented meaning of the `{index}` placeholder,
> and is a review standard rather than a framework rule.
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**`@MethodSource` and `@ArgumentsSource` are ordinary Java ([04](04-methodsource.md),
[06](06-argumentssource.md)), and ordinary Java is where logic goes to live. This chunk is about
what happens when it does: a factory that loops, filters, computes or shuffles has quietly become
a second program, unreviewed, untested, and capable of making every row in the table green for a
reason nobody intended.**

## The shape of the problem

```java
static Stream<Arguments> cases() {
    List<Arguments> out = new ArrayList<>();
    for (Currency currency : Currency.getAvailableCurrencies()) {
        if (currency.getDefaultFractionDigits() < 0) {
            continue;                                         // filter
        }
        int minor = currency.getDefaultFractionDigits() == 0 ? 100 : 10_050;
        out.add(Arguments.of(currency, minor));               // computed expectation
    }
    Collections.shuffle(out);                                 // 🔴
    return out.stream();
}
```

Four separate defects, and each is worth naming on its own because they arrive one commit at a
time.

### The expectation is computed, so a row can pass for the wrong reason

`currency.getDefaultFractionDigits() == 0 ? 100 : 10_050` is a rule. If the production code
implements the same rule, the assertion is that the code agrees with a copy of itself — it will
stay green through any change that is applied consistently to both. If it implements a *different*
rule, you have a second implementation that no reviewer reads and no test covers.

Either way the ternary is wrong: it assumes fraction digits are 0 or 2. `BHD` has three. The
generated table therefore asserted the wrong expectation for every three-decimal currency and
stayed green, because the code and the factory shared the same mistaken belief.

🔴 **An expected value that the test can derive from the input is not an expectation — it is a
restatement.** Type the answer in by hand, or assert an invariant instead.

### The row count is a property of the environment

`Currency.getAvailableCurrencies()` returns whatever the JDK's ISO 4217 data says on the machine
that ran it. A JDK upgrade adds or removes currencies, and with them adds or removes test cases —
so "the suite passed" means something different this quarter than it did last quarter, and nothing
in the build output says so. The same applies to a factory that lists a directory, queries a
database, or reads a live registry.

### The filter can silently empty the table

`if (…) continue;` drops pseudo-currencies today. Widen it — or let the underlying data change —
and it drops everything. **A parameterized test with zero interesting rows still reports green**,
because there is nothing left to fail. That is the single quietest way to lose coverage in this
whole topic, and the only defence is a source whose contents you can read.

### `shuffle` destroys the report's identity

The display-name placeholder is documented as:

> *"`{index}` — the current invocation index (1-based)"*

Every mechanism that reports, reruns, isolates or diffs test results leans on that index being
stable. Shuffle the source and `[7]` is a different case on every run: a CI failure cannot be
reproduced by rerunning that index locally, two runs' outputs cannot be compared, and a flaky row
cannot be pinned down. `Random`, `HashSet` iteration order and a parallel `Stream` collected into
an unordered container all produce the same effect without the word `shuffle` appearing anywhere.

⚠️ The user guide does not, as far as I could find, *require* argument sources to be deterministic
or ordered. This is an argument from what `{index}` means, not a documented rule — but every tool
that consumes JUnit's output behaves as though it were one.

## The rewrite: freeze the data, keep the source dumb

```java
@ParameterizedTest(name = "{0} formats 100.50 as {1} minor units")
@CsvSource({
    "EUR, 10050",     // 2 minor digits
    "USD, 10050",     // 2 minor digits
    "JPY, 100",       // 0 minor digits — the interesting case
    "BHD, 100500"     // 3 minor digits — the case the loop never thought about
})
void convertsToMinorUnits(Currency currency, long expectedMinorUnits) {
    assertThat(Money.of("100.50", currency).toMinorUnits()).isEqualTo(expectedMinorUnits);
}
```

Four rows, every expectation typed by a human, every case chosen deliberately — including the
three-decimal currency the generator was wrong about. Enumerating the table is what made the bug
visible; no amount of extra generated rows would have.

Note also that `Currency` arrives by implicit conversion from `"EUR"`
([08](08-conversion-and-aggregation.md)), so freezing the table cost nothing in ceremony.

## The legitimate version: generate inputs, never expectations

If you genuinely want "every value the platform knows about", that is a real and useful test.
Keep it, keep it separate, and assert an **invariant**:

```java
@ParameterizedTest
@MethodSource("everyCurrencyKnownToTheJdk")
void roundTripsThroughMinorUnits(Currency currency) {
    Money original = Money.of("100.50", currency);
    assertThat(Money.ofMinorUnits(original.toMinorUnits(), currency)).isEqualTo(original);
}

static Stream<Currency> everyCurrencyKnownToTheJdk() {
    return Currency.getAvailableCurrencies().stream()
        .sorted(comparing(Currency::getCurrencyCode));      // ordered, so {index} means something
}
```

Nothing computes an expected value; the assertion is `f(g(x)) == x`, which cannot be satisfied by
a shared misunderstanding. And the source is sorted, so the invocation index is stable across
runs even though the set is not.

That distinction — *generated inputs, invariant assertions* — is the doorway into property-based
testing, which does it deliberately and adds shrinking on top:
**topic 10 · property-based testing** *(not written yet)*.

## The three things a factory is allowed to do

1. **List values.** Literals, constants, enum values, `argumentSet(…)` labels
   ([07c](07c-naming-arguments.md)).
2. **Construct objects from those values.** A builder call per row is fine — it is still one row
   in, one object out, with no branching on content.
3. **Read a fixed resource that is checked in.** A CSV file under `test/resources`
   ([03c](03c-csvfilesource.md)) is data you can diff in a pull request; a live registry is not.

Anything else — a conditional, an accumulation, a call to `now()`, a call to the network — is the
factory doing the test's thinking where the report cannot show it.

## Gotchas

**★ A `@MethodSource` factory containing a loop.** The row count becomes a property of whatever
the loop iterates. If that is a JDK registry, a directory listing or a database, your coverage
changes when the environment does and nothing announces it.

**★ A factory that computes the expected value.** Computed the way production does, it asserts
self-consistency; computed differently, it is an unreviewed second implementation. Both are rows
that can pass for the wrong reason, and the second is worse because it looks careful.

**★ A ternary or `switch` producing the expected column.** That is the computed-expectation smell
in its smallest form. The currency example's `== 0 ? 100 : 10_050` is three characters of code and
an entire class of missing coverage.

**★ `Collections.shuffle`, `Random`, or `HashSet` iteration order in a source.** `{index}` is
documented as *"the current invocation index"*; an unstable order makes `[7]` a different case
every run, so a CI failure cannot be reproduced by index and two reports cannot be diffed.

**★ A parallel or unordered stream in a factory.** Same effect as `shuffle` without the word.
`.parallel()`, `.collect(toSet())` and `Map` iteration all lose order silently.

**★ A filter inside the source.** A `continue` or a `.filter(…)` can reduce the table to nothing,
and a parameterized test with zero rows is green. Green is exactly what nobody investigates.

**★ A source that reads the clock.** `LocalDate.now()` in a factory makes the table's meaning
depend on the day it ran — the canonical "passes until the first of the month" failure. Freeze the
instant and pass it in as a column.

**★ A source that reads the filesystem or the network.** Coverage then depends on the working
directory, the CI image, or somebody else's uptime. A checked-in `@CsvFileSource`
([03c](03c-csvfilesource.md)) is the version of this that a reviewer can actually read.

**★ Assuming a large generated table is more thorough than a small hand-written one.** The
generator embodied the same wrong assumption as the code and missed three-decimal currencies
entirely. Four deliberate rows found it. Row count is not coverage.

**★ Generating inputs *and* expectations from the same model.** This is the general form of the
defect. Generating inputs is fine — excellent, even — provided the assertion is an invariant that
holds regardless of what was generated.

**★ Putting the logic in an `ArgumentsProvider` instead and calling it clean.** Moving a loop from
a `@MethodSource` method into a custom `ArgumentsProvider` ([06](06-argumentssource.md)) changes
where the code lives, not whether it computes expectations. A provider that combines two lists into
a Cartesian product is data; one that decides what each row should assert is not.

**★ A factory whose output you cannot print.** If you cannot state, in a sentence, exactly which
rows will run, neither can the person diagnosing the failure at 2am.

## Interview questions

**★ Why is a loop inside a `@MethodSource` factory a problem?**
Because it moves the test's coverage out of the file and into whatever the loop iterates, and it
almost always ends up computing the expected value as well. The assertion then becomes "the
production rule agrees with the rule in the factory" — self-consistency rather than correctness.
It also makes the row count unstable across environments and JDK versions, so nobody can say what
the suite actually checked.

**★ What exactly is wrong with computing the expected value?**
An expectation has to come from *outside* the implementation — a specification, a worked example,
a human. If the test derives it from the input using a rule, then either that rule matches
production, in which case the test cannot detect a wrong rule, or it does not, in which case you
have written a second implementation nobody reviews. The currency example shows the first failure
mode: a shared assumption that fraction digits are 0 or 2 made every three-decimal currency assert
the wrong number, in green.

**★ Why does a shuffled or unordered argument source matter?**
Because the report's `{index}` is defined as the invocation index, and every tool that reports,
reruns or diffs results leans on it. Shuffle the source and `[7]` is a different case each run: a
CI failure cannot be reproduced by index, two runs cannot be compared, and a flaky row cannot be
isolated. JUnit does not require determinism — this is an argument from what the index means — but
the tooling around it assumes it.

**★ Is there ever a good reason to build a large table from a live registry?**
Yes, when the assertion is an *invariant* rather than a computed expectation — round-tripping,
idempotence, "never throws", "always normalises to itself". Those hold for every input regardless
of the data's shape, so nothing can pass for the wrong reason. Sort the source so the index stays
stable, and keep it in a separate method from the hand-written examples.

**★ A filter in a factory is a coverage risk. Why is that worse than a bug?**
Because it fails silently in the green direction. A bug turns a test red and someone investigates;
a filter that matches nothing produces a parameterized test with no invocations, which reports as
passing. Nobody investigates a pass, and no coverage tool distinguishes "asserted nothing" from
"asserted everything correctly".

**★ How do you decide whether a hand-written table is thorough enough?**
By choosing rows at the boundaries of the domain rather than the middle, and by asking what a row
would have to look like to be *surprising*. The currency example is the whole argument: a generated
table of every ISO currency still missed three-decimal currencies because the generator shared the
code's assumption, while four rows chosen for their boundaries caught it immediately.

**★ Does moving the loop into a custom `ArgumentsProvider` fix it?**
No. It relocates the code without changing what the code does. A provider that produces a
Cartesian product of two enumerated lists is still data — nothing about the expected outcome is
being decided. A provider that filters, computes an expected column, or reads a live source has
exactly the same problems it had as a factory method, plus one more file to open.

{/* FOOTER */}
