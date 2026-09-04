---
title: "oneOf and frequencyOf generate a sum type by choosing between arbitraries rather than between values, which means a two-value branch and a two-thousand-value branch get the same share of the sample — and because shrinking moves toward the start of the list, the order you write the alternatives in decides what every minimal failing case will look like"
sidebar_label: "05c5 · Choice among arbitraries"
sidebar_position: 27
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Randomly Choosing
> among Arbitraries* and *Select or generate values randomly*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); and the **jqwik 1.10.1
> javadoc** for `Arbitraries.oneOf`, `Arbitraries.frequency` and `Arbitraries.frequencyOf`
> ([jqwik.net](https://jqwik.net/docs/1.10.1/javadoc/net/jqwik/api/Arbitraries.html)).
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** Every signature, caveat and probability
> statement below is quoted or paraphrased from the guide and the javadoc; none of it is the
> output of a run here.

**`combine` and `flatMap` build a *product* — this and that and the other. This page is the
other half of algebraic data: a *sum*, where a value is one thing **or** another. jqwik has four
entry points for it, split along two axes — values versus arbitraries, weighted versus uniform —
and two documented shrinking rules that make the *order* of your alternatives a design decision
rather than a formatting one. The recursive case, where one alternative contains the whole
structure again, needs different machinery and is
[05c6](05c6-recursive-arbitraries.md).**

## Choosing between values, and choosing between arbitraries

Four entry points, and the difference between the pairs is what they hold:

| Call | Chooses between | Weighted? |
|---|---|---|
| `Arbitraries.of(v1, v2, …)` | **values** | No — uniform |
| `Arbitraries.oneOf(a1, a2, …)` | **arbitraries** | No — uniform |
| `Arbitraries.frequency(Tuple.of(w, v), …)` | **values** | Yes |
| `Arbitraries.frequencyOf(Tuple.of(w, a), …)` | **arbitraries** | Yes |

The `…Of` suffix means "of arbitraries". Getting that wrong is a compile error, so it costs you
thirty seconds rather than a bug, but knowing the rule saves the thirty seconds.

```java
@Provide
Arbitrary<Integer> oneOfThree() {
    IntegerArbitrary below1000 = Arbitraries.integers().between(-2000, -1001);
    IntegerArbitrary above1000 = Arbitraries.integers().between(1001, 2000);
    Arbitrary<Integer> oneOrMinusOne = Arbitraries.samples(-1, 1);
    return Arbitraries.oneOf(below1000, above1000, oneOrMinusOne);
}
```

The guide's comment on that example is the one worth internalising: *"In this example the
statistics should also give you an equal distribution between the three types of integers."*
Equal between the three **arbitraries**, not between the values they can produce — the third
alternative has two possible values and gets a third of the sample, so `-1` and `1` are each
roughly one try in six while any individual value from the two thousand-wide ranges is
vanishingly rare. That asymmetry is the whole reason `oneOf` exists.

Weighting is the same shape with a tuple:

```java
@Provide
Arbitrary<Integer> oneOfThree() {
    IntegerArbitrary below1000 = Arbitraries.integers().between(-1050, -1001);
    IntegerArbitrary above1000 = Arbitraries.integers().between(1001, 1050);
    Arbitrary<Integer> oneOrMinusOne = Arbitraries.samples(-1, 1);

    return Arbitraries.frequencyOf(
        Tuple.of(1, below1000),
        Tuple.of(3, above1000),
        Tuple.of(6, oneOrMinusOne)
    );
}
```

The weights are relative, not percentages. The guide spells the arithmetic out for the
value-level `frequency`: with weights summing to 36, *"'a' will be generated with a probability
of 1/36 whereas 'd' has a generation probability of 20/36 (= 5/9)"*. So `Tuple.of(1, …)` and
`Tuple.of(3, …)` and `Tuple.of(6, …)` sum to 10 and give you 10%, 30% and 60%.

Two shrinking facts, both documented and both easy to exploit:

> *"`Arbitrary<U> of(U... values)`: Choose randomly from a list of values. Shrink towards the
> first one."*

> *"Shrinking moves towards the start of the frequency list."*

**Order your alternatives from least to most interesting.** If a sum type has a trivial case and
several rich ones, put the trivial case first and every minimal failing sample that can be
expressed with it will be. If you put the rich case first, jqwik will faithfully shrink toward
it and you will read a minimal sample that is not minimal in any sense you care about.

## A sum type, generated

Sealed interfaces are the Java shape this maps onto, and the mapping is direct:

```java
sealed interface Payment permits Card, BankTransfer, Voucher {}

@Provide
Arbitrary<Payment> payments() {
    Arbitrary<Payment> vouchers = Arbitraries.strings().alpha().ofLength(10)
            .map(Voucher::new);
    Arbitrary<Payment> transfers = Arbitraries.strings().numeric().ofLength(18)
            .map(BankTransfer::new);
    Arbitrary<Payment> cards = Combinators.combine(
                    Arbitraries.strings().numeric().ofLength(16),
                    Arbitraries.integers().between(2026, 2035))
            .as((pan, expiryYear) -> new Card(pan, expiryYear));

    //  Vouchers first: they are the simplest case, so shrinking lands there when the
    //  defect is not payment-method-specific. Weighted because production traffic is
    //  overwhelmingly cards, and a property should meet the code where it lives.
    return Arbitraries.frequencyOf(
            Tuple.of(1, vouchers),
            Tuple.of(2, transfers),
            Tuple.of(7, cards));
}
```

⚠️ The comment is doing real work and belongs in the code. Weighting a generator toward
production traffic is a defensible decision and an invisible one: nothing in the report says
that vouchers were 10% of the sample. If a defect only affects vouchers, this generator finds
it seven times more slowly than a uniform one would — which is fine if the weighting was chosen,
and a silent hole if it was copied.

## Where this connects

- Building a product type from independent parts is
  [05c · Composing arbitraries](05c-composing-arbitraries.md); the dependent case is
  [05c3 · Dependent generation](05c3-dependent-generation.md).
- `Arbitraries.of`, `samples`, and the rest of the catalogue are
  [05a · The defaults nobody chooses](05a-the-defaults-you-inherit.md).
- Recursive structures, where one alternative contains the whole type again, are
  [05c6 · Recursive arbitraries](05c6-recursive-arbitraries.md).
- Why a shrinking target matters, and what "shrink towards the first one" buys you, is
  [06 · Shrinking](06-shrinking.md).
- Proving that the weighted alternatives actually arrived in the proportions you intended is
  what the topic's **statistics and coverage checking** material is for.
- The worked aggregate that a sum-typed field would slot into is
  [05c4 · A generator for an aggregate](05c4-a-generator-for-an-aggregate.md).

## Gotchas

**★ `oneOf` distributes evenly across *arbitraries*, not across values, so a two-value alternative and a two-thousand-value alternative get the same share of the sample.**
This is the point of `oneOf` and it still catches people, because "uniform" is read as "uniform
over values". In the guide's own example the `samples(-1, 1)` branch is one third of the sample,
so `-1` alone is about one try in six. Use it deliberately — it is the cheapest way to guarantee
that a rare-but-critical case is well represented — and never assume the distribution without
checking it.

**★ `frequency` weights are relative and unnormalised, so adding a fourth alternative silently changes the probability of the other three.**
With weights 1, 3 and 6 the shares are 10%, 30% and 60%. Add `Tuple.of(10, somethingNew)` and
they become 5%, 15%, 30% and 50% — every existing branch has been halved by a change that looks
purely additive in a diff. If the proportions matter, state the intended percentages in a
comment next to the weights so the next person has something to preserve.

**★ Weighting a generator toward production traffic is a legitimate decision that makes rare-case defects proportionally slower to find, and nothing in the report tells you it happened.**
`frequencyOf` with 7:2:1 is a good way to test the code where it actually lives, and it also
means a voucher-only defect needs roughly seven times as many tries to surface as a uniform
generator would. Both halves are true. Write the reason in a comment, and if a branch is
critical rather than common, give it a floor — or split it into its own property with its own
generator, where its weight is 100%.

**★ Enum generation shrinks toward the first constant, so reordering an enum's declaration silently changes every minimal failing sample that mentions it.**
The guide's catalogue entry is explicit: *"Choose randomly from all values of an enum. Shrink
towards first enum value."* That is free and useful — put `PENDING` before `SETTLED` and a
lifecycle defect that affects both is reported on `PENDING` — but it also means an enum reorder,
which looks like a cosmetic change and is usually done for readability, quietly relocates every
future counter-example. It is not a reason to freeze enum order; it is a reason to know why a
shrunk sample landed where it did before concluding the defect is state-specific.

**★ Declare each branch as `Arbitrary<Payment>` rather than letting inference pick a type from the branches.**
`Arbitraries.oneOf` and `frequencyOf` are generic over the element type, so writing
`Arbitrary<Card> cards = …` and then combining it with `Arbitrary<Voucher>` makes the inferred
element type depend on what the branches happen to be — and adding or removing a branch can
therefore change the inferred type of the whole expression, breaking a `@Provide` method's
declared return type in a way whose error message points at the wrong line. Declaring every
branch at the interface type costs nothing and keeps the generator's type stable as the
hierarchy grows.

**★ There is no documented mechanism for choosing a *type* of a sealed hierarchy automatically, so an alternative you forget to list is silently never generated.**
Adding a fourth `permits` case to the sealed interface does not add a fourth branch to your
`frequencyOf`. The compiler will not tell you — the generator still returns `Arbitrary<Payment>`
and still compiles. The property then goes green forever on a payment type it has never seen. If
you generate sealed hierarchies, put an exhaustive `switch` over the type somewhere in the test
sources so that adding a case breaks the build, and let the compiler carry the invariant the
generator cannot.

## Interview questions

**★ What is the difference between `oneOf` and `frequencyOf`, and between those and `of` and `frequency`?**
The `…Of` suffix means "of arbitraries": `oneOf` and `frequencyOf` choose between generators,
`of` and `frequency` choose between concrete values. The `frequency…` prefix means weighted:
`frequency` and `frequencyOf` take `Tuple2` pairs whose first element is a relative weight, and
the weights are unnormalised, so with 1, 3 and 6 you get 10%, 30% and 60%. The distinction that
actually matters in practice is arbitraries-versus-values, because `oneOf` distributes evenly
across the *branches* rather than across the values in them — an alternative holding two values
and one holding a two-thousand-wide integer range each get a third of the sample if there are
three branches. That is a feature. It is how you make sure a rare case gets a real share of a
run, and it is also how people accidentally over-test a boundary they only meant to include.

**★ You have a sealed interface with three implementations. How do you generate it, and what maintenance risk are you taking on?**
One arbitrary per implementation, then `frequencyOf` with weights chosen deliberately, with the
simplest implementation listed first so that shrinking lands there when the defect is not
specific to a subtype — the guide documents that shrinking *"moves towards the start of the
frequency list"*, and that is free ordering information most people leave on the table. The
maintenance risk is that the generator and the `permits` clause are two lists that nobody
reconciles: add a fourth implementation and the generator still compiles, still returns the
interface type, and simply never produces the new case, so every property over that type goes
green on code it has never executed. I would defend against it with an exhaustive `switch` over
the sealed type somewhere in the test sources — a `toString`-style helper, or the classifier for
a statistics block — so that adding a `permits` entry breaks the compile and the generator gets
updated with it.

**★ A colleague weights a generator 90/10 to match production traffic. Do you approve it?**
Yes, with a comment, and with one follow-up question. The weighting is legitimate: a property
suite that spends most of its budget on the path production actually takes finds the defects that
actually happen, and jqwik gives you `frequencyOf` for exactly this. The comment is mandatory
because nothing in the report says the sample was skewed, so the next person to read a green
property will assume even coverage. The follow-up question is whether the 10% branch is rare
*and* low-risk, or rare and high-risk. Rare and low-risk is fine at 10%. Rare and high-risk —
the refund path, the foreign-currency path — deserves a property of its own with a generator
that produces it every time, because a case you cannot afford to break should not be tested at
one tenth the rate of one you can.

**★ Why does the order of alternatives in an `oneOf` or `frequencyOf` matter?**
Because shrinking follows it. The guide documents two rules — `of(U... values)` *"Shrink towards
the first one"* and, for weighted choice, *"Shrinking moves towards the start of the frequency
list"* — so the first branch is the one every minimal failing sample will be expressed in when
the defect is not branch-specific. That is genuinely useful and free: put the simplest,
cheapest-to-read alternative first and your counter-examples come back in the form easiest to
reason about. Get it backwards and a defect affecting all three payment methods is reported as a
`Card` with a sixteen-digit PAN and a plausible expiry year, and the reader spends ten minutes
looking for something card-specific that is not there. It is one of a small number of places
where a formatting-looking decision changes the quality of every future failure report.

{/* FOOTER */}
