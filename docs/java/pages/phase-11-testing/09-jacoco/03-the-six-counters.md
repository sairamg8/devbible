---
title: "The six counters: instruction, branch, line, complexity, method and class are six different numbers on the same code, they disagree with each other by design, and 'we're at 80%' is meaningless until you say which one you mean"
sidebar_label: "03 · The six counters"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `doc/counters.html`, with the counter
> definitions quoted directly, plus `check-mojo.html` for the counter names accepted in rules.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> JUnit Jupiter 6.0.3.
> ⚠️ **No build and no test runs on this machine.** Every number on this page is either quoted
> from JaCoCo's documentation or arithmetic on a worked example you can check by reading it.

**JaCoCo reports six counters, and a team that does not know which one its threshold uses does
not know what its threshold means. They are not six views of one quantity — they are six
different questions with different answers on the same class, and the spread between them is
often twenty points or more. The defaults compound this: both Maven and Gradle default an
unspecified rule to `INSTRUCTION`, which is systematically the most generous of the six.**

## The six, from JaCoCo's own definitions

### Instructions (C0)

*"The smallest unit JaCoCo counts are single Java byte code instructions."*

This is the foundation. Every other counter is derived from instruction-level probe data plus
some extra information. Two properties follow, and both are quoted or directly stated in the
documentation:

- **It is independent of source formatting.** Reformatting a file, splitting a long expression
  across three lines, or running a code formatter does not change instruction counts.
- **It is available without debug information.** Unlike lines, it needs no `-g` compiler flag.

That robustness is real, and it is why instruction coverage is the default. It is also why the
default is a poor gate: instructions are numerous and most of them are on the happy path, so
executing a method once covers most of its instructions regardless of how many decisions it
contains.

### Branches (C1)

Decision points in `if` and `switch` statements — did each arm get taken?

🔴 The documented caveat is the most important sentence in this whole topic:

> *"exception handling is not considered as branches in the context of this counter definition"*

**A `try`/`catch` adds no branches.** A catch block contributes nothing to branch coverage,
which means a codebase whose error handling lives entirely in catch blocks can post an excellent
branch-coverage number with none of its error paths exercised. [Chunk 06b](06b-try-catch-is-invisible.md)
is entirely about the consequences.

Branch coverage is the most useful of the six for judging test thoroughness, and
[chunk 03b](03b-branch-coverage-is-the-useful-one.md) argues why.

### Cyclomatic complexity

JaCoCo computes `v(G) = B - D + 1` and reports **missed** and **covered** complexity: how many
independent paths through a method were exercised versus how many exist.

Because it is built on the same branch definition, it inherits the same hole:

> *"try/catch blocks will also not increase complexity"*

So a method whose only "complexity" is error handling reports complexity 1 — as simple as a
getter — no matter how many failure modes it handles.

Covered complexity is an underused number. Where branch coverage says "some arm of each decision
ran", complexity coverage approximates "how many distinct routes through this method were taken",
which is closer to the question you actually care about.

### Lines

> *"A source line is considered executed when at least one instruction that is assigned to this
> line has been executed."*

Two documented properties, and both bite:

- 🔴 **Lines require debug information in the class files.** Without `-g` (or with a build that
  strips it), there is no line report at all. [Chunk 03c](03c-line-coverage-needs-debug-info.md)
  covers this.
- 🔴 **Line counts are not additive**, because *"a single line of a source code may refer to
  multiple methods or multiple classes."* Summing per-class line totals to reconcile them against
  a package total will not work, and the discrepancy is not a bug.

And note the definition's weakness: **at least one instruction**. A line containing a compound
condition, a ternary, or a chained call is "covered" when any part of it ran. This is the
mechanism behind the 100%-covered-untested example in [chunk 01](01-what-coverage-measures.md).

### Methods

A method is executed when at least one of its instructions runs. The documented subtlety:

> **constructors and static initializers count as methods**

— including implicitly generated ones. So a class with no explicit constructor still has a method
in the denominator, and a class with a `static {}` block has another. This is a direct
consequence of measuring bytecode rather than source, and it is why method counts can exceed the
number of methods you wrote.

### Classes

> A class is executed when *"at least one of its methods has been executed"* — constructors and
> static initializers included.

This is the weakest counter and the one most likely to mislead. Because loading a class often
runs its static initialiser, and because constructing an object counts, **class coverage tends to
read very high**. A class at "100% class coverage" may have had exactly one constructor called.
Class coverage is a discovery aid — which classes did nothing at all touch — not a quality metric.

## Why the six disagree, with a worked example

```java
public String classify(int score, boolean vip) {
    if (score > 90 || vip) {
        return "gold";
    }
    if (score > 50) {
        return "silver";
    }
    return "bronze";
}
```

One test, `classify(95, false)`:

- The `score > 90` check runs and is true; `return "gold"` runs.
- The `vip` check is **never evaluated** — `||` short-circuits.
- The second `if` and both remaining returns never run.

Now read the counters:

| Counter | Roughly what it reports | Why |
|---|---|---|
| **Class** | 100% | A method ran. That is the entire test. |
| **Method** | 100% for `classify` | It was entered. |
| **Instruction** | High | The whole first branch, which is most of the instructions on the taken path. |
| **Line** | ~40% | Three of the five significant lines never ran. |
| **Branch** | Low | Four branch outcomes exist in that first `if` alone (`score > 90` true/false, `vip` true/false); one was taken. Plus both arms of the second `if`, neither taken. |
| **Complexity** | Low | Multiple independent paths exist; one was walked. |

The ordering — class ≥ method ≥ instruction ≥ line ≥ branch — is not guaranteed as a theorem, but
it is the overwhelmingly common shape on real code, and it is why the same codebase honestly
reports both "92% covered" and "61% covered" depending on who ran the report.

**Note the `||` in particular.** Both operands of a short-circuit operator are separate branches.
A compound condition is where line coverage and branch coverage diverge most sharply, and it is
where bugs live.

## Which to use for what

| Purpose | Counter | Why |
|---|---|---|
| A regression floor in CI | **BRANCH**, plus LINE | Hardest to inflate; closest to "did you test the decisions" |
| Finding untested code | **CLASS** or **METHOD** at 0 | Cheap scan for whole areas nothing touches |
| Judging a specific algorithm's tests | **COMPLEXITY** | Approximates paths walked vs paths available |
| Comparing across projects | none of them | Different exclusions and different code shapes make it meaningless |
| A default you did not choose | INSTRUCTION | Which is what you get if you do not name one |

The last row is the practical warning. In both Maven's `check` goal and Gradle's
`violationRules`, an unspecified counter is `INSTRUCTION` and an unspecified value is
`COVEREDRATIO`. [Chunk 04](04-thresholds.md) is about writing rules that say what you mean.

## Missed, covered, and the four value types

Every counter reports both a **missed** and a **covered** count, and a rule can be written
against either as a ratio or an absolute. The `check` goal's accepted `value` types are
`TOTALCOUNT`, `MISSEDCOUNT`, `COVEREDCOUNT`, `MISSEDRATIO` and `COVEREDRATIO`.

The absolute counts are more useful than they look. `MISSEDCOUNT` with a `maximum` expresses
"no more than N uncovered branches in this class", which does not move when the class grows —
unlike a ratio, which a large well-covered addition can lift while the untested part stays
untested. [Chunk 04](04-thresholds.md) builds on this.

## Where this connects

- **[03b · Branch coverage is the useful one](03b-branch-coverage-is-the-useful-one.md)** — the
  argument for it, with the compound-condition case worked through.
- **[03c · Line coverage needs debug info](03c-line-coverage-needs-debug-info.md)** — the `-g`
  dependency and the non-additivity, both documented.
- **[04 · Thresholds](04-thresholds.md)** — writing a rule that names its counter.
- **[06b · try/catch is invisible](06b-try-catch-is-invisible.md)** — the branch definition's
  exception-handling hole, taken seriously.
- **[01 · What coverage measures](01-what-coverage-measures.md)** — why even branch coverage
  cannot tell a real test from an empty one.

## Gotchas

**★ "We're at 80%" is not a statement until you name the counter.**
Instruction, line and branch coverage on the same code routinely differ by twenty points or more.
Two teams comparing numbers, or one team comparing this quarter's dashboard to last quarter's
gate, can be comparing entirely different measurements without either noticing.

**★ Both Maven and Gradle default an unspecified rule to the most generous counter.**
Element `BUNDLE`, counter `INSTRUCTION`, value `COVEREDRATIO`. A team that writes
`<minimum>0.80</minimum>` believing it configured line coverage has set a materially weaker gate,
and will only discover it by comparing two reports.

**★ `try`/`catch` adds no branches and no complexity — by definition, not by omission.**
JaCoCo's counter documentation says so explicitly for both. A service whose decisions are all
"did this call throw" reports as trivially simple and trivially well-covered. This is the single
strongest fact for arguing that a coverage number cannot stand alone.

**★ Line coverage is satisfied by one instruction on the line.**
A line with a ternary, a compound condition, or a chained call is green when any part of it
executed. This is why line coverage looks reassuring on exactly the dense expressions where bugs
hide, and why branch coverage is the more honest counter.

**★ Line totals are not additive, and trying to reconcile them wastes an afternoon.**
JaCoCo documents the reason: *"a single line of a source code may refer to multiple methods or
multiple classes."* Per-class line counts summed by hand will not equal the package total. The
report is not wrong.

**★ Class coverage reads high for trivial reasons and is not a quality signal.**
Loading a class can run its static initialiser; constructing one counts as executing a method.
A class can therefore be "covered" without any of its behaviour running. Use class coverage to
find the zeroes, never to claim a percentage.

**★ Method counts include constructors and static initialisers you did not write.**
Implicit default constructors and generated `<clinit>` methods are real bytecode and are counted.
A data-heavy module's method denominator is larger than its source suggests, which is one reason
numbers move after a refactor that added no methods.

**★ Short-circuit operators split one source condition into several branches.**
`if (a || b)` is two decisions, so four branch outcomes, on one line. Teams tuning a branch
threshold are often surprised by how many branches a "simple" condition contributes, and this is
usually where the missing coverage is.

**★ Covered complexity is the most useful counter almost nobody looks at.**
Branch coverage says each decision had some arm taken; complexity coverage approximates how many
distinct routes through the method were walked. For a genuinely branchy algorithm the second is
much closer to the question you care about, and it is available in every report already.

**★ Comparing coverage numbers between projects is meaningless and is done constantly.**
Different exclusions, different code shapes, different counters, different merge policies. A
service that is 60% branch-covered with no exclusions may be far better tested than one at 90%
instruction coverage with generated code excluded.

## Interview questions

**★ Name JaCoCo's counters and say which you'd gate on.**
Instruction, branch, line, complexity, method and class. I would gate on **branch**, optionally
with line as a secondary: branch is the hardest to inflate, because covering it requires
exercising both outcomes of each decision rather than merely entering the method. Instruction is
the default in both Maven and Gradle and is the most generous, so a rule that does not name its
counter is weaker than the person who wrote it believes.

**★ What's the difference between line coverage and branch coverage, and why does it matter?**
A line is covered when at least one instruction assigned to it has executed; a branch is covered
when a specific outcome of a decision has been taken. So a line holding `if (a || b)` is fully
line-covered by a single test that makes `a` true — while three of the four branch outcomes were
never exercised, and `b` was never even evaluated because `||` short-circuits. Branch coverage is
the counter that notices.

**★ Why doesn't a `try`/`catch` improve your branch coverage when you test the failure path?**
Because JaCoCo's branch counter explicitly excludes exception handling — its documentation says
exception handling *"is not considered as branches in the context of this counter definition"*,
and correspondingly that try/catch does not increase complexity either. Testing the catch block
does raise instruction and line coverage for the lines inside it, but it adds no branch outcomes,
so a codebase whose decisions are mostly error handling reports as far simpler and far better
covered than it is.

**★ Why do JaCoCo's per-class line counts not add up to the package total?**
Because line coverage is not additive across classes. JaCoCo documents the reason: a single
source line may refer to multiple methods or multiple classes — an anonymous class or lambda
declared inline, for instance, puts code from two classes on one line. The line is counted once
in the aggregate but appears in more than one class's report.

**★ Your dashboard says 91% and your build gate is set to 85%, yet the gate just failed. Explain.**
Almost certainly two different counters. The dashboard is likely showing instruction or line
coverage while the gate is on branch coverage — or the reverse, with the gate on a bundle
default of instruction coverage while the dashboard shows something else. Second possibility: the
two numbers cover different class sets, because the report applies exclusions that the check goal
does not, or the dashboard reads a merged unit-plus-integration exec file while the gate reads
only the unit one.

**★ When would you use `MISSEDCOUNT` instead of `COVEREDRATIO`?**
When you want a limit that does not move as the class grows. A ratio can be lifted by adding
well-covered code while the untested part stays exactly as untested, so a class can drift toward
its threshold without anyone testing the thing that was missing. `MISSEDCOUNT` with a `maximum`
says "no more than N uncovered branches here", which is a claim about the actual gap rather than
about its proportion, and it is a better fit for ratcheting a legacy class down over time.

{/* FOOTER */}
