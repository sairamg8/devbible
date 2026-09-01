---
title: "INLINE_CONSTS is the only operator in PIT that can see a literal value, and it cannot see the named constant you will enable it for — because javac folded that one away before pitest saw the class; its replacement rules are full of special cases because two of them are the tool's design criteria applied to individual numbers; and extracting a magic number into a constant deletes the only mutant that could measure it"
sidebar_label: "03d2c · Inline constants"
sidebar_position: 16
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page — the *Inline Constant Mutator*
> section, its constant-type table, its constant-folding example and the page's numbered footnotes 1,
> 2 and 3, quoted verbatim — and the *Invert Negatives Mutator* section's note on negative constants.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> ⚠️ **No sandbox and no build on this machine.** Operator behaviour is quoted from pitest's
> documentation; the Java on this page is illustrative source, never a run.

**Two of the five optional operators corrupt a value rather than a decision or a call. This chunk is
the first of them, and it is the only operator anywhere in PIT that can mutate a literal — which makes
it the only instrument that reaches the blind spot [03b](03b-arithmetic-mutators.md) left open, and
the only operator whose usefulness is destroyed by a refactoring everyone agrees is correct.
`REMOVE_INCREMENTS` is [03d2d](03d2d-remove-increments.md); the two operators that neutralise a call
are [03d2e](03d2e-the-call-neutralising-operators.md).**

## What it does

> *"The inline constant mutator mutates inline constants. An inline constant is a literal value
> assigned to a non-final variable"*

```java
public int foo() {
  int i = 42;
  return i;
}
```

becomes

```java
public int foo() {
  int i = 43;
  return i;
}
```

The replacement rules are, unusually, not a simple swap table. Pitest introduces them with the
admission that *"The rules are a little complex due to the different ways that apparently similar Java
statements are converted to byte code."*

| Constant type | Mutation, verbatim |
|---|---|
| `boolean` | *"replace the unmutated value true with false and replace the unmutated value false with true"* |
| `integer` `byte` `short` | *"replace the unmutated value 1 with 0, -1 with 1, 5 with -1 or otherwise increment the unmutated value by one"* |
| `long` | *"replace the unmutated value 1 with 0, otherwise increment the unmutated value by one."* |
| `float` | *"replace the unmutated values 1.0 and 2.0 with 0.0 and replace any other value with 1.0"* |
| `double` | *"replace the unmutated value 1.0 with 0.0 and replace any other value with 1.0"* |

## Why the rules have special cases

Pitest's own footnotes explain the odd rows, and both are the design criteria from
[03d2](03d2-the-optional-operator-inventory.md) applied at the level of an individual number.

> *"Integer numbers and booleans are actually represented in the same way be the JVM, it is therefore
> never safe if change a 0 to anything but a 1 or a 1 to anything but a 0."*

That is the **viability** constraint. A `boolean` on the operand stack is an `int` of 0 or 1; a mutant
that turned a `boolean`-shaped `0` into `7` would produce a class whose behaviour is undefined at best
and which the verifier may reject — `NON_VIABLE`, a status that counts as detected while measuring
nothing ([04 · Reading a report](04-reading-a-report.md)).

> *"Floating point numbers are always changed to 1 rather than adding 1 to the original value as this
> would result in equivalent mutations. Adding 1 to a large floating point number doesn't necessarily
> change its value due to the imprecise way in which floats are represented."*

That is the **equivalence** constraint, and it is the sharper of the two. Above `2^53`, `x + 1.0` is
`x` for a `double`. An operator that incremented floating-point literals would therefore produce
unkillable mutants on exactly the large values where a defect is most expensive, so pitest replaces
instead of incrementing. The `1.0 -> 0.0` and `2.0 -> 0.0` special cases exist because replacing `1.0`
with `1.0` would be no mutation at all — pitest's third footnote says the float note *"applies to both
floats and doubles."*

The integer `5 -> -1` row looks like a typo and is not. It is the same instinct expressed for integers:
an operator that only ever adds one produces mutants that a rounding rule, a `compareTo` or a tolerance
can absorb, so the one mid-range value pitest special-cases gets flipped across zero instead.

## What it reaches

**It closes the negative-constant gap.** [03b](03b-arithmetic-mutators.md) closed on a limitation:
`INVERT_NEGS` *"does not mutate negative constants, only variables"*, so a sign error in `return -1;`
is invisible to the default set. `INLINE_CONSTS` reaches it — `-1` becomes `1`, per the integer row. It
is likewise the only operator that can touch a magic number in a comparison, a retry limit, a page size
or a scale factor written as a literal in a method body.

```java
public Money lateFee(int daysLate) {
    if (daysLate > 30) {          // CONDITIONALS_BOUNDARY sees the operator, not the 30
        return Money.gbp("25.00");
    }
    return Money.ZERO;
}
```

The default set mutates `>` to `>=` and mutates the two returns; nothing in it can change `30` to `31`.
With `INLINE_CONSTS` on, a mutant that moves the cliff by a day is generated, and it survives unless a
test pins the behaviour at exactly 30 and exactly 31 — which is the same `@CsvSource` shape that kills a
`CONDITIONALS_BOUNDARY` mutant ([03](03-mutators.md)), one row wider.

## What it does not reach, and the refactoring that takes it away

The same page's constant-folding warning applies:

> *"Please note that the compiler might optimize the use of final variables (regardless whether those
> are stack variables or member variables)."*

with the worked example

```java
public class A {
  private static final int VAR = 13;
  public String foo() {
    final int i = 42;
    return "" + VAR + ":" + i;
  }
}
```

compiled to the equivalent of `return "13:42";`, and the conclusion:

> *"In such situations the mutation engine can not mutate any variable."*

So rewrite `lateFee` the way a reviewer would ask for —

```java
private static final int GRACE_PERIOD_DAYS = 30;

public Money lateFee(int daysLate) {
    if (daysLate > GRACE_PERIOD_DAYS) { ... }
}
```

— and `javac` folds the constant into the comparison. There is no literal left in the method for
`INLINE_CONSTS` to mutate, and the field itself is initialised in the static initializer, which pitest
does not mutate by policy ([02b](02b-what-it-cannot-mutate.md)). The operator reaches literals written
**inline in a method body** and does nothing at all for the named constants at the top of the class,
which is where most teams put the numbers they care about.

That is worth stating plainly because it inverts the usual advice. Extracting a magic number into a
named constant is the right refactoring and it removes the only mutant that could have measured it. The
number does not become better tested; it becomes invisible to the technique, and the mutation score
goes up because the denominator shrank.

**Why the operator is off:** it is the noisiest of the five on ordinary code. Every `0`, `1`, `-1` and
`""` used as an initialiser, a loop bound, an index, a capacity hint or an accumulator seed becomes a
mutant, and a large share of those are equivalent — an accumulator seeded with a value the fixture makes
irrelevant, an index immediately overwritten, an `ArrayList` sized for performance rather than for
behaviour.

## Where this connects

- **[03d2 · Optional operators](03d2-the-optional-operator-inventory.md)** — the two-bucket rule for
  reading an operator's warning, both halves of which this operator's footnotes illustrate.
- **[03d2d · `REMOVE_INCREMENTS`](03d2d-remove-increments.md)** — the other optional operator that
  corrupts a value.
- **[03d2e · The call-neutralising operators](03d2e-the-call-neutralising-operators.md)** —
  `CONSTRUCTOR_CALLS` and `NON_VOID_METHOD_CALLS`, and the honest ranking across all five.
- **[03b · Arithmetic mutators](03b-arithmetic-mutators.md)** — `INVERT_NEGS` ignores negative
  constants, which is the gap this operator fills.
- **[02b · What it cannot mutate](02b-what-it-cannot-mutate.md)** — constant folding and static
  initializers, which together put named constants outside the technique entirely.
- **[03 · Mutators](03-mutators.md)** — `CONDITIONALS_BOUNDARY`, whose survivor is the boundary case
  next door to this operator's threshold mutant.
- **[03 · Parameterized tests](../03-parameterized-tests/README.md)** — the rows that kill an
  `INLINE_CONSTS` mutant on a threshold literal.

## Gotchas

**★ `INLINE_CONSTS` cannot see your `static final` constants, which is usually why people enable it.**
An inline constant is *"a literal value assigned to a non-final variable"*. Named constants are either
initialised in the static initializer, which pitest does not mutate by policy, or folded into their call
sites by the compiler, leaving nothing to mutate. If the reason for enabling the operator was "we want
to know whether our thresholds are tested", it will not answer that question.

**★ Extracting a magic number into a named constant deletes the only mutant that could see it.**
This is an uncomfortable interaction between a good refactoring and the measurement. `if (days > 30)`
gives `INLINE_CONSTS` a literal to mutate; `if (days > GRACE_PERIOD_DAYS)` gives it nothing, because
`javac` folds the `static final int` into the comparison. The refactoring is still right — but a
mutation score that improves after it has improved for a reason with no connection to the tests.

**★ `INLINE_CONSTS` replaces `5` with `-1`, not `6`, and the rule is deliberate.**
The integer rule is *"replace the unmutated value 1 with 0, -1 with 1, 5 with -1 or otherwise increment
the unmutated value by one"*. The special cases exist because the JVM represents small integers and
booleans identically, and pitest's own footnote says it is *"never safe if change a 0 to anything but a
1 or a 1 to anything but a 0"*. A mutant description that reads as a nonsense edit to the source is
usually one of these rows rather than a bug in the report.

**★ Floating-point constants are replaced, never incremented, and that is an equivalence fix.**
`float` and `double` literals go to `0.0` or `1.0` rather than to `value + 1`, because — pitest's own
footnote — *"Adding 1 to a large floating point number doesn't necessarily change its value due to the
imprecise way in which floats are represented."* An operator that incremented a `double` would produce
equivalent mutants on exactly the large values where a defect matters most.

**★ `INLINE_CONSTS` mutants in capacity hints and fixed loop bounds are pure noise.**
`new ArrayList<>(16)`, `new StringBuilder(64)`, `for (int i = 0; i < 3; i++)` over a fixed set: all of
them are literals, all of them get mutants, and none has behaviour a test should constrain. This is the
bulk of what the operator generates on a real codebase and the reason it is off by default.

**★ A `String` literal is not an inline constant for this operator's purposes.**
The constant-type table covers `boolean`, the integral types, `long`, `float` and `double` — there is no
row for `String`, and the operator's own example mutates an `int`. A wrong message, a wrong format
string or a wrong SQL fragment is not reached by this operator, and is not reached by any other operator
in the tool either. Text is outside mutation testing.

**★ Enabling it does not tell you which literals it mutated, only which mutants survived.**
A filtered or unreachable literal simply produces no mutant, and pitest reports no status for a mutant
it never generated ([02b3](02b3-the-filter-inventory.md)). So "we turned on `INLINE_CONSTS` and the
threshold is clean" can mean the threshold is tested or that it was never mutated. The mutant count per
class, read against the number of literals you can see in the source, is the only check.

## Interview questions

**★ Someone wants `INLINE_CONSTS` on so that the VAT rate constant is covered by mutation testing. What do you tell them?**
That it will not do that. `INLINE_CONSTS` mutates *"a literal value assigned to a non-final variable"* —
literals written inside a method body. A `private static final BigDecimal VAT_RATE` is initialised in
the static initializer, which pitest declines to mutate because a mutant there has no effect once the
class is loaded, and a primitive compile-time constant is folded into its call sites by `javac`, so
there is no instruction left to mutate at all; pitest's own note says *"In such situations the mutation
engine can not mutate any variable."* What the operator *will* do is mutate every incidental `0`, `1`
and `-1` in the same package, most of which produce equivalent or trivially killed mutants. If the goal
is confidence in the constant, that is a parameterised test asserting the computed amounts, or a code
review — not an operator.

**★ Why are `INLINE_CONSTS`'s replacement rules full of special cases rather than "add one"?**
Because two of pitest's constraints are visible in the type system rather than in the source. Small
integers and booleans have the same JVM representation, so mutating a `0` to anything but `1` risks a
class the verifier rejects — a `NON_VIABLE` mutant, which counts as detected while measuring nothing —
and pitest's footnote says so directly. And floating-point values are replaced with `0.0` or `1.0`
rather than incremented because adding one to a large `double` may not change it at all, which would be
an equivalent mutant no test could ever kill. Both special cases are the "stable, few equivalents"
criterion applied at the level of individual literal values, which is a good illustration that the
criterion is not a slogan — it is visible in the operator's own rules.

**★ A team extracts every magic number into a named constant and their mutation score goes up. What happened?**
Nothing about their tests. If `INLINE_CONSTS` was enabled, the literals it was mutating are gone: a
`static final` primitive is folded into its call sites by the compiler, so the mutants that used to exist
on those lines are not generated at all. The denominator shrank, and it shrank by removing mutants that
were mostly survivors, because thresholds written as literals are rarely pinned by a boundary test. It
is a clean example of why a mutation score is only comparable against a run with the same code shape as
well as the same operator set — and an argument for reading the mutant count per class alongside the
percentage.

**★ Which defects can PIT's default operator set not see at all, and does `INLINE_CONSTS` fix that?**
The default set can see comparisons, arithmetic, `void` calls and return values. It cannot see a wrong
literal, because no default operator mutates one; it cannot see a wrong `String`, a wrong regex or a
wrong SQL fragment at all; and it cannot see anything in a static initializer or folded by the compiler.
`INLINE_CONSTS` fixes exactly one item on that list — numeric and boolean literals written inline in a
method — and only where the compiler has left them in place. Everything else on the list stays outside
the technique, which is why a clean mutation report is evidence about your assertions rather than proof
of correctness.

{/* FOOTER */}
