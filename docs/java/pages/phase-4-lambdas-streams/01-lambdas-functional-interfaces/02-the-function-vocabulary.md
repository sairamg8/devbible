---
title: "The java.util.function vocabulary"
sidebar_label: "2 · The function vocabulary"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `java.util.function` package Javadoc
> (JDK 25 API documentation), the JLS SE 25 §9.8 (functional interfaces),
> and the `@FunctionalInterface` annotation Javadoc.

**`java.util.function` is a vocabulary, not a library — 43 interfaces that
exist so every API in the ecosystem can say "give me code" in the same
words. Learn six shapes (`Function`, `Supplier`, `Consumer`, `Predicate`,
the operators, the `Bi` forms) and every stream signature, Spring callback
and Mockito stub becomes readable; skip this and every one of them is a
fresh puzzle.**

## The core six — organized by shape, not name

The names encode arity and direction: what goes in, what comes out.

| Interface | Method | In → Out | You reach for it when |
|---|---|---|---|
| `Function<T, R>` | `apply` | `T` → `R` | transform: `map`, converters, extractors |
| `Supplier<T>` | `get` | () → `T` | lazy/deferred creation: `orElseGet`, factories |
| `Consumer<T>` | `accept` | `T` → () | side effects: `forEach`, callbacks |
| `Predicate<T>` | `test` | `T` → `boolean` | decisions: `filter`, validation |
| `UnaryOperator<T>` | `apply` | `T` → `T` | same-type transform: `List.replaceAll` |
| `Runnable` | `run` | () → () | "just do it": executors, deferred blocks |

The two-argument column adds `BiFunction<T, U, R>`, `BiConsumer<T, U>`
(`Map.forEach`), `BiPredicate<T, U>`, and `BinaryOperator<T>`
(two `T` in, one `T` out — `reduce`, `Map.merge`). There is no
`BiSupplier` — nothing to take in means nothing to double.

Recognition beats recall: given `Map.computeIfAbsent(K key, Function<? super K, ? extends V> f)`
you should *see* "key in, value out" without reading further — that is the
skill this vocabulary buys.

`UnaryOperator<T> extends Function<T, T>` and
`BinaryOperator<T> extends BiFunction<T, T, T>` — they add no methods, only
a sharper name and matching static helpers (`UnaryOperator.identity()`).

## The primitive variants — why 43 and not 10

`Function<Integer, Integer>` boxes every value through the machinery
phase 1 documented ([Autoboxing](../../phase-1-language-core/02-autoboxing-integer-cache/README.md)).
For hot paths the package ships specializations for `int`, `long` and
`double` in every direction:

- `IntPredicate`, `IntFunction<R>` (int → R), `ToIntFunction<T>` (T → int),
  `IntUnaryOperator`, `IntBinaryOperator`, `IntSupplier`, `IntConsumer`,
  `ObjIntConsumer<T>` — and the same family for `Long…`/`Double…`.
- Naming rule: the prefix says the *input* is primitive (`IntFunction`);
  `To<P>` says the *output* is (`ToIntFunction`). `IntToLongFunction`
  says both.
- These are what `IntStream.map(IntUnaryOperator)` and
  `Stream.mapToInt(ToIntFunction)` take — the reason "sum money-in-cents
  without boxing" (the `reduce` topic) works at all.
- There is deliberately no `BooleanSupplier`-style full family, no
  `ShortFunction`, no `FloatPredicate`: the package covers the three
  numeric carriers the JVM computes in, plus `BooleanSupplier` alone.

Use them when a pipeline is numeric; don't contort domain code into
primitives to "save boxing" a dozen values — that is phase-12 profiling's
call, not a style rule.

## `@FunctionalInterface` — a promise, not a requirement

```java
@FunctionalInterface
public interface Retryable<T> {
    T attempt() throws Exception;              // the single abstract method

    default Retryable<T> named(String n) { … } // defaults don't count
    // static helpers don't count either
    // methods matching Object's public signatures (toString…) don't count
}
```

Any interface with exactly one abstract method is functional — lambdas work
against it with or without the annotation (`Runnable`, `Callable` and
`Comparator` predate it). The annotation makes the compiler *fail* if a
second abstract method sneaks in, turning an API-breaking edit into a
compile error at the source instead of lambda breakage in every consumer.
Rule: **annotate every interface you intend people to lambda against.**

`Comparator` is the proof of the "defaults don't count" rule: one abstract
method (`compare` — `equals` doesn't count because it matches `Object`),
plus a dozen defaults (`reversed`, `thenComparing` — phase 3's
[Comparable vs Comparator](../../phase-3-generics-collections/10-comparable-comparator/README.md)).

## Write your own, or reuse?

Reuse the standard shapes in *plumbing* — glue code, stream helpers,
internal utilities — so signatures stay instantly readable. Define your own
in *domain APIs* where the name is documentation and there is room for
evolution:

```java
@FunctionalInterface
public interface PriceRule { Money apply(Order order); }
// vs Function<Order, Money> — same shape, but the name states the contract,
// the type can't be confused with other Order→Money functions, and default
// methods (combine, cap) have a home later.
```

The wildcards you will see everywhere — `Function<? super T, ? extends R>`
— are PECS from phase 3 applied to function types: the API accepts a
function that handles anything at least as general as `T` and returns
anything at least as specific as `R`. Read them as "a function I can call
with my `T` and use the result as `R`", then move on.

## Gotchas

**Symptom:** stream over IDs is slow and allocation-heavy in a profile, all `Integer.valueOf`
**Cause:** `Function<Integer, Integer>` / `Stream<Integer>` boxing on every element
**Fix:** switch to the primitive rails: `mapToInt`, `IntUnaryOperator`, `IntStream` — the `To…`/`…To…` naming tells you which interface fits

**Symptom:** `Comparator` still works as a lambda target despite having many methods
**Cause:** only *abstract* methods count, and `equals(Object)` matches an `Object` signature — one SAM remains
**Fix:** none needed — but apply the same rules when your own interface "stops being functional" after adding a method: make additions `default`

**Symptom:** adding a method to a shared interface breaks dozens of lambdas across the codebase
**Cause:** the interface was implicitly functional and consumers lambda'd it; the new abstract method made it non-functional
**Fix:** add as `default` with a sensible body, and put `@FunctionalInterface` on it so the next attempt fails at the interface, not at the callers

**Symptom:** `Function<Order, Money>` and a hand-rolled `PriceRule` "should" be interchangeable but aren't assignable
**Cause:** functional interfaces have no structural typing in Java — same shape, unrelated types
**Fix:** bridge with a method reference (`rule::apply`) at the boundary, or standardize one type per concept in the API

**Symptom:** `computeIfAbsent(key, k -> null)` doesn't create a mapping and the "cached" work repeats every call
**Cause:** the `Function` contract in `computeIfAbsent` treats a null result as "no mapping"
**Fix:** never return null from mapping functions; cache an `Optional` or sentinel if absence is a real result

**Symptom:** wrong interface chosen — `Consumer<T>` where a result was needed, discovered only when the caller ignores computed values
**Cause:** shapes were picked by arity alone; direction (returns vs consumes) is part of the contract
**Fix:** name the data flow first — in/out/decision/effect — then pick from the table; the compiler cannot catch a `forEach` that should have been a `map`

## Interview questions

**★ Why does `java.util.function` contain 43 interfaces instead of a handful?**
Six core shapes × arity variants × primitive specializations for `int`,
`long`, `double` in each direction. The primitive forms exist because
generics can't range over primitives (erasure — phase 3), so avoiding
boxing in numeric pipelines requires dedicated types like `ToIntFunction`
and `IntUnaryOperator`.

**★ What exactly makes an interface functional?**
Exactly one abstract method, where default methods, static methods, and
abstract methods matching public `Object` signatures don't count.
`@FunctionalInterface` doesn't confer the property — it asserts it, so the
compiler rejects edits that would break every lambda consumer.

**★ `Function<Integer, Integer>` vs `IntUnaryOperator` — when does the difference matter?**
Semantically never; mechanically on every call: the former boxes argument
and result. In a tight loop or stream over millions of values that is
allocation pressure and cache misses; on a config callback invoked once it
is nothing. Choose primitive variants where the *data* is numeric and hot.

**★ Why did `Comparator` not need to change for lambdas?**
It already had a single abstract method, so it was retroactively a
functional interface — the lambda feature was designed to make decades of
existing SAM types (`Runnable`, `Callable`, listeners) lambda-compatible
for free, rather than introducing a parallel type system.

**When do you define your own functional interface instead of using `Function`?**
Domain APIs: when the name documents the contract (`PriceRule`), when you
want a place for default combinators, when checked exceptions must be in
the signature, or when two same-shaped functions must not be confusable.
Plumbing stays on the standard vocabulary.

**Why is there no `BiSupplier`?**
A supplier takes nothing — there is no second "nothing" to add. Arity
variants exist only on the input side; multiple outputs are a record
(phase 2), not a fatter interface.

---

← Prev: [Syntax, capture and `this`](01-syntax-capture-and-this.md) · Index: [Lambdas and functional interfaces](README.md) · Next → **Composition and checked exceptions** *(not written yet)*
