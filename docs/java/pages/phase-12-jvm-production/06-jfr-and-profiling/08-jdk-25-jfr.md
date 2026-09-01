---
title: "JDK 25 changed profiling three times over — a CPU-time sampler that finally sees native code, a rewritten sampling mechanism that stopped risking a JVM crash, and exact method timing by instrumentation — and two of the three are explicitly qualified in ways the release notes summaries drop"
sidebar_label: "08 · What JDK 25 changed"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 509 "JFR CPU-Time Profiling (Experimental)"**, **JEP 518
> "JFR Cooperative Sampling"** and **JEP 520 "JFR Method Timing & Tracing"** — all three
> Release 25, all `Closed/Delivered` — quoted verbatim throughout
> ([openjdk.org](https://openjdk.org/jeps/509)), and the **JDK 25 `jfr` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jfr.html)).
> 🔴 **No sandbox** — no event output, profile or measurement below is a captured run. The command
> forms are the JEPs' own examples.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Three JEPs landed in JDK 25 that change what JFR profiling is. One adds a CPU-time sampler that
sees native code. One rewrites how sampling works so it can no longer crash the JVM. One adds exact
per-invocation timing by instrumentation. Two of the three carry qualifiers that almost every
summary drops — and the qualifiers are what determine whether you can use them.**

## JEP 509 · CPU-time profiling — experimental, Linux only, off by default

**What it adds.** A new event, `jdk.CPUTimeSample`, that samples using the Linux kernel's CPU
timer rather than at wall-clock intervals:

> *"The ability to accurately and precisely measure CPU-cycle consumption was added to the Linux
> kernel in version 2.6.12 via a timer that emits signals at fixed intervals of CPU time rather
> than fixed intervals of elapsed real time. Most profilers on Linux use this mechanism to produce
> CPU-time profiles."*

> *"JFR will use Linux's CPU-timer mechanism to sample the stack of every thread running Java code
> at fixed intervals of CPU time."*

🔴 **The decisive improvement is native visibility** — the first of the three deficiencies in
[07](07-execution-sampling.md):

> *"In particular, this kernel mechanism would allow JFR to correctly track CPU cycles consumed by
> Java programs even when they're running native code."*

**Three qualifiers, all in the JEP:**

1. **Experimental.** The title says so, and: *"This feature is experimental for now, so that we
   may refine it based on experience before making it permanent."* 🔴 **Say "experimental" every
   time you name it.**
2. **Linux only.** *"We add CPU-time profiling to JFR, on Linux systems only … We may add CPU-time
   profiling to JFR on other platforms in the future."*
3. **Off by default.** *"This event is not enabled by default."*

```bash
java -XX:StartFlightRecording=jdk.CPUTimeSample#enabled=true,filename=profile.jfr ...
```

⚠️ **It does not replace the execution sampler**: *"This event is similar to the existing
`jdk.ExecutionSample` event for execution-time sampling. Enabling CPU-time events does not affect
execution-time events in any way, so the two can be collected simultaneously."*

**Collect both.** They answer the two different questions from
[01](01-the-regex-that-ate-a-core.md) — where CPU goes, and where wall-clock time goes — and having
them on one timeline is exactly the correlation JFR is good at.

## JEP 518 · Cooperative sampling — a safety fix you cannot see

**Scope: Implementation.** No new API, no new event, no flag. The behaviour of existing sampling
changed, which is why it is the JEP most likely to be missed entirely.

**The problem it fixes**, from [07](07-execution-sampling.md): JFR sampled asynchronously to avoid
safepoint bias, using stack-parsing heuristics that *"are inefficient and, worse, when their
results are incorrect then they can crash the JVM"* — with crash-protection mechanisms that *"can
fail in the presence of concurrent activity such as class unloading."*

**The new mechanism**, verbatim:

> *"When it is time to take a sample, JFR's sampler thread still suspends the target thread. Rather
> than attempting to parse the stack, however, it just records the target's program counter and
> stack pointer in a sample request, which it appends to an internal thread-local queue. It then
> arranges for the target thread to stop at its next safepoint, and resumes the thread."*
>
> *"The target runs normally until its next safepoint. At that time, the safepoint handling code
> inspects the queue. If it finds any sample requests, then, for each one, it reconstructs a stack
> trace, **adjusting for safepoint bias**, and emits a JFR execution-time sampling event."*

🔴 **The trick is that the sample is *requested* at an arbitrary point and *taken* at a safepoint,
with the recorded program counter used to correct.** That is how it gets safety without simply
reintroducing the bias.

The JEP lists further advantages: creating a request *"requires hardly any work, and could be done
in response to a hardware event or inside a signal handler"*; the event-emitting code is simpler
and can allocate; and *"the sampler thread has less work to do … improving scalability."*

**Two honest caveats the JEP states itself:**

⚠️ **It does not fully solve safepoint bias.** From Future Work:

> *"Our new approach does not entirely avoid safepoint bias. In some situations, such as when
> sampling inside a method for which the HotSpot JVM has an intrinsic implementation, it may be
> impossible to parse the stack. In these cases, the recorded stack trace will reflect the last
> Java stack frame, thereby introducing some bias."*

🔴 **Intrinsics are the remaining blind spot** — and intrinsics are exactly the hot methods
(`System.arraycopy`, cryptographic primitives, `Math` operations) you might most want attributed.

⚠️ **Native code still uses the old path:** *"This approach works well when the target thread is
running Java code, whether interpreted or compiled, but not when the target thread is running
native code. In that case, we continue to use the existing approach."*

**And its verdict on the alternative** matters for [09](09-async-profiler.md):

> *"The HotSpot JVM does have an existing internal but unsupported mechanism,
> `AsyncGetCallTrace`, which is used by some third-party tools. Unfortunately, this mechanism
> relies on the same kind of risky stack-parsing heuristics that JFR uses today, but without any
> crash protection, thus it is even riskier. Another drawback is that it is based on the POSIX
> SIGPROF signal, an equivalent of which does not exist on Windows."*

## JEP 520 · Method timing and tracing — exact, and expensive on purpose

**What it adds.** Two events — `jdk.MethodTiming` and `jdk.MethodTrace` — implemented by
**bytecode instrumentation** rather than sampling, with an explicit goal:

> *"For method invocations, record complete and exact statistics rather than incomplete and inexact
> sample-based statistics."*
> *"Allow execution times and stack traces to be recorded for specific methods without requiring
> source code modifications."*

The JEP's own example:

```bash
java -XX:StartFlightRecording:jdk.MethodTrace#filter=java.util.HashMap::resize,filename=recording.jfr ...
jfr print --events jdk.MethodTrace --stack-depth 20 recording.jfr
```

🔴 **This is a genuinely different kind of answer.** Sampling tells you what is probably hot;
instrumentation tells you exactly how many times a specific method ran and how long each call took.
The JEP's motivating examples are precise questions: *"if an application takes an unusually long
time to start, tracing static initializers can reveal class loading that could be deferred"*, and
*"If a method was changed to fix a performance bug, timing its execution can confirm that the fix
was successful."*

**Methods are selectable at runtime**, not only at launch: *"Allow methods to be selected via
command-line arguments, configuration files, the `jcmd` tool, and over the network via the Java
Management Extensions API (JMX)."*

🔴 **The non-goals are the operative part:**

> *"It is not a goal to record method arguments or the values of non-static fields."*
> *"It is not a goal to time or trace methods that do not have a bytecode representation, such as
> abstract, native, or non-static non-default interface methods."*
> *"It is not a goal to time or trace a large number of methods simultaneously, since that would
> significantly degrade performance. **Use method sampling in such cases.**"*
> *"JFR generally aims to impose a CPU overhead of less than one percent. **It is not a goal to
> remain within this constraint when timing and tracing methods.**"*

**So: a few named methods, briefly, when you have a specific question.** It is a scalpel, and the
JEP says so. It is not a replacement for profiling and is explicitly not a debugger — no arguments,
no field values.

⚠️ **`native` methods cannot be traced**, because they have no bytecode. So the method whose cost
JEP 509 exists to reveal is the one JEP 520 cannot instrument.

## Using them together

The three compose into a workflow rather than competing:

1. **Continuous `default.jfc`** finds that something is wrong and when
   ([03c](03c-continuous-recording-in-production.md)).
2. **`jdk.CPUTimeSample`** (Linux, experimental) answers where CPU goes, including native — and
   `jdk.ExecutionSample` answers where wall-clock time goes. Collect both.
3. **`jdk.MethodTrace`** on the two or three methods sampling implicated, briefly, for exact counts
   and durations.
4. **JEP 518** applies throughout without being asked for — it is why step 2 is now safe.

## Gotchas

**★ `jdk.CPUTimeSample` is experimental, Linux-only, and off by default.**
All three qualifiers are in JEP 509. Naming the feature without them overstates what is available,
particularly to anyone running on macOS or Windows.

**★ It does not replace the execution sampler.**
JEP 509: enabling it *"does not affect execution-time events in any way, so the two can be collected
simultaneously"*. They answer different questions and both are worth having.

**★ JEP 518 changed nothing you can see, and everything about safety.**
Scope: Implementation. No API, no event, no flag — the existing sampling simply stopped relying on
heuristics that *"can crash the JVM"*. It is the easiest of the three to miss and the one that
applies whether or not you asked.

**★ Cooperative sampling does not fully eliminate safepoint bias.**
The JEP's own Future Work says so: methods with an intrinsic implementation may be impossible to
parse, and *"the recorded stack trace will reflect the last Java stack frame, thereby introducing
some bias"*. Intrinsics are often exactly the hot methods you care about.

**★ Native code still uses the old sampling path.**
JEP 518's new approach applies to Java code, interpreted or compiled. For native frames,
*"we continue to use the existing approach"*.

**★ `jdk.MethodTiming` and `jdk.MethodTrace` are outside the overhead aim by design.**
JEP 520 states the one-percent aim and then says remaining within it is not a goal for these events.
Enabling them broadly is contrary to the JEP's own guidance.

**★ Do not trace many methods at once.**
The non-goal is explicit: it *"would significantly degrade performance. Use method sampling in such
cases."* This is a scalpel for two or three named methods.

**★ `native` methods cannot be traced.**
No bytecode representation, so JEP 520 cannot instrument them — along with abstract and non-static
non-default interface methods. The native cost that JEP 509 finally makes visible is precisely what
JEP 520 cannot time.

**★ Method tracing is not a debugger.**
Recording method arguments and non-static field values are explicit non-goals. It answers "how often
and how long", not "with what".

**★ Methods can be selected at runtime.**
Command line, configuration file, `jcmd` or JMX — so a targeted trace does not require a restart,
which is what makes it usable during an incident.

## Interview questions

**★ What did JDK 25 change about JFR profiling?**
Three JEPs. JEP 509 added `jdk.CPUTimeSample`, a CPU-time sampler using the Linux kernel's CPU timer
that can attribute time spent in native code — experimental, Linux-only, off by default. JEP 518
rewrote the sampling mechanism to be cooperative, removing stack-parsing heuristics that could crash
the JVM. And JEP 520 added `jdk.MethodTiming` and `jdk.MethodTrace`, exact per-invocation
measurement of named methods by bytecode instrumentation.

**★ What is cooperative sampling and what problem does it solve?**
JFR used to sample asynchronously at arbitrary code locations to avoid safepoint bias, using
heuristics to parse stacks — which JEP 518 says *"can crash the JVM"*. The new approach suspends the
thread, records only its program counter and stack pointer into a thread-local queue, arranges for
it to stop at its next safepoint, and reconstructs the stack there *"adjusting for safepoint bias"*.
It gets safety without simply reintroducing the bias.

**★ Does cooperative sampling eliminate safepoint bias?**
No, and the JEP says so in its Future Work: where a method has an intrinsic implementation it may be
impossible to parse the stack, and the trace then *"will reflect the last Java stack frame, thereby
introducing some bias"*. Intrinsics — array copies, cryptographic primitives, maths operations — are
often exactly the hot code you wanted attributed, so the remaining blind spot is not an obscure one.

**★ When would you use `jdk.MethodTrace` rather than a profiler?**
When you have a specific question about a specific method that sampling cannot answer exactly: how
many times did this run, and how long did each call take. JEP 520's motivating examples are tracing
static initializers to explain slow startup, and timing a method to confirm a performance fix
worked. It is deliberately not a substitute for profiling — the JEP's non-goals warn that tracing
many methods at once *"would significantly degrade performance"* and say to use sampling instead.

**★ What can `jdk.MethodTrace` not do?**
Record method arguments or non-static field values — both explicit non-goals, so it is not a
debugger. Instrument methods without a bytecode representation, which rules out abstract, native and
non-static non-default interface methods. And stay within JFR's overhead aim: JEP 520 states the
one-percent target and then excludes itself from it.

**★ Should you enable `jdk.CPUTimeSample` in production?**
Only with the qualifiers understood. It is experimental, so its behaviour may change; it is
Linux-only, so a mixed fleet gets inconsistent data; and it is off by default, so it must be named
explicitly. Where those are acceptable it is worth enabling alongside the execution sampler rather
than instead of it, since the two answer different questions and JEP 509 confirms they can be
collected simultaneously.

**★ Why is JEP 518 the one people miss?**
Because its scope is Implementation — no new API, no new event, no flag to turn on. Nothing about
using JFR changed. What changed is that the sampler no longer relies on heuristics the JDK itself
describes as able to crash the JVM, so the safety argument for enabling profiling in production got
materially stronger without anybody doing anything.

{/* FOOTER */}
