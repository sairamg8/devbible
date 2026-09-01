---
title: "A classloader leak costs native metaspace that no heap dump contains and is caused by a heap reference that every heap dump does contain, so the dump is the wrong tool for measuring it and the only tool for fixing it"
sidebar_label: "05c · Classloader leak in a dump"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Eclipse Memory Analyzer documentation** — "Reference →
> Inspections → Duplicate Classes", "Reference → Inspections → Path to GC Roots" and "Concepts →
> Garbage Collection Roots"
> ([help.eclipse.org](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/reference/inspections/duplicate_classes.html)),
> the **JDK 25 `jcmd` tool reference** for `VM.classloader_stats`, `VM.classloaders` and
> `VM.metaspace` with their documented impact levels
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)), and the
> **JDK 25 Troubleshooting Guide**'s class-loader-statistics section
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)).
> **The mechanism** — per-classloader arenas, reclamation only at loader death — is established
> from JEP 122 in
> [`../01-memory-layout/04c-the-classloader-leak.md`](../01-memory-layout/04c-the-classloader-leak.md)
> and is not re-derived here.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Topic 01 owns *why* a classloader leak happens: metaspace is allocated in per-loader arenas and
freed only when the loader dies. This chunk owns *what you do about it once you have a dump*, which
is a genuinely awkward workflow because cause and cost live in different places. The megabytes are
native and absent from the file. The reference pinning the loader is an ordinary Java reference and
is right there in it. So the dump cannot tell you the leak exists and is the only thing that can
tell you how to fix it — which is exactly the wrong way round from every other leak in this topic.**

## Order of operations, and why starting with the dump wastes a step

```bash
# 1 · is it classes at all, and is the count growing?
jcmd <pid> VM.native_memory summary        # watch Class committed and the "classes #" count

# 2 · which loader?   Impact: Low — safe on a live production JVM
jcmd <pid> VM.classloader_stats
jcmd <pid> VM.classloaders show-classes

# 3 · only now, why is it still reachable?
jcmd <pid> GC.heap_dump /var/dumps/loaders_%p.hprof
```

Steps 1 and 2 cost seconds. Step 3 costs a stop-the-world pause and several gigabytes. Doing them
in the other order is the standard mistake, and it is worse than merely slow: the heap dump of a
metaspace leak looks *fine*, because the retained heap of a leaked loader is small. You can stare
at a correct dump of a leaking JVM and conclude there is no problem.

The Troubleshooting Guide describes the shape of `VM.classloader_stats` output — one row per
loader with `ClassLoader`, `Parent`, `CLD*`, `Classes`, `ChunkSz`, `BlockSz` and `Type` columns —
and defines the two size columns:

> *"`ChunkSz`: Total size of all allocated metaspace chunks"*
>
> *"`BlockSz`: Total size of all allocated metaspace blocks (each chunk has several blocks)"*

🔴 **What you are looking for is many rows of the same `Type` with a small `Classes` count each.**
Dozens of `URLClassLoader` rows holding one class apiece, or one row per test class, or a growing
count of a framework's own loader type. A single loader with a large class count is a big
application; a hundred loaders of the same type is a leak.

## The three queries that matter once you have the dump

### Duplicate Classes

> *"Classes where there are two or more with the same name… Sometimes a class is replaced on the fly
> by the application or as part of a deploy/undeploy cycle in an application server and the old
> class loader and associated classes should be garbage collected. This can only happen once all
> the instances of classes, the classes themselves and the class loader are no longer accessible
> from the rest of the application or GC roots."*

And the tell that turns a list into a diagnosis:

> *"If there are **no or few instances** shown in a class loader line then that class loader might
> not be used anymore, but some spurious reference might be keeping the class loader alive or one
> of its defined classes or some of the instances alive, and so that class loader alive. The Path
> to GC Roots query can help tell why a class loader is kept alive."*

**A loader with zero live instances of its classes is the definition of a leaked loader.** It is
doing nothing, holds nothing you can use, and retains every byte of metadata for every class it
ever defined.

⚠️ **The false positive you will hit immediately:**

> *"Note: Java 8 and later virtual machines create some synthetic classes for lambda expressions.
> These can have names such as `java.lang.invoke.LambdaForm$DMH`, `java.lang.invoke.LambdaForm$MH`
> and `java.lang.invoke.LambdaForm$BMH`. These classes are unusual in that multiple classes of the
> same name are loaded by the same class loader. Unless you think you have a particular problem
> with lambda expressions… these classes can be ignored."*

Every modern application produces a long list of these. They are noise, and the distinguishing
feature is that they share *one* loader; the leak you want has *many* loaders sharing one class
name.

⚠️ And a second reading MAT itself offers: *"Possible cause: Several versions of the same library
are deployed."* Duplicate classes are not always a leak — sometimes they are a dependency problem
wearing the same clothes.

### Path to GC Roots on the loader

This is the query that produces the fix. Run it on the leaked `ClassLoader` instance and read the
chain from the loader outward to the root. The last few hops are the bug, and there is a short list
of what they usually are:

| Chain ends at | The pin |
|---|---|
| a `Thread` | a `ThreadLocal` value, or a thread the application started and never joined |
| a **System Class** static field | a registry, a driver list, a metrics map, a listener list |
| `Finalizable` / `Unfinalized` | an object with a finalizer that has not run |
| a **JNI Global** | a native agent or library holding a global reference |
| a **Busy Monitor** | something synchronized on an object from the dead loader |

Remember the reading direction: MAT's path tree runs *towards* the root, and *"the field in bold of
the object of a line actually refers to the preceding object in the tree view"*
([04c](04c-leak-suspects-and-paths-to-gc-roots.md)).

⚠️ **Ask for several paths.** A leaked loader is typically pinned by more than one reference, and
cutting one changes nothing. `-numberofpaths` exists for this, and "we fixed it and it still leaks"
is almost always this.

### Counting instances by loader

The dominator tree grouped **by class loader** — MAT's own advice for the diffuse case — turns a
question about metaspace into a question the heap dump can answer: which loader still has live
instances, and how many. A loader with one instance is as leaked as a loader with a thousand; the
instance count tells you *what kind* of pin you are looking for, because one instance suggests a
registry entry and thousands suggest the application is still running on the old loader.

## What the dump still cannot tell you

- **How much metaspace the leak costs.** Not in the file. `VM.classloader_stats`' `ChunkSz`
  column, or NMT's `Class` category.
- **Whether the loader would be collectable if you fixed this one path.** There may be others.
- **Whether unloading has simply not happened yet.** Classes become unloadable when the loader is
  unreachable, but the metadata is returned only when a collection actually unloads them. A JVM with
  a large heap that rarely performs the relevant collection holds unloadable metadata for a long
  time, which makes "we fixed the reference" hard to verify without forcing a collection.

That last point is the reason a fix has to be verified by *repetition* — trigger the loader-creating
event many times and watch the class count return to baseline rather than ratchet — not by a single
observation.

## Gotchas

**★ The heap dump of a metaspace leak looks healthy.**
The retained heap of a leaked loader is small; the cost is native and not in the file. Starting the
investigation with a dump produces a correct, reassuring, useless result. `VM.classloader_stats`
first, always — it is rated Impact: Low and answers the question in one command.

**★ `LambdaForm$DMH` / `$MH` / `$BMH` duplicates are normal and there will be many.**
MAT's documentation calls them out explicitly. Multiple same-named synthetic classes in *one*
loader is expected; the leak signature is one class name across *many* loaders.

**★ Duplicate classes can mean a dependency problem rather than a leak.**
*"Possible cause: Several versions of the same library are deployed."* Two loaders holding two
genuinely different versions of the same class is a build issue with entirely different symptoms
and an entirely different fix.

**★ "No or few instances" is the strongest signal in the whole query.**
A loader whose classes have no live instances is doing nothing and retaining everything. That row
is the one to run Path to GC Roots on, and MAT's documentation says so.

**★ One path is rarely the whole story.**
A leaked loader is usually pinned by a `ThreadLocal` *and* a registry entry *and* a shutdown hook.
Fixing one and re-testing produces "the fix did not work". Ask for several paths.

**★ Fixing the reference does not immediately return the metaspace.**
Unloading requires a collection that actually unloads classes. Verification therefore needs either a
forced collection or enough repetitions to be convincing; a single "the number did not drop"
observation proves nothing.

**★ `VM.classloader_stats` is Impact: Low and `GC.heap_dump` is Impact: High.**
The cheap command is the diagnostic and the expensive one is the follow-up. Most investigations of
this leak run long because that order was reversed.

**★ Test suites produce this more often than production does.**
An application context per test class, none closed, all inside one long-lived JVM. The symptom is a
build that gets slower and then dies, which almost nobody diagnoses as a metaspace problem. The fix
is the framework's context cache, not a bigger metaspace.

**★ A loader is only dead when every instance of every class it loaded is unreachable.**
That is a much stronger condition than it sounds, and it is why a single cached object, one MBean
registration or one un-deregistered JDBC driver pins thousands of classes' worth of metadata.

## Interview questions

**★ Why is a heap dump both the wrong tool and the right tool for a classloader leak?**
Wrong for detection and measurement, right for the fix. The leaked memory is native class metadata
allocated in per-loader arenas, and the HPROF format contains only the Java heap — so the file
cannot show you the cost, and a dump of a badly leaking JVM looks entirely healthy because the
retained *heap* of a leaked loader is small. But the cause is an ordinary Java reference pinning the
`ClassLoader` object, and that reference is in the file. So the correct sequence is
`VM.native_memory` and `VM.classloader_stats` to establish that classes are growing and to name the
loader, and only then a dump, whose job is exclusively to answer "what is still pointing at this
loader".

**★ In MAT, how do you identify a leaked classloader?**
Duplicate Classes, looking for one class name defined under several loaders, then reading the
instance counts. MAT's documentation gives the decisive tell: *"If there are no or few instances
shown in a class loader line then that class loader might not be used anymore, but some spurious
reference might be keeping the class loader alive."* A loader with zero live instances is doing
nothing and retaining every class it ever defined. Run Path to GC Roots on that loader and the chain
that appears is the bug — usually a thread-local, a static registry, a finalizable object, or a JNI
global reference. Ignore the `LambdaForm$MH`-family duplicates, which the documentation says are
expected in any JDK 8+ application.

**★ You fixed the reference and the class count did not fall. Did the fix work?**
Unknown from that observation, because reclamation is not immediate. Classes become *unloadable*
when their loader becomes unreachable, but the metadata is only returned when a collection actually
performs class unloading — and on a large heap that collection may be a long way off. So the
verification is not "did the number drop", it is "does the number stop ratcheting across
repetitions": trigger the loader-creating event many times and check that the loader count and the
`Class` committed value return to a baseline rather than climbing. The second possibility is that
the fix was correct but incomplete, because leaked loaders are typically pinned by more than one
reference and Path to GC Roots showed you only one.

**★ Duplicate Classes returns a hundred rows. How do you tell a leak from a normal application?**
By what shares what. The normal case is multiple same-named synthetic lambda classes loaded by a
single loader, which MAT documents as expected and says to ignore. The dependency case is one class
name under two loaders with meaningfully different implementations — several versions of a library
deployed together. The leak case is one class name under *many* loaders of the same type, with the
older ones holding few or no live instances, and a count that grows with redeploys, test classes,
tenants or generated proxies. Instance count and growth over time separate the three.

**★ A colleague wants to fix a metaspace leak by raising `-XX:MaxMetaspaceSize`. What do you say?**
That it is a legitimate stopgap and not a fix, and that it should be labelled as such out loud. If
the class count is merely *large* — a big application with many frameworks — then raising the limit
is the correct answer and there is no leak. If the class count is *growing*, raising the limit
multiplies the time to failure by whatever factor you raised it and changes nothing else; and in a
container it takes memory from the heap and every other native region. `VM.classloader_stats` run
twice, a few minutes apart, distinguishes the two cases in one Impact: Low command, and that should
happen before the flag changes.

{/* FOOTER */}
