---
title: "A virtual thread's stack is an object on the Java heap that grows and shrinks, so -Xss stops being a per-thread reservation and the cost of a million threads moves from a region -Xmx cannot see into one it can"
sidebar_label: "06b · Virtual thread stacks"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against **JEP 444: Virtual Threads** (final in JDK 21), sections
> *"Memory use and interaction with garbage collection"*, *"Scheduling virtual threads"* and
> *"Pinning"* ([openjdk.org](https://openjdk.org/jeps/444)); **JEP 491: Synchronize Virtual
> Threads without Pinning** (delivered in **JDK 24**)
> ([openjdk.org](https://openjdk.org/jeps/491)); the **JDK 25
> `Thread.Builder.OfVirtual`** javadoc
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.Builder.OfVirtual.html));
> and the **JDK 25 core-libraries "Virtual Threads" guide**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/core/virtual-threads.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A platform thread's stack is a fixed-size native reservation made by the operating system.
A virtual thread's stack is a Java object on the garbage-collected heap that grows and shrinks
as the thread runs. Everything surprising about virtual-thread memory follows from that one
substitution: `-Xss` no longer multiplies by the thread count, `-Xmx` finally does bound the
stack, the failure mode changes from "unable to create native thread" to `OutOfMemoryError:
Java heap space`, and the GC now has an opinion about your call depth.**

## The one sentence that explains the whole chunk

JEP 444, verbatim:

> *"The stacks of virtual threads are stored in Java's garbage-collected heap as **stack chunk
> objects**. The stacks grow and shrink as the application runs, both to be memory-efficient
> and to accommodate stacks of depth up to the JVM's configured platform thread stack size.
> This efficiency is what enables a large number of virtual threads and thus the continued
> viability of the thread-per-request style in server applications."*

Three separate claims are packed in there and each one changes a number in your memory budget:

1. **"stored in Java's garbage-collected heap as stack chunk objects"** — the stack is heap.
   It is bounded by `-Xmx`, it is traced by the collector, it is reported in a heap dump, and
   it disappears when the virtual thread becomes unreachable, with no OS involvement at all.
2. **"grow and shrink as the application runs"** — nothing is reserved up front. A virtual
   thread that only ever runs three frames deep occupies a stack chunk sized for three frames.
   This is precisely the property HotSpot does *not* give platform threads, which get a
   fixed-size stack at creation and keep it until they die.
3. **"up to the JVM's configured platform thread stack size"** — `-Xss` has not stopped
   mattering. It still sets the *ceiling on depth*. It has simply stopped being a per-thread
   *reservation*.

🔴 That third point is the correction most material gets wrong in both directions. "`-Xss` does
not apply to virtual threads" is too strong: the JEP says the stacks accommodate depth *up to*
the configured platform thread stack size, so `-Xss` is still the depth budget. What is no
longer true is that `-Xss` costs you anything per virtual thread. Both halves of that sentence
have to survive into your mental model.

## `Thread.Builder.OfVirtual` has no `stackSize`, and that is the API telling you

`Thread.Builder.OfPlatform` declares `name`, `inheritInheritableThreadLocals`,
`uncaughtExceptionHandler`, `group`, `daemon`, `priority` and **`stackSize`**.
`Thread.Builder.OfVirtual` declares `name`, `inheritInheritableThreadLocals` and
`uncaughtExceptionHandler` — and nothing else.

```java
Thread.ofPlatform().stackSize(8L * 1024 * 1024).start(task);   // compiles
Thread.ofVirtual().stackSize(8L * 1024 * 1024).start(task);    // does not compile
```

There is no per-virtual-thread stack size because there is no per-virtual-thread reservation to
size. If you need one virtual thread to recurse very deeply, the knobs available to you are the
global `-Xss` and rewriting the recursion — the same two options, minus the targeted one.

## Virtual thread stacks are not GC roots

> *"Unlike platform thread stacks, virtual thread stacks are not GC roots. Thus the references
> they contain are not traversed in a stop-the-world pause by garbage collectors, such as G1,
> that perform concurrent heap scanning."*

This is a genuinely good property and it is easy to under-appreciate. With a million platform
threads (which you could not have anyway), a million stacks would have to be scanned in the
root-scanning phase of every GC, and root scanning is stop-the-world work. Virtual thread
stacks are ordinary heap objects reached from the virtual thread object, so they are traced
concurrently along with everything else. The pause does not scale with the number of virtual
threads; it scales with the number of *carriers*, which is bounded by the scheduler's
parallelism.

The flip side is that everything a suspended virtual thread's frames reference is **strongly
reachable from the heap**. A million parked virtual threads, each holding a 1 MB byte array in
a local variable, is a terabyte of live data that no GC can collect and no `-Xss` accounting
would have predicted. Local variables in a blocked virtual thread are, for retention purposes,
fields of a live heap object.

## The failure mode changes, and so does the flag that fixes it

| | Platform threads | Virtual threads |
|---|---|---|
| Stack location | native, outside the heap | Java heap, as stack chunk objects |
| Sized by | `-Xss`, fixed at creation | grows and shrinks; `-Xss` is the depth ceiling |
| Bounded by | nothing (thread count × `-Xss`) | `-Xmx` |
| Visible to GC | as a root, scanned in a pause | as ordinary heap objects, traced concurrently |
| Exhaustion looks like | `OutOfMemoryError: unable to create native thread…` | `OutOfMemoryError: Java heap space` |
| Visible in a heap dump | no | yes |
| Diagnosed with | NMT `Thread` category | a heap dump |

The row that changes an on-call runbook is the second-to-last one. On a platform-thread service
you diagnose thread-stack pressure with Native Memory Tracking, because the memory is native.
On a virtual-thread service you diagnose it with a **heap dump**, because the memory is heap —
the stack chunks and everything their frames reference are right there in the dominator tree.
Reaching for NMT on a virtual-thread footprint problem finds nothing and wastes an hour.

## The G1 humongous stack chunk limitation

JEP 444 states a limitation you should know exists before you meet it:

> *"A current limitation of virtual threads is that the G1 GC does not support humongous stack
> chunk objects. If a virtual thread's stack reaches half the region size, which could be as
> small as 512KB, then a `StackOverflowError` might be thrown."*

G1 calls any object larger than half a region *humongous* and allocates it through a special
path; stack chunks are excluded from that path. The consequence is a `StackOverflowError`
thrown at a depth that has nothing to do with `-Xss` and everything to do with
`-XX:G1HeapRegionSize`, which G1 derives ergonomically from the heap size. A small heap gives
small regions, and small regions give a low stack-chunk ceiling.

I could not find a JDK 25 document stating that this limitation has been lifted, so treat it as
current: if a virtual thread overflows at a depth a platform thread handles comfortably, the
region size is the suspect, not `-Xss`. G1's region sizing is
**Topic 02 · GC in practice** *(not written yet)*'s subject; the interaction is noted here
because the symptom shows up as a stack error, not a GC error.

## Seeing a stack that is an object

A stack that lives on the heap is not something `jstack` was designed to print. JEP 444 says so
and introduces a different dump:

> *"Unfortunately the JDK's traditional thread dump, obtained with `jstack` or `jcmd`, presents a
> flat list of threads. This is suitable for dozens or hundreds of platform threads, but is
> unsuitable for thousands or millions of virtual threads. Accordingly, we will not extend
> traditional thread dumps to include virtual threads; we will, rather, introduce a new kind of
> thread dump in `jcmd` to present virtual threads alongside platform threads, all grouped in a
> meaningful way."*

```
jcmd <pid> Thread.dump_to_file -format=json <file>
```

Two properties of that dump are load-bearing for a memory investigation:

> *"The new thread dump format does not include object addresses, locks, JNI statistics, heap
> statistics, and other information that appears in traditional thread dumps. Moreover, because
> it might need to list a great many threads, generating a new thread dump does not pause the
> application."*

No pause is the reason you can take one on a busy production service; no lock information is the
reason it does not replace `jcmd Thread.print` when you are hunting a deadlock. And there is a
way to become invisible in it:

> *"If the system property `jdk.trackAllThreads` is set to false … virtual threads created
> directly with the `Thread.Builder` API will not always be tracked by the runtime and may not
> appear in the new thread dump."*

The reading order for the rest of this material: how a virtual thread's frames get between the
carrier's native stack and the heap, what still pins them there, and what the carriers
themselves cost, is [06c · Carriers, mounting and pinning](06c-carriers-mounting-and-pinning.md).
The full thread-dump treatment belongs to **Topic 05 · Thread dumps** *(not written yet)*.

## Gotchas

**★ `jstack` does not list virtual threads, and never will.**
JEP 444: *"we will not extend traditional thread dumps to include virtual threads"*. A
traditional dump of a virtual-thread service shows you the carriers and nothing else, which
looks reassuringly small and tells you nothing. Use `jcmd <pid> Thread.dump_to_file`.

**★ The new thread dump omits lock information.**
*"The new thread dump format does not include object addresses, locks, JNI statistics, heap
statistics…"*. It is the right tool for "what are my million threads doing" and the wrong tool
for "who holds the monitor". Deadlock hunting still needs `jcmd Thread.print`.

**★ `-Djdk.trackAllThreads=false` can hide threads from the dump.**
JEP 444 states that with it set, virtual threads created directly with the `Thread.Builder` API
*"may not appear in the new thread dump"*. If a dump shows fewer threads than you know exist,
check that property before concluding the threads finished.

**★ "`-Xss` does not apply to virtual threads" is half wrong.**
It no longer *reserves* anything per virtual thread, but JEP 444 says stacks grow *"to
accommodate stacks of depth up to the JVM's configured platform thread stack size"* — so `-Xss`
is still the depth ceiling. Lowering `-Xss` to shrink a virtual-thread service's footprint saves
nothing and lowers the depth at which every virtual thread overflows.

**★ You cannot give one virtual thread a bigger stack.**
`Thread.Builder.OfVirtual` has no `stackSize` method. The targeted escape hatch that exists for
platform threads simply is not there, so a legitimately deep call path either runs on a platform
thread or gets rewritten iteratively.

**★ Local variables in a parked virtual thread are heap retention.**
The stack chunk is a heap object and everything its frames reference is strongly reachable from
it. A million parked virtual threads each holding a large buffer in a local is a live-set
problem that looks nothing like a thread problem, and it shows up in a heap dump as ordinary
retained size — which is exactly why it is findable.

**★ Virtual-thread memory pressure is a heap dump problem, not an NMT problem.**
NMT's `Thread` category counts native stacks. Virtual thread stacks are not there. Running NMT
against a virtual-thread footprint question and finding a small `Thread` figure proves nothing.

**★ A virtual thread can hit `StackOverflowError` at a depth a platform thread survives.**
JEP 444: G1 does not support humongous stack chunk objects, so a stack that reaches half the G1
region size — *"which could be as small as 512KB"* — may overflow. The lever is the heap region
size, not `-Xss`, which makes this one genuinely hard to guess at 03:00.

**★ Where does a virtual thread's stack live, and what bounds it?**
On the Java heap, as stack chunk objects — JEP 444's own term. It is bounded by `-Xmx`, traced
by the garbage collector, visible in a heap dump, and reclaimed when the virtual thread becomes
unreachable. That is the single structural difference from a platform thread, whose stack is a
fixed native allocation made by the OS at thread creation and bounded by nothing except the
thread count multiplied by `-Xss`.

**★ Does `-Xss` still mean anything with virtual threads?**
Yes, but only as a ceiling. JEP 444 says the stacks grow and shrink *"to accommodate stacks of
depth up to the JVM's configured platform thread stack size"*, so `-Xss` still determines how
deep a virtual thread can recurse. What it no longer does is reserve memory per thread — which
is why a million virtual threads is a viable thing to say and a million platform threads is not.
Note also that `Thread.Builder.OfVirtual` has no `stackSize` method, so `-Xss` is the *only*
lever, and it is global.

**★ A service running a million virtual threads gets an `OutOfMemoryError`. Which one, and how
do you diagnose it?**
`Java heap space`, and with a heap dump. Because virtual thread stacks are heap objects, running
out of room for them is an ordinary heap exhaustion, and the stack chunks plus everything their
frames reference appear in the dominator tree like any other retained set. The instinct trained
on platform threads — reach for NMT, look at the `Thread` category — finds nothing here, because
there are no native stacks to count beyond the carriers.

**★ Why are virtual thread stacks not GC roots, and why is that good?**
Because they are ordinary objects in the heap, reachable from the virtual thread object, rather
than native memory regions the collector must enumerate. JEP 444 states it directly: their
references *"are not traversed in a stop-the-world pause by garbage collectors, such as G1, that
perform concurrent heap scanning."* The benefit is that root-scanning pause time scales with the
number of *carriers*, not with the number of virtual threads — otherwise a million threads would
mean a million stacks to scan in every pause, and the whole design would collapse.

**★ Why might a virtual thread throw `StackOverflowError` where a platform thread does not?**
Because of the G1 humongous-object limitation JEP 444 records: G1 does not support humongous
stack chunk objects, so if a virtual thread's stack reaches half the G1 region size — which the
JEP notes *"could be as small as 512KB"* — a `StackOverflowError` may be thrown. Region size is
derived ergonomically from the heap size, so a small heap produces small regions and a
correspondingly low ceiling. Raising `-Xss` does not help; the lever is the heap and region
sizing, or removing the depth.

**★ How do you inspect a service running a million virtual threads?**
Not with `jstack`. JEP 444 explicitly declined to extend the traditional thread dump to virtual
threads and added `jcmd <pid> Thread.dump_to_file -format=json <file>` instead, which groups
threads meaningfully and — importantly for production — does not pause the application while it
is generated. The trade-off is that the new format omits object addresses, locks, JNI statistics
and heap statistics, so it answers "what are they all doing" and not "who holds this monitor".
Also check `jdk.trackAllThreads`: with it set to false, virtual threads created directly through
the `Thread.Builder` API may not be listed at all.

**★ Why can you not simply run a million platform threads with a small `-Xss` instead?**
Because the cost is not only the stack reservation. Each platform thread is an OS thread, so you
pay a kernel task structure, a scheduler entry, and a place in every root-scanning pause, and you
are bounded by process and system limits on thread counts and memory mappings long before you
reach a million. Shrinking `-Xss` reduces one term and leaves all the others. Virtual threads
change the structure rather than the constant: the stack becomes a growable heap object, the
scheduling is done in user space by a `ForkJoinPool`, and the stacks stop being GC roots.

{/* FOOTER */}
