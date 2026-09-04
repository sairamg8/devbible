---
title: "You do not lose JFR in a native image — you lose the ability to turn it on later, because every monitoring feature is a build-time decision, and what you actually lose is JVMTI, the attach mechanism and the Java-level events that were implemented by bytecode instrumentation"
sidebar_label: "07b · No JIT, no JFR, no jstack"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "JDK Flight Recorder (JFR) with Native Image"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/debugging-and-diagnostics/JFR/)),
> "Java Diagnostic Command (jcmd) with Native Image"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/debugging-and-diagnostics/jcmd/)),
> "Debugging and Diagnostics"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/debugging-and-diagnostics/)),
> "Native Image Compatibility Guide"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/metadata/Compatibility/)) and "Build Options"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildOptions/));
> the `--enable-monitoring` value list cross-checked against `VMInspectionOptions.java` on the `release/graal-vm/25.3` branch of `oracle/graal`.
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.0 / Spring Framework 7.0.8**.
> Documentation-validated; **no sandbox run** — the option and event lists below are transcribed from documentation and source, not from a running binary.

**"You lose your observability" is the summary everyone repeats and it is wrong in an expensive way. JFR works. `jcmd` works. Heap dumps work. Thread dumps work. Native memory tracking works. What is true is that every one of them must be compiled in at build time, that a handful of JFR event families genuinely do not exist, and that the entire JVMTI-and-attach family — `-javaagent`, APM agents, `jstack` on a process you did not prepare — is gone permanently. The practical consequence is that observability becomes a build decision, and a binary shipped without it cannot be given it in an incident.**

## First: there is no JIT, and what that costs you diagnostically

The compiler ran at build time. At run time there is no tiered compilation, no profile collection, no de-optimisation, and no code cache that grows. So:

- **`-XX:+PrintCompilation`, `-XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining`, `jitwatch` and every "why did this not inline" workflow have no subject.** The answer is in the build, not the process.
- **You cannot warm anything up.** There is no state that improves with load, which is the good half of *"Delivers peak performance immediately, with no warmup"* ([01](01-what-problem-it-solves.md)) and the reason a benchmark harness's warm-up phase is meaningless here.
- **A performance regression is a *build* regression.** It came from a dependency change, an option change, a compiler version change or a profile change — never from the JVM having made a different decision at run time. That is genuinely easier to reason about, and [07c](07c-getting-throughput-back.md) is where the levers are.

⚠️ **The one exception, and it is why some GC events are conditional:** Truffle-based languages can do runtime compilation inside a native image. If you are not embedding a Truffle language, no code is compiled at run time in your process.

## What is gone, permanently

The Compatibility guide is the authority, and the reason is structural:

> *"Java has some optional specifications that a Java implementation can use for debugging and monitoring Java programs, including JVMTI. They help you monitor the Java VM at runtime for events such as compilation, for example, which do not occur in most native images. These interfaces are built on the assumption that Java bytecode is available at run time, which is not the case for native images built with the closed-world optimization."*

> *"Because the `native-image` builder generates a native executable, users must use native debuggers and monitoring tools (such as GDB or VTune) rather than tools targeted for Java. JVMTI and other bytecode-based tools are not supported with Native Image."*

So the following do not work and cannot be made to:

| Gone | Why |
|---|---|
| `-javaagent:` and every agent that instruments bytecode | no bytecode at run time |
| APM agents that attach via JVMTI | JVMTI unsupported |
| JaCoCo-style coverage inside the binary | bytecode instrumentation |
| The **attach** mechanism as HotSpot implements it | there is no HotSpot attach listener; `jcmd` support is a compiled-in feature instead |
| `jstat`, `jinfo`, `jmap` as HotSpot tools | same |
| The tracing agent from [03c](03c-the-tracing-agent.md) | it is a JVMTI agent — it runs on a JVM, never on the native binary |

🔴 **The last row surprises people.** The tracing agent is a build-time tool that observes a *JVM* run. The native equivalent is `-H:+MetadataTracingSupport` plus `-XX:TraceMetadata`, which is a different mechanism ([03c](03c-the-tracing-agent.md)).

## The switch that decides everything: `--enable-monitoring`

Every diagnostic capability below is off unless you compile it in. The Build Options page lists the values:

> *"enable monitoring features that allow the VM to be inspected at run time. Comma-separated list can contain 'heapdump', 'jfr', 'jvmstat', 'jmxserver' (experimental), 'jmxclient' (experimental), 'threaddump', 'nmt' (experimental), 'jcmd' (experimental), or 'all' (deprecated behavior: defaults to 'all' if no argument is provided)"*

```bash
native-image --enable-monitoring=heapdump,jfr,jcmd,jvmstat,threaddump,nmt -jar app.jar
```

or through the plugin:

```xml
<buildArgs>
  <buildArg>--enable-monitoring=heapdump,jfr,jcmd,jvmstat,threaddump,nmt</buildArg>
</buildArgs>
```

Three things to know about it:

- 🔴 **`--enable-monitoring` with no argument is deprecated.** The source's own warning text says an argument-less use is deprecated and asks you to *"always explicitly specify the list of monitoring features to be enabled"*. List them.
- ⚠️ **`jvmstat`, `jmxclient`, `jmxserver` and `jcmd` are not supported on Windows** and are ignored there with a warning; the `jcmd` page states plainly *"Currently, this feature is not available on Windows."*
- 🔴 **This is a decision with a security dimension.** A binary with `heapdump` and `jcmd` compiled in can be asked for its own memory by anyone who can execute it ([04b](04b-the-secret-baked-into-the-image.md)). Make the choice deliberately and write it down; do not inherit it from a tutorial.

**The decision that matters most:** you cannot add any of this to a running process. A production incident on a binary built without `--enable-monitoring` is diagnosed with logs and metrics only, and the remedy is a rebuild and a redeploy. **That is the argument for shipping monitoring enabled in production**, and it is a strong one.

## JFR: what is actually true

The headline, from the JFR page:

> *"GraalVM Native Image supports building a native executable with JFR events, and users can use `jdk.jfr.Event` API with a similar experience to using JFR in the Java HotSpot VM."*

> *"JFR support is disabled by default and must be explicitly enabled at build time."*

```bash
native-image --enable-monitoring=jfr JavaApplication
./javaapplication -XX:StartFlightRecording="filename=recording.jfr,dumponexit=true,duration=10s"
```

The `-XX:StartFlightRecording` key-value pairs are the familiar ones — `name`, `settings`, `delay`, `duration`, `filename`, `maxage`, `maxsize`, `dumponexit` — and `-XX:FlightRecorderOptions` is available for fine-tuning. Logging is configured with a **different flag from HotSpot's**:

```bash
./javaapplication -XX:FlightRecorderLogging=jfr+system=debug
```

with tags `all, jfr, system, event, setting, bytecode, parser, metadata, dcmd`, levels `trace, debug, info, warning, error, off`, and documented defaults: unset means `WARNING`, empty string means `INFO`, `disable` turns it off entirely.

### ✅ What works

- **Your own `jdk.jfr.Event` subclasses**, with a *"similar experience"* to HotSpot.
- **Method profiling with two samplers.** *"The asynchronous sampler is enabled by default, while the safepoint sampler is used only on demand."* And the reason it matters: *"Asynchronous sampling offers the advantage of avoiding safepoint bias, which happens if a profiler does not sample all points in the application with equal probability."* 🔴 **That is the safepoint-bias argument topic 06 makes for async-profiler — and here the async sampler is the default.**
- **Stack traces on recorded events.** *"other JFR events that support stacktraces on HotSpot also support stacktraces in Native Image"*, so allocation flame graphs from `jdk.ObjectAllocationInNewTLAB` work.
- **Event streaming** (JEP 349) — *"JFR Event Streaming is available with Native Image."*
- **`jcmd` control** — `JFR.start`, `JFR.stop`, `JFR.check`, `JFR.dump`, when `jcmd` was also compiled in.
- **Remote JMX to `FlightRecorderMXBean`** — start, stop and dump from JMC or VisualVM. ⚠️ *"Remote JMX connection support needs to be enabled separately at build time and is experimental."*
- **A substantial built-in event list**, including `jdk.ExecutionSample`, `jdk.GarbageCollection` and the GC-phase events, `jdk.ObjectAllocationSample`, `jdk.ObjectAllocationInNewTLAB`, `jdk.JavaMonitorEnter`/`Wait`/`Inflate`, `jdk.ThreadPark`, `jdk.ThreadSleep`, `jdk.ThreadCPULoad`, `jdk.SocketRead`/`SocketWrite`, `jdk.SafepointBegin`/`End`, `jdk.VirtualThreadStart`/`End`/`Pinned`, the `jdk.Container*` family, and the NMT events.

### ❌ What does not, precisely

- **Java-level events implemented by bytecode instrumentation.** The reference: *"Many of the VM-level built-in events are available in Native Image. Java-level events implemented by bytecode instrumentation on the HotSpot JVM are not yet available in Native Image. Such events include file I/O and exception built-in events."*
  🔴 **That is the concrete loss and it is a real one.** `jdk.FileRead`, `jdk.FileWrite` and the `jdk.JavaExceptionThrow`/`jdk.JavaErrorThrow` events are exactly what you want when diagnosing "something is throwing a lot" or "who is hammering the disk", and they are not there.
- **Stack traces on *streamed* events.** *"Currently, stacktraces are not yet available on streamed events. This means you cannot access the stacktrace of an event inside its callback method. However, this limitation does not affect stacktraces in the JFR snapshot file (`.jfr`), those will still work as usual."*
- **Leak profiling is partial.** *"Leak profiling implemented using the `jdk.OldObjectSample` event is partially available. Specifically, old object tracking is possible, but the path to the GC root information is unavailable."* ⚠️ **Path-to-GC-root is the entire point of `OldObjectSample` for leak hunting**; without it you know *what* is old, not *why* it is retained. A heap dump ([07d](07d-the-diagnostic-toolbox.md)) is the answer instead.
- **Windows**: *"On Windows, Native Image supports local JFR recordings written to `.jfr` files. Remote JMX access to `FlightRecorderMXBean` and JFR control through `jcmd` are not currently available on Windows."* The signal-handler-based sampler is POSIX-only, so Windows uses the recurring-callback sampler.
- **Several event families are conditional on the collector or on NMT.** The reference footnotes mark the GC and allocation events *"Available if Serial GC is used"*, `jdk.OldObjectSample` *"Partially available if Serial GC is used"*, and the `jdk.NativeMemoryUsage*` events *"Available if Native Memory Tracking is used"*.

🔴 **Write "JFR is partial" and then say which part.** *"You lose JFR"* is false and will lose you an argument with someone who has read the page.

## `jcmd`

> *"Native Image now supports the Java Diagnostic Command (`jcmd`), enabling users to interact with native executables using the same `jcmd` tool they use for Java applications. This support complements existing Native Image monitoring features, including JDK Flight Recorder, heap dumps, and native memory tracking."*

```bash
native-image --enable-monitoring=jcmd,jfr,heapdump,nmt,jvmstat YourApplication
jcmd <pid> help
```

The supported commands, and which build flag each needs:

| Command | Needs `--enable-monitoring=` |
|---|---|
| `GC.run`, `Thread.print`, `Thread.dump_to_file`, `VM.command_line`, `VM.system_properties`, `VM.uptime`, `VM.version`, `help` | always available |
| `GC.heap_dump` | `heapdump` |
| `JFR.start`, `JFR.stop`, `JFR.check`, `JFR.dump` | `jfr` |
| `VM.native_memory` | `nmt` |
| `Compiler.dump_code_cache` | only with Truffle runtime compilation |

🔴 **`Thread.print` and `Thread.dump_to_file` are "always available"** once `jcmd` support is compiled in — which means the thread-dump workflow from topic 05 ([`05-thread-dumps/README.md`](../05-thread-dumps/README.md)) survives, including the virtual-thread dump. That is the single most reassuring fact in this topic for anyone who debugs stuck services for a living.

Add `jvmstat` if you want discovery: *"You might find it useful to also enable the `jvmstat` monitoring feature so your native executable can be discovered and listed with `jcmd -l` or `jcmd` with no arguments provided."*

On cost: *"Adding `jcmd` support to Native Image has minimal impact on performance when the application is idle. However, the performance impact varies significantly depending on the diagnostic commands used and how frequently they are invoked."* And a genuinely useful habit: *"You can use `jcmd <pid> help <command>` to print the help information for a specific command which also lists its expected performance impact."*

## Gotchas

**★ Symptom: a production incident, and the binary answers nothing.** Cause: it was built without `--enable-monitoring`, and there is no attach mechanism to add it. Fix: there is no fix during the incident — the remedy is a rebuild. Decide *now* which features ship in production and record the decision; the default of "none" is a decision too, and a bad one for anything you have to operate.

**★ Symptom: `--enable-monitoring` with no argument produces a deprecation warning.** Cause: the argument-less form defaults to `all` and is deprecated; the builder asks you to list features explicitly. Fix: name them — `--enable-monitoring=heapdump,jfr,jcmd,nmt,threaddump`. It also forces the security conversation, which is the point.

**★ Symptom: `jcmd` cannot see the native process at all.** Cause: `jvmstat` was not enabled, so the process is not discoverable by `jcmd -l`. Fix: add `jvmstat` to the monitoring list — and remember it is unsupported on Windows, along with `jcmd` itself.

**★ Symptom: `jdk.FileRead` and exception events are missing from a recording.** Cause: *"Java-level events implemented by bytecode instrumentation on the HotSpot JVM are not yet available in Native Image."* Fix: instrument what you need with your own `jdk.jfr.Event` subclasses, which are fully supported, or fall back to application-level metrics ([`08-metrics-with-micrometer/README.md`](../08-metrics-with-micrometer/README.md)) for the same signal.

**★ Symptom: `jdk.OldObjectSample` shows old objects but no retention path.** Cause: leak profiling is *"partially available … the path to the GC root information is unavailable."* Fix: use a heap dump and a dominator tree instead — the workflow topic 04 teaches ([`04-out-of-memory-error/README.md`](../04-out-of-memory-error/README.md)) — which needs `--enable-monitoring=heapdump` at build time.

**★ Symptom: an event stream callback cannot read the event's stack trace.** Cause: *"stacktraces are not yet available on streamed events."* Fix: use streaming for counting and thresholding, and take a `.jfr` snapshot when you need stacks — the snapshot file's stack traces *"will still work as usual."*

**★ Symptom: `-Xlog:jfr*` does nothing.** Cause: unified logging is HotSpot's. Fix: `-XX:FlightRecorderLogging=jfr+system=debug`, with the tag and level vocabulary from the JFR page. It is a different flag with a different syntax and no amount of HotSpot habit will find it.

**★ Symptom: an APM vendor's Java agent produces no data.** Cause: JVMTI and bytecode instrumentation are unsupported. Fix: use the vendor's OpenTelemetry SDK integration rather than the agent — instrumentation that is compiled in as library code works, instrumentation that is injected at run time does not. Topic 09 owns the tracing wiring ([`09-distributed-tracing/README.md`](../09-distributed-tracing/README.md)).

**★ Symptom: the safepoint-bias argument from topic 06 is repeated as a reason to distrust native-image profiles.** Cause: assuming the JFR sampler here is the HotSpot safepoint sampler. Fix: it is not — *"The asynchronous sampler is enabled by default, while the safepoint sampler is used only on demand."* Native Image's default profiling posture is the unbiased one.

**★ Symptom: JFR works on Linux and half of it disappears on Windows.** Cause: the documented Windows carve-outs — local `.jfr` recordings only; no remote JMX to `FlightRecorderMXBean`; no JFR control through `jcmd`; no signal-handler sampler. Fix: plan the diagnostic story per platform, and do not assume a Linux-verified runbook transfers.

## Interview questions

**★ "You lose JFR in a native image." Correct the statement.**
JFR is supported, with the `jdk.jfr.Event` API giving *"a similar experience"* to HotSpot, provided the binary was built with `--enable-monitoring=jfr`. What is genuinely unavailable is the family of Java-level events implemented by bytecode instrumentation on HotSpot — the reference names file I/O and exception events — plus stack traces on streamed events, and the path-to-GC-root part of `jdk.OldObjectSample` leak profiling. Several GC and allocation events are conditional on Serial GC, and Windows lacks remote JMX and `jcmd` control. The bigger operational fact is not any of those: it is that JFR must be compiled in, so a binary shipped without it cannot be given it during an incident.

**★ Why is the observability decision a build decision rather than an operational one?**
Because there is no attach mechanism. HotSpot lets you enable NMT, start a recording or take a heap dump on a process that was started without any of them, because the machinery is always present and the attach listener can turn it on. In a native image each capability is code that is either linked into the binary or absent, selected by `--enable-monitoring` at build time. That makes "which diagnostics ship in production" an architecture decision with a security trade-off — a binary with `heapdump` and `jcmd` is more debuggable and more exposed — and one that has to be made before the incident rather than during it.

**★ What survives from the thread-dump workflow?**
More than you would guess. With `--enable-monitoring=jcmd`, both `Thread.print` and `Thread.dump_to_file` are listed as *"Always available"*, so the topic-05 workflow — print all threads with stack traces, or dump to plain text or JSON including virtual threads — works against a native executable using the same `jcmd` binary. Alternatively `--enable-monitoring=threaddump` enables the signal path, dumping all thread stack traces on `SIGQUIT`. What is gone is `jstack` as a HotSpot attach tool; the capability is compiled in rather than attached.

**★ What replaces a `-javaagent`-based APM agent?**
Library-level instrumentation compiled into the binary. JVMTI and bytecode-based tools are explicitly unsupported, so anything that rewrites classes at run time cannot work. The practical substitutes are Micrometer for metrics, the OpenTelemetry SDK wired as ordinary beans for traces, and JFR with your own `jdk.jfr.Event` subclasses for anything the built-in events do not cover. The distinction to hold onto is instrumentation-as-code versus instrumentation-as-injection: the first survives the closed world, the second cannot.

**★ Why is there no `-XX:+PrintCompilation`, and what replaces the question it answered?**
There is no JIT, so there is no compilation at run time to print. The question — "why is this method slow, was it inlined, did it de-optimise" — moves entirely to build time, where the levers are the optimisation level, profile-guided optimisation, and `-march` ([07c](07c-getting-throughput-back.md)). A useful corollary for incident response: a native image cannot suddenly get slower because the JIT made a different choice, so a throughput regression is always attributable to a change in the build inputs, which is a much smaller search space.

**★ Which JFR events are conditional, and on what?**
Three groups, per the reference's footnotes. The GC and allocation family — `jdk.GarbageCollection`, the `jdk.GCPhasePause*` levels, `jdk.GCHeapSummary`, `jdk.AllocationRequiringGC`, `jdk.ObjectAllocationSample`, `jdk.ObjectAllocationInNewTLAB`, `jdk.SystemGC` — is *"Available if Serial GC is used"*. `jdk.OldObjectSample` is *"Partially available if Serial GC is used"*. The `jdk.NativeMemoryUsage*` events require native memory tracking, which is its own `--enable-monitoring=nmt` flag. So your event coverage depends on two earlier build decisions, the collector and the monitoring list, which is worth checking before promising a team a particular dashboard.

{/* FOOTER */}
