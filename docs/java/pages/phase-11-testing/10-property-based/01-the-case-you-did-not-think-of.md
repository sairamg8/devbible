---
title: "An example-based test suite is a written transcript of what its author imagined could go wrong, so the defect that survives it is by construction one nobody imagined — and a property is the only kind of test that can be about the cases you did not think of"
sidebar_label: "01 · The case you did not think of"
sidebar_position: 1
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)) for what a property is and
> the default number of tries, and the **JDK 25 javadocs** for `java.math.BigDecimal`,
> `java.math.RoundingMode` and `java.math.BigInteger` (`divide`, `mod`, `movePointRight`).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine.** Every page in this topic carries Java
> source and documented behaviour, never console output, a timing or a seed from a real run.

**Every test you have ever written is a case somebody thought of. That is not a criticism of
the tests; it is a description of what a test *is*. A test method names an input, names an
expected output and asserts the relation between them, and all three came out of a human
head. The consequence is uncomfortable and exact: the set of defects your suite can catch is
bounded above by the set of defects your team imagined. Property-based testing is the one
technique that changes that bound, because it moves the input out of your head and into a
generator, and moves the assertion from "the answer is 50.00" to "whatever the answer is, it
sums back to the total".**

## The bill-splitter, and the table a competent person writes

Here is a method that ships in a real system, in some form, roughly everywhere.

```java
public final class Bill {

    /** Split {@code total} into {@code ways} equal shares, rounded to cents. */
    public static List<BigDecimal> split(BigDecimal total, int ways) {
        BigDecimal share = total.divide(BigDecimal.valueOf(ways), 2, RoundingMode.HALF_UP);
        return Collections.nCopies(ways, share);
    }
}
```

And here is the test a careful engineer writes for it — a `@ParameterizedTest` with a table,
which is exactly the right instinct and exactly what **topic 03 · Parameterized tests** is
about:

```java
@ParameterizedTest
@CsvSource({
    "100.00, 2, 50.00",
    "100.00, 4, 25.00",
    " 90.00, 3, 30.00",
    " 12.50, 5,  2.50",
    "  0.00, 3,  0.00"
})
void splitsEvenly(BigDecimal total, int ways, BigDecimal expectedShare) {
    assertThat(Bill.split(total, ways)).containsOnly(expectedShare);
}
```

Five cases. Green. It is a good table: it has a zero, it has an odd divisor, it has a
non-round total. It was written by someone paying attention.

Now look at what the author of that table did without noticing. **Every row divides
exactly.** Not because they were lazy — because a human writing an expected value has to be
able to compute it, and `100.00 / 3` is not a number you can put in the third column. The
table is not a sample of the input space. It is a sample of *the input space in which the
author could state an expected answer*, which is a very different and much smaller set, and
it excludes precisely the region where a rounding bug lives.

## The property

A property does not state an expected value. It states a relation that must hold whatever
the values are:

```java
import net.jqwik.api.*;
import net.jqwik.api.constraints.*;
import static org.assertj.core.api.Assertions.*;

class BillProperties {

    @Property
    void sharesAddUpToTheTotal(
        @ForAll @BigRange(min = "0.00", max = "10000.00") @Scale(2) BigDecimal total,
        @ForAll @IntRange(min = 1, max = 20) int ways
    ) {
        List<BigDecimal> shares = Bill.split(total, ways);

        BigDecimal sum = shares.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(sum).isEqualByComparingTo(total);
    }
}
```

That is the whole test. There is no expected column, because there is no case. The
assertion is a *law*: money that goes into a split comes out of it. jqwik will run it, by
default, **1000 times** — the user guide is explicit:

> *"If not specified differently, jqwik will run 1000 tries, i.e. a 1000 different sets of
> parameter values and execute the property method with each of those parameter sets."*

The law is false for the implementation above, and the arithmetic says exactly why:
`100.00` split three ways gives `33.33` per share by `HALF_UP` at scale 2, and
`33.33 × 3 = 99.99`. One cent has disappeared. `0.01` split two ways gives `0.01` each
(`0.005` rounds up), and `0.01 × 2 = 0.02` — a cent has been *created*. Both are inside the
generator's range. Neither is in the table, and neither would ever be, because neither has
a clean answer for a human to write in a third column.

## The fix, and the second thing the property finds

The correct shape is largest-remainder allocation: work in the smallest unit, divide, and
hand the remainder units out one at a time.

```java
public static List<BigDecimal> split(BigDecimal total, int ways) {
    if (ways <= 0) {
        throw new IllegalArgumentException("ways must be positive: " + ways);
    }
    BigInteger units = total.movePointRight(2).toBigIntegerExact();   // whole cents
    BigInteger base  = units.divide(BigInteger.valueOf(ways));
    int extra        = units.mod(BigInteger.valueOf(ways)).intValueExact();

    List<BigDecimal> shares = new ArrayList<>(ways);
    for (int i = 0; i < ways; i++) {
        BigInteger cents = i < extra ? base.add(BigInteger.ONE) : base;
        shares.add(new BigDecimal(cents).movePointLeft(2));
    }
    return shares;
}
```

Now `100.00 / 3` is `33.34, 33.33, 33.33`, which sums to `100.00`, and `0.01 / 2` is
`0.01, 0.00`.

And here is the part that matters more than the fix. **Widen the generator to allow negative
totals and the property fails again.** `BigInteger.divide` truncates toward zero while
`BigInteger.mod` is documented to return a non-negative result, so for `-100.00` split three
ways `units = -10000`, `base = -3333` and `extra = (-10000).mod(3) = 2`; the shares sum to
`3 × -3333 + 2 = -9997` cents, which is `-99.97`, not `-100.00`. That is a real defect in
the corrected code, it comes from a documented asymmetry between two JDK methods, and
nothing about writing the fix would have surfaced it. The property surfaces it the moment
somebody widens `@BigRange`, which is a one-line change to a generator rather than five new
rows nobody knows they need.

That is the whole argument of this topic in one paragraph: **the property outlives the
author's imagination, and the table cannot.**

## Before you write one line of this: read chunk 02 first

⚠️ jqwik is **not** a JUnit Jupiter extension. It is a separate `TestEngine` implementation
that plugs into the JUnit *Platform*, and the version of the Platform it is built against is
not the version Spring Boot 4.1 puts on your classpath. That collision is the load-bearing
practical fact of this whole topic and it is unpacked, with the evidence, in
[02 · jqwik is an engine, not an extension](02-the-stack-problem.md) and
[02c · What a team on Boot 4.1 can actually do](02c-what-to-do-about-it.md). Read those
before you add a dependency, not after.

## Where this connects

- The hand-written table itself — every source, `@CsvSource`, `@MethodSource`, argument
  conversion — belongs to
  [03 · Parameterized tests](../03-parameterized-tests/README.md). This topic is not an
  argument against it; it is an argument about the region of the input space it cannot
  reach.
- The mechanics of `@Property` and `@ForAll` are
  [03 · Writing a property](03-a-property.md); the catalogue of relations worth asserting
  is [04 · Finding properties](04-finding-properties.md).
- Builders and object mothers, which solve the *arrangement* problem for example tests, are
  [08 · Test data patterns](../08-test-data-patterns/README.md). A jqwik `@Provide` method
  is the same idea with the defaults replaced by a distribution.
- The other technique that attacks "my tests only check what I thought of" from the opposite
  direction — mutating the production code and asking whether any test notices — is
  **topic 11 · Mutation testing**. The two are complementary: properties widen the inputs,
  mutation testing widens the *faults*.

## Gotchas

**★ A five-row table where every row divides evenly is not a coincidence, it is a selection effect, and it happens on every table you will ever review.**
The author had to be able to state the expected output, so they chose inputs whose output
they could state. That silently deletes exactly the region — awkward divisions, rounding
boundaries, values needing carry — where arithmetic bugs live. When you review a table, do
not ask "are there enough rows"; ask "what property of these inputs made them easy to write
down, and what does that property exclude?"

**★ A property with no generated parameters is just a test with extra ceremony.**
`@Property void somethingIsTrue() { ... }` compiles and runs, a thousand times, doing
exactly the same thing a thousand times. jqwik's own documentation notes that `@Example` is
internally *"properties with the number of tries hardcoded to 1"* — so a parameterless
`@Property` is an `@Example` you are paying 1000× for. If a method has no `@ForAll`
parameter, it should be `@Example` or a Jupiter `@Test`.

**★ Only parameters annotated `@ForAll` are generated, and jqwik will not warn you about the ones that are not.**
The guide states it flatly: *"Mind that only parameters that are annotated with '@ForAll'
are considered for value generation."* Forgetting the annotation on the third of three
parameters does not fail loudly at compile time; it makes jqwik try to resolve that
parameter through the parameter-resolution hook instead, and the failure surfaces as a
confusing resolution error rather than "you forgot an annotation".

**★ Fixing the code that a property falsified is only half the job — widening the generator is the other half.**
The bill splitter above passes for non-negative totals and fails for negative ones, and the
only reason you find that out is that somebody changes `min = "0.00"` to
`min = "-10000.00"`. Every property carries an implicit claim about its domain, and that
claim is where the next bug hides. When you fix a falsification, ask what the range excludes
and whether production excludes the same thing.

**★ Give me a real example of a bug a table would not have caught.**
Split `100.00` three ways with `total.divide(BigDecimal.valueOf(3), 2, HALF_UP)` and you get
three shares of `33.33`, summing to `99.99`. Every row a human writes in a `@CsvSource` for
this method divides exactly, because the author has to compute the expected share to put in
the third column, and `33.333…` is not writable. So the table structurally excludes the case.
The property "the shares sum to the total" excludes nothing. The second-order version is
better still: after you fix it with largest-remainder allocation, the property fails again on
negative totals, because `BigInteger.divide` truncates toward zero while `BigInteger.mod`
returns a non-negative remainder — a defect that came from the *fix*, not the original code,
and that nobody would write a test row for.

**★ A colleague says property-based testing is flaky by design because it uses random input. Is that true?**
It is a real risk and it is a solved one, but only if you configure for it. jqwik reports the
random seed for every property run and, by default, reuses the last failing sample and the
previous seed on the next run (`AfterFailureMode.SAMPLE_FIRST`), which makes a falsification
stick locally until it is fixed. The genuine flakiness risk is a property that is *nearly*
always true — one that fails for one input in ten million — because it will go red in CI on a
build unrelated to the change that introduced it. That is not the tool being unreliable;
that is the tool telling you your code has a rare defect, and the right response is to
capture the falsifying sample as a permanent example test. The mechanics of seeds, the
`.jqwik-database`, and what CI does and does not persist are the whole of
[07 · Reproducibility](07-reproducibility.md).
{/* FOOTER */}
