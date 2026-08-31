---
title: "A table of cases is a sample of the input space in which its author could state an expected answer, which is why three whole classes of defect are structurally unreachable from it — and why a property is a different kind of claim rather than a larger number of tests"
sidebar_label: "01b · What a table cannot contain"
sidebar_position: 2
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)) for edge-case generation and
> the `Statistics` API, and the **JUnit Jupiter 6.0.3** user guide
> ([docs.junit.org/6.0.3](https://docs.junit.org/6.0.3/user-guide/)) for what
> `@ParameterizedTest` sources can and cannot express.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only.

**[The bill splitter](01-the-case-you-did-not-think-of.md) showed one defect a table missed.
This chunk generalises it. There are exactly three reasons a hand-written table cannot reach
part of the input space, and none of them is "the author was careless" — they are properties
of the medium. And once you see that, the useful reframing follows: a property is not more
tests, it is a different kind of claim, and the teams that read it as "more tests" write bad
properties and delete the example tests they still needed.**

## The three classes of case a table structurally cannot contain

It is worth being precise about *why* tables miss things, because "write more cases" is not
the fix and knowing why tells you when to reach for this technique.

**1 · The value nobody would type.** `Integer.MIN_VALUE` (whose `Math.abs` is itself
negative), the empty string, a string containing a surrogate pair, `BigDecimal` with a
negative scale, a `LocalDate` on 29 February, a `Duration` of exactly zero. Each of these is
findable by a person who has been bitten before. A generator finds them because its
arbitraries treat them as edge cases and mix them in deliberately — see
[08 · Edge cases, exhaustive generation and data](08-edge-cases-exhaustive-and-data.md).

**2 · The combination of two individually reasonable values.** A table is a list of rows;
a row is one combination. Two parameters with five interesting values each have twenty-five
combinations, three parameters have a hundred and twenty-five, and nobody writes a
hundred-and-twenty-five-row `@CsvSource`. The bug that only appears when the discount is
percentage-based *and* the currency has zero decimal places *and* the order has one line is
a bug a table will not have a row for. A property has both parameters in scope on every try.

**3 · The case that only exists at a size a human will not type.** A defect that needs a
list of forty elements, a string of 300 characters, or a nesting depth of six will not be in
a table, because typing the input is tedious and the reviewer would ask you to shorten it.
The generator does not find it tedious.

## What actually changed: the epistemics, not the count

The temptation is to read property-based testing as "a lot more tests". It is not, and
reading it that way produces bad properties. What changed is the *kind of claim the test
makes*.

- An example test claims: **this input maps to this output.** It is a fact. Facts are
  checkable, precise and, individually, weak — one fact rules out one behaviour.
- A property claims: **for all inputs in this set, this relation holds.** It is a
  specification. It is weaker per-input (it does not pin the answer down) and enormously
  stronger overall (it rules out a whole shape of behaviour).

The two are complements, not competitors, and the failure mode of teams that discover
property-based testing is deleting the example tests. Do not. An example test is the only
thing that pins down a *specific* required answer — that VAT on £19.99 at 20% is £4.00 and
not £3.99 — and a property will happily pass on an implementation that returns the wrong
number consistently, as long as it returns it *lawfully*. See
[11 · Where it does not pay](11-where-it-does-not-pay.md) for the full version of that
argument.

## Gotchas

**★ A generator is not uniform over the type, and you should not want it to be.**
If jqwik picked `int` values uniformly from 2³², you would essentially never see `0`, `1`,
`-1` or `Integer.MAX_VALUE`, which are the values that break code. jqwik deliberately
biases: the guide says most base-type arbitraries carry a set of edge cases and that
*"whenever an arbitrary is asked to produce a value it will mix-in edge cases from time to
time"*. This is why "random testing" is a misleading name for the technique — the
distribution is engineered, and understanding that it is engineered is what stops you from
believing a green property means "all inputs work".

**★ Reviewing a property is a different skill from reviewing a test, and most reviewers have never been taught it.**
On a normal test the reviewer checks the expected value. On a property there is no expected
value, so the only things to review are (a) is the law actually true of the specification,
and (b) does the generator's domain match production's domain. Reviewers who have not made
that switch approve properties on autopilot, and the two things that most need scrutiny —
a law that is subtly false at a boundary, and a `min`/`max` that quietly excludes the
interesting region — go through unexamined. If your team is adopting this, say out loud in
the first few reviews that the two questions to ask are "is the law true?" and "what does the
range exclude?"

**★ A table with a row per production incident is a good thing and a property does not replace it.**
Regression rows are not guesses about the input space; they are recorded facts about inputs
that actually occurred. They belong in a `@ParameterizedTest` table forever, with a comment
naming the incident, because they are the one part of the table that was not chosen by
imagination. When a property falsifies something, the falsifying sample should be *added to
that table*, not left to the generator to rediscover — a generator that found it once is not
guaranteed to find it again with a different seed.

**★ "We'll just add more cases" does not converge, because the input space is not linearly bigger than the table.**
Two `int` parameters is 2⁶⁴ combinations. Adding rows moves you from covering 5 of them to
covering 50. The only way to make progress is to stop enumerating inputs and start
constraining outputs, which is what a property does. If a code reviewer's response to a
production incident is "add a test for that input", they have fixed one point and left the
neighbourhood untouched.

**★ A property that generates over a range you chose is still bounded by your imagination — just at a coarser grain.**
`@IntRange(min = 1, max = 20)` on the number of ways to split a bill is a judgement call you
made, and it excludes `0`, `-1` and `Integer.MAX_VALUE`. Properties do not abolish the
author's assumptions; they relocate them from a table of values to the *boundaries of a
range*, where there are far fewer of them and they are far easier to review. That is a real
improvement and it is not the same thing as exhaustiveness.

**★ A green property tells you nothing until you know the generator produced interesting values.**
A property over `@ForAll String` that only ever sees strings of length 0–5 will not exercise
your parser's buffer-growth path, and it will pass, confidently, forever. This is not
hypothetical — it is the single most common way property suites become decorative. jqwik
ships `Statistics.collect()` and coverage checks specifically to make that visible; see
[09 · Statistics](09-statistics.md). A property you have never instrumented is a property
you are trusting on faith.

## Interview questions

## Interview questions

**★ Explain to a non-engineer why a test in your codebase contains no expected result.**
A normal test is like checking one specific receipt: "a £100 bill split three ways should
print £33.34, £33.33 and £33.33." A property is like checking a rule that must hold for every
receipt the till will ever print: "however we split a bill, the parts add back up to the
total." We do not write the answer down, because writing it down is the step that limits us
to the cases somebody could work out in their head — and the errors we care about are exactly
the ones nobody could work out in their head. The computer then tries the rule against a
thousand different bills, including the awkward ones, and tells us the smallest bill that
breaks it.

**★ Someone proposes replacing all your parameterized tests with properties. Argue against it.**
Three arguments, in order of force. First, properties cannot express a required specific
answer: the rule "the parts add up" is satisfied by a splitter that always returns the total
to one person and zero to everyone else, so anything a regulator or a contract specified by
value still needs an example. Second, regression cases have evidentiary value that a
generator does not reproduce — a row that says "input from incident 4211" is a permanent
record that this exact input once broke production, and deleting it in favour of a generator
that *might* rediscover it is losing information. Third, properties are far more expensive per
run and far harder to review, so a suite that is all properties is slower and less
scrutinised. The right ratio is a handful of properties on the code that has laws, plus the
table you already had.

**★ What does property-based testing actually give you that a well-written parameterized test does not?**
It changes what the test is a claim about. A parameterized test is a set of facts — this
input, that output — and the set was chosen by a person, so it can only contain cases that
person thought of, and in practice only cases whose expected output that person could
compute. A property is a universally quantified claim over a described input space: *for all
totals and all divisors, the shares sum to the total*. The tool then searches that space,
and it searches it differently on every run and specifically at edge values. Concretely: a
five-row bill-splitting table where every total divides cleanly will be green on an
implementation that loses a penny on `100.00 / 3`, and one three-line property will not be.
The complement matters too — a property does not pin down that VAT on £19.99 is £4.00, so
properties do not replace example tests, they cover the region example tests cannot reach.

**★ If properties are so much stronger, why not delete the example tests?**
Because a property constrains the shape of the answer and not the answer. An implementation
of `split` that returns all zeros satisfies "shares sum to the total" for a total of zero and
fails otherwise, but it is easy to write laws that a wrong-but-consistent implementation
satisfies completely — "the result is the same length as the input", "encoding then decoding
round-trips" — while the actual numbers are wrong. Example tests anchor the specification to
concrete required values, usually values that came from a regulation, a spec or a
stakeholder. The healthy suite has both: a small number of examples that say *what the
answer is* and a small number of properties that say *what is always true of the answer*.

**★ How do you decide which methods in a codebase deserve a property at all?**
Look for a method where you can state a relation without computing an answer. Round trips
(`parse(format(x)).equals(x)`), invariants that survive an operation (a sum, a count, a
sorted order, a total balance), idempotence (`f(f(x)) == f(x)`), and agreement with a
deliberately stupid reference implementation are the four that pay most often. If you cannot
finish the sentence "for all inputs, ..." without saying "it returns the right answer", there
is probably no property there and you should write examples instead — which is a real answer,
not a cop-out, and is the subject of the *where it does not pay* chunk.

**★ Where does this sit relative to mutation testing?**
They attack the same weakness from opposite ends. The weakness is that a suite's power is
bounded by what its author imagined. Property-based testing widens the *inputs* — you stop
choosing them. Mutation testing widens the *faults* — it changes the production code
underneath your existing tests and reports which changes no test noticed, which measures
whether your assertions are load-bearing. A codebase with high line coverage, a rich table of
cases and a suite that survives mutation is a codebase whose tests actually constrain
behaviour; any two out of three is not enough. They are separate topics because the tooling
and the failure modes are completely different, but the diagnosis they respond to is one
diagnosis.

{/* FOOTER */}

{/* FOOTER */}
