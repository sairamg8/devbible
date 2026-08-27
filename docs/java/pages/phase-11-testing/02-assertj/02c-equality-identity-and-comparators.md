---
title: "isEqualTo, isSameAs, isEqualByComparingTo and usingRecursiveComparison are four different questions about sameness, and picking the wrong one produces a test that is green for the wrong reason"
sidebar_label: "02c · Equality vs identity"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — "Field by field recursive
> comparison" and "Avoiding incorrect usage"
> ([assertj.github.io/doc](https://assertj.github.io/doc/#assertj-core-recursive-comparison)) —
> the `assertj-core` 3.27.7 sources
> (`org.assertj.core.internal.StandardComparisonStrategy.areEqual`,
> `org.assertj.core.util.Objects.areEqual`, `AbstractAssert.isSameAs`,
> `AbstractComparableAssert.isEqualByComparingTo`, `org.assertj.core.error.ShouldBeSame`),
> and the `junit-jupiter-api` 6.0.3 sources (`AssertionUtils.objectsAreEqual`).
> JDK 25 · Spring Boot 4.1.0 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**"Are these the same?" has at least four answers in Java, and AssertJ gives each of them
a different method. `isEqualTo` asks `equals`. `isSameAs` asks `==`. `isEqualByComparingTo`
asks `compareTo`. `usingRecursiveComparison` ignores `equals` entirely and walks the fields.
Choosing between them is not a style question — a `BigDecimal` compared with `isEqualTo`
and a JPA entity compared with `isEqualTo` both fail for reasons that have nothing to do
with the code under test.**

## `isEqualTo` — `equals`, with two deviations worth knowing

`isEqualTo` routes through the assert's *comparison strategy*. With no comparator
configured that is `StandardComparisonStrategy`, and its `areEqual` has one special case
before it delegates:

```java
public boolean areEqual(Object actual, Object other) {
  if (actual == null) return other == null;
  Class<?> actualClass = actual.getClass();
  if (actualClass.isArray() && other != null) {
    // ... element-wise Arrays.equals for each primitive array type ...
```

and otherwise falls through to `org.assertj.core.util.Objects.areEqual`, which is:

```java
public static boolean areEqual(Object o1, Object o2) {
  return java.util.Objects.deepEquals(o1, o2);
}
```

**Deviation one: arrays are compared by content.** `assertThat(new int[]{1,2,3}).isEqualTo(new int[]{1,2,3})`
succeeds. This is *not* how JUnit behaves — Jupiter 6.0.3's `AssertionUtils.objectsAreEqual`
is exactly:

```java
static boolean objectsAreEqual(@Nullable Object obj1, @Nullable Object obj2) {
    if (obj1 == null) {
        return (obj2 == null);
    }
    return obj1.equals(obj2);
}
```

so `assertEquals(new int[]{1,2,3}, new int[]{1,2,3})` fails on array identity and you are
expected to reach for `assertArrayEquals`. If you are migrating a suite, this is one of the
few places where the AssertJ translation is *more* permissive than the original.

**Deviation two: a configured comparator replaces `equals` silently.** `usingComparator(...)`
swaps the comparison strategy, and every subsequent `isEqualTo` on that chain asks the
comparator instead. This is powerful and it is the reason the documentation lists
`usingComparator` after an assertion as a misuse — see
[02 · assertThat and the chain](02-assertthat-basics.md).

## `isSameAs` — reference identity, and the reason you rarely want it

`isSameAs` is `==`. The failure message template from `ShouldBeSame` is:

```java
super("%nExpecting actual:%n  %s%nand:%n  %s%nto refer to the same object", actual, expected);
```

Note what that message implies: both objects render identically in a typical failure,
because they *are* equal — they are just not the same instance. A developer reading
"Expecting actual: `User[id=42]` and: `User[id=42]` to refer to the same object" for the
first time reliably assumes AssertJ is broken. It is not; identity is exactly what was
asserted.

`isSameAs` is right in a small number of places and wrong nearly everywhere else:

- **Right:** asserting a cache returned the cached instance rather than a rebuilt one;
  asserting an interner or a flyweight; asserting a builder returned `this`; asserting an
  identity-mapped JPA entity came back from the persistence context rather than the
  database (see the persistence-context topic in
  [Phase 10 · Lazy loading](../../phase-10-data-access/10-lazy-loading/README.md)).
- **Wrong:** anything that crosses a serialisation boundary, a mapper, a copy constructor,
  a record's `with`-style rebuild, or a repository round trip.

Its mirror `isNotSameAs` has a genuine and underused role: asserting that a defensive copy
really was copied.

## `isEqualByComparingTo` — `compareTo`, and the `BigDecimal` problem

`BigDecimal.equals` compares scale as well as value. `new BigDecimal("42.0")` and
`new BigDecimal("42.00")` are numerically identical and not `equals`. Every team meets this
through a money test that fails with two values that look the same in the message.

```java
// fails: scale 1 vs scale 2, though both are forty-two
assertThat(order.total()).isEqualTo(new BigDecimal("42.0"));

// passes: compareTo == 0
assertThat(order.total()).isEqualByComparingTo(new BigDecimal("42.0"));
```

`isEqualByComparingTo` is declared on `AbstractComparableAssert`, so it is available for
anything `Comparable` — `BigDecimal`, `BigInteger`, the `java.time` temporals, your own
comparable value types. For temporals it matters for the same class of reason: two
`ZonedDateTime` values at the same instant in different zones are not `equals` and do
compare equal. See [08b · Dates and times](08b-dates-and-times.md).

## `usingRecursiveComparison` — ignore `equals` entirely

The fourth question: "do these two objects hold the same data?", asked without consulting
either type's `equals`. This is the right tool for DTOs, records mapped from entities,
and any class where `equals` is identity-based (JPA entities) or absent.

```java
assertThat(actualDto).usingRecursiveComparison().isEqualTo(expectedDto);
```

The documentation's framing:

> *"assertion succeeds as the data of both objects are the same."* … *"assertion fails as
> Person equals only compares references."*

It has its own chunk because it has its own failure modes — asymmetry, type leniency,
and the `ignoringFields` habit that hides real regressions. See
[04 · The recursive comparison](04-recursive-comparison.md) and
[04b · Ignoring fields](04b-ignoring-fields.md).

## Choosing, in one table

| Question | Method | Asks |
|---|---|---|
| Same value by the type's own rules? | `isEqualTo` | `equals` (arrays: deep) |
| Literally the same object? | `isSameAs` | `==` |
| Numerically/ordering equal? | `isEqualByComparingTo` | `compareTo() == 0` |
| Same data, ignoring `equals`? | `usingRecursiveComparison().isEqualTo` | field-by-field walk |
| Equal under *my* rule? | `usingComparator(c).isEqualTo` | your `Comparator` |
| Same hash bucket? | `hasSameHashCodeAs` | `hashCode()` |

## The `equals`/`hashCode` contract is testable, and this is where

`hasSameHashCodeAs` exists on `AbstractAssert` and is one of the few assertions whose
purpose is to check a *contract* rather than a value. If your value type overrides
`equals`, a small test that asserts two equal instances have the same hash code is worth
its four lines — it is the failure that otherwise shows up months later as an entity
vanishing from a `HashSet`.

## Gotchas

**★ `isEqualTo` on two `BigDecimal`s with different scales fails, and the message shows two
numbers that look identical.**
`BigDecimal.equals` includes scale. Use `isEqualByComparingTo`. This is the single most
common "AssertJ is lying to me" report in money code, and it is `BigDecimal` behaving
exactly as specified.

**★ `isEqualTo` on arrays passes in AssertJ and fails in JUnit's `assertEquals`.**
AssertJ's standard comparison strategy special-cases arrays and falls through to
`Objects.deepEquals`; Jupiter's `objectsAreEqual` calls `obj1.equals(obj2)`. Migrating a
test from `assertArrayEquals` to `isEqualTo` is safe; migrating a deliberate identity check
is not.

**★ `isSameAs` on two objects that are `equals` produces a message where both sides render
identically.**
The template is "Expecting actual: X and: X to refer to the same object". This is correct
and confusing. If you did not mean identity, you wanted `isEqualTo`.

**★ A JPA entity compared with `isEqualTo` usually asserts nothing you meant.**
Entities routinely inherit `Object.equals` (identity) or implement `equals` on the id
alone. In the first case `isEqualTo` degenerates to `isSameAs`; in the second it passes
regardless of every other field. Use `usingRecursiveComparison`, or compare a projection.

**★ `usingComparator` set once applies to every subsequent assertion in the chain,
including ones you did not think of.**
It replaces the comparison strategy on the assert, not on one call. Reset it with
`usingDefaultComparator()` if the chain continues into assertions that should use `equals`.

**★ A `Comparator` that is inconsistent with `equals` makes `isEqualTo` and
`isEqualByComparingTo` disagree, legitimately.**
`compareTo() == 0` and `equals` are only required to agree by convention, and `BigDecimal`
famously breaks it — its javadoc says so. Do not assume one implies the other.

**★ `hasSameHashCodeAs` passing proves nothing about equality.**
Unequal objects are allowed to collide. It is useful as half of an `equals`/`hashCode`
contract test — the half that catches an `equals` override with no matching `hashCode` —
and useless as a substitute for `isEqualTo`.

**★ Two `ZonedDateTime` values at the same instant in different zones are not `equals`.**
`isEqualTo` fails, `isEqualByComparingTo` passes, and only one of them is the question you
meant to ask. Decide whether you are asserting an instant or a wall-clock-plus-zone.

**★ Records make `isEqualTo` work and can make it work too well.**
A record's generated `equals` compares every component, including generated ids and
timestamps you did not intend to pin. It is a real equality, which means a test that was
passing accidentally starts failing when you add a component.

**★ `isEqualTo(null)` is legal and is not `isNull()`.**
It goes through the comparison strategy and reports as an equality failure rather than a
null assertion. Use `isNull()`; the message is clearer and the intent is unambiguous.

## Interview questions

**★ You are asserting a monetary total and the test fails showing `42.0` expected and
`42.00` actual. What happened and what is the fix?**
`BigDecimal.equals` compares unscaled value *and* scale, so `42.0` (scale 1) and `42.00`
(scale 2) are not equal even though they are numerically identical, and `isEqualTo` uses
`equals`. The fix is `isEqualByComparingTo`, which uses `compareTo`. The deeper fix is to
decide on a canonical scale for money in your domain and enforce it at construction, so the
comparison question stops arising.

**★ When is `isSameAs` the right assertion?**
When identity is the property under test rather than an implementation detail: a cache
that must return the cached instance rather than rebuild it, an interner, a builder that
must return `this` for chaining, a persistence context that must return the identity-mapped
entity. Everywhere else it is either accidentally correct (small integer caching, string
literals) or a test that will break the first time someone introduces a mapper.

**★ How does AssertJ's `isEqualTo` differ from JUnit's `assertEquals`?**
Two ways that matter. First, arrays: AssertJ's standard comparison strategy compares them
element-wise and ultimately by `Objects.deepEquals`, whereas Jupiter's `objectsAreEqual`
calls `obj1.equals(obj2)`, which for arrays is identity. Second, configurability: AssertJ's
`isEqualTo` consults the assert's comparison strategy, so `usingComparator` can replace
`equals` for that chain — `assertEquals` has no such hook.

**★ Your DTO has no `equals` override. What are your options for asserting it, and what
does each cost?**
Add `equals` (a production change made for a test — sometimes right, often not);
assert field by field (verbose, and silently misses a field you add later);
`usingRecursiveComparison` (walks every field, so a new field is compared automatically);
or make the DTO a record, which generates a component-wise `equals`. The recursive
comparison is usually right for test-only comparison, and turning the type into a record is
usually right if the type is genuinely a value.

**★ What does it mean that `compareTo` and `equals` are not required to agree, and where
does it bite in tests?**
`Comparable`'s contract only *recommends* consistency with `equals`; `BigDecimal`
explicitly does not comply. It bites when a test compares with one and the production code
sorts, dedupes or keys with the other — a `TreeSet` of `BigDecimal` deduplicates `42.0` and
`42.00`, a `HashSet` does not. A test that asserts with `isEqualByComparingTo` while
production stores in a `HashSet` is testing a different relation than the one that runs.

**★ Why can `usingComparator` make a later assertion in the same chain behave unexpectedly?**
Because it replaces the comparison strategy on the assert object, not on a single call, and
the assert object is what every subsequent link in the chain operates on. A chain that
starts with a lenient comparator for one field and then asserts something unrelated is
still using the lenient comparator. `usingDefaultComparator()` puts it back.

{/* FOOTER */}
