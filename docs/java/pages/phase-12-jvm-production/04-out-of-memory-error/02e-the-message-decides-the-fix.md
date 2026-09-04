---
title: "\"Add more heap\" is the correct response to two of the nine OutOfMemoryError messages and is wrong, useless or actively harmful for the other seven — this is the routing table from the word after the colon to the first command you run"
sidebar_label: "02e · The message decides the fix"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 — this chunk asserts no new facts. Every message string, flag and command
> below is established and sourced in the chunk it links to; the underlying sources are the
> **JDK 25 Troubleshooting Guide**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)),
> the **JDK 25 `java` and `jcmd` tool references**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)) and the
> **JDK 25 HotSpot source at tag `jdk-25+36`**
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/tree/jdk-25%2B36)).
> **No sandbox** — commands and their documented behaviour only, no captured output.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**There is one decision to make in the first thirty seconds of an `OutOfMemoryError` incident, and
it is not which tool to open. It is: which region does this message name? Get that right and the
next command follows mechanically. Get it wrong and you can spend an afternoon analysing a heap
dump for a failure that was never in the heap — which is, by a wide margin, the most expensive
routine mistake in production Java.**

## The routing table

| Message | Region | First command | Then |
|---|---|---|---|
| `Java heap space` | Java heap | `jcmd <pid> GC.heap_info` | live set rising? → heap dump → [04](04-reading-a-dump-in-mat.md) |
| `Java heap space: failed reallocation…` | Java heap (via deoptimisation) | as above | as above; ignore the JIT frames |
| `GC overhead limit exceeded` | Java heap, Parallel GC only | read the GC log | [02c](02c-gc-overhead-limit-is-parallel-only.md) |
| `Requested array size exceeds VM limit` | none — one allocation | read the stack trace | bound the input; nothing else |
| `Metaspace` | class metadata | `jcmd <pid> VM.classloader_stats` | [05c](05c-finding-a-classloader-leak-in-a-dump.md) |
| `Compressed class space` | klass metadata sub-region | `jcmd <pid> VM.metaspace` | raise `CompressedClassSpaceSize` |
| `request size … Out of swap space?` | native heap; process is dead | read `hs_err_pid<pid>.log` | [`../01-memory-layout/11c`](../01-memory-layout/11c-the-footprint-that-is-not-in-any-region.md) |
| `reason stack_trace (Native method)` | a native library | `pmap`, `smaps_rollup` | [`../01-memory-layout/11d`](../01-memory-layout/11d-finding-it-outside-the-jvm.md) |
| `Cannot reserve N bytes of direct buffer memory…` | direct buffers | read `allocated:` vs `limit:` in the message | [`../01-memory-layout/07`](../01-memory-layout/07-direct-and-mapped-buffers.md) |
| `unable to create native thread: …` | thread stacks / OS limits | `grep -c '' /proc/<pid>/task`, `ulimit -u`, `pids.max` | [`../01-memory-layout/06d`](../01-memory-layout/06d-the-thread-count-arithmetic.md) |
| `C heap space` | native heap, JNI handles | check attached agents / JNI libraries | [02d](02d-the-messages-that-are-not-on-the-list.md) |
| *no message, exit 137* | not an `OutOfMemoryError` at all | `kubectl describe pod`, `dmesg` | [`../01-memory-layout/01b`](../01-memory-layout/01b-oom-error-versus-oomkilled.md) |

## Why "add more heap" is the default answer and why it is usually wrong

It is the default because it is the only remedy that requires no diagnosis, it can be applied by
editing one line of a manifest, and for the one message people have actually seen before —
`Java heap space` — it sometimes works. So it becomes the reflex.

The four ways it fails:

**It does nothing.** `Requested array size exceeds VM limit` is thrown *"irrespective of how much
heap size is available"*. `Metaspace` and `Compressed class space` are bounded by different flags
entirely. No amount of `-Xmx` touches any of them.

**It makes things worse in a container.** `Metaspace`, `Compressed class space`, `Out of swap
space?`, `(Native method)`, `C heap space` and the direct-buffer failure are all drawing on the
*same physical memory* that a larger heap will now commit. Raising `-Xmx` inside a fixed cgroup
limit takes memory away from precisely the region that failed. And since
`-XX:MaxDirectMemorySize` defaults to `-Xmx`, raising the heap ceiling silently raises the
direct-memory ceiling too, so the worst case grows twice.

**It delays the diagnosis without changing the outcome.** For a genuine leak, doubling `-Xmx`
doubles the time to failure and nothing else — and doubles the size of the heap dump you will
eventually have to take and open.

**It hides the signal.** A larger heap collects less often, so a classloader that should have
been unloaded stays alive longer, and metaspace grows faster than it did before.

## The one question that separates "too small" from "leaking"

For the heap messages only, and it is the guide's own:

> *"For detecting memory leaks, it is important to monitor the live set of the application that
> is, the amount of Java heap space or Metaspace being used **after a full garbage collection**.
> If the live set increases over time after the application has reached a stable state and is
> under a stable load, that could be a strong indication of a memory leak."*

Three qualifiers in that sentence do real work: **after a full collection** (not utilisation),
**after the application has reached a stable state** (not during warm-up, when caches and JIT
profiles are legitimately filling), and **under a stable load** (a rising live set under rising
traffic is a working set, not a leak).

```bash
jcmd <pid> GC.heap_info        # committed vs used, per generation or region set
```

If used-after-collection is a small and stable fraction of committed, the heap is not your
problem and you are looking at the wrong region. That command costs seconds and ends a surprising
share of these investigations. Topic 01 makes the general version of the argument in
[`12-the-checklist.md`](../01-memory-layout/12-the-checklist.md).

## The cheap probes, in the order that eliminates the most

None of these writes a large file and all of them are faster than deciding to take a dump.

```bash
jcmd <pid> GC.heap_info          # "Provides generic Java heap information."   Impact: Medium
jcmd <pid> VM.classloader_stats  # "Print statistics about all ClassLoaders."  Impact: Low
jcmd <pid> VM.metaspace basic    # basic "does not need a safepoint"
jcmd <pid> GC.class_histogram    # counts and bytes by class.                  Impact: High
jcmd <pid> VM.native_memory summary   # needs -XX:NativeMemoryTracking at launch
```

⚠️ `GC.class_histogram` is rated **Impact: High** by the `jcmd` reference — the same rating as
`GC.heap_dump`. It is much cheaper in *bytes written* than a dump, but it is not a free probe on a
large heap. Run `GC.heap_info` and `VM.classloader_stats` first.

⚠️ The Troubleshooting Guide shows `jcmd <pid> GC.class_histogram filename=Myheaphistogram`. On
JDK 25 that command takes exactly two arguments, `-all` and `-parallel` — `ClassHistogramDCmd`
declares `num_arguments() { return 2; }` and the `jcmd` man page lists only those two. **There is
no `filename` option**; the guide's example is stale. Redirect the shell's output instead.

## What to do when you cannot tell

Two situations are genuinely ambiguous from one observation, and in both the honest answer is
"take a second measurement", not "guess":

- **A leak versus a legitimately large working set.** Needs the live set across several load
  cycles. [06 · When it is not a leak](06-when-it-is-not-a-leak.md).
- **Class-loading growth versus a classloader leak.** Needs `VM.classloader_stats` twice with a
  gap. [`../01-memory-layout/04c`](../01-memory-layout/04c-the-classloader-leak.md).

Both branches end in "wait longer", there is no command that shortens them, and shipping a fix
without waiting is how the wrong fix ships.

## Gotchas

**★ Reading the message is a step, and skipping it is the commonest failure in the whole topic.**
The exception class is the same for all nine failures. Only the detail message names the region.
Teams routinely see `java.lang.OutOfMemoryError`, conclude "heap", and open a dump — for a
metaspace, direct-buffer or native-thread failure where the dump cannot contain the answer.

**★ In a container, raising `-Xmx` is not neutral for the non-heap messages — it is a regression.**
The heap and the failing region share one cgroup limit. A larger heap commits more of it. And
because `-XX:MaxDirectMemorySize` defaults to `-Xmx`, the direct-memory ceiling moves with it, so
the worst-case native footprint rises at the same time.

**★ `GC.class_histogram` is `Impact: High`, not a free probe.**
The `jcmd` reference gives it the same impact rating as `GC.heap_dump`. It is cheap in disk and
expensive in pause on a large heap. `GC.heap_info` (Medium) and `VM.classloader_stats` (Low) come
first.

**★ The Troubleshooting Guide's `GC.class_histogram filename=` example does not work on JDK 25.**
The command has two options, `-all` and `-parallel`. Passing `filename=` is an unknown argument.
Redirect stdout if you want a file.

**★ A stack trace is the right evidence for exactly two of the nine messages.**
`Requested array size exceeds VM limit` and the direct-buffer failure both name the culprit
frame. For the other seven the trace names whoever allocated next, which is noise.

**★ "The heap graph is flat" is a finding, not an all-clear.**
Flat heap plus rising RSS is the signature of six of the nine messages. It is the most
information-dense pair of graphs available and is routinely read as "memory is fine".

**★ Fixing the symptom is available at every row of the table and is almost always wrong.**
Raising a limit, raising `-Xmx`, scheduling restarts — each improves the graph and answers no
question. Do them deliberately to buy time, and record that that is what you did.

**★ The message may not be the first thing that went wrong.**
Once memory is tight the failure cascades. The first `OutOfMemoryError` in the file is the
evidence; the rest are the aftermath. And after four of them the JVM stops attaching stack traces
altogether — [01b](01b-the-error-with-no-stack-trace.md).

## Interview questions

**★ Why is "read the `OutOfMemoryError` message" a step of its own?**
Because only two of the nine messages mean "the heap is too small", and treating them as
interchangeable sends you to the wrong region with the wrong tool. `Metaspace` is class metadata,
`Compressed class space` is a bounded sub-region inside it, `unable to create native thread` is
stacks or an OS limit, `Cannot reserve … direct buffer memory` is native memory reached through
`ByteBuffer`, `Requested array size exceeds VM limit` is one allocation rather than a total, and
two more are native-heap failures. Raising `-Xmx` addresses exactly one of them, wastes time on
several, and actively harms the container-bound ones because the heap and the failing region
share one memory limit.

**★ Your colleague's first move in every memory incident is a heap dump. Is that wrong?**
Premature rather than wrong, and the cost is real: the dump pauses the application at a safepoint,
writes a file the size of the live set, and needs a machine with enough RAM to index it. It
answers exactly one question — what is retained on the Java heap — so it is decisive when the
live set is growing and irrelevant when it is not, which covers a large share of container memory
incidents. Reading the detail message costs zero seconds and eliminates seven of the nine
possibilities; `jcmd GC.heap_info` costs a few more and settles whether the heap is even
implicated.

**★ You have `OutOfMemoryError: Java heap space` and a dump. What do you look at first, and what
would make you stop?** First the dominator tree, sorted by retained heap, because that is the only
view that answers "what is keeping this alive" rather than "what is there". What would make me
stop is the live set: if heap-used-after-full-GC across the preceding hours was flat, then the
heap is correctly sized for a working set that simply exceeds `-Xmx`, and the dump will show a
large, legitimate, well-distributed set of objects with no single dominator — which is not a bug
report, it is a capacity decision. Distinguishing those two before opening the file saves the
afternoon.

**★ Given a fixed container limit, when is raising `-Xmx` the right response at all?**
When the message is `Java heap space` or `GC overhead limit exceeded`, the live set after full GC
is flat rather than ratcheting, and the non-heap regions have measured headroom — because in a
container every byte you give the heap is a byte taken from metaspace, thread stacks, the code
cache, GC structures and direct buffers, and `MaxDirectMemorySize` defaults to `-Xmx` so the
theoretical worst case rises with it. In practice that means: confirm from the GC log that this is
sizing rather than retention, confirm from NMT that the native side has room, and then move
`MaxRAMPercentage` rather than hard-coding `-Xmx`, so the same image still works at a different
container size.

{/* FOOTER */}
