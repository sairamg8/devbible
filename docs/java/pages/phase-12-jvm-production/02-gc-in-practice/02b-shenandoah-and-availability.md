---
title: "Shenandoah is a product-quality concurrent-compaction collector whose generational mode became a product feature in JDK 25 and is still not its default, which makes it the one collector where 'which JDK, which mode, which release' has to be answered before any benchmark is meaningful"
sidebar_label: "02b · Shenandoah"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 189** (Shenandoah, JDK 12), **JEP 379** (Production,
> JDK 15), **JEP 404** (Generational Shenandoah, Experimental, JDK 24), **JEP 521**
> (Generational Shenandoah, product, JDK 25) and **JEP 535** (Generational Mode by Default,
> **Targeted, release 28**)
> ([189](https://openjdk.org/jeps/189), [379](https://openjdk.org/jeps/379),
> [404](https://openjdk.org/jeps/404), [521](https://openjdk.org/jeps/521),
> [535](https://openjdk.org/jeps/535)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Every "G1 vs ZGC vs Shenandoah" comparison you have read skipped two questions. The first
is whether Shenandoah is in the JDK you deploy, which is
[02b2](02b2-is-shenandoah-in-your-jdk.md). The second is which Shenandoah you would be
running if it were, because its generational mode reached product status in JDK 25 and is
still not the default — so the obvious command line gets you the more memory-hungry
configuration. This page is what Shenandoah is, what its own JEPs admit it is bad at, and
the exact status of every part of it on JDK 25.**

## What Shenandoah is

JEP 189's summary:

> *"Add a new garbage collection (GC) algorithm named Shenandoah which reduces GC pause times
> by doing evacuation work concurrently with the running Java threads. Pause times with
> Shenandoah are independent of heap size, meaning you will have the same consistent pause
> times whether your heap is 200 MB or 200 GB."*

and its trade, stated in the JEP's own words rather than a vendor's:

> *"Shenandoah trades concurrent cpu cycles and space for pause time improvements. … Marking
> and compacting are performed concurrently so we only need to pause the Java threads long
> enough to scan the thread stacks to find and update the roots of the object graph."*

That is the same bargain ZGC makes, arrived at by different mechanics — Shenandoah's original
design used a forwarding pointer per object, ZGC uses coloured pointers and load barriers.
For a decision, the difference between them matters far less than the difference between
either of them and G1.

JEP 189 also contains the most honest sentence in the whole low-latency literature, and it is
the reason [10 · Safepoints](10-safepoints.md) exists:

> *"The goal is not to fix all JVM pause issues. Pause times due to reasons other than GC
> like Time To Safe Point (TTSP) issues or monitor inflation are outside the scope of this
> JEP."*

## The three things to say about it, and all three matter

**1 · It is a product feature, not experimental.** JEP 379 made that change in **JDK 15**:
*"Change the Shenandoah garbage collector from an experimental feature into a product
feature. … Making Shenandoah a product feature means that `-XX:+UnlockExperimentalVMOptions`
would no longer be needed."* Any instruction that still tells you to add the unlock flag is
from JDK 12–14.

**2 · Its generational mode became a product feature in JDK 25, and is still not the
default.** JEP 521's summary and non-goal, verbatim:

> *"Change the generational mode of the Shenandoah garbage collector from an experimental
> feature to a product feature."*
>
> *"It is not a goal to change the default mode of the Shenandoah collector. **By default,
> Shenandoah will continue to use a single generation.**"*

So on JDK 25 the command that gets you generational Shenandoah is:

```
-XX:+UseShenandoahGC -XX:ShenandoahGCMode=generational
```

and JEP 521's whole content is that the `-XX:+UnlockExperimentalVMOptions` that JDK 24
required is no longer needed — *"Removing the requirement to specify
`-XX:+UnlockExperimentalVMOptions` does not make its presence on the command line an
error"*, so old scripts keep working.

The default it is not: **JEP 535, "Shenandoah GC: Generational Mode by Default", is
`Targeted` for release 28**, and describes the change as *"changing the default value of the
`ShenandoahGCMode` option from `satb` to `generational`"*. On JDK 25, `satb` — the
non-generational snapshot-at-the-beginning mode — is what you get if you do not ask.

⚠️ This is the exact place where Shenandoah and ZGC are most often confused. ZGC's
generational mode is the *only* mode as of JDK 24. Shenandoah's generational mode is a
*product* feature that is *not* the default as of JDK 25, and will become the default in
JDK 28. Two collectors, two very different positions on the same road.

**3 · It is not in every JDK build.** This is the one nobody says, it has two distinct
failure modes, and it gets its own page:
[02b2 · Is Shenandoah in your JDK?](02b2-is-shenandoah-in-your-jdk.md).

## What JEP 404 admits, and why you should read the non-goals

The generational Shenandoah JEP is unusually candid about where it loses, and these
sentences are better guidance than any benchmark:

> *"It is not a goal to improve CPU and power usage compared to traditional stop-the-world
> GCs. If longer pauses can be tolerated, other collectors such as G1 may still provide more
> energy-efficient behavior."*
>
> *"It is not a goal to maximize mutator throughput. If longer pauses can be tolerated, other
> collectors such as the Parallel collector may still provide superior throughput on certain
> platforms."*
>
> *"In the initial release, ergonomic heuristics may not provide optimal behavior on all
> workloads."*

The motivation section states the non-generational cost plainly, which is the reason
generational mode exists at all:

> *"Compared to the generational collectors G1, CMS, and Parallel, non-generational
> Shenandoah tends to require more heap headroom and work harder to recover space occupied by
> unreachable objects."*

That sentence is also the reason **running Shenandoah in its JDK 25 default mode is a
deliberate choice with a memory cost**, not a neutral one.

## Gotchas

**★ Generational Shenandoah is a product feature on JDK 25 but not the default.**
JEP 521 says so as an explicit non-goal: *"By default, Shenandoah will continue to use a
single generation."* Without `-XX:ShenandoahGCMode=generational` you are running the `satb`
mode, which JEP 404's motivation says *"tends to require more heap headroom"*. Enabling
Shenandoah and stopping there gets you the more memory-hungry configuration.

**★ Generational mode becoming the default has a version: JDK 28.**
JEP 535 is `Targeted` for release 28. Until then, every Shenandoah command line has to carry
the mode explicitly, and any documentation you write should carry the version with it.

**★ `-XX:+UnlockExperimentalVMOptions` has not been needed for Shenandoah since JDK 15, and
has not been needed for its generational mode since JDK 25.**
JEP 379 removed the first requirement, JEP 521 the second. Leaving the unlock flag in is
harmless — JEP 521 notes it *"does not make its presence on the command line an error"* — but
it is a reliable signal that the rest of the command line is also a decade old.

**★ "Shenandoah has lower pauses than G1" is true and frequently irrelevant.**
JEP 404 lists as explicit non-goals both better CPU/power usage than stop-the-world
collectors and better throughput than Parallel, and says G1 *"may still provide more
energy-efficient behavior"*. If your pause budget is comfortably met by G1, moving to a
concurrent-compaction collector buys you a number you were not being judged on and costs you
CPU you were.

**★ Do not confuse Shenandoah's generational timeline with ZGC's.**
ZGC: generational by default since JDK 23, non-generational removed in JDK 24, so there is
only one ZGC. Shenandoah: generational is a product feature in JDK 25 but the default is
still `satb`, and the switch is targeted for JDK 28. The two collectors are at genuinely
different points and the advice for one is wrong for the other.

## Interview questions

**★ What state is generational Shenandoah in, precisely?**
On JDK 25 it is a **product** feature and **not** the default. JEP 404 added it as
experimental in JDK 24; JEP 521 promoted it to product in JDK 25 with the explicit non-goal
*"It is not a goal to change the default mode of the Shenandoah collector. By default,
Shenandoah will continue to use a single generation."* You enable it with
`-XX:ShenandoahGCMode=generational`, and `-XX:+UnlockExperimentalVMOptions` is no longer
required. Making it the default is JEP 535, which is Targeted for release 28. That is a
different position from ZGC, whose generational mode has been the only mode since JDK 24.

**★ Someone proposes switching a service from G1 to Shenandoah to fix p99. What do you ask?**
Four questions before any benchmark. Does the JDK image contain Shenandoah, and is that
image's vendor part of our supported set — because choosing this collector makes the base
image a correctness dependency. Is the p99 problem actually GC pauses, or is it
time-to-safepoint, which JEP 189 explicitly places outside Shenandoah's scope? Do we have
spare CPU, since JEP 404 lists better CPU and power usage than stop-the-world collectors as
a non-goal and says G1 may be more energy-efficient? And will we run generational mode,
because the JDK 25 default is single-generation and JEP 404's own motivation says the
non-generational mode *"tends to require more heap headroom"*.

**★ How would you decide between ZGC and Shenandoah?**
Availability first: ZGC is in every JDK 25 build and documented by Oracle; Shenandoah is in
neither guarantee. If both are available, the honest position is that they occupy the same
niche — concurrent compaction, pause times independent of heap size, paid for in CPU and
headroom — and the deciding factors are operational rather than algorithmic: which one your
vendor supports, which one your team can read the logs of, and which one your workload
measures better on. What I would not do is decide from published pause-time comparisons,
because both collectors' pauses are already below the noise floor of most services, and the
number that will actually differ is throughput at a fixed heap size.

{/* FOOTER */}
