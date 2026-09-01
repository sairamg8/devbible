---
title: "There are two Spring modes and they are not two settings of one feature — one fast-forwards initialisation with no CRIU and no warm JVM, the other snapshots a process that has actually served traffic, and only the second delivers the thing you came for"
sidebar_label: "05b · The two modes"
sidebar_position: 9
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0** reference, "JVM Checkpoint Restore"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/checkpoint-restore.html)) —
> both mode sections quoted below — and the **Spring Boot 4.1** checkpoint/restore page, which
> names the modes as *"on demand checkpoint/restore of a running application"* and *"automatic
> checkpoint/restore at startup"*. 🔴 **No sandbox.**

**Choosing between them is choosing how much warmth you want and how much operational
machinery you are willing to build for it.**

## Mode A · On-demand checkpoint of a running application

The process starts normally, serves traffic, and is checkpointed when you decide it is warm.

> *"A checkpoint can be created on demand, for example using a command like
> `jcmd application.jar JDK.checkpoint`. Before the creation of the checkpoint, Spring stops all
> the running beans, giving them a chance to close resources if needed by implementing
> `Lifecycle.stop`. After restore, the same beans are restarted, with `Lifecycle.start` allowing
> beans to reopen resources when relevant."*

The payoff, and its price, in one paragraph of the reference:

> *"If the checkpoint is created on a warmed-up JVM, the restored JVM will be equally
> warmed-up, allowing potentially peak performance immediately. This method typically requires
> access to remote services, and thus requires some level of platform integration."*

🔴 **"Requires access to remote services" is the operational cost.** To warm the JVM you must
run real request paths, which means the checkpointing environment needs a database, a broker,
downstream services — a canary environment, which is exactly how the CRaC project describes the
deployment flow: an application is deployed to a canary environment, processes canary requests
*"that triggers class loading and JIT compilation"*, is checkpointed, and the image becomes
*"part of a new deployment bundle"*.

⚠️ **This mode is also the one where the `@Scheduled(fixedRate)` catch-up applies** — Spring
attaches that warning specifically to on-demand checkpoint/restore
([04b](04b-what-changes-across-a-restore.md)).

## Mode B · Automatic checkpoint at startup

One system property, no traffic, no canary:

> *"When the `-Dspring.context.checkpoint=onRefresh` JVM system property is set, a checkpoint is
> created automatically at startup during the `LifecycleProcessor.onRefresh` phase. After this
> phase has completed, all non-lazy initialized singletons have been instantiated, and
> `InitializingBean#afterPropertiesSet` callbacks have been invoked; but the lifecycle has not
> started, and the `ContextRefreshedEvent` has not yet been published."*

🔴 **Read the lifecycle position precisely, because it is the whole design.** Singletons exist
and `afterPropertiesSet` has run — so bean graph construction, configuration parsing and
classpath scanning are all captured — but the lifecycle has not started, so the web server is
not listening and listener containers are not consuming. That is why this mode needs far less
resource coordination: most of the things that would abort a checkpoint have not been opened
yet.

And the limitation, stated by the reference itself:

> *"Automatic checkpoint/restore is a way to "fast-forward" the startup of the application to a
> phase where the application context is about to start, but it does not allow to have a fully
> warmed-up JVM."*

⚠️ **So mode B competes with CDS and the AOT cache** (topic 10), not with mode A. It removes
initialisation, not warm-up — and it does so at the cost of a Linux-only CRaC JDK and an image
containing your heap.

## The third thing, which is not a mode

> *"For testing purposes, it is also possible to leverage the `-Dspring.context.exit=onRefresh`
> JVM system property which triggers similar behavior, but instead of creating a checkpoint, it
> exits your Spring application at the same lifecycle phase without requiring the Project CraC
> dependency/JVM or Linux. This can be useful to check if connections to remote services are
> required when the beans are not started, and potentially refine the configuration to avoid
> that."*

🔴 **This runs anywhere and costs nothing, and it is the most useful thing in this topic for
most teams.** It answers "does my context talk to the network during refresh?" — which is the
question behind slow startup, behind failing automatic checkpoints, and behind the AOT-cache
training run in topic 10.

## Choosing

| | Mode A · on-demand | Mode B · `checkpoint=onRefresh` |
|---|---|---|
| Warm JVM after restore | ✅ yes, if warmed before checkpoint | ❌ no, explicitly |
| Needs remote services at checkpoint time | yes | no |
| Resource coordination required | substantial — everything is open | modest — lifecycle not started |
| Where the checkpoint happens | canary environment | build |
| Operational machinery | canary + image pipeline | one system property |
| Image contains your heap | yes | yes |

⚠️ **Both modes produce an image with the same security properties**
([04c](04c-secrets-and-the-snapshot.md)) — mode A's is worse in practice because real traffic
has flowed through it.

## Gotchas

🔴 **Mode B does not give you a warm JVM.** If warm-up was the reason to adopt CRaC, the cheap
mode does not solve your problem.

🔴 **`spring.context.exit=onRefresh` is a diagnostic, not a deployment mode.** It exits the
application; it does not create anything.

⚠️ **In mode B, the checkpoint is taken before `ContextRefreshedEvent`.** Code hanging off that
event runs *after restore*, on every restored instance — occasionally exactly what you want, and
occasionally a surprise.

⚠️ **A bean that opens a connection in `afterPropertiesSet` will still abort a mode-B
checkpoint.** "Lifecycle not started" is not "nothing is open"; eager initialisation in
construction is still eager.

⚠️ **Mode A means your build pipeline now includes running the application against real
dependencies.** That is a substantial infrastructure commitment, and the image it produces is a
deployment artefact with a shelf life.

⚠️ **Mixing the modes is not a plan.** Decide which one the deployment is built around; they
imply different pipelines and different security postures.

## Interview questions

**★ What are the two Spring checkpoint/restore modes?**
On-demand checkpoint/restore of a running application, triggered when you choose (for example
with `jcmd … JDK.checkpoint`), and automatic checkpoint at startup with
`-Dspring.context.checkpoint=onRefresh`.

**★ Exactly where in the lifecycle does the automatic checkpoint happen?**
During `LifecycleProcessor.onRefresh`: after all non-lazy singletons are instantiated and
`InitializingBean#afterPropertiesSet` callbacks have run, but before the lifecycle starts and
before `ContextRefreshedEvent` is published.

**★ Which mode gives a warm JVM?**
Only the on-demand mode, and only if the process was actually warmed before the checkpoint. The
reference says the automatic mode *"does not allow to have a fully warmed-up JVM"* — it
fast-forwards startup.

**★ Why does the on-demand mode require platform integration?**
Because warming means serving representative traffic, which requires access to the remote
services the application depends on — in practice a canary environment whose output becomes part
of the deployment bundle.

**★ What is `-Dspring.context.exit=onRefresh` for?**
Testing. It reaches the same lifecycle phase and exits instead of checkpointing, without needing
CRaC, a CRaC JDK or Linux — useful for discovering whether the context contacts remote services
during refresh.

**★ Does the automatic mode remove the need for resource coordination?**
It reduces it, because the lifecycle has not started so servers and listeners are not open. It
does not remove it: anything opened during bean construction or `afterPropertiesSet` will still
abort the checkpoint.

**★ What should mode B be compared against?**
CDS and the AOT cache, which also cut initialisation without a warm JVM — and do so without
Linux-only constraints, CRIU privileges or an image containing your heap.

Next: [Operating it](06-operating-it.md).

{/* FOOTER */}
