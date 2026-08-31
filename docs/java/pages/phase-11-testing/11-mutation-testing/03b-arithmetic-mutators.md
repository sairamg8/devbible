---
title: "MATH, INCREMENTS and INVERT_NEGS break the arithmetic, and every survivor they produce is the same finding wearing three hats: an assertion that says the number exists rather than what it is — with the extra trap that fixture values of 0 and 1 make the mutants genuinely equivalent, so a thorough-looking test cannot kill them"
sidebar_label: "03b · Arithmetic mutators"
sidebar_position: 9
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page — the *Math Mutator*,
> *Increments Mutator* and *Invert Negatives Mutator* sections, quoted verbatim — and the
> [Basic concepts](https://pitest.org/quickstart/basic_concepts/) page. Filter feature names from
> pitest 1.30.0 source (`FINFINC`, `FFLOOP`, `FINFIT`).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter
> 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no build on this machine.** Mutator behaviour is quoted from pitest's docs;
> the Java on this page is illustrative source, never a run.

**Three of the eleven default mutators attack the arithmetic: the binary operators, the increments,
and the sign. Every survivor they produce says the same thing — a computed number is not asserted,
or is asserted in a way that cannot tell the mutant from the original. They are also the operators
whose reports read most strangely against the source, because the compiler's choice of opcode, not
your choice of syntax, decides which one fires: `this.i++` is mutated by `MATH` and a local `i++`
by `INCREMENTS`. The fourth non-conditional default, `VOID_METHOD_CALLS`, is a different kind of
finding and is [chunk 03b2](03b2-void-method-calls.md).**

## `MATH` — and the `i++` surprise

> *"The math mutator replaces binary arithmetic operations for either integer or floating-point
> arithmetic with another operation."*

| Original | Mutated | | Original | Mutated |
|---|---|---|---|---|
| `+` | `-` | | `&` | <code>&#124;</code> |
| `-` | `+` | | <code>&#124;</code> | `&` |
| `*` | `/` | | `^` | `&` |
| `/` | `*` | | `<<` | `>>` |
| `%` | `*` | | `>>` | `<<` |
| | | | `>>>` | `<<` |

Two documented traps.

**String concatenation is not `+`:**

> *"Keep in mind that the + operator on Strings as in `String a = "foo" + "bar";` is not a
> mathematical operator but a string concatenation and will be replaced by the compiler with
> something like `String a = new StringBuilder("foo").append("bar").toString();`"*

So you will never see a `MATH` mutant on string building.

**`this.i++` is a `MATH` mutation, not an `INCREMENTS` one:**

> *"Please note that the compiler will also use binary arithmetic operations for increments,
> decrements and assignment increments and decrements of non-local variables (member variables)
> although a special iinc opcode for increments exists. This special opcode is restricted to local
> variables (also called stack variables) and cannot be used for member variables."*

which makes

```java
public class A {
  private int i;
  public void foo() {
    this.i++;
  }
}
```

mutate to

```java
public class A {
  private int i;
  public void foo() {
    this.i = this.i - 1;
  }
}
```

under `MATH`. This is the clearest example in the whole tool of why "which mutator fired" can be
confusing when read as a source change: identical-looking Java produces different operators
depending on whether the variable is a field or a local.

**What a survivor means:** an arithmetic result is not asserted, or is asserted too loosely. A
`MATH` survivor in a total or a percentage calculation is almost always an `isNotNull()`,
`isGreaterThan(0)` or `isNotZero()` assertion where an `isEqualTo` belonged.

**The fix, shown.** Here is a test that leaves every `MATH` mutant in `total()` alive:

```java
@Test
void calculatesTheTotal() {
    Money total = invoice.total();
    assertThat(total).isNotNull();
    assertThat(total.amount()).isPositive();
}
```

`+` becomes `-`, `*` becomes `/`, and the result is still a non-null positive `Money` for most
inputs. The assertion that kills them is the one that names the answer:

```java
@Test
void calculatesTheTotal() {
    Invoice invoice = anInvoice()
        .withLine("widget", 3, Money.gbp("10.00"))
        .withVatRate(new BigDecimal("0.20"))
        .build();

    assertThat(invoice.total()).isEqualTo(Money.gbp("36.00"));
}
```

Note that the fixture has to be chosen so the mutants differ from the original: with a quantity of
`1`, `3 * 10` and `3 / 10`-style mutants are distinguishable but `1 * 10` and `1 / 10` may not be
under a rounding rule, and with a VAT rate of `0` the `+`/`-` mutant on the VAT addition is
equivalent. **Fixture values of 0 and 1 are how arithmetic mutants survive a test that looks
thorough** — the same reason
[08 · Test data patterns](../08-test-data-patterns/01-the-forty-line-setup.md) argues for values
chosen to make the assertion meaningful.

## `INCREMENTS` and `INVERT_NEGS`

`INCREMENTS`:

> *"The increments mutator will mutate increments, decrements and assignment increments and
> decrements of local variables (stack variables). It will replace increments with decrements and
> vice versa."*

> *"Please note that the increments mutator will be applied to increments of local variables only.
> Increments and decrements of member variables will be covered by the Math Mutator."*

Applied to a loop counter this is the operator that produces the legitimate infinite loop from
[02c](02c-timeouts-and-determinism.md), which is why `FINFINC`, `FFLOOP` and `FINFIT` exist to
filter most of them out before they run.

`INVERT_NEGS`:

> *"The invert negatives mutator inverts negation of integer and floating point variables."*

```java
public float negate(final float i) {
  return -i;
}
```

becomes `return i;`, with the caveat:

> *"Please note, this mutator does not mutate negative constants, only variables."*

**What a survivor means:** for `INVERT_NEGS`, that sign is not asserted — common in refund, credit
and adjustment code where the test checks the magnitude and not the direction. That is a real
defect class: a refund of `+50` instead of `-50`.

**The fix, shown.** This assertion is blind to sign:

```java
assertThat(refund.amount().abs()).isEqualTo(new BigDecimal("50.00"));
```

This one is not:

```java
assertThat(refund.amount()).isEqualByComparingTo("-50.00");
```

Any use of `abs()`, `isCloseTo` with a large tolerance, or a comparison against a magnitude is a
place `INVERT_NEGS` will survive.

## Where this connects

- **[03 · Mutators](03-mutators.md)** — the groups, the design goal, and the two conditional
  operators.
- **[03b2 · `VOID_METHOD_CALLS`](03b2-void-method-calls.md)** — the fourth non-conditional default,
  which deletes an action rather than corrupting a value.
- **[03c · The returns mutators](03c-the-returns-mutators.md)** — the five that replace a return
  value rather than break the computation behind it.
- **[03d · Optional mutators](03d-optional-mutators.md)** — `NON_VOID_METHOD_CALLS`,
  `INLINE_CONSTS`, `CONSTRUCTOR_CALLS` and why they are off.
- **[02 · AssertJ](../02-assertj/README.md)** — `isEqualTo` versus `isNotNull` is the entire
  difference between killing a `MATH` mutant and not.

## Gotchas

**★ `this.i++` and a local `i++` are mutated by different operators.**
A member variable increment compiles to a field read, an arithmetic op and a field write, so `MATH`
mutates it to `this.i - 1`. A local increment uses `iinc` and is mutated by `INCREMENTS`. Filtering
out `MATH` because "we don't do much arithmetic" therefore also removes mutants from every counter
field in the codebase.

**★ String `+` produces no `MATH` mutants, so string-building logic is barely mutated at all.**
The compiler turns concatenation into `StringBuilder` calls, which are non-`void` method calls and
therefore untouched by the default set. A class whose job is formatting will show a small mutant
count and a high score without anyone having tested the format.

**★ `INVERT_NEGS` does not touch negative constants.**
`return -1;` is a constant and is not mutated by this operator; `return -i;` is. Sign errors in
code that returns literal negatives are invisible to it — those need `INLINE_CONSTS`, which is
optional and off.

**★ Fixture values of 0 and 1 make arithmetic mutants equivalent.**
`x * 1` and `x / 1` give the same answer; `x + 0` and `x - 0` give the same answer. A test whose
quantities are 1 and whose rates are 0 exercises the arithmetic and cannot distinguish the mutants,
so `MATH` survivors persist next to a passing, thorough-looking test. Pick fixture values where
every operator in the expression produces a different result.

**★ `abs()`, `isCloseTo` with a wide tolerance and `isPositive()` all hide `INVERT_NEGS` and `MATH` survivors.**
Any assertion that reduces the value before comparing loses exactly the information the mutant
changed. `isCloseTo(expected, within(1.0))` on a calculation whose mutant shifts the result by 0.5
is a test that cannot fail. Mutation testing is unusually good at finding these because it changes
the value by a specific, small amount.

**★ Loop-counter mutants are mostly filtered, so `INCREMENTS` survivors are rarer than the operator suggests.**
`FINFINC`, `FFLOOP` and `FINFIT` remove increments whose mutation would hang. What is left is
increments in non-loop positions — a running counter, a retry count, a page index — where a
survivor is a real finding about an unasserted count.

## Interview questions

**★ Why does an increment on a field get mutated by `MATH` rather than `INCREMENTS`?**
Because the JVM's `iinc` opcode only works on local variables. A field increment compiles to a
field read, an `iadd`, and a field write, which is a binary arithmetic operation and therefore
`MATH`'s territory — pitest documents the mutation as `this.i = this.i - 1`. It is a good example
of why bytecode mutation occasionally produces reports that read strangely against the source: two
lines of Java that look identical are two different bytecode shapes.

**★ A `MATH` mutant survives in your VAT calculation and the test looks thorough. What are the likely causes?**
Three, in order. The assertion is too weak — `isNotNull`, `isPositive` or `isCloseTo` with a
tolerance wider than the mutant's effect. The fixture values are degenerate — a quantity of 1 makes
`*` and `/` produce the same result, a rate of 0 makes `+` and `-` produce the same result, so the
mutant is genuinely equivalent for that input. Or the mutated expression's result is not on the
path to anything the test asserts on, which means the test covers the line but tests something
else. All three are fixed in the test, not in the production code.

**★ A colleague wants to disable `MATH` because "we barely do arithmetic". What do you tell them?**
That `MATH` covers more than arithmetic in the source. It mutates the bitwise operators, the shift
operators, and — because of the `iinc` restriction — every increment and decrement of a *field*,
which includes retry counters, running totals and index members. Disabling it removes mutants from
all of those. If the real problem is noise from one class, `excludedClasses` or a narrower
`targetClasses` glob is the right instrument; turning off an operator globally changes the
denominator of every future score.

{/* FOOTER */}
