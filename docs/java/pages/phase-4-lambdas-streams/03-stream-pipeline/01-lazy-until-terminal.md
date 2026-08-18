---
title: "Lazy until terminal"
sidebar_label: "1 · Lazy until terminal"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 `java.util.stream` package summary
> ("Stream operations and pipelines" — laziness, short-circuiting), and the
> Javadoc for `Stream.peek`, `Stream.findFirst`, `Stream.anyMatch`,
> `Stream.limit` and `Stream.count`.

**Intermediate operations return a new stream and do *no work*. All
computation is deferred until the terminal operation starts pulling — and
then elements flow through the whole pipeline *one at a time*, not stage
by stage. Those two sentences, taken seriously, predict every behaviour
this chunk demonstrates: the pipeline that "didn't run", the `peek` that
printed three lines for a thousand-element list, and the infinite stream
that terminated.**

## The three stages

```java
long n = orders.stream()                     // 1. source
        .filter(o -> o.total() > 100)        // 2. intermediate (lazy)
        .map(Order::customerId)              // 2. intermediate (lazy)
        .distinct()                          // 2. intermediate (lazy, stateful)
        .count();                            // 3. terminal — NOW it runs
```

- **Source** — a collection, array, generator, or I/O channel. Building a
  stream from it consumes nothing.
- **Intermediate operations** (`filter`, `map`, `flatMap`, `sorted`,
  `distinct`, `limit`, `peek`…) — each returns a new stream wrapping the
  previous one. Always lazy: *"traversal of the pipeline source does not
  begin until the terminal operation of the pipeline is executed"* (package
  summary).
- **Terminal operation** (`forEach`, `collect`, `reduce`, `count`,
  `findFirst`, `anyMatch`, `toArray`, `iterator`…) — starts the pull,
  produces a value or side effect, and *consumes* the stream.

A pipeline without a terminal op is a no-op that compiles:

```java
orders.stream().map(this::audit);   // audit() NEVER runs — nothing pulls
```

This is the most-reported "streams are broken" bug and it is working as
designed: an intermediate op is a description, and nobody executed it.

## Elements flow one at a time — vertical, not horizontal

The mental model that fails is horizontal: "first `filter` runs over the
whole list, then `map` runs over the survivors." The real model is
vertical: the terminal op asks for one element; that element runs through
`filter`, then (if it passes) `map`, then is delivered — *then* the next
element starts.

```java
Stream.of("a", "bb", "ccc")
      .filter(s -> s.length() > 1)   // called per element, interleaved
      .map(String::toUpperCase)      // runs immediately after each passing filter
      .forEach(this::send);          // "BB" is sent before "ccc" is even filtered
```

Consequences that matter in real code:

- **Memory:** no intermediate collections exist between stages. A
  ten-million-element pipeline holds one element in flight (per thread),
  which is why `Files.lines(...)` pipelines can process files larger than
  the heap.
- **Order of side effects:** a log line in `map` and one in `filter`
  interleave per element. If you expected phase-by-phase output, the
  interleaved trace looks like chaos but is correct.
- **Stateful intermediates are the exception:** `sorted()` must buffer
  *everything* before emitting anything, and `distinct()` must remember
  what it has seen. A `sorted()` mid-pipeline reintroduces exactly the
  full-collection cost the vertical model avoids.

## Short-circuiting — pulling only what's needed

Some operations are documented as *short-circuiting*: they can produce a
result from a finite prefix of an infinite stream (`limit`,
`takeWhile`) or terminate without examining every element (`findFirst`,
`findAny`, `anyMatch`, `allMatch`, `noneMatch`).

```java
Optional<Order> first = orders.stream()
        .filter(o -> o.total() > 100)     // runs until ONE match is found
        .findFirst();                     // then the whole pipeline stops
```

With laziness this composes into the striking result: **an infinite source
plus a short-circuiting op is a finite program**:

```java
List<Integer> firstTenEven = Stream.iterate(0, n -> n + 2)
        .limit(10)                        // pull exactly ten
        .toList();
```

And the inverse trap: a *non*-short-circuiting terminal on an infinite
source (`Stream.iterate(0, n -> n + 1).count()`) never returns.

## The `peek` surprise, precisely

`peek` is an intermediate op, so it inherits both behaviours above:

1. **No terminal, no peek** — a dangling `.peek(System.out::println)`
   prints nothing.
2. **Only pulled elements are peeked** — after `findFirst` matches on the
   third element, `peek` has printed three lines, not the list's thousand.
3. **Elided entirely when traversal is skipped** — the `count()` Javadoc
   warns it may compute the size *from the source* without traversing, so
   a pipeline like `list.stream().peek(...).count()` may print nothing at
   all. (`Stream.count` API note, JDK 25.)

`peek` is honest about the execution model; the surprise is only relative
to the horizontal loop model. Use it to *learn* what actually flows —
never as a load-bearing side effect
([topic 10 makes that argument](../10-stateful-lambdas.md)).

## Gotchas

**Symptom:** pipeline "does nothing" — no exception, no effect, nothing in the logs
**Cause:** no terminal operation; intermediates are lazy descriptions
**Fix:** end with `collect`/`toList`/`forEach`/`count`/…; if you want effects, say so with a terminal op

**Symptom:** debugging `peek` prints far fewer lines than the source has elements
**Cause:** a short-circuiting terminal (`findFirst`, `anyMatch`, `limit`) stopped pulling once satisfied
**Fix:** expected — the print count *is* the number of elements actually processed, which is the useful datum

**Symptom:** `peek` before `count()` prints nothing even with a terminal op present
**Cause:** `count()` may take the size from a sized source without traversal, eliding the pipeline
**Fix:** never rely on `peek` for effects; to force traversal while debugging, collect instead of counting

**Symptom:** log lines from `map` and `filter` interleave per element instead of appearing in stage order
**Cause:** vertical per-element execution — each element traverses the whole pipeline before the next starts
**Fix:** expected; read traces element-wise. For stage-order traces, split the pipeline and collect between stages (debug only)

**Symptom:** `OutOfMemoryError` from a pipeline that "streams" a huge source
**Cause:** a stateful intermediate — `sorted()` (buffers all) or `distinct()` (remembers all) — mid-pipeline
**Fix:** sort/dedupe as late as possible on the smallest data; or pre-sort the source; for files, ask whether the order is needed at all

**Symptom:** program hangs on an infinite stream even though a `filter` "narrows it"
**Cause:** the terminal op is not short-circuiting (`count`, `collect` without `limit`) — `filter` narrows, it doesn't bound
**Fix:** bound explicitly with `limit`/`takeWhile`; only short-circuiting ops make infinite sources finite

**Symptom:** a `map` lambda with a side effect ran a different number of times after a harmless-looking refactor
**Cause:** how many elements are pulled depends on the terminal op and downstream ops — that count was never stable API
**Fix:** keep behavioral parameters pure; effects belong in the terminal op ([topic 10](../10-stateful-lambdas.md))

## Interview questions

**★ Why does a stream pipeline without a terminal operation do nothing?**
Intermediate ops only build a new stream object describing the
computation; the package doc specifies traversal begins at the terminal
op. No terminal, no pull, no work — by design, because laziness is what
enables short-circuiting and one-element-in-flight memory behaviour.

**★ Walk me through what actually executes in `list.stream().filter(f).map(m).findFirst()`.**
`findFirst` requests an element. Element 1 runs `f`; if false, element 2
is pulled, and so on. The first element passing `f` runs `m` once, is
wrapped in the `Optional`, and the pipeline stops — untouched elements are
never filtered, let alone mapped.

**★ How can a pipeline over an infinite stream terminate?**
Via a short-circuiting operation: `limit`/`takeWhile` bound the pull;
`findFirst`/`anyMatch` stop at a witness. Laziness means the infinite
source is only ever asked for the elements the bounded pipeline demands.

**★ Which intermediate operations are not "one element in flight", and what does that cost?**
Stateful ones. `sorted()` buffers the entire stream before emitting the
first element (full memory + latency); `distinct()` retains every seen
element (memory grows with cardinality); `limit`/`skip` on ordered
parallel streams also buffer. They reintroduce whole-collection costs
inside an otherwise streaming pipeline.

**★ Why might `peek` print nothing even when the pipeline has a terminal operation?**
If the terminal result doesn't require traversal — the documented case is
`count()` on a source with a known size — the library may elide the
traversal and every behavioural parameter with it. `peek` only observes
elements that actually flow.

**A colleague inserts `.map(x -> { log(x); return x; })` to trace a pipeline. Critique it.**
It's `peek` with worse manners: same laziness caveats (may run fewer
times than expected, may be elided), plus it launders a side effect
through an op the library assumes pure. For ad-hoc debugging `peek` is at
least explicit about being a tap; for real observability, collect
intermediate results in a test, or extract the lambda and unit-test it.

**Why is "streams are lazy" the reason streams can replace loops over data bigger than memory?**
Because no stage materializes a collection: each element flows source →
terminal individually, so peak memory is one element (plus stateful-op
buffers). `Files.lines(path).filter(...).count()` reads a multi-gigabyte
file in constant memory — a `List<String>` version cannot.

---

← Index: [The stream pipeline](README.md) · Next → [The machinery](02-the-machinery.md)
