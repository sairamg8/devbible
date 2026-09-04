---
title: "Memory Analyzer's histogram tells you what is in the heap and its dominator tree tells you why, and the reason the histogram so rarely solves anything is that the class with the most bytes is almost never the class with the bug"
sidebar_label: "04 · Reading a dump in MAT"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Eclipse Memory Analyzer documentation** — "Concepts → Heap
> Dump", "Concepts → Reachability", "Concepts → Garbage Collection Roots", "Concepts → Dominator
> Tree", "Reference → Query Matrix → Finding Memory Leak" and "Tasks → Querying Heap Objects
> (OQL)"
> ([help.eclipse.org](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/concepts/dominatortree.html)),
> and the **JDK 25 Troubleshooting Guide**, "Analysis Tools"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)),
> which names MAT and YourKit as examples and *"no specific product is recommended"*.
> **No sandbox** — no dump was opened for these pages; every behaviour described is quoted from
> the tool's documentation, and no histogram, tree or retained size is reproduced from memory.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Opening a heap dump for the first time is disorienting because the default view — the class
histogram — is the wrong one. It ranks classes by bytes, and in every Java application the top of
that list is `byte[]`, `char[]`, `String`, `Object[]` and `HashMap$Node`, which is true, useless
and identical for a healthy service and a leaking one. The view that answers the question is the
dominator tree, and understanding what it is takes about four sentences of graph theory that pay
for themselves permanently.**

## What is actually in the file

MAT's own inventory, which is also the list of things a dump cannot tell you:

> *"All Objects — Class, fields, primitive values and references"*
>
> *"All Classes — Classloader, name, super class, static fields"*
>
> *"Garbage Collection Roots — Objects defined to be reachable by the JVM"*
>
> *"Thread Stacks and Local Variables — The call-stacks of threads at the moment of the snapshot,
> and per-frame information about local objects"*

and then, flatly:

> *"A heap dump does not contain allocation information so it cannot resolve questions like who
> had created the objects and where they have been created."*

🔴 **That sentence is why "where did these come from?" is unanswerable from a dump.** It is the
single most common question people bring to MAT and the tool has no way to answer it. The
allocation site lives in JFR's `OldObjectSample` event or in an allocation profiler —
[04d](04d-old-object-sample-instead-of-a-dump.md).

## Reachability, and what MAT does to the file before you see it

> *"An object is reachable from another object if there is a path following the directed links
> from the source object to the destination object."*
>
> *"If there is no path from a garbage collection root to an object then it is unreachable."*

⚠️ **MAT discards unreachable objects during parsing by default.** Its batch-mode output shows the
step explicitly — `Task: Removing unreachable objects` — and the option to prevent it is:

```bash
./mat/ParseHeapDump.sh dump.hprof -keep_unreachable_objects org.eclipse.mat.api:suspects
```

> *"`-keep_unreachable_objects` means that all objects are retained in the snapshot, even if they
> are not reachable from an ordinary GC root."*

That interacts with the acquisition decision from [03c](03c-getting-a-heap-dump.md) in a way that
catches people out: you can take a `-all` dump specifically to see the churn, and then have MAT
throw the churn away at parse time. **If you dumped with `-all`, parse with
`-keep_unreachable_objects`, or you have done half of each.**

## Garbage collection roots

> *"A garbage collection root is an object that is accessible from outside the heap."*

MAT enumerates the reasons, and reading the list once removes most of the confusion about why
something is still alive:

| Root type | MAT's description |
|---|---|
| **System Class** | *"Class loaded by bootstrap/system class loader."* |
| **JNI Local** / **JNI Global** | *"Local/Global variable in native code, such as user defined JNI code or JVM internal code."* |
| **Thread** | *"A started, but not stopped, thread."* |
| **Thread Block** | *"Object referred to from a currently active thread block."* |
| **Busy Monitor** | *"Everything that has called `wait()` or `notify()` or that is synchronized."* |
| **Java Local** | *"Local variable. For example, input parameters or locally created objects of methods that are still in the stack of a thread."* |
| **Native Stack** | *"In or out parameters in native code… many methods have native parts and the objects handled as method parameters become GC roots."* |
| **Finalizable** | *"An object which is in a queue awaiting its finalizer to be run."* |
| **Unfinalized** | *"An object which has a finalize method, but has not been finalized and is not yet on the finalizer queue."* |
| **Unreachable** | *"An object which is unreachable from any other root, but has been marked as a root by MAT to retain objects which otherwise would not be included in the analysis."* |

Two of those matter disproportionately in practice. **`Thread` being a root is the whole
`ThreadLocal`-on-a-pool story** ([05b](05b-threadlocal-on-a-pooled-thread.md)): a live thread keeps
its `ThreadLocalMap` alive, which keeps the values alive, for as long as the pool exists. And
**`Finalizable` / `Unfinalized` being root types** is how a finalizer backlog shows up in a dump —
a large population of objects rooted for no reason your code can see
([07b](07b-finalizers-and-cleaners.md)).

## The dominator tree

The definitions, from MAT, and they are worth reading slowly:

> *"An object `x` **dominates** an object `y` if every path in the object graph from the start (or
> the root) node to `y` must go through `x`."*
>
> *"The **immediate dominator** `x` of some object `y` is the dominator closest to the object `y`."*
>
> *"A **dominator tree** is built out of the object graph. In each dominator tree each object is the
> immediate dominator of its children, so dependencies between the objects are easily identified."*

And the three properties that make it the view you want:

> *"The objects belonging to the sub-tree of `x` (i.e. the objects dominated by `x`) represent the
> retained set of `x`."*
>
> *"If `x` is the immediate dominator of `y`, then the immediate dominator of `x` also dominates
> `y`, and so on."*
>
> *"**The edges in the dominator tree do not directly correspond to object references from the
> object graph.**"*

🔴 **That last property is the one people trip over.** A parent in the dominator tree is not
necessarily holding a field reference to its child. It is the object through which *every* path to
the child passes. So "why is this `HashMap` the parent of my entity when the entity is referenced
by three other things?" has the answer: because all three of those paths themselves go through the
map. The tree is about control over lifetime, not about pointers.

The operational consequence is short: **sort the dominator tree by retained heap and read the top
of it.** If one object retains a large fraction of the heap, that object is the answer or one hop
from it. If nothing does, the leak is diffuse and you want the "group by class" view — see
[04b · Shallow versus retained](04b-shallow-versus-retained.md) for why, and
[04c](04c-leak-suspects-and-paths-to-gc-roots.md) for what MAT does about it automatically.

## The four-step method, from MAT's own documentation

> *"The following 4-step approach proved to be most efficient to detect memory issues: Get an
> overview of the heap dump… Find big memory chunks (single objects or groups of objects)…
> Inspect the content of this memory chunk… If the content of the memory chunk is too big check
> who keeps this memory chunk alive."*
>
> *"This sequence of actions is automated in Memory Analyzer by the Leak Suspects Report."*

The queries MAT names as most useful, in its own words:

- **Dominator Tree** — *"every node is responsible for keeping its children alive. The tree is
  sorted by the retained size, so you find single big objects easily. When there is no single
  object responsible for big memory consumption it is helpful to group the result by class and
  class loader to reveal big memory chunks."*
- **Top Consumers** — *"the biggest objects grouped by class, class loader, and package."*
- **Paths to GC Roots** — *"helps to identify who is responsible for keeping a single object in
  the heap."*
- **Duplicate Classes** — *"Lists classes loaded multiple times… Possible cause: Several versions
  of the same library are deployed."*
- **Big Drops in Dominator Tree** — *"objects with a big difference between the retained size of
  the parent and the children… These are places where the memory of many small objects is
  accumulated under one object."*

## OQL, for the question the UI does not have a button for

> *"Memory Analyzer allows to query the heap dump with custom SQL-like queries. OQL represents
> classes as tables, objects as rows, and fields as columns."*

```sql
SELECT * FROM [ INSTANCEOF ] <class name> [ WHERE <filter-expression> ]
```

This is how you answer questions that are specific to your domain rather than to the heap — every
`HttpSession` whose `lastAccessed` is older than a threshold, every cache entry whose key matches a
tenant, every `Connection` in a particular state. `INSTANCEOF` includes subclasses, which is
usually what you want and is not the default.

## Gotchas

**★ The class histogram is the default view and it is the least useful one.**
It ranks by bytes, and the top of that list is `byte[]`, `char[]`, `String` and `Object[]` in every
Java heap ever dumped. Those are the *contents* of the leak, not the leak. Go to the dominator
tree first; use the histogram to confirm a hypothesis, not to form one.

**★ MAT removes unreachable objects at parse time by default.**
If you deliberately took a `-all` dump to study allocation churn and then opened it normally, the
tool discarded exactly the population you were after. `-keep_unreachable_objects` in batch mode,
or the equivalent preference in the UI, is required for that workflow.

**★ Dominator-tree edges are not references.**
*"The edges in the dominator tree do not directly correspond to object references from the object
graph."* Reading a parent-child pair as "this field points to that object" produces confident,
wrong conclusions about which code to change. Use Paths to GC Roots when you need actual references.

**★ A heap dump contains no allocation sites, ever.**
MAT says so directly. "Where were these created?" cannot be answered from the file no matter how
long you look. That question needs JFR's `OldObjectSample` or an allocation profiler.

**★ `Finalizable` and `Unfinalized` are GC root types, and they explain otherwise inexplicable
retention.** A large population of objects whose only root is the finalizer queue is a finalizer
backlog, which the Troubleshooting Guide names as a cause of `Java heap space`. It looks like a
leak with no owner.

**★ `Thread` is a GC root, so anything a live thread can reach is alive.**
Including its `ThreadLocalMap`, its stack locals, and everything they transitively hold. On a
container-managed pool the thread outlives every request, so "the request finished" is not a reason
for anything to be collectable.

**★ MAT's size calculation for IBM system dumps can exceed `-Xmx`.**
Its documentation warns that for those formats *"the size of classes includes some of the amount of
native memory in the Java process (but outside of the Java heap)"* and that *"this may cause the
total size reported on the Overview pane to exceed the maximum Java heap size"*. If you are looking
at a non-HPROF dump and the arithmetic seems impossible, this is why.

**★ Compressed-reference detection is inferred, not read from a header.**
MAT's parser logs a line of the form *"Detected compressed references, because with uncompressed
64-bit references the array at … would overlap the array at …"*. It is an inference from the
object layout. On an unusual heap it can be wrong, and every shallow size in the file scales with
it.

**★ `INSTANCEOF` is not the default in OQL.**
`SELECT * FROM com.example.Cache` matches that exact class only. If the runtime type is a
subclass — a proxy, a generated subclass, a framework's decorator — you get zero rows and conclude
the objects are not there.

## Interview questions

**★ What is a dominator tree and why is it the right view for a leak?**
It is a transformation of the object graph in which each object's parent is its *immediate
dominator* — the nearest object through which every path from a GC root to it must pass. The
property that makes it useful is that the subtree beneath any node is exactly that node's retained
set, so sorting by retained size ranks objects by "how much memory disappears if this one becomes
unreachable". That is the question a leak investigation is actually asking. A histogram, by
contrast, ranks by shallow bytes per class, which tells you the heap is full of `byte[]` — true of
every Java process and useful in none of them.

**★ Someone shows you a dominator tree where a `ConcurrentHashMap` is the parent of objects that
are also referenced from three other places. Is the tree wrong?**
No — dominance is not reference. MAT's documentation says explicitly that *"the edges in the
dominator tree do not directly correspond to object references from the object graph"*. The map is
the immediate dominator because every path from a GC root to those objects goes through it,
including the three other references, which must themselves be reachable only via the map. The
practical reading is "if this map went away, so would they", which is the right question. To find
the actual reference chain you want the Paths to GC Roots query instead.

**★ You open a dump and the top of the histogram is `byte[]`, `char[]` and `String`. What now?**
Nothing — that is the histogram of every Java heap and it carries no signal. Switch to the
dominator tree sorted by retained heap. If one object dominates a large fraction, expand it and
find the accumulation point. If no single object does, group the dominator tree by class and by
class loader, which is MAT's own advice for the diffuse case, and look for a *type* whose
instances collectively dominate. Then run Paths to GC Roots on a representative instance to get the
chain that has to change.

**★ Why is `Thread` a garbage-collection root, and what does that imply for a thread pool?**
Because a running thread's stack is a source of references the collector cannot see through
otherwise: its locals, its parameters, and its `ThreadLocalMap` are all reachable from outside the
heap in the sense MAT means. The implication for a pool is severe: the thread does not end when
the request does, so anything the request left attached to the thread — a `ThreadLocal` value, an
MDC map, a security context, a transaction handle — stays reachable until either the value is
removed or the pool is destroyed. That is why a dominator tree in a leaking web application so
often has `Thread` objects near the top.

**★ How would you use OQL, and what is the trap in it?**
For domain-specific questions the built-in queries cannot express — sessions older than a
threshold, cache entries for a particular tenant, connections in a given state. The syntax is
`SELECT * FROM [INSTANCEOF] <class> [WHERE <expr>]`, and the trap is that `INSTANCEOF` is optional
and omitting it matches the exact class only. In a Spring or Hibernate application the runtime type
is very often a generated subclass or proxy, so the naive query returns nothing and the natural
conclusion — "those objects are not in the heap" — is wrong.

{/* FOOTER */}
