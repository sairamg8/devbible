---
title: "Text constraints, containers, and where an annotation lives"
sidebar_label: "4 · Text and placement"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the **Hibernate Validator 9.1 reference**,
> *Built-in constraints* (the `@Email` and `@Pattern` `regexp`/`flags`
> attributes and their supported types) and *Declaring and validating bean
> constraints* — container element constraints
> (docs.hibernate.org/stable/validator/reference/en-US/html_single/) — and the
> Spring Framework reference *Java Bean Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**`@Email` and `@Pattern` are the two constraints people trust most and should
trust least: both check shape and neither checks meaning. And an annotation
that is placed where the provider does not look is not a weak constraint, it is
no constraint — which is why "where does this go" deserves its own section
rather than a footnote.**

## `@Email` is far weaker than the name suggests

`@Email` checks that a character sequence *looks like* an address. It is not
RFC 5322 in full, it does not resolve the domain, it does not check that a
mailbox exists, and it accepts things most people assume it rejects — a
single-label domain such as `a@b` passes, because nothing requires a hostname
to contain a dot.

**Treat it as a typo filter.** The only real proof that an address is valid is
a message delivered to it and a link clicked; every serious signup flow does
that anyway, which is exactly why tightening the regex buys so little.

If you do want a stricter shape, `@Email` takes its own `regexp`, applied **in
addition** to the built-in check rather than instead of it:

```java
@NotBlank
@Size(max = 254)
@Email(regexp = ".+@.+\\..+", message = "{validation.email.shape}")
private String contactEmail;
```

⚠️ **The mirror-image mistake is worse.** A hand-rolled "strict" address regex
rejects legitimate addresses — plus-addressing (`ada+news@example.com`), long
new top-level domains, internationalised local parts — and the people it
rejects are real customers who cannot work around it. Loose validation plus a
delivery check beats strict validation every time.

The `254` in that example is not decoration: it is the practical maximum length
of an address in an SMTP path, and it is the kind of bound worth writing down
so that nobody has to rediscover it.

## `@Pattern` matches the whole input

`@Pattern` compiles a `java.util.regex.Pattern` and requires the **entire**
value to match — the semantics of `Matcher.matches()`, not `find()`. Two
things follow.

```java
@Size(max = 32)
@Pattern(regexp = "[A-Z]{2}-[0-9]{4,10}", message = "{order.reference.format}")
private String orderReference;
```

**No anchors are needed, and wrapping the expression in `.*` is a common
accident** that turns the constraint into "contains something that looks like
this", which is nearly always weaker than intended and occasionally accepts
everything.

**Always bound the input first.** A catastrophically backtracking expression is
only dangerous when the input is long, so `@Size(max = ...)` next to every
`@Pattern` is the cheapest available mitigation. The `flags` attribute takes
`Pattern.Flag` values — `CASE_INSENSITIVE`, `MULTILINE` and the rest — which is
the supported way to say what a `(?i)` prefix would say.

## Nothing is normalised before it is validated

Bean Validation compares the value as received. `@NotBlank` trims *for the
purpose of its own check*; it does not modify the field, and no other
constraint trims anything. So `"  user@example.com  "` fails `@Email`, and a
reference number pasted from a spreadsheet with a trailing tab fails
`@Pattern`.

You have two honest options and one dishonest one.

- **Reject and say so** — legitimate, and the message must be specific enough
  that the user can see the problem, because trailing whitespace is invisible.
- **Normalise during deserialisation, before validation runs.** For JSON that
  is a Jackson-level concern; see
  [customising serialisation](../07-rest-controllers/11-customising-serialisation.md).
  This is the option most APIs want, because "leading space" is not a
  meaningful thing to tell a client.
- **Normalise inside a `ConstraintValidator`** — do not. A validator that
  mutates its input has changed the user's data in a place nobody looks, and
  validators run against a value the provider hands them, not against the field
  you would need to write back.

## Container element constraints

Since Bean Validation 2.0 a constraint can sit on a **type argument**, which is
how you say "each element" rather than "the container".

```java
public record TagUpdate(
        @Size(max = 10)                                 // the list: at most 10 entries
        List<@NotBlank @Size(max = 24) String> tags,    // each tag, individually

        Map<@NotBlank String, @Positive Integer> weights,

        Optional<@Email String> replyTo) { }
```

The two `@Size`s on `tags` mean entirely different things and both are useful:
the outer one bounds the collection, the inner one bounds each string. On the
map, the first constraint applies to keys and the second to values — a
distinction that has no other syntax. And `Optional<@Email String>` constrains
the contained value, which is the only sensible reading, since
`Optional.empty()` has nothing to check.

## Where a constraint may be placed

| Placement | Example | What it constrains |
|---|---|---|
| field | `@NotBlank private String name;` | the field |
| getter (property) | `@NotBlank public String getName()` | the JavaBean property |
| type argument | `List<@NotBlank String>` | each element / key / value |
| record component | `record R(@NotBlank String name)` | propagated per the annotation's `@Target` |
| method parameter | `void f(@Positive int n)` | method validation — [chunk 6](06-the-failure.md), [chunk 8](08-beyond-the-controller.md) |
| method return value | `@NotNull Order find(…)` | method validation |
| class | `@ConsistentDateRange public class Booking` | cross-field rules — [chunk 7](07-custom-validators.md) |

**On a record, annotate the component.** The built-in constraints target
fields, methods, parameters and type use, so a component annotation is
propagated to the places the provider inspects. That is one more reason records
are comfortable DTOs — see
[records as DTOs](../07-rest-controllers/05-records-as-dtos.md) — and it
removes the field-versus-getter question entirely.

⚠️ **Never annotate both a field and its getter with the same constraint.**
They are discovered as two constrained elements, so one bad value produces two
identical violations, the error response lists the field twice, and any client
that counts errors is now wrong.

## The trade-off

Text constraints give you a fast, declarative, portable rejection at the cost
of precision: `@Email` accepts addresses that cannot receive mail, `@Pattern`
encodes a format in a string literal that no compiler checks and no IDE
refactors, and neither can explain *why* a value is wrong beyond "it does not
match". The alternative — parsing into a narrow type in a deserializer, so that
`Email` and `OrderReference` are types rather than annotated strings — gives
better errors and stronger downstream guarantees, and costs you the free
field-addressed report and the framework integration.

Placement has its own trade. Field constraints are the most obvious to read;
getter constraints are the only ones that can express a derived rule without
custom code, and they leak an internal property name into the error response.
Neither is universally right, but **mixing both styles in one codebase is
always wrong**, because that is where the duplicate-violation bug comes from.

## Gotchas

**Symptom** · `a@b` is accepted by `@Email`.
**Cause** · That is the specified behaviour; the built-in check is deliberately
permissive.
**Fix** · Nothing, unless you add a `regexp`. Do not read `@Email` as proof of
deliverability — a confirmation mail is the only such proof.

**Symptom** · A `@Pattern` that "obviously" restricts the format accepts
everything.
**Cause** · The expression is wrapped in `.*`, so a whole-input match becomes
trivially satisfiable.
**Fix** · Remove the wildcards; `@Pattern` already matches the entire value.

**Symptom** · A valid-looking value fails `@Pattern` or `@Email` and the user
cannot see why.
**Cause** · Leading or trailing whitespace, which nothing trims.
**Fix** · Normalise during deserialisation, or make the message name the
problem explicitly.

**Symptom** · A value pasted with a plus sign or a long TLD is rejected.
**Cause** · A hand-written "strict" email regex.
**Fix** · Fall back to plain `@Email` plus `@Size(max = 254)` and confirm by
delivery.

**Symptom** · Two identical violations for one field.
**Cause** · The constraint sits on the field *and* on the getter.
**Fix** · One placement convention per project. On records the question does
not arise.

**Symptom** · A constraint on a `Map` field never fires for the values inside
it.
**Cause** · `@Size` on a `Map` measures the map.
**Fix** · Constrain the type arguments:
`Map<@NotBlank String, @Positive Integer>`.

**Symptom** · A regex-heavy endpoint becomes slow or unresponsive under
hostile input.
**Cause** · Backtracking on a long input against a pattern with nested
quantifiers.
**Fix** · `@Size(max = …)` before the `@Pattern`, and rewrite the expression to
remove the nesting. The size bound is the part that is free.

## Interview questions

**★ How much does `@Email` actually guarantee?**
That the string is shaped like an address. It does not resolve the domain, does
not check the mailbox, and accepts dotless domains such as `a@b`. It is a typo
filter. Its optional `regexp` adds a stricter shape check on top of the
built-in one, but tightening it rejects real addresses — plus-addressing and
new TLDs are the usual casualties — so the standard advice is loose validation
plus a confirmation email.

**★ Does `@Pattern` search or match?**
It matches the whole value. That is why anchors are unnecessary, and why
wrapping an expression in `.*` silently weakens the constraint to "contains".
The `flags` attribute is the supported way to pass `CASE_INSENSITIVE` and
friends rather than embedding inline flag groups.

**★ Why put `@Size` next to `@Pattern` even when there is no length rule?**
Because regular-expression backtracking cost grows with input length, so an
unbounded field plus a pattern with nested quantifiers is a denial-of-service
lever. The size bound is a one-line, zero-cost mitigation that closes the class
of problem regardless of how good the expression is.

**★ Does Bean Validation trim input before validating?**
No. `@NotBlank` trims for its own decision only; nothing modifies the value.
So a trailing space fails `@Email` and `@Pattern`. Normalisation belongs in
deserialisation, before validation runs — never inside a `ConstraintValidator`,
which would be mutating user data in a place nobody thinks to look.

**★ How do you constrain the keys and the values of a `Map` differently?**
With container element constraints on the type arguments —
`Map<@NotBlank String, @Positive Integer>`. There is no other syntax for it: a
constraint on the field itself applies to the map as a whole, so `@Size` there
bounds the number of entries.

**★ Can you put constraints on a record component, and where do they end up?**
Yes, and it is the normal way to write a DTO in Boot 4. The component
annotation is propagated to the field, the accessor and the constructor
parameter according to the annotation's `@Target`, and the built-in constraints
target enough of those for the provider to find them. It also makes the
field-versus-getter double-annotation bug impossible.

**★ What is the argument for parsing into a narrow type instead of annotating a
`String`?**
An `Email` type that can only be constructed from a valid address carries its
guarantee everywhere it goes, is checked by the compiler, and can produce a
precise parse error. Annotated strings carry no guarantee past the controller —
the service still receives a `String` that could be anything — but they
integrate with the framework's error reporting for free. Most Spring codebases
use annotations at the edge and narrow types inside, which is the layering from
[chunk 1](01-why-validate-at-the-edge.md).

---

← Prev: [Null, empty and blank](03-null-empty-blank.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [`@Valid` at the boundary](05-valid-at-the-boundary.md)
