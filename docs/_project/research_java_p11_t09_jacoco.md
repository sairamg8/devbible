---
name: research-java-p11-t09-jacoco
description: Banked, source-verified facts for phase 11 topic 09 (JaCoCo) — version, goals, counter definitions and the two documented facts that carry the topic's whole argument. Do not re-derive.
metadata:
  type: project
---

# Java · Phase 11 · Topic 09 — JaCoCo: banked research

Verified 2026-08-31 by session `5bd19f1e` against jacoco.org's own documentation
(`doc/maven.html`, `doc/counters.html`). **Do not re-derive; do not quote a blog instead.**

## Version

**JaCoCo 0.8.16.202608270545** is what jacoco.org/jacoco/trunk documents as of 2026-08-31.
⚠️ Check what `spring-boot-dependencies:4.1.0` manages, if anything, before pinning a number in
a POM sample — Boot manages the *plugin* differently from a dependency.

## Maven plugin goals (from `doc/maven.html`)

`prepare-agent` · `prepare-agent-integration` · `report` · `report-integration` ·
`report-aggregate` · `check` · `merge` · `instrument` · `restore-instrumented-classes` ·
`dump` · `help`.

⚠️ The `check` goal's rule/limit syntax (element, counter, value, minimum) is **not** on
`doc/maven.html` — it is on `check-mojo.html`. **Fetch that page before writing the check-goal
chunk.** Counters and values must be quoted from there, not guessed.

## 🔴 The counter definitions — these carry the topic's argument

From `doc/counters.html`, quoted:

- **Instructions (C0):** *"The smallest unit JaCoCo counts are single Java byte code
  instructions."* Independent of source formatting, and available **without debug information**.
- **Branches (C1):** decision points in `if` and `switch`. 🔴 *"exception handling is not
  considered as branches in the context of this counter definition"* — **so `try`/`catch` adds
  no branches**, and a catch block contributes nothing to branch coverage.
- **Cyclomatic complexity:** `v(G) = B - D + 1`. Because exception handling is not a branch,
  *"try/catch blocks will also not increase complexity"*.
- **Lines:** require **debug information** in the class files. *"A source line is considered
  executed when at least one instruction that is assigned to this line has been executed."*
  🔴 Line counts are **not additive** across methods/classes, because *"a single line of a
  source code may refer to multiple methods or multiple classes."*
- **Methods:** executed when at least one instruction runs; **constructors and static
  initializers count as methods**, including implicitly generated ones.
- **Classes:** executed when *"at least one of its methods has been executed"* — constructors
  and static initializers included.

## Why these facts matter to the chunk plan

They are the evidence for "coverage is a floor, not a target", and they are checkable rather
than opinion:

1. **A line can be 100% covered and its branches untested** — line coverage is satisfied by one
   instruction on the line executing. This is the single most useful thing to show with a
   worked example.
2. **`try`/`catch` is invisible to branch coverage and to complexity.** A codebase whose error
   handling is entirely in catch blocks can post a high branch-coverage number while none of the
   error paths is exercised. This is the strongest "what the number cannot say" argument
   available, and it comes straight from JaCoCo's own definition.
3. **Coverage is measured on BYTECODE**, so generated code counts — implicit constructors,
   static initializers, synthetic switch-map classes, lambdas, records' generated members. That
   is why numbers move when nobody wrote a test, and why a Lombok-heavy or record-heavy module
   reads differently from a plain one.
4. **Line coverage needs `-g` debug info**; instruction coverage does not. A build that strips
   debug info silently loses the line report.
5. Line totals not being additive is why a per-class report and an aggregate report can look
   inconsistent to someone who tries to reconcile them by hand.

## Still to verify before writing topic 09

- `check-mojo.html` — the full rule/limit syntax, counters and value types.
- Gradle's `jacocoTestReport` / `jacocoTestCoverageVerification` task wiring for the current
  Gradle line.
- `report-aggregate` in a multi-module build: which module runs it and what it needs on the
  classpath.
- Whether Boot 4.1 or the Spring Boot Gradle/Maven plugins say anything about JaCoCo + the
  repackaged jar or about `@Generated` exclusion (JaCoCo ignores classes/methods annotated with
  an annotation whose simple name is `Generated` **with the right retention** — verify the exact
  rule, it is commonly misquoted).

Topic 11 · PIT is the honest answer to what these numbers cannot say — see the phase notes.
Related: [[progress-java-p11-t08-test-data-patterns]], [[cursor-java]].

---

## 🔴 ROUND 2 — verified 2026-08-31 by session `01cb3b13`. These CORRECT the section above.

### Version — the research above was wrong about what "current" means

- 🔴 **0.8.15 (2026/06/04) is the latest RELEASE.** `0.8.16.202608270545` is a **snapshot**, not a
  release — the section above quoted it as if it were shippable. Pin **0.8.15** in a POM sample.
- **JDK support is a non-issue and the `_plan.md`'s worry is resolved:** 0.8.15 **officially
  supports Java 26** class files, with experimental support for 27 and 28. JDK 25 is comfortably
  inside support. Source: `doc/changes.html`. Say so plainly rather than hedging.

### `check` goal — full syntax, from `check-mojo.html`

Binds by default to **`verify`**. `haltOnFailure` default **`true`**.
`dataFile` default `${project.build.directory}/jacoco.exec`. `skip` default `false`
(`jacoco.skip`). `includes`/`excludes` are **class file patterns**, wildcards `*` and `?`.

`rules` → `rule` → { `element`, `includes`, `excludes`, `limits` → `limit` → { `counter`,
`value`, `minimum`, `maximum` } }.

| Slot | Allowed values |
|---|---|
| `element` | `BUNDLE` · `PACKAGE` · `CLASS` · `SOURCEFILE` · `METHOD` |
| `counter` | `INSTRUCTION` · `LINE` · `BRANCH` · `COMPLEXITY` · `METHOD` · `CLASS` |
| `value` | `TOTALCOUNT` · `MISSEDCOUNT` · `COVEREDCOUNT` · `MISSEDRATIO` · `COVEREDRATIO` |

🔴 **Defaults when unspecified: element `BUNDLE`, counter `INSTRUCTION`, value `COVEREDRATIO`.**
So a bare `<minimum>0.80</minimum>` is *instruction* coverage over the whole bundle — **not line
coverage**, which is what everyone assumes they configured.

### `prepare-agent` — from `prepare-agent-mojo.html`

Binds to **`initialize`**. Sets **`argLine`** (`tycho.testArgLine` for `eclipse-test-plugin`);
overridable via `propertyName`. `destFile` default `${project.build.directory}/jacoco.exec`.
`append` — when false an existing exec file is *replaced*. `excludeClassLoaders` is
**colon-separated**. `inclNoLocationClasses` covers "classes without source location".

🔴 **THE ARGLINE TRAP, documented on JaCoCo's own page.** If surefire has a hand-written
`<argLine>`, it overwrites the agent property and coverage silently reads 0%. The documented fix
is **late property evaluation**: `<argLine>@{argLine} -your -extra -arguments</argLine>`, or
define `argLine` as a Maven property instead of inside surefire's `<configuration>`.

### `report` / `report-aggregate`

`report` binds to **`verify`**; output `${project.reporting.outputDirectory}/jacoco`; HTML+XML+CSV,
selectable via `formats`. `includes`/`excludes` are class file patterns.
`report-aggregate` builds "from all modules this project depends on, and optionally this project
itself" — `compile`/`runtime`/`provided` deps contribute **source and exec data**, `test`-scope
deps contribute **exec data only**. `includeCurrentProject` defaults **`false`**, which is why the
aggregator module's own classes vanish from the report unless you flip it.
⚠️ The docs do **not** name which module should run it — do not claim they do.

### Gradle — from `docs.gradle.org/current/userguide/jacoco_plugin.html`

🔴 Two documented non-obvious facts, both quotable:
- *"the `jacocoTestReport` task does not depend on the `test` task"* — wire `finalizedBy`/`dependsOn`.
- *"The `JacocoCoverageVerification` task is not a task dependency of the `check` task."*

`violationRules { rule { element, includes, limit { counter, value, minimum/maximum } } }`;
minimum is a `BigDecimal` (`"0.5".toBigDecimal()`). `jacoco { toolVersion = "…" }`.
⚠️ The page does **not** document a report-exclusion syntax — the `classDirectories`/`fileTree`
exclude recipe is community practice, so present it as such, not as documented API.

### 🔴🔴 The `@Generated` filter — the two facts every blog post gets wrong

From `doc/changes.html` (there is **no** `doc/filtering.html`; both hosts 404 — cite `changes.html`):
JaCoCo filters classes/methods annotated with an annotation **whose simple name is `Generated`**,
and **only with retention `RUNTIME` or `CLASS`** (added v0.8.3). `@lombok.Generated` and
`@groovy.transform.Generated` got dedicated support in v0.8.0.

1. 🔴 **`jakarta.annotation.Generated` is `@Retention(SOURCE)`** — verified against the Jakarta
   Annotations 3.0 javadoc. It is **gone from the bytecode**, so JaCoCo cannot see it and does
   **not** filter it. Code generated by anything that marks its output with only that annotation
   counts fully toward coverage.
2. 🔴 **Lombok does not add `@lombok.Generated` by default.** It is opt-in via
   `lombok.addLombokGeneratedAnnotation = true` in `lombok.config` — projectlombok.org's own
   configuration page: *"Lombok can be configured to add `@lombok.Generated` annotations to all
   generated nodes where possible; useful for JaCoCo (which has built in support)"*. Until you set
   it, every generated getter, `equals` and `hashCode` is in your denominator.

### Built-in filters, with the version each arrived (from `changes.html`)

`values`/`valueOf` on enums, private empty constructors, synchronized blocks,
try-with-resources, `finally` duplication, `switch` on `String` — **0.8.0**;
empty enum constructors — **0.8.1**; the `@*Generated` retention rule — **0.8.3**;
record accessors + generated `toString`/`hashCode`/`equals`, bridge methods — **0.8.6**;
`assert` statements — **0.8.8**; exhaustive switch expressions and record patterns — **0.8.11**;
Kotlin default-argument bytecode — 0.8.12; Kotlin safe-call chains, suspend functions,
Compose pausable composition, serialization-plugin methods — 0.8.14.

### Class ids — why a class reads 0% when it was definitely executed

From `doc/classids.html`: a class id is a **CRC64 of the raw class file**, and it is how exec data
is related to analysed classes. Different compiler, version, settings or any post-processing
between run and report ⇒ *"execution data cannot be related to the analyzed classes"* and the
classes are *"reported with 0% coverage"*. Diagnosis is the **Sessions page**: *"If the entry is
not linked this means there is a class id mismatch between the class used at runtime and the
class provided to create the report."* Probes are *"stored in a plain boolean array"* with no
metadata, so a mismatch would otherwise yield *"random coverage results"*.
🔴 This is the documented root cause of the "bytecode manipulation broke my coverage" class of
bug — Spring's repackaging, shading, or an aspect weaver run after the tests.

From `doc/faq.html`: agent `includes`/`excludes` control **collection**, not report visibility, and
*"If execution data is missing for a particular class, this class is shown as not covered because
the report generator cannot distinguish whether the class was excluded from instrumentation or not
executed."* — i.e. **excluding at the agent makes classes read as 0%, not as absent.** Excluding
must be done at the **report**.

### Still not settled — flag as uncertain, do NOT fill in from a blog

- Whether Boot 4.1's BOM or its Maven/Gradle plugins manage a JaCoCo version at all.
- What `report` does when no exec file exists (skip vs fail) — `report-mojo.html` does not say.
- A documented Gradle report-exclusion API (see above — recipe is community practice).
