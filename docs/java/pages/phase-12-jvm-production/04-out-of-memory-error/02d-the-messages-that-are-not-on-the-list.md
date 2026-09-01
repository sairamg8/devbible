---
title: "Four more OutOfMemoryError messages are real, are common in production, and appear nowhere in the Troubleshooting Guide's list — and the two everybody quotes from memory are not the strings the JVM actually prints"
sidebar_label: "02d · Not on the list"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 source at tag `jdk-25+36`** —
> `hotspot/share/runtime/os.hpp` (`OS_NATIVE_THREAD_CREATION_FAILED_MSG`),
> `hotspot/share/prims/jvm.cpp` (`JVM_StartThread`), `hotspot/share/prims/jni.cpp`
> (`jni_NewWeakGlobalRef`), `hotspot/share/runtime/deoptimization.cpp`,
> `hotspot/share/memory/universe.cpp` (the pre-allocated message strings) and
> `java.base/share/classes/java/nio/Bits.java` (`reserveMemory`)
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/java.base/share/classes/java/nio/Bits.java)),
> checked against the **JDK 25 Troubleshooting Guide**'s enumerated list
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**The Troubleshooting Guide lists seven detail messages. It is not a complete inventory of what a
JDK 25 JVM can print after `java.lang.OutOfMemoryError:`, and the gap matters because two of the
missing ones — the direct-buffer failure and the native-thread failure — are among the most common
in containerised production. Worse, the short forms everyone remembers are not the actual strings.
"`Direct buffer memory`" has not been the message for years, and "`unable to create native
thread`" is only the first half of one. This chunk is the four extras, quoted from the source that
emits them, and the honest statement of where each comes from.**

## Say "seven documented, plus these"

That phrasing matters. A reader who searches the guide for `unable to create native thread` and
finds nothing concludes they misread the log, or that they are on a weird JDK. They are not: the
message exists, it just comes from HotSpot's C++ rather than from a documented list. Naming the
provenance is the difference between a page that helps and a page that starts an argument.

| Message | Emitted by | In the guide? |
|---|---|---|
| `Cannot reserve N bytes of direct buffer memory (allocated: A, limit: L)` | `java.nio.Bits` | no |
| `unable to create native thread: possibly out of memory or process/resource limits reached` | `hotspot/share/runtime/os.hpp`, thrown from `JVM_StartThread` | no |
| `C heap space` | pre-allocated in `universe.cpp`; thrown from `jni_NewWeakGlobalRef` | no |
| `Java heap space: failed reallocation of scalar replaced objects` | pre-allocated in `universe.cpp`; thrown from `deoptimization.cpp` | no |

## 1 · The direct-buffer message is not `Direct buffer memory`

🔴 This is the correction with the widest blast radius, because "`OutOfMemoryError: Direct buffer
memory`" appears in thousands of blog posts, in monitoring rules and in this very corpus's
sibling pages. The JDK 25 string, from `java.nio.Bits.reserveMemory`, is:

```java
// no luck
throw new OutOfMemoryError
    ("Cannot reserve "
     + size + " bytes of direct buffer memory (allocated: "
     + RESERVED_MEMORY.get() + ", limit: " + MAX_MEMORY +")");
```

So a real line has this shape — a schematic, with the three byte counts shown as placeholders
rather than as values from a run:

```
java.lang.OutOfMemoryError: Cannot reserve <size> bytes of direct buffer memory (allocated: <reserved>, limit: <max>)
```

**The word "Cannot" starts it and the numbers are in it** — which is the useful part, because
`allocated` and `limit` tell you immediately whether you are near `-XX:MaxDirectMemorySize` or
nowhere near it.

An alert rule matching `Direct buffer memory` still fires, because that substring survives inside
the longer sentence. An alert rule matching `^java.lang.OutOfMemoryError: Direct buffer memory$`
does not.

**What the JVM tried before throwing** is worth knowing, because it explains a class of "we fixed
it by adding a `System.gc()`" folklore. `Bits.reserveMemory` escalates: an optimistic CAS on the
reserved-bytes counter, then a loop on `waitForReferenceProcessing()`, then an explicit
`System.gc();` with the comment *"trigger VM's Reference processing"*, then an exponential
back-off of up to nine sleeps, and only then the throw. Direct buffers are freed by a
`jdk.internal.ref.Cleaner`, a `PhantomReference`, so reclamation genuinely depends on a
collection happening.

🔴 **Therefore `-XX:+DisableExplicitGC` disables the JDK's own direct-buffer reclamation trigger.**
A service with that flag and heavy direct-buffer traffic can throw this error while the buffers it
needs are all unreachable and merely uncollected. If the goal was to neutralise a rogue library's
`System.gc()`, `-XX:+ExplicitGCInvokesConcurrent` is the flag that does it without breaking this
path. The region, its default (`-XX:MaxDirectMemorySize` defaults to `-Xmx`) and the `Cleaner`
lifecycle belong to
[`../01-memory-layout/07-direct-and-mapped-buffers.md`](../01-memory-layout/07-direct-and-mapped-buffers.md)
and [`07b`](../01-memory-layout/07b-cleaners-and-deterministic-release.md).

Also verbatim from `Bits.tryReserveMemory`, and frequently the resolution of a confusing incident:

> *"-XX:MaxDirectMemorySize limits the total **capacity** rather than the actual memory usage,
> which will differ when buffers are page aligned."*

## 2 · The native-thread message, in full

From `os.hpp`:

```cpp
#define OS_NATIVE_THREAD_CREATION_FAILED_MSG "unable to create native thread: possibly out of memory or process/resource limits reached"
```

and from `JVM_StartThread` in `jvm.cpp`, the whole failure path:

```cpp
if (native_thread->osthread() == nullptr) {
  ResourceMark rm(thread);
  log_warning(os, thread)("Failed to start the native thread for java.lang.Thread \"%s\"",
                          JavaThread::name_for(JNIHandles::resolve_non_null(jthread)));
  native_thread->smr_delete();
  if (JvmtiExport::should_post_resource_exhausted()) {
    JvmtiExport::post_resource_exhausted(
      JVMTI_RESOURCE_EXHAUSTED_OOM_ERROR | JVMTI_RESOURCE_EXHAUSTED_THREADS,
      os::native_thread_creation_failed_msg());
  }
  THROW_MSG(vmSymbols::java_lang_OutOfMemoryError(),
            os::native_thread_creation_failed_msg());
}
```

Three things are visible here that nothing in the documentation tells you:

**A `log_warning(os, thread)` line is emitted first, and it names the thread.** Enable
`-Xlog:os+thread=warning` — it is on by default at warning level in unified logging — and you get
`Failed to start the native thread for java.lang.Thread "<name>"` immediately before the error.
The name is usually the pool prefix, which identifies *which* executor was expanding when the
process hit its limit. That is a far better clue than the OOM's own stack trace.

**The JVM's own wording tells you it is guessing.** *"possibly out of memory **or process/resource
limits reached**"* — the common causes are `ulimit -u`, the cgroup `pids.max`,
`vm.max_map_count`, and an address-space `ulimit`, none of which are a shortage of RAM. Confirming
the diagnosis is arithmetic, and topic 01 owns it:
[`../01-memory-layout/06d-the-thread-count-arithmetic.md`](../01-memory-layout/06d-the-thread-count-arithmetic.md).

**`THROW_MSG` is a direct throw — it does not call `report_java_out_of_memory`.** So none of the
four OOM hooks fires for this failure. That is the source-level confirmation of the man page's
exclusion, and it is exactly what
[03 · The OOM hooks are one function](03-the-oom-hooks-are-one-function.md) is about.

**JVMTI agents do see it**, via `post_resource_exhausted` with both
`JVMTI_RESOURCE_EXHAUSTED_OOM_ERROR` and `JVMTI_RESOURCE_EXHAUSTED_THREADS` set. If you have an
APM agent attached, it may well have recorded the event the JVM's own flags ignored.

## 3 · `C heap space`

Pre-allocated in `universe.cpp` alongside `Java heap space` and `Metaspace`:

```cpp
msg = java_lang_String::create_from_str("C heap space", CHECK);
java_lang_Throwable::set_message(oom_array->obj_at(_oom_c_heap), msg());
```

⚠️ **The only call site I could find in the JDK 25 sources I checked is
`jni_NewWeakGlobalRef`** — when the JNI weak-global handle block cannot be extended from the C
heap. There may be others in files I did not read; I did not confirm a complete list, and I am
not going to assert one. What is certain is that the message exists, that it is native-heap
exhaustion rather than Java-heap exhaustion, and that it is not in the guide's seven. If you see
it, an agent or a native library holding JNI weak global references is the first place to look.

## 4 · `Java heap space: failed reallocation of scalar replaced objects`

Also pre-allocated, and thrown from `deoptimization.cpp`:

```cpp
if (failures) {
  THROW_OOP_(Universe::out_of_memory_error_realloc_objects(), failures);
}
```

The mechanism: the JIT proved via escape analysis that an object never escapes its method and
eliminated the allocation entirely, keeping the fields in registers. Something then forced the
frame to deoptimise — an uncommon trap, a class load, a debugger attaching — and the interpreter
needs the object to actually exist. Materialising it allocates, and that allocation failed.

It is genuine heap exhaustion, so the fix is the same as for `Java heap space`. Its value is
diagnostic: the frames in the trace are a deoptimisation path rather than your allocation site,
which is otherwise baffling.

## What the complete picture looks like

Nine messages, three provenances:

- **Seven** documented in the Troubleshooting Guide.
- **Two more** pre-allocated by HotSpot but never enumerated by Oracle: `C heap space`,
  `Java heap space: failed reallocation of scalar replaced objects`.
- **Two more** thrown as ordinary strings rather than pre-allocated singletons: the native-thread
  message from HotSpot, and the direct-buffer message from `java.nio.Bits` — which, being plain
  Java library code, is the one case where `throw new OutOfMemoryError(...)` in the JDK behaves
  exactly like `throw new OutOfMemoryError(...)` in yours.

That last point is the neatest way to remember which failures fire the OOM flags: the flags live in
HotSpot's `report_java_out_of_memory`, and `Bits` cannot call it.

## Gotchas

**★ `OutOfMemoryError: Direct buffer memory` is not the JDK 25 message.**
The real string starts `Cannot reserve` and carries the failing size, the currently allocated
total and the limit. Documentation, alerts and runbooks quoting the short form are quoting a JDK
that is many releases old; an exact-match log rule built on it never fires.

**★ The direct-buffer message contains the two numbers you need and people ignore them.**
`allocated:` versus `limit:` tells you in one glance whether you are at the ceiling (raise
`-XX:MaxDirectMemorySize`, or find the leak) or far from it (the failure is fragmentation or a
concurrent spike, and the limit is not the problem).

**★ `-XX:+DisableExplicitGC` breaks direct-buffer reclamation.**
`Bits.reserveMemory` calls `System.gc()` deliberately, with the comment *"trigger VM's Reference
processing"*, because direct buffers are freed by a `PhantomReference`-based `Cleaner`. Disabling
explicit GC removes that escalation step and converts a recoverable pause into an
`OutOfMemoryError`. Use `-XX:+ExplicitGCInvokesConcurrent` instead.

**★ `unable to create native thread` is the abbreviation, not the message.**
The full string continues `: possibly out of memory or process/resource limits reached`. Searching
the JDK documentation for either form finds nothing, because the message lives in `os.hpp` and is
not documented anywhere.

**★ The line *before* the native-thread OOM names the thread that failed to start.**
`log_warning(os, thread)("Failed to start the native thread for java.lang.Thread \"%s\"", …)`.
The name identifies the pool that was growing. Most incident reports for this failure do not
include that line because nobody looked one line up.

**★ The native-thread failure fires none of the OOM flags.**
It is a bare `THROW_MSG`, not a call to `report_java_out_of_memory`. No heap dump, no
`OnOutOfMemoryError` command, no `ExitOnOutOfMemoryError`, no `CrashOnOutOfMemoryError`. A
container configured entirely around those flags gets no evidence at all for one of its most
likely failures.

**★ A JVMTI agent may have recorded a native-thread OOM that your flags missed.**
`JvmtiExport::post_resource_exhausted` is called with `JVMTI_RESOURCE_EXHAUSTED_THREADS` before the
throw. If an APM agent is attached, its own event stream is a source of evidence the JVM's flags
did not produce.

**★ Two messages begin with `Java heap space` and a prefix match conflates them.**
The scalar-replacement variant is thrown from deoptimisation, not from your allocation site. If
the frames look like JIT internals rather than application code, read the full message.

**★ "Not in the documentation" is not "not real", and saying so out loud prevents an argument.**
Four of the nine messages a JDK 25 JVM can print are absent from Oracle's enumerated list. A page
that presents a list of eight or nine without saying which are documented sets its reader up to
be contradicted by someone holding the guide.

## Interview questions

**★ How many `OutOfMemoryError` detail messages are there?**
Seven are documented — the Troubleshooting Guide's list — and at least four more are real. HotSpot
pre-allocates two the guide never mentions, `C heap space` and `Java heap space: failed
reallocation of scalar replaced objects`. Two more are thrown as ordinary strings: the
native-thread failure from `os.hpp` via `JVM_StartThread`, and the direct-buffer failure from
`java.nio.Bits`. The right way to state it is "seven documented, plus these", because the
provenance changes what you can do about each one — in particular, the two undocumented *thrown*
ones do not go through HotSpot's `report_java_out_of_memory`, so none of the OOM flags fire for
them.

**★ What is the exact message for a direct-buffer exhaustion on JDK 25?**
`Cannot reserve N bytes of direct buffer memory (allocated: A, limit: L)`, from
`java.nio.Bits.reserveMemory`. Not `Direct buffer memory`, which is what everybody quotes and
which has not been the whole string for a long time. The two numbers are the useful part: `limit`
is your effective `-XX:MaxDirectMemorySize`, which defaults to `-Xmx` rather than to a share of
it, and `allocated` says whether you were actually near it. Before throwing, `Bits` escalates
through reference processing and an explicit `System.gc()`, which is why
`-XX:+DisableExplicitGC` can cause this error on a service that would otherwise have recovered.

**★ Your pod dies with `unable to create native thread` and the node has 40 GB free. Explain.**
Because that message is not primarily about memory — its own full text says *"possibly out of
memory or process/resource limits reached"*. Creating a platform thread needs a fresh native stack
(1 MB on Linux/x64, 2 MB on AArch64) plus an OS thread, and it fails on `ulimit -u`, the cgroup
`pids.max`, `vm.max_map_count`, or an address-space `ulimit` long before the machine runs out of
RAM. Free memory on the node is consistent with every one of those. Two immediate moves: read the
`log_warning(os, thread)` line just above the error, which names the thread and therefore the pool
that was expanding, and check the pids limit. The fix is normally to bound the pool or move to
virtual threads, not to add RAM.

**★ Why does the direct-buffer OOM behave differently from the metaspace OOM with respect to heap
dumps?** Because of where each is thrown from. Metaspace exhaustion goes through
`Metaspace::report_metadata_oome`, which calls HotSpot's `report_java_out_of_memory` — the single
function that implements all four OOM flags. The direct-buffer failure is `throw new
OutOfMemoryError(...)` in ordinary Java library code in `java.nio.Bits`, which has no way to call
into that C++ function at all. The man page describes the same boundary from the outside when it
excludes *"OutOfMemoryError exceptions thrown directly from Java code"*. So metaspace gets a dump
on JDK 25 and the direct-buffer failure never can.

{/* FOOTER */}
