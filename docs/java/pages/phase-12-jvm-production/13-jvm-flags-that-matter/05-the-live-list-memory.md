---
title: "Size the heap as a share of a limit the platform already knows, not as a number someone typed — -Xmx is fully supported, does exactly what it says, and is still the wrong instrument in a container"
sidebar_label: "05 · The live list — heap sizing"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the JDK 25 HotSpot GC Tuning Guide
> ([Ergonomics](https://docs.oracle.com/en/java/javase/25/gctuning/ergonomics.html)), quoted
> verbatim for the default heap fractions, and the JDK 25 `java` tool reference
> ([java](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> Target: **JDK 25 (LTS)**. Documentation-validated; **no sandbox run**.

**This is the first of four "live lists" — the flags that are still correct on JDK 25 and
still worth having. Heap sizing is the group people get most wrong, and not because the flags
are hard. It is because two things are true at once that sound contradictory: `-Xmx` is fully
supported and does exactly what it says, *and* it is usually the wrong instrument in a
container. The percentage forms exist because a container's memory limit is a moving number
and an absolute is a copy of it that drifts. The ceilings that are **not** the heap —
metaspace and direct memory — are their own subject and live in
[the ceilings that are not the heap](05b-the-ceilings-that-are-not-the-heap.md).**

## The list

| Flag | Keep it? | Why |
|---|---|---|
| `-XX:MaxRAMPercentage` | ✅ **usually yes** | Heap as a share of the *cgroup* limit; survives a resize |
| `-XX:InitialRAMPercentage` | ✅ when warm-up pauses matter | Removes the grow-the-heap phase |
| `-XX:MinRAMPercentage` | ⚠️ rarely, and not what it sounds like | Applies only to *small* memory limits |
| `-Xmx` / `-Xms` | ⚠️ only outside containers | Absolute numbers that do not travel |

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
[`PrintFlagsFinal`](04-printflagsfinal.md) is how.

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

### The gap between initial and maximum

*"Initial heap size of 1/64 of physical memory"* and *"Maximum heap size of 1/4"* are both
ergonomic defaults, and the distance between them is why a JVM grows its heap during warm-up.
That growth is normal behaviour, not accumulation — but it is not free, because each resize is
work the collector does while your application is trying to serve traffic.

Closing the gap deliberately is the standard latency trade. Leaving it open is the standard
density trade. Both are defensible; what is not defensible is having the gap by accident and
then reading the warm-up growth on a dashboard as a leak.

## Where the rest of the memory story lives

- **Metaspace and direct buffers** — the two bounds that decide whether the *process* survives
  — are in [the ceilings that are not the heap](05b-the-ceilings-that-are-not-the-heap.md).
- **The collector** that manages this heap, and the 1792 MB threshold that silently changes it,
  are in [the GC live list](05c-the-live-list-gc.md) and [ergonomics](03-ergonomics.md).

## Gotchas

**★ Symptom: `-XX:MinRAMPercentage=50.0` is set to guarantee a minimum heap and the heap is
still tiny at startup.** Cause: it does not set a minimum heap. It sets the *maximum* heap
percentage for small memory limits, and on an ordinary server-sized container it does not
apply at all. Fix: the flag you want is `InitialRAMPercentage`.

```bash
-XX:InitialRAMPercentage=50.0 -XX:MaxRAMPercentage=75.0
```

**★ Symptom: `-Xmx3g` is honoured in a 2 GiB container instead of being rejected.** Cause: the
JVM has no obligation to sanity-check your ceiling against the cgroup limit — you asked for a
3 GiB heap and it will try to give you one. The kernel enforces the limit, and its enforcement
is `SIGKILL`. Fix: percentages. There is no in-JVM error to catch here; the failure happens
outside the JVM.

**★ Symptom: a flag string tuned carefully on one instance size performs badly after a
capacity change, with no code or config change in between.** Cause: absolute flag values do
not scale with the machine, while every ergonomic default does. The tuning was correct for
the machine it was measured on and became wrong the moment the machine changed. Fix: prefer
the percentage-based forms wherever both exist, so a resize carries the tuning with it.

**★ Symptom: heap usage climbs steadily during warm-up and settles, and it reads as a leak on
a dashboard.** Cause: the gap between the initial heap (*"1/64 of physical memory"*) and the
maximum (*"1/4"*). The JVM starts small and grows, so early growth is expected behaviour, not
accumulation. Fix: if the resize work matters, remove the gap deliberately rather than
treating the growth as a fault:

```bash
-XX:InitialRAMPercentage=75.0 -XX:MaxRAMPercentage=75.0
```

**★ Symptom: `-XX:MaxRAMPercentage=75` (no decimal point) looks wrong in review and gets
"corrected" back and forth.** Cause: the flag is `double`-valued and both forms parse, so both
sides of the argument have working examples. Fix: settle it by reading the resolved value
rather than by preference, and write the decimal form to match what the JVM reports back.

```bash
java -XX:MaxRAMPercentage=75 -XX:+PrintFlagsFinal -version | grep -i maxrampercentage
```

**★ Symptom: both `-Xmx` and `-XX:MaxRAMPercentage` are set, and the team disagrees about
which one is in force.** Cause: they express the same ceiling two ways, one absolute and one
derived, so reading the string cannot settle it — and the answer depends on resolution order
rather than on which looks more specific. Fix: stop reading the string and read the resolved
value, then delete the loser. Carrying both is how the next person inherits the same argument.

```bash
java $JAVA_OPTS -XX:+PrintFlagsFinal -version | grep -i 'MaxHeapSize\|MaxRAMPercentage'
```

**★ Symptom: a percentage that was correct becomes wrong after the service adds a sidecar or
an agent.** Cause: `MaxRAMPercentage` is a share of the *container's* limit, and anything else
sharing that limit — a sidecar, a Java agent's own footprint, an init process — reduces what
is genuinely available to the heap without changing the percentage. Fix: the percentage is a
decision about headroom, so it has to be revisited when what occupies that headroom changes.
This is one of the few cases where a working configuration degrades with no change to the
flag itself.

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

**★ Why is the default maximum heap only a quarter of available memory?**
Because `-Xmx` bounds the Java heap and the operating system kills you on the *process*.
Metaspace, the code cache, thread stacks, GC structures, direct and mapped byte buffers and
the native allocator all sit outside the heap, and in a container all of it has to fit under
one cgroup limit. A conservative default leaves headroom so the JVM's own non-heap growth
does not push the process over the edge, where the failure is an abrupt kernel kill rather
than a catchable `OutOfMemoryError` with a heap dump. For a dedicated container running a
single JVM the 25% default is more conservative than it needs to be, which is why raising it
via `MaxRAMPercentage` is one of the few overrides that is nearly always justified.

**★ Would you set `-Xms` equal to `-Xmx`, and what are you trading?**
For a latency-sensitive long-running service, usually yes, and the trade is memory for
predictability. The default gap between an initial heap of a sixty-fourth of memory and a
maximum of a quarter means the JVM grows the heap during warm-up, and each resize is
collector work happening while the application is already serving traffic — which shows up as
early-life latency that disappears once the heap settles, and is easy to misread as a
warm-up artefact of the application itself. Closing the gap removes that work at the cost of
holding the full heap from the first second, which matters when you are packing pods onto
nodes by observed resident set. The wrong version of this decision is having the gap by
accident and then reading the resulting growth curve on a dashboard as a memory leak.

**★ Someone points out that `-Xmx` has been stable for twenty years while `MaxRAMPercentage`
is comparatively new. Is that an argument for `-Xmx`?**
It is an observation about track record rather than an argument about correctness, and the
tool reference does not support the implied distinction — it applies the same "subject to
change" language to `-X` and `-XX` alike, so neither flag carries a stronger guarantee than
the other. The real question is which one expresses the intent, and in a container the intent
is a share of a limit that the platform owns and can change. Age is a reasonable proxy for
stability when nothing else is available, but here something else is available: what the flag
means when the environment changes underneath it. `-Xmx` means the same number; that is
precisely the problem.

{/* FOOTER */}
