---
title: "A JVM can fail on memory in two completely different ways, and telling OutOfMemoryError apart from OOMKilled in the first thirty seconds decides which half of your tools are useless"
sidebar_label: "01b · OOMError vs OOMKilled"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 Troubleshooting Guide**, "Troubleshoot Memory
> Leaks → Understand the OutOfMemoryError Exception"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html))
> and "Diagnostic Tools → Native Memory Tracking"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html)),
> and the **JDK 25 `java` tool reference** — `-Xmx`, `-XX:MaxDirectMemorySize`
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**`OutOfMemoryError` is the JVM telling you that one of *its* limits was reached; OOMKilled
is the kernel telling you nothing at all, because `SIGKILL` cannot be handled. The first
gives you a stack trace, a detail message naming the exact region, an optional heap dump and
a chance to run shutdown hooks. The second gives you exit code 137 and a restarted pod. They
have different causes, different fixes and almost no overlapping evidence — and the single
most expensive mistake in production Java is spending an afternoon on heap dumps for an
incident that was never about the heap.**

## The two failures, side by side

| | `OutOfMemoryError` | OOMKilled |
|---|---|---|
| Raised by | the JVM, in Java, on a Java thread | the Linux kernel's cgroup memory controller |
| Signal | none — it is a `java.lang.Error` | `SIGKILL` (9) |
| Stack trace | yes | none |
| Detail message | yes, and it names the region | none |
| Runs `finally` / shutdown hooks | yes (unreliably, but yes) | **no** |
| `-XX:+HeapDumpOnOutOfMemoryError` | fires | does not fire |
| Exit status | whatever your handler chooses | 137 (128 + 9) |
| Evidence lives in | the application log, the dump | `dmesg`, the kubelet, `kubectl describe pod` |
| Correct first tool | GC log, then heap dump | Native Memory Tracking |

The row that matters most is "detail message", because it is the JVM naming the region for
you, for free, in the log line you already have.

## Seven detail messages, and only two of them are about `-Xmx`

The JDK 25 Troubleshooting Guide enumerates the detail messages appended after
`java.lang.OutOfMemoryError:`. There are **seven**, and reading them is faster than any
tooling:

> *"**Java heap space** — indicates that an object could not be allocated in the Java heap.
> This error does not necessarily imply a memory leak."*
>
> *"**GC Overhead limit exceeded** — indicates that the garbage collector (GC) is running
> most of the time, and the Java application is making very slow progress. After a garbage
> collection, if the Java application spends more than approximately 98% of its time
> performing garbage collection and if it is recovering less than 2% of the heap and has been
> doing so for the last five (compile-time constant) consecutive garbage collections, then a
> `java.lang.OutOfMemoryError` error is thrown."*
>
> *"**Requested array size exceeds VM limit**"*
>
> *"**Metaspace** — Java class metadata … is allocated in native memory (referred to here as
> Metaspace). If the Metaspace for class metadata is exhausted, a
> `java.lang.OutOfMemoryError` error with a detail message Metaspace is thrown."*
>
> *"**request size bytes for reason. Out of swap space?** … Java reports this apparent error
> when an allocation from the native heap failed and the native heap might be close to
> exhaustion."*
>
> *"**Compressed class space** — … If `UseCompressedClassPointers` is true, the amount of
> space available for class metadata is fixed at the amount `CompressedClassSpaceSize`."*
>
> *"**reason stack_trace (Native method)** — … the allocation failure was detected in a Java
> Native Interface (JNI) or native method rather than in the JVM itself."*

Only the first two are heap. `Metaspace` and `Compressed class space` are native class
metadata — raising `-Xmx` does not add a byte to either. `Out of swap space?` and
`(Native method)` are the native heap. The full inventory with worked diagnoses is
**04 · `OutOfMemoryError`** *(not written yet)*.

Two of these are not on that list and are worth knowing anyway, because they come from
regions this topic owns: direct-buffer exhaustion against `-XX:MaxDirectMemorySize` — whose
message is **not** the short string people grep for but
`Cannot reserve N bytes of direct buffer memory (allocated: …, limit: …)`, thrown by
`java.nio.Bits` — [07 · Direct and mapped buffers](07-direct-and-mapped-buffers.md) —
and `java.lang.OutOfMemoryError: unable to create native thread`, which is a thread-stack and
process-limit problem, not a heap problem — [06 · Thread stacks](06-thread-stacks.md).

## Where the rest of this argument lives

Four follow-on questions have their own pages because each has its own set of traps. *What
does the JVM do when it throws, and which of those hooks actually fire?* is
[01c · The OOM flags and what they cover](01c-the-oom-flags-and-what-they-cover.md) — the
answer is "less than you think", and the man page says so in a sentence most people have
never read. *How do you get a heap dump deliberately without causing a second incident?* is
[01d · Taking a heap dump on purpose](01d-taking-a-heap-dump-on-purpose.md). *How much memory
does a JVM need beyond `-Xmx`?* is [01e · The native budget](01e-the-native-budget.md), and
the three numbers that all get called "memory" are
[01f · Reserved, committed and resident](01f-reserved-committed-and-resident.md).

## Gotchas

**★ Exit code 137 is not an `OutOfMemoryError` and never will be.**
137 is 128 + SIGKILL(9). `SIGKILL` cannot be caught, blocked or handled. No shutdown hook
runs, no heap dump is written, no `finally` executes, no log line is flushed. If your runbook
says "check the heap dump" for a 137, the runbook is wrong: there is no heap dump and there
never was going to be one.

**★ "The heap graph is flat" is evidence, not an all-clear.**
A flat, healthy heap graph next to a rising RSS graph is the *signature* of a native
footprint problem. It is the most information-dense pair of graphs in this phase, and teams
routinely read it as "memory is fine" and go looking somewhere else entirely.

**★ `GC Overhead limit exceeded` is a heap message that arrives *before* the heap is
technically full.**
The documented rule is 98 percent of time in GC recovering less than 2 percent of the heap
for five consecutive collections. The practical consequence is that a service can spend
minutes effectively dead — every request timing out — before the error is thrown. If your
alerting only watches for `OutOfMemoryError`, you missed the outage; watch GC time as a
fraction of wall clock.

**★ The Troubleshooting Guide's `Metaspace` advice contains a line that reads oddly in 2026.**
It says *"Metaspace is allocated from the same address space as the Java heap. Reducing the
size of the Java heap will make more space available for Metaspace."* On a 64-bit machine
with a normal heap, address space is not the scarce resource — physical memory is, and the
sentence is really about the total memory budget. Do not read it as "metaspace comes out of
`-Xmx`". It does not.

**★ An `OutOfMemoryError` caught and swallowed is worse than a crash.**
It is an `Error`, not an `Exception`, but a `catch (Throwable t)` in a framework thread pool
will catch it, and the thread that hit the allocation failure is rarely the thread that
caused the retention. The service then limps along in a half-broken state with no restart
and no alert. `-XX:+ExitOnOutOfMemoryError` or `-XX:+CrashOnOutOfMemoryError` turns it back
into a clean, visible failure that the orchestrator can act on.

**★ `Requested array size exceeds VM limit` is not about how much memory you have.**
It means the requested array length exceeded the VM's own maximum array size, which on
HotSpot is a little under `Integer.MAX_VALUE` elements because the array header consumes
part of the allocation. It is thrown regardless of heap size, so raising `-Xmx` changes
nothing. The cause is nearly always an unbounded `ByteArrayOutputStream`, an unbounded
`StringBuilder`, or a `List` being grown from untrusted input.

**★ The two "native" detail messages point at different places.**
`request size bytes for reason. Out of swap space?` means an allocation *inside the JVM*
failed; `reason stack_trace (Native method)` means the failure was *"detected in a Java
Native Interface (JNI) or native method rather than in the JVM itself"*. The first sends you
to NMT and the JVM's own regions; the second sends you to whatever native library is in your
stack, which NMT cannot see.

**★ A Kubernetes `OOMKilled` can also be the *container's* limit, not the pod's.**
A multi-container pod has per-container limits, and a sidecar that is killed makes the pod
look like it failed on memory while the JVM was innocent. Read
`kubectl describe pod` for *which* container has `Last State: Terminated / Reason: OOMKilled`
before you start tuning the JVM at all.

**★ A JVM can also be killed by the *host* OOM killer, which behaves differently.**
The cgroup killer targets the offending cgroup; the global killer picks a victim by score,
and a JVM with a large RSS is an attractive one. In that case the JVM may be killed because
some *other* process exhausted the machine, and no amount of JVM tuning will help. `dmesg`
distinguishes them — the global killer logs the whole candidate table.

**★ Two `OutOfMemoryError`s in the same JVM can have different causes.**
Once memory is tight, secondary failures cascade: a thread that cannot allocate throws, the
handler tries to log, the logger cannot allocate a buffer, and the stack traces you collect
are all from the aftermath rather than the cause. The first one in the log is the evidence;
the rest are noise. This is another argument for `-XX:+ExitOnOutOfMemoryError`.

**★ The failure can be a `StackOverflowError` wearing a memory costume.**
Deep recursion exhausts one thread's stack and throws `StackOverflowError`, not
`OutOfMemoryError`, and the process footprint barely moves. It looks like a memory bug in a
dashboard and is not one. [06 · Thread stacks](06-thread-stacks.md) covers the distinction.

**★ Neither failure mode tells you the *rate*.**
Both are terminal events. A leak that doubles RSS in ten minutes and one that doubles it in
ten days produce the same 137. The rate is the most useful single number for identifying the
cause, and you only have it if you were already recording RSS and heap over time. Record
both, always.

## Interview questions

**★ What is the difference between `OutOfMemoryError` and OOMKilled?**
`OutOfMemoryError` is a Java `Error` thrown by the JVM when one of the JVM's own limits is
reached — the heap, metaspace, compressed class space, the direct-buffer limit, the array
length limit, or a failed native allocation inside the VM. It has a stack trace, it triggers
`-XX:+HeapDumpOnOutOfMemoryError`, and the detail message says which limit. OOMKilled is the
kernel sending `SIGKILL` because the cgroup memory limit was exceeded; the JVM is never
consulted and cannot react. The consequence is diagnostic: the first leaves evidence inside
the JVM, the second leaves evidence only outside it.

**★ Your service throws `OutOfMemoryError: Metaspace` and a colleague raises `-Xmx`. What
happens?**
Nothing good. Metaspace is native memory bounded by `-XX:MaxMetaspaceSize`, not by `-Xmx`;
raising the heap ceiling adds no metaspace at all. In a container it makes things worse
twice over: the bigger heap commits more memory, squeezing the native budget metaspace draws
from, and the bigger heap collects less often, so dead classloaders are unloaded *later*. The
correct response is to find the classloader leak; the second-best is to cap metaspace
explicitly so you get a diagnosable `OutOfMemoryError` instead of a silent OOMKill.

**★ Why does the JVM sometimes report `OutOfMemoryError: unable to create native thread` on a
machine with plenty of free memory?**
Because that message is not about the heap and often not about memory at all. Creating a
platform thread requires a fresh native stack — 1 MB or 2 MB of address space depending on
platform — plus an OS thread, and it fails if the process hits `ulimit -u`, the cgroup pids
limit, `vm.max_map_count`, or the address space limit. "Plenty of free memory" is consistent
with every one of those. The fix is usually to bound the thread count or to move to virtual
threads, not to add RAM.

**★ Which failure mode do you consider worse for a service: an `OutOfMemoryError` or an
OOMKill, and why?**
An `OutOfMemoryError` that is caught and swallowed, which is worse than either. A clean
OOMKill at least restarts the process into a known-good state and shows up as a pod restart
count someone will notice. An uncaught `OutOfMemoryError` also fails loudly. But an `Error`
absorbed by a framework's `catch (Throwable)` leaves a process that is alive, passing its
liveness probe, and failing a fraction of requests indefinitely with no restart and no
alert. That is why `-XX:+ExitOnOutOfMemoryError` is worth its keep in a container: it
converts the worst mode into the merely bad one.

**★ How can a JVM be OOMKilled without ever having reached `-Xmx`?**
Because the kernel measures the whole process and `-Xmx` measures one region of it. The
resident set is the heap's committed-and-touched pages plus metaspace, plus the committed
part of a 240 MB code cache reservation, plus every platform thread's touched stack pages,
plus the GC's card tables and remembered sets, plus direct buffers, plus whatever glibc's
allocator is holding. Any of those can grow while the heap sits at half of `-Xmx`. The heap
does not have to be full for the process to be over its limit; usually it is not.

**★ Which of the seven `OutOfMemoryError` detail messages are *not* fixed by more heap?**
Five of them. `Metaspace` and `Compressed class space` are native class metadata bounded by
`MaxMetaspaceSize` and `CompressedClassSpaceSize`. `request size bytes for reason. Out of
swap space?` and `reason stack_trace (Native method)` are native-heap exhaustion, where a
larger Java heap makes things strictly worse by consuming more of the same physical memory.
`Requested array size exceeds VM limit` is a hard VM limit on array length that has nothing
to do with available memory. Only `Java heap space` and `GC Overhead limit exceeded` respond
to `-Xmx` — and `GC Overhead limit exceeded` often responds better to fixing the retention.

**★ Your monitoring alerts on `OutOfMemoryError` in the logs. What incidents does that miss?**
Every OOMKill, because there is no log line. Every `GC Overhead limit exceeded` outage that
resolved before the error threshold was crossed, because the service was effectively dead for
minutes while technically healthy. Every degraded-but-alive process where an `Error` was
swallowed by a `catch (Throwable)`. And every `StackOverflowError`. Alerting on the exception
text is alerting on one symptom of one failure mode; alert on pod restart reason, on GC time
as a fraction of wall clock, and on RSS relative to the limit instead.

{/* FOOTER */}
