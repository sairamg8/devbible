---
title: "instanceof pattern matching and flow scoping"
sidebar_label: "2 · instanceof and flow scoping"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against JEP 394 (Pattern Matching for `instanceof`,
> finalized in 16), the JLS SE 25 §15.20.2 (`instanceof`), §6.3.1 (scope of
> pattern variables), and JEP 441 (Pattern Matching for `switch`, 21).

**The pre-16 idiom tested a type, then cast to it — two steps that could
drift apart. The pattern form binds a variable if and only if the test
passes, and the compiler puts that binding in scope exactly where the match
is *provable*. Learn to read scope as provability and the one surprising
shape — the negated test whose binding survives for the rest of the method —
becomes the most useful idiom on the page.**

## From test-and-cast to patterns

```java
if (obj instanceof String) {
    String s = (String) obj;   // repeat the type; hope it matches the test
    ...
}
```

The pattern form:

```java
if (obj instanceof String s && s.length() > 3) {
    // s is in scope, typed String, non-null — the && sees it too
}
```

The old form had a real bug class: the test and the cast named different
types after a refactor, and the compiler had no opinion. The pattern form has
one type, written once.

## Flow scoping

The binding is in scope precisely where the compiler can *prove* the match
succeeded (JLS §6.3.1) — which produces one non-obvious but very useful
shape, the early-return guard:

```java
public boolean equals(Object o) {
    if (!(o instanceof Money m)) return false;   // negated test + early return…
    return amount.equals(m.amount) && currency == m.currency;  // …so m IS in scope here
}
```

That is the modern `equals` idiom
([Phase 2's contract topic](../../phase-2-classes-objects/06-equals-hashcode/02-implementing-it-right.md)
builds on it). Notes worth owning:

- `instanceof` is **null-rejecting**: `null instanceof T` is `false` for
  every `T` — so a matched binding is guaranteed non-null. A pattern match is
  a null check for free.
- The binding is in scope after `&&` (the right side runs only on match) but
  **not** after `||`, and not in the `else` of a positive test — scope
  follows provability, not braces.
- After `if (!(o instanceof T t)) return;` the binding is in scope **for the
  rest of the method** — the compiler proved every later line only runs on a
  match. Powerful, and the reason re-using pattern-variable names in one
  method collides.
- The pattern variable is an ordinary local: reassignable (don't), and
  effectively-final if you leave it alone — so lambdas below the guard can
  capture it.

## Patterns meet switch

`switch` over patterns (JEP 441) generalizes the same machinery — with sealed
types it adds compiler-checked exhaustiveness. The
[`switch` expressions topic](../08-control-flow-switch/README.md) owns that
half (including `case null` and guarded patterns); the
[patterns-null-and-legacy chunk](../08-control-flow-switch/02-patterns-null-and-legacy.md)
is where the two pages meet. The division of labour: one-type questions →
`instanceof` pattern; case analysis over several shapes → pattern `switch`.

## When instanceof is a smell — and when it's the design

A chain of `instanceof` tests over an **open** hierarchy re-implements
dynamic dispatch by hand — every new subtype silently falls through every
existing chain. That is the smell: the fix is polymorphism (put the varying
behaviour *on* the types) —
[Phase 2's dispatch topic](../../phase-2-classes-objects/04-polymorphism-dispatch/README.md).

Pattern matching is the *right* tool when:

- the hierarchy is **sealed** — the compiler enforces exhaustiveness, so a
  new subtype breaks the build instead of falling through
  ([Phase 2's ADT topic](../../phase-2-classes-objects/09-sealed-adts.md)
  pairs sealed types with `switch` for exactly this);
- you are at an **untyped boundary** — deserialization, `Object`-typed
  framework callbacks, heterogeneous collections;
- you are implementing **`equals`** — the guard idiom above.

The distinction to carry: dispatch on *behaviour that belongs to the types* →
polymorphism; case analysis over a *closed set of shapes* → sealed + patterns.

## Gotchas

**Symptom:** "pattern variable already in scope" or a binding usable in a branch you didn't expect
**Cause:** flow scoping follows provability — after `if (!(o instanceof T t)) return;` the binding `t` is in scope for the *rest of the method*, and re-declaring the name collides
**Fix:** read scope as "where the match is proven", not "inside the braces"; pick fresh names for later patterns in the same method

**Symptom:** an `instanceof` chain over DTO types keeps missing the newest subtype in one of five places
**Cause:** open hierarchy + manual case analysis — nothing forces the chains to be updated together
**Fix:** seal the hierarchy and switch over it (exhaustiveness makes the compiler find every chain), or move the behaviour onto the types as a polymorphic method

**Symptom:** `null instanceof Foo` surprised a reviewer by being `false` rather than throwing
**Cause:** specified behaviour — `instanceof` rejects null for every type
**Fix:** rely on it: a successful pattern match guarantees non-null, which is why the `equals` guard idiom needs no separate null check

**Symptom:** binding not visible after `if (o instanceof T t || somethingElse)`
**Cause:** on the `||` path the right side runs when the match *failed* — the compiler cannot prove `t` exists, so it is out of scope there and after the statement
**Fix:** restructure to `&&`/early-return shapes where the match is provable; `||` and patterns rarely combine usefully

**Symptom:** a lambda below the guard "cannot capture" the pattern variable after someone assigned to it
**Cause:** pattern variables are ordinary locals — assignment destroys effective finality, and lambda capture requires it
**Fix:** never reassign a pattern binding; it names a proof, and reassignment makes the name lie

**Symptom:** old test-and-cast code threw CCE after a refactor even though it "checked first"
**Cause:** the `instanceof` type and the cast type drifted apart — the two-step idiom has no compiler linkage
**Fix:** convert to the pattern form mechanically; one type written once is the entire point of JEP 394

## Interview questions

**★ Explain flow scoping in `instanceof` pattern matching.**
The binding is in scope exactly where the compiler can prove the match
succeeded: the `then` branch of a positive test, the right side of `&&`, and
— after a negated test with an early exit — the remainder of the method.
That last shape is the modern `equals` idiom.

**★ Why does `null instanceof T` return false, and what does that buy?**
By specification, `instanceof` is a test of "is this object of type T", and
null is no object. It buys a free null check: any bound pattern variable is
guaranteed non-null, simplifying every guard built on it.

**★ When is an `instanceof` chain a design smell, and what replaces it?**
Over an open hierarchy where new subtypes can appear: each chain is a
hand-rolled dispatch that new types silently miss — polymorphism belongs on
the types. Over a *sealed* set of shapes, `switch` patterns with
exhaustiveness checking are the honest tool, and new variants break the
build loudly.

**★ Write the modern `equals` opening.**
`if (!(o instanceof Money m)) return false;` — negated pattern, early
return. It handles null (instanceof rejects it), the wrong type, and the
cast in one line, and leaves `m` in scope for the field comparison that
follows.

**Why prefer the pattern form even when the old idiom worked?**
The old form states the type twice with no compiler linkage — refactors can
split them, and the failure is a runtime CCE. The pattern form is
single-source: the test, the type, and the binding cannot disagree.

**Where does `instanceof` end and pattern `switch` begin?**
One type to check → `instanceof` pattern. Several alternatives from one
value — especially over a sealed hierarchy where exhaustiveness matters →
pattern `switch`, which adds `case null`, guards, and compile-time
completeness checking.

---

← Prev: [Reference casts](01-reference-casts.md) · Index: [Casting and `instanceof`](README.md) · Next → [Primitive casts and erasure](03-primitive-casts-erasure.md)
