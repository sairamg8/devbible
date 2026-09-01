---
title: "PIT reports one of seven outcomes per mutant and only two of them are findings — but five of the seven are classified as detected, so three statuses that mean 'something went wrong' and one that means 'this can never be killed' all land in the numerator of your mutation score, and the two that are actually actionable mean completely different things"
sidebar_label: "04 · Reading a report"
sidebar_position: 22
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest's
> [Basic concepts](https://pitest.org/quickstart/basic_concepts/) page — the *Running the tests*
> section listing the seven outcomes and their descriptions, quoted verbatim — the
> [FAQ](https://pitest.org/faq/) entries *"My code has really poor test coverage, will mutation testing
> take forever?"* and *"I'm seeing a lot of timeouts, what's going on?"*, and pitest 1.30.0 source read
> at the `1.30.0` tag: `org.pitest.mutationtest.DetectionStatus` (every constructor argument and
> javadoc), `MutationStatusMap`, `build/MutationTestUnit` and
> `pitest-html-report/.../ConfidenceMap.java`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3, Testcontainers 2.0.5.
> ⚠️ **No sandbox and no build on this machine.** Status semantics are quoted from pitest's
> documentation and read from its published source. **No mutation score, console transcript, status
> count or timing on this page came from a run.**

**A mutation report is a list of mutants, each carrying one status, and everything useful about the
report follows from knowing what the seven statuses mean and — separately — which of them pitest counts
as *detected*. Those are not the same question, and the gap between them is where mutation scores go
wrong. Two statuses are findings you act on, and they call for opposite actions. Three mean the run
itself misbehaved and should be close to zero. One is classified as detected while its own javadoc says
it cannot be. This chunk is the vocabulary; [04c](04c-the-score-arithmetic.md) is what the numbers
built out of it actually compute.**

## The seven outcomes

From pitest's *Basic concepts* page:

> *"For each mutation PIT will report one of the following outcomes: Killed; Survived; No coverage;
> Non viable; Timed Out; Memory error; Run error"*

with the definitions, verbatim:

> *"Killed means a test caught the mutation successfully."*

> *"Survived means the mutation was not detected by the covering test."*

> *"No coverage is the same as Survived except there were no tests that exercised the line of code where
> the mutation was created."*

> *"A mutation may time out if it causes an infinite loop, such as removing the increment from a counter
> in a for loop."*

> *"A non viable mutation is one that could not be loaded by the JVM as the bytecode was in some way
> invalid. PIT tries to minimise the number of non-viable mutations that it creates."*

> *"A memory error might occur as a result of a mutation that increases the amount of memory used by the
> system, or may be the result of the additional memory overhead required to repeatedly run your tests
> in the presence of mutations. If you see a large number of memory errors consider configuring more
> heap and permgen space for the tests."*

> *"A run error means something went wrong when trying to test the mutation. Certain types of non viable
> mutation can currently result in an run error. If you see a large number of run errors this is
> probably be an indication that something went wrong."*

and the sentence that sets the expectation for three of them:

> *"Under normal circumstances you should see no non viable mutations or run errors."*

## 🔴 Which of them count as detected

This is not in the documentation. It is one boolean per enum constant in
`org.pitest.mutationtest.DetectionStatus`, and it decides your mutation score:

```java
KILLED(true),
SURVIVED(false),
TIMED_OUT(true),
NON_VIABLE(true),
MEMORY_ERROR(true),
NOT_STARTED(false),
STARTED(false),
RUN_ERROR(true),
NO_COVERAGE(false),
EQUIVALENT(true);
```

| Status | Detected | Has coverage | Meaning |
|---|---|---|---|
| `KILLED` | ✅ | yes | A test failed with the mutant present |
| `SURVIVED` | ❌ | yes | Every covering test passed |
| `NO_COVERAGE` | ❌ | **no** | No test executes the mutated line |
| `TIMED_OUT` | ✅ | yes | Ran longer than the timeout formula allows |
| `MEMORY_ERROR` | ✅ | yes | The minion ran out of memory |
| `RUN_ERROR` | ✅ | yes | Something went wrong |
| `NON_VIABLE` | ✅ | yes | The JVM would not load the mutated class |
| `EQUIVALENT` | ✅ | yes | Cannot be killed, by definition |
| `NOT_STARTED` | ❌ | yes | Internal — not yet assessed |
| `STARTED` | ❌ | yes | Internal — in progress |

So **five** statuses feed the numerator, and only one of them is "a test caught it". The enum's own
`isDetected` javadoc is unusually candid about this:

> *"Returns true if this status indicates that the mutation was distinguished from the un-mutated code
> by the test suite, ignores the slight ambiguity of some of the statuses."*

"Slight ambiguity" is carrying `RUN_ERROR` and `MEMORY_ERROR`, both of which mean the run went wrong.

## The two findings, and why they need opposite responses

**`SURVIVED` is the finding this whole topic exists for.** Every covering test ran to completion and
none of them failed. That is a precise sentence about your assertions: *this behaviour can change and
the build stays green.* Which operator produced it names the missing assertion —
[03](03-mutators.md) onward is the catalogue.

**`NO_COVERAGE` is a different problem with a different fix.** No test touches the line at all, so the
mutant was never run against anything. The FAQ is explicit that this costs almost nothing:

> *"Due to the way PIT picks which tests to run, there is little or no execution time cost for mutations
> on lines that have no test coverage."*

Two consequences worth separating. First, a `NO_COVERAGE` mutant is not evidence about the strength of
your assertions — it is evidence about your coverage, which you already had from JaCoCo
([09 · What coverage measures](../09-jacoco/01-what-coverage-measures.md)). Second, and the reason the
distinction matters practically: the fix for a survivor is a *better* assertion in a test that already
exists; the fix for a no-coverage mutant is a *test that does not exist yet*. Those are different
amounts of work, and a report read as a flat list of "things that were not killed" hides the difference.

**Read the two as separate counts, never as one.** A class with 40 survivors and 0 no-coverage mutants
is well exercised and weakly asserted. A class with 0 survivors and 40 no-coverage mutants is not tested
at all and has a mutation score that looks the same as the first one's in some presentations —
[04c](04c-the-score-arithmetic.md) is exactly about which figure separates them.

The remaining four statuses that carry `detected = true` — `TIMED_OUT`, `NON_VIABLE`, `MEMORY_ERROR`
and `RUN_ERROR` — together with the never-assigned `EQUIVALENT`, are the ones that make a bad run look
like a good one. They are [04d](04d-the-statuses-that-are-not-findings.md).

## Where this connects

- **[04a · The HTML report](04a-the-html-report.md)** — where each of these statuses actually appears,
  and the colour that hides three of them behind one word.
- **[04b · Equivalent mutants](04b-equivalent-mutants.md)** — the survivor that cannot be killed, and
  why the score's ceiling is not 100.
- **[04c · The score arithmetic](04c-the-score-arithmetic.md)** — mutation coverage, test strength, the
  integer percentage cap, and the four gates a build can fail on.
- **[02c · Timeouts and determinism](02c-timeouts-and-determinism.md)** — why `TIMED_OUT` is the least
  reliable status and lands in the numerator anyway.
- **[03 · Mutators](03-mutators.md)** — which operator produced a survivor is what turns it from a chore
  into a specific missing assertion.
- **[09 · What coverage measures](../09-jacoco/01-what-coverage-measures.md)** — the metric
  `NO_COVERAGE` duplicates, and the reason it is a different finding from a survivor.
- **[06 · The cost](06-the-cost.md)** — survivors are the expensive status, which is why a report full
  of them is also a slow run.

## Gotchas

**★ Five of the ten statuses count as detected, and only one of them means a test caught anything.**
`KILLED`, `TIMED_OUT`, `NON_VIABLE`, `MEMORY_ERROR`, `RUN_ERROR` and `EQUIVALENT` all carry
`detected = true`. So a run with a hundred run errors reports a *better* mutation score than the same run
with those hundred mutants working correctly. The enum's own javadoc concedes it *"ignores the slight
ambiguity of some of the statuses"*.

**★ `SURVIVED` and `NO_COVERAGE` are not the same finding and need different work.**
A survivor means the tests execute the line and do not constrain it — fix the assertion. A no-coverage
mutant means no test reaches the line at all — write a test. Presenting them as one number, or fixing
them in one pass, wastes the distinction that makes a mutation report more useful than a coverage report.

**★ `NO_COVERAGE` costs almost nothing to produce, so a huge count is cheap and meaningless.**
The FAQ says there is *"little or no execution time cost for mutations on lines that have no test
coverage"*. A poorly covered project therefore gets a fast pitest run and a terrible score, and the score
is telling you what JaCoCo already told you. The information mutation testing adds lives entirely in the
covered mutants.

back from a minion. Treat a report showing `EQUIVALENT` entries as evidence that a plugin is installed,
and check what it is before trusting the number.

**★ The status you see is per mutant, and one source line can carry many mutants with different statuses.**
A line with a comparison and a return produces mutants from several operators; a `finally` block produces
duplicated mutants across exit paths ([02b](02b-what-it-cannot-mutate.md)); a method with three returns
produces three separate returns mutants. "Line 47 is red" is not a status — read the mutant list for the
line, not the line's colour.

**★ Two internal statuses exist and should never appear in a report.**
`NOT_STARTED` and `STARTED` are documented in the enum as *"For internal use only"*, both with
`detected = false`. `MutationTestUnit` initialises every mutant to `NOT_STARTED` before dispatching it.
If either appears in output you are looking at a run that did not finish.

**★ A mutant that was filtered has no status at all, which is a fourth thing on top of the ten.**
Every filter in [02b3](02b3-the-filter-inventory.md) removes candidates *before* they are dispatched, so
a logging line, a `record` accessor or a loop-counter increment simply produces no entry — not
`SURVIVED`, not "filtered", nothing. The absence is invisible in the report and shows up only as a
mutant count lower than the source would lead you to expect. Any reasoning of the form "there is no
finding here, so this is fine" has to account for it.

**★ `SURVIVED` is the most expensive status to produce, so a report full of findings is also a slow run.**
Pitest stops at the first failing test, so a kill costs one test on average and a survivor costs *all* of
its covering tests, run to completion ([02](02-how-it-works.md)). The first pitest run on a weakly
asserted codebase is therefore the slowest one it will ever have, and it gets faster as you fix things —
which is the opposite of most people's expectation and worth saying before anyone times it
([06 · The cost](06-the-cost.md)).

**★ `NO_COVERAGE` on a line you know is covered usually means the covering test was excluded from the run.**
`excludedTestClasses`, `excludedGroups`, or a surefire `<excludes>` block that pitest copied
([05 · Wiring it up](05-wiring-it-up.md)) all remove tests from pitest's view without removing them from
your build. The mutant is then genuinely uncovered *as far as pitest is concerned*, and the report is
correct about a run that is not the run you thought you configured.

**★ A status can be carried forward from a previous run rather than measured in this one.**
With incremental analysis enabled, pitest reuses statuses from the history file when it believes nothing
relevant changed ([05c](05c-scoping-and-incremental.md)). The report does not distinguish a status that
was measured today from one that was inferred, so "this mutant is killed" may be a statement about last
week. That is the trade incremental analysis makes, and it is fine as long as nobody reads the report as
a fresh measurement.

## Interview questions

**★ What are PIT's possible outcomes for a mutant, and which of them are findings?**
Pitest documents seven: killed, survived, no coverage, non viable, timed out, memory error and run
error — plus `EQUIVALENT` and two internal states in the enum. Exactly two are findings. `SURVIVED`
means every covering test ran and none failed, which is a statement about the strength of your
assertions and is the reason to run the tool. `NO_COVERAGE` means nothing executes the line, which is a
statement about coverage that JaCoCo already made and calls for a different fix — writing a test rather
than strengthening one. The other statuses are either "the run misbehaved" — non viable, memory error,
run error, which pitest says you should see essentially none of — or the ambiguous `TIMED_OUT`.

**★ Which statuses count towards the mutation score, and why is that a problem?**
Five: killed, timed out, non viable, memory error and run error, plus `EQUIVALENT` if anything sets it.
Only the first means a test caught anything. The problem is that the four others all correspond to
*something going wrong*, and the worse the run goes, the better the score looks. A build agent under load
manufactures timeouts; a broken `jvmArgs` setting manufactures run errors; an under-provisioned minion
manufactures memory errors. Each of those raises the numerator. It is the single strongest argument for
reading a mutation report as per-status counts rather than as one percentage, and for treating a
suspiciously good score as a reason to look at the breakdown.

**★ Your report shows 200 survivors and 1,800 no-coverage mutants. Where do you start?**
Not with the mutation score, which is uninterpretable in that shape. The 1,800 are telling you the code
is largely untested, which is a coverage finding and cost almost nothing to produce — the FAQ notes
uncovered lines carry *"little or no execution time cost"*. The 200 survivors are the only mutation-
testing information in the report: those lines are executed by tests that do not constrain them. I would
narrow `targetClasses` to the package that actually matters, re-run, and work the survivors there — and
I would treat the no-coverage number as an input to a conversation about test coverage, not about
assertion strength.

**★ Why does PIT report `NO_COVERAGE` separately instead of calling it a survivor?**
Because it is a different fact requiring different work, even though pitest's own documentation defines
it as *"the same as Survived except there were no tests that exercised the line"*. A survivor is a line
your tests execute and do not constrain — the fix is a stronger assertion in a test that already exists,
and it is the only kind of finding mutation testing produces that no other tool can. A no-coverage mutant
is a line no test reaches, which JaCoCo already told you, and the fix is a test that does not exist yet.
The separation also matters for the arithmetic: `NO_COVERAGE` carries `detected = false` *and*
`hasCoverage() == false`, which is what lets pitest compute a second figure — test strength — that
excludes uncovered mutants entirely.

**★ A method you know is tested shows no mutants at all in the report. What are the possibilities?**
Four, and none of them is "the code is perfect". A filter removed the candidates before dispatch —
logging calls exempt the whole line, `record` and Lombok-generated code is filtered, loop-counter
increments are filtered. The compiler removed what you wanted mutated — a folded `static final`
constant, or string concatenation, which becomes `StringBuilder` calls that no default operator touches.
The operators do not model that construct — nothing in the tool mutates a `String` literal, a regex or
SQL. Or pitest never saw the class, because `targetClasses` or `excludedClasses` excluded it, or the
class has no line-number debug information. The mutant count per class, sanity-checked against what the
class does, is the only way to notice any of these, because a mutant that was never generated appears
under no status.

**★ Does a killed mutant tell you which test killed it?**
One test, yes — the report records a killing test per mutant, and the HTML page shows it. That is the
*first* test that failed, not the set of tests that would have, because pitest stops as soon as one
fails; the ordering is fastest-first with `FooTest`-named classes weighted up, so the killing test is
partly an artefact of timing. Getting the full set requires `fullMutationMatrix`, which pitest documents
as *"a partially supported feature added due to demand from the research community"* whose enabling
means *"other pitest features are not guaranteed to work correctly"* — and which removes the early exit,
so every covering test runs against every mutant. It is an investigation tool, not a setting.

{/* FOOTER */}
