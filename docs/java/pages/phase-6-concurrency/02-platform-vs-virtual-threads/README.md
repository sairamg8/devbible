---
title: "Platform vs virtual threads"
sidebar_label: "02 · Platform vs virtual threads"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JEP 444 (Virtual Threads, final in JDK 21),
> JEP 491 (Synchronize Virtual Threads without Pinning, JDK 24), the
> JDK 25 Javadoc for `java.lang.Thread`, `Thread.Builder` and
> `java.util.concurrent.Executors`, and the JDK 25 Core Libraries guide's
> virtual-threads chapter (docs.oracle.com/en/java/javase/25/core/).

**A platform thread is a thin wrapper over one OS thread — expensive to
create, capped in the low thousands, which is why two decades of Java
server code revolves around pooling and sharing them. A virtual thread is
a thread whose stack lives on the heap and whose execution *mounts* a
small pool of carrier threads only while it has work: when it blocks, it
unmounts and costs nothing but memory. That makes threads cheap enough to
stop sharing them — one thread per task, millions if needed — and revives
the simplest server design there is: thread-per-request, written as plain
blocking code. What virtual threads do NOT change is everything the rest
of this phase teaches: races, visibility, locks and coordination are
identical on both kinds.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What a thread costs](01-what-a-thread-costs.md)** | The 1:1 platform model, stacks and creation cost, why pools exist; the virtual model — heap stacks, carrier threads, the scheduler, mount/unmount at blocking points |
| 2 | **[What changed, what didn't](02-what-changed-what-didnt.md)** | Cheap blocking and the thread-per-request revival; throughput not speed; the memory model, races and interruption unchanged; observability differences |
| 3 | **[Using them well](03-using-them-well.md)** | `Thread.Builder`, `ofVirtual`, `newVirtualThreadPerTaskExecutor`; never pool virtual threads; limiting with semaphores; when platform threads still win; pinning in brief |

## Why this is a Master topic

- **It is the JDK 21+ server model.** Spring Boot, Helidon, Quarkus all
  ship a switch that puts every request on a virtual thread; knowing what
  that switch does is now table stakes for backend Java.
- **The mental model prevents two opposite mistakes** — pooling virtual
  threads (cargo-culted from platform habits, negates the point) and
  treating them as a concurrency-safety feature (they are a *cost*
  feature; every race survives the migration).
- **Interviews attack the boundary**: "are virtual threads faster?",
  "what happens to `synchronized`?", "why not use them for CPU work?" —
  all three are answered by the mount/unmount model, not by folklore.
- **Capacity planning changed shape** — the limit moved from "how many
  threads fit" to "how much *concurrent work* can downstream systems
  take", and chunk 3's semaphore pattern is the new knob.

## Where this connects

- **[Threads: lifecycle, interrupt](../01-threads-lifecycle-interrupt/README.md)** —
  states, daemons and the interruption protocol apply unchanged here.
- **[The JVM at run time](../../phase-0-platform-jvm/01-what-java-is/02-the-jvm-at-run-time.md)** —
  carrier threads are ordinary platform threads the JVM schedules onto
  cores.
- **[Immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)** —
  a million threads sharing mutable state is a million-way race; the
  immutability strategy scales where locking does not.
- **Phase 9 — Spring** flips `spring.threads.virtual.enabled` and runs
  controllers on these.

---

← Prev: [Threads: lifecycle, interrupt](../01-threads-lifecycle-interrupt/README.md) · Index: [Phase 6 — Concurrency](../README.md) · Next → [What a thread costs](01-what-a-thread-costs.md)
