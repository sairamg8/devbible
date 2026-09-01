---
title: "JMH is not a library you call, it is a code generator that writes the benchmark around your method — which is why adding the jar to your build does nothing, and why the harness can defend against optimisations you would forget"
sidebar_label: "03 · What JMH is"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH `README.md`** on `master`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/README.md)) and the
> **JMH samples** `JMHSample_01_HelloWorld` and `JMHSample_02_BenchmarkModes`. Latest
> released JMH on Maven Central: **1.37** (`org.openjdk.jmh:jmh-core`). JDK 25.
> 🔴 **No sandbox** — no benchmark project was generated or run for this page.

**The single most useful sentence about JMH is a negative one, and it is in the project's own
README: adding the jar to your build is not enough. JMH is not a testing library. It is an
annotation processor that generates a benchmark program, and the generated program is the
thing that runs.**

## The claim, in the project's words

> *"NOTE: JMH is not intended to be used in the same way as a typical testing library such as
> JUnit. Simply adding the `jmh-core` jar file to your build is not enough to be able to run
> benchmarks."*

and, from the first sample:

> *"JMH works as follows: users annotate the methods with `@Benchmark`, and then JMH produces
> the generated code to run this particular benchmark as reliably as possible. In general one
> might think about `@Benchmark` methods as the benchmark "payload", the things we want to
> measure. The surrounding infrastructure is provided by the harness itself."*

🔴 **"Payload" is the right mental model.** You supply a method; the harness supplies the
loop, the timing, the result sink, the warm-up schedule, the forked JVMs and the statistics.
That division is why the defences from [02b](02b-dead-code-elimination.md) and
[02c](02c-constant-folding-and-loop-hoisting.md) are structural rather than disciplinary —
they live in code you did not write and cannot forget to write.

## Where the generated code lives, and why you should read it

`JMHSample_02_BenchmarkModes` gives the path and the reason:

> *"When you are puzzled with some particular behavior, it usually helps to look into the
> generated code. You might see the code is doing not something you intend it to do. Good
> experiments always follow up on the experimental setup, and cross-checking the generated
> code is an important part of that follow up."*

> *"The generated code for this particular sample is somewhere at
> `target/generated-sources/annotations/.../JMHSample_02_BenchmarkModes.java`"*

⚠️ **This is the debugging tool most JMH users never touch.** If a result is strange, the
generated class shows you the actual loop, the actual sink, and what the harness thinks your
`@State` object's lifecycle is.

## The infrastructure has a cost, and the harness tells you what it is

The hello-world benchmark is deliberately empty:

```java
@Benchmark
public void wellHelloThere() {
    // this method was intentionally left blank.
}
```

and the sample explains why an empty benchmark is worth running:

> *"Although this benchmark measures "nothing" it is a good showcase for the overheads the
> infrastructure bear on the code you measure in the method. There are no magical
> infrastructures which incur no overhead, and it is important to know what are the infra
> overheads you are dealing with."*

with the scale stated as *"in most of our measurements, it is down to several cycles per
call."* 🔴 **Several cycles is not zero.** If the thing you are measuring is also a few
cycles, the harness overhead is a material fraction of your result, and the honest response
is to benchmark a larger unit of work rather than to fight for resolution you cannot have.

## What the harness does *not* promise

The README is unusually candid, and this belongs on any page that recommends JMH:

> *"Your benchmarks should be peer-reviewed. Do not assume that a nice harness will magically
> free you from considering benchmarking pitfalls. We only promise to make avoiding them
> easier, not avoiding them completely."*

⚠️ **JMH removes the mechanical failures, not the experimental design ones.** It cannot tell
you that your input distribution is unrealistic, that your `@State` is shared when it should
not be, that you are measuring a cache-resident working set, or that the thing you optimised
is not on the critical path in production. Those are still yours. See
[What a microbenchmark cannot tell you](09-what-a-microbenchmark-cannot-tell-you.md).

## Two other harness behaviours worth knowing early

- **A benchmark that never finishes hangs the run.** *"if the benchmark method never
  finishes, then JMH run never finishes as well."*
- **An exception ends that benchmark, not the run.** *"If you throw an exception from the
  method body the JMH run ends abruptly for this benchmark and JMH will run the next
  benchmark down the list."* ⚠️ In a long overnight suite, this is how a benchmark silently
  disappears from the results table rather than failing loudly.
- **Method names do not matter.** *"the methods names are non-essential, and it only matters
  that the methods are marked with `@Benchmark`."* Names are for you and for the `-i`/include
  regex.

## The run model in one paragraph

Build produces a self-contained jar: *"JMH generates self-contained JARs, bundling JMH
together with it."* You run that jar. It forks fresh JVMs, runs warm-up iterations in each,
runs measurement iterations, aggregates across forks, and prints a table with a score and an
error. Every one of those steps is a defence against something from
[02](02-why-the-jvm-defeats-naive-timing.md): the fork against profile pollution, the warm-up
against the tier ladder, the aggregation against run-to-run variance, the error bar against
over-reading a single number.

The runtime options live behind `-h`: *"The runtime options for the JMH are available with
"-h": `$ java -jar target/benchmarks.jar -h`"*. See
[Project setup](03b-project-setup.md) for how that jar comes to exist.

## Gotchas

🔴 **Adding `jmh-core` as a dependency and calling it from a JUnit test is the single most
common JMH mistake.** Without the annotation processor there is no generated harness, so
either nothing runs or you are timing a plain method call with none of the defences.

🔴 **The benchmark you read is not the code that ran.** Anything that surprises you should be
checked against `target/generated-sources/annotations/`. Reasoning about the source you wrote
while the harness runs something else is how people conclude the JVM is "random".

⚠️ **Harness overhead of "several cycles per call" sets a floor on what is measurable.**
Sub-nanosecond operations cannot be resolved individually; measure a batch and report per
operation, using `@OperationsPerInvocation` honestly.

⚠️ **A thrown exception removes a benchmark from the results without failing the build.**
Check that the results table contains every benchmark you expected before comparing numbers.

⚠️ **`jmh-core` and `jmh-generator-annprocess` must be the same version.** Mixed versions
produce generated code that does not match the runtime, and the failures are obscure. The
README's advice when anything is odd is to regenerate a clean archetype project and transplant
the benchmark, *"since the minute differences in the build configurations may attribute to
the failures you are seeing."*

⚠️ **JMH's own defences do not extend past your method boundary.** If your benchmark calls
into your production code, the optimiser sees the whole thing together after inlining; the
sink at the boundary does not protect intermediate work inside.

## Interview questions

**★ Why is "just add the JMH dependency" not enough?**
Because JMH is an annotation-processor-driven code generator, not a library you call. The
README says it explicitly — it is *"not intended to be used in the same way as a typical
testing library such as JUnit"* and adding `jmh-core` alone will not let you run benchmarks.
Without the processor there is no generated harness.

**★ What does the harness supply that your method does not?**
The measurement loop, timing, the result sink that limits dead-code elimination, warm-up and
measurement iteration scheduling, forked JVMs, and the statistical aggregation across forks.
Your `@Benchmark` method is only the payload.

**★ Why run an empty benchmark?**
To measure the harness's own overhead, which the samples describe as being down to several
cycles per call in most of their measurements. It gives you the floor below which no result
is meaningful, and a baseline against which an eliminated computation shows up.

**★ Where do you look when a JMH result makes no sense?**
The generated sources under `target/generated-sources/annotations/`. The samples recommend
cross-checking the generated code as part of following up on the experimental setup.

**★ What does JMH explicitly not promise?**
That it removes benchmarking pitfalls. The README asks for peer review and says the project
only promises *"to make avoiding them easier, not avoiding them completely"*. Design errors —
unrealistic inputs, wrong scope, measuring the wrong unit — survive the harness.

**★ What happens if a benchmark method throws?**
That benchmark ends abruptly and JMH continues with the next one. The run does not fail as a
whole, so a benchmark can vanish from a results table without an obvious error — check the
table is complete before drawing conclusions.

**★ What happens if a benchmark method never returns?**
The JMH run never finishes either. There is no per-invocation timeout on your payload; an
accidental infinite loop hangs the suite.

**★ Do benchmark method names matter?**
Not to the harness — only the `@Benchmark` annotation matters. Names matter to you, and to
the include regex you pass on the command line to select which benchmarks run.

Next: [Project setup](03b-project-setup.md).

{/* FOOTER */}
