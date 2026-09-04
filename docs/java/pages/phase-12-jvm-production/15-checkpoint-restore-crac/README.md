---
title: "Checkpoint/restore with CRaC: the only fast-start technique in this phase that brings back a warm JVM, bought with a Linux-only runtime, a privileged CRIU binary, and a deployment artefact that contains every secret your process ever saw"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **CRaC project documentation**
> ([README](https://github.com/CRaC/docs/blob/master/README.md),
> [step-by-step guide](https://github.com/CRaC/docs/blob/master/STEP-BY-STEP.md),
> [best practices guide](https://github.com/CRaC/docs/blob/master/best-practices.md)), the
> **Spring Framework 7.0** reference "JVM Checkpoint Restore"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/checkpoint-restore.html)),
> and the **Spring Boot 4.1** reference "Checkpoint and Restore With the JVM". JVM behaviour
> cross-checked against the **HotSpot compilation policy** header at `jdk-25+36`.
> Version spine: JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · `org.crac:crac` 1.4.0+.
> 🔴 **No sandbox** — no checkpoint was taken, no image created and no restore timed. Every
> transcript, exception and quotation on these pages comes from the projects' own
> documentation and is attributed where it appears; **no startup or restore number is quoted as
> a measurement**.

**A Java service has two start-up costs — initialisation and JIT warm-up — and almost every
mitigation addresses only the first. CRaC addresses both, by not starting at all: it restores a
process image of a JVM that was already running and already warm. That is a genuinely different
capability, and it is bought at a price paid almost entirely outside your source code.**

This is the third member of the phase's fast-start trio: **topic 10** owns CDS and the AOT
cache, **topic 11** owns GraalVM native image, and this topic owns checkpoint/restore — and the
comparison table between all three.

**13 chunks.** Read in order; each links to the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The cold-start problem](01-the-cold-start-problem.md)** | <span className="db-tier t-when">When Needed</span> | Initialisation and warm-up are different costs; only one is in your logs |
| 2 | **[What CRaC is](02-what-crac-is.md)** | <span className="db-tier t-when">When Needed</span> | CRIU with the application's consent — and the three commands |
| 3 | **[Warm, not just started](02b-warm-not-just-started.md)** | <span className="db-tier t-when">When Needed</span> | 🔴 The differentiator: profiles, compiled code and heap all survive |
| 4 | **[The resource lifecycle](03-the-resource-lifecycle.md)** | <span className="db-tier t-when">When Needed</span> | Two methods, one registry — and it holds weak references |
| 5 | **[What must be released](04-what-must-be-released.md)** | <span className="db-tier t-when">When Needed</span> | The checkpoint refuses, names the socket, and makes you fix it |
| 6 | **[What changes across a restore](04b-what-changes-across-a-restore.md)** | <span className="db-tier t-when">When Needed</span> | Time jumped, tokens expired, DNS moved, the PRNG is a clone |
| 7 | **[Secrets and the snapshot](04c-secrets-and-the-snapshot.md)** | <span className="db-tier t-when">When Needed</span> | 🔴 The image is your heap. Treat it as a credential |
| 8 | **[Spring Boot support](05-spring-boot-support.md)** | <span className="db-tier t-when">When Needed</span> | Checkpoint/restore mapped onto the bean `Lifecycle` contract |
| 9 | **[The two modes](05b-the-two-modes.md)** | <span className="db-tier t-when">When Needed</span> | On-demand gives warmth; `onRefresh` explicitly does not |
| 10 | **[Operating it](06-operating-it.md)** | <span className="db-tier t-when">When Needed</span> | Canary pipeline, CRIU privileges, CPU features, image lifecycle |
| 11 | **[CRaC vs native image vs AOT cache](07-crac-vs-native-image-vs-aot-cache.md)** | <span className="db-tier t-when">When Needed</span> | 🔴 The comparison table this topic owns |
| 12 | **[When to reach for it](08-when-to-reach-for-it.md)** | <span className="db-tier t-when">When Needed</span> | A narrow shape — and the much more common "fix the startup" |
| 13 | **[The checklist](09-the-checklist.md)** | <span className="db-tier t-when">When Needed</span> | Deciding, then the readiness list before you try |

## The five things this topic is really about

**1 · Coordination is the feature.** An uncoordinated process snapshot would restore holding
sockets and files that no longer exist. CRaC notifies the application before the checkpoint and
after the restore, and — crucially — **aborts the checkpoint** if an open file or socket remains,
naming it in the exception. Adoption is therefore a series of small, legible failures rather than
one large mystery.

**2 · "Warm" means the whole memory image.** Loaded classes, method profiles, C2-compiled code,
inline caches, a populated application heap. Spring Boot's reference adds the clause that answers
the native-image objection: the restored process *"retains all the capabilities of the HotSpot
JVM, including further JIT optimizations at runtime"*.

**3 · The cheap mode does not deliver the headline benefit.**
`-Dspring.context.checkpoint=onRefresh` fast-forwards initialisation but, in the framework's own
words, *"does not allow to have a fully warmed-up JVM"*. Warmth requires checkpointing a process
that has served real traffic — which requires a canary environment with real dependencies.

**4 · The image is a credential.** Spring's documentation says twice that the checkpoint files
contain a representation of the JVM's memory and that you should assume **any value the JVM saw**
is in them. Shipping the image inside a container image — the most convenient deployment — makes
the heap readable to anyone who can pull the container.

**5 · The blockers are not in your code.** Linux only. A vendor CRaC JDK. A setuid-root `criu`
binary and the privileges to go with it, at *restore* time as well as checkpoint time. Matching
CPU features across the fleet. An artefact the size of your heap, with a shelf life. Most
evaluations end at one of these, and most services should fix their startup instead.

## The phase gate this topic serves

For *"p99 latency doubled after the deploy"*, this topic supplies a specific and frequently
missed hypothesis: **the deploy did not make the code slower, it made the fleet cold**. Knowing
that warm-up is a separate, invisible cost — and knowing the three ways to remove it and what
each one really costs — is what stops that investigation from chasing a change that never
happened.

{/* FOOTER */}
