---
title: "Every way of taking a heap dump makes a choice about unreachable objects on your behalf, and jcmd and jmap made opposite choices — so a runbook ported from one to the other now produces the inverse of what it claims"
sidebar_label: "03c · Getting a heap dump"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `jcmd` tool reference** — `GC.heap_dump`,
> `GC.class_histogram`, `GC.heap_info`, `GC.finalizer_info`, `VM.set_flag`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)), the
> **JDK 25 `jmap` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jmap.html)), the
> **JDK 25 Troubleshooting Guide**, "Diagnosing Java Memory Leaks → Diagnostic Data"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)),
> the **JDK 25 API documentation** for `com.sun.management.HotSpotDiagnosticMXBean`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/jdk.management/com/sun/management/HotSpotDiagnosticMXBean.html)),
> and the **JDK 25 HotSpot source at tag `jdk-25+36`** — `services/heapDumper.cpp`,
> `services/heapDumper.hpp` and `services/diagnosticCommand.hpp`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/services/heapDumper.cpp)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A heap dump answers one question — what is keeping objects on the Java heap alive — and there
are five ways to obtain one, all producing the same HPROF format and none producing the same
*contents*. The variable is whether unreachable objects are in the file, and every route picks a
default for you: `jcmd` collects first and includes only reachable objects, `jmap` includes
everything, the OOM hook runs no collection at all, and the analysis tool then discards
unreachable objects again unless told otherwise. Getting that chain wrong does not produce a bad
file; it produces a file that answers a different question convincingly.**

**Topic 01 owns the decision of whether to take a dump at all**, together with the two cheaper
probes that usually make it unnecessary —
[`01d · Taking a heap dump on purpose`](../01-memory-layout/01d-taking-a-heap-dump-on-purpose.md).
This chunk is the mechanics once that decision is made.

## The supported route: `jcmd GC.heap_dump`

> *"`GC.heap_dump [options] filename` — Generates a HPROF format dump of the Java heap.
> Impact: High --- depends on the Java heap size and content. **Request a full GC unless the
> `-all` option is specified.**"*
>
> *"`-all`: (Optional) Dump all objects, including unreachable objects (BOOLEAN, false)"*
>
> *"`-gz`: (Optional) If specified, the heap dump is written in gzipped format using the given
> compression level. 1 (recommended) is the fastest, 9 the strongest compression. (INT, 1)"*
>
> *"`-overwrite`: (Optional) If specified, the dump file will be overwritten if it exists
> (BOOLEAN, false)"*
>
> *"`-parallel`: (Optional) Number of parallel threads to use for heap dump. The VM will try to
> use the specified number of threads, but might use fewer. (INT, 1)"*
>
> *"`filename`: The name of the dump file. **If `%p` is specified in the filename, it is expanded
> to the JVM's PID.** (FILE, no default value)"*

That last line is worth having: `%p` works in `jcmd` too, not only in `-XX:HeapDumpPath`. It is
the difference between a script that can be run on every replica and one that overwrites its own
output.

```bash
# retention: what is being kept alive?  (full GC first, reachable objects only)
jcmd 1 GC.heap_dump -gz=1 -parallel=8 /var/dumps/retain_%p.hprof.gz

# allocation churn: what is being made and discarded?  (no GC, everything included)
jcmd 1 GC.heap_dump -all -gz=1 /var/dumps/churn_%p.hprof.gz
```

The default — collect, then dump what survived — is right for a **retention** question. Every
object in the file is genuinely held by something, so a dominator tree means what it says.
`-all` is right for an **allocation** question, because the objects about to die are the evidence.
You cannot recover one view from the other file.

## `jmap` is experimental and unsupported on JDK 25

The `jmap` reference opens with this, and it is not a footnote:

> *"Note: This command is experimental and unsupported."*
>
> *"Note: This command is unsupported and might not be available in future releases of the JDK."*

It still works, and every tutorial written before 2019 uses it. Its `live` sub-option is
documented as:

> *"`live` --- When specified, dumps only the live objects; if not specified, then dumps all
> objects in the heap."*

🔴 **So `jmap` and `jcmd` have opposite defaults.**

| | Unreachable objects included? | Full GC first? |
|---|---|---|
| `jcmd GC.heap_dump file` | **no** | **yes** |
| `jcmd GC.heap_dump -all file` | yes | no |
| `jmap -dump:format=b,file=f <pid>` | **yes** | no |
| `jmap -dump:live,format=b,file=f <pid>` | no | yes |
| `-XX:+HeapDumpOnOutOfMemoryError` | **yes** | **no** — see below |
| `HotSpotDiagnosticMXBean.dumpHeap(path, true)` | no | yes |

A runbook that said `jmap -dump:live` and was "modernised" to `jcmd GC.heap_dump -all` now means
the exact opposite of what it did. This is a real and common porting error, because `-all` looks
like the harmless "give me everything" flag rather than the semantic inversion it is.

`jmap` also has two sub-commands worth knowing even though `jcmd` supersedes them: `-clstats`,
*"prints class loader statistics of Java heap"*, and `-finalizerinfo`, *"prints information on
objects awaiting finalization"* — the `jcmd` equivalents being `VM.classloader_stats` and
`GC.finalizer_info`.

## The dump the JVM writes for you is different from both

`HeapDumper::dump_heap(bool oome)` constructs its dumper like this:

```cpp
HeapDumper dumper(false /* no GC before heap dump */,
                  oome  /* pass along out-of-memory-error flag */);
dumper.dump(my_path, tty, HeapDumpGzipLevel);
```

🔴 **The crash-time dump runs no collection.** In practice the collector has just run and failed,
so most garbage is already gone — but the file is formally a snapshot of everything, not of the
live set, and that matters when you later ask a tool to keep unreachable objects.

It is also parallel by default, which the interactive command is not:

```cpp
static uint default_num_of_dump_threads() {
  return MAX2<uint>(1, (uint)os::initial_active_processor_count() * 3 / 8);
}
```

with a guard specific to the OOM case:

```cpp
if (_oome && num_dump_threads > 1) {
  // Each additional parallel writer requires several MB of internal memory ...
  // For the OOM handling we may already be limited in memory.
  // Lets ensure we have at least 20MB per thread.
  julong max_threads = os::free_memory() / (20 * M);
  ...
}
```

So on a machine with almost no free memory the JVM quietly falls back towards a single writer. A
crash-time dump on a starved container is slower than the same dump on a healthy one, by design.

## From inside the JVM: `HotSpotDiagnosticMXBean`

The programmatic route, and what Spring Boot Actuator's `heapdump` endpoint calls:

```java
import com.sun.management.HotSpotDiagnosticMXBean;
import java.lang.management.ManagementFactory;

public final class Dumps {

    private static final HotSpotDiagnosticMXBean BEAN =
            ManagementFactory.getPlatformMXBean(HotSpotDiagnosticMXBean.class);

    /** liveOnly == true performs a full GC first and writes only reachable objects. */
    static void dump(String path, boolean liveOnly) throws java.io.IOException {
        BEAN.dumpHeap(path, liveOnly);
    }

    /** The same bean sets MANAGEABLE flags — this is jcmd VM.set_flag from inside. */
    static void armDumpOnOom(String path) {
        BEAN.setVMOption("HeapDumpPath", path);
        BEAN.setVMOption("HeapDumpOnOutOfMemoryError", "true");
    }
}
```

The `boolean` is `-all` inverted: `true` means live objects only. The same pause applies — this is
a different door, not a cheaper one. The second method is the in-process form of the runtime
arming described in [03b](03b-which-failures-actually-trigger-them.md), and it is useful when you
have an admin endpoint but no shell.

## The two probes that come first, and one documentation bug

```bash
jcmd <pid> GC.heap_info          # "Provides generic Java heap information."   Impact: Medium
jcmd <pid> VM.classloader_stats  # "Print statistics about all ClassLoaders."  Impact: Low
jcmd <pid> GC.finalizer_info     # "Provides information about the Java finalization queue."  Impact: Medium
jcmd <pid> GC.class_histogram    # counts and bytes by class.                  Impact: High
```

⚠️ The Troubleshooting Guide shows `jcmd <pid> GC.class_histogram filename=Myheaphistogram`.
`ClassHistogramDCmd` in `diagnosticCommand.hpp` declares `num_arguments() { return 2; }` and the
two are `-all` and `-parallel`; the `jcmd` reference lists the same two. **There is no `filename`
option on JDK 25** — the guide's example is stale. Redirect stdout instead.

⚠️ Note also the asymmetry in the `-parallel` defaults: `GC.class_histogram`'s is `0`, documented
as *"let the VM determine the number of threads to use"*, while `GC.heap_dump`'s is `1`, meaning
**serial**. The cheaper command parallelises by default and the expensive one does not.

## Gotchas

**★ `jmap -dump:` and `jcmd GC.heap_dump` have opposite defaults.**
`jmap` dumps everything unless you say `live`; `jcmd` dumps only reachable objects unless you say
`-all`. Porting a command from one to the other without re-reading both manuals inverts the
meaning of the dump, and the resulting file looks perfectly legitimate.

**★ `-XX:+HeapDumpOnOutOfMemoryError` writes a dump with no preceding collection.**
`false /* no GC before heap dump */` in `heapDumper.cpp`. It is not a live-set snapshot in the way
`jcmd`'s default is. In practice the difference is small because the collector just ran, but if
you then parse it with unreachable objects kept, you are looking at a different population than
you would get from `jcmd`.

**★ `jmap` is documented as experimental and unsupported on JDK 25.**
*"This command is experimental and unsupported"* and *"might not be available in future releases
of the JDK"*, in the first lines of its own reference. New runbooks should use `jcmd`, which is
supported and has `-gz`, `-parallel` and `-overwrite` — the three options that make a large dump
operationally survivable.

**★ `GC.heap_dump -parallel` defaults to 1 while the crash-time dump defaults to about
three-eighths of your CPUs.** So the dump you take by hand is, out of the box, slower than the one
the JVM would have written for you. Always pass `-parallel` on a large heap.

**★ `-gz` changes the format and not every tool reads it.**
The output is a gzipped HPROF stream. Memory Analyzer handles it; older analysers and ad-hoc
scripts do not. Check what will open the file before you write a 20 GB one you cannot read. MAT's
own documentation notes the trade: the file *"will take up less disk space, but will take longer
to read when parsed"*.

**★ `%p` works in the `jcmd` filename too, and almost nobody uses it.**
*"If `%p` is specified in the filename, it is expanded to the JVM's PID."* A script that dumps
several replicas into one volume without it silently overwrites, and the file you keep is from
whichever pod finished last.

**★ Without `-overwrite`, a repeated `jcmd GC.heap_dump` fails rather than replacing.**
The option is documented as `(BOOLEAN, false)`. That is the safe default and it means an automated
capture that runs twice does nothing the second time — which is either a useful guard or a silent
gap in your evidence, depending on whether you noticed.

**★ The `hprof` format contains only the Java heap.**
No metaspace contents, no code cache, no native bytes behind a `DirectByteBuffer` — you see the
`DirectByteBuffer` object and its `capacity` field, not the buffer. MAT's own documentation lists
what a dump does contain: all objects, all classes, GC roots, and thread stacks with per-frame
locals. If the growth is anywhere else, the dump is a large file that cannot hold the answer.

**★ A dump contains no allocation information at all.**
MAT states it plainly: *"A heap dump does not contain allocation information so it cannot resolve
questions like who had created the objects and where they have been created."* If the question is
"where was this allocated", the tool is JFR's `OldObjectSample` — [04d](04d-old-object-sample-instead-of-a-dump.md) —
or an allocation profiler, not a dump.

**★ `GC.class_histogram` is rated `Impact: High`, the same as the dump.**
It writes no file, which makes it feel free, but on a large heap it is a real pause.
`GC.heap_info` (Medium) and `VM.classloader_stats` (Low) are the genuinely cheap probes.

## Interview questions

**★ What is the difference between `jcmd GC.heap_dump <file>` and `jcmd GC.heap_dump -all <file>`,
and when do you want each?** The default requests a full GC first and writes only reachable
objects; `-all` skips the collection and *"dump[s] all objects, including unreachable objects"*.
Use the default for a retention question — every object in the file is genuinely kept alive by
something, so a dominator tree means what it says and there is no garbage to explain away. Use
`-all` when the question is allocation churn, because the objects about to die are the evidence.
The two files are not interconvertible, so the choice is made when you run the command.

**★ Why is `jmap` still in every tutorial and why should you not use it?**
Because it was the only tool for a decade and the commands are muscle memory. The JDK 25 reference
now opens with *"This command is experimental and unsupported"* and warns it *"might not be
available in future releases"*. `jcmd GC.heap_dump` is the supported equivalent, produces the same
HPROF format, and adds `-gz`, `-parallel` and `-overwrite`. The specific trap in migrating is that
the two have inverted defaults for unreachable objects: `jmap` needs `live` to exclude them,
`jcmd` needs `-all` to include them, so a mechanical translation of an old command produces a file
that answers the opposite question.

**★ How do you take a heap dump from a container you cannot exec into?**
Three routes, in decreasing order of convenience. If Spring Boot Actuator is present and the
`heapdump` endpoint is exposed, it calls `HotSpotDiagnosticMXBean.dumpHeap` over HTTP — with the
same pause, and with the `live` flag fixed by the endpoint rather than by you. Otherwise wire the
same `HotSpotDiagnosticMXBean` call into an internal admin endpoint of your own, which has the
advantage that you choose the path and the flag. Failing both, use the management interface
remotely via JMX. In every case the file lands inside the container, so the question of a mounted
volume with room for it does not go away.

**★ You need a dump of a 40 GB heap and the tooling keeps timing out. What do you change?**
Four things, all of which are about the file rather than the analysis. `-parallel=<n>` because the
interactive default is a single writer. `-gz=1` because the format is highly repetitive and the
documentation names 1 as the recommended level — you trade a little CPU for a much smaller file.
A target path on a volume with room for the uncompressed live set, since the write is streamed and
a full disk truncates it. And, before any of that, a raised or disabled liveness-probe timeout,
because a dump of that size will exceed a normal probe window and the resulting restart kills the
dump halfway. Then check the analysis machine has enough RAM to index the file, which is a
separate constraint covered in [03d](03d-the-dump-you-could-not-take.md).

**★ Someone took a dump with `-all` on a healthy service and reports that it looks alarming. What
happened?** They photographed the garbage. Without a preceding collection, a healthy young
generation is mostly objects that were about to be reclaimed — that is what a generational heap
looks like by design. The histogram is full of short-lived types, the dominator tree has no
meaningful structure, and nothing in it retains anything. The fix is to re-take the dump without
`-all` so the file contains only what survived a collection, and to understand that `-all` is for
the churn question rather than the retention question.

{/* FOOTER */}
