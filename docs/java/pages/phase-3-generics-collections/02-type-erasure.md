---
title: "Type erasure"
sidebar_label: "02 · Type erasure"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JLS SE 25 §4.6 (type erasure), §4.12.2
> (heap pollution), §8.4.8.3 (bridge methods), §9.6.4.7 (`@SafeVarargs`),
> and the JDK 25 API documentation for `java.lang.Class` and
> `java.lang.reflect.Method#getGenericReturnType`.

**Generics are a compile-time construct: after the compiler has proven your
code type-correct, it erases the type arguments — `List<Order>` becomes
`List`, `T` becomes `Object` (or its first bound) — and inserts casts where
reads need them. One class file serves every parameterization. The design
bought seamless migration from pre-generics Java at a permanent price: the
runtime cannot see type arguments, and everything that would need them —
`new T[]`, `instanceof List<String>`, overloads differing only in
arguments — is impossible.**

## What erasure actually does

The compiler's rewrite (JLS §4.6):

- `List<Order>`, `List<String>`, `List<?>` → `List` in the bytecode.
- A type variable `T` → its **first bound**: `<T>` → `Object`,
  `<T extends Number>` → `Number`, `<T extends Number & Serializable>` →
  `Number` (first bound wins; casts to the others are inserted as needed).
- **Casts appear at typed reads**: `Order o = orders.get(0)` compiles to
  `get` returning `Object` plus a checked cast to `Order`. This inserted
  cast is where heap pollution detonates
  ([topic 01 chunk 2](01-generics-raw-types/02-raw-types-the-bug-factory.md)).
- Generic *method* parameters erase the same way; the proof happened at
  compile time, the bytecode runs untyped.

One consequence up front: **erasure is why generics cost nothing at
runtime** — no per-parameterization classes (contrast C++ templates, .NET
reified generics), no runtime checks beyond the casts you would have
written by hand in 2003.

## What it breaks — the complete everyday list

### No `instanceof` against a parameterized type

```java
if (x instanceof List<String>) { }   // does not compile — unverifiable
if (x instanceof List<?>) { }        // fine — asks only "is it a List"
```

The runtime can check "is a `List`"; it cannot check what was in the
angle brackets, so the language refuses to pretend.

### One `.class`, one class object

`List.class` exists; `List<String>.class` does not.
`new ArrayList<String>().getClass() == new ArrayList<Integer>().getClass()`
is `true` — one class object, so class-based dispatch, caches keyed on
`getClass()`, and most reflection see no difference between
parameterizations.

### Overloads can't differ by type argument only

```java
void handle(List<Buyer> buyers) { }
void handle(List<Seller> sellers) { }   // does not compile — same erasure
```

Both erase to `handle(List)` — a compile error ("both methods have same
erasure"). The fix is different method names, which is also the more
readable API.

### No `new T[]`, no `new T()`

`new T[10]` would need the real `T` for the array's runtime component type
([Phase 1 topic 09](../phase-1-language-core/09-arrays.md) — array
stores are runtime-checked); `new T()` would need the real constructor.
Standard escapes:

```java
T[] a = (T[]) new Object[n];        // inside collection implementations —
                                    // fenced @SuppressWarnings("unchecked")
List<T> list = new ArrayList<>();   // usually the honest answer

<T> T make(Class<T> type) {         // "type token" — pass the class in
    return type.getDeclaredConstructor().newInstance();
}
```

The `Class<T>` **type token** pattern is how Jackson
(`readValue(json, Order.class)`), JUnit and DI containers smuggle the
type a signature erased back in as a value.

### Bridge methods

Erasure would break overriding — `compareTo(Order)` in your class vs the
erased `compareTo(Object)` the interface declares — so the compiler
generates a hidden **bridge method** (`compareTo(Object)` that casts and
delegates, JLS §8.4.8.3). Where you meet them: stack traces with two
`compareTo` frames, `getDeclaredMethods()` returning "duplicate" synthetic
entries (`Method::isBridge` filters them), and coverage tools reporting an
uncoverable method.

### Varargs of a generic type — `@SafeVarargs`

`T...` compiles to a `T[]`, which erasure makes an `Object[]` — a
covariant array of an erased type, the exact combination that enables heap
pollution. Hence the "possible heap pollution from parameterized vararg
type" warning on `List<String>... lists`. `@SafeVarargs` (JLS §9.6.4.7) is
the author's promise that the method only reads the array — the JDK's own
`List.of(E...)` carries it. Legal only on methods that can't be overridden
(`static`, `final`, `private`, constructors), because the promise must
bind every implementation.

## What survives erasure

Erasure removes arguments from *objects*, not from *declarations*. Field
types, method signatures, superclass and bound declarations keep their
generic form in the class file's `Signature` attribute — readable via
`Field#getGenericType`, `Method#getGenericReturnType`,
`Class#getGenericSuperclass`. That is how Jackson deserializes a
`List<Order>` **field** correctly without being told, and how the
"super type token" trick works: `new TypeReference<List<Order>>() {}`
creates a subclass whose *declared* superclass — generic arguments
included — is reflectively readable. What is genuinely gone is the
argument of a runtime *instance*: nothing recovers the `<Order>` from an
`ArrayList` object itself.

## Gotchas

**Symptom:** "both methods have same erasure" on two overloads that look obviously different
**Cause:** the difference lives entirely in type arguments, which erase
**Fix:** different names (`handleBuyers`/`handleSellers`); as an API-design matter the names were better anyway

**Symptom:** `instanceof List<String>` rejected, so a raw cast was written and now warns
**Cause:** the runtime check is impossible; the cast is unverifiable
**Fix:** check `instanceof List<?>`, then validate *elements* if provenance is untrusted, or redesign so the type is known statically

**Symptom:** Jackson deserializes `List<Order>` into `List<LinkedHashMap>` and later reads throw `ClassCastException`
**Cause:** `readValue(json, List.class)` passes an erased token — element type unknown, so maps are produced; the failure surfaces at the first typed element read
**Fix:** `new TypeReference<List<Order>>() {}` — the super-type-token reads the argument from the anonymous class's declared supertype

**Symptom:** reflection over a class shows duplicate methods with identical names
**Cause:** compiler-generated bridge methods reconciling erased overrides
**Fix:** filter with `Method::isBridge`/`isSynthetic`; never assume one name → one `Method`

**Symptom:** heap-pollution warning on a `T...` parameter that looks innocent
**Cause:** generic varargs materialize as an erased, covariant `Object[]` — writable unsafely by design
**Fix:** if the method only reads the array, annotate `@SafeVarargs` (on a non-overridable method); if it writes or leaks the array, the warning is a real bug report

**Symptom:** `catch (AppException<Payment> e)` won't compile
**Cause:** generic catch is unverifiable — a `Throwable` subclass cannot be generic at all (JLS §8.1.2)
**Fix:** non-generic exception carrying a typed payload field, or distinct exception classes per case ([Phase 5](../phase-5-exceptions/README.md) covers failure design)

**Symptom:** a `Class<T>` parameter was added "for erasure reasons" but callers now pass `List.class` for a `List<Order>` and element type is still lost
**Cause:** `Class` tokens carry only the raw type — one level, no nesting
**Fix:** for nested generics use the super-type-token pattern (`TypeReference`, Spring's `ParameterizedTypeReference`); plain `Class<T>` tokens suffice only for non-generic `T`

## Interview questions

**★ Why did Java choose erasure over reified generics?**
Migration compatibility, chosen deliberately in Java 5: erased generics
let old bytecode and generified code interoperate both ways — a
pre-generics `List` and a `List<String>` are the same runtime type, so
neither side recompiles. The cost is permanent runtime blindness to type
arguments. Kotlin inherits it on the JVM (its `reified` works only in
inlined functions); C# reified instead because .NET accepted breaking its
type system between versions.

**★ Where exactly does the `ClassCastException` from heap pollution come from, if generics are erased?**
From the cast the *compiler inserted* at the typed read
(`Order o = list.get(0)` → cast to `Order`). Erasure removes the types
but adds back the casts the source no longer shows — so the crash names a
line with no visible cast on it.

**★ What is a bridge method and why does it exist?**
A compiler-synthesized method reconciling an erased supertype signature
with a specialized override — `compareTo(Object)` casting and delegating
to your `compareTo(Order)`. Without it, dynamic dispatch
([Phase 2 topic 04](../phase-2-classes-objects/04-polymorphism-dispatch/README.md))
through the erased interface signature would miss your override.

**★ How does Jackson's `TypeReference` recover a type erasure destroyed?**
It doesn't recover it from an instance — it reads it from a *declaration*.
`new TypeReference<List<Order>>() {}` is an anonymous subclass whose
declared generic supertype, including `<List<Order>>`, is stored in the
class file and readable via `getGenericSuperclass`. Declarations keep
generics; only instances lose them.

**★ Why is `@SafeVarargs` restricted to static, final or private methods and constructors?**
It is a promise about an implementation ("this body never writes the
varargs array unsafely"). An overridable method can't make that promise —
a subclass body could violate it while callers still see the annotation —
so the language limits it to methods with exactly one possible body.

**What does `<T extends Number>` erase to, and when does it matter?**
To `Number` — the first bound. It matters for overload clashes (two
methods erasing to the same `Number`-taking signature), for the raw type
seen by reflection, and for which casts the compiler inserts for the
other bounds.

---

← Prev: [Generics and raw types](01-generics-raw-types/README.md) · Next → [Wildcards and PECS](03-wildcards-pecs.md)
