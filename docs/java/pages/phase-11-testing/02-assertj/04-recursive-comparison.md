---
title: "usingRecursiveComparison compares two objects field by field without asking either of them to implement equals, and the two facts that decide whether your test is sound are that it is driven by the actual object's fields and that since 3.17.0 it stopped honouring overridden equals"
sidebar_label: "04 · Recursive comparison"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — the "Recursive comparison"
> section ([assertj.github.io/doc](https://assertj.github.io/doc/)) — and the
> `assertj-core` 3.27.7 API (`AbstractObjectAssert.usingRecursiveComparison`,
> `RecursiveComparisonAssert`, `RecursiveComparisonConfiguration`,
> `withStrictTypeChecking`, `usingOverriddenEquals`).
> JDK 25 · Spring Boot 4.1.1 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**`isEqualTo` on a domain object asks that object's `equals` whether the test passes. That
is a problem twice over: an entity's `equals` is often written for JPA identity rather than
for value equality, and a DTO usually has no `equals` at all, so the assertion degrades to
reference identity. The recursive comparison takes `equals` out of the loop and walks the
object graph field by field. It is the right tool often enough to be worth knowing well, and
it fails in ways that are quiet enough to be worth knowing better.**

## What it does

```java
Person sherlock = new Person("Sherlock", 1.80);
sherlock.home.ownedSince = new Date(123);
sherlock.home.address.street = "Baker Street";
sherlock.home.address.number = 221;

Person sherlock2 = new Person("Sherlock", 1.80);
sherlock2.home.ownedSince = new Date(123);
sherlock2.home.address.street = "Baker Street";
sherlock2.home.address.number = 221;

assertThat(sherlock).usingRecursiveComparison()
                    .isEqualTo(sherlock2);
```

Note `home.address.street` — the comparison **recurses**. `Person` holds a `Home`, which
holds an `Address`, and every field of every level is compared. Neither class needs
`equals`, and the failure message names the exact path that differed rather than saying two
objects were not equal.

That last point is most of the value. `assertThat(a).isEqualTo(b)` on objects with a
30-field `toString` gives you two walls of text to diff by eye. The recursive comparison
gives you the field path.

## The three rules that decide whether your assertion is sound

### 1. It is driven by `actual`, not by `expected`

> *"The comparison is **not symmetrical** since it is **limited to `actual` fields**. The
> algorithm gathers `actual` fields and then compares them to the corresponding `expected`
> fields."*

This is the single most important sentence about the feature, and it is easy to read past.
**A field that exists on `expected` but not on `actual` is never compared.** So if your
expected object is a richer type than the object under test, the extra fields are silently
ignored, and the assertion is weaker than it looks.

The documented consequence of that asymmetry is that the two objects need not be the same
type at all — by default they only need to share the fields `actual` has. That is
deliberate and genuinely useful when comparing an entity to a DTO. It is also exactly how a
test ends up comparing four fields of a twelve-field object without anyone noticing.

`withStrictTypeChecking()` tightens it: the expected object's type must match, or be a
subtype of, the actual object's type. Turn it on whenever you are not deliberately comparing
across types.

### 2. Fields are resolved getter-first

> *"The recursive comparison uses introspection to find out the fields to compare and their
> values. It first looks for the object under test fields (skipping any ignored ones as
> specified in the configuration), then it looks for the same fields in the expected object
> to compare to. The next step is resolving the field values using first a getter method (if
> any) or reading the field value."*

Getter first, field second — the same order as `extracting`, and the same consequence: a
computed getter that does not simply return its backing field is what the comparison sees.
That is usually right and occasionally a surprise.

### 3. Since 3.17.0 it ignores `equals`, including yours

> *"Since 3.17.0 the recursive comparison does not use anymore `equals` methods of classes
> that have overridden it, so no need to force recursive comparison on these classes."*

This is the behaviour change most likely to bite someone reading older material. Before
3.17.0, a nested class with an overridden `equals` was compared *with* that `equals`, and
`ignoringAllOverriddenEquals()` existed to stop it. Now the default is the other way round
and `usingOverriddenEquals()` is the opt-in.

⚠️ It matters for a value type whose `equals` is deliberately narrower than its fields —
`Money` that compares amount and currency but carries a cached formatted string, say. The
recursive comparison will compare that cached field and fail on it. `usingOverriddenEquals()`
or a per-type comparator is the fix; see
[04b · Ignoring fields and custom comparisons](04b-ignoring-fields.md).

## When it is the right tool

- **Asserting a DTO or a response body** that has no `equals` and should not grow one just
  to satisfy a test.
- **Asserting a JPA entity** whose `equals` is written for identity semantics — comparing
  two entities with `isEqualTo` is then asking a question about identity, not about the
  data you just saved.
- **A mapper test** — entity in, DTO out — where the whole point is that every field made
  the trip, and enumerating them by hand is what you are trying to avoid.
- **Any object with more than about five fields**, where the failure message's field path
  is worth more than the assertion's brevity.

## 🔴 When it hides a bug

The recursive comparison's weakness is that it is *complete by default and easy to make
incomplete*. Every configuration method in
[04b](04b-ignoring-fields.md) narrows what is being checked, and a narrowed comparison
still reads like a full one at the call site.

Three shapes to watch for:

```java
// asserts almost nothing about a 12-field object
assertThat(actual).usingRecursiveComparison()
                  .ignoringFields("id", "createdAt", "updatedAt", "version",
                                  "audit", "links", "etag", "revision")
                  .isEqualTo(expected);
```

When the ignore list is longer than what remains, the test has stopped being a comparison
and become a check of four fields — written in a way that looks exhaustive. Naming those
four fields explicitly says more, and says it honestly.

```java
// "make the test pass" — and now nothing null is ever wrong
assertThat(actual).usingRecursiveComparison()
                  .ignoringActualNullFields()
                  .isEqualTo(expected);
```

`ignoringActualNullFields()` is a legitimate tool for partial-object assertions and a
disastrous habit as a default, because the bug it hides is precisely "the field did not get
populated". Every unmapped field in a mapper is `null` in `actual`, and this flag excuses
all of them.

```java
// comparing across types with no type check
assertThat(orderEntity).usingRecursiveComparison()
                       .isEqualTo(someOtherThingEntirely);
```

Without `withStrictTypeChecking()` this passes as long as the fields `orderEntity` has
happen to match. Refactor `OrderEntity` to drop a field and the assertion gets *weaker*
rather than failing.

**The discipline that keeps it honest: every `ignoring…` call needs a reason a reader can
see.** A comment naming why `createdAt` cannot be compared is worth more than the line
itself.

## Gotchas

**★ The comparison is not symmetrical, and fields only on `expected` are never checked.**
The docs are explicit: it is *"limited to `actual` fields"*. Swapping the two arguments can
change whether the test passes. If you built a rich `expected` and are comparing it to a
sparse `actual`, you are asserting much less than the code reads like.

**★ Objects of different types compare equal by default.**
Only shared field names are compared and the types need not relate at all. This is
deliberate — and it means a test comparing an entity to an unrelated class can pass.
`withStrictTypeChecking()` unless you are crossing types on purpose.

**★ Since 3.17.0 your overridden `equals` is ignored by default.**
A value type whose `equals` is intentionally narrower than its field set will now be
compared on the fields that `equals` excluded. The pre-3.17 mental model, and any article
written before it, has this backwards.

**★ `ignoringActualNullFields()` excuses exactly the bug you are usually hunting.**
An unmapped field is `null`. This flag makes every unmapped field acceptable. Use it for a
deliberate partial assertion; never reach for it to make a failing test pass.

**★ An ignore list longer than the compared set.**
The assertion reads as "these objects are equal" and means "these four fields match".
Write the four fields out instead — the test then says what it does.

**★ Recursing into a JPA entity walks its associations.**
Field access on a lazy association triggers a load, or throws outside a session, and a
bidirectional association recurses back to the parent. Compare DTOs, or ignore the
association fields explicitly. See
[Phase 10 · Lazy loading](../../phase-10-data-access/10-lazy-loading/README.md).

**★ Getter-first resolution means a computed getter wins over its backing field.**
Same rule as `extracting` — see
[03d · Extracting by name](03d-extracting-by-name.md). A getter that normalises, trims or
derives is what gets compared.

**★ It compares fields the class does not publish.**
Introspection reaches private state, so a cached value, a memoised hash or a transient
scratch field is part of the comparison unless you exclude it. The test is then coupled to
the implementation.

**★ Collection order is compared by default.**
The docs state the recursive comparison *"is strict about collection order"* by default,
which is correct for a `List` and wrong for anything whose order is incidental. There is a
configuration option to relax it — see [04b](04b-ignoring-fields.md) — and reaching for it
is the moment to ask whether the field should be a `Set`.

**★ A cycle in the object graph.**
Parent → child → parent is normal in a domain model. AssertJ handles cycles rather than
overflowing the stack, but the comparison is doing far more work than the call site
suggests, and the failure paths get long.

**★ `usingRecursiveComparison()` on the *collection* assert is a different thing from
comparing elements recursively.**
For "these two lists contain equal-by-fields elements", the element-comparator form is what
you want — see
[03b · Element comparison and streams](03b-element-comparison-and-streams.md).

## Interview questions

**★ Why would you use `usingRecursiveComparison()` instead of `isEqualTo`?**
Because `isEqualTo` delegates to the object's `equals`. A DTO usually has none, so the
assertion becomes reference identity; a JPA entity usually has one written for identity
semantics, so the assertion asks about identity rather than about the data. The recursive
comparison compares the fields regardless, and reports the field path that differed instead
of two `toString`s.

**★ The comparison is described as "not symmetrical". What does that mean in practice?**
It gathers the fields of `actual` and looks for the same fields on `expected`. A field
present only on `expected` is never compared. So `assertThat(a).usingRecursiveComparison()
.isEqualTo(b)` and the reverse can give different results, and comparing a sparse actual to
a rich expected asserts much less than it appears to.

**★ Do the two objects have to be the same type?**
No, by default — they only need to share the fields that `actual` has, which is what makes
entity-to-DTO comparison work. `withStrictTypeChecking()` requires the expected type to be
the actual type or a subtype, and is what you want whenever crossing types is not the point
of the test.

**★ What changed in 3.17.0?**
The recursive comparison stopped using overridden `equals` methods. Before that, a nested
class with its own `equals` was compared using it and you had to opt out; now it is compared
field by field and you opt *in* with `usingOverriddenEquals()`. It matters most for value
types whose `equals` is deliberately narrower than their field set.

**★ How does it resolve a field's value?**
By introspection: a getter if one exists, otherwise the field itself — the same getter-first
order as `extracting`. A computed getter is therefore what gets compared, and private fields
with no getter are still reached.

**★ When does a recursive comparison hide a bug?**
When the configuration has narrowed it without the call site showing it. The three common
shapes: an `ignoringFields` list longer than what remains; `ignoringActualNullFields()`,
which excuses every field a mapper failed to populate; and a cross-type comparison with no
`withStrictTypeChecking()`, where removing a field from `actual` makes the assertion weaker
rather than red.

**★ You are testing a mapper from entity to DTO. Argue for and against using the recursive
comparison.**
For: the point of the test is that every field made the trip, so a field-by-field comparison
is exactly the claim, it needs no `equals` on the DTO, and a new field added to both sides is
covered without editing the test. Against: a new field added to the *entity only* is not
caught unless the DTO is the actual object, because the comparison follows `actual`'s fields
— so put the DTO on the `assertThat` side, add `withStrictTypeChecking()` off, and be
deliberate about the direction. And if you end up ignoring half the fields, the recursive
comparison is no longer describing the mapping and explicit assertions say more.

{/* FOOTER */}
