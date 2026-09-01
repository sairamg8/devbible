---
title: "The if-side and else-side remove-conditionals mutants on one line are opposite forcings of the same decision, so the useful unit of information is which of the two lived — a diagnostic that names the missing test rather than the area, that branch coverage structurally cannot express, and that costs you a wave of JVM-killed mutants on every null guard in the codebase"
sidebar_label: "03d2b · Reading the pair"
sidebar_position: 15
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page — the *Remove Conditionals
> Mutator* section, quoted verbatim, including its stated reason for the operator being off by
> default — and the [Maven quick start](https://pitest.org/quickstart/maven/) entries for `mutators`,
> `targetClasses` and `reportsDirectory`. Group membership from pitest 1.30.0 source at the `1.30.0`
> tag: `engine/gregor/config/StandardMutatorGroups.java`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> ⚠️ **No sandbox and no build on this machine.** Operator behaviour is quoted from pitest's
> documentation; the Java and XML on this page are illustrative source, never a run.

**[03d2](03d2-the-optional-operator-inventory.md) is the mechanism: four specialisations, two axes, a
group name that resolves to all of them. This chunk is the payoff and the decision. A
remove-conditionals result is only half a finding on its own — the `_IF` and `_ELSE` mutants on one
line are opposite forcings of a single decision, and it is the pair that tells you which test is
missing. That is a strictly finer instrument than branch coverage and than `NEGATE_CONDITIONALS`, and
it comes with one real cost that nobody mentions: on defensive code the operator's mutants are killed
by the JVM rather than by your assertions.**

## The diagnostic table

This is the same two-sided reading the boolean returns mutators produce
([03c2](03c2-reading-a-returns-survivor.md)), and for the same structural reason: the two variants
force opposite outcomes of one condition.

| What you see on a line | What it means | What to write |
|---|---|---|
| Both `_IF` and `_ELSE` killed | Both outcomes of the condition are asserted | Nothing |
| `_IF` survived, `_ELSE` killed | Nothing checks the case where the guard is **false** | A test for the false case |
| `_ELSE` survived, `_IF` killed | Nothing checks the case where the guard is **true** | A test for the true case |
| Both survived | The condition's outcome is not observed at all | Both |

The direction is the part everyone gets backwards, so derive it rather than memorising it. `_IF` makes
the guarded statements *always* execute; the only input that can notice is one for which the guard is
false. `_ELSE` makes them *never* execute; the only input that can notice is one for which the guard is
true. **The surviving variant names the branch you have no test for.**

Concretely, on a discount rule:

```java
public Money discountFor(Customer customer, Order order) {
    if (customer.isLoyaltyMember()) {
        return order.total().multiply(LOYALTY_RATE);
    }
    return Money.ZERO;
}
```

```java
// The only test on this method.
@Test
void loyaltyMembersGetTenPercent() {
    assertThat(policy.discountFor(aLoyaltyMember(), orderTotalling("100.00")))
        .isEqualTo(Money.gbp("10.00"));
}
```

`_ELSE` forces `discountFor` to return `Money.ZERO` for everybody, which breaks this test, so it dies.
`_IF` forces the discount branch for everybody — and this test only ever passes a loyalty member, who
takes that branch anyway — so it survives. One survivor, and it says precisely: *nothing here checks
what an ordinary customer gets.*

```java
@Test
void everyoneElseGetsNothing() {
    assertThat(policy.discountFor(anOrdinaryCustomer(), orderTotalling("100.00")))
        .isEqualTo(Money.ZERO);
}
```

With that second test in place, the `_IF` mutant hands the ordinary customer a discount, the assertion
fails, and it dies too. Both killed is the state you want, and the state you left behind was exactly
readable while it lasted.

That is why the pair matters and a single entry does not. A report skimmed for "survived" rows, without
noticing whether the sibling on the same line was killed, throws away the half of the signal that names
the test.

## Sharper than branch coverage, and sharper than `NEGATE_CONDITIONALS`

**Against branch coverage.** JaCoCo's branch counter goes green the moment any caller drives the
condition both ways, and there is no field in its execution data for whether either result was checked
([09 · Branch coverage](../09-jacoco/03b-branch-coverage-is-the-useful-one.md)). Both branches of the
rule above are "covered" by a single integration test that walks through the pricing service and
asserts on an HTTP status code. The remove-conditionals pair distinguishes that case from a real test.

**Against `NEGATE_CONDITIONALS`.** Negating the comparison swaps *both* branches at once, so a survivor
says only that the decision's outcome is unobserved — true, useful, and not localised. The
remove-conditionals variants force one branch each, so the pair says which side. On a suite with a
happy path and no unhappy path, which is the common shape, that is the difference between "look at this
method" and "add the ineligible-customer case".

**Against `CONDITIONALS_BOUNDARY`.** These measure different things and it is worth not confusing them.
`CONDITIONALS_BOUNDARY` shifts `>=` to `>`, which changes behaviour for exactly one input — the
threshold — so its survivor means the boundary value is untested. A remove-conditionals survivor means
a whole branch is unasserted. Both on one line is a line with essentially no test; a boundary survivor
alone is a missing `@CsvSource` row ([03](03-mutators.md)).

## Why it is off, and why the recommendation is still right

> *"The reason these are not enabled by default is that there is a large degree of overlap in the tests
> required to kill these mutations and those required to kill mutations from other default operators
> such as the conditional boundaries mutator."*

That is a third reason, distinct from the two design criteria in
[03d2](03d2-the-optional-operator-inventory.md): **redundancy**. The tests you write to kill a
`CONDITIONALS_BOUNDARY` mutant usually kill the remove-conditionals mutants on the same line as a side
effect, so most of what this operator adds is extra mutants that die to assertions you already have —
cost with no new information.

So the recommendation —

> *"it is highly recommended that you enable it if you wish to ensure your test suite has full coverage
> of conditional statements"*

— and the default do not contradict each other. The conditional clause is doing the work. Enable it when
the **guarantee** is what you want: every conditional constrained in both directions, on code where
that matters. Leave it off when you are reading the report for **findings**, because the default set
will surface the same findings for less runtime.

## The cost nobody mentions: null guards

On a null check —

```java
if (customer != null) {
    total = total.subtract(customer.loyaltyDiscount());
}
```

— the `_IF` variant forces the body to execute against a `null` customer, and the mutant dies of a
`NullPointerException` rather than of an assertion. That is the "unstable" failure mode from
[03d2](03d2-the-optional-operator-inventory.md) arriving inside an operator that is otherwise well
behaved, and it lands precisely in the defensive code that was never interesting to measure.

The consequence is a class of reports that look excellent and mean nothing. A utility package full of
null guards will show a high remove-conditionals kill rate, contributed entirely by the JVM. The
per-class breakdown separates that from the genuine findings on business rules; the headline percentage
merges them, which is one more reason [04 · Reading a report](04-reading-a-report.md) argues for reading
the per-status and per-class numbers rather than the total.

Codebases written with `Optional`, `record` components and non-null invariants barely see this. Codebases
written with a null check at the top of every method see little else.

## Scoping it

Use the additive form, and put a `targetClasses` glob next to it:

```xml
<configuration>
  <mutators>
    <mutator>DEFAULTS</mutator>
    <mutator>REMOVE_CONDITIONALS</mutator>
  </mutators>
  <targetClasses>
    <param>com.example.pricing.*</param>
  </targetClasses>
  <reportsDirectory>${project.build.directory}/pit-reports-pricing</reportsDirectory>
</configuration>
```

The glob is not decoration. `mutators` is a property of the whole pitest execution and there is no
per-package operator configuration in the open-source tool, so "remove conditionals for the pricing
rules and the defaults everywhere else" is expressed as a **separate execution** with its own scope and
its own report directory — not as one run with two operator sets.

That produces two mutation scores with two different denominators, which is correct and worth stating
explicitly: they are not comparable with each other, they are not comparable with the previous run's
single number, and adding them together produces a figure that means nothing. What you are buying is a
list of surviving `_IF`/`_ELSE` pairs on the code you care about.

## Where this connects

- **[03d2 · Optional operators](03d2-the-optional-operator-inventory.md)** — the mechanism: the four
  specialisations, the group, and the two-bucket rule for reading any optional operator's warning.
- **[03c2 · Reading a returns survivor](03c2-reading-a-returns-survivor.md)** — the
  `TRUE_RETURNS`/`FALSE_RETURNS` pair, the same diagnostic shape applied to a predicate's answer.
- **[03 · Mutators](03-mutators.md)** — `CONDITIONALS_BOUNDARY` and `NEGATE_CONDITIONALS`, and what each
  of their survivors means.
- **[04 · Reading a report](04-reading-a-report.md)** — why the per-class and per-status breakdown
  carries the information and the headline percentage does not.
- **[09 · Branch coverage is the useful one](../09-jacoco/03b-branch-coverage-is-the-useful-one.md)** —
  the metric this operator supersedes, and the exact respect in which it does.
- **[03 · Parameterized tests](../03-parameterized-tests/README.md)** — two rows, one per branch, is
  what killing a remove-conditionals pair usually looks like in practice.

## Gotchas

**★ Pitest recommends `REMOVE_CONDITIONALS` and does not enable it, and both are correct.**
The mutators page says it is *"highly recommended that you enable it if you wish to ensure your test
suite has full coverage of conditional statements"*, and the same page says the reason it is off is
*"a large degree of overlap in the tests required to kill these mutations and those required to kill
mutations from other default operators"*. Those answer different questions — guarantee versus
information per unit of runtime. Quoting one at someone quoting the other is the most common argument
about this operator.

**★ A single remove-conditionals result is half a finding — read the pair.**
The `_IF` and `_ELSE` variants on one line are opposite forcings of the same decision, so the unit of
information is which of the two lived. A report filtered to "survived" rows, with the killed siblings
hidden, drops exactly the half that localises the missing test.

**★ Both variants surviving on a line covered by exactly one test is not the same finding as both surviving on a line covered by ten.**
With one covering test that only exercises one branch, both mutants can survive simply because nothing
drives the other path — that is a missing test, not a weak assertion. With several covering tests that
do drive both paths, both surviving means the outcome is never asserted. The mutation report does not
distinguish these; the covering-tests list on the HTML page for that mutant does
([04a](04a-the-html-report.md)).

**★ `REMOVE_CONDITIONALS` is killed by the JVM on null guards.**
Forcing `if (customer != null)` to execute its body drives a `NullPointerException`, which pitest
records as a kill. On defensive code the operator therefore reports high kill rates that measure
nothing, in the same run where it reports genuine findings on business rules. Look at which classes the
kills came from before believing them.

**★ Enabling an optional operator is a whole-execution change, not a per-package one.**
`mutators` applies to the entire pitest run. Adding `REMOVE_CONDITIONALS` "for the pricing package"
means a second execution with its own `targetClasses` and `reportsDirectory`, or it means enabling it
everywhere. Teams that do not realise this enable it globally, watch the runtime and the survivor count
climb across code they never intended to measure, and turn it off again a week later.

**★ Two executions produce two scores, and neither is the project's mutation score.**
Different operator sets mean different denominators. A `DEFAULTS` run over the repository and a
`DEFAULTS + REMOVE_CONDITIONALS` run over one package are two measurements of two things; averaging
them, or reporting the second as "the mutation score went up", is the arithmetic that makes people stop
trusting the number.

**★ A remove-conditionals survivor next to a `CONDITIONALS_BOUNDARY` survivor is a different message from either alone.**
The boundary survivor says the threshold value is untested. The remove-conditionals survivor says a
whole branch is unasserted. Together they say the line is executed by tests that assert on something
else entirely — which is the signature of a class covered only by an integration test walking past it.

## Interview questions

**★ What does a `REMOVE_CONDITIONALS` survivor tell you that a `NEGATE_CONDITIONALS` survivor does not?**
Which side. `NEGATE_CONDITIONALS` inverts the comparison, so both branches swap at once and a survivor
says only that the decision's outcome is unobserved. The remove-conditionals specialisations force one
branch each, so the pair of results localises the gap: `_IF` surviving while `_ELSE` dies means the
false case is untested — the mutant that makes the guarded statements always execute can only be caught
by an input for which the guard is false — which on a rule with a happy-path-only suite is exactly the
missing test.
Branch coverage cannot express this at all — it reports both branches taken as soon as any caller
exercises them, and has no field for whether either result was checked.

**★ You enable `REMOVE_CONDITIONALS` and the mutation score falls by six points. What do you report?**
That the measurement got stricter and the tests did not get worse. The operator adds mutants, so the
denominator grows; every new mutant that nothing kills is a conditional whose outcome was already
unconstrained before the operator existed — you simply could not see it. The correct report is the list
of surviving `_IF`/`_ELSE` pairs, not the delta in the percentage, and the correct baseline from here on
is the new run rather than the old one. This is also the moment to write down which operator set
produced which number, because the two are not comparable in either direction.

**★ Your utility package scores 96% with remove-conditionals enabled and your domain package scores 71%. Which is better tested?**
Almost certainly the domain package, and the comparison is the trap. A utility package full of null
guards and argument checks gives this operator a large supply of mutants that die of
`NullPointerException` when the guard is forced open — killed by the JVM, not by an assertion. The
domain package's conditionals are business decisions whose branches produce different values, so its
mutants can only be killed by something asserting on the result. The scores are measuring two different
things, which is the general reason mutation scores are not comparable across packages any more than
across projects.

**★ How would you enable this operator for one package only?**
By running pitest twice. `mutators` is a property of the whole execution and there is no per-package
operator configuration in the open-source tool, so a second execution — its own `mutators`, its own
`targetClasses` glob, its own `reportsDirectory` — is the only way to say "remove conditionals for the
pricing rules and the defaults everywhere else". Doing it in one run applies the extra operator to the
whole codebase, and the usual outcome is that somebody turns it off again and the information is lost.
It also keeps the two mutation scores separate, which they have to be: different operator sets mean
different denominators.

**★ When would you *not* enable it, on code you care about?**
When what you want from the run is findings rather than a guarantee. Pitest's own stated reason for
leaving it off is that the tests required to kill these mutations overlap heavily with the tests
required to kill `CONDITIONALS_BOUNDARY` and the returns mutators, so on a first pass it mostly
generates mutants that die to assertions you are about to write anyway — and every one of those costs
runtime, with survivors costing the most because each runs all its covering tests to completion. The
sequence that works is: run the defaults, fix every survivor, and only then add this operator to check
that nothing is left. Reaching for it before the defaults are clean is buying precision you cannot yet
use.

{/* FOOTER */}
