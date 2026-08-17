---
title: "The JVM at run time"
sidebar_label: "2 · The JVM at run time"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JVMS SE 25 §5 (loading, linking, initializing),
> the JDK 25 `java` launcher reference, and the HotSpot runtime overview in the
> JDK documentation.

**When you type `java -jar app.jar`, no code in the jar is compiled to machine
code yet, and almost none of it is even loaded. The JVM loads classes lazily,
verifies each one before trusting it, starts by interpreting bytecode, and
promotes only the methods that prove hot to native code. A Java process is
slowest in exactly the minutes after it starts — by design.**

## From `java -jar` to your first line

The sequence, in order:

1. **The launcher starts a JVM** inside the new process and reads config: the
   jar's manifest (`Main-Class:`), classpath, `-D` properties, `-Xmx` and
   friends.
2. **The main class is loaded** — its bytes located on the classpath, parsed,
   and **verified**.
3. **Linking**: verification (is this bytecode well-formed and type-safe?),
   preparation (static fields get default values), and resolution of symbolic
   references — mostly deferred until first use.
4. **Initialization**: static initializers and `static { }` blocks run — at
   first *active use* of the class, not at load.
5. **`main(String[] args)` runs on the "main" thread**, interpreted.
6. As methods get called repeatedly, the **JIT compiles the hot ones** in the
   background; execution switches to native versions as they become ready.

Two words in that list do daily work: *lazily* and *verified*.

## Lazy loading: classes arrive at first use

The JVM does not scan the jar up front. A class loads when something first
references it. Three practical consequences:

- **Startup touches a fraction of the code.** A missing dependency for a
  code path nobody hit yet fails *later*, at first use — as
  `NoClassDefFoundError` in the middle of handling a request, not at boot.
- **Static initializers run at unpredictable-feeling times** — first active
  use. An expensive `static` block is a landmine that detonates on the first
  request that touches the class, not at deploy.
- Frameworks that *do* scan everything at startup (Spring's component scan)
  are doing extra, deliberate work on top of the lazy default — one reason a
  Spring boot takes seconds while `java HelloWorld` takes milliseconds.

## Verification: the JVM does not trust bytecode

Before a class runs, the verifier proves the bytecode is structurally sound:
the stack cannot over/underflow, every instruction gets operands of the type
it expects, jumps land on instruction boundaries, private members stay
private. This is why bytecode from any source — `javac`, Kotlin's compiler, a
bytecode-generating library, an attacker — meets the same wall.

For an application developer this surfaces exactly one way: a
`java.lang.VerifyError` almost always means **corrupted or version-mismatched
bytecode on the classpath** — most often a library instrumented or shaded
badly, or two half-matching versions of the same library. It is not your bug;
it is your dependency tree's bug (Phase 8's `dependency:tree` is the tool).

## Interpret first, compile what's hot

Execution starts in the **interpreter** — each bytecode instruction dispatched
one at a time. Meanwhile HotSpot counts invocations and loop iterations.
Methods that cross thresholds get compiled by the JIT compilers (C1 quickly
with light optimization, C2 slower with heavy optimization) on background
threads, and calls switch over to the native versions. Hot loops can even be
swapped *mid-execution* (on-stack replacement).

The model to keep: **a Java service's performance is a function of how long it
has been running.** The first 100 requests after a restart execute a mix of
interpreted and lightly-compiled code; the next 100,000 run C2-optimized
native code. This is *warm-up*, it is measured in requests as much as seconds,
and it is why:

- benchmarks that don't warm up measure the interpreter (Phase 12's JMH topic);
- rolling deploys briefly raise latency on every restarted instance;
- "restart it" has a real cost even when it fixes the symptom.

The full mechanism — tiers, thresholds, deoptimization — is topic 07.

## What "managed runtime" buys you

The JVM stands between your code and the OS and provides, without opt-in:

- **Memory safety**: no raw pointers, array bounds checked, no
  use-after-free — the entire class of memory-corruption CVEs that dominate
  C/C++ security advisories is absent by construction.
- **Garbage collection**: you allocate, the JVM reclaims (topic 08; tuning in
  Phase 12).
- **A thread model**: `Thread` maps onto OS threads — and since 21, virtual
  threads multiplex cheaply onto few OS threads (Phase 6).
- **Uniform exceptions**: a `NullPointerException` with a stack trace instead
  of a segfault; an `OutOfMemoryError` instead of silent corruption.
- **Observability hooks**: thread dumps, heap dumps, JFR profiling — built
  into the runtime, attachable to a live production process (Phase 12).

The bill for all of it: memory overhead (object headers, GC headroom), warm-up
time, and GC pauses. Phase 12 is about paying that bill knowingly.

## When does the process actually exit?

The JVM exits when one of these happens:

- **All non-daemon threads have terminated.** `main` returning does *not* end
  the process if other non-daemon threads are alive — a thread pool with
  default (non-daemon) threads keeps the JVM running after `main` finishes.
- `System.exit(n)` runs shutdown hooks and terminates — in an application
  server or test runner, it kills threads that are not yours; treat it as
  forbidden outside `main`-adjacent CLI code.
- A signal (SIGTERM from an orchestrator) triggers shutdown hooks — the
  graceful-shutdown story your deploys depend on (Phase 12).

## Gotchas

**Symptom:** `main` finished but the process never exits; CI hangs on a "passed" run
**Cause:** a non-daemon thread is still alive — an `ExecutorService` nobody shut down, a scheduled timer, a client library's background thread
**Fix:** `executor.shutdown()` in a finally/close path, or mark helper threads as daemons via a `ThreadFactory`. A thread dump (`jcmd <pid> Thread.print`) names the culprit instantly

**Symptom:** `NoClassDefFoundError` mid-request, hours after a clean startup
**Cause:** lazy loading — the class was first *used* just now, and its bytes are missing/broken on the classpath; startup never touched it
**Fix:** the missing jar goes back on the classpath (Phase 8's dependency work). Distinguish from `ClassNotFoundException` — that story is topic 05

**Symptom:** first request after deploy takes 900ms; the same request takes 40ms an hour later
**Cause:** warm-up — interpreted/C1 code serving early traffic, C2-compiled code serving later traffic; possibly also lazy class loading and connection-pool fill on the first request
**Fix:** expected behaviour to plan around: health-check warm-up requests, gradual traffic shifting in deploys. Measuring "cold" numbers as the service's performance is a benchmarking error

**Symptom:** `ExceptionInInitializerError` once, then `NoClassDefFoundError` for the same class forever after
**Cause:** a static initializer threw; the class is marked failed and every later use gets the terser second error — the *original* cause appeared exactly once, at first use
**Fix:** find the first occurrence in the logs (it wraps the real exception). Keep static initializers trivial; move fallible work (I/O, config reads) out of them

**Symptom:** a test framework or server logs "JVM exited unexpectedly" with no stack trace
**Cause:** library or test code called `System.exit()`, tearing down every thread in the process
**Fix:** never call it outside a CLI's outermost layer; test runners can install a blocking `System.exit` interceptor. Search the diff for `exit(`

**Symptom:** `java.lang.VerifyError` on startup after a dependency upgrade
**Cause:** malformed or mismatched bytecode — typically a badly shaded jar, a bytecode-instrumenting agent meeting a class file newer than it understands, or two versions of a library interleaved
**Fix:** `mvn dependency:tree` for duplicates; upgrade the instrumenting agent (the usual suspect after a JDK bump); rebuild the shaded artifact

**Symptom:** the service is up (port open) but the orchestrator's first probes fail or time out
**Cause:** "started" ≠ "ready" — class loading, pool initialization and JIT warm-up are still in progress when the socket opens
**Fix:** separate liveness from readiness (Phase 9's Actuator topic); readiness reports true only after initialization actually completes

## Interview questions

**★ Walk through what happens when you run `java -jar app.jar`.**
Process starts a JVM; the launcher reads the manifest's `Main-Class`; that
class is loaded, verified, prepared and initialized; `main` runs interpreted
on the main thread; classes continue to load lazily at first use; the JIT
compiles hot methods in the background and execution migrates to native code.
The process exits when all non-daemon threads end.

**★ Why is a Java service slower right after a restart, and what follows from that operationally?**
Execution starts interpreted; the JIT needs real traffic to identify and
compile hot paths, so early requests run slower code. Operationally: rolling
restarts cost tail latency per instance, benchmarks need warm-up, and
"restart fixed it" still bought you a warm-up bill.

**★ When do static initializers run — and what is the failure mode?**
At the class's first *active use*, not at load or startup. If one throws, the
first caller gets `ExceptionInInitializerError` with the real cause; the class
is then permanently failed and later uses get bare `NoClassDefFoundError` —
so the diagnosis lives at the first occurrence only.

**★ `main` returned but the JVM didn't exit. Why?**
Non-daemon threads are still running — the JVM exits only when the last
non-daemon thread ends. Typical culprits: un-shut-down executors, timers,
client libraries' background threads. Daemon threads, by contrast, die with
the JVM.

**★ What does bytecode verification protect against, and when do you meet it?**
It proves type-safety and structural soundness of every loaded class —
protecting the runtime from malformed or malicious bytecode regardless of
which compiler produced it. In practice you meet it as `VerifyError`, which
almost always indicates a broken/mismatched dependency or an outdated
instrumentation agent, not your code.

**What does "managed runtime" mean, concretely?**
The JVM provides memory safety (no raw pointers, bounds checks), garbage
collection, a thread model, structured exceptions instead of segfaults, and
built-in observability (thread/heap dumps, JFR) — in exchange for memory
overhead, warm-up, and GC pauses.

**Why does Spring take seconds to start when `java HelloWorld` takes milliseconds?**
The JVM itself is lazy and fast to start; Spring deliberately front-loads
work — scanning the classpath, building the bean graph, initializing pools —
trading startup time for fail-fast configuration and ready-at-boot behaviour.

**Is `System.exit()` ever appropriate?**
At the outermost layer of a CLI to set the process exit code. Inside servers,
libraries or tests it terminates every thread in the shared process and skips
normal unwinding — a bug, not a shutdown strategy.

---

← Prev: [Source to bytecode](01-source-to-bytecode.md) · Next → [Write once, run anywhere](03-write-once-run-anywhere.md)
