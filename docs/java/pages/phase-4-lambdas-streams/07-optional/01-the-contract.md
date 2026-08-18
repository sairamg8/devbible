---
title: "The contract — what Optional is for"
sidebar_label: "1 · The contract"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the `java.util.Optional` Javadoc (JDK 25 API
> documentation) — its class-level API note, the `of`/`ofNullable`/`empty`
> method docs, and the value-based class warning — plus the Javadoc for
> `Stream.findFirst`, `Stream.max` and `Stream.reduce`.

**The `Optional` Javadoc contains its own usage rule, and it is stricter than
most codebases: `Optional` is "primarily intended for use as a method return
type where there is a clear need to represent 'no result,' and where using
`null` is likely to cause errors." Two sentences later it adds the second
rule people miss: a variable of type `Optional` should *never itself be
null*. Everything on this page is those two sentences unpacked — what
returning `Optional` buys, why the other positions (field, parameter,
element) don't buy it, and where `Optional`s naturally come from.**

## What returning `Optional` actually buys

A method returning `User` that can fail to find one has three classic
designs, and each hides the absence somewhere:

```java
User findByEmail(String email);          // null on miss — invisible in the signature
User findByEmail(String email)           // throws on miss — absence becomes exceptional
    throws UserNotFoundException;
Optional<User> findByEmail(String email); // absence is IN the return type
```

With the `Optional` version, the caller *cannot* write
`findByEmail(e).getName()` — it doesn't compile. The miss case must be
handled (or at least deliberately unwrapped) before the value is usable.
That is the whole value proposition: **the compiler makes forgetting the
empty case a type error instead of a 2 a.m. `NullPointerException`.**

Choose between the three honestly:

- **`Optional<T>`** — absence is a *normal, expected* outcome the caller
  should decide about ("no user with that email" is a valid answer).
- **Throwing** — absence is a *broken precondition* ("the config file this
  app cannot start without is missing").
- **null** — legitimate only in private internals and hot paths where the
  wrapping cost or ergonomics matter, documented with `@Nullable`
  ([chunk 3](03-the-boundaries.md) draws this line properly).

## Where `Optional`s come from

You will *consume* far more `Optional`s than you create. The stream API
returns one from every terminal operation that can come up empty:

```java
Optional<Order> first   = orders.stream().filter(Order::isRush).findFirst();
Optional<Order> any     = orders.parallelStream().filter(Order::isRush).findAny();
Optional<Order> biggest = orders.stream().max(comparing(Order::total));
Optional<Integer> sum   = orders.stream().map(Order::items).reduce(Integer::sum);
```

`findFirst`, `findAny`, `min`, `max`, and one-arg `reduce` all return
`Optional` for the same reason: an empty stream has no first element, no
maximum, no reduction — and the API refuses to invent a null or a sentinel
for it. (Two-arg `reduce` takes an identity value, so it can return `T`
directly — the identity *is* the empty answer.)

Creating your own, there are exactly three factories:

```java
Optional.of(value)         // value must be non-null — throws NPE immediately if not
Optional.ofNullable(value) // null becomes Optional.empty()
Optional.empty()           // the empty instance
```

`of` vs `ofNullable` is a statement of intent: `of` asserts "this cannot be
null here, fail fast if I'm wrong"; `ofNullable` is the adapter you put at
the seam where a null-returning API (a `Map.get`, a legacy DAO, `getenv`)
meets `Optional`-shaped code. Using `ofNullable` on a value you *know* is
non-null muffles a check; using `of` on a maybe-null value just moves the
NPE.

## The positions `Optional` should not occupy

**Not a field.**

```java
class Customer {
    private Optional<String> middleName;   // don't
    private String middleName;             // null allowed, Optional at the accessor
    Optional<String> middleName() { return Optional.ofNullable(middleName); }
}
```

The Javadoc's value-based warning and `Optional`'s design both push the same
way: it is a *transient* wrapper for API boundaries, not a storage shape.
Concretely: `Optional` is **not `Serializable`**, so an `Optional` field
breaks Java serialization of the containing class; it adds an extra object
per field for no information gain (the field can *still* be null — now you
have three states: null `Optional`, empty, present); and most frameworks
that reflect over fields (JPA, many mappers) need extra configuration or
simply fight it. Store the nullable value; return the `Optional`.

**Not a parameter.**

```java
void register(String name, Optional<String> referralCode)  // don't
void register(String name, String referralCode)            // @Nullable, or…
void register(String name)                                 // …overload
```

An `Optional` parameter makes every call site wrap
(`register("x", Optional.empty())` is noise), and it *still* doesn't protect
you — the caller can pass a null `Optional`, which is strictly worse than a
null `String` because the method now needs two checks to be defensive.
Overloads or a nullable parameter say the same thing cheaper.

**Not a collection element or a map value.** `List<Optional<String>>`
should be a filtered `List<String>` — that is what
`.flatMap(Optional::stream)` is for ([chunk 2](02-the-operative-api.md)).
A `Map<K, Optional<V>>` has *three* states per key (absent, present-empty,
present-full) where a plain map's two states almost always suffice.

**Not a replacement for an empty collection.** A method returning "the
matching orders" returns `List<Order>` — empty when there are none — never
`Optional<List<Order>>`. The empty collection *already* represents absence,
and every caller can loop over it unconditionally. Wrapping it forces an
unwrap that buys nothing.

## The identity warning

`Optional` is a **value-based class** (its Javadoc carries the standard
warning). The practical rules:

- Never compare with `==` — use `equals`, which compares the *contained*
  values. Two `Optional.of("a")` instances are `equals` but need not be the
  same object.
- Never synchronize on an `Optional` — value-based classes make no promise
  about identity, and synchronizing on them may throw or misbehave under
  Valhalla-era JVMs.
- Don't even rely on `Optional.empty()` returning the same instance — the
  Javadoc says so explicitly: "there is no guarantee that it is a
  singleton"; use `isEmpty()`, not `== Optional.empty()`.

## `get()` and its honest replacement

`Optional.get()` throws `NoSuchElementException` when empty. It is not
deprecated, but its Javadoc points at the fix: "The preferred alternative to
this method is `orElseThrow()`" — the no-argument `orElseThrow()` does
exactly what `get()` does with a name that *admits it can throw*. Reserve
either for the cases where emptiness genuinely cannot happen and you want a
loud failure if you're wrong; the fluent alternatives in
[chunk 2](02-the-operative-api.md) cover everything else.

## Gotchas

**Symptom:** `NullPointerException` from `Optional.of(...)` — the thing it was meant to prevent
**Cause:** `of` requires non-null; the maybe-null value needed `ofNullable`
**Fix:** `ofNullable` at seams with null-returning code; keep `of` for values you assert are present

**Symptom:** `NullPointerException` calling `.isPresent()` on an `Optional`
**Cause:** the `Optional` reference itself is null — someone returned `null` from an `Optional`-returning method
**Fix:** an `Optional`-returning method returns `Optional.empty()`, *never* null — treat `return null;` in such a method as a review-blocking bug

**Symptom:** `NotSerializableException: java.util.Optional` serializing a session or cache entry
**Cause:** an `Optional` field in a serialized class — `Optional` deliberately isn't `Serializable`
**Fix:** store the nullable value in the field; expose `Optional` only from the accessor

**Symptom:** an entity's optional column mapping fails or needs a custom converter
**Cause:** `Optional` used as a JPA entity field type — persistence providers map column types, not wrappers
**Fix:** nullable field, `Optional`-returning getter if you want the API; the repository layer (Spring Data `findById`) is where `Optional` belongs

**Symptom:** API consumers pass `null` where an `Optional` parameter is expected, and the method NPEs unwrapping it
**Cause:** `Optional` parameters create the null-`Optional` third state
**Fix:** don't take `Optional` parameters — overload, or accept a documented nullable argument

**Symptom:** `Optional<List<Order>>` return type and every caller writes `.orElse(List.of())`
**Cause:** absence modeled twice — the empty list already says "none"
**Fix:** return the empty collection; reserve `Optional` for scalar "no result"

**Symptom:** code behaves differently after a JDK upgrade around `optA == optB` checks
**Cause:** identity comparison on a value-based class — never specified to be stable
**Fix:** `equals`, `isEmpty()`, `isPresent()`; treat any `==` on `Optional` as a bug

## Interview questions

**★ The Javadoc says `Optional` is "primarily intended" as a return type. Why not fields and parameters?**
A field: not serializable, an extra allocation that still can be null (three
states instead of two), and frameworks reflect over fields expecting
storable types. A parameter: forces wrapping at every call site and can
itself be null, so the callee needs *more* defensive code, not less.
Both positions get the safety without the cost from plain nullable values +
`Optional` at the API boundary.

**★ When do you return `Optional<T>` vs throw vs return null?**
`Optional` when absence is a normal outcome the caller should handle;
an exception when absence violates a precondition and can't be meaningfully
handled locally; null only in private/hot internals with `@Nullable`
documentation. The signature is the contract — pick the one that tells the
caller the truth.

**★ Why does one-arg `reduce` return `Optional` but the two-arg overload returns `T`?**
The two-arg form takes an identity element, which *is* the answer for an
empty stream (`reduce(0, Integer::sum)` → 0). Without an identity, an empty
stream has no reduction at all, and the API encodes "no result" as
`Optional.empty()` rather than inventing one.

**★ What's wrong with `Optional<List<T>>`?**
It models absence twice. The empty list already means "none", every caller
can iterate it without unwrapping, and the wrapper adds a state
(present-but-empty vs absent) that almost never carries a distinct meaning.
Collections' empty forms are their own `Optional`.

**★ `Optional.of` vs `ofNullable` — is `ofNullable` just "safer"?**
No — they are different *claims*. `of` asserts non-null and fails fast at
the construction site (the most debuggable place); `ofNullable` legitimately
converts a null-based API's result. Blanket `ofNullable` hides the assertion
and lets a wrong assumption travel before failing.

**★ What does `Optional` being a value-based class forbid?**
Relying on identity: `==` comparisons, `synchronized` on an instance,
`System.identityHashCode` assumptions — including assuming `empty()` is a
singleton. Only `equals`/`hashCode`/state matter, which is exactly how the
class is meant to be used.

**★ Is `get()` deprecated? What should you write instead?**
Not deprecated, but its own Javadoc recommends `orElseThrow()` — identical
behaviour, honest name. In review, `get()` (or bare `orElseThrow()`) demands
the same justification: why is empty impossible here, and is a
`NoSuchElementException` the failure you want if that reasoning rots?

---

← Index: [Optional used correctly](README.md) · Next → [The operative API](02-the-operative-api.md)
