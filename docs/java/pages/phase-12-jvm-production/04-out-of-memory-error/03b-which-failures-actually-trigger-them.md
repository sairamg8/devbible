---
title: "Which OutOfMemoryErrors trigger the dump flags is decided by the list of HotSpot call sites that reach report_java_out_of_memory, not by the man page — and on JDK 25 metaspace is on that list even though the documentation says it is not"
sidebar_label: "03b · Which failures trigger them"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 HotSpot source at tag `jdk-25+36`** —
> `memory/metaspace.cpp` (`report_metadata_oome`), `gc/shared/memAllocator.cpp`
> (`Allocation::check_out_of_memory`), `prims/jvm.cpp` (`JVM_StartThread`),
> `runtime/globals.hpp` (the `MANAGEABLE` attribute and the four OOM flags)
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/memory/metaspace.cpp)),
> the **JDK 25 `java` tool reference** for `-XX:+HeapDumpOnOutOfMemoryError` and
> `-XX:OnOutOfMemoryError`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)), the
> **JDK 25 `jcmd` tool reference** for `VM.set_flag`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)), and the
> **JDK 25 Troubleshooting Guide** for the `jhsdb jmap` core-file workflow
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**"Always set `-XX:+HeapDumpOnOutOfMemoryError`" is the most-repeated line in production Java
advice and it is incomplete, because the flag covers only the failures whose code path calls
HotSpot's `report_java_out_of_memory`. The man page states that boundary as "Java Heap exhaustion"
and gets it half right: the exclusions it names are correct, and the inclusion is narrower than
what JDK 25 actually does. This chunk is the call-site inventory, the two flags Oracle never
documented, and the fact that three of the six dump-related flags can be turned on at runtime.**

## Two of the flags are undocumented; three of the dump flags are runtime-writable

`-XX:+ExitOnOutOfMemoryError` and `-XX:+CrashOnOutOfMemoryError` **do not appear in the JDK 25
`java` man page at all**. Their only authoritative descriptions are their declarations:

```cpp
product(bool, ExitOnOutOfMemoryError, false,
        "JVM exits on the first occurrence of an out-of-memory error thrown from JVM")

product(bool, CrashOnOutOfMemoryError, false,
        "JVM aborts, producing an error log and core/mini dump, on the "
        "first occurrence of an out-of-memory error thrown from JVM")
```

Plain `product`: supported, no unlock flag, both default `false`. And crucially, **neither
description narrows to heap exhaustion** — they say "thrown from JVM", which is the same boundary
the function itself enforces.

The dump-related flags carry an extra attribute the others do not:

```cpp
product(bool,  HeapDumpOnOutOfMemoryError, false, MANAGEABLE, ...)
product(ccstr, HeapDumpPath,               nullptr, MANAGEABLE, ...)
product(int,   HeapDumpGzipLevel,          0, MANAGEABLE, ...)  range(0, 9)
product(bool,  HeapDumpBeforeFullGC,       false, MANAGEABLE, ...)
product(bool,  HeapDumpAfterFullGC,        false, MANAGEABLE, ...)
product(uint,  FullGCHeapDumpLimit,        0, MANAGEABLE, ...)
```

`globals.hpp` defines the attribute:

> *"MANAGEABLE flags are writeable external product flags. They are dynamically writeable through
> the JDK management interface (`com.sun.management.HotSpotDiagnosticMXBean` API) and also through
> JConsole."*

🔴 **So you can arm the heap-dump-on-OOM behaviour on a JVM that is already running**, without a
restart:

```bash
jcmd <pid> VM.set_flag HeapDumpPath /var/dumps/late_%p.hprof
jcmd <pid> VM.set_flag HeapDumpOnOutOfMemoryError true
```

`VM.set_flag` is rated *Impact: Low*. This is the answer to "the flag was not set and we cannot
restart the pod without losing the state". `ExitOnOutOfMemoryError` and `CrashOnOutOfMemoryError`
are **not** manageable — those two are launch-time only.

## What actually triggers them: the call sites, not the man page

The man page states a restriction under both documented flags:

> *"This applies only to `OutOfMemoryError` exceptions caused by Java Heap exhaustion; it does not
> apply to `OutOfMemoryError` exceptions thrown directly from Java code, nor by the JVM for other
> types of resource exhaustion (such as native thread creation errors)."*

The second half is exactly right, and the source proves it: the native-thread failure in
`JVM_StartThread` is a bare `THROW_MSG` that never calls `report_java_out_of_memory`, and
`java.nio.Bits` is Java code that has no way to call it at all.

🔴 **The first half is wrong on JDK 25.** `Metaspace::report_metadata_oome` calls it, and the
source even names the flags in its comment:

```cpp
// -XX:+HeapDumpOnOutOfMemoryError and -XX:OnOutOfMemoryError support
const char* space_string = out_of_compressed_class_space ?
  "Compressed class space" : "Metaspace";

report_java_out_of_memory(space_string);
```

So the honest table, built from call sites rather than from the man page:

| Message | Calls `report_java_out_of_memory`? | Dump / hooks fire? |
|---|---|---|
| `Java heap space` | yes — `memAllocator.cpp` | **yes** |
| `GC overhead limit exceeded` | yes — same call site | **yes** |
| `Metaspace` | **yes** — `metaspace.cpp` | **yes**, despite the man page |
| `Compressed class space` | **yes** — same call site | **yes**, despite the man page |
| `Requested array size exceeds VM limit` | no | no |
| `request size … Out of swap space?` | no — fatal-error handler instead | no dump; an `hs_err` log |
| `reason stack_trace (Native method)` | no | no |
| `unable to create native thread: …` | no — bare `THROW_MSG` | no |
| `Cannot reserve … direct buffer memory` | no — thrown from Java | no |

⚠️ **Read this as a documented-versus-implemented discrepancy, not as licence to rely on it.** The
man page is the contract and the source is the current behaviour; where they differ, the safe
engineering position is to configure for the documented behaviour and be pleased when you get more.
Concretely: still set `-XX:MaxMetaspaceSize` and still expect to need
`jcmd VM.classloader_stats`, but do check `HeapDumpPath` after a metaspace OOM, because on JDK 25
there is likely to be a file there. ⚠️ **The sibling page
[`../01-memory-layout/01c`](../01-memory-layout/01c-the-oom-flags-and-what-they-cover.md) lists
`Metaspace` and `Compressed class space` as "no" in its table, following the man page. That is the
documented answer; this page is the implemented one.**

## The three other heap-dump flags nobody mentions

The same `MANAGEABLE` block declares three more, and none appears in the `java` man page:

```cpp
product(bool, HeapDumpBeforeFullGC, false, MANAGEABLE,
        "Dump heap to file before any major stop-the-world GC "
        "(also see FullGCHeapDumpLimit, HeapDumpPath, HeapDumpGzipLevel)")

product(bool, HeapDumpAfterFullGC, false, MANAGEABLE, "...")

product(uint, FullGCHeapDumpLimit, 0, MANAGEABLE,
        "Limit the number of heap dumps triggered by "
        "HeapDumpBeforeFullGC or HeapDumpAfterFullGC "
        "(0 means no limit)")
```

`HeapDumpBeforeFullGC` plus `HeapDumpAfterFullGC` with `FullGCHeapDumpLimit=2` is a leak-hunting
instrument: a pair of dumps bracketing the same collection tells you exactly what survived it,
which is the definition of the live set. Compare the two in MAT and the delta is the retention —
see [04c](04c-leak-suspects-and-paths-to-gc-roots.md) for the comparison workflow.

⚠️ `FullGCHeapDumpLimit` defaults to **`0`, which means *no limit***, not "none". Setting
`HeapDumpBeforeFullGC` on a service that does several full collections an hour and forgetting the
limit fills the volume. Always set the limit in the same breath as the flag.

Successive dumps do not overwrite: `HeapDumper::dump_heap` keeps a `dump_file_seq` counter and
appends `.1`, `.2` and so on after the first file.

## `HeapDumpPath` accepts a directory, and the man page does not say so

The man page describes it as *"the path and file name"*. `globals.hpp` is more accurate —
*"the path (filename or directory) of the dump file (defaults to `java_pid<pid>.hprof` in the
working directory)"* — and the implementation confirms it: `dump_heap` calls `os::opendir` on the
configured path, and if it is a directory it appends a separator and the default name.

```
-XX:HeapDumpPath=/var/dumps            # a directory: files become /var/dumps/java_pid<pid>.hprof
-XX:HeapDumpPath=/var/dumps/x_%p.hprof # a filename: %p is the pid, and %p is the ONLY expansion
```

One more implementation detail that changes the filename you should look for:

```cpp
const char* dump_file_name = HeapDumpGzipLevel > 0 ? "java_pid%p.hprof.gz" : "java_pid%p.hprof";
```

With `-XX:HeapDumpGzipLevel=1` the default name gains a `.gz`. A cleanup script globbing
`*.hprof` will not match it.

## Gotchas

**★ `HeapDumpOnOutOfMemoryError` can be turned on at runtime and almost nobody knows it.**
It is a `MANAGEABLE` flag: `jcmd <pid> VM.set_flag HeapDumpOnOutOfMemoryError true`, Impact: Low.
So can `HeapDumpPath` and `HeapDumpGzipLevel`. When the incident is happening and the flag was not
set at launch, this is the recovery — and it is available for exactly as long as the process has
not yet thrown its first OOM.

**★ `ExitOnOutOfMemoryError` and `CrashOnOutOfMemoryError` are *not* manageable.**
They have no `MANAGEABLE` attribute, so `VM.set_flag` will not set them. Those two are launch-time
decisions and cannot be retrofitted to a running JVM.

**★ On JDK 25 a metaspace OOM does produce a heap dump, and the man page says it does not.**
`metaspace.cpp` calls `report_java_out_of_memory` with a comment naming both flags. Do not build a
runbook that skips checking `HeapDumpPath` after a `Metaspace` failure. Equally, do not build one
that *depends* on the file being there — the documented contract still excludes it.

**★ `-XX:HeapDumpGzipLevel` exists, is `MANAGEABLE`, and changes the file extension.**
Range 0–9, default 0 meaning no compression. Set it and the default filename becomes
`java_pid<pid>.hprof.gz`. It is the crash-time equivalent of `jcmd GC.heap_dump -gz`, it is not in
the `java` man page, and a retention script matching `*.hprof` silently stops finding your dumps.

**★ `HeapDumpBeforeFullGC` with the default `FullGCHeapDumpLimit` writes an unbounded number of
dumps.** `0` means *no limit*, which reads like "off" and is the opposite. On a service doing
regular full collections this fills the volume and can evict the pod. Set the limit explicitly,
every time.

**★ `HeapDumpPath` can be a directory and most runbooks assume it cannot.**
`globals.hpp` says *"filename or directory"* and the implementation calls `opendir` to find out.
Pointing it at a mounted directory is usually what you want, because the JVM then supplies the
`%p`-bearing default name and successive dumps get `.1`, `.2` suffixes rather than colliding.

**★ `%p` is expanded by the JVM and nothing else is.**
Anything else in the value is literal unless a shell expanded it before the JVM saw it — which is
why dumps with a literal `$(date)` in the filename exist. Values arriving through
`JAVA_TOOL_OPTIONS` or a Kubernetes `args` list never pass through a shell.

## Interview questions

**★ The flag was not set and we cannot restart the pod. Can we still get a dump on the next OOM?**
Yes, if the JVM has not already thrown one. `HeapDumpOnOutOfMemoryError`, `HeapDumpPath` and
`HeapDumpGzipLevel` are all declared `MANAGEABLE` in `globals.hpp`, which `globals.hpp` itself
defines as *"writeable external product flags … dynamically writeable through the JDK management
interface"*. So `jcmd <pid> VM.set_flag HeapDumpPath /var/dumps/x_%p.hprof` followed by
`jcmd <pid> VM.set_flag HeapDumpOnOutOfMemoryError true` arms it live, at Impact: Low. What you
cannot retrofit is `ExitOnOutOfMemoryError` or `CrashOnOutOfMemoryError` — neither is manageable.

**★ Does `-XX:+HeapDumpOnOutOfMemoryError` really only cover heap exhaustion?**
The man page says so, in those words, and repeats the sentence under `-XX:OnOutOfMemoryError`. The
JDK 25 source disagrees in one specific place: `Metaspace::report_metadata_oome` calls
`report_java_out_of_memory` with a comment that literally reads
`// -XX:+HeapDumpOnOutOfMemoryError and -XX:OnOutOfMemoryError support`, so metaspace and
compressed-class-space exhaustion do trigger the hooks on this release. The exclusions the man
page names *are* correct: a native-thread failure is a bare `THROW_MSG`, and the direct-buffer
failure is thrown from ordinary Java code in `java.nio.Bits`, neither of which can reach that
function. The engineering position is to configure for the documented contract and treat the extra
coverage as a bonus you check for, not one you depend on.

**★ Two of the four OOM flags are not in the `java` man page. How would you confirm they exist on
the JVM you are actually running?**
`java -XX:+PrintFlagsFinal -version | grep -i outofmemory` prints every flag the binary knows
about with its current value and origin, which is first-party confirmation that
`ExitOnOutOfMemoryError` and `CrashOnOutOfMemoryError` are present and `false` by default. That is
worth doing rather than trusting a page like this one, because the two flags are `product` flags
declared only in `globals.hpp` — supported, no unlock option needed, but unsearchable in Oracle's
documentation. Treat the absence from the man page as a documentation gap, not as a deprecation
signal; nothing in `arguments.cpp` marks either flag deprecated or obsolete.

**★ How would you use `HeapDumpBeforeFullGC` and `HeapDumpAfterFullGC` to find a leak?**
Enable both with `FullGCHeapDumpLimit=2` so you get exactly one pair, on a replica taken out of
the load balancer. The two files bracket a single full collection, so everything present in the
"after" dump survived a collection by definition — that *is* the live set, without having to infer
it from a GC log. Open the pair in Memory Analyzer's comparison mode, or run
`ParseHeapDump.sh after.hprof -baseline=before.hprof org.eclipse.mat.api:suspects2`, and the
objects that should have died but did not are the report. The cost is two full-heap pauses and two
files, so it is a deliberate experiment rather than something to leave enabled.

{/* FOOTER */}
