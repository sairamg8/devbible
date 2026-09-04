---
title: "Shenandoah is conditionally compiled, its selection flag is declared unconditionally, and its tuning flags are not — so one missing build feature produces two different error messages at two different startup stages, and neither of them says the words 'not in this build'"
sidebar_label: "02b2 · Is Shenandoah in your JDK?"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/shared/gcConfig.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcConfig.cpp)
> (`IncludedGCs[]`, `fail_if_non_included_gc_is_selected()`, `FAIL_IF_SELECTED`) and
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp)
> (the unconditional `UseShenandoahGC` declaration versus the `SHENANDOAHGC_ONLY`-guarded
> `GC_SHENANDOAH_FLAGS` block); **JEP 189**
> ([openjdk.org/jeps/189](https://openjdk.org/jeps/189)) for the
> `--with-jvm-features=-shenandoahgc` build switch; the **HotSpot Virtual Machine Garbage
> Collection Tuning Guide, Release 25**, "Supported Operating Systems in Documentation"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/introduction-garbage-collection-tuning.html));
> and the **absence** of the string "Shenandoah" from the JDK 25 `java` tool reference
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)) and
> from every chapter of the JDK 25 GC tuning guide — checked by full-text search of all twelve
> fetched chapters, zero occurrences in either document.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Shenandoah is the only collector in this topic whose availability is a question. It is
compiled in or out at build time, and the JVM's reaction to asking for a collector that was
compiled out is neither an unrecognised option nor a clear "not built" message — it is an
abort during VM initialisation with wording that reads like a platform limitation. Worse,
the *tuning* flags fail at a different stage with a different message, so which error you see
depends on the order of your arguments. This page is exactly what happens, why, and the one
command that settles it.**

## Conditionally compiled, and the flag lies about it

`gcConfig.cpp` builds its table of known collectors from build-time macros:

```cpp
static const IncludedGC IncludedGCs[] = {
   ...
SHENANDOAHGC_ONLY_ARG(IncludedGC(UseShenandoahGC, CollectedHeap::Shenandoah, shenandoahArguments, "shenandoah gc"))
   ...
};

void GCConfig::fail_if_non_included_gc_is_selected() {
  ...
  NOT_SHENANDOAHGC(FAIL_IF_SELECTED(UseShenandoahGC));
  ...
}
```

where the macro expands to:

```cpp
#define FAIL_IF_SELECTED(option)                                            \
  if (option) {                                                             \
    vm_exit_during_initialization("Option -XX:+" #option " not supported"); \
  }
```

**So on a JDK built without Shenandoah, `-XX:+UseShenandoahGC` is not an unrecognised
option.** The flag is declared unconditionally in `gc_globals.hpp`, in the same block as
`UseG1GC` and `UseZGC`, with no preprocessor guard around it:

```cpp
product(bool, UseShenandoahGC, false,
        "Use the Shenandoah garbage collector")
```

It parses. It sets a boolean. Then the VM aborts during initialisation with
`Option -XX:+UseShenandoahGC not supported`. That is a different failure at a different stage
from the `Unrecognized VM option` you get for a removed flag, and it is easy to misread as
"unsupported on this platform" rather than "absent from this build".

## Two flags, two failure stages

The *tuning* flags behave differently. `gc_globals.hpp` pulls them in behind a guard:

```cpp
  SHENANDOAHGC_ONLY(GC_SHENANDOAH_FLAGS(
    develop, develop_pd, product, product_pd, range, constraint))
```

so on a build without Shenandoah, `-XX:ShenandoahGCMode=generational` really *is*
unrecognised and fails at argument parsing, before the collector is ever selected.

| Argument | Build **with** Shenandoah | Build **without** |
|---|---|---|
| `-XX:+UseShenandoahGC` | selects Shenandoah | parses, then `Option -XX:+UseShenandoahGC not supported` at VM init |
| `-XX:ShenandoahGCMode=generational` | sets the mode | `Unrecognized VM option` at parse time |

One missing build feature, two different error messages, and **which one you see depends on
which flag the parser reaches first** — argument parsing happens before collector selection,
so a command line carrying both fails at parse time with the mode flag's message, and the
operator never learns that the collector itself is missing.

JEP 189 documented the build switch and the support commitment:

> *"The Shenandoah build system disables the build on unsupported configurations
> automatically. Downstream builders may choose to disable building Shenandoah with
> `--with-jvm-features=-shenandoahgc` on otherwise supported platforms."*
>
> *"Shenandoah has been implemented and will be supported by Red Hat for aarch64 and for
> amd64."*

Note the architecture list in that second sentence. Availability is not only a vendor
question; a multi-architecture image can have Shenandoah on one platform and not on another,
and the failure appears only on the nodes running the architecture that lacks it.

## The documentation is the strongest available evidence

The claim "Oracle's JDK does not ship Shenandoah" is usually made without a citation. Here is
a checkable one: **the string "Shenandoah" does not appear anywhere in Oracle's JDK 25 `java`
tool reference, nor in any chapter of Oracle's JDK 25 HotSpot GC Tuning Guide.** Serial,
Parallel, G1 and ZGC each have a chapter and a set of documented flags. Shenandoah has
neither, and the tuning guide's scope note is written to accommodate exactly this:

> *"This document and its recommendations apply to all JDK 25 supported system
> configurations, limited by actual availability of some garbage collectors in a particular
> configuration."*

Builds that do include it — Eclipse Temurin and Red Hat's builds of OpenJDK are the ones most
teams encounter — document it themselves, and the OpenJDK Shenandoah project wiki is the
upstream reference. ⚠️ **I have not verified the current build configuration of any specific
vendor's JDK 25 binaries against a primary source, and this page will not assert one.** The
verified claims are: the collector is conditionally compiled, JEP 189 documents the
`--with-jvm-features=-shenandoahgc` switch that turns it off, and Oracle's own JDK 25
documentation does not mention it. Check your own runtime rather than trusting any list —
including this one.

## How to check, in one command

```bash
# Does this JDK have Shenandoah at all?
java -XX:+UseShenandoahGC -version
```

Three possible outcomes, each diagnostic:

| What you get | What it means |
|---|---|
| A normal `java -version` banner | Shenandoah is present and selectable |
| `Option -XX:+UseShenandoahGC not supported` during initialisation | The flag exists, the collector was not compiled in |
| `Unrecognized VM option 'UseShenandoahGC'` | Not a JDK 25 HotSpot build (the flag is declared unconditionally on 25) |

Run it inside the image you deploy, on the architecture you deploy to, not on a developer
laptop. And to confirm what you actually got once the service is running, add `-Xlog:gc` and
read the first line — `universe.cpp` logs `Using <heap name>` at startup, as described in
[02 · The four collectors](02-the-four-collectors.md).

⚠️ `jcmd <pid> VM.flags` on a *running* JVM cannot answer this question, because a JVM that
could not select Shenandoah never reached the point of having a PID. Availability is a
pre-flight check, not a runtime one.

## Gotchas

**★ `-XX:+UseShenandoahGC` on a build without Shenandoah is not a parse error — it kills the
VM during initialisation.**
The flag is declared unconditionally; only the implementation is conditional. The message is
`Option -XX:+UseShenandoahGC not supported`, produced by `vm_exit_during_initialization`. If
you are looking for `Unrecognized VM option` in a startup failure you will not find it and
may conclude the flag was accepted.

**★ `-XX:ShenandoahGCMode=generational` fails differently from `-XX:+UseShenandoahGC` on the
same build.**
The mode flag comes from `GC_SHENANDOAH_FLAGS`, which is compiled in only under
`SHENANDOAHGC_ONLY`, so on a build without Shenandoah it is genuinely unrecognised and fails
at argument parsing. One missing build feature, two error messages, and which one you see
depends on argument order — parsing runs first, so a command line with both flags reports the
mode flag and never mentions the collector.

**★ Oracle's JDK 25 documentation does not mention Shenandoah at all.**
Zero occurrences in the `java` man page and zero across every chapter of the GC tuning guide.
If your team's standard is "it must be in the vendor documentation", Shenandoah fails that
test on an Oracle JDK, and the tuning guide's scope note anticipates it: recommendations are
*"limited by actual availability of some garbage collectors in a particular configuration"*.

**★ Choosing Shenandoah couples your application to a JDK vendor — and to an architecture.**
Every other collector in this topic is present in every JDK 25 build. Shenandoah is the one
choice that makes "which base image" a correctness question rather than a preference, and
JEP 189's support statement names specific architectures (*"aarch64 and … amd64"*), so a
multi-arch deployment can be half-broken.

**★ A CI pipeline on one JDK and a production image on another turns this into an
intermittent outage.**
The most common shape: CI and local development on a Temurin image where the flag works,
production on a vendor image where it does not, and the failure appears at the first
deploy — with a message about an unsupported option that reads like a platform bug. Pin the
same JDK build everywhere, or check availability in the image build, not at deploy time.

**★ `jcmd VM.flags` cannot tell you whether Shenandoah is available.**
It queries a running JVM. A JVM that asked for an absent collector aborted during
initialisation and has no PID to query. The check has to be `java -XX:+UseShenandoahGC
-version` against the image.

**★ `-XX:+IgnoreUnrecognizedVMOptions` will hide the mode flag failure and not the collector
failure.**
It suppresses unrecognised-option errors at parse time, which covers
`-XX:ShenandoahGCMode=...`, but it does nothing about `vm_exit_during_initialization`. The
result is a JVM that ignores your mode and then dies selecting the collector — the confusing
middle case where the operator concludes the mode flag was the problem.

## Interview questions

**★ Is Shenandoah available on JDK 25?**
That depends on the build, which is the whole point. Shenandoah is an OpenJDK collector that
is conditionally compiled: JEP 189 documents `--with-jvm-features=-shenandoahgc` as the
switch downstream builders use to leave it out, and Oracle's JDK 25 documentation — both the
`java` man page and every chapter of the GC tuning guide — does not mention it at all. The
flag `UseShenandoahGC` is nonetheless declared unconditionally in `gc_globals.hpp`, so on a
build without the collector it parses and then aborts initialisation with
`Option -XX:+UseShenandoahGC not supported`. The only reliable answer is to run
`java -XX:+UseShenandoahGC -version` against the exact image and architecture you deploy.

**★ Why does `-XX:+UseShenandoahGC` behave differently from `-XX:+UseConcMarkSweepGC` on a
JDK that supports neither?**
Because they fail at different stages for different reasons. `UseConcMarkSweepGC` was removed
entirely — the name is not declared anywhere, so argument parsing prints
`Unrecognized VM option` and the JVM never initialises. `UseShenandoahGC` is declared
unconditionally in the shared GC flags, so parsing succeeds; it is the *collector selection*
step that fails, via `FAIL_IF_SELECTED` calling
`vm_exit_during_initialization("Option -XX:+UseShenandoahGC not supported")`. The practical
consequence is that a Shenandoah misconfiguration survives a naive flag-parsing check, and a
CMS one does not.

**★ Your service starts in CI and fails to start in production with a message about an
unsupported VM option. Walk through the diagnosis.**
First, read which stage failed: `Unrecognized VM option` is argument parsing, `Option -XX:+...
not supported` is VM initialisation, and they have different causes. If it is the second and
the flag is `UseShenandoahGC`, the collector was compiled out of the production JDK — the
flag exists in every JDK 25 HotSpot build, the implementation does not. Then compare the two
JDKs: vendor, version and architecture, because JEP 189 names specific architectures for
Shenandoah support and a multi-arch image can differ per node. The fix is to align the images
or to stop depending on a conditionally-compiled collector; the fix that is *not* acceptable
is `-XX:+IgnoreUnrecognizedVMOptions`, which suppresses the parse-time error and leaves the
initialisation failure intact while making the next stale flag invisible.

**★ How would you make "does this image support the collector we configured" a build-time
check rather than a deploy-time surprise?**
Run the collector selection against the image as part of the image build: a single
`RUN java -XX:+UseShenandoahGC -XX:ShenandoahGCMode=generational -version` layer fails the
build if either flag is unavailable, and costs a fraction of a second. The same technique
generalises to every GC flag in the deployment: starting a JVM with the production flag set
and `-version` exercises the entire argument parser and collector-selection path without
running the application, and catches removed flags, locked flags and absent collectors in one
step. It is the cheapest possible guard against the whole failure class in
[02c · What was removed](02c-what-was-removed.md).

{/* FOOTER */}
