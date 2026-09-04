---
title: "The memory flags worth keeping are percentages, not absolutes — and -XX:MaxDirectMemorySize is the one whose default the manual actively hides, because it is a second copy of your heap ceiling that rises every time you raise -Xmx"
sidebar_label: "05 · The live list — memory"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the JDK 25 `java` tool reference —
> [`-XX:MaxDirectMemorySize`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html),
> quoted verbatim — and the JDK 25 HotSpot GC Tuning Guide
> ([Ergonomics](https://docs.oracle.com/en/java/javase/25/gctuning/ergonomics.html)) for the
> default heap fractions. Target: **JDK 25 (LTS)**. Documentation-validated;
> **no sandbox run**.

**This is the first of four "live lists" — the flags that are still correct on JDK 25 and
still worth having. The memory group is the one people get most wrong, and not because the
flags are hard. It is because two things are true at once that sound contradictory: `-Xmx` is
fully supported and does exactly what it says, *and* it is usually the wrong instrument in a
container. The percentage forms exist because a container's memory limit is a moving number
and an absolute is a copy of it that drifts. Then there is `-XX:MaxDirectMemorySize`, whose
documented description says the JVM "chooses the size automatically" and does not tell you
what it chooses — which turns out to be your entire heap ceiling, again.**

## The list

| Flag | Keep it? | Why |
|---|---|---|
| `-XX:MaxRAMPercentage` | ✅ **usually yes** | Heap as a share of the *cgroup* limit; survives a resize |
| `-XX:InitialRAMPercentage` | ✅ when warm-up pauses matter | Removes the grow-the-heap phase |
| `-XX:MinRAMPercentage` | ⚠️ rarely, and not what it sounds like | Applies only to *small* memory limits |
| `-Xmx` / `-Xms` | ⚠️ only outside containers | Absolute numbers that do not travel |
| `-XX:MaxMetaspaceSize` | ⚠️ as a leak *detector* | Unbounded by default |
| `-XX:MaxDirectMemorySize` | 🔴 know its default | Silently equals `-Xmx` |

## The percentage flags, and why they are the default answer

Ergonomics gives you *"Maximum heap size of 1/4 of physical memory"*, and on a
container-aware JVM "physical memory" is the cgroup limit. So the JVM already knows the
number you are about to hard-code. `-XX:MaxRAMPercentage` changes the *share* and leaves the
JVM to read the limit:

```bash
-XX:MaxRAMPercentage=75.0
```

For a dedicated container running one JVM this is nearly always the right shape. The value
is a decision about how much headroom the non-heap parts of the process need — metaspace,
code cache, thread stacks, GC structures, direct buffers, the native allocator — and 75% is
a common starting point rather than a rule.

⚠️ **It takes a floating-point value.** `-XX:MaxRAMPercentage=75` is accepted, but write
`75.0`; the percentage flags are `double`-valued and the decimal form is what you will see
in every example, including the JVM's own resolved output.

`-XX:InitialRAMPercentage` is the `-Xms` equivalent, and setting it equal to the maximum is
the standard move for a latency-sensitive service:

```bash
-XX:InitialRAMPercentage=75.0 -XX:MaxRAMPercentage=75.0
```

That trades memory for the absence of heap-resize work during warm-up. It is a real trade,
not a free win: the process now holds its full heap from the first second, which matters if
you were relying on a small resident set early on to pack more pods onto a node.

### 🔴 `-XX:MinRAMPercentage` does not do what its name says

This is the single most reliable misreading in the group. **It is not a minimum heap size**
and it is not the floor to `MaxRAMPercentage`'s ceiling. It sets the *maximum* heap as a
percentage — like `MaxRAMPercentage` — but applies only when the available memory is
**small**, below a threshold in the low hundreds of megabytes.

Its purpose is that a flat percentage behaves badly at tiny sizes: 25% of 128 MB is a heap
too small to be useful, so a different, larger percentage applies down there.

⚠️ **This page could not find that threshold stated in the JDK 25 `java` tool reference**,
and does not assert a number for it. What is safe to say, and sufficient in practice: if your
container has a memory limit in the ordinary server range, `MinRAMPercentage` is not the flag
that is affecting you, and setting it will not raise a floor because there is no floor to
raise. If you want a minimum heap, that is `InitialRAMPercentage` or `-Xms`. Check the
resolved value on your own JVM rather than trusting any table, this one included —
`04-printflagsfinal.md` is how.

## `-Xmx` and `-Xms` — supported, correct, and usually the wrong tool

Nothing is wrong with these flags. They are not deprecated, not obsolete, and do precisely
what they promise. The problem is what they promise: an absolute number, fixed at the moment
someone typed it, duplicating a fact the platform already owns.

**They remain the right choice when there is no cgroup limit to read** — a JVM on a shared
host, a VM running several processes, a desktop tool — because there the JVM's idea of
"physical memory" is the whole machine and a share of it is not what you mean.

🔴 **Inside a container, an absolute is a bug waiting for a capacity change.** `-Xmx3g` in a
2 GiB container is honoured, the process grows past the cgroup limit, and the kernel kills
it — an `OOMKilled` with no `OutOfMemoryError`, no heap dump and no stack trace, because the
JVM was never given the chance to notice. Topic 03 owns that distinction in full; it is the
most misdiagnosed symptom in the phase.

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
proxy generation — produces `OutOfMemoryError: Metaspace`, which names the problem, is
catchable, and can trigger a heap dump. Without it, the same leak walks the process past the
cgroup limit and the kernel kills it, and you are left with a restarted pod and no evidence.

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
`05c-the-live-list-diagnostics.md` *(not written yet)* covers arming it.

**When to set it explicitly:** when you want the direct-buffer ceiling to be a deliberate,
smaller number than the heap ceiling, so that a direct-buffer leak fails as
`OutOfMemoryError: Direct buffer memory` rather than as a container kill. Same logic as
metaspace — a tripwire that converts a silent death into a named error.

## Gotchas

**★ Symptom: `-XX:MinRAMPercentage=50.0` is set to guarantee a minimum heap and the heap is
still tiny at startup.** Cause: it does not set a minimum heap. It sets the *maximum* heap
percentage for small memory limits, and on an ordinary server-sized container it does not
apply at all. Fix: the flag you want is `InitialRAMPercentage`.

```bash
-XX:InitialRAMPercentage=50.0 -XX:MaxRAMPercentage=75.0
```

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

**★ Symptom: `-Xmx3g` is honoured in a 2 GiB container instead of being rejected.** Cause: the
JVM has no obligation to sanity-check your ceiling against the cgroup limit — you asked for a
3 GiB heap and it will try to give you one. The kernel enforces the limit, and its enforcement
is `SIGKILL`. Fix: percentages. There is no in-JVM error to catch here; the failure happens
outside the JVM.

**★ Symptom: metaspace grows steadily across redeploys until the container is killed, with the
heap flat throughout.** Cause: a classloader leak, and no `MaxMetaspaceSize`, so metaspace grew
until the *process* hit the cgroup limit rather than until a Java error was raised. Fix: set the
tripwire so the failure becomes diagnosable:

```bash
-XX:MaxMetaspaceSize=256m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/var/log/app
```

The pairing is the point — the bound turns it into an `OutOfMemoryError`, and the dump flag
means that error leaves evidence.

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

**★ Symptom: `-XX:MaxRAMPercentage=75` (no decimal point) looks wrong in review and gets
"corrected" back and forth.** Cause: the flag is `double`-valued and both forms parse, so both
sides of the argument have working examples. Fix: settle it by reading the resolved value
rather than by preference, and write the decimal form to match what the JVM reports back.

```bash
java -XX:MaxRAMPercentage=75 -XX:+PrintFlagsFinal -version | grep -i maxrampercentage
```

## Interview questions

**★ Why prefer `-XX:MaxRAMPercentage` to `-Xmx` in a container, when `-Xmx` is fully supported
and does exactly what it says?**
Because the two encode different things. `-Xmx` encodes an absolute number that duplicates the
cgroup limit, and the copy drifts the moment capacity planning changes the limit — a
hard-coded `-Xmx2g` silently wastes half of a 4 GiB allocation, and a hard-coded `-Xmx3g` in a
2 GiB container is honoured right up until the kernel kills the process. `MaxRAMPercentage`
encodes the *decision* — how much of the limit the heap should take — and lets the JVM read
the limit, which it has done since JDK 10. The important nuance is that this is not a case of
a bad flag being replaced by a good one. `-Xmx` is correct and remains the right choice where
there is no cgroup limit to read; it is an example of a fully valid flag being the wrong
instrument for the environment.

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
pod, no Java-level error, no heap dump, and nothing that names the cause. A bound turns the same
leak into `OutOfMemoryError: Metaspace`, which names the subsystem, is catchable, and can
trigger a heap dump that identifies the retained classloaders. The flag is a tripwire rather
than a budget, which drives how you pick the number: high enough that normal steady-state
operation never approaches it, because if it fires during ordinary work you have manufactured
an outage rather than caught a leak.

**★ `MinRAMPercentage` — what does it actually do?**
It sets the maximum heap as a percentage of available memory, and it applies only when
available memory is small — below a threshold in the low hundreds of megabytes. It is not a
minimum heap size and it is not a floor beneath `MaxRAMPercentage`, despite reading exactly
like both. It exists because a single flat percentage behaves badly at very small sizes, where
25% of the limit leaves a heap too small to run anything, so a larger percentage applies in
that range. The practical consequences are that on a normally-sized container it has no effect
whatever, and that someone setting it expecting a guaranteed minimum heap has set a flag that
will never fire; the flag they wanted was `InitialRAMPercentage` or `-Xms`. Worth adding that
the exact threshold is not stated in the JDK 25 tool reference, so the honest move is to read
the resolved value on your own JVM rather than trust a number from any secondary source.

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

{/* FOOTER */}
