---
title: "Validation groups, and why two DTOs usually beat them"
sidebar_label: "12 · Validation groups"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the **Hibernate Validator 9.1 reference** —
> *Validating groups*, *Group sequences* and *Group conversion*
> (docs.hibernate.org/stable/validator/reference/en-US/html_single/) — and the
> Spring Framework reference *Java Bean Validation*
> (docs.spring.io/spring-framework/reference/core/validation/beanvalidation.html
> — `@Validated` carrying group classes) and *Validation* for
> `@RequestMapping` methods
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html).
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**A group is a marker interface that partitions the constraints on a type, so
one class can carry two rulesets — the create case and the update case being
the canonical example. It works, it is standard, and it has one failure mode
severe enough to dominate the whole feature: requesting a group does *not*
include the `Default` group, so switching an endpoint to a group can silently
disable half its validation.**

## The mechanism

```java
public interface OnCreate { }
public interface OnUpdate { }

public record ProductRequest(
        @Null(groups = OnCreate.class)                        // must be absent on create
        @NotNull(groups = OnUpdate.class)                     // must be present on update
        Long id,

        @NotBlank(groups = { OnCreate.class, OnUpdate.class })
        @Size(max = 120)                                      // ← Default group only!
        String name,

        @NotNull(groups = OnCreate.class)
        @PositiveOrZero
        BigDecimal price) { }
```

```java
@PostMapping
Product create(@Validated(OnCreate.class) @RequestBody ProductRequest request) { … }

@PutMapping("/{id}")
Product update(@PathVariable Long id,
               @Validated(OnUpdate.class) @RequestBody ProductRequest request) { … }
```

**Only `@Validated` takes groups.** `@Valid` has no attributes at all, so an
endpoint that needs a group must use Spring's annotation — one of the few
places where the choice between the two is forced rather than stylistic
([chunk 5](05-valid-at-the-boundary.md)).

## 🔴 The `Default` trap

Look again at `@Size(max = 120)` and `@PositiveOrZero` above. Neither declares
a `groups` attribute, so both belong to the **`Default`** group and nothing
else. Validating with `@Validated(OnCreate.class)` requests exactly the
`OnCreate` group — **`Default` is not included** — so those two constraints are
never evaluated.

The endpoint keeps working. Nothing logs. The name length is no longer bounded
and negative prices are accepted. **This is the single most damaging groups
mistake**, and it is nearly invisible in review because the DTO is visibly
covered in annotations.

The fix is to name both groups explicitly:

```java
@PostMapping
Product create(@Validated({ Default.class, OnCreate.class }) @RequestBody ProductRequest request) { … }
```

`jakarta.validation.groups.Default` is an ordinary interface you import and
list like any other group. **Make `{ Default.class, X.class }` the house
style** — the case where you genuinely want a group *without* `Default` is rare
enough to deserve a comment when it happens.

## Ordering with `@GroupSequence`

A sequence evaluates groups in order and **stops at the first group that
produces a violation**:

```java
@GroupSequence({ Default.class, ExpensiveChecks.class })
public interface FullValidation { }
```

Validating against `FullValidation` runs `Default` first; only if everything
there passes does `ExpensiveChecks` run at all. That is the sane way to keep a
costly check — a complicated pattern, a constraint that consults configuration
— from running against input that is obviously malformed.

Two properties are worth being precise about. The short-circuit is **between
groups, not within one**: inside `Default` you still get every violation at
once, which is what keeps the error report complete. And a sequence is a
*group*, so it is used the same way: `@Validated(FullValidation.class)`.

`@GroupSequence` may also be placed **on a class** to redefine what `Default`
means for that type. It is powerful and easy to misread — a reader of the
constraint annotations has no local clue that `Default` has been redefined —
so prefer a named sequence interface unless you have a specific reason.

## Groups do not cross a cascade by themselves

`@Valid` on a nested field cascades the **`Default`** group, whatever group the
outer validation requested. Carrying a group across the boundary is explicit:

```java
public record OrderRequest(
        @NotNull
        @Valid
        @ConvertGroup(from = OnCreate.class, to = OnCreate.class)
        AddressRequest shippingAddress) { }
```

Forgetting `@ConvertGroup` reproduces the `Default` trap one level down: the
nested object is validated, but against a different ruleset than the one you
asked for. This is the second-most-common groups bug and it is harder to see,
because the nested object *is* being validated.

## The trade-off: groups versus two DTOs

Groups keep one type and one set of annotations, at the cost of a ruleset that
can only be read by mentally filtering annotations by group — plus the
`Default` trap, which fails silently. **Two request records are almost always
clearer:**

```java
public record CreateProductRequest(@NotBlank @Size(max = 120) String name,
                                   @NotNull @PositiveOrZero BigDecimal price) { }

public record UpdateProductRequest(@NotNull Long id,
                                   @NotBlank @Size(max = 120) String name,
                                   @PositiveOrZero BigDecimal price) { }
```

Each type states its own contract, needs no group reasoning, cannot fall into
the `Default` trap, generates cleaner API documentation, and lets the two
contracts diverge — which they always eventually do, usually the first time
someone adds a field that only creation accepts. The duplication is real and it
is the smaller cost. It is the same argument records-as-DTOs makes generally in
[records as DTOs](../07-rest-controllers/05-records-as-dtos.md).

**Where groups genuinely earn their place** is when the same object must
satisfy different rules at *different points in one process* rather than at two
different endpoints: a draft that must be well-formed to save and complete to
submit, a multi-step wizard whose state accumulates, a batch record checked
cheaply on ingest and fully on processing. There the two rulesets apply to the
same instance, and two types would mean copying data between them for no
benefit.

The second legitimate use is **sequencing**, above — cheap checks before
expensive ones — which has no equivalent in a two-DTO design.

## Gotchas

**Symptom** · Adding `@Validated(OnCreate.class)` made half the DTO's
constraints stop firing.
**Cause** · Constraints with no `groups` attribute are in `Default` only, and
requesting a group does not include `Default`.
**Fix** · `@Validated({ Default.class, OnCreate.class })`, importing
`jakarta.validation.groups.Default`.

**Symptom** · `@Valid(OnCreate.class)` will not compile.
**Cause** · `@Valid` has no attributes.
**Fix** · Use Spring's `@Validated` when you need groups; keep `@Valid`
everywhere else.

**Symptom** · Groups work on the top-level object but the nested object is
validated against the wrong ruleset.
**Cause** · `@Valid` cascades `Default`; groups do not propagate.
**Fix** · `@ConvertGroup(from = X.class, to = X.class)` next to the `@Valid` on
the nested field.

**Symptom** · An expensive validation runs even when the input is obviously
malformed.
**Cause** · All requested groups are evaluated together; nothing orders them.
**Fix** · A `@GroupSequence` interface listing `Default` before the expensive
group, and validate against the sequence.

**Symptom** · A constraint annotated with a group fires on an endpoint that
never mentions that group.
**Cause** · The endpoint validates with `Default` and the constraint also lists
`Default` — or a class-level `@GroupSequence` has redefined what `Default`
means for that type.
**Fix** · Check for a class-level `@GroupSequence` first; it is the least
visible cause.

**Symptom** · Only some violations come back from a sequence-validated request.
**Cause** · That is what a sequence does — it stops at the first group with a
violation.
**Fix** · Nothing, if the sequencing was intentional. If a complete report
matters more than the ordering, do not use a sequence.

**Symptom** · Two endpoints share a DTO and one of them starts rejecting valid
requests after an unrelated change.
**Cause** · Somebody added an unqualified constraint to the shared type; it
landed in `Default` and therefore in both endpoints.
**Fix** · This is the structural argument for two DTOs. In a group-based
design, every new constraint has to be assigned a group deliberately.

## Interview questions

**★ What is a validation group, and what activates one?**
A marker interface listed in a constraint's `groups` attribute, partitioning
the constraints on a type. It is activated by Spring's
`@Validated(SomeGroup.class)` — `@Valid` cannot express it, having no
attributes. The usual motivation is one DTO serving both create and update.

**★ What is the single most dangerous thing about groups?**
That a constraint with no `groups` attribute belongs to `Default` only, and
requesting a specific group does **not** include `Default`. Switching an
endpoint from `@Valid` to `@Validated(OnCreate.class)` therefore silently
disables every unqualified constraint on the DTO — the endpoint keeps working
and stops enforcing rules. Write `@Validated({ Default.class, OnCreate.class })`
unless you specifically mean otherwise.

**★ Groups or two DTOs for create versus update?**
Two DTOs, for most APIs. Each states its own contract with no group filtering
to reason about, cannot hit the `Default` trap, documents itself better, and
lets the two contracts diverge as they inevitably do. Groups earn their place
when the *same instance* must satisfy different rules at different points of a
process — draft versus submit, ingest versus process — where two types would
mean copying data between them.

**★ What does `@GroupSequence` do, and what does it not do?**
It orders groups and stops at the first group that yields a violation, so
expensive checks can be made to run only after the cheap ones pass. It does
**not** short-circuit within a group — inside `Default` you still get every
violation — which is what keeps the field-by-field report complete. It can also
be applied to a class to redefine `Default` for that type, which is powerful
and nearly invisible to a reader.

**★ Do groups propagate into nested objects?**
No. `@Valid` cascades the `Default` group regardless of what the outer
validation requested. Carrying a group across requires
`@ConvertGroup(from = …, to = …)` next to the `@Valid`, and forgetting it
reproduces the `Default` trap one level down — with the extra confusion that
the nested object *is* being validated, just against the wrong set.

**★ How would you review a pull request that introduces groups?**
Check three things. Every `@Validated(X.class)` should be
`@Validated({ Default.class, X.class })` unless the omission is deliberate and
commented. Every cascaded `@Valid` on a nested object should carry a
`@ConvertGroup` if the outer validation uses a group. And every existing
unqualified constraint should be examined, because it is now implicitly
`Default`-only and may no longer run on the endpoints that need it.

---

← Prev: [Cross-field rules](11-cross-field-rules.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Validation beyond the controller](13-beyond-the-controller.md)
