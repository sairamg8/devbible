---
title: "A flame graph's x-axis is not time and its left-to-right order is alphabetical, which means every instinct to read it as a timeline is wrong — width is the only dimension that carries information, and the widest thing at the top is the answer"
sidebar_label: "09b · Flame graphs"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **async-profiler's `docs/FlamegraphInterpretation.md`**, quoted
> verbatim, and its README
> ([github.com/async-profiler/async-profiler](https://github.com/async-profiler/async-profiler/blob/master/docs/FlamegraphInterpretation.md)),
> and **JEP 509** for the properties of the sampled data a flame graph is built from
> ([openjdk.org](https://openjdk.org/jeps/509)).
> 🔴 **No sandbox** — no flame graph, sample count or percentage below is a captured run. The
> worked example is the project documentation's own.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A flame graph is the standard way to look at a profile, and it is routinely misread in exactly
one way: as something happening over time. It is not. Understanding how one is built from samples
takes two minutes and it fixes the misreading permanently — which is why the project's own
documentation opens by saying that is the way to learn it.**

## How one is built

The documentation's approach: *"To interpret a flame graph, the best way forward is to understand
how it is created."*

**Step 1 — sample.** *"Profiling starts by taking samples `X` times per second. Whenever a sample
is taken, the current call stack for it is saved."*

Its worked example collects:

> - *`func3()->func7()`: 3 samples*
> - *`func4()`: 1 sample*
> - *`func1()->func5()`: 2 samples*
> - *`func2()->func6()->func8()`: 4 samples*
> - *`func2()->func6()`: 1 sample*

**Step 2 — sort.** *"Samples are then alphabetically sorted at the base level just after root (or
main method) of the application."*

🔴 **Alphabetically.** That single word disposes of every timeline reading.

**Step 3 — aggregate.** *"The blocks for the same functions at each level of stack depth are then
stitched together to get an aggregated view."*

## 🔴 The x-axis is not a timeline

Stated outright:

> *"Note that X-axis is no longer a timeline. Flame graph does not preserve information on **when**
> a particular stack trace was taken, it only indicates **how often** a stack trace was observed
> during profiling."*

**Three consequences that are all mistakes people make:**

**You cannot see a spike.** A method that consumed everything for two seconds and nothing for the
rest of a five-minute profile is one wide block, indistinguishable from a method that consumed a
little the whole time. Flame graphs aggregate; the timeline is gone. ⚠️ If *when* is the question,
you need the timeline — JFR's event stream ([04](04-the-event-model.md)) or Mission Control's
timeline pages, not a flame graph.

**Left-to-right adjacency means nothing.** Two neighbouring blocks are neighbours because of
alphabetical order. They did not run in that sequence, and one did not call the other.

**Nothing "starts" on the left.** There is no beginning and no end. The root is the bottom.

## What the dimensions actually mean

| Dimension | Meaning |
|---|---|
| **Width** | 🔴 **The only dimension carrying information.** Proportion of samples in which this frame was on the stack |
| **Height / y-axis** | Stack depth. A frame sits on its caller |
| **Left-to-right order** | ⚠️ **Alphabetical. Nothing.** |
| **Colour** | Frame type in async-profiler's palette — Java, native, kernel and so on. ⚠️ *"Colors may have different meaning in various flame graph implementations"* |

**So reading one reduces to a single rule: look for wide plateaus at the top.**

The documentation's own conclusion on its example:

> *"In this example, except `func4()`, no other function actually consumes any resource at the base
> level of stack depth. `func5()`, `func6()`, `func7()` and `func8()` are the ones consuming
> resources, with `func8()` being a likely candidate for performance optimization."*

🔴 **`func8()` is the answer because it is wide *and* at the top — nothing above it.** A wide block
with wide children is a *path*: the cost is below it, and optimising it does nothing. This is the
graphical form of the self-time-versus-total-time distinction from
[07](07-execution-sampling.md).

## Reading one in practice

**Look at the top edge.** The frames with nothing above them are where the resource is actually
being consumed. Everything below is call structure.

**Find wide plateaus, ignore narrow spires.** A tall narrow tower is a deep call chain that costs
little. It looks dramatic and is irrelevant.

**Check whose frames they are.** A wide plateau in framework or JDK code usually means *your* code
is calling it too often — the fix is above it, not in it. Colour helps: a wide native or kernel
plateau is a different investigation entirely, and one JFR would not have shown you
([09](09-async-profiler.md)).

**Compare two graphs rather than reading one.** A profile in isolation shows what the program does;
against a baseline it shows what changed. Differential flame graphs make this explicit, and even
side by side beats interpretation from first principles.

## What kind of flame graph you are looking at

⚠️ **The same picture means different things depending on the profiling mode**, and the mode is not
visible in the graph:

- **CPU** — width is CPU consumed. Blocked threads barely appear. The default and the most common.
- **Wall clock** — width is elapsed time. **Waiting shows up**, so a socket read can dominate. This
  is the right mode for a latency question and the wrong one for a CPU question
  ([01](01-the-regex-that-ate-a-core.md)).
- **Allocation** — width is bytes allocated, not time. A wide block is producing garbage, which may
  cost nothing directly and everything in collection.
- **Lock** — width is time spent contended.

🔴 **Always label a flame graph with its mode when you share it.** A CPU graph and a wall-clock
graph of the same workload look similar and mean opposite things, and the disagreement that follows
is entirely avoidable.

## What it inherits from sampling

A flame graph is a view of samples, so every limitation in [07](07-execution-sampling.md) applies
to it — and the picture is more confident-looking than the data. JEP 509 says such profiles *"may
be inaccurate"*, and that inaccuracies *"are likely to be greater when collecting the samples over
a relatively short period"*.

⚠️ **A narrow block may be noise.** With a few hundred samples, a block at 1% width could be one or
two samples. **Widths are reliable for ranking, not for measurement** — a 3% difference between two
graphs is not a finding.

## Gotchas

**★ The x-axis is not time.**
Quoted directly: the graph *"does not preserve information on when a particular stack trace was
taken, it only indicates how often"*. Every timeline instinct about a flame graph is wrong.

**★ Left-to-right order is alphabetical.**
*"Samples are then alphabetically sorted at the base level."* Adjacent blocks are neighbours because
of their names, not because one followed or called the other.

**★ You cannot see a spike in a flame graph.**
Two seconds of total consumption inside a five-minute profile aggregates into one block. If *when*
matters, use a timeline view — JFR's events or Mission Control's pages — not a flame graph.

**★ Width is the only informative dimension.**
Height is stack depth; horizontal position is alphabetical; colour is frame type and varies between
implementations. Everything you conclude comes from width.

**★ A wide frame with wide children is a path, not a hotspot.**
The cost is above it in the graph — nearer the top edge. Optimising a wide block that has wide
children does nothing, which is the graphical form of total-versus-self time.

**★ A tall narrow spire is not interesting.**
Deep call chains look dramatic and consume little. Wide and shallow beats narrow and tall, every
time.

**★ A wide plateau in framework code usually means your code calls it too often.**
The fix is in the caller above it, not in the framework. The graph shows where the time goes, not
whose fault it is.

**★ The profiling mode changes the meaning entirely.**
CPU, wall clock, allocation and lock graphs look alike and mean different things — width is CPU,
elapsed time, bytes, or contended time respectively. Label any graph you share with its mode.

**★ Colour conventions are not universal.**
async-profiler uses a palette to differentiate frame types, and the documentation notes colours
*"may have different meaning in various flame graph implementations"*. Do not carry a colour
convention between tools.

**★ Narrow blocks may be noise.**
At a few hundred samples, 1% width may be one or two samples. Widths rank reliably and measure
badly — a small difference between two graphs is not a result.

**★ Comparing beats interpreting.**
One graph shows what the program does; two show what changed. A differential or side-by-side view
against a healthy baseline is far more informative than any amount of reasoning about a single
picture.

## Interview questions

**★ What does the x-axis of a flame graph represent?**
Not time. async-profiler's documentation states it directly: the graph *"does not preserve
information on when a particular stack trace was taken, it only indicates how often a stack trace
was observed"*, and samples are *"alphabetically sorted at the base level"*. Horizontal position
carries no information at all; width is the proportion of samples containing that frame.

**★ How do you read one?**
Look at the top edge for wide plateaus. Those are frames where the resource is actually being
consumed, since nothing is above them. Width is the only informative dimension — height is stack
depth and left-to-right is alphabetical. A wide block with wide children is a call path rather than
a hotspot, so the cost is above it.

**★ Can a flame graph show you that a spike happened?**
No. It aggregates all samples for the whole profiling period, so a method that consumed everything
for two seconds of a five-minute recording produces the same block as one consuming a little
throughout. For *when*, you need a timeline view — JFR's event stream or Mission Control's timeline
pages.

**★ Two flame graphs of the same service look completely different. What is the first thing you
check?**
The profiling mode. A CPU graph and a wall-clock graph look similar and mean opposite things —
width is CPU consumed in one and elapsed time in the other, so blocking I/O is nearly invisible in
the first and can dominate the second. Allocation graphs measure bytes rather than time. If the
mode is not labelled, the comparison is meaningless.

**★ A wide block in `HashMap.get` sits near the top. What do you conclude?**
That a lot of map lookups are happening, not that `HashMap` is slow. The actionable question is
which caller is responsible, which means looking at the frames beneath it. A wide plateau in JDK or
framework code almost always means your code calls it too often, and the fix lives above it in the
graph.

**★ How much should you trust the widths?**
For ranking, a lot; for measurement, little. A flame graph is a view of sampled data, so it inherits
every limitation of sampling — JEP 509 says such profiles *"may be inaccurate"*, more so over short
collection periods. A narrow block at a few hundred samples may be one or two samples of noise, and
a small width difference between two graphs is not a result.

**★ What is the fastest way to make a flame graph more useful?**
Have a second one to compare it against, from a healthy period or from before a change. A single
graph shows what the program does, which requires you to know what is normal; two graphs show what
is different, which does not. Differential flame graphs make that explicit, and even a side-by-side
comparison beats interpreting one in isolation.

{/* FOOTER */}
