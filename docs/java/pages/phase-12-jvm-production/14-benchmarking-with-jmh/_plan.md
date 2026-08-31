# Topic 14 · Benchmarking with JMH — chunk plan

Tier: **Know**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **measuring small code correctly**: the harness, and every way the JVM invalidates a
naive measurement. 🔴 **06 owns profiling a running service** (finding *where*); this topic
owns comparing two implementations (deciding *which*). It is not a load-testing topic.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-benchmark-that-measured-nothing.md` | `nanoTime` around a loop, and the four things it actually measured |
| 2 | `02-why-the-jvm-defeats-naive-timing.md` | Interpreter → C1 → C2, OSR, and profile-guided speculation |
| 2b | `02b-dead-code-elimination.md` | The compiler deleted your benchmark because nothing read the result |
| 2c | `02c-constant-folding-and-loop-hoisting.md` | A constant input turns your method into a literal |
| 3 | `03-what-jmh-is.md` | Generated harness code, separate forks, and why it is not a library call |
| 3b | `03b-project-setup.md` | The archetype, the annotation processor, and why the `-jar` run is the supported one |
| 4 | `04-the-annotations.md` | `@Benchmark`, `@BenchmarkMode`, `@OutputTimeUnit`, `@Warmup`, `@Measurement`, `@Fork` |
| 4b | `04b-modes.md` | Throughput, AverageTime, SampleTime, SingleShotTime — and which answers your question |
| 5 | `05-state.md` | `@State` scopes, `@Setup`/`@TearDown` levels, and the shared field that serialised everything |
| 6 | `06-blackholes.md` | Consuming results; the implicit return-value sink; `Blackhole.consumeCPU` |
| 6b | `06b-compiler-blackholes.md` | The JDK-level blackhole and why it replaced the old trick |
| 7 | `07-forks-and-warmup.md` | 🔴 Why one fork is not enough: profile pollution across benchmarks |
| 7b | `07b-reading-the-error-bars.md` | Score, error, confidence — a difference inside the error is not a difference |
| 8 | `08-profilers-in-jmh.md` | `-prof gc`, `-prof perfasm`, `-prof async`; allocation rate as the honest metric |
| 9 | `09-what-a-microbenchmark-cannot-tell-you.md` | Cache behaviour at scale, GC over hours, real input distributions |
| 10 | `10-benchmarks-in-ci.md` | Noise, dedicated hardware, and regression gates that do not flake |
| 11 | `11-the-checklist.md` | Writing, running and *believing* a benchmark |

## Verify, do not assume
- ⚠️ 🔴 The current JMH version and whether the archetype is still the documented setup.
- ⚠️ The exact `@Setup(Level.…)` values and their semantics — from the JMH samples.
- ⚠️ Whether compiler blackholes are on by default on JDK 25 and the flag that controls them.
- ⚠️ **No fabricated benchmark scores.** If a page shows a result table, it must be quoted
  from the JMH samples or clearly labelled as an illustrative shape.
