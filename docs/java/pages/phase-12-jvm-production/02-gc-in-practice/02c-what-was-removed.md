---
title: "A garbage collection flag on JDK 25 is in one of three states — deprecated, obsolete or removed — and only the third one stops your service from starting, which is why the dangerous stale flags are the ones that produce a warning nobody reads"
sidebar_label: "02c · What was removed"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** — the "Deprecated Java
> Options", "Obsolete Java Options" and "Removed Java Options" sections and their definitions
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> the **HotSpot Virtual Machine Garbage Collection Tuning Guide, Release 25**, "The Z Garbage
> Collector"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/z-garbage-collector1.html)),
> **JEP 439**, **JEP 474** and **JEP 490**
> ([439](https://openjdk.org/jeps/439), [474](https://openjdk.org/jeps/474),
> [490](https://openjdk.org/jeps/490)),
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`runtime/arguments.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/arguments.cpp)
> (the `special_jvm_flags[]` table and the unrecognised-option path) and
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Most inherited JVM command lines contain at least one flag that no longer does what its
author intended. The JDK sorts those into three tiers with three completely different
failure modes, and the intuition most people have — "old flags just get ignored" — is right
for exactly one of the three. This page is the tiers, which garbage collection flags are in
each on JDK 25, and why the tier that merely warns is more dangerous than the tier that
crashes.**

## The three tiers, in the man page's own words

> *"Deprecated Java Options: Accepted and acted upon --- a warning is issued when they're
> used."*
>
> *"Obsolete Java Options: Accepted but ignored --- a warning is issued when they're used."*
>
> *"Removed Java Options: Removed --- using them results in an error."*

That is the whole model. A flag is either doing its job noisily, doing nothing noisily, or
stopping the JVM. The implementation lives in one table in `arguments.cpp`:

```cpp
static SpecialFlag const special_jvm_flags[] = {
  // -------------- Deprecated Flags --------------
  ...
  // -------------- Obsolete Flags - sorted by expired_in --------------
  { "PerfDataSamplingInterval", JDK_Version::undefined(), JDK_Version::jdk(25), JDK_Version::jdk(26) },
  { "MetaspaceReclaimPolicy",   JDK_Version::undefined(), JDK_Version::jdk(21), JDK_Version::undefined() },
  { "ZGenerational",            JDK_Version::jdk(23),     JDK_Version::jdk(24), JDK_Version::undefined() },
  { "ZMarkStackSpaceLimit",     JDK_Version::undefined(), JDK_Version::jdk(25), JDK_Version::undefined() },
  ...
};
```

Three version columns: **deprecated in**, **obsolete in**, **expired in**. Once a flag
expires it leaves the table altogether, and from then on the parser has never heard of it.

## Tier 3 — removed. These stop the JVM.

A flag that is not declared anywhere and not in the special table goes down this path:

```cpp
jio_fprintf(defaultStream::error_stream(),
            "Unrecognized VM option '%s'\n", argname);
JVMFlag* fuzzy_matched = JVMFlag::fuzzy_match((const char*)argname, arg_len, true);
if (fuzzy_matched != nullptr) {
  jio_fprintf(defaultStream::error_stream(),
              "Did you mean '%s%s%s'?\n", ...);
}
```

and the launch fails. On JDK 25, searching `globals.hpp`, `gc_globals.hpp` and
`arguments.cpp` at tag `jdk-25+36` finds **no trace at all** of any of these:

| Flag | Died with |
|---|---|
| `-XX:+UseConcMarkSweepGC` | CMS, removed in JDK 14 |
| `-XX:CMSInitiatingOccupancyFraction` | CMS |
| `-XX:+UseCMSInitiatingOccupancyOnly` | CMS |
| `-XX:+UseParNewGC` | the CMS young collector, removed in JDK 10 |
| `-XX:+UseParallelOldGC` | folded into `UseParallelGC`, removed in JDK 16 |
| `-XX:PermSize` / `-XX:MaxPermSize` | PermGen, removed in Java 8 |
| `-Xincgc` | the incremental CMS mode |
| `-XX:+PrintTenuringDistribution` | replaced by `-Xlog:gc+age` |
| `-XX:+PrintHeapAtGC` | replaced by `-Xlog:gc+heap` |
| `-XX:+UseGCLogFileRotation` | rotation is a unified-logging output option |
| `-XX:NumberOfGCLogFiles` | replaced by `filecount=` |
| `-XX:GCLogFileSize` | replaced by `filesize=` |

Every one of those is a failed container start, not a warning. That is the *good* outcome:
the failure is loud, immediate, and points at the exact string.

The escape hatch, `-XX:+IgnoreUnrecognizedVMOptions`, converts every one of these into
silence — including the next stale flag someone adds. Reach for it only to get a legacy
process booting while you clean up, never as a permanent setting.

## Tier 2 — obsolete. These warn and do nothing.

An obsolete-but-not-expired flag is still in the table, so the parser recognises the name and
takes this path instead:

```cpp
if (is_obsolete_flag(stripped_argname, &since)) {
  char version[256];
  since.to_string(version, sizeof(version));
  warning("Ignoring option %s; support was removed in %s", stripped_argname, version);
  return true;
}
```

The two garbage collection entries on JDK 25 are `ZGenerational` (obsolete in 24) and
`ZMarkStackSpaceLimit` (obsolete in 25). Both are accepted, both are ignored, both warn.

**This is the tier that hurts.** A `-XX:-ZGenerational` left over from a JDK 21 rollout does
not fail the deploy, does not appear in an error, and does not do what its author believed.
It emits one `[warning][gc]` line into a log that nobody greps, and the service runs with
generational ZGC while a comment in the manifest claims otherwise.

## ZGC is generational, and there is no other kind

The JDK 25 ZGC chapter carries the note in a box of its own:

> *"As of JDK 24 ZGC is a generational garbage collector. The ZGenerational option has been
> removed."*

The history in three JEPs: **JEP 439** (JDK 21) added Generational ZGC behind
`-XX:+ZGenerational`; **JEP 474** (JDK 23) flipped the default and deprecated the flag;
**JEP 490** (JDK 24) removed the non-generational implementation. JEP 490 states the
resulting behaviour precisely:

> *"`-XX:+UseZGC` — Generational ZGC is used."*
>
> *"`-XX:+UseZGC -XX:+ZGenerational` — Generational ZGC is used. An obsolete-option warning is
> printed."*
>
> *"`-XX:+UseZGC -XX:-ZGenerational` — Generational ZGC is used. An obsolete-option warning is
> printed."*

⚠️ **Note that the tuning guide's "has been removed" and the source's "obsolete" are not the
same claim, and the source is the operative one.** The implementation is gone; the *option
name* is still recognised. JEP 490 says what happens when that changes: *"The option will
expire in a future release, at which point it will not be recognized by the HotSpot JVM,
which will refuse to start."* So a leftover `-XX:-ZGenerational` is a warning today and a
tier-3 outage on some future JDK. Delete it now rather than on the day it becomes an
incident.

The one thing the flag can never do again is give you non-generational ZGC. Any article whose
advice is "enable Generational ZGC with `-XX:+ZGenerational`" is describing JDK 21 or 22 and
should be discarded rather than adapted.

## What still works, and the audit

The third tier — options that are deprecated, still honoured, and quietly costing you
something — plus Epsilon and a step-by-step audit of an inherited command line are
[02c2 · The flags that still work and shouldn't](02c2-flags-that-still-work.md).

## Gotchas

**★ On JDK 25 a stale `-XX:` GC flag fails the launch; it does not warn.**
`-XX:+UseConcMarkSweepGC`, `-XX:MaxPermSize=256m` and `-Xincgc` are unrecognised, and the JVM
prints `Unrecognized VM option` and exits. The only exception is a flag that is *obsolete but
not yet expired*, like `ZGenerational`, which warns and is ignored.
`-XX:+IgnoreUnrecognizedVMOptions` turns the failure back into silence, which is why it is
almost always the wrong fix — it hides the next stale flag too.

**★ `-XX:-ZGenerational` on JDK 25 does not give you non-generational ZGC. It gives you a
warning and generational ZGC.**
JEP 490 is explicit: with the flag set either way, *"Generational ZGC is used"*. The
implementation is gone. A startup script that still carries the flag is not configuring
anything; it is producing a log line.

**★ The dangerous tier is the one that warns, not the one that crashes.**
A removed flag is found in seconds by anyone who reads the container's exit output. An
obsolete flag runs for two years, is documented in a wiki as configuring something, and is
configuring nothing.

**★ "Obsolete" and "removed" are not synonyms in JVM documentation, and the tuning guide
uses them loosely.**
The ZGC chapter says the option *"has been removed"*; `arguments.cpp` classifies it as
obsolete with expiry undefined. Removed means the launch fails; obsolete means it does not.
When a doc page and the flag table disagree about a tier, the table is the behaviour.

**★ An expired flag leaves no trace anywhere, so you cannot look it up in the JDK.**
Once a flag passes its `expired_in` version it is deleted from `special_jvm_flags[]` as well
as from `globals.hpp`. `-XX:+PrintFlagsFinal` will not list it, `-XX:+PrintFlagsInitial` will
not list it, and the only evidence that it ever existed is the release notes of the JDK that
removed it. This is why an inherited command line has to be tested against the target JDK
rather than reasoned about.

**★ The fuzzy matcher will happily suggest a flag that is not what you meant.**
`Did you mean '(+/-)UseSerialGC'?` after a typo in a collector flag is a spelling suggestion,
not a semantic one. Take the suggestion as a hint about the parser's dictionary, not as
advice about your configuration.

## Interview questions

**★ What are the three states a JVM option can be in, and what does each do at startup?**
Deprecated — *"accepted and acted upon"*, with a warning; the option still works. Obsolete —
*"accepted but ignored"*, with a warning; the name parses and nothing happens. Removed (the
source calls it expired) — the option is unrecognised, the JVM prints
`Unrecognized VM option` and refuses to start. HotSpot tracks the first two in one table in
`arguments.cpp` with `deprecated_in`, `obsolete_in` and `expired_in` version columns; once a
flag passes `expired_in` it leaves the table and becomes tier three. The operationally
important asymmetry is that tier three is discovered instantly and tier two can survive for
years.

**★ How do you enable generational ZGC on JDK 25?**
You do not; it is the only ZGC there is. `-XX:+UseZGC` gives you generational ZGC.
Generational mode became the default in JDK 23 under JEP 474 and the non-generational
implementation was deleted in JDK 24 under JEP 490. The `ZGenerational` flag is obsolete: the
JVM still recognises the name, prints *"Ignoring option ... support was removed in"*, and
uses generational ZGC regardless of whether you wrote `+` or `-`. JEP 490 also states that
the option will expire eventually, after which the JVM *"will refuse to start"*. If a piece
of advice tells you to add `-XX:+ZGenerational`, it was written for JDK 21 or 22.

**★ You inherit a service whose start command includes `-XX:+UseConcMarkSweepGC`. What
happens when it is moved to JDK 25?**
The JVM refuses to start. CMS was removed in JDK 14, so the flag is not merely ignored — it
is unrecognised, and an unrecognised `-XX:` option prints `Unrecognized VM option` and aborts
initialisation. The tempting fix, `-XX:+IgnoreUnrecognizedVMOptions`, makes the process start
but also silences every other stale flag in the command line, so you will never discover the
next one. The right fix is to delete the flag and every CMS-specific tuning flag alongside
it — `CMSInitiatingOccupancyFraction`, `UseCMSInitiatingOccupancyOnly`, `UseParNewGC` — then
let G1's defaults run and measure.

{/* FOOTER */}
