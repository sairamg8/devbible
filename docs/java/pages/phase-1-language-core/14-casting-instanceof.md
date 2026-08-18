---
title: "Casting and instanceof pattern matching"
sidebar_label: "14 · Casting and instanceof"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §5 (conversions and contexts),
> §15.20.2 (`instanceof`), §15.16 (cast expressions), JEP 394 (Pattern
> Matching for `instanceof`, finalized in 16), and JEP 441 (Pattern Matching
> for `switch`, 21).

**Java has two unrelated things both spelled "cast". A *primitive* cast
converts a value — possibly destroying information, silently, with no runtime
check. A *reference* cast converts nothing: it is an assertion about what the
object already is, checked at run time, throwing `ClassCastException` when
you asserted wrong. `instanceof` pattern matching (`if (o instanceof User u)`)
folded the test and the assertion into one step — deleting both the
boilerplate and the class of bug where the test and the cast disagreed.**

## Reference casts: assertions, not conversions

Upcasts (subtype → supertype) are implicit and always safe — a `Child` *is a*
`Base`, and assigning it to a `Base` variable changes only the compile-time
view, never the object:

```java
Object o = "hello";          // upcast: implicit, free, unchecked — always true
```

Downcasts (supertype → subtype) are claims the compiler cannot verify, so the
JVM verifies them at run time:

```java
String s = (String) o;       // checked: if o isn't a String → ClassCastException
```

Key mental model: **the object never changes type.** It was constructed as
exactly one class and stays that class for life; casts only change which
*view* the compiler lets you use. `getClass()` tells the truth regardless of
any cast.

A `ClassCastException` is therefore always a *modeling* error surfacing: the
code believed a container/API held one type and it held another. The message
names both classes; the fix is upstream, where the wrong object entered.

## instanceof pattern matching (JEP 394)

The pre-16 idiom tested, then cast — two steps that could drift apart:

```java
if (obj instanceof String) {
    String s = (String) obj;   // repeat the type; hope it matches the test
    ...
}
```

The pattern form binds a variable if and only if the test passes:

```java
if (obj instanceof String s && s.length() > 3) {
    // s is in scope, typed String, non-null — the && sees it too
}
```

**Flow scoping** puts the binding in scope precisely where the compiler can
*prove* the match succeeded — which produces one non-obvious but very useful
shape, the early-return guard:

```java
public boolean equals(Object o) {
    if (!(o instanceof Money m)) return false;   // negated test + early return…
    return amount.equals(m.amount) && currency == m.currency;  // …so m IS in scope here
}
```

That is the modern `equals` idiom (Phase 2's contract topic builds on it).
Notes worth owning:

- `instanceof` is **null-rejecting**: `null instanceof T` is `false` for
  every `T` — so a matched binding is guaranteed non-null. A pattern match is
  a null check for free.
- The binding is in scope after `&&` (the right side runs only on match) but
  **not** after `||`, and not in the `else` of a positive test — scope
  follows provability, not braces.
- `switch` over patterns (JEP 441) generalizes this — with sealed types it
  adds compiler-checked exhaustiveness. **Control flow and `switch`
  expressions (topic 08, not written yet)** owns that half; the two pages
  meet at sealed hierarchies.

## Primitive casts: actual conversions, silently lossy

Widening (`int → long`, `int → double`) is implicit and value-preserving
(mostly — `long → double` can lose precision in the low bits). **Narrowing
requires an explicit cast and simply truncates**:

```java
long big = 4_000_000_000L;
int n = (int) big;            // no exception — the top bits are gone; n is negative
```

No runtime check, no error — modular truncation is the *specified* behaviour
(JLS §5.1.3). This is a different universe from reference casts: nothing is
asserted, bits are transformed. The overflow discipline (`Math.toIntExact`
for checked narrowing) belongs to **operators and overflow (topic 04, not
written yet)**; the point here is that the cast syntax gives no hint which
universe you are in — the operand types decide.

Boxed types add the trap that they are *reference* casts with primitive
intuitions: `(Integer) someObject` throws CCE if the object is a `Long`, even
though `long → int` would have been a legal primitive cast. Boxed numeric
types are unrelated classes to the cast machinery — there is no boxed
widening.

## Generics: the cast the runtime cannot check

Erasure (Phase 3 owns the mechanism) means the runtime knows a `List`, not a
`List<String>`. Two consequences here:

- `obj instanceof List<String>` **does not compile** — the runtime could
  never answer it. Only `List<?>` (or a raw check) is testable.
- A cast *to* `List<String>` compiles with an **unchecked warning** and no
  runtime verification. The CCE, if the claim was wrong, fires later — at the
  first `String s = list.get(i)` — far from the lying cast.

Discipline: treat every `@SuppressWarnings("unchecked")` as a signed
statement that you have out-of-band proof, scoped to the smallest possible
declaration, with a comment saying what the proof is.

## When instanceof is a smell — and when it's the design

A chain of `instanceof` tests over an **open** hierarchy re-implements
dynamic dispatch by hand — every new subtype silently falls through every
existing chain. That is the smell: the fix is polymorphism (put the varying
behaviour *on* the types) — Phase 2's dispatch topic.

Pattern matching is the *right* tool when:

- the hierarchy is **sealed** — the compiler enforces exhaustiveness, so a
  new subtype breaks the build instead of falling through (Phase 2's ADT
  topic pairs sealed types with `switch` for exactly this);
- you are at an **untyped boundary** — deserialization, `Object`-typed
  framework callbacks, heterogeneous collections;
- you are implementing **`equals`** — the guard idiom above.

The distinction to carry: dispatch on *behaviour that belongs to the types* →
polymorphism; case analysis over a *closed set of shapes* → sealed + patterns.

## Gotchas

**Symptom:** `ClassCastException: class java.lang.Long cannot be cast to class java.lang.Integer`
**Cause:** boxed types are unrelated classes — reference casts don't do numeric conversion, and JSON/ORM layers often box small numbers as `Integer` or `Long` unpredictably
**Fix:** cast to `Number` and call `.intValue()`/`.longValue()` at untyped boundaries — convert values, don't assert classes

**Symptom:** CCE at a `list.get(...)` line nowhere near any cast
**Cause:** an unchecked generic cast earlier claimed `List<String>` over a list holding something else; erasure deferred the check to the read site
**Fix:** find the `@SuppressWarnings("unchecked")` or raw-type assignment upstream — that's the lying line; validate contents at the boundary instead of asserting

**Symptom:** `(int) someLong` produced a negative number; no exception anywhere
**Cause:** narrowing primitive casts truncate bits by specification — they never throw
**Fix:** `Math.toIntExact(someLong)` when overflow must be an error; the silent form only where truncation is the intent (hashing, masking)

**Symptom:** "pattern variable already in scope" or a binding usable in a branch you didn't expect
**Cause:** flow scoping follows provability — after `if (!(o instanceof T t)) return;` the binding `t` is in scope for the *rest of the method*, and re-declaring the name collides
**Fix:** read scope as "where the match is proven", not "inside the braces"; pick fresh names for later patterns in the same method

**Symptom:** `x instanceof List<String>` won't compile
**Cause:** erasure — the runtime cannot distinguish `List<String>` from `List<Integer>`, so the language refuses the untestable question
**Fix:** test `instanceof List<?>`, then validate/cast *elements* as they are read, or redesign so the element type is carried by your own typed wrapper

**Symptom:** an `instanceof` chain over DTO types keeps missing the newest subtype in one of five places
**Cause:** open hierarchy + manual case analysis — nothing forces the chains to be updated together
**Fix:** seal the hierarchy and switch over it (exhaustiveness makes the compiler find every chain), or move the behaviour onto the types as a polymorphic method

**Symptom:** `null instanceof Foo` surprised a reviewer by being `false` rather than throwing
**Cause:** specified behaviour — `instanceof` rejects null for every type
**Fix:** rely on it: a successful pattern match guarantees non-null, which is why the `equals` guard idiom needs no separate null check

## Interview questions

**★ What does a reference cast actually do at run time?**
Nothing to the object — it checks. The JVM verifies the object's actual class
against the asserted type and throws `ClassCastException` on mismatch;
otherwise the same reference flows through with a new compile-time view. The
object's type was fixed at construction and never changes.

**★ Explain flow scoping in `instanceof` pattern matching.**
The binding is in scope exactly where the compiler can prove the match
succeeded: the `then` branch of a positive test, the right side of `&&`, and
— after a negated test with an early exit — the remainder of the method.
That last shape is the modern `equals` idiom.

**★ Why is `instanceof List<String>` illegal but `(List<String>)` only a warning?**
Erasure removes element types at run time, so the `instanceof` question is
unanswerable and the language rejects it. The cast is allowed as *unchecked*
because the runtime can at least verify "is a List" — but the element claim
is unverified, and a wrong claim surfaces as a CCE at a later read.

**★ How do primitive casts differ from reference casts?**
Primitive casts convert values — narrowing truncates silently by spec, no
runtime check. Reference casts convert nothing — they assert, and are checked
with CCE on failure. Same syntax, disjoint semantics; the operand types
decide which you wrote.

**★ When is an `instanceof` chain a design smell, and what replaces it?**
Over an open hierarchy where new subtypes can appear: each chain is a
hand-rolled dispatch that new types silently miss — polymorphism belongs on
the types. Over a *sealed* set of shapes, `switch` patterns with
exhaustiveness checking are the honest tool, and new variants break the
build loudly.

**Why does `null instanceof T` return false, and what does that buy?**
By specification, `instanceof` is a test of "is this object of type T", and
null is no object. It buys a free null check: any bound pattern variable is
guaranteed non-null, simplifying every guard built on it.

**A cast between `Integer` and `Long` — legal?**
No: they are sibling classes, and reference casts don't convert. This
surprises because the primitive casts (`int`↔`long`) are legal. At untyped
boundaries, go through `Number` and convert with `.intValue()`/`.longValue()`.

---

← Prev: [`null` and `NullPointerException`](13-null-and-npe/README.md) · Next → [Naming and idiom](15-naming-idiom.md)
