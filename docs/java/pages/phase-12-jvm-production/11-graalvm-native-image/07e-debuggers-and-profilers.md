---
title: "Two diagnostics come from outside the process rather than being compiled into it — an experimental JDWP debugger that ships a bytecode interpreter alongside your binary and turns one artefact into three, and Linux perf, which is the profiler that actually works because it never needed a JVM in the first place"
sidebar_label: "07e · Debuggers and profilers"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Java Debug Wire Protocol (JDWP) with Native Image"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/debugging-and-diagnostics/JDWP/)),
> "Linux Perf Profiler Support in Native Image"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/debugging-and-diagnostics/perf-profiler/)),
> "Debugging and Diagnostics" and "Native Image Compatibility Guide";
> all read from `docs/reference-manual/native-image/` on the **`release/graal-vm/25.3`** branch of
> [`oracle/graal`](https://github.com/oracle/graal/tree/release/graal-vm/25.3/docs/reference-manual/native-image).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.1 / Spring Framework 7.0.9**.
> Documentation-validated; **no sandbox run** — no debugger was attached, no `perf record` was executed
> and no flame graph was rendered. Every limitation below is transcribed from the reference's own lists.

**[07b](07b-no-jit-no-jfr-no-jstack.md) said JVMTI is gone and *"users must use native debuggers and monitoring tools (such as GDB or VTune) rather than tools targeted for Java."* That is still the rule, but it now has two important qualifications. GraalVM 25.3 ships an experimental JDWP implementation, so a standard Java debugger *can* attach to a native executable — at the price of a bytecode interpreter, an external metadata file, a shared library that must travel with the binary, and a limitation list that reads like a catalogue of the closed world. And `perf` needs no qualification at all: it profiles a native executable the way it profiles any other ELF binary, which makes it the one profiling tool in this topic that gains capability from AOT compilation instead of losing it.**

## JDWP — the debugger that exists, with the word "experimental" attached

> *"This document describes the Java Debug Wire Protocol (JDWP) debugging support for Native Image, a feature that enables debugging of native images using standard Java tooling."*

> *"Note: JDWP debugging for Native Image is experimental."*

### The one-time setup

The JDWP server is not in your binary. It is a separate shared library you build once per GraalVM installation:

```bash
native-image --macro:svmjdwp-library
```

> *"The JDWP feature relies on a shared library, which is loaded only when the debugger is actively used. This library must be built once before building native images with JDWP enabled. … This is a one-time setup step. The same library will be used for all native images built with JDWP enabled."*

> *"This library is stored in the GraalVM installation by default. If that directory is not writable, provide an alternative destination path with `-o <path/to/writable/directory>/libsvmjdwp`."*

⚠️ **A read-only GraalVM installation is the normal case in a container image**, so the `-o` form is the one a Dockerfile needs.

### Building a debuggable image, and what it actually produces

```bash
native-image -H:+UnlockExperimentalVMOptions -H:+JDWP -cp app.jar com.example.BillingApplication
```

> This command produces:
> 1. *"The native executable"*
> 2. *"An `<image-name>.metadata` file"*
> 3. *"The `lib:svmjdwp` (`libsvmjdwp.so`, `libsvmjdwp.dylib` or `svmjdwp.dll`) shared library that will be necessary when debugging is also copied next to those files."*

🔴 **This is the finding on the page.** Native image's headline property — one self-contained executable with no runtime beside it — is exactly what a debuggable build gives up. The reference is explicit:

> *"Debugging requires the `image-name.metadata` file generated at build time and the `svmjdwp` shared library in the same directory as the native executable."*

Three files that must stay together, one of which is derived from *that specific build*. So a debuggable image is a different deployment artefact with a different packaging story, and the metadata file is build-specific: a rebuild invalidates it. **Plan for a separate debug image, not for debugging the production one.**

⚠️ *"If `lib:svmjdwp` cannot be found, the application will terminate with error code 1."* — a hard failure, not a degradation.

### Launching and connecting

```bash
./billing-service -XX:JDWPOptions=transport=dt_socket,server=y,address=8000
```

> *"To launch the native image in debug mode, use the `-XX:JDWPOptions=` option, similar to HotSpot's `-agentlib:jdwp=`."*

The option vocabulary is not identical to HotSpot's, and the reference tells you where to get the real list rather than reproducing it:

> *"For a complete list of supported JDWP options on Native Image, run: `./your-application -XX:JDWPOptions=help`"*

Two non-standard options exist and both matter in a container:

- **`mode=native:<path>`** — *"Specifies the path to the `svmjdwp` library"*, accepting a direct path to the library, a directory containing it, or a GraalVM installation with it in `lib` or `bin`. *"If no path is specified, `lib:svmjdwp` is searched for beside the native executable."* Bare `mode=native` means search next to the executable.
- **`vm.options=…`** — *"VM options, separated by whitespaces, passed to the JDWP server isolate/JVM, should not include a `,` character."* It also accepts `vm.options=@argfile`, the standard Java command-line argument-file form.

### The architecture, because it explains every limitation

> *"The JDWP debugging support is implemented using a Java bytecode interpreter, adapted from Espresso to work with Native Image."*

Four components: an **interpreter** derived from Espresso that *"does not enable any dynamic features beyond what Native Image already supports"*; a **PLT/GOT feature** *"used to divert execution to the interpreter"*; the external **metadata file** *"containing information required for runtime method interpretation"*; and the **JDWP server** as a native library plus a **resident** component inside the application *"providing access to locals, fields, stack traces, and other runtime information."*

**So debugging works by interpreting bytecode that the compiled binary does not otherwise contain**, reached by diverting calls through the PLT/GOT. That single sentence predicts the entire limitation list: anything that requires interpreting a frame that is currently executing as compiled code, or interpreting a method the interpreter cannot handle, does not work.

### The limitations, in full

The reference groups them, and the grouping is the useful part.

**Because of the closed world** — these are structural and are not going to change:

> *"Only classes, methods, and fields included in the image are accessible."*
> *"Some types may not be instantiable at runtime, even if there are instances in the image heap."*
> *"Some fields cannot be written to."*
> *"No support for dynamic class loading."*
> *"No class or method redefinition."*
> *"There's no runtime class-path `System.getProperty("java.class.path") == null`"*

**Debugger features that simply are not implemented:**

> *"No exception breakpoints."*
> *"No field watchpoints."*
> *"No early return or frame popping."*

**Because compiled frames are not interpreter frames** — this is the group that will surprise you during an actual session:

> *"Cannot write locals of compiled frames."*
> *"Cannot hit breakpoints or stepping events on actively executing compiled methods."*
> *"Step-out operations only work for interpreter frames, not compiled frames."*

**Because not every method can be interpreted:**

> *"Methods that use 'System Java'."*
> *"Methods that contain a call to an intrinsic without compiled entry-point."*
> *"Breakpoints cannot be set in non-interpretable methods."*
> *"Stepping through non-interpretable methods is not possible, these are effectively treated as if they were Java 'native' methods, with no guarantee to break/step on the next executed method, only on the next interpreted method."*

**And three more, each of which has bitten someone:**

> *"Interpreting 'dead-code' may work, but only on a best-effort basis."*
> *"Violating compiled-code assumptions, for example, passing a null argument where a non-null was expected, is considered undefined behavior and prone to crashes."*
> *"Can only debug the first isolate of a native image."*
> *"Step-into does not work for target methods of a `MethodHandle` object, for example, lambdas."*

🔴 **Read the last one twice.** Step-into not working through `MethodHandle` targets means **step-into does not work into a lambda**, and modern Spring code is lambdas from top to bottom — every `Optional.map`, every stream pipeline, every functional route definition, every `@Bean` supplier. That single limitation removes a large fraction of the debugging you would actually want to do in a Boot application.

⚠️ **"Undefined behavior and prone to crashes" is a documented outcome of a debugger action.** Setting a local to `null` where the compiler proved non-nullness can crash the process. A debugger that can crash the thing it is debugging is not a production tool, and the reference's own framing — *"Expose Native Image through JDWP as-is, maintaining its assumptions and constraints"* — says why: the debugger does not weaken the compiled code's assumptions, so violating them is on you.

### So when is JDWP worth it?

**When the bug only reproduces in the native image.** That is the whole case, and it is a real one: a metadata gap, a build-time-initialisation surprise ([04](04-build-time-vs-run-time-initialisation.md)), a conditional bean resolved differently under AOT ([05b](05b-what-spring-gives-up.md)). For everything else, debug on the JVM with `-Dspring.aot.enabled=true`, where you have a complete debugger with no limitation list at all (**08** *(not written yet)*).

## `perf` — the profiler that works, and the two flags that make it readable

There is no JVMTI, no `-javaagent` and no async-profiler attach here ([07b](07b-no-jit-no-jfr-no-jstack.md)). What there is, on Linux, is a native executable that `perf` can sample like any other ELF binary — and unlike a JIT-compiled JVM, its symbols do not move.

```bash
native-image -g -H:+PreserveFramePointer -cp app.jar com.example.BillingApplication
```

> *"The `-g` option instructs Native Image to produce debug information for the generated binary. `perf` can use this debug information, for example, to provide proper names for types and methods in traces. The `-H:+PreserveFramePointer` option instructs Native Image to save frame pointers on the stack. This allows `perf` to reliably unwind stack frames and reconstruct the call hierarchy."*

🔴 **Without `-H:+PreserveFramePointer` you get samples but not call graphs**, which means a flat profile and no flame graph worth the name. Both flags are build-time, so this is the same rule as everything else in [07d](07d-the-diagnostic-toolbox.md): decide before you ship. `-g` also enlarges the artefact — the build output lists the `.debug` file and a `sources` directory as separate artefacts — so a profiling build is usually a separate build.

### The kernel settings, and the sentence the reference attaches to them

```bash
cat /proc/sys/kernel/perf_event_paranoid > perf_event_paranoid.backup
cat /proc/sys/kernel/kptr_restrict > kptr_restrict.backup
echo -1 > /proc/sys/kernel/perf_event_paranoid
echo 0 > /proc/sys/kernel/kptr_restrict
```

> *"In the example above, `-1` and `0` are used as values, which are the least restrictive, so it is not recommended to use them in production code. You can customize these values according to your needs."*

The documented ladders, so you can choose a value rather than pasting the loosest one:

| `perf_event_paranoid` | Meaning |
|---|---|
| `-1` | *"Allow use of (almost) all events by all users."* |
| `>=0` | *"Disallow `ftrace` function tracepoint by users without `CAP_SYS_ADMIN`."* |
| `>=1` | *"Disallow CPU event access by users without `CAP_SYS_ADMIN`."* |
| `>=2` | *"Disallow kernel profiling by users without `CAP_SYS_ADMIN`."* |

| `kptr_restrict` | Meaning |
|---|---|
| `0` | *"Kernel pointers are readable by all users."* |
| `1` | *"Kernel pointers are only accessible to privileged users (those with the `CAP_SYS_ADMIN` capability)."* |
| `2` | *"Kernel pointers are hidden from all users."* |

⚠️ **These are host-wide kernel settings, not per-process ones.** In Kubernetes that means a node-level change, usually needing a privileged pod or a node configuration — which is why `perf` is normally a pre-production or dedicated-node activity, and why JFR ([07b](07b-no-jit-no-jfr-no-jstack.md)) is what you run continuously. Restore the backups afterwards; the reference tells you to.

### Recording and rendering

```bash
perf record -g -e cycles -o perf.data ./billing-service
perf report -i perf.data
```

Flame graphs use Brendan Gregg's FlameGraph scripts, and the reference's warning is the one everybody hits:

> *"Make sure the profiling data was recorded with `-g` to capture call graphs, otherwise the flame graph will be flat."*

```bash
perf script -i perf.data | ./stackcollapse-perf.pl > perf.data.folded
./flamegraph.pl perf.data.folded > perf.data.svg
```

A variant worth knowing about, because it answers a different question from a normal flame graph:

> *"Generate a stack-reversed flame graph with the topmost frames shown at the bottom of the flame graph in order of invocation time. Calls appear left-to-right in chronological order, with stack frames in each call arranged top-to-bottom from oldest to newest. Events from all threads contributing to the profiling data are shown interleaved."*

```bash
./flamegraph.pl --reverse perf.data.folded > perf.data.svg
```

**That is a start-up-analysis tool.** A chronological, stack-reversed graph over the first seconds of a process shows you what start-up actually spent its time on — which, for a technology whose entire justification is start-up ([01](01-what-problem-it-solves.md)), is the single most on-topic use of `perf` in this whole topic.

### jitdump, and why you almost certainly do not need it

Native Image can emit runtime-compilation metadata in the Linux `jitdump` format:

```bash
native-image -g -H:+PreserveFramePointer -H:+RuntimeDebugInfo -H:RuntimeDebugInfoFormat=jitdump -cp app.jar com.example.BillingApplication
```

> *"This enables perf profiling of runtime compiled methods, for example for Truffle compilations."*

🔴 **"Runtime compiled methods" in a native image means Truffle**, and only Truffle — the same exception [07b](07b-no-jit-no-jfr-no-jstack.md) records for GC events. If you are not embedding a Truffle language, nothing in your process is compiled at run time and this whole feature has no subject. Skip it.

If you are, the workflow has one non-obvious requirement:

> *"When recording profiling data, use the `-k 1` option to ensure time-based events are ordered correctly for injection … If the perf data was not recorded with `-k 1`, injecting runtime compilation metadata from a jitdump file will fail."*

```bash
perf record -k 1 -o perf.data ./billing-service
perf inject -j -i perf.data -o perf.jit.data
perf report -i perf.jit.data
```

Runtime symbols then *"appear as coming from `jitted-<pid>-<code_id>.so`"*. Writing is controlled by `-R:-RuntimeJitdump` at build time and `-XX:±RuntimeJitdump` at run time, with the output directory set by `-R:RuntimeJitdumpDir=<jitdump_dir>` (default `./jitdump`).

## Where each tool belongs

| Question | Tool | Where |
|---|---|---|
| "Why is this method slow?" | `perf` + flame graph, or JFR `jdk.ExecutionSample` | here / [07b](07b-no-jit-no-jfr-no-jstack.md) |
| "What did start-up spend its time on?" | `perf` with `flamegraph.pl --reverse` | here |
| "What are the threads doing right now?" | `SIGQUIT`, or `jcmd Thread.print` | [07d](07d-the-diagnostic-toolbox.md) |
| "What is retaining this memory?" | heap dump | [07d](07d-the-diagnostic-toolbox.md) |
| "Why does this bug only happen in the native binary?" | JDWP, or better, reproduce on the JVM with AOT enabled | here / **08** *(not written yet)* |
| "Why is throughput lower than the JVM?" | none of these — it is a build question | [07c](07c-getting-throughput-back.md) |

## Gotchas

**★ Symptom: a debuggable native image starts and immediately exits with code 1.** Cause: *"If `lib:svmjdwp` cannot be found, the application will terminate with error code 1."* Fix: put the library next to the executable, or point at it explicitly with `-XX:JDWPOptions=…,mode=native:/opt/graalvm/lib/libsvmjdwp.so`. Remember the library is built once, separately, with `native-image --macro:svmjdwp-library`.

**★ Symptom: `native-image --macro:svmjdwp-library` fails to write its output.** Cause: *"This library is stored in the GraalVM installation by default"*, and that directory is read-only in most container base images. Fix: `-o <path/to/writable/directory>/libsvmjdwp`, then reference that path with `mode=native:` when launching.

**★ Symptom: a debugger attaches but breakpoints never fire.** Cause: the most likely candidate is that the method is not interpretable or is *"actively executing"* as compiled code — *"Cannot hit breakpoints or stepping events on actively executing compiled methods"*, and *"Breakpoints cannot be set in non-interpretable methods."* Fix: set the breakpoint earlier, on a caller that will be entered fresh, and accept that some methods have no breakpoint at all. If the target is a lambda, see the next entry.

**★ Symptom: step-into on a lambda or stream operation goes nowhere.** Cause: *"Step-into does not work for target methods of a `MethodHandle` object, for example, lambdas."* Fix: there is no workaround inside the native debugger. Reproduce on the JVM with `-Dspring.aot.enabled=true`, which exercises the AOT-generated context while giving you a complete debugger (**08** *(not written yet)*).

**★ Symptom: setting a variable in the debugger crashes the process.** Cause: two documented reasons. *"Cannot write locals of compiled frames"*, and more seriously *"Violating compiled-code assumptions, for example, passing a null argument where a non-null was expected, is considered undefined behavior and prone to crashes."* Fix: treat the native debugger as read-mostly. Observing state is supported; editing it is not, because the compiler optimised against assumptions the debugger does not re-check.

**★ Symptom: the debug session works locally and fails after a rebuild.** Cause: the `<image-name>.metadata` file is produced by a specific build and *"Debugging requires the `image-name.metadata` file generated at build time and the `svmjdwp` shared library in the same directory as the native executable."* An old metadata file next to a new binary is a mismatch. Fix: ship the executable and its metadata as one unit, and rebuild both together.

**★ Symptom: a team plans to enable JDWP in production "just in case".** Cause: reasoning by analogy with a JVM, where `-agentlib:jdwp` is a run-time flag and costs nothing when unused. Fix: here it changes the artefact — three files instead of one, a bytecode interpreter and PLT/GOT diversion compiled in, and an experimental feature in the hot path of your deployment. Build a separate debug image on demand instead, and use `threaddump`, `heapdump` and JFR for production ([07d](07d-the-diagnostic-toolbox.md)).

**★ Symptom: an application with multiple isolates can only be partly debugged.** Cause: *"Can only debug the first isolate of a native image."* Fix: no workaround is documented. If your design uses multiple isolates, JDWP is not a complete debugging story for it and the `perf`/dump/JFR route is what remains.

**★ Symptom: `perf report` shows hex addresses instead of method names.** Cause: the binary was built without `-g`, so there is no debug information for `perf` to resolve symbols against. Fix: rebuild with `-g`, and accept the larger artefact — that is why the profiling build is usually separate from the release build.

**★ Symptom: the flame graph is one frame tall.** Cause: the reference names it — *"Make sure the profiling data was recorded with `-g` to capture call graphs, otherwise the flame graph will be flat."* Fix: two different `-g` flags are involved and both are required: `perf record -g` for call graphs, and `native-image -g` for symbols. Add `-H:+PreserveFramePointer` at build time, or the unwinding is unreliable even with `perf record -g`.

**★ Symptom: `perf` produces nothing useful inside a Kubernetes pod.** Cause: `perf_event_paranoid` and `kptr_restrict` are host-wide kernel settings, and the defaults on a managed node deny the events you need. Fix: this is a node-level change requiring privilege, so run `perf` on a dedicated or pre-production node, and use JFR for anything you need on a normal production node. Restore the backed-up values afterwards.

**★ Symptom: someone loosens `perf_event_paranoid` to `-1` on a shared production node and leaves it.** Cause: copying the reference's setup block without its warning. Fix: the warning is in the same document — *"which are the least restrictive, so it is not recommended to use them in production code."* Pick the least permissive level that lets the events you need through, using the documented ladder, and restore the backups when you are finished.

**★ Symptom: `perf inject -j` fails to attach jitdump metadata.** Cause: the recording was made without `-k 1` — *"If the perf data was not recorded with `-k 1`, injecting runtime compilation metadata from a jitdump file will fail."* Fix: re-record with `perf record -k 1`. But first check whether you need jitdump at all: it exists for runtime-compiled methods, which in a native image means Truffle, and a plain Spring application has none.

**★ Symptom: `-H:+RuntimeDebugInfo` was added to an ordinary service build "for better profiles".** Cause: assuming jitdump relates to the application's own code. Fix: remove it. The reference scopes it to runtime-compiled code — *"for example for Truffle compilations"* — and an application with no Truffle language compiles nothing at run time, so the option adds build cost and artefacts for no signal.

## Interview questions

**★ Can you attach a debugger to a native executable, and what is the honest answer to "should you"?**
Yes — GraalVM 25.3 documents an experimental JDWP implementation. You build the server library once with `native-image --macro:svmjdwp-library`, build the image with `-H:+UnlockExperimentalVMOptions -H:+JDWP`, and launch with `-XX:JDWPOptions=transport=dt_socket,server=y,address=8000`, which is deliberately shaped like HotSpot's `-agentlib:jdwp=`. Whether you should is a different question. The build stops producing a single self-contained binary: you now have the executable, an `<image-name>.metadata` file and the `lib:svmjdwp` shared library, and all three must sit in the same directory or the process exits with code 1. The limitation list is long and includes no exception breakpoints, no field watchpoints, no writing locals of compiled frames, no breakpoints in non-interpretable methods, only the first isolate, and no step-into through `MethodHandle` targets — which means no step-into a lambda. The pragmatic answer is that JDWP is for bugs that only reproduce natively; everything else is debugged on the JVM with `spring.aot.enabled=true`.

**★ How does JDWP debugging work in a binary that contains no bytecode?**
It ships a bytecode interpreter. The reference says the support is *"implemented using a Java bytecode interpreter, adapted from Espresso to work with Native Image"*, reached by a PLT/GOT feature *"used to divert execution to the interpreter"*, driven by an external metadata file *"containing information required for runtime method interpretation"*, with the protocol served by a native library and a resident component inside the application that provides locals, fields and stack traces. That architecture explains every limitation directly: anything that requires interpreting a frame currently running as compiled code, or interpreting a method the interpreter cannot handle, fails — hence no breakpoints on actively executing compiled methods, no step-out from compiled frames, and no writing their locals.

**★ Why does `perf` work when async-profiler and APM agents do not?**
Because `perf` never needed the JVM. It is a kernel-level sampling profiler that works against any ELF binary using debug information and frame pointers; JVMTI attach, bytecode instrumentation and the HotSpot attach mechanism — the things async-profiler and APM agents depend on — are exactly what the closed world removes. The two build flags that make its output readable are `-g`, which produces the debug information `perf` uses *"to provide proper names for types and methods in traces"*, and `-H:+PreserveFramePointer`, which saves frame pointers so `perf` can *"reliably unwind stack frames and reconstruct the call hierarchy."* Without the second you get a flat profile. The catch is operational rather than technical: `perf` needs kernel settings that are host-wide, so it is usually a pre-production or dedicated-node tool while JFR handles continuous profiling.

**★ You want to know what your native service spends its start-up time on. What do you run?**
`perf record -g` over the process from launch, then fold the stacks and render with `flamegraph.pl --reverse`. The reference describes what that produces: *"the topmost frames shown at the bottom of the flame graph in order of invocation time. Calls appear left-to-right in chronological order."* A conventional flame graph aggregates by stack and tells you where cumulative time went; a reversed, chronological one tells you what happened *when*, which is the right shape for a phase that runs once. Build with `-g -H:+PreserveFramePointer`, and remember this is the question native image exists to answer well, so it is worth having a repeatable procedure for it.

**★ What is jitdump for, and why is it almost always irrelevant?**
It is the Linux format for describing runtime-compiled code so `perf` can attribute samples to it. In a native image, the only thing compiled at run time is Truffle — the reference's example is *"for example for Truffle compilations"* — because the closed-world build compiled everything else ahead of time. So for an ordinary Spring service there is no runtime-compiled code and jitdump has no subject; `-H:+RuntimeDebugInfo -H:RuntimeDebugInfoFormat=jitdump` adds build cost and artefacts for nothing. If you *are* embedding a Truffle language, the workflow is `perf record -k 1`, then `perf inject -j`, then report — and the `-k 1` is mandatory, because injection fails without correctly ordered time-based events.

**★ A `NullPointerException` appears only in the native binary and not on the JVM. How do you attack it?**
Do not start with JDWP. Start on the JVM with `-Dspring.aot.enabled=true`, because the most common cause of "only in native" is the AOT-processed context rather than the compilation, and that reproduces on a JVM with a full debugger (**08** *(not written yet)*). If it still does not reproduce, the next candidates are a missing reachability registration ([03b](03b-reachability-metadata.md)) and build-time initialisation ([04](04-build-time-vs-run-time-initialisation.md)), both of which have their own diagnostics — `-XX:MissingRegistrationReportingMode=Exit` and a `-XX:+DumpHeapAndExit` image-heap dump ([07d](07d-the-diagnostic-toolbox.md)) — that are cheaper and more conclusive than stepping. Only when the bug is genuinely a native-only control-flow question is a debug image worth building, and even then treat the session as read-mostly, because writing state in a compiled frame is documented as *"undefined behavior and prone to crashes."*

**★ Why is a debuggable native image a different artefact rather than a different flag?**
Because the debugging machinery is compiled in and its dependencies are external. `-H:+JDWP` changes the build output from one file to three — the executable, a build-specific `<image-name>.metadata`, and the `lib:svmjdwp` shared library copied alongside — and all three must be co-located at run time. That contradicts the property the technology is chosen for, so shipping it everywhere would mean giving up self-contained deployment on every service for a capability used a few times a year. It is also an experimental feature. The right shape is a `debug` build profile that produces the three-file artefact on demand, kept out of the release pipeline.

{/* FOOTER */}
