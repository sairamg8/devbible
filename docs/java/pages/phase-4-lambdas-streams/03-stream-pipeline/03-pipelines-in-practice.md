---
title: "Pipelines in practice"
sidebar_label: "3 · Pipelines in practice"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 Javadoc for `Stream` (static
> factories, `onClose`/`close`), `BaseStream` (`AutoCloseable`),
> `Files.lines`, `BufferedReader.lines`, `Stream.iterate`,
> `Stream.generate` and `Stream.ofNullable`.

**Real pipelines start somewhere, sometimes hold an open file, and contain
lambdas that can throw. The API gives you a source for every shape of
data, a close protocol that almost no stream needs and file streams
absolutely do, and *nothing at all* for checked exceptions — the one place
you must bring your own pattern. This chunk is the working inventory:
where streams come from, which ones must be closed, what exceptions do to
a running pipeline, and how to debug one without smearing `peek`
everywhere.**

## Where streams come from

| Need | Source |
|---|---|
| A collection | `collection.stream()` / `.parallelStream()` |
| Known values | `Stream.of(a, b, c)`, `Stream.of(single)` |
| Possibly-null single value | `Stream.ofNullable(x)` — empty stream if null |
| An array | `Arrays.stream(arr)` (also `int[]` → `IntStream`) |
| A range of indices | `IntStream.range(0, n)` / `rangeClosed(1, n)` |
| A map | `map.entrySet().stream()` (a `Map` is not a `Collection`) |
| Lines of a file | `Files.lines(path)` — **must be closed** |
| A recurrence | `Stream.iterate(seed, next)` or the 3-arg bounded form |
| Repeated supplier calls | `Stream.generate(supplier)` |
| Two streams joined | `Stream.concat(s1, s2)` |
| Nothing | `Stream.empty()` — the identity for `concat`, the safe return |
| A builder | `Stream.<T>builder().add(a).add(b).build()` |

Choices with consequences:

- **`Stream.ofNullable`** replaces the
  `x == null ? Stream.empty() : Stream.of(x)` dance — most useful inside
  `flatMap` when unfolding optional-ish structures.
- **`IntStream.range`** is the index-carrying stream — the sanctioned
  answer to "I need the element *and* its position"
  ([topic 10's counter gotcha](../10-stateful-lambdas.md)).
- **`iterate` vs `generate`**: `iterate` is a recurrence (each element
  from the last — ordered by construction); `generate` calls a supplier
  with no ordering promise — right for "n randoms", wrong for sequences.
  Both are infinite unless bounded (`limit`, `takeWhile`, or `iterate`'s
  three-argument predicate form).

## Closing — the rule and the one place it applies

`BaseStream` extends `AutoCloseable`, but the `Stream` Javadoc is
explicit: almost all stream instances don't need closing — only streams
whose source **holds a resource** do. Collection- and array-backed
streams close to no effect; **`Files.lines` holds an open file
descriptor**, and not closing it leaks one per call until the OS limit:

```java
// ✓ the pattern for every I/O-backed stream
try (Stream<String> lines = Files.lines(path)) {
    long errors = lines.filter(l -> l.contains("ERROR")).count();
}   // file closed here, success or exception
```

The terminal operation does **not** close the stream — that is the
mistake the try-with-resources guards against. The same applies to
`BufferedReader.lines()` (closing the reader is your job) and any stream
you build with an `onClose` handler — `close()` is the only thing that
runs those handlers.

Design corollary: a method that *returns* an I/O-backed stream transfers
the close obligation to its caller. Either document that loudly or don't
return the stream — process it inside the method and return the result.

## Exceptions inside pipelines

An exception thrown by any behavioural parameter propagates out of the
*terminal operation* and kills the whole pipeline — there is no per-element
recovery, no "skip and continue", and in parallel the other threads are
interrupted on a best-effort basis. Three honest patterns:

**1. Unchecked domain failures — let them fly.** If a bad element means
the whole computation is invalid, the propagating exception is correct;
try/catch around the terminal op, not inside the lambda.

**2. Checked exceptions — handle *inside* the lambda, at the element.**
`Function.apply` declares no checked exceptions, so this doesn't compile:

```java
paths.stream().map(Files::readString)   // ✗ IOException is checked
```

The lambda must resolve it — by wrapping:

```java
paths.stream()
     .map(p -> {
         try { return Files.readString(p); }
         catch (IOException e) { throw new UncheckedIOException(e); }
     })
```

(`UncheckedIOException` exists in the JDK precisely for this seam — and
`Files.lines`' own lazy reads throw it too, so file pipelines should
catch it around the terminal op.)

**3. Partial success — make failure a value.** When some elements failing
is *expected*, don't smuggle it through exceptions; map to a result
carrier and split:

```java
record Parsed(String raw, Optional<Config> ok) {}

var results = lines.stream()
     .map(l -> new Parsed(l, tryParse(l)))          // tryParse returns Optional
     .toList();
var good = results.stream().flatMap(p -> p.ok().stream()).toList();
var bad  = results.stream().filter(p -> p.ok().isEmpty()).toList();
```

This keeps the pipeline total (every input produces an output) and the
failure handling inspectable — the shape `Collectors.partitioningBy`
formalizes (**Collectors** *(not written yet)*).

## Debugging without print

The horizontal-model habit — sprinkle prints, read stage-by-stage output —
fights the machinery (chunk 1: interleaved, possibly elided). What works:

- **Break the chain.** Assign intermediate results to locals with
  `.toList()` between stages *in a debug build or test*. Each list is
  inspectable in a debugger; laziness is temporarily traded for
  visibility, deliberately and locally.
- **Extract and unit-test lambdas.** A multi-line lambda is a method that
  hasn't been named yet. Named, it gets breakpoints, tests, and stack
  frames that say `parseTariff` instead of `lambda$process$3`.
- **Breakpoints inside lambdas** work in IntelliJ and Eclipse (both offer
  "lambda body" breakpoint targets on a line with a chain, and IntelliJ
  adds a Stream Trace visualizer) — no code change needed.
- **`peek` for flow-counting only** — how many elements reached this
  stage — with chunk 1's elision caveats in mind, and deleted before
  commit.
- **Prefer reproducing in a test** with a three-element source over
  staring at production-size flows: the vertical model means three
  elements exercise every stage in the same order a million would.

## Gotchas

**Symptom:** "too many open files" (`FileSystemException`) after the service runs for a while
**Cause:** `Files.lines` (or `list`/`walk`/`find`) streams never closed — each holds a descriptor; terminal ops don't close
**Fix:** every I/O-backed stream in try-with-resources; audit for `Files.` stream factories used bare

**Symptom:** `UncheckedIOException` from deep inside a pipeline that "already opened the file fine"
**Cause:** `Files.lines` reads lazily — I/O errors surface mid-traversal, wrapped unchecked, at the terminal op
**Fix:** catch `UncheckedIOException` around the terminal operation; the open succeeding never promised the reads would

**Symptom:** `map(Files::readString)` won't compile — "unhandled exception: IOException"
**Cause:** functional interfaces in `java.util.function` declare no checked exceptions
**Fix:** wrap in the lambda (rethrow `UncheckedIOException`), or map to a result-carrier value; there is no annotation that makes it go away

**Symptom:** one malformed element kills a million-element batch job
**Cause:** exceptions abort the terminal op — pipelines have no built-in skip-and-continue
**Fix:** if partial success is legitimate, make failure a value (Optional/record carrier, `partitioningBy`) instead of an exception

**Symptom:** `Stream.generate(() -> counter++).limit(5)` produces surprising values in parallel
**Cause:** `generate` promises no order and the supplier is stateful — both documented hazards
**Fix:** `iterate` for sequences (order is structural), `IntStream.range().map(...)` for indexed generation; keep suppliers stateless

**Symptom:** returning `Files.lines(p)` from a helper leaks descriptors even though callers "use streams correctly"
**Cause:** the close obligation crossed the API boundary invisibly — callers treat it like a collection stream
**Fix:** process within the method and return data; if returning the stream is the point, name it loudly (`openLines`) and document the contract

**Symptom:** debugger steps skip over the interesting logic in a chained pipeline
**Cause:** breakpoint set on the chain line hits the *builder* call, not the lambda bodies
**Fix:** use the IDE's lambda-target breakpoints (or put each lambda on its own line / extract to methods)

**Symptom:** `Stream.concat` of many streams (in a loop or reduce) blows the stack on traversal
**Cause:** deep left-leaning concat chains — the Javadoc warns repeated concatenation may cause `StackOverflowError`
**Fix:** `streams.flatMap(identity())` over a stream of streams instead of iterated `concat`

## Interview questions

**★ Which streams must be closed, and why doesn't the terminal operation do it?**
Streams whose source holds a resource — the `Files` factories
(`lines`, `walk`, `list`, `find`) and anything built with `onClose`
handlers. Terminal ops consume the *elements*, but the API separates
consumption from resource release (`BaseStream` is `AutoCloseable`);
try-with-resources is the documented pattern. Collection/array streams
need nothing.

**★ Why do checked exceptions and streams fight, and what are your options?**
The `java.util.function` interfaces declare no `throws`, so a lambda body
must resolve any checked exception itself. Options: wrap-and-rethrow
unchecked (`UncheckedIOException` for I/O), pre-validate so the checked
path can't occur, or model failure as data (Optional/either-style record)
when partial success is expected. The missing fourth option — "declare it
through" — doesn't exist because generic `throws` transparency was never
added to the language.

**★ `iterate` vs `generate` — when is each correct?**
`iterate(seed, f)` produces a recurrence: element n is `f`(element n−1),
inherently ordered — right for sequences, wrong when elements are
independent. `generate(s)` calls a supplier per demanded element with no
order promise — right for "a stream of randoms/fresh objects", wrong for
anything positional. Both are infinite; bound with `limit`, `takeWhile`,
or `iterate`'s predicate overload.

**★ A pipeline over `Files.lines` throws halfway through the file. What is the state of the world?**
The terminal op propagates the exception (an `UncheckedIOException` if
the failure was I/O); with try-with-resources the file still closes —
close runs on the failure path. Any side effects the pipeline already
performed have happened; there is no rollback. Which is the argument for
keeping pipelines pure and applying effects after collecting.

**★ How do you get "element plus its index" through a pipeline, given lambdas can't mutate a counter?**
Drive by index: `IntStream.range(0, list.size()).mapToObj(i -> process(i,
list.get(i)))`. The index comes from the stream's own structure, so it's
correct under any execution order — unlike an `AtomicInteger` side
counter, which numbers by execution order, not position.

**How would you debug a five-stage pipeline that produces two fewer results than expected?**
Count the flow: temporarily `.toList()` after each stage in a test (or
`peek` with a counter, minding elision) to find which stage drops them —
usually a `filter` predicate or an empty-`flatMap` mapping. Then extract
that lambda into a named method and unit-test it with the boundary
element. The vertical model guarantees a three-element reproduction
behaves like production.

**When is returning `Stream<T>` from a public API the right call?**
When laziness or short-circuiting is the value being sold: potentially
huge or I/O-backed sequences the caller may only partially consume
(`Files.lines`, `String.lines`, JDK precedents). The contract must ship
with it: single-use, and close-if-resource-backed. For plain in-memory
results, return the collection — restreamable, sizable, inspectable.

---

← Prev: [The machinery](02-the-machinery.md) · Index: [The stream pipeline](README.md)
