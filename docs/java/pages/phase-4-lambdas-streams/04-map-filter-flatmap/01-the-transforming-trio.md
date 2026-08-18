---
title: "The transforming trio: map, filter, flatMap"
sidebar_label: "1 · The transforming trio"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `Stream#map`, `Stream#filter`, `Stream#flatMap`, `Stream#mapMulti`,
> `Optional#stream`, and the `java.util.stream` package documentation.

**Three shapes cover every element-wise transformation: `map` is 1 → 1,
`filter` is 1 → 0-or-1, and `flatMap` is 1 → 0-or-many. The moment you know
which shape your problem is, the operation chooses itself — and the moment
you find yourself with a `Stream<List<LineItem>>` when you wanted
`Stream<LineItem>`, you've found the `flatMap` you were missing.**

## `map` — one in, one out, always

```java
List<String> emails = users.stream()
    .map(User::email)           // Stream<User> → Stream<String>
    .toList();
```

- The mapper is applied **once per element**; the stream's size never
  changes. A `null` return doesn't remove the element — it puts a `null` *in*
  the stream, which a later `filter(Objects::nonNull)` must clean up (or
  better: don't return null from mappers).
- `map` must be **stateless and non-interfering** — the per-method Javadoc
  makes both a requirement, not a suggestion. Mutating the source or
  accumulating into a captured list inside `map` is the bug topic 10 covers.
- The type transformation is the point: each `map` step is a typed pipeline
  stage, and the compiler tracks it. When a chain stops compiling, read the
  types stage by stage — the error is almost always one stage earlier than
  where javac reports it.

## `filter` — the predicate keeps, not removes

```java
orders.stream()
    .filter(o -> o.total().signum() > 0)   // keeps matching elements
```

The predicate answers "keep?", not "drop?" — inverted predicates are the
most common one-line stream bug and survive review because both versions
read plausibly. `Predicate.not(String::isBlank)` reads the intent out loud
and is the idiomatic negation since 11.

## `flatMap` — the one worth mastering

`flatMap` maps each element to a **stream** and concatenates the results
into one flat stream. Three patterns are daily work:

**1 · Parent → children (orders → all their line items):**

```java
List<LineItem> allItems = orders.stream()
    .flatMap(order -> order.lineItems().stream())   // Stream<LineItem>
    .toList();
```

Without `flatMap` this is a nested loop with an accumulator list; with a
`map` instead you get `Stream<Stream<LineItem>>` — the compile error that
teaches most people the difference.

**2 · Flattening nested collections:**

```java
List<List<String>> pages;                       // paginated results
List<String> all = pages.stream()
    .flatMap(List::stream)
    .toList();
```

**3 · `Optional.stream()` — filter-and-unwrap in one step (since 9):**

```java
List<User> found = ids.stream()
    .map(repo::findById)                  // Stream<Optional<User>>
    .flatMap(Optional::stream)            // present → 1 element, empty → 0
    .toList();
```

This replaces the pre-9 `.filter(Optional::isPresent).map(Optional::get)`
pair — one op, no `get`, nothing for a linter to flag.

Two contract details from the Javadoc that bite:

- Each mapped stream is **closed after its contents are placed into the
  outer stream** — hand `flatMap` a stream you also use elsewhere and the
  second use throws `IllegalStateException: stream has already been operated
  upon or closed`.
- A mapper may return `null` **instead of** an empty stream? No — the Javadoc
  says an empty stream must be used; returning `null` throws a
  `NullPointerException` when the pipeline reaches that element, far from
  the mapper that caused it.

## `mapMulti` — the low-allocation alternative (since 16)

`flatMap` allocates a `Stream` per element even when most elements produce
zero or one result. `mapMulti` hands you a consumer instead — push zero or
more values, no per-element stream:

```java
List<LineItem> allItems = orders.stream()
    .<LineItem>mapMulti((order, sink) ->
        order.lineItems().forEach(sink))
    .toList();
```

The Javadoc's own guidance on when it beats `flatMap`: when the number of
results per element is **small (possibly zero)**, or when an
imperative/recursive walk produces the results more naturally than building
a stream (e.g. flattening a tree). Note the explicit type witness
(`.<LineItem>mapMulti`) — inference usually can't see through the consumer,
and this is where most first attempts stop compiling.

## Choosing between the three (and a half)

| Your problem | Shape | Op |
|---|---|---|
| Convert each element | 1 → 1 | `map` |
| Keep some elements | 1 → 0/1 | `filter` |
| Unwrap `Optional`s, dropping empties | 1 → 0/1 | `map` + `flatMap(Optional::stream)` |
| Each element expands to many | 1 → 0..n | `flatMap` |
| Expands to *few*, hot path, or recursive walk | 1 → 0..n | `mapMulti` |

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `Stream<Stream<X>>` or `Stream<List<X>>` where you wanted `Stream<X>` | Used `map` where the mapper returns a collection/stream | `flatMap(x -> …stream())`, or `map` then `flatMap(List::stream)` |
| `IllegalStateException: stream has already been operated upon or closed` inside a pipeline | The `flatMap` mapper returned a stream that was already consumed (stored in a variable and used twice) | Build a fresh stream inside the mapper each time |
| `NullPointerException` deep in a terminal op, stack trace not naming your code | A `flatMap` mapper returned `null` instead of `Stream.empty()` | Return `Stream.empty()`; the Javadoc requires an empty stream, never null |
| `null` elements appear downstream and blow up in a collector | A `map` mapper returned `null` — `map` never drops elements | Fix the mapper, or follow with `filter(Objects::nonNull)` |
| Filter seems to do the opposite of what it says | Predicate written as "drop?" instead of "keep?" | Re-read as "keep when true"; use `Predicate.not(…)` for negation |
| `mapMulti` call won't compile with a lambda that looks right | Type inference can't determine the result type from the consumer | Add the type witness: `.<LineItem>mapMulti(…)` |
| Duplicate work when the same expensive `map` result feeds two conditions | Each stream element flows through once, but you called the mapper twice in two ops | `map` to a record/pair once, then filter/map on the carried value |

## Interview questions

1. **"What's the difference between `map` and `flatMap`?"** — `map` is 1 → 1:
   the mapper's return value becomes the element. `flatMap` is 1 → 0..n: the
   mapper returns a *stream*, and its elements are spliced into the outer
   stream. If your mapper returns a collection or stream, `map` gives you a
   stream *of containers*; `flatMap` gives you the contents.
2. **"You have `List<Order>`, each with `List<LineItem>`. Produce all line
   items."** — `orders.stream().flatMap(o -> o.lineItems().stream()).toList()`.
   The follow-up "and only for paid orders?" adds a `filter(Order::isPaid)`
   *before* the `flatMap` — filtering parents is cheaper than filtering
   children.
3. **"How do you turn `Stream<Optional<User>>` into `Stream<User>` with the
   empties gone?"** — `.flatMap(Optional::stream)` (since 9). Before that:
   `.filter(Optional::isPresent).map(Optional::get)`.
4. **"Can a `map` operation change the number of elements in a stream?"** —
   No. Even returning `null` keeps the element (as null). Only `filter`,
   `flatMap`/`mapMulti`, `distinct`, `limit`/`skip`/`takeWhile`/`dropWhile`
   change cardinality.
5. **"When would you pick `mapMulti` over `flatMap`?"** — Per the Javadoc:
   few (possibly zero) results per element, where a `Stream` allocation per
   element is waste, or when generating results imperatively/recursively is
   more natural than composing a stream. Otherwise `flatMap` reads better.
6. **"Why must the function passed to `map` be stateless?"** — The stream
   contract (package doc) allows the runtime to reorder or parallelize
   execution; a stateful mapper produces results that depend on execution
   order, which is undefined. Topic 10 shows the failure modes.
7. **"What happens if a `flatMap` mapper returns `null`?"** — NPE at
   traversal time. The contract requires an empty stream for "no results" —
   `null` is not the empty stream. (Contrast `mapMulti`: just don't call the
   consumer.)

---

← Index: [map, filter, flatMap and friends](README.md) · Next → [Stateful, bounding and peek](02-stateful-bounding-peek.md)
