---
title: "From the error line to the fix in nine steps, where the first four cost seconds and eliminate most of the possibilities, and the expensive one that everybody starts with is number six"
sidebar_label: "08 · The checklist"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 — this chunk asserts no new facts. Every message, flag, command and
> threshold below is established and sourced in the chunk it links to; the underlying sources are
> the **JDK 25 Troubleshooting Guide**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)),
> the **JDK 25 `java` and `jcmd` tool references**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)), the
> **HotSpot GC Tuning Guide, Release 25**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/)), the **JDK 25 HotSpot
> source at tag `jdk-25+36`** ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/tree/jdk-25%2B36))
> and the **Eclipse Memory Analyzer documentation**
> ([help.eclipse.org](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/)).
> **No sandbox** — commands and their documented behaviour only. No captured output.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**This is the topic compressed into the sequence you run when a service has just died and you have
a log line and a PID. The order is the content: each step is chosen because it eliminates the most
possibilities per second spent, and the reason it is worth having written down is that the tool
everybody reaches for first — the heap dump — is step six.**

## The sequence

### 1 · Is it an `OutOfMemoryError` at all?

Exit code 137 with no stack trace is an OOMKill: the kernel, not the JVM, and there is no dump and
never was. Exit code **3** is `-XX:+ExitOnOutOfMemoryError` doing its job. Anything else, read the
log.
[`../01-memory-layout/01b`](../01-memory-layout/01b-oom-error-versus-oomkilled.md) ·
[03](03-the-oom-hooks-are-one-function.md)

### 2 · Read the word after the colon

Nine possible messages, three regions, and only two of them mean "add heap". This step costs zero
seconds and eliminates seven of the nine possibilities.
[02](02-the-seven-documented-messages.md) · [02b](02b-the-four-native-messages.md) ·
[02d](02d-the-messages-that-are-not-on-the-list.md) · [02e](02e-the-message-decides-the-fix.md)

⚠️ If the message is `Direct buffer memory` or `unable to create native thread` and you cannot find
it in Oracle's documentation, you have not misread the log — those come from `java.nio.Bits` and
`os.hpp` and are not on the guide's list.

### 3 · Find the *first* error, not the latest

The JVM's OOM hooks fire once per process lifetime, and it stops attaching stack traces after four
errors. The first occurrence has the trace and owns the one heap dump; everything after it is
aftermath.
[01b](01b-the-error-with-no-stack-trace.md) · [03](03-the-oom-hooks-are-one-function.md)

### 4 · Take the cheap probe that matches the message

```bash
jcmd <pid> GC.heap_info           # Impact: Medium — is the live set even large?
jcmd <pid> VM.classloader_stats   # Impact: Low    — metaspace / class space
jcmd <pid> VM.metaspace basic     # basic needs no safepoint
jcmd <pid> GC.finalizer_info      # Impact: Medium — a finalizer backlog
jcmd <pid> VM.native_memory summary.diff   # needs NMT at launch
```

⚠️ `GC.class_histogram` is rated **Impact: High**, the same as a dump. It is not a free probe.
[02e](02e-the-message-decides-the-fix.md) · [03c](03c-getting-a-heap-dump.md)

### 5 · Decide whether it is a leak before you look for one

Post-collection live set, under stable load, after warm-up. Flat means sizing; ratcheting means
retention; plateauing above `-Xmx` is a leak with a finite key space. This step uses the GC log,
which either exists already or never will.
[06](06-when-it-is-not-a-leak.md)

### 6 · Only now, the dump

```bash
jcmd <pid> GC.heap_dump -parallel=8 -gz=1 /var/dumps/x_%p.hprof.gz
```

Default = full GC first, reachable objects only, which is the retention question. `-all` inverts
both and answers the churn question. A mounted volume, a raised probe timeout, and a machine that
can parse the result — all decided before you type it.
[03c](03c-getting-a-heap-dump.md) · [03d](03d-the-dump-you-could-not-take.md)

### 7 · Dominator tree, then accumulation point, then path to GC roots

Not the histogram. Sort by retained heap; find the object whose retained size is huge and shallow
size is tiny; walk down to where retention fans out; walk up to the root. Read the report's
"The instance is referenced by" line, which is MAT deliberately skipping past the JDK to your code.
[04](04-reading-a-dump-in-mat.md) · [04b](04b-shallow-versus-retained.md) ·
[04c](04c-leak-suspects-and-paths-to-gc-roots.md)

### 8 · Match the chain to one of the known shapes

| The chain ends at | Read |
|---|---|
| a static field holding a collection | [05](05-the-usual-suspects.md) |
| a `Thread` → `threadLocals` → `table` | [05b](05b-threadlocal-on-a-pooled-thread.md) |
| a `ClassLoader` with no live instances | [05c](05c-finding-a-classloader-leak-in-a-dump.md) |
| a listener list, an MBean, a driver, a hook | [05d](05d-listeners-callbacks-and-forgotten-registrations.md) |
| a queue backing array | [05](05-the-usual-suspects.md) — unbounded queue |
| `Finalizable` / `Unfinalized` | [07b](07b-finalizers-and-cleaners.md) |
| a `SoftReference` / `WeakHashMap` | [07](07-references-and-caches.md) |

### 9 · Verify by re-measuring, not by re-reading

Reproduce the event that caused the growth, repeatedly, and confirm the post-collection live set
returns to baseline rather than ratcheting. Path to GC Roots shows *one* path and there are usually
several, so "we fixed it and it still leaks" normally means one of three references was cut.
[04c](04c-leak-suspects-and-paths-to-gc-roots.md) · [06](06-when-it-is-not-a-leak.md)

## The one-page version

| Symptom | First question | Tool |
|---|---|---|
| Exit 137, no trace | Which process? Which limit? | `kubectl describe pod`, `dmesg` |
| Exit 3 | The JVM chose to die | Find the first OOM in the log |
| `Java heap space` | Is the live set rising? | GC log → dump |
| `GC overhead limit exceeded` | Are you on Parallel GC? | GC log — G1 cannot print this |
| `Requested array size…` | Which frame? | The stack trace *is* the bug |
| `Metaspace` / `Compressed class space` | Is the class count rising? | `VM.classloader_stats` |
| `Out of swap space?` | Where is the `hs_err` log? | Read it — there is no dump |
| `(Native method)` | Which native library? | `pmap`, `smaps_rollup` |
| `Cannot reserve … direct buffer memory` | `allocated:` vs `limit:`? | Read the message itself |
| `unable to create native thread` | Threads? `pids.max`? `ulimit -u`? | The `log_warning` line above it |
| Trace-less OOM | How many came before? | Find error number one |

## What to configure before the next one

Six lines, and the argument for each is that the data cannot be recovered afterwards.

```
# a clean, visible, unambiguous death (exit code 3, no shutdown hooks)
-XX:+ExitOnOutOfMemoryError

# the one dump the JVM will write, somewhere that survives the container
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/var/dumps

# the only record of what the heap was doing before the restart
-Xlog:gc*:file=/var/log/gc.log:uptime,level,tags:filecount=5,filesize=20M

# the metaspace report HotSpot already writes and nobody enables
-Xlog:gc+metaspace+freelist+oom=info:file=/var/log/metaspace-oom.log

# allocation sites and paths to GC roots, continuously, documented at "less than 1%"
-XX:StartFlightRecording
```

Plus two decisions that are not flags. **Native Memory Tracking cannot be attached to a running
JVM** — either pay for it permanently or be able to restart one replica with it in minutes. And
**can you run `jcmd` inside the container at all?** A distroless image leaves you in an incident
with no JVM tooling.

And one thing to bound rather than to observe: **set `-XX:MaxMetaspaceSize`**, because unbounded by
default is precisely why metaspace growth arrives as an exit code 137 with no Java-side evidence
instead of as a diagnosable `OutOfMemoryError`.

## Gotchas

**★ The commonest mistake is starting at step 6.**
The heap dump is the tool people know, so it is the tool they reach for — including for the six of
nine messages where the file physically cannot contain the answer. Steps 1 to 4 cost seconds and
eliminate more.

**★ The latest `OutOfMemoryError` in the log is the least informative one.**
The hooks fired for the first; the stack traces stopped after the fourth. Reading the newest line is
reading the aftermath of something that happened hours earlier.

**★ Two of the nine messages are not in Oracle's documentation and two more are undocumented
HotSpot strings.** Failing to find `unable to create native thread` or
`Cannot reserve … direct buffer memory` in the guide does not mean you misread the log. Say "seven
documented, plus these".

**★ `GC overhead limit exceeded` cannot be produced by the default collector.**
It is Parallel GC only. On G1 a service that is 98 percent GC-bound simply keeps going until
something else kills it. Its absence proves nothing.

**★ `-XX:+HeapDumpOnOutOfMemoryError` produces exactly one file, ever.**
A `static int` and a compare-and-swap, never reset. "We had six OOMs and one dump" is by design, and
the one you have is the useful one.

**★ `-XX:+ExitOnOutOfMemoryError` runs no shutdown hooks.**
`os::_exit(3)`, described in the source as *"quick exit with no cleanup hooks run"*. Graceful
shutdown and this flag do not compose, and that is deliberate — cleanup would need to allocate.

**★ The dump you configured is on a filesystem that no longer exists.**
`HeapDumpPath` defaults to the working directory, which in a container is ephemeral overlay
storage. This is the single most common reason a correctly configured flag produced nothing.

**★ Three of the branches end in "measure again later".**
Leak versus working set, class-loading growth versus classloader leak, and verifying a fix all need
more than one observation. There is no command that shortens them, and guessing instead is how the
wrong fix ships.

**★ Fixing the symptom is available at every step and is almost always wrong.**
Raising `-Xmx`, raising the container limit, disabling `UseGCOverheadLimit`, restarting nightly —
each makes the graph look better and answers nothing. Do them deliberately to buy time, record the
date, and say out loud that that is what you did.

**★ In a container, raising `-Xmx` for a non-heap message is a regression, not a neutral change.**
The heap and the failing region share one cgroup limit, and `MaxDirectMemorySize` defaults to
`-Xmx`, so the worst-case native footprint rises with the heap you just enlarged.

**★ Most of this checklist is unrunnable if nothing was configured beforehand.**
GC logs, NMT, JFR and a durable `HeapDumpPath` are all launch-time decisions. The step that
actually prevents the next bad incident is the last section of this page, done today.

## Interview questions

**★ Walk me through your response to `java.lang.OutOfMemoryError` in production.**
Read the detail message first, because only two of the nine mean "add heap" and the rest send you to
five different regions with five different tools. Then find the *first* occurrence in the log rather
than the latest, since the JVM's OOM hooks fire once per process and it stops attaching stack traces
after the fourth error — so the first one owns both the trace and the single heap dump. Then run the
cheap probe that matches the message: `GC.heap_info` for the heap ones, `VM.classloader_stats` for
metaspace, the `hs_err` log for `Out of swap space?`, `pmap` for `(Native method)`. Only if the heap
is genuinely implicated and the live set is ratcheting do I take a dump, and then it is the dominator
tree sorted by retained heap, not the histogram. Verification is a re-measurement across load cycles,
not a re-read of the report.

**★ Which three things would you add to a service that has none of them, to make the next memory
incident diagnosable?** Permanent rotated GC logging, because live-set-after-full-GC is the only
reliable leak signal and it cannot be reconstructed afterwards.
`-XX:+HeapDumpOnOutOfMemoryError` with `-XX:HeapDumpPath` on a mounted volume, plus
`-XX:+ExitOnOutOfMemoryError` so the process dies cleanly at error number one — which is the only
error that gets both a trace and the dump. And `-XX:StartFlightRecording`, documented at *"less than
1%"* overhead and *"safe to have always on in production"*, because it is the only source of
allocation sites and a heap dump structurally cannot contain them. Then two decisions that are not
flags: an NMT policy, since it cannot be attached to a running JVM, and whether the container image
contains `jcmd` at all.

**★ What is the single most useful sentence in this topic?**
That the detail message names the region and the region decides the tool. `OutOfMemoryError` is one
exception class covering at least nine distinct failures across the Java heap, native class
metadata, a bounded klass-pointer sub-region, the native heap, a third-party library's allocator,
direct buffers, thread creation and a hard VM array limit. They share a name and nothing else — not
a cause, not a fix, not even the same evidence, since one of them takes the process down through the
fatal-error handler and two of them fire none of the JVM's OOM hooks at all. Everything else in this
topic is elaboration of that one distinction.

**★ Your team's runbook says "on OOM, take a heap dump and analyse it in MAT". What would you
change?** I would put four steps in front of it and one after. In front: read the detail message,
because for six of the nine the dump cannot contain the answer; find the first error rather than the
latest; run the cheap probe that matches the message; and check the post-collection live set to
decide whether this is retention at all. After: verify by re-measuring across load cycles rather
than by re-reading the report, since Path to GC Roots shows one path and leaked objects usually have
several. I would also add the practical preconditions to the dump step itself — a mounted volume, a
raised liveness-probe timeout, `-parallel` and `-gz`, and a machine that can index the file — because
a runbook that ends in "take a dump" and produces a truncated file on ephemeral storage has cost the
incident more than it gave it.

**★ A service is being killed with exit code 137 and the heap graph is flat. Is any of this topic
relevant?** Only the parts that tell you it is not. Exit 137 is `SIGKILL` from the kernel's cgroup
memory controller — no `OutOfMemoryError`, no stack trace, no detail message, no heap dump — so
every diagnostic in this topic is unavailable by construction, and a flat heap graph is consistent
with that rather than contradictory. The right move is to make the JVM's own limit bind *before* the
cgroup's, so a future occurrence becomes a diagnosable Java error: set `-XX:MaxMetaspaceSize`, set
`-XX:MaxDirectMemorySize` explicitly rather than letting it default to `-Xmx`, and keep the heap
ceiling low enough to leave native headroom. Until then the investigation belongs to Native Memory
Tracking and the container, not to this topic.

{/* FOOTER */}
