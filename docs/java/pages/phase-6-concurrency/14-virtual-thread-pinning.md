---
title: "Virtual-thread pinning"
sidebar_label: "14 · Virtual-thread pinning"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against JEP 491 (Synchronize Virtual Threads
> without Pinning, JDK 24), JEP 444 (Virtual Threads — the original
> pinning description), the JDK 25 Core Libraries virtual-threads guide,
> and the JDK 24 release notes (removal of the
> `jdk.tracePinnedThreads` property).

**A virtual thread is *pinned* when it blocks but cannot unmount from its
carrier — so the cheap park you were promised becomes an expensive one: a
real OS thread sits blocked underneath. For two JDK releases the loudest
cause was `synchronized`, and a whole generation of migration guides said
"rewrite hot locks to `ReentrantLock`". JDK 24 (JEP 491) fixed monitors
properly, which makes this a topic with a before and an after: you need
the *after* to run current JDKs well, and the *before* to recognize
obsolete advice — which you will keep meeting in blog posts, codebases and
interviews.**

## What pinning is

Normally a virtual thread that blocks **unmounts**: its stack moves to the
heap, the carrier picks up other work
([how mounting works](02-platform-vs-virtual-threads/01-what-a-thread-costs.md)).
Pinned means blocked *without* unmounting — the carrier blocks too. One
pinned thread is noise; N of them (N = carrier count, default ≈ cores) is
**carrier starvation**: every virtual thread in the process stops being
scheduled, and the service stalls at a throughput cliff that no metric
named "thread count" will explain.

## The before and after

| Cause of pinning | JDK 21–23 | JDK 24+ (JEP 491) |
|---|---|---|
| blocking inside `synchronized` (monitor acquisition, or I/O while holding one) | pins | **fixed** — unmounts like any block |
| `Object.wait()` | pins | **fixed** — unmounts |
| native frame on the stack (JNI, FFM upcall) | pins | still pins |
| some file-system I/O | occupies the carrier | same — but compensated (below) |

JEP 491's change is structural: monitor state was moved off the carrier so
ownership survives unmounting — `synchronized` blocking now parks the
virtual thread, frees the carrier, and reacquires on wake. That is why
the old advice — *convert hot `synchronized` blocks that block inside to
`ReentrantLock` so virtual threads can unmount* — is **legacy guidance**:
correct for 21–23, obsolete on 24+. Choose locks for their features again
([lock choice](04-synchronized-intrinsic-locks/03-choosing-the-lock-object.md)),
not for virtual-thread survival.

What remains on JDK 25:

- **Native frames pin.** A virtual thread executing JNI/FFM code, or Java
  code called *from* native, cannot unmount — its stack can't be safely
  relocated under a native frame. Blocking done inside or below native
  code holds the carrier for the duration.
- **File I/O occupies the carrier** — most OS file APIs have no
  non-blocking form. This is not classified as pinning; the scheduler
  **compensates** by temporarily growing the carrier pool while the
  operation runs, so it degrades gracefully rather than starving. Native
  pinning gets no such compensation.
- **Class initializers** and a few other VM-internal moments can also
  briefly pin — rarely operationally relevant, worth knowing they exist.

## Detecting it

The JFR event **`jdk.VirtualThreadPinned`** is emitted when a virtual
thread parks while pinned (default threshold 20 ms) and carries the stack
that pinned. Watch it in production via your JFR pipeline or
`jfr print --events jdk.VirtualThreadPinned recording.jfr`.

The JDK 21-era quick check, `-Djdk.tracePinnedThreads=full|short` —
printing a stack when pinning occurred — **was removed in JDK 24**
alongside JEP 491 (it also had deadlock problems of its own). If a
runbook tells you to set it on a current JDK, the runbook is dated: the
JFR event is the mechanism. (The syllabus row for this topic predates
that removal — treat this page as the correction.)

## What to actually do

1. **Be on JDK 24+.** The dominant historical cause is then simply gone —
   most services need nothing else.
2. **Leave `synchronized` alone** (on 24+). Rewrites to `ReentrantLock`
   for pinning reasons add complexity for zero benefit now; keep or
   revert them on their lock-feature merits alone.
3. **Audit the native boundary, not the lock sites.** JDBC drivers,
   crypto providers, compression libs and image codecs with native cores
   are where real pinning persists. If a hot path blocks below JNI,
   either route that work to a small platform-thread executor or accept
   and size for the carrier occupancy.
4. **Keep the JFR event on** with a threshold you'd page on; alert on
   sustained pinned-time, not single events.
5. **Stuck on 21–23?** The old advice is *your* advice: find
   blocks-inside-`synchronized` on hot paths with the pinned events and
   convert those to `ReentrantLock`; upgrade as the actual fix.

## Gotchas

**Symptom:** service on JDK 21 stalls completely under load; dumps show all FJ carrier threads `BLOCKED` entering monitors
**Cause:** pre-491 synchronized pinning — every carrier is stuck under a pinned virtual thread; nothing else can be scheduled
**Fix:** upgrade to 24+; interim: convert the specific hot `synchronized`-then-block sections to `ReentrantLock` and confirm with pinned events

**Symptom:** after upgrading to JDK 24, `jdk.VirtualThreadPinned` events almost disappear — but a few remain, always with the same driver frames
**Cause:** the survivors are native-frame pinning (JNI in the driver); JEP 491 fixed monitors, not native code
**Fix:** move calls through that driver to a bounded platform-thread executor, or size carrier count accepting the occupancy; ask the vendor about their pure-Java path

**Symptom:** team spent a sprint replacing every `synchronized` with `ReentrantLock` "for virtual threads" on a JDK 25 codebase
**Cause:** legacy guidance applied after its expiry date
**Fix:** stop the migration; on 24+ the JVM unmounts blocked monitor waiters — revert where `synchronized` was the simpler and sufficient tool

**Symptom:** `-Djdk.tracePinnedThreads=full` set per an old runbook; no output ever appears on JDK 25
**Cause:** the property was removed in JDK 24 — silently ignored now
**Fix:** record JFR and read `jdk.VirtualThreadPinned`; update the runbook

**Symptom:** heavy file-processing service shows carriers frequently occupied though nothing reports as "pinned"
**Cause:** file I/O isn't pinning — it occupies the carrier with temporary-pool compensation, and may not cross the pinned-event threshold
**Fix:** usually nothing — compensation is the design; if the extra platform threads matter (memory, limits), throttle concurrent file ops with a semaphore

## Interview questions

**★ Define pinning and explain why a few pinned threads can stall a whole service.**
Pinning is a virtual thread blocking while unable to unmount, so its
carrier — a real OS thread — blocks with it. The carrier pool is tiny
(≈ core count): pin all of them simultaneously and no virtual thread in
the process can run at all. The failure is a cliff, not a slope, and
arrives under exactly the load that makes blocking likely.

**★ What did JEP 491 change, mechanically?**
Pre-24, monitor ownership and wait-queue state were tied to the carrier,
so a virtual thread blocking on (or inside) `synchronized` couldn't
unmount. JDK 24 re-implemented monitor support so ownership belongs to
the virtual thread itself: blocking on monitor entry or `Object.wait()`
now unmounts, freeing the carrier, and the thread remounts to continue
after acquiring. Result: `synchronized` and `Object.wait` are no longer
pinning causes.

**★ What still pins on JDK 25, and what merely occupies a carrier?**
Pins: native frames — JNI or FFM anywhere on the stack (the stack can't
be relocated under native activation records), plus corner cases like
class initialization. Occupies-with-compensation: blocking file-system
I/O — the scheduler temporarily grows the carrier pool, so it costs extra
platform threads rather than scheduling starvation. The operational
difference: native pinning starves; file I/O degrades.

**★ How do you detect pinning in production, and what happened to `jdk.tracePinnedThreads`?**
JFR: the `jdk.VirtualThreadPinned` event (default 20 ms threshold) with
the pinning stack; aggregate and alert on pinned time. The
`jdk.tracePinnedThreads` system property from JDK 21 was removed in
JDK 24 with JEP 491 — on current JDKs it does nothing, and guides that
mention it are pre-24.

**★ You inherit a 2024-era PR converting `synchronized` to `ReentrantLock` "for Loom". Approve or revert on JDK 25?**
Interrogate it feature by feature: on 25 the pinning rationale is void
(JEP 491), so keep the conversion only where `ReentrantLock`'s actual
features earn it — `tryLock` timeouts, interruptible acquisition,
fairness, multiple conditions. Where it was a mechanical swap, prefer
reverting to `synchronized`: less API surface, no unlock-in-`finally` to
get wrong, and identical virtual-thread behaviour now.

---

← Prev: [Reading the dump; livelock and starvation](13-deadlock-livelock-starvation/02-dumps-livelock-starvation.md) · Index: [Phase 6 — Concurrency](README.md) · Next → [Immutability as the first strategy](15-immutability-first-strategy/README.md)
