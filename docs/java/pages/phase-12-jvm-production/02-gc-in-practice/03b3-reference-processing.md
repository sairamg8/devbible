---
title: "Reference processing is a stop-the-world phase whose size is set by application code that nobody thinks of as garbage collection work, and the flag that controls how long soft references live is denominated in free heap megabytes — so the retention policy of a soft cache changes every time somebody edits `-Xmx`"
sidebar_label: "03b3 · Reference processing"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "Garbage-First Garbage Collector Tuning → Reference Object Processing Takes
> Too Long" and Table 8-1
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html)),
> and "Other Considerations → Finalization and Weak, Soft, and Phantom References",
> "Reference-Object Types" and "Soft References"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/other-considerations.html)),
> the JDK 25 `java` tool reference for `-XX:SoftRefLRUPolicyMSPerMB`,
> `-XX:+ParallelRefProcEnabled` and `-XX:ReferencesPerThread`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and **JEP 421 · Deprecate Finalization for Removal**
> ([openjdk.org/jeps/421](https://openjdk.org/jeps/421)) as cited by the tuning guide.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**The Post Evacuate phase of a G1 pause is mostly reference processing, and its cost is set
by how many `Reference` objects the application keeps alive. Almost nobody writes
`new WeakReference<>(...)` on purpose in a business service, and almost every service has
millions of them anyway — via `WeakHashMap`, `ThreadLocal`, soft-reference caches, and one
`Cleaner` registration for every direct `ByteBuffer` ever allocated. This page is what the
collector has to do with them, the two flags that control how fast it does it, and the
soft-reference lifetime rule that makes soft caches behave in a way no application can
predict.**

## Reference processing, which is the phase people forget

> *"Information about the time taken for processing of Reference Objects is shown in the
> Reference Processing phase. During the Reference Processing phase, G1 updates the referents
> of Reference Objects according to the requirements of the particular type of Reference
> Object. By default, G1 tries to parallelize the sub-phases of Reference Processing using the
> following heuristic: for every `-XX:ReferencesPerThread` reference Objects start a single
> thread, bounded by the value in `-XX:ParallelGCThreads`. This heuristic can be disabled by
> setting `-XX:ReferencesPerThread` to 0 to use all available threads by default, or
> parallelization disabled completely by `-XX:-ParallelRefProcEnabled`."*

Table 8-1 gives the defaults: `-XX:+ParallelRefProcEnabled` and
`-XX:ReferencesPerThread=1000`, with *"A value of 0 indicates that the maximum number of
threads as indicated by the value of `-XX:ParallelGCThreads` will always be used."*

The man page adds a scoping detail that catches people migrating collectors:

> *"`-XX:+ParallelRefProcEnabled` — Enables parallel reference processing. By default,
> collectors employing multiple threads perform parallel reference processing if the number of
> parallel threads to use is larger than one. The option is available only when the throughput
> or G1 garbage collector is used (`-XX:+UseParallelGC` or `-XX:+UseG1GC`). Other collectors
> employing multiple threads always perform reference processing in parallel."*

So `-XX:+ParallelRefProcEnabled` in a ZGC command line is not doing anything; ZGC always
parallelises. It is also a flag that used to be genuinely necessary and is now a default —
copying it forward from a JDK 8 configuration is harmless but is a reliable marker that the
rest of the line is stale.

## The four reachability levels, which are the actual specification

> *"An object is **strongly reachable** if it can be reached by some thread without traversing
> any reference objects. A newly-created object is strongly reachable by the thread that
> created it."*
>
> *"An object is **softly reachable** if it is not strongly reachable but can be reached by
> traversing a soft reference."*
>
> *"An object is **weakly reachable** if it is neither strongly nor softly reachable but can be
> reached by traversing a weak reference. When the weak references to a weakly-reachable object
> are cleared, the object becomes eligible for finalization."*
>
> *"An object is **phantom reachable** if it is neither strongly, softly, nor weakly reachable,
> it has been finalized, and some phantom reference refers to it."*
>
> *"An object is **unreachable**, and therefore eligible for reclamation, when it is not
> reachable in any of the previous ways."*

Read that as a *pipeline*, because that is what the collector implements. An object that is
weakly reachable and has a finalizer has to be discovered, its weak references cleared, then
be queued for finalization, then be re-examined on a later cycle, then possibly be phantom
reachable, then be reclaimed. **That is several collection cycles and several passes of the
Reference Processing phase for one dead object.** It is the mechanical reason finalizers are
expensive, and the reason a `Cleaner`-based release is one cycle rather than three.

## Soft references, and the rule nobody knows

> *"Soft references are kept alive longer in the server virtual machine than in the client.
> The rate of clearing can be controlled with the command-line option
> `-XX:SoftRefLRUPolicyMSPerMB=<N>`, which specifies the number of milliseconds (ms) a soft
> reference will be kept alive (once it is no longer strongly reachable) **for each megabyte of
> free space in the heap**. The default value is 1000 ms per megabyte, which means that a soft
> reference will survive (after the last strong reference to the object has been collected) for
> 1 second for each megabyte of free space in the heap. This is an approximate figure because
> soft references are cleared only during garbage collection, which may occur sporadically."*

The man page adds the client-versus-server distinction as a design intent:

> *"The `-XX:SoftRefLRUPolicyMSPerMB` option accepts integer values representing milliseconds
> per one megabyte of the current heap size (for Java HotSpot Client VM) or the maximum
> possible heap size (for Java HotSpot Server VM). This difference means that the Client VM
> tends to flush soft references rather than grow the heap, whereas the Server VM tends to grow
> the heap rather than flush soft references."*

⚠️ The two documents differ on the denominator — the tuning guide says *"free space in the
heap"*, the man page says the *"maximum possible heap size"* for the server VM. **They agree
on the thing that matters: the lifetime of a soft reference is a function of heap size, not
of anything the application decides.** I have not found a source that settles which of the
two phrasings describes JDK 25's implementation, and this page will not assert one.

Either way, the operational consequence is the same and it is severe: a soft-reference cache
on a large heap is effectively permanent, and the same cache after someone halves `-Xmx` for
a container is cleared aggressively. Nothing in the application changed. This is most of the
argument for using a bounded cache with an explicit eviction policy instead — an argument
made in full in
[01 · Memory layout → 12 · The checklist](../01-memory-layout/12-the-checklist.md).

## The tail of the pipeline

Finalization sits between weak and phantom reachability and costs an object several
collection cycles; `Cleaner` sits at phantom reachability and costs one. Both, and the three
ways to find out whether a running JVM still uses either, are
[03b4 · Finalization and cleaners](03b4-finalization-and-cleaners.md).

## Gotchas

**★ Reference Processing is a pause phase, and ordinary code fills it.**
`WeakHashMap`, `ThreadLocal`, soft-reference caches and every direct `ByteBuffer`'s `Cleaner`
create `Reference` objects. A large live population of them shows up as Post Evacuate time,
not as Object Copy time, and it is completely invisible to young-generation tuning.

**★ `-XX:ReferencesPerThread=0` means "use every thread", not "use none".**
It reads like a disable switch. Table 8-1: *"A value of 0 indicates that the maximum number of
threads as indicated by the value of `-XX:ParallelGCThreads` will always be used."* The flag
that actually disables parallelism is `-XX:-ParallelRefProcEnabled`.

**★ `SoftRefLRUPolicyMSPerMB` ties soft-reference lifetime to heap size.**
One second of extra lifetime per megabyte — of free heap according to the tuning guide, of
maximum heap according to the man page — means a soft-reference cache is nearly permanent on a
roomy heap and much shorter-lived on a small one. A `-Xmx` change alters your cache's
retention policy, and no line of application code records that dependency.

**★ `-XX:+ParallelRefProcEnabled` does nothing outside Parallel and G1.**
The man page: the option *"is available only when the throughput or G1 garbage collector is
used"*, and *"Other collectors employing multiple threads always perform reference processing
in parallel"*. Under ZGC it is a no-op that makes a command line look tuned.

**★ Reference processing time is not reduced by giving the JVM more heap.**
It is proportional to the number of live `Reference` objects, which a bigger heap does not
change — and for soft references, a bigger heap makes it *worse*, because they live longer.
This is one of the few GC problems where the reflexive "add memory" response is actively
counterproductive.

## Interview questions

**★ Your pause breakdown shows most of the time in Reference Processing. What is going on and
what would you do?**
The application has a large live population of `Reference` objects, and G1 must update every
referent according to its reference type during the pause. The usual sources are not
deliberate: `WeakHashMap`, `ThreadLocal` entries on pooled threads, soft-reference caches, and
every direct `ByteBuffer`, each of which registers a `Cleaner`. The tuning levers are
`-XX:ReferencesPerThread` (default 1000; one processing thread per that many references,
bounded by `ParallelGCThreads`; set to 0 to always use the maximum) and
`-XX:-ParallelRefProcEnabled` to turn parallelism off entirely. But the flags only change how
fast you process them — the real fix is usually to reduce the population, and for
soft-reference caches specifically to replace them with a bounded cache, because
`SoftRefLRUPolicyMSPerMB` ties their lifetime to heap size in a way no application can reason
about.

**★ What are the reachability levels, in order, and why does the order matter to the
collector?**
Strongly, softly, weakly, phantom, unreachable. Strongly reachable means reachable without
traversing any reference object. Softly reachable means reachable only through a soft
reference; weakly reachable means only through a weak reference, and clearing those weak
references makes the object *"eligible for finalization"*; phantom reachable means the object
has already been finalized and only a phantom reference refers to it. It matters because the
collector implements it as a pipeline: each level is discovered during a collection, and an
object can only descend one step per cycle. That is why an object with a finalizer takes
several collections to be reclaimed, and why phantom-reference-based cleanup — which is what
`Cleaner` uses — is cheaper than finalization.

**★ Why are soft references a bad basis for a cache?**
Because their lifetime is set by the JVM from heap size, not by the application from anything
meaningful. The default is one second of additional lifetime per megabyte, so on a large heap
soft entries effectively never clear and the cache is unbounded; on a small or full heap they
clear aggressively and the cache is useless. Reducing `-Xmx` for a container therefore
silently changes your cache's eviction policy, and there is no line of code anywhere that
records that dependency. On top of that, every soft reference is one more entry to process
inside a stop-the-world Reference Processing phase. A bounded cache with an explicit size or
time policy gives you a retention rule you chose, a memory cost you can compute, and no GC
pause contribution proportional to cache size.

{/* FOOTER */}
