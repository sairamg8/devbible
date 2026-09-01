---
title: "Mutation testing is the only tool in this phase that answers the question everyone thinks coverage answers — not 'did this line run' but 'would anything have noticed if it were wrong' — and it answers it by breaking your code on purpose and seeing whether a test fails"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 to 2026-09-01 against **pitest's own documentation** —
> [Mutation operators](https://pitest.org/quickstart/mutators/), the
> [FAQ](https://pitest.org/faq/), the [Maven](https://pitest.org/quickstart/maven/) and
> [Gradle](https://pitest.org/quickstart/gradle/) quick starts — and against **pitest source read
> at a version tag** for group membership and operator resolution. Version and JDK-support facts
> come from Maven Central and pitest's release notes.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, **JUnit Jupiter 6.0.3**, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no build on this machine.** Every page carries Java source, POM and Gradle
> configuration, and behaviour quoted from documentation — **never a mutation score, a run
> duration or a report produced by a run here.**

**[09 · Coverage with JaCoCo](../09-jacoco/README.md) ends on an admission: a coverage probe
records that an instruction executed, and executing a line is not the same as checking its
result. A test with no assertions at all drives coverage to 100%. This topic is the honest answer
to that. Mutation testing changes your compiled code — flips a conditional, replaces a return
value, removes a call — and re-runs the tests that cover the changed line. If they still pass,
nothing in your suite was checking that behaviour. The mutant *survived*, and a surviving mutant
is a specific, falsifiable claim about one line, which is a far better artefact than a
percentage.**

**38 chunks, ~10,083 lines, 437 gotchas and interview questions.**

## Three things that shape the whole topic

1. 🔴 **Most of PIT's operators are switched off, and the group machinery does not behave the way
   the docs imply.** The group literally named `DEFAULTS` is not what you get when you configure
   nothing, `OLD_DEFAULTS` is documented but not registered, and there is an undocumented
   minus-prefix syntax that is almost always the right way to change an operator set. Chunks `03`
   through `03d3b` are that inventory, read from published source rather than paraphrased.
2. 🔴 **The score is not a stable number.** Timeout detection compares execution times, and
   pitest states those *"can be affected by external factors"* — so the same mutant can time out
   on one run and be killed on another. That single fact decides how you may and may not gate a
   build on it.
3. 🔴 **The cost is inherent, not an implementation flaw.** Killing a mutant means running its
   covering tests, so the bill is mutants × covering-test runtime. Pitest's own advice is to
   *"limit analysis to the code that you are changing"* — which is the difference between a tool
   that fits in a review and one a team bans.

## The chunks

### Why, and how it works

| # | Chunk | What it argues |
|---|---|---|
| 01 | [Testing the tests](01-testing-the-tests.md) | Coverage says the line ran; this asks whether anything would notice it change |
| 01b | [The tool and its versions](01b-the-tool-and-its-versions.md) | pitest, its JUnit 5 plugin, and JDK support |
| 02 | [How it works](02-how-it-works.md) | Mutate the bytecode, re-run the covering tests, see what survives |
| 02b | [What it cannot mutate](02b-what-it-cannot-mutate.md) | The blind spots, starting with static initialisers |
| 02b2 | [Logging and `avoidCallsTo`](02b2-logging-and-avoidcallsto.md) | Why log calls are excluded by default |
| 02b3 | [The filter inventory](02b3-the-filter-inventory.md) | Everything filtered before you see a report |
| 02c | [Timeouts and determinism](02c-timeouts-and-determinism.md) | 🔴 Why the same run can give two answers |

### The operators

| # | Chunk | What it argues |
|---|---|---|
| 03 | [Mutators](03-mutators.md) | The default set, and what a survivor means for each |
| 03b | [Arithmetic mutators](03b-arithmetic-mutators.md) | The operators that change a calculation |
| 03b2 | [`VOID_METHOD_CALLS`](03b2-void-method-calls.md) | Removing a call nobody asserted on |
| 03c | [The returns mutators](03c-the-returns-mutators.md) | The replacement group that finds the most |
| 03c2 | [Reading a returns survivor](03c2-reading-a-returns-survivor.md) | What to actually do about one |
| 03d | [Optional mutators](03d-optional-mutators.md) | 🔴 `DEFAULTS` is not the default; the minus-prefix syntax |
| 03d2 | [Optional operators](03d2-the-optional-operator-inventory.md) | The inventory, read from source |
| 03d2b | [Reading the pair](03d2b-reading-a-remove-conditionals-pair.md) | `REMOVE_CONDITIONALS` in practice |
| 03d2c | [Inline constants](03d2c-inline-constants.md) | The noisiest operator, and when it earns it |
| 03d2d | [Remove increments](03d2d-remove-increments.md) | A small operator with a sharp use |
| 03d2e | [Neutralising calls](03d2e-the-call-neutralising-operators.md) | Removing behaviour rather than changing it |
| 03d2f | [Adopting one](03d2f-adopting-an-optional-operator.md) | How to turn an operator on without drowning |
| 03d3 | [Research operators](03d3-the-research-operators.md) | What they are for, and why not in CI |
| 03d3b | [Experimental operators](03d3b-the-experimental-operators.md) | The rest of the catalogue |

### Reading the output

| # | Chunk | What it argues |
|---|---|---|
| 04 | [Reading a report](04-reading-a-report.md) | Killed, survived, timed out, no coverage — and which to act on |
| 04a | [The HTML report](04a-the-html-report.md) | Navigating it without drowning |
| 04a2 | [XML, CSV and the gaps](04a2-the-other-output-formats.md) | What the machine-readable formats do and do not carry |
| 04b | [Equivalent mutants](04b-equivalent-mutants.md) | The mutant that cannot be killed |
| 04b2 | [The ceiling](04b2-the-ceiling-on-the-score.md) | 🔴 Why the score is never 100 |
| 04c | [The score arithmetic](04c-the-score-arithmetic.md) | What the denominator actually contains |
| 04c2 | [Thresholds and gates](04c2-thresholds-and-gates.md) | Gating on a number that moves |
| 04d | [Not findings](04d-the-statuses-that-are-not-findings.md) | The statuses that are noise, and why |

### Wiring and the verdict

| # | Chunk | What it argues |
|---|---|---|
| 05 | [Wiring it up](05-wiring-it-up.md) | Maven, and the first run |
| 05a | [Before the first run](05a-before-the-first-run.md) | What to configure so the first run finishes |
| 05a2 | [Surefire and JaCoCo](05a2-surefire-and-jacoco.md) | The interactions that bite |
| 05b | [Gradle](05b-gradle.md) | The Gradle plugin |
| 05b2 | [Gradle isolation](05b2-gradle-isolation-and-gaps.md) | Where the Gradle story is thinner |
| 05c | [Scoping and history](05c-scoping-and-incremental.md) | 🔴 The lever that makes it usable |
| 05c2 | [Incremental analysis](05c2-incremental-analysis.md) | Making it viable in CI |
| 06 | [The cost](06-the-cost.md) | The honest verdict on when to use it |
| 07 | [What this phase taught](07-what-this-phase-taught.md) | 🔴 The closing argument for **all twelve topics** |

## The four things this topic is really about

1. **A surviving mutant is a question, not a defect.** "Nothing noticed when I changed this line —
   do we care?" Sometimes the honest answer is no, and that is a legitimate outcome.
2. 🔴 **The score is a diagnostic, not a target.** It has a ceiling below 100 because of
   equivalent mutants, it is not fully deterministic, and gating a build on an exact figure
   teaches a team to re-run red builds.
3. **Scope decides whether the tool survives contact with your project.** Whole codebase on every
   push is the version that gets banned; the diff in a pull request is the version that works.
4. **It is the only mechanical check on whether your assertions assert anything** — which is why
   it is the last topic in the phase, and why `07` is the phase's closing argument rather than
   this topic's.

## Where it sits in the phase

- **[09 · Coverage with JaCoCo](../09-jacoco/README.md)** measures execution. This measures
  whether execution was *checked*. It is the direct answer to 09's admission.
- **[10 · Property-based testing](../10-property-based/README.md)** attacks the same blindness
  from the input side — generated inputs instead of mutated code. It is also the topic whose own
  failure mode, a property that restates the implementation, this tool is the only reliable way
  to detect.
- **[12 · Real-world testing scenarios](../12-real-world-scenarios/README.md)** is where the
  assertions this topic judges actually get written.

{/* FOOTER */}
