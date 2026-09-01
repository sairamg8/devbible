---
title: "Finalization sits between weak and phantom reachability, so a finalizable object costs several collection cycles instead of one, and its replacement — the Cleaner API — fails silently and completely if the cleaning action holds a reference to the thing it is cleaning"
sidebar_label: "03b4 · Finalization and cleaners"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "Other Considerations → Finalization and Weak, Soft, and Phantom References",
> "Finalization", "Migrating from Finalization", "The try-with-Resources Statement" and "The
> Cleaner API" (including Figure 10-1, `CleanerExample`, and the production guidance that
> follows it)
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/other-considerations.html)),
> the **JDK 25 `jcmd` tool reference** for `GC.finalizer_info`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> and **JEP 421 · Deprecate Finalization for Removal**
> ([openjdk.org/jeps/421](https://openjdk.org/jeps/421)) as cited by the guide.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Finalization is deprecated for removal, is slower than its reputation suggests for a
mechanical reason worth understanding, and is still present in a surprising amount of running
code — including code you did not write. Its replacement, `Cleaner`, is better in three
documented ways and has one failure mode that produces no error, no log line and no
reclaimed resource. This page is the mechanism, the three commands that tell you whether a
live JVM is affected, and the exact shape of a `Cleaner` that works.**

## Finalization: deprecated, and slower than you think

> *"However, the use of finalization is discouraged. It can lead to problems with security,
> performance, and reliability. For instance, relying on finalization to close file
> descriptors makes an external resource (descriptors) dependent on garbage collection
> promptness."*
>
> *"Finalization has been deprecated in JDK 9. It also has been deprecated for removal in
> JDK 18; see JEP 421: Deprecate Finalization for Removal."*
>
> *"A class can declare a finalizer – the method `protected void finalize()` – whose body
> releases any underlying resources. The GC will schedule the finalizer of an unreachable
> object, which is called before the GC reclaims the object's memory."*

The cost is structural, not incidental. Recall the reachability pipeline from
[03b3](03b3-reference-processing.md): an object goes strong → soft → weak → *finalized* →
phantom → reclaimed, and each transition is discovered by a *collection*. A finalizable object
therefore has to be found weakly reachable in one cycle, queued, have its finalizer run by the
finalizer thread, be re-examined in a later cycle, become phantom reachable, and only then be
reclaimed. **Several collection cycles per object, plus a promotion into the old generation
for anything that survives long enough**, which is most of them.

## The three ways to find out whether it affects you

All production-safe, none requiring a restart:

> *"`jcmd` tool: Run the following command to print information about the Java finalization
> queue; the value `<pid>` is the PID of your JVM: `jcmd <pid> GC.finalizer_info`"*
>
> *"JDK Flight Recorder: The JDK Flight Recorder (JFR) event, `jdk.FinalizerStatistics`,
> identifies classes at run time that use finalizers. The event is enabled by default in the
> `default.jfc` and `profile.jfc` JFR configuration files. When enabled, JFR emits a
> `jdk.FinalizerStatistics` event for each instantiated class with a non-empty `finalize()`
> method."*
>
> *"The event includes the class that overrides `finalize()`, that class's `CodeSource`, the
> number of times the class's finalizer has run, and the number of objects still on the heap
> (and not yet finalized)."*
>
> *"JDK Mission Control: … In `MBean Features`, the attribute
> `ObjectPendingFinalizationCount` is the approximate number of objects that are pending
> finalization."*

`jdk.FinalizerStatistics` being **on by default in both stock JFR profiles** is the important
detail: if you already take flight recordings, the answer to "does anything in this
application still use finalizers" is already in them, along with the `CodeSource` that tells
you *which dependency* it came from. JFR itself is
[06 · JFR and profiling](../06-jfr-and-profiling/README.md).

`ObjectPendingFinalizationCount` is the one to put on a dashboard. A finalizer queue that
grows without bound means the single finalizer thread cannot keep up, and every object waiting
in it is retaining everything it references. That is a heap growth pattern that looks exactly
like a leak and is not one.

## The replacement, in the guide's own words

> *"The `try`-with-resources statement is a `try` statement that declares one or more
> resources. A resource is an object that must be closed after the program is finished with
> it. The `try`-with-resources statement ensures that each resource is closed at the end of
> the code block, even if one or more exceptions occur."*
>
> *"If you foresee that the lifecycle of a resource in your application will live beyond the
> scope of a `try`-with-resources statement, then you can use the Cleaner API instead. The
> Cleaner API allows a program to register a cleaning action for an object that is run some
> time after the object becomes unreachable."*

and the three advantages, quoted because each is a specific defect of finalizers:

> *"**More secure**: A cleaner must explicitly register an object. In addition, cleaning
> actions cannot access it so object resurrection is impossible."*
>
> *"**Better performance**: You have more control over when you register a cleaning action,
> which means a cleaning action never processes an uninitialized or partially initialized
> object. You can also cancel an object's cleaning action."*
>
> *"**More reliable**: You can control which threads run cleaning actions."*

and the caveat that stops `Cleaner` from being a general answer:

> *"However, like finalizers, the garbage collector schedules cleaning actions, so they may
> suffer from unbounded delays. Thus, don't use the cleaner API in situations where the timely
> release of a resource is required."*

## The three rules, and the one that fails silently

The guide's own implementation guidance for a production cleaner:

> *"The cleaning action class (`State` in this example) should be a private implementation
> detail. In particular, it shouldn't be used from the `main(String[])` method. Thus, your
> cleaning action class should be immutable whenever practical. A new object should handle
> creating its own cleaning action class and registering itself with a cleaner within its
> constructor."*
>
> *"Classes typically need access to objects within the cleaner action class. The simplest way
> to do this is for the object to save a reference to the cleaner action class."*
>
> *"`Cleaner` instances should be shared. In this example, all instances of `CleanerExample`
> should share a single, static `Cleaner` instance."*

Note the direction of the reference in the second rule: **the object holds the state, never
the reverse.** That is the whole safety property. If the cleaning action holds a reference to
the object being cleaned, the object is strongly reachable from the `Cleaner`, never becomes
phantom reachable, and the action never runs. No error, no log line, no reclaimed resource.

The guide's `CleanerExample` (Figure 10-1) puts the state in a separate `State` class for
exactly this reason. Here is the same shape with a deterministic path added:

```java
public final class Resource implements AutoCloseable {
    // Rule 3: one shared Cleaner for every instance of this class.
    private static final Cleaner CLEANER = Cleaner.create();

    // Rule 1: private, immutable, and holding NO reference to Resource.
    private static final class State implements Runnable {
        private final long handle;
        State(long handle) { this.handle = handle; }
        @Override public void run() { releaseNative(handle); }
    }

    // Rule 2: the object holds the state, not the other way round.
    private final State state;
    private final Cleaner.Cleanable cleanable;

    public Resource(long handle) {
        this.state = new State(handle);
        this.cleanable = CLEANER.register(this, state);   // registered in the constructor
    }

    @Override public void close() {
        cleanable.clean();   // deterministic release; idempotent, cancels the cleaner
    }
}
```

And the anti-pattern, which passes review because it is shorter:

```java
// WRONG: the lambda captures `this`. The Cleaner holds the lambda,
// so `this` is permanently strongly reachable and run() never fires.
CLEANER.register(this, () -> releaseNative(this.handle));
```

`close()` calling `cleanable.clean()` is the point: `Cleaner` is the *safety net*,
`try`-with-resources is the mechanism. The direct-`ByteBuffer` version of this exact pattern
is
[01 · Memory layout → 07b · Cleaners and deterministic release](../01-memory-layout/07b-cleaners-and-deterministic-release.md).

## Gotchas

**★ A finalizable object takes several collection cycles to die.**
The reachability pipeline is strong → soft → weak → *finalized* → phantom → reclaimed, and
each transition is discovered by a collection. An object with a finalizer is therefore
promoted, kept, queued, run, re-examined and only then reclaimed. That is the mechanical cost
behind "finalizers are slow", and it is why `Cleaner` — which enters at phantom reachability —
is cheaper as well as safer.

**★ A `Cleaner` action that captures the object it cleans never runs.**
The action is strongly reachable from the cleaner, and if it holds `this` then so is the
object, so the object is never unreachable and the cleanup never fires. The guide's rule —
*"your cleaning action class should be immutable whenever practical"* and should be a private
class rather than a capturing lambda — exists precisely to prevent this. It fails silently: no
error, no log, just a resource that is never released.

**★ `Cleaner` has no timing guarantee, and the guide says so.**
*"Like finalizers, the garbage collector schedules cleaning actions, so they may suffer from
unbounded delays. Thus, don't use the cleaner API in situations where the timely release of a
resource is required."* If a file descriptor or a socket must be released promptly,
`try`-with-resources is the mechanism and `Cleaner` is only the backstop for the case where
someone forgot.

**★ Every `Cleaner` instance is a thread.**
The guide's rule that *"`Cleaner` instances should be shared"* and that all instances of a
class should use *"a single, static `Cleaner` instance"* is not tidiness — creating a
`Cleaner` per object creates a thread per object. On a service that allocates such objects per
request this is a thread-count incident, not a GC one; see
[01 · Memory layout → 06d](../01-memory-layout/06d-the-thread-count-arithmetic.md).

**★ You may already have the finalizer answer without instrumenting anything.**
`jdk.FinalizerStatistics` is *"enabled by default in the `default.jfc` and `profile.jfc` JFR
configuration files"*, so any existing flight recording names every class with a non-empty
`finalize()` — and its `CodeSource`, which tells you which dependency introduced it. The live
equivalent is one command: `jcmd <pid> GC.finalizer_info`.

**★ A growing finalizer queue looks exactly like a memory leak in a heap dump.**
Objects awaiting finalization are reachable from the finalizer queue and retain everything
they reference. If the single finalizer thread cannot keep up — because a finalizer blocks on
I/O, for instance — the queue grows and the heap grows with it. A dominator tree will point at
the finalizer reference chain, which is a true answer to the wrong question;
`ObjectPendingFinalizationCount` is the number that says what is actually happening.

**★ A finalizer can resurrect its object; a cleaning action cannot.**
`finalize()` receives `this` and may store it somewhere reachable, which un-kills the object
and means its finalizer will never run again. The guide's phrasing for the alternative is
*"cleaning actions cannot access it so object resurrection is impossible"*. This is not a
theoretical concern in code that once used finalizers to return objects to a pool.

**★ `finalize()` runs on an object whose constructor may have thrown.**
The finalizer of a partially constructed object is still scheduled, so it can observe fields
that were never initialised. The guide's phrasing for `Cleaner` is that a cleaning action
*"never processes an uninitialized or partially initialized object"* — because registration is
an explicit act that happens after the state object is built.

**★ `Cleanable.clean()` is the cancel button, and calling it is what makes `close()` cheap.**
Once `clean()` has run, the cleaner has nothing left to do for that object, so a resource
closed deterministically never enters the phantom-reachability path at all. A `close()` that
does the work itself and *does not* call `cleanable.clean()` leaves the registration live and
the object queued for a cleanup that will double-release.

## Interview questions

**★ Finalizers versus `Cleaner` — what actually changes?**
Four things, and the guide names three of them. Security: a cleaning action *"cannot access"*
the object, so resurrection is impossible, whereas a finalizer receives `this` and can
republish it. Correctness: a cleaning action *"never processes an uninitialized or partially
initialized object"*, whereas a finalizer runs on an object whose constructor may have thrown.
Control: you choose the thread. And cost: finalization sits between weak and phantom
reachability so it adds collection cycles, while `Cleaner` acts at phantom reachability. What
does *not* change is timing — the guide is explicit that cleaners *"may suffer from unbounded
delays"* — so neither is a substitute for `try`-with-resources.

**★ How would you find out whether a running production JVM still uses finalizers?**
Three ways, none of which requires a restart. `jcmd <pid> GC.finalizer_info` prints
information about the finalization queue directly. If you already collect JDK Flight Recorder
recordings, the answer is in them already: `jdk.FinalizerStatistics` is enabled by default in
both the `default.jfc` and `profile.jfc` profiles and emits an event *"for each instantiated
class with a non-empty `finalize()` method"*, including the class, its `CodeSource`, how many
times the finalizer ran and how many objects are still pending — the `CodeSource` is what tells
you which third-party jar to raise an issue against. And via JMX, the `Memory` MBean's
`ObjectPendingFinalizationCount` attribute gives the approximate queue depth, which is the
number to alert on if it grows.

**★ A colleague writes `CLEANER.register(this, () -> close())`. What is wrong with it?**
The lambda captures `this`, so the cleaning action holds a strong reference to the object it
is meant to clean up. The `Cleaner` holds the action, so the object is permanently strongly
reachable, never becomes phantom reachable, and the cleaning action never runs — the resource
leaks and nothing anywhere reports an error. The fix is the shape the tuning guide prescribes:
a private, immutable state class holding only the raw resource handle, constructed and
registered inside the owning object's constructor, with `close()` calling
`Cleanable.clean()` for the deterministic path. It is a silent failure, which is why it is
worth recognising on sight in a code review.

**★ A heap dump's dominator tree says the biggest retainer is the finalizer reference queue.
What is the diagnosis?**
That the application creates finalizable objects faster than the single finalizer thread can
process them, or that some finalizer is blocking. Everything sitting in the queue is reachable
and retains its whole object graph, so the heap grows in a way that looks like a leak but is
really a backlog. The confirming measurement is `ObjectPendingFinalizationCount` over time, or
`jcmd GC.finalizer_info`. The fix is not GC tuning; it is finding the class with the
`finalize()` method — `jdk.FinalizerStatistics` names it and its `CodeSource` — and replacing
it with `try`-with-resources plus a `Cleaner` backstop. If it is in a dependency, pinning a
newer version is often enough, since most libraries have already migrated.

**★ Why is `try`-with-resources still the answer when `Cleaner` exists?**
Because `Cleaner` gives you no timing guarantee and `try`-with-resources gives you an exact
one. The guide says cleaning actions *"may suffer from unbounded delays"* and explicitly tells
you not to use the API *"in situations where the timely release of a resource is required"* —
which describes file descriptors, sockets, database connections and locks, i.e. most resources
worth releasing. The correct structure uses both: `try`-with-resources as the mechanism that
releases the resource at a known point, and a `Cleaner` registration as a safety net for the
paths where a caller failed to use it, with `close()` calling `Cleanable.clean()` so the
safety net is cancelled once the deterministic path has run.

{/* FOOTER */}
