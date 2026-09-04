---
title: "Coverage with JaCoCo: the report answers exactly one question — did this instruction execute — and every question anyone actually wants answered is a different one, so the whole skill is knowing which direction the number can be read in"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s own documentation
> ([jacoco.org/jacoco/trunk/doc](https://www.jacoco.org/jacoco/trunk/doc/)) — `counters.html`
> (the six counter definitions, quoted), `classids.html` (CRC64 class ids and the Sessions-page
> diagnosis), `faq.html` (what agent exclusions do to a report), `changes.html` (the filter list
> and the version each filter arrived in), and the Maven mojo pages `prepare-agent-mojo.html`,
> `prepare-agent-integration-mojo.html`, `report-mojo.html`, `report-aggregate-mojo.html` and
> `check-mojo.html`. Plus the **Gradle user manual**'s JaCoCo plugin page, the **Jakarta
> Annotations 3.0** javadoc for `jakarta.annotation.Generated`, and **Project Lombok**'s
> configuration documentation for `lombok.addLombokGeneratedAnnotation`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7,
> Testcontainers 2.0.5.
> ⚠️ **0.8.15 (2026/06/04) is the current release** — version strings like
> `0.8.16.202608270545` on jacoco.org are snapshots. It officially supports **Java 26** class
> files, so JDK 25 is comfortably inside support.
> ⚠️ **No build, no Docker and no sandbox on this machine.** Every page carries Java source, POM
> and Gradle configuration, and behaviour quoted from documentation — **never a coverage
> percentage produced by a run.**

**A coverage tool answers one question: while your tests ran, did this instruction execute? That
is smaller than anyone hopes. It is not "was this tested", because executing a line and checking
its result are different acts and a probe stores one bit. It is not "is this correct", because a
test with no assertions drives coverage to 100%. The number is real and useful — it can prove the
negative — but it reads in one direction only, and this topic is mostly about which direction.**

Three facts run through all 22 chunks, and each one is quoted from JaCoCo's own documentation
rather than argued:

1. **0% is a fact; 100% is not.** Nothing reached that code — sound, and actionable. Everything
   above is a claim about execution, never about testing.
2. 🔴 **Exception handling is not a branch** — *"exception handling is not considered as branches
   in the context of this counter definition"*, and *"try/catch blocks will also not increase
   complexity"*. So the code most likely to be wrong in production is the code your branch-coverage
   gate cannot see.
3. **The tools' defaults are not what teams think they configured.** An unspecified `check` limit
   is `BUNDLE` / `INSTRUCTION` / `COVEREDRATIO` — the most generous counter at the coarsest
   granularity. Gradle's report task does not depend on `test`, and its verification task is not a
   dependency of `check`.

**22 chunks, 5,306 lines, 304 gotchas and interview questions.** Read in order; each chunk links
to the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[01 · What coverage measures](01-what-coverage-measures.md)** | <span className="db-tier t-know">Know</span> | Lines executed, not lines tested — with a class at 100% line *and* branch coverage and zero assertions |
| 2 | **[01b · How JaCoCo works](01b-how-jacoco-works.md)** | <span className="db-tier t-know">Know</span> | An agent, load-time rewriting, one-bit probes, CRC64 class ids — the four facts behind every strange result |
| 3 | **[02 · Wiring it up (Maven)](02-wiring-it-up-maven.md)** | <span className="db-tier t-know">Know</span> | Eleven goals, their real defaults, and why `mvn test` produces no report |
| 4 | **[02b · The argLine trap](02b-the-argline-trap.md)** | <span className="db-tier t-know">Know</span> | Surefire's `<argLine>` silently overwrites the agent; the documented fix is `@{argLine}` |
| 5 | **[02c · Wiring it up (Gradle)](02c-wiring-it-up-gradle.md)** | <span className="db-tier t-know">Know</span> | Two documented traps: the report does not depend on `test`, and verification is not in `check` |
| 6 | **[02d · Integration tests and merge](02d-integration-tests-and-failsafe.md)** | <span className="db-tier t-know">Know</span> | Two runs, two exec files, and why merging is a policy choice rather than a default |
| 7 | **[03 · The six counters](03-the-six-counters.md)** | <span className="db-tier t-know">Know</span> | Instruction, branch, line, complexity, method, class — six numbers that disagree by design |
| 8 | **[03b · Branch coverage is the useful one](03b-branch-coverage-is-the-useful-one.md)** | <span className="db-tier t-know">Know</span> | The only counter whose cheapest route to green needs a real test — and four ways it still loses |
| 9 | **[03c · Lines, debug info, addition](03c-line-coverage-needs-debug-info.md)** | <span className="db-tier t-know">Know</span> | Line coverage needs `-g` and does not add up, both documented, both surprising |
| 10 | **[04 · Thresholds](04-thresholds.md)** | <span className="db-tier t-know">Know</span> | The `check` rule syntax in full, why element granularity matters more than the number, and `MISSEDCOUNT` |
| 11 | **[04a · Floor or target](04a-floor-or-target.md)** | <span className="db-tier t-know">Know</span> | The same XML encodes two opposite policies, and most teams never notice which they picked |
| 12 | **[04b · The 80% ritual](04b-the-eighty-percent-ritual.md)** | <span className="db-tier t-know">Know</span> | Five patterns, shown as code, that raise a number and lower a suite's value |
| 13 | **[04c · The ratchet](04c-the-ratchet.md)** | <span className="db-tier t-know">Know</span> | An auto-raising floor ratchets on noise and on deletions — and the second has no fix |
| 14 | **[05 · Exclusions](05-exclusions.md)** | <span className="db-tier t-know">Know</span> | Three places to exclude; the obvious one makes your number *worse* |
| 15 | **[05b · The @Generated rule](05b-the-generated-annotation-rule.md)** | <span className="db-tier t-know">Know</span> | `jakarta.annotation.Generated` is source-retained; Lombok's annotation is opt-in. Both traps |
| 16 | **[05c · Filtered for free](05c-what-jacoco-filters-for-free.md)** | <span className="db-tier t-know">Know</span> | Twenty-odd built-in filters with versions — and why many hand-written exclusions are dead config |
| 17 | **[06 · What the number cannot say](06-what-the-number-cannot-say.md)** | <span className="db-tier t-know">Know</span> | Seven questions the report structurally cannot answer, and the three it answers well |
| 18 | **[06b · try/catch is invisible](06b-try-catch-is-invisible.md)** | <span className="db-tier t-know">Know</span> | A branch gate is *exactly as satisfied* by code with no error handling as by thorough error handling |
| 19 | **[06c · The class that reads 0%](06c-the-zero-percent-class.md)** | <span className="db-tier t-know">Know</span> | Six causes, one appearance, and the Sessions page that tells the worst of them apart |
| 20 | **[07 · Multi-module](07-multi-module.md)** | <span className="db-tier t-know">Know</span> | `report-aggregate` selects by dependency, scope changes what is contributed, and it omits itself by default |
| 21 | **[07b · Coverage in CI](07b-coverage-in-ci.md)** | <span className="db-tier t-know">Know</span> | Coverage on the *change* — the one deployment that survives every objection in this topic |
| 22 | **[08 · The checklist](08-the-checklist.md)** | <span className="db-tier t-know">Know</span> | Reading a report usefully, and the setup this topic recommends |

## The boundary

**09 owns coverage measurement and what the number means.** Phase 8 owns Maven and Gradle
themselves — this topic wires a plugin into a build it assumes you understand, and links to
**[Phase 8 · Build and dependencies](../../phase-8-build-dependencies/README.md)** rather than
re-teaching the lifecycle, `javac`'s `-g` flag, or the reactor.

🔴 **The honest answer to "what the number cannot say" is the next topic but one.** Coverage
cannot tell a test that asserts from a test that does not, because a probe has one bit and no
room for "and it was correct". **Topic 11 · Mutation testing** changes your code and asks whether
a test notices, which is the question you had all along — and it kills every one of the five
patterns in [chunk 04b](04b-the-eighty-percent-ritual.md) outright. **Topic 10 · Property-based
testing** attacks the neighbouring blindness from the input side: coverage cannot see that a
*combination* of decisions was never walked, and generated inputs are one answer to that.

## Three claims documentation could not settle — flagged in-page, not invented

1. Whether Spring Boot 4.1's BOM or its build plugins manage a JaCoCo version at all.
   `02` says so explicitly and recommends pinning regardless.
2. What the `report` goal does when no execution data file exists — skip or fail.
   `report-mojo.html` does not say.
3. A documented Gradle report-exclusion API. The manual documents none, so `02c` and `05`
   present the `classDirectories`/`fileTree` recipe as **community practice**, not as plugin API.

⚠️ Also worth knowing: **there is no `doc/filtering.html` on jacoco.org** — both that host and
eclemma.org return 404 for it. The filter list lives in `doc/changes.html`, which is what
[chunk 05c](05c-what-jacoco-filters-for-free.md) cites.

{/* FOOTER */}
