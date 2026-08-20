---
title: "The starter, the provider and the built-in catalogue"
sidebar_label: "2 · The starter and the catalogue"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the **Spring Boot 4.0 migration guide**
> (github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide —
> the dedicated `spring-boot-starter-validation`, the
> `spring-boot-starter-web` → `spring-boot-starter-webmvc` rename, and Bean
> Validation no longer arriving transitively with the web starters), the Spring
> Boot reference *Validation*
> (docs.spring.io/spring-boot/reference/io/validation.html), the Spring
> Framework reference *Java Bean Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html)
> and the **Hibernate Validator 9.1 reference**, *Built-in constraints*
> (docs.hibernate.org/stable/validator/reference/en-US/html_single/). Spring
> Boot 4.1.0, Spring Framework 7.0.x, Jakarta EE 11, JDK 25.

**Bean Validation is a Jakarta specification — `jakarta.validation.*` — that
Spring integrates but does not implement; the implementation is Hibernate
Validator, and in Spring Boot 4 nothing puts it on your classpath unless you
ask. The single most common upgrade surprise in this whole topic is that
`@Valid` silently stops working, and the cause is a missing dependency, not a
missing annotation.**

## 🔴 In Boot 4 you must add the starter — it is no longer transitive

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

```groovy
implementation 'org.springframework.boot:spring-boot-starter-validation'
```

Boot 4.0 reorganised the starters: **Jakarta Validation has its own starter**
(with `spring-boot-starter-validation-test` alongside it) and **Bean Validation
is no longer pulled in transitively by the web starters**. The web starter was
itself renamed — `spring-boot-starter-web` is now
**`spring-boot-starter-webmvc`** — so an upgraded build file has two edits
here, not one.

⚠️ **What this looks like when you get it wrong is nothing at all.** The
annotations still compile if `jakarta.validation-api` is on the classpath for
any reason, `@Valid` is still legal, and every request is accepted. There is no
provider, so there is no `Validator` bean, so nothing validates. If the API jar
is present without a provider you may instead meet
`jakarta.validation.NoProviderFoundException` — which at least names what is
missing. Silence is the worse and more common outcome.

**What the starter gives you** is Hibernate Validator plus Boot's
auto-configuration of a `LocalValidatorFactoryBean`. That one bean implements
**both** `jakarta.validation.Validator` and
`org.springframework.validation.Validator`, which is why the same instance
serves the annotation-driven path and Spring's own `Errors`-based `DataBinder`
path. It is also what enables method validation on `@Validated` beans, which
Boot turns on automatically once a provider is on the classpath
([chunk 13](13-beyond-the-controller.md)).

The bean is conditional, like everything else Boot configures — if you declare
your own `Validator`, Boot's backs off. That mechanism is
[bean conditions and back-off](../05-auto-configuration/04-bean-conditions-and-back-off.md).

## The catalogue, with the types each one actually accepts

Every one of these lives in `jakarta.validation.constraints`. **The supported
type is not a detail.** Applying a constraint to a type it does not support
raises `UnexpectedTypeException` — *"No validator could be found for
constraint"* — at validation time, not at compile time, so the mistake ships.

| Constraint | Means | Applies to |
|---|---|---|
| `@NotNull` | value is not `null` | any type |
| `@Null` | value **is** `null` | any type |
| `@AssertTrue` / `@AssertFalse` | the boolean is true / false | `Boolean`, `boolean` |
| `@Size(min, max)` | size is between `min` and `max`, inclusive | `CharSequence`, `Collection`, `Map`, arrays |
| `@Min` / `@Max` | ≥ / ≤ the given `long` | `BigDecimal`, `BigInteger`, byte/short/int/long and their wrappers (Hibernate Validator also accepts `CharSequence` and any `Number`) |
| `@DecimalMin` / `@DecimalMax` | ≥ / ≤ a bound given as a **string**, with `inclusive` | as `@Min`, plus `CharSequence` |
| `@Digits(integer, fraction)` | at most *n* integral and *m* fractional digits | numeric types and `CharSequence` |
| `@Positive` / `@PositiveOrZero` | strictly positive / non-negative | numeric types and `CharSequence` |
| `@Negative` / `@NegativeOrZero` | strictly negative / non-positive | numeric types and `CharSequence` |
| `@NotEmpty` | not `null` **and** size > 0 | `CharSequence`, `Collection`, `Map`, arrays |
| `@NotBlank` | not `null` **and** trimmed length > 0 | `CharSequence` **only** |
| `@Pattern(regexp, flags)` | matches the regular expression | `CharSequence` |
| `@Email(regexp, flags)` | is a valid email address | `CharSequence` |
| `@Past` / `@PastOrPresent` | date is in the past / not in the future | `java.time` types, `java.util.Date`, `Calendar` |
| `@Future` / `@FutureOrPresent` | date is in the future / not in the past | as above |

Three readings of that table are worth making explicit.

**`@DecimalMin` takes a string on purpose.** `@Min` takes a `long`, so it
cannot express a fractional bound at all. For money the pair you want is a
`BigDecimal` field with `@DecimalMin(value = "0.00", inclusive = false)` and a
`@Digits(integer = 10, fraction = 2)` cap — the first says "greater than zero"
without rounding, the second stops a client sending twelve decimal places that
your column will silently truncate.

**The four sign constraints exist as two pairs** — `@Positive` and
`@PositiveOrZero`, `@Negative` and `@NegativeOrZero` — because zero is the
boundary everybody disagrees about. `@Positive` treats zero as invalid.
Choosing between them is a business decision (is an order of zero units a
request or a mistake?) and the specification refuses to guess.

**The temporal constraints are two pairs for the same reason.** `@Past` rejects
*now*; `@PastOrPresent` accepts it. A date of birth of today is legal for a
newborn and would fail `@Past` — a bug that appears on exactly one day per
record.

## The trade-off

The built-in set is deliberately small and portable, and that is both its
strength and its ceiling. **It describes the shape of a value and nothing about
its meaning.** There is no `@ValidIsoCurrency`, no `@AtLeastOneOf`, no
`@InThePastByAtLeast(Duration)`, and nothing that can look at a second field.
Everything past this table is a custom validator you write, own, test and
document ([chunk 9](09-custom-validators.md)) — which is precisely why the
table is worth knowing exactly, so that nobody on the team invents a
`@NotEmptyString` that `@NotBlank` already is.

The second cost is metadata. The provider builds a constraint model per class
by reflection on first use and caches it. For a normal service this is
invisible; for a deep DTO graph with many cascades it is real reflective work
at first touch, and for a function that wants to start in milliseconds the
whole library is a line item you might decline.

## Gotchas

**Symptom** · After upgrading to Boot 4, no request is ever rejected; every
`@Valid` behaves as if it were absent.
**Cause** · `spring-boot-starter-validation` is missing. Boot 4 stopped
shipping Bean Validation transitively with the web starters.
**Fix** · Add the starter explicitly:
`org.springframework.boot:spring-boot-starter-validation`. If you renamed
`spring-boot-starter-web` to `spring-boot-starter-webmvc` in the same upgrade,
this is the second edit that goes with it.

**Symptom** · Startup or the first request fails with `UnexpectedTypeException:
… No validator could be found for constraint
'jakarta.validation.constraints.NotBlank' validating type 'java.util.List'`.
**Cause** · `@NotBlank` is `CharSequence`-only and somebody reached for it on a
collection.
**Fix** · `@NotEmpty` if the intent was "the list is not empty";
`List<@NotBlank String>` if the intent was "no element is blank". They are
different rules and you may want both.

**Symptom** · A `@Min` bound on a `BigDecimal` price behaves oddly at the
boundary, or a fractional bound cannot be expressed at all.
**Cause** · `@Min`/`@Max` take a `long`.
**Fix** · `@DecimalMin("0.01")`, with `inclusive` stated explicitly so the
boundary is not a matter of opinion.

**Symptom** · Amounts arrive with more decimal places than the column holds and
are silently rounded on write.
**Cause** · A range constraint bounds the *value*, never the *precision*.
**Fix** · Add `@Digits(integer = 10, fraction = 2)` alongside the range.

**Symptom** · A quantity of `0` is accepted where it should not be, or rejected
where it should not be.
**Cause** · `@Positive` versus `@PositiveOrZero` chosen without deciding.
**Fix** · Decide once per field and write it down; zero is the value that
generates the support ticket.

**Symptom** · `@Past` on a date of birth rejects newborns.
**Cause** · `@Past` is strict about *now*.
**Fix** · `@PastOrPresent`.

## Interview questions

**★ Which artifact provides `@NotNull`, and which one actually enforces it?**
`jakarta.validation.constraints.NotNull` comes from the Jakarta Validation
**API**; enforcement comes from a **provider**, in practice Hibernate
Validator. Spring joins the two by auto-configuring a
`LocalValidatorFactoryBean` when a provider is on the classpath. That split is
exactly why a missing starter produces annotations that compile fine and do
nothing at all.

**★ What changed about validation in Spring Boot 4, and how would it show up in
a real upgrade?**
Bean Validation is no longer a transitive dependency of the web starters and
now has its own `spring-boot-starter-validation`. It shows up as validation
silently ceasing to happen — no exception, no log, every request accepted — or,
if the API jar is present without a provider, as `NoProviderFoundException`. It
tends to arrive in the same commit as the `spring-boot-starter-web` →
`spring-boot-starter-webmvc` rename, which is a useful reminder to check for
it.

**★ Why does `LocalValidatorFactoryBean` implement two `Validator` interfaces?**
Because Spring predates Bean Validation and has its own `Errors`-based
`org.springframework.validation.Validator` used by `DataBinder`. The single
bean implements both, adapting `ConstraintViolation`s into `FieldError`s when
called through the Spring interface, so annotation-driven validation and
programmatic binding share one configured instance rather than diverging.

**★ Why is `@Size` legal on a `String`, a `List` and a `Map` but `@NotBlank`
only on a `String`?**
"Blank" is a character-sequence idea — trimmed length zero — and there is no
meaningful trim of a collection. `@Size` measures a size, which all of those
types have. The type lists are part of the specification, and going outside
them gives `UnexpectedTypeException` at runtime rather than a compile error,
which is why the table is worth memorising rather than guessing at.

**★ `@Min` versus `@DecimalMin` — when does the difference actually bite?**
Whenever the bound is fractional, which in practice means money. `@Min` takes a
`long` and cannot express `0.01`; `@DecimalMin` takes the bound as a string and
parses it with full precision, and adds an `inclusive` flag so the boundary is
explicit. The related trap is that neither bounds *precision* — that is
`@Digits`.

**★ What can the built-in constraint set not express, and what do you do about
it?**
Anything referring to a second field, anything referring to external state, and
anything domain-specific — currency codes, IBANs, "end after start", "at least
one contact method". Cross-field rules need a class-level custom constraint;
domain formats need a `ConstraintValidator`. Both are covered in chunk 7. The
important discipline is checking the built-in table first, because a surprising
share of hand-written constraints reimplement `@NotBlank` or `@Digits`.

**★ Is there a runtime cost to Bean Validation worth caring about?**
The provider builds a reflective constraint model per class on first use and
caches it, so the cost is a first-touch cost per DTO type rather than a
per-request one. It is not usually measurable in a long-running service. Where
it does matter is startup-sensitive deployments — serverless functions,
scale-to-zero — where the whole library plus its metadata is a defensible thing
to leave out in favour of hand-written checks.

---

← Prev: [Why validate at the edge](01-why-validate-at-the-edge.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Null, empty and blank](03-null-empty-blank.md)
