---
title: "Coverage measures which bytecode instructions ran, and nothing else: not which lines were tested, not which behaviour was checked, not whether a single assertion looked at the result — the gap between 'executed' and 'tested' is the whole subject of this topic"
sidebar_label: "01 · What coverage measures"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s own documentation
> ([jacoco.org/jacoco/trunk/doc](https://www.jacoco.org/jacoco/trunk/doc/)) — `counters.html`,
> `changes.html`, `classids.html`, `faq.html`, `implementation.html` — and the Maven plugin
> mojo pages. Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7,
> Testcontainers 2.0.5.
> ⚠️ **No sandbox, no build and no test runs on this machine.** Every page in this topic carries
> Java source, POM and Gradle configuration, and behaviour quoted from documentation —
> **never a coverage percentage produced by a run.** Numbers that appear are either from
> JaCoCo's own docs, named as such, or arithmetic on a worked example you can check by eye.

**A coverage tool answers exactly one question: while your tests ran, did this instruction
execute? That is a smaller question than anyone hopes. It is not "was this behaviour tested",
because executing a line and checking its result are different acts and JaCoCo can only see the
first. It is not "is this code correct", because a test with no assertion at all drives coverage
to 100%. The number is real and it is useful — it can prove the negative, that a piece of code
was never reached by anything — but the useful reading of it runs in one direction only, and
this topic is mostly about which direction.**

## The one thing the number genuinely proves

Coverage is a **one-directional instrument**, and this is the sentence to carry out of the topic:

- **0% on a class is a fact.** Nothing your test suite did caused that code to execute. There is
  no test for it. That conclusion is sound, and you can act on it.
- **100% on a class is not a fact about testing.** It says every instruction ran. It says nothing
  about whether anything looked at what happened.

Everything useful you will ever do with coverage exploits the first bullet. Everything that goes
wrong with coverage — the 80% gate, the sprint spent lifting a number, the reviewer who approves
a change because the bar stayed green — comes from someone reading the second bullet as though
it were the first.

## The test that covers everything and tests nothing

Here is a class with a genuine rule in it.

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

And here is a test that takes it to **100% line coverage and 100% branch coverage**:

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

Every instruction in `shippingFor` executed. Both arms of the `if` were taken. Every counter
JaCoCo has will report full coverage for this class, and a `check` rule demanding 100% will pass.

There is not a single assertion. The method could `return Money.gbp("4.99")` in both branches,
or return `null`, or charge the customer £499, and this suite stays green at 100%.

This is not a contrived example; it is the exact shape that appears when a team is asked to
raise a number rather than to test a behaviour. The tests are cheap to write, they genuinely
execute the code, and they are worth nothing. **Coverage cannot tell them apart from real
tests, because assertions are not part of what it measures.**

## Why it can't tell: what JaCoCo actually observes

JaCoCo does not read your tests. It does not know JUnit exists. It attaches to the JVM as a
Java agent and rewrites classes as they are loaded, inserting **probes** — boolean flags — at
points in the control flow. When the code runs, probes flip to `true`. At the end of the run
the array of flags is written to an execution data file, conventionally `jacoco.exec`.

Three consequences follow directly, and they explain most of the surprises in the rest of this
topic:

1. **Measurement happens on bytecode, not source.** JaCoCo counts things the compiler produced,
   including things you did not write — implicit constructors, static initialisers, the members
   the compiler generates for a `record`, the synthetic classes behind a `switch` on an enum.
   That is why a coverage number can move when nobody touched a test.
2. **The unit of truth is "an instruction executed".** Every other counter — line, branch,
   method, class — is derived from instruction-level probes plus information about how source
   maps onto bytecode. Lines in particular need the compiler to have emitted debug information;
   without it there is no line report at all.
3. **Nothing about the *outcome* is recorded.** A probe stores one bit: reached, or not. Whether
   the value the method returned was inspected, compared, or thrown away is invisible, and
   there is no place in the format where that information could be kept.

JaCoCo's own docs make the last point structurally clear: probes are, in its wording, *"stored in
a plain boolean array"*. One bit per probe. There is no room in a bit for "and it was correct".

## "Executed" versus "tested" — the distinction, stated properly

It is worth being precise, because the loose version of this argument ("coverage is useless")
is wrong and gets dismissed.

| Question | Can coverage answer it? |
|---|---|
| Did any test cause this line to run? | **Yes.** This is exactly what it measures. |
| Is there a test *for* this line? | No. Executing something incidentally, on the way to testing something else, counts identically. |
| Did a test check the result of this line? | No. Assertions are invisible to the instrument. |
| Would a bug introduced here be caught? | No — that is mutation testing's question, and it is **topic 11 · Mutation testing**'s whole subject *(not written yet)*. |
| Is this code unreachable dead code? | Not directly, but 0% coverage is where you look first. |

The second row is the one that does the most quiet damage. A controller test that posts a JSON
body will execute your validation annotations, your mapper, three constructors and a good deal
of a service — all of it counts as covered, and none of it was the subject of a test. Coverage
of a class is frequently a side effect of testing a *different* class.

## So what is it good for?

A tool that cannot tell a good test from an empty one is still worth running, for three
narrow, honest uses:

- **Finding the code nothing reaches.** Whole packages at 0% are a real finding: either dead
  code to delete, or a genuine hole in the suite. This is the highest-value use and it needs no
  threshold, no gate and no ceremony — just someone reading the report.
- **Seeing what a *change* did not touch.** Coverage on the diff of a pull request is a far
  better signal than coverage of the repository, because "you added forty lines and none ran"
  is actionable in a way that "the project is at 74.3%" never is. [Chunk 07](07b-coverage-in-ci.md)
  is about making that visible.
- **Stopping regression, as a floor.** A threshold that says "do not go *below* where we are"
  costs nothing and catches the pull request that quietly deletes a test class. A threshold that
  says "reach 80%" is a different instrument with different incentives, and
  [chunk 04b](04b-the-eighty-percent-ritual.md) is about why it goes wrong.

Notice that all three are uses of the *low* end of the scale. That is the one-directional
property again.

## Where this connects

- **[03 · The six counters](03-the-six-counters.md)** — what instruction, branch, line,
  complexity, method and class each actually count, from JaCoCo's own definitions. The
  differences between them are not cosmetic and one of them is a trap.
- **[06 · What the number cannot say](06-what-the-number-cannot-say.md)** — this chunk's
  argument taken to its limit, including the documented fact that `try`/`catch` is not a branch.
- **11 · Mutation testing** *(not written yet)* — the honest answer to "was this behaviour
  actually checked". Mutation testing changes your code and asks whether a test notices;
  a test with no assertions fails that question immediately. If this chunk annoyed you, that
  topic is the resolution.
- **[Phase 8 · Build and dependencies](../../phase-8-build-dependencies/README.md)** owns Maven and
  Gradle themselves. This topic wires a plugin into a build it assumes you already understand.

## Gotchas

**★ 100% coverage and zero assertions is not a hypothetical — it is what "raise the number" produces.**
When a team is measured on coverage, the cheapest way to move the metric is to call methods
without checking them, and that is exactly what appears. The tests are honest-looking, they run
fast, and they are inert. Any coverage target creates this pressure; the only defence is that
somebody reads the tests, which is a review problem rather than a tooling one.

**★ Coverage of a class is often a side effect of testing a different class.**
An end-to-end test drags a service, two mappers and a validator through its call path and marks
all of them covered. The report then shows a well-tested-looking mapper for which no test exists.
This is why "we are at 85%" tells you much less than "which classes are at 0%".

**★ A number quoted without its counter is meaningless, and most numbers are quoted that way.**
"We're at 80%" — of instructions, lines, or branches? Those are three different numbers on the
same code, and for most codebases instruction coverage reads highest and branch coverage lowest.
Teams routinely compare a line-coverage figure from one report against a branch threshold in
another and conclude something false.

**★ Coverage measures bytecode, so the number moves when nobody wrote code.**
Upgrading the compiler, switching a class to a `record`, adding Lombok, or turning on a
different `-parameters`/`-g` setting all change what instructions exist. The denominator shifts
underneath a threshold that was tuned to the old one, and the build breaks on a change that
contained no logic. [Chunk 05](05-exclusions.md) is about controlling this.

**★ Incidental execution is indistinguishable from deliberate testing, including to you.**
Six months later nobody remembers whether `PriceFormatter` is at 95% because it has tests or
because every controller test formats a price. Deleting the class's real test would move the
number by almost nothing, and nothing would flag it.

**★ "Coverage went up, so the change is fine" inverts the tool.**
Adding a large, thoroughly-executed but weakly-asserted feature raises the percentage. Deleting a
dead, untested module also raises it. Adding one careful test to a large untested class barely
moves it. The direction of the number and the quality of the change are only loosely related,
and the correlation is weakest exactly when the change is large.

**★ 0% is a fact, but not always the fact you think.**
A class at 0% might be untested — or it might be excluded at the agent rather than at the report,
or a victim of a class id mismatch, both of which render as 0%. JaCoCo's FAQ is explicit that the
report *"cannot distinguish whether the class was excluded from instrumentation or not executed"*.
Check [chunk 06c](06c-the-zero-percent-class.md) before you write the missing tests.

**★ There is no "coverage" counter — there are six, and the tools default to different ones.**
The Maven `check` goal's default limit is `INSTRUCTION`/`COVEREDRATIO`, which almost nobody
intends. Reading a threshold you did not fully specify as "line coverage" is the most common
configuration error in this whole topic, and it is silent.

## Interview questions

**★ What does code coverage actually measure?**
Which instructions in the compiled bytecode were executed while the tests ran. Not which lines
were tested, and nothing about assertions or correctness — a test that calls a method and checks
nothing produces identical coverage to one that checks everything. The useful reading is
one-directional: 0% proves nothing exercised the code, while 100% proves only that it ran.

**★ Your service is at 92% coverage and a production bug appears in a heavily covered class. Is the number wrong?**
No — the number is measuring what it always measured, and someone read it as a different
measurement. 92% says those instructions executed during the suite; it never claimed their
results were checked. Look at whether the covering tests assert on that class's output or merely
pass through it on the way to something else, and whether the bug is on a path that has no
branch — an exception path, for instance, which JaCoCo does not count as a branch at all.

**★ Why can't a coverage tool tell you whether a test asserted anything?**
Because it instruments the code under test, not the test, and it records one bit per probe:
reached or not. There is no channel in the execution data for "and the result was inspected".
Answering that question requires changing the program and observing whether tests fail —
which is mutation testing, a fundamentally more expensive technique because it re-runs the suite
per mutant.

**★ Would you ever set a coverage target of 100%?**
Not as a target across a codebase, because the cheapest route to it is assertion-free tests plus
exclusions, and you have then spent real effort to learn nothing. As a *floor on a specific
component* — a pure pricing or tax calculator with no I/O — it can be reasonable, since anything
unreached there really is suspicious. The distinction is floor versus target, and whether the
code in scope is the kind where every path genuinely matters.

**★ A colleague says coverage is useless. What's the accurate version of that claim?**
That its high end is uninformative, not that the tool is. Coverage cannot distinguish a good
test from an empty one, so a high percentage is not evidence of quality — but a *low* number is
solid evidence of absence, and per-change coverage on a pull request answers a real question
("did any of this run?"). The useful position is to use it as a floor and a discovery tool, and
to get the "was it actually checked" answer from mutation testing instead.

**★ Two reports on the same commit disagree — one says 88%, the other 71%. Give three explanations.**
Different counters (instruction coverage runs higher than branch coverage on the same code);
different scopes (one includes generated or configuration classes the other excludes, or one is
an aggregate across modules and one is a single module); and missing execution data or a class id
mismatch in one of them, which renders affected classes as 0% and drags the total down. Establish
which counter and which class set each number covers before treating the difference as real.

{/* FOOTER */}
