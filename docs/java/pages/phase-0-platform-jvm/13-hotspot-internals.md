---
title: "HotSpot internals"
sidebar_label: "13 · HotSpot internals"
sidebar_position: 13
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against the HotSpot Virtual Machine Garbage Collection and
> compilation sections of the JDK 25 documentation, the OpenJDK HotSpot
> glossary ([openjdk.org/groups/hotspot](https://openjdk.org/groups/hotspot/)),
> and the JITWatch project documentation.

**Below topic 07's "interpreter, then C1, then C2" summary sits machinery you
need perhaps twice a career: tiered compilation's actual levels, speculative
optimization and its undo button (deoptimization), and intrinsics. This page
is a map for those two occasions — a benchmark that makes no sense, or a
performance regression that follows a seemingly innocent refactor — not
study material.**

## The five tiers

HotSpot's tiered compilation, precisely:

| Tier | What runs | Purpose |
|---|---|---|
| 0 | Interpreter | Start instantly, gather full profiles |
| 1 | C1, no profiling | Trivial methods — compile once, done |
| 2 | C1, light profiling | Fallback path when C2 is backed up |
| 3 | C1, full profiling | The normal staging tier — fast code that keeps counting |
| 4 | C2 | The optimizing compiler — speculative, profile-guided, where peak throughput comes from |

The typical journey is 0 → 3 → 4. Compilation happens on background threads;
generated native code lives in the **code cache**, a fixed-size native memory
region (`-XX:ReservedCodeCacheSize` names its cap).

## Speculation and deoptimization

C2's defining move is **betting on the profile**. If a call site only ever
saw one receiver class, C2 devirtualizes and inlines it, guarded by a cheap
check — plus class-hierarchy analysis, null-check elimination, branch pruning
for never-taken paths. Each bet carries an **uncommon trap**: if the
assumption ever fails, execution *deoptimizes* — falls back to the
interpreter mid-method, discards the compiled code, and recompiles later with
the corrected profile.

Two practical phenomena follow:

- **Profile pollution / megamorphic call sites.** A call site with one or two
  observed receiver types (mono/bimorphic) inlines; at three or more
  (megamorphic) it degrades to a real virtual dispatch. Code shared by many
  types can thus be fast in isolation and slower in real traffic — and
  *adding a third implementation of an interface can slow down call sites
  that never see it*, which is the classic "innocent refactor, measurable
  regression".
- **Warm-up is not monotonic.** A phase change in traffic can invalidate
  yesterday's speculation, causing a deopt-recompile blip — visible as a
  brief latency spike with no external cause.

## Intrinsics

Some methods are **compiler-known**: the JIT replaces the call with hand-tuned
machine code instead of compiling the Java body — `System.arraycopy`,
`Math.min`/`max`/`sqrt`, `String` comparison/copy hot paths, CRC32,
`Long.numberOfLeadingZeros`, array fill/compare, and (on capable CPUs) AES
and vector operations. Consequences worth knowing:

- Stdlib "utility" calls can be *faster than your straightforward loop* —
  another reason not to hand-roll `arraycopy`.
- A benchmark of "my loop vs the library call" is often measuring an
  intrinsic, not Java-vs-Java.

## Seeing it, when you must

All observation flags are diagnostic output switches — syntax here, output
shapes in the tools' own docs:

```bash
java -XX:+PrintCompilation ...                         # compilation events per method
java -XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining ...   # inlining decisions
java -XX:+PrintFlagsFinal -version                     # every flag's effective value
```

**JITWatch** turns the JIT's log (`-XX:+LogCompilation`) into a browsable
view of tiers, inlining and deopts — the right tool the day this page becomes
load-bearing. **JFR** (Phase 12) records compilation and code-cache events
continuously in production.

## When this knowledge actually pays

1. **Benchmark forensics** — results that flip between runs, or degrade when
   a second implementation is registered: suspect profile pollution, warm-up,
   OSR, or an intrinsic; reach for JMH's discipline (Phase 12) and JITWatch.
2. **Post-refactor regression with "no logic change"** — a method grew past
   inlining thresholds, a call site went megamorphic, or an intrinsic-backed
   call was replaced by a hand-rolled loop.
3. **Code cache pressure** — the JVM warns when the code cache fills;
   compilation stops and un-compiled paths stay interpreted. Seen in
   pathological cases (massive generated code, agents); the dial is
   `ReservedCodeCacheSize`.

Everything else about HotSpot you can enjoy from a distance.

## Gotchas

**Symptom:** microbenchmark says the hand-written loop beats `System.arraycopy`
**Cause:** broken benchmark — dead-code elimination or missing warm-up; `arraycopy` is an intrinsic and is not beaten by a plain Java loop
**Fix:** JMH with blackholes and warm-up iterations (Phase 12's benchmarking topic); distrust any nanoTime-around-a-loop result

**Symptom:** adding a third implementation of an interface slowed down code paths that never use it
**Cause:** shared call sites went megamorphic — inlining and devirtualization gave way to real virtual dispatch
**Fix:** usually accept it (the cost is small at service scale); in genuinely hot inner loops, split the call site per type or avoid the shared funnel — but only with profiler evidence

**Symptom:** brief latency spike with no GC pause and no external cause, then normal
**Cause:** a phase change triggered deoptimization and recompilation — speculation adjusting to new traffic shape
**Fix:** recognition; if recurring, JFR's compilation events confirm it, and steadier traffic mixes or warm-up routing smooth it

**Symptom:** "CodeCache is full. Compiler has been disabled" warning; throughput slowly degrades
**Cause:** compiled-code storage exhausted — new hot methods stay interpreted
**Fix:** raise `-XX:ReservedCodeCacheSize`; investigate what generated so much code (agents, massive generated sources, method handles)

**Symptom:** engineer "optimizes" by marking everything `final` for the JIT
**Cause:** folklore — HotSpot already speculates non-overridden methods effectively via class-hierarchy analysis
**Fix:** use `final` for design intent (Phase 1); expect no measurable JIT difference from it

## Interview questions

**★ What is deoptimization and why is it central to how HotSpot works?**
C2 compiles speculatively — assuming the profile (single receiver type,
never-taken branches, non-null values) holds. Deoptimization is the undo:
when a guard fails, execution transfers back to the interpreter and the
method recompiles with corrected assumptions. It is what lets HotSpot
optimize as aggressively as a closed-world compiler *without* being wrong.

**★ Why can adding an implementation of an interface slow existing code?**
Call sites are profiled by receiver type: one or two types allow
devirtualization and inlining; a third makes the site megamorphic and forces
virtual dispatch — at every caller sharing that site, including ones that
never see the new type.

**What are intrinsics?**
Methods the JIT recognizes and replaces with hand-tuned machine code rather
than compiling their Java bodies — `System.arraycopy`, key `Math` and
`String` operations, CRC32, AES on capable CPUs. One more reason stdlib calls
beat hand-rolled equivalents.

**What are C1 and C2, and why have both?**
Two JIT compilers: C1 compiles fast with light optimization (tiers 1–3,
keeps profiling); C2 compiles slowly with heavy profile-guided optimization
(tier 4). The tiered pipeline gets code off the interpreter quickly while
reserving expensive compilation for proven hot spots.

**What is the code cache?**
The fixed-size native region storing JIT output. If it fills, compilation
stops and performance quietly degrades — the rare failure mode
`ReservedCodeCacheSize` exists for.

**A colleague's benchmark shows Java "getting faster the longer it runs, then suddenly slower once". Explain both.**
Faster: tier progression 0 → 3 → 4 as profiles mature. The one-off slowdown:
a deoptimization — some speculation failed (new type observed, rare branch
taken), execution dropped to the interpreter, then recompiled.

---

← Prev: [Java vs Kotlin vs the JVM ecosystem](12-java-vs-kotlin.md) · Index: [Phase 0 — The platform and the JVM](README.md)
