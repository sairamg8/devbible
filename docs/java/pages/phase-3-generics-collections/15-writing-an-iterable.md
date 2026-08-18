---
title: "Writing an Iterable"
sidebar_label: "15 · Writing an Iterable"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the JDK 25 Javadoc for `java.lang.Iterable` and
> `java.util.Iterator` (including the documented `remove` default and the
> `NoSuchElementException` contract), and the JLS SE 25 §14.14.2 (the
> enhanced `for` statement's desugaring).

**Implementing `Iterable<T>` is what puts your own type on the right side of
a `for (T t : thing)` — the enhanced `for` is nothing but sugar over
`iterator()`, `hasNext()`, `next()`. The whole job is one method returning a
small state machine, and the contract has exactly three load-bearing lines:
`next` throws `NoSuchElementException` when exhausted, `hasNext` must be
side-effect-free, and each `iterator()` call returns a fresh, independent
iterator.**

## What the compiler does with for-each

Per JLS §14.14.2, this:

```java
for (Order o : orders) { process(o); }
```

desugars (for an `Iterable`) to:

```java
for (Iterator<Order> it = orders.iterator(); it.hasNext(); ) {
    Order o = it.next();
    process(o);
}
```

Anything whose type implements `Iterable<T>` qualifies — collections,
`Path`-walking results, your own types. (Arrays compile to an index loop
instead; they implement nothing.)

## A worked implementation

A date range that iterates day by day — the classic "my type is a sequence
but not a collection" shape:

```java
public record DateRange(LocalDate fromInclusive, LocalDate toExclusive)
        implements Iterable<LocalDate> {

    @Override public Iterator<LocalDate> iterator() {
        return new Iterator<>() {                 // fresh state per call
            private LocalDate next = fromInclusive;

            @Override public boolean hasNext() {
                return next.isBefore(toExclusive);   // no side effects
            }

            @Override public LocalDate next() {
                if (!hasNext()) throw new NoSuchElementException();
                LocalDate current = next;
                next = next.plusDays(1);             // advance ONLY here
                return current;
            }
        };
    }
}

for (LocalDate d : new DateRange(start, end)) { ... }   // just works
```

The three contract lines, mapped onto the code:

1. **`next` past the end throws `NoSuchElementException`** — not `null`,
   not a stale value. Callers besides for-each (which always checks
   `hasNext`) rely on it.
2. **`hasNext` is pure.** All advancing lives in `next`. A `hasNext` that
   moves state breaks the desugared loop, which may call it repeatedly.
3. **Each `iterator()` call is independent.** Two nested for-each loops
   over the same object must not share a cursor — which is exactly what
   happens if the *container* implements `Iterator` itself (the classic
   one-shot bug).

`remove()` needs no code: the interface default throws
`UnsupportedOperationException` (documented) — correct for read-only
sequences. Implement it only if removal is genuinely supported, with the
"once per `next`, else `IllegalStateException`" contract the Javadoc
specifies.

## When a Stream beats a custom Iterable

The same range as a one-liner, no class at all:

```java
Stream<LocalDate> days = start.datesUntil(end);          // JDK-provided
IntStream.range(0, n).mapToObj(i -> ...)                 // the general trick
```

Reach for `Iterable` when callers should *for-each your type directly*,
re-iterate it many times, or pass it to APIs that take `Iterable`. Reach
for a `Stream`-returning method when the sequence is consumed once in a
pipeline — a `Stream` is itself one-shot, which is topic territory for
**Phase 4** *(not written yet)*. A type can offer both (`iterator()` and a
`stream()` accessor); the collections do.

## Gotchas

**Symptom:** second for-each over the same object silently iterates nothing
**Cause:** the class implements `Iterator` *and* `Iterable`, returning `this` from `iterator()` — one shared exhausted cursor
**Fix:** `Iterable` is the container, `Iterator` the cursor; `iterator()` constructs a fresh cursor every call

**Symptom:** loop skips every other element
**Cause:** `hasNext` advances state (or `next` is called twice per iteration — once "to check", once to use)
**Fix:** advancement lives in `next` alone; capture `next()`'s result in one variable

**Symptom:** `NullPointerException` in caller code far from the sequence's end
**Cause:** `next` returned `null` past the end instead of throwing `NoSuchElementException`
**Fix:** honor the contract — the throw is the API; null is a value, not a signal ([Phase 1, topic 13](../phase-1-language-core/13-null-and-npe/README.md))

**Symptom:** `UnsupportedOperationException` from `it.remove()` surprises a caller
**Cause:** the interface default — the implementor never wrote `remove` at all
**Fix:** working as documented; support removal deliberately or let the default stand and say so in the type's Javadoc

**Symptom:** `ConcurrentModificationException`-style corruption from a hand-rolled iterator over a mutable backing structure
**Cause:** custom iterators get no fail-fast modCount machinery for free — mutation mid-iteration silently derails the cursor
**Fix:** iterate a snapshot, document "don't mutate while iterating", or build modCount checking like the JDK collections do (**topic 11** *(not written yet)*)

## Interview questions

**★ What exactly does for-each require of a type, and what does it compile to?**
`Iterable<T>` — one `iterator()` method. JLS §14.14.2 desugars the loop to
`iterator()`/`hasNext()`/`next()` calls; there is no other magic, which is
why any hand-written iterator drives for-each identically.

**★ Why must `iterator()` return a new object each call?**
Independent traversals — nested loops, retries, two callers. Sharing a
cursor makes iteration one-shot and order-dependent, the signature bug of
merging `Iterable` and `Iterator` into one class.

**★ Where does `Iterator` beat `Stream`, and vice versa?**
`Iterator`/`Iterable`: re-iterable, for-each syntax, lazy pull with easy
early exit, no pipeline machinery. `Stream`: fusion of map/filter/collect,
parallel option, but one-shot and no checked exceptions through it. The
JDK's own types offer both faces.

**Why is `remove` a default method that throws?**
Java 8 retrofitting: most iterators are read-only, so the interface made
the common case free and opt-in mutation explicit — the same
"unsupported by default" pattern as the immutable collections.

**What does `Iterable`'s `forEach(Consumer)` default buy you?**
An internal-iteration shortcut (`thing.forEach(x -> ...)`) without writing
the loop; the default just runs the enhanced for internally (documented).
Override only when the structure can iterate itself faster.

---

← Prev: [Choosing a collection](14-choosing-a-collection/README.md) · Next → **Legacy types** *(not written yet)*
