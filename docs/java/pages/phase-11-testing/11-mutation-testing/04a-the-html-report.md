---
title: "The HTML report is three levels of generated page whose source templates tell you exactly what it can and cannot show: it collapses ten statuses into four CSS classes, it offers a covering-tests list only on survivors, it names the killing test for a mutant but never the whole set, and the Active mutators block at the bottom of each source page is the only place your real operator set is written down"
sidebar_label: "04a · The HTML report"
sidebar_position: 23
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest 1.30.0's HTML report source read at the `1.30.0` tag:
> `pitest-html-report/src/main/resources/templates/mutation/mutation_package_index.st`,
> `package_index.st`, `mutation_report.st` and `style.css`, plus
> `pitest-html-report/src/main/java/org/pitest/mutationtest/report/html/` —
> `MutationHtmlReportListener`, `LineStyle`, `LineStatus`, `ConfidenceMap` and `MutationTotals`.
> Output formats and directory behaviour from the
> [Maven quick start](https://pitest.org/quickstart/maven/) (`outputFormats`, `reportsDirectory`,
> `timestampedReports`, `verbose`) and the FAQ's *"Can I see the source code of the mutants?"* entry.
> CSV and XML shapes from `pitest-entry/.../report/csv/CSVReportListener.java` and
> `report/xml/XMLReportListener.java`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Everything below is read from pitest's published
> templates and source. **No screenshot, page, score or count on this page came from a run.**

**[04](04-reading-a-report.md) is the status vocabulary. This chunk is the artefact you actually read,
and the useful way to learn it is from the StringTemplate files pitest renders it with, because they
state precisely what the report contains and — more usefully — what it leaves out. Four things in those
templates change how you use the report: the colour scheme is four classes for ten statuses, the
covering-tests list is rendered only for survivors, the killing test is one name rather than a set, and
the bottom of every source page carries the only authoritative record of which mutation operators
actually ran.**

## Three levels of page

`MutationHtmlReportListener` writes exactly three kinds of file, from three templates:

| File | Template | Contents |
|---|---|---|
| `index.html` | `mutation_package_index.st` | Project summary, then a breakdown by package |
| `<package>/index.html` | `package_index.st` | Package summary, then a breakdown by class |
| `<package>/<SourceFile>.html` | `mutation_report.st` | The annotated source file |

plus a single `style.css` at the root. The default output is HTML only —

> *"outputFormats — List of formats in which to write mutation results as the mutations are analysed.
> Supported formats are HTML, XML, CSV. Defaults to HTML."*

— written under `reportsDirectory`, which for the Maven plugin defaults to `target/pit-reports`. Note
that the Maven `mutationCoverage` documentation says the report goes to
`target/pit-reports/YYYYMMDDHHMI` while the `timestampedReports` parameter is documented as
*"Defaults to false"*; if you are automating anything that reads the report, set `timestampedReports`
explicitly rather than relying on either statement.

## The three columns, on every summary page

Both index templates render the same three metrics side by side, and it is worth knowing that the
*fractions* are printed next to each bar because those are the numbers you should read:

| Column | Fraction printed | What it is |
|---|---|---|
| Line Coverage | covered lines / total lines | Ordinary line coverage, from pitest's own coverage pass |
| Mutation Coverage | detected / **total mutants** | The mutation score |
| Test Strength | detected / **mutants with coverage** | The score with uncovered mutants removed |

Three columns, two denominators. That difference is the single most useful thing on the page and it is
[04c](04c-the-score-arithmetic.md)'s subject; here it is enough to know that the report shows both and
that reading only the middle column is how a poorly covered project's report gets misread.

⚠️ The line-coverage column is conditional in the template — `$if(showCoverage)$` — and renders `n/a`
with a full-width bar when coverage data is unavailable. A full green bar labelled `n/a` is not 100%
coverage.

## The annotated source page

`mutation_report.st` renders each source line as three cells:

1. **The line number**, styled by `LineStyle.getLineCoverage()` — `covered`, `uncovered` or `na`.
2. **A mutant count**, linking down to the mutant list for that line, with a hover popup listing each
   mutant as `<index>. <location> : <description> → <status>`.
3. **The source text**, styled by both line coverage and mutation status.

Below the source, a *Mutations* section groups every mutant by line. Each entry shows the mutator's
human-readable description and its status, with a popup carrying **Location** and **Killed by**.

Two template details matter more than they look.

**The covering-tests list exists only for survivors.** The template guards it:

```
$if(mutation.survived)$
<a title="Click to view covering tests" class="view-covered-by-tests" ...>Covering tests</a>
<div class="covered-tests" ...>Covered by tests:
<ul>$mutation.coveringTests: { test | <li>$test$</li> }$</ul>
```

That is exactly the right design — on a survivor, "which tests ran and failed to notice" is the
question you have — and it means the page cannot answer that question for a killed mutant, or for a
`TIMED_OUT` one. It is also how you settle the ambiguity from
[03d2b](03d2b-reading-a-remove-conditionals-pair.md): a mutant that survived with **one** covering test
is a missing test; one that survived with **twelve** is a missing assertion.

**"Killed by" is one test, not the set.** Pitest stops at the first failure
([02](02-how-it-works.md)), so the recorded killing test is whichever ran first in
fastest-first-with-`FooTest`-weighted order. It is not "the test that owns this behaviour" and should
not be read as one. The full set needs `fullMutationMatrix`, which pitest documents as *"a partially
supported feature added due to demand from the research community"*.

## 🔴 The colour scheme collapses ten statuses into four

`LineStyle.getMutation()` is the whole of the mutation colouring logic:

```java
public String getMutation() {
  if (!this.line.detectionStatus().isPresent()) {
    return "";
  }
  final DetectionStatus status = this.line.detectionStatus().get();
  if (!status.isDetected()) {
    return "survived";
  }
  if (ConfidenceMap.hasHighConfidence(status)) {
    return "killed";
  } else {
    return "uncertain";
  }
}
```

and `ConfidenceMap`'s high-confidence set is four constants:

```java
private static final EnumSet<DetectionStatus> HIGH = EnumSet
    .of(DetectionStatus.KILLED,
        DetectionStatus.SURVIVED,
        DetectionStatus.NO_COVERAGE,
        DetectionStatus.NON_VIABLE);
```

So the CSS classes come out as:

| Rendered class | Statuses it represents | Colour in `style.css` |
|---|---|---|
| `killed` | `KILLED`, `NON_VIABLE` | pale green `#aaffaa` |
| `survived` | `SURVIVED`, `NO_COVERAGE` | pale red `#ffaaaa` |
| `uncertain` | `TIMED_OUT`, `MEMORY_ERROR`, `RUN_ERROR`, `EQUIVALENT` | pale blue-grey `#dde7ef` |
| `covered` / `uncovered` | line coverage, independently | pale green / pale red |

Three consequences.

**Green includes `NON_VIABLE`.** A mutant the JVM refused to load renders exactly like a mutant a test
killed. It is high-confidence in the sense that pitest is sure of the outcome, and it is not high
confidence that anything was tested.

**Red includes `NO_COVERAGE`.** The two findings that [04](04-reading-a-report.md) argues need opposite
responses are the same colour. The *Mutations* list underneath spells out the real status per mutant;
the line colouring does not.

**Blue-grey is "something is off".** `uncertain` is the visual marker for the three failure statuses,
and it is the fastest way to eyeball whether a run misbehaved — scan the source pages for blue-grey
before you read anything else ([04d](04d-the-statuses-that-are-not-findings.md)).

## The *Active mutators* block

Every source page ends with two lists, and the first one is the most under-appreciated element of the
whole report:

```
<h2>Active mutators</h2>
<ul>
$mutators : { mutator | <li class='mutator'>$mutator$</li> }$
</ul>

<h2>Tests examined</h2>
<ul>
$tests:{ test | <li>$test.name$ ($test.time$ ms)</li>}$
</ul>
```

**This is the only place your real operator set is written down.** The build file underdetermines it —
the string `DEFAULTS` and the implicit default set are different sets in 1.30.0
([03d](03d-optional-mutators.md)), filters remove whole categories before dispatch
([02b3](02b3-the-filter-inventory.md)), and any pitest plugin on the classpath can register additional
operators. If you intend to compare a mutation score with anything, archive this list beside the number.
The alternative is the console output with `verbose` enabled, which the Maven docs point at:
*"Available options are shown in the console output when verbose logging is enabled."*

*Tests examined* is the other half of the same idea: the tests pitest considered for that file, with the
per-test durations that feed the timeout formula ([02c](02c-timeouts-and-determinism.md)).

What the HTML report **cannot** show — the mutated source, a machine-readable form, and any comparison
with a previous run — and what the XML and CSV formats give you instead, is
[04a2](04a2-the-other-output-formats.md).

## Where this connects

- **[04 · Reading a report](04-reading-a-report.md)** — the ten statuses this page renders as four colours.
- **[04c · The score arithmetic](04c-the-score-arithmetic.md)** — the three summary columns and the two denominators behind them.
- **[04d · The statuses that are not findings](04d-the-statuses-that-are-not-findings.md)** — what blue-grey means and what to do about it.
- **[03d · Optional mutators](03d-optional-mutators.md)** — why the *Active mutators* list is authoritative and the build file is not.
- **[02c · Timeouts and determinism](02c-timeouts-and-determinism.md)** — the per-test durations in *Tests examined* are the inputs to the timeout formula.
- **[02 · How it works](02-how-it-works.md)** — first-failure exit, which is why "Killed by" names one test.
- **[09 · Coverage with JaCoCo](../09-jacoco/README.md)** — the line-coverage column here comes from pitest's own coverage pass, not from JaCoCo, and the two can disagree.

## Gotchas

**★ Green in the report includes `NON_VIABLE`, and red includes `NO_COVERAGE`.**
`LineStyle` maps anything detected-and-high-confidence to `killed` and anything not detected to
`survived`, and `ConfidenceMap`'s high-confidence set contains `NON_VIABLE`. So a mutant the JVM refused
to load is the same green as one a test killed, and a line nobody tests is the same red as one whose
assertions are too weak. The per-mutant list below the source is where the real statuses are.

**★ Blue-grey means the run misbehaved, and it is the first thing to scan for.**
`uncertain` covers `TIMED_OUT`, `MEMORY_ERROR`, `RUN_ERROR` and `EQUIVALENT` — every status whose
meaning pitest itself hedges. A source page with blue-grey on it is a page whose numbers you should not
quote until you know why.

**★ The covering-tests list is rendered only for survivors.**
The template guards it with `$if(mutation.survived)$`. That is the right choice, and it means you cannot
use the report to ask "which tests ran against this killed mutant". It also makes the survivor list far
more useful than it first appears: one covering test means you are missing a test, a dozen means you are
missing an assertion.

**★ "Killed by" is the first test that failed, not the test that owns the behaviour.**
Pitest orders covering tests fastest-first with `FooTest`-named classes weighted up, and stops at the
first failure. So the recorded killing test is partly an artefact of measured durations, and it can
change between runs on the same commit. Do not use it to attribute behaviour to a test.

**★ The *Active mutators* list is the only authoritative record of what ran.**
Between the `DEFAULTS`-group divergence, the filters and any plugin-supplied operators, your build file
does not determine your operator set. Archive this block, or the `verbose` console output, alongside any
score you intend to compare with a later one. A mutation score quoted without its operator set is not
reproducible.

**★ A green `n/a` bar in the line-coverage column is not 100% coverage.**
The index templates render `$if(showCoverage)$ ... $else$` a full-width bar with the legend `n/a`. It
looks exactly like a complete bar. Read the legend, not the bar.

**★ The report directory may or may not be timestamped, and the docs say both things.**
The `mutationCoverage` goal's description says output goes to `target/pit-reports/YYYYMMDDHHMI`; the
`timestampedReports` parameter says *"Defaults to false"*. Rather than depend on either, set the
parameter explicitly — anything in CI that publishes or diffs the report needs a stable path.

## Interview questions

**★ Walk me through what you look at first when you open a PIT HTML report.**
Not the headline percentage. First, the three columns on the index page together — line coverage,
mutation coverage and test strength — because mutation coverage and test strength have different
denominators and the gap between them is the size of the uncovered-mutant problem. Then the per-class
breakdown, to find where the interesting code is, because a project-wide number averages a pricing
engine with a package of `record`s. Then one class's source page: scan for blue-grey first, which means
`TIMED_OUT`, `RUN_ERROR` or `MEMORY_ERROR` and tells me the run itself misbehaved; then read the
*Mutations* list, not the line colours, because green includes `NON_VIABLE` and red includes
`NO_COVERAGE`. Finally the *Active mutators* block at the bottom, so I know which operator set produced
everything above it.

**★ A survivor's popup shows one covering test. Another shows fifteen. Are those the same finding?**
No, and the covering-tests list — which pitest renders only for survivors — is what separates them. One
covering test means the line is reached by a single test that probably exercises one path through it:
the likely fix is another test, for the case nobody drives. Fifteen covering tests means the code is
exercised from every direction and still nothing distinguishes the mutant: that is a missing or weak
assertion, and often a signal that the fifteen are integration-style tests dragging the class through
their call path while asserting on something else entirely. The action differs, and so does the cost —
the fifteen-test survivor is also fifteen full test runs per mutant, which is where the run time went.

**★ How do you find out which mutation operators produced a given report?**
Two places, both authoritative and neither of them the build file: the console output with `verbose`
enabled, which the Maven documentation says lists the available and active options, and the *Active
mutators* block that `mutation_report.st` renders at the bottom of every annotated source page. You need
one of them because the configuration underdetermines the answer — the string `DEFAULTS` and the
implicit default set are different sets in 1.30.0, filters remove whole categories of mutant before
anything runs, and any pitest plugin on the classpath registers additional operators and changes what
`ALL` resolves to. If a score is going to be compared with a later one, that list is part of the record.

{/* FOOTER */}
