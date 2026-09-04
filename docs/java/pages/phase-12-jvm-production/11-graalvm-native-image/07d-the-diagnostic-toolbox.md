---
title: "A native image can produce a heap dump five different ways, a thread dump on SIGQUIT and a native-memory report on shutdown — but every one of those is a build-time switch you either compiled in or did not, so the real content of this page is the list of monitoring features you decide to ship in production"
sidebar_label: "07d · The diagnostic toolbox"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Create a Heap Dump from a Native Executable"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/guides/create-heap-dump-from-native-executable/)),
> "Native Memory Tracking (NMT) with Native Image"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/debugging-and-diagnostics/NMT/)),
> "Java Diagnostic Command (jcmd) with Native Image"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/debugging-and-diagnostics/jcmd/)) and
> "Debugging and Diagnostics"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/debugging-and-diagnostics/));
> option semantics, the deprecation and the two error strings cross-checked against
> [`VMInspectionOptions.java`](https://github.com/oracle/graal/blob/release/graal-vm/25.3/substratevm/src/com.oracle.svm.core/src/com/oracle/svm/core/VMInspectionOptions.java)
> on the **`release/graal-vm/25.3`** branch of `oracle/graal`.
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.1 / Spring Framework 7.0.9**.
> Documentation-validated; **no sandbox run** — no dump was taken, no signal was sent and no report was read.
> The two quoted error strings are transcribed from the linked source file, not from a terminal.

**[07b](07b-no-jit-no-jfr-no-jstack.md) argued that observability in a native image is a build decision. This page is what that decision actually buys, item by item: five documented routes to a heap dump, a thread dump on a signal, and native memory tracking that is deliberately a shadow of HotSpot's. Read it as a procurement list rather than a runbook — because the runbook is worthless if the binary in production was compiled without the feature the runbook needs, and there is no attach mechanism to add it during the incident.**

## Heap dumps: five routes, one prerequisite

The prerequisite is a single build flag, and without it every route below fails identically:

> *"To enable heap dump support, a native executable must be built with the `--enable-monitoring=heapdump` option."*

The failure is not silent. `VMInspectionOptions.java` carries the message the runtime prints:

> `Unable to dump heap. Heap dumping is only supported for native binaries built with '--enable-monitoring=heapdump'.`

The five routes, in the reference's own order:

> 1. *"Create a heap dump from a running process with VisualVM (Linux/macOS only)."*
> 2. *"The command-line option `-XX:+HeapDumpOnOutOfMemoryError` can be used to create a heap dump when the native executable runs out of Java heap memory."*
> 3. *"Dump the initial heap of a native executable using the `-XX:+DumpHeapAndExit` command-line option."*
> 4. *"Create a heap dump by sending a `SIGUSR1` signal to the application at runtime (Linux/macOS only)."*
> 5. *"Create a heap dump programmatically using the `org.graalvm.nativeimage.VMRuntime#dumpHeap` API."*

Plus a sixth that lives on the `jcmd` page rather than this one: `jcmd <pid> GC.heap_dump`, which needs both `heapdump` and `jcmd` in the monitoring list ([07b](07b-no-jit-no-jfr-no-jstack.md)).

And the option that applies to all of them:

> *"By default, a heap dump is created in the current working directory. The `-XX:HeapDumpPath` option can be used to specify an alternative filename or directory."*

```bash
./billing-service -XX:HeapDumpPath=/var/dumps/billing.hprof
```

🔴 **In a container, the current working directory is usually not a volume.** A dump written there dies with the container that produced it — which is precisely the container that just crashed. Set `-XX:HeapDumpPath` to a mounted path at deploy time, exactly as you would for a JVM ([04 · `OutOfMemoryError`](../04-out-of-memory-error/README.md)).

### Route 2 — on `OutOfMemoryError`, and the filename you will grep for

> *"Start the application with the option `-XX:+HeapDumpOnOutOfMemoryError` to get a heap dump when the native executable throws an `OutOfMemoryError` because it ran out of Java heap memory. The heap dump is created in a file named `svm-heapdump-<PID>-OOME.hprof`."*

**`svm-heapdump-<PID>-OOME.hprof` is worth memorising**, because it is not the HotSpot naming and a log-scraping rule written for `java_pid<PID>.hprof` will never match it.

⚠️ **Note the qualifier — *"because it ran out of Java heap memory."*** This is the same restriction phase 12 records for HotSpot: the flag fires for heap exhaustion, not for every `OutOfMemoryError`. A native image has fewer non-heap exhaustion modes than a JVM (no metaspace, no compressed class space), but direct buffers and native threads are still outside the heap and outside this flag's reach.

### Route 3 — 🔴 `-XX:+DumpHeapAndExit` dumps the image heap, which is a *build* artefact

This is the route with no HotSpot analogue and the one most worth knowing:

> *"Use the `-XX:+DumpHeapAndExit` command-line option to dump the initial heap of a native executable. This can be useful to identify which objects the Native Image build process allocated to the executable's heap."*

The **initial heap** is the image heap — the object graph the builder serialised into the binary because those objects existed at the end of build-time class initialisation ([04](04-build-time-vs-run-time-initialisation.md)). So this option answers, on any machine, with no debugger and no source access:

- **What did build-time initialisation actually put in my binary?**
- 🔴 **Is a credential in there?** [04b](04b-the-secret-baked-into-the-image.md) is the chunk that argues this is a security failure mode rather than a curiosity, and `-XX:+DumpHeapAndExit` is the tool that turns the argument into evidence. It is also the reason the `heapdump` feature is not a free thing to ship: anyone who can execute your binary can ask it for its own image heap.

```bash
# audit the image heap of a release candidate, then open the .hprof in your usual analyser
./billing-service -XX:+DumpHeapAndExit -XX:HeapDumpPath=/tmp/image-heap.hprof
```

The default destination is derived from the image name — the guide's HelloWorld example produces `helloworld.hprof` — which matches `VMInspectionOptions.determineHeapDumpPath()` building the path from the image `Name` option plus `.hprof`.

### Route 4 — `SIGUSR1`, and the one build shape where it disappears

> *"Create a heap dump by sending a `SIGUSR1` signal to the application at runtime (Linux/macOS only)."*

> *"Note: This requires the `Signal` API, which is enabled by default except when building shared libraries."*

> *"The `SIGUSR1` heap dump trigger is not available on Microsoft Windows."*

```bash
kill -SIGUSR1 "$(pidof billing-service)"
```

The dump lands in the working directory (or `-XX:HeapDumpPath`) **while the process keeps running** — the guide is explicit that *"The heap dump will be created in the application's working directory"* while the application continues. That makes it the right route for a leak investigation on a live service, and it is the closest thing a native image has to `jcmd GC.heap_dump` without compiling `jcmd` support in.

⚠️ **`-shared` builds lose it.** If you ship a native shared library rather than an executable, the `Signal` API is off and this route does not exist.

### Route 5 — the programmatic route, for a condition only you can express

```java
import java.io.File;
import java.io.IOException;
import org.graalvm.nativeimage.VMRuntime;

public final class HeapDumpTrigger {

    private HeapDumpTrigger() {
    }

    /** Dump the live heap to a temporary file. Returns the path, or null if unsupported. */
    public static String dumpNow() {
        try {
            File file = File.createTempFile("billing-", ".hprof");
            VMRuntime.dumpHeap(file.getAbsolutePath(), true);
            return file.getAbsolutePath();
        } catch (UnsupportedOperationException notCompiledIn) {
            // thrown when the binary was built without --enable-monitoring=heapdump
            return null;
        } catch (IOException e) {
            return null;
        }
    }
}
```

Two things the reference's own sample teaches by its structure. **`UnsupportedOperationException` is the exception you catch when heap dumping was not compiled in** — the sample catches exactly that and prints the message. And the second argument of `VMRuntime.dumpHeap(String, boolean)` is the live-objects flag; `VMInspectionOptions.dumpImageHeap()` in the source passes `true` for the image-heap dump.

**When is this the right route?** When the trigger is a business condition rather than a signal — a cache exceeding a bound, a session map crossing a threshold, a scheduled audit of the image heap on start-up in a security-sensitive deployment. Wire it behind an admin-only path, never a public endpoint.

### Route 1 — VisualVM, and the flag people forget

> *"VisualVM can open heap dump files created on Windows, but it cannot currently request heap dumps from running Native Image processes on Windows. For this, you need to add `jvmstat` to the `--enable-monitoring` option (for example, `--enable-monitoring=heapdump,jvmstat`). This will allow VisualVM to pick up and list running Native Image processes."*

Same rule as `jcmd -l` in [07b](07b-no-jit-no-jfr-no-jstack.md): **discovery is `jvmstat`, the capability is something else.** A binary with `heapdump` but not `jvmstat` can be dumped by signal and by `jcmd` with an explicit PID, but will not appear in a tool's process list.

## Thread dumps on a signal

`jcmd Thread.print` and `Thread.dump_to_file` are the richer route and [07b](07b-no-jit-no-jfr-no-jstack.md) covers them. The signal route is separate, cheaper, and does not require `jcmd`:

```bash
native-image --enable-monitoring=threaddump -jar billing.jar
```

```bash
kill -SIGQUIT "$(pidof billing-service)"
```

The source's own help text for the feature it replaced states the behaviour exactly:

> *"Dumps all thread stacktraces on SIGQUIT/SIGBREAK."*

⚠️ **`-H:+DumpThreadStacksOnSignal` is deprecated** and the source carries the replacement in its deprecation message: *"Please use `'--enable-monitoring=threaddump'`."* If you find that option in a build file, it is a pre-`--enable-monitoring` artefact.

🔴 **This is the one diagnostic that costs you almost nothing to ship and answers the most common 03:00 question.** "The service is not responding — what are its threads doing?" needs no network port, no discovery, no client tool and no attach: a signal and stdout. Everything in topic 05 about reading a dump ([`05-thread-dumps/README.md`](../05-thread-dumps/README.md)) still applies to the output.

## Native memory tracking, and how much less it is than HotSpot's

NMT exists here, and the framing sentence explains why it matters less than on a JVM:

> *"Unlike the HotSpot JVM, Native Image mostly uses memory on the collected heap managed by its garbage collector. However, there are still many places where native memory is used by Native Image to avoid allocations on the managed heap. Some examples include JFR, the garbage collector, and heap dumping. Native memory can also be directly requested at the application level with `Unsafe#allocateMemory(long)`."*

```bash
native-image --enable-monitoring=nmt,jcmd,jfr -jar billing.jar
```

```bash
./billing-service -XX:+PrintNMTStatistics     # report written when the application completes
jcmd <pid> VM.native_memory                   # on demand, needs jcmd support too
```

🔴 **NMT is not switchable at run time here, and that is the opposite of HotSpot:**

> *"NMT support is disabled by default and must be explicitly enabled at build time. … If NMT is included at build time, it will always be enabled at runtime. This is different than on HotSpot which allows for enabling/disabling NMT at runtime."*

The cost is stated as low: *"On Native Image, both the CPU and memory consumption of NMT are quite minimal. In comparison to other serviceability features such as JFR, NMT has relatively very little overhead."*

### 🔴 The limitations, which are the point

| HotSpot NMT has | Native Image 25.3 |
|---|---|
| `summary` and `detail` modes | **summary only** — *"In Native Image, only NMT summary mode is currently supported."* |
| Callsite tracking | **no** — *"The detailed mode, which enables callsite tracking, is not available."* |
| Baselines and diffs (`VM.native_memory baseline` / `summary.diff`) | **no** — *"Capturing baselines is also not yet possible."* |
| Several tracking categories | **malloc only** — *"Malloc tracking is the only feature currently available (as of GraalVM for JDK 23)."* |

And the coverage boundary, which is identical to HotSpot's and equally misunderstood:

> *"Native Image, same as HotSpot, can only track allocations at the VM-level and those made with `Unsafe#allocateMemory(long)`. For example, if a library code or application code calls malloc directly, that call will bypass the NMT accounting and be untracked."*

**Read the table as: NMT here answers "how much" and cannot answer "who".** Losing baselines is the sharper loss for an operator — the HotSpot workflow of baselining at start-up and diffing an hour later is how you attribute native growth, and it is not available. What replaces it is JFR:

> *"The OpenJDK JFR events `jdk.NativeMemoryUsage` and `jdk.NativeMemoryUsageTotal` are supported in Native Image. There are also two Native Image specific JFR events that you can access: `jdk.NativeMemoryUsagePeak` and `jdk.NativeMemoryUsageTotalPeak`. These Native Image specific events have been created to expose peak usage data otherwise not exposed through the JFR events ported over from the OpenJDK. These new events are marked as experimental."*

⚠️ *"You may need to enable experimental events in software like JDK Mission Control to view them."* — a JMC setting, not a build flag, and the reason a peak-usage event can appear to be missing when it is merely hidden.

**A time series of `jdk.NativeMemoryUsage` over a recording is the closest available substitute for a baseline diff**, and it requires `--enable-monitoring=jfr,nmt` together.

## 🔴 So what do you actually ship?

This is the decision the page exists for. Every row is a build-time commitment you cannot revise during an incident.

| Feature | Ship it in production? | Why |
|---|---|---|
| `threaddump` | **Yes.** | Signal-driven, no port, no client, no discovery. Answers the most common outage question. |
| `heapdump` | **Yes, with a caveat.** | It is the only route to a retention analysis, and JFR's leak profiling is missing path-to-GC-root ([07b](07b-no-jit-no-jfr-no-jstack.md)). 🔴 The caveat is that it lets anyone who can execute the binary read its memory and its image heap — see below. |
| `jfr` | **Yes.** | Always-on-capable, sampled asynchronously by default, and the only structured source of GC, allocation and lock data. |
| `nmt` | **Yes.** | Documented as *"quite minimal"* overhead, and it is the only answer to "the pod is bigger than the heap". |
| `jcmd` | **Usually.** | Gives you `Thread.print`, `GC.heap_dump`, `JFR.*` and `VM.native_memory` through one familiar tool. ⚠️ Not supported on Windows. |
| `jvmstat` | **Only if a tool needs to discover the process.** | Pure discovery. Adds a memory-mapped file. ⚠️ Not supported on Windows. |
| `jmxserver` / `jmxclient` | **No, by default.** | Both are marked **experimental** in the option's own allowed-values text, and a remote management port is a much larger surface than a signal handler. |

```xml
<buildArgs>
  <buildArg>--enable-monitoring=heapdump,jfr,jcmd,nmt,threaddump</buildArg>
</buildArgs>
```

⚠️ **The security half of the trade is real and belongs in the same commit as the flag.** A binary that will dump its heap on `SIGUSR1`, or its image heap on `-XX:+DumpHeapAndExit`, hands its memory to any process that can signal or execute it. The mitigations are the ordinary ones — do not run as root, do not share a process namespace, restrict who can `exec` into the container, and keep secrets out of the image heap in the first place ([04b](04b-the-secret-baked-into-the-image.md)). **Shipping nothing is not the safe option; it is the option where the incident has no evidence.**

⚠️ **List the features explicitly, and expect an abort if you typo one.** The validator in `VMInspectionOptions.java` raises a user error for unrecognised values — *"The `'--enable-monitoring='` option contains invalid value(s)"* — and warns rather than aborting for values that are merely unsupported on Windows.

## Gotchas

**★ Symptom: `Unable to dump heap. Heap dumping is only supported for native binaries built with '--enable-monitoring=heapdump'.`** Cause: exactly what it says — the capability was not compiled in. Fix: rebuild with `heapdump` in the monitoring list. There is no run-time remedy, which is the entire argument for deciding the list before you ship ([07b](07b-no-jit-no-jfr-no-jstack.md)).

**★ Symptom: an OOM kill produced no `.hprof` even though `-XX:+HeapDumpOnOutOfMemoryError` was set.** Cause: two candidates. Either the process was killed by the kernel or the orchestrator rather than throwing `OutOfMemoryError` — a cgroup OOM kill never reaches Java code — or the dump went to the container's working directory and vanished with the container. Fix: distinguish the two by checking whether the container's exit reason was `OOMKilled` ([03 · Heap sizing in containers](../03-heap-sizing-in-containers/README.md)), and in either case set `-XX:HeapDumpPath` to a mounted volume.

**★ Symptom: a monitoring script never finds the dump file.** Cause: the name is `svm-heapdump-<PID>-OOME.hprof`, not HotSpot's `java_pid<PID>.hprof`. Fix: match the SVM pattern, or remove the ambiguity by setting `-XX:HeapDumpPath` to a fixed filename you control.

**★ Symptom: `kill -SIGUSR1` does nothing.** Cause: three documented possibilities — the binary was built without `heapdump`; you are on Windows, where *"The `SIGUSR1` heap dump trigger is not available"*; or the artefact is a shared library, since the `Signal` API is *"enabled by default except when building shared libraries."* Fix: for an executable on Linux or macOS, add `heapdump` to the monitoring list; for a shared library, use the `VMRuntime.dumpHeap` API instead, which does not depend on signals.

**★ Symptom: `VMRuntime.dumpHeap` throws `UnsupportedOperationException`.** Cause: the same missing build flag, surfaced as an exception rather than a message because you called the API. Fix: catch it deliberately and degrade — the reference's own sample does exactly this — and rebuild with `--enable-monitoring=heapdump`:

```java
try {
    VMRuntime.dumpHeap(path, true);
} catch (UnsupportedOperationException notCompiledIn) {
    log.warn("Heap dump requested but this binary was built without --enable-monitoring=heapdump");
}
```

**★ Symptom: a security review asks what is inside the shipped binary and nobody can answer.** Cause: the image heap is invisible from the outside and nobody knew there was a tool. Fix: `-XX:+DumpHeapAndExit` on the release candidate, then open the `.hprof` in the analyser you already use for JVM dumps. This is a repeatable release-gate check, not a one-off ([04b](04b-the-secret-baked-into-the-image.md)).

**★ Symptom: VisualVM or `jcmd -l` does not list the native process.** Cause: `jvmstat` was not in the monitoring list; discovery is a separate feature from every capability it discovers. Fix: add `jvmstat` — and note it is one of the four values unsupported on Windows, along with `jcmd`, `jmxserver` and `jmxclient`.

**★ Symptom: `-H:+DumpThreadStacksOnSignal` produces a deprecation warning.** Cause: it was replaced by the monitoring list. Fix: `--enable-monitoring=threaddump`, which is what the deprecation message itself tells you to use.

**★ Symptom: `jcmd <pid> VM.native_memory baseline` is rejected or produces nothing useful.** Cause: *"Capturing baselines is also not yet possible."* Fix: there is no equivalent command. Take repeated `VM.native_memory` summaries and diff them yourself, or record `jdk.NativeMemoryUsage` and `jdk.NativeMemoryUsageTotal` over a JFR recording, which needs `--enable-monitoring=jfr,nmt` at build time.

**★ Symptom: NMT accounts for far less memory than the process is using.** Cause: the documented coverage boundary — NMT tracks *"allocations at the VM-level and those made with `Unsafe#allocateMemory(long)`"*, and *"if a library code or application code calls malloc directly, that call will bypass the NMT accounting and be untracked."* A JNI library or an FFM downcall allocating with `malloc` is invisible. Fix: treat NMT's total as a floor, not the process footprint, and reach for OS-level accounting (RSS, `pmap`, `perf`) for the remainder ([07e](07e-debuggers-and-profilers.md)).

**★ Symptom: `-XX:NativeMemoryTracking=summary` is rejected.** Cause: that is HotSpot's spelling and there is no run-time NMT switch here — it is `--enable-monitoring=nmt` at build time, and *"If NMT is included at build time, it will always be enabled at runtime."* Fix: move the decision into the build; at run time the only related option is `-XX:+PrintNMTStatistics`, which controls reporting, not tracking.

**★ Symptom: `jdk.NativeMemoryUsagePeak` is absent from a JMC view.** Cause: the two peak events are Native-Image-specific and *"marked as experimental"*; *"You may need to enable experimental events in software like JDK Mission Control to view them."* Fix: enable experimental events in the viewer. The recording is fine; the display is filtering them.

**★ Symptom: the monitoring list contains a typo and the build fails with an unhelpful-looking error.** Cause: the validator aborts on unrecognised values — *"The `'--enable-monitoring='` option contains invalid value(s)"* — while merely warning for values ignored on Windows. Fix: the accepted set is `heapdump`, `jfr`, `jvmstat`, `jmxserver` (experimental), `jmxclient` (experimental), `threaddump`, `nmt`, `jcmd`, `all`. Note that a Windows build silently drops four of them with a warning, so a Windows CI job can produce a binary with less monitoring than the flags claim.

**★ Symptom: a team decides to ship no monitoring at all "for security".** Cause: treating the diagnostic surface as pure risk. Fix: price both sides. The risk is that someone who can already execute your binary or signal your process can read its memory. The cost of the alternative is an outage diagnosed with logs only and a rebuild-and-redeploy as the first debugging step. `threaddump` in particular adds a signal handler and answers the most common question there is; excluding it is very hard to justify.

## Interview questions

**★ Name the ways a native image can produce a heap dump, and the one prerequisite they share.**
Six, five of them on the heap-dump guide and one on the `jcmd` page. VisualVM against a running process on Linux or macOS; `-XX:+HeapDumpOnOutOfMemoryError` when the Java heap is exhausted; `-XX:+DumpHeapAndExit` for the initial image heap; `SIGUSR1` on Linux or macOS; the `VMRuntime.dumpHeap` API from inside the application; and `jcmd <pid> GC.heap_dump`. All of them require `--enable-monitoring=heapdump` at build time, and the last additionally requires `jcmd`. `-XX:HeapDumpPath` redirects the output for all of them, and the OOM route has its own filename, `svm-heapdump-<PID>-OOME.hprof`.

**★ What does `-XX:+DumpHeapAndExit` show you that no HotSpot tool can?**
The image heap — the object graph the builder serialised into the binary at the end of build-time class initialisation. The reference describes it as being able to *"identify which objects the Native Image build process allocated to the executable's heap."* There is no HotSpot equivalent because a JVM builds its heap at run time. Operationally it is two things: an explanation of binary size and start-up state, and a security audit tool, because anything a static initialiser held when the build finished is now a constant inside a file you distribute. It is the mechanism that turns "could a secret be baked in?" from a worry into a check you can run on a release candidate.

**★ How is native memory tracking here different from HotSpot's, and what breaks as a result?**
Four differences. It is build-time only — `--enable-monitoring=nmt` — and *"If NMT is included at build time, it will always be enabled at runtime"*, whereas HotSpot lets you toggle it. Only summary mode exists, so there is no callsite attribution. Baselines are not implemented, which kills the standard HotSpot workflow of baselining and diffing to attribute growth. And malloc tracking is the only category available as of GraalVM for JDK 23. What breaks is attribution: you can see how much off-heap memory is in use and in which categories, but not who allocated it or how it changed since start-up. The partial substitute is JFR — `jdk.NativeMemoryUsage`, `jdk.NativeMemoryUsageTotal`, and the experimental Native-Image-specific `jdk.NativeMemoryUsagePeak` and `jdk.NativeMemoryUsageTotalPeak` — which gives you a time series in place of a diff.

**★ Why does NMT under-report, on both HotSpot and Native Image?**
Because it instruments the VM's own allocation paths and `Unsafe#allocateMemory(long)`, and nothing else. The reference states it directly: *"if a library code or application code calls malloc directly, that call will bypass the NMT accounting and be untracked."* So a JNI library, an FFM downcall or any native dependency that allocates on its own is invisible to NMT while being entirely visible to the kernel's RSS accounting. The practical consequence is that NMT's total is a lower bound on non-heap usage; when RSS exceeds heap plus NMT by a lot, the remainder is by definition somewhere NMT cannot see, and the next tool is an OS-level one.

**★ Which monitoring features would you ship in a production binary, and how do you defend the security trade-off?**
`threaddump`, `heapdump`, `jfr`, `nmt` and usually `jcmd`; not `jmxserver` or `jmxclient`, which the option's own allowed-values text marks experimental and which open a remote management surface; `jvmstat` only if a tool needs to discover the process. The defence is that the alternative is worse: there is no attach mechanism, so a binary shipped without a feature cannot be given it during an incident, and the first debugging step becomes a rebuild and a redeploy. The residual risk is that someone who can already execute the binary or signal the process can obtain its memory — which is a real risk, and the mitigations are process-level rather than build-level: non-root, no shared process namespace, restricted `exec`, and no secrets in the image heap. `threaddump` is close to free on both axes and should be in every build.

**★ A native service stops responding to health checks. It was built with `--enable-monitoring=heapdump,jfr,jcmd,nmt,threaddump`. What do you do, in order?**
Send `SIGQUIT` and read the thread dump — cheapest, needs no client, and answers deadlock, exhausted pool and stuck-on-IO in one look. If `jcmd` is reachable, prefer `jcmd <pid> Thread.print` or `Thread.dump_to_file` for the richer output including virtual threads. If the threads look healthy but memory is suspect, `jcmd <pid> VM.native_memory` for the off-heap summary and `SIGUSR1` or `jcmd GC.heap_dump` for the heap, remembering to point `-XX:HeapDumpPath` somewhere that survives the container. Start a JFR recording if the problem is ongoing rather than instantaneous. What you do not do is reach for `jstack`, an APM agent or `-XX:NativeMemoryTracking=summary`: none of those exist here, and knowing that in advance is the difference between five minutes and an hour ([07b](07b-no-jit-no-jfr-no-jstack.md)).

**★ Your artefact is a native shared library rather than an executable. What changes on this page?**
The `Signal` API is *"enabled by default except when building shared libraries"*, so the `SIGUSR1` heap-dump route and the `SIGQUIT` thread-dump route are gone — the two routes that need nothing but a signal are exactly the two that depend on signal handling being present. What remains is the programmatic `VMRuntime.dumpHeap` API, `jcmd` if it was compiled in, and JFR. For a library embedded in a host process that is often the right answer anyway, since a signal handler in a library is intrusive to its host, but it means the diagnostic design has to be deliberate rather than inherited.

{/* FOOTER */}
