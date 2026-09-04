---
title: "Unfiltered equivalent mutants put a ceiling on the mutation score that nobody can compute, that differs per package, and that makes a count a steadier gate than a percentage — and this topic's own operators have already named nine specific ways to manufacture one, each with a different correct response"
sidebar_label: "04b2 · The ceiling"
sidebar_position: 26
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the pitest
> [Maven quick start](https://pitest.org/quickstart/maven/) entries for `mutationThreshold`,
> `testStrengthThreshold` and `avoidCallsTo`, quoted verbatim, and the
> [Mutation operators](https://pitest.org/quickstart/mutators/) page's per-operator warnings for
> `NON_VOID_METHOD_CALLS`, `EXPERIMENTAL_MEMBER_VARIABLE` and the returns mutators. Status semantics
> and the `maxSurviving` parameter read from pitest 1.30.0 source at the `1.30.0` tag:
> `org.pitest.mutationtest.DetectionStatus`, `statistics/MutationStatistics.getTotalSurvivingMutations`
> and `pitest-maven/.../PitMojo` (`maxSurviving`, default `-1`).
> `funmodifiablecollection`'s description from `build/intercept/defensive` in the same tag.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3,
> Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no build on this machine.** Every figure quoted is from pitest's documentation or
> source. **No ceiling, score or mutant count on this page came from a run.**

**[04b](04b-equivalent-mutants.md) established that equivalent mutants exist, that pitest filters five
recognisable shapes, and that no tool can find the rest. This chunk is the part you have to act on. The
unfiltered remainder is a permanent block of survivors that sets a ceiling on your mutation score below
100 — a ceiling nobody can compute, that differs between two packages of the same project, and that
makes a percentage a poor thing to gate on. It also has a specific, enumerable shape: by this point the
topic's own operator chunks have already named nine distinct ways to produce an unkillable mutant, and
each one has a different correct response.**

## The ceiling, and what it does to a threshold

Every unfiltered equivalent mutant is a permanent `SURVIVED` entry: in the denominator, never in the
numerator. Pitest's own threshold documentation is the only place in the docs where the tool warns you
about its own metric:

> *"Please bear in mind that your build may contain equivalent mutations. Careful thought must therefore
> be given when selecting a threshold."*

Three consequences run through the rest of this topic.

**A mutation score of 100 is not a target.** On code with real decisions the achievable ceiling is below
100 by an amount only a human reading the survivors can estimate. A package reporting 100 is telling you
something about the operator set, the scope, or the triviality of the code — not about the tests.

**The ceiling is per codebase, and per package.** Defensive value objects returning unmodifiable
collections, methods whose expected result is genuinely zero, `equals`/`hashCode` implementations and
`Optional`-returning methods tested only for the absent case all manufacture unkillable mutants at
different rates from a package of pure calculations. Two packages at 80% are not equally well tested, and
the difference is not in the tests.

**A count gates better than a percentage.** Equivalent mutants are a roughly constant *number* in a given
body of code. `maxSurviving` counts survivors instead of dividing them:

```java
if ((this.maxSurviving >= 0)
    && (result.getTotalSurvivingMutations() > this.maxSurviving)) {
  throw new MojoFailureException("Had "
      + result.getTotalSurvivingMutations() + " surviving mutants, but only "
      + this.maxSurviving + " survivors allowed");
}
```

⚠️ With one sharp edge: `getTotalSurvivingMutations()` is `getTotalMutations() - getTotalDetectedMutations()`,
so it counts **`NO_COVERAGE` mutants as survivors too** ([04c](04c-the-score-arithmetic.md)). On a
partially covered codebase that makes the number much larger than the survivor list you are reading, and
a `maxSurviving` gate set from the report's survivor count will fail immediately.

## The nine equivalent mutants this topic has already named

Every one of these came out of a specific operator chunk. Together they are most of what you will
actually meet.

| Where it comes from | Why it cannot be killed | Response |
|---|---|---|
| `MATH` with a fixture quantity of `1` or a rate of `0` ([03b](03b-arithmetic-mutators.md)) | `x * 1` and `x / 1` agree; `x + 0` and `x - 0` agree | **Change the fixture** |
| `PRIMITIVE_RETURNS` where the expected value genuinely is `0` ([03c2](03c2-reading-a-returns-survivor.md)) | `return 0` mutated to `return 0` | **Change the fixture** |
| `EMPTY_RETURNS` on an `Optional` method tested only for the absent case ([03c2](03c2-reading-a-returns-survivor.md)) | `Optional.empty()` mutated to `Optional.empty()` for that input | **Add a test with a present value** |
| A defensive `Collections.unmodifiableList(...)` getter ([02b3](02b3-the-filter-inventory.md)) | Nobody asserts a getter's result throws `UnsupportedOperationException` | **`+funmodifiablecollection`** |
| A `log.debug` line, if `FLOGCALL` is disabled ([02b2](02b2-logging-and-avoidcallsto.md)) | Nobody asserts on debug output | **Leave `FLOGCALL` on; use `avoidCallsTo`** |
| A metrics call — `counter.increment()` ([02b2](02b2-logging-and-avoidcallsto.md)) | Same argument as logging, and no default handling | **Add the package to `avoidCallsTo`** |
| `EXPERIMENTAL_MEMBER_VARIABLE` on a field explicitly initialised to its default ([03d3b](03d3b-the-experimental-operators.md)) | Removing an assignment of `0` leaves `0` | **Do not enable the operator** |
| `EXPERIMENTAL_NAKED_RECEIVER` on a method returning `this` ([03d3b](03d3b-the-experimental-operators.md)) | `builder.withX(..)` and `builder` are the same object | **Do not enable the operator** |
| `NON_VOID_METHOD_CALLS` on a method that already returns a default ([03d2e](03d2e-the-call-neutralising-operators.md)) | Documented: *"may also create equivalent mutations if it replaces a method that already returns one of the default values"* | **Scope the operator narrowly** |

Read the response column. **Four distinct kinds of answer** appear in it, and picking the right kind is
the whole skill.

## The four responses, and when each is right

**1 · Change the fixture.** This is the best outcome and the most common one people miss. A `MATH`
mutant that survives because the quantity is `1` is not telling you the assertion is weak; it is telling
you the *data* cannot discriminate. Pick values where every operator in the expression produces a
different result — a quantity of 3, a rate of 0.2, a total that is not a round number. The same applies
to `PRIMITIVE_RETURNS` on a zero result: an empty basket's `itemCount()` is `0` with or without the
mutant, so use a basket with items.

```java
// Equivalent under MATH: 1 * 10 and 1 / 10 are not distinguished by a rounding rule,
// and a VAT rate of 0 makes the +/- mutant on the VAT line identical.
anInvoice().withLine("widget", 1, Money.gbp("10.00")).withVatRate(ZERO).build();

// Discriminating: every operator in the expression yields a different total.
anInvoice().withLine("widget", 3, Money.gbp("10.00")).withVatRate(new BigDecimal("0.20")).build();
```

**2 · Add a test the mutant *can* distinguish.** An `EMPTY_RETURNS` mutant on an `Optional`-returning
method is genuinely equivalent for the not-found input. No amount of strengthening the not-found test
will kill it, because for that input the original and the mutant return the same thing. What kills it is
a second test where the value is present. This is the case where "the survivor is equivalent" and "the
survivor is a finding" are both true, of different inputs.

**3 · Record the decision in the build file.** For a category you have decided is not worth testing —
metrics calls, a defensive collection wrapper — the right move is a filter or an `avoidCallsTo` entry,
because it is visible, reviewable and applies consistently. Leaving twenty permanent survivors in the
report so that everyone learns to ignore that section is the failure mode this replaces.

```xml
<features>
  <feature>+funmodifiablecollection</feature>
</features>
<avoidCallsTo>
  <avoidCallsTo>java.util.logging</avoidCallsTo>
  <avoidCallsTo>org.apache.log4j</avoidCallsTo>
  <avoidCallsTo>org.slf4j</avoidCallsTo>
  <avoidCallsTo>org.apache.commons.logging</avoidCallsTo>
  <avoidCallsTo>org.apache.logging.log4j</avoidCallsTo>
  <avoidCallsTo>io.micrometer.core.instrument</avoidCallsTo>
</avoidCallsTo>
```

**4 · Accept it.** Some survivors are equivalent, unfilterable and not worth configuring around. The
correct response is to leave them and to remember that they are in the denominator — which is precisely
why the gate should be `maxSurviving` at the current count rather than a percentage.

🔴 **There is a fifth response that is always wrong: editing the production code to make the entry go
away.** A mutation report is not a code-quality report. Changing `x * -1` to `-x`, or removing a
defensive copy, or inlining a guard, in order to change a number, is optimising the measurement instead
of the thing measured.

## Where this connects

- **[04b · Equivalent mutants](04b-equivalent-mutants.md)** — the definition, the undecidability argument, and pitest's five filters.
- **[04c · The score arithmetic](04c-the-score-arithmetic.md)** — what `maxSurviving` counts, and why test strength is a different denominator.
- **[03b · Arithmetic mutators](03b-arithmetic-mutators.md)** — fixture values of 0 and 1, the most common source of an equivalent mutant nobody filters.
- **[03c2 · Reading a returns survivor](03c2-reading-a-returns-survivor.md)** — the `Optional` absent-case survivor and the zero-result survivor.
- **[02b3 · The filter inventory](02b3-the-filter-inventory.md)** — `funmodifiablecollection` and the rest of the switchable filters.
- **[02b2 · Logging and `avoidCallsTo`](02b2-logging-and-avoidcallsto.md)** — the one filter with a user-editable list, and the metrics case.
- **[08 · Test data patterns](../08-test-data-patterns/01-the-forty-line-setup.md)** — choosing fixture values that discriminate, which is response 1 stated as a testing practice.

## Gotchas

**★ A 100% mutation score means your operator set or scope is too narrow, not that your tests are perfect.**
Equivalent mutants put a ceiling below 100 on any code with real logic. So a package reporting 100 is
either trivial — `record`s, DTOs, mappers — or measured by too few operators, or scoped to exclude the
interesting classes. Treat it as a prompt to check the *Active mutators* list and the `targetClasses`
glob, not as a result ([04a](04a-the-html-report.md)).

**★ The equivalent-mutant ceiling differs per package, so cross-package comparison is meaningless.**
Defensive value objects, methods whose expected result is genuinely zero, and `equals`/`hashCode`
implementations all generate unkillable mutants at different rates from a package of pure calculations.
Two packages at 80% are not equally well tested, and the difference is not in the tests.

**★ Pitest's threshold documentation is the only place the tool warns you about its own metric.**
*"Please bear in mind that your build may contain equivalent mutations. Careful thought must therefore be
given when selecting a threshold."* That sentence is in the `mutationThreshold` entry and nowhere else.
If somebody is proposing a percentage gate, it is the sentence to put in front of them.

**★ `maxSurviving` counts `NO_COVERAGE` mutants as survivors.**
`getTotalSurvivingMutations()` is total minus detected, and `NO_COVERAGE` carries `detected = false`. So
the number the gate compares against is survivors *plus* uncovered mutants, which on a partially covered
codebase is far larger than the survivor list in the report. Set the limit from the actual failure
message, not from what you counted by eye.

**★ The most common equivalent mutant is caused by the test, not by the code.**
Fixture values of 0 and 1 make `MATH` mutants indistinguishable; a zero expected result makes
`PRIMITIVE_RETURNS` indistinguishable; an `Optional` test that only covers the absent case makes
`EMPTY_RETURNS` indistinguishable. None of these is filterable, because pitest cannot see your fixtures —
and all of them are fixed in the test rather than accepted.

**★ Accepting a survivor and hiding it are different, and only one of them survives a handover.**
Deciding a category is not worth killing is legitimate; recording that decision as a filter or an
`avoidCallsTo` entry makes it reviewable. Leaving the survivors in the report teaches everyone to skim
past that section, and six months later nobody knows which of them were decisions and which were
oversights.

**★ Editing production code to remove a mutant is always the wrong response.**
Rewriting `x * -1` as `-x`, deleting a defensive copy, or inlining a guard clause in order to change a
report entry is optimising the measurement. A survivor says something about the tests; the three
legitimate responses are a better assertion, a better fixture, or a recorded decision.

**★ An operator you enabled is a category of equivalent mutant you signed up for.**
Three of the nine entries above exist only because somebody turned on `EXPERIMENTAL_MEMBER_VARIABLE`,
`EXPERIMENTAL_NAKED_RECEIVER` or `NON_VOID_METHOD_CALLS`. Each of those operators has a documented
warning saying so. The cheapest response to an equivalent mutant is often to not have generated it
([03d2f](03d2f-adopting-an-optional-operator.md)).

## Interview questions

**★ What does the equivalent mutant problem mean for setting a mutation score threshold?**
That the achievable ceiling is below 100 by an amount nobody can compute, and that it differs per
package. Pitest's own `mutationThreshold` documentation says *"Please bear in mind that your build may
contain equivalent mutations. Careful thought must therefore be given when selecting a threshold."* The
practical consequences are: never gate at 100; set any percentage with real headroom below the observed
value; and prefer `maxSurviving`, which counts survivors rather than dividing them, because the number of
equivalent mutants in a given body of code is roughly constant and therefore does not move the gate when
unrelated things change the mutant count. The caveat on `maxSurviving` is that it counts uncovered
mutants as survivors too, so the limit has to come from an actual run.

**★ Someone proposes gating the build at 100% mutation coverage on a new module. What do you say?**
That it will either fail permanently or prove the module has no logic in it. Equivalent mutants are
unavoidable on code with real decisions — a method whose expected result is genuinely zero makes a
`PRIMITIVE_RETURNS` mutant indistinguishable; a defensive `Collections.unmodifiableList` wrapper makes a
survivor nobody will assert against; an `Optional`-returning method tested only for the absent case makes
its `EMPTY_RETURNS` mutant equivalent for that input. A green 100% therefore tells you the operator set
is narrow, the scope excludes the interesting classes, or the module is `record`s and mappers. I would
gate on `maxSurviving` at the number the module currently has, so the count can only go down, and keep
the percentage as something a person reads.

**★ You have a `MATH` survivor on a VAT calculation and the test looks thorough. Is it a finding?**
Possibly not, and the way to tell is to look at the fixture before the assertion. If the quantity is 1,
`x * 1` and `x / 1` give the same answer; if the VAT rate is 0, the `+`/`-` mutant on the VAT line gives
the same answer. In both cases the mutant is genuinely equivalent *for that input* and no strengthening
of the assertion will kill it — the fix is a fixture whose values discriminate: a quantity of 3, a rate
of 0.2, a total that is not round. If the fixture already discriminates, then it is a real finding and
the assertion is too weak — `isNotNull`, `isPositive` or an `isCloseTo` with a tolerance wider than the
mutant's effect. Fixture first, assertion second; people reliably check them in the other order.

**★ Walk me through your four options when you decide a survivor cannot be killed.**
Change the fixture, if the mutant is equivalent only because the test data cannot discriminate — that is
the most common case and the best outcome, because it strengthens the test. Add a different test, if the
mutant is equivalent for the input you have but not for another one; the `Optional` absent-case survivor
is the standard example, and no amount of work on the existing test will kill it. Record the decision in
the build file, if it is a category you have decided is out of scope — a filter such as
`+funmodifiablecollection`, or an `avoidCallsTo` entry for a metrics package — because that makes the
decision visible and consistent instead of leaving people to learn which parts of the report to skip.
Or accept it, and remember it sits in the denominator, which is the argument for gating on a count
rather than a percentage. The one option that is never right is editing the production code to make the
entry disappear.

**★ Why is it worth knowing which of pitest's "equivalences" are facts and which are policies?**
Because you are allowed to disagree with the policies. Pitest names two causes: a mutant that behaves
identically, which is a fact about the program, and a mutant that behaves differently *"in a way that is
outside the scope of testing"*, which is a judgement — its example is logging. That second category is
reversible, and on an audit trail or a regulated event log it is reversed: the behaviour is the product
and you do want it asserted. The right response there is not to disable `FLOGCALL` globally, which turns
debug-logging mutants back on everywhere, but to stop the auditable calls looking like logging — a domain
call that pitest mutates and a test can assert on. Knowing the difference tells you which survivors are
a permanent tax and which are a configuration choice somebody made on your behalf.

{/* FOOTER */}
