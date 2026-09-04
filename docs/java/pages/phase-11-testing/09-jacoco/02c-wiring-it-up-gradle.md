---
title: "Wiring JaCoCo into Gradle: two sentences in Gradle's own manual explain why most Gradle coverage setups are quietly broken — jacocoTestReport does not depend on test, and jacocoTestCoverageVerification is not a dependency of check"
sidebar_label: "02c · Wiring it up (Gradle)"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against the **Gradle user manual**'s JaCoCo plugin page
> ([docs.gradle.org/current/userguide/jacoco_plugin.html](https://docs.gradle.org/current/userguide/jacoco_plugin.html))
> and **JaCoCo 0.8.15**'s `changes.html`. Version spine from `spring-boot-dependencies:4.1.1`:
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.
> ⚠️ **No build and no sandbox on this machine** — build script and documented behaviour only,
> never build output. Samples are Kotlin DSL, matching the manual's own examples.

**Gradle's JaCoCo plugin is less configuration than Maven's and has fewer moving parts, and it
still manages to have two failure modes that are stated plainly in Gradle's own documentation
and ignored by almost everyone. Both are of the form "the task you assume runs, does not". One
produces a stale report; the other produces a coverage gate that never fires. Neither is a bug,
and neither prints a warning.**

## The plugin, and what it gives you

```kotlin
plugins {
    java
    jacoco
}
```

With the Java plugin also applied, this creates:

- a `jacocoTestReport` task, generating HTML into
  `layout.buildDirectory.dir("reports/jacoco/test")` by default;
- a `jacocoTestCoverageVerification` task, which checks coverage against rules and, per the
  manual, *"The build fails if any of the configured rules are not met."*;
- a `jacoco { }` extension where `toolVersion` selects the JaCoCo version.

The agent wiring itself is implicit — the plugin attaches a `JacocoTaskExtension` to `Test`
tasks and adds the `-javaagent` argument for you. **Gradle has no equivalent of Maven's
[argLine trap](02b-the-argline-trap.md)**, because you never name the property; adding
`jvmArgs` to a `Test` task appends rather than replaces the agent argument. That is the one place
Gradle is unambiguously the better-behaved of the two.

Pin the version explicitly, for the same reproducibility reason as in Maven:

```kotlin
jacoco {
    toolVersion = "0.8.15"
}
```

## 🔴 Trap 1 · `jacocoTestReport` does not depend on `test`

Straight from the manual: *"While tests should be executed before generation of the report, the
`jacocoTestReport` task does not depend on the `test` task."*

Run `./gradlew jacocoTestReport` on a clean checkout and you get a report generated from no
execution data. Run it on a dirty build directory and you get a report from **whenever the tests
last ran** — which may be several commits ago. Nothing is marked stale, because from Gradle's
point of view nothing is: the task's inputs (the exec file, the class files) are what they are.

The manual gives both wirings:

```kotlin
tasks.test {
    finalizedBy(tasks.jacocoTestReport)   // report always follows a test run
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)                  // report always triggers a test run
}
```

They are not the same thing and the choice matters:

- **`finalizedBy` on `test`** means every `./gradlew test` also produces a report — including
  when the tests *fail*, which is exactly when you want to see what ran. This is the one to
  reach for by default.
- **`dependsOn` on the report** means asking for a report runs the tests first. Useful, but it
  does not help the developer who just runs `test`, and a failing `test` will stop the report
  from being produced at all.

Using both is fine and is what most projects converge on.

## 🔴 Trap 2 · Verification is not part of `check`

Also from the manual, and even more consequential: *"The `JacocoCoverageVerification` task is not
a task dependency of the `check` task."*

This is the one that silently disarms coverage gates. A team adds `violationRules`, sees the task
exist, runs `./gradlew build` — which runs `check`, which runs `test` — and concludes the gate is
active. It is not. `jacocoTestCoverageVerification` never ran, and coverage can fall to zero
without the build noticing.

The wiring:

```kotlin
tasks.check {
    dependsOn(tasks.jacocoTestCoverageVerification)
}
```

Note the asymmetry with Maven, where `check` binds by default to `verify` and *is* in the path of
an ordinary `mvn verify`. In Gradle the gate is opt-in twice: once to configure the rules, and
once to make anything run them.

## Violation rules

The DSL mirrors the Maven `check` goal's structure — rules containing limits — using the manual's
own example shape:

```kotlin
tasks.jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit {
                minimum = "0.5".toBigDecimal()
            }
        }

        rule {
            element = "CLASS"
            includes = listOf("org.gradle.*")
            limit {
                counter = "LINE"
                value = "TOTALCOUNT"
                maximum = "0.3".toBigDecimal()
            }
        }
    }
}
```

Two details worth extracting:

- **`minimum` and `maximum` are `BigDecimal`.** Hence `"0.5".toBigDecimal()` rather than `0.5`.
  This is a deliberate choice — coverage ratios compared with floating point produce
  off-by-a-hair failures — and it is a compile error if you get it wrong, so it is the friendly
  kind of surprise.
- **The bare `rule { limit { minimum = … } }` inherits the same defaults as Maven's** — element
  `BUNDLE`, counter `INSTRUCTION`, value `COVEREDRATIO`. The first rule above is *instruction*
  coverage across the bundle, not line coverage. [Chunk 04](04-thresholds.md) is about writing
  these deliberately.

## Reports: choose your formats

```kotlin
tasks.jacocoTestReport {
    reports {
        xml.required = true      // for CI tooling
        csv.required = false
        html.outputLocation = layout.buildDirectory.dir("jacocoHtml")
    }
}
```

XML is the format CI coverage tools consume, and it is worth turning on deliberately —
[chunk 07b](07b-coverage-in-ci.md) covers why the HTML report alone is close to useless in a
pipeline.

## Excluding classes from the report

⚠️ **State of the documentation:** the Gradle manual page does not document a report-exclusion
API. The widely-used recipe filters the report task's `classDirectories`:

```kotlin
tasks.jacocoTestReport {
    classDirectories.setFrom(
        files(classDirectories.files.map {
            fileTree(it) { exclude("**/generated/**", "**/*Config.class") }
        })
    )
}
```

This works because `classDirectories` is an ordinary Gradle file collection, but it is
**community practice built on a general Gradle mechanism, not a documented JaCoCo-plugin
feature** — so treat it as more fragile across Gradle versions than Maven's `<excludes>`, which
is a documented plugin parameter. And note the patterns are `.class` file paths, same as Maven's.
[Chunk 05](05-exclusions.md) argues about *what* to exclude; this is only the how.

## Maven and Gradle side by side

| | Maven | Gradle |
|---|---|---|
| Agent wiring | `prepare-agent` sets `argLine`; **can be overwritten** | Implicit on `Test` tasks; `jvmArgs` appends |
| Report runs by default? | Yes, at `verify` | **No** — no dependency on `test` |
| Gate runs by default? | Yes, `check` binds to `verify` | **No** — not a `check` dependency |
| Rule DSL | `<rules><rule><limits><limit>` | `violationRules { rule { limit { } } }` |
| Report exclusions | documented `<excludes>` | undocumented `classDirectories` filtering |
| Version pinning | `<version>` on the plugin | `jacoco { toolVersion }` |

The pattern is consistent: **Maven's defaults do more and can be silently broken; Gradle's
defaults do less and must be explicitly asked.** Neither is safer — they fail in opposite
directions, and both failures are quiet.

## Where this connects

- **[02 · Wiring it up (Maven)](02-wiring-it-up-maven.md)** — the same job with the opposite
  set of surprises.
- **[04 · Thresholds](04-thresholds.md)** — what to put in `violationRules` and why the
  defaults are the wrong starting point.
- **[05 · Exclusions](05-exclusions.md)** — what deserves excluding, and the two very different
  places you can do it.
- **[Phase 8 · Gradle](../../phase-8-build-dependencies/04-gradle/README.md)** owns the build tool
  itself — task graphs, `finalizedBy` versus `dependsOn`, and configuration avoidance.

## Gotchas

**★ `./gradlew jacocoTestReport` on its own can report on a test run from days ago.**
The manual says outright that the report task does not depend on `test`. The report is generated
from whatever `.exec` file is in the build directory, and a stale one produces a plausible,
completely wrong report with no indication of its age. The failure is worse than an error,
because the output looks fine.

**★ A coverage gate wired only through `violationRules` never runs.**
`jacocoTestCoverageVerification` is *"not a task dependency of the `check` task"*, so
`./gradlew build` does not execute it. Teams have shipped for months believing a threshold was
enforced. Verify by deliberately breaking the rule — set the minimum to `"1.0"` on a branch and
confirm the build actually fails.

**★ `finalizedBy` and `dependsOn` are not interchangeable here.**
`test { finalizedBy(jacocoTestReport) }` produces a report even when tests fail — usually what
you want, since a failing run is when you most want to see what executed.
`jacocoTestReport { dependsOn(test) }` does not, because a failed dependency stops the task.
Most projects want both wirings, not a choice between them.

**★ A bare `rule { limit { minimum = "0.8".toBigDecimal() } }` is instruction coverage, not line coverage.**
Identical defaults to Maven — element `BUNDLE`, counter `INSTRUCTION`, value `COVEREDRATIO`.
Gradle's terser DSL makes it *easier* to write a rule without naming its counter, so the mistake
is if anything more common here.

**★ `minimum` takes a `BigDecimal`, and the mistake is a compile error rather than a silent one.**
`"0.5".toBigDecimal()`, not `0.5`. Unusually for this topic, this is a surprise that tells you
about itself immediately.

**★ Report exclusion via `classDirectories` is community practice, not documented API.**
The Gradle manual does not document an exclusion syntax for the report task. The `fileTree`
recipe works, but it is a general Gradle file-collection manipulation, so it is more exposed to
change across Gradle versions than Maven's documented `<excludes>` parameter. Pin your Gradle
version and re-verify the recipe when you upgrade.

**★ Excluding at `classDirectories` excludes from the *report* only — the agent still instruments.**
Which is correct and is what you want: instrumenting and then omitting from the report gives a
fair denominator, whereas excluding at the agent leaves classes appearing as uncovered. The
distinction is the same one Maven has, and it is the subject of [chunk 05](05-exclusions.md).

**★ Multiple `Test` tasks produce multiple exec files, and `jacocoTestReport` reads one by default.**
A project with a separate `integrationTest` task gets a second execution data file that the
default report does not include. The result is a report that legitimately shows integration-only
code as uncovered. `executionData` on the report task has to be pointed at all of them.

**★ Configuration cache and up-to-date checks can skip a report you expected to regenerate.**
If the exec file and class files have not changed, Gradle correctly declares the report task
up to date and does nothing. That is right, but combined with trap 1 it means "I ran the report
task and the number did not change" can have two entirely different causes.

## Interview questions

**★ What are the two documented surprises in Gradle's JaCoCo plugin?**
That `jacocoTestReport` does not depend on `test`, so a report can be generated from stale or
absent execution data; and that `jacocoTestCoverageVerification` is not a dependency of `check`,
so a configured coverage gate does not run as part of `./gradlew build`. Both are stated in
Gradle's own manual, both are silent, and both need an explicit `finalizedBy`/`dependsOn` wiring.

**★ Does Gradle have Maven's argLine problem?**
No. The Gradle plugin attaches the agent through a `JacocoTaskExtension` on `Test` tasks rather
than through a named property you have to reference, and adding `jvmArgs` appends to the JVM
arguments rather than replacing the agent flag. You cannot accidentally overwrite it the way a
Surefire `<argLine>` overwrites the property `prepare-agent` sets.

**★ You've added `violationRules` with a 70% minimum and the build still passes at 40%. Why?**
Because the verification task never ran. `jacocoTestCoverageVerification` is not in `check`'s
task graph, so `build` does not trigger it. Add `check { dependsOn(jacocoTestCoverageVerification) }`.
And while you are there, confirm the rule is measuring what you think — a `limit` with no
`counter` is instruction coverage, which reads higher than line or branch coverage on the same code.

**★ How do you exclude generated code from a Gradle coverage report, and what's the caveat?**
Filter the report task's `classDirectories` through a `fileTree` with `exclude` patterns on
`.class` paths. The caveat is that this is not a documented feature of the JaCoCo Gradle plugin —
the manual documents no exclusion API — so it is community practice riding on a general Gradle
mechanism, and worth re-verifying on a Gradle upgrade. Also note it excludes from the report only;
the agent still instruments those classes, which is the behaviour you want.

**★ Compare Maven's and Gradle's JaCoCo defaults.**
Maven's do more and can be broken silently: report and check both bind to `verify` so they run in
an ordinary build, but the agent arrives via a property that Surefire configuration can overwrite.
Gradle's do less and must be asked for: the agent wiring is robust, but neither the report nor the
verification runs unless you wire it. Maven fails by having its coverage silently disabled;
Gradle fails by never having enabled the parts you assumed.

{/* FOOTER */}
