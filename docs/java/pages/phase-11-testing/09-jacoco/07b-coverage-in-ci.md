---
title: "Coverage in CI: the HTML report nobody opens, the XML nobody enables, and the one form of the metric that survives every objection in this topic — coverage on the change rather than on the repository"
sidebar_label: "07b · Coverage in CI"
sidebar_position: 21
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `report-mojo.html` (formats, output directory)
> and `check-mojo.html` (`haltOnFailure`, `jacoco.skip`), and the **Gradle user manual**'s JaCoCo
> page for the `reports` block. Version spine from `spring-boot-dependencies:4.1.0`: JDK 25,
> Spring Boot 4.1.0, JUnit Jupiter 6.0.3.
> ⚠️ **No build, no CI and no test runs on this machine.** No specific CI product's configuration
> is quoted, because none was verified — the shapes below are described generically and you should
> check your platform's own documentation for exact syntax.

**Most projects have coverage in CI in the sense that a report is generated and archived somewhere
nobody looks. That is not using coverage; it is paying for it. The version that pays for itself is
narrow and specific: the report reaches the pull request, it talks about the lines in *this diff*,
and the build asserts that the measurement happened at all. Everything else in this topic has been
about the limits of the number — this chunk is about the one deployment where it is genuinely
useful.**

## Why the archived HTML report is close to worthless

It is generated on every build, uploaded as an artifact, and opened by nobody — because opening it
requires knowing it exists, finding the build, downloading a zip and browsing a frame-based site to
find the class you care about. By then the reviewer has approved the pull request.

The report is a good product. Its delivery is the problem: **it arrives in a place nobody is
standing.** The fix is not a better report, it is putting the finding where the decision is made.

## Turn on XML — it is what everything else consumes

The HTML is for humans; the **XML is the integration surface**. Every CI coverage integration, PR
annotator and trend dashboard reads it, and in Gradle it is off by default:

```kotlin
tasks.jacocoTestReport {
    reports {
        xml.required = true      // 🔴 the one that matters
        html.required = true     // still useful for the drill-down
        csv.required = false
    }
}
```

Maven's `report` goal produces all three formats by default, so there is nothing to enable — but
if someone has narrowed `<formats>`, XML is the one to keep.

## The thing to build first: assert the measurement happened

Before any threshold, add the check that catches every broken-pipeline failure in this topic:

- **`jacoco.exec` exists and is non-trivial in size.** Catches the agent never attaching — the
  argLine trap ([chunk 02b](02b-the-argline-trap.md)) — and a test JVM killed before writing.
- **Total covered instructions are greater than zero.** Catches a class id mismatch across the
  board ([chunk 06c](06c-the-zero-percent-class.md)) and a report generated over the wrong
  classes.

This matters because **a threshold does not reliably catch these.** Some rule formulations pass
vacuously when there is no data to evaluate, so the build goes green with zero coverage and a gate
that believes it is protecting you. The measurement assertion is a handful of lines, has no policy
attached, and never produces a false positive.

## Coverage on the change

This is the recommendation the whole topic has been building toward.

"The repository is at 74%" is not actionable, is not comparable, moves for reasons unrelated to
testing ([chunk 05c](05c-what-jacoco-filters-for-free.md)), and invites every gaming pattern in
[chunk 04b](04b-the-eighty-percent-ritual.md). "**Eleven of the forty lines you added were not
executed by any test, here they are**" is a different kind of statement:

- **It is actionable.** It names lines, in the diff, in front of the person who wrote them.
- **It is fair to legacy code.** It asks nothing about the 200,000 lines nobody is touching, so it
  can be introduced to any codebase on day one without a remediation project.
- **It resists the gaming patterns.** Adding assertion-free tests to satisfy it is still possible,
  but it is visible in the same review as the code, which is where that conversation belongs.
- **It does not need a ratchet.** The number is per-change, so there is no stored high-water mark
  to defeat ([chunk 04c](04c-the-ratchet.md)).

Mechanically, a per-change report is the intersection of the diff's added lines with the coverage
XML. Most CI platforms and code-review integrations offer this; ⚠️ **the specific product names
and configuration were not verified for this page**, so check your platform's documentation rather
than trusting a remembered snippet.

⚠️ **One caveat to state to your team when you introduce it:** per-change coverage is a *line*
measurement in practice, because a diff is lines. It therefore inherits every weakness of line
coverage from [chunk 03c](03c-line-coverage-needs-debug-info.md) — including that a compound
condition on one added line reads as covered when a fraction of it ran. It is the best deployment
of the metric, not an escape from the metric's nature.

## Where the gate belongs

Assuming you have decided on a floor rather than a target ([chunk 04a](04a-floor-or-target.md)):

- **Run `report` on every build**, including feature branches. It is cheap and it is what feeds
  the PR annotation.
- **Run `check` on the pull request**, so it blocks the merge rather than breaking the main branch
  after the fact. A gate that fires after merge is a gate that produces an incident ticket.
- **Do not gate feature branches mid-flight.** Failing a developer's build on coverage while they
  are still writing the tests trains them to disable it.
- **`jacoco.skip=true` for a fast local loop** is fine and should be documented, so people
  disable it deliberately rather than inventing their own way around it.

⚠️ And beware the asymmetry that creates a false sense of safety: if `jacoco.skip` is wired into
a general "skip tests" convenience property, the gate silently never evaluates. Combined with a
green build, that is a gate everyone believes in and nobody has.

## Trends, honestly

If a trend chart is required:

- **Chart branch coverage**, not instruction or line — least sensitive to the branchless code and
  formatting that move the others.
- **Annotate every JaCoCo upgrade on the chart.** Filters arrive in releases and shift the
  denominator, so those steps are tooling changes, not team performance
  ([chunk 05c](05c-what-jacoco-filters-for-free.md)).
- **Publish the counter and the exclusion list next to the number.** A percentage travels further
  than its caveats, and once "we're at 82%" is in a slide it has become a quality claim.
- **Chart the count of classes at 0% too.** It is the one figure in the whole report that means
  exactly what it appears to mean.

## Where this connects

- **[02b · The argLine trap](02b-the-argline-trap.md)** — the failure the measurement assertion
  catches.
- **[06c · The class that reads 0%](06c-the-zero-percent-class.md)** — the other failures it
  catches.
- **[04a · Floor or target](04a-floor-or-target.md)** — what the gate should be.
- **[04c · The ratchet](04c-the-ratchet.md)** — why per-change coverage removes the need for one.
- **[08 · The checklist](08-the-checklist.md)** — reading a report usefully, once it reaches you.

## Gotchas

**★ An archived HTML report is a cost, not a control.**
It is generated every build and opened by nobody, because reaching it takes more steps than the
reviewer has patience for. If coverage is not visible in the pull request, assume it is not
informing any decision, and either put it there or stop paying for the upload.

**★ Gradle does not enable the XML report by default, and XML is what every integration reads.**
`xml.required = true`. Teams wire up a coverage integration, see nothing, and conclude the
integration is broken. Maven produces all three formats by default, so this is a Gradle-specific
trap.

**★ A threshold does not reliably catch a broken measurement pipeline.**
With no execution data, some rule formulations have nothing to evaluate and pass. The build is
green, coverage is zero, and the gate reports success. Asserting that the exec file exists and that
covered instructions are non-zero is a separate, policy-free check that catches every variant.

**★ `jacoco.skip` wired into a general skip-tests property silently disarms the gate.**
A convenience flag for fast local builds propagates into a CI profile, `check` never evaluates, and
nothing in the output says so. This is the same class of failure as Gradle's missing `dependsOn`,
arrived at from the other direction.

**★ Per-change coverage is line-based, so it inherits line coverage's weaknesses.**
A diff is lines, so the intersection is a line measurement — and a compound condition on one added
line reads as covered when any part of it ran. It is the best deployment of the metric, not a
different metric. Say so when introducing it, or someone will over-claim for it later.

**★ Gating the main branch instead of the pull request means the gate fires after the merge.**
By then the change is in, the author has moved on, and fixing it is a new piece of work with its
own ticket. Run `check` where it can still block something.

**★ Failing a developer's feature-branch build on coverage teaches them to disable coverage.**
Mid-flight branches legitimately have code without tests yet. A gate that fires there is noise, and
the rational response to noise is to silence it — usually by adding an exclusion that then
outlives the branch.

**★ A trend chart without JaCoCo-version annotations attributes tooling changes to the team.**
Filters landing in a release shift the denominator, sometimes noticeably — the Kotlin cluster in
0.8.14, records in 0.8.6. An unannotated step in the chart will be read as a quarter where
something happened, and someone will be asked to explain it.

**★ The count of classes at 0% is the most honest number you can publish, and almost nobody publishes it.**
It means exactly what it appears to mean, it is not gameable by assertion-free tests, and it goes
down only when someone tests or deletes something. It is a better headline metric than a
percentage and it is available in every report already.

**★ Uploading the report is not the same as anyone being able to read it.**
Frame-based HTML in a build artifact, behind a login, several clicks deep. If the goal is that a
reviewer sees uncovered lines, the delivery mechanism has to be the review tool, not the artifact
store.

## Interview questions

**★ How should coverage appear in CI?**
As a comment or annotation on the pull request naming the uncovered lines in that diff, not as an
archived HTML report nobody opens. Enable the XML report, since that is what every integration
consumes and Gradle leaves it off by default. And before any threshold, assert that the measurement
actually happened — that the exec file exists and that covered instructions are non-zero — because
a broken pipeline produces a green build that a threshold may not catch.

**★ Why is per-change coverage better than repository coverage?**
Because it is actionable and fair. It names specific lines in the diff in front of the person who
wrote them, rather than producing a repository percentage nobody can act on. It asks nothing about
untouched legacy code, so it can be introduced anywhere immediately without a remediation project.
And it needs no stored high-water mark, so it avoids the ratchet's failure modes entirely. The
caveat is that it is line-based, since a diff is lines, so it inherits line coverage's weaknesses.

**★ What would you check in CI before setting any coverage threshold?**
That coverage is being measured at all: the execution data file exists and is non-trivial, and the
report's total covered instructions are greater than zero. Those two checks catch the agent never
attaching, a killed test JVM, and a class id mismatch — all of which produce a green build with a
zero or absent report. A threshold is not a substitute, because with no data to evaluate, some rule
formulations pass vacuously.

**★ What's the most honest coverage number to put on a dashboard?**
The count of classes at 0%. It means exactly what it appears to mean, it cannot be moved by
assertion-free tests, and it only improves when someone genuinely tests or deletes something. A
percentage requires its counter, exclusion list, JaCoCo version and merge policy to be interpreted,
and none of those travel with it once it is in a slide.

**★ Where in the pipeline should the coverage gate run?**
On the pull request, so it can block a merge, rather than on the main branch where it fires after
the change has landed and produces a ticket instead of a fix. Not on feature branches mid-flight,
because failing a build for code whose tests are not written yet trains people to disable it. And
watch for `jacoco.skip` being wired into a general skip-tests convenience property, which disarms
the gate silently while the build stays green.

{/* FOOTER */}
