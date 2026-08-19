---
title: "The model: a task graph, and two phases"
sidebar_label: "1 · The model and the phases"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Gradle User Manual for 9.x
> (docs.gradle.org/current — *Build Lifecycle*, *Task Configuration
> Avoidance*, *Configuration Cache*), the Gradle 9.0.0 release notes and
> gradle.org/whats-new/gradle-9, the Gradle 9.7.0 release notes (current
> release, 2026-08-07), and maven.apache.org's *Introduction to the Build
> Lifecycle* for the Maven side of the comparison.

**A Maven build is a document that gets interpreted: you declare what the
project *is*, and a fixed lifecycle of phases runs the plugin goals bound to
them. A Gradle build is a program that gets executed: your script runs, and
what it produces is a directed acyclic graph of tasks with declared inputs
and outputs, which Gradle then executes. That single difference explains
everything people like and dislike about Gradle — including why "work in the
configuration phase" is the most common way to make a Gradle build slow.**

## Lifecycle vs task graph

Maven's model is a fixed sequence. `mvn package` runs `validate → compile →
test → package`, in that order, always, because the lifecycle is defined by
Maven and not by your POM. Your POM chooses *which goals bind to which
phases*; it never changes the order or invents a phase.

Gradle has no lifecycle in that sense. `./gradlew build` asks for a task
named `build`; Gradle walks its dependency edges (`build` depends on `check`
and `assemble`, `assemble` on `jar`, `jar` on `classes`, and so on) and
executes that subgraph. The `java` plugin creates those tasks and those
edges. A different plugin creates different ones.

| | Maven | Gradle |
|---|---|---|
| Unit of work | a plugin *goal* bound to a *phase* | a *task* |
| Ordering | fixed lifecycle, defined by Maven | edges declared by you and by plugins (`dependsOn`, and implicitly via inputs/outputs) |
| "Run just this" | awkward — every phase before it also runs | natural — `./gradlew :service:test` runs that node's subgraph |
| Skipping work | mostly re-runs; individual plugins opt in | built in — a task whose inputs are unchanged and outputs present is `UP-TO-DATE` |
| Parallelism | `-T`, at the module level | task level, across *and* within projects |

The practical consequence: in Maven, "run the tests of module `service`
without rebuilding everything" is a fight. In Gradle it is the default,
because the graph knows `:service:test` needs `:domain:jar` and nothing else.

The cost is symmetrical. Read a POM and you know what will happen. In Gradle
what happens depends on what the script *did when it ran* — and a script can
do anything.

## The three stages, and the two that matter

Every Gradle invocation has three stages. The first two are where the
confusion lives.

1. **Initialization** — Gradle reads `settings.gradle.kts`, decides which
   projects are in the build, and creates a `Project` object for each.
2. **Configuration** — **every** build script in the build is executed, top
   to bottom. Tasks are created and configured. No task action runs.
3. **Execution** — Gradle selects the requested tasks, orders them by the
   graph, and runs the *actions* of the ones that are not up to date.

"Every" in step 2 is load-bearing. Configuration runs for all projects on
every build, even one that will execute a single task in a single module. So
anything expensive at the top level of a build script is paid on **every**
invocation, including `./gradlew help`.

```kotlin
// build.gradle.kts — this is the smell
val gitSha = "git rev-parse --short HEAD".runCommand()   // forks a process at CONFIGURATION time

tasks.jar { manifest { attributes("Git-SHA" to gitSha) } }
```

Ten modules doing something similar is ten process forks on `./gradlew
tasks`. The lazy form defers the work to execution and only if it is needed:

```kotlin
val gitSha = providers.exec {
    commandLine("git", "rev-parse", "--short", "HEAD")
}.standardOutput.asText.map { it.trim() }               // a Provider — evaluated on demand

tasks.jar { manifest { attributes("Git-SHA" to gitSha.get()) } }
```

## Configuration avoidance

Gradle's name for the discipline is **configuration avoidance**: register
tasks lazily, configure them lazily.

```kotlin
tasks.register<Copy>("copyDocs") {          // register, not create
    from("docs"); into(layout.buildDirectory.dir("docs"))
}
tasks.named<Test>("test") { useJUnitPlatform() }   // named, not getByName-and-mutate
```

`register` and `named` return providers whose configuration blocks execute
only if the task ends up in the graph. The eager equivalents — `create`,
`getByName`, iterating `tasks` and mutating — force every task to be created
and configured on every build, whatever you asked for.

This is also the reason the configuration cache (chunk 4) works at all: if
the configuration phase is deterministic and side-effect-free, its *result* —
the serialised task graph — can be reused. Work smuggled into configuration
is precisely what makes a build configuration-cache-incompatible.

## Inputs, outputs, and why the graph is more than an order

A Gradle task is not just "some code to run". It declares typed inputs
(files, properties, classpaths) and outputs (files, directories). Those
declarations do three jobs at once:

- **Ordering.** If task B's input is task A's output, Gradle infers the edge.
  You rarely need `dependsOn` in modern builds; wiring outputs to inputs is
  the idiomatic way to express a dependency.
- **Up-to-date checks.** Gradle fingerprints the inputs and outputs. Unchanged
  inputs plus intact outputs means the action is skipped as `UP-TO-DATE`.
- **Cacheability.** The same fingerprint is the basis of the build cache key,
  so an identical task from a *different* machine can supply the outputs.

A task with undeclared inputs breaks all three quietly: it is ordered wrong,
it is skipped when it should have run, and it poisons the cache. This is why
"my task reads a file it never declared" is the root cause of the strangest
Gradle bugs — the tool is not doing anything wrong, it was simply told
nothing about that file.

## What this model costs you

The graph is powerful because your script computes it — which means your
script can compute a *different* one depending on an environment variable, a
file's contents, or which day it is. A Gradle build is only as reproducible
as its author made it, and nothing in the tool forces the discipline.

Maven's rigidity is the same property inverted: you cannot express a build
Maven does not already understand, and you also cannot make it mysterious.
That is a real reason to choose Maven, and chunk 5 says so plainly.

## Gotchas

**Symptom:** `./gradlew help` takes eight seconds in a monorepo, and so does every other command
**Cause:** expensive work at the top level of build scripts — process forks, file reads, network calls — runs during the configuration phase, which executes every script on every invocation
**Fix:** move the work into a task action or a lazy `Provider`; use `tasks.register`/`tasks.named` rather than `create`/`getByName`; run with `--configuration-cache`, which reports the worst offenders by name

**Symptom:** a `println` in a task's block clearly ran, but the task never appeared in the build output
**Cause:** configuration and execution were conflated — configuring an eagerly created task always happens; *executing* it happens only if it is in the requested subgraph
**Fix:** print from a `doLast {}` block, not from the configuration block; use `./gradlew <task> --dry-run` to see the graph that would actually run

**Symptom:** a task is `UP-TO-DATE` even though a file it reads has obviously changed
**Cause:** that file is not a declared input — Gradle fingerprints only what the task told it about
**Fix:** declare it (`@InputFile`, `inputs.file(...)`); as a stopgap `--rerun-tasks` forces execution, but a task with undeclared inputs is also uncacheable and mis-ordered, so fix the declaration

**Symptom:** two tasks that must run in a fixed order sometimes run in the other order under `--parallel`
**Cause:** the ordering was assumed from script position; declaration order in a script has no effect on the graph
**Fix:** express the real relationship — wire one task's output to the other's input, or `dependsOn` if there is genuinely no data flow

**Symptom:** a build behaves differently on CI than locally, with no code change
**Cause:** the configuration phase read something environmental — an env var, a git state, a local file — so the two machines built *different graphs*
**Fix:** treat build scripts as code that must be deterministic; pass environment-specific values in as declared inputs rather than reading them at configuration time

**Symptom:** a module builds on its own but the rest of the build cannot see it
**Cause:** it is not `include`d in `settings.gradle.kts` — a directory in the repo is not a Gradle project
**Fix:** add it to `include(...)`; `./gradlew projects` prints what Gradle actually believes exists

## Interview questions

**★ What is the actual difference between Maven's lifecycle and Gradle's task graph?**
Maven's phase order is fixed by Maven; a POM only binds goals to phases, so
`mvn test` always runs everything up to `test`. Gradle has no such sequence —
plugins create tasks and declare edges, and asking for a task executes
exactly its subgraph. That is why "test only this module" is trivial in
Gradle and awkward in Maven, and why Gradle can skip and parallelise at task
granularity.

**★ Name the stages of a Gradle build and say which one your build script body runs in.**
Initialization (settings, project set), configuration (every build script
body executes; tasks are created and configured), execution (task actions
run). The body of `build.gradle.kts` runs during configuration — on every
invocation, for every project, regardless of which task you asked for.

**★ Why is work in the configuration phase a smell, and how do you find it?**
It is paid on every build including no-op ones, it multiplies by the number
of modules, and it makes the build incompatible with the configuration cache,
which exists to serialise and reuse the configuration result. Find it with
`--configuration-cache` (it names incompatible work) and with a build scan's
configuration-time breakdown.

**★ What do `tasks.register` and `tasks.named` buy over `create` and `getByName`?**
Laziness. They return providers whose configuration blocks run only if the
task ends up in the executed graph; the eager forms create and configure
every task on every build. In a large build that is measurable configuration
time, and it is what Gradle means by configuration avoidance.

**★ Gradle skipped a task as UP-TO-DATE and it should not have. What is the diagnosis?**
Almost always an undeclared input. Up-to-date checks compare fingerprints of
*declared* inputs and outputs; a file the task reads without declaring is
invisible to that comparison. `--rerun-tasks` proves the diagnosis by forcing
execution, but the fix is the declaration — the same omission also makes the
task unsafe to cache.

**★ How does one task end up ordered after another without `dependsOn`?**
By data flow: when task B's input is wired to task A's output provider,
Gradle infers the dependency edge from that wiring. It is the preferred form
because it carries the ordering *and* the up-to-date/caching information,
whereas a bare `dependsOn` carries only the ordering.

**★ Why can Gradle parallelise more aggressively than Maven?**
Because it knows the graph at task granularity and knows each node's inputs
and outputs, so it can prove which tasks are independent. Maven parallelises
at module level (`-T`) because the lifecycle, not a graph, defines what
happens inside a module — there is no finer structure to exploit.

---

← Prev: [Gradle](README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [The DSL and the script](02-the-dsl-and-the-script.md)
