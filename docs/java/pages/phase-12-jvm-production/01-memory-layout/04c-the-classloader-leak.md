---
title: "Metaspace is freed when a classloader dies and never before, so a single live instance pins its class, which pins its loader, which pins every byte of metadata that loader ever allocated — a leak with no leaked objects, invisible to `-Xmx` and absent from a heap dump"
sidebar_label: "04c · The classloader leak"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 122 "Remove the Permanent Generation"** for the
> per-classloader allocation and reclamation model
> ([openjdk.org](https://openjdk.org/jeps/122)), **JEP 387 "Elastic Metaspace"** for the arena
> and chunk model ([openjdk.org](https://openjdk.org/jeps/387)),
> and the **JDK 25 `jcmd` tool reference** for `VM.metaspace`, `VM.classloader_stats` and
> `VM.classloaders`, including their documented impact levels
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**The classloader leak is the reason metaspace has a reputation. It is not a leak of objects,
it does not grow the heap, a heap dump does not show its cost, and the thing being retained is
native memory belonging to classes nobody has referenced in hours. This page is the mechanism —
which is a single sentence in JEP 122 — where it comes from in practice, and the three commands
that identify it.**

## The mechanism, in JEP 122's own words

> *"Allocation of native memory for class meta-data will be done in blocks… **Each block will be
> associated with a class loader**… **Freeing the space for the class meta-data would be done
> when the class loader dies** by freeing all the blocks associated with the class loader. Class
> meta-data will not be moved during the life of the class."*

JEP 387 adds the internal shape:

> *"Metaspace memory is managed in per-class-loader arenas. An arena contains one or more chunks,
> from which its loader allocates via inexpensive pointer bumps."*

Four consequences, and the whole page follows from them:

1. Metaspace is allocated in **per-classloader arenas**.
2. **Nothing is freed per class.** There is no partial reclamation, ever.
3. **The unit of reclamation is the classloader**, and only when the loader itself becomes
   unreachable.
4. Metadata is **never moved**, so the region is not compacted.

## What "the loader dies" actually requires

A classloader is unreachable only when **every class it loaded is unreachable, and every
instance of every one of those classes is unreachable.**

That is a much stronger condition than it sounds, because the reference graph runs in the
direction people do not picture:

```
  one live object
        ↓  (its class)
  the Class object
        ↓  (defining loader)
  the ClassLoader
        ↓  (its arena)
  every byte of metadata for every class it ever loaded
```

**One reference at the top pins everything at the bottom.** A single `ThreadLocal` left on a
pooled thread, one entry in a static cache, one shutdown hook, one JDBC driver still registered
in `DriverManager`, one un-deregistered MBean, one lambda captured by a static listener list —
any of these retains a loader worth thousands of classes' metadata.

This is why the leak's shape is so unlike an object leak:

| | Object leak | Classloader leak |
|---|---|---|
| Where the bytes are | Java heap | Native metaspace |
| Bounded by | `-Xmx` | `MaxMetaspaceSize` — **unlimited by default** |
| Shows in a heap dump | ✅ The retained set | ❌ Not the cost; ✅ the *cause* |
| Growth shape | Smooth, with allocation | **Stepwise** — one loader at a time |
| Typical ending | `OutOfMemoryError: Java heap space` | OOMKill, or `OutOfMemoryError: Metaspace` if bounded |

The stepwise growth is the most useful tell. Heap leaks trend; classloader leaks jump, and the
jumps line up with redeploys, with test classes, or with whatever event creates a loader.

## Where it comes from in practice

Six sources, and between them they cover almost every real case:

**Repeated hot redeploys** into a long-lived application server. The classic Tomcat case: each
redeploy creates a `WebappClassLoader`, and one lingering reference from the container or from a
library holds the old one alive along with the entire application's metadata.

**Runtime class generation in a loop.** Dynamic proxies, CGLIB-style subclasses, and bytecode
generators are fine when they generate **one class per type**; they are a leak when they
generate **one class per call**. The distinction is often a cache key away — a proxy factory
that fails to cache generates an unbounded number of classes without any redeploy at all.

**Scripting engines and expression evaluators** that compile each script or expression to a
class. Same shape: a cache turns an unbounded class count into a bounded one.

**Test suites** that build a fresh application context per test class and never close it. Every
context can bring its own loader, and the JVM running the suite accumulates all of them. This is
the version most developers meet first, as a build that gets slower and then dies.

**Per-tenant, per-plugin or per-script loaders** in any framework that isolates by classloader.
The design is deliberate; the leak is the loader outliving the tenant.

**Un-deregistered integrations** — JDBC drivers, MBeans, `ThreadLocal`s on container-managed
thread pools, shutdown hooks, logging appenders. These are the *pins* rather than the source:
they are what keeps a loader that should have died alive.

## Finding it: three commands in order

**1 · Is it growing, and is it classes?**

```bash
jcmd <pid> VM.native_memory summary
```

Watch the `Class` category's **committed** value and the `classes #` count over time. A class
count that only ever rises is the signature. `VM.native_memory summary.diff` against a baseline
is the sharper form — [11b](11b-the-nmt-baseline-workflow.md) is the workflow, and it is worth
having a baseline taken at startup before you need one.

**2 · Which loader?**

```bash
jcmd <pid> VM.classloader_stats
```

🔴 **This is the diagnostic.** The tool reference rates it *"Impact: Low"*, so it is safe on a
production JVM. It prints one row per loader with its class count and metaspace consumption.

Run it twice, a few minutes apart, and look for a **loader type whose instance count is
growing**. Dozens of `WebappClassLoader` rows, or one loader per test class, or a rising count of
some framework's `ScriptClassLoader`, answers the question in a single command.

```bash
jcmd <pid> VM.classloaders show-classes
```

gives the loader tree and the classes each holds, which names the culprit precisely — a
generated-proxy loader holding ten thousand `$Proxy` classes is not ambiguous.

**3 · Why is it still reachable?**

*Now* take a heap dump.

```bash
jcmd <pid> GC.heap_dump /path/to/dump.hprof
```

The dump does not contain metaspace, so it cannot tell you the size — but it contains the
`ClassLoader` object and every reference to it. Find the leaked loader instance, ask the tool for
the path to the GC roots, and the chain that appears is the bug: the static field, the
`ThreadLocal`, the registry entry. That chain is the fix.

⚠️ **The order matters.** Starting with the heap dump wastes a step and often misleads, because
the heap looks fine — the retained heap of a leaked loader is small, and its cost is all in a
region the dump does not describe. [01d](01d-taking-a-heap-dump-on-purpose.md) makes the general
version of this point.

**A fourth command, when you want detail on the region itself:**

```bash
jcmd <pid> VM.metaspace
```

Options are `basic | show-loaders | show-classes | by-chunktype | by-spacetype | vslist |
chunkfreelist | scale`, rated *"Impact: Medium --- Depends on number of classes loaded"*, and
`basic` *"does not need a safepoint"* — which makes `basic` the one to reach for on a live
service.

## Fixing it

The fix is always the same shape: **break the reference that pins the loader**, or **stop
creating loaders**.

- **A `ThreadLocal` on a pooled thread** — remove it in a `finally`, or do not use one on a
  thread you do not own. This is the single most common pin in application servers.
- **A static registry** — deregister on shutdown. JDBC drivers, MBeans, logging appenders,
  metric gauges and event listeners all have a deregistration API, and the leak is that nobody
  calls it.
- **An un-closed context** — close it. A Spring `ApplicationContext` per test class must be
  closed or shared through the framework's context cache, which exists precisely for this.
- **Uncached generated classes** — cache them by the key that determines the class. One class
  per type is fine; one per invocation is not.
- **Genuinely needed per-tenant loaders** — bound the count, and make loader disposal part of
  tenant teardown with a test that asserts the loader is collectable.

And set `-XX:MaxMetaspaceSize` ([04b](04b-the-metaspace-flags.md)) so the next occurrence
announces itself as a Java error rather than as a container kill.

## Gotchas

**★ Metaspace is freed at classloader granularity, never per class.**
JEP 122: *"Freeing the space for the class meta-data would be done when the class loader dies."*
One pinned instance retains the metadata of every class its loader ever defined, and there is no
partial reclamation to hope for.

**★ The reference that leaks is on the heap; the memory that leaks is not.**
This is why the leak is confusing. The pin is an ordinary Java reference visible in a heap dump;
the cost is native metaspace the dump does not contain. Tools that look at one see nothing wrong
with the other.

**★ A heap dump is the wrong first tool and the right second one.**
It cannot size metaspace. It can show the reference chain keeping a leaked loader alive, which is
the actual fix — but only after `VM.classloader_stats` has told you which loader to look for.

**★ `jcmd VM.classloader_stats` is `Impact: Low` and answers the question in one command.**
It is safe to run on a production JVM and gives per-loader class counts and metaspace usage. Most
investigations of this leak are longer than they need to be because nobody ran it.

**★ Growth is stepwise, not smooth.**
Heap leaks trend upward with load. Classloader leaks jump when a loader is created — at a
redeploy, at a test class boundary, at a tenant creation. A metric that jumps in steps and never
returns is a strong signal on its own.

**★ One class per call is a leak; one class per type is not.**
Dynamic proxies and bytecode generators are safe when their output is cached by type. A missing
cache key turns the same library into an unbounded class generator with no redeploy involved.

**★ Test suites leak this way more often than production does.**
An application context per test class, never closed, accumulates loaders inside one long-lived
JVM. The symptom is a build that slows down and then fails, which almost nobody diagnoses as a
metaspace problem.

**★ `ThreadLocal` on a container-managed thread is the classic pin.**
The thread outlives the request, the application and often the deployment. The value holds its
class, the class holds the loader, and the loader holds everything. Removing the value in a
`finally` block is the whole fix.

**★ Unloading requires a collection that looks for it.**
Classes become unloadable when their loader is unreachable, but the metadata is returned only
when a collection actually unloads them. A JVM with a large heap that rarely performs the
relevant collection can hold unloadable metadata for a long time — which makes "we fixed the
reference" hard to verify without forcing a collection.

## Interview questions

**★ Explain the classloader leak.**
Metaspace is allocated in per-classloader arenas and freed only when the loader dies — JEP 122:
*"Freeing the space for the class meta-data would be done when the class loader dies."* A loader
dies only when every class it loaded and every instance of those classes is unreachable. So one
lingering reference — a `ThreadLocal`, a static registry entry, a JDBC driver, an un-closed
context — pins the loader and every byte of metadata it allocated. Repeat per redeploy or per
generated class and metaspace grows monotonically, invisibly to `-Xmx`.

**★ How do you find which classloader is leaking?**
`jcmd <pid> VM.classloader_stats`, which the tool reference rates Impact: Low, prints per-loader
class counts and metaspace usage. Run it twice with a gap and look for a loader type whose
instance count is rising; `VM.classloaders show-classes` gives the tree and the classes involved.
Only then take a heap dump, to trace what keeps the leaked loader reachable. Starting with the
heap dump wastes a step, because metaspace usage is not in it.

**★ Why does a heap dump not show a metaspace leak, given that the leak is caused by a heap
reference?**
Because the dump records objects, and the leaked memory is native class metadata that is not an
object. The dump *does* contain the `ClassLoader` instance and the reference chain pinning it,
which is the cause — but the megabytes are in a region the format does not describe. Cause and
cost are in different places, which is exactly why the leak is hard to recognise.

**★ A service in Kubernetes is OOMKilled every few days. The heap is flat and well under `-Xmx`.
Walk through it.**
Heap is not the process, so start with `jcmd VM.native_memory summary` and look at which category
is growing. If it is `Class` with a rising class count, it is a classloader or class-generation
leak: `VM.classloader_stats` twice to find the growing loader type, `VM.classloaders
show-classes` to name it, then a heap dump to find the reference pinning it. Set
`-XX:MaxMetaspaceSize` in the meantime so the next occurrence is a Java error rather than an
exit code 137.

**★ Your integration test suite dies with a metaspace error after adding fifty test classes. What
is happening?**
Almost certainly one application context per test class, each bringing its own classloader, none
closed, all inside one long-lived JVM. The fix is to let the test framework's context cache share
contexts — which is what it exists for — rather than to raise the metaspace limit, and to make
sure any test that dirties a context marks it so the framework can dispose of it.

**★ A proxy library is generating classes without any redeploy. How is that possible, and how do
you confirm it?**
It is generating one class per call rather than per type, usually because a cache key is missing
or wrong. Confirm with `jcmd VM.classloaders show-classes` and look for a loader holding a large
and growing number of generated class names — `$Proxy` or the library's own naming scheme. The
class count rising while the deployment is untouched distinguishes this from the redeploy case
immediately.

**★ You fixed the reference that was pinning a loader. How do you verify the fix?**
Reproduce the loader-creating event repeatedly and watch the class count and `Class` committed
value in NMT return to baseline rather than ratchet. Because reclamation depends on a collection
that actually unloads classes, verification may need one to be triggered rather than waited for —
and `VM.classloader_stats` showing a stable loader count across many cycles is the assertion
worth automating.

{/* FOOTER */}
