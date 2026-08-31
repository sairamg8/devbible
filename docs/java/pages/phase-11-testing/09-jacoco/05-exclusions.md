---
title: "Exclusions: there are three different places to exclude a class and they produce three different reports, the one everybody reaches for first is the one that makes your number worse, and JaCoCo's own FAQ explains why"
sidebar_label: "05 · Exclusions"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `doc/faq.html` (quoted on what agent excludes
> do to a report), `prepare-agent-mojo.html`, `report-mojo.html` and `check-mojo.html` for the
> three `excludes` parameters, and the **Gradle user manual**'s JaCoCo page. Version spine from
> `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.
> ⚠️ **No build and no test runs on this machine** — configuration and documented behaviour only.

**Excluding code from coverage is both the most legitimate configuration you will do and the
cheapest way to cheat, and the two are hard to tell apart in a diff. Before the ethics, though,
there is a mechanical problem that trips up most teams once: JaCoCo has three separate `excludes`
parameters, they are not interchangeable, and the most obvious one — the agent's — does the
opposite of what people expect.**

## The three places, and what each does

| Where | Parameter | Effect |
|---|---|---|
| **Agent** | `prepare-agent` → `excludes` | Stops *collection*. Class is not instrumented. |
| **Report** | `report` → `excludes` | Removes the class from the *report* entirely. |
| **Rule** | `check` → `rule` → `excludes` | Class stays in the report; *this rule* does not apply to it. |

🔴 **The agent one is the trap.** Stopping instrumentation does not remove the class from the
report, because the report generator analyses the class files on disk independently to know what
*could* have been covered. With no execution data for that class, it appears **fully uncovered**.

JaCoCo's FAQ says this plainly:

> *"If execution data is missing for a particular class, this class is shown as not covered
> because the report generator cannot distinguish whether the class was excluded from
> instrumentation or not executed."*

And on the right way round:

> *"If you want to exclude classes from the report please configure the respective report
> generation tool accordingly."*

So a team that excludes generated code at the agent to "stop it dragging the number down" makes
the number **worse**: the classes are still counted, now guaranteed at 0%.

**Use the report's `excludes` for anything about the number. Use the agent's only when a class
must genuinely not be instrumented** — a class a framework rewrites, or one where instrumentation
collides with something. That is a rare, technical reason, not a reporting one.

## Maven

```xml
<execution>
  <id>report</id>
  <goals><goal>report</goal></goals>
  <configuration>
    <excludes>
      <exclude>com/example/**/generated/**/*.class</exclude>
      <exclude>com/example/**/*MapperImpl.class</exclude>
      <exclude>com/example/config/**/*.class</exclude>
    </excludes>
  </configuration>
</execution>
```

⚠️ **These are class *file* patterns**, not package names — slashes, a `.class` suffix, and `*`/`?`
wildcards. `com.example.generated.*` matches nothing, silently. The usual symptom is an exclusion
that "doesn't work", followed by more patterns being added rather than the syntax being checked.

Note that the `check` goal has its own `excludes` too, at both goal and rule level. If you exclude
only at the report, a bundle-wide rule still evaluates over classes the report no longer shows,
and the two numbers diverge — which is confusing enough to be worth keeping in sync deliberately.

## Gradle

⚠️ **The Gradle manual does not document a report-exclusion API.** The recipe everyone uses
filters the report task's `classDirectories`:

```kotlin
tasks.jacocoTestReport {
    classDirectories.setFrom(
        files(classDirectories.files.map {
            fileTree(it) {
                exclude("**/generated/**", "**/*MapperImpl.class", "**/config/**")
            }
        })
    )
}
```

This works because `classDirectories` is an ordinary Gradle file collection — it is **community
practice riding on a general Gradle mechanism, not a documented plugin feature**, so it is more
exposed to change across Gradle versions than Maven's documented `<excludes>` parameter. Re-verify
it when you upgrade Gradle. Apply the same filtering to `jacocoTestCoverageVerification` or the
gate and the report will disagree.

## What deserves excluding

The honest test is: **would a test of this code tell you anything you do not already know?** If
the answer is no for a *structural* reason — not because it is hard, and not because you have not
got round to it — the exclusion is legitimate.

**Usually legitimate:**

- **Generated code.** MapStruct implementations, protobuf/Avro classes, JOOQ or jOOQ-style
  generated schema classes, OpenAPI client stubs. You are not testing your code; you are testing
  a generator that has its own test suite. ⚠️ But see [chunk 05b](05b-the-generated-annotation-rule.md)
  — JaCoCo may already be filtering some of it, and the rule for that is widely misquoted.
- **Configuration classes with no logic.** A `@Configuration` class that returns `new Thing(dep)`
  is a wiring declaration. A test of it asserts that the wiring is the wiring.
  ⚠️ A `@Configuration` class **with a conditional** is not this — it has a decision, and the
  decision can be wrong.
- **Generated builders and generated `equals`/`hashCode`** — again, see [05b](05b-the-generated-annotation-rule.md).
- **Framework entry points you do not own the behaviour of** — a `main` method whose entire body
  is `SpringApplication.run(App.class, args)`.

**Rarely legitimate, and worth arguing about:**

- **DTOs and entities.** Often excluded, and often correctly — a field holder has no behaviour.
  But an entity with lifecycle callbacks, a computed property, or custom `equals` semantics does
  have behaviour, and excluding the whole class hides it. Exclude generated members, not types.
- **Exception classes.** A custom exception with a constructor is nothing. One with a message
  template or an error-code mapping has logic.
- **"Legacy" packages.** This is a deferral dressed as an exclusion. It is sometimes the right
  call, and it should carry a date or a ticket, because otherwise it is permanent.

**Not legitimate:**

- **A package excluded because the gate failed.** This is [chunk 04b](04b-the-eighty-percent-ritual.md)'s
  pattern 5, and it is the reason exclusion lists need reviewing.
- **Anything excluded because "it's hard to test".** Hard-to-test is a design finding, not a
  reporting problem. The exclusion removes the evidence and keeps the difficulty.

## Excluding honestly: three practices

1. **A comment per entry, saying why.** Not "generated" — *which* generator, and where its own
   tests are. An entry nobody can justify in six months is one that will never be removed.
2. **Exclude by structural marker, not by convenience.** `**/generated/**` is a claim about a
   directory the build owns. `com/example/pricing/**` is a claim about a business package, and it
   will silently swallow real logic the day someone puts a class there.
3. **Review the exclusion list on the same cadence as the threshold.** They are one control. A
   rising threshold and a growing exclusion list is a number improving while the codebase does not.

And the diagnostic question, for any exclusion: **if this code were wrong, how would we find out?**
If the answer is "the generator's own tests would fail" or "it would not compile", exclude it. If
the answer is "a customer would tell us", do not.

## Where this connects

- **[05b · The `@Generated` rule](05b-the-generated-annotation-rule.md)** — the annotation-based
  filtering JaCoCo does for free, and the two facts about it that are almost universally
  misstated.
- **[05c · What JaCoCo filters for free](05c-what-jacoco-filters-for-free.md)** — the built-in
  filter list, which makes many hand-written exclusions unnecessary.
- **[04 · Thresholds](04-thresholds.md)** — rule-level excludes, the third of the three.
- **[04b · The eighty percent ritual](04b-the-eighty-percent-ritual.md)** — exclusion as the
  cheapest way to move a number.
- **[06c · The class that reads 0%](06c-the-zero-percent-class.md)** — the other cause of the
  symptom an agent-level exclusion produces.

## Gotchas

**★ Excluding at the agent makes your coverage number worse, not better.**
The report analyses class files independently, so a class with no execution data is shown as not
covered — JaCoCo's FAQ says the generator *"cannot distinguish whether the class was excluded from
instrumentation or not executed."* Teams excluding generated code at the agent to help their
number guarantee it at 0% instead. Exclude at the report.

**★ They are class file patterns: slashes and `.class`, not dots.**
`com/example/generated/**/*.class`, not `com.example.generated.*`. A dotted pattern matches
nothing and reports no error, so the exclusion appears ignored and people add more patterns rather
than checking the syntax.

**★ Report excludes and check excludes are separate, so the gate and the dashboard can disagree.**
Excluding a package from the report while a bundle-wide rule still evaluates over it means the
number you look at and the number that fails the build are computed over different class sets.
Keep them in sync deliberately, or move the exclusion to the rule level where it is explicit.

**★ In Gradle you must filter the verification task too.**
The `classDirectories` recipe applied only to `jacocoTestReport` leaves
`jacocoTestCoverageVerification` measuring everything. Same divergence as above, arrived at
differently.

**★ The Gradle exclusion recipe is not documented API.**
The manual documents no exclusion syntax for the report task; `classDirectories`/`fileTree` is a
general Gradle mechanism the community uses. It works, and it is more exposed to change on a
Gradle upgrade than Maven's documented parameter. Re-verify after upgrading.

**★ Excluding a whole type to remove its generated members hides real behaviour.**
An entity with a computed property or a lifecycle callback has logic worth testing, and excluding
`**/domain/**` to get rid of Lombok-generated getters takes that with it. Prefer annotation-based
filtering ([chunk 05b](05b-the-generated-annotation-rule.md)), which removes members rather than
types.

**★ A package-named exclusion swallows whatever gets added to that package later.**
`com/example/pricing/**` excluded once for a generated class means the real pricing logic added
next quarter is invisible to coverage and to the gate, and nothing announces it. Exclude by
build-owned directory or by annotation, not by business package.

**★ "Legacy" exclusions are permanent unless they carry a date.**
An exclusion added to defer work becomes an exclusion nobody remembers the reason for. If it is a
deferral, say so in a comment with a ticket, and treat its removal as work rather than as
housekeeping.

**★ A growing exclusion list alongside a rising threshold is a number improving while nothing else does.**
The two controls move in opposite directions and are usually reviewed by different people at
different times. Looking at them together, once a quarter, is the whole audit.

**★ Excluding is invisible in the report — you cannot see what is not there.**
A reader of the HTML report has no indication that half the codebase was removed from it. Anyone
quoting the number needs to know the exclusion list exists, which is an argument for keeping it
short and in one place.

## Interview questions

**★ What's the difference between excluding classes at the agent and at the report?**
The agent's `excludes` stop instrumentation, so no execution data is collected — but the report
still analyses the class files and shows those classes as fully uncovered, because as JaCoCo's FAQ
puts it, the generator cannot distinguish exclusion from non-execution. The report's `excludes`
remove the classes from the report and from the numbers. So if your goal is a fairer percentage you
want the report; the agent's excludes are for the rare case where a class must not be instrumented
at all, for instance because another bytecode transformer collides with it.

**★ What would you exclude from a coverage report, and what would you refuse to exclude?**
Generated code with its own upstream test suite — MapStruct implementations, protobuf classes,
OpenAPI stubs — and configuration classes whose bodies are pure wiring, and a `main` method that
only calls `SpringApplication.run`. I would refuse to exclude anything on the grounds that it is
hard to test, since that is a design finding rather than a reporting problem, and anything excluded
in response to a failing gate. DTOs are the arguable middle: a pure field holder is fine to
exclude, but excluding a whole entity type to remove its generated getters also hides its lifecycle
callbacks and computed properties.

**★ Your exclusion doesn't seem to be taking effect. What do you check?**
The pattern syntax first — JaCoCo takes class *file* patterns with slashes and a `.class` suffix,
so a dotted package expression matches nothing and reports no error. Then which `excludes` you
configured: an agent exclusion will not remove anything from the report, it will show it at 0%.
Then whether the same exclusion is applied to every place that computes a number — in Maven the
report and the check goal each have their own, and in Gradle the report task and the verification
task each need the `classDirectories` filter.

**★ How do you tell an honest exclusion from a dishonest one?**
Ask what a test of that code would tell you, and if the code were wrong, how you would find out.
If a test would only assert that the generator generated, or that the wiring is the wiring, the
exclusion is honest. If the answer to "how would we find out it was wrong" is "a customer would
tell us", it is not. Procedurally: an exclusion added in the same pull request that a gate started
failing is the one to look at, and every entry should carry a comment saying why.

**★ Why does a growing exclusion list matter more once you introduce a coverage gate?**
Because the gate creates a pressure and the exclusion list is the cheapest valve — a one-line diff
in build configuration, reviewed as config rather than as code. Without a gate, an exclusion is
usually genuine housekeeping. With one, it competes with writing tests and it wins on effort every
time. That is why the threshold and the exclusion list have to be reviewed as a single control
rather than separately.

{/* FOOTER */}
