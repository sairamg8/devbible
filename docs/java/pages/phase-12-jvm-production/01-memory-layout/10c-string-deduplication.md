---
title: "String deduplication makes duplicate strings share one backing array without touching the objects, which is why it needs no code change, why `==` still returns false afterwards, and why it does nothing at all for the short-lived strings a web request creates"
sidebar_label: "10c · String deduplication"
sidebar_position: 67
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against **JEP 192 · String Deduplication in G1**, the **HotSpot Java
> Virtual Machine Garbage Collection Tuning Guide** for JDK 25
> ([docs.oracle.com/en/java/javase/25/gctuning/](https://docs.oracle.com/en/java/javase/25/gctuning/)),
> and the **JDK 25 `java` tool reference**
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html))
> for `-XX:+UseStringDeduplication` and `-XX:StringDeduplicationAgeThreshold`. Collector support
> checked against the JDK 18 GC changelogs — it is **no longer G1-only**.
> JDK 25 · Spring Boot 4.1.0.
> **No sandbox** — Java source, quoted documentation and arithmetic only. No captured output.

**[10b](10b-the-pool-and-interning.md) covered the mechanisms that collapse `String` *objects*.
This one collapses the `byte[]` *arrays* underneath them instead, and that single difference is
what makes it the mechanism most people should reach for first: it needs no code change, it
cannot alter program semantics, and it is a flag rather than a refactor. It is also why `==`
does not start returning true afterwards, which is the thing everyone expects and nobody gets.**

## The idea: collapse the arrays, not the objects

Deduplication attacks the same waste from the other end, and it is the mechanism most people
should reach for first because **it requires no code change at all**.

The insight: two equal `String` objects each have their own `byte[]`. The `String` objects
themselves are small — a header, a reference, the coder, a cached hash. The *array* is where the
bytes are. So instead of collapsing the objects, collapse the arrays:

```
Before:  String("PENDING") ──> byte[7] {P,E,N,D,I,N,G}
         String("PENDING") ──> byte[7] {P,E,N,D,I,N,G}   ← a second copy of the bytes

After:   String("PENDING") ──┐
                             ├─> byte[7] {P,E,N,D,I,N,G}  ← one array, shared
         String("PENDING") ──┘
```

The two `String` objects remain distinct objects — `==` still returns false — but the payload
exists once. This is safe precisely because `String` is immutable and its backing array is never
mutated after construction. It is also why the technique has no equivalent for `StringBuilder`
or for mutable arrays: sharing requires the guarantee that nobody writes.

It is enabled with a flag and tuned with one more:

```bash
-XX:+UseStringDeduplication
-XX:StringDeduplicationAgeThreshold=3     # survive N collections before being considered
```

The age threshold exists so the collector does not spend effort on strings that are about to
die. Only strings that have survived some collections — that is, that look long-lived — are
candidates. That is also the honest limit of the technique: **it does nothing for the
short-lived garbage of a request/response cycle**, which is a large fraction of the strings a
web service creates.

### 🔴 It is no longer G1-only

This is the fact most likely to be stale in anything you read. Deduplication shipped in JDK 8u20
as a **G1-only** feature — JEP 192 is titled *"String Deduplication in G1"* — and for years
every article said so correctly.

The underlying infrastructure was then generalised, and support was added to **Serial, Parallel
and ZGC** as of JDK 18. On JDK 25, `-XX:+UseStringDeduplication` is not a reason to choose G1.

⚠️ **Verify the support matrix for the specific collector you run** rather than trusting this
page's version of it. The point to carry away is directional: *"it only works with G1"* is out
of date, and an article that says so is describing a pre-18 JVM and may be stale about other
things too.

### When it is worth turning on

Deduplication costs background work in the collector and a table of its own. It pays when
**long-lived** strings are **highly duplicated** — caches of parsed data, in-memory reference
tables, entity graphs loaded from a database where the same status, type or tenant string
appears on every row.

The way to find out is to look rather than guess: a heap histogram that shows a very large
number of `String`/`byte[]` instances relative to the number of *distinct* values you would
expect is the signal. [Topic 04](../04-out-of-memory-error/_plan.md) owns heap dump analysis,
and its dominator tree is where duplicate-heavy structures become obvious.

## Gotchas

**★ Deduplication and interning are different things.** Interning collapses `String` objects so
`==` becomes true; deduplication collapses the backing `byte[]` and leaves the objects distinct,
so `==` stays false. Expecting `==` to start working after enabling deduplication is a
misunderstanding of what it does.

**★ Deduplication does nothing for short-lived strings.** The age threshold means a string must
survive several collections to be considered. The per-request strings a web service churns
through are collected long before that. If your duplication is in transient request data, this
flag will not help and something in the code has to change.

**★ "String deduplication requires G1" is out of date.** True until JDK 18, false since. If you
find it in an article, treat the rest of that article's JVM claims as also possibly pre-18.

**★ Deduplication has nothing to share if your duplicates are already `==`.** If the strings
came from literals or from an existing canonicalising map, they are already one object with one
array, and the collector will find nothing to do. Enabling the flag and seeing no improvement
can mean the problem was already solved, not that the flag is broken.

**★ Lowering the age threshold to catch more strings can cost more than it saves.** The
threshold exists to avoid spending effort on strings that are about to die. Setting it to 1
makes the collector examine far more candidates, most of which will be collected anyway. If your
duplicates are short-lived, the answer is a code change, not a smaller threshold.

**★ It saves the arrays, not the `String` objects.** Two deduplicated `String`s still cost two
object headers, two references, two coder bytes and two cached hashes. For a heap of very short
strings — two-character codes, single digits — the array is the smaller half and deduplication
recovers proportionally little. The technique pays best on long, repeated strings.

**★ The saving does not appear immediately.** Deduplication happens as part of collection, and
only for strings old enough to qualify. Enabling the flag and re-reading a metric a minute later
is measuring nothing. Compare live-set-after-full-GC across a meaningful interval instead.

**★ It is not free.** There is background collector work and a table of the JVM's own. On a heap
with few duplicates you pay that for nothing, which is why "just turn it on everywhere" is not
the advice — look at a histogram first.

## Interview questions

**★ What is the difference between string interning and string deduplication?**
Interning collapses `String` *objects*: `intern()` returns the pool's canonical instance, so two
interned equal strings are `==`. Deduplication collapses the backing `byte[]` *arrays*: the
collector finds `String` objects with equal contents and points them at a single shared array,
leaving the `String` objects themselves distinct, so `==` remains false. Interning is an
explicit, synchronous, per-call operation in your code; deduplication is a background collector
activity enabled by a flag with no code change. They are not alternatives — they solve the same
waste at different levels, and deduplication is usually the one to try first because it costs
nothing to adopt and cannot change program semantics.

**★ Why is deduplication safe at all? What guarantee does it depend on?**
Immutability. `String`'s backing array is never written after construction, so two `String`
objects can point at the same array with no possibility of one mutating what the other sees.
That is the entire safety argument, and it is why there is no equivalent trick for
`StringBuilder`, for `char[]`, or for any mutable buffer. It is also a good illustration of why
`String`'s immutability is a design decision with runtime consequences rather than just an API
convenience — and why any code that reaches through reflection to mutate a string's array is not
merely unsupported but actively dangerous on a JVM with deduplication enabled.

**★ When would you enable `-XX:+UseStringDeduplication`, and when is it pointless?**
Enable it when long-lived strings are highly duplicated — an in-memory cache, a reference table,
an entity graph where every row carries the same status or tenant string. It is pointless for
short-lived strings, because the `StringDeduplicationAgeThreshold` requires a string to survive
several collections before it is even a candidate, and the per-request churn of a web service is
collected long before that. It is also pointless if the duplicates are already the same object,
as they would be after literals or a canonicalising map. It costs background collector work and
a table of its own, so it is a measured decision: look at a heap histogram for a large count of
`String` instances relative to the number of distinct values you would expect.

**★ Someone says string deduplication requires G1. Is that right?**
It was right and is now out of date. It shipped in JDK 8u20 as a G1-only feature — JEP 192 is
titled *"String Deduplication in G1"* — and the infrastructure was later generalised so that
Serial, Parallel and ZGC support it as of JDK 18. On JDK 25 it is not a reason to choose G1.
I would still verify the matrix against the release notes for the exact collector, and I would
treat any article that states the G1 restriction as current as being pre-18 and therefore
possibly stale on other JVM details too.

**★ Why does the age threshold exist, and would you ever change it?**
Because deduplication costs work per candidate string, and a string that is about to be
collected is not worth examining. The threshold makes the collector consider only strings that
have survived some number of collections and therefore look long-lived — which is exactly the
population where the saving persists. I would be reluctant to lower it: doing so increases the
number of candidates examined without increasing the number that survive to benefit, so it
trades CPU for very little. If the duplication is genuinely in short-lived strings, the flag is
the wrong tool and the fix belongs in the code.

**★ You enable deduplication and see no improvement. What are the possible explanations?**
Several, and they are worth separating. The duplicates may be short-lived and never reach the
age threshold. The duplicates may already be the same object — literals, or a canonicalising map
already in place — in which case there is nothing to share. The strings may be short enough that
the two object headers dominate the array and the array saving is small. There may simply not be
many duplicates, and the histogram that suggested there were was counting distinct values. Or
not enough time may have passed: the saving accrues through collection cycles, so a measurement
taken a minute after the flag went on is measuring nothing.

**★ How would you decide between compact strings, deduplication and a canonicalising map for a
service holding a large in-memory dataset?**
They are not competing, so the honest answer is to consider all three in order of cost. Compact
strings are already on and free — the only decision is whether your text is predominantly
Latin-1, which decides how much you already got. Deduplication is a flag with no code change and
suits exactly this shape of workload, long-lived and duplicated, so it is the next thing to try
and the easiest to measure. A canonicalising map is a code change but gives the most control and
can also be scoped to the loading phase, which suits a dataset built once and then read — and
scoping it that way sidesteps the unboundedness problem. What I would not do is reach for
`intern()`, which has the cost of the third option and the control of neither of the first two.

{/* FOOTER */}
