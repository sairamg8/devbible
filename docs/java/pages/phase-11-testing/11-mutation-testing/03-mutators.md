---
title: "Eleven mutators are on by default in PIT and the DEFAULTS group is not the OLD_DEFAULTS group any more: RETURN_VALS was replaced by five narrower return mutators, and knowing which operator produced a survivor is the difference between 'write a better test' and knowing exactly which assertion is missing"
sidebar_label: "03 · Mutators"
sidebar_position: 8
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page — the group table and the
> per-mutator sections — the [FAQ](https://pitest.org/faq/) entry *"Can I activate more mutators
> without relisting all the default ones?"*, and the
> [Maven quick start](https://pitest.org/quickstart/maven/) `mutators` parameter.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, JUnit Jupiter
> 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Mutator behaviour, tables and examples are quoted
> from pitest's documentation; the Java on this page is illustrative source, never a run.

**A surviving mutant is only useful if you know what it changed. "Something on line 41 survived" is
a chore; "`CONDITIONALS_BOUNDARY` survived on line 41" tells you nobody tests the boundary, and
you can write that assertion in thirty seconds. This chunk is the default operator set — eleven
mutators, on by default in PIT 1.30.0 — with what each one does to bytecode and, more usefully,
what a survivor of each one means about your tests. The five return-value mutators get their own
chunk because they are the newest, the most productive, and the most often confused with the
`RETURN_VALS` operator they replaced.**

## The groups, and the trap in the table

Pitest's overview:

> *"PIT currently provides some built-in mutators, of which most are activated by default. The
> default set can be overridden, and different operators selected, by passing the names of the
> required operators to the mutators parameter. To make configuration easier, some mutators are put
> together in groups."*

There are four groups: `OLD_DEFAULTS`, `DEFAULTS`, `STRONGER`, `ALL`. The FAQ names three of
them —

> *"Three groups are currently defined: DEFAULTS; STRONGER; ALL"*

— while the mutators page's own table has a fourth column for `OLD_DEFAULTS`. 🔴 **The difference
between `OLD_DEFAULTS` and `DEFAULTS` is exactly one swap:** `OLD_DEFAULTS` contains
`RETURN_VALS`; `DEFAULTS` drops it and adds `EMPTY_RETURNS`, `FALSE_RETURNS`, `TRUE_RETURNS`,
`NULL_RETURNS` and `PRIMITIVE_RETURNS`. Every other entry is identical. That single swap is why
old blog posts, old configurations and old score comparisons do not line up with a modern run —
see [03c](03c-the-returns-mutators.md).

Groups compose with individual names. From the FAQ:

> *"Yes. You can specify both individual mutators and groups of them using the same syntax."*

```xml
<mutators>
  <mutator>DEFAULTS</mutator>
  <mutator>EXPERIMENTAL_MEMBER_VARIABLE</mutator>
</mutators>
```

and the flat instruction about the biggest group:

> *"Using the ALL option is strongly discouraged."*

## The design goal, in pitest's words

This sentence explains the whole default/optional split:

> *"The operators are largely designed to be stable (i.e not be too easy to detect) and minimise
> the number of equivalent mutations that they generate. Those operators that do not meet these
> requirements are not enabled by default."*

Read "stable" carefully: it means **hard** to detect. An operator that any test trivially kills
tells you nothing — every mutant it produces is killed, the score rises, and you learn nothing. An
operator that produces mutants nothing can ever kill is worse. The default set is the operators
that sit between those two failure modes, which is why the defaults are the right starting point
and `ALL` is not.

## The default set

Eleven mutators, from the mutators page's `DEFAULTS` column:

| Mutator | What it does |
|---|---|
| `CONDITIONALS_BOUNDARY` | Shifts a relational operator by one boundary |
| `INCREMENTS` | Swaps `++` and `--` on local variables |
| `INVERT_NEGS` | Removes the negation of a numeric variable |
| `MATH` | Replaces a binary arithmetic or bitwise operator |
| `NEGATE_CONDITIONALS` | Replaces a conditional with its logical negation |
| `VOID_METHOD_CALLS` | Deletes a call to a `void` method |
| `EMPTY_RETURNS` | Returns the "empty" value for the type |
| `FALSE_RETURNS` | Returns `false` |
| `TRUE_RETURNS` | Returns `true` |
| `NULL_RETURNS` | Returns `null` |
| `PRIMITIVE_RETURNS` | Returns `0` |

The first two — the conditional operators — are below. `MATH`, `INCREMENTS`, `INVERT_NEGS` and
`VOID_METHOD_CALLS` are [chunk 03b](03b-arithmetic-mutators.md); the last five are
[chunk 03c](03c-the-returns-mutators.md).

## `CONDITIONALS_BOUNDARY` — the off-by-one detector

> *"The conditionals boundary mutator replaces the relational operators `<`, `<=`, `>`, `>=` with
> their boundary counterpart"*

| Original | Mutated |
|---|---|
| `<` | `<=` |
| `<=` | `<` |
| `>` | `>=` |
| `>=` | `>` |

**What a survivor means:** no test exercises the exact boundary value. If free shipping starts at
£50 and `>=` can become `>` without any test failing, then no test orders exactly £50. This is the
single most valuable mutator in the default set for business logic, because off-by-one at a
threshold is a defect class that ships regularly and that a `assertThat(shipping).isZero()` on a
£60 order will never catch.

**The fix, shown:**

```java
@ParameterizedTest
@CsvSource({
    "49.99, 4.99",
    "50.00, 0.00",   // the boundary itself — this is the assertion that kills the mutant
    "50.01, 0.00"
})
void shippingAtAndAroundTheThreshold(String total, String expectedShipping) {
    assertThat(policy.shippingFor(anOrderTotalling(total)))
        .isEqualTo(Money.gbp(expectedShipping));
}
```

The `50.00` row is what kills it. `49.99` and `50.01` alone leave the mutant alive, because both
give the same answer under `>=` and `>`. This is exactly the shape
[03 · Parameterized tests](../03-parameterized-tests/README.md) exists for.

## `NEGATE_CONDITIONALS` — the "is this branch checked at all" detector

> *"The negate conditionals mutator will mutate all conditionals found according to the replacement
> table below."*

| Original | Mutated |
|---|---|
| `==` | `!=` |
| `!=` | `==` |
| `<=` | `>` |
| `>=` | `<` |
| `<` | `>=` |
| `>` | `<=` |

Pitest is explicit about its relationship to the previous operator:

> *"This mutator overlaps to a degree with the conditionals boundary mutator, but is less stable
> i.e these mutations are generally easier for a test suite to detect."*

**What a survivor means:** something much worse than a missing boundary case. Inverting a condition
usually flips which branch runs for *most* inputs, so a survivor means either both branches produce
the same observable result under your assertions, or the condition's outcome is never asserted on
at all. A `NEGATE_CONDITIONALS` survivor next to a `CONDITIONALS_BOUNDARY` survivor on the same
line is a line with no meaningful test; a `CONDITIONALS_BOUNDARY` survivor alone is a boundary
case.

## Where this connects

- **[03b · Arithmetic mutators](03b-arithmetic-mutators.md)** — `MATH`,
  `INCREMENTS`, `INVERT_NEGS` and `VOID_METHOD_CALLS`, and the reason a field increment is mutated
  by a different operator from a local one.
- **[03c · The returns mutators](03c-the-returns-mutators.md)** — the other five defaults, and the
  `RETURN_VALS` operator they replaced.
- **[03d · Optional mutators](03d-optional-mutators.md)** — what is in `STRONGER` and `ALL`, and
  why `ALL` is "strongly discouraged".
- **[03 · Parameterized tests](../03-parameterized-tests/README.md)** — the natural home of the
  boundary rows that kill `CONDITIONALS_BOUNDARY` mutants.
- **[02 · AssertJ](../02-assertj/README.md)** — a survivor is usually a weak assertion, and this is
  the vocabulary for a strong one.

## Gotchas

**★ `DEFAULTS` is not `OLD_DEFAULTS`, and a configuration copied from an old post silently changes your score.**
The only difference is that `OLD_DEFAULTS` has `RETURN_VALS` where `DEFAULTS` has the five narrower
return mutators. That is a different mutant count on the same code, so the denominator changes and
the percentage moves without any test changing. If you are comparing a score against a historical
figure, check which group produced each one.

**★ A `CONDITIONALS_BOUNDARY` survivor is the highest-value finding in a default run, and the easiest to dismiss.**
It looks trivial — `>=` became `>` — and it means no test uses the exact boundary value. Threshold
off-by-ones are a defect class that reaches production regularly precisely because the tests use
round numbers on either side. Treat these as the first thing to fix in any report.

**★ The mutators page's own table and the FAQ disagree about how many groups there are.**
The FAQ says three (`DEFAULTS`, `STRONGER`, `ALL`); the mutators table has a column for
`OLD_DEFAULTS` as well. Both are on pitest.org. `OLD_DEFAULTS` exists — it has a column of its own
with entries in it — but the FAQ is where people look for the list, so it is under-advertised.

**★ Reading a mutator description as a source change is right most of the time and wrong often enough to matter.**
Pitest mutates bytecode and its own documentation warns *"it can sometimes be difficult to simply
describe how the mutation operators map to equivalent changes to a Java source file."* The
member-variable increment is the classic case. When a mutant makes no sense as a source edit, the
answer is usually that the compiler produced something different from what you wrote.

## Interview questions

**★ Which mutators are on by default in PIT, and why those?**
Eleven: `CONDITIONALS_BOUNDARY`, `INCREMENTS`, `INVERT_NEGS`, `MATH`, `NEGATE_CONDITIONALS`,
`VOID_METHOD_CALLS`, and the five return mutators `EMPTY_RETURNS`, `FALSE_RETURNS`, `TRUE_RETURNS`,
`NULL_RETURNS`, `PRIMITIVE_RETURNS`. Pitest's stated criterion is that default operators should be
*stable* — hard enough to detect that killing them means something — while generating few
equivalent mutants. Operators that are trivially killed teach you nothing, and operators that
generate unkillable mutants pollute the report; the default set is what sits between.

**★ A `CONDITIONALS_BOUNDARY` mutant survives on your discount threshold. What is missing?**
A test at the exact boundary. The mutant changes `>=` to `>`, which alters the result for one input
only: the threshold value itself. Tests at £49.99 and £50.01 both pass either way. The fix is a
case at exactly £50.00 with an assertion on the returned amount — which is precisely the row people
leave out of a parameterised test because it feels like a duplicate of the one below it.

**★ What is the difference between `CONDITIONALS_BOUNDARY` and `NEGATE_CONDITIONALS`, and what does it mean when both survive on one line?**
`CONDITIONALS_BOUNDARY` shifts the comparison by one — `>=` to `>` — so it changes behaviour for
exactly one input. `NEGATE_CONDITIONALS` inverts it — `==` to `!=`, `>=` to `<` — so it changes
behaviour for most inputs; pitest's docs call it the less stable of the two, meaning easier to
kill. If both survive on the same line, the condition's outcome is not being asserted at all: not
only is the boundary untested, but flipping which branch runs makes no observable difference to
your tests. That is a line covered by tests that assert on something else entirely.

**★ Why is `ALL` "strongly discouraged" if more mutants means more information?**
Because the extra operators fail one of pitest's two design criteria. Some are unstable — the
constructor call mutator's docs say it is *"fairly unstable and likely to cause
NullPointerExceptions even with weak test suites"*, so its mutants are killed by tests that check
nothing. Others generate equivalent mutants that cannot be killed at all and sit in the report
permanently. Both make the score less meaningful, and both make the run slower, since survivors are
the expensive case. More mutants is not more information when the extra mutants are noise.

{/* FOOTER */}
