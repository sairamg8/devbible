---
title: "\"CodeCache is full. Compiler has been disabled\" is the message everybody quotes and the one a default JDK 25 JVM does not print — it names the segment instead, and the compiler comes back on afterwards, which makes every runbook written before code cache flushing wrong in both halves"
sidebar_label: "05b · When the code cache fills"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** for
> `-XX:+UseCodeCacheFlushing`, `-XX:ReservedCodeCacheSize`, the segment size flags and the Code
> Heap State Analytics section
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the JDK 25 HotSpot source at tag `jdk-25+36` — `src/hotspot/share/code/codeCache.cpp`
> (`report_codemem_full`, `maybe_restart_compiler`, `gc_on_allocation`,
> `disable_compilation_forever`)
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/code/codeCache.cpp)).
> ⚠️ The man page's Code Heap State Analytics section is **stale** and is flagged as such below.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[05](05-the-code-cache.md) established that the code cache is native, defaults to 240 MB, and
is three segments rather than one. This page is what the JVM actually does when one of them
fills — which is not what the widely-quoted message and the widely-repeated consequence
describe, because both come from a JVM that stopped existing several releases ago. What it costs
you and how to find it is [05c · Diagnosing code cache pressure](05c-diagnosing-code-cache-pressure.md).**

## The message names the heap, not the cache

From `codeCache.cpp::report_codemem_full`:

```cpp
if (SegmentedCodeCache) {
  msg1_stream.print("%s is full. Compiler has been disabled.",
                    get_code_heap_name(code_blob_type));
  msg2_stream.print("Try increasing the code heap size using -XX:%s=",
                    get_code_heap_flag_name(code_blob_type));
} else {
  msg1_stream.print("CodeCache is full. Compiler has been disabled.");
  msg2_stream.print("Try increasing the code cache size using -XX:ReservedCodeCacheSize=");
}
```

🔴 **The famous string is in the `else` branch.** On a default JDK 25 JVM `SegmentedCodeCache` is
on ([05](05-the-code-cache.md)), so what you actually get names the specific segment:

```
CodeHeap 'profiled nmethods' is full. Compiler has been disabled.
Try increasing the code heap size using -XX:ProfiledCodeHeapSize=
```

`CodeCache is full` appears only with `-XX:-SegmentedCodeCache` or `-XX:-TieredCompilation`.

**This matters operationally.** A log alert, a runbook grep or a saved search written against the
literal string `CodeCache is full` will not fire on a default modern JVM. Match on
`is full. Compiler has been disabled.` instead — that substring is common to both branches and
survives a configuration change that the segment name does not.

## The flag the message names is a trap

Which flag appears in the second line depends on which segment filled:

| Segment | Flag named in the message |
|---|---|
| Non-nmethod | `-XX:NonNMethodCodeHeapSize=` |
| Non-profiled nmethods | `-XX:NonProfiledCodeHeapSize=` |
| Profiled nmethods | `-XX:ProfiledCodeHeapSize=` |

⚠️ Per [05](05-the-code-cache.md), those three must sum to `ReservedCodeCacheSize` or the JVM
calls `vm_exit_during_initialization("Invalid code heap sizes", …)` and does not start.

🔴 **So following the message's advice literally — setting only the one flag it names — converts
a throughput problem into a failed rollout.** The message is generated from a template that knows
which heap overflowed and nothing about the constraint between the three. Raise
`ReservedCodeCacheSize` and let ergonomics redistribute, unless you have a measured reason to
carve the segments by hand and are setting all three.

## "Once compilation is off it never comes back" is false

This is the second half of the folklore, and on JDK 25 it is wrong. From the same file:

```cpp
if (UseCodeCacheFlushing) {
  if (CompileBroker::set_should_compile_new_jobs(CompileBroker::stop_compilation)) {
    log_info(codecache)("Code cache is full - disabling compilation");
  }
} else {
  disable_compilation_forever();
}
```

**`-XX:+UseCodeCacheFlushing` is on by default** — the man page says *"This option is enabled by
default"* — so the `else` branch, the permanent one, is not the path a normal JVM takes.

What happens instead is a cycle:

1. A segment fills. Compilation of new jobs **stops**, and the JVM logs
   `Code cache is full - disabling compilation`.
2. The JVM unloads cold nmethods, reclaiming space.
3. `CodeCache::maybe_restart_compiler` fires, logging **`Restarting compiler`** and emitting a
   JFR `EventJITRestart` event carrying `freedMemory` and `codeCacheMaxCapacity`.
4. Compilation resumes — and if the pressure has not gone away, the whole thing repeats.

🔴 **So the modern failure mode is not "the JIT turned off". It is thrashing: stop, flush,
restart, repeatedly.** That is much harder to spot, because the application never settles into a
uniformly slow state that somebody would notice and screenshot. It oscillates, and the p99
oscillates with it.

The man page corroborates this without quite saying it. Its Code Heap State Analytics section
lists, among the questions the tool answers, *"Why was the JIT turned off and then on again and
again?"* — a question that only makes sense if repeated restarts are expected behaviour.

⚠️ **Do not "fix" this with `-XX:-UseCodeCacheFlushing`.** Turning it off takes the
`disable_compilation_forever()` branch, which is the pre-flushing behaviour: the compiler is
disabled for the life of the process. Whatever problem prompted the idea, this makes it
permanent and unrecoverable without a restart.

## Sweeping is GC-driven now, and the man page has not caught up

⚠️ **The man page's Code Heap State Analytics section is stale.** It still asks *"Why is the
method sweeper not working effectively?"*

**There is no method sweeper.** The dedicated sweeper thread was removed several releases ago,
and nmethod unloading is now driven by the garbage collector — `CodeCache::gc_on_allocation`,
with GC causes `_codecache_GC_threshold` and `_codecache_GC_aggressive`. **Flag this rather than
repeating it**: a reader who goes looking for sweeper tuning on JDK 25 finds flags that no longer
exist and advice that cannot apply.

The thresholds that do exist:

| Flag | Default | Meaning |
|---|---|---|
| `SweeperThreshold` | `15.0` | *"percentage of ReservedCodeCacheSize"* at which cleaning begins |
| `StartAggressiveSweepingAt` | `10` | The point at which cleaning becomes aggressive |

⚠️ On a segmented cache the segmented variant measures the **non-profiled heap only**, not the
whole reservation — so percentage arithmetic against the 240 MB total gives the wrong answer on
a default JVM.

**Being GC-driven has a consequence worth stating.** Reclamation of compiled code now depends on
collections happening. A JVM under low allocation pressure collects rarely, so cold nmethods can
sit in the cache longer than the age-based intuition from the sweeper era suggests — one more
reason the old mental model mispredicts.

## Gotchas

**★ A default JDK 25 JVM does not print `CodeCache is full`.**
It names the segment: `CodeHeap 'profiled nmethods' is full. Compiler has been disabled.` The
famous string appears only with `-XX:-SegmentedCodeCache` or `-XX:-TieredCompilation`, so alerts
matching the old literal silently never fire.

**★ Match logs on `is full. Compiler has been disabled.`**
That substring is common to the segmented and non-segmented messages. Matching on the segment
name instead breaks the moment somebody changes a compilation flag.

**★ The compiler comes back on.**
`UseCodeCacheFlushing` is on by default, so the JVM stops compilation, unloads cold nmethods,
logs `Restarting compiler` and resumes — repeatedly if pressure persists. "The JIT switched off"
describes the `-XX:-UseCodeCacheFlushing` behaviour, which is not the default.

**★ The modern failure mode is thrashing, not a single switch-off.**
Stop, flush, restart, repeat. Performance oscillates instead of dropping to a stable level, which
is far harder to correlate with a deploy or a load change. JFR's `EventJITRestart` is the
unambiguous signal that it happened.

**★ Following the error message's flag advice literally can stop the JVM from starting.**
It names one segment flag. The three segment sizes must sum to `ReservedCodeCacheSize` or HotSpot
exits during initialization. Raise the total instead and let ergonomics divide it.

**★ There is no method sweeper, and the man page still asks about one.**
Its Code Heap State Analytics section references a sweeper that was removed; unloading is
GC-driven via `CodeCache::gc_on_allocation`. Searching for sweeper flags on JDK 25 is a dead end
that the official documentation actively encourages.

**★ `SweeperThreshold` is measured against the non-profiled heap on a segmented cache.**
Not against the full `ReservedCodeCacheSize`. The flag description says "percentage of
ReservedCodeCacheSize", and on a default JVM that description is misleading.

**★ Because unloading is GC-driven, a quiet JVM reclaims code more slowly.**
Cold nmethods are freed as a consequence of collections. Low allocation pressure means few
collections, so code lingers. The age at which code disappears is not a property of the code
cache alone.

**★ Disabling `UseCodeCacheFlushing` makes the failure permanent.**
The `else` branch is `disable_compilation_forever()`. There is essentially no production reason
to turn this off, and doing so converts a recoverable, intermittent problem into an unrecoverable
one.

**★ Nothing throws.**
There is no `OutOfMemoryError` for the code cache. The JVM writes a warning to its own log and
carries on with methods interpreted. Any monitoring built purely on exceptions is blind to this
entire failure mode.

## Interview questions

**★ What happens when the code cache fills up?**
Compilation of new methods stops and the JVM logs that it has stopped. On any modern JDK,
`UseCodeCacheFlushing` is on by default, so it then unloads cold nmethods, logs `Restarting
compiler`, emits a JFR `EventJITRestart`, and resumes — repeating if pressure persists. Nothing
throws and the application keeps running; affected methods simply stay interpreted or at a lower
tier.

**★ Someone quotes "CodeCache is full. Compiler has been disabled." Why might you not see that
exact line on JDK 25?**
Because the segmented code cache is on by default, and the segmented branch of
`report_codemem_full` prints the *heap* name instead — for example `CodeHeap 'profiled nmethods'
is full.` The unsegmented string appears only with `-XX:-SegmentedCodeCache` or
`-XX:-TieredCompilation`. Any alert matching the old literal will never fire, which is worse than
having no alert, because it looks like coverage.

**★ Is it true that once the code cache fills, the JIT is off for the life of the process?**
Not by default. That was the behaviour before code cache flushing and it is still what happens
with `-XX:-UseCodeCacheFlushing`, which takes the `disable_compilation_forever()` branch. With
the default, the JVM flushes cold nmethods and restarts compilation, so the real failure mode is
repeated stop-flush-restart cycles rather than a permanent switch-off.

**★ The message suggests `-XX:ProfiledCodeHeapSize=`. Would you set it?**
Not on its own. The three segment sizes must sum to `ReservedCodeCacheSize`, and if they do not,
HotSpot calls `vm_exit_during_initialization("Invalid code heap sizes", …)` and the JVM will not
start. The safe response is to raise `ReservedCodeCacheSize` and let ergonomics redistribute;
carving the segments by hand needs a measured reason and all three flags set consistently.

**★ How is compiled code reclaimed on JDK 25?**
By the garbage collector. The dedicated sweeper thread was removed, and nmethod unloading now
happens through `CodeCache::gc_on_allocation` with dedicated GC causes. That is why the man
page's question about "the method sweeper" is stale, and it also means reclamation is coupled to
collection frequency — a JVM that collects rarely holds cold compiled code longer.

**★ Why is there no `OutOfMemoryError` for the code cache?**
Because running out of it is not fatal to correctness. The JVM can always fall back to
interpreting, so the failure degrades performance rather than preventing execution. The
consequence is that the condition is reported only through the JVM's own logging and JFR, which
is precisely why it goes unnoticed for so long.

{/* FOOTER */}
