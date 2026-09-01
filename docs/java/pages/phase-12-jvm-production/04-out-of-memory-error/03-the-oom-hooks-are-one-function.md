---
title: "All four OutOfMemoryError flags are implemented by a single twenty-line HotSpot function guarded by a compare-and-swap, so they fire together, in a fixed order, and exactly once in the lifetime of the JVM"
sidebar_label: "03 · The hooks are one function"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 HotSpot source at tag `jdk-25+36`** —
> `utilities/debug.cpp` (`report_java_out_of_memory`), `runtime/globals.hpp`
> (`HeapDumpOnOutOfMemoryError`, `OnOutOfMemoryError`, `ExitOnOutOfMemoryError`,
> `CrashOnOutOfMemoryError`, and the `MANAGEABLE` attribute definition),
> `gc/shared/memAllocator.cpp`, `memory/metaspace.cpp` and `prims/jvm.cpp`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/utilities/debug.cpp)),
> and the **JDK 25 `java` tool reference** for the documented restriction on
> `-XX:+HeapDumpOnOutOfMemoryError` and `-XX:OnOutOfMemoryError`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**`-XX:+HeapDumpOnOutOfMemoryError`, `-XX:OnOutOfMemoryError`, `-XX:+CrashOnOutOfMemoryError` and
`-XX:+ExitOnOutOfMemoryError` are not four independent features. They are four `if` statements
inside one twenty-line function, `report_java_out_of_memory`, and everything surprising about
their behaviour follows from that: they run in a fixed order, and a static compare-and-swap makes
the whole block execute **once in the lifetime of the JVM**. The second `OutOfMemoryError` gets
nothing, no matter which flags you set. This chunk is the function's mechanics;
[03b · Which failures actually trigger them](03b-which-failures-actually-trigger-them.md) is the
separate and more contested question of which failures reach it at all.**

## The function

```cpp
void report_java_out_of_memory(const char* message) {
  static int out_of_memory_reported = 0;

  // A number of threads may attempt to report OutOfMemoryError at around the
  // same time. To avoid dumping the heap or executing the data collection
  // commands multiple times we just do it once when the first threads reports
  // the error.
  if (Atomic::cmpxchg(&out_of_memory_reported, 0, 1) == 0) {
    // create heap dump before OnOutOfMemoryError commands are executed
    if (HeapDumpOnOutOfMemoryError) {
      tty->print_cr("java.lang.OutOfMemoryError: %s", message);
      HeapDumper::dump_heap_from_oome();
    }

    if (OnOutOfMemoryError && OnOutOfMemoryError[0]) {
      VMError::report_java_out_of_memory(message);
    }

    if (CrashOnOutOfMemoryError) {
      tty->print_cr("Aborting due to java.lang.OutOfMemoryError: %s", message);
      report_fatal(OOM_JAVA_HEAP_FATAL, __FILE__, __LINE__, "OutOfMemory encountered: %s", message);
    }

    if (ExitOnOutOfMemoryError) {
      tty->print_cr("Terminating due to java.lang.OutOfMemoryError: %s", message);
      os::_exit(3); // quick exit with no cleanup hooks run
    }
  }
}
```

Read it line by line, because six separate pieces of production-relevant behaviour are in there.

## 1 · It fires once per JVM, for ever

`static int out_of_memory_reported` with `Atomic::cmpxchg(&…, 0, 1)`. The comment explains the
intent — avoid several threads dumping the heap simultaneously — but the variable is never reset.

🔴 **A JVM writes at most one heap dump on OOM, runs your `OnOutOfMemoryError` command at most
once, and after the first `OutOfMemoryError` these flags are permanently inert.**

Combine that with the four-item pre-allocated error pool from
[01b](01b-the-error-with-no-stack-trace.md) and the shape of an unattended incident becomes clear:
the first OOM gets a stack trace *and* a dump; the next three get stack traces and nothing else;
everything after that is a bare message. If the process was left running for an hour, the only
evidence that exists was created in the first few seconds.

This is the strongest single argument for `-XX:+ExitOnOutOfMemoryError` in a supervised
environment: it makes the one moment the JVM instruments also be the last moment.

## 2 · The order is fixed, and the comment says why

Heap dump → `OnOutOfMemoryError` commands → crash → exit. *"create heap dump before
OnOutOfMemoryError commands are executed"* — so a script wired to `-XX:OnOutOfMemoryError` can
rely on the dump file already existing when it runs. That is what makes this pattern work:

```
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/var/dumps
-XX:OnOutOfMemoryError="/usr/local/bin/ship-dump.sh %p"
```

It also means `CrashOnOutOfMemoryError` and `ExitOnOutOfMemoryError` are mutually exclusive in
practice: the crash aborts the process before the exit line is reached. Setting both is not an
error, it is just that the second one never runs.

## 3 · `ExitOnOutOfMemoryError` exits with code 3 and runs no shutdown hooks

```cpp
os::_exit(3); // quick exit with no cleanup hooks run
```

Two facts nobody documents:

**The exit status is 3.** Not 1, not 137. If your orchestrator, supervisor or CI job distinguishes
exit codes, 3 is the one that means "the JVM terminated itself on an out-of-memory error". That is
a useful, unambiguous signal — and it is invisible unless you know to look for it.

**No shutdown hooks run.** `os::_exit` is the immediate variant: no `Runtime.addShutdownHook`
callbacks, no `@PreDestroy`, no Spring context close, no connection draining, no graceful
shutdown. In-flight requests are dropped mid-flight. **Topic 12 · Graceful shutdown** *(not written
yet)* owns the machinery this flag bypasses, and the interaction is worth stating explicitly on
both pages: **`ExitOnOutOfMemoryError` is deliberately ungraceful.** It has to be, because running
shutdown hooks requires allocating, and the premise is that allocation just failed.

## 4 · `CrashOnOutOfMemoryError` goes through the fatal-error handler

`report_fatal(OOM_JAVA_HEAP_FATAL, …)` produces an `hs_err_pid<pid>.log` and, subject to
`ulimit -c` and the kernel's `core_pattern`, a core dump. For a *native* failure the `hs_err` log
is far better evidence than a heap dump: it contains the heap summary, the metaspace summary, the
code cache summary, the thread list and the process memory map, in a few hundred kilobytes of
text rather than several gigabytes of binary describing the region that was not the problem.

The Troubleshooting Guide documents the follow-up, which is not obvious:

> *"if you specify the `-XX:+CrashOnOutOfMemoryError` command-line option while running your
> application, then when a `java.lang.OutOfMemoryError` error is thrown, the JVM will generate a
> core dump. You can then execute `jhsdb jmap` on the core file to get a histogram"*

```bash
jhsdb jmap --histo --exe /path/to/bin/java --core core.<pid>
```

So the core dump is not a dead end: it can be interrogated for a class histogram after the fact.

## Gotchas

**★ The OOM hooks fire once per JVM lifetime and never again.**
A `static int` guarded by a compare-and-swap, never reset. One heap dump, one
`OnOutOfMemoryError` invocation, for the whole life of the process. "We had six OOMs and one
dump" is the design, not a bug — and the one dump belongs to the *first* failure, which is the
one you wanted anyway.

**★ `-XX:+ExitOnOutOfMemoryError` exits with status 3.**
`os::_exit(3)`. Not 1, not 137. If your alerting distinguishes exit codes, 3 is an unambiguous
"the JVM killed itself over memory" signal that no other path produces.

**★ `-XX:+ExitOnOutOfMemoryError` runs no shutdown hooks at all.**
The source comment is *"quick exit with no cleanup hooks run"*. No `@PreDestroy`, no Spring context
close, no pool draining, no graceful HTTP shutdown. In-flight requests die where they stand. That
is intentional — cleanup would need to allocate — but it means the flag and a graceful-shutdown
configuration are answering different questions and one of them will not happen.

**★ Setting both `ExitOnOutOfMemoryError` and `CrashOnOutOfMemoryError` silently picks the crash.**
The crash branch runs first and aborts. The exit branch is unreachable. There is no warning; you
simply get the expensive behaviour when you may have intended the cheap one.

**★ The JVM prints a line to `tty` before each action, and `tty` is not your logger.**
`java.lang.OutOfMemoryError: <msg>`, `Aborting due to …`, `Terminating due to …` go to the VM's
own output stream — stdout for the process — not through SLF4J, not through your JSON encoder, not
through your MDC. A log pipeline that only ingests the application's structured output drops all
three.

**★ `-XX:OnOutOfMemoryError` runs a command *inside* a JVM that has no memory.**
The command is forked from a process that just failed to allocate. Keep it to a small static
binary or a shell one-liner; anything that starts another JVM is likely to fail for the same
reason the first one did.

**★ The dump written on OOM does **not** run a full GC first, unlike `jcmd GC.heap_dump`.**
`HeapDumper::dump_heap(bool oome)` constructs the dumper with `false /* no GC before heap dump */`.
The interactive command's default is the opposite. In practice the collector has just run and
failed, so most garbage is already gone — but the file is a snapshot of reachable *and*
unreachable objects, and a tool that keeps unreachable objects will show both.

**★ The OOM dump is parallel by default; `jcmd GC.heap_dump` is not.**
`default_num_of_dump_threads()` returns `max(1, cpus * 3 / 8)`, and the dumper additionally
reserves at least 20 MB of free memory per writer thread because *"For the OOM handling we may
already be limited in memory."* The `jcmd` command's `-parallel` option defaults to `1`. So the
crash-time dump is faster than the one you take by hand unless you ask for threads.

**★ A core dump from `CrashOnOutOfMemoryError` can exceed the container's disk.**
It is the whole address space. `ulimit -c` and the kernel's `core_pattern` decide whether it is
written at all, where, and whether it is truncated. Enabling the flag without checking those gets
you the abort and no evidence.

## Interview questions

**★ You set `-XX:+HeapDumpOnOutOfMemoryError`, the service threw three `OutOfMemoryError`s, and
there is exactly one dump file. Bug?**
No — that is the documented-by-source behaviour. All four OOM flags are implemented inside
`report_java_out_of_memory`, whose whole body sits behind
`Atomic::cmpxchg(&out_of_memory_reported, 0, 1)` on a `static int` that is never reset. The first
failure to reach that function does the dump and runs any `OnOutOfMemoryError` command; every
later one skips the entire block. The comment in the source says the intent was to stop several
threads dumping simultaneously, and the side effect is once-per-process. Which is fine, because
the first OOM is the one with evidence in it — the fourth is aftermath.

**★ What exit code does `-XX:+ExitOnOutOfMemoryError` produce, and what does it skip?**
`os::_exit(3)` — status 3, and the source comment is *"quick exit with no cleanup hooks run"*. So
no shutdown hooks, no `@PreDestroy`, no Spring context close, no connection draining, no graceful
HTTP shutdown; in-flight requests are dropped. That is deliberate: running cleanup would require
allocating memory, and the premise of the flag is that allocation just failed. The practical
consequences are that a graceful-shutdown configuration and this flag do not compose, and that
exit code 3 is a distinctive signal worth alerting on, since nothing else in the JVM produces it.

**★ Why does the JVM guard the whole hook block with a compare-and-swap rather than a lock?**
Because the situation it is handling is several threads failing to allocate at nearly the same
instant, which is the normal shape of heap exhaustion, and the desired behaviour is "exactly one
of you does this, the rest carry on immediately". A CAS on a `static int` gives that with no
allocation, no lock acquisition and no possibility of blocking a thread inside a VM that is
already out of memory. The trade-off the design accepts — and the reason it surprises people — is
that the guard is a one-shot for the process rather than a one-shot per incident.

**★ When would you prefer `CrashOnOutOfMemoryError` over `HeapDumpOnOutOfMemoryError`?**
When the failure is expected to be native. The heap-dump flag serialises the Java heap, which by
hypothesis is not where the memory went, and produces a multi-gigabyte binary. The crash flag goes
through `report_fatal` and produces an `hs_err_pid<pid>.log` containing the heap summary, the
metaspace summary, the code cache summary, the thread list and the process memory map — a few
hundred kilobytes of text that is the whole answer for a `Metaspace`, `Compressed class space` or
`Out of swap space?` failure. And the Troubleshooting Guide points out that the accompanying core
dump is still queryable afterwards: `jhsdb jmap --histo --exe … --core …` gives a class histogram
from it.

{/* FOOTER */}
