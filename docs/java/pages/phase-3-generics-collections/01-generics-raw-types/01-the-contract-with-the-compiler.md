---
title: "The contract with the compiler"
sidebar_label: "1 · The contract"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §4.5 (parameterized types), §8.1.2
> (generic classes), §15.9.1 (the diamond form), and the JDK 25 API
> documentation for `java.util.List` and `java.util.Map`.

**A type parameter turns a class that holds `Object` into a family of types
that each hold one thing. `List<Order>` and `List<Invoice>` are the same
class file with different compile-time contracts: the compiler rejects the
wrong `add` and guarantees the right `get` — no casts, no faith.**

## The problem generics solve

Before Java 5, every collection held `Object`, and correctness lived in the
programmer's memory:

```java
List orders = new ArrayList();       // pre-generics (raw — chunk 2)
orders.add(new Order(1));
orders.add("oops — a String");       // compiles fine

Order o = (Order) orders.get(1);     // ClassCastException — at runtime,
                                     // far from the line that caused it
```

The failure has two ugly properties: it is **distant** (the exception
surfaces at the read, which can be another class, another day) and it is
**silent until hit** (a code path that never reads index 1 never fails).
Generics move the error to the write, at compile time:

```java
List<Order> orders = new ArrayList<>();
orders.add(new Order(1));
orders.add("oops");                  // does not compile
Order o = orders.get(0);             // no cast — the type is guaranteed
```

That is the entire deal: **you state the element type once; the compiler
checks every producer and every consumer against it.**

## The vocabulary

```java
public class Box<T> {                // T: type parameter (declaration)
    private T value;                 // used like a type inside the class
    public void put(T value) { this.value = value; }
    public T get() { return value; }
}

Box<String> box = new Box<>();       // String: type argument (use site)
```

- **Type parameter** (`T`) — the placeholder in the class or method
  declaration. Convention: `T` (type), `E` (element), `K`/`V` (key/value),
  `R` (return). Single letters on purpose — they signal "placeholder, not a
  real class" at a glance.
- **Type argument** (`String`) — what you plug in at the use site. Must be
  a reference type: `Box<int>` does not compile, which is why boxing
  ([Phase 1 topic 02](../../phase-1-language-core/02-autoboxing-integer-cache/README.md))
  is a collections story.
- **Parameterized type** (`Box<String>`) — the combination. `Box<String>`
  and `Box<Integer>` are different compile-time types built from one class.
- Generic **interfaces** work identically (`interface List<E>`), and a
  class fixes or forwards the parameter when implementing:
  `class OrderList implements List<Order>` vs `class MyList<E> implements List<E>`.

## The diamond `<>`

Since Java 7 the right-hand side infers its type arguments from the left:

```java
Map<CustomerId, List<Order>> byCustomer = new HashMap<>();   // diamond
```

- Without the diamond — `new HashMap()` — you have constructed a **raw**
  map, not an inferred one. That single missing `<>` silently discards
  checking for everything you put in it (chunk 2). This is the most common
  way raw types enter modern code: a typo, not a decision.
- Since Java 9 the diamond also works on anonymous classes
  (`new Comparator<>() { ... }`).
- `var` (Phase 1 [topic 03](../../phase-1-language-core/03-var.md)) infers
  from the right side instead — `var list = new ArrayList<String>();` —
  so with `var`, the type argument must be written out on the constructor:
  `var list = new ArrayList<>();` gives `ArrayList<Object>`, which is
  almost never what was meant.

## What you get for it

- **`get` without casts** — and with them goes the whole class of
  wrong-cast bugs.
- **Intent in the signature** — `Map<String, List<Order>>` documents the
  shape; a raw `Map` documents nothing.
- **Refactoring safety** — change the element type and the compiler lists
  every line that must follow.
- **Zero runtime cost** — generics are compile-time only (erasure,
  [topic 02](../../phase-3-generics-collections/02-type-erasure.md)); a
  `List<Order>` is exactly as fast as a raw `List`.

The cost side of the trade: type arguments must be reference types (boxing
tax for primitives until Project Valhalla lands), and the runtime cannot
see them (no `instanceof List<String>` — topic 02 owns that story).

## Gotchas

**Symptom:** `new HashMap()` compiles, everything works, then a reviewer flags 47 unchecked warnings
**Cause:** missing diamond — the constructor call is raw, and every subsequent operation on the map is unchecked
**Fix:** `new HashMap<>()`; treat a raw constructor in new code as a typo, always

**Symptom:** `var list = new ArrayList<>();` then `list.add("a")` works but `String s = list.get(0)` won't compile
**Cause:** with `var` on the left there is nothing to infer from, so the diamond resolves to `ArrayList<Object>`
**Fix:** put the type argument on the constructor when using `var`: `var list = new ArrayList<String>();`

**Symptom:** `Box<int> b = ...` fails with "unexpected type"
**Cause:** type arguments must be reference types; primitives can't parameterize
**Fix:** `Box<Integer>` — and for hot numeric paths, primitive arrays or `IntStream` (Phase 4) instead of boxed collections

**Symptom:** `List<String>.class` or `new Box<String>().getClass()` comparisons behave as if the type argument doesn't exist
**Cause:** it doesn't, at runtime — one class object serves every parameterization
**Fix:** design so the runtime never needs the argument; where unavoidable, pass a `Class<T>` token ([topic 02](../../phase-3-generics-collections/02-type-erasure.md))

**Symptom:** generic class compiles but a `static` field of type `T` won't
**Cause:** `T` belongs to an *instance* of the parameterization; statics are shared across all of them ([Phase 1 topic 11](../../phase-1-language-core/11-static/README.md))
**Fix:** statics can't refer to the class's type parameter — restructure, or make the method generic with its own parameter (chunk 3)

## Interview questions

**★ What do generics actually buy over casting from `Object`?**
The same guarantee, moved: from a runtime `ClassCastException` at the read
site — possibly far from the bug — to a compile error at the write site,
on the exact wrong line. Plus self-documenting signatures and safe
refactoring. Cost: nothing at runtime; the checks are compile-time only.

**★ Why can't type arguments be primitives?**
Type arguments must be reference types because after erasure the class
works on `Object` references. `List<int>` therefore boxes to
`List<Integer>` — roughly four times the memory per element and a pointer
chase per read — which is why hot numeric paths use `int[]`
([Phase 1 topic 09](../../phase-1-language-core/09-arrays.md)) or
`IntStream` (Phase 4).

**★ What exactly does the diamond `<>` do, and what changes if you omit it?**
`<>` asks the compiler to infer the constructor's type arguments from the
target type. Omitting it does not "infer differently" — it constructs a
**raw type**, disabling generic checking for that object entirely. One
character separates checked from unchecked.

**★ Is `Box<String>` a subclass of `Box<Object>`?**
No — parameterized types from the same class have no subtype relationship
between different arguments (invariance, chunk 3). `Box<String>` and
`Box<Object>` share a class file and nothing else.

**Why are type-parameter names single capital letters?**
Pure convention (`T`, `E`, `K`, `V`, `R`), but a load-bearing one: `Box<Element>`
would parse identically, yet a maintainer reading `Element` will hunt for a
class of that name. The single letter says "placeholder" instantly.

**Can a generic class have several parameters? Can an inner class add its own?**
Yes — `Map<K, V>` — and yes: a nested generic class introduces parameters
alongside the outer's (inner classes see the outer's parameters; static
nested classes don't, same rule as all statics).

---

← Index: [Generics and raw types](README.md) · Next → [Raw types — the bug factory](02-raw-types-the-bug-factory.md)
