---
title: "Generic methods and invariance"
sidebar_label: "3 · Methods and invariance"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §8.4.4 (generic methods), §4.10
> (subtyping — parameterized types), §18 (type inference), and the JDK 25
> API documentation for `java.util.Collections` and `java.util.Comparator`.

**A generic method carries its own type parameter, scoped to one call; the
compiler infers the argument per call site, which is why you almost never
see the parameter written. And parameterized types are *invariant*:
`List<String>` is not a `List<Object>`, however loudly intuition objects.
Those two facts together are most of "reading library signatures" — and
invariance is the door wildcards ([topic 03](../03-wildcards-pecs.md))
were built to open.**

## Generic methods

The parameter is declared *before the return type*, and belongs to the
method alone:

```java
public static <T> T firstOrNull(List<T> list) {
    return list.isEmpty() ? null : list.get(0);
}

public static <T extends Comparable<T>> T max(List<T> list) { ... }

Order first = firstOrNull(orders);        // T inferred as Order — no <>
```

- Works in any class, generic or not; `static` methods **must** use their
  own parameter, since the class's `T` is per-instance and statics have no
  instance ([Phase 1 topic 11](../../phase-1-language-core/11-static/README.md)).
- Inference (JLS §18) resolves `T` from the arguments and the *target
  type* — `Collections.<String>emptyList()` shows the rare explicit form,
  needed only when there is nothing to infer from.
- Real signatures read exactly like this once the vocabulary lands:
  `Comparator.comparing(Function<? super T, ? extends U>)`,
  `Collectors.toMap(...)` — type parameter, bounds, wildcards, in that
  order.

### Bounds

`<T extends Something>` constrains the argument and *unlocks its API
inside the method* — without a bound, `T` only has `Object`'s methods:

```java
static <T extends Comparable<T>> T max(List<T> list)   // can call compareTo
static <T extends Number & Serializable> void f(T t)   // multiple bounds: class
                                                       // first, then interfaces
```

The production-grade sort signature bound is worth decoding once:
`<T extends Comparable<? super T>>` — "T can compare itself, possibly via
a comparison defined on a supertype" — which is what lets a subclass sort
with the parent's `compareTo`. The `? super` half is
[topic 03's](../03-wildcards-pecs.md) subject.

## Invariance — the rule intuition fights

```java
List<String> strings = List.of("a");
List<Object> objects = strings;        // does NOT compile
```

If it did compile, this would:

```java
objects.add(42);                        // fine for a List<Object>
String s = strings.get(1);              // ClassCastException — pollution
```

**Invariance is what makes generic writes safe.** Arrays chose the
opposite — covariance, checked per-store at runtime — and that produced
`ArrayStoreException`
([Phase 1 topic 09](../../phase-1-language-core/09-arrays.md)). Generics,
being erased, could not runtime-check stores, so the unsafe assignment is
rejected at compile time instead. Same hole, plugged at a better layer.

Two corollaries that bite weekly:

- **Nesting doesn't rescue it**: `List<List<String>>` is not a
  `List<List<Object>>` — invariance applies at every depth.
- **It is about type arguments, not the types themselves**: `ArrayList<String>`
  *is* assignable to `List<String>` (ordinary subtyping of the class), and
  `List<String>` to `Collection<String>`. What never converts is the
  *argument*: `C<Sub>` to `C<Super>`.

When a method should accept "a list of any Order subtype" or "a consumer
of any Order supertype", the answer is not raw and not `Object` — it is a
wildcard, and that is exactly where [topic 03](../03-wildcards-pecs.md)
picks up.

## Gotchas

**Symptom:** "non-static type variable T cannot be referenced from a static context"
**Cause:** a static method tried to use the class's type parameter; the class's `T` exists per parameterized instance
**Fix:** give the method its own parameter: `static <T> Box<T> of(T value)` — the idiom behind every static factory

**Symptom:** `max(orders)` fails to compile with a wall of inference errors, though `Order implements Comparable<Order>`
**Cause:** the bound is `<T extends Comparable<T>>` but the class inherits `Comparable` from a superclass — `Order extends BaseEntity implements Comparable<BaseEntity>` doesn't satisfy `Comparable<Order>`
**Fix:** the library-grade bound `<T extends Comparable<? super T>>` accepts comparison-via-supertype; when writing your own bounded methods, copy that form

**Symptom:** method that takes `List<Object>` rejects every actual list in the codebase
**Cause:** invariance — only `List<Object>` itself assigns to it
**Fix:** `List<?>` if it only reads, `List<? extends T>` for typed reads; reserve `List<Object>` for genuinely heterogeneous data

**Symptom:** `var x = Collections.emptyList();` then `x.add(...)` or typed use fails
**Cause:** no target type to infer from — `T` resolves to `Object`, so `x` is `List<Object>`
**Fix:** declare the target (`List<String> x = Collections.emptyList();`) or witness it (`Collections.<String>emptyList()`); same trap as diamond-with-`var` (chunk 1)

**Symptom:** overriding a generic method in a subclass silently created an overload instead
**Cause:** the override changed the type-parameter bounds or spelled the parameter differently in a way that changed erasure; signatures no longer match
**Fix:** `@Override` on every intended override ([Phase 2 topic 03](../../phase-2-classes-objects/03-inheritance/README.md)) turns the silent fork into a compile error

**Symptom:** IDE offers `Collections.<String>emptyList()` syntax and reviewers have never seen it
**Cause:** explicit type witnesses are legal on any generic method call but almost always redundant since Java 8's target-typing improvements
**Fix:** keep them only where inference genuinely fails (chained calls with no target type); otherwise let inference work

## Interview questions

**★ Why is `List<String>` not a subtype of `List<Object>`, when `String[]` is a subtype of `Object[]`?**
Generic writes can't be checked at runtime (erasure), so the compiler must
prevent the aliasing that would make a checked-looking write unsafe —
invariance. Arrays keep runtime component types, so Java let them be
covariant and checks every store, throwing `ArrayStoreException` on
violation. Generics moved the same error to compile time; arrays punt it
to runtime.

**★ Declare a static generic method returning the first element of any list.**
`public static <T> T first(List<T> list) { return list.get(0); }` — the
`<T>` before the return type is the method's own declaration; call sites
never write it because §18 inference resolves it from the argument.

**★ What does `<T extends Comparable<? super T>>` accept that `<T extends Comparable<T>>` rejects?**
Types that inherit their comparison: if `Employee extends Person` and
`Person implements Comparable<Person>`, then `Employee` satisfies only the
`? super` form — it is a `Comparable<Person>`, not a
`Comparable<Employee>`. Library code (`Collections.sort`) uses the wider
bound so subclasses remain sortable.

**★ Can a generic method's type parameter shadow the class's?**
Yes — `class Box<T> { <T> T oops(T t) {...} }` compiles, and the method's
`T` hides the class's, which is a reliable source of confusion. Name
method parameters differently (`<R>`, `<U>`) when the class is generic.

**What are multiple bounds and their ordering rule?**
`<T extends ClassBound & Interface1 & Interface2>` — at most one class,
first, then interfaces. Inside the method, `T` has the union of their
APIs; the erasure of `T` is the first bound
([topic 02](../02-type-erasure.md) explains why that matters).

**When must you write an explicit type witness?**
When neither arguments nor target type pin the parameter — classically
passing `Collections.emptyList()` straight into an overloaded method or a
ternary. `Collections.<Order>emptyList()` resolves it. Rare by design;
prefer restructuring so inference works.

---

← Prev: [Raw types — the bug factory](02-raw-types-the-bug-factory.md) · Index: [Generics and raw types](README.md) · Next → [Type erasure](../02-type-erasure.md)
