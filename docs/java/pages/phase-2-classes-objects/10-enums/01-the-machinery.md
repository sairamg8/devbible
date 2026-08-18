---
title: "The machinery"
sidebar_label: "1 · The machinery"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against JLS §8.9 (Enum Types) and the `java.lang.Enum`
> Javadoc (JDK 25 API documentation) — the singleton, serialization and
> `compareTo` guarantees below are specified behaviour, not convention.

**`enum Status { NEW, PAID, SHIPPED }` compiles to a final class extending
`java.lang.Enum<Status>`, with three `public static final` instances the JVM
constructs during class initialization — before any of your code can run.
You cannot construct a fourth: the constructor is private by rule, `new` is
a compile error, and even reflection refuses. Everything distinctive about
enums — safe `==`, exhaustive `switch`, `EnumSet`'s bit tricks — falls out
of that one guarantee: the set of instances is closed and known.**

## What the compiler generates

For `enum Status { NEW, PAID, SHIPPED }` you effectively get:

```java
public final class Status extends Enum<Status> {
    public static final Status NEW     = new Status("NEW", 0);
    public static final Status PAID    = new Status("PAID", 1);
    public static final Status SHIPPED = new Status("SHIPPED", 2);

    public static Status[] values() { /* clone of an internal array */ }
    public static Status valueOf(String name) { /* exact-match lookup */ }

    private Status(String name, int ordinal) { super(name, ordinal); }
}
```

The details that matter in practice:

- **`final` class, private constructor.** No subclassing, no extra
  instances. (A constant with a body — chunk 2 — makes the enum itself
  implicitly *sealed*-like: the constant's anonymous subclass is the only
  exception, and you can't write another.)
- **Constants are initialized in declaration order** during static
  initialization, each getting its `name` (the identifier, exactly as
  written) and `ordinal` (its zero-based position).
- **`values()` returns a fresh clone every call** — the array is mutable,
  so the class hands you a copy. Calling it in a hot loop allocates every
  time; cache it in a `private static final` field if it shows up in
  profiles (`EnumSet.allOf` is the cleaner alternative — chunk 3).
- **`valueOf(String)` matches the exact identifier** — case-sensitive, no
  trimming — and throws `IllegalArgumentException` for anything else.
  What that means at API boundaries is chunk 3's subject.

## The singleton guarantee, and what it buys

Each constant exists exactly once per class loader. Consequences, all
specified:

- **`==` is correct and null-safe.** `status == Status.PAID` compares
  identity, which for enums *is* equality — and unlike
  `status.equals(Status.PAID)` it cannot throw when `status` is null (it
  is simply false). `Enum.equals` is final and defined as `==` anyway, so
  the two agree; `==` just fails better.
- **`hashCode` is identity-based and stable per run** — enums are perfect
  `HashMap` keys, though `EnumMap` beats them (chunk 3).
- **Serialization preserves the singleton.** Enum serialization is
  special-cased: only the `name` is written, and deserialization resolves
  it back to the canonical constant with `valueOf`. A deserialized enum is
  `==` to the original — the one place in Java serialization where identity
  survives the round trip. This also makes an enum the standard
  bullet-proof singleton implementation (immune to the reflection and
  serialization attacks that break the hand-rolled kind).
- **`compareTo` is final and compares ordinals** — sort order is
  declaration order, always. You cannot override it; if you need a
  different order, sort with an explicit `Comparator.comparing(...)` on a
  field.

## `name()`, `ordinal()`, `toString()` — three different jobs

| Method | Returns | Overridable? | Safe to persist? |
|---|---|---|---|
| `name()` | the identifier, exactly as declared | no (final) | yes — breaks only if you *rename* the constant, which is a visible refactor |
| `ordinal()` | zero-based declaration position | no (final) | **never** — breaks silently if anyone reorders or inserts |
| `toString()` | `name()` by default | yes | no — it's for display, and someone will override it |

**Why persisting `ordinal()` is a time bomb:** the ordinal is an accident of
source order. Insert `CANCELLED` between `NEW` and `PAID` and every `1` in
the database now means `CANCELLED` where it meant `PAID` — no exception, no
log line, just every historical row reinterpreted. `Enum.ordinal()`'s own
Javadoc says it exists for `EnumSet`/`EnumMap`-style data structures, not
for programmers. Store `name()`, or better, an explicit code field you
control (chunk 3 shows the JPA and JSON versions of this rule).

## Restrictions, and why they exist

- **An enum cannot extend a class** — it already extends `Enum`. It *can*
  implement interfaces (chunk 2 uses that for strategy tables).
- **Nothing can extend an enum** — the constant set must stay closed or
  every guarantee above dies.
- **Constructors run before static fields other than the constants exist**,
  and an enum constructor cannot reference a non-constant static field —
  the constants are created first during class init, so the field would be
  uninitialized. The standard workaround is a static lookup map built
  *after* the constants, in a static initializer (chunk 3's `fromCode`).
- **Generic enums don't exist** (`enum Box<T>` is a compile error) — the
  constants are singletons, and a singleton can't be parameterized per use.

## Gotchas

**Symptom:** a colleague "fixed" alphabetical ordering of constants and a week later historical orders show the wrong status
**Cause:** `ordinal()` values were persisted; reordering renumbered every constant
**Fix:** persist `name()` or an explicit code field; add a test asserting each constant's stored code so any change fails CI loudly

**Symptom:** `status.equals(otherStatus)` throws `NullPointerException` in a code path where status can be absent
**Cause:** `equals` needs a non-null receiver; enums are still references
**Fix:** compare with `==` — for enums it is the specified equality and is null-safe on either side

**Symptom:** profiler shows surprising allocation in a tight loop that "only reads an enum"
**Cause:** `values()` clones its array on every call
**Fix:** hoist `Status.values()` into a `private static final Status[]` (or iterate `EnumSet.allOf(Status.class)`)

**Symptom:** `valueOf("paid")` throws `IllegalArgumentException` though `PAID` exists
**Cause:** `valueOf` is an exact, case-sensitive identifier match
**Fix:** normalize at the boundary or provide your own `fromString` with explicit rules (chunk 3)

**Symptom:** sorting by enum gives declaration order when the UI wants a business order
**Cause:** `compareTo` is final and ordinal-based
**Fix:** sort with an explicit `Comparator` over a field (`comparing(Status::displayRank)`), never by reordering constants

**Symptom:** enum constructor fails to compile reading a static `Map` declared above it
**Cause:** JLS forbids enum constructors touching non-constant static fields — constants initialize first
**Fix:** build the map in a static initializer after the constants, keyed by the field you need

**Symptom:** two "equal" enum constants after messing with custom serialization or multiple class loaders
**Cause:** the singleton guarantee is per class loader; container setups with duplicated jars can load the class twice
**Fix:** one copy of the jar on one loader path — and compare by `name()` if a value genuinely crosses loader boundaries

## Interview questions

**★ What does an enum actually compile to?**
A final class extending `java.lang.Enum`, with one `public static final`
instance per constant created during class initialization, a private
constructor, and generated `values()`/`valueOf(String)` statics. The
instance set is closed — no `new`, no subclassing, no reflective
construction.

**★ Why is `==` correct for enums when it's a bug for `Integer` or `String`?**
Each constant is a canonical singleton, so identity and equality coincide by
construction — `Enum.equals` is final and implemented as `==`. Boxed
integers and strings have many instances representing the same value, so
identity comparisons lie. Bonus: `==` on enums is null-safe where `equals`
throws.

**★ Why should you never persist `ordinal()`?**
It encodes declaration position, not meaning. Any insert or reorder silently
renumbers all following constants and reinterprets every stored value —
no error is raised. Persist `name()` or a deliberate code field, and pin
each constant's stored form with a test.

**★ How does enum serialization differ from normal object serialization?**
Only the constant's name is serialized; deserialization resolves it via
`valueOf` to the existing canonical instance, so identity (`==`) survives
the round trip. This is also why an enum is the recommended
serialization-proof singleton pattern.

**★ Can you override `equals`, `hashCode`, or `compareTo` on an enum?**
No — all three are final in `java.lang.Enum`. Equality is identity, hash is
identity-based, ordering is ordinal. Alternative orderings are expressed
with external `Comparator`s.

**Why does `values()` return a new array each time?**
Arrays are mutable and the internal one is shared state; handing it out
would let any caller reorder or null out constants for everyone. The clone
costs an allocation, which is also the reason to hoist it in hot paths.

**Why can't an enum constructor read a static field of its own class?**
Constants are constructed during class init *before* other static fields
are assigned; the language forbids the reference rather than let you read
an uninitialized value. Lookup maps over constants belong in a static
initializer that runs after the constants exist.

---

← Index: [Enums](README.md) · Next → [Behaviour per constant](02-behaviour-per-constant.md)
