---
title: "\"The pod grew and the heap is flat\" is not one question but seven, asked in a fixed order, and the value of the order is that each answer eliminates a region — this is the whole topic compressed into the sequence you run at three in the morning"
sidebar_label: "12 · The checklist"
sidebar_position: 46
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 — this chunk asserts no new facts. Every command, flag and claim below is
> established and sourced in the chunk it links to, and the sources are the **JDK 25 `java` and
> `jcmd` tool references**
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> the **JDK 25 Troubleshooting Guide**
> ([docs.oracle.com/en/java/javase/25/troubleshoot/](https://docs.oracle.com/en/java/javase/25/troubleshoot/))
> and the **HotSpot GC Tuning Guide** for JDK 25. JDK 25 · Spring Boot 4.1.0.
> **No sandbox** — commands and their documented behaviour only. No captured output.

**Everything in this topic exists to make one moment go well: a service is using more memory than
someone expected, and you have a shell and a PID. The failure in that moment is almost never a
lack of knowledge — it is reaching for the tool you know best rather than the one that eliminates
the most possibilities. This chunk is the order, and the order is the point.**

The single sentence the whole topic reduces to:

🔴 **`-Xmx` bounds one region of several. Every question below is really "which region?", and
each step is chosen because it rules one out.**

## The ordered sequence

### 1. Is it this process, and is the limit what you think?

Before any JVM tooling at all. Two facts, two commands, and they end a surprising share of these
investigations:

```bash
cat /sys/fs/cgroup/memory.max /sys/fs/cgroup/memory.current   # cgroup v2
grep -E 'VmRSS|Threads' /proc/<pid>/status
```

- **Was the JVM the process the kernel killed?** A cgroup limit covers the whole container. A
  sidecar, a log shipper or a forgotten shell shares it. The JVM is the most conspicuous process,
  not automatically the guilty one.
- **Is the limit the number in the manifest?** Defaults, overrides and edits happen. Read it.

**Why first:** free, fast, and if the answer is "a sidecar" then every subsequent step would have
been wasted. See [11c](11c-the-footprint-that-is-not-in-any-region.md).

### 2. Which failure is it — `OutOfMemoryError` or OOMKilled?

These look similar in a dashboard and have nothing else in common:

| | `OutOfMemoryError` | OOMKilled (exit 137) |
|---|---|---|
| Who decided | The JVM | The kernel |
| Evidence | A stack trace, and a heap dump if you configured one | No stack trace, no dump — the process is simply gone |
| Means | The *heap* (or another JVM budget) is exhausted | The *process* exceeded the cgroup limit |
| Next step | Step 4 | Step 5 |

🔴 **Read which one you have before doing anything else diagnostic.** They lead down different
branches of this checklist and the most common wasted afternoon in the phase is analysing a heap
for a problem that was never in the heap.
[01b](01b-oom-error-versus-oomkilled.md) owns the distinction.

### 3. If it is `OutOfMemoryError`, read the message, not the exception

The word after the colon determines the fix, and only one of the messages means "add heap":

The JDK 25 troubleshooting guide documents **seven** detail messages. Two more are real but come
from elsewhere in the JVM and are not on that list — worth knowing, because looking for them in
the guide and not finding them makes people doubt what they are seeing:

| Message | Region | |
|---|---|---|
| `Java heap space` | The heap — step 4 | documented |
| `GC Overhead limit exceeded` | The heap, plus a collector spending its life on it | documented |
| `Requested array size exceeds VM limit` | A single allocation, not the heap's total | documented |
| `Metaspace` | Class metadata — [04 · Metaspace](04-metaspace.md) | documented |
| `request size bytes for reason. Out of swap space?` | The OS is out of swap, not the JVM out of heap | documented |
| `Compressed class space` | The bounded class-pointer region — [09c](09c-class-pointers-and-compact-headers.md) | documented |
| `reason stack_trace (Native method)` | A native frame's allocation | documented |
| `unable to create native thread: possibly out of memory or process/resource limits reached` | Thread stacks or an OS limit — [06](06-thread-stacks.md) | from HotSpot, not the guide |
| `Cannot reserve N bytes of direct buffer memory (allocated: …, limit: …)` | Native, via `ByteBuffer` — [07](07-direct-and-mapped-buffers.md) | from `Bits`, not the guide |

⚠️ **Note the last two are quoted in full deliberately.** They are commonly paraphrased as
"unable to create native thread" and "Direct buffer memory", and searching a log for those short
forms works — but searching the *documentation* for them does not, because they are not in it.

[Topic 04](../04-out-of-memory-error/_plan.md) owns the full set and each one's causes.

### 4. If the heap is implicated, is the *live set* growing?

Not "is the heap full" — a full heap is normal between collections. The question is what survives
a collection:

```bash
-Xlog:gc*                    # already on, ideally, from before the incident
jcmd <pid> GC.heap_info
```

If live-set-after-full-GC rises across cycles for unchanged traffic, you have retention and a heap
dump names it. If it is flat, the heap is not your problem and you belong at step 5.
[Topic 02](../02-gc-in-practice/_plan.md) owns reading the log;
[topic 04](../04-out-of-memory-error/_plan.md) owns the dump.

### 5. If the heap is flat, which JVM region is growing?

This is where the topic's central claim pays off: there are several regions and `-Xmx` bounds one.

```bash
# needs -XX:NativeMemoryTracking=summary at startup
jcmd <pid> VM.native_memory baseline      # after warm-up, not at startup
#   ... wait long enough for the growth ...
jcmd <pid> VM.native_memory summary.diff
```

One category almost always dominates the diff, and it names the next tool:

| Category grew | Region | Go to |
|---|---|---|
| `Class` | Metaspace — class count or a classloader leak | [04 · Metaspace](04-metaspace.md) |
| `Thread` | Thread count × committed stack | [06](06-thread-stacks.md), [06d](06d-the-thread-count-arithmetic.md) |
| `Code` | The JIT's code cache | [05 · The code cache](05-the-code-cache.md) |
| `Other` | 🔴 Usually direct byte buffers | [07](07-direct-and-mapped-buffers.md) |
| `Internal` | Often JVMTI — an attached agent | [11](11-native-memory-tracking.md) |
| `GC` / `GCCardSet` | Collector structures, a function of heap size | [02](../02-gc-in-practice/_plan.md) |
| `Java Heap` | You are at step 4 after all | [04](../04-out-of-memory-error/_plan.md) |

[11](11-native-memory-tracking.md) and [11b](11b-the-nmt-baseline-workflow.md) own this step.

### 6. If NMT is flat too, the growth is not the JVM's

That is a result, not a dead end — the troubleshooting guide is explicit that NMT *"does not track
memory allocations by non-JVM code"*. Leave the JVM's tooling:

```bash
cat /proc/<pid>/smaps_rollup
pmap -X <pid>
```

Candidates in order of likelihood: the C allocator's arenas and retained free space, a native
library, a memory-mapped file, JNI, a native agent.
[11c](11c-the-footprint-that-is-not-in-any-region.md) owns it.

### 7. Ask whether it plateaus before you call it a leak

Allocator retention rises with peak demand and flattens. A leak keeps rising across load cycles.
They look identical in a one-hour window and have unrelated fixes. This step costs patience rather
than commands, and skipping it is how a `MALLOC_ARENA_MAX` change gets made for a Java-heap leak.

## The one-page version

| Symptom | First question | Tool |
|---|---|---|
| `OutOfMemoryError` with a message | Which message? | Read it — [04](../04-out-of-memory-error/_plan.md) |
| Exit 137, no stack trace | Which process? Which limit? | cgroup files — [01b](01b-oom-error-versus-oomkilled.md) |
| Heap graph sawtooths, service fine | Nothing. This is health. | — |
| Live set rises across full GCs | What retains it? | Heap dump — [04](../04-out-of-memory-error/_plan.md) |
| Heap flat, RSS rising | Which NMT category? | [11b](11b-the-nmt-baseline-workflow.md) |
| Heap flat, NMT flat, RSS rising | Which mapping? | `pmap` — [11c](11c-the-footprint-that-is-not-in-any-region.md) |
| RSS rises then plateaus at peak | Allocator retention, probably | Watch longer — [11c](11c-the-footprint-that-is-not-in-any-region.md) |
| Objects bigger than expected | Which layout flags? | JOL — [08d](08d-measuring-an-object.md) |
| Heap over 32 GB, capacity fell | Compressed oops lost | [09](09-compressed-oops.md), [09d](09d-verifying-what-the-jvm-chose.md) |

## What to do before the next incident

Most of this checklist is cheaper if three decisions were made earlier, and all three are one line:

1. 🔴 **`-XX:+HeapDumpOnOutOfMemoryError` with a `HeapDumpPath` on a volume that survives a
   restart.** A dump you did not take is a dump you cannot analyse, and the container's
   filesystem is gone by the time you look. [01d](01d-taking-a-heap-dump-on-purpose.md).

   ⚠️ **But know what it does not cover.** The man page is explicit: *"This applies only to
   `OutOfMemoryError` exceptions caused by Java Heap exhaustion; it does not apply to
   `OutOfMemoryError` exceptions thrown directly from Java code, nor by the JVM for other types
   of resource exhaustion (such as native thread creation errors)."* So it gets you **nothing**
   for metaspace, compressed class space, direct buffer or native-thread exhaustion — four of the
   nine rows above. `-XX:+ExitOnOutOfMemoryError` and `-XX:+CrashOnOutOfMemoryError` are the
   broader net (both `product`, both default `false`, and neither is in the man page), because
   they fire on *any* out-of-memory error thrown from the JVM.
2. **GC logging on, permanently, rotated.** `-Xlog:gc*` with `filecount` and `filesize` costs
   almost nothing and is the only record of what the heap was doing before the restart. If the
   heap is anywhere near 32 GB, add `gc+heap+coops` too — [09d](09d-verifying-what-the-jvm-chose.md).
3. **Decide your NMT policy now.** It cannot be attached to a running JVM. Either accept the
   documented 5–10% cost permanently, or make sure you can restart one replica with
   `-XX:NativeMemoryTracking=summary` in minutes rather than in a release cycle.

And one that is a packaging decision rather than a flag: **can you run `jcmd` inside the
container at all?** A JRE-only or distroless image can leave you in an incident with no JVM
tooling. That trade belongs to [topic 10](../10-packaging-for-deploy/_plan.md), and it is felt
here.

## Gotchas

**★ The commonest mistake is starting at step 4.** A heap dump is the tool people know, so it is
the tool they reach for — including for problems that were never in the heap. Steps 1 and 2 are
free and eliminate more.

**★ "The JVM is using too much memory" is an assertion, not an observation.** In a container the
limit is shared. Confirm which process was killed before analysing anything.

**★ A sawtooth heap graph is a healthy heap.** Memory rising to the limit and dropping at a
collection is the collector working. Alerting on heap utilisation rather than on live-set-after-GC
generates pages for correct behaviour.

**★ Restarting resolves every symptom in this checklist and diagnoses none of them.** A restart
schedule is a way of not finding out which of five unrelated causes you have.

**★ NMT cannot be turned on after the fact.** If it was off when the incident happened, no amount
of `jcmd` will produce the data. That decision was made at launch.

**★ `-XX:+HeapDumpOnOutOfMemoryError` only covers *heap* exhaustion.** The man page says so in
as many words. A metaspace, compressed-class-space, direct-buffer or native-thread
`OutOfMemoryError` produces no dump however carefully you configured the flag. "We have heap
dumps enabled" is not the same as "we will have evidence".

**★ Two of the nine `OutOfMemoryError` messages are not in the documentation.** The native-thread
and direct-buffer messages come from HotSpot and from `Bits` respectively. Failing to find them in
the troubleshooting guide does not mean you misread the log.

**★ The heap dump you configured is on a filesystem that no longer exists.** Ephemeral container
storage disappears with the container. `HeapDumpPath` has to point at something mounted, or the
flag achieved nothing.

**★ A single NMT snapshot during an incident is nearly useless.** Every category is legitimately
large. The baseline and the diff are the technique — and the baseline has to have been taken
before the growth, which means before you were paged.

**★ Reserved is not committed.** In NMT reports and in `pmap` alike, address space claimed is not
memory used. Comparing a reserved figure against a container limit produces alarm about nothing.

**★ Two of these branches end in "wait longer".** Distinguishing a leak from allocator retention,
and distinguishing legitimate class loading from a classloader leak, both need more than one
observation. There is no command that shortens them, and guessing instead is how the wrong fix
ships.

**★ Fixing the symptom is available at every step and is almost always wrong.** Raising `-Xmx`,
raising the container limit, adding `MALLOC_ARENA_MAX`, scheduling restarts — each makes the
graph look better and none of them answers which region was growing. Do them to buy time
deliberately, and say out loud that that is what you are doing.

## Interview questions

**★ A service is being OOMKilled in Kubernetes. The heap graph is flat and healthy. Walk me
through your investigation.**
First, confirm the JVM is the process being killed and read the cgroup's actual limit rather than
the manifest — a container's limit is shared, and the JVM is the obvious suspect rather than
necessarily the right one. Then note what the failure *is*: OOMKilled means the kernel enforced a
limit on the whole process, not that the JVM ran out of heap, so a flat heap is consistent rather
than contradictory. That points at the non-heap regions, and NMT with a baseline taken after
warm-up and a diff over a meaningful interval says which: Class for metaspace and classloader
leaks, Thread for thread count times committed stack, Code for the code cache, Other most often
for direct byte buffers. If NMT is flat too, the growth is not the JVM's at all — the guide says
it does not track non-JVM allocation — and the investigation moves to `pmap` and
`smaps_rollup`, with the allocator's retained arenas as the most likely answer. Throughout,
whether the curve plateaus or keeps rising distinguishes retention from a leak.

**★ Why is "read the `OutOfMemoryError` message" a step of its own?**
Because only one of the messages means "the heap is too small", and treating them as
interchangeable sends you to the wrong region. `Metaspace` is class metadata, `Compressed class
space` is a bounded region inside it, `unable to create native thread` is stacks or an OS limit,
`Direct buffer memory` is native memory reached through `ByteBuffer`, and `Requested array size
exceeds VM limit` is about one allocation rather than the total. Raising `-Xmx` addresses exactly
one of them and wastes time — or masks the problem — for the rest.

**★ What would you put in place before an incident so that this checklist is actually runnable?**
Three flags and one packaging decision. `-XX:+HeapDumpOnOutOfMemoryError` with a `HeapDumpPath`
on storage that survives the container, because a dump written to an ephemeral filesystem is a
dump you will not have. Permanent rotated GC logging, because it is the only record of what the
heap was doing before the restart, plus `gc+heap+coops` if the heap is near the 32 GB boundary.
And a decision about NMT, since it cannot be attached to a running JVM — either pay the documented
5–10% permanently or be able to restart a replica with it in minutes. The packaging decision is
whether the image contains the JDK tools at all: a distroless image can leave you in an incident
with no `jcmd`.

**★ Your colleague's first move in every memory incident is to take a heap dump. Is that wrong?**
It is not wrong so much as premature, and the cost is real: a dump is large, taking it pauses the
application, and analysing it is slow. It answers exactly one question — what is retained on the
Java heap — so it is decisive when the live set is growing and irrelevant when it is not, which is
a substantial fraction of container memory incidents. Two cheaper steps come first: confirming
which process hit which limit, and confirming whether the failure was an `OutOfMemoryError` or an
OOMKill. Those cost seconds and frequently make the dump unnecessary.

**★ You have applied a fix and the graph looks better. How do you know you fixed it?**
By checking that the mechanism you changed is the mechanism that was growing, not just that the
number moved. Raising a limit, raising `-Xmx`, or restarting on a schedule all improve the graph
without addressing anything, and so does a traffic dip. The honest confirmation is the same
measurement that identified the cause: if it was a growing live set, live-set-after-full-GC should
now be flat across cycles; if it was an NMT category, the same baseline-and-diff should now show
it flat; if it was allocator retention, RSS should plateau lower. And if the fix was deliberately a
stopgap to buy time, that should be recorded as such rather than closed as resolved.

**★ What is the single most useful sentence from this topic?**
That `-Xmx` bounds the Java heap and nothing else. Metaspace, the code cache, thread stacks, GC
structures, direct and mapped buffers and the native allocator all live outside it, so "the heap
is fine" and "the process is fine" are different claims. Almost every surprising memory incident
in a container is that sentence being discovered the hard way, and every step of this checklist is
an attempt to find out which of those regions the question is really about.

{/* FOOTER */}
