---
title: "Streams vs loops"
sidebar_label: "08 · Streams vs loops"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for the
> `java.util.stream` package (package summary: side-effects, laziness,
> debugging) and the Javadoc for `Stream.takeWhile`, `Stream.anyMatch` and
> `Collection.removeIf`.

**"Always streams" and "streams are slow, use loops" are both wrong, and
both common. The honest line: a stream is a *description of a
transformation* — when the code's job is "take this collection, transform,
filter, aggregate into a result", the description reads better than the
mechanics. A loop is *statements executed in order* — when the code's job
involves early exit with effects, index arithmetic, mutating locals, checked
exceptions, or stepping through with a debugger, the mechanics ARE the
logic, and forcing them into lambdas hides them. Fluency means writing both
and switching without ideology.**

## The same job, both ways

Transformation pipeline — the stream's home ground:

```java
// Loop version: the WHAT is buried in HOW
List<String> emails = new ArrayList<>();
for (Customer c : customers) {
    if (c.isActive()) {
        emails.add(c.getEmail().toLowerCase());
    }
}

// Stream version: filter → map → collect, reads as the spec
List<String> emails = customers.stream()
        .filter(Customer::isActive)
        .map(c -> c.getEmail().toLowerCase())
        .toList();
```

Stateful sequential logic — the loop's home ground:

```java
// Running balance with a stop condition and an effect: a loop IS this shape
long balance = openingBalance;
for (Transaction t : transactions) {
    balance += t.amount();
    if (balance < 0) {
        alerts.overdraft(t, balance);   // effect tied to the exact element
        break;                          // early exit
    }
}
```

The stream rendition of the second example needs a stateful lambda (which
[topic 10](10-stateful-lambdas.md) shows is contractually forbidden) or a
contorted `reduce` carrying a record of accumulated state — strictly worse
than the four honest lines above.

## What pushes toward a stream

- **Shape is transform/filter/aggregate** — `map`, `filter`, `groupingBy`,
  `joining` name the intent; the collector handles the container.
- **The operations chain** — three named steps beat three nested `if`s and
  two temporary lists.
- **The aggregation is non-trivial** — `groupingBy(dept, averagingLong(salary))`
  as a loop is a `Map`, a `getOrDefault` dance, and a second pass to
  average. The collector is the algorithm, prewritten and correct.
- **You may want parallelism later** — a clean pipeline can *consider*
  `.parallel()` ([topic 09](09-parallel-streams.md) — usually decline);
  a mutating loop cannot.

## What pushes toward a loop

- **Early exit — with effects or complex conditions.** `break`/`return` are
  direct. Streams cover the *pure* cases: `anyMatch`/`allMatch`/`findFirst`
  short-circuit a search; `takeWhile` (JDK 9+) truncates a prefix:

  ```java
  boolean hasRush = orders.stream().anyMatch(Order::isRush);   // stops at first hit
  var head = readings.stream().takeWhile(r -> r.ok()).toList(); // prefix until predicate fails
  ```

  When the exit condition mixes with side effects or multiple variables,
  the loop wins.
- **Index math** — comparing `list.get(i)` with `list.get(i - 1)`, stepping
  by two, walking two lists in lockstep. `IntStream.range` can simulate an
  index, but the moment indices interact, the simulation reads worse than
  `for (int i = 1; i < n; i++)`.
- **Mutating locals** — lambdas capture only effectively final variables
  ([phase 1's `final`](../phase-1-language-core/12-final.md)); an
  accumulator that several steps update is loop-shaped by construction.
- **Checked exceptions** — a `throws IOException` call inside `map` forces
  try/catch-and-rethrow-unchecked boilerplate in every lambda
  ([topic 01, chunk 3](01-lambdas-functional-interfaces/README.md) has the
  patterns). A loop just throws.
- **Debugging density** — a breakpoint on a loop line shows every local;
  stepping a fused pipeline hops through library frames. (IDE stream
  debuggers exist and help, but the loop needs no tooling.)
- **Effects are the point** — writing rows, sending messages: a plain loop
  runs them in order with normal error handling. Collect first, then loop
  over the results ([topic 10](10-stateful-lambdas.md)'s closing pattern).

## Performance, honestly

For typical business collections, **either form is fine and the difference
is noise** compared to the I/O around it. What is worth knowing:

- A stream pipeline has fixed setup cost (spliterator, op chain, collector)
  that a bare loop doesn't — measurable on tiny hot paths, irrelevant on a
  request that then calls a database.
- Boxing is the real trap: `Stream<Integer>` arithmetic boxes every
  element; `IntStream`/`mapToInt` exists precisely to avoid it (topic 06).
- A `for` loop over an `ArrayList` is about as fast as Java gets; never
  *expect* a stream to beat it sequentially. Streams buy clarity and
  composition, not sequential speed.
- Any claim beyond that needs a JMH benchmark of *your* shape on *your*
  JVM — folklore numbers in either direction are exactly that.

## The tiebreak: readability, judged locally

When both forms are legal and neither trips a hard criterion above, pick
the one the *next reader* parses faster. Two useful defaults teams
converge on:

1. **A pipeline longer than ~4–5 operations wants extraction** — name the
   steps (`.filter(this::eligibleForRenewal)`) or split into two
   statements; past that length, a loop with comments often reads better.
2. **Don't mix idioms in one method** — half loop, half stream over the
   same data forces the reader to context-switch twice.

## Gotchas

**Symptom:** stream pipeline needs a value updated across elements and the "fix" was an `AtomicInteger`/array-of-one capture
**Cause:** loop-shaped state forced into lambdas — effectively-final capture forbids plain mutation, so the workaround smuggles it
**Fix:** write the loop; or reshape so state lives in the collector (`reduce`, custom collector), not a capture

**Symptom:** try/catch wrapping inside every lambda of a pipeline that calls I/O
**Cause:** checked exceptions and `java.util.function` interfaces don't compose — the signature has no `throws`
**Fix:** a loop for effectful I/O; or a small wrapper that rethrows as an unchecked domain exception once, not per lambda

**Symptom:** `IntStream.range(0, n).forEach(i -> ...)` doing `list.get(i)` and `list.get(i + 1)`
**Cause:** index arithmetic simulated inside a stream — the pipeline adds nothing but indirection
**Fix:** plain indexed `for` — the stream form has no laziness, no composition, no parallelism benefit here

**Symptom:** performance regression blamed on streams; profiler shows `Integer.valueOf` hot
**Cause:** boxed `Stream<Integer>` math, not "streams are slow" — the loop version with `int` never boxed
**Fix:** `mapToInt`/`IntStream` (topic 06) — the primitive pipeline usually lands within noise of the loop

**Symptom:** a search loops through all elements although the answer was found early
**Cause:** stream chosen without a short-circuiting terminal — `filter(...).toList().isEmpty()` instead of a match op
**Fix:** `anyMatch`/`noneMatch`/`findFirst` — they stop at the first witness

**Symptom:** review comment war: one side rewrites loops as streams, the other reverts
**Cause:** style preference argued as correctness
**Fix:** agree on the criteria (this page's two lists) in the team's guide; both forms are idiomatic Java, chosen per shape

**Symptom:** `takeWhile` "misses" matching elements later in the list
**Cause:** `takeWhile` truncates at the *first* predicate failure — it is a prefix operation, not a filter
**Fix:** `filter` for "all matching anywhere"; `takeWhile` only for "the leading run"

## Interview questions

**★ Give the decision criteria you actually use for stream vs loop.**
Stream: the code is a transform/filter/aggregate pipeline, ops chain
cleanly, the collector expresses the aggregation, no checked exceptions in
the path. Loop: early exit entangled with effects, index arithmetic,
mutating local state, checked exceptions, or the code is primarily *doing*
things rather than *computing* a result. Tiebreak: whichever the next
reader parses faster.

**★ "Streams are slower than loops" — evaluate.**
Sequentially, a stream adds fixed pipeline setup and (if boxed) boxing
costs, so a tight loop can win micro-benchmarks; on realistic workloads the
difference usually vanishes into I/O. The meaningful performance rule is
about *boxing* (`mapToInt` vs `Stream<Integer>`), not streams vs loops.
Claims either way deserve a JMH measurement of the actual shape.

**★ How do you exit a stream early?**
Only via short-circuiting operations: `anyMatch`/`allMatch`/`noneMatch`,
`findFirst`/`findAny`, `limit`, `takeWhile`. There is no `break` from a
`forEach` — needing one means the terminal op is wrong or the code wants a
loop.

**★ Why do checked exceptions push toward loops?**
The `java.util.function` interfaces declare no `throws`, so a checked-
throwing call can't be passed as a lambda without a wrapper that catches
and rethrows unchecked — per lambda, per pipeline. A loop body throws
naturally and the method signature tells the truth.

**★ Your teammate wrote a `reduce` carrying a record of (balance, alerts, stopped) through a pipeline. Reaction?**
That's a loop wearing a stream costume: sequential stateful logic with an
exit condition. The record-accumulator `reduce` is harder to read, can't
short-circuit, and its combiner is wrong-or-unused in parallel. Four lines
of `for` with `break` say it directly.

**★ When would you convert a working loop into a stream during review — and when not?**
Convert when the loop is a pure collect-transform (especially with a
nontrivial grouping the collectors express better) and no criterion from
the loop column applies. Leave it when conversion needs capture tricks,
exception wrappers, or index gymnastics — the conversion cost is
permanent reader cost, and "it's more modern" isn't a reason.

---

← Prev: [`Optional` used correctly](07-optional/README.md) · Next → [Parallel streams](09-parallel-streams.md)
