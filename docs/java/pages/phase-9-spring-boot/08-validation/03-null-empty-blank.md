---
title: "Null, empty and blank — the three that get confused"
sidebar_label: "3 · Null, empty and blank"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the **Hibernate Validator 9.1 reference**,
> *Built-in constraints* and *Constraint validator implementations*
> (docs.hibernate.org/stable/validator/reference/en-US/html_single/ — including
> the rule that *"the validation of `null` is considered valid by default"*),
> and the Spring Framework reference *Java Bean Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Almost every constraint in the specification treats `null` as valid. This is
not an oversight, it is the design: optionality is expressed by exactly one
annotation — `@NotNull` — and every other constraint answers only the question
"given that there is a value, is it acceptable?". Once that clicks, the whole
`@NotNull` / `@NotEmpty` / `@NotBlank` argument resolves itself, and so does
the much larger class of bug where a field is simply absent and nothing
complains.**

## The rule, stated once

> A `null` value passes every constraint except `@NotNull`, `@NotEmpty` and
> `@NotBlank`.

`@Size(min = 5)` on a `null` string: valid. `@Positive` on a `null` `Integer`:
valid. `@Email` on `null`: valid. `@Pattern` on `null`: valid. `@Past` on
`null`: valid.

The reason is composability. If `@Size(min = 5)` rejected `null`, there would
be no way to say "optional, but if present at least five characters" — you
would need a second annotation for every constraint. By making absence
orthogonal, the specification lets you build the rule you want from two
independent pieces:

```java
@Size(min = 5, max = 40) String nickname;             // optional, bounded if present
@NotNull @Size(min = 5, max = 40) String username;    // required, and bounded
```

That is also the rule custom validators must obey — an `isValid` that returns
`false` for `null` breaks the composition for every user of the constraint. See
[chunk 7](07-custom-validators.md).

## `@NotNull` vs `@NotEmpty` vs `@NotBlank`, exactly

| Constraint | Rejects | Accepts | Legal on |
|---|---|---|---|
| `@NotNull` | `null` | `""`, `"   "`, `[]`, anything non-null | **any type** |
| `@NotEmpty` | `null`, `""`, `[]`, `{}`, `new int[0]` | `"   "`, `[a]` | `CharSequence`, `Collection`, `Map`, arrays |
| `@NotBlank` | `null`, `""`, `"   "`, `"\t\n"` | `" x "` | `CharSequence` **only** |

Read as a truth table over the values a `String` field can actually hold:

| value | `@NotNull` | `@NotEmpty` | `@NotBlank` |
|---|---|---|---|
| `null` | ✗ fail | ✗ fail | ✗ fail |
| `""` | ✓ pass | ✗ fail | ✗ fail |
| `"   "` | ✓ pass | ✓ **pass** | ✗ fail |
| `"a"` | ✓ pass | ✓ pass | ✓ pass |

**The row that catches people is `"   "` under `@NotEmpty`.** A string of three
spaces has a length of three, so it is not empty. `@NotEmpty` on a `String` is
almost always the wrong choice — if the field is text a human types, you want
`@NotBlank`; if it is a collection, `@NotEmpty` is the only one of the three
that fits.

**And `@NotBlank` implies the other two for strings.** It rejects `null` and
`""` on its way to rejecting whitespace, so `@NotNull @NotBlank String` is
redundant — you get two violations for a `null` value and a client that sees a
duplicated field in the error report.

The practical rule of thumb, and it covers most of what you will write:

- **text a human typed** → `@NotBlank`
- **a collection, map or array that must have contents** → `@NotEmpty`
- **anything else that must be present** → `@NotNull`

## The types that lie: primitives and the absent field

```java
public record OrderLine(
        @Positive int quantity,          // ⚠️
        @NotNull @Positive Integer price // ✓
) { }
```

A primitive `int` cannot be `null`, so a JSON body that omits `quantity`
entirely binds it to `0`. Two consequences follow, and both are worse than they
look.

**`@NotNull` on a primitive is always satisfied** and therefore says nothing.
It is not an error — the constraint is legal on any type — it is simply dead
weight that reads like a guarantee.

**`@Positive` on that same primitive turns an omission into a range error.** The
client omitted the field; the report says the quantity must be greater than
zero. That is a misleading message, and it is unfixable at the constraint layer
because the information — *the field was not sent* — was destroyed during
binding.

**Use wrapper types on inbound DTOs** so that absent and zero remain
distinguishable, and let `@NotNull` say the thing it is for. This is the same
argument as [the absent field](../07-rest-controllers/06-the-absent-field.md)
in topic 07, arriving from the other side: there it is about PATCH semantics
and `null`-versus-missing, here it is about which violation message the client
gets. Both conclude that the wire type should be able to represent absence.

`Optional<T>` as a DTO field is a third option and a poor one for JSON bodies —
it makes the constraint apply to the contained value
(`Optional<@Email String>`) and gives Jackson an extra layer to configure. See
[Optional](../../phase-4-lambdas-streams/07-optional/README.md) for why
`Optional` was designed as a return type rather than a field type.

## Collections: two different emptinesses

```java
public record BasketRequest(
        @NotEmpty List<@Valid @NotNull LineItem> items,   // at least one line
        @Size(max = 5) List<@NotBlank String> couponCodes // optional, ≤ 5, none blank
) { }
```

`@NotEmpty` on `items` rejects `null` and `[]`. It says nothing whatever about
the elements: a list containing a single `null` passes. `@NotNull` on the type
argument is what rejects that, and `@Valid` on the type argument is what
cascades into each element's own constraints
([chunk 5](05-valid-at-the-boundary.md)).

`couponCodes` shows the other combination: no `@NotEmpty`, so absent and empty
are both fine, but bounded when present and with no blank entries.

## Constraints do not chain

Constraints on one field are evaluated independently; there is no
short-circuit, and no ordering between them. `@NotNull @Size(min = 5)` on a
`null` value yields exactly **one** violation — not because the provider
stopped after the first failure, but because `@Size` genuinely passes on
`null`. Change it to `@NotBlank @Size(min = 5)` and feed it `""` and you get
**two**, since both reject the empty string.

This is the mechanism behind "the same bad value produced a different number of
errors than I expected", and it is worth being able to predict, because the
count is what the client renders. How the complete set of violations is
collected and surfaced is [chunk 6](06-the-failure.md).

## The trade-off

Treating `null` as valid is the right default and it has a real cost: **the
failure mode of forgetting `@NotNull` is silence**. A DTO with `@Size`,
`@Email` and `@Pattern` all over it and no `@NotNull` anywhere accepts a body
of `{}` without complaint, and every field arrives as `null` in the service.
Nothing in the framework will tell you; the tests that catch it are the ones
you wrote to assert rejections.

The alternative design — non-null by default, opt into optionality — is what
Kotlin's type system gives you for free and what JSpecify annotations describe
for Java, but neither is enforced by Bean Validation. If your team wants that
guarantee on DTOs, the enforcement has to come from a review habit or an
architecture test, not from the validator.

## Gotchas

**Symptom** · A required string is accepted as `""`.
**Cause** · `@NotNull` only rejects `null`.
**Fix** · `@NotBlank` for typed text. `@NotNull` guards presence, not content.

**Symptom** · A required string is accepted as `"   "`.
**Cause** · `@NotEmpty` measures length, and three spaces have length three.
**Fix** · `@NotBlank`, which trims before measuring.

**Symptom** · `@NotEmpty` on a `String` "works" in every test and then lets
whitespace through in production.
**Cause** · Test data used `""` and real users press the space bar.
**Fix** · `@NotBlank`, and test with `"   "` explicitly.

**Symptom** · Two violations for the same field with nearly identical messages.
**Cause** · `@NotNull @NotBlank` on a `String` — `@NotBlank` already rejects
`null`.
**Fix** · Drop the `@NotNull`.

**Symptom** · A body that omits a numeric field is accepted and downstream code
sees `0`.
**Cause** · The DTO field is a primitive `int`, so absence is not
representable, and `@NotNull` on it can never fail.
**Fix** · Use `Integer` on the DTO and annotate `@NotNull @Positive`. Convert
to `int` when you build the domain object.

**Symptom** · The error message says "must be greater than 0" for a field the
client never sent.
**Cause** · Same root cause — the primitive defaulted to `0` and `@Positive`
fired.
**Fix** · Wrapper type, as above. The message is only fixable by making absence
representable.

**Symptom** · A list of items validates, but an element that is `null` slips
through to the service and NPEs there.
**Cause** · `@NotEmpty` constrains the list, not its contents.
**Fix** · `List<@NotNull @Valid LineItem>` — the type-argument constraints are
what reach the elements.

**Symptom** · An empty JSON body `{}` produces no violations at all.
**Cause** · No `@NotNull`/`@NotBlank`/`@NotEmpty` anywhere on the DTO; every
other constraint passes on `null`.
**Fix** · Presence has to be stated. Nothing infers it from the field being
non-optional in your head.

**Symptom** · An HTML form posts an empty text input and the field arrives as
`""` rather than `null`, so `@NotNull` passes.
**Cause** · Form and query parameters are strings; an empty input is an empty
string, not an absent value.
**Fix** · `@NotBlank` for form-backed fields. This is one of the places where
form binding and JSON binding genuinely differ —
[the named inputs](../07-rest-controllers/03-the-named-inputs.md) covers the
binding side.

## Interview questions

**★ Why does `@Size(min = 5)` accept `null`?**
Because presence and shape are deliberately orthogonal in the specification.
Every constraint except `@NotNull`, `@NotEmpty` and `@NotBlank` answers only
"given a value, is it acceptable?". That is what lets `@Size` alone mean
"optional but bounded" and `@NotNull @Size` mean "required and bounded" —
without the specification needing an optional/required variant of every
constraint.

**★ Give the exact difference between `@NotNull`, `@NotEmpty` and `@NotBlank`.**
`@NotNull` rejects only `null` and applies to any type. `@NotEmpty` rejects
`null` and zero-size values, and applies to `CharSequence`, `Collection`, `Map`
and arrays — so on a `String` it still accepts `"   "`. `@NotBlank` applies only
to `CharSequence`, rejects `null`, and rejects any value whose *trimmed* length
is zero, so it is the only one of the three that rejects whitespace. For text a
human types, `@NotBlank`; for collections, `@NotEmpty`; for everything else,
`@NotNull`.

**★ Is `@NotNull @NotBlank String name` correct?**
It works and it is redundant. `@NotBlank` already fails on `null`, so a `null`
value produces two violations for one field, which duplicates that field in the
error response and can break a client that counts errors. Use `@NotBlank`
alone.

**★ What is wrong with `@NotNull` on an `int` field?**
Nothing syntactically — the constraint is legal on any type — but a primitive
can never be `null`, so it can never fail. It reads as a presence guarantee and
provides none. Worse, the omitted field binds to `0`, so a range constraint
like `@Positive` then reports a value problem for what was actually a missing
field.

**★ How do you validate the elements of a collection as well as the collection
itself?**
Put constraints on the type argument. `@NotEmpty List<@NotNull @Valid Item>`
says three separate things: the list is present and non-empty, no element is
`null`, and each element's own constraints are cascaded into. Dropping the
type-argument constraints leaves a list of `null`s perfectly valid.

**★ Why might one bad value produce one violation and another produce two?**
Because constraints do not chain, they each answer independently for the value
given. `null` against `@NotNull @Size(min=5)` produces one violation, since
`@Size` passes on `null`. `""` against `@NotBlank @Size(min=5)` produces two,
since both reject it. Nothing was "short-circuited" in the first case.

**★ A DTO has `@Size`, `@Email` and `@Pattern` on its fields and a request body
of `{}` is accepted. Explain.**
Every constraint on the DTO is a shape constraint, and shape constraints pass
on `null`. With no `@NotNull` or `@NotBlank` anywhere, an empty body satisfies
all of them. This is Bean Validation's most important structural property:
**presence must be stated explicitly**, and forgetting produces silence rather
than an error.

**★ Would you use `Optional<String>` as a DTO field to express optionality?**
Generally not. `Optional` was designed as a return type; as a field it adds a
layer for the JSON mapper to configure, is not serializable, and moves the
constraint onto the type argument (`Optional<@Email String>`) where it is
easier to misplace. A nullable wrapper field plus the deliberate absence of
`@NotNull` says the same thing with less machinery.

---

← Prev: [The starter and the catalogue](02-the-constraints.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Text, containers and placement](04-text-containers-placement.md)
