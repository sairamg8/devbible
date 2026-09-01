---
title: "The Leak Suspects report is an algorithm with published rules rather than an oracle, and knowing that it starts at the dominator tree, uses a ten-percent threshold and ignores weak, soft, phantom and finalizer references is the difference between trusting it and being misled by it"
sidebar_label: "04c · Leak suspects and GC roots"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Eclipse Memory Analyzer documentation** — "Tasks → Running
> Leak Suspect Report", "Reference → Inspections → Path to GC Roots", "Reference → Inspections →
> Duplicate Classes", "Reference → Query Matrix → Finding Memory Leak" and "Tasks → Batch mode"
> ([help.eclipse.org](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/tasks/runningleaksuspectreport.html)).
> **No sandbox** — no report was generated for this page; every rule, threshold and phrase below is
> quoted from MAT's own documentation.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**"Run Leak Suspects and see what it says" is reasonable advice that becomes much better advice
once you know what the report is doing. It is a documented algorithm: start at the dominator tree,
flag anything retaining more than a configurable share of the heap, then walk down to the point
where retention fans out, then walk up to the shortest path from a GC root. Every step has a rule
you can check, and one of the rules — that paths ignore weak, soft, phantom and finalizer
references — is the reason it sometimes reports "no suspects" on a heap that is unmistakably
leaking.**

## What the report does, step by step

> *"The standard leak suspects report operates just using the heap dump data, which is a snapshot
> from a particular moment. **It does not use any time information as to when objects were
> allocated.**"*

That first sentence is a limitation worth internalising: the report cannot distinguish "large
because it grew" from "large because it was always large". Two dumps can; one cannot.

> *"The starting point is the **dominator tree**. The biggest items at the top level of the
> dominator tree are analyzed, and if an item retains a significant amount of memory (**default is
> 10%**) then that item could be the cause of the memory leak because if it were no longer
> referenced then all that memory could be freed."*

🔴 **Ten percent is the threshold, and it is why a leak spread across twenty owners produces no
suspects.** The report has a second pass for exactly that case:

> *"It could be that single objects do not retain a significant amount of memory but many objects
> all of one type do. This is a second class of leak suspect. This type is found using the
> dominator tree, grouped by class."*

Then the descent:

> *"For a single object leak suspect the retained objects are analyzed in the dominator tree to see
> if there is an **accumulation point**. An accumulation point is an object with a big difference
> between the retained size of itself and the largest retained size of a child object. These are
> places where the memory of many small objects is accumulated under one object."*

And the ascent:

> *"The **Shortest Paths To the Accumulation Point** shows a path from a garbage collection root to
> the accumulation point. There will be other paths, otherwise an object on the path would retain
> the leak suspect, so itself would be considered a leak suspect."*

That parenthetical is a small, elegant proof: the report shows you *one* path, and it can do that
honestly because if there were only one path, the intermediate object would itself have been
flagged.

## The sentence in the report that names the fix

MAT documents the phrasing it uses, which is worth recognising because it is where the answer is:

> *"In the report, the text **Most of these instances are referenced from one instance of** introduces
> the accumulation point."*
>
> *"The query also attempts to find an **interesting** (not a standard Java class `java.`, `javax.`,
> `com.sun.`, `jdk.`) Java object which directly or indirectly refers to the accumulation point.
> This means that if the accumulation point is a array or object inside a standard Java collection
> then the interesting object might be part of the application itself. The text in the report
> **The instance is referenced by** introduces this interesting object."*

🔴 **"The instance is referenced by" is the line to read first.** The accumulation point is nearly
always a JDK collection — a `HashMap$Node[]`, an `Object[]`, a `ConcurrentHashMap$Node[]` — which
tells you nothing about your code. The "interesting object" is MAT deliberately skipping past the
JDK to find something with your package name on it. That is the class to open.

## The exclusion that produces false negatives

> *"The standard options for the query **ignore weak, soft, phantom and finalizer references** when
> finding paths."*

This default is correct almost all of the time: an object held only by a `WeakReference` is not
leaked, it is cached, and including those edges would fill every path with `WeakHashMap` internals
and `Cleaner` plumbing.

But it has two consequences worth knowing:

**A genuine leak through a reference object is invisible to the default query.** The classic case
is a `ThreadLocal`, whose map entry has a weak *key* and a **strong value** — see
[05b](05b-threadlocal-on-a-pooled-thread.md). The value chain is strong, so that one is visible;
but a leak whose only path runs through a `SoftReference` referent genuinely will not appear until
you change the exclusions.

**"No suspects found" on a heap you know is leaking is a prompt to change the excludes**, not a
verdict. The Path to GC Roots query takes them as an argument:

> *"`-excludes` — Fields of certain classes which should be ignored when finding paths. For example
> this allows paths through Weak or Soft Reference referents to be ignored. This is of the format
> `class name pattern [: field name [, field name ]*]`. Subclasses of the class are also included.
> If no field names are specified for the class then all fields are excluded."*
>
> *"`-numberofpaths` — The number of different paths to be displayed."*

So `java.lang.ref.WeakReference:referent` is the shape of an exclusion, and removing it is how you
look through weak edges deliberately.

## Path to GC Roots, and what it is for

> *"Find out who is keeping alive a single object."*
>
> *"Motivation: Having found an expensive object it is then important to find all the reasons it is
> kept alive."*

Note **"all the reasons"**, plural, and `-numberofpaths`. A leaked object frequently has several
independent holders, and removing one changes nothing. If you fix a leak and it does not go away,
the usual explanation is that you cut one of three paths.

The result view has a presentation quirk that reverses people's intuition:

> *"With the arrows in each icon points up and to the left, showing that **the field in bold of the
> object of a line actually refers to the preceding object in the tree view** which is up and to
> the left."*

The tree reads *outward from the leaked object towards the root*, and each row's bold field is the
reference held by *that* row pointing at the row above. Reading it in the other direction produces
a confidently wrong story about which class holds which.

## Duplicate Classes, for the loader case

> *"Classes where there are two or more with the same name… Sometimes a class is replaced on the fly
> by the application or as part of a deploy/undeploy cycle in an application server and the old
> class loader and associated classes should be garbage collected. This can only happen once all the
> instances of classes, the classes themselves and the class loader are no longer accessible from
> the rest of the application or GC roots."*
>
> *"If there are no or few instances shown in a class loader line then that class loader might not
> be used anymore, but some spurious reference might be keeping the class loader alive… The Path to
> GC Roots query can help tell why a class loader is kept alive."*

⚠️ And the false positive it warns about:

> *"Note: Java 8 and later virtual machines create some synthetic classes for lambda expressions.
> These can have names such as `java.lang.invoke.LambdaForm$DMH`, `java.lang.invoke.LambdaForm$MH`
> and `java.lang.invoke.LambdaForm$BMH`. These classes are unusual in that **multiple classes of the
> same name are loaded by the same class loader**. Unless you think you have a particular problem
> with lambda expressions… these classes can be ignored."*

Any modern application produces a long list of those. They are not a finding.
[05c](05c-finding-a-classloader-leak-in-a-dump.md) is the full workflow.

## Running it headlessly, and comparing two dumps

```bash
# the standard report
./mat/ParseHeapDump.sh dump.hprof org.eclipse.mat.api:suspects

# overview: heap overview, system properties, thread overview, top consumers, class histogram
./mat/ParseHeapDump.sh dump.hprof org.eclipse.mat.api:overview

# per-component report on the biggest consumers
./mat/ParseHeapDump.sh dump.hprof org.eclipse.mat.api:top_components

# 🔴 the one that finds growth rather than size
./mat/ParseHeapDump.sh later.hprof -baseline=earlier.hprof org.eclipse.mat.api:suspects2
```

`suspects2` against a baseline is the answer to the report's own admitted limitation — it has no
time information, so give it two points in time. On a slowly growing service it finds in one
command what a single dump cannot express.

## Gotchas

**★ "No leak suspects found" is not "no leak".**
The threshold is a configurable ten percent of the heap for a single object. A leak spread across
thirty owners, or one that is currently only three percent of a large heap, produces an empty
report on a process that will certainly die.

**★ The report has no time information and says so.**
*"It does not use any time information as to when objects were allocated."* It cannot distinguish a
large working set from a growing one. That is what `-baseline=` and `suspects2` are for, and it is
why a single dump from a service that has been up for a week is weaker evidence than two dumps an
hour apart.

**★ Paths ignore weak, soft, phantom and finalizer references by default.**
Correct almost always, and occasionally the reason your leak is invisible. `-excludes` is the
argument that controls it; removing the reference-type exclusion is how you look through a
`SoftReference` deliberately.

**★ The accumulation point is a JDK class and is never the answer on its own.**
It will be an `Object[]`, a `HashMap$Node[]` or similar. MAT's "The instance is referenced by" line
exists precisely to skip past the JDK to something in your packages. Read that line, not the
accumulation point's class name.

**★ Path to GC Roots shows one path and there are usually several.**
The documentation is explicit that other paths exist. Fixing the one the report showed you and
finding the leak unchanged is the standard second day of this investigation. Use `-numberofpaths`.

**★ The path tree reads towards the root, and the bold field points at the row above.**
*"the field in bold of the object of a line actually refers to the preceding object in the tree
view"*. Reading it top-down as "A holds B holds C" inverts every relationship in it.

**★ `LambdaForm$DMH` / `$MH` / `$BMH` duplicates are normal.**
The JVM loads multiple same-named synthetic classes in one loader for lambda call sites. Every
modern application shows dozens. MAT's own documentation says to ignore them unless lambdas are
specifically your suspicion.

**★ The report is stored next to the dump and reopened silently.**
*"This report will be stored together with the heap dump and can be displayed when you open the
heap dump again."* If you re-run analysis after changing options, check you are not reading a
cached report generated with the previous settings.

**★ A thread as leak suspect gets a different report shape, and the extra information is the useful
part.** *"If the leak suspect is a thread then thread related information such as the call stack is
shown, together with interesting stack frames which have local variables referring to objects on
the path to the accumulation point."* Those frames name the method that is holding the memory —
which is as close to an allocation site as a dump ever gets.

## Interview questions

**★ How does MAT's Leak Suspects report decide what is a suspect?**
It starts from the dominator tree and flags any top-level object whose retained size exceeds a
threshold — ten percent of the heap by default — on the reasoning that if that object were dropped,
that much memory would be freed. It then does a second pass grouped by class, to catch leaks where
no single object is large but many instances of one type collectively are. For each suspect it
descends to the accumulation point, defined as the node with a big gap between its own retained
size and its largest child's, and then reports the shortest path from a GC root to that point plus
the nearest non-JDK object that refers to it. Every one of those steps is documented, which means
you can tell when the report is quiet because there is nothing wrong and when it is quiet because
the leak does not match its shape.

**★ The report says "no leak suspects" but the heap grows every hour. What next?**
Two moves. First, give it time information: take a second dump and run
`ParseHeapDump.sh later.hprof -baseline=earlier.hprof org.eclipse.mat.api:suspects2`, because the
standard report explicitly *"does not use any time information"* and cannot see growth in a single
snapshot. Second, look for the diffuse case by hand: group the dominator tree by class and by class
loader and take the retained set of the whole group, since the ten-percent threshold applies to
single objects and a leak spread across many owners will never cross it. If both come up empty,
question whether the leak is on the heap at all — metaspace, direct buffers and thread stacks are
not in the file.

**★ Why do MAT's path queries exclude weak and soft references, and when would you remove that
exclusion?** Because including them fills every path with `WeakHashMap` internals, `Cleaner`
plumbing and cache machinery, and because an object held only weakly or softly is not leaked — the
collector can take it. The exclusion makes the common case readable. You remove it when the
hypothesis is specifically that a reference object is the problem: a `SoftReference`-based cache
that is not clearing because the heap is large, a `WeakHashMap` whose *values* strongly reference
their own keys and so can never be evicted, or a `Cleaner` action that is itself retaining the
object it was supposed to release. `-excludes` takes a `class:field` pattern, so you can drop just
the referent exclusion and keep the rest.

**★ You fixed the reference chain the report showed and the leak is unchanged. What went wrong?**
Almost certainly nothing — the report shows one path and the documentation says there are others.
*"There will be other paths, otherwise an object on the path would retain the leak suspect."* Re-run
Path to GC Roots with `-numberofpaths` set high enough to see all of them; you will typically find
the object is held by a cache *and* a listener list *and* a thread local, and cutting one leaves
the other two. This is also why the honest verification of a memory fix is a re-measurement of the
live set over several load cycles, not a re-read of the same report.

**★ Duplicate Classes shows dozens of `LambdaForm$MH` entries. Is that a classloader leak?**
No. MAT's documentation calls it out specifically: the JVM creates synthetic classes for lambda
call sites and *"multiple classes of the same name are loaded by the same class loader"*, which is
unusual but expected. Every application using lambdas shows them. The finding you are looking for
in that query is a *different* shape — the same application class name appearing under several
distinct loaders, especially loaders with few or no live instances, which is the redeploy or
per-tenant leak. Path to GC Roots on the empty-looking loader tells you what is pinning it.

{/* FOOTER */}
