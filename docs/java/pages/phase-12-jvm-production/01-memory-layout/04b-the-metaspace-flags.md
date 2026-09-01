---
title: "Metaspace is unlimited by default, `MetaspaceSize` is a GC trigger rather than a reservation, the flag bounding the region that actually runs out is not in the man page, and the standard fix for the error it produces is deprecated in JDK 25 and obsolete in 26"
sidebar_label: "04b · The metaspace flags"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** for `-XX:MaxMetaspaceSize`,
> `-XX:MetaspaceSize` and `-XX:+UseCompressedClassPointers`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> the **JDK 25 Troubleshooting Guide** for `Compressed class space`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/)),
> **JEP 387 "Elastic Metaspace"** ([openjdk.org](https://openjdk.org/jeps/387)),
> and the JDK 25 HotSpot source at tag `jdk-25+36` — `src/hotspot/share/runtime/globals.hpp`
> for `MetaspaceSize` and `CompressedClassSpaceSize`, and
> `src/hotspot/share/runtime/arguments.cpp` for the deprecated- and obsolete-flag tables
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/globals.hpp)).
> 🔴 **`CompressedClassSpaceSize` appears zero times in the JDK 25 man page**; the source and the
> Troubleshooting Guide are its only documentation.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Four flags govern the region [04](04-metaspace.md) describes, and three of the four are
routinely misunderstood: one is unlimited by default, one is a collection trigger that people
read as a reservation, one is undocumented in the man page, and one is on its way out of the
JDK entirely. This page is what each actually does.**

## `-XX:MaxMetaspaceSize` — unlimited by default

The man page is unambiguous:

> *"Sets the maximum amount of native memory that can be allocated for class metadata. **By
> default, the size isn't limited.**"*

Confirmed in the source as `product(size_t, MaxMetaspaceSize, max_uintx, ...)` — the maximum
representable value, which is the idiom for "no limit".

🔴 **This is the most consequential default in the region.** A classloader leak in a container
does not produce `OutOfMemoryError: Metaspace`. It produces steadily growing native memory until
the kernel OOM-kills the process, which arrives as exit code 137 and a healthy-looking heap —
an infrastructure symptom for a Java cause. [01b](01b-oom-error-versus-oomkilled.md) is the page
for that distinction.

**So the argument for setting it is diagnostic, not protective.** A limit converts an
unattributable container kill into a Java error with a stack trace, a thread, and a stack of
tooling that works. Pick a number comfortably above the steady-state committed value — the
`Class` committed figure in NMT after warm-up, with real headroom — and treat a breach as a bug
report rather than as a sizing problem.

⚠️ **A limit does not stop a leak; it relocates the symptom.** That is the point. An
`OutOfMemoryError: Metaspace` at 04:00 is a far better artefact than an OOMKill, because it
names the region and can trigger the JVM's own diagnostics.

## `-XX:MetaspaceSize` — a GC trigger, not a reservation

This is the most widely misread flag in the phase. The man page only says the default *"depends
on the platform"*; the source settles both the value and, more importantly, the meaning:

```cpp
product(size_t, MetaspaceSize, NOT_LP64(16 * M) LP64_ONLY(21 * M),
        "Initial threshold (in bytes) at which a garbage collection is done to reduce Metaspace usage")
```

**21 MB on 64-bit**, and it is the occupancy at which the JVM performs a collection *to try to
unload classes*.

It does not pre-allocate 21 MB. It does not limit anything. Raising it does not "give metaspace
more room" — it **delays the first class-unloading collection**, and the threshold then adjusts
upward as the application settles.

The one legitimate use: an application that loads a large number of classes during startup —
which is every Spring Boot service — crosses 21 MB almost immediately and triggers collections
whose only possible outcome is nothing, because none of those classes is unloadable yet. Raising
`MetaspaceSize` to somewhere near the post-startup steady state removes that burst. It is a
startup-latency optimisation, and a small one.

## `-XX:CompressedClassSpaceSize` — 1 GB, and not in the man page

The string "CompressedClass" appears **zero times** in the JDK 25 `java` tool reference. From
the source:

```cpp
product(size_t, CompressedClassSpaceSize, 1*G,
        "Maximum size of class area in Metaspace when compressed class pointers are used")
        range(1*M, LP64_ONLY(4*G) NOT_LP64(max_uintx))
```

It *is* documented in the Troubleshooting Guide, under the `Compressed class space` error —
which is the only place most people ever meet it, usually at the worst possible moment.

Two things follow.

**The 1 GB is reserved address space.** It appears in `pmap`, in NMT's `reserved` column, and
in every "why does my JVM map a gigabyte" question. It is not resident memory
([01f](01f-reserved-committed-and-resident.md)).

**Exhausting it is a class-count problem.** A gigabyte of `Klass` structures is a very large
number of classes. Raising the flag is the immediate fix; the real question is why the
application has that many, and the answer is usually runtime class generation
([04c](04c-the-classloader-leak.md)).

### ⚠️ `UseCompressedClassPointers` is deprecated in JDK 25 and obsolete in 26

From `arguments.cpp`, `special_jvm_flags[]`:

```cpp
{ "UseCompressedClassPointers", JDK_Version::jdk(25), JDK_Version::jdk(26), JDK_Version::undefined() },
```

and `globals.hpp` now labels it *"(Deprecated) Use 32-bit class pointers in 64-bit VM."*

🔴 **So the standard advice for a `Compressed class space` error — "turn off compressed class
pointers" — is advice with a one-release life.** On JDK 25 `-XX:-UseCompressedClassPointers`
warns; on JDK 26 it is obsolete and the JVM will not honour it.

The reason is [08b](08b-compact-object-headers.md): compact object headers **require** compressed
class pointers, and JEP 534 makes compact headers the default in Release 27. The flag that
disables them is being removed because the feature that needs them is becoming mandatory.

**Raise `CompressedClassSpaceSize`, or reduce the class count.** Those are the two supported
answers on JDK 25 and the only two that survive JDK 26.

## Elastic metaspace, and the flag that outlived its JEP

**JEP 387 (JDK 16)** rebuilt the allocator, and its description is the best short account of how
the region works internally:

> *"Metaspace memory is managed in per-class-loader arenas. An arena contains one or more
> chunks, from which its loader allocates via inexpensive pointer bumps."*

and the change itself:

> *"replace the existing metaspace memory allocator with a buddy-based allocation scheme… commit
> memory from the operating system to arenas lazily, on demand… uniformly-sized granules which
> can be committed and uncommitted independently."*

The practical effect is that metaspace **returns memory to the OS** after classes are unloaded,
which the pre-16 implementation largely did not. A JVM that unloads a burst of classes now
shrinks its resident set instead of holding the high-water mark forever — which matters in a
container, where RSS is what the limit is measured against.

⚠️ **Uncommitting granules is not compaction.** JEP 122 still guarantees metadata is never
moved. A workload that repeatedly loads and unloads unevenly-sized classes can hold more
committed metaspace than its live metadata would suggest, because a granule with one live
allocation in it cannot be returned.

⚠️ **JEP 387's own flag is gone.** `-XX:MetaspaceReclaimPolicy` is **obsolete since JDK 21** —
`{ "MetaspaceReclaimPolicy", undefined, jdk(21), undefined }` in the obsolete-flags table. Any
article quoting JEP 387's "new command-line option" is quoting a flag a JDK 25 JVM rejects at
launch.

## What to actually set

For a containerised service on JDK 25, in order of value:

1. **`-XX:MaxMetaspaceSize`**, set generously above the observed steady state. Its purpose is to
   make a class leak announce itself as a Java error rather than as an OOMKill.
2. **Nothing else**, unless a measurement says otherwise.
3. `-XX:MetaspaceSize` near the post-startup steady state, if startup full-GC churn shows up in
   `-Xlog:gc` and you care about the milliseconds.
4. `-XX:CompressedClassSpaceSize` only in response to an actual `Compressed class space` error,
   and alongside an investigation into the class count.

And the flags to remove if you find them: `-XX:PermSize` and `-XX:MaxPermSize` (dead since
Java 8, fatal at launch on JDK 25), `-XX:MetaspaceReclaimPolicy` (obsolete since 21), and
`-XX:-UseCompressedClassPointers` (deprecated in 25). Topic 13 owns the full retired-flag
inventory.

## Gotchas

**★ `-XX:MaxMetaspaceSize` is unlimited by default, so metaspace exhaustion usually is not an
`OutOfMemoryError` at all.**
It is unbounded native growth ending in an OOMKill or a swapping machine. Setting a limit is
what turns a container-level mystery into a Java-level error, and that diagnostic value is the
main reason to set it.

**★ `-XX:MetaspaceSize` is a GC trigger threshold, not an initial reservation.**
The source calls it *"Initial threshold (in bytes) at which a garbage collection is done to
reduce Metaspace usage"*, default 21 MB on 64-bit. Raising it delays the first class-unloading
collection; it does not reserve, allocate or limit anything. The name is doing real damage here.

**★ `CompressedClassSpaceSize` defaults to 1 GB and is absent from the `java` man page.**
Zero occurrences of "CompressedClass" in the JDK 25 tool reference. It is in `globals.hpp` and
in the Troubleshooting Guide. Its 1 GB is reserved address space, and it is why NMT's `Class`
line looks alarming on every JVM.

**★ Fixing `Compressed class space` with `-XX:-UseCompressedClassPointers` is a dead end.**
Deprecated in JDK 25, obsolete in 26, because compact object headers require compressed class
pointers and become the default in Release 27. Raise the size, or reduce the class count.

**★ `-XX:MetaspaceReclaimPolicy` is obsolete since JDK 21.**
It came from JEP 387 and is still quoted in articles about elastic metaspace. A JDK 25 JVM
rejects it at launch, which — since unrecognised `-XX:` flags are fatal — means a failed rollout
rather than a warning.

**★ A metaspace limit does not prevent a leak, and is not meant to.**
It converts the failure mode. If you set one expecting the application to survive, you have
misunderstood what it buys: an error you can attribute, hours earlier, with a stack trace.

**★ Elastic metaspace returns memory but does not defragment.**
Granules can be uncommitted independently, but metadata is never moved. A granule holding one
live allocation stays committed, so committed metaspace can exceed live metadata after churn.

**★ `-XX:PermSize` and `-XX:MaxPermSize` do not merely do nothing — they stop the JVM.**
PermGen died in Java 8, and unrecognised `-XX:` options are fatal at launch on JDK 25. These
still appear in startup scripts inherited from Java 7 era systems.

## Interview questions

**★ How is metaspace bounded, and what happens when it is not?**
By `-XX:MaxMetaspaceSize`, which by the man page's own words *"isn't limited"* by default. With
no limit, a class leak grows native memory until the container limit is reached and the kernel
kills the process — an OOMKill with a healthy heap rather than a Java error. Setting a ceiling
turns that into `OutOfMemoryError: Metaspace`, with a stack trace and diagnostics that name the
region.

**★ What does `-XX:MetaspaceSize=256m` actually do?**
It raises the occupancy threshold at which the JVM triggers a collection to unload classes, from
the 21 MB 64-bit default. It does not reserve 256 MB, does not limit metaspace, and does not make
it larger. Its legitimate use is an application that loads many classes at startup, where the low
default causes early full collections that can accomplish nothing because none of those classes
is unloadable yet.

**★ You see `OutOfMemoryError: Compressed class space` and you have already raised
`MaxMetaspaceSize`. What now?**
They bound different regions. The compressed class space holds `Klass` structures and is bounded
by `-XX:CompressedClassSpaceSize`, default 1 GB and absent from the man page. Raise that. Do not
reach for `-XX:-UseCompressedClassPointers`: it is deprecated in JDK 25 and obsolete in 26,
because compact object headers require compressed class pointers. And treat either error as
evidence of an unusual class count, which is worth explaining before it is worth raising a limit.

**★ Why is `UseCompressedClassPointers` being removed?**
Because compact object headers (JEP 519, a product feature in JDK 25) require compressed class
pointers — they fold a 22-bit class reference into the 64-bit header — and JEP 534 makes compact
headers the default in Release 27. A flag that turns off something the default layout depends on
cannot survive, so it is deprecated in 25 and obsolete in 26.

**★ Would you set a metaspace limit in production, and why?**
Yes, generously above the steady-state committed value, and for diagnostic reasons rather than
protective ones. Unlimited is the default, so a class leak in a container presents as an
unattributable OOMKill; a limit makes it present as `OutOfMemoryError: Metaspace` with a stack
trace, which is the difference between a two-day investigation and a ten-minute one.

**★ Does metaspace ever give memory back to the operating system?**
Since JDK 16 and JEP 387, yes. The buddy allocator commits in uniform granules that can be
uncommitted independently, so unloading classes can shrink the resident set where the older
implementation effectively held its high-water mark. It is still not compaction — metadata is
never moved — so fragmentation within committed granules is possible after heavy churn.

**★ Which metaspace flags in an inherited startup script would you delete on sight?**
`-XX:PermSize` and `-XX:MaxPermSize`, dead since Java 8 and fatal at launch on JDK 25;
`-XX:MetaspaceReclaimPolicy`, obsolete since JDK 21; and `-XX:-UseCompressedClassPointers`,
deprecated in 25. On a JDK where unrecognised `-XX:` options stop the JVM, an inherited flag list
is a rollout risk rather than a cosmetic issue.

{/* FOOTER */}
