---
title: "Four of the seven documented OutOfMemoryError messages are about native memory the Java heap knows nothing about, and one of them does not throw at all — it kills the process through the fatal-error handler and leaves an hs_err log instead"
sidebar_label: "02b · The four native messages"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Troubleshoot Memory Leaks →
> Understand the OutOfMemoryError Exception"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)),
> the **HotSpot Garbage Collection Tuning Guide, Release 25**, "Other Considerations → Class
> Metadata" ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/)), and the
> **JDK 25 source at tag `jdk-25+36`** — `hotspot/share/memory/metaspace.cpp`
> (`report_metadata_oome`) and `hotspot/share/runtime/arguments.cpp` (`special_jvm_flags[]`, for
> the `UseCompressedClassPointers` deprecation)
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/memory/metaspace.cpp)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**`Metaspace`, `Compressed class space`, `request size bytes for reason. Out of swap space?` and
`reason stack_trace (Native method)` are the four documented messages that have nothing to do with
`-Xmx`. Raising the heap for any of them is at best a no-op and at worst directly harmful, because
a bigger heap commits more of the same physical memory these four are competing for. Two of them
name a JVM region with its own flag; one takes the process down through the crash handler; and one
is the JVM telling you the problem is in somebody else's code.**

## 4 · `Metaspace`

> *"Java class metadata (the virtual machine's internal presentation of a Java class) is allocated
> in native memory (referred to here as Metaspace). If the Metaspace for class metadata is
> exhausted, a `java.lang.OutOfMemoryError` error with a detail message Metaspace is thrown. The
> amount of Metaspace that can be used for class metadata is limited by the parameter
> `MaxMetaSpaceSize`, which can be specified on the command line."*

⚠️ The guide spells the flag `MaxMetaSpaceSize`, with a capital `S` in the middle. **The real flag
is `-XX:MaxMetaspaceSize`.** On JDK 25 an unrecognised `-XX:` option fails the launch unless
`-XX:+IgnoreUnrecognizedVMOptions` is set, in which case you get a JVM that silently ignored the
limit you thought you had applied.

The guide's action needs the same reading-with-a-2026-eye that
[`../01-memory-layout/01b`](../01-memory-layout/01b-oom-error-versus-oomkilled.md) gives it:

> *"Action: If `MaxMetaSpaceSize` has been specified on the command-line, increase its value.
> Metaspace is allocated from the same address space as the Java heap. Reducing the size of the
> Java heap will make more space available for Metaspace."*

Address space is not the scarce resource on 64-bit; physical memory is. Read that sentence as
being about the total memory budget, not as "metaspace comes out of `-Xmx`". It does not.

**The one thing to do before anything else** is turn on the log HotSpot already writes for you.
`Metaspace::report_metadata_oome` emits a report *before* it throws:

```cpp
LogMessage(gc, metaspace, freelist, oom) log;
if (log.is_info()) {
  log.info("Metaspace (%s) allocation failed for size %zu", ...);
  ...
  MetaspaceUtils::print_basic_report(&ls, 0);      // "In case of an OOM, log out a short but still useful report."
}
```

```
-Xlog:gc+metaspace+freelist+oom=info:file=/var/log/metaspace-oom.log
```

At `debug` level it additionally prints the offending `ClassLoaderData`, which names the loader
that was allocating when the region ran out. That is the leak candidate, from a log line, without
a dump.

The region itself, its flags and the classloader leak that fills it belong to topic 01 —
[`04-metaspace.md`](../01-memory-layout/04-metaspace.md),
[`04b-the-metaspace-flags.md`](../01-memory-layout/04b-the-metaspace-flags.md) and
[`04c-the-classloader-leak.md`](../01-memory-layout/04c-the-classloader-leak.md). What belongs
here is the diagnosis from a dump:
[05c · Finding a classloader leak in a dump](05c-finding-a-classloader-leak-in-a-dump.md).

## 6 · `Compressed class space`

> *"On 64-bit platforms, a pointer to class metadata can be represented by 32-bit offset (with
> `UseCompressedOops`). This is controlled by the command-line flag `UseCompressedClassPointers`
> (`true` by default). If `UseCompressedClassPointers` is true, the amount of space available for
> class metadata is **fixed at the amount `CompressedClassSpaceSize`**."*
>
> *"Note: There is more than one kind of class metadata: –klass metadata, and other metadata.
> **Only klass metadata is stored in the space bounded by `CompressedClassSpaceSize`.** Other
> metadata is stored in Metaspace."*

That note is the whole distinction between this message and `Metaspace`, and it is why they need
separate fixes. `Compressed class space` is a *sub-region* running out while metaspace as a whole
may still have room. The GC tuning guide adds the relationship in the other direction:

> *"The `-XX:MaxMetaspaceSize` applies to the sum of the committed compressed class space and the
> space for the other class metadata."*

So the two limits nest: `MaxMetaspaceSize` bounds the total; `CompressedClassSpaceSize` bounds one
part of it, and defaults to **1 GB** — a default that appears nowhere in the `java` man page.

⚠️ **The guide's remedy is on a deprecation path.** It says:

> *"Action: Increase `CompressedClassSpaceSize` or set `UseCompressedClassPointers` to false."*

`UseCompressedClassPointers` is **deprecated in JDK 25 and obsolete in JDK 26** —
`arguments.cpp`'s `special_jvm_flags[]` carries
`{ "UseCompressedClassPointers", JDK_Version::jdk(25), JDK_Version::jdk(26), … }`. Turning it off
on 25 warns; on 26 it will not work at all. Raise `-XX:CompressedClassSpaceSize`, and note the
guide gives you the exact rejection message for an out-of-range value:

> *"For example `-XX:CompressedClassSpaceSize=4g`, exceeds acceptable bounds and will result in a
> message such as `CompressedClassSpaceSize of 4294967296 is invalid; must be between 1048576 and
> 3221225472`."*

Under `-XX:+UseCompactObjectHeaders` the class pointer shrinks from 32 to 22 bits, which changes
the arithmetic again — see
[`../01-memory-layout/09c-class-pointers-and-compact-headers.md`](../01-memory-layout/09c-class-pointers-and-compact-headers.md).

## 5 · `request size bytes for reason. Out of swap space?`

> *"The detail message `request size bytes for reason. Out of swap space?` **appears to be** a
> `java.lang.OutOfMemoryError` error. However, Java reports this apparent error when an allocation
> from the native heap failed and the native heap might be close to exhaustion. The message
> indicates the size (in bytes) of the request that failed and the reason for the memory request.
> Usually the reason is the name of a source module reporting the allocation failure, although
> sometimes it indicates the actual reason."*

🔴 **This one behaves differently from every other message in the list:**

> *"Action: When this error is thrown, the Java VM (JVM) invokes the fatal error handling
> mechanism: it generates a fatal error log file, which contains useful information about the
> thread, process, and system at the time of the crash. In the case of native heap exhaustion,
> the heap memory and memory map information in the log can be useful."*

So the JVM **dies and writes an `hs_err_pid<pid>.log`**. There is no throw to catch, no heap dump,
and no process afterwards — but you get a text file containing the heap summary, the metaspace
summary, the thread list and the process memory map, which for a native failure is far better
evidence than a dump of the Java heap would have been, and is a few hundred kilobytes rather than
several gigabytes.

Note the structure of the message: **`request size bytes` is a number and `reason` is a string**,
so a real line names both the failing allocation size and the HotSpot source module that asked for
it. The `reason` token is the most useful part and the part people skip past.

## 7 · `reason stack_trace (Native method)`

> *"This detail message indicates that a native method has encountered an allocation failure. The
> difference between this and the previous message is that **the allocation failure was detected
> in a Java Native Interface (JNI) or native method rather than in the JVM itself**."*
>
> *"Action: If this type of `java.lang.OutOfMemoryError` error is thrown, you might need to use
> native utilities of the operating system to diagnose the issue further."*

This is the only message that points *outside* the JVM entirely, and it is the one where the JVM's
own tooling has nothing to offer. Native Memory Tracking explicitly *"does not track memory
allocations by non-JVM code"*, so `jcmd VM.native_memory` will look clean while the process keeps
growing. The tools are `pmap`, `/proc/<pid>/smaps_rollup` and the library's own instrumentation —
[`../01-memory-layout/11c-the-footprint-that-is-not-in-any-region.md`](../01-memory-layout/11c-the-footprint-that-is-not-in-any-region.md)
and [`11d`](../01-memory-layout/11d-finding-it-outside-the-jvm.md) own that path.

Candidates, in the order they turn up in practice: a compression or crypto library with its own
native buffers, an image or PDF renderer, a database driver's native layer, a metrics or tracing
agent, and anything reached through the Foreign Function and Memory API with an `Arena` that is
never closed.

## What these four have in common

**`-XX:+HeapDumpOnOutOfMemoryError` is documented as not applying to any of them** — and for two of
them the documentation is wrong on JDK 25, which is the subject of
[03 · The OOM hooks are one function](03-the-oom-hooks-are-one-function.md). Read that before you
conclude you will have no evidence.

**A bigger heap makes all four worse.** They are drawing on the same physical memory the heap
commits. In a container, raising `-Xmx` or `MaxRAMPercentage` to "give the JVM more room" takes
room away from exactly the region that failed. **Topic 03 · Heap sizing in containers** *(not
written yet)* owns that arithmetic.

**None of them shows on the heap chart.** A flat, healthy heap graph next to a rising RSS graph is
the signature of all four, and it is routinely read as "memory is fine".

## Gotchas

**★ The guide spells the metaspace flag `MaxMetaSpaceSize` and it does not exist.**
The flag is `-XX:MaxMetaspaceSize`. Copying the guide's spelling into a launch script either fails
the launch or, under `-XX:+IgnoreUnrecognizedVMOptions`, silently leaves metaspace unbounded —
which is the default and the reason metaspace growth so often ends as an OOMKill rather than a
Java error.

**★ `Metaspace` and `Compressed class space` are two different regions and people treat them as
one.** The guide's own note says only klass metadata lives in the `CompressedClassSpaceSize`-bounded
space. Raising `MaxMetaspaceSize` does not enlarge the compressed class space, and raising
`CompressedClassSpaceSize` does not help ordinary metaspace exhaustion. `jcmd VM.metaspace` prints
them separately, and NMT's `Class` category splits into `Metadata:` and `Class space:` for the
same reason.

**★ The `Compressed class space` remedy in the guide has a one-release life.**
*"set `UseCompressedClassPointers` to false"* is written for an older JDK. On 25 the flag is
deprecated; on 26 it is obsolete. A runbook containing it will start warning this year and stop
working next year.

**★ `Out of swap space?` is not a question about your swap file.**
The question mark is the JVM guessing. On a container host with swap disabled it usually means the
cgroup limit, `vm.max_map_count`, or an address-space `ulimit` — none of which are swap. Read the
`hs_err` log's memory map rather than the message, and check `vm.max_map_count` specifically if the
process has many mappings.

**★ For `Out of swap space?` there is no dump and there was never going to be one.**
The JVM goes through the fatal-error handler, not through the throw path. Looking for the heap
dump your flags promised is looking for a file the JVM never had the opportunity to write.

**★ HotSpot logs a metaspace report before it throws, and almost nobody enables it.**
`-Xlog:gc+metaspace+freelist+oom=info` gets you `MetaspaceUtils::print_basic_report` at the moment
of failure; at `debug` level it also identifies the allocating `ClassLoaderData`. That is the
suspect named for free, in the log you already collect.

**★ `(Native method)` means NMT will look clean.**
The Troubleshooting Guide is explicit that NMT does not track non-JVM allocation. A flat NMT
summary next to a rising RSS is not "nothing found"; for this message it is confirmation.

**★ All four are invisible to heap-utilisation alerting.**
If your only memory alert is "heap above 90 percent", four of the seven documented failures will
page you exactly never, and will present as an unexplained restart.

## Interview questions

**★ Your service throws `OutOfMemoryError: Metaspace` and a colleague raises `-Xmx`. What
happens?**
Nothing good. Metaspace is native memory bounded by `-XX:MaxMetaspaceSize`, not by `-Xmx`; raising
the heap ceiling adds no metaspace at all. In a container it makes things worse twice over: the
bigger heap commits more memory, squeezing the native budget metaspace draws from, and the bigger
heap collects less often, so dead classloaders are unloaded later. The right first move is
`jcmd VM.classloader_stats` twice a few minutes apart — Impact: Low, safe on a live JVM — to see
whether the class count is merely large or actually growing.

**★ What is the difference between `Metaspace` and `Compressed class space`, and how do you tell
which one you have?** They are nested. `MaxMetaspaceSize` bounds the sum of all class metadata;
`CompressedClassSpaceSize`, default 1 GB, bounds only the klass-metadata part that compressed
class pointers can address — the guide's own note says *"Only klass metadata is stored in the
space bounded by `CompressedClassSpaceSize`."* You tell them apart from the message itself, and
confirm with `jcmd VM.metaspace` or NMT, where the `Class` category splits into `Metadata:` and
`Class space:`. The fixes differ: one needs a larger total or fewer loaders, the other needs a
larger `CompressedClassSpaceSize` — and specifically *not* `-XX:-UseCompressedClassPointers`,
which is deprecated on 25 and obsolete on 26.

**★ Why does `Out of swap space?` produce different evidence from every other message?**
Because the JVM does not throw and continue: the guide says it *"invokes the fatal error handling
mechanism"* and writes an `hs_err_pid<pid>.log`. That file contains the heap summary, the metaspace
summary, the thread list and the process memory map, which is exactly the right evidence for a
native-heap failure and exactly what a heap dump would not have contained. So the correct response
to this message is to find and read the crash log — and to check that your container writes it
somewhere that survives the restart, because by default it lands in the working directory.

**★ You get `reason stack_trace (Native method)` and NMT shows nothing unusual. Is NMT broken?**
No — that combination is the expected result and is itself informative. The Troubleshooting Guide
says NMT *"does not track memory allocations by non-JVM code"*, and this message specifically means
the failure was detected in a JNI or native method rather than in the JVM. So a clean NMT summary
alongside a growing RSS confirms the diagnosis rather than contradicting it, and moves the
investigation to `pmap`, `smaps_rollup`, and whichever native library appears in the stack — a
codec, a driver, a renderer, an agent, or an unclosed FFM `Arena`.

**★ Which of the seven messages would you expect on a container that keeps getting OOMKilled?**
Possibly none of them, and that is the point. An OOMKill is `SIGKILL` from the kernel: no message,
no stack trace, no dump. These four native messages are what you get when the JVM's *own* limit
binds before the cgroup's, which is the situation you should be engineering towards — set
`-XX:MaxMetaspaceSize`, set `-XX:MaxDirectMemorySize`, keep `-Xmx` well under the limit — precisely
so that a future incident produces a diagnosable Java error instead of exit code 137.
[`../01-memory-layout/01b`](../01-memory-layout/01b-oom-error-versus-oomkilled.md) owns that
distinction.

{/* FOOTER */}
