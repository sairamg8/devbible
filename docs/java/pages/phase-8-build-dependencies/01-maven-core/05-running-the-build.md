---
title: "Running the build"
sidebar_label: "5 · Running the build"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the maven-surefire-plugin "Skipping
> Tests" page (`-DskipTests` vs `-Dmaven.test.skip`, and that
> `maven.test.skip` is honoured by Surefire, Failsafe and the Compiler
> Plugin), the maven-dependency-plugin `analyze` mojo page (it forks
> `test-compile`; `analyze-only` does not), the Maven lifecycle guide,
> and "What's new in Maven 4"
> (maven.apache.org/whatsnewinmaven4.html — the phase tree and
> concurrent builder, `before:`/`after:` phases, `--resume`,
> `deployAtEnd` default, `--fail-on-severity`, `mvnsh`, `mvnup`, and the
> recommendation to prefer `mvn verify` over `mvn clean install`).

**The three commands most Java developers actually type — `mvn clean
install`, `-DskipTests`, and `cd` into a module — are each subtly the
wrong tool, and each has a correct counterpart that is no harder to
type. This chunk is about the operating surface: which phase to invoke,
which flag really skips what, how to build one module of fifty, and
which goals run outside the lifecycle altogether.**

## `mvn verify` vs the reflexive `mvn clean install`

`mvn clean install` is the most-typed Maven command and usually the
wrong one. Maven 4's own documentation recommends **`mvn verify`**
instead, and the reasoning is worth internalising:

- `install` writes into your local repository. Inside a multi-module
  build the reactor already resolves siblings from the reactor, so
  installing buys nothing — but it *does* leave artifacts behind that
  later builds can silently resolve, including from a branch you have
  since abandoned. That is a real and common source of "it builds for
  me".
- `verify` runs everything that proves the build is good — unit tests,
  packaging, integration tests, enforcer rules, coverage gates — and
  stops before the side effect.
- `install` is genuinely right when a *different* project on the same
  machine must consume the artifact. That is the use case; "so it's
  there" is not.

And `clean`: usually unnecessary, occasionally mandatory. Maven's
incremental compilation is good at "nothing changed" and unreliable
about deletions, renames, changed generated sources and changed plugin
configuration. The right habit is **"not by default, and immediately
when a result stops making sense"** — with CI always cleaning, because
CI starts from an empty workspace anyway and a cached one is a
reproducibility hole.

## Skipping tests: two flags that are not the same thing

```bash
mvn install -DskipTests             # COMPILES tests, does not RUN them
mvn install -Dmaven.test.skip=true  # does not compile them either
```

`-DskipTests` sets Surefire's `skipTests` parameter — test sources still
compile, so a test that no longer compiles still breaks the build.
`maven.test.skip` is honoured by Surefire, Failsafe **and the Compiler
Plugin**, so `test-compile` is skipped as well and broken test code
passes unnoticed.

That difference is the whole point:

| Flag | Compiles tests | Runs tests | Reasonable use |
|---|---|---|---|
| *(none)* | yes | yes | the default; what CI does |
| `-DskipTests` | **yes** | no | build the artifact now, test it in the pipeline |
| `-Dmaven.test.skip=true` | **no** | no | only when test compilation itself is the obstacle |
| `-Dmaven.test.failure.ignore=true` | yes | yes, failures ignored | a report-collecting stage — never a gate |

`-DskipTests` is a legitimate everyday tool. `-Dmaven.test.skip=true`
throws away the compiler's opinion of your test code as well, which is a
much larger concession than the two extra characters suggest, and it is
how a test suite quietly rots: nothing compiles it, so nothing notices.
`-Dmaven.test.failure.ignore=true` is more dangerous still, because the
build is green while tests are failing — acceptable only in a stage
whose *only* job is to collect reports for a later gate.

## Goals invoked directly, and forking

`mvn <plugin>:<goal>` bypasses the lifecycle entirely:

```bash
mvn help:effective-pom
mvn dependency:tree
mvn versions:display-dependency-updates
mvn enforcer:enforce
```

No phases run before it, so `mvn dependency:tree` compiles nothing —
which is exactly what you want when the build is broken and you are
trying to find out why. The short form works because Maven resolves the
prefix (`dependency`, `help`) against plugin metadata; for a plugin
outside the known groups you give the full
`groupId:artifactId:version:goal`.

Some goals declare a **forked lifecycle**: invoking them triggers a
parallel run of the default lifecycle up to a phase they need.
`dependency:analyze` documents that it invokes `test-compile` before
executing itself, and is intended to be used standalone for that reason
— the non-forking `dependency:analyze-only` exists for binding inside a
normal build. This is why one `dependency:` goal compiles your project
and another does not, and knowing the mechanism saves you from
concluding that Maven is being arbitrary.

## Selecting projects in a reactor

```bash
mvn -pl invoice-service -am verify   # this project AND what it needs
mvn -pl invoice-service -amd verify  # this project AND what depends on it
mvn -rf invoice-api verify           # resume from this module onward
mvn -T 1C verify                     # parallel: one thread per core
mvn -o verify                        # offline: no remote lookups at all
mvn -U verify                        # force a snapshot/metadata update check
```

`-pl` with `-am` is the correct way to build one module of a large
reactor. The alternative everyone reaches for — `cd` into the module and
run `mvn verify` there — resolves its siblings from `~/.m2` instead of
from the reactor, so you may be testing against a stale sibling from
another branch and not know it.

`-T 1C` is usually safe and often a large win, but it is not free: a
plugin that is not thread-safe will warn, and a build whose modules
share mutable state outside the reactor (a fixed port, a shared temp
directory, a database) will fail intermittently rather than cleanly.
Introduce it in CI first, where a flake is visible.

Maven 4 replaces `-rf` with **`--resume` / `-r`**, which knows which
subprojects already succeeded and picks up after the last failure
without you naming the module.

## Maven 4: the lifecycle becomes a tree

Maven 3's lifecycle is an ordered list. Maven 4 models it as a **tree of
phases**, which is what allows finer-grained scheduling and the
concurrent builder (`-b concurrent`) rather than only per-module
parallelism. Alongside that:

- **`before:` and `after:` phases** — bind an execution with
  `<phase>before:integration-test</phase>`, and order several within one
  phase with an index: `before:integration-test[100]`.
- **`before:all` / `after:all`** (the whole build) and **`before:each` /
  `after:each`** (per subproject), intended to replace the deprecated
  `pre-*` / `post-*` phases.
- A behaviour change worth knowing: an execution bound to `post-clean`
  ran in Maven 3 only if you typed `mvn post-clean`; in Maven 4 it runs
  as part of `mvn clean`. If you have such an execution, check it.
- `deployAtEnd` defaults to **true** and multi-subproject deployment is
  all-or-nothing, so "module 7 of 12 deployed and then it failed" stops
  being a reachable state.
- **`--fail-on-severity WARN`** turns warnings into build failures,
  which is how you stop a codebase accumulating them.
- **`mvnsh`** keeps a Maven process alive between invocations to avoid
  JVM startup cost, and **`mvnup`** automates migrating a POM to the 4.x
  model. Both are new tools in the 4 distribution rather than changes to
  the build model.

⚠️ Maven 4 is at **4.0.0-rc-6** and the download page says plainly that
release candidates are not for production. It also requires **Java 17**
to *run* Maven itself. Read this section as what is coming and as
context for warnings you may see from the RC, not as something to roll
out.

## Gotchas

**Symptom:** a colleague's build resolves an old version of your module
**Cause:** `install` put an artifact in their local repository weeks ago and nothing has overwritten it
**Fix:** prefer `verify`; when you must install, be deliberate about it. `-U` forces snapshot re-checks, and for a release version nothing will ever re-check

**Symptom:** `-Dmaven.test.skip=true` sits in a pipeline, and a test stopped compiling months ago
**Cause:** that flag skips test *compilation*, so nothing checks the test sources at all
**Fix:** `-DskipTests` when you want to defer running them; reserve `maven.test.skip` for a genuine compilation obstacle, and grep your CI config for it today

**Symptom:** CI is green while the test report shows failures
**Cause:** `-Dmaven.test.failure.ignore=true`
**Fix:** it belongs only in a stage that collects reports for a later gate; a gating stage must fail on failures

**Symptom:** a module builds fine standalone and fails inside the reactor, or the reverse
**Cause:** standalone resolution pulls siblings from the local repository (possibly stale); the reactor uses freshly built ones
**Fix:** reproduce with `mvn -pl <module> -am verify` from the root instead of `cd`-ing in

**Symptom:** `-T 1C` produces intermittent failures that never reproduce serially
**Cause:** modules sharing mutable state outside the reactor — a fixed port, a shared temp path, one database — or a plugin that is not thread-safe
**Fix:** find the shared resource; parallelism did not cause the bug, it revealed it. Run parallel in CI first so the flake is visible early

**Symptom:** `mvn dependency:analyze` compiles the project even though no phase was named
**Cause:** the goal declares a forked lifecycle and invokes `test-compile` before running
**Fix:** expected behaviour; use `dependency:analyze-only` when binding it inside a build, and `dependency:tree` when you need diagnosis on a build that does not compile

**Symptom:** `mvn <prefix>:<goal>` fails with "no plugin found for prefix"
**Cause:** prefix resolution only searches the configured plugin groups
**Fix:** add the groupId to `<pluginGroups>` in `settings.xml`, or use the full `groupId:artifactId:version:goal` form

**Symptom:** deleting `~/.m2/repository` "fixes" a problem
**Cause:** almost always a stale snapshot or a locally installed artifact — both of which have precise diagnoses
**Fix:** find the actual artifact (`dependency:tree`, `-X`), delete that one directory, or use `-U`. Wiping the repository re-downloads gigabytes and destroys the evidence that would have told you what happened

## Interview questions

**★ Why does Maven 4's documentation recommend `mvn verify` over `mvn clean install`?**
`verify` runs everything that proves the build is correct and stops
before writing into the local repository. `install` adds a side effect
that buys nothing inside a reactor — siblings already resolve from the
reactor — and leaves artifacts behind that later builds may silently
pick up. `install` is right when a separate project on the same machine
must consume the artifact.

**★ `-DskipTests` vs `-Dmaven.test.skip=true`?**
`-DskipTests` compiles the tests and does not run them.
`maven.test.skip` is honoured by Surefire, Failsafe *and* the compiler
plugin, so the tests are not compiled at all. The second silently
accepts test code that no longer builds, which is how a suite rots.

**★ When is `clean` actually necessary?**
When output has gone stale in a way incremental compilation cannot see:
deleted or renamed classes leaving orphaned `.class` files, changed
generated sources, changed plugin configuration. CI should always clean
because it starts empty anyway; local builds should not, because the
cost is real and the need is occasional.

**★ How do you build one module of a fifty-module reactor correctly?**
`mvn -pl <module> -am verify` from the root — `-pl` selects it, `-am`
adds what it depends on. Running from inside the module directory
resolves siblings from the local repository, which may be stale or from
another branch.

**★ You invoke `mvn dependency:analyze` on a project you have not built, and it compiles. Why?**
The goal declares a forked lifecycle: it invokes `test-compile` before
executing itself, because it analyses bytecode. `dependency:analyze-only`
is the non-forking variant meant for binding inside a normal build.

**★ Someone suggests `-T 1C` to speed up CI. What do you check first?**
Whether any modules share state outside the reactor — a hard-coded port,
a fixed temp directory, one shared database — and whether any plugin
warns that it is not thread-safe. Parallelism does not create those
bugs, it exposes them, so roll it out where a flake is visible rather
than on a developer's machine.

**★ A build works locally and fails in CI, or vice versa. What is your order of investigation?**
Diff `help:effective-pom` between the two; check `help:effective-settings`
for a mirror or a local profile; check for locally installed artifacts
or stale snapshots (`-U`, and `dependency:tree` to see what resolved);
and only then look at the code. Every one of those is an input
difference, which is what "works on my machine" always is.

**★ Why is wiping `~/.m2/repository` a bad reflex?**
Because it works for the wrong reason and destroys the evidence. The
real cause is nearly always one stale snapshot or one locally installed
artifact, both of which are findable and fixable in place with `-U` or a
targeted delete. Wiping re-downloads gigabytes, hides the cause, and
guarantees the same problem returns without anyone knowing why.

**★ What changes about running a build in Maven 4?**
The lifecycle becomes a tree, enabling the concurrent builder
(`-b concurrent`); `before:`/`after:` bindings with ordering indices
replace the deprecated `pre-*`/`post-*` phases; an execution on
`post-clean` now runs during `mvn clean`; `--resume` picks up after the
last failed subproject automatically; `deployAtEnd` defaults to true so
multi-module deploys are all-or-nothing; and `--fail-on-severity` can
turn warnings into failures. It requires Java 17 to run and is still at
release-candidate status.

---

← Prev: [The lifecycle](04-the-lifecycle.md) · Index: [Maven core](README.md) · Next → [Plugins vs dependencies](06-plugins-vs-dependencies.md)
