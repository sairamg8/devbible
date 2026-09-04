---
title: "A native build is a whole-program compilation that runs on a JVM with a documented default of 85% of system memory in CI and up to 32 threads — so it is a capacity problem before it is a latency problem, and it belongs in a different part of your pipeline from the JVM build"
sidebar_label: "06b · The long build"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Build Output"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildOutput/)),
> "Build Configuration" ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildConfiguration/)),
> "Build Options" ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildOptions/)) and
> "Optimizations and Performance"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/optimizations-and-performance/)).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.1 / Spring Framework 7.0.9**.
> Documentation-validated; **no sandbox run** — ⚠️ **no build duration on this page is a measurement.** The reference manual does not publish build times, and neither does this page; what follows is the set of documented mechanisms that determine yours.

**A JVM build compiles each class independently and stops. A native build performs a whole-program points-to analysis over your code, your dependencies and the JDK, then compiles every reachable method with the Graal compiler, then links a binary. It is measured in minutes rather than seconds, it is memory-bound before it is CPU-bound, and the builder itself runs on a JVM with its own heap that you can and often must configure. Treating it like another Maven goal is how a native migration takes the whole CI cluster down with it.**

## What the builder is actually doing

The build output reference names the stages, and the two that dominate are worth understanding:

**Performing analysis** — *"In this stage, a points-to analysis is performed. The progress indicator visualizes the number of analysis iterations."* And a diagnostic worth remembering: *"A large number of iterations can indicate problems in the analysis likely caused by misconfiguration or a misbehaving feature."*

**Building universe → parsing methods → inlining methods → compiling methods → linking.** The compiler parses *"all reachable methods"* — so compile time scales with reachability, which is the same number that drives image size ([02](02-the-closed-world-assumption.md)).

🔴 **That is the single most useful causal chain on this page: more dependencies → more reachable methods → longer analysis, longer compilation, larger binary, more resident memory.** Every one of those four is the same lever. Pruning a dependency improves all of them at once.

## The builder's own memory, and the defaults nobody reads

`native-image` is a Java program. The Build Configuration page lists what it gives itself:

```
-Xss10M
-XX:MaxRAMPercentage=<percentage based on available memory>
-XX:GCTimeRatio=19
-XX:+ExitOnOutOfMemoryError
```

with the rationale for each:

> *"The `-XX:MaxRAMPercentage` value determines the maximum heap size of the builder and is computed based on available memory of the system. It maxes out at 32GB by default and can be overwritten with, for example, `-J-XX:MaxRAMPercentage=90.0` for 90% of physical memory or `-Xmx4g` for 4GB."*

> *"`-XX:GCTimeRatio=19` increases the goal of the total time for garbage collection to 5%, which is more throughput-oriented and reduces peak RSS."*

> *"The build process also exits on the first `OutOfMemoryError` (`-XX:+ExitOnOutOfMemoryError`) to provide faster feedback in environments under a lot of memory pressure."*

The Build Output page describes the mode selection, and this is the paragraph that explains most CI surprises:

> *"By default, the build process uses the dedicated mode (which uses 85% of system memory) in containers or CI environments (when the `$CI` environment variable is set to `true`), but never more than 30GiB of memory. Otherwise, it uses shared mode, which uses the available memory to avoid memory pressure on developer machines. If less than 8GiB of memory are available, the build process falls back to the dedicated mode."*

⚠️ **Read that carefully. In a container or when `$CI` is `true`, the builder takes 85% of system memory.** On a shared runner with several concurrent jobs, that is a recipe for the kernel's OOM killer taking out somebody else's build. Override it explicitly:

```bash
native-image -J-XX:MaxRAMPercentage=60.0 ...
# or an absolute cap, which is easier to reason about on a shared agent
native-image -J-Xmx8g ...
```

and, where you know the floor:

> *"`Xms` (for example, `-J-Xms9g`) can also be used to ensure a minimum for the limit, if you know the image needs at least that much memory to build."*

⚠️ **"The memory limit of the Java heap, so actual memory consumption can be higher."** The reference says so directly and points at the reported peak RSS. Size the *container* above the heap cap, not equal to it — the same arithmetic as topic 03's ([`03-heap-sizing-in-containers/README.md`](../03-heap-sizing-in-containers/README.md)), applied to the builder instead of your application.

## Threads

> *"By default, the build process uses all available processors to maximize speed, but not more than 32 threads. Use the `--parallelism` option to set the number of threads explicitly (for example, `--parallelism=4`). Use fewer threads to reduce load on your system as well as memory consumption (at the cost of a slower build process)."*

🔴 **"All available processors" on a container-limited agent is a classic trap.** If the container's CPU quota is two cores but the host has sixty-four, a builder that spawns thirty-two threads spends its life being throttled. Set `--parallelism` to the container's actual CPU allowance.

## When it runs out of memory

The Build Options page lists the remedies in order:

> *"If you encounter `OutOfMemoryError: Java heap space` you can:*
> *- use the `-Os` flag to reduce image size*
> *- use more specific preservation options like `-H:Preserve=package=<package>` instead of `-H:Preserve=all`*
> *- use more RAM by increasing the heap size with `-J-Xmx<n>g`"*

and names the two configurations that make it likely:

> *"Native Image compilation is memory-intensive, particularly when building large projects or when using `-H:Preserve=all` or `--pgo-instrument`."*

**Both of those are discovery-mode settings** ([03b](03b-reachability-metadata.md), [07c · Getting throughput back](07c-getting-throughput-back.md)). If your *normal* build needs them, you have a metadata problem or a profiling workflow problem, not a memory problem.

## Making it faster

**`-Ob` — quick build mode.** The optimisation-level table describes it as *"Quick build mode: Speeds up builds during development by avoiding time-consuming optimizations. This can also reduce file size sometimes."*

🔴 **`-Ob` is a development setting, not a CI setting and never a production setting.** It produces a binary that starts and runs, so it is genuinely useful for "does this even build" iteration — and it is not the artefact you should measure or ship.

**`-Os` — optimise for size.** *"`-Os` enables all `-O2` optimizations except those that can increase code or image size significantly. Typically creates the smallest possible images at the cost of reduced performance."* Useful when memory during the build, not just the output size, is the binding constraint.

**Reduce reachability.** The most durable lever and the only one with no downside. Fewer starters, fewer transitive dependencies, fewer unconditional metadata entries from libraries ([03b](03b-reachability-metadata.md)). Watch the reachable types/fields/methods counts across builds; that number is your build-time budget.

**Do not expect incremental builds.** A whole-program analysis has nothing to be incremental about — the analysis result depends on the whole closed world, so changing one method can change reachability anywhere. Nothing in the reference offers an incremental mode, and I found no documented mechanism for one.

## Where it belongs in the pipeline

The pipeline shape that survives contact with a real team:

| Trigger | What runs | Why |
|---|---|---|
| Every commit / PR | JVM build + full JVM test suite | Fast feedback; this is where correctness is established |
| Every commit / PR | JVM run with `-Dspring.aot.enabled=true` | Cheap proof that the AOT-generated context is valid (**08 · Testing a native image** *(not written yet)*) |
| Merge to main, or nightly | Native build + `nativeTest` with `-XX:MissingRegistrationReportingMode=Exit` | Catches metadata gaps without gating every push |
| Release | Native build on the target platform, then run the binary in the deployment image | The only thing that proves you did not produce a fallback file |

Spring Boot's own testing guidance points the same way:

> *"Generating the native image that contains the tests to run can be a time-consuming operation, so most developers will probably prefer to use the JVM locally. They can, however, be very useful as part of a CI pipeline. For example, you might choose to run native tests once a day."*

⚠️ **The failure mode to avoid is the opposite of slowness: a release that produces a native artefact nobody has ever executed.** A nightly native build that has been red for three weeks is worse than no native build, because it creates the appearance of coverage.

## Gotchas

**★ Symptom: a native build in CI is OOM-killed, or takes down a co-scheduled job.** Cause: *"the build process uses the dedicated mode (which uses 85% of system memory) in containers or CI environments (when the `$CI` environment variable is set to `true`)"*. On a shared runner that is 85% of the *host*, not of your share. Fix: cap it explicitly with `-J-Xmx8g` or `-J-XX:MaxRAMPercentage=60.0`, and size the container above the cap because *"actual memory consumption can be higher"* than the heap limit.

**★ Symptom: the build is slow on a CPU-limited container despite plenty of cores on the host.** Cause: *"the build process uses all available processors … but not more than 32 threads"*, and "available" means what the JVM sees, which may exceed the container's CPU quota. Fix: `--parallelism=<the container's CPU allowance>`. Fewer threads also reduces memory, which is usually the tighter constraint anyway.

**★ Symptom: the build fails with `OutOfMemoryError: Java heap space` and increasing `-Xmx` does not help.** Cause: `-Xmx` without `-J` goes to the wrong JVM. The builder's own JVM options are prefixed `-J`. Fix: `-J-Xmx16g`. And check whether `-H:Preserve=all` or `--pgo-instrument` is in the command line — the reference names both as making compilation *"memory-intensive"*.

**★ Symptom: the analysis stage reports an unusually large number of iterations.** Cause: the reference reads this as a signal — *"A large number of iterations can indicate problems in the analysis likely caused by misconfiguration or a misbehaving feature."* Fix: look at what you changed. A newly added `Feature`, a very broad metadata registration, or `-H:Preserve` are the usual causes.

**★ Symptom: a developer's `-Ob` build behaves acceptably and the release build is measured against it.** Cause: quick-build mode *"avoid\[s\] time-consuming optimizations"*, so it is not a performance-representative artefact. Fix: keep `-Ob` for local iteration only, and make sure any throughput or start-up figure quoted in a decision came from a build at the default `-O2` or better.

**★ Symptom: build time grows steadily over months with no obvious cause.** Cause: reachability creep — each new dependency adds reachable methods, and compile time scales with them. Fix: track the reachable types/fields/methods counts in the build output as a CI metric, exactly as the reference suggests comparing them *"before and after merging code changes or adding, removing, or upgrading dependencies"*. It gives you a regression signal months before anyone complains.

**★ Symptom: the team tries to cache the native build between CI runs and it never hits.** Cause: whole-program analysis is not incremental; there is no documented incremental mode. Fix: cache the *Maven or Gradle* dependency resolution and the JVM build outputs, which do cache, and accept that the `native-image` step is full every time. The lever is reachability, not caching.

**★ Symptom: PGO is adopted and CI time roughly doubles.** Cause: the PGO workflow is two builds plus a representative run — `--pgo-instrument`, then execute, then `--pgo` — and the reference notes the instrumented build is memory-intensive. Fix: run the PGO pipeline on a schedule for release candidates, not per commit, and store the `.iprof` profile as a build artefact so the optimised build can be reproduced without redoing the instrumented run ([07c · Getting throughput back](07c-getting-throughput-back.md)).

**★ Symptom: nightly native builds have been failing for weeks and nobody noticed.** Cause: it is not gating anything, so nothing is on fire. Fix: alert on it like a production job. A native pipeline that is red by default gives you all the cost of native image and none of the assurance.

## Interview questions

**★ Why is a native build so much slower than a JVM build, in mechanism rather than in feeling?**
Because it is whole-program. `javac` compiles each class in isolation and stops at bytecode. `native-image` runs a points-to analysis over your code, your dependencies and the JDK to a fixed point, builds a universe of all reachable types, fields and methods, has the Graal compiler parse and inline and compile every reachable method, and links a binary. Every stage scales with the size of the closed world rather than with the size of your diff — which is also why it cannot be incremental: changing one method can change reachability anywhere.

**★ What are the builder's default memory and thread settings, and which of them will hurt you in CI?**
The builder runs on a JVM with `-Xss10M`, a computed `-XX:MaxRAMPercentage` capped at 32 GB, `-XX:GCTimeRatio=19` and `-XX:+ExitOnOutOfMemoryError`. It uses *"dedicated mode (which uses 85% of system memory) in containers or CI environments (when the `$CI` environment variable is set to `true`), but never more than 30GiB"*, and up to 32 threads or the number of available processors. The one that hurts is the 85%: on a shared runner it is 85% of the host, and it will evict other jobs. Cap it with `-J-Xmx` and set `--parallelism` to the container's real CPU allowance.

**★ The native build runs out of memory. What do you try, in order?**
The reference gives the order: `-Os` to reduce image size, replace `-H:Preserve=all` with a specific package or module selector, and only then raise the heap with `-J-Xmx<n>g`. Before any of them, check whether `-H:Preserve=all` or `--pgo-instrument` is in the command line at all, since the documentation names both as making compilation memory-intensive — and neither belongs in a routine build. And remember the `-J` prefix: `-Xmx` alone goes to the wrong JVM.

**★ Where should the native build sit in a CI pipeline, and what is the argument?**
Off the pull-request path. The JVM build and test suite gate every commit because they are fast and they are where correctness is established; a JVM run with `spring.aot.enabled=true` is a cheap additional gate that proves the AOT context is valid. The native build and `nativeTest` run on merge or nightly, because Spring Boot's own guidance is that native image generation *"can be a time-consuming operation"* and that native tests *"can, however, be very useful as part of a CI pipeline. For example, you might choose to run native tests once a day."* The release build must additionally *execute* the produced binary in the deployment image, because that is the only check that catches a fallback file.

**★ What single change most reliably reduces native build time?**
Reducing reachability. Analysis time, compilation time, image size and resident memory are all functions of the number of reachable types, fields and methods, so removing an unused starter or a heavyweight transitive dependency improves all four at once. The build prints those counts, and the reference explicitly recommends comparing them across dependency changes. Nothing else on the list — parallelism, heap, `-Ob`, `-Os` — has that property; they trade one resource for another.

**★ Is `-Ob` a reasonable setting for CI?**
For a "does it build" job, yes; for anything you measure or ship, no. Quick build mode is documented as *"Speeds up builds during development by avoiding time-consuming optimizations"*, so a `-Ob` binary is not performance-representative. The risk is not that it fails, it is that someone benchmarks it, concludes native image is slow, and makes a strategy decision on a development-mode artefact. If `-Ob` appears in a pipeline, label the artefact so it cannot be confused with a release build.

{/* FOOTER */}
