---
title: "Swapping produces the worst time-to-safepoint numbers of any cause and no JVM flag touches it, a JNI critical section is the one kind of native code that really does block a safepoint, and the flag that names the guilty thread is useless until you also set the delay — its default is ten seconds"
sidebar_label: "10c · Diagnosing it"
sidebar_position: 40
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`runtime/globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/globals.hpp)
> for the declared defaults and descriptions of `SafepointTimeout` (`false`),
> `SafepointTimeoutDelay` (`10000`, a `double`, *"supports sub-millisecond resolution with
> fractional values"*), `AbortVMOnSafepointTimeout` and `AbortVMOnSafepointTimeoutDelay` (both
> `DIAGNOSTIC`); and
> [`runtime/safepoint.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/safepoint.cpp)
> for the `# SafepointSynchronize: Finished after` warning. Also **JEP 518 · JFR Cooperative
> Sampling**, whose Future Work section concedes it *"does not entirely avoid safepoint bias"*.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[10b](10b-what-makes-time-to-safepoint-long.md) covered the counted loop, which is the cause
everyone has heard of. In production it is frequently not the cause. This page is the rest of the
list — in the order the causes are worth checking rather than the order they are famous — and the
two flags that turn "a safepoint took 900 ms" into "this thread took 900 ms to arrive".**

## The other causes, in the order they are worth checking

**Swapping and page faults.** A thread that must touch a swapped-out page to reach its next poll
waits for disk. This is the cause with the worst ratio of impact to obscurity: time-to-safepoint
goes to whole seconds, nothing in the JVM is at fault, no JVM flag affects it, and the fix is to
stop the machine swapping. Container memory accounting makes it more likely than it used to be,
because a JVM sized against a limit it shares with the page cache can push the host into reclaim
— [03 · Heap sizing in containers](../03-heap-sizing-in-containers/README.md). Check this first
precisely because it is nobody's first guess.

**JNI critical sections.** `GetPrimitiveArrayCritical` hands native code a raw pointer into the
heap, so the collector cannot move anything until it is released. Unlike ordinary native code —
which is safepoint-safe and not waited for, per [10](10-safepoints.md) — a critical section
genuinely blocks the safepoint for its full duration. Compression, cryptography and image
libraries use these, so this is an ordinary cause in an ordinary application, not an exotic one,
and it is the single exception to the otherwise reliable rule that native threads are free.

**Very deep or very numerous stacks.** Reaching the safepoint includes the per-thread work of
getting there. It is usually negligible; on a service with thousands of platform threads and deep
stacks it stops being negligible, and it is one of the quieter arguments for virtual threads —
[Phase 6 · Concurrency](../../phase-6-concurrency/README.md).

**Machine-level contention.** If the JVM's threads are not being scheduled — a noisy neighbour, a
cgroup CPU quota being throttled — they cannot reach a poll. The safepoint log shows a long
"Reaching safepoint" with no JVM-level explanation, and the answer is outside the JVM. This is
worth checking early on any platform with CPU limits, because throttling produces exactly this
signature and is invisible from inside the process.

**Long-running native calls that are not critical sections are *not* a cause**, and it is worth
stating explicitly because it is the first guess most people make. Those threads are
safepoint-safe and are not waited for.

## Diagnosing it

`-Xlog:safepoint` is the first move and usually the last: the "Reaching safepoint" column either
is or is not the problem, and the question is settled in a minute. What it does not tell you is
*which thread* was late.

For that, `globals.hpp` provides:

| Flag | Default | The source's description |
|---|---|---|
| `-XX:+SafepointTimeout` | `false` | *"Time out and warn or fail after SafepointTimeoutDelay milliseconds if failed to reach safepoint"* |
| `-XX:SafepointTimeoutDelay` | `10000` | *"Delay in milliseconds for option SafepointTimeout; supports sub-millisecond resolution with fractional values."* |
| `-XX:+AbortVMOnSafepointTimeout` | `false` | *"Abort upon failure to reach safepoint (see SafepointTimeout)"* — `DIAGNOSTIC` |
| `-XX:AbortVMOnSafepointTimeoutDelay` | `0` | *"Delay in milliseconds for option AbortVMOnSafepointTimeout"* — `DIAGNOSTIC` |

🔴 **The pairing is the point.** `SafepointTimeout` alone, with its default 10-second delay, will
never fire for a problem measured in hundreds of milliseconds — the flag looks like it does
nothing. Set the delay near your actual latency budget:

```
-XX:+SafepointTimeout -XX:SafepointTimeoutDelay=100
```

and the JVM warns and names the threads that failed to arrive in time, which converts an
unexplained global stall into a specific stack to go and look at. **That the delay is a `double`
supporting sub-millisecond values, and says so in its own description, is the source telling you
it expects a small number.**

`AbortVMOnSafepointTimeout` escalates the warning into a crash with a full dump at the moment of
the stall. It is `DIAGNOSTIC`, needs `-XX:+UnlockDiagnosticVMOptions`, and is a deliberate choice
for a reproduction environment — never a production setting.

`safepoint.cpp` also emits, under its limit check:

```
"# SafepointSynchronize: Finished after %6d ms"
```

at warning level, which is the same idea reported after the fact rather than while waiting.

## Safepoint bias, and why this is also a profiling topic

Any profiler that samples stacks at safepoints can only ever observe threads at safepoint polls —
so code between polls is systematically under-sampled, and the profile is biased toward the
places where polls happen to be. This is **safepoint bias**, and it is the standard argument for
async-profiler's signal-based sampling over safepoint-based sampling.

It connects to [10b](10b-what-makes-time-to-safepoint-long.md) in a way that is easy to miss:
**strip mining changes where the polls are**, so it changes the bias. A counted loop with no poll
is invisible to a safepoint-based profiler no matter how much time is spent in it; enable strip
mining and it becomes visible — but only at chunk boundaries, which is a different distortion
rather than none.

This is not an argument for disabling strip mining. It is an argument for an instrument that does
not depend on safepoints at all. JDK 25's own answer is **JEP 518 · JFR Cooperative Sampling**,
which improves matters substantially and still concedes in its own Future Work that it *"does not
entirely avoid safepoint bias"*. That argument, and async-profiler's, are
[06 · JFR and profiling](../06-jfr-and-profiling/README.md).

## Gotchas

**★ Swapping produces the worst time-to-safepoint numbers of any cause, and no JVM flag helps.**
A thread that must fault in a page to reach its next poll waits on disk, and "Reaching safepoint"
goes to seconds. The JVM is blameless and the fix is at the machine or container level — which is
also why it is so rarely the first thing checked by the person reading the JVM's logs.

**★ JNI critical sections do block safepoints, unlike ordinary native code.**
`GetPrimitiveArrayCritical` holds a raw pointer into the heap, so nothing can move until it is
released. This is the one exception to the otherwise-reliable rule that native threads are
safepoint-safe, and compression, crypto and image libraries all use it — so it is an ordinary
cause, not an exotic one.

**★ CPU throttling looks exactly like a JVM problem and is not one.**
A cgroup CPU quota being exhausted stops threads being scheduled, so they cannot reach a poll.
The safepoint log shows a long "Reaching safepoint" with nothing inside the JVM to blame. Check
throttling metrics early on any platform that enforces CPU limits.

**★ `SafepointTimeout` with its default 10-second delay will never fire for a latency problem.**
The flag is close to useless unpaired. Set `SafepointTimeoutDelay` near your actual budget —
100 ms, or lower. That the delay is a `double` supporting fractional values, and says so, is the
source telling you what magnitude it expects.

**★ `AbortVMOnSafepointTimeout` is `DIAGNOSTIC` and crashes the JVM deliberately.**
It converts the warning into a termination with a full dump. Exactly right in a reproduction
environment, exactly wrong in production, and it needs `-XX:+UnlockDiagnosticVMOptions` to be
accepted at all — which is the JVM signalling the same thing.

**★ Long native calls are not a cause; people guess them first anyway.**
A thread in a JNI call or blocked in a syscall is safepoint-safe and is not waited for. Time
spent investigating "we have some slow native code" is usually time wasted, unless that code is
inside a critical section.

**★ Thousands of platform threads with deep stacks make arrival itself expensive.**
The per-thread work of reaching a safepoint is normally negligible and stops being so at scale.
It is a quiet argument for virtual threads, and a reason that "just raise the pool size" has a
cost that does not appear in any pool metric.

**★ Strip mining moves the polls, so it shifts safepoint bias rather than removing it.**
A profiler that samples at safepoints sees a different — not a better — picture once polls appear
at chunk boundaries. The conclusion is to use a profiler that does not sample at safepoints, not
to turn off strip mining.

**★ JEP 518 improves safepoint bias and its own text says it does not eliminate it.**
Cooperative sampling is a real improvement in JDK 25 and it is not a solution to the class of
problem. Anyone quoting it as "JFR no longer has safepoint bias" is overstating what the JEP
claims for itself.

**★ Time-to-safepoint problems are invisible to every GC metric, including the good ones.**
Allocation rate, promotion rate, live data size and pause distribution can all be healthy while
the application loses hundreds of milliseconds per collection. The only instrument that shows it
is the safepoint log — which is the argument for leaving `-Xlog:safepoint` on.

## Interview questions

**★ Time-to-safepoint is 900 ms and there is no obvious loop. What else do you check?**
First, swapping — a thread that has to fault a page in from disk before it reaches its next poll
waits on the disk, and this produces the worst numbers of any cause while the JVM is entirely
blameless. Check the machine's paging activity and the container's memory accounting. Second, JNI
critical sections: `GetPrimitiveArrayCritical` hands native code a raw pointer into the heap, so
the collector cannot move anything until it is released, and unlike ordinary native code — which
is safepoint-safe and not waited for — that region really does block the safepoint. Compression,
crypto and imaging libraries use it. Third, scheduling: if the JVM's threads are not getting CPU,
because of a noisy neighbour or a cgroup CPU quota, they cannot reach a poll, and the explanation
is outside the JVM entirely. Fourth, sheer scale — thousands of platform threads with deep stacks
make the arrival work itself non-trivial. To find out which thread is responsible, set
`-XX:+SafepointTimeout` with `-XX:SafepointTimeoutDelay` near your latency budget rather than at
its 10-second default, and the JVM names the stragglers.

**★ How would you configure a JVM to name the thread that is holding up safepoints?**
`-XX:+SafepointTimeout -XX:SafepointTimeoutDelay=100`, adjusting the delay to something
meaningful for the service's latency budget. The default delay is 10000 ms, which will never fire
for a problem measured in hundreds of milliseconds — the flag is close to useless without the
delay being set, which is the part people miss. The source describes the delay as supporting
*"sub-millisecond resolution with fractional values"*, which is a fairly direct hint that it is
expected to be set small. When the timeout fires, the JVM warns and identifies the threads that
failed to reach the safepoint in time, which converts an unexplained global stall into a specific
stack to go and look at. In a reproduction environment you can escalate to
`-XX:+AbortVMOnSafepointTimeout`, which crashes the JVM with a full dump at that moment — it is a
`DIAGNOSTIC` flag needing `-XX:+UnlockDiagnosticVMOptions`, and it is emphatically not a
production setting.

**★ What is safepoint bias, and how does it connect to strip mining?**
Safepoint bias is the sampling error that afflicts any profiler which collects stacks at
safepoints: it can only observe threads where polls exist, so code executing between polls is
systematically under-represented and the profile points at the poll sites rather than at the hot
code. The connection to strip mining is that the flags controlling where polls are placed
therefore also control the bias. A counted loop with no poll is invisible to such a profiler no
matter how much time is spent in it; enable strip mining and polls appear every thousand
iterations, so the loop becomes visible — but at the chunk boundaries, which is a different
distortion rather than none. That is why the answer is not to tune poll placement for the
profiler's benefit but to use an instrument that does not depend on safepoints: async-profiler's
signal-based sampling, or JFR with JEP 518 cooperative sampling on JDK 25 — which improves matters
substantially and still concedes in its own text that it does not entirely eliminate the bias.

**★ Why is a JNI critical section different from any other native code, from the safepoint's point
of view?**
Because of what it is allowed to do to the heap. Ordinary native code cannot touch Java objects
without going through JNI accessors that respect the collector's state, so a thread inside it has
a stable Java stack that is not in the collector's way — the JVM marks it safepoint-safe on the
transition out and never waits for it. `GetPrimitiveArrayCritical` breaks that contract
deliberately: it hands back a raw pointer into the array's storage so the native code can operate
on it at full speed, which means the collector must not move that array, which means it must not
run a relocating collection at all until the corresponding release call. So the region behaves
like an uninterruptible section from the safepoint protocol's perspective, and its duration is
added directly to time-to-safepoint. It matters practically because the libraries that use it are
the ones everyone has — compression, cryptography, image codecs — so "we do not write JNI" is not
a reason to rule it out.

**★ Why is `-Xlog:safepoint` worth leaving on in production when most GC logging is not?**
Because of the ratio between what it costs and what it is the only source of. It is `info` level
and emits one line per safepoint — not per collection phase, not per object age, one line — so on
a service with a healthy safepoint rate it is a trivial volume, comparable to ordinary
application logging and far below the age or ergonomics tracing discussed elsewhere in this
topic. Against that, it is the only place time-to-safepoint appears anywhere in the JVM's output.
Not the GC log, which reports the work at the safepoint; not the Micrometer GC metrics, which are
sourced from GC notifications and inherit the same blind spot; not a thread dump, which is taken
after the fact. So the alternative to having it on is not having a cheaper source of the same
information — it is not having the information, and discovering during an incident that the
diagnosis requires a restart with an extra flag. That is the argument, and it is one of the few
cases in this phase where "just leave it on" is the right default.

{/* FOOTER */}
