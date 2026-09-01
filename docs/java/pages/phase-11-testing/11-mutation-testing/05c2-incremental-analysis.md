---
title: "PIT's incremental analysis skips work it can infer from a history file, and its own documentation says four of the five optimisations introduce potential error because the tool only tracks super classes and outer classes when deciding whether a class's behaviour changed — so a report produced with history contains statuses that were never measured, and nothing in the output says which"
sidebar_label: "05c2 · Incremental analysis"
sidebar_position: 36
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest's
> [Incremental analysis](https://pitest.org/quickstart/incremental_analysis/) page — all five
> optimisations, the dependency caveat, the parameter list and the `withHistory` warning, quoted
> verbatim — the [Maven quick start](https://pitest.org/quickstart/maven/) entries for
> `historyInputFile`, `historyOutputFile`, `withHistory` and `extraFeatures`, the
> [command line quick start](https://pitest.org/quickstart/commandline/) for
> `--historyInputLocation`/`--historyOutputLocation`, and the [FAQ](https://pitest.org/faq/) entry
> *"PIT is taking forever to run"*. Gradle equivalents from `PitestPluginExtension.groovy` on the
> gradle-pitest-plugin `master` branch (`historyInputLocation`, `historyOutputLocation`,
> `enableDefaultIncrementalAnalysis`, `setWithHistory`).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Behaviour is read from pitest's documentation and the
> plugins' source. **No timing, speed-up figure or run outcome on this page came from executing
> anything.**

**[05c](05c-scoping-and-incremental.md) is the instrument that makes a run smaller. This is the one that
makes it *skip* — and it is the most intellectually honest feature page pitest has, because it enumerates
the five inferences it makes and then tells you that four of them can be wrong. Understanding exactly why
they can be wrong is what tells you where a history file belongs: in a developer's inner loop and a fast
CI signal, and not behind a published number or a gate.**

## What it does

> *"PIT contains an experimental feature to enable its use on very large codebases - incremental
> analysis."*

> *"If this option is activated, PIT will track changes to the code and tests and store the results from
> previous runs. It will then use this information to avoid re-running analysis when the results can be
> logically inferred."*

The five optimisations, verbatim:

> *"If an infinite loop was detected in the last run, and the class has not changed then it can be assumed
> that this mutation still results in an infinite loop."*

> *"If a mutation was killed in the last run and neither the class under test or the killing test has
> changed, then it can be assumed that this mutation is still killed."*

> *"If a mutation survived in the last run, no new tests cover it, and none of the covering tests have
> changed, then it must still survive."*

> *"If a mutation was previously killed, but the class or killing test has changed then it is likely that
> the last killing test will still kill it and it should therefore be prioritised above others. (since
> 1.14.4)"*

> *"If a number of mutations for a class previously survived, but the class has changed then it is likely
> that these mutations will still survive. If they are enabled simultaneously and can not be killed as a
> single meta mutant then the mutations need not be analysed individually. (not yet implemented)"*

Note the two annotations pitest attached itself: optimisation 4 is *"(since 1.14.4)"* and optimisation 5
is *"(not yet implemented)"*. So on 1.30.0 there are four active inferences and one ordering hint.

## 🔴 The honesty of that page

Pitest then says something almost no tool says about its own feature:

> *"With the exception of 4), all these optimisations introduce a degree of potential error into the
> analysis."*

and explains exactly why:

> *"The main issue is that class behaviour is defined not only by its bytecode, but also by its
> dependencies (i.e the classes it interacts with and the graph of classes that they interact with). PIT
> will only consider the strongest of these dependencies - changes to super classes and outer classes,
> when deciding if a class's behaviour might have changed."*

> *"So the incremental feature is based on the assumption that it will be relatively rare for changes in
> the dependencies of a class to change the status of a mutation. Although this assumption seems
> reasonable, it is currently unproven."*

and, on the unimplemented fifth:

> *"Optimisation 5) carries the additional risk that the mutations within the meta mutant might cancel
> each other out, leaving the behaviour of the class unchanged. Again it seems likely that this would be
> rare but this has not been quantified."*

**Notice which optimisation is exempt.** Number 4 — prioritising the previous killing test — changes what
pitest *tries first*, not what it *concludes*, so it cannot be wrong; the mutant is still run. Every other
inference substitutes a conclusion for a measurement.

## What that means concretely

A concrete failure of the assumption is easy to state. `PricingService` has a `MATH` mutant that was
killed last run by `PricingServiceTest`. Neither file changes. But `Money.multiply` — a collaborator that
is neither a super class nor an outer class — gains a rounding-mode change. The mutant's status may now
be different and pitest will not re-run it, because both of the classes it tracks are unchanged.

That is not a bug; it is the documented boundary of what pitest tracks, and it is the reason the page calls the underlying assumption *"currently unproven"*. Two practical consequences.

**A report produced with a history file contains statuses that were not measured in that run.** Nothing
in the HTML, the XML or the CSV distinguishes an inferred status from a measured one
([04](04-reading-a-report.md), [04a2](04a2-the-other-output-formats.md)). "This mutant is killed" may be
a statement about last week.

**It interacts badly with a gate.** A `mutationThreshold` or `maxSurviving` compared against a partly
inferred report is comparing against a measurement that was never made for every part of the codebase
that did not change ([04c2](04c2-thresholds-and-gates.md)). If you gate, gate on a full run.

## Turning it on

Two parameters, or one convenience switch:

> *"historyInputFile — Path to a file containing history information for incremental analysis."*

> *"historyOutputFile — Path to write history information for incremental analysis. May be the same as
> historyInputFile."*

> *"withHistory — Sets the history input and output files to point a project specific file within the
> temp directory. This is a convenient way of using history files to speed up local analysis."*

```
mvn -DwithHistory test-compile org.pitest:pitest-maven:mutationCoverage
```

The command-line tool names them differently — `--historyInputLocation` and `--historyOutputLocation` —
and the incremental page lists both spellings side by side, which is worth knowing when you are reading
someone's script rather than their POM.

⚠️ **The precedence is stated as a warning on the incremental page:**

> *"If withHistory is true, the history input and output file location parameters are ignored."*

So a CI job that carefully configures `historyInputFile` and `historyOutputFile` and *also* passes
`-DwithHistory` writes to the temp directory and reads nothing you intended — with no warning, just a run
that is mysteriously not faster.

And the input/output split has a gap pitest names itself:

> *"These point to the locations from which to read and write mutation analysis results. This can be the
> same location. If different locations are used you will need to implement some mechanism to swap the
> values between runs as PIT does itself does not currently provide a mechanism."*

For CI that means the history file is a **build cache artefact** — restored before the run, saved after
it — and `withHistory`'s temp directory is exactly the wrong place for it, because CI agents are usually
ephemeral. Using a single path for both input and output is the arrangement that needs no swapping mechanism.

On Gradle the same feature is `enableDefaultIncrementalAnalysis`, with `historyInputLocation` and
`historyOutputLocation` as `RegularFileProperty`, and `withHistory` provided as an alias for migration
([05b2](05b2-gradle-isolation-and-gaps.md)).

## What none of this is: a diff

The FAQ's advice —

> *"The most effective way to use mutation testing is usually to limit analysis to the code that you are
> changing."*

— is immediately followed by *"Tooling is available to integrate pitest into pull requests"*, and the
tooling is arcmutate's. Its git integration appears in pitest's own Maven documentation as a feature
string, described there as *"arcmutate's git integration and history implementations"*:

```
mvn -Ppitest -DextraFeatures="+GIT(from[HEAD~1]), +arcmutate_history(run_tests[false])" test-compile
```

Those features do not exist without the plugin on pitest's classpath, and the plugin is licensed software
with free licences for open-source projects ([01b](01b-the-tool-and-its-versions.md)). Note that the
example activates arcmutate's *own* history implementation alongside the git one — a second signal that
the open-source history file is not the mechanism serious per-PR integrations are built on.

**So the free feature set is: globs, plus a history file, plus the arithmetic that a class you did not
touch probably behaves the same.** That is enough for a nightly run over a scoped package. It is not
enough for per-pull-request line-level analysis. Decide which you are building before you promise anyone
comments on their PR.

## Where this connects

- **[05c · Scoping](05c-scoping-and-incremental.md)** — the globs, and why they do not cut the coverage pass.
- **[05 · Wiring it up](05-wiring-it-up.md)** — where these parameters go, and the profile a CI run belongs in.
- **[05b2 · Gradle isolation](05b2-gradle-isolation-and-gaps.md)** — `enableDefaultIncrementalAnalysis` and the `withHistory` alias.
- **[04 · Reading a report](04-reading-a-report.md)** — a status carried forward looks exactly like one measured today.
- **[04c2 · Thresholds and gates](04c2-thresholds-and-gates.md)** — why gating on a partly-inferred report is a bad idea.
- **[06 · The cost](06-the-cost.md)** — the arithmetic this feature is trying to avoid, and the honest verdict on when to pay it.
- **[01b · The tool and its versions](01b-the-tool-and-its-versions.md)** — arcmutate, and which "pitest features" from blog posts are commercial.

## Gotchas

**★ Four of incremental analysis's five optimisations are documented as introducing potential error.**
Pitest's own page: *"With the exception of 4), all these optimisations introduce a degree of potential
error into the analysis"*, because it only tracks the strongest dependencies — super classes and outer
classes — when deciding whether a class's behaviour might have changed. The assumption that dependency
changes rarely flip a mutation's status is described by pitest as *"reasonable"* but *"currently
unproven"*.

**★ Optimisation 4 is exempt because it changes the order, not the answer.**
Prioritising the previously-killing test only decides what pitest tries first; the mutant is still run and
still judged. That is the distinction to hold on to when someone asks whether incremental analysis is
"safe": one of its five ideas is a pure scheduling hint, and the other four replace a measurement with an
inference.

**★ A report produced with a history file contains statuses that were not measured in that run.**
And nothing in the HTML, XML or CSV distinguishes an inferred status from a measured one. That is fine for
a fast local loop and wrong for a published number or a gate, where you are comparing a threshold against
last week's suite for every part of the codebase that did not change.

**★ The fifth optimisation is documented and not implemented.**
*"(not yet implemented)"*, in pitest's own text, along with a stated risk that the mutations inside a meta
mutant *"might cancel each other out"*. It is worth knowing because the page reads as a description of
current behaviour until you notice the annotation, and because a blog post summarising the page may not
have noticed it either.

**★ `withHistory` overrides the explicit history file locations, silently.**
*"If withHistory is true, the history input and output file location parameters are ignored."* A CI job
that configures `historyInputFile`/`historyOutputFile` and also passes `-DwithHistory` writes to the temp
directory and reads nothing it intended — and gets no warning, just a run that is mysteriously not faster.

**★ `withHistory` puts the file in the temp directory, which is the wrong place for CI.**
The documentation describes it as *"a convenient way of using history files to speed up local analysis"*,
and that is exactly its scope. On an ephemeral CI agent the temp directory is empty at the start of every
run, so the feature costs you the write and buys you nothing.

**★ Pitest does not rotate the history file for you.**
*"If different locations are used you will need to implement some mechanism to swap the values between
runs as PIT does itself does not currently provide a mechanism."* The workable arrangement in CI is a
single path plus the build cache: restore before, save after. Two different paths means writing the swap
yourself.

**★ The Maven and command-line parameters have different names for the same thing.**
`historyInputFile`/`historyOutputFile` in Maven, `--historyInputLocation`/`--historyOutputLocation` on the
command line, `historyInputLocation`/`historyOutputLocation` in the Gradle plugin. The incremental page
lists both spellings; the quick starts each list only their own. Copying a flag between a script and a POM
does not work.

**★ Git-scoped analysis is not in the open-source tool.**
`+GIT(from[HEAD~1])` is arcmutate's, and pitest's own Maven documentation labels it as such — alongside
`+arcmutate_history(...)`, a second history implementation that exists because the built-in one is not
what per-PR integrations are built on. The free scoping instruments are class-name globs and this history
file, neither of which knows what changed in your branch.

**★ "Experimental" is pitest's own word for this feature.**
The page opens with *"PIT contains an experimental feature to enable its use on very large codebases"*.
It has been there for many releases and it is actively developed — optimisation 4 arrived in 1.14.4 — but
the label is the maintainer's own assessment and it belongs in any conversation where someone proposes
building a quality gate on top of it.

## Interview questions

**★ How does PIT's incremental analysis work, and when would you not use it?**
It stores the results of previous runs in a history file and skips analysis it can infer: a mutant killed
last run, where neither the class under test nor the killing test has changed, is assumed still killed; a
survivor whose covering tests are unchanged and unextended is assumed still surviving; a previous
infinite loop in an unchanged class is assumed still an infinite loop. There is also a pure ordering
optimisation that prioritises the previous killing test. Pitest is unusually honest about the risk — it
says all of them except the ordering one *"introduce a degree of potential error into the analysis"*,
because it only tracks changes to super classes and outer classes when deciding whether a class's
behaviour might have changed, and it calls the underlying assumption *"reasonable"* but *"currently
unproven"*. So I would use it for a developer's inner loop and for a fast CI signal, and not for a
published score or a gate, because a threshold compared against partly-inferred statuses is comparing
against a measurement that was never made.

**★ Give me a concrete case where incremental analysis gets the wrong answer.**
A `MATH` mutant in `PricingService` was killed last run by `PricingServiceTest`. Neither file changes in
this commit. But `Money`, which `PricingService` calls and which is neither its super class nor its outer
class, changes its rounding mode. Pitest's dependency tracking considers only super classes and outer
classes, so it concludes the mutant is still killed and does not re-run it — and it may no longer be. The
page describes exactly this shape: class behaviour is defined by the graph of classes it interacts with,
pitest tracks only the strongest of those relationships, and the assumption that dependency changes
rarely flip a mutation's status is unproven. It is a reasonable engineering trade for speed; it is not a
property you should build a gate on.

**★ A team wants mutation testing on every pull request, restricted to the lines they changed. What is the plan?**
There are two honest plans and they are different. The open-source plan is a scoped nightly or per-merge
run: `targetClasses` narrowed to the modules that matter, slow tests excluded, threads raised, and a
history file restored from and saved to the CI cache — which gets you "this run is fast because most of
the codebase did not change", not "this run analysed the diff". Pitest has no notion of a diff at all;
its scoping instruments are class-name globs and that history file. The other plan is arcmutate, whose
git integration appears even in pitest's own Maven documentation as `+GIT(from[HEAD~1])` and is described
there as *"arcmutate's git integration"*; it is licensed, with free licences for open-source projects. I
would put both options in front of whoever is asking, with the note that the free plan cannot produce
per-PR line-level comments no matter how it is configured.

**★ You add `-DwithHistory` to a CI job that already configures history file locations, and nothing gets faster. Why?**
Because `withHistory` wins and points both locations at a project-specific file in the temp directory —
the incremental page states it as a warning: *"If withHistory is true, the history input and output file
location parameters are ignored."* On an ephemeral CI agent that directory is empty at the start of every
run, so pitest reads no history, infers nothing, and writes a file nobody will ever read. The fix is to
drop `withHistory` in CI, use a single explicit path for both input and output so no swapping mechanism
is needed — pitest says it provides none — and restore and save that path through the build cache.
`withHistory` is documented as a convenience for *local* analysis and that is exactly where it belongs.

**★ Would you put mutation testing on a pull request build at all?**
Only in a shape that survives the constraints. A full run is too slow for a PR, a history-file run gives
answers that were partly inferred, and the tool cannot restrict itself to changed lines without a
commercial plugin. So what I would actually do is run the default operator set over one or two packages
where a survivor genuinely matters, with the slow tests excluded, and gate on `maxSurviving` at the
current count so the number can only ratchet down — with the full, unscoped, non-incremental run happening
nightly and read by a person. The thing to avoid is the shape teams reach for first: a whole-repository
run with a percentage gate and a history file, which is slow, produces a number nobody can reproduce, and
compares it against a measurement that was never made.

{/* FOOTER */}
