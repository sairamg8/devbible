---
title: "Metaspace has no default ceiling and direct memory's default ceiling is a second copy of your heap — so the two bounds that decide whether a container survives are the two nobody sets"
sidebar_label: "05b · The ceilings that are not the heap"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the JDK 25 `java` tool reference —
> [`-XX:MaxDirectMemorySize`, `-XX:+HeapDumpOnOutOfMemoryError`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html),
> both quoted verbatim — and the JDK 25 `jcmd` tool reference
> ([jcmd](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)).
> Target: **JDK 25 (LTS)**. Documentation-validated; **no sandbox run**.

**`-Xmx` bounds the Java heap. The kernel kills the *process*. Everything between those two
sentences is this page. Metaspace and direct byte buffers are the two largest things living in
that gap, and each has a default that surprises people in opposite directions: metaspace has
**no upper bound at all**, and direct memory has one that silently equals your entire heap
ceiling — so the flag you never set has already granted a second heap's worth of native
allocation. Both are worth setting, and for the same reason, which is not the one people
expect: not to constrain memory, but to convert a silent kernel kill into a named Java error
you can act on.**

## `-XX:MaxMetaspaceSize` — unbounded by default, and that is the point

Metaspace holds class metadata and, unlike the heap, **has no default upper bound** — it
grows until the process runs out of native memory or the container limit is hit.

That makes the flag useful for a reason people find counter-intuitive: you set it not to
*constrain* metaspace but to **convert a slow container death into a fast, diagnosable Java
error**.

```bash
-XX:MaxMetaspaceSize=256m
```

With this set, a classloader leak — the usual cause, from repeated redeployment or dynamic
proxy generation — produces `OutOfMemoryError: Metaspace`, which names the subsystem in the
log and is catchable. Without it, the same leak walks the process past the cgroup limit and
the kernel kills it, and you are left with a restarted pod and no evidence.

🔴 **Do not expect `-XX:+HeapDumpOnOutOfMemoryError` to capture it.** The tool reference
restricts that flag explicitly:

> *"This applies only to `OutOfMemoryError` exceptions caused by Java Heap exhaustion; it does
> not apply to `OutOfMemoryError` exceptions thrown directly from Java code, nor by the JVM for
> other types of resource exhaustion (such as native thread creation errors)."*

Metaspace exhaustion is not Java heap exhaustion, so **no automatic dump is written**. What the
bound buys you is the named error in the log rather than a silent kill — which is the whole
win, and is worth having — but the evidence-gathering has to be deliberate:

```bash
jcmd <pid> GC.heap_dump /var/log/app/metaspace-leak.hprof
```

`05d-the-live-list-diagnostics.md` *(not written yet)* covers that flag's real scope in full,
because the same restriction catches people out on several other error classes.

⚠️ **Set it high enough that normal operation never approaches it.** This is a tripwire, not
a tuning knob. If it fires during ordinary steady-state work, the number is too low and you
have converted a non-problem into an outage.

## 🔴 `-XX:MaxDirectMemorySize` — the flag whose default the manual hides

The reference says:

> *"Sets the maximum total size (in bytes) of the `java.nio` package, direct-buffer
> allocations. Append the letter `k` or `K` to indicate kilobytes, `m` or `M` to indicate
> megabytes, or `g` or `G` to indicate gigabytes. **If not set, the flag is ignored and the
> JVM chooses the size for NIO direct-buffer allocations automatically.**"*

Read that last sentence carefully. It tells you a choice is made and does not tell you what
it is.

**The choice is your maximum heap size.** When the flag is unset, HotSpot sets the direct
memory ceiling from `Runtime.getRuntime().maxMemory()` — the same number `-Xmx` or
`MaxRAMPercentage` produced. So:

- A JVM with a 3 GiB heap ceiling also permits roughly **3 GiB of direct buffers**, entirely
  outside the heap.
- The worst case for the *process* is therefore around **twice** what a reading of `-Xmx`
  suggests, before metaspace, code cache, thread stacks and the native allocator are counted.
- 🔴 **Raising `-Xmx` raises the direct-memory ceiling too.** Increasing the heap to fix an
  `OutOfMemoryError` silently increases the process's other worst case by the same amount —
  which is one of the mechanisms behind "we gave it more memory and it got OOMKilled sooner".

This matters more than it used to because direct buffers are no longer exotic. Netty, most
NIO-based HTTP clients and servers, and several serialisation libraries allocate them as a
matter of course, so any reactive or high-throughput service is using them whether or not
anyone chose to.

⚠️ **Mapped buffers are bounded by no JVM flag at all.** `MappedByteBuffer` allocations use a
separate pool that `MaxDirectMemorySize` does not cover. If a service memory-maps files there
is no JVM-side ceiling to set, and the accounting has to come from Native Memory Tracking —
`05d-the-live-list-diagnostics.md` *(not written yet)* covers arming it.

**When to set it explicitly:** when you want the direct-buffer ceiling to be a deliberate,
smaller number than the heap ceiling, so that a direct-buffer leak fails as
`OutOfMemoryError: Direct buffer memory` rather than as a container kill. Same logic as
metaspace — a tripwire that converts a silent death into a named error.

## The shape both flags share

Neither of these is a tuning decision. Both are **failure-mode decisions**, and that reframing
is what makes them easy to set:

| | Without the bound | With the bound |
|---|---|---|
| What fails | The process, via the kernel | The JVM, via a named error |
| What you get | A restarted pod | `OutOfMemoryError: Metaspace` / `: Direct buffer memory` |
| Evidence | None | A log line naming the subsystem |
| Where to set the number | — | Well clear of observed steady state |

The number is not a budget you are enforcing. It is the point at which you would rather be
told than killed.

## Gotchas

**★ Symptom: a pod is OOMKilled and the heap dump shows a healthy, half-empty heap.** Cause:
the heap was never the problem — the process exceeded the cgroup limit through non-heap
memory, and direct buffers are the usual suspect precisely because their default ceiling
equals the heap ceiling and nobody set it. Fix: stop looking at the heap and account for the
whole process.

```bash
# Must be armed at launch; it cannot be enabled retroactively.
-XX:NativeMemoryTracking=summary
# then, on the running process:
jcmd <pid> VM.native_memory summary
```

**★ Symptom: raising `-Xmx` from 2g to 3g to fix an `OutOfMemoryError` makes the container die
sooner and more violently.** Cause: two effects compound. The heap itself now occupies more
of the limit, and the unset `MaxDirectMemorySize` ceiling rose from 2 GiB to 3 GiB with it, so
the process's worst case grew by 2 GiB rather than 1. Fix: raise the *share* of a known limit
rather than an absolute, and bound direct memory explicitly if the service uses NIO buffers
heavily.

**★ Symptom: metaspace grows steadily across redeploys until the container is killed, with the
heap flat throughout.** Cause: a classloader leak, and no `MaxMetaspaceSize`, so metaspace grew
until the *process* hit the cgroup limit rather than until a Java error was raised. Fix: set the
tripwire so the failure becomes diagnosable:

```bash
-XX:MaxMetaspaceSize=256m
```

🔴 **Do not add `-XX:+HeapDumpOnOutOfMemoryError` here expecting a dump.** That flag covers
Java heap exhaustion only; the error is raised and no dump is written. Take it deliberately
with `jcmd <pid> GC.heap_dump` instead.

**★ Symptom: setting `-XX:MaxMetaspaceSize` causes an outage in normal operation.** Cause: it
was set as a tuning value rather than as a tripwire, low enough that steady-state class loading
reaches it. Fix: raise it well clear of observed steady state. Its job is to catch unbounded
growth, not to hold metaspace to a budget.

**★ Symptom: a service that memory-maps files exceeds its container limit and
`MaxDirectMemorySize` has no effect on it.** Cause: mapped buffers use a separate pool that
this flag does not bound, and no JVM flag bounds it. Fix: accept that the ceiling must come
from outside the JVM — the container limit and the code's own mapping discipline — and use
Native Memory Tracking to see the pool rather than trying to cap it with a flag that does not
apply.

**★ Symptom: a service dies with "unable to create native thread" and no heap dump appears,
despite `-XX:+HeapDumpOnOutOfMemoryError` being set.** Cause: the same documented restriction.
Native thread exhaustion is named in the reference as one of the *"other types of resource
exhaustion"* the flag does not cover, so the `OutOfMemoryError` is real and the dump is not
written. Fix: recognise that this flag is narrower than its name suggests — it covers Java heap
exhaustion and nothing else — and that thread exhaustion is a stack-size and thread-count
question rather than a heap one.

**★ Symptom: a direct-buffer leak is suspected and Native Memory Tracking was not enabled, so
there is no way to confirm it.** Cause: `-XX:NativeMemoryTracking` is a launch-time flag and
the accounting is not collected retroactively. Fix: none for the running process — which is
the argument for arming `summary` pre-emptively, since the class of problem it answers is
exactly the one where nothing else will tell you.

## Interview questions

**★ What is the default value of `-XX:MaxDirectMemorySize`, and why does it matter?**
It is your maximum heap size. The tool reference only says that *"if not set, the flag is
ignored and the JVM chooses the size for NIO direct-buffer allocations automatically"* — it
states that a choice is made without stating what it is — and the choice HotSpot makes is
`Runtime.getRuntime().maxMemory()`, the same number `-Xmx` or `MaxRAMPercentage` produced. It
matters for two reasons. First, the process's worst case is roughly twice what reading `-Xmx`
suggests, before metaspace, code cache and thread stacks are counted, which is a large error to
make when sizing a container. Second, and less obvious, raising `-Xmx` raises the direct-memory
ceiling by the same amount — so the standard response to an `OutOfMemoryError` quietly enlarges
a second, invisible worst case, which is one real mechanism behind "we gave it more memory and
it got killed sooner."

**★ Why would you set `-XX:MaxMetaspaceSize` when metaspace is unbounded by default and you do
not want to constrain it?**
To change the *failure mode*, not the behaviour. Unbounded metaspace means a classloader leak
grows until the process hits the container limit, and the kernel kills it — you get a restarted
pod, no Java-level error, and nothing that names the cause. A bound turns the same leak into
`OutOfMemoryError: Metaspace`, which names the subsystem in the log and is catchable. The sharp
edge worth knowing is that this does **not** get you an automatic heap dump:
`-XX:+HeapDumpOnOutOfMemoryError` is documented as applying only to *"`OutOfMemoryError`
exceptions caused by Java Heap exhaustion"*, and metaspace exhaustion is not that — so the dump
has to be taken deliberately with `jcmd <pid> GC.heap_dump`. The flag is a tripwire rather
than a budget, which drives how you pick the number: high enough that normal steady-state
operation never approaches it, because if it fires during ordinary work you have manufactured
an outage rather than caught a leak.

**★ A pod is OOMKilled but the heap dump looks healthy. Where do you look?**
Outside the heap, and the reframing is the whole answer: `-Xmx` bounds the Java heap while the
kernel enforces a limit on the *process*. Metaspace, the code cache, thread stacks, GC
structures, direct and mapped byte buffers and the native allocator all sit between the two and
none of them appear in a heap dump. Direct buffers are the first place to look on any
NIO-based service, because their default ceiling equals the heap ceiling and almost nobody sets
it explicitly, so a service with a 3 GiB heap silently permits another 3 GiB of direct
allocation. The tool is Native Memory Tracking — `-XX:NativeMemoryTracking=summary` at launch,
then `jcmd <pid> VM.native_memory summary` — and the catch is that it must be armed before the
incident, since the accounting is not collected retroactively.

**★ Why is `-XX:+HeapDumpOnOutOfMemoryError` narrower than its name suggests?**
Because it covers one specific cause of one specific error. The reference states that it
applies *"only to `OutOfMemoryError` exceptions caused by Java Heap exhaustion"* and explicitly
excludes two other sources: an `OutOfMemoryError` thrown directly from Java code, and the JVM
raising one for *"other types of resource exhaustion (such as native thread creation errors)"*.
So the three cases people most often expect it to catch — metaspace exhaustion, direct-buffer
exhaustion, and running out of native threads — produce a real `OutOfMemoryError` and **no
dump**. The practical consequence is that a service can be correctly configured for heap dumps
and still leave nothing behind for the failure that actually happens, which is why the bounds
on this page are worth setting: at minimum the error names the subsystem in the log, even
when no file is written.

**★ Both flags on this page are described as tripwires rather than tuning. What does that
change about how you choose the number?**
It inverts the question. A tuning value is chosen to be *right* — as close to optimal as you
can measure. A tripwire is chosen to be *never reached in normal operation*, which means you
deliberately set it well above observed steady state and accept that it is not optimal. Getting
this backwards is how `-XX:MaxMetaspaceSize` causes an outage: someone sizes it tightly around
current usage, a release loads more classes, and a flag added to catch a leak becomes the
thing that takes the service down. The value comes from what happens at the boundary — a named,
catchable Java error instead of a `SIGKILL` with no explanation — so any number that preserves
that and stays clear of normal operation is a good number, and precision buys nothing.

{/* FOOTER */}
