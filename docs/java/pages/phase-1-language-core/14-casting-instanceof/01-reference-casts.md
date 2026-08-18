---
title: "Reference casts: assertions, not conversions"
sidebar_label: "1 · Reference casts"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §5.5 (casting contexts, including
> the compile-time rules for which casts are rejected outright), §15.16
> (cast expressions), §5.1.5/§5.1.6 (widening and narrowing reference
> conversion), and the JDK 25 API documentation (`java.lang.Number`).

**A reference cast never touches the object. It was constructed as exactly
one class and stays that class for life; casts only change which *view* the
compiler lets you use. Downcasts are claims, checked at run time; a
`ClassCastException` is always a *modeling* error surfacing — the code
believed a container or API held one type and it held another.**

## Upcasts: implicit, free, always true

Subtype → supertype needs no syntax and no check — a `Child` *is a* `Base`,
and assigning it to a `Base` variable changes only the compile-time view,
never the object:

```java
Object o = "hello";          // upcast: implicit, free, unchecked — always true
```

Upcasting is not a niche operation — it happens invisibly at every method
call that takes an interface parameter and every collection insertion. It is
safe because it *loses* capability (fewer methods visible) rather than
claiming any.

## Downcasts: claims the JVM verifies

Supertype → subtype is a claim the compiler cannot verify, so the JVM
verifies it at run time:

```java
String s = (String) o;       // checked: if o isn't a String → ClassCastException
```

Key mental model: **the object never changes type.** `getClass()` tells the
truth regardless of any cast. The cast succeeded ⇒ the object always was
that type; the cast failed ⇒ the assertion was wrong, not the object.

A `ClassCastException` message names both sides —
`class java.lang.Long cannot be cast to class java.lang.Integer` — and the
fix is almost never at the throw site. It is upstream, where the wrong
object *entered* the container or crossed the API.

## What the compiler rejects before the runtime ever sees it

Not every cast compiles. JLS §5.5 rejects casts that *provably* cannot
succeed:

```java
String s = "x";
Integer i = (Integer) s;        // compile error: unrelated classes
```

But the net has holes you should know about:

- **Casting to an interface almost always compiles**, even when it looks
  absurd — because some unknown subclass of the static type *could*
  implement it. Only a `final` class (provably closed) lets the compiler
  reject an impossible interface cast at compile time.
- **Casting `null` is always legal and always succeeds**: `(String) null`
  is a `null` of static type `String`. No check fires — `null` passes every
  reference cast, which is consistent with `instanceof` rejecting it
  ([chunk 2](02-instanceof-flow-scoping.md)).

So "it compiles" means "not provably impossible" — a much weaker statement
than "plausible".

## The boxed-numeric trap

Boxed types are *reference* casts with primitive intuitions: `(Integer)
someObject` throws CCE if the object is a `Long`, even though `long → int`
would have been a legal primitive cast. Boxed numeric types are unrelated
classes to the cast machinery — there is no boxed widening, no boxed
narrowing, no numeric kinship at all:

```java
Object fromJson = 42L;              // a Long — JSON layers box unpredictably
Integer n = (Integer) fromJson;     // ClassCastException at run time
int ok = ((Number) fromJson).intValue();   // convert values, don't assert classes
```

The `Number` route is the correct boundary idiom: every boxed numeric type
extends `Number`, and `intValue()`/`longValue()` perform an actual
conversion. This trap pairs with the
[autoboxing topic](../02-autoboxing-integer-cache/README.md) — boxing decides which
class you get; casting then refuses to bridge them.

## Gotchas

**Symptom:** `ClassCastException: class java.lang.Long cannot be cast to class java.lang.Integer`
**Cause:** boxed types are unrelated classes — reference casts don't do numeric conversion, and JSON/ORM layers often box small numbers as `Integer` or `Long` unpredictably
**Fix:** cast to `Number` and call `.intValue()`/`.longValue()` at untyped boundaries — convert values, don't assert classes

**Symptom:** a cast to an interface compiled, then threw CCE in production — reviewer expected a compile error
**Cause:** interface casts are rejected at compile time only when the static type is a `final` class; otherwise some subclass could implement it, so the compiler must allow it
**Fix:** treat interface casts as runtime claims needing the same scrutiny as any downcast; an `instanceof` pattern makes the check explicit

**Symptom:** `(String) null` ran without exception and the NPE fired much later
**Cause:** `null` passes every reference cast by specification — the check is on the object, and there is no object
**Fix:** casts are not null checks; validate nullness separately (`Objects.requireNonNull` at the boundary — [the null topic](../13-null-and-npe/README.md))

**Symptom:** CCE deep inside a framework callback, naming two classes with identical names
**Cause:** same class loaded by two classloaders — class identity is (name, loader), so the "same" class from another loader is a different class to the cast machinery
**Fix:** locate the class in exactly one loader (a container/deployment problem, not a code problem); the message usually shows the two loaders in brackets

**Symptom:** a `getClass()`-based branch broke when a subclass instance arrived; an `instanceof`-based one didn't
**Cause:** `getClass()` is exact-type identity; `instanceof`/casts accept subtypes — the two encode different questions
**Fix:** decide which question you are asking: substitutability → `instanceof`; exact-type equality (some `equals` designs) → `getClass()`

## Interview questions

**★ What does a reference cast actually do at run time?**
Nothing to the object — it checks. The JVM verifies the object's actual class
against the asserted type and throws `ClassCastException` on mismatch;
otherwise the same reference flows through with a new compile-time view. The
object's type was fixed at construction and never changes.

**★ A cast between `Integer` and `Long` — legal?**
No: they are sibling classes, and reference casts don't convert. This
surprises because the primitive casts (`int`↔`long`) are legal. At untyped
boundaries, go through `Number` and convert with `.intValue()`/`.longValue()`.

**★ Which casts does the compiler reject outright, and why do interface casts usually slip through?**
Casts provably impossible by the class hierarchy — two unrelated *classes* —
fail at compile time. An interface cast compiles unless the static type is a
`final` class, because an unknown subclass could implement the interface; the
claim only becomes checkable at run time.

**Why does casting `null` never throw?**
The runtime check inspects the object's class, and `null` has no object. A
cast is therefore never a null check — the matching design fact is that
`instanceof` answers `false` for null, so the two features agree that null
belongs to no type.

**Where do you fix a `ClassCastException`?**
Upstream. The throw site is where the wrong belief met reality; the bug is
where the wrong object entered the collection, cache, or API. The exception
message naming both classes tells you what to search for.

---

← Index: [Casting and `instanceof`](README.md) · Next → [`instanceof` and flow scoping](02-instanceof-flow-scoping.md)
