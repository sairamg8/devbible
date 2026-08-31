---
title: "Reading a coverage report usefully: the order to look at things in, the five questions to ask before believing any number, and the setup this topic recommends — stated as a checklist you can apply to a project you have just been handed"
sidebar_label: "08 · The checklist"
sidebar_position: 22
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 — this chunk restates conclusions established and sourced in the chunks it
> links to; every documented claim it repeats is cited there against **JaCoCo 0.8.15**'s
> `doc/counters.html`, `doc/classids.html`, `doc/faq.html`, `doc/changes.html` and the Maven mojo
> pages, and against the **Gradle user manual**. Version spine from
> `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.
> ⚠️ **No build and no test runs on this machine.**

**You have been handed a project with a coverage report and a number. This chunk is what to do
with it, in order — first the four questions that decide whether the number means anything at all,
then how to read the report itself, then the configuration this topic recommends. It is a
summary, and every item links to where the argument was made.**

## Part 1 · Before believing any number

Four questions, in this order. If any of the first three has a bad answer, the number is not yet
evidence of anything.

**1 · Was coverage actually measured?**
Does `target/jacoco.exec` (or the Gradle equivalent) exist, with real size, from *this* run? An
absent or stale file means the number is about a different build.
→ [02b](02b-the-argline-trap.md), [07b](07b-coverage-in-ci.md)

**2 · Is anything at 0% that obviously ran?**
If the whole report is zeroes, the pipeline is broken, not the tests. If a coherent subsystem is
at 0%, suspect a different JVM or an agent-level exclusion before suspecting the team.
→ [06c](06c-the-zero-percent-class.md)

**3 · Which counter is this number?**
Instruction, line and branch coverage on the same code differ by twenty points or more.
Unspecified rules default to `INSTRUCTION`, the most generous.
→ [03](03-the-six-counters.md), [04](04-thresholds.md)

**4 · What is excluded?**
Read the exclusion list before the percentage. A number over a codebase with a large exclusion
list is a number about a different codebase.
→ [05](05-exclusions.md)

## Part 2 · Reading the report

Once the number is trustworthy, the report is read from the bottom of the scale upward — because
that is the end that carries information ([chunk 01](01-what-coverage-measures.md)).

1. **Sort by classes at 0%.** This is the real product of the whole exercise. Each one is either a
   test worth writing, dead code worth deleting, or one of the four false zeroes.
2. **Compare line coverage to branch coverage per class.** The normal pattern is line above
   branch. Where the gap is *large*, there is dense conditional logic tested shallowly. Where it
   **inverts** — line below branch — there are usually unexecuted catch bodies, since catch blocks
   have lines but no branches. → [06b](06b-try-catch-is-invisible.md)
3. **Look at covered complexity on the branchy classes.** It approximates paths walked against
   paths available, and it is the most useful counter almost nobody opens.
   → [03](03-the-six-counters.md)
4. **Open the source view on one important class and actually read the red.** The highlighted
   source is the useful part of the HTML report; the header percentage is a by-product.
5. **Then ask what the covered lines assert.** The report cannot tell you, and this is the point
   at which you stop using the report and start reading tests.
   → [06](06-what-the-number-cannot-say.md)

## Part 3 · The setup this topic recommends

For a project starting from nothing:

**Wiring**
- Pin the JaCoCo version explicitly — the filter set changes between releases and moves your
  denominator. → [05c](05c-what-jacoco-filters-for-free.md)
- Maven: `prepare-agent` + `report`. Use `@{argLine}` in any Surefire `<argLine>`, and the same
  for Failsafe. → [02](02-wiring-it-up-maven.md), [02b](02b-the-argline-trap.md)
- Gradle: `test { finalizedBy(jacocoTestReport) }` and
  `check { dependsOn(jacocoTestCoverageVerification) }` — neither is wired by default.
  Enable `xml.required`. → [02c](02c-wiring-it-up-gradle.md)
- Integration tests: separate exec files, and decide deliberately whether to merge.
  → [02d](02d-integration-tests-and-failsafe.md)

**Denominator hygiene, before any threshold**
- Turn on `lombok.addLombokGeneratedAnnotation = true` if you use Lombok — it is off by default
  and generated `equals` is branch-heavy. → [05b](05b-the-generated-annotation-rule.md)
- Check the built-in filter list before writing any exclusion; several common ones are dead
  configuration. Do not exclude records. → [05c](05c-what-jacoco-filters-for-free.md)
- Exclude at the **report**, never at the agent. → [05](05-exclusions.md)

**Gating**
- A **floor**, not a target, set at the codebase's actual current number.
  → [04a](04a-floor-or-target.md)
- Name `<counter>` and `<value>` in every limit. Prefer `BRANCH`.
  → [03b](03b-branch-coverage-is-the-useful-one.md), [04](04-thresholds.md)
- Prefer per-class `MISSEDCOUNT` budgets over a bundle ratio. → [04](04-thresholds.md)
- Do not automate a ratchet. → [04c](04c-the-ratchet.md)
- Assert the measurement happened, as a check separate from the threshold.
  → [07b](07b-coverage-in-ci.md)

**Reporting**
- Per-change coverage on the pull request is the deployment that matters.
  → [07b](07b-coverage-in-ci.md)
- Publish the count of classes at 0% alongside any percentage.
- Multi-module: aggregate before judging low-level modules. → [07](07-multi-module.md)

## Part 4 · The one-paragraph version

Coverage tells you what did not run. That is a real finding and it is the only one the tool
delivers reliably, so build everything around it: find the zeroes, watch the diff, hold a floor.
Gate on branches because they are the hardest to fake, knowing that error handling is invisible to
them by definition. Keep the denominator honest by filtering generated code rather than excluding
types. And when what you actually want to know is whether a bug would be caught, stop asking the
coverage report — it has no way to answer, and **topic 11 · Mutation testing** *(not written yet)*
does.

## Where this connects

- **[01 · What coverage measures](01-what-coverage-measures.md)** — where the argument starts.
- **[06 · What the number cannot say](06-what-the-number-cannot-say.md)** — where it ends.
- **10 · Property-based testing** *(not written yet)* — the other answer to "the cases you did not
  think of", where coverage's blindness to combinations is attacked from the input side.
- **11 · Mutation testing** *(not written yet)* — the honest answer to what this number cannot say.

## Gotchas

**★ The first question is "was it measured", not "is it high enough".**
Every threshold conversation that begins at the number skips the check that would have shown the
number is meaningless. A missing or stale exec file, or a report of zeroes, invalidates everything
downstream, and both are one `ls` away.

**★ Reading a coverage report top-down, by percentage, extracts the least information available.**
The header number is the least informative thing on the page. The class list sorted by 0% is the
most. Most people never scroll past the header.

**★ The line-below-branch inversion is a specific, useful signal and it is invisible unless you look for it.**
Line coverage normally exceeds branch coverage. When a class inverts, it usually means catch bodies
went unexecuted — they contribute lines but no branches. It is the cheapest available way to find
untested error handling given that the branch counter cannot see it.

**★ Fixing the Lombok flag before setting a threshold, rather than after, saves a false argument.**
Turning it on moves the number without anyone writing a test, which looks exactly like gaming if it
happens after a gate exists. Do the denominator hygiene first, then calibrate.

**★ A checklist applied once is configuration; applied quarterly it is a control.**
The threshold and the exclusion list drift in opposite directions, and each is reviewed by
different people at different times. Looking at them together, on a schedule, is the entire audit
and it takes minutes.

**★ Every recommendation here assumes the number is being used as a floor.**
Under a target, several of them invert: exclusions become attractive, `MISSEDCOUNT` becomes an
obstacle to route around, and denominator hygiene becomes a way to move the number. The setup is
not neutral with respect to the policy. → [04a](04a-floor-or-target.md)

**★ "We follow the checklist" is not the same as anyone reading a report.**
All of Part 3 can be true while nobody has ever looked at which classes are at 0%. The
configuration is the cheap half; Part 2 is where the value is, and it requires a person.

## Interview questions

**★ You join a team and are shown a coverage report. What do you look at first?**
Not the percentage. First, whether coverage was actually measured — is there a recent, non-trivial
execution data file, and is anything at 0% that obviously ran. Then which counter the number is,
since instruction, line and branch coverage differ substantially and unspecified rules default to
instruction. Then the exclusion list, because a number over a heavily-excluded codebase is a number
about a different codebase. Only then does the figure mean anything, and even then what I would
read is the list of classes at 0%.

**★ Describe the JaCoCo setup you'd put on a new Spring Boot service.**
Pinned plugin version; `prepare-agent` and `report` in Maven with `@{argLine}` in any Surefire
configuration; separate execution data for integration tests with a deliberate decision about
merging. Before any gate, denominator hygiene: `lombok.addLombokGeneratedAnnotation = true`, and
exclusions at the report rather than the agent, checked against the built-in filter list first.
Then a floor — not a target — at the current number, with `BRANCH` and `COVEREDRATIO` named
explicitly, ideally per-class `MISSEDCOUNT` budgets. Plus a CI check asserting that coverage was
measured, and per-change coverage on pull requests.

**★ What single number would you report to leadership, and why?**
The count of classes at 0% coverage, alongside per-change coverage on pull requests. The zero count
means exactly what it appears to mean, cannot be moved by assertion-free tests, and improves only
when someone tests or deletes something. A percentage requires its counter, exclusion list, JaCoCo
version and merge policy to interpret, and none of that context survives the journey into a slide.

**★ How do you find untested error handling?**
Not with branch coverage, which by JaCoCo's own definition does not count exception handling as
branching. Three ways instead: look for classes where line coverage is *below* branch coverage,
which is unusual and usually means unexecuted catch bodies; make "which failure modes does this
handle and is each tested" a review question, since the tool cannot supply the pressure; and run
mutation testing on the error-handling code, which is indifferent to whether the construct is a
branch.

**★ Summarise the case for and against coverage in a sentence each.**
For: it reliably identifies code that no test reached, which is a real and actionable finding, and
on a pull request it answers "did any of this run" in a way nobody can argue with. Against: its high
end is uninformative, because assertions are invisible to it and error handling is not even counted
as branching — so a high percentage is not evidence of a good suite, and treating it as a target
reliably produces worse tests.

{/* FOOTER */}
