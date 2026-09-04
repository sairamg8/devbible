---
title: "Deciding to take a heap dump means choosing which region you are about to spend a full GC and several gigabytes of disk photographing, and jcmd's default already made one of those choices for you"
sidebar_label: "01d · Taking a dump on purpose"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 `jcmd` tool reference** — `GC.heap_dump`,
> `GC.heap_info`, `GC.class_histogram`, `VM.classloader_stats`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> the **JDK 25 `jmap` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jmap.html)),
> and the **JDK 25 Troubleshooting Guide**, "Diagnostic Tools"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A heap dump answers one question — what is keeping objects on the Java heap alive — and it
is the most expensive way to ask any question in this phase. This page is about *acquiring*
the file correctly: which command, which flag, what pause you are buying, and the two
cheaper probes that usually make the dump unnecessary. Analysing the file — MAT, dominator
trees, the usual leak shapes — belongs to
`04 · OutOfMemoryError` *(not written yet)*; this page exists in the memory-layout topic
because "which region does this tool read" is a map question, and taking a dump for a
problem that is not on the heap is the most common wasted hour in a production memory
incident.**

## The cheap probes you should exhaust first

Both of these take seconds and neither writes a large file.

```bash
jcmd <pid> GC.heap_info          # "Provides generic Java heap information."  Impact: Medium
jcmd <pid> GC.class_histogram    # object counts and bytes by class
jcmd <pid> VM.classloader_stats  # "Print statistics about all ClassLoaders."  Impact: Low
```

`GC.heap_info` tells you committed versus used per generation or region set. If used-after-GC
is a small fraction of committed, the heap is not the leak and you have just saved yourself a
dump. `GC.class_histogram` names the class that is growing, which is frequently enough on its
own — "four million `char[]`" and "three hundred thousand `HikariProxyConnection`" are
different investigations. `VM.classloader_stats` is the probe for the classloader leak, and
it reads metaspace rather than the heap.

## `jcmd GC.heap_dump`, and the `-all` decision the default makes for you

> *"`GC.heap_dump [options] filename` — Generates a HPROF format dump of the Java heap.
> Impact: High --- depends on the Java heap size and content. **Request a full GC unless the
> `-all` option is specified.**"*
>
> *"`-all`: (Optional) Dump all objects, including unreachable objects (BOOLEAN, false)"*
>
> *"`-gz`: (Optional) If specified, the heap dump is written in gzipped format using the
> given compression level. 1 (recommended) is the fastest, 9 the strongest compression.
> (INT, 1)"*
>
> *"`-parallel`: (Optional) Number of parallel threads to use for heap dump. The VM will try
> to use the specified number of threads, but might use fewer. (INT, 1)"*
>
> *"`-overwrite`: (Optional) If specified, the dump file will be overwritten if it exists
> (BOOLEAN, false)"*

The default — full GC first, reachable objects only — is right for a **retention** question.
Every object in the file is genuinely held by something, so a dominator tree means what it
says and there is no garbage to explain away.

`-all` is right for an **allocation** question. It skips the collection, so the file contains
the objects that were about to die, which is exactly the evidence you want when the symptom
is churn and GC pressure rather than growth.

Getting this backwards costs you the analysis, not just the file: a `-all` dump of a healthy
service looks alarming, because most of a healthy young generation is garbage by design.

```bash
# retention: what is being kept alive?
jcmd 1 GC.heap_dump -gz=1 -parallel=4 /var/dumps/retain_$(date +%s).hprof

# allocation: what is being made and thrown away?
jcmd 1 GC.heap_dump -all -gz=1 /var/dumps/churn_$(date +%s).hprof
```

`-gz=1` is close to free and typically shrinks an HPROF file dramatically, because the format
is repetitive. `-parallel` shortens the pause. Both are worth setting by default on any heap
large enough that you had to think about whether to dump it.

## `jmap` is experimental and unsupported on JDK 25

The JDK 25 `jmap` reference opens with this, and it is not a footnote:

> *"Note: This command is experimental and unsupported."*
>
> *"Note: This command is unsupported and might not be available in future releases of the
> JDK."*

`jmap -dump:live,format=b,file=heap.bin <pid>` still works and is in every tutorial written
before 2019, but `jcmd GC.heap_dump` is the supported path and has options `jmap` does not
(`-gz`, `-parallel`, `-overwrite`). `jmap`'s `live` sub-option is the equivalent of *not*
passing `-all`:

> *"`live` --- When specified, dumps only the live objects; if not specified, then dumps all
> objects in the heap."*

Note that the two tools have opposite defaults: `jmap -dump:` without `live` dumps
everything, `jcmd GC.heap_dump` without `-all` dumps only reachable objects. A runbook that
was ported from one to the other without reading this is producing the opposite of what it
intends. `jmap` also carries two sub-commands worth knowing even though `jcmd` supersedes
them: `-clstats`, *"prints class loader statistics of Java heap"*, and `-finalizerinfo`,
*"prints information on objects awaiting finalization"*.

## Taking a dump from inside the JVM

Occasionally you cannot get a shell into the container but you can reach an HTTP endpoint.
`HotSpotDiagnosticMXBean` is the programmatic equivalent and is what Spring Boot Actuator's
`heapdump` endpoint uses:

```java
import com.sun.management.HotSpotDiagnosticMXBean;
import java.lang.management.ManagementFactory;

public final class Dumps {

    public static void dump(String path, boolean liveOnly) throws Exception {
        HotSpotDiagnosticMXBean bean = ManagementFactory.getPlatformMXBean(
                HotSpotDiagnosticMXBean.class);
        bean.dumpHeap(path, liveOnly);   // liveOnly=true performs a full GC first
    }
}
```

The `boolean` is the same decision as `-all`, inverted: `true` means live objects only. The
same pause applies — this is not a cheaper way to get a dump, only a different door.

## The cost you are agreeing to

A heap dump is not a background operation. Three costs, all real:

1. **A safepoint pause** for the duration of the walk. The `jcmd` reference rates the impact
   *"High --- depends on the Java heap size and content"*. On a multi-gigabyte heap this is
   long enough to fail a default liveness probe.
2. **Disk equal to the live set**, before compression. If the pod's ephemeral-storage limit
   is smaller than the heap, the write fails partway and may get the pod evicted — a second
   incident caused by investigating the first.
3. **Analysis memory.** Opening a 20 GB HPROF file needs a machine with enough RAM to index
   it; the analysis tool is itself a JVM with its own `-Xmx`, and "the dump is too big to
   open" is a common and infuriating end to this sequence.

The mitigation for all three is the same: take the dump from an instance that has been
removed from the load balancer, with `-gz` and `-parallel`, onto a mounted volume, after the
liveness probe timeout has been raised.

## Gotchas

**★ `jcmd GC.heap_dump` runs a full GC unless you pass `-all`, and both choices are wrong for
some questions.**
The default gives a dump of reachable objects — right for "what is retaining memory", wrong
for "what is being allocated and immediately discarded". `-all` gives the reverse. The
decision is made when you run the command; you cannot recover the other view from the file
you got.

**★ `jmap -dump:` and `jcmd GC.heap_dump` have opposite defaults.**
`jmap` dumps everything unless you say `live`; `jcmd` dumps only live objects unless you say
`-all`. Porting a runbook from one to the other without re-reading the flags silently
inverts the meaning of the dump.

**★ Writing a heap dump can itself cause the outage you are investigating.**
It pauses the application at a safepoint — impact rated *"High"* by the `jcmd` reference —
writes a file roughly the size of the live set, and on a large heap takes long enough to fail
a liveness probe and get the pod restarted mid-dump. Rule out the heap with `GC.heap_info`
first; that costs seconds.

**★ `jmap` is documented as experimental and unsupported on JDK 25.**
*"This command is experimental and unsupported"* and *"might not be available in future
releases of the JDK"*. It still works, and every pre-2019 tutorial uses it. New runbooks
should use `jcmd`, which is supported and has the options that make a large dump survivable.

**★ A dump taken during a restart storm is a dump of a cold JVM.**
If the pod has already been killed and restarted, the process you are dumping has none of the
state that caused the problem. Dump the instance that is *currently* growing, which means
having the RSS graph in front of you and picking a live victim, not reacting after the
restart.

**★ The `hprof` format only contains the Java heap.**
No thread stacks beyond roots, no metaspace contents, no code cache, no direct buffer
*contents* (you see the `DirectByteBuffer` object and its capacity field, not the native
bytes). If the growth is in any of those, the dump is a large file that cannot contain the
answer — see [02 · The process map](02-the-process-map.md) for what does.

**★ `-gz` changes the file format, and not every tool reads it.**
The compressed output is a gzipped HPROF stream. Modern analysers handle it; older ones and
ad-hoc scripts do not. Check what will open the file before you write a 20 GB one you cannot
read.

**★ An HPROF file contains your production data.**
Every `String` in memory: customer names, tokens, session identifiers, anything a request
carried. A heap dump is a data-protection artefact and needs the same handling as a database
export — a fact that surprises people the first time they copy one to a laptop to open it.

**★ `GC.class_histogram` also stops the world, briefly.**
It is much cheaper than a dump but not free, and on a very large heap it is a noticeable
pause. It is still the right second step after `GC.heap_info`, because it usually names the
growing class without producing a file at all.

## Interview questions

**★ What is the difference between `jcmd GC.heap_dump <file>` and
`jcmd GC.heap_dump -all <file>`?**
The default requests a full GC first and dumps only reachable objects; `-all` skips the
collection and *"dump[s] all objects, including unreachable objects"*. Use the default for a
retention question — every object in the file is genuinely kept alive by something, so a
dominator tree means what it says. Use `-all` when the question is allocation churn, because
the garbage is the evidence. Running the wrong one produces a file that looks like it shows a
leak and does not.

**★ You want a heap dump from a 20 GB heap in production without causing an incident. How?**
Accept there will be a pause and shorten it: `-parallel` to use multiple dumping threads,
`-gz=1` to trade a little CPU for a much smaller file, and a target path on a volume with
room for it. Raise or temporarily disable the liveness probe timeout first, because a dump
that size will exceed a normal probe window and the restart will kill the dump halfway. Take
it from a replica removed from the load balancer if the topology allows — the dump is
representative even if that instance is not serving. And check the machine you will analyse
it on has enough memory to index the file, before you spend the pause.

**★ Why would you run `jcmd GC.class_histogram` before taking a dump?**
Because it is far cheaper and frequently sufficient. It gives counts and byte totals by
class, which usually names the growing type outright; from there `VM.classloader_stats` or a
targeted code review often closes the case with no dump at all. The histogram also tells you
how big the dump would be, which is information you want before committing to the pause and
the disk.

**★ `jmap` still works. Why not use it?**
Because the JDK 25 documentation labels it *"experimental and unsupported"* and warns it
*"might not be available in future releases"*. `jcmd GC.heap_dump` is the supported
equivalent, produces the same HPROF format, and adds `-gz`, `-parallel` and `-overwrite`,
which are what make a dump of a large heap operationally survivable. The only reason to
reach for `jmap` is a very old JDK where `jcmd` lacks the sub-command.

**★ A colleague took a heap dump for an `OutOfMemoryError: Metaspace`. What will they find?**
The Java heap, which is not where metaspace lives. The dump is not entirely useless — a
classloader leak shows up on the heap as a large and growing number of `ClassLoader`
instances with retention paths, and that *is* the usual cause of metaspace exhaustion — but
the metaspace contents themselves are not in the file. `jcmd VM.metaspace` and
`jcmd VM.classloader_stats` read the actual region and are both faster and more direct. See
[04 · Metaspace](04-metaspace.md).

**★ How do you take a heap dump from a container you cannot exec into?**
Two options. If Actuator is present and the `heapdump` endpoint is exposed, it calls
`HotSpotDiagnosticMXBean.dumpHeap` for you over HTTP — with the same pause, and with the
`live` flag fixed by the endpoint's implementation rather than by you. Otherwise, wire the
same `HotSpotDiagnosticMXBean` call into an internal admin endpoint of your own, which has
the advantage that you choose the path and the `liveOnly` flag. Either way the file lands
inside the container, so the volume question does not go away.

**★ Is there a cost to enabling `-XX:+HeapDumpOnOutOfMemoryError` on a service that never
runs out of memory?**
No steady-state cost — the flag only arms a handler. The cost is entirely at failure time,
and it is the dump's cost: a long pause on a JVM that is already in trouble, and a file the
size of the live set on whatever filesystem `-XX:HeapDumpPath` points at. That is why the
flag pairs with a deliberate choice of path, not with the default of the working directory.
See [01c · The OOM flags](01c-the-oom-flags-and-what-they-cover.md).

{/* FOOTER */}
