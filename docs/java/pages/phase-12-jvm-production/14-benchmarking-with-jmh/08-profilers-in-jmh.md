---
title: "-prof gc turns a benchmark from a stopwatch into an experiment, because allocation per operation is a number the JIT cannot flatter and the machine's mood cannot move"
sidebar_label: "08 · Profilers in JMH"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against **`JMHSample_35_Profilers`** in the OpenJDK JMH repository
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/jmh-samples/src/main/java/org/openjdk/jmh/samples/JMHSample_35_Profilers.java)),
> whose source comments contain every output table quoted on this page. 🔴 **Those tables are
> JMH's, reproduced from the sample's comments — no profiler was run here.** JMH 1.37, JDK 25.
> ⚠️ The sample's own output predates JDK 25 (it shows `PS_Eden_Space`, i.e. Parallel GC);
> the *shape* is what matters, and on JDK 25 the space names will be G1's by default.

**A score tells you that something changed. A profiler tells you what changed. JMH ships
several, they attach to the forked JVM automatically, and the most useful of them costs one
command-line flag.**

## The framing, from the sample

> *"JMH has a few very handy profilers that help to understand your benchmarks. While these
> profilers are not the substitute for full-fledged external profilers, in many cases, these
> are handy to quickly dig into the benchmark behavior. When you are doing many cycles of
> tuning up the benchmark code itself, it is important to have a quick turnaround for the
> results."*

> *"Use `-lprof` to list the profilers. There are quite a few profilers … Many profilers have
> their own options, usually accessible via `-prof <profiler-name>:help`."*

🔴 **`-lprof` first.** Availability depends on the platform and the JVM — the `perf` family is
Linux-only ([08b](08b-the-perf-family.md)) — so the list is the authority, not a blog post.

## `-prof gc` — the most valuable flag in JMH

Quoted from the sample's comments:

```
Benchmark                                              (type)  Mode  Cnt    Score     Error   Units
JMHSample_35_Profilers.Maps.test                      hashmap  avgt    5  1553.201 ±   6.199   ns/op
JMHSample_35_Profilers.Maps.test:gc.alloc.rate        hashmap  avgt    5  1257.046 ±   5.675  MB/sec
JMHSample_35_Profilers.Maps.test:gc.alloc.rate.norm   hashmap  avgt    5  2048.001 ±   0.001    B/op
JMHSample_35_Profilers.Maps.test:gc.churn.PS_Eden_Space      hashmap  avgt 5 1259.148 ± 315.277 MB/sec
JMHSample_35_Profilers.Maps.test:gc.count             hashmap  avgt    5    29.000            counts
JMHSample_35_Profilers.Maps.test:gc.time              hashmap  avgt    5    16.000                ms
```

and the reading:

> *""gc.alloc" would say we are allocating 1257 and 377 MB of objects per second, or 2048 bytes
> per benchmark operation. "gc.churn" would say that GC removes the same amount of garbage from
> Eden space every second. In other words, we are producing 2048 bytes of garbage per benchmark
> operation."*

> *"If you look closely at the test, you can get a (correct) hypothesis this is due to Integer
> autoboxing."*

🔴 **`gc.alloc.rate.norm` — bytes per operation — is the number to build habits around.** It is
*normalised*, so it does not move when the machine is busy, and it is a property of your code
rather than of the run. A change in allocation per operation is a real change; a 3% change in
`ns/op` may not be ([07b](07b-reading-the-error-bars.md)).

The sample is careful about the two counters' failure modes:

> *"Note that "gc.alloc" counters generally produce more accurate data, but they can also fail
> when threads come and go over the course of the benchmark. "gc.churn" values are updated on
> each GC event, and so if you want a more accurate data, running longer and/or with small heap
> would help. But anyhow, always cross-reference "gc.alloc" and "gc.churn" values with each
> other to get a complete picture."*

and about normalised versus raw:

> *"non-normalized counters are dependent on benchmark performance! Here, "treemap" tests are 3x
> slower, and thus both allocation and churn rates are also comparably lower. It is often useful
> to look into non-normalized counters to see if the test is allocation/GC-bound (figure the
> allocation pressure "ceiling" for your configuration!), and normalized counters to see the
> more precise benchmark behavior."*

⚠️ **A slower benchmark automatically shows a lower allocation *rate*.** Comparing `MB/sec`
between two implementations of different speed is comparing throughput, not allocation
behaviour. Compare `B/op`.

## `-prof stack` — is the code even running?

```
78.0%  78.0% java.util.TreeMap.getEntry
21.2%  21.2% org.openjdk.jmh.samples.JMHSample_35_Profilers$Maps.test
 0.4%   0.4% java.lang.Integer.valueOf
```

> *"Stack profiler is useful to quickly see if the code we are stressing actually executes. As
> many other sampling profilers, it is susceptible for sampling bias: it can fail to notice
> quickly executing methods, for example. In the benchmark above, it does not notice
> `HashMap.get`."*

🔴 **This is the third defence against [02b](02b-dead-code-elimination.md)'s silent failure**,
after the baseline method and the allocation counter: if your method does not appear in the
stack profile at all, it may not be running. ⚠️ And note the documented bias — *absence is
weak evidence*, since a fast method can be missed entirely. Topic 06 owns the
sampling-bias argument in general; see
[JFR and profiling](../06-jfr-and-profiling/README.md).

## `-prof cl` — classloading

```
JMHSample_35_Profilers.Classy.load:class.load       avgt   15  29374.097 ±  716.743  classes/sec
JMHSample_35_Profilers.Classy.load:class.load.norm  avgt   15      1.000 ±    0.001   classes/op
JMHSample_35_Profilers.Classy.load:class.unload     avgt   15  29598.233 ± 3420.181  classes/sec
```

> *"This profiler is handy when doing the classloading performance work, because it says if the
> classes were actually loaded, and not reused across the `Class.forName` calls. It also helps
> to see if the benchmark performs any classloading in the measurement phase. For example, if
> you have non-classloading benchmark, you would expect these metrics be zero."*

⚠️ **Non-zero `class.load.norm` in a benchmark that should not be loading classes is a
warm-up failure** — lazy initialisation still happening inside the measurement window.

## `-prof comp` — is the JIT still busy?

```
JMHSample_35_Profilers.Classy.load:compiler.time.profiled  avgt    5      5.000  ms
JMHSample_35_Profilers.Classy.load:compiler.time.total     avgt    5    479.000  ms
```

> *"We seem to be at proper steady state: out of 479 ms of total compiler work, only 5 ms happen
> during the measurement window. It is expected to have some level of background compilation
> even at steady state."*

🔴 **This is the objective test for "was warm-up long enough".** Sloping iterations are the
symptom; `compiler.time.profiled` as a fraction of `compiler.time.total` is the measurement.
⚠️ And note the caveat — *some* background compilation at steady state is normal, so the target
is a small fraction, not zero.

## Use profilers with several forks

Repeated twice in the sample, for both profiler pairs:

> *"As most profilers, [these] are able to aggregate samples from multiple forks. It is a good
> idea to run multiple forks with the profilers enabled, as it improves results error
> estimates."*

## Gotchas

🔴 **Compare `gc.alloc.rate.norm`, not `gc.alloc.rate`.** The rate is a function of how fast the
benchmark runs; the normalised value is a property of the code.

🔴 **Profilers change the thing they measure.** They are cheap, not free — attach them when
investigating, and take your headline numbers from a clean run.

⚠️ **Cross-reference `gc.alloc` with `gc.churn`.** The sample says allocation counters can fail
when threads come and go, and churn is only updated on GC events; agreement between the two is
what makes either credible.

⚠️ **The sample's output shows `PS_Eden_Space`** — Parallel GC space names from an older JDK.
On JDK 25 the default is G1 and the space names differ; the phase's collector facts live in
[02 · GC in practice](../02-gc-in-practice/README.md).

⚠️ **`gc.count` and `gc.time` have no error term in the sample's output.** They are counts over
the run, not per-iteration statistics — do not read them as precise comparables.

⚠️ **A stack profile that shows the JMH stub methods prominently is expected**, not a defect;
the generated harness is real code on the stack.

⚠️ **`-prof` names and options vary by JMH version and platform.** `-lprof` and
`-prof <name>:help` are the only current answers.

## Interview questions

**★ Which JMH profiler would you attach first, and why?**
`-prof gc`, for `gc.alloc.rate.norm` — bytes allocated per operation. It is normalised, so it
does not move with machine speed, and allocation is the most common hidden cost in Java code.

**★ Why compare normalised rather than raw allocation counters?**
Because raw rates depend on benchmark speed: the sample points out that a 3× slower variant
shows proportionally lower allocation and churn rates. Bytes per operation is the property of
the code.

**★ What are `gc.alloc` and `gc.churn` measuring, and why cross-reference them?**
Allocation as reported per thread, versus garbage removed from each memory pool at GC events.
Allocation counters can fail when threads come and go; churn is only updated on collections.
The sample advises always cross-referencing them for a complete picture.

**★ How can `-prof stack` reveal a broken benchmark?**
If the code under test never appears in the samples, it may have been eliminated or never
executed. The caveat is sampling bias — the sample notes it fails to notice `HashMap.get` in
its own example — so absence is suggestive, not proof.

**★ What does `-prof comp` tell you?**
How much compiler work happened during the measurement window versus in total. A small
`compiler.time.profiled` relative to `compiler.time.total` indicates a proper steady state;
some background compilation is expected even then.

**★ When is `-prof cl` the right tool?**
When classloading is either the subject or a suspected contaminant. A benchmark that should
not load classes but shows non-zero `class.load.norm` is doing lazy initialisation inside the
measurement window.

**★ Should profilers be enabled for a single fork?**
No — the sample explicitly recommends multiple forks with profilers enabled, because the
profiler results aggregate across forks and the error estimates improve.

**★ Are JMH's profilers a substitute for a full profiler?**
No, and the sample says so. They exist for quick turnaround while iterating on a benchmark;
deep investigation belongs to JFR, JMC or async-profiler, which topic 06 covers.

Next: [The perf family](08b-the-perf-family.md).

{/* FOOTER */}
