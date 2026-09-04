---
title: "The Troubleshooting Guide lists excessive finalization as a cause of Java heap space, and the mechanism is that a finalizable object needs two garbage collections to die while a single daemon thread decides how fast that happens"
sidebar_label: "07b · Finalizers and cleaners"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Understand the
> OutOfMemoryError Exception" and "Monitoring the Objects Pending Finalization"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)),
> the **HotSpot Garbage Collection Tuning Guide, Release 25**, "Other Considerations →
> Finalization and Weak, Soft, and Phantom References" and "→ Migrating from Finalization"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/)), the **JDK 25 `jcmd`
> tool reference** for `GC.finalizer_info`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)), and the
> **Eclipse Memory Analyzer documentation** for the `Finalizable` and `Unfinalized` GC root types
> ([help.eclipse.org](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/concepts/gcroots.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Finalization is deprecated for removal and almost nobody writes a `finalize` method any more, and
yet it still causes `OutOfMemoryError: Java heap space` in production — because the objects with
finalizers are in your dependencies, not in your code. The Troubleshooting Guide names it as a
cause under the very first detail message, and the mechanism is worth understanding for the same
reason as the mechanism behind `Cleaner`, which replaced it and has one of the same problems.**

## The mechanism, in the guide's words

> *"One other potential source of this error arises with applications that make excessive use of
> finalizers. If a class has a `finalize` method, then **objects of that type do not have their
> space reclaimed at garbage collection time**. Instead, after garbage collection, the objects are
> **queued for finalization**, which occurs at a later time. In the Oracle implementations of the
> Java Runtime, finalizers are executed by **a daemon thread** that services the finalization queue.
> **If the thread cannot keep up with the finalization queue, then the Java heap could fill up**, and
> this kind of `java.lang.OutOfMemoryError` error would be thrown. One scenario that can cause this
> situation is when an application creates high-priority threads that cause the finalization queue
> to increase at a rate that is faster than the rate at which the finalizer thread is servicing that
> queue."*

Three facts in that paragraph do all the work:

**A finalizable object takes at least two collections to die.** The first discovers it is
unreachable and enqueues it; the finalizer runs; a later collection actually reclaims it. In the
meantime the object *and everything it references* is retained.

**There is one finalizer thread.** Not a pool. Its throughput is a single thread's throughput, and
it is a daemon, so it gets no priority guarantees.

**Production rate can exceed consumption rate indefinitely.** Nothing applies backpressure. The
queue grows, the retained graph grows with it, and the heap fills — with objects that are already
garbage.

## Why this reaches you even though you did not write a finalizer

The finalizable objects in a modern application come from dependencies and from the JDK itself:
native-resource wrappers in image, crypto, compression and database libraries; some
`FileInputStream`/`FileOutputStream` lineages; older HTTP and socket abstractions; and
`Object.finalize` overrides in code that predates try-with-resources.

Which means the diagnosis has to be a measurement rather than a code search.

## Measuring it

The guide gives three routes, and one of them is a single command:

```bash
jcmd <pid> GC.finalizer_info      # "Provides information about the Java finalization queue."  Impact: Medium
```

> *"Run the following command to print information about the Java finalization queue"* — from the
> tuning guide, which also names the JMX attribute and the JFR event:

**JMX.** `java.lang.Memory`'s `ObjectPendingFinalizationCount` attribute — *"the approximate number
of objects that are pending finalization"* — readable from `MemoryMXBean.getObjectPendingFinalizationCount()`
and therefore exportable as a metric. The guide's caveat is *"The count is approximate, but it can
be used to characterize an application and understand if it relies heavily on finalization."*

🔴 **A monotonically rising `ObjectPendingFinalizationCount` under stable load is the whole
diagnosis.** It is one gauge, it costs nothing, and almost nobody exports it.

**JFR.** The event, verbatim:

> *"The JDK Flight Recorder (JFR) event, `jdk.FinalizerStatistics`, identifies classes at run time
> that use finalizers. The event is **enabled by default in the `default.jfc` and `profile.jfc` JFR
> configuration files.** When enabled, JFR emits a `jdk.FinalizerStatistics` event for each
> instantiated class with a non-empty `finalize()` method. The event includes the class that
> overrides `finalize()`, that class's `CodeSource`, the number of times the class's finalizer has
> run, and the number of objects still on the heap (and not yet finalized)."*

That is the best answer to "which of my dependencies uses finalizers", it is on by default in the
standard recording templates, and `CodeSource` names the jar.

**In a heap dump.** MAT exposes two GC root types for this:

> *"**Finalizable** — An object which is in a queue awaiting its finalizer to be run."*
>
> *"**Unfinalized** — An object which has a finalize method, but has not been finalized and is not yet
> on the finalizer queue."*

A large population of objects whose only root is `Finalizable` is a finalizer backlog, and it looks
exactly like a leak with no owner — which is why knowing the root type exists saves an afternoon.

## Status: deprecated for removal

> *"However, the use of finalization is discouraged. It can lead to problems with security,
> performance, and reliability. For instance, relying on finalization to close file descriptors
> makes an external resource (descriptors) dependent on garbage collection promptness."*
>
> *"Note: Finalization has been deprecated in JDK 9. It also has been **deprecated for removal in
> JDK 18**; see JEP 421: Deprecate Finalization for Removal."*

So this is a problem with an end date, and until then it is a problem in code you do not own.

## The replacements

The guide names two, in order of preference.

**try-with-resources**, for anything whose lifetime is lexical:

> *"The `try`-with-resources statement ensures that each resource is closed at the end of the code
> block, even if one or more exceptions occur."*

**`Cleaner`**, for anything whose lifetime is not:

> *"If you foresee that the lifecycle of a resource in your application will live beyond the scope
> of a `try`-with-resources statement, then you can use the Cleaner API instead. The Cleaner API
> allows a program to register a cleaning action for an object that is run some time after the
> object becomes unreachable."*

Its advantages, verbatim:

> *"**More secure**: A cleaner must explicitly register an object. In addition, cleaning actions
> cannot access it so **object resurrection is impossible**."*
>
> *"**Better performance**: You have more control over when you register a cleaning action, which
> means a cleaning action never processes an uninitialized or partially initialized object. You can
> also cancel an object's cleaning action."*
>
> *"**More reliable**: You can control which threads run cleaning actions."*

🔴 **And the limitation it shares with finalization, which the guide states plainly:**

> *"However, like finalizers, the garbage collector schedules cleaning actions, so **they may suffer
> from unbounded delays**. Thus, don't use the cleaner API in situations where the timely release of
> a resource is required."*

`Cleaner` fixes resurrection, partial initialisation and thread control. It does **not** fix "the
resource is released whenever a collection gets round to it". That is the same property that makes
direct `ByteBuffer` reclamation dependent on GC ([02d](02d-the-messages-that-are-not-on-the-list.md))
and it is the reason `Cleaner` is a safety net rather than a resource-management strategy.

## Writing one correctly

The guide's rules for production use, condensed into the shape they imply:

> *"The cleaning action class (`State` in this example) should be a private implementation detail. In
> particular, it shouldn't be used from the `main(String[])` method. Thus, your cleaning action class
> should be **immutable** whenever practical."*
>
> *"`Cleaner` instances should be shared. In this example, all instances of `CleanerExample` should
> share a single, **static** `Cleaner` instance."*

```java
public final class NativeHandle implements AutoCloseable {

    private static final Cleaner CLEANER = Cleaner.create();   // shared, static

    // must NOT reference the enclosing NativeHandle — that would keep it reachable for ever
    private record State(long address) implements Runnable {
        @Override public void run() { free(address); }
    }

    private final State state;
    private final Cleaner.Cleanable cleanable;

    public NativeHandle(long address) {
        this.state = new State(address);
        this.cleanable = CLEANER.register(this, state);
    }

    @Override public void close() { cleanable.clean(); }        // the deterministic path
}
```

🔴 **The cleaning action must not capture the object being registered.** A lambda that touches
`this`, or a non-static inner class, makes the object strongly reachable from the cleaner — so it
is never phantom-reachable, the action never runs, and you have built a leak whose stated purpose
was to prevent one. Making the state a `record` or a `static` nested class is the mechanical
defence.

And note `close()` calling `cleanable.clean()`: **the `Cleaner` is the backstop and
`AutoCloseable` is the contract.** Registering a cleaner and *not* implementing `AutoCloseable`
means every release waits for a collection.

## Gotchas

**★ A finalizable object needs at least two collections to die, and retains its whole graph in
between.** The first collection enqueues it; the finalizer runs later; a subsequent collection
reclaims it. Everything the object references is retained across that whole interval, so the heap
cost is the transitive graph, not the object.

**★ There is exactly one finalizer thread and nothing applies backpressure.**
The guide names the failure directly: *"If the thread cannot keep up with the finalization queue,
then the Java heap could fill up."* Production rate is your application's; consumption rate is one
daemon thread's.

**★ The finalizable objects are in your dependencies, not your code.**
Grepping your source for `finalize` finds nothing and proves nothing. `jdk.FinalizerStatistics` —
enabled by default in `default.jfc` and `profile.jfc` — names the classes and their `CodeSource`,
which is the jar.

**★ `ObjectPendingFinalizationCount` is one JMX gauge and almost nobody exports it.**
A monotonic rise under stable load is a complete diagnosis. The guide calls the count approximate
and says it *"can be used to characterize an application"* — which is exactly what a metric is for.

**★ `Finalizable` and `Unfinalized` are GC root types in MAT.**
A large population rooted only by the finalizer queue is a backlog, not a leak with a missing owner.
Without knowing those root types exist, the dump looks like objects being retained by nothing.

**★ `Cleaner` does not make release timely, and the guide says so.**
*"like finalizers, the garbage collector schedules cleaning actions, so they may suffer from
unbounded delays."* If timely release matters, the answer is `AutoCloseable` and
try-with-resources, with the cleaner only as a backstop for the case where somebody forgot.

**★ A cleaning action that captures the registered object never runs.**
A lambda referencing `this`, or a non-static inner class, keeps the object strongly reachable from
the `Cleaner`, so it is never phantom-reachable. The action never fires and the object never dies.
This is the single most common `Cleaner` bug, and it converts a cleanup mechanism into a leak.

**★ `Cleaner` instances should be shared, not created per object.**
Each `Cleaner.create()` starts a thread. One per object is a thread leak on top of everything else.
A single `private static final Cleaner` per class or per library is the documented shape.

**★ Registering a cleaner without implementing `AutoCloseable` guarantees late release.**
The cleaner is the fallback; `close()` calling `cleanable.clean()` is the path that actually runs
on time. A class with a cleaner and no `close` has made every release dependent on the collector.

**★ Finalization is deprecated for removal, so this is a problem with an end date and no fix now.**
JEP 421 deprecated it for removal in JDK 18. It still exists on JDK 25 and the objects using it are
still in your dependency tree, so the operational answer is measurement and dependency upgrades
rather than a code change you can make.

## Interview questions

**★ How can finalizers cause `OutOfMemoryError: Java heap space`?**
Because a finalizable object is not reclaimed at the collection that finds it unreachable. It is
queued instead, its finalizer runs later on a single daemon thread, and only a subsequent collection
reclaims it — so the object and its entire transitive graph stay on the heap for at least two
collection cycles. If the application creates finalizable objects faster than that one thread can
service the queue, and nothing applies backpressure, the queue and the retained graph grow without
bound. The Troubleshooting Guide names this under `Java heap space` specifically, and the diagnosis
is `jcmd GC.finalizer_info`, the `ObjectPendingFinalizationCount` JMX attribute, or MAT's
`Finalizable` root type.

**★ You do not write finalizers. Why should you care?**
Because your dependencies do. Native-resource wrappers in imaging, crypto, compression and database
libraries, and some older JDK stream lineages, still carry `finalize` methods, and the failure mode
is yours regardless of who wrote the code. The way to find out is `jdk.FinalizerStatistics`, a JFR
event enabled by default in both the `default.jfc` and `profile.jfc` templates, which emits one
event per instantiated class with a non-empty `finalize()` and includes the class's `CodeSource` —
so it names the jar. That is a fifteen-second answer to a question a source grep cannot answer at
all.

**★ What does `Cleaner` fix relative to finalization, and what does it not fix?**
It fixes resurrection, because a cleaning action cannot access the object it is cleaning up after;
partial initialisation, because you choose when to register; cancellability, because
`Cleanable.clean()` can be called explicitly; and thread control, because you decide which cleaner
and therefore which thread runs the action. It does **not** fix timeliness — the tuning guide says
*"like finalizers, the garbage collector schedules cleaning actions, so they may suffer from
unbounded delays. Thus, don't use the cleaner API in situations where the timely release of a
resource is required."* So `Cleaner` belongs as a backstop behind an `AutoCloseable` contract, never
as the primary mechanism.

**★ What is the classic bug when writing a `Cleaner`?**
Capturing the registered object in the cleaning action. If the action is a lambda that touches
`this`, or a non-static inner class with its implicit outer reference, the `Cleaner` holds the
object strongly — so it never becomes phantom-reachable, the action never runs, the resource is
never released, and the object never dies. The mechanical defence is to make the cleaning action a
`static` nested class or a `record` holding only the primitive state it needs, so it is impossible
for it to reference the enclosing instance. The second most common bug is creating one `Cleaner`
per object rather than sharing a static instance, since each `Cleaner.create()` starts a thread.

**★ You see millions of objects in a heap dump whose only GC root is "Finalizable". What is that?**
A finalization backlog. Those objects are already unreachable from application code — they have been
queued for finalization and the single finalizer thread has not got to them, so MAT reports the
queue itself as their root. It looks like a leak with no owner, which is confusing until you know
that `Finalizable` and `Unfinalized` are root types. The confirmation is
`ObjectPendingFinalizationCount` rising, or `jcmd GC.finalizer_info`, and the fix is to identify the
class via `jdk.FinalizerStatistics` and either reduce the creation rate or replace the dependency.

{/* FOOTER */}
