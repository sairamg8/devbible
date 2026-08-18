---
title: "Primitive casts, erasure, and covariant arrays"
sidebar_label: "3 · Primitive casts and erasure"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §5.1.2 (widening primitive
> conversion), §5.1.3 (narrowing primitive conversion), §5.5 (casting
> contexts), §15.20.2, the JDK 25 Javadoc (`Math.toIntExact`), and JEP 394.

**Same syntax, different machine: a cast between primitive types is an
actual value conversion — silent, unchecked, specified to truncate — and a
cast involving generics is the opposite extreme, a claim the runtime cannot
check at all. This chunk covers both ends: the cast that never throws but
destroys bits, and the cast that cannot throw *here* but detonates later at
someone else's line.**

## Primitive casts: actual conversions, silently lossy

Widening (`int → long`, `int → double`) is implicit and value-preserving
(mostly — `int → float` and `long → double`/`long → float` can lose
precision in the low bits: the target's mantissa is narrower than the
source's range). **Narrowing requires an explicit cast and simply
truncates**:

```java
long big = 4_000_000_000L;
int n = (int) big;            // no exception — the top bits are gone; n is negative
```

No runtime check, no error — modular truncation is the *specified* behaviour
(JLS §5.1.3). This is a different universe from reference casts: nothing is
asserted, bits are transformed. The overflow discipline (`Math.toIntExact`
for checked narrowing) belongs to
[operators and overflow](../04-operators-overflow/README.md); the point here is
that the cast syntax gives no hint which universe you are in — the operand
types decide.

Special cases worth naming:

- `double → int` saturates at the extremes and maps `NaN` to `0` (not modular
  like integer→integer narrowing) — a second, different silent rule inside
  "narrowing" ([the floating-point topic](../05-floating-point-bigdecimal/README.md)).
- `char` ↔ numeric casts are how character arithmetic works —
  `(char) ('a' + 1)` — and how negative numbers become surprising chars.

## The boxed/primitive seam

Casting works differently on either side of autoboxing, and the compiler
picks the machinery from the *static types*:

```java
Object o = 42;                 // boxes to Integer
int a = (int) o;               // unboxing cast: checks "is Integer", then unwraps — CCE if o is a Long
long b = (long) (int) o;       // legal chain: reference-check, unbox, then widen
long c = (long) o;             // THROWS if o is an Integer — asserts "is a Long", and it isn't
```

The last line is the interview-grade trap: `(long) o` on a boxed `Integer`
is a *reference* cast to `Long` (then unbox), not a numeric widening — boxed
types have no kinship. The two-step `(long) (int) o` spells out the real
route: assert `Integer`, unbox to `int`, widen to `long`.

## Generics: the cast the runtime cannot check

Erasure ([Phase 3's type-erasure topic](../../phase-3-generics-collections/02-type-erasure.md) owns the
mechanism) means the runtime knows a `List`, not a `List<String>`. Two
consequences here:

- `obj instanceof List<String>` **does not compile** — the runtime could
  never answer it. Only `List<?>` (or a raw check) is testable.
- A cast *to* `List<String>` compiles with an **unchecked warning** and no
  runtime verification. The CCE, if the claim was wrong, fires later — at the
  first `String s = list.get(i)` — far from the lying cast.

Discipline: treat every `@SuppressWarnings("unchecked")` as a signed
statement that you have out-of-band proof, scoped to the smallest possible
declaration, with a comment saying what the proof is.

## Arrays: the covariant exception

Arrays are covariant — `String[]` *is a* `Object[]` to the type system — so
the compiler accepts assignments that generics reject, and the runtime backs
them with a per-store check:

```java
Object[] arr = new String[3];   // legal: array covariance
arr[0] = 42;                    // compiles — throws ArrayStoreException at run time
```

That per-store check is the price of covariance, and it is the exact bug
shape invariant generics were designed to prevent —
[the arrays topic](../09-arrays.md) tells the full story, and it is why
`List<String>` is *not* a `List<Object>` while `String[]` *is* an
`Object[]`. Reference casts between array types (`(String[]) objArray`)
are checked like any downcast — on the *array object's* actual component
type, not element by element.

## Gotchas

**Symptom:** CCE at a `list.get(...)` line nowhere near any cast
**Cause:** an unchecked generic cast earlier claimed `List<String>` over a list holding something else; erasure deferred the check to the read site
**Fix:** find the `@SuppressWarnings("unchecked")` or raw-type assignment upstream — that's the lying line; validate contents at the boundary instead of asserting

**Symptom:** `(int) someLong` produced a negative number; no exception anywhere
**Cause:** narrowing primitive casts truncate bits by specification — they never throw
**Fix:** `Math.toIntExact(someLong)` when overflow must be an error; the silent form only where truncation is the intent (hashing, masking)

**Symptom:** `x instanceof List<String>` won't compile
**Cause:** erasure — the runtime cannot distinguish `List<String>` from `List<Integer>`, so the language refuses the untestable question
**Fix:** test `instanceof List<?>`, then validate/cast *elements* as they are read, or redesign so the element type is carried by your own typed wrapper

**Symptom:** `(long) obj` threw CCE though the value "was a number"
**Cause:** the object was a boxed `Integer`; `(long)` on a reference asserts `Long` — boxed types have no widening relationship
**Fix:** `((Number) obj).longValue()`, or the explicit two-step `(long) (int) obj` when the boxed class is known

**Symptom:** a `double` cast to `int` produced `0` from `NaN` and `Integer.MAX_VALUE` from an overflow — different rules than the long→int case
**Cause:** floating→integral narrowing saturates and zeroes NaN (JLS §5.1.3); integral→integral narrowing truncates modularly — two silent rules under one syntax
**Fix:** range-check before the cast at boundaries; know which of the two rules applies to the types at hand

**Symptom:** `ArrayStoreException` deep in library code that "only assigned an element"
**Cause:** array covariance let a `String[]` travel as `Object[]`; the runtime store-check caught the wrong element type
**Fix:** don't pass arrays covariantly across API boundaries; use `List<T>` (invariant, compile-time-checked) — [the arrays topic](../09-arrays.md)

## Interview questions

**★ How do primitive casts differ from reference casts?**
Primitive casts convert values — narrowing truncates silently by spec, no
runtime check. Reference casts convert nothing — they assert, and are checked
with CCE on failure. Same syntax, disjoint semantics; the operand types
decide which you wrote.

**★ Why is `instanceof List<String>` illegal but `(List<String>)` only a warning?**
Erasure removes element types at run time, so the `instanceof` question is
unanswerable and the language rejects it. The cast is allowed as *unchecked*
because the runtime can at least verify "is a List" — but the element claim
is unverified, and a wrong claim surfaces as a CCE at a later read.

**★ `Object o = 42; long x = (long) o;` — what happens and why?**
`ClassCastException`. `42` boxed to `Integer`; `(long)` on a reference
context asserts the object is a `Long`. Boxed numerics are unrelated
classes. The working forms: `(long) (int) o` or `((Number) o).longValue()`.

**★ Why are arrays covariant when generics are invariant, and what does it cost?**
Arrays predate generics and needed polymorphic utility methods
(`Arrays.sort(Object[])`), so `String[]` was made assignable to `Object[]` —
paid for with a runtime check on every reference store
(`ArrayStoreException`). Generics chose invariance so the same error is a
compile error instead.

**What discipline should surround `@SuppressWarnings("unchecked")`?**
Smallest possible scope (a single declaration, never a class), plus a
comment stating the out-of-band proof that the cast is sound. It is a signed
assertion that you know something the compiler cannot — treat writing one as
an event.

**Name the silent-conversion rules inside "narrowing".**
Integral→integral: modular bit truncation. Floating→integral: round toward
zero, saturate at the target's min/max, `NaN` → 0. Both compile with an
explicit cast, neither can throw — the syntax looks identical.

---

← Prev: [`instanceof` and flow scoping](02-instanceof-flow-scoping.md) · Index: [Casting and `instanceof`](README.md) · Next → [Naming and idiom](../15-naming-idiom.md)
