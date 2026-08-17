---
title: "Write once, run anywhere — and where it leaks"
sidebar_label: "3 · Write once, run anywhere"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JVMS SE 25 (platform-independence of the class
> file format), JEP 400 (UTF-8 by default, 18), and the GraalVM native-image
> documentation for the trade-off comparison.

**The `.jar` you build on a MacBook runs unchanged on the Linux server because
the artifact contains no machine code — only bytecode, whose meaning the JVM
specification fixes identically everywhere. The platform-specific half of the
system is the JVM itself, installed once per machine. WORA is real and you
depend on it every deploy; it leaks only at the edges where your program
touches things the class file format never captured — native code, file
systems, and process environment.**

## Why it actually works

Three pieces, each load-bearing:

1. **The class file format is fully specified** (JVMS §4) — every instruction's
   effect, every type's semantics, `double` is IEEE-754 64-bit everywhere,
   `int` overflows identically everywhere. There is no
   "implementation-defined" corner like C's.
2. **The JVM is ported, per platform, by someone else.** Linux/x86-64,
   Linux/ARM, macOS, Windows — each has a JVM that gives bytecode the same
   observable behaviour.
3. **The standard library wraps the OS.** `Files`, `Socket`, `Thread` present
   one API; the platform differences live *below* the API line, inside the
   JDK's native implementation.

The operational consequence is the modern build pipeline: **compile once in
CI, produce one artifact, promote that same artifact through dev → staging →
production** — even when CI runs Linux containers and developers run ARM Macs.
No per-platform builds, no cross-compilation matrix. (Docker made this normal
for other languages decades after Java shipped it.)

## One spec, several implementations

"The JVM" is a specification with multiple implementations, all running the
same class files:

| Implementation | What it is |
|---|---|
| **HotSpot** | The OpenJDK JVM — the default; what every mainstream distribution ships |
| **OpenJ9** | Eclipse's JVM (IBM lineage) — different GC and JIT trade-offs, smaller footprint focus |
| **GraalVM** | HotSpot plus the Graal JIT — and **native-image**, which deliberately *abandons* WORA: it AOT-compiles your app to one platform's machine code for instant startup (Phase 12 weighs that trade) |

Distributions (Temurin, Corretto, Zulu, Oracle) are the *same* OpenJDK source
built and supported by different vendors — topic 02's subject.

## The JVM is a language platform, not a Java platform

The spec constrains class files, not source languages. Anything that emits
valid bytecode runs on the JVM and interoperates with Java libraries:

- **Kotlin** — the significant one in industry; compiles to class files that
  call and are called by Java seamlessly (topic 12 compares honestly).
- **Scala, Groovy, Clojure** — same mechanism.

This is why "Java ecosystem" outlives Java-the-syntax arguments: the JVM, the
libraries, the tooling and the operational knowledge transfer across all of
them. It is also why `invokedynamic` exists in the instruction set — it was
added (JEP 292 lineage, Java 7) largely for *non-Java* languages' dispatch,
and Java itself later used it for lambdas and string concatenation.

## Where WORA leaks

Every leak is something outside the class file's vocabulary. The complete
practical list:

| Leak | The bug it produces |
|---|---|
| **Native code** (JNI/FFM, or a library bundling `.so`/`.dylib`/`.dll`) | The jar runs only where a matching native binary for that OS *and CPU arch* exists — the ARM-Mac-to-x86-server surprise |
| **File-system case sensitivity** | `new File("Config.YML")` finds `config.yml` on macOS (case-insensitive), `FileNotFoundException` on Linux |
| **Path separators** | Hardcoded `"C:\\data"` or `"\\"` breaks off-Windows. Java APIs accept `/` on every OS — use it, or `Path.of` |
| **Default charset** (historical) | Before 18, file I/O without an explicit charset used the *platform* charset — UTF-8 on Linux, windows-1252 on Windows — the classic mojibake source. JEP 400 made UTF-8 the default everywhere from 18 |
| **Line separators** | `\n` hardcoded vs `System.lineSeparator()` — matters only for output consumed by picky Windows tooling |
| **Default locale and timezone** | `new SimpleDateFormat("MMM")` or `LocalDate.now()` silently depend on the host's settings — the server's UTC vs the laptop's IST (Phase 7 makes this discipline explicit) |
| **Process environment** | Env-var names, shell behaviour in `ProcessBuilder`, signal handling details |
| **Container limits** | Not an OS difference but a deployment one: the same jar behaves differently under a cgroup memory cap — Phase 12's heap-sizing topic |

Note what is *not* on the list: arithmetic, threading semantics, GC behaviour
differences that change correctness, library behaviour. The core language is
genuinely identical.

## The discipline that keeps WORA true

- Bundle **no** native code unless unavoidable; when a library does (Netty's
  native transports, some compression libs), confirm the deploy arch is
  covered — especially since ARM servers became common.
- Use `/` or `Path.of(...)` for paths; never `File.separator` concatenation
  gymnastics and never hardcoded `\\`.
- Name charsets explicitly at boundaries even post-18 (`StandardCharsets.UTF_8`)
  — it documents intent and survives an inherited Java 11 runtime.
- Pin the server timezone story: store `Instant`, set `-Duser.timezone=UTC`
  or configure explicitly, never trust the host default (Phase 7).
- Test on the deployment OS — which CI on Linux containers gives you for free
  when developers run Macs. The bugs the matrix catches are exactly this
  page's table.

## Gotchas

**Symptom:** works on the Mac, `FileNotFoundException` on the Linux server for a file that exists
**Cause:** case mismatch — macOS's default file system is case-insensitive, Linux's is case-sensitive; `Config.YML` matched `config.yml` locally
**Fix:** match the exact case; make CI (Linux) run the code path so the laptop's forgiveness can't hide it

**Symptom:** a dependency upgrade works everywhere except the new ARM instances, failing with `UnsatisfiedLinkError`
**Cause:** the library ships native binaries per OS/arch, and the bundled set lacks linux-aarch64
**Fix:** upgrade to a version with ARM binaries, add the platform-specific classifier artifact, or switch to the pure-Java fallback the library usually offers (slower, but WORA again)

**Symptom:** text written by the service reads fine on Linux, garbled ("mojibake") when the same jar runs on an old Windows JDK
**Cause:** pre-18 default-charset dependence — unspecified charset meant *platform* charset, so the same bytecode did different I/O per OS
**Fix:** pass `StandardCharsets.UTF_8` explicitly at every reader/writer boundary; on 18+ the default is UTF-8 everywhere (JEP 400), but explicitness survives old runtimes

**Symptom:** date-formatting or parsing behaves differently on the server than on every developer machine
**Cause:** default locale/timezone are host settings, silently consulted by `now()`, formatters and `toString`
**Fix:** store and compute in `Instant`/UTC; pass explicit `ZoneId` and `Locale` at formatting boundaries — Phase 7's `java.time` topic is the full treatment

**Symptom:** paths built with `"\\"` work in a developer's Windows-era snippet and break in the container
**Cause:** hardcoded Windows separator; Linux paths use `/`
**Fix:** `Path.of("data", "reports", name)` — or just use `/`, which Java accepts on Windows too

**Symptom:** the team debates rewriting in Kotlin and someone claims the ops runbook becomes obsolete
**Cause:** conflating language with platform — Kotlin compiles to the same class files on the same JVM
**Fix:** GC tuning, thread dumps, JFR, classpath model, deployment: all identical. The platform knowledge transfers wholesale (topic 12)

**Symptom:** after adopting GraalVM native-image, the "build once, run anywhere" pipeline broke
**Cause:** native-image is an explicit WORA trade — it produces a single-platform native executable
**Fix:** expected. Build per target platform in CI, or stay on the JVM where startup time doesn't justify the exchange (Phase 12 weighs it)

## Interview questions

**★ Why does a jar built on macOS run unchanged on a Linux server?**
The jar contains only bytecode, whose semantics the JVM spec fixes
identically on every platform; the platform-specific code is the JVM itself,
already installed on the server. The artifact is portable because machine
code was never in it.

**★ Where does "write once, run anywhere" actually break down?**
At everything the class file can't express: bundled native libraries (OS/arch
specific), file-system differences (case sensitivity, separators), host
defaults (charset before 18, locale, timezone), and environment/container
limits. The language core itself does not vary.

**★ What did JEP 400 change and what bug class did it kill?**
From Java 18, the default charset is UTF-8 on every platform. Before that,
unspecified-charset I/O used the platform default (windows-1252 vs UTF-8),
so identical bytecode performed different I/O per OS — the classic mojibake
bug. Explicit `StandardCharsets.UTF_8` remains good practice for old runtimes.

**★ What is the relationship between the JVM spec, HotSpot, and Temurin?**
The JVMS is the contract; HotSpot is the OpenJDK implementation of it;
Temurin (like Corretto or Zulu) is a vendor's build of OpenJDK with a support
lifecycle. Same class files run on all of them.

**★ How can Kotlin call Java code with no bridging layer?**
Kotlin's compiler emits standard class files — same bytecode, same object
model, same JVM. Interop is not a compatibility feature; it is the platform
working as specified. The JVM even added `invokedynamic` primarily to serve
non-Java languages (and Java's own lambdas later used it).

**What does GraalVM native-image trade away, and when is that trade right?**
It AOT-compiles to one platform's machine code: instant startup and low
memory, but per-platform builds, closed-world constraints on reflection, and
usually lower peak throughput than warmed-up JIT. Right for CLIs and
scale-to-zero; wrong for long-running hot services — Phase 12's treatment.

**Why do teams promote one artifact through environments instead of rebuilding per stage?**
Because bytecode is platform-neutral, the tested artifact *is* the deployed
artifact — eliminating "built differently for prod" as a failure class. This
is WORA's quiet operational payoff.

---

← Prev: [The JVM at run time](02-the-jvm-at-run-time.md) · Index: [What Java is](README.md)
