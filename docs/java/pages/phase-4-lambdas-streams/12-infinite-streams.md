---
title: "Infinite streams: iterate, generate, takeWhile/dropWhile"
sidebar_label: "12 · Infinite streams"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against the JDK 25 API documentation
> (docs.oracle.com/en/java/javase/25/) for `Stream.iterate` (both
> overloads), `Stream.generate`, `Stream.takeWhile` and `Stream.dropWhile`,
> and the `java.util.stream` package summary's sections on stream
> characteristics and short-circuiting operations.

**A stream doesn't need a collection behind it — `Stream.iterate` and
`Stream.generate` describe *unbounded* sequences, and because intermediate
operations are lazy, an infinite stream is perfectly legal right up until a
terminal operation tries to drain it. The discipline is simple: every
infinite source must meet a short-circuiting operation (`limit`,
`takeWhile`, `findFirst`, `anyMatch`) before the terminal op — and a few
operations (`sorted`, `distinct` on everything, `count`) can never finish
on one no matter what comes after them.**

## The three sources

```java
// 1. iterate(seed, next) — each element is a function of the previous one.
Stream<Long> powersOfTwo = Stream.iterate(1L, x -> x * 2);        // infinite

// 2. iterate(seed, hasNext, next) — the bounded, for-loop-shaped overload (JDK 9).
Stream<Long> under1M = Stream.iterate(1L, x -> x < 1_000_000, x -> x * 2);

// 3. generate(supplier) — no relation between elements; the supplier is
//    just called per element.
Stream<UUID> ids = Stream.generate(UUID::randomUUID);             // infinite
```

The differences that matter:

- **`iterate` is inherently *ordered* and *sequential in nature*** — element
  n depends on element n−1, so the sequence is well-defined but cannot be
  usefully parallelized (the library can't compute element 1000 without the
  999 before it).
- **The three-arg `iterate` is a `for` loop as a stream** —
  `iterate(seed, hasNext, next)` mirrors
  `for (T x = seed; hasNext(x); x = next(x))`. It terminates on its own,
  needs no `limit`, and is the right spelling when the bound is a property
  of the *value* ("while under a million") rather than a count.
- **`generate` produces an *unordered* stream.** With a stateless supplier
  (`UUID::randomUUID`, a constant) that is harmless. With a *stateful*
  supplier (reading a scanner, popping a queue) you have re-created the
  stateful-lambda problem of [the previous topic](10-stateful-lambdas.md) —
  order and element assignment are undefined under parallelism.

## Every infinite source needs a short-circuit

An intermediate `limit(n)` or `takeWhile(p)`, or a short-circuiting
*terminal* (`findFirst`, `findAny`, `anyMatch`, `allMatch`, `noneMatch`),
is what makes the pipeline finite:

```java
List<Long> firstTen = Stream.iterate(1L, x -> x * 2)
        .limit(10)                    // bound it BEFORE the terminal
        .toList();

Optional<Long> firstOver = Stream.iterate(1L, x -> x * 2)
        .filter(x -> x > 1_000_000)
        .findFirst();                 // short-circuiting terminal — fine
```

Without one, `toList()`, `forEach`, `reduce` or `count` simply never
returns — no exception, no timeout, a thread at 100% until something kills
it. And position matters: the bound must come **before** any operation
that has to see every element. `sorted()` and the terminal `count()`
buffer or drain the whole stream, so
`iterate(...).sorted().limit(10)` hangs even though a `limit` is present —
the sort needs the end of an endless sequence before it can emit anything.
`distinct()` is subtler: it streams through, but on an infinite source
with finitely many distinct values, a downstream `limit` larger than that
value count will also never fill.

## `takeWhile` and `dropWhile`

JDK 9 added the value-based bounds (the stream analogue of a `while`
loop):

```java
// backoff delays: 100ms, 200ms, 400ms ... capped at 30s — then stop.
List<Duration> delays = Stream.iterate(Duration.ofMillis(100), d -> d.multipliedBy(2))
        .takeWhile(d -> d.compareTo(Duration.ofSeconds(30)) <= 0)
        .toList();

// skip the header lines, keep the rest of a (finite) stream.
List<String> body = lines.stream()
        .dropWhile(String::isBlank)
        .toList();
```

- `takeWhile(p)` keeps the **longest prefix** of elements matching `p` and
  cuts the stream at the *first* non-match — unlike `filter`, nothing
  after that point is considered, which is exactly what makes it a valid
  bound for an infinite stream.
- `dropWhile(p)` is its mirror: drop the matching prefix, keep everything
  from the first non-match on. On an infinite stream `dropWhile` does
  **not** bound anything — it only moves the starting point.
- **Both are defined in terms of encounter order, so they are only
  deterministic on *ordered* streams.** On an unordered stream ("some
  subset" / "some prefix" is the Javadoc's phrasing) the result is
  nondeterministic — and `generate` produces exactly such a stream. The
  docs also warn both can be *expensive on ordered parallel* pipelines
  (the prefix must be agreed across splits); if you meet that, `.unordered()`
  or a sequential stream is the documented escape.

The predicate cuts at the first `false` — `takeWhile` is not "take all
elements that match" but "take *until* the first mismatch". A sequence
that dips below the threshold and comes back up is truncated at the dip:
`Stream.of(1, 2, 9, 1, 3).takeWhile(x -> x < 5)` yields `1, 2` — the later
`1` and `3` never appear. That is the single most common misreading.

## Where infinite streams actually earn their keep

- **Retry/backoff schedules** — the `Duration` example above: the policy
  is *data*, testable without sleeping.
- **Test fixtures** — `Stream.generate(this::randomOrder).limit(500)`.
- **Pagination cursors** — `iterate(firstPage, Page::hasNext, p -> fetch(p.nextToken()))`
  turns "loop until no next-token" into a stream of pages (the three-arg
  form: the bound is a property of the page, not a count).
- **Numeric sequences** — `IntStream.iterate`/`LongStream.iterate` avoid
  boxing every element (`Stream<Long>` boxes; `LongStream` doesn't —
  the argument of [topic 06](06-reduce-primitive-streams.md)).

For anything more stateful — reading a socket, polling a queue — a plain
loop is more honest: the "supplier" has side effects, and stream machinery
adds laziness you then have to reason around
([stateful lambdas](10-stateful-lambdas.md)).

## Gotchas

**Symptom:** the program hangs, one core pinned, no exception, no output
**Cause:** an infinite source reached a draining terminal (`toList`, `count`, `forEach`, `reduce`) with no `limit`/`takeWhile`/short-circuiting terminal anywhere in the pipeline
**Fix:** bound every `iterate(seed, next)`/`generate` pipeline before the terminal; or use the self-terminating three-arg `iterate`

**Symptom:** the pipeline has a `limit(10)` and still hangs
**Cause:** a full-stream operation sits *before* the limit — `sorted()` (buffers everything), or `distinct()` upstream of a `limit` it can never fill
**Fix:** order matters: bound first, then sort/dedupe the finite remainder

**Symptom:** `takeWhile` "randomly" drops elements that match the predicate
**Cause:** it takes the longest *prefix* — the first non-matching element ends the stream; later matches are never reached (or the stream was unordered, making "prefix" itself nondeterministic)
**Fix:** for "all matching elements anywhere" use `filter`; keep `takeWhile` for genuinely monotonic cut conditions on ordered streams

**Symptom:** `dropWhile` on an infinite stream still never terminates
**Cause:** `dropWhile` only skips a prefix — it bounds nothing; the rest of the stream is still infinite
**Fix:** pair it with `limit`/`takeWhile` downstream, or rethink which side of the cut you actually want

**Symptom:** `count()` never returns though every element is trivially countable
**Cause:** `count` must drain the stream — on an infinite source there is no count to return
**Fix:** there is no fix by design; if "how many until X" is the question, that's `takeWhile(...).count()`

**Symptom:** `generate` with a stateful supplier gives duplicated/missing/reordered elements under `.parallel()`
**Cause:** `generate` is unordered and the supplier is a behavioral parameter — per-element calls race and have no defined assignment to positions
**Fix:** keep stateful sequences on `iterate` (ordered, sequential by nature) or a plain loop; reserve `generate` for stateless suppliers

**Symptom:** exponential-backoff stream overflows to negative delays
**Cause:** `iterate`'s function runs unbounded — `x * 2` on a `long` eventually wraps ([overflow](../phase-1-language-core/04-operators-overflow/README.md)); the `takeWhile` may even stay true forever after wrap
**Fix:** cap inside the step function (`Math.min(cap, x * 2)`) or bound by element count too, not only by value

## Interview questions

**★ Why doesn't `Stream.iterate(1, x -> x + 1)` blow up the moment you write it?**
Laziness. Sources and intermediate operations describe a pipeline; nothing
is computed until a terminal operation pulls elements. An infinite
*description* is fine — only an unbounded *drain* hangs.

**★ `iterate(...).limit(10).sorted()` works; `iterate(...).sorted().limit(10)` hangs. Why?**
`sorted` must see the whole input before emitting its first element — it
buffers. In the first pipeline it sorts ten elements; in the second it
waits for the end of an infinite stream that never comes. Bounds must
precede full-stream operations.

**★ What is the difference between `takeWhile(p)` and `filter(p)`?**
`filter` evaluates every element and keeps all matches. `takeWhile` keeps
the longest matching *prefix* and short-circuits the stream at the first
non-match — elements after it are never even produced, which is why it can
bound an infinite stream and `filter` cannot.

**★ When would you choose the three-arg `iterate(seed, hasNext, next)` over `iterate(seed, next).takeWhile(hasNext)`?**
They express the same bound, but the three-arg form is self-terminating at
the source — no risk of someone reordering the pipeline and losing the
bound — and it reads as the `for` loop it replaces. Prefer it whenever the
termination condition is known at the source.

**★ Why are `takeWhile`/`dropWhile` documented as nondeterministic on unordered streams?**
"Prefix" is only meaningful with an encounter order. Without one, the spec
allows taking/dropping *some* subset of matching elements — and
`Stream.generate` sources are unordered, so combining the two is exactly
the undefined case.

**How would you produce capped exponential backoff delays as data?**
`Stream.iterate(base, d -> d.multipliedBy(2)).map(d -> d.compareTo(cap) < 0 ? d : cap).limit(maxAttempts).toList()`
— or `takeWhile` below the cap and append the cap. The point interviewers
look for: the schedule becomes a testable value, with overflow handled in
the step function rather than discovered in production.

---

← Prev: [`toList()` vs `Collectors.toList()`](11-tolist-vs-collectors.md) · Next → [Stream gatherers](13-stream-gatherers.md)
