---
title: "The classic execution sampler misses threads running native code, does not report the samples it failed to take, and samples only a subset of threads each interval — three deficiencies the JDK itself enumerates, which is why a hot method in a profile is a claim about the sampler as much as about your program"
sidebar_label: "07 · Execution sampling"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 509 "JFR CPU-Time Profiling (Experimental)"**, whose
> Motivation enumerates the execution sampler's deficiencies verbatim
> ([openjdk.org](https://openjdk.org/jeps/509)), and **JEP 518 "JFR Cooperative Sampling"**
> (Release 25) for how sampling is implemented and what safepoint bias is
> ([openjdk.org](https://openjdk.org/jeps/518)).
> 🔴 **No sandbox** — no profile, percentage or sample count below is a measurement.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Every sampled profile is an inference: the sampler looked N times, saw a method M times, and you
conclude the method accounts for M/N of the resource. That inference is only as good as the
sampling, and the JDK's own documentation is unusually candid about where JFR's classic execution
sampler falls short. This page is how it works and the three deficiencies JEP 509 lists — because
knowing them is what stops you over-trusting a profile.**

## How it works

JEP 518 describes the mechanism:

> *"JFR can create an execution-time profile that shows which program elements consume significant
> elapsed real time, i.e., wall-clock time. It does this by sampling the execution stacks of
> program threads at fixed intervals of, say, 20 milliseconds. Each sample produces a JFR event
> containing a stack trace."*

**Note "elapsed real time".** The classic `jdk.ExecutionSample` samples at intervals of *wall-clock*
time, not CPU time — which makes it an execution-time profile rather than a CPU profile, and
[01](01-the-regex-that-ate-a-core.md) established that those are different measurements with
different answers.

To take a sample, the sampler needs to walk another thread's stack, and JEP 518 explains why that
is hard:

> *"In order to produce a stack trace for a program thread, JFR's sampler thread must suspend the
> target thread and parse the call frames on the stack. The HotSpot JVM maintains metadata to guide
> the parsing of stack frames, but that metadata is valid only when a thread is suspended at
> well-defined code locations known as safepoints."*

## 🔴 The three deficiencies, from JEP 509

The JDK's own list, verbatim:

> *"This mechanism works on all OS platforms, but it suffers from some deficiencies:*
> - *It only samples threads that are currently executing Java code and not native code called
>   from Java code.*
> - *When it tries to obtain a sample, it may fail for technical reasons, and it doesn't report the
>   number of such missed samples.*
> - *It selects only a subset of threads for sampling at each interval."*

and the conclusion the JEP draws:

> *"Consequently, the resulting profile may be inaccurate and not reflect the actual CPU usage
> profile. The inaccuracies are likely to be greater when collecting the samples over a relatively
> short period (say, one minute)."*

**Each of those has a practical consequence:**

**1 · Native code is invisible.** Time spent inside a native method — compression, cryptography, a
JNI call, some I/O paths — is not attributed. So a profile can show a Java method as inexpensive
while most of its cost is in the native call it makes. ⚠️ This interacts with
[04b](../05-thread-dumps/04b-runnable-does-not-mean-running.md)'s point about `RUNNABLE`: the JVM's
visibility ends at the same boundary in both tools.

**2 · Failed samples are silent.** The sampler may fail and **does not report how often**. So the
denominator in your mental M/N is unknown, and there is no indication when it is unreliable. A
profile does not have an error bar and cannot be given one.

**3 · Only a subset of threads is sampled per interval.** On a service with many threads, any
individual thread is sampled less often than the interval suggests. Whether that biases the profile
depends on whether the subset selection correlates with what threads are doing — which is not
something you can check.

🔴 **And the last sentence is the practical rule: short recordings are less trustworthy.** The JEP
names *"say, one minute"* as the regime where inaccuracies are likely greater. **Profile over a
representative period, not over the ninety seconds you had.**

## Safepoint bias — the classic objection

JEP 518 states the problem and why it is not simply solved:

> *"If we sample stacks only at safepoints, however, then we will likely suffer from the safepoint
> bias problem: We risk losing accuracy, since a frequently-executed span of code might not be
> anywhere near a safepoint. The safepoint bias problem is well known and thoroughly researched."*

**The mechanism of the bias:** the JVM inserts safepoint polls at certain places — method returns,
loop back-edges — and not others. Some code runs a long way between safepoints; famously, tight
counted loops may have no poll inside them at all because the JIT can prove they terminate. If you
can only sample at safepoints, **that code is systematically under-sampled** and the cost appears
attributed to whatever ran next.

⚠️ **It is not random error, it is bias**: more samples do not fix it, because the same code is
missed every time. That is why it matters more than the sampling noise people usually worry about.

**JFR's historical answer was to sample asynchronously**, outside safepoints — with the consequence
JEP 518 describes:

> *"Since the metadata for parsing stack frames is not guaranteed to be valid at non-safepoints,
> JFR's sampler thread uses heuristics in order to generate a stack trace. Unfortunately, these
> stack-parsing heuristics are inefficient and, worse, when their results are incorrect then they
> can crash the JVM."*

🔴 **That is the JDK saying its own profiler could crash the VM.** JDK 25 changes it —
[08](08-jdk-25-jfr.md) covers what JEP 518 replaced it with, and the honest caveat it kept.

## What a "hot method" actually means

Given all of the above, the correct reading of a profile entry:

**"This method's frame was on the stack in 62% of the samples that succeeded, from the threads that
were selected, at moments the sampler was able to observe."**

That is still enormously useful — it is far better than intuition, and the errors are usually
smaller than the differences you are looking for. But it licenses different conclusions than people
usually draw:

| ✅ Supported | ❌ Not supported |
|---|---|
| This method is a major consumer | This method takes exactly 62% |
| These two methods differ substantially | These two differ by 3% |
| The profile changed after the fix | The profile improved by 11% |
| This is where to look first | This is the complete list |

🔴 **Use profiles to rank and to compare, not to measure.** A profile is a directional instrument.
Treating its percentages as measurements is how a 3% difference between two runs becomes an
argument.

## Reading one well

**Self time versus total time.** Total includes callees; self is the method's own work. A method
with high total and low self is a *path*, not a hotspot — the cost is below it. Optimising it
usually means changing how often it is called rather than what it does.

**Look at the tree, not the list.** A flat list of hot methods shows `HashMap.get` at the top, which
tells you nothing actionable. The call tree shows *which* caller is doing all the lookups, which
is the thing you can change.

**Compare against a baseline.** A profile in isolation shows what a program does; a profile against
a healthy one shows what *changed*. This is the strongest argument for continuous recording
([03c](03c-continuous-recording-in-production.md)) — you always have the comparison.

**Expect the answer to be boring.** Serialisation, logging, string formatting, a collection lookup
in the wrong place, a regex. The interesting-looking code is rarely the expensive code, which is
the entire reason to measure rather than reason.

## Gotchas

**★ The classic execution sampler misses native code.**
JEP 509: it *"only samples threads that are currently executing Java code and not native code
called from Java code"*. A Java method whose cost is in a native call looks cheap.

**★ Failed samples are not reported.**
The JEP says it *"may fail for technical reasons, and it doesn't report the number of such missed
samples"*. The denominator is unknown and there is no signal when it is unreliable, so a profile
cannot carry an error bar.

**★ Only a subset of threads is sampled each interval.**
So on a many-threaded service each thread is sampled less than the interval implies, and whether
that biases the result is not checkable from the profile.

**★ Short recordings are explicitly less trustworthy.**
JEP 509: inaccuracies *"are likely to be greater when collecting the samples over a relatively
short period (say, one minute)"*. Profile over a representative period, not over the time you
happened to have.

**★ Safepoint bias is bias, not noise.**
The same code is missed every time, so more samples do not correct it. Tight counted loops with no
safepoint poll are the classic case, and their cost is attributed to whatever ran next.

**★ `jdk.ExecutionSample` is wall-clock, not CPU.**
It samples at fixed intervals of elapsed real time. That makes it an execution-time profile — which
is the right tool for a latency question and the wrong one for a CPU question.

**★ The historical async sampler could crash the JVM.**
JEP 518 says the stack-parsing heuristics *"are inefficient and, worse, when their results are
incorrect then they can crash the JVM"*. This is the JDK's assessment of its own implementation,
and it is why JDK 25 replaced it.

**★ A high-total, low-self method is a path, not a hotspot.**
The cost is below it. Optimising the method itself does nothing; changing how often it is called
might.

**★ A flat list of hot methods is often useless.**
`HashMap.get` at the top is not actionable. The call tree identifies which caller is responsible,
which is the thing you can change.

**★ Profiles rank; they do not measure.**
Given unknown failed samples, subset selection and safepoint bias, a 3% difference between two
profiles is not a finding. Use them to compare and prioritise, not to quantify.

**★ The answer is usually boring.**
Serialisation, logging, formatting, a lookup in the wrong place. That the expensive code is rarely
the interesting code is exactly why measuring beats reasoning.

## Interview questions

**★ How does JFR's execution sampler work?**
A sampler thread periodically — at fixed intervals of elapsed real time, JEP 518 uses 20 ms as its
example — suspends target threads and walks their stacks, emitting a stack trace as an event. The
resulting profile is an execution-time profile, showing where wall-clock time is spent, and it is
built by aggregating those samples into proportions.

**★ What are its known limitations?**
JEP 509 lists three: it only samples threads executing Java code, not native code called from Java;
when a sample fails it does not report how many were missed; and it selects only a subset of threads
each interval. The JEP concludes that the profile *"may be inaccurate"*, and that inaccuracies are
likely greater over short collection periods — it names about a minute.

**★ What is safepoint bias?**
The JVM can only reliably parse a thread's stack at a safepoint, but safepoint polls are not evenly
distributed through the code — a tight counted loop may contain none. Sampling only at safepoints
therefore systematically under-samples code that runs far from one, and attributes its cost
elsewhere. JEP 518 calls the problem *"well known and thoroughly researched"*. The key property is
that it is bias rather than noise: more samples do not correct it.

**★ Why did JFR historically sample asynchronously, and what did that cost?**
To avoid safepoint bias, it suspended threads and parsed stacks at arbitrary locations. But the
JVM's frame-parsing metadata is only guaranteed valid at safepoints, so it relied on heuristics —
which JEP 518 describes as *"inefficient and, worse, when their results are incorrect then they can
crash the JVM"*. Accuracy was bought with a stability risk, which is what JDK 25 set out to remove.

**★ A profile says a method accounts for 62% of samples. What can you conclude?**
That it is a major consumer and the right place to look first. Not that it takes exactly 62% of the
time — the denominator excludes failed samples that are not counted, the thread subset selection is
unknown, native time is missing, and safepoint bias may shift attribution. Profiles are reliable for
ranking and comparison and unreliable as measurements, so a small difference between two profiles is
not a finding.

**★ Two profiles differ by 3% on a method. Is that a real improvement?**
Not on that evidence. Given unreported failed samples, per-interval thread subsetting and safepoint
bias, a difference that small is within the noise and possible systematic error of the instrument.
The right response is to compare over longer, representative periods, and to look for a change large
enough to be unambiguous — or to measure the thing directly with a benchmark, which is topic 14's
subject.

**★ How do you read a profile beyond finding the top method?**
Distinguish self time from total time, since a high-total low-self method is a path rather than a
hotspot and optimising it does nothing. Read the call tree rather than the flat list, because
`HashMap.get` at the top is not actionable while the caller doing all the lookups is. And compare
against a baseline from a healthy period, which turns "this is what the program does" into "this is
what changed" — the reason continuous recording pays off.

{/* FOOTER */}
