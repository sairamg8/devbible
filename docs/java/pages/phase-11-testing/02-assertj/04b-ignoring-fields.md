---
title: "Every method on RecursiveComparisonConfiguration narrows what the assertion checks while leaving the call site reading like a full comparison, which is why the useful way to learn them is by what each one stops being able to catch"
sidebar_label: "04b · Ignoring fields and custom comparisons"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — the "Recursive comparison"
> section ([assertj.github.io/doc](https://assertj.github.io/doc/)) — and the
> `assertj-core` 3.27.7 API (`RecursiveComparisonConfiguration` and the
> `RecursiveComparisonAssert` configuration methods: `ignoringFields`,
> `ignoringFieldsMatchingRegexes`, `ignoringActualNullFields`,
> `ignoringExpectedNullFields`, `usingOverriddenEquals`,
> `ignoringOverriddenEqualsForTypes`, `withEqualsForFields`, `withComparatorForFields`,
> `withEqualsForType`, `withComparatorForType`, `withStrictTypeChecking`).
> JDK 25 · Spring Boot 4.1.1 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**[04](04-recursive-comparison.md) argued that the recursive comparison's danger is being
complete by default and easy to make incomplete. This chunk is the API that makes it
incomplete — and the honest way to read each method is not "what it lets me ignore" but
"what it stops the test from being able to catch". Every one of them is the right call
somewhere and a silent hole somewhere else.**

## Excluding fields

```java
Person sherlock = new Person("Sherlock", 1.80);
sherlock.home.address.street = "Baker Street";
sherlock.home.address.number = 221;

Person moriarty = new Person("Moriarty", 1.80);
moriarty.home.address.street = "Crime Street";
moriarty.home.address.number = 221;

assertThat(sherlock).usingRecursiveComparison()
                    .ignoringFields("name", "home.address.street")
                    .isEqualTo(moriarty);
```

Field paths are dotted and reach into the graph — `home.address.street`, not `street`. The
regex form casts wider:

| Method | Excludes |
|---|---|
| `ignoringFields(String…)` | exactly these dotted paths |
| `ignoringFieldsMatchingRegexes(String…)` | every path matching a regex |
| `ignoringFieldsOfTypes(Class…)` | every field of these types, wherever it appears |

⚠️ **The regex form is the one to be careful with.** `ignoringFieldsMatchingRegexes(".*Id")`
looks like it excludes surrogate keys and also excludes `customerId`, `orderId`,
`externalReferenceId` and any future field whose name happens to end that way. It keeps
working — silently and increasingly broadly — as the model grows. Prefer the explicit list
until it becomes genuinely unmanageable, and then ask whether you are comparing the right
pair of objects.

## Ignoring nulls, in each direction

```java
sherlock.name = null;
sherlock.home.address.street = null;

assertThat(sherlock).usingRecursiveComparison()
                    .ignoringActualNullFields()
                    .isEqualTo(moriarty);
```

Two methods, and they mean opposite things:

- **`ignoringActualNullFields()`** — a `null` on the object under test is not compared.
  🔴 This is the dangerous one. An unmapped field, an unpopulated response, a column that
  did not load: all `null` on `actual`, all excused.
- **`ignoringExpectedNullFields()`** — a `null` on the expected object is not compared. This
  is the useful one for partial assertions: build an expected object with only the fields
  you care about set, leave the rest `null`, and the comparison checks exactly what you
  filled in.

If what you want is "check these five fields and ignore the other twenty",
`ignoringExpectedNullFields()` expresses it by construction, and it cannot accidentally
excuse a field that failed to populate. Reach for that one.

## Overridden `equals` — the 3.17.0 inversion

> *"Since 3.17.0 the recursive comparison does not use anymore `equals` methods of classes
> that have overridden it, so no need to force recursive comparison on these classes."*

So the modern controls run the other way from what older articles describe:

| Method | Effect |
|---|---|
| *(default, since 3.17.0)* | every type is compared field by field; `equals` is not called |
| `usingOverriddenEquals()` | re-enable overridden `equals` where a class has one |
| `ignoringOverriddenEqualsForTypes(Class…)` | force recursive comparison for these types |
| `ignoringAllOverriddenEquals()` | force recursive comparison for all non-JDK types |

The last two only do anything once you have turned `equals` back on — they are the pre-3.17
world's controls, still present, and reading them out of context is how people end up
believing `equals` is used by default.

**When to turn `equals` back on:** a value type whose `equals` is deliberately narrower than
its fields. `Money` with a cached formatted string, an object with a memoised hash, anything
carrying scratch state that is not part of its identity. Field-by-field will compare the
cache; `equals` will not.

## Custom comparisons

```java
BiPredicate<Double, Double> closeEnough = (d1, d2) -> Math.abs(d1 - d2) <= 0.5;

assertThat(frodo).usingRecursiveComparison()
                 .withEqualsForFields(closeEnough, "height")
                 .isEqualTo(tallerFrodo);

assertThat(frodo).usingRecursiveComparison()
                 .withEqualsForType(closeEnough, Double.class)
                 .isEqualTo(tallerFrodo);
```

Four methods, two axes — field or type, `BiPredicate` or `Comparator`:

| | `BiPredicate` | `Comparator` |
|---|---|---|
| **one field** | `withEqualsForFields(p, "a", "b")` | `withComparatorForFields(c, "a", "b")` |
| **a whole type** | `withEqualsForType(p, Double.class)` | `withComparatorForType(c, Double.class)` |

**Field-level configuration takes precedence over type-level**, which is the resolution rule
to remember when both are in play.

This is the *right* answer to the two problems people usually solve by ignoring a field:

- **A timestamp that will never be exactly equal** — a comparator with a tolerance asserts
  that it is close, which is a real claim. `ignoringFields("createdAt")` asserts nothing.
- **A floating-point field** — `withEqualsForType(closeEnough, Double.class)` says what you
  mean. See [02d · Numbers and offsets](02d-numbers-and-offsets.md) for why exact
  floating-point equality is the wrong question in the first place.

Prefer a comparator to an ignore, every time you can write one. An ignore removes the field
from the test; a comparator keeps it and states the weaker claim you actually hold.

## Type checking and collection order

`withStrictTypeChecking()` requires the expected object's type to be the actual object's
type or a subtype. Without it — the default — the two objects need only share the field
names `actual` has, and may otherwise be unrelated. Turn it on unless comparing across types
is the point of the test.

On collections, the documentation states the recursive comparison *"is strict about
collection order"* by default. There is configuration to relax that
(`ignoringCollectionOrder`, and a per-field variant); ⚠️ **I could not confirm the exact
signatures of the per-field forms against the 3.27.7 documentation**, so check the javadoc
before relying on one. The design question is worth asking first: if a field's order is
genuinely incidental, a `Set` says so in the model, and the test stops needing the option.

## A worked configuration, with the reasons visible

```java
assertThat(actualOrder).usingRecursiveComparison()
                       .withStrictTypeChecking()                  // it must BE an Order
                       .ignoringFields("id")                      // DB-assigned, unknowable
                       .withEqualsForFields(closeEnoughInstant,   // clock skew, not a bug
                                            "placedAt")
                       .isEqualTo(expectedOrder);
```

Three lines of configuration, three reasons a reader can check. Compare that with an
`ignoringFields("id", "placedAt", "version", "audit")` that says nothing about why — the
second is the same test with the reasoning deleted.

## Gotchas

**★ `ignoringActualNullFields()` excuses every field the code failed to populate.**
The single most dangerous method here. If you want a partial comparison, use
`ignoringExpectedNullFields()` and set only the fields you mean on the expected object; it
cannot hide an unmapped field, because the hole is on the other side.

**★ `ignoringFieldsMatchingRegexes` grows silently.**
A regex written against today's field names quietly starts excluding fields added next
year. `.*Id`, `.*At`, `.*Date` all catch far more than intended. Explicit paths fail loudly
when a field is renamed, which is the behaviour you want.

**★ Ignoring a field to avoid a comparator.**
A timestamp that cannot be exactly equal is a case for a tolerance, not for exclusion.
`ignoringFields("createdAt")` means the test no longer knows whether `createdAt` was set at
all.

**★ `ignoringAllOverriddenEquals()` is a no-op in the default configuration.**
Since 3.17.0 overridden `equals` is already not used. The method only matters after
`usingOverriddenEquals()`. Copying it from an old article adds a line that does nothing and
suggests to the next reader that `equals` was in play.

**★ Field-level and type-level comparators both configured, with different meanings.**
Field-level wins. Configuring `withComparatorForType(c1, BigDecimal.class)` and
`withComparatorForFields(c2, "total")` means `total` uses `c2` and every other `BigDecimal`
uses `c1` — correct, and not obvious from reading either line alone.

**★ A dotted path that does not exist is not necessarily an error.**
`ignoringFields("home.adress.street")` — one letter wrong — excludes nothing, and the
comparison silently keeps comparing the field you meant to ignore. If a test starts failing
after an unrelated rename, check the ignore list for stale paths.

**★ `withStrictTypeChecking()` omitted on a cross-type comparison.**
The default lets unrelated types compare equal on shared field names. Deleting a field from
`actual` then makes the assertion *weaker* rather than failing — the one refactoring
outcome no test should have.

**★ Configuration built once and reused across tests.**
A shared `RecursiveComparisonConfiguration` is convenient and makes each test's actual claim
invisible at its call site. If two tests need genuinely different exclusions, sharing one
configuration means the union of both holes applies to both.

**★ Ignoring a collection field rather than fixing its order.**
Excluding `items` because the order varies removes the items from the test entirely.
Relaxing the order keeps them. Better still, ask why the order varies.

**★ The ignore list as a substitute for the right expected object.**
Once the configuration is longer than the assertion, the recursive comparison has stopped
paying for itself. Four explicit `assertThat(...).isEqualTo(...)` lines, or an
`extracting(...)` on the fields that matter, say the same thing and say it visibly.

## Interview questions

**★ What is the difference between `ignoringActualNullFields()` and
`ignoringExpectedNullFields()`, and which is safer?**
The first skips fields that are `null` on the object under test; the second skips fields that
are `null` on the expected object. `ignoringExpectedNullFields()` is much safer for partial
comparisons: you set only the fields you care about on the expected object and the rest are
not checked. `ignoringActualNullFields()` excuses fields the production code failed to
populate — which is usually the exact bug the test exists to find.

**★ Why prefer a custom comparator over ignoring a field?**
Because ignoring removes the field from the assertion entirely, while a comparator keeps it
and states a weaker but real claim. A timestamp compared with a tolerance still asserts it
was set and is roughly right; an ignored timestamp asserts nothing, including that it exists.

**★ Both `withComparatorForType` and `withComparatorForFields` are configured for a field.
Which applies?**
The field-level one. Field configuration takes precedence over type configuration, so a
per-field comparator overrides the per-type comparator for that field and the type-level
one continues to apply everywhere else.

**★ What does `ignoringAllOverriddenEquals()` do in AssertJ 3.27?**
On the default configuration, effectively nothing — since 3.17.0 the recursive comparison
already ignores overridden `equals`. It is meaningful only after `usingOverriddenEquals()`
has re-enabled them. Seeing it in a codebase usually means the line was copied from
pre-3.17 material.

**★ When would you deliberately turn `equals` back on with `usingOverriddenEquals()`?**
When a type's `equals` is intentionally narrower than its field set — a value object with a
cached formatted string, a memoised hash, or scratch state that is not part of its identity.
Field-by-field comparison would compare the cache and fail on a difference that does not
matter.

**★ What is wrong with `ignoringFieldsMatchingRegexes(".*Id")`?**
It excludes far more than the surrogate key it was written for — `customerId`, `orderId`,
any future field ending in `Id` — and it does so silently and increasingly as the model
grows. An explicit path list breaks loudly when a field is renamed, which is the failure
mode you want from a test.

**★ How do you keep a recursive comparison honest as a codebase grows?**
Give every configuration line a reason a reader can check, prefer comparators to exclusions,
use `ignoringExpectedNullFields()` rather than `ignoringActualNullFields()` for partial
comparisons, keep `withStrictTypeChecking()` on unless crossing types is the point, and
treat "the configuration is longer than the assertion" as the signal to stop using the
recursive comparison and write the explicit assertions instead.

{/* FOOTER */}
