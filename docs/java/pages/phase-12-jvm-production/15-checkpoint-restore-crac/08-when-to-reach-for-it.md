---
title: "The shape that justifies CRaC is narrow — long-lived JVM workloads whose cost is warm-up, on Linux, on a platform that grants CRIU privileges — and for almost everyone else the honest advice is to fix the startup instead"
sidebar_label: "08 · When to reach for it"
sidebar_position: 12
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **CRaC project documentation**
> ([github.com/CRaC/docs](https://github.com/CRaC/docs/blob/master/README.md)), the **Spring
> Framework 7.0** and **Spring Boot 4.1** checkpoint/restore references
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/checkpoint-restore.html)).
> 🔴 **No sandbox** — no measurements were taken, and no claim below rests on one.

**This topic's tier is "When needed", and this is the page that says when that is. It is the
shortest list in the phase.**

## The case *for*

All of these should be true, not some:

1. **Warm-up, not initialisation, is the cost.** You have measured latency over the first
   minute of an instance's life, not just read the boot log
   ([01](01-the-cold-start-problem.md)). If initialisation dominates, the AOT cache is cheaper
   and safer ([07](07-crac-vs-native-image-vs-aot-cache.md)).
2. **Cold instances are frequent and consequential.** Scale-to-zero, aggressive autoscaling, or
   a deployment cadence that keeps a meaningful fraction of the fleet cold.
3. **You need the JVM.** Dynamic behaviour, peak throughput under sustained load, or a
   dependency surface that makes native image impractical.
4. **Linux, with compatible CPUs across the fleet**, or a plan to pin `-XX:CPUFeatures`.
5. **The platform will grant CRIU privileges** — settled with the platform team before any code
   is written ([06](06-operating-it.md)).
6. **The security team accepts an image containing the heap**, with a home for it and a rebuild
   cadence ([04c](04c-secrets-and-the-snapshot.md)).
7. **You can build and maintain a canary step in the pipeline** that runs the application
   against real-shaped dependencies.

⚠️ **Requirements 4–7 are where evaluations end, and none of them is about your code.**

## The case *against* — the much more common one

> *"Automatic checkpoint/restore is a way to "fast-forward" the startup of the application to a
> phase where the application context is about to start, but it does not allow to have a fully
> warmed-up JVM."*

🔴 **If the cheap mode does not solve your problem and the expensive mode needs a canary
pipeline, the question becomes: why is startup slow at all?** In practice the answer is usually
one of a short list, and every item is fixable without any of this machinery:

- The context contacts remote services during refresh. Spring gives you the diagnostic for
  free — `-Dspring.context.exit=onRefresh` — described as *"useful to check if connections to
  remote services are required when the beans are not started, and potentially refine the
  configuration to avoid that"*.
- Eager creation of connection pools, caches and clients that nothing needs for a minute.
- Classpath scanning across a large dependency graph.
- Schema validation, migrations or index building at boot.
- A fat jar run without extraction, paying nested-jar reading cost on every start (topic 10).

⚠️ **Each of these makes every environment better** — local development, tests, CI — while CRaC
makes only production faster and adds an artefact to secure.

## Workload shapes, and the right answer for each

| Shape | Usually right |
|---|---|
| Long-running service, occasional deploys, slow scaling | Nothing; fix startup if it annoys you |
| Long-running service, aggressive autoscaling, warm-up-sensitive latency | **CRaC**, if the platform allows |
| Short-lived function, scale-to-zero, small dynamic surface | Native image |
| Batch job started thousands of times a day | AOT cache; native image if it fits |
| CLI tool | Native image, or the AOT cache |
| Anything on Windows or macOS in production | Not CRaC — it is Linux only |
| Anything where the heap must never be written to disk | Not CRaC |

## If you do adopt it

Keep the blast radius small: one service first, the one where the numbers are clearest.
Measure the whole path — image pull, restore, `afterRestore` work, first request — not the
restore alone ([06](06-operating-it.md)). And keep the non-CRaC path working, because a
platform policy change, a JDK upgrade lag or a CPU-family migration can take the capability
away with little notice.

🔴 **The `org.crac` shim makes that dual path nearly free**: on a JDK without CRaC the
registrations are accepted by a dummy implementation and the application runs normally
([03](03-the-resource-lifecycle.md)). Build the code so it degrades to an ordinary start.

## Gotchas

🔴 **"Our startup is slow" is not a CRaC diagnosis.** Distinguish initialisation from warm-up
first; they have different fixes and only one of them needs this.

🔴 **The automatic mode is not a cheap way to get CRaC's headline benefit.** By its own
documentation it does not give a warm JVM.

⚠️ **A proof of concept will succeed and prove little.** The API works quickly; the pipeline,
privilege and secret questions are the project.

⚠️ **Restoring many instances at once creates a synchronised connection storm** from
`afterRestore` handlers — the fast-scaling scenario is exactly the one that triggers it.

⚠️ **Adopting CRaC couples you to a JDK vendor's CRaC build** and to its release cadence.

⚠️ **Do not adopt it for developer experience.** It is a production deployment technique; local
start-up time is better served by fixing eager initialisation.

⚠️ **Revisit the decision when the JDK moves.** The AOT cache is improving quickly (JEP 483,
514, 515), and some of what motivates CRaC today may be cheaper to obtain tomorrow.

## Interview questions

**★ When is CRaC the right answer?**
When warm-up — not initialisation — is the dominant cost, cold instances are frequent and
consequential, you need a full JVM, you are on Linux with compatible CPUs, the platform grants
CRIU privileges, and the security team accepts an image containing the heap.

**★ What is the most common reason to *not* use it?**
That the real problem is initialisation, which is cheaper to fix directly or with the AOT
cache — or that the platform will not grant CRIU the privileges it needs.

**★ How do you tell initialisation cost from warm-up cost?**
Initialisation is what the boot log reports. Warm-up shows up as elevated latency on the first
requests after readiness. Measure the first minute of an instance's life, not the startup line.

**★ What free diagnostic should you run before considering CRaC?**
`-Dspring.context.exit=onRefresh`, which reaches the same lifecycle phase and exits without
needing CRaC, a CRaC JDK or Linux — revealing whether the context contacts remote services
during refresh.

**★ Why keep a non-CRaC path working?**
Because the capability can be withdrawn by a platform policy change, a JDK upgrade lag or a CPU
migration. The `org.crac` shim makes this nearly free: on a JDK without CRaC the application
starts normally.

**★ What is the risk when many instances restore simultaneously?**
A synchronised burst of `afterRestore` work — reconnecting pools, re-registering, refreshing
tokens — hitting downstream services at once. The fast scale-out scenario is precisely the one
that causes it.

**★ Would you adopt CRaC to speed up local development?**
No. It is a production technique with an operational and security cost. Slow local startup is
better addressed by removing eager initialisation, which improves every environment.

Next: [The checklist](09-the-checklist.md).

{/* FOOTER */}
