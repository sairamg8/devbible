---
title: "Docker blocks the syscall async-profiler's most accurate engine depends on, so the profiler that works perfectly on your laptop fails in production — and the three documented ways round it trade accuracy, privilege or both"
sidebar_label: "09c · Running it in a container"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **async-profiler's `docs/ProfilingInContainer.md`** and
> `docs/CpuSamplingEngines.md`, quoted verbatim
> ([github.com/async-profiler/async-profiler](https://github.com/async-profiler/async-profiler/blob/master/docs/ProfilingInContainer.md)),
> and the **JDK 25 `jcmd` tool reference** for the JFR alternative
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)).
> 🔴 **No sandbox, no Docker.** No command below was run. Every requirement is quoted from the
> project's documentation.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Everything in [09](09-async-profiler.md) assumed you can run the profiler. In a container you
frequently cannot, and the reason is not a bug — Docker deliberately restricts the syscall the
accurate engine depends on. This page is the documented requirements, the three documented ways
round the restriction, and the point at which the honest answer is to use JFR instead.**

## 🔴 The blocker, stated by the project

`docs/ProfilingInContainer.md`:

> *"By default, Docker container restricts the access to `perf_event_open` syscall."*

And `-e cpu` — *"the most accurate CPU sampler available in async-profiler and the only one that
can obtain kernel stack traces"* — relies on `perf_events`
([09](09-async-profiler.md)). So the default container configuration disables the engine you
most want.

⚠️ **This is a security decision, not an oversight.** `perf_event_open` has been a source of kernel
vulnerabilities, and container runtimes block it in their default seccomp profile deliberately.
Anything you do to enable it is loosening a control that exists for a reason.

## The three documented alternatives

Quoted from the same document:

> *"There are 3 alternatives to allow profiling in a container:*
>
> *1. You can modify the [seccomp profile](https://docs.docker.com/engine/security/seccomp/) or
> disable it altogether with `--security-opt seccomp=unconfined` option. In addition,
> `--cap-add SYS_ADMIN` may be required.*
>
> *2. You can use "fdtransfer": see the help for `--fdtransfer`.*
>
> *3. Last, you may fall back to `-e ctimer` profiling mode, see Troubleshooting."*

**What each actually costs:**

| Option | Cost | When |
|---|---|---|
| **Relax seccomp** (`--security-opt seccomp=unconfined`, possibly `--cap-add SYS_ADMIN`) | 🔴 A real security relaxation, and it changes the container spec | A dedicated profiling environment, never the production default |
| **`--fdtransfer`** | More moving parts; a helper passes descriptors in | Where the privilege can be confined to the helper |
| **`-e ctimer`** | Accuracy — no kernel stacks | ✅ **The pragmatic default in a container** |

🔴 **Option 3 is the one you will usually take**, and it is worth being explicit that it is a
downgrade rather than an equivalent: `ctimer` and `itimer` do not produce kernel stack traces, and
`itimer`'s documented limitations — one signal per process at a time, uneven distribution across
threads, jiffy-limited resolution — apply.

⚠️ **Record which engine produced a profile.** A `ctimer` profile and a `cpu` profile of the same
workload are not directly comparable, and comparing them as though they were produces conclusions
that are artefacts of the engine.

## Profiling from the host

The document describes the other approach — attaching from outside the container:

> *"When profiling from the host, `pid` should be the Java process ID in the host namespace. Use
> `ps aux | grep java` or `docker top <container>` to find the process ID."*

> *"async-profiler should be run from the host by a privileged user - it will automatically switch
> to the proper pid/mount namespace and change user credentials to match the target process."*

**Two requirements that trip people up:**

🔴 **The PID must be the host-namespace one.** Inside the container the JVM is probably PID 1; from
the host it is something else entirely. `docker top <container>` is the documented way to find it,
and using the container-namespace PID from the host simply targets the wrong process.

🔴 **The library must be reachable at the same path from both sides:**

> *"make sure that the target container can access `libasyncProfiler.so` by the same absolute path
> as on the host. Alternatively, specify `--libpath` option to override path to
> `libasyncProfiler.so` in a container."*

That path-matching requirement is the most common reason host-side profiling fails with a confusing
error, and `--libpath` is the documented escape.

⚠️ **It needs a privileged user on the host**, which in a managed Kubernetes environment you may
simply not have. That is not a workaround problem; it is a "this approach is unavailable" problem.

## The other constraints worth knowing

**File descriptors.** `-e cpu` *"allocates a descriptor per thread"*, and if `ulimit -n` is low
*"an application may run out of file descriptors"*. Container images often ship a conservative
limit, and the failure lands on the application rather than the profiler.

**Hidden kernel symbols.** With `kernel.kptr_restrict` set, async-profiler *"continues to use
`perf_events`, emits a warning and does not show kernel stack traces"* — a degraded result with a
warning that is easy to overlook in a busy terminal.

**Debug symbols.** Native frames resolve to names only if symbols are available. Minimal container
images strip them, so a profile can be technically correct and full of unnamed addresses — which is
worse than useless, because it looks like data.

## 🔴 When to stop and use JFR instead

The honest decision point, because the effort of getting async-profiler working in a locked-down
container is easy to underestimate:

**Use JFR when** the question is about Java code, the environment is locked down, you need it
*now*, or getting a security exception approved would outlast the incident. JFR needs no seccomp
change, no privileged user, no library path matching and no extra capability — `jcmd JFR.start` is
rated *"Impact: Low"* and just works ([03](03-starting-a-recording.md)).

**Persist with async-profiler when** you specifically need what only it gives: kernel frames,
non-Java threads, hardware counters, or native allocation profiling
([09](09-async-profiler.md)). Those are real needs and JFR does not cover them.

⚠️ **And on JDK 25, try `jdk.CPUTimeSample` first** ([08](08-jdk-25-jfr.md)). It is experimental
and Linux-only, but it gives CPU-time profiling including native code through the supported
interface — with none of this page's requirements. **A great deal of container-profiling effort has
historically gone into obtaining something the JDK now offers directly.**

## Gotchas

**★ Docker blocks `perf_event_open` by default.**
Quoted directly from the project documentation. That disables `-e cpu`, the accurate engine, so the
profiler that worked on your laptop fails in the container for a reason that is deliberate rather
than accidental.

**★ Relaxing seccomp is a real security decision.**
`--security-opt seccomp=unconfined` plus possibly `--cap-add SYS_ADMIN` removes a control that
exists because `perf_event_open` has a vulnerability history. It belongs in a dedicated profiling
environment, not in a production container spec.

**★ `-e ctimer` is a downgrade, not an equivalent.**
It is the documented container fallback and it does not produce kernel stack traces. Treating a
`ctimer` profile as interchangeable with a `cpu` profile misattributes the difference between them
to the application.

**★ Record the engine in your findings.**
`cpu`, `itimer` and `ctimer` differ in accuracy. Comparing profiles taken with different engines
produces differences that are artefacts of the tooling.

**★ Host-side profiling needs the host-namespace PID.**
Inside the container the JVM is usually PID 1; that number means something else on the host.
`docker top <container>` is the documented way to get the right one.

**★ `libasyncProfiler.so` must be reachable at the same absolute path from both sides.**
Stated in the documentation, and the most common cause of a confusing host-side failure.
`--libpath` overrides it.

**★ Host-side profiling requires a privileged user.**
In a managed Kubernetes environment you may not have one, which makes this approach unavailable
rather than merely inconvenient.

**★ `-e cpu` can exhaust the application's file descriptors.**
A descriptor per thread against a container's conservative `ulimit -n`. The profiler's resource use
becomes the application's failure.

**★ Stripped images produce unnamed native frames.**
Without debug symbols a profile is full of addresses. It looks like data and answers nothing, which
is worse than an obvious failure.

**★ JFR has none of these requirements.**
No seccomp change, no capability, no privileged user, no path matching. `jcmd JFR.start` is Impact:
Low and works in a stock container. That asymmetry should decide most container profiling.

**★ On JDK 25, `jdk.CPUTimeSample` may remove the need entirely.**
Experimental and Linux-only, but it delivers CPU-time profiling including native code through the
supported interface — the thing much of this page's effort was historically spent obtaining.

## Interview questions

**★ Why does async-profiler often fail in a container?**
Because its most accurate CPU engine relies on `perf_events`, and the project documentation states
that *"by default, Docker container restricts the access to `perf_event_open` syscall"*. The
restriction is deliberate — that syscall has a vulnerability history and container runtimes block it
in their default seccomp profile — so this is a security control working as intended rather than a
bug.

**★ What are your options when it does?**
The documentation lists three: relax the seccomp profile, with `--security-opt seccomp=unconfined`
and possibly `--cap-add SYS_ADMIN`; use `--fdtransfer`, which passes descriptors in via a helper;
or fall back to `-e ctimer`. The third is usually the pragmatic answer and is an accuracy
downgrade — no kernel stack traces — so the engine used should be recorded alongside any finding.

**★ What do you need to profile from the host rather than inside the container?**
A privileged user on the host, the JVM's PID in the *host* namespace rather than the container's —
`docker top` gives it — and `libasyncProfiler.so` reachable at the same absolute path from both
sides, or `--libpath` to override it. The path requirement is the usual cause of a confusing
failure, and the privileged-user requirement often makes the approach simply unavailable on managed
Kubernetes.

**★ When would you stop trying and use JFR?**
Whenever the question is about Java code and the environment is locked down. JFR needs no seccomp
change, no added capability, no privileged user and no path matching, and `jcmd JFR.start` is rated
Impact: Low. Getting a security exception approved routinely takes longer than the incident lasts.
I would persist with async-profiler only for what JFR genuinely cannot give: kernel frames, non-Java
threads, hardware counters or native allocation profiling.

**★ How does JDK 25 change this calculation?**
`jdk.CPUTimeSample` from JEP 509 provides CPU-time profiling that covers native code through a
supported interface, with none of the container requirements on this page — no seccomp relaxation,
no capability, no privileged host user. It is experimental and Linux-only, so it is not a universal
answer, but on Linux it removes the single most common reason teams fought to get async-profiler
running in a container.

**★ Your profile from a container is full of hexadecimal addresses instead of method names. What
happened?**
The image lacks debug symbols, so native frames cannot be resolved. Minimal base images strip them
as a matter of course. The profile is technically valid and practically useless — and worse than an
outright failure, because it looks like data. The fix is symbols in the image or accepting that
native frames will not be attributable in that environment.

{/* FOOTER */}
