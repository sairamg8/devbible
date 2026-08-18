---
title: "The boundaries"
sidebar_label: "3 · The boundaries"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.util.Optional`, `OptionalInt`, `OptionalLong` and `OptionalDouble`,
> the `Map.get`/`Map.computeIfAbsent` Javadoc, and jspecify.dev (JSpecify
> 1.0 specification) for the annotations landscape.

**Knowing the `Optional` API is chunk 2; knowing where `Optional` *stops
paying its way* is this chunk. The boundaries are: data shapes (records,
DTOs, entities) where the wrapper fights the ecosystem; seams with
null-returning APIs, where `ofNullable` belongs; the primitive variants and
their deliberately smaller API; and the honest cases where a `@Nullable`
reference beats a wrapper — a line the JSpecify effort is slowly making
tool-checkable.**

## Records and DTOs

A record component *can* be an `Optional`, and it is almost always the wrong
call for the same reasons as any field ([chunk 1](01-the-contract.md)):
serialization, an extra object per instance, and a third state (the
component itself can be null). The pattern that keeps both the storage and
the API honest:

```java
// Storage: nullable component, documented. API: Optional accessor.
public record Customer(String name, String middleName /* nullable */) {
    public Optional<String> middleNameOpt() {
        return Optional.ofNullable(middleName);
    }
}
```

The canonical constructor validates what must be present; the extra accessor
gives callers the typed absence. JSON mappers, `equals`/`hashCode` and the
canonical constructor all keep working on plain values.

For JSON specifically: Jackson needs its `jdk8` datatype module registered
before `Optional` fields round-trip at all, and even then "absent",
"present-null" and "field missing from the document" collapse in ways that
need per-project decisions. Keeping `Optional` out of the serialized shape
sidesteps the whole cliff.

## Entities and repositories — the Spring Data split

The persistence layer draws the line neatly, and it is worth internalizing
as *the* example of lane discipline:

- **Entity fields: never `Optional`.** JPA maps columns to storable types;
  a nullable column is a nullable field.
- **Repository *return types*: `Optional` is idiomatic.** Spring Data's own
  `CrudRepository.findById` returns `Optional<T>`, and the
  `orElseThrow`-into-404 chain is the standard controller move (phase 9/10
  territory — **phase 10 · data access** *(not written yet)* builds on
  this):

```java
Order order = orders.findById(id)
        .orElseThrow(() -> new OrderNotFoundException(id));
```

Same class of data, different position: storage is nullable, the *query
API* returns `Optional`. That is chunk 1's contract applied by a framework.

## The seam with null-returning Java

Most of the JDK and most libraries you call predate `Optional` or
deliberately avoid it. The conversion happens at *your* boundary, once:

```java
Optional<String> region = Optional.ofNullable(System.getenv("REGION"));
Optional<Price> cached  = Optional.ofNullable(priceBySku.get(sku));   // Map.get
```

Two disciplines keep the seam clean:

1. **Wrap immediately at the call, not layers later.** The whole point is
   that null never travels; `ofNullable` three frames up the stack means
   three frames of unprotected null.
2. **Don't wrap what has a better native answer.** `Map` grew its own
   absence handling — `getOrDefault`, `computeIfAbsent`, `merge` — that is
   both clearer and cheaper than `ofNullable(map.get(k)).orElseGet(...)`.
   Reach for `Optional` when the absence must *escape* the method, not for
   local defaulting.

Going the other way — feeding `Optional`-shaped results into null-expecting
APIs — is what `orElse(null)` is legitimately for. Confine it to the seam
and comment it; inside your own logic it is a regression.

## `OptionalInt`, `OptionalLong`, `OptionalDouble`

The primitive streams' terminals return primitive optionals:

```java
OptionalInt max = IntStream.of(ids).max();
OptionalDouble avg = orders.stream().mapToInt(Order::cents).average();
int m = max.orElseThrow();          // getAsInt() is the get() equivalent
```

Two things to know:

- **They exist to avoid boxing** — `Optional<Integer>` costs a box *and* a
  wrapper per value; `OptionalInt` is one flat carrier. On a hot aggregation
  path that difference is the reason the primitive stream API exists at all
  (topic 06 covers the boxing economics).
- **Their API is deliberately smaller** — there is **no `map`, `flatMap`,
  `filter` or `or`** on `OptionalInt`/`Long`/`Double`. You get
  presence checks, `ifPresent(OrElse)`, the `orElse` family and `stream()`.
  If you need to transform, either do it before the terminal (in the
  stream) or unwrap. Converting to the object form
  (`max.stream().boxed().findFirst()`) is possible but usually a sign the
  pipeline should have been shaped differently.

They are also value-based and non-serializable, same as `Optional`.

## When `@Nullable` is the honest choice

`Optional` is a public-API tool. Inside a class — private helpers, hot
loops, tight data structures — a nullable reference with a nullness
annotation often tells the same truth at zero allocation and zero unwrap
ceremony:

```java
private @Nullable Node find(K key) { ... }   // internal: null means miss
public Optional<V> lookup(K key) {           // boundary: typed absence
    return Optional.ofNullable(find(key)).map(n -> n.value);
}
```

The rule of thumb: **`Optional` where absence crosses an API boundary;
`@Nullable` where it stays inside one.** The JDK itself follows this — its
internals are null-based, its modern *query* APIs return `Optional`.

The annotations story is finally consolidating: **JSpecify 1.0** (a joint
spec by Google, JetBrains, Meta, Microsoft, Oracle participation and others)
standardizes `@Nullable`/`@NonNull`/`@NullMarked` semantics so tools —
IntelliJ, NullAway/Error Prone, the Kotlin compiler — can check them
consistently. A `@NullMarked` codebase gets compile-time null tracking on
*every* reference, which covers the interior cases `Optional` was never
meant for. `Optional` and JSpecify are complements, not rivals: one is an
API shape for "no result", the other is static proof about everything else.

## The cost, stated honestly

Each present `Optional` is an object allocation (empty is typically shared,
though not guaranteed — [chunk 1](01-the-contract.md)). For a method called
a handful of times per request, irrelevant. In the innermost loop of a
parser or a per-element step over millions of items, wrappers are real
work for the allocator — which is precisely why the *stream* API's internal
protocols pass plain values and why the primitive optionals exist. Measure
before blaming `Optional` for anything, but don't design a hot path's
internal representation around it either.

## Gotchas

**Symptom:** JSON of a record with an `Optional` field serializes as `{"present":true}` or fails outright
**Cause:** the mapper doesn't know `Optional` (Jackson needs the jdk8 module; others vary)
**Fix:** plain nullable fields in serialized shapes; `Optional` on accessors only

**Symptom:** `Optional` entity field breaks JPA mapping or needs a hand-written converter
**Cause:** persistence maps columns to storable types — `Optional` isn't one
**Fix:** nullable field on the entity; `Optional` belongs on the repository's query methods

**Symptom:** `ofNullable(map.get(k)).orElse(default)` scattered through a class
**Cause:** using `Optional` for *local* defaulting where `Map` already has the verb
**Fix:** `map.getOrDefault(k, default)` / `computeIfAbsent` — `Optional` is for absence that escapes the method

**Symptom:** compile error: `OptionalInt` has no `map`/`filter`
**Cause:** the primitive optionals deliberately carry a reduced API
**Fix:** transform inside the `IntStream` before the terminal, or unwrap with `orElse*` and compute

**Symptom:** `orElse(null)` sightings all over business logic
**Cause:** typed absence being converted back to null far from any legacy seam
**Fix:** keep `orElse(null)` at framework/legacy boundaries only; chains + `orElseGet`/`orElseThrow` inside

**Symptom:** micro-benchmark shows an interior data structure slower after an `Optional` refactor
**Cause:** per-element wrapper allocation on a hot path — the one place the cost is real
**Fix:** `@Nullable` internals, `Optional` at the boundary; primitive optionals for numeric terminals

**Symptom:** two "absent" states behaving differently — a missing JSON field vs an explicit null
**Cause:** `Optional` can't represent both; mappers collapse or split them per configuration
**Fix:** if the distinction is contractual, model it explicitly (e.g. JSON Merge Patch semantics need a tri-state, not `Optional`)

## Interview questions

**★ Where exactly should `Optional` appear in a Spring-style layered app?**
Repository and service *return types* for single-result lookups
(`findById`), unwrapped at the web layer via `orElseThrow` into an
error response. Not on entity fields, not on DTO fields, not on controller
parameters. Storage stays nullable; queries return typed absence.

**★ Why is `Optional` not `Serializable`, and what does that decide for you?**
Deliberate design — it was specified as a transient API-boundary type, and
making it serializable would have blessed it as a field/data-shape type.
Consequence: any serialized class (sessions, caches, DTOs) stores plain
nullable values.

**★ What do `OptionalInt`/`OptionalLong`/`OptionalDouble` exist for, and what's missing from them?**
Unboxed absence for primitive stream terminals (`max`, `average`, one-arg
`reduce`) — no `Integer` box inside an `Optional` wrapper. They omit
`map`/`flatMap`/`filter`/`or`; transformation belongs in the stream before
the terminal, or after unwrapping.

**★ Make the case for `@Nullable` over `Optional` somewhere — and for `Optional` over `@Nullable` somewhere else.**
Interior of a data structure / hot path: `@Nullable` costs nothing, stays
tool-checkable (JSpecify + NullAway), and never leaks because it's private.
Public lookup API: `Optional` — callers can't ignore absence, chains
compose, and the contract survives callers who never read Javadoc.
The boundary between "inside" and "API" is the decision line.

**★ What is JSpecify and how does it change the null-vs-Optional debate?**
A cross-vendor 1.0 spec standardizing nullness annotation semantics
(`@Nullable`, `@NonNull`, `@NullMarked`) so static tools agree on meaning.
It makes the `@Nullable` half of the discipline *checkable*: annotated
internals get compile-time null tracking, leaving `Optional` to do the one
job it was designed for — absent results at API boundaries.

**★ A teammate wraps every `Map.get` in `ofNullable`. Better options?**
For local defaults: `getOrDefault`. For populate-on-miss:
`computeIfAbsent`. For merge-style updates: `merge`. `ofNullable(get(k))`
is right only when the absence needs to *leave* the method as an
`Optional` — the map API's own verbs are clearer and allocation-free for
everything else.

**★ Why can't `Optional` model a JSON PATCH's "field absent vs field explicitly null"?**
Both collapse to `empty()` — `Optional` is binary. Merge-patch semantics
need three states (leave unchanged / set to null / set to value), so the
model must carry them explicitly (a tri-state wrapper or presence flags);
forcing it through `Optional` loses the distinction the feature depends on.

---

← Prev: [The operative API](02-the-operative-api.md) · Index: [Optional used correctly](README.md)
