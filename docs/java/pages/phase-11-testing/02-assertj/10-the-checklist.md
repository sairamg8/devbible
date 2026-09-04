---
title: "Reading an assertion in a pull request means asking one question of it — what would this say when it fails, and could it fail at all — because almost every defect in this topic is an assertion that is green for a reason unrelated to the behaviour"
sidebar_label: "10 · The checklist"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 — this chunk restates conclusions established and sourced in chunks
> 01–09 of this topic; each item links to the chunk carrying its evidence. Underlying
> sources: the AssertJ Core documentation
> ([assertj.github.io/doc](https://assertj.github.io/doc/)) and the `assertj-core` **3.27.7**
> sources on GitHub (tag `assertj-build-3.27.7`).
> JDK 25 · Spring Boot 4.1.1 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**Nine chunks of this topic keep arriving at the same two questions. Everything below is one
of them wearing a different hat: *could this assertion fail?* and *if it did, would the
message tell me why?* An assertion that cannot answer both is not doing the job the test was
written for, and it will be green in the build either way.**

## 🔴 Could it fail at all?

The defects that survive review, in rough order of how often they appear.

**Is anything vacuous?**
`allSatisfy`, `allMatch`, `noneSatisfy`, `noneMatch`, `doesNotContain` and every "at most"
size assertion pass on an empty collection. A filter that matched nothing, a repository that
returned nothing, a stream already consumed — any of them makes the whole block green.
Look for a `hasSize(n)` or `isNotEmpty()` pinning the collection.
→ [02b](02b-assertions-that-assert-nothing.md), [03e](03e-filtering-and-navigating.md),
[03f](03f-navigating-to-elements.md)

**Is there an `assertAll()`?**
A `new SoftAssertions()` without one makes the test unfailable — the javadoc's own words are
that the test *"will pass"*. If the test does not use `assertSoftly`, `AutoCloseableSoftAssertions`
or the extension, this is the first thing to check.
→ [06](06-soft-assertions.md)

**Does `as(...)` or `withFailMessage(...)` come *before* the assertion?**
After it, they are silently ignored, because the failing assertion threw and broke the chain.
→ [09](09-describedas-and-messages.md)

**Is the recursive comparison still comparing anything?**
Count the `ignoringFields` entries against the fields that remain. And treat
`ignoringActualNullFields()` as a red flag on sight: it excuses exactly the unmapped-field
bug most mapper tests exist to catch.
→ [04](04-recursive-comparison.md), [04b](04b-ignoring-fields.md)

**Does the exception assertion assert that something was thrown?**
`catchThrowable` returns `null` and fails nothing. `assertThatThrownBy` fails immediately.
Know which one you are reading.
→ [05](05-exceptions.md)

**Is `contains` doing the work of `containsExactly`?**
`contains` is a subset check and passes over any amount of unexpected data. That is
sometimes what you want and is usually not.
→ [03](03-collections.md)

**Is the lambda in `assertThatThrownBy` one call?**
Two statements and the assertion passes when the *setup* throws.
→ [05](05-exceptions.md)

## What would it say when it fails?

**Did you land on `ObjectAssert`?**
`first()`, `element(i)`, `singleElement()`, `get()` on an `Optional`, and every
`extracting(String)` return an `ObjectAssert` — `isEqualTo` and little else. Pass
`as(STRING)` or a method reference and keep the real API.
→ [03d](03d-extracting-by-name.md), [03f](03f-navigating-to-elements.md),
[08](08-optional-assertions.md)

**Is `withFailMessage` throwing away the diff?**
It replaces the whole message, so the actual and expected values are gone. Right for
`isTrue()`/`isFalse()`; almost always wrong elsewhere, where a more specific assertion beats
a better sentence.
→ [09](09-describedas-and-messages.md)

**Are there descriptions where the report needs them?**
Soft assertions and loops produce many messages with nothing to tell them apart. `as("order
%s", ref)` is the only thing that names the failing case.
→ [06](06-soft-assertions.md), [09](09-describedas-and-messages.md)

**Would a `Condition` say more than a raw predicate?**
`allMatch(p)` reports "did not match the given predicate". The two-argument overload, or a
described `Condition`, names what was being looked for.
→ [03f](03f-navigating-to-elements.md), [07](07-custom-assertions.md)

## Is it asserting the right thing?

**A message string, or the behaviour?**
`hasMessageContaining("invalid")` breaks on a reword and passes on the wrong exception type.
Assert the type; assert a *value* inside the message, not the sentence; assert a custom
exception's own fields where they exist.
→ [05b](05b-causes-and-messages.md)

**Cause, or root cause?**
Different exceptions in any layered stack. Assert the cause when the wrapping is part of the
contract, the root cause when the intermediate layers are incidental.
→ [05b](05b-causes-and-messages.md)

**Exact equality on a timestamp or a `double`?**
Both are tolerance questions wearing an equality mask — and `isEqualToIgnoringNanos` is
*not* a tolerance, it fails on a one-nanosecond difference across a second boundary. For
timestamps the real fix is injecting a `Clock`.
→ [02d](02d-numbers-and-offsets.md), [08b](08b-dates-and-times.md)

**`equals`, or fields?**
`isEqualTo` on a JPA entity asks that entity's identity-semantics `equals`. On a DTO with no
`equals` it asks reference identity. Neither is the question the test meant.
→ [02c](02c-equality-identity-and-comparators.md), [04](04-recursive-comparison.md)

**Positional assertions on an unordered collection?**
`containsExactly` and `element(2)` on a `HashSet` assert hash order. Deterministic, and
about nothing.
→ [03](03-collections.md), [03f](03f-navigating-to-elements.md)

**Is the test asserting one behaviour?**
Eleven soft assertions covering everything the method touched is a survey, not a test — it
fails for eleven reasons and its name can describe one.
→ [06b](06b-composing-soft-assertions.md)

## Style, once the above is settled

- **One spelling per codebase.** `contains`/`hasValue`, `isPresent`/`isNotEmpty`,
  `assertThatThrownBy`/`assertThatExceptionOfType`, `as`/`describedAs`, `being`/`having` are
  each two names for one thing. Mixing them costs every reader a moment and hides the pairs
  that genuinely differ.
- **`Condition` before a custom assertion class.** Three lines and no new vocabulary.
  → [07](07-custom-assertions.md)
- **If you write a custom assertion class, write the entry point too.** Otherwise the static
  import collides with `Assertions.assertThat` and it is abandoned within a month.
  → [07b](07b-adopting-custom-assertions.md)
- **Prefer a comparator to an ignore.** An ignored field is not asserted to exist; a
  comparator with a tolerance still makes a claim.
  → [04b](04b-ignoring-fields.md)
- **Prefer the `Function` overloads to the `String` ones.** `extracting(Order::status)` is
  compile-checked, keeps the type, and cannot read a private field by accident.
  → [03d](03d-extracting-by-name.md)

## The one-minute review

If you read only one assertion and have thirty seconds:

1. **Delete it mentally.** Would any test in this file now fail? If not, it asserts nothing.
2. **Break the production code mentally** — return an empty list, a `null`, the wrong status.
   Does this assertion go red?
3. **Read the message it would print.** Does it name the case, the actual value and the
   expected one?

Three questions, and they catch every defect in the list above.

## Gotchas

**★ Treating a green build as evidence the assertions work.**
Everything in the "could it fail" section is green by construction. A suite of vacuous
assertions is indistinguishable from a suite of good ones until the production code breaks
and nothing goes red.

**★ Reviewing assertions without reading the setup.**
An assertion is only as strong as the data behind it. `containsExactly(a, b)` against a
fixture built two lines above asserts that a list literal round-tripped.

**★ Applying the checklist to new code only.**
The vacuous assertions are already in the suite, written when the collection was never
empty. They became vacuous when something upstream changed, silently.

**★ Using the checklist as a style guide.**
The style section is last on purpose. A consistent spelling of `contains` matters far less
than an assertion that can fail, and a review that spends its attention on the first has
none left for the second.

## Interview questions

**★ How do you review an assertion in a pull request?**
Three questions: could it fail — delete it mentally and see whether anything goes red;
would it fail for the right reason — break the production code mentally and check; and what
would it say when it does. Most real defects are the first question, and most of those are
vacuous truth on an empty collection or a missing `assertAll()`.

**★ Name the assertions that pass on an empty collection.**
`allSatisfy`, `allMatch`, `noneSatisfy`, `noneMatch`, `doesNotContain`,
`doesNotContainAnyElementsOf` and every "at most" size assertion. `anySatisfy` and `anyMatch`
are the exceptions — they fail, because nothing can satisfy them. The defence is a `hasSize`
or `isNotEmpty` before the real assertion.

**★ What single AssertJ mistake would you most want a team to stop making?**
Forgetting `assertAll()` on a hand-rolled `SoftAssertions`. It makes the test structurally
incapable of failing while looking entirely normal, and nothing — not the compiler, not the
IDE, not the build — says a word. The fix is a convention: never write
`new SoftAssertions()`, always `assertSoftly` or the extension.

**★ You see `assertThat(result).usingRecursiveComparison().ignoringFields("id", "createdAt",
"updatedAt", "version", "audit").isEqualTo(expected)`. What do you say?**
That it reads as a full comparison and is a check of whatever few fields remain. Count them
against the ignore list; if the list is longer, write the remaining assertions explicitly so
the test says what it does. And ask whether each exclusion could be a comparator instead —
`createdAt` with a tolerance still asserts the timestamp exists.

**★ A test asserts `assertThat(orders).isNotEmpty()`. Is that enough?**
Only if existence is the behaviour under test. Otherwise it passes for any non-empty result,
including entirely wrong ones. It is the collection-shaped version of `isPresent()` on an
`Optional`, and the same answer applies: assert the value, which asserts existence as a
side effect.

**★ Why does this topic keep returning to the failure message?**
Because a test's value is realised exactly once — when it fails, in front of someone who did
not write it. A test that goes red and says "expected true but was false" has cost time
rather than saved it. Everything in AssertJ that looks like ergonomics — the type-specific
assertions, `as(...)`, `Condition` descriptions, custom assertion classes — is really about
that one moment.

{/* FOOTER */}
