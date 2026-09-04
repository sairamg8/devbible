---
title: "Code cache pressure presents as a throughput regression with a healthy heap, healthy GC and unchanged load, it can relieve itself and come back, and every piece of evidence for it lives somewhere nobody is looking — the JVM's own log, a JFR event, or a `jcmd` call that takes one second"
sidebar_label: "05c · Diagnosing code cache pressure"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `jcmd` tool reference** for `Compiler.codecache`,
> `Compiler.codelist` and `Compiler.CodeHeap_Analytics`, including their documented impact levels
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> and the **JDK 25 `java` tool reference** for `-Xlog:codecache`,
> `-XX:ReservedCodeCacheSize` and `-XX:+UseCodeCacheFlushing`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[05b](05b-when-the-code-cache-fills.md) described what the JVM does when a code heap fills.
This page is what it does to you, and how to find it — because the symptom looks like an
application regression, the evidence is not in any dashboard you own, and the condition can
resolve itself before anyone investigates.**

## What it costs

The application does not crash and nothing throws. Methods that would have been compiled stay
interpreted, or stay at a lower tier, and the consequences are:

- **Throughput drops**, potentially by an order of magnitude on affected paths. Interpreted code
  against C2-optimised code is not a marginal difference; it is the difference the JIT exists to
  create.
- **Latency rises unevenly.** Only the methods that failed to compile are slow, so the effect
  concentrates in whatever became hot most recently — very often the newest code path, which is
  the one deployed this morning. That correlation is real and completely misleading.
- **Nothing in the usual dashboards moves.** The heap is fine. GC is fine. Thread counts are
  fine. Request rate is unchanged. There is no exception and no error rate.
- **It can resolve and return on its own**, because flushing may relieve the pressure enough for
  compilation to resume. An intermittent regression with no attributable cause is the classic
  presentation.

**The tell is a performance regression with no corresponding heap, GC or load change** —
accompanied by warning lines in the JVM's own log that nobody reads, because they are not
exceptions and they do not go to the application logger.

## The four commands

**Is the cache under pressure?**

```bash
jcmd <pid> Compiler.codecache
```

*"Impact: Low"* — prints the code cache layout and, on a segmented JVM, each heap's size, used
and free figures. This is the first command for any code-cache question and it is safe on a
production JVM.

🔴 **Run it on a healthy instance too.** "Used 140 MB of 240 MB" means nothing without knowing
what this application normally sits at. Capturing it once per service, at steady state, turns
every future investigation into a comparison instead of a guess.

**What is in there?**

```bash
jcmd <pid> Compiler.codelist
```

*"Impact: Medium"* — every compiled method currently in the cache with its tier and address.
Useful when the answer turns out to be "an enormous number of generated methods" and you need to
name them rather than suspect them.

**The detailed state, including fragmentation:**

```bash
jcmd <pid> Compiler.CodeHeap_Analytics
```

Options are
`aggregate | UsedSpace | FreeSpace | MethodCount | MethodSpace | MethodAge | MethodNames | discard`.
`MethodAge` is the interesting one when flushing behaviour is in question — it shows how long
compiled methods are surviving — and `FreeSpace` speaks to fragmentation, which matters because
a heap can fail an allocation while showing free bytes.

**The wider picture:**

```bash
jcmd <pid> VM.native_memory summary
```

The **Code** category, described as *"Generated code"*, gives reserved and committed alongside
every other region. This is the right framing when the actual question is where the process's
memory went rather than why compilation stopped.

⚠️ **The code cache is not in a heap dump**, for the same reason metaspace is not
([04](04-metaspace.md)): it is native memory holding machine code, not objects.

## The two log lines and the JFR event

**In the JVM log**, grep for:

```
is full. Compiler has been disabled.
Restarting compiler
```

The first is the fill; the second is the recovery. **Seeing the pair repeatedly is the
thrashing signature** and is worth alerting on directly.

For a deliberate investigation:

```bash
# after a representative workload
java -Xlog:codecache=Trace ...
# or, to log the state when the cache fills
java -Xlog:codecache=Debug ...
```

Both are the man page's own suggestions. `Debug` prints the state at the moment of a fill, which
is exactly the snapshot you want and cannot reconstruct afterwards.

**In JFR**, the event is `EventJITRestart`, carrying `freedMemory` and `codeCacheMaxCapacity`.
🔴 **This is the cleanest possible evidence**: an event that exists only when compilation was
stopped and restarted, with the amount reclaimed attached. If JFR runs continuously — which
topic 06 argues it should — the evidence for an incident three days ago is already recorded, and
no reproduction is needed.

## Fixing it

In order of preference:

1. **Raise `-XX:ReservedCodeCacheSize`.** The man page's limit is 2 GB. Going from 240 MB to
   480 MB costs reserved address space, which is free on 64-bit, plus whatever additional memory
   is actually committed. For a real throughput problem this is a cheap and low-risk fix. Let
   ergonomics redistribute across the segments rather than setting them individually — see the
   trap in [05b](05b-when-the-code-cache-fills.md).
2. **Reduce the amount of generated code.** If `Compiler.codelist` is dominated by proxy or
   generated-accessor methods, the code cache is a symptom and the class-generation behaviour is
   the cause — the same root as the metaspace case in [04c](04c-the-classloader-leak.md), and
   fixing it helps both regions at once.
3. **Reconsider deliberate JVM-level workarounds.** Disabling tiered compilation to "save code
   cache" drops the default from 240 MB to 48 MB *and* removes C1's profiling stage, so C2
   compiles with less information. It is almost always a net loss.
4. **Do not disable `UseCodeCacheFlushing`.** It takes the `disable_compilation_forever()`
   branch, making a recoverable problem permanent.

⚠️ **Raising the size is treatment, not diagnosis.** If usage grows without bound across a
service's lifetime rather than plateauing after warm-up, more space postpones the same incident.
The plateau is the thing to verify after any increase.

## Preventing the next one

Three cheap measures, in decreasing order of value:

**Record the steady-state number.** One `Compiler.codecache` capture per service after warm-up,
kept somewhere findable. Without it, every future investigation starts by trying to establish
what normal is, during an incident.

**Alert on the log substring.** `is full. Compiler has been disabled.` is unambiguous, has no
false positives, and is trivial to match. Most organisations discover this failure mode once and
then never build the alert that would have caught it in two minutes.

**Run JFR continuously.** `EventJITRestart` then exists in the historical record, which is the
difference between explaining an incident and speculating about it.

## Gotchas

**★ The symptom looks like an application regression.**
Throughput drops, some latencies rise, the heap is fine and GC is fine. Nothing points at the JVM
unless somebody reads the JVM's own log or runs `Compiler.codecache`, and neither is on the
standard checklist.

**★ It can fix itself, which makes it intermittent.**
Flushing can relieve the pressure enough for compilation to resume, so the incident closes
without explanation and returns later. An unexplained, recurring throughput regression is worth
one `Compiler.codecache` call before anything else.

**★ The regression correlates with your newest code, and that is a coincidence.**
The methods that fail to compile are the ones that became hot most recently — typically whatever
was just deployed. The deploy is not the cause; it is the thing that happened to be compiling
when there was no room. Chasing the diff can burn a day.

**★ `Compiler.codecache` is `Impact: Low` and almost nobody runs it.**
It is safe on production, takes a second, and answers the question directly. Most of the length
of a typical investigation into this is the time before somebody runs it.

**★ A usage number is meaningless without a baseline.**
"140 MB of 240 MB used" could be steady state or could be a service climbing toward a wall. One
capture on a healthy instance converts the metric from ambiguous to decisive.

**★ Nothing throws, so exception-based monitoring is blind to it.**
The evidence is JVM log output and JFR events. A monitoring stack built entirely on error rates
and exceptions cannot see this failure mode at all.

**★ Free bytes do not guarantee an allocation succeeds.**
Fragmentation within a code heap can fail an allocation while the heap reports free space.
`Compiler.CodeHeap_Analytics FreeSpace` is the view that shows it, and it explains the otherwise
baffling case of a fill message on a cache that is not full.

**★ Raising the size is treatment, not diagnosis.**
If usage climbs without ever plateauing, a bigger cache only moves the date. Verify that the new
size plateaus after warm-up rather than assuming the fix held.

**★ The code cache is not in a heap dump.**
Same reason as metaspace: native memory holding machine code rather than objects. A dump cannot
answer any question on this page.

## Interview questions

**★ How would you diagnose a suspected code cache problem on a running service?**
`jcmd <pid> Compiler.codecache` first — impact Low — for per-segment size, used and free. Then
`Compiler.codelist` to see what is in there, and `Compiler.CodeHeap_Analytics MethodAge` if
flushing behaviour is in question. In the logs, grep for `is full. Compiler has been disabled.`
and `Restarting compiler`; in a JFR recording, look for `EventJITRestart`, which is the
unambiguous evidence that thrashing occurred and says how much was freed each time.

**★ A service's p99 doubled after a release. Heap, GC and load are unchanged. How does the code
cache enter your thinking?**
It is one of the few things that degrades throughput without touching any of those three. The
check is cheap — one `Compiler.codecache` call and a log grep for the fill message — so it
belongs early in the ordered plan rather than at the end. The correlation with the release is
also expected under this hypothesis, because the newly deployed methods are the ones that fail to
compile, which makes the release look causal when it is only coincident.

**★ Why is this failure mode so often mistaken for an application regression?**
Because every dashboard people look at is healthy: heap normal, GC normal, load normal, no
exceptions. The only evidence is the JVM's own log output, JFR events, or a `jcmd` call nobody
makes. And because flushing can relieve the pressure, the problem comes and goes, so it looks
like an intermittent bug in whatever was deployed most recently.

**★ Why would a service that ran fine for a year start hitting this after a release?**
Because code cache usage tracks the volume of code that becomes hot, not the request rate. A
release that adds a framework, a batch of generated proxies or a large set of new endpoints adds
methods to compile — and with tiered compilation most hot methods are compiled twice. Nothing
about load has to change. Comparing `Compiler.codelist` across the two versions shows it
directly.

**★ You raise `ReservedCodeCacheSize` from 240 MB to 480 MB and the problem goes away. Are you
done?**
Only if usage now plateaus after warm-up. If it climbs steadily instead, the extra space has
bought time rather than fixed anything, and the real question is why the amount of hot code grows
without bound — typically runtime class generation. Verifying the plateau is the step that
distinguishes a fix from a postponement.

**★ What would you put in place so the next occurrence is caught in minutes?**
A recorded steady-state `Compiler.codecache` capture per service so any future number can be
compared; a log alert on `is full. Compiler has been disabled.`, which is unambiguous and has no
false positives; and continuous JFR so `EventJITRestart` is already in the historical record.
All three are close to free, and together they turn a multi-day investigation into an alert.

**★ Can the code cache report free space and still fail to allocate?**
Yes — fragmentation within a code heap can prevent a contiguous allocation even when the totals
look comfortable. `Compiler.CodeHeap_Analytics FreeSpace` shows the distribution rather than the
sum, which is what makes the situation legible; the aggregate "used vs size" view does not.

{/* FOOTER */}
