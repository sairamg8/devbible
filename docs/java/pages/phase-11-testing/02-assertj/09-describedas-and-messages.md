---
title: "as() and overridingErrorMessage both have to be called BEFORE the assertion or they are silently ignored, because a failing assertion throws and breaks the chain — and the difference between them is that one adds a label while the other throws away everything AssertJ knows"
sidebar_label: "09 · describedAs and failure messages"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the `assertj-core` **3.27.7** sources on GitHub
> (tag `assertj-build-3.27.7`) — the javadoc of `as(String, Object...)`,
> `as(Supplier<String>)`, `describedAs` and the `Description` overloads on
> [`Descriptable`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/Descriptable.java),
> and `overridingErrorMessage`, `withFailMessage`, `descriptionText()` and
> `getWritableAssertionInfo()` on
> [`AbstractAssert`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/AbstractAssert.java).
> JDK 25 · Spring Boot 4.1.0 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**[01 · Why fluent assertions](01-why-fluent-assertions.md) argued that the failure message
is the product. This is the page about controlling it. There are two mechanisms and they are
not variants of each other: `as(...)` prefixes AssertJ's message with a label of yours, and
`overridingErrorMessage(...)` replaces it entirely — throwing away the actual value, the
expected value, and any diff the IDE would have shown. Both share one rule, and it is the
rule people break.**

## 🔴 Before the assertion, or it does nothing

The javadoc says it on every one of these methods, in bold:

> *"You must set it **before** calling the assertion otherwise it is ignored as the failing
> assertion breaks the chained call by throwing an AssertionError."*

The mechanism is obvious once stated and invisible until then. `as(...)` returns the assert
so the chain can continue; if the assertion has already run and failed, it threw, and
nothing after it executes. So:

```java
// ✅ the description is used
assertThat(frodo.getAge()).as("check %s's age", frodo.getName()).isEqualTo(33);

// 🔴 the description is silently ignored — isEqualTo already threw
assertThat(frodo.getAge()).isEqualTo(33).as("check Frodo's age");
```

The second line compiles, runs, and produces the default message. Nothing warns. This is the
single most common mistake with the API, and it is invisible in review unless you know to
look at the order.

## `as(...)` — a label on AssertJ's message

```java
// set an incorrect age to Mr Frodo which is really 33 years old.
frodo.setAge(50);
assertThat(frodo.getAge()).as("check %s's age", frodo.getName()).isEqualTo(33);
```

and the message that produces, from the javadoc's own round-trip:

```
[check Frodo's age]
expected: 33
 but was: 50
```

The description is a **prefix in square brackets**; everything AssertJ knew is still there.
That is why `as(...)` is nearly free: it adds context without removing any.

`as` and `describedAs` are the same method — `as` is declared as
`default SELF as(String description, Object... args) { return describedAs(description, args); }`.
Use whichever reads; `as` is shorter and far more common.

The description follows `String.format` syntax, so parameterise it rather than
concatenating.

### The lazy overload

```java
// the lazy test description is not evaluated as the assertion succeeds
assertThat(frodo.getAge()).as(() -> "check Frodo's age").isEqualTo(50);
```

> *"Lazily specifies the description of the assertion that is going to be called, the given
> description is **not** evaluated if the assertion succeeds."*

Worth reaching for when building the description is itself expensive — serialising an object,
querying something — because in a passing suite that work would otherwise be done thousands
of times for messages nobody reads.

⚠️ The javadoc notes `IllegalStateException` *"if the descriptionSupplier is `null` when
evaluated"* — so a `null` supplier fails only on the path where a failure was already
happening.

## `overridingErrorMessage` — replacing it entirely

```java
assertThat(player.isRookie()).overridingErrorMessage("Expecting Player <%s> to be a rookie but was not.", player)
                             .isTrue();
```

> *"Overrides AssertJ default error message by the given one."*
>
> *"The new error message is built using `String#format(String, Object...)` if you provide
> args parameter (if you don't, the error message is taken as it is)."*

`withFailMessage(...)` is the alias, and reads better in most contexts.

**The cost is total.** The actual value, the expected value and the structured comparison
are gone — your string is the whole message. Which means:

- No IDE diff view, because there is no actual/expected pair on the error.
- Whatever you did not interpolate into the string is not in the report.
- The message can go stale and lie: it says what someone once believed the failure meant,
  and nothing keeps it honest.

**The one case where it genuinely wins** is the assertion whose default message says nothing
useful — the boolean:

```java
// default: "Expecting value to be true but was false"
assertThat(order.isConfirmed()).isTrue();

// better
assertThat(order.isConfirmed())
    .withFailMessage("Expected order %s to be confirmed, but its status was %s",
                     order.reference(), order.status())
    .isTrue();
```

`isTrue()` has nothing to report — `true` and `false` are the only values and neither is
informative. That is the assertion `withFailMessage` was made for. Everywhere else, a
better assertion beats a better message: asserting the status directly gives you
`expected: CONFIRMED but was: PENDING` for free, with no string to maintain.

## Which to use

| | Keeps AssertJ's message? | Reach for it when |
|---|---|---|
| `as(...)` / `describedAs(...)` | **yes**, as a `[prefix]` | almost always — especially in loops and soft assertions |
| `as(() -> ...)` | yes | the description is expensive to build |
| `overridingErrorMessage(...)` / `withFailMessage(...)` | **no**, replaces it | `isTrue()`/`isFalse()`, and little else |

## Where descriptions stop being optional

Two places in this topic where `as(...)` is structural rather than decorative:

- **Soft assertions.** The report is a numbered list with no line numbers to distinguish
  entries, and the `SoftAssertions` javadoc recommends `as(...)` explicitly for this reason.
  See [06 · Soft assertions](06-soft-assertions.md).
- **Loops and parameterized tests.** Twenty assertions from one line of source produce twenty
  identical messages. `as("order %s", order.reference())` is the only thing that says which
  one failed. For parameterized tests the display name does part of this job — see
  [03 · Parameterized tests](../03-parameterized-tests/07-display-names.md).

`descriptionText()` returns the description currently set, and `getWritableAssertionInfo()`
exposes the underlying `WritableAssertionInfo` — the javadoc notes it is there so that a
custom assertion *"can use the returned `WritableAssertionInfo` to change the error message
and still keep the description set by the assertion user"*. That is the polite way to write
[07 · Custom assertions](07-custom-assertions.md): improve the message without discarding
the caller's `as(...)`.

## Gotchas

**★ 🔴 `as(...)` after the assertion does nothing at all.**
`assertThat(x).isEqualTo(y).as("...")` compiles and is silently ignored, because a failing
`isEqualTo` threw before `as` could run. The javadoc states this on every description method.
It is the most common mistake with this API and nothing warns about it.

**★ `overridingErrorMessage` destroys the actual/expected pair.**
No diff view in the IDE, and nothing in the report except your string. Anything you did not
interpolate is gone — including the actual value, which is usually the thing you most wanted
to see.

**★ An overriding message that has gone stale.**
It is a string; nothing checks it against what the assertion does. A message written for one
condition survives a rewrite of the condition and then confidently misreports the failure.
`as(...)` cannot do this, because AssertJ's own message is still underneath.

**★ Reaching for `withFailMessage` instead of a better assertion.**
If the default message is unhelpful, that is usually the assertion's fault, not the message's.
`assertThat(order.isConfirmed()).isTrue()` needs a custom message; `assertThat(order.status())
.isEqualTo(CONFIRMED)` does not, and it is the better test.

**★ Concatenating instead of using the format arguments.**
`as("check " + name + "'s age")` builds the string on every passing assertion. The
`String.format` overload defers the formatting, and the `Supplier` overload defers everything.

**★ A `null` description.**
`as(String, ...)` throws `NullPointerException` if the description is null; the `Supplier`
overload throws `IllegalStateException` *"if the descriptionSupplier is null when
evaluated"* — that is, only on the failure path, when you are already debugging something
else.

**★ `as(...)` on the wrong link of a navigated chain.**
`assertThat(orders).as("orders").filteredOn(...).hasSize(3)` describes the assertion on the
filtered result, not on `orders` — navigation returns a new assert and the description does
carry, but the reader's mental model of which object is being described often does not match.
Put the description immediately before the assertion it explains.

**★ Descriptions omitted in soft assertions.**
Four numbered failures with no labels. The `SoftAssertions` javadoc recommends `as(...)`
precisely here, and it is the one place where leaving it out makes a report actively hard to
use.

**★ Assuming `describedAs` differs from `as`.**
It does not — `as` delegates to `describedAs`. Some codebases use both, which reads as though
a distinction exists.

**★ A description that repeats the assertion.**
`as("total should be 42").isEqualTo(42)` says nothing the message would not. A good
description names the *case* — which order, which row, which scenario — not the expectation.

## Interview questions

**★ Why must `as(...)` come before the assertion?**
Because the assertion throws when it fails, which breaks the chain — nothing after it runs.
`as(...)` sets state on the assert object for the *next* assertion to use, so placed
afterwards it is simply never reached. The javadoc says so on every description method, and
the mistake is silent.

**★ What is the difference between `as(...)` and `overridingErrorMessage(...)`?**
`as(...)` prefixes AssertJ's message with your label in square brackets and keeps everything
else — actual, expected, diff. `overridingErrorMessage` (alias `withFailMessage`) replaces
the entire message, so the actual and expected values are gone and the IDE has no diff to
show. One adds; the other substitutes.

**★ When is `overridingErrorMessage` the right call?**
When the default message carries no information — `isTrue()` and `isFalse()`, where the
actual value is `false` and that is all AssertJ can say. Everywhere else, changing the
assertion to one that compares real values gives a better message for free and leaves nothing
to maintain.

**★ What does the `Supplier` overload of `as` buy you?**
Laziness — the javadoc says the description is *"not evaluated if the assertion succeeds"*.
Worth it when building the description is expensive, since in a green suite that cost would
be paid on every passing assertion for a message no one ever reads.

**★ Are `as` and `describedAs` different?**
No. `as` is declared as a default method that delegates straight to `describedAs`. There are
`String`, `Supplier<String>` and `Description` overloads of each; the choice is purely about
which reads better.

**★ Where are descriptions not optional?**
Soft assertions, where the report is a numbered list with nothing else to distinguish the
entries — the `SoftAssertions` javadoc recommends `as(...)` for exactly this. And loops,
where one line of source produces many identical failure messages and the description is the
only thing naming which iteration failed.

**★ A teammate's test uses `withFailMessage` on every assertion. What do you say?**
That each one is now a string with no actual or expected value behind it, no IDE diff, and
nothing keeping it truthful as the assertions change. `as(...)` gives the context without the
loss. And where the default message really is useless, the fix is usually a more specific
assertion rather than a better sentence about a boolean.

{/* FOOTER */}
