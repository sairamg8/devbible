---
title: "Three fast-start technologies, one comparison table: the AOT cache skips work the JVM would repeat, native image compiles the world ahead of time and throws the JIT away, and CRaC ships a running process — they are not three settings of one dial"
sidebar_label: "07 · CRaC vs native image vs AOT cache"
sidebar_position: 11
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **CRaC project documentation**
> ([github.com/CRaC/docs](https://github.com/CRaC/docs/blob/master/README.md)), the **Spring
> Boot 4.1** references for *AOT Cache*, *GraalVM Native Images* and *Checkpoint and Restore
> With the JVM* ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/)),
> the **Spring Framework 7.0** checkpoint/restore reference, and **JEP 483 / 514 / 515** for the
> AOT cache. Spring Boot's AOT-cache page states the version gate quoted below.
> 🔴 **No sandbox** — no startup, restore or build time on this page is a measurement, and none
> is quoted as one. Topic 10 owns the AOT cache in detail and topic 11 owns native image; this
> page owns only the comparison.

**The three are often presented as a ladder of increasing commitment. They are not — they
remove different work, fail in different ways, and two of them compose.**

## What each one actually removes

| | **AOT cache / CDS** (topic 10) | **GraalVM native image** (topic 11) | **CRaC** (this topic) |
|---|---|---|---|
| Class loading and linking | ✅ skipped — served from the cache | ✅ gone; done at build | ✅ already done in the image |
| Application initialisation | ❌ still runs | ✅ largely at build time | ✅ captured in the image |
| **JIT warm-up** | ❌ still cold (JEP 515 caches *profiles*, so profiling starts sooner) | n/a — **there is no JIT** | ✅ **restored warm** |
| Peak throughput | full JVM | ahead-of-time compiled, typically below a warmed JVM | full JVM, immediately |
| Dynamic features (reflection, proxies, dynamic loading) | unchanged | constrained; needs reachability metadata | unchanged |
| Platform | any | build per target | **Linux only** |
| Runtime needed | stock JDK | none — a native binary | **CRaC-enabled JDK + CRIU privileges** |
| Artefact | jar + cache file | native binary | jar + **image of your heap** |
| Build cost | a training run | a long native build | running the app in a canary |
| Security surface added | small | small | 🔴 **an image containing every secret the JVM saw** |

🔴 **The single row that matters most is JIT warm-up**, and only CRaC fills it. The single row
that kills most CRaC proposals is the platform-and-privileges row.

## The AOT cache, briefly

Spring Boot's documentation states the version gate directly: *"Spring Boot supports the AOT
cache for Java 25 and above. If you're using an earlier version of Java, you have to use CDS
instead"*, and recommends *"using the AOT cache whenever possible"*. The mechanism is a training
run that records what the application loads and links, and a production run that reads it back.

⚠️ **Its most-missed gotcha is a silent no-op**: *"You have to use the cache file with the
extracted form of the application, otherwise it has no effect."* Topic 10 owns this.

**Where it wins:** no new runtime, no platform restriction, no image containing data, and it
composes with everything. **Where it stops:** the JIT still starts cold.

## Native image, briefly

Ahead-of-time compilation under the closed-world assumption: everything reachable must be known
at build time, so reflection, dynamic proxies and resource loading need reachability metadata,
and Spring's AOT engine generates much of it for you.

**Where it wins:** the fastest start of the three, the smallest footprint, no JVM at all.
**Where it stops:** peak throughput is the compiler's, not a warmed JIT's; builds are long;
and anything genuinely dynamic is either configured or unsupported.

⚠️ **The comparison people get wrong is native image versus CRaC on *throughput*.** Native image
starts fastest; a restored CRaC process starts warm and keeps the JIT, so for a long-running
service under sustained load the JVM is usually the faster steady state. Different questions.

## Choosing, honestly

- **Start here for everyone:** reduce startup work, then adopt the AOT cache (or CDS below Java
  25). Low risk, no platform change, composes with the rest.
- **Native image** when start-up dominates and the workload is short-lived or scale-to-zero,
  when footprint matters, and when the application's dynamic surface is small enough to be
  configured.
- **CRaC** when the workload is long-lived enough that *warm-up*, not initialisation, is the
  cost — and when the platform will grant CRIU privileges and the security team accepts an
  image of the heap.
- **Nothing at all** when your service starts in two seconds, runs for weeks, and scales on a
  ten-minute horizon. That is most services.

🔴 **CRaC and the AOT cache are not alternatives — a restored process contains whatever the
checkpointed one had.** Native image and CRaC *are* alternatives: one has no JVM to snapshot.

## Gotchas

🔴 **"Fast start" is three different measurements**: time to first byte, time to steady-state
latency, and time from scale-out decision to serving. The three technologies rank differently on
each, and image pull time can dominate all of them.

⚠️ **Native image's throughput deficit and CRaC's warm restore are frequently compared with
numbers from different workloads.** Insist on the workload before believing a comparison — and
note this page quotes none.

⚠️ **The AOT cache's benefit disappears if you run the non-extracted jar.** Silent, and
documented.

⚠️ **CRaC's costs are mostly not in your codebase.** Build pipeline, base image, privileges,
secret handling — none of which appear in a proof of concept and all of which appear in
production.

⚠️ **Reachability metadata is a maintenance burden that grows with dependencies**, so a
native-image decision is a standing commitment, not a one-off build change.

⚠️ **Do not choose on start-up benchmarks alone.** Ask what the service's actual cost profile is:
a service restarted twice a week does not need any of this.

## Interview questions

**★ Which of the three removes JIT warm-up?**
Only CRaC, by restoring a process whose profiles and compiled code are already in memory. The
AOT cache reduces class loading and linking (and with JEP 515 caches method profiles so
profiling starts sooner); native image has no JIT at all.

**★ Why is native image not simply "better" than CRaC?**
Because it has no JIT: peak throughput is whatever the ahead-of-time compiler achieved, and
dynamic features need reachability configuration. A restored CRaC process is a full HotSpot JVM
that keeps optimising — better for long-running services under sustained load.

**★ What is the AOT cache's version gate?**
Java 25 and above; below that you use CDS instead. Spring Boot's documentation states this and
recommends the AOT cache whenever possible.

**★ Do CRaC and the AOT cache compete?**
No. A restored image contains whatever the checkpointed process had, so the two compose. Native
image and CRaC do compete — there is no JVM to snapshot.

**★ What is the biggest non-technical obstacle to CRaC?**
Platform and security: CRIU's privileges (a setuid-root binary in the runtime image) and an
image that contains every secret the JVM saw. Both are decided outside the application team.

**★ Which should a team try first?**
Reducing startup work, then the AOT cache or CDS. They are low-risk, require no platform change,
produce no artefact containing data, and compose with whatever comes later.

**★ When is the honest answer "none of these"?**
When the service starts in a couple of seconds, runs for weeks, and scales on a slow horizon.
None of these technologies pays for its complexity there.

Next: [When to reach for it](08-when-to-reach-for-it.md).

{/* FOOTER */}
