---
title: "The AOT cache moves start-up and warm-up and does nothing at all for peak throughput, so whether it is worth a build step depends entirely on how often your process starts — and JDK 25 quietly added cached method profiles, which the java man page has not caught up with"
sidebar_label: "05f · When the cache helps"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 515 · Ahead-of-Time Method Profiling**
> ([openjdk.org](https://openjdk.org/jeps/515) — Closed/Delivered, **Release 25**, Scope
> Implementation); **JEP 483 · Ahead-of-Time Class Loading & Linking**
> ([openjdk.org](https://openjdk.org/jeps/483), JDK 24); the **JDK 25 `java` tool reference**,
> "Ahead-of-Time Cache"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); and the
> **Spring Boot reference**, "Packaging → AOT Cache"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/aot-cache.html)).
> 🔴 **No sandbox** — the timing and size figures below are **quoted from JEP 515's own example**
> and are attributed as such. Nothing on this page was measured here. JDK 25 · Spring Boot 4.1.0 /
> Spring Framework 7.0.8.

**[05d](05d-the-aot-cache.md) and [05e](05e-aot-modes-and-diagnosis.md) covered how to build a cache
and how to know it loaded. This chunk is the question a reviewer should ask before either: is this
worth a build step for *this* service? The answer turns on a distinction that gets blurred
constantly — start-up, warm-up and peak throughput are three different things, and the AOT cache
addresses the first two and is completely irrelevant to the third.**

## Three numbers, not one

| | What it is | Does the AOT cache move it? |
|---|---|---|
| **Start-up** | Process start to "ready to serve" | **Yes.** Classes are loaded and linked from the cache instead of being discovered, parsed and verified |
| **Warm-up** | "Ready to serve" to steady-state performance | **Yes, since JDK 25** — cached method profiles let the JIT start optimising immediately |
| **Peak throughput** | Steady-state performance, hours in | **No.** The same JIT produces the same code from the same profiles. Nothing changes |

JEP 483 describes the start-up work it removes, and the list is worth reading because it explains
*why* a framework benefits disproportionately:

> *"It scans hundreds of JAR files on disk and reads and parses thousands of class files into
> memory; It loads the parsed class data into class objects and links them together so that classes
> can use each others' APIs, which involves verifying bytecodes and resolving symbolic references,
> which in turn may involve instantiating lambda objects; and It executes the static initializers of
> classes"*

## JDK 25 added cached profiles — and the man page did not notice

JEP 515 is **Closed/Delivered for Release 25**, and it extends the cache:

> *"We extend the AOT cache, introduced by JEP 483, to collect method profiles during training runs.
> Just as the AOT cache currently stores classes that the JVM would otherwise need to load and link
> at startup, the AOT cache now also stores method profiles that the JVM would otherwise need to
> collect in the early part of an application's run. Accordingly, production runs of the application
> are both faster to start and faster to achieve peak performance."*

The critical safety property, because "cached profiles" sounds like it should be able to make things
*worse*:

> *"Profiles cached during training runs do not prevent additional profiling during production runs.
> This is critical, since an application's behavior in production can diverge from what was observed
> in training. Even with cached profiles, the HotSpot JVM continues to profile and optimize the
> application as it runs, fusing the benefits of AOT profiles, on-line profiling, and JIT
> compilation."*

🔴 **So a training run that does not resemble production cannot poison your steady state.** It
simply supplies less useful priors and the JVM re-profiles. This is why the AOT cache is a
low-risk optimisation in a way that ahead-of-time *compilation* would not be — a point JEP 515
makes itself when it says AOT-compiled code *"is preferable"* only *"if an application is so
predictable that we can compile its hot methods to native code ahead of time"*.

⚠️ **A documentation inconsistency worth knowing about.** The JDK 25 `java` tool reference still
says the cache *"currently contains Java classes and heap objects"* and that *"In future JDK
releases, the AOT cache may contain additional artifacts, such as execution profiles and compiled
methods."* JEP 515, which delivers execution profiles, is Closed/Delivered for **JDK 25**. The
straightforward reading is that the man page text was carried over from JDK 24 and not updated;
**I could not find a JDK 25 document that reconciles the two**, so this page reports both and does
not pretend to resolve it. If it matters to a decision you are making, verify on your own JDK build
with `-Xlog:aot` rather than on either document.

## The one measurement, quoted and hedged

JEP 515 measures its own example — a hundred-thousand-iteration loop over a `Stream` pipeline in a
program the JEP says *"causes almost 900 JDK classes to be loaded"*:

> *"This program runs in 90 milliseconds with an AOT cache that contains no profiles. After
> collecting profiles into the AOT cache, it runs in 73 milliseconds — an improvement of 19%. The
> AOT cache with profiles occupies an additional 250 kilobytes, about 2.5% more than the AOT cache
> without profiles."*

🔴 **That is the JEP's measurement of the JEP's microbenchmark, and it is quoted here for shape, not
for transfer.** It says: profiles are a small addition to the cache file, and they buy a
double-digit percentage of an already-short warm-up on a program that is nothing like a Spring
service. Do not carry the 19% into a design document. What you can carry is the direction and the
cost ratio.

## What the cache does not touch

A start-up budget for a real Spring service contains several items and class loading is only one of
them. None of the following is affected by any archive or cache:

- **Connection pool initialisation** — Hikari opening its minimum-idle connections, and the TCP and
  TLS handshakes each of those costs.
- **Schema validation or migration** — Hibernate's `ddl-auto` check, Flyway or Liquibase running.
- **Remote configuration fetches** — a config server, a secrets manager, a service-discovery
  registration.
- **DNS resolution** on first contact with each dependency ([03c](03c-musl-runtime-differences.md)).
- **Anything deliberately deferred to first request** — which the training run also did not archive
  ([05c](05c-the-training-run.md)).

⚠️ **Measure before you optimise.** If two of the five seconds are Flyway, an AOT cache addressing
the other three is a partial answer at best, and the cheaper win might be a different Flyway
configuration. This is a general instruction for the phase: the ordered plan from the phase gate
applies to start-up too — find where the time goes first.

## Where it pays, and where it does not

**It pays in proportion to how often the process starts.**

- **Scale-to-zero and serverless.** Every request may be a cold start. Start-up *is* latency.
- **Aggressive horizontal autoscaling.** Scaling out during a traffic spike is precisely when you
  cannot afford a slow start; a pod that takes 40 seconds to become ready arrives after the spike.
- **Rolling deploys across many replicas.** Start-up multiplies by replica count and sits on the
  critical path of every release, which sets how fast you can roll back.
- **Short-lived processes**: batch jobs, CLI tools, CI test JVMs, scheduled tasks. Here start-up can
  be most of the wall-clock time.
- **Constrained CPU.** A pod with a fraction of a core spends much longer on class loading and JIT
  than the same code on a workstation, so the same saving is a larger fraction.

**It does not pay much for:**

- **A long-lived service that starts once a month** and then runs at steady state. You are optimising
  a number that appears in your life twelve times a year.
- **A service whose start-up is dominated by I/O** rather than class loading — see the list above.
- **Anything where the build-step cost is not accepted.** The training run adds time to every image
  build, and on a multi-architecture build it is emulated on the non-native platform.

## The staleness question, answered by construction

Spring Boot's validity rule — the cache is good *"as long as the application is not updated and the
same Java version is used"* — plus the tool reference's three-way binding (classpath, JDK release,
OS/CPU) means there are exactly two ways to ship a stale cache:

1. **Building the cache outside the image**, so the application or JDK can change without the cache
   changing. Do not do this ([05c](05c-the-training-run.md)).
2. **Restoring the cache from a build cache** whose key does not cover all three bindings. If your CI
   caches `app.aot` between builds keyed on, say, the lockfile hash, a JDK base-image bump produces a
   cache that no longer loads — and thanks to `AOTMode=auto`, no error.

Both are avoided by the same rule: **regenerate on every image build, unconditionally.** The
training run is a context refresh; it is not expensive enough to be worth caching, and a wrong
cache-key is a silent regression.

## Gotchas

**★ Start-up, warm-up and peak throughput are three different numbers.** The cache moves the first
two. It cannot move the third, because the same JIT eventually produces the same code. Anyone
promising throughput gains from an AOT cache has confused warm-up with peak.

**★ A bad training run cannot poison production performance.** JEP 515: *"Profiles cached during
training runs do not prevent additional profiling during production runs."* The JVM keeps profiling.
The worst case is that the cached priors are useless, not that they are harmful.

**★ The JDK 25 man page and JEP 515 disagree about whether the cache stores profiles.** The man page
says profiles are a future addition; JEP 515 is Closed/Delivered for JDK 25. Do not quote the man
page's "future" wording as evidence that profiles are unavailable on JDK 25, and do not assume the
opposite either — check `-Xlog:aot` on your build.

**★ JEP 515's 19% is a microbenchmark of a `Stream` loop.** It is quoted in this phase because it is
documented and attributable, not because it predicts anything about a Spring service. Never put it
in a capacity plan.

**★ Class loading is only one item in a start-up budget.** Connection pools, schema validation,
remote config fetches and DNS are untouched. Profile your own start-up before assuming the cache is
the lever.

**★ A cache restored from a CI build cache is a silent-staleness machine.** The bindings are
classpath, JDK release and OS/CPU; a build-cache key rarely covers all three. Regenerate every
build.

**★ The training run costs build time on every architecture you publish.** On a multi-arch
`buildx` build the non-native platform is emulated. Budget for it, and consider whether you actually
publish for both architectures.

**★ "It made no difference" almost always means it did not load.** Before concluding the cache is not
worth it for your workload, prove it loaded with `-Xlog:aot` ([05e](05e-aot-modes-and-diagnosis.md))
and prove you are running the extracted form ([05c](05c-the-training-run.md)). Those two account for
most disappointment.

**★ Constrained CPU changes the answer.** The same class-loading work takes far longer on a fraction
of a core, so a saving that looks negligible on a laptop can be substantial in a pod with a 500m CPU
limit. Measure in a container with production's limits, not on a workstation.

**★ Spring's build-time AOT processing is a different lever with a similar name.** It reduces the
*work* at start-up rather than caching the results of doing it, and the two compose —
**`06-spring-boot-aot-processing.md`** *(not written yet)*.

**★ If start-up still dominates after all of this, the next step is a different technology, not a
better cache.** GraalVM native image (topic 11) and CRaC (topic 15) are the two answers, and both
cost far more than a build step. The AOT cache is what you try first precisely because it costs
almost nothing.

## Interview questions

**★ Does the AOT cache improve throughput?**
No. It improves start-up and, since JDK 25 and JEP 515, warm-up. Peak throughput is produced by the
JIT from profiles, and the JIT continues to profile in production either way — JEP 515 is explicit
that cached profiles *"do not prevent additional profiling during production runs"*. The steady state
is the same; you reach it sooner.

**★ What did JEP 515 add, and why is it safe?**
Method profiles in the AOT cache, so *"the JIT runs earlier and with more accuracy"*. It is safe
because the JVM keeps profiling at run time, so a training run whose behaviour diverges from
production degrades the benefit rather than the correctness or the eventual performance. That is the
key difference from ahead-of-time *compilation*, where a wrong prediction has to be undone.

**★ How would you decide whether an AOT cache is worth adopting for a given service?**
By how often the process starts and by where its start-up time actually goes. Scale-to-zero,
aggressive autoscaling, many-replica rolling deploys and short-lived jobs make start-up a
first-class latency number. Then measure the start-up budget: if most of it is Flyway, TLS
handshakes and config fetches, the cache addresses the smaller half. If most of it is class loading
and context refresh — which for a large Spring application it usually is — it is a good trade for one
build step.

**★ A team reports the AOT cache "made no difference". What do you check before believing them?**
Two things, in order. Did it load — `-XX:AOTMode=auto -Xlog:aot`, because the default is to degrade
silently. And are they running the extracted form, because Spring Boot documents that using the
cache with the uber jar *"has no effect"*. Only after both are ruled out is it worth discussing
whether class loading is their bottleneck.

**★ Could a training run make production slower?**
Not in any documented way. The cache stores classes, heap objects and profiles; the JVM continues to
profile and can re-optimise. The realistic downsides are build time, image size — an archive is
larger than the classes it holds — and a cache that fails to load and therefore does nothing.

**★ Why is "regenerate on every build" the rule rather than "cache it in CI"?**
Because the cache is bound to the classpath, the JDK release and the OS/CPU architecture, and no
ordinary build-cache key covers all three. A stale cache does not fail — `AOTMode=auto` degrades
quietly — so a wrong cache key produces an invisible regression. The training run is a context
refresh; it is not expensive enough to be worth that risk.

**★ Where does the AOT cache sit relative to native image and CRaC?**
It is the cheapest of the three and the only one that changes nothing about how your application
runs: same JVM, same JIT, same reflection, same diagnostics. Native image (topic 11) buys far more
start-up and footprint in exchange for a closed-world assumption and a different observability
story. CRaC (topic 15) restores a checkpointed process. Try the cache first, and reach for the other
two only when the cache has been proven insufficient with numbers.

{/* FOOTER */}
