---
title: "perf counts what the CPU did, perfnorm divides it by your operation count, and perfasm shows you the machine code that did it — three flags that turn 'this is slower' into 'this is slower because of a lock xadd'"
sidebar_label: "08b · The perf family"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against **`JMHSample_35_Profilers`** in the OpenJDK JMH repository
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/jmh-samples/src/main/java/org/openjdk/jmh/samples/JMHSample_35_Profilers.java)).
> 🔴 **Every output block below is quoted from that sample's source comments — nothing here
> was run or measured.** JMH 1.37, JDK 25. The sample's own run instructions mark the platform
> for each: `-prof perf`, `-prof perfnorm`, `-prof perfasm` **(Linux)**, `-prof xperfasm`
> **(Windows)**, `-prof dtraceasm` **(Mac OS X)**.

**Everything on [08](08-profilers-in-jmh.md) is portable and JVM-level. This page is the layer
below: hardware performance counters and the generated assembly. It is the difference between
knowing a benchmark got slower and knowing which instruction is stalling.**

## `-prof perf` — the raw counters, for the forked JVM only

> *"One can simply run "perf stat java -jar ..." to get the first idea how the workload behaves.
> In JMH case, however, this will cause perf to profile both host and forked JVMs."*

> *"`-prof perf` avoids that: JMH invokes perf for the forked VM alone."*

🔴 **That is the whole reason to use JMH's wrapper rather than `perf stat` by hand**: the
harness JVM is not the JVM you want to measure. Its output is `perf stat`'s, quoted from the
sample:

```
      4172.776137 task-clock (msec)         #    0.411 CPUs utilized
              612 context-switches          #    0.147 K/sec
   16,599,643,026 cycles                    #    3.978 GHz                     [30.80%]
   17,815,084,879 instructions              #    1.07  insns per cycle         [38.49%]
    3,813,373,583 branches                  #  913.870 M/sec                   [38.56%]
        1,212,788 branch-misses             #    0.03% of all branches         [38.91%]
    7,582,256,427 L1-dcache-loads           # 1817.077 M/sec                   [39.07%]
          312,913 L1-dcache-load-misses     #    0.00% of all L1-dcache hits   [38.66%]
  <not supported> stalled-cycles-frontend
```

with the sample's reading — *"this benchmark goes with good IPC, does lots of loads and lots of
stores, all of them are more or less fulfilled without misses"* — and the honest complaint that
follows: *"The data like this is not handy though: you would like to normalize the counters per
benchmark op."*

⚠️ **Two details in that block are worth naming.** The bracketed percentages are counter
multiplexing — the kernel time-shares a limited number of hardware counters, so each figure is
an extrapolation from a fraction of the run. And `<not supported>` is normal: which counters
exist depends on the CPU and on what a virtualised or containerised environment exposes.

## `-prof perfnorm` — counters per operation

> *"This is exactly what `-prof perfnorm` does"*

```
JMHSample_35_Profilers.Atomic.test                         avgt   15   6.551 ±  0.023  ns/op
JMHSample_35_Profilers.Atomic.test:CPI                     avgt    3   0.933 ±  0.026   #/op
JMHSample_35_Profilers.Atomic.test:L1-dcache-loads         avgt    3  12.267 ±  1.324   #/op
JMHSample_35_Profilers.Atomic.test:L1-dcache-load-misses   avgt    3   0.001 ±  0.022   #/op
JMHSample_35_Profilers.Atomic.test:L1-dcache-stores        avgt    3   4.090 ±  0.402   #/op
```

> *""perfnorm", again, can (and should!) be used with multiple forks, to properly estimate the
> metrics."*

🔴 **`#/op` is the same idea as `gc.alloc.rate.norm`** from [08](08-profilers-in-jmh.md):
divide by the operation count and the number stops depending on how fast the machine happened
to be. "12.3 L1 loads per operation" is a statement about your code. ⚠️ Note the sample's own
`Cnt` column — 3 for the counters against 15 for the score — a reminder that counter samples
are fewer and noisier than the score they annotate.

## `-prof perfasm` — the hottest generated code

> *"It is important to follow up on generated code when dealing with fine-grained benchmarks.
> We could employ PrintAssembly to dump the generated code, but it will dump *all* the
> generated code, and figuring out what is related to our benchmark is a daunting task. But we
> have "perf" that can tell what program addresses are really hot! This enables us to contrast
> the assembly output."*

> *"`-prof perfasm` would indeed contrast out the hottest loop in the generated code! It will
> also point fingers at "lock xadd" as the hottest instruction in our code. Hardware counters
> are not very precise about the instruction addresses, so sometimes they attribute the events
> to the adjacent code lines."*

```
Hottest code regions (>10.00% "cycles" events):
....[Hottest Region 1]...............................................................
 [0x7f1824f87c45:0x7f1824f87c79] in org.openjdk.jmh.samples.generated.JMHSample_35_Profilers_Atomic_test::test_avgt_jmhStub
                    0x00007f1824f87c25: test   %r11d,%r11d
                    0x00007f1824f87c28: jne    0x00007f1824f87cbd  ;*ifeq
```

⚠️ **"Sometimes they attribute the events to the adjacent code lines" is the caveat to carry
into every reading of a perfasm dump.** Skid means the hottest *line* may be a neighbour of the
real culprit; read the region, not the single row.

🔴 **`perfasm` is also the honest answer to "did my change actually change the code?"** — you
can see the instructions, including whether a call was inlined, whether a bound check survived,
and whether the loop was vectorised.

## Platform reality

The sample's run block gives the platform mapping directly:

| Flag | Platform |
|---|---|
| `-prof perf`, `-prof perfnorm`, `-prof perfasm` | Linux |
| `-prof xperfasm` | Windows |
| `-prof dtraceasm` | Mac OS X |

⚠️ **The assembly profilers need a disassembler the JVM can load** (`hsdis`), or they print the
addresses without instructions. And `perf` itself needs permission: hardware counters are
commonly restricted by `perf_event_paranoid` and are often unavailable inside containers or on
cloud instances.

🔴 **Note also that the sample runs `perf` and `perfasm` with `-f 1` and `perfnorm` with
`-f 3`.** The assembly profilers produce a large dump per fork; the counter profilers want
several forks for their error estimates. That is a deliberate asymmetry, not an inconsistency.

## Gotchas

🔴 **`perf stat java -jar benchmarks.jar` profiles the wrong process** — or rather, both
processes. Use `-prof perf` so the counters attach to the forked JVM alone.

🔴 **Counter multiplexing means the numbers are extrapolations.** The bracketed percentages in
the output say how much of the run each counter was actually scheduled for; treat a counter
measured 30% of the time accordingly.

⚠️ **`<not supported>` counters are common on virtual machines and in containers.** Absent
hardware counters are an environment fact, not a JMH failure.

⚠️ **Instruction attribution skids.** Hardware sampling is imprecise about addresses, so a hot
instruction may be reported one or two lines away from the real one.

⚠️ **`perfasm` output is enormous.** Run it on one fork, on one benchmark, after you already
know from a score and `perfnorm` that there is something to look at.

⚠️ **Without `hsdis` the assembly profilers degrade to addresses.** Installing a disassembler
is part of the setup, and its availability varies by JDK distribution.

⚠️ **Hardware counters are per-core and the OS moves threads.** The `cpu-migrations` and
`context-switches` rows in the output are not decoration — a benchmark that migrates constantly
is measuring the scheduler as much as the code.

⚠️ **Do not compare counter values across machines.** Cache sizes, prefetchers and even counter
definitions differ; compare within a machine, between variants.

## Interview questions

**★ Why use `-prof perf` rather than running `perf stat` on the benchmark jar?**
Because the harness runs in one JVM and forks another. `perf stat` on the launcher profiles
both; `-prof perf` attaches to the forked VM alone, which is the one executing the benchmark.

**★ What does `perfnorm` add over `perf`?**
Normalisation per benchmark operation — counters reported as `#/op` instead of totals or rates,
so they describe the code rather than the run. The sample says it can and should be used with
multiple forks to estimate the metrics properly.

**★ What is `CPI` and why is it useful?**
Cycles per instruction — the reciprocal of IPC. It tells you whether the code is
instruction-bound or stalling on memory and branches. Combined with cache-miss counts per
operation it usually identifies which.

**★ What do the bracketed percentages in `perf` output mean?**
The proportion of the run for which that counter was actually scheduled. Hardware counters are
multiplexed, so the printed values are extrapolations from partial sampling.

**★ What does `perfasm` give you that `PrintAssembly` does not?**
Focus. `PrintAssembly` dumps all generated code; `perfasm` uses hardware sampling to identify
the hot addresses and prints those regions, contrasting the code that actually consumes cycles.

**★ What is the main caveat when reading a `perfasm` region?**
Attribution skid — the sample notes hardware counters *"are not very precise about the
instruction addresses, so sometimes they attribute the events to the adjacent code lines"*.
Read the region as a whole.

**★ Which of these profilers work on macOS and Windows?**
The assembly profiler has platform variants: `perfasm` on Linux, `xperfasm` on Windows,
`dtraceasm` on macOS. The `perf`/`perfnorm` counter profilers are the Linux `perf` wrappers.

**★ Why might none of the perf profilers work on your cloud CI box?**
Hardware counters are frequently restricted or unavailable in virtualised and containerised
environments, and the kernel's `perf_event` permissions may forbid them. Expect
`<not supported>` rows or an unavailable profiler, and fall back to `-prof gc` and `-prof comp`.

Next: [What a microbenchmark cannot tell you](09-what-a-microbenchmark-cannot-tell-you.md).

{/* FOOTER */}
