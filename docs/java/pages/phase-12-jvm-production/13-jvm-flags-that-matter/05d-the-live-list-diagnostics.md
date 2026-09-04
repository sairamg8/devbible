---
title: "The diagnostic flags cost nothing until the day they are the only evidence you have — and every one of them must be armed before the incident, because none of them can be turned on retroactively"
sidebar_label: "05d · The live list — diagnostics"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the JDK 25 `java` tool reference —
> [`-XX:+HeapDumpOnOutOfMemoryError`, `-XX:HeapDumpPath`,
> `-XX:OnOutOfMemoryError`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html),
> all three quoted verbatim below, including the Java-heap-only restriction each carries.
> Target: **JDK 25 (LTS)**. Documentation-validated; **no sandbox run**.

**Every other group in this live list is about making the JVM behave. This one is about being
able to explain it afterwards, and it follows a different rule: these flags have to be set
*before* the thing you want to diagnose happens. There is no retroactive mode. A heap dump you
did not configure is a heap dump that does not exist; native memory accounting not enabled at
launch was never collected. That asymmetry — near-zero cost until the incident, impossible to
obtain during it — is the whole argument for turning them on by default. 🔴 And the most
important fact on this page is a limitation almost nobody knows:
`-XX:+HeapDumpOnOutOfMemoryError` covers Java **heap** exhaustion and nothing else.**

## The list

| Flag | Cost until it fires | What you lose without it |
|---|---|---|
| `-XX:+HeapDumpOnOutOfMemoryError` | None | The only artefact that shows *what* filled the heap |
| `-XX:HeapDumpPath` | None | The dump, to a container filesystem that vanishes |
| `-XX:OnOutOfMemoryError` | None | A hook to notify or capture before the process goes |

The two with a *continuous* cost — `-XX:NativeMemoryTracking` and `-XX:StartFlightRecording` —
are on [armed instrumentation](05e-armed-instrumentation.md).

## `-XX:+HeapDumpOnOutOfMemoryError` — and its real scope

> *"Enables the dumping of the Java heap to a file in the current directory by using the heap
> profiler (HPROF) when a `java.lang.OutOfMemoryError` exception is thrown by the JVM. You can
> explicitly set the heap dump file path and name using the `-XX:HeapDumpPath` option. By
> default, this option is disabled and the heap isn't dumped when an `OutOfMemoryError`
> exception is thrown. **This applies only to `OutOfMemoryError` exceptions caused by Java Heap
> exhaustion; it does not apply to `OutOfMemoryError` exceptions thrown directly from Java
> code, nor by the JVM for other types of resource exhaustion (such as native thread creation
> errors).**"*

🔴 **Read the bolded sentence twice, because the flag is much narrower than its name.** Three
failures that produce a genuine `OutOfMemoryError` and **no dump**:

| Failure | Error you see | Dump written? |
|---|---|---|
| Java heap exhausted | `OutOfMemoryError: Java heap space` | ✅ yes |
| Metaspace exhausted | `OutOfMemoryError: Metaspace` | ❌ **no** |
| Direct buffers exhausted | `OutOfMemoryError: Direct buffer memory` | ❌ **no** |
| Native threads exhausted | `OutOfMemoryError: unable to create native thread` | ❌ **no** |
| Application `throw new OutOfMemoryError()` | whatever it says | ❌ **no** |

The consequence is that a service can be *correctly configured for heap dumps* and still leave
nothing behind for the failure that actually happened — and the team concludes the flag is
broken, or that the container killed the process before it could write. Neither is true; the
flag did exactly what it is documented to do.

**For the cases it does not cover**, take the dump deliberately:

```bash
jcmd <pid> GC.heap_dump /var/log/app/investigation.hprof
```

[The ceilings that are not the heap](05b-the-ceilings-that-are-not-the-heap.md) covers the
bounds that at least turn those failures into *named* errors rather than silent kernel kills.

## `-XX:HeapDumpPath` — and why the default is wrong in a container

> *"Sets the path and file name for writing the heap dump provided by the heap profiler (HPROF)
> when the `-XX:+HeapDumpOnOutOfMemoryError` option is set. By default, the file is created in
> the current working directory, and it's named `java_pid<pid>.hprof` where `<pid>` is the
> identifier of the process that caused the error."*

Two problems with that default in a container, and they compound:

1. **The current working directory is usually ephemeral.** The pod dies, the writable layer
   goes with it, and the dump you successfully wrote is gone before anyone can fetch it. Point
   it at a mounted volume.
2. **The filename embeds the PID**, which in a container is very often `1` — so consecutive
   crashes produce `java_pid1.hprof` every time and each one **overwrites** the last. You keep
   the most recent crash and lose the first, which is usually the informative one.

The reference documents `%p` for the process identifier:

> *"The following example shows how to set the default file explicitly (`%p` represents the
> current process identifier): `-XX:HeapDumpPath=./java_pid%p.hprof`"*

`%p` does not solve the container case on its own, precisely because the PID is stable. Give
the path something that actually varies:

```bash
-XX:+HeapDumpOnOutOfMemoryError \
-XX:HeapDumpPath=/var/log/app/heapdump-$(hostname)-$(date +%s).hprof
```

⚠️ **That shell expansion happens in your entrypoint script, not in the JVM** — an exec-form
`ENTRYPOINT` performs no expansion, so the literal `$(hostname)` ends up in the filename. If
you have no shell, use a per-pod mount path instead, supplied by the platform.

⚠️ **A heap dump is roughly the size of the live heap.** A service with a 4 GiB heap writes a
multi-gigabyte file at the worst possible moment, and it must fit on the volume or the write
fails and you get nothing. Size the volume for it deliberately.

## `-XX:OnOutOfMemoryError` — a hook, with the same narrow scope

> *"Sets a custom command or a series of semicolon-separated commands to run when an
> `OutOfMemoryError` exception is first thrown by the JVM. If the string contains spaces, then
> it must be enclosed in quotation marks. […] **This applies only to `OutOfMemoryError`
> exceptions caused by Java Heap exhaustion; it does not apply to `OutOfMemoryError` exceptions
> thrown directly from Java code, nor by the JVM for other types of resource exhaustion (such
> as native thread creation errors).**"*

🔴 **Identical restriction, and it is easy to miss because the two flags are documented
separately.** A team that knows the heap-dump flag is heap-only will often reach for
`OnOutOfMemoryError` as the general-purpose hook — and it is not one. It fires on exactly the
same narrow condition.

Two cautions before using it at all:

- **The command runs while the JVM is in a bad state.** Keep it to something that cannot itself
  need memory or block — copying a file, touching a marker, sending a signal.
- **It runs on every occurrence**, and an `OutOfMemoryError` frequently arrives repeatedly. A
  hook that uploads a multi-gigabyte dump will be invited to do so many times at once.

## Where the rest of this group lives

The two flags that record the period *before* a failure — Native Memory Tracking and Flight
Recorder — have a continuous cost and answer a different question, so they have their own page:
[armed instrumentation](05e-armed-instrumentation.md). The principle both halves share is
argued there.

## Gotchas

**★ Symptom: `-XX:+HeapDumpOnOutOfMemoryError` is set, the service dies with
`OutOfMemoryError: Metaspace`, and no dump appears.** Cause: the flag is documented as applying
*"only to `OutOfMemoryError` exceptions caused by Java Heap exhaustion"*, and metaspace is not
the Java heap. The flag worked correctly and did nothing. Fix: bound metaspace so the failure is
at least *named*, and take the dump by hand:

```bash
-XX:MaxMetaspaceSize=256m
# when it fires:
jcmd <pid> GC.heap_dump /var/log/app/metaspace.hprof
```

**★ Symptom: consecutive crashes leave only one heap dump, and it is the least interesting
one.** Cause: the default filename is `java_pid<pid>.hprof`, and in a container the PID is
almost always `1`, so every crash writes the same filename and overwrites its predecessor. Fix:
put something that varies into the path — a hostname, a timestamp — and remember the expansion
must happen in a shell, which an exec-form `ENTRYPOINT` does not provide.

**★ Symptom: the heap dump is configured, the pod crashes, and the file is gone.** Cause: the
default location is *"the current working directory"*, which in a container is on the ephemeral
writable layer and dies with the pod. Fix: `-XX:HeapDumpPath` pointed at a mounted volume that
outlives the container.

**★ Symptom: the heap dump write fails partway and leaves a truncated, unreadable file.**
Cause: a dump is roughly the size of the live heap, and the volume did not have room for
several gigabytes. Fix: size the volume against the heap ceiling rather than against typical
usage, and check it before the incident — a truncated dump is worth exactly as much as no dump.

**★ Symptom: `-XX:OnOutOfMemoryError` is set as a general failure hook and never fires.**
Cause: it carries the *same* Java-heap-only restriction as the heap-dump flag, documented
separately, so a metaspace or native-thread failure does not trigger it. Fix: do not treat it
as a general hook. For broader coverage, watch the process from outside — the container's
restart reason and exit code — rather than from a JVM flag that is scoped to one cause.

**★ Symptom: the `OnOutOfMemoryError` command runs many times and makes the outage worse.**
Cause: it runs each time the error is thrown, and `OutOfMemoryError` typically arrives
repeatedly and on several threads at once. A command that uploads a multi-gigabyte dump will be
asked to do so concurrently. Fix: make the hook idempotent and cheap — touch a marker, send a
signal — and do the expensive work elsewhere, from something that is not inside the dying JVM.

## Interview questions

**★ Does `-XX:+HeapDumpOnOutOfMemoryError` capture every `OutOfMemoryError`?**
No, and this is the most useful thing to know about the flag. The tool reference restricts it
to *"`OutOfMemoryError` exceptions caused by Java Heap exhaustion"* and explicitly excludes both
an `OutOfMemoryError` thrown directly from Java code and the JVM raising one for *"other types
of resource exhaustion (such as native thread creation errors)"*. So the three cases people most
often expect it to catch — metaspace exhaustion, direct-buffer exhaustion, and running out of
native threads — produce a real error and **no dump**. The practical consequence is that a
service can be correctly configured for heap dumps and still leave nothing behind for the
failure that actually happened, and the team then wastes time deciding the flag is broken or
that the container killed the process too fast. Neither is true. For those cases you take the
dump deliberately with `jcmd <pid> GC.heap_dump`.

**★ Why is the default heap dump path a problem in a container, given the flag works?**
Two reasons that compound. The default location is *"the current working directory"*, which in
a container sits on the ephemeral writable layer — so the dump is written successfully and then
destroyed with the pod, which is the worst kind of failure because everything looked like it
worked. And the default filename is `java_pid<pid>.hprof`, where in a container the PID is
almost always `1`, so repeated crashes all write the same name and each overwrites the last;
you retain the most recent and lose the first, which is usually the one that shows the onset.
The fix is a mounted volume plus something genuinely varying in the filename — and the varying
part has to be expanded by a shell, which an exec-form `ENTRYPOINT` does not give you.

**★ What is the trap in `-XX:OnOutOfMemoryError`?**
Two, and the first is the one that catches people. It carries the *same* Java-heap-only
restriction as the heap-dump flag — documented separately, so a team that has learned the
restriction for one flag often reaches for this as the general-purpose hook it is not. The
second is operational: the command runs inside a JVM that is already failing, and it runs on
each occurrence, and `OutOfMemoryError` typically arrives repeatedly across several threads. A
hook that does anything expensive, allocates, or blocks will be doing it several times at once
in a process with no memory. Keep it to something trivially cheap — touch a marker, send a
signal — and do the real work from outside the dying JVM.

{/* FOOTER */}
