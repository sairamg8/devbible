---
title: "The legacy GC logging flags were not removed in JDK 9 — they are deprecated, still honoured, and translated into unified logging at startup, which is why a service can keep writing an unrotated GC log for years without anyone noticing it forfeited every option that matters"
sidebar_label: "02c2 · Flags that still work"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** — "Deprecated Java
> Options" (`-Xloggc`), "Convert GC Logging Flags to Xlog", "Convert Runtime Logging Flags to
> Xlog" and `-XX:+PrintFlagsFinal`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp)
> for the `PrintGC` / `PrintGCDetails` declarations,
> [`runtime/arguments.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/arguments.cpp)
> for `handle_deprecated_print_gc_flags()` and the `-Xloggc:` handler, and
> [`runtime/flags/jvmFlag.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/flags/jvmFlag.cpp)
> for `is_unlocked()` and the locked-flag error messages.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[02c](02c-what-was-removed.md) covered the two tiers that announce themselves. This page
is the third: options that are deprecated, still work, and are therefore never investigated.
The GC logging flags are the important case, because the legacy path silently gives up log
rotation, filename expansion and asynchronous writing — three things you only discover you
needed during an incident. The page ends with the audit procedure for a command line you did
not write.**

## Tier 1 — deprecated. These still work.

This is the tier people are surprised by, because the folklore says the legacy GC print flags
were "replaced by unified logging in JDK 9". They were replaced; they were not removed.
`gc_globals.hpp` on JDK 25 still declares:

```cpp
product(bool, PrintGC, false,
        "Print message at garbage collection. "
        "Deprecated, use -Xlog:gc instead.")

product(bool, PrintGCDetails, false,
        "Print more details at garbage collection. "
        "Deprecated, use -Xlog:gc* instead.")
```

and `arguments.cpp` translates them into unified logging configuration at startup:

```cpp
bool Arguments::handle_deprecated_print_gc_flags() {
  if (PrintGC) {
    log_warning(gc)("-XX:+PrintGC is deprecated. Will use -Xlog:gc instead.");
  }
  if (PrintGCDetails) {
    log_warning(gc)("-XX:+PrintGCDetails is deprecated. Will use -Xlog:gc* instead.");
  }

  if (_legacyGCLogging.lastFlag == 2) {
    // -Xloggc was used to specify a filename
    const char* gc_conf = PrintGCDetails ? "gc*" : "gc";
    ...
  } else if (PrintGC || PrintGCDetails || (_legacyGCLogging.lastFlag == 1)) {
    LogConfiguration::configure_stdout(LogLevel::Info, !PrintGCDetails, LOG_TAGS(gc));
  }
  return true;
}
```

`-Xloggc:<file>` gets the same treatment, from its own handler:

```cpp
} else if (match_option(option, "-Xloggc:", &tail)) {
  // Deprecated flag to redirect GC output to a file. -Xloggc:<filename>
  log_warning(gc)("-Xloggc is deprecated. Will use -Xlog:gc:%s instead.", tail);
```

and the man page lists it under Deprecated Java Options with the mapping spelled out:
*"`-Xloggc:filename` is replaced by `-Xlog:gc:filename`."*

⚠️ **This corrects a claim you will see stated confidently, including in this topic's own
planning notes: `-XX:+PrintGCDetails` is not gone on JDK 25.** It is deprecated, it warns,
and it is honoured. Contrast the *runtime* logging flags, where the man page is explicit that
the removal was total: *"These legacy flags are no longer recognized and will cause an error
if used directly"* — that sentence governs `TraceExceptions`, `TraceClassLoading` and friends,
not the GC print flags.

## What the legacy path costs you

Read the translation again. `-Xloggc:/var/log/gc.log` becomes `-Xlog:gc:/var/log/gc.log` —
the *tag-selection* and *output* fields of the `-Xlog` grammar, and nothing else. The
`-Xlog` synopsis has four fields:

```
-Xlog[:[what][:[output][:[decorators][:output-options[,...]]]]]
```

The legacy flags can only ever produce the first two. Concretely, a service running on the
deprecated path has:

- **no rotation.** `filecount=` and `filesize=` are output-options. The unified-logging
  default is *"Files are rotated by default with up to 5 rotated files of target size 20 MB"*,
  but that default applies to `-Xlog` outputs, not to the legacy translation, which passes no
  output options at all. `UseGCLogFileRotation`, `NumberOfGCLogFiles` and `GCLogFileSize` —
  the flags that used to provide rotation — were removed, so there is no way to ask for it
  from the legacy path.
- **no `%p` in the filename.** Unified logging expands `%p`, `%t` and `%hn` to the PID,
  startup timestamp and hostname. A fixed path means a restarted JVM overwrites or appends to
  the log of the process you are trying to post-mortem.
- **no async.** `-Xlog:async` is a directive on the `-Xlog` option. On the legacy path every
  GC log write is synchronous and inside the safepoint.
- **no decorator control.** You get the defaults — uptime, level, tags — and cannot add
  `time` or `pid`, which are the two you want when correlating a GC log with anything else.

The whole of that is [07c · Rotating and shipping GC logs](07d-rotating-and-shipping-gc-logs.md).
The reason it belongs here too is that the failure is *silent*: the service starts, the log
file exists, someone ticks "GC logging enabled" on a checklist, and the volume fills up
eleven months later.

## Epsilon: the collector that does not collect

Not removed, and not really a collector, but it belongs in any honest enumeration:

```cpp
product(bool, UseEpsilonGC, false, EXPERIMENTAL,
        "Use the Epsilon (no-op) garbage collector")
```

`EXPERIMENTAL` means it requires `-XX:+UnlockExperimentalVMOptions` before
`-XX:+UseEpsilonGC` will be accepted. Epsilon allocates and never reclaims; when the heap is
exhausted the JVM exits. It is a measurement instrument, not a deployment option: it gives
you an application's *total* allocation as a single number, and it makes GC-attributable
latency exactly zero so you can tell whether a latency problem is GC at all. It is also the
cleanest way to establish the allocation floor discussed in
[11 · When tuning is the wrong answer](11-when-tuning-is-the-wrong-answer.md).

## Locked flags, and why the order on the command line matters

`EXPERIMENTAL` and `DIAGNOSTIC` are not documentation labels; they are enforced:

```cpp
bool JVMFlag::is_unlocked() const {
  if (is_diagnostic()) {
    return UnlockDiagnosticVMOptions;
  }
  if (is_experimental()) {
    return UnlockExperimentalVMOptions;
  }
  return true;
}
```

and when a locked flag is used, the error is generated from a template that says something
most people do not expect:

```cpp
jio_snprintf(buf, buflen,
             "Error: VM option '%s' is experimental and must be enabled via -XX:+UnlockExperimentalVMOptions.\n"
             "Error: The unlock option must precede '%s'.\n",
             _name, _name);
```

**"The unlock option must precede"** — flags are processed left to right, so
`-XX:+UseEpsilonGC -XX:+UnlockExperimentalVMOptions` fails while the reverse order works.
This bites hardest when a flag is injected by a wrapper: `JAVA_TOOL_OPTIONS`,
`JDK_JAVA_OPTIONS` and a Dockerfile `ENTRYPOINT` all contribute arguments in an order that is
not obvious, and the resulting error names a flag that looks perfectly ordered in the file
you are editing.

It matters directly in this topic because several of the G1 flags the tuning guide recommends
by name are `EXPERIMENTAL` or `DIAGNOSTIC` in `g1_globals.hpp` and cannot be set without the
corresponding unlock — see [03b · G1's pause-time control and its knobs](03c-g1-pause-time-and-the-knobs.md).

## How to audit a command line you inherited

Three steps, in this order, and none of them requires guessing.

1. **Start the JVM with the flags and read stderr.** Removed flags fail here with
   `Unrecognized VM option`, and HotSpot's fuzzy matcher often prints
   `Did you mean '...'?` with the modern spelling. Locked flags fail here too, with the
   "must precede" message.
2. **Grep the startup output for `[warning][gc]`.** That is where the deprecated and obsolete
   tiers announce themselves — `is deprecated. Will use ... instead`, and
   `Ignoring option ...; support was removed in ...`.
3. **Diff intent against reality with `-XX:+PrintFlagsFinal`.** A flag that survived all of
   the above may still be having no effect because ergonomics overrode it, or because it
   belongs to a collector you are not running. `-XX:+PrintFlagsFinal` prints the settled
   value and marks its origin. The tuning guide teaches the pattern in the Parallel chapter:
   *"To verify your default values, use the `-XX:+PrintFlagsFinal` option and look for
   `-XX:MaxHeapSize` in the output. For example, on Linux you can run the following:
   `java -XX:+PrintFlagsFinal <GC options> -version | grep MaxHeapSize`"*. The full treatment
   is **13 · JVM flags that matter in 2026** *(not written yet)*.

A fourth step worth adding for GC specifically: **delete every flag you cannot explain, then
measure.** G1's tuning chapter recommends precisely that when migrating: *"Generally, when
moving to G1 from other collectors, start by removing all options that affect garbage
collection, and only set the pause-time goal and overall heap size by using `-Xmx` and
optionally `-Xms`."*

## Gotchas

**★ `-XX:+PrintGCDetails` and `-Xloggc:` still work on JDK 25.**
They are *deprecated*, not removed: still declared in `gc_globals.hpp`, still translated into
`-Xlog:gc*` and `-Xlog:gc:<file>` by `Arguments::handle_deprecated_print_gc_flags()`. A
service using them looks healthy and quietly forfeits log rotation, `%p` filename expansion
and async logging. "PrintGCDetails is gone" is a widely repeated claim that this release does
not support.

**★ The legacy logging path cannot express output options, so it cannot rotate.**
`-Xloggc:` maps only to the `what` and `output` fields of the `-Xlog` grammar. There is no
way to attach `filesize=` or `filecount=` to it, and the flags that used to do that job —
`UseGCLogFileRotation`, `NumberOfGCLogFiles`, `GCLogFileSize` — were removed. An unbounded GC
log on a small volume is the eventual outcome, and the only fix is to stop using the legacy
flag.

**★ A fixed GC log path plus a restart loop destroys the evidence.**
Without `%p` or `%t` in the filename, every restart writes to the same file. A crash-loop is
exactly the situation in which you want the previous process's GC log and exactly the
situation in which the legacy flag has already overwritten it.

**★ `-XX:+UnlockExperimentalVMOptions` must appear *before* the flag it unlocks.**
The error message is generated with the literal line *"Error: The unlock option must precede
'%s'."* Arguments are processed left to right. When flags arrive from several sources —
`JAVA_TOOL_OPTIONS`, `JDK_JAVA_OPTIONS`, the entrypoint, the command — the effective order is
not the order you see in any single file.

**★ Epsilon needs `-XX:+UnlockExperimentalVMOptions` first, and it will exit your JVM.**
It is declared `EXPERIMENTAL` in `gc_globals.hpp`. Without the unlock flag, `-XX:+UseEpsilonGC`
is rejected. With it, the process runs until the heap is exhausted and then terminates — which
is the intended behaviour, and is exactly why it is a measurement tool and not a deployment.

**★ A flag can parse, be accepted, and still have no effect.**
`-XX:SurvivorRatio` under ZGC, `-XX:MaxTenuringThreshold` under a collector that computes its
own threshold, `-XX:ParallelRefProcEnabled` under a collector that always parallelises
reference processing — all accepted, none doing what the operator thinks. The man page notes
the last one: parallel reference processing *"is available only when the throughput or G1
garbage collector is used"*. Only `-XX:+PrintFlagsFinal` plus knowing which collector is
running will tell you.

**★ "Enabled GC logging" on a checklist is not the same as "will have a GC log during the
next incident."**
The legacy path gives you a file that grows without bound and is overwritten on restart. Two
minutes converting it to a modern `-Xlog:gc*:file=/var/log/gc-%p.log::filecount=10,filesize=20M`
is the highest-value change in this entire topic.

## Interview questions

**★ A colleague says the legacy GC logging flags were removed in JDK 9. Are they right?**
Not for the GC ones. `PrintGC`, `PrintGCDetails` and `-Xloggc:` are still declared on JDK 25
and are *deprecated*: `Arguments::handle_deprecated_print_gc_flags()` warns and then
translates them into the equivalent `-Xlog` configuration, so they keep working. What *was*
removed outright is the surrounding machinery — `UseGCLogFileRotation`, `NumberOfGCLogFiles`,
`GCLogFileSize`, `PrintHeapAtGC`, `PrintTenuringDistribution` — and the legacy *runtime*
logging flags, about which the man page says *"These legacy flags are no longer recognized
and will cause an error if used directly"*. The practical damage of the surviving deprecated
path is that it gives you an unrotated, unbounded log file with no PID in its name.

**★ Why is a deprecated flag more dangerous operationally than a removed one?**
Because it works. A removed flag fails the container start, is found by whoever reads the
exit output, and is fixed the same day. A deprecated flag produces one warning line, does
something close enough to what its author intended that nothing looks wrong, and hides a
capability gap — in the GC logging case, the absence of rotation and of a PID in the filename
— that only becomes visible at the worst possible moment, when you go looking for the log of
a process that has already restarted.

**★ Why does `-XX:+UseEpsilonGC -XX:+UnlockExperimentalVMOptions` fail?**
Because arguments are processed left to right and the unlock flag has to be set before the
locked flag is parsed. HotSpot's own error text says so: *"Error: VM option 'UseEpsilonGC' is
experimental and must be enabled via -XX:+UnlockExperimentalVMOptions. Error: The unlock
option must precede 'UseEpsilonGC'."* The practical version of this problem is not a
hand-typed command line but an environment variable — `JAVA_TOOL_OPTIONS` and
`JDK_JAVA_OPTIONS` prepend or append arguments, so the effective ordering can differ from
what any single file shows.

**★ What is Epsilon for, given that it never reclaims anything?**
Measurement. Two uses in particular. First, it turns total allocation into a directly
observable quantity: run a workload with a fixed heap and Epsilon and you learn how much the
workload allocates before the JVM exits, which is the input to every allocation-rate argument
in this topic. Second, it removes GC as a variable entirely — if a latency profile is
unchanged under Epsilon, garbage collection was not the cause, and you have saved yourself a
week of collector tuning. It is experimental, requires
`-XX:+UnlockExperimentalVMOptions`, and terminates the JVM when the heap fills, all of which
are appropriate for a measurement instrument and disqualifying for production.

**★ How would you audit an inherited JVM command line for dead garbage collection flags?**
Run it against the target JDK first, because that is the only authority. Removed flags
announce themselves on stderr with `Unrecognized VM option` and often a
`Did you mean '...'?` suggestion; locked flags fail with *"The unlock option must precede"*.
Then grep the startup output for `[warning][gc]`, which is where the deprecated and obsolete
tiers print — the two message shapes are
`... is deprecated. Will use -Xlog:... instead.` and
`Ignoring option ...; support was removed in ...`. Finally, run with
`-XX:+PrintFlagsFinal` and compare the settled values against what the command line asked
for, because a flag can be perfectly valid and still be overridden by ergonomics or ignored
by the collector you are actually running. Then do what the G1 tuning chapter recommends for
migration — *"start by removing all options that affect garbage collection"* — and add back
only what a measurement justifies.

{/* FOOTER */}
