---
title: "A thread's allocation buffer is eden divided by the number of allocating threads divided by fifty, which means more threads silently shrink it — and the flag almost every article names to fix that, `InitialTLABSize`, has never existed and will stop a JDK 25 JVM from starting"
sidebar_label: "03c2 · TLAB sizing and the flags"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** for `-XX:TLABSize`,
> `-XX:-UseTLAB`, `-XX:+IgnoreUnrecognizedVMOptions` and `-Xlog`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the JDK 25 HotSpot source at tag `jdk-25+36` —
> `src/hotspot/share/gc/shared/tlab_globals.hpp` for every flag default in the table below and
> `threadLocalAllocBuffer.cpp` for the sizing formula
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/tlab_globals.hpp)).
> 🔴 **Nine of the eleven flags below appear nowhere in the man page**; the source is the only
> documentation for them.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[03c](03c-tlabs-and-allocation.md) established that a thread allocates inside a private slice
of eden by bumping a pointer. This page is how big that slice is, who decides, and what happens
to it when the thread count changes — plus the correction this topic exists to make, because
the flag most widely cited for tuning it is not a flag at all.**

## The eleven flags, from the source

From `tlab_globals.hpp` at `jdk-25+36`, with the source's own descriptions:

| Flag | Default | The source's description |
|---|---|---|
| `UseTLAB` | `true` | *"Use thread-local object allocation"* |
| `ResizeTLAB` | `true` | *"Dynamically resize TLAB size for threads"* |
| `ZeroTLAB` | `false` | *"Zero out the newly created TLAB"* |
| `MinTLABSize` | `2*K` | *"Minimum allowed TLAB size (in bytes)"* |
| `TLABSize` | `0` | *"Starting TLAB size (in bytes); zero means set ergonomically"* |
| `TLABWasteTargetPercent` | `1` | *"Percentage of Eden that can be wasted"* |
| `TLABRefillWasteFraction` | `64` | *"Maximum TLAB waste at a refill"* |
| `TLABWasteIncrement` | `4` | *"Increment allowed waste at slow allocation"* |
| `TLABAllocationWeight` | `35` | *"Allocation averaging weight"* |
| `YoungPLABSize` | `4096` HeapWords | promotion buffer, young generation |
| `OldPLABSize` | `1024` HeapWords | promotion buffer, old generation |

🔴 **Only `UseTLAB` and `TLABSize` are in the JDK 25 `java` man page.** The other nine exist
only in the source. This is a recurring pattern in this topic — `MaxDirectMemorySize`'s real
default in [07](07-direct-and-mapped-buffers.md) is the same story — and the general lesson is
worth stating once: **"it is not in the man page" is not evidence that a flag does not exist,
and it is not evidence about its default either.**

**The waste budget is one percent.** `TLABWasteTargetPercent = 1` says the JVM is willing to
waste up to 1% of eden on retired buffer tails in exchange for making essentially every
allocation lock-free. That is the trade the entire design rests on, and it is a very good one.

## How the size is actually chosen

Not by you, by default. `TLABSize = 0` means ergonomic, and the man page is explicit: *"If this
option is set to 0, then the JVM selects the initial size automatically."*

The calculation is in `threadLocalAllocBuffer.cpp`:

```
init_sz = (eden_capacity / HeapWordSize) / (nof_threads * target_refills())
```

where

```
_target_refills = 100 / (2 * TLABWasteTargetPercent)
```

which is **50** at the default `TLABWasteTargetPercent = 1` — the source clamps it to a minimum
of 2. So, in one line:

> **A thread's initial TLAB is approximately `eden_capacity / (allocating_threads × 50)`.**

The 50 is the JVM saying: *I intend each thread to refill about fifty times per eden.* Fifty
refills means each retired tail is at most a fiftieth of a buffer, which is where the 1% waste
target comes from. The two numbers are the same decision expressed twice.

### Two consequences that surprise people

**More threads means smaller buffers.** The same eden divided among more allocators. A service
that goes from a 200-thread pool to 20,000 concurrently-*allocating* virtual threads drives the
per-thread buffer down by two orders of magnitude, which raises refill frequency and pushes
more allocations onto the slow path. Nothing in the configuration changed; the divisor did.

⚠️ The word doing the work is **allocating**. A parked virtual thread is not competing for
eden. The pressure comes from concurrent allocation, not from thread count on its own — which
is why the same migration is harmless for a service whose virtual threads spend their lives
blocked on I/O.

**A bigger heap means bigger buffers, automatically.** Raising `-Xmx` raises eden raises the
TLAB. There is nothing to tune in step with it, which is the intended behaviour: one
configuration works across environment sizes.

## `ResizeTLAB`: why the initial size barely matters

`ResizeTLAB` is `true` by default, and it is the reason manual tuning is nearly always worse
than the default. Each thread's buffer size is adapted from its *observed* allocation rate,
using an exponentially-weighted moving average whose weight is `TLABAllocationWeight = 35`.

The effect: **threads that allocate heavily converge on large buffers; threads that barely
allocate converge on small ones and stop wasting eden.** A thread pool with wildly uneven work
— a few hot request handlers and fifty idle background threads — ends up with a size per thread
rather than a size per process, which no single static value could achieve.

`MinTLABSize = 2K` is the floor, so even a thread that allocates almost nothing gets a usable
buffer rather than being pushed onto the slow path for every object.

⚠️ **Setting `-XX:TLABSize` does not disable resizing.** It sets the starting point, and
`ResizeTLAB` then moves away from it. Pinning a size requires `-XX:TLABSize=N -XX:-ResizeTLAB`
together, and doing that discards a per-thread adaptive mechanism in favour of one number you
guessed.

## 🔴 `-XX:InitialTLABSize` does not exist

This is the correction this page exists to make, and it is in wide enough circulation that the
plan for this very topic contained it.

**The flag is `-XX:TLABSize`.** There is no `InitialTLABSize` in `tlab_globals.hpp`, in
`globals.hpp`, or in the man page — the string does not appear in the JDK at all.

On JDK 25 that is not a harmless typo. **An unrecognised `-XX:` option fails the launch**
unless `-XX:+IgnoreUnrecognizedVMOptions` is set, so a startup script carrying
`-XX:InitialTLABSize=512k` does not quietly do nothing: the JVM refuses to start, and the
deployment fails on the first pod.

There is a real reason for the confusion, and it is worth knowing because it makes the correct
name memorable: `TLABSize` genuinely *is* only the **starting** size — the source's own
description is *"Starting TLAB size (in bytes)"* — because `ResizeTLAB` adjusts it afterwards.
Someone who reads that description and reconstructs the flag name from its meaning arrives at
`InitialTLABSize`, which is a perfectly reasonable name for the thing and is not what it is
called.

⚠️ **`-XX:+IgnoreUnrecognizedVMOptions` is the wrong fix.** It converts a loud failure into a
silent one, and it will then also swallow the next three flags somebody misspells. The right
fix is to delete the flag, because the ergonomic default is better than any number a human
would have picked.

## Observing it

```bash
java -Xlog:gc+tlab=debug:file=tlab.log:time,uptime -jar app.jar
```

`gc+tlab=debug` reports per-thread TLAB statistics at each young collection — sizes, refill
counts and waste. `gc+tlab=trace` adds per-thread detail and is verbose enough to be a
diagnostic session rather than a production setting.

What to look for:

- **Refill counts far above the target of 50** per thread per eden. The buffers are too small
  for the allocation rate — usually a thread-count consequence rather than a configuration
  one.
- **Waste well above the 1% budget.** Threads are being handed buffers they do not fill,
  which points at a large population of barely-allocating threads, or at an allocation size
  distribution with a long tail.
- **Slow-path allocations climbing.** Objects are too big for the buffers. That is an object-
  size question, not a TLAB question.

⚠️ **`-XX:-UseTLAB` is a diagnostic, never a setting.** It disables the mechanism entirely so
every allocation contends on shared eden. Its only legitimate use is to prove that a behaviour
is or is not TLAB-related, and the answer is almost always "it is now much worse".

## When tuning any of this is the right answer

Almost never, and it is worth being blunt about why. The ergonomic size is derived from eden
and thread count, which are the two things that actually determine it; `ResizeTLAB` then
corrects per thread from measured behaviour. A static value you choose cannot beat that unless
you know something the JVM does not.

The cases where somebody legitimately reaches for these flags:

1. **Diagnosis.** Proving an allocation-throughput problem is TLAB-related, using
   `-XX:-UseTLAB` as the control.
2. **A pathological thread population** — thousands of allocating threads on a small heap —
   where the derived size has collapsed toward `MinTLABSize`. Even then the better fixes are
   fewer allocating threads or a larger heap, both of which fix the divisor.
3. **Benchmark stability**, where `-XX:TLABSize=N -XX:-ResizeTLAB` removes the adaptive
   behaviour so runs are comparable. That is a measurement setting, not a production one.

If none of those applies, the honest recommendation is to leave all eleven flags alone and
spend the effort on allocation *rate*, which is under the application's control and has a much
larger effect.

## Gotchas

**★ `-XX:InitialTLABSize` is not a flag, and on JDK 25 it stops the JVM from starting.**
The flag is `-XX:TLABSize`, default 0 = ergonomic. Unrecognised `-XX:` options are fatal at
launch unless `-XX:+IgnoreUnrecognizedVMOptions` is set, so this is not a silent no-op in a
startup script — it is a failed rollout.

**★ `-XX:+IgnoreUnrecognizedVMOptions` turns a caught mistake into an uncaught one.**
It is occasionally justified when one image must boot across several JDK versions. Adding it to
work around a flag you got wrong means the next wrong flag will also be ignored, and you will
find out from behaviour instead of from a startup error.

**★ `TLABSize` is a *starting* size, not a fixed one.**
`ResizeTLAB` is on by default and adapts it per thread from observed allocation rate. Setting
`TLABSize` alone does not pin anything; pinning needs `-XX:-ResizeTLAB` as well.

**★ Nine of the eleven TLAB flags are absent from the man page.**
`ResizeTLAB`, `MinTLABSize`, `ZeroTLAB`, `TLABWasteTargetPercent`, `TLABRefillWasteFraction`,
`TLABWasteIncrement`, `TLABAllocationWeight` and the two PLAB sizes exist only in
`tlab_globals.hpp`. Absence from the man page says nothing about whether a flag exists or what
its default is.

**★ More threads shrink every thread's buffer.**
Size is eden divided by allocating threads divided by fifty. Raising concurrency — especially
by adopting virtual threads for allocation-heavy work — reduces per-thread buffer size and
raises refill frequency with no flag changing. The heap did not shrink; the slices did.

**★ Only *allocating* threads count.**
Threads parked on I/O do not compete for eden. A million virtual threads blocked on a socket
have no effect on TLAB sizing; a thousand of them parsing JSON have a large one. Any reasoning
from raw thread count will mispredict both cases.

**★ The 1% waste target and the 50 refills are the same number.**
`target_refills = 100 / (2 × TLABWasteTargetPercent)`. Changing `TLABWasteTargetPercent`
changes the refill target and therefore the buffer size — it is not an independent knob, and
tuning it "to reduce waste" makes buffers smaller and refills more frequent.

**★ `MinTLABSize` means even an idle thread holds 2 KB of eden.**
With tens of thousands of threads that is a real number — 20,000 threads is 40 MB of eden
committed to buffers — which is another reason very high thread counts and small heaps
interact badly.

**★ These flags do not affect promotion.**
`YoungPLABSize` and `OldPLABSize` are the GC workers' copying buffers. They live in the same
header and are a different mechanism; nothing in `gc+tlab` application-thread output describes
them.

## Interview questions

**★ How big is a TLAB?**
There is no fixed answer; it is ergonomic. The initial size is roughly eden capacity divided by
the number of allocating threads divided by the target refill count, which is 50 at the default
`TLABWasteTargetPercent` of 1. `ResizeTLAB` then adapts it per thread from observed allocation
rate. `-XX:TLABSize` sets the starting value, and its default of 0 means "choose it for me".

**★ A startup script has `-XX:InitialTLABSize=1m` and the service will not start on JDK 25.
What happened, and what is the fix?**
That flag does not exist — the real one is `-XX:TLABSize` — and modern JDKs treat an
unrecognised `-XX:` option as fatal at launch rather than ignoring it. The fix is to delete the
flag. Adding `-XX:+IgnoreUnrecognizedVMOptions` would make the JVM start, but it suppresses the
same error for every future flag typo, and the ergonomic default was better than the value
being set anyway.

**★ Your service moved from a 200-thread pool to virtual threads and allocation throughput got
worse. Give a JVM-level explanation.**
TLAB size is eden divided among the allocating threads. Far more concurrently-allocating
threads means much smaller per-thread buffers, more frequent refills, proportionally more waste
in retired tails, and more objects pushed onto the slow path. The heap did not change; its
division did. `-Xlog:gc+tlab=debug` would confirm it by showing refill counts far above the
target of 50, and the fixes are a larger heap, or fewer threads allocating concurrently, rather
than a TLAB flag.

**★ Why does the JVM accept wasting eden at all?**
Because the alternative is synchronising every allocation. The budget is explicit —
`TLABWasteTargetPercent = 1` — so the JVM trades up to one percent of eden to make essentially
all allocations a private pointer bump. Given that allocation is the most frequent operation in
most Java programs, one percent of a young generation is a very cheap price for removing a
contended atomic from it.

**★ Would you set `-XX:TLABSize` in production? When?**
Almost never. The derived size uses the two variables that actually determine it — eden size
and thread count — and `ResizeTLAB` then corrects per thread from measurement, which a static
value cannot do. The defensible uses are benchmark stability, where you want
`-XX:TLABSize=N -XX:-ResizeTLAB` so runs are comparable, and a pathological case where
thousands of allocating threads on a small heap have driven the derived size to the floor —
and even there, fixing the divisor by adding heap or reducing concurrency is the better answer.

**★ How would you tell whether TLABs are a problem at all?**
Run with `-Xlog:gc+tlab=debug` and compare refill counts against the target of about 50 per
thread per eden, and waste against the 1% budget. If both are near target, TLABs are not your
problem and the allocation cost you are chasing is collection frequency driven by allocation
rate. As a control, `-XX:-UseTLAB` should make things dramatically worse; if it does not, the
allocation path was not what you were measuring.

**★ Why is `ResizeTLAB` a bigger deal than the initial size?**
Because real thread pools are heterogeneous. A single static size is simultaneously too small
for the handful of hot allocating threads and too large for the many that barely allocate,
wasting eden at one end and forcing refills at the other. Per-thread adaptation from an
exponentially-weighted allocation average gives each thread a size that matches its behaviour,
which is why the initial value it starts from rarely matters.

{/* FOOTER */}
