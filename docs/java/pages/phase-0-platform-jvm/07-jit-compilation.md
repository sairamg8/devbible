---
title: "JIT compilation: interpreter → C1 → C2"
sidebar_label: "07 · JIT compilation"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the JDK 25 Java Virtual Machine Guide
> ([docs.oracle.com/en/java/javase/25/vm/](https://docs.oracle.com/en/java/javase/25/vm/)),
> the HotSpot glossary entries for tiered compilation and on-stack
> replacement, and JEP 483 / Project Leyden material for the AOT-cache note.

**HotSpot runs your bytecode three different ways over a method's lifetime:
interpreted (immediately, slowly), C1-compiled (quickly produced, lightly
optimized, still profiling), and C2-compiled (expensively produced,
aggressively optimized using everything the profile learned). Methods earn
promotion by being executed; compilation happens on background threads; and
optimizations are *speculative* — built on observed behaviour, and undone the
moment reality disagrees. Warm-up is not an implementation wart. It is the
strategy.**

## The tiered pipeline

Every method starts at tier 0 — the **interpreter** — which executes bytecode
instruction by instruction and, crucially, *counts*: invocations of the
method, and iterations of its loops (backedge counts). Cross a threshold and
the method is queued for compilation:

- **C1 (client compiler)** — compiles fast, optimizes lightly, and inserts
  profiling instrumentation: which branches are taken, which types actually
  flow through call sites, whether `null` ever shows up.
- **C2 (server compiler)** — for methods that stay hot: compiles slowly,
  optimizes hard, and *consumes* C1's profile to make bets (see below).

Compilation runs on **background compiler threads** — the application never
stops to wait for the JIT. Until the compiled version is ready, callers keep
using the current one; the swap happens at a safe point. For a long-running
loop, HotSpot can even replace the code *mid-loop* — **on-stack replacement
(OSR)** — so a hot `while` doesn't have to return before benefiting.

There is no persistent result: **compiled code dies with the process.** Every
restart begins at tier 0 again. (Project Leyden's AOT cache — JEP 483 lineage,
Phase 12's packaging topic — exists precisely to soften this by shipping some
of the warm-up work ahead of time.)

## Speculation: the reason JIT beats AOT here

C2's signature move is optimizing for what the profile *observed*, not what
the bytecode *allows*:

- A call site that only ever saw one implementation gets the virtual dispatch
  removed and the target **inlined** — even though, in principle, another
  subclass could exist.
- A branch never taken compiles to a bare check that jumps to an "uncommon
  trap" if it ever fires.
- A reference that was never `null` skips the general path.

**Inlining is the master optimization**: once a callee's body is pasted into
the caller, every other optimization (constant folding, escape analysis,
dead-code elimination) can see across the old call boundary. This is why
"many small methods" is *good* for JIT performance, and why hand-inlining
code for speed is counterproductive — you are doing badly what C2 does well.

When a bet goes wrong — a new class is loaded that overrides the method
everyone had inlined, the cold branch finally fires — the JVM
**deoptimizes**: it throws the compiled code away, falls back to the
interpreter, re-profiles, and recompiles under the new facts. Correctness is
never at stake; only the speed dips. (The machinery — uncommon traps, safe
points, class-hierarchy analysis — is topic 13.)

Compiled code lives in the **code cache**, a bounded native-memory region. If
it fills, compilation stops and the JVM warns — rare, but the log line
`CodeCache is full` explains an otherwise mysterious slowdown.

## What warm-up means operationally

The performance of a Java process is a function of how long — and on what
traffic — it has been running:

- **Deploys**: a freshly restarted instance serves its first requests from
  the interpreter and C1. Rolling restarts move a latency bump across the
  fleet. Mitigations: warm-up requests before joining the pool, gradual
  traffic ramping, and readiness gates that don't lie (Phase 9).
- **Autoscaling**: a new instance under instant full load is the worst case —
  cold code *and* peak traffic. Pre-warming or slow-start load-balancer
  policies exist for exactly this.
- **Benchmarks**: timing a loop with `System.nanoTime` measures an unknown
  mix of interpreter, OSR and partially-compiled code — plus dead-code
  elimination if the result is unused. JMH (Phase 12) exists because getting
  this wrong by hand is the norm, not the exception.
- **"Restart fixed it"** still costs the warm-up bill again — a reason to
  find the actual bug (Phase 12's tooling) rather than schedule restarts.

## Gotchas

**Symptom:** a hand-rolled benchmark shows an operation is "20× slower" than the same code measured later or elsewhere
**Cause:** the timed loop ran interpreted or mid-compilation — or C2 deleted the work entirely because the result was never used (dead-code elimination)
**Fix:** use JMH, which handles warm-up iterations, forking and result-sinking (blackholes); distrust any Java timing without a warm-up story

**Symptom:** p99 latency spikes for a minute after every deploy, then settles
**Cause:** warm-up — early traffic executes interpreter/C1 code while C2 compiles the hot paths observed under real load
**Fix:** expected; engineer around it (warm-up requests, traffic ramping) rather than chasing a regression that isn't one

**Symptom:** performance drops noticeably at a moment when a new plugin/module was loaded, then recovers
**Cause:** deoptimization — loading a new class invalidated speculative inlining built on "only one implementation exists", forcing recompilation under the new class hierarchy
**Fix:** nothing broken; recovery is automatic. Recognize the signature: a dip correlated with late class loading

**Symptom:** the whole service runs an order of magnitude slow, consistently, no warm-up recovery
**Cause:** the JIT is off — `-Xint` (interpreter-only, a debugging flag) left in the launch options, or the code cache filled and compilation stopped (`CodeCache is full` in the log)
**Fix:** remove `-Xint`; if the cache filled, raise `-XX:ReservedCodeCacheSize` and ask why so much code is hot

**Symptom:** refactoring a large method into small ones *improved* performance, to the team's surprise
**Cause:** huge methods can exceed inlining budgets and profile poorly; small methods inline cleanly and open cross-method optimization
**Fix:** not a fix — a lesson: write small methods for readability and let inlining do its job; never hand-merge methods "to save call overhead"

**Symptom:** a canary instance's metrics look worse than the fleet's, poisoning the comparison
**Cause:** the canary restarted most recently — its JIT state is coldest; the comparison conflates code version with warm-up state
**Fix:** compare after warm-up, or restart a control instance alongside the canary

## Interview questions

**★ Why are the first 100 requests after a deploy slower than the next 100,000?**
Execution starts in the interpreter while profiling counters find the hot
methods; C1 then C2 compile them on background threads, and steady-state
traffic runs C2-optimized native code. Compiled code doesn't survive
restarts, so every deploy repays the warm-up cost.

**★ What is tiered compilation?**
The default HotSpot pipeline: interpret first (tier 0), promote
frequently-executed methods to fast-but-light C1 compilation with profiling,
and promote the persistently hot ones to slow-but-aggressive C2 compilation
that exploits the gathered profile. Each tier trades compile cost for code
quality.

**★ What is deoptimization and what triggers it?**
Discarding compiled code and falling back to the interpreter because a
speculative assumption broke — typically a newly loaded class invalidating
inlining decisions, or a branch/type the profile said never happens finally
happening. It protects correctness; the cost is a temporary performance dip
followed by recompilation.

**★ Why does the JVM interpret at all instead of compiling everything up front?**
Compilation costs time and memory, most code is cold, and — decisively — the
JIT optimizes *better* with a run-time profile: it inlines the virtual calls
that are monomorphic in practice and specializes for observed types, which a
profile-less AOT compiler cannot do safely. Interpret-then-compile buys
information.

**What is on-stack replacement?**
Swapping a running method's execution from interpreted to compiled code in
the middle of a loop, without waiting for the method to return — how a hot
`main`-loop or batch job benefits from compilation it would otherwise never
re-enter.

**Why is inlining called the gateway optimization?**
Because it dissolves call boundaries: once the callee's body is inlined, the
optimizer can fold constants, eliminate dead code and analyse escapes across
what used to be a black-box call. Most of C2's wins start with an inline.

**Does JIT-compiled code survive a restart, and what follows from the answer?**
No — the code cache is process memory. Hence per-restart warm-up, hence JMH's
forked warm-up methodology, hence Project Leyden's AOT cache work to shift
some of that cost to build/first-run time (Phase 12).

---

← Prev: [main, startup and the config channels](06-main-startup-config.md) · Next → [Garbage collection, the working model](08-garbage-collection.md)
