---
title: "Every field on a GC log line comes from a format string in HotSpot, and knowing which one settles the two questions people get wrong every time — the third number in parentheses is committed capacity and not `-Xmx`, and the number at the end means a different thing under every collector"
sidebar_label: "07c · Reading a GC log"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/shared/gcTraceTime.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcTraceTime.cpp)
> for the `gc` line and the `gc+cpu` line,
> [`gc/g1/g1HeapTransition.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1HeapTransition.cpp)
> for the region summary,
> [`gc/z/zStat.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/zStat.cpp)
> for ZGC's line,
> [`memory/universe.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/memory/universe.cpp)
> for the `Using <collector>` line, and
> [`gc/shared/gcCause.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcCause.cpp)
> for the complete cause list; and the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, whose example log lines are quoted here **verbatim from the guide** —
> "Evacuation Failure" and "Ergonomic Defaults"
> ([g1](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html)),
> "Unusual System or Real-Time Usage" and "Mixed Collections Take Too Long"
> ([g1-tuning](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html)),
> and "Class Metadata"
> ([other-considerations](https://docs.oracle.com/en/java/javase/25/gctuning/other-considerations.html)).
> 🔴 **No log output on this page was produced by running anything.** Every example is either a
> format string from the JDK source or a line quoted from Oracle's documentation, and each is
> labelled as such.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A GC log line is not free-form text; it is a `printf` with a known format string, and reading
it accurately is a matter of knowing which one. This page takes the four lines you will
actually look at — the collection summary, the CPU breakdown, the region summary and the
startup banner — back to the source that emits them, so that the two most common misreadings
stop happening: that the parenthesised heap number is the maximum heap, and that the number at
the end is comparable across collectors.**

## The line everyone reads: `-Xlog:gc`

`gcTraceTime.cpp` builds it, and this is the whole of it:

```cpp
void GCTraceTimeLoggerImpl::log_end(Ticks end) {
  double duration_in_ms = TimeHelper::counter_to_millis(end.value() - _start.value());
  LogStream out(_out_end);

  out.print("%s", _title);

  if (_gc_cause != GCCause::_no_gc) {
    out.print(" (%s)", GCCause::to_string(_gc_cause));
  }

  if (_heap_usage_before != SIZE_MAX) {
    CollectedHeap* heap = Universe::heap();
    size_t used_before_m = _heap_usage_before / M;
    size_t used_m        = heap->used() / M;
    size_t capacity_m    = heap->capacity() / M;
    out.print(" %zuM->%zuM(%zuM)", used_before_m, used_m, capacity_m);
  }

  out.print_cr(" %.3fms", duration_in_ms);
}
```

So the shape is:

```
<title> (<gc cause>) <usedBefore>M-><usedAfter>M(<capacity>M) <duration>ms
```

Field by field:

- **`<title>`** — the collection type, e.g. `Pause Young (Normal)`, `Pause Young (Concurrent
  Start)`, `Pause Remark`, `Pause Cleanup`, `Pause Full`.
- **`(<gc cause>)`** — one of the strings in `gcCause.cpp`. **This is the most informative field
  on the line** and the one people skip. See the table below.
- **`<usedBefore>M-><usedAfter>M`** — heap used before and after, **whole-heap, in whole
  megabytes**. Not young generation. Rounded down by integer division, so a 900 KB heap prints
  as `0M`.
- **`(<capacity>M)`** — 🔴 **`heap->capacity()`, the *currently committed* heap. Not `-Xmx`.**
  This is the single most common misreading of a GC log: a line reading `2159M->402M(3000M)` on
  a JVM with `-Xmx8g` is telling you the heap is currently committed at 3 GB, not that the
  maximum is 3 GB. If `-Xms` equals `-Xmx` the two coincide, which is why the error survives.
- **`<duration>ms`** — `%.3fms`, milliseconds, and for a `Pause …` title it is a stop-the-world
  pause.

There is a matching `log_start` that prints title and cause with no sizes, so at `debug` level
each collection produces a begin line and an end line.

The GC id — the `GC(26)` you see between the decorators and the title — is not a decorator. The
man page notes it under the legacy flag mapping: *"`PrintGCID` — Not Applicable — GC ID is now
always logged."*

### A real line, quoted from the documentation

The tuning guide prints this as an example of an evacuation failure. **It is Oracle's output,
reproduced verbatim, not a run of ours:**

```
[9,740s][info ][gc] GC(26) Pause Young (Normal) (G1 Evacuation Pause) (Evacuation
Failure: Allocation/Pinned) 2159M->402M(3000M) 6,108ms
```

Decoders: `[9,740s]` is the `uptime` decorator, `[info ]` the `level`, `[gc]` the `tags`;
`GC(26)` the collection id; `Pause Young (Normal)` the title; `(G1 Evacuation Pause)` the cause;
`(Evacuation Failure: Allocation/Pinned)` an extra clause G1 adds in this case; then
used-before, used-after, capacity, and 6.108 milliseconds.

⚠️ Note `[9,740s]` and `6,108ms`. **Unified logging formats numbers in the platform locale**, so
in a European locale the decimal separator is a comma. A parser expecting a dot silently
misreads every duration on the page. If GC logs are machine-read, pin the locale.

## The GC causes, which are the diagnosis

From `gcCause.cpp`, the ones you will meet:

| Cause | What it means |
|---|---|
| `Allocation Failure` | ordinary: eden filled |
| `G1 Evacuation Pause` | ordinary G1 young or mixed collection |
| `G1 Humongous Allocation` | a humongous allocation forced an IHOP check — [03d2](03d2-humongous-fragmentation.md) |
| `G1 Compaction Pause` | Full GC — [03e2](03e2-the-road-to-a-full-gc.md) |
| `G1 Periodic Collection` | you configured `G1PeriodicGCInterval` |
| `Metadata GC Threshold` | metaspace high-water mark, not heap — [01 · Memory layout → 04b](../01-memory-layout/04b-the-metaspace-flags.md) |
| `Metadata GC Clear Soft References` | metaspace pressure, second attempt |
| `CodeCache GC Threshold` / `CodeCache GC Aggressive` | nmethod unloading — [01 · Memory layout → 05b](../01-memory-layout/05b-when-the-code-cache-fills.md) |
| `System.gc()` | application or library — [03e2](03e2-the-road-to-a-full-gc.md) |
| `Heap Inspection Initiated GC` | `jcmd GC.class_histogram` |
| `Heap Dump Initiated GC` | `jcmd GC.heap_dump` without `-all` |
| `JvmtiEnv ForceGarbageCollection` | a JVMTI agent |
| `Diagnostic Command` | `jcmd GC.run` |
| `Timer` / `Warmup` / `Allocation Rate` / `Allocation Stall` / `Proactive` / `High Usage` | ZGC-specific |
| `Allocation Failure During Evacuation` / `Upgrade To Full GC` | Shenandoah-specific |

**Three of those — `Metadata GC Threshold`, `CodeCache GC Threshold`, `Heap Inspection Initiated
GC` — describe a collection that has nothing to do with heap pressure.** Tuning the heap in
response to any of them is wasted work, and the cause string is the only place that says so.

## The other lines

`gc+cpu`'s user/system/real breakdown, `gc+heap`'s region summary and its two inconsistent
formats, the shutdown summary that tells you G1's region size, ZGC's differently-shaped line and
the startup banner that names the collector are
[07c2 · The other GC log lines](07c2-the-other-gc-log-lines.md).

## Gotchas

**★ The number in parentheses is committed capacity, not `-Xmx`.**
`heap->capacity()`, not `heap->max_capacity()`. A line reading `…(3000M)` on a JVM with
`-Xmx8g` means 3 GB is committed right now. The two coincide only when `-Xms` equals `-Xmx`,
which is why the misreading survives — and why it produces a badly wrong conclusion on a JVM
whose heap is still growing.

**★ The before-and-after sizes are whole-heap and integer megabytes.**
Not the young generation, and rounded down. On a small heap a collection that freed 900 KB
prints as `0M->0M`, which reads like nothing happened.

**★ The GC cause is the most informative field and the one everyone skips.**
`Metadata GC Threshold`, `CodeCache GC Threshold` and `Heap Inspection Initiated GC` all describe
collections that have nothing to do with heap pressure. Reading the cause first partitions the
problem before any tuning is considered.

**★ Unified logging formats numbers in the platform locale.**
Oracle's own example prints `[9,740s]` and `6,108ms`. In a locale using comma as the decimal
separator, every duration in your log has a comma in it. Parsers built on a dot silently produce
nonsense rather than failing.

**★ Each collection produces two lines at debug level, one at info.**
`log_start` prints title and cause; `log_end` prints title, cause, sizes and duration. A parser
counting occurrences of `Pause Young` at debug level double-counts every collection.

**★ A `Pause Young (Normal)` can take six seconds.**
Oracle's own example line does. The title describes the *type* of collection, not its cost; an
evacuation failure turns a young collection into something an order of magnitude more expensive
without renaming it. Alert on duration, never on collection type.

## Interview questions

**★ In the line `2159M->402M(3000M)`, what is 3000M?**
The **currently committed** heap capacity — `heap->capacity()` in `gcTraceTime.cpp` — not the
maximum heap. It is what the JVM has committed from the operating system at this moment, and on
a JVM whose heap is still growing it will change from line to line. The misreading is common
because the standard latency configuration sets `-Xms` equal to `-Xmx`, in which case committed
and maximum coincide and nothing goes wrong. On a JVM with a floating heap, concluding "the max
heap is 3 GB" from that field leads directly to the wrong sizing decision. The other two
numbers are whole-heap used before and after the collection, in integer megabytes.

**★ What is the single most useful field on a GC log line, and why?**
The cause, in parentheses after the collection type. It partitions the problem before any
analysis: `Allocation Failure` or `G1 Evacuation Pause` is an ordinary collection;
`G1 Humongous Allocation` says an oversized object drove it; `Metadata GC Threshold` and
`CodeCache GC Threshold` say the collection had nothing to do with the heap at all;
`System.gc()`, `Heap Inspection Initiated GC`, `Heap Dump Initiated GC`,
`JvmtiEnv ForceGarbageCollection` and `Diagnostic Command` each name a caller who requested it.
Three seconds reading that field routinely saves a day of heap tuning aimed at a metaspace
threshold or a monitoring agent.

**★ A GC log line says `Pause Young (Normal)` and took 6 seconds. Is that possible?**
Yes, and the tuning guide's own worked example is exactly that — a `Pause Young (Normal)` of
6.108 ms in its own units, but the general point holds and the guide's example carries an
`(Evacuation Failure: Allocation/Pinned)` clause. The collection *type* describes what G1 set
out to do, not what it cost. When evacuation fails, G1 leaves objects in place, marks regions as
failed and fixes them up, all inside the same pause and under the same title. That is why
alerting on "Full GC" misses the worst pauses a G1 heap produces, and why the alert should be on
pause duration regardless of type.

{/* FOOTER */}
