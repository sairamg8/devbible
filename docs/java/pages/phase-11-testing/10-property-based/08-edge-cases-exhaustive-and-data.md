---
title: "jqwik does not only generate random values — it generates the boundaries first, switches to trying every value when the space is small enough, and will read a fixed table instead when you tell it to, and knowing which of those three modes a property is actually running in is the difference between a property that proves something and one that ran a thousand near-identical tries"
sidebar_label: "08 · Edge cases, exhaustive generation and data"
sidebar_position: 40
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Optional
> `@Property` Parameters*, *Generation Modes*, *Exhaustive Generation*, *Data-Driven
> Properties* and the edge-cases material under *Random Value Generation*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no test run on this machine** — the generation modes and their
> selection rules are quoted from the guide, never observed from a run. No seeds, no
> timings, no sample counts from an actual execution.

**A property test is not one thing. jqwik has three generation modes and picks between them
for you, and the mode decides what the thousand tries were actually worth. Randomized
generation samples a space. Exhaustive generation covers it. Data-driven generation abandons
generation entirely and reads your table. Most people write properties for years without
knowing the second and third exist, and then wonder why a property over an enum pair "passed
1000 times" — it tested nine distinct inputs, one hundred and eleven times each.**

Three facts run through this chunk:

1. **Edge cases are generated first, not stumbled upon.** jqwik injects the boundaries — empty
   string, zero, `MIN_VALUE`, `MAX_VALUE` — deliberately. The bugs property testing is famous
   for catching are mostly these, and they arrive by design.
2. 🔴 **`AUTO` silently switches to exhaustive when the space is small enough**, which means
   two properties written identically can be doing categorically different work depending on
   the types of their parameters.
3. **Edge cases multiply across parameters.** Three parameters with six edge cases each is 216
   combinations before a single random value is drawn — and that is the good case.

## Edge cases: the boundaries, injected on purpose

For every arbitrary jqwik knows a set of *edge cases* — the values most likely to break code.
For integers that is zero, one, minus one, `Integer.MIN_VALUE`, `Integer.MAX_VALUE`. For
strings it includes the empty string. For lists, the empty list. For `Optional`,
`Optional.empty()`.

These are not sampled and hoped for. A randomized generator drawing an `int` uniformly will
essentially never produce `Integer.MAX_VALUE`; the chance is one in four billion. jqwik puts
it in on purpose, and that single design decision is why property tests find overflow bugs
that a thousand random draws never would.

The behaviour is controlled per property:

```java
@Property(edgeCases = EdgeCasesMode.MIXIN)
void everyOrderTotalIsNonNegative(@ForAll int quantity, @ForAll int unitPrice) {
    // ...
}
```

The guide defines the three modes as:

- **`MIXIN`** — the default. *"Edge cases will be mixed with randomly generated parameter sets
  until all known permutations have been mixed in."*
- **`FIRST`** — *"All edge cases being generated before jqwik starts with randomly generated
  samples."*
- **`NONE`** — *"Will not generate edge cases for the full parameter set at all. However, edge
  cases for individual parameters are still being mixed into the set from time to time."*

The global default is set with the `jqwik.edgecases.default` property in the configuration
file, which is the right place for it — this is a suite-wide policy, not a per-test taste.

**Read `NONE` carefully.** It does not mean "no edge cases". It switches off the *combined*
edge-case permutations for the full parameter set while individual parameters still get theirs
mixed in. If you reached for `NONE` because you wanted a purely random sample, you did not get
one.

### The combinatorial trap

jqwik reports two numbers you should learn to read:

- `edge-cases#total` — the total number of permutations of combined edge cases.
- `edge-cases#tried` — how many of those the current run actually attempted.

When `total` is far larger than `tried`, the run never finished mixing in the boundaries, and
"1000 tries passed" is a weaker claim than it looks. The cause is almost always parameter
count. Edge cases combine multiplicatively: five parameters with five edge cases each is 3,125
permutations, and with the default try count most of them are never reached.

**The fix is not to raise `tries`.** It is to notice that a property needing five independent
generated parameters is usually a property that has not found its invariant yet. Split it, or
generate one aggregate object whose construction encodes the relationships, which collapses
five axes into one.

## Generation modes: what your property is actually doing

The `generation` attribute selects the strategy, and the guide's definitions are exact:

```java
@Property(generation = GenerationMode.AUTO)
void statusTransitionsAreLegal(@ForAll Status from, @ForAll Status to) { /* ... */ }
```

- **`AUTO`** — the default. *"This will choose exhaustive generation whenever this is deemed
  sensible, i.e., when the maximum number of generated values is equal or less than the
  configured `tries` attribute."*
- **`RANDOMIZED`** — *"Always generate values using its randomized generators."*
- **`EXHAUSTIVE`** — *"Use exhaustive generation if the arbitraries in use support exhaustive
  generation at all and if the calculated maximum number of different values to generate is
  below `Integer.MAX_VALUE`."*
- **`DATA_DRIVEN`** — *"Feed values from a data provider specified with `@FromData`."*

🔴 **`AUTO` is where the surprise lives.** Take the property above: two `Status` parameters over
an enum with three constants. The maximum number of distinct value pairs is nine, which is well
under the default try count, so jqwik switches to exhaustive generation and runs exactly nine
tries — covering the space completely and proving something genuinely stronger than any
sampling could. Widen `Status` to twenty constants and the space becomes 400; still under
1,000, still exhaustive. Add a third parameter and it is 8,000 — over the limit, so the same
source code silently reverts to randomized sampling.

**Nothing in the test changed. The strength of the claim did.** This is the single most
useful thing to know in this chunk: when the space is small, a property test is not a sampling
technique at all, it is a proof by exhaustion, and it is worth checking whether yours is one.

### When exhaustive generation is not possible

Not every arbitrary supports it. An arbitrary over `String` with unbounded length has no finite
maximum, and neither does one built from an unrestricted `flatMap`. Under `AUTO` this is
invisible — jqwik simply uses randomized generation. Under explicit `EXHAUSTIVE` the
requirement is stated: the arbitraries must support it, and the calculated maximum must be
below `Integer.MAX_VALUE`.

The practical consequence is that **constraining a generator can change the generation mode**.
Putting `@IntRange(min = 0, max = 10)` on a parameter does not merely narrow the values; if it
brings the total space under `tries`, it converts the property from sampling to exhaustion.
That is an argument for constraining tightly when the domain genuinely is small — you get
completeness as a side effect.

## Data-driven properties: when you already know the cases

Sometimes the input set is not a space to explore but a list you were handed — a regulatory
table, a set of known-bad payloads from production, the examples in a specification.

```java
@Property(generation = GenerationMode.DATA_DRIVEN)
void vatIsAppliedPerCountry(@ForAll @FromData("vatRates") String country, @ForAll int rate) {
    assertThat(taxService.rateFor(country)).isEqualTo(rate);
}

@Provide
Table<String, Integer> vatRates() {
    return Table.of(
        "DE", 19,
        "FR", 20,
        "LU", 17
    );
}
```

`@FromData("methodName")` points at a provider returning a `Table`, and `Table.of()` takes
alternating values across the row. Generation is switched off entirely: the rows are the cases.

**This is `@ParameterizedTest` wearing a property's clothes, and you should usually just write
`@ParameterizedTest`.** Topic 03 owns that mechanism, it is the more familiar idiom, and every
Java developer reading your suite already knows it. The narrow case where `@FromData` earns its
place is when you have a property already — with generators, shrinking, the whole apparatus —
and you want to run *the same property body* against a fixed table as well, without duplicating
the assertions into a second test class. Then keeping it inside jqwik is the smaller change.

## Gotchas

**Raising `tries` to "test more" can weaken the report you get.** If a property was running
exhaustively at the default and you push `tries` up, it stays exhaustive and the extra tries do
nothing. If it was near the boundary, you have changed which mode it uses. Either way the
number in the annotation is not a dial for rigour.

**`NONE` does not disable edge cases.** Covered above, and worth repeating because the enum
constant reads like it does.

**An exhaustive property that passes tells you the whole space is covered — for the parameters
you generated.** It says nothing about the state the class under test carried in. Exhaustion
over inputs is not exhaustion over behaviour, and a property over a stateful service is
sampling that service's state no matter what mode the inputs are in.

**Edge cases are per-arbitrary, so a custom `@Provide` generator may have none worth the name.**
If you build an aggregate with `Combinators`, think about whether its boundaries survived the
composition. A generator for `Order` that always produces between one and five line items has
quietly removed "the empty order" from the space — and that is usually the case that breaks.

**A table with fewer rows than `tries` runs each row once; that is fine and expected.** Do not
read the try count in the report as a failure to reach your target.

**`@FromData` and randomized parameters do not mix comfortably.** Once generation is
`DATA_DRIVEN`, the values come from the table. If you want part fixed and part generated, that
is a `@ParameterizedTest` with a generator inside, or a property whose provider builds the
combination — not a half-and-half property.

**★ A colleague says their property "passed 1,000 times so the code is proven". What is wrong with that sentence?**
Two things, and the second is the interesting one. First, 1,000 passing tries is evidence, not
proof — unless the property ran exhaustively, in which case it *is* proof over the input space
and they undersold it. Second, and much more common: the tries are not 1,000 distinct inputs.
If the parameters are enums or small bounded ranges, jqwik may have run exhaustively and done
nine real cases; if there are many parameters, the edge-case permutations may never have
finished mixing in. The number in the report is a count of executions, and the question worth
asking is how many distinct inputs it represents.

**★ How would you tell whether a given property is running exhaustively?**
Compare the size of the input space against the `tries` setting, because that is precisely the
rule `AUTO` applies — exhaustive when the maximum number of generated values is at or below
`tries`. In practice you compute the space by hand: enum constants multiplied out, ranges
multiplied out. If you want certainty rather than inference, set
`generation = GenerationMode.EXHAUSTIVE` explicitly; if the arbitraries cannot support it you
have learned the answer, and if they can you have made the guarantee part of the test's
declaration instead of a coincidence of parameter types.

**★ You add a third `@ForAll` parameter to a passing property and it starts finding a bug. What happened?**
Most likely nothing about the third parameter — the property crossed the threshold from
exhaustive to randomized, and randomized generation with edge-case mixin started producing
combinations the exhaustive run had covered but the *assertions* had been tuned around. The
inverse is the more common story though: the space got large enough that jqwik began sampling
widely and hit a region the old exhaustive space never contained. Either way the lesson is that
adding a parameter is not an incremental change to a property; it can change the kind of test
it is.

**★ When is `EdgeCasesMode.NONE` the right choice?**
Rarely, and I would want a specific reason. The honest one is performance in a property whose
edge-case permutation count is enormous and whose boundaries are already covered by dedicated
example tests — you are choosing to spend the tries on the random interior because the corners
are tested elsewhere. What it is *not* for is making a failing property pass. If turning off
edge cases turns the suite green, the boundaries are broken and the property just told you so.

**★ Why might constraining a parameter more tightly make a property stronger rather than weaker?**
Because it can shrink the input space below the `tries` threshold and flip the property into
exhaustive generation. A property over `@IntRange(min = 1, max = 12) int month` covers all
twelve months and is a complete statement about months; the same property over an unconstrained
`int` samples four billion values a thousand at a time and is a much weaker claim, while also
spending most of its tries on inputs the production code would reject at the boundary anyway.
Narrower is not always weaker — it depends on whether the narrowing matches the real domain.

**★ Would you use `@FromData` or `@ParameterizedTest` for a fixed table of regulatory rates?**
`@ParameterizedTest`, almost always. It is the idiom every Java developer in the team already
reads fluently, it lives in the same engine as the rest of the suite, and a fixed table has no
use for generation, shrinking or seeds — which is the entire value jqwik adds. The one case I
would keep in jqwik is when the property body already exists with generators and I want the
identical assertions driven by a table too; then `@FromData` avoids duplicating the body into a
second class, and that is a real maintenance argument rather than a stylistic one.

{/* FOOTER */}
