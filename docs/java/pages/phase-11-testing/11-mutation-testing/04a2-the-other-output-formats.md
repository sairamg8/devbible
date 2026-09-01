---
title: "The HTML report is for a person and cannot be parsed, the CSV is seven positional fields with no header row, and the XML is the only format carrying the per-mutant cost figure — and none of the three can show you mutated source or compare two runs, which is the gap the commercial plugin exists to fill"
sidebar_label: "04a2 · XML, CSV and the gaps"
sidebar_position: 24
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest 1.30.0 source read at the `1.30.0` tag:
> `pitest-entry/src/main/java/org/pitest/mutationtest/report/csv/CSVReportListener.java` and
> `report/xml/XMLReportListener.java` (including its `Tag` enum and `makeMutationAttributes`), plus
> `pitest-entry/src/main/resources/META-INF/services/org.pitest.mutationtest.MutationResultListenerFactory`.
> Format and aggregation behaviour from the
> [Maven quick start](https://pitest.org/quickstart/maven/) (`outputFormats`, `fullMutationMatrix`,
> `exportLineCoverage`, the *Reporting Goal* section), the
> [Advanced usage](https://pitest.org/quickstart/advanced/) page's *Mutation Result Listener* section,
> and the [FAQ](https://pitest.org/faq/) entries *"Can I see the source code of the mutants?"* and
> *"How can I combine all the reports for a project with multiple modules into a single report?"*.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Field lists and element names are read from pitest's
> published source. **No report file, row or value on this page came from a run.**

**[04a](04a-the-html-report.md) is the report a person reads. This chunk is everything that report
cannot do and what to reach for instead: the two machine-readable formats and their exact shapes, the
one field that exists in only one of them, and the three things no open-source pitest output can give
you — mutated source, a comparison with yesterday, and any notion of a diff. Knowing which gap is a
design decision and which is a commercial upsell matters before you plan a CI integration around it.**

## `outputFormats`, and what each one writes

> *"outputFormats — List of formats in which to write mutation results as the mutations are analysed.
> Supported formats are HTML, XML, CSV. Defaults to HTML."*

```xml
<configuration>
  <outputFormats>
    <outputFormat>HTML</outputFormat>
    <outputFormat>XML</outputFormat>
  </outputFormats>
</configuration>
```

Each format is a `MutationResultListener` registered through `META-INF/services`, which is the same
extension point a plugin uses. From the *Advanced usage* page:

> *"Multiple result listeners may be supplied. Each listener must provide a unique name, to enable a
> listener the user must include the name in the outputFormats config parameter."*

So the list is open-ended: a plugin's listener appears in it under whatever name the plugin registers,
and a name that is not registered is simply not written. There is no error for asking for a format
nobody supplies.

## The CSV: `mutations.csv`, seven positional fields, no header

`CSVReportListener` writes one line per mutant, comma-separated, from exactly these calls:

```java
this.out.write(makeCsv(mutation.getDetails().getFilename(), mutation
    .getDetails().getClassName().asJavaName(), mutation.getDetails()
    .getMutator(), mutation.getDetails().getMethod(), mutation
    .getDetails().getLineNumber(), mutation.getStatus(),
    createKillingTestDesc(mutation.getKillingTest()))
    + System.getProperty("line.separator"));
```

| # | Field |
|---|---|
| 1 | Source file name |
| 2 | Class name, in Java form |
| 3 | Mutator |
| 4 | Method |
| 5 | Line number |
| 6 | Status |
| 7 | Killing test, or the literal `none` |

Three things to know before you build anything on it. There is **no header row** — nothing labels the
columns, so a consumer hard-codes the order against a pitest version. The killing test is escaped with
`StringEscapeUtils.escapeCsv` and the other six fields are not, so a class or method name containing a
comma would produce a malformed row (unlikely in Java, not impossible in generated or Kotlin code). And
the line separator is `System.getProperty("line.separator")`, so a file written on Windows and parsed on
Linux carries `\r`.

## The XML: `mutations.xml`, and the field that exists nowhere else

`XMLReportListener` writes one `mutation` element per mutant. The attributes come from
`makeMutationAttributes`:

```java
return "detected='" + result.getStatus().isDetected() + "' status='"
    + result.getStatus() + "' numberOfTestsRun='"
    + result.getNumberOfTestsRun() + "'";
```

and the child elements from the listener's `Tag` enum: `sourceFile`, `mutatedClass`, `mutatedMethod`,
`methodDescription`, `lineNumber`, `mutator`, `indexes`/`index`, `blocks`/`block`, `killingTest` and
`description`.

🔴 **`numberOfTestsRun` is in the XML and in neither the CSV nor the HTML.** It is the per-mutant cost
figure — how many covering tests actually ran before pitest stopped — and it is the only place in any
output where the run's time is attributed to individual mutants. If the question is "why does this take
forty minutes", this attribute answers it and nothing else does ([06 · The cost](06-the-cost.md)). It is
also the direct evidence for the claim that survivors are the expensive case: a killed mutant stops at
the first failure, a survivor runs them all.

Note also that `detected` is written as an attribute alongside `status`, which means the XML is the one
format that hands you pitest's own detected/not-detected classification rather than making you
reconstruct it from the status name — the distinction [04](04-reading-a-report.md) is built around.

**`fullMutationMatrix` changes the XML and only the XML.** With it enabled, `killingTest` is replaced by
`killingTests`, `succeedingTests` and `coveringTests` elements, each a `|`-separated list
(`MUTATION_MATRIX_TEST_SEPARATOR`). The documented cost is severe:

> *"When set to true causes pitest to continue processing after a test fails and record addition failing
> tests when XML output is enabled. This is a partially supported feature added due to demand from the
> research community. Other pitest features are not guaranteed to work correctly when it is enabled."*

It removes the first-failure exit, so every covering test runs against every mutant. Use it for one
investigation, never as a setting.

## The three things no format gives you

**Mutated source.** From the FAQ:

> *"Pitest mutates bytecode. It does not produce mutated source code, so is not able to display it. In
> theory, it is possible to generate source code from the mutated bytecode using a decompiler, but in
> practice, the results are poor for anything other than very simplistic code."*

What every format gives you instead is the original line plus the mutator's description. That is usually
readable as a source edit and occasionally is not — the `MATH` mutation of `this.i++` to
`this.i = this.i - 1` is the standard example ([03b](03b-arithmetic-mutators.md)). The nearest thing to
an escape hatch is the `EXPORT` feature, which writes the mutated **class files** into the report
directory ([02b3](02b3-the-filter-inventory.md)) — bytecode, not source, and off by default.

**A comparison with the previous run.** Every output is a snapshot. Nothing in the open-source tool
diffs two reports, and the history file used by incremental analysis is an optimisation input rather
than a report ([05c](05c-scoping-and-incremental.md)). Tracking a score over time is your CI's problem,
and doing it correctly means recording the operator set and pitest version beside each number
([04a](04a-the-html-report.md)'s *Active mutators* block).

**Any notion of a diff.** Pitest's scoping tools are class-name globs. Restricting analysis to lines
changed between two refs is arcmutate's `+GIT(from[HEAD~1])` feature, which the Maven quick start itself
describes as *"arcmutate's git integration"* ([01b](01b-the-tool-and-its-versions.md)). Plan a
pull-request integration against the free feature set unless someone has bought a licence.

## Multi-module aggregation

There are two separate mechanisms and they are easy to confuse.

**The `report` goal** is a Maven *site* report. Its documentation is explicit about the prerequisite:
the `mutationCoverage` goal must already have run and produced HTML, and *"The report goal then copies
the latest HTML report to the site directory."* It aggregates nothing; it relocates one report.

**Report aggregation across modules** is the FAQ's *"How can I combine all the reports for a project
with multiple modules into a single report?"* entry, and it needs XML rather than HTML plus
`exportLineCoverage`. The Gradle plugin's own README shows the same requirement — `outputFormats =
["XML"]`, `exportLineCoverage = true`, `timestampedReports = false` — before its `pitestReportAggregate`
task will work ([05b · Gradle](05b-gradle.md)).

⚠️ And the caveat from the `crossModule` documentation applies to both: if one class is analysed in
several modules, *"If report aggregation is used without ensuring that each class is reported only once,
the results are undefined."*

## Where this connects

- **[04a · The HTML report](04a-the-html-report.md)** — the report a person reads, and the *Active mutators* block that belongs beside any exported number.
- **[04 · Reading a report](04-reading-a-report.md)** — the statuses that appear in the `status` field of every format.
- **[04c · The score arithmetic](04c-the-score-arithmetic.md)** — what to compute from an exported file, and what pitest computes itself.
- **[02 · How it works](02-how-it-works.md)** — first-failure exit, which is what `numberOfTestsRun` measures and what `fullMutationMatrix` disables.
- **[05c · Scoping and incremental analysis](05c-scoping-and-incremental.md)** — the history file, which is not a report.
- **[05b · Gradle](05b-gradle.md)** — `pitestReportAggregate` and the settings it requires.
- **[01b · The tool and its versions](01b-the-tool-and-its-versions.md)** — arcmutate, and which "pitest features" from blog posts are actually commercial.

## Gotchas

**★ `numberOfTestsRun` exists in the XML report and nowhere else.**
`XMLReportListener` writes it as an attribute on every `mutation` element; the CSV listener's seven
fields do not include it and neither does the HTML. It is the per-mutant cost figure, so if the question
is "where did the run time go", XML is the only format that answers it
([06 · The cost](06-the-cost.md)).

**★ The CSV has no header row and seven positional fields.**
`CSVReportListener` writes file name, class name, mutator, method, line number, status and killing test
— the last being the literal string `none` when there is no killing test. Nothing labels the columns, so
anything consuming the file has to hard-code the order, and the order is a property of the pitest
version you are running.

**★ Only one of the CSV's seven fields is escaped.**
`createKillingTestDesc` runs the killing test through `StringEscapeUtils.escapeCsv`; the file name,
class, mutator, method, line and status are written raw. Java identifiers will not contain commas, but
generated names, Kotlin function names with spaces and parameterised test display names can, and the
row is then malformed with no warning.

**★ You cannot see the mutated source in any format.**
The FAQ says decompiling gives poor results and pitest does not attempt it. When a mutator description
does not read as a plausible source edit, the answer is in the bytecode the compiler produced, not in
the report: a field increment mutated by `MATH`, a `finally` block duplicated across exit paths, a
`record`'s generated method. The `EXPORT` feature dumps mutated **class files** into the report
directory, which is a different thing and rarely what anyone wanted.

**★ `fullMutationMatrix` silently does nothing unless XML output is enabled.**
The parameter's documentation says it records the additional failing tests *"when XML output is
enabled"*. Turning it on with the default HTML-only output pays the full cost — every covering test runs
against every mutant, because the first-failure exit is gone — and produces no extra information
anywhere.

**★ An unrecognised name in `outputFormats` is not an error.**
Formats are `MutationResultListener` plugins resolved by name through `META-INF/services`. Asking for a
format no listener provides simply produces no such file. A typo, or a listener that used to come from a
plugin you removed, therefore shows up as a missing report rather than a failed build.

**★ The site `report` goal aggregates nothing.**
It is a Maven site report that copies the latest HTML output into the site directory, and its
documentation says the `mutationCoverage` goal must already have produced HTML for it to work. If
multiple timestamped reports exist it takes the most recent. Multi-module aggregation is a different
mechanism that needs XML and `exportLineCoverage`.

**★ Aggregating a class that was analysed in two modules gives undefined results.**
Pitest's `crossModule` documentation says so directly: *"If report aggregation is used without ensuring
that each class is reported only once, the results are undefined."* Cross-module analysis and report
aggregation are individually reasonable and combine badly unless the `targetClasses` globs guarantee
each class is mutated in exactly one module.

**★ No pitest output compares two runs, and the git-aware version is commercial.**
Every format is a snapshot. The history file is an optimisation input, not a report. Restricting
analysis to changed lines is arcmutate's git integration, which the Maven quick start names as such.
Design your CI story around globs and a history file, or around a licence — but decide which before you
promise anyone pull-request comments.

## Interview questions

**★ You need mutation results in a dashboard. Which output format and why?**
XML, via `outputFormats`. The HTML is a report for a person and is not parseable in any stable way; the
CSV is seven positional fields with no header row, so a consumer has to hard-code column order against a
pitest version and only one of those fields is escaped. The XML gives each mutant an element with
`detected`, `status` and `numberOfTestsRun` attributes plus child elements for source file, class,
method, method descriptor, line, mutator, indexes, blocks, killing test and description — enough to
reconstruct the report, attribute findings to classes, and see where the run time went, which
`numberOfTestsRun` is the only field anywhere that tells you. I would also record the active mutator set
and the pitest version alongside it, because the numbers mean nothing without them.

**★ Why can't the report show you the mutated source, and does it matter?**
Because pitest mutates bytecode and never produces mutated source — its FAQ says generating it back with
a decompiler gives *"poor"* results for anything non-trivial, so it does not try. What you get instead is
the original line plus a human-readable description of the operator that fired. That is usually enough
and occasionally misleading, and the cases where it misleads are exactly the ones where the compiler
produced something you did not write: a member-variable `i++` mutated by `MATH` into
`this.i = this.i - 1`, a `finally` block whose contents were copied to every exit path so one source
line carries several identical-looking mutants, or a generated `record` method. When a description does
not read as a plausible edit, the explanation is in the bytecode rather than in the report.

**★ How would you work out which mutants are costing you the most run time?**
Export XML and sum `numberOfTestsRun` per class. It is the only figure pitest publishes that attributes
runtime to individual mutants, and it makes the topic's central cost claim concrete: a killed mutant
stops at the first failing test, so its count is small; a survivor runs every covering test to
completion, so its count equals the number of covering tests. The classes at the top of that list are
the ones with weak assertions *and* slow covering tests — usually a domain class whose only coverage
comes from `@SpringBootTest` or Testcontainers tests, which is the case
[05 · The test pyramid](../05-the-test-pyramid/README.md) says to fix with unit tests rather than with a
pitest setting.

**★ Someone asks for mutation testing on pull requests, restricted to the changed lines. What do you tell them?**
That the open-source tool has no notion of a diff, so it cannot do exactly that. Its scoping instruments
are class-name globs and an incremental history file, which together get you "analyse the classes in
these packages, reusing results where nothing relevant changed" — useful, and not the same thing. Line-
level, git-aware scoping is arcmutate's `GIT` feature, which pitest's own Maven quick start describes as
*"arcmutate's git integration"*, and arcmutate is licensed software with free licences for open-source
projects. The honest plan is either a narrow glob plus a history file in CI, or a licence — and the
decision should be made before anyone is promised per-PR comments.

**★ A team enables `fullMutationMatrix` to find out which tests kill which mutants and the build gets much slower with no new information. What went wrong?**
Two things, both documented. The feature records the extra failing tests *"when XML output is enabled"*,
so with the default HTML-only `outputFormats` there is nowhere for the additional data to go. And it
disables pitest's first-failure exit, which is one of the four decisions that make the tool usable at
all — every covering test now runs against every mutant instead of stopping at the first failure, so the
run cost approaches the worst case for every mutant rather than only for survivors. The documentation
also warns that *"Other pitest features are not guaranteed to work correctly when it is enabled"*, which
is the reason to treat it as a one-off investigation with XML turned on, not as a build setting.

{/* FOOTER */}
