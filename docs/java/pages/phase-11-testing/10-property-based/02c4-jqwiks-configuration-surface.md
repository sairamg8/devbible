---
title: "jqwik reads every one of its settings out of the JUnit Platform's own junit-platform.properties, writes a .jqwik-database into your working directory that CI will never have, and ships annotations whose simple names collide exactly with Jupiter's — three pieces of configuration surface that arrive with the dependency whether you configure them or not"
sidebar_label: "02c4 · The configuration surface"
sidebar_position: 9
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *jqwik
> Configuration*, *Legacy Configuration in jqwik.properties File*, *Tagging Tests*,
> *Naming and Labeling Tests*, *Disabling Tests* and *Seeing jqwik Reporting in Gradle
> Output* ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no test run on this machine** — documented configuration keys and
> published defaults only, never the output of a run.

**[02c3](02c3-wiring-it-into-the-build.md) got the properties to run. This page is what
arrives with them: one configuration file that is the Platform's rather than jqwik's, a
run-history file that changes behaviour between your laptop and CI, and a set of annotations
— `@Tag`, `@Disabled` — whose simple names are identical to Jupiter's and whose imports are
not. Every item here is a default somebody will hit and misattribute, and two of them are
decisions worth making on the first day rather than the first incident.**

## Where jqwik reads its configuration

There is one file, and it is the JUnit Platform's, not jqwik's:

> *"jqwik uses JUnit's configuration parameters to configure itself. The simplest form is a
> file `junit-platform.properties` in your classpath…"*

Put it in `src/test/resources/junit-platform.properties`. The documented keys, with their
defaults, are:

```properties
jqwik.database = .jqwik-database             # file storing data of previous runs; empty disables recording
jqwik.tries.default = 1000                   # default number of tries per property
jqwik.maxdiscardratio.default = 5            # ratio before assumption misses fail a property
jqwik.reporting.onlyfailures = false         # true = report only falsified properties
jqwik.reporting.usejunitplatform = false     # true = publish through platform reporting
jqwik.failures.runfirst = false              # true = run previously failing properties first
jqwik.failures.after.default = SAMPLE_FIRST  # PREVIOUS_SEED, SAMPLE_ONLY, SAMPLE_FIRST, RANDOM_SEED
jqwik.generation.default = AUTO              # AUTO, RANDOMIZED, EXHAUSTIVE
jqwik.edgecases.default = MIXIN              # FIRST, MIXIN, NONE
jqwik.shrinking.default = BOUNDED            # BOUNDED, FULL, OFF
jqwik.shrinking.bounded.seconds = 10         # max shrinking time when BOUNDED
jqwik.seeds.whenfixed = ALLOW                # ALLOW, WARN, FAIL — guards committed fixed seeds
jqwik.hideAntiAiClause = false               # hides the anti-AI line in terminal emulators only
```

Two of these are decisions a team should make on day one rather than inherit:
`jqwik.seeds.whenfixed = FAIL`, which stops a hard-coded `@Property(seed = "…")` reaching
`main` (see [07 · Reproducibility](07-reproducibility.md)), and
`jqwik.tries.default`, which is the single biggest lever on suite runtime
(see [12 · The cost](12-the-cost.md)).

⚠️ **A `jqwik.properties` file does nothing.** The guide is explicit: *"Prior releases of
jqwik used a custom `jqwik.properties` file. Since version 1.6.0 this is no longer
supported."* Older blog posts and older internal wikis still show it, and a settings file
that is silently ignored is worse than no settings file.

## What it writes into your working directory

By default `jqwik.database = .jqwik-database` — a file in the process's working directory
recording which properties failed and with which sample. It is what makes
`AfterFailureMode.SAMPLE_FIRST` work across runs. Two consequences: it belongs in
`.gitignore`, and it does not exist in a fresh CI container, so the after-failure behaviour
that helps you locally does nothing on a clean CI agent. The full treatment is
[07 · Reproducibility](07-reproducibility.md).

## Tags and names are jqwik's own annotations

Small but load-bearing, because the imports look identical in an IDE's suggestion list. The
guide states it plainly:

> *"Note that the `@Tag` annotation you'll have to use with jqwik is `net.jqwik.api.Tag`
> rather than `org.junit.jupiter.api.Tag`."*

The same applies to `@Disabled` (`net.jqwik.api.Disabled`). Display names come from
`@Label("…")` rather than Jupiter's `@DisplayName`, and jqwik additionally replaces
underscores in identifiers with spaces for display — so `a_property_about_money` renders as
`a property about money` with no annotation at all.

## Where this connects

- Getting properties discovered and executed at all is
  [02c3 · Wiring it into the build](02c3-wiring-it-into-the-build.md).
- Why jqwik uses the Platform's configuration mechanism rather than its own is
  [02 · An engine, not an extension](02-the-stack-problem.md).
- The after-failure modes, the seed, and what CI does and does not remember are
  [07 · Reproducibility](07-reproducibility.md).
- `jqwik.tries.default` as the main lever on suite runtime is
  [12 · The cost](12-the-cost.md).

## Gotchas

**★ A `jqwik.properties` file is silently ignored and has been since 1.6.0.**
The guide says so outright. If a repository contains one — copied from an old tutorial or
carried over from a previous project — every setting in it is dead, which typically means the
team believes `tries` is 100 while it is really 1000, and cannot understand why the suite is
slow. Grep for the filename before believing any claim about how jqwik is configured in a
codebase you did not set up.

**★ `net.jqwik.api.Tag` and `org.junit.jupiter.api.Tag` have the same simple name, and the IDE will offer you the wrong one.**
The class is `Tag` in both. An auto-import picks whichever it likes, the code compiles, and
the tag is invisible to jqwik's filtering — so a `mvn test -Dgroups=fast` run silently omits
or includes the wrong properties. The same hazard applies to `@Disabled`. When reviewing
jqwik code, read the import block, not the annotation.

**★ `jqwik.reporting.usejunitplatform` defaults to `false`, so jqwik's report — including the seed — goes to stdout and not into your CI test report.**
The guide explains why: Gradle does not yet support platform reporting for this, so *"jqwik
has switched to do its own reporting by default"*. The consequence is that a CI failure email
or a test-report artifact contains the assertion error but not the `seed = …` line you need to
reproduce it, unless somebody scrolls the raw log. If reproducing CI failures matters to you —
and it should — set that parameter to `true` deliberately and check that your reporter shows
the entries.

**★ The `.jqwik-database` file is per working directory, which means "the same failure keeps coming back locally" and "CI never remembers anything" are the same fact.**
Locally the file persists between runs, so a falsified property keeps re-running its failing
sample until you fix it — that is the intended, useful behaviour. On a fresh CI agent the file
does not exist, so every run starts clean with a new random seed, which is why a rare
falsification can appear on an unrelated build and then vanish. Neither is a bug; both
surprise people who have not read the configuration.

## Interview questions

**★ You are setting up a properties module from scratch. What goes in `junit-platform.properties` on day one, and why?**
Three entries at minimum. `jqwik.seeds.whenfixed = FAIL`, because the single most damaging
thing that happens to a property suite is somebody pasting `@Property(seed = "424242")` while
debugging and committing it — that property now tests one fixed sequence of inputs forever
and looks exactly like a working property; jqwik has a built-in guard for precisely this and
it is off by default. `jqwik.tries.default` set consciously — 1000 is the default and it is
the right number for a nightly job and often the wrong one for a per-commit build, and
choosing it once beats sprinkling `tries` on individual properties. And
`jqwik.reporting.usejunitplatform = true`, so the seed and the tries/checks counts land in
the machine-readable test report rather than only on stdout, which is what makes a CI failure
reproducible. I would also add `.jqwik-database` to `.gitignore` in the same commit.

**★ Why does jqwik configure itself through `junit-platform.properties` rather than its own file, and what does that tell you about the tool?**
Because configuration parameters are a JUnit *Platform* concept, not a Jupiter one — the
Platform reads them and hands them to every engine, and each engine namespaces its own keys.
jqwik's keys are all prefixed `jqwik.` for exactly that reason, and its `@Property` attributes
are documented as overriding what the configuration file sets. What it tells you is the same
thing chunk 02 argued: jqwik is a first-class citizen of the Platform, at the same level as
Jupiter, using the Platform's own extension points rather than sitting inside somebody else's
engine. It also explains a live gotcha — jqwik *had* its own file once and dropped it in
1.6.0, and a leftover `jqwik.properties` in a repository is silently ignored today.

**★ A property in your repository is annotated `@Property(seed = "424242")`. What is wrong, and what would you have done to prevent it?**
It is no longer a property. A fixed seed makes jqwik generate the same sequence of values on
every run, so the test now checks one thousand fixed inputs forever — it looks like a property,
it costs like a property, and it has the search behaviour of a hard-coded table nobody can
read. It almost always arrives the same way: somebody pastes the seed from a failure to debug
it locally and forgets to remove it. The prevention is built in and off by default:
`jqwik.seeds.whenfixed = FAIL` in `junit-platform.properties` makes any fixed seed fail the
property outright, and the guide describes the setting as *"useful to prevent accidental
commits of fixed seeds into source control"*. `WARN` is the softer option if you have a
legitimate reason to fix a seed somewhere. What I would not rely on is code review catching
a nine-character string in an annotation.

{/* FOOTER */}
