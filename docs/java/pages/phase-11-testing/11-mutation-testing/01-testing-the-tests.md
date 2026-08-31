---
title: "Coverage proves a line executed; mutation testing changes that line and asks whether a single test noticed — it is the only automated instrument that measures your assertions rather than your call graph, and it is the honest answer to everything topic 09 said the number could not say"
sidebar_label: "01 · Testing the tests"
sidebar_position: 1
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against **pitest (PIT) 1.30.0** — released 2026-08-27, confirmed from
> `org/pitest/pitest/maven-metadata.xml` on
> [repo1.maven.org](https://repo1.maven.org/maven2/org/pitest/pitest/maven-metadata.xml) and the
> [GitHub releases](https://github.com/hcoles/pitest/releases) — and pitest's own documentation:
> [Basic concepts](https://pitest.org/quickstart/basic_concepts/),
> [Mutation operators](https://pitest.org/quickstart/mutators/),
> [Maven quick start](https://pitest.org/quickstart/maven/) and the
> [FAQ](https://pitest.org/faq/). Behaviour of statuses and scores read from pitest's source:
> `DetectionStatus.java`, `MutationStatistics.java`, `PercentageCalculator.java`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7,
> Testcontainers 2.0.5.
> ⚠️ **No sandbox, no build and no test runs on this machine.** Every page in this topic carries
> Java source, POM and Gradle configuration, and documented or source-read behaviour —
> **never a mutation score, console transcript or timing produced by a run.** Figures that appear
> are from pitest's own documentation and source, named as such.

**[Topic 09 · what coverage measures](../09-jacoco/01-what-coverage-measures.md) ends on an
admission: a coverage tool records one bit per probe — reached, or not — and there is nowhere in
that format to store "and the result was checked". A test with no assertions at all reaches 100%.
Mutation testing is the technique that closes exactly that hole, and it closes it the only way it
can be closed: by breaking your production code on purpose and finding out whether your test suite
turns red. This topic is about PIT, the tool that does that for the JVM, what its output means, what
it costs, and the narrow set of circumstances where paying that cost is the right call.**

## Picking up where coverage stopped

Topic 09's worked example is a shipping policy with a real rule in it and a test class that
executes every instruction and every branch while asserting nothing:

```java
public final class ShippingPolicy {

    private static final Money FREE_SHIPPING_THRESHOLD = Money.gbp("50.00");

    public Money shippingFor(Order order) {
        if (order.total().isGreaterThanOrEqualTo(FREE_SHIPPING_THRESHOLD)) {
            return Money.ZERO;
        }
        return Money.gbp("4.99");
    }
}
```

```java
class ShippingPolicyTest {

    private final ShippingPolicy policy = new ShippingPolicy();

    @Test
    void aboveThreshold() {
        policy.shippingFor(anOrderTotalling("60.00"));
    }

    @Test
    void belowThreshold() {
        policy.shippingFor(anOrderTotalling("10.00"));
    }
}
```

JaCoCo reports this class as fully covered on every counter it has. It is correct to do so — those
instructions did execute. The coverage tool is not lying; it is answering a different question from
the one the team believes it asked.

Now ask a question a coverage tool structurally cannot ask: **if I change `Money.ZERO` to
`Money.gbp("4.99")`, does anything in the suite fail?** It does not. **If I change `>=` to `>`?**
Nothing fails. **If I delete the whole `if` and always charge £4.99?** Nothing fails. Three
defects, injected deliberately, and the suite stays green — which is a precise, mechanical
measurement of the fact that these tests check nothing.

That measurement is the whole technique. Mutation testing systematically introduces small,
plausible faults into your compiled code, re-runs the tests that cover the faulted line, and
records whether any of them failed. A fault the tests catch is **killed**. A fault they do not
catch is a **survivor**, and every survivor is a sentence of the form *"this behaviour can change
and your build stays green."*

## The vocabulary, stated once

- A **mutation operator** (pitest calls them **mutators**) is a rule for making one small change
  to bytecode — replace `>=` with `>`, replace a `return true` with `return false`, delete a call
  to a `void` method.
- A **mutant** is one class file with exactly one such change applied. Pitest's docs:
  > *"These are Java classes which contain a mutation (or fault) which should make them behave
  > differently from the unmutated class."*
- A mutant is **killed** if some covering test fails while it is loaded, and **survives** if they
  all pass.
- The **mutation score** is the proportion of generated mutants that were detected. Its exact
  numerator is more interesting than it looks and gets its own chunk —
  [04 · Reading a report](04-reading-a-report.md).

The canonical example in pitest's own documentation is the conditionals boundary mutator, which
turns this:

```java
if ( i >= 0 ) {
    return "foo";
} else {
    return "bar";
}
```

into this:

```java
if ( i > 0 ) {
    return "foo";
} else {
    return "bar";
}
```

The source is not actually rewritten — pitest mutates bytecode, which matters enormously and is
[chunk 02](02-how-it-works.md)'s subject — but that is the change in behaviour a surviving mutant
here would represent: *nothing in your suite distinguishes "at least zero" from "more than zero"*.

## What the number is a property of

This is the single most useful reframing in the topic, and it is why mutation testing is a testing
tool rather than a code-quality tool.

**A coverage percentage is a property of the relationship between the tests and the code's
structure.** A mutation score is a property of the **assertions**. Nothing else in the JVM
ecosystem measures assertions. Static analysis reads your code; coverage watches your code
execute; a linter counts your `assertThat` calls without knowing whether any of them constrains
anything. Mutation testing is the only automated technique that answers *"if this were wrong,
would we find out?"* — which is the question a test suite exists to answer.

The practical consequence: **you cannot raise a mutation score with assertion-free tests.** The
shipping policy suite above scores zero on mutation while scoring 100% on coverage, and the only
way to move it is to write an assertion that constrains the returned `Money`. The metric is
resistant to the exact form of gaming that makes coverage targets counterproductive.

That resistance is not the same as being a good target. Mutation scores have their own pathologies
— equivalent mutants that cannot be killed at all, statuses that count as "detected" without any
test having detected anything, and a cost model that punishes large slow suites — and the rest of
this topic is largely about those.

## Where this connects

- **[01b · The tool and its versions](01b-the-tool-and-its-versions.md)** is the artifact story:
  what PIT actually is, the five separately-versioned pieces, and the JUnit Platform plugin that
  has not shipped since May 2025.
- **[09 · What coverage measures](../09-jacoco/01-what-coverage-measures.md)** is the argument this
  topic answers. Read it first if you have not: the shipping policy example above is lifted from it
  deliberately.
- **[09 · How JaCoCo works](../09-jacoco/01b-how-jacoco-works.md)** explains agent-based
  instrumentation. PIT also rewrites bytecode, but at a different moment and for a different
  reason, and running both in one build has a specific interaction —
  [chunk 05](05-wiring-it-up.md).
- **[04 · Mockito](../04-mockito/README.md)** matters more here than it looks: a suite built on
  `verify()` rather than on assertions about returned values kills a specific and narrow class of
  mutant, which [chunk 06](06-the-cost.md) picks apart.
- **[02 · AssertJ](../02-assertj/README.md)** is where the assertions that kill mutants get
  written. A weak assertion — `isNotNull()` on a value with a real invariant — is exactly what a
  surviving mutant points at.
- **10 · Property-based testing** *(not written yet)* attacks the same weakness from the other
  side: mutation testing asks whether your assertions are strong enough for the inputs you chose,
  property-based testing asks whether you chose enough inputs.

## Gotchas

**★ A high mutation score on a class with no logic means nothing at all.**
Getters, DTOs, `record` accessors and mapper classes generate few interesting mutants and the ones
they do generate are trivially killed by any test that touches them. Averaging those into a
project-wide score dilutes the only part of the number that carries information — the score on the
code that has decisions in it. Mutation testing is worth running on a pricing engine and worth
nothing on a package of `record`s.

**★ Mutation testing is not a code-quality tool and reporting it as one wastes the run.**
A surviving mutant does not say your production code is bad. It says one specific behaviour of it
is unconstrained by any test. The action is always "write or strengthen an assertion" or "decide
this behaviour genuinely does not matter and filter it" — never "refactor the production class".
Teams that put the mutation score on the same dashboard as complexity and duplication start
treating it as a code metric and then argue about the wrong thing.

**★ You cannot compare mutation scores between projects, or across a mutator-set change.**
The denominator is the number of mutants generated, which depends on the mutator set, the pitest
version, the filters active, and how much branching your code contains. Change the `mutators`
configuration and the score moves without a line of test code changing. Two teams quoting 78% are
not necessarily measuring the same thing, and the same team quoting 78% before and after a pitest
upgrade may not be either.

**★ The suite must be green before pitest will do anything, and its error message says so.**
Pitest computes per-test line coverage first, in a normal run of your tests. If any fail there, it
aborts with the message defined in `org.pitest.help.Help`:
> *"%s tests did not pass without mutation when calculating line coverage. Mutation testing
> requires a green suite."*

This is not a nice-to-have — the whole method depends on "test failed" meaning "the mutant was
detected", which is meaningless if tests were already failing.

**★ A flaky test poisons the result in a way that looks like a real finding.**
If a test fails intermittently, it will kill mutants it does not actually detect, on whichever
minion happened to run when it flaked. The mutation score comes out higher than the truth and the
specific mutants credited to it are effectively random. Mutation testing is one of the few
processes that makes flakiness *look like quality*, which is why the first prerequisite is a
deterministic suite — see **08 · Test data patterns**'s chunks on order dependence and clocks
([05b](../08-test-data-patterns/05b-tests-that-depend-on-each-other.md),
[06 · Random and time](../08-test-data-patterns/06-random-and-time.md)).

**★ "We have 90% coverage, so mutation testing will be quick" is backwards.**
Pitest's FAQ is explicit that *uncovered* code is nearly free — *"Due to the way PIT picks which
tests to run, there is little or no execution time cost for mutations on lines that have no test
coverage."* Cost is driven by covered mutants times the runtime of the tests that cover them. A
well-covered project with a slow suite is the expensive case, not the cheap one.

## Interview questions

**★ What is mutation testing, in one paragraph, and what does it measure that coverage does not?**
It compiles your code, then produces many copies of it with one small deliberate fault each — a
comparison operator flipped, a return value replaced, a `void` call deleted — and for each one runs
the tests that cover the faulted line to see whether any of them fails. A fault the tests catch is
killed; one they miss survives. What that measures is the strength of your assertions, which
coverage structurally cannot: coverage records that an instruction executed, and there is no field
in its execution data for whether the result was inspected. The practical difference is that an
assertion-free test drives coverage to 100% and mutation score to zero.

**★ Why can't a team just game a mutation score the way they game a coverage target?**
Because the only way to move it is to add an assertion that distinguishes correct behaviour from
the mutated behaviour. Calling a method without checking it kills nothing. The score is not
un-gameable — you can exclude classes, restrict the mutator set to the operators your code happens
to satisfy, or set the threshold where you already are — but every one of those is a visible
configuration change in the build file rather than a quiet change in the test code, which is a
meaningfully different kind of dishonesty.

**★ You run PIT on a class and it reports zero surviving mutants. Is that class well tested?**
It means every fault *from pitest's operator set* on covered lines was detected. That is real
evidence and it is bounded in three ways: the operator set does not model every possible defect
(nothing mutates your SQL, your regex literals, or the ordering of two independent statements);
mutants on uncovered lines are reported separately as no-coverage, not as survivors; and some
statuses count as detected without a test having detected anything. It is much stronger evidence
than 100% coverage, and it is not proof of correctness.

**★ Your service is at 91% line coverage and 34% mutation score. What does that combination tell you?**
That the tests execute nearly all of the code and constrain roughly a third of its behaviour. The
usual causes, in order of likelihood: tests that call and never assert; tests that assert on
something incidental (`isNotNull`, a status code, a list size) rather than on the value the method
computes; heavy use of mocks with `verify()` where the assertion is about interaction rather than
result; and integration-style tests that drag a lot of code through their call path while checking
only the endpoint's output. The gap between those two numbers is the size of the illusion the
coverage number was creating.

**★ Is PIT worth adding to a build where the tests are already good?**
Its cheapest genuine value is not the score — it is the list of surviving mutants on the code you
care about most, read once, by a person. On a well-tested domain module that list is short and
every entry is either a real missing assertion or a mutant you should filter. That is a
few-hours-per-quarter exercise, not a gate. Whether it should run on every build is a cost
question, and the answer is usually no for a whole repository and yes for changed code only —
[chunk 05c](05c-scoping-and-incremental.md) and [chunk 06](06-the-cost.md).

**★ Why does PIT insist the test suite passes before it starts?**
Because its entire signal is "a test failed while the mutant was loaded". If a test was already
failing without any mutant, that signal is uninterpretable — the mutant would be recorded as
killed by a failure that has nothing to do with it, inflating the score. Pitest therefore performs
a clean coverage run first and refuses to continue if anything is red, with the message *"Mutation
testing requires a green suite."*

{/* FOOTER */}
