---
title: "The dump-on-OOM safety net you think you have covers Java heap space and nothing else, because one sentence in the java man page excludes every native failure"
sidebar_label: "01c · The OOM flags"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 `java` tool reference** —
> `-XX:+HeapDumpOnOutOfMemoryError`, `-XX:HeapDumpPath`, `-XX:OnOutOfMemoryError`,
> `-XX:OnError`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> the **JDK 25 `jcmd` tool reference** — `GC.heap_dump`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> and the JDK 25 HotSpot source `src/hotspot/share/runtime/globals.hpp` at tag `jdk-25+36`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/globals.hpp))
> for `ExitOnOutOfMemoryError` and `CrashOnOutOfMemoryError`, which the man page does not
> document. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Every production Java checklist tells you to set `-XX:+HeapDumpOnOutOfMemoryError`, and
almost none of them mention the sentence in the JDK documentation that says it only applies
to heap exhaustion. So the flag that is supposed to be your safety net does nothing for
`Metaspace`, nothing for `Compressed class space`, nothing for `Direct buffer memory`,
nothing for `unable to create native thread` and — obviously — nothing for an OOMKill. This
page is the honest inventory of what each OOM flag actually covers, which two flags are not
in the man page at all, and what to configure instead so that the hard failures leave
evidence.**

## The five flags

```
-XX:+HeapDumpOnOutOfMemoryError            # write an HPROF dump; off by default
-XX:HeapDumpPath=/dumps/heap_%p.hprof      # where; %p expands to the pid
-XX:OnOutOfMemoryError="<command>"         # run a command
-XX:+ExitOnOutOfMemoryError                # exit on the first one
-XX:+CrashOnOutOfMemoryError               # abort with an hs_err log and a core dump
```

## The sentence that limits the first three

For `-XX:+HeapDumpOnOutOfMemoryError`, the JDK 25 man page says:

> *"Enables the dumping of the Java heap to a file in the current directory by using the
> heap profiler (HPROF) when a `java.lang.OutOfMemoryError` exception is thrown by the JVM.
> … By default, this option is disabled and the heap isn't dumped when an
> `OutOfMemoryError` exception is thrown. **This applies only to `OutOfMemoryError`
> exceptions caused by Java Heap exhaustion; it does not apply to `OutOfMemoryError`
> exceptions thrown directly from Java code, nor by the JVM for other types of resource
> exhaustion (such as native thread creation errors).**"*

The identical restriction appears under `-XX:OnOutOfMemoryError`:

> *"Sets a custom command or a series of semicolon-separated commands to run when an
> `OutOfMemoryError` exception is first thrown by the JVM. … This applies only to
> `OutOfMemoryError` exceptions caused by Java Heap exhaustion; it does not apply to
> `OutOfMemoryError` exceptions thrown directly from Java code, nor by the JVM for other
> types of resource exhaustion (such as native thread creation errors)."*

Cross-referencing that against the seven detail messages from
[01b](01b-oom-error-versus-oomkilled.md) gives an uncomfortable table:

| Detail message | Dump fires? |
|---|---|
| `Java heap space` | **yes** |
| `GC Overhead limit exceeded` | yes — it is heap exhaustion |
| `Requested array size exceeds VM limit` | no — a VM limit, not heap exhaustion |
| `Metaspace` | ⚠️ **the man page says no — the source says yes** (below) |
| `Compressed class space` | ⚠️ **same discrepancy** |
| `request size bytes for reason. Out of swap space?` | **no** |
| `reason stack_trace (Native method)` | **no** |
| direct buffer exhaustion | **no** — ⚠️ and the message is *not* the literal `Direct buffer memory`; see below |
| `unable to create native thread` | **no** — named explicitly in the doc |

Most of the ways a JVM can say "out of memory" produce no dump — and they are, without
exception, the ones that are hardest to diagnose without one.

🔴 **Two corrections to the table above, both established from the JDK 25 source at `jdk-25+36`
after this page was first written:**

**1 · Metaspace OOMs *do* fire the hook, despite the man page.**
`src/hotspot/share/memory/metaspace.cpp`'s `report_metadata_oome` calls
`report_java_out_of_memory`, with the comment `// -XX:+HeapDumpOnOutOfMemoryError and
-XX:OnOutOfMemoryError support`. So on JDK 25 both `Metaspace` and `Compressed class space` reach
the same hook the heap messages do. ⚠️ **The man page's "Java Heap exhaustion" wording is
narrower than the implementation.** Configure for the documented contract — a behaviour that
contradicts the documentation can be changed without notice — but do not be surprised by a dump
you were told you would not get.

**2 · There is no message that literally reads `Direct buffer memory`.**
`java.nio.Bits` throws
`OutOfMemoryError("Cannot reserve " + size + " bytes of direct buffer memory (allocated: …, limit: …)")`.
Anything grepping logs for the short string finds nothing — see
[07 · Direct and mapped buffers](07-direct-and-mapped-buffers.md). The count of distinct
out-of-memory messages is also larger than eight: the troubleshooting guide documents seven, and
HotSpot has several more that are real but unlisted.

## `-XX:HeapDumpPath` and the second outage

> *"Sets the path and file name for writing the heap dump provided by the heap profiler
> (HPROF) when the `-XX:+HeapDumpOnOutOfMemoryError` option is set. By default, the file is
> created in the current working directory, and it's named `java_pid<pid>.hprof` where
> `<pid>` is the identifier of the process that caused the error."*

The current working directory in a container image is usually a writable overlay layer that
disappears when the container does. So the default configuration writes a file the size of
your live set into ephemeral storage, and then the container restarts and takes it with it.
If your ephemeral-storage limit is smaller than your heap — which it usually is — the write
also gets the pod evicted for a completely separate reason, and now you have two incidents.

```
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/var/dumps/heap_%p.hprof   # %p, and only %p, is expanded by the JVM
```

Point it at a mounted volume with room for the whole heap, and keep `%p` in the name so a
crash-loop does not overwrite the first and most informative dump with the fourth.

## The two flags that are not in the man page

`-XX:+ExitOnOutOfMemoryError` and `-XX:+CrashOnOutOfMemoryError` are widely recommended and
are **not documented in the JDK 25 `java` man page at all**. They are ordinary product flags,
and the only authoritative description of them is their declaration in
`src/hotspot/share/runtime/globals.hpp`:

```cpp
product(bool, ExitOnOutOfMemoryError, false,
        "JVM exits on the first occurrence of an out-of-memory error "
        "thrown from JVM")

product(bool, CrashOnOutOfMemoryError, false,
        "JVM aborts, producing an error log and core/mini dump, on the "
        "first occurrence of an out-of-memory error thrown from JVM")
```

Three things follow from those two declarations. `product` means they are supported and
need no `-XX:+UnlockExperimentalVMOptions`. Both default to `false`. And "thrown from JVM"
in both descriptions means the same exclusion applies as for the documented flags: an
`OutOfMemoryError` your own code constructs and throws does not trigger them — but unlike
`HeapDumpOnOutOfMemoryError`, the description does *not* narrow them to heap exhaustion, so
they are the broader net.

`-XX:+CrashOnOutOfMemoryError` produces an `hs_err_pid<pid>.log`, which for a *native*
memory failure is strictly better evidence than a heap dump: it contains the heap summary,
the metaspace summary, the code cache summary, the thread list and the process's memory map,
in a text file of a few hundred kilobytes rather than a multi-gigabyte binary of the region
that was not the problem.

## What to configure, in order of value

```
# always, everywhere
-XX:+ExitOnOutOfMemoryError                   # a clean death the orchestrator can act on
-Xlog:gc*:file=/var/log/gc.log:uptime,level,tags:filecount=5,filesize=20M

# when the heap is a plausible suspect
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/var/dumps/heap_%p.hprof     # a real volume, not the CWD

# when the native side is a plausible suspect
-XX:NativeMemoryTracking=summary              # ~5-10% cost; measure before committing

# instead of HeapDumpOnOutOfMemoryError, when the failure is native
-XX:+CrashOnOutOfMemoryError                  # hs_err log + core dump, covers more cases
```

The two dump flags are mutually redundant in practice: `CrashOnOutOfMemoryError` aborts, so
`HeapDumpOnOutOfMemoryError` will have written its dump first if the error was heap
exhaustion, and will have written nothing if it was not. Running both is reasonable.
Running `ExitOnOutOfMemoryError` and `CrashOnOutOfMemoryError` together is not — they are
two different answers to the same question, and the crash is the more expensive one.

Getting a dump deliberately, rather than on failure, is a different set of trade-offs and
lives in [01d · Taking a heap dump on purpose](01d-taking-a-heap-dump-on-purpose.md).

## Gotchas

**★ `-XX:+HeapDumpOnOutOfMemoryError` only fires for `Java heap space`.**
Not "for any `OutOfMemoryError`" — the man page restricts it to *"`OutOfMemoryError`
exceptions caused by Java Heap exhaustion"* and explicitly excludes errors thrown from Java
code and *"other types of resource exhaustion"*. It does not fire for `Metaspace`,
`Compressed class space`, `Direct buffer memory` or `unable to create native thread`, and it
obviously does not fire for an OOMKill. The safety net has holes exactly where the hard cases
are.

**★ `-XX:OnOutOfMemoryError` carries the same restriction, so "run a script on OOM" is not a
general hook.**
The man page repeats the sentence verbatim under that flag. A wrapper that expects to capture
diagnostics on every `OutOfMemoryError` will silently do nothing for the native ones. If you
need a hook that covers more of them, `-XX:+CrashOnOutOfMemoryError` — described in the
HotSpot source as firing on *"the first occurrence of an out-of-memory error thrown from
JVM"*, with no heap-exhaustion qualifier — is the closer match, at the price of a core dump.

**★ `-XX:HeapDumpPath` defaults to the current working directory.**
Which in a container is ephemeral overlay storage that vanishes on restart, and which often
has a smaller limit than the heap. The default configuration therefore produces either no
dump or a second, unrelated eviction. Always point it at a mounted volume, and keep `%p` in
the filename.

**★ A heap dump taken for a native OOM contains the wrong region.**
It serialises the Java heap, which by hypothesis is not where the memory went. It remains
useful for a classloader leak, because you can count `ClassLoader` instances and find what
retains them; it is useless for a `malloc` leak, a direct-buffer leak or thread stacks.

**★ Errors thrown from Java code are excluded from all of these hooks.**
`throw new OutOfMemoryError("simulated")` in a test will not produce a heap dump, will not run
`OnOutOfMemoryError`, and will not exit under `ExitOnOutOfMemoryError`, because all of them
are documented as applying to errors thrown *by the JVM*. If you are validating an OOM
runbook, you have to exhaust memory for real.

**★ `ExitOnOutOfMemoryError` and `CrashOnOutOfMemoryError` are undocumented in the man page,
which means they are unsearchable when you need them.**
They are `product` flags in `globals.hpp` and they work, but you will not find them in the
`java` reference, and `java -XX:+PrintFlagsFinal -version | grep OutOfMemory` is the only
first-party way to confirm they exist on your build. Treat the absence from the man page as
a documentation gap, not as a deprecation signal.

**★ Running `ExitOnOutOfMemoryError` and `CrashOnOutOfMemoryError` together is incoherent.**
They are two different terminal behaviours for the same event. Pick the one that matches
what you need: a fast, cheap restart, or an expensive but far more informative crash log and
core dump.

**★ A core dump from `CrashOnOutOfMemoryError` can be larger than the container's disk.**
A core dump is the process's entire address space. On a JVM with a 4 GB heap that is a
multi-gigabyte file, and `ulimit -c` and the kernel's `core_pattern` decide whether it is
written at all, where, and whether it is truncated. Enabling the flag without checking those
gets you the abort without the evidence.

**★ `%p` is expanded by the JVM; shell substitutions in `HeapDumpPath` are not.**
The man page documents `%p` as *"the current process identifier"*. Anything else in that
string is taken literally unless your entrypoint is a shell that expanded it first — which is
a common source of dumps with a literal `$(date)` in the filename.

## Interview questions

**★ You set `-XX:+HeapDumpOnOutOfMemoryError`. Your service dies with
`OutOfMemoryError: Metaspace` and there is no dump. Why?**
Because the flag is documented as applying *"only to `OutOfMemoryError` exceptions caused by
Java Heap exhaustion"* and explicitly not to *"other types of resource exhaustion"*.
Metaspace is native class metadata, not the Java heap, so the hook does not fire. This is
not a bug or a misconfiguration; it is the documented behaviour, and it is why a checklist
that stops at that one flag leaves the five hardest failure modes with no evidence at all.

**★ How do you turn an OOMKill into something you can debug?**
Give the JVM a limit that binds *before* the cgroup's, so the JVM throws instead of being
killed. If the heap is the suspect, set `-Xmx` or `MaxRAMPercentage` low enough that
`Java heap space` is reached while the pod still has headroom. If metaspace is the suspect,
set `-XX:MaxMetaspaceSize` explicitly — unbounded by default is precisely why metaspace
growth manifests as a kernel kill rather than a Java error. Then add
`-XX:+HeapDumpOnOutOfMemoryError` with `-XX:HeapDumpPath` on a volume that survives the
restart, `-XX:+ExitOnOutOfMemoryError` so the failure is clean, and
`-XX:NativeMemoryTracking=summary` so you can see which region moved. You are trading a
silent kill for a loud, instrumented one.

**★ Why is `-XX:+ExitOnOutOfMemoryError` a good default in a container and a bad one on a
desktop?**
In a container there is a supervisor whose job is to restart you, health checks that route
traffic away, and usually more than one replica — a fast, clean death is cheaper than a
degraded process. On a desktop or in a long-running batch job there is no supervisor,
exiting loses in-flight work, and a JVM that threw once may well recover when a large
transient allocation is released. The flag is a statement about deployment topology, not
about the JVM.

**★ When would you prefer `-XX:+CrashOnOutOfMemoryError` over
`-XX:+HeapDumpOnOutOfMemoryError`?**
When the suspected failure is native. The heap-dump flag is restricted to heap exhaustion
and produces a binary of the Java heap; the crash flag is described as firing on any
out-of-memory error *"thrown from JVM"* and produces an `hs_err` log containing the heap
summary, the metaspace summary, the code cache summary, the thread list and the memory map.
For a `Metaspace`, `Compressed class space` or `Out of swap space?` failure that text file is
the whole answer, and it is a few hundred kilobytes rather than several gigabytes.

**★ Someone's `HeapDumpPath` contains a literal `$(hostname)` in the filename on disk. What
happened?**
The JVM expands `%p` and nothing else; everything else in the value is literal. The
substitution was written expecting a shell to evaluate it, but the flag reached the JVM
unevaluated — typically because it was passed through a `JAVA_TOOL_OPTIONS` environment
variable or a Kubernetes `args` list rather than through a shell. Use `%p`, or expand the
value in an entrypoint script before the JVM sees it.

{/* FOOTER */}