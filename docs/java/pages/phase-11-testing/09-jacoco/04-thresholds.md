---
title: "Thresholds: the check goal's rule syntax in full, why every limit must name its counter and its value, and the difference between a floor that stops regression and a target that buys you assertion-free tests"
sidebar_label: "04 · Thresholds"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `check-mojo.html` — the full rule and limit
> structure, the allowed values for `element`, `counter` and `value`, the defaults when
> unspecified, and `haltOnFailure` — plus the **Gradle user manual**'s `violationRules` DSL.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> JUnit Jupiter 6.0.3.
> ⚠️ **No build and no test runs on this machine** — configuration and documented behaviour
> only. No percentage on this page comes from a run.

**A coverage threshold is a policy encoded in XML, and most teams get the policy wrong before
they get to the XML. The policy question is whether you are stopping the number going down or
pushing it up — a floor or a target — because those two produce completely different behaviour in
a team. The XML question is that every limit you do not fully specify silently becomes something
else, and JaCoCo's defaults are the most generous combination available.**

## The full syntax

The `check` goal binds by default to **`verify`** and has `haltOnFailure` **`true`**. Its
structure, from the mojo documentation:

```
rules
  └── rule
        ├── element        BUNDLE | PACKAGE | CLASS | SOURCEFILE | METHOD
        ├── includes       class file patterns
        ├── excludes       class file patterns
        └── limits
              └── limit
                    ├── counter   INSTRUCTION | LINE | BRANCH | COMPLEXITY | METHOD | CLASS
                    ├── value     TOTALCOUNT | MISSEDCOUNT | COVEREDCOUNT | MISSEDRATIO | COVEREDRATIO
                    ├── minimum
                    └── maximum
```

🔴 **The defaults when you omit them: element `BUNDLE`, counter `INSTRUCTION`, value
`COVEREDRATIO`.** So this:

```xml
<rule>
  <limits><limit><minimum>0.80</minimum></limit></limits>
</rule>
```

means *80% instruction coverage across the whole bundle* — the most generous counter
([chunk 03](03-the-six-counters.md)) at the coarsest granularity. Almost nobody writing that
intends it. **Name all three, every time:**

```xml
<execution>
  <id>check</id>
  <goals><goal>check</goal></goals>
  <configuration>
    <rules>
      <rule>
        <element>BUNDLE</element>
        <limits>
          <limit>
            <counter>BRANCH</counter>
            <value>COVEREDRATIO</value>
            <minimum>0.70</minimum>
          </limit>
          <limit>
            <counter>LINE</counter>
            <value>COVEREDRATIO</value>
            <minimum>0.75</minimum>
          </limit>
        </limits>
      </rule>
    </rules>
  </configuration>
</execution>
```

Several limits inside one rule are ANDed — all must hold. Several rules are also all evaluated.

## Element granularity is the more important choice

A `BUNDLE` rule is one number for the whole module, and it is the weakest useful shape, because
a large well-covered area subsidises a small badly-covered one. The three ways a bundle rule
fails you:

- **A new untested class barely moves the total**, so the gate does not notice it.
- **A well-covered addition raises the total**, offsetting a regression elsewhere in the same
  pull request.
- **It tells you nothing about where the problem is** when it does fail.

`CLASS` is the granularity that changes behaviour, because it cannot be averaged away:

```xml
<rule>
  <element>CLASS</element>
  <excludes>
    <exclude>com.example.config.*</exclude>
  </excludes>
  <limits>
    <limit>
      <counter>BRANCH</counter>
      <value>COVEREDRATIO</value>
      <minimum>0.50</minimum>
    </limit>
  </limits>
</rule>
```

"No class may be below 50% branch coverage" is a much stronger statement than "the module
averages 80%", and it is usually achievable at a lower number. ⚠️ Applied to an existing
codebase it will fail on dozens of classes at once, which is what [chunk 04c](04c-the-ratchet.md)
is about.

Note `<excludes>` on the rule itself — distinct from the report's excludes and from the agent's.
Rule-level excludes say "this rule does not apply here" without removing the classes from the
report, which is usually what you want for configuration classes.

## `MISSEDCOUNT` — the value nobody uses and probably should

Ratios have a structural problem on growing code: **a ratio can improve while the untested part
stays exactly as untested.** Add 200 well-covered lines to a class with 40 uncovered branches and
the percentage climbs; the 40 branches are still there.

Absolute counts do not behave that way:

```xml
<limit>
  <counter>BRANCH</counter>
  <value>MISSEDCOUNT</value>
  <maximum>10</maximum>
</limit>
```

"No class may have more than 10 uncovered branches." That number does not drift as the class
grows, it is trivially explainable to a reviewer, and it converts "raise the percentage" into
"go and test these ten specific decisions", which is an actionable instruction rather than a
quota. `TOTALCOUNT` with a `maximum` is a related trick — it caps how big or complex a class may
get at all, which is a design rule rather than a coverage rule but is enforced in the same place.

## Gradle

Same structure, different syntax, same defaults:

```kotlin
tasks.jacocoTestCoverageVerification {
    violationRules {
        rule {
            element = "CLASS"
            excludes = listOf("com.example.config.*")
            limit {
                counter = "BRANCH"
                value = "COVEREDRATIO"
                minimum = "0.50".toBigDecimal()
            }
        }
    }
}

tasks.check {
    dependsOn(tasks.jacocoTestCoverageVerification)   // 🔴 or nothing runs
}
```

🔴 The `dependsOn` is not optional. Gradle's manual states the verification task *"is not a task
dependency of the `check` task"*, so without that line the rules are configuration that never
executes — see [chunk 02c](02c-wiring-it-up-gradle.md).

## Where this connects

- **[03 · The six counters](03-the-six-counters.md)** — what you are choosing between in
  `<counter>`, and why `INSTRUCTION` is a poor default.
- **[04b · The eighty percent ritual](04b-the-eighty-percent-ritual.md)** — what a target does to
  a codebase, in code.
- **[04c · The ratchet](04c-the-ratchet.md)** — moving a floor over time without automating
  yourself into a corner.
- **[05 · Exclusions](05-exclusions.md)** — the other half of any threshold conversation, because
  a gate makes exclusions suddenly very attractive.
- **[02c · Wiring it up (Gradle)](02c-wiring-it-up-gradle.md)** — the `dependsOn` without which
  none of this runs.

## Gotchas

**★ A limit with no `<counter>` is an instruction-coverage limit.**
Documented defaults: element `BUNDLE`, counter `INSTRUCTION`, value `COVEREDRATIO`. Since
instruction coverage reads highest of the six, the gate is weaker than intended — often by 15–20
points against branch coverage on the same code. This is the single most common misconfiguration
in the topic and it produces no error.

**★ A `BUNDLE` rule cannot see a new untested class.**
One class added at 0% moves a module-wide percentage by a fraction of a point. The gate holds, the
class ships untested, and the number the team watches did not react. `CLASS`-level rules are what
make a gate respond to the change in front of it.

**★ A ratio limit can be satisfied by growth rather than by testing.**
Adding well-covered code raises the percentage while leaving every previously-uncovered branch
uncovered. Over a year a class can drift from 60% to 75% without a single one of its original
gaps being closed. `MISSEDCOUNT` with a `maximum` is immune to this.

**★ In Gradle the rules do not run unless you wire `check` to depend on the task.**
Quoted from Gradle's manual: the verification task *"is not a task dependency of the `check`
task"*. Teams have shipped for months with a configured, never-executed gate. Verify by setting a
minimum of `"1.0"` on a scratch branch and confirming the build actually fails.

**★ Rule-level `<excludes>`, report `<excludes>` and agent `excludes` are three different things.**
Rule excludes exempt classes from a rule while keeping them in the report; report excludes remove
them from the numbers entirely; agent excludes stop collection and — per JaCoCo's FAQ — make the
classes appear *uncovered*, which is the opposite of what people intend.
[Chunk 05](05-exclusions.md) is the whole story.

**★ Class file patterns, not package names.**
Rule includes and excludes take the same wildcard class-file patterns as the rest of the plugin.
A dotted package expression may silently match nothing, the exclusion appears to be ignored, and
the next move is usually to add more patterns rather than to check the syntax.

**★ A gate on a bundle that has no execution data can pass vacuously.**
If the agent never attached, there may be nothing for a rule to evaluate against, so the build is
green with zero coverage. A gate should be paired with an assertion that the exec file exists and
that the total instruction count is non-zero — see [chunk 02b](02b-the-argline-trap.md).

## Interview questions

**★ Write a JaCoCo rule that requires 70% branch coverage and explain every element.**
A `rule` with `<element>BUNDLE</element>` (or `CLASS` for per-class enforcement) containing a
`limit` with `<counter>BRANCH</counter>`, `<value>COVEREDRATIO</value>` and
`<minimum>0.70</minimum>`. All three of element, counter and value must be stated, because their
defaults are `BUNDLE`, `INSTRUCTION` and `COVEREDRATIO` — omitting them gives you a bundle-wide
instruction-coverage gate, which is materially weaker than what you asked for.

**★ Why might `MISSEDCOUNT` be a better limit than `COVEREDRATIO`?**
Because a ratio moves when the code grows, independently of whether anything was tested. Adding a
well-covered feature to a class lifts its percentage while every existing uncovered branch stays
uncovered, so a ratio gate can be satisfied by growth. `MISSEDCOUNT` with a `maximum` fixes an
absolute budget — "no more than ten uncovered branches in this class" — which does not drift, is
easy to explain in review, and translates into a concrete list of decisions to go and test.

**★ Your Gradle build has `violationRules` configured and coverage has fallen to 30% without failing. Why?**
Because `jacocoTestCoverageVerification` is not a dependency of `check`, so `./gradlew build`
never runs it — Gradle's own manual says so. The rules are configuration that has never executed.
Adding `tasks.check { dependsOn(tasks.jacocoTestCoverageVerification) }` fixes it, and it is worth
proving the fix by temporarily setting an impossible minimum and confirming a red build.

**★ Should a coverage gate be on the whole bundle or per class?**
Per class, in most cases. A bundle rule averages a new untested class into a large covered
codebase and does not react to it, and when it does fail it does not say where. A per-class rule
cannot be averaged away and points at the file. The trade-off is that a per-class rule applied to
an existing codebase fails on many classes at once, which is why it usually needs rule-level
excludes and a lower initial minimum than a bundle rule would use.

{/* FOOTER */}
