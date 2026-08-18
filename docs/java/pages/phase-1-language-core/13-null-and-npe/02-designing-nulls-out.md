---
title: "Designing nulls out"
sidebar_label: "2 · Designing nulls out"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `java.util.Objects`, `List.of`/`Map.of` and
> `Map.getOrDefault` JDK 25 API documentation, jspecify.org (JSpecify 1.0),
> and the `ConcurrentHashMap` class Javadoc (null hostility).

**The defensive strategy is one sentence: nulls die at boundaries. Validate
every reference that enters your code (constructor, public method, config,
deserialization), never *return* null where "nothing" has a shape (empty
list, empty string, `Optional`), and the interior of your codebase becomes
null-free by construction — no scattered `if (x != null)` guards, because
non-null is an invariant, not a hope.**

## Fail at the boundary: `Objects.requireNonNull`

```java
public class Order {
    private final CustomerId customer;
    private final List<Line> lines;

    public Order(CustomerId customer, List<Line> lines) {
        this.customer = Objects.requireNonNull(customer, "customer");
        this.lines = List.copyOf(lines);   // copyOf also rejects null (and null elements)
    }
}
```

Why this beats letting the NPE happen later "anyway":

- **Distance.** Unvalidated, the null sits in the field until something
  dereferences it — a different class, a different request, minutes later.
  Validated, the stack trace points at the constructor call that passed the
  null: the true origin.
- **The message is the diagnosis** — `requireNonNull(x, "customer")` names
  the argument in the exception. One string argument, most of the value.
  (For an expensive message, the `Supplier<String>` overload defers building
  it.)
- `requireNonNull` returns its argument, so it inlines into assignments and
  chains; it costs nothing when the value is non-null.

The same rule at *method* boundaries applies to public API entry points —
inside a class, between private methods, re-checking is noise: the boundary
already guaranteed it.

## Never return null when "nothing" has a shape

| Instead of returning null… | Return |
|---|---|
| …for an empty collection | `List.of()` / `Set.of()` / `Map.of()` — immutable, shared, free |
| …for "no text" | `""` — if blank and absent truly mean the same thing here |
| …for a lookup that can miss | `Optional<T>` — the miss becomes part of the signature (**Phase 4, topic 07 — not written yet** — owns the full API) |
| …for "not found" that is a *caller error* | throw — a broken invariant is an exception, not an absence |

A method that returns a null collection forces every caller into a guard, and
the one caller who forgets becomes next month's NPE. `Collections.emptyList()`
/ `List.of()` cost nothing — they return shared immutable instances.

**Null and empty are different answers to different questions.** "The user
has no orders" is an empty list; "we don't know the user's orders" is an
absence. When your domain genuinely has both states, model the second
explicitly (`Optional`, a sealed result type) rather than overloading null to
mean either.

## `Map.get` and the null-hostile collections

- `map.get(key)` returns null both for *absent key* and for *present key
  mapped to null* — indistinguishable without `containsKey`. Prefer
  `getOrDefault(key, fallback)`, and simply never store null values;
  then `get`'s null unambiguously means absent.
- The modern factories are null-hostile on purpose: `List.of(a, b)`,
  `Map.of(k, v)` and `List.copyOf` all throw NPE on any null element —
  at *creation*, which is the boundary principle applied by the JDK itself.
- `ConcurrentHashMap` rejects null keys *and* values entirely — in a
  concurrent map, `get` returning null must mean "absent" unambiguously,
  because a `containsKey` check races.
- Old collections (`ArrayList`, `HashMap`) tolerate nulls; treat that as a
  legacy permission, not an invitation.

## Nullness annotations and JSpecify

Type-level nullness (`String` vs "`String` that may be null") is the fix the
language never shipped — so annotations grew: `javax.annotation` (JSR-305,
dormant), Spring's, JetBrains', Checker Framework's, all mutually
incompatible in package and semantics. **JSpecify 1.0 (2024) is the
convergence**: one artifact (`org.jspecify.annotations`), precise semantics,
adopted by the ecosystem's heavyweights as the common target.

```java
@NullMarked                     // this package/class: unannotated types are non-null
public class OrderService {
    @Nullable Order findLatest(CustomerId id) { /* null is now IN the signature */ }
}
```

`@NullMarked` flips the default — everything is non-null unless said
otherwise — which matches the boundary discipline: nullable becomes the
loud exception. The annotations do nothing at run time; their value is
static analysis (NullAway, IntelliJ, the Checker Framework) turning null
mistakes into build-time errors. For a new codebase in 2026: JSpecify +
NullAway is the defensible default.

## The framing that keeps it honest

Hoare's "billion-dollar mistake" is about *unchecked* nulls — every reference
in pre-annotation Java is implicitly "or null", and the type system stays
silent. You cannot remove null from Java; you can remove it from *your*
invariants: constructors that reject it, returns that never produce it,
annotations that make the residue visible. The goal is not zero nulls — it
is zero *surprising* nulls.

## Gotchas

**Symptom:** NPE deep in the domain layer, hours after the bad data entered
**Cause:** a boundary (constructor, controller, mapper) accepted a null without checking — the null travelled
**Fix:** `requireNonNull` with a message in every constructor for every reference field; the failure moves to the true origin with the argument named

**Symptom:** `List.of(a, b, c)` throws NPE at construction
**Cause:** one element was null — the immutable factories reject null elements by design
**Fix:** that's the feature working: find the null producer. If null elements are genuinely meaningful (rare), you need `ArrayList` — and a design conversation

**Symptom:** a caller's `getOrders().size()` NPEs; the repo "returns null when empty"
**Cause:** null used where empty has a shape — every caller must guard, one didn't
**Fix:** return `List.of()`; audit the codebase for `return null;` on collection-typed methods — each is a latent NPE

**Symptom:** migrated a `HashMap` to `ConcurrentHashMap`; writes now throw NPE
**Cause:** the old map stored null values; `ConcurrentHashMap` forbids them
**Fix:** stop storing nulls — represent absence by absence (`remove` instead of `put(k, null)`), or store a sentinel/`Optional` if "present but empty" is a real state

**Symptom:** `map.get(k)` returns null; is the key missing or mapped to null?
**Cause:** `get`'s contract overloads null with both meanings
**Fix:** never store null values (then null = absent), or `containsKey` when you must distinguish; `getOrDefault` for the common fallback shape

**Symptom:** `@Nullable` on a parameter, but the IDE and CI disagree about whether a warning exists
**Cause:** mixed annotation vendors with different semantics and analysis targets
**Fix:** standardize on JSpecify, add one analyzer (NullAway) to the build, delete the other imports — annotations without an enforcing analyzer are comments

**Symptom:** `Optional` fields all over the entity classes
**Cause:** `Optional` misapplied — it is designed as a *return* vocabulary, not a field/parameter type (not serializable, adds a wrapper per field, and Phase 4 covers the API's intent)
**Fix:** nullable field + non-null accessor returning `Optional`, or model absence in the schema; keep `Optional` at the API surface

**Symptom:** deserialized objects violate "impossible" non-null invariants
**Cause:** Jackson and friends can bypass or partially run constructors depending on configuration — `requireNonNull` never fired
**Fix:** deserialize into records (canonical constructor always runs, checks and all) or enable creator-based binding; treat the deserializer as a boundary needing the same validation

## Interview questions

**★ What is your strategy for avoiding NPEs in a service codebase?**
Boundary validation: `requireNonNull` with messages in constructors and
public entry points, so nulls fail at the origin; never return null where
empty or `Optional` has a shape; null-hostile collections interior-side;
JSpecify annotations plus a static analyzer to make the residue visible at
build time. Interior code then treats non-null as an invariant.

**★ Why is returning an empty list better than returning null?**
Null forces a guard on every caller forever, and one missed guard is a
production NPE. `List.of()` is free (shared immutable instance), iterates
zero times, and makes "no results" indistinguishable from any other result
in caller code — which is exactly the point.

**★ What ambiguity does `Map.get` have, and how do you resolve it?**
Null means either "absent" or "present, mapped to null". Resolve by policy —
never store null values — or by `containsKey`/`getOrDefault`.
`ConcurrentHashMap` enforces the policy at the API level because the
two-call check races under concurrency.

**★ What is JSpecify and why does it matter?**
The 2024 convergence standard for nullness annotations — one package, defined
semantics, `@NullMarked` to make non-null the default. It matters because the
previous half-dozen incompatible `@Nullable`s made tooling unreliable;
one standard makes build-time null analysis practical across libraries.

**★ Where does `Optional` fit — and where doesn't it?**
As a return type for lookups that can miss, making absence part of the
signature. Not fields, not parameters, not collections of it — the API was
designed for return-site fluency (Phase 4 covers usage), and elsewhere plain
nullability with annotations is lighter.

**Why do `List.of` and friends reject null elements?**
Boundary discipline in the JDK itself: a null inside a collection is a
deferred NPE with the origin erased. Rejecting at construction gives the
failure a useful stack trace — and lets consumers of the collection drop
their guards.

**When is throwing better than returning empty/Optional?**
When absence means a *broken invariant* rather than a normal miss: config
that must exist, an id that referential integrity guarantees. Expected
absence is data (`Optional`/empty); impossible absence is a bug and should
be loud.

---

← Prev: [Reading an NPE](01-reading-an-npe.md) · Index: [null and NPE](README.md)
