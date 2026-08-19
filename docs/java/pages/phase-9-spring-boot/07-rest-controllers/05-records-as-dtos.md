---
title: "Records as DTOs"
sidebar_label: "5 · Records as DTOs"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Jakarta Validation 3.1 specification page
> (jakarta.ee — Jakarta EE 11, Java SE 17 baseline, *"Clarify Java Records
> support"* listed as the substantive change from 3.0, and no removals or
> backwards-incompatible changes), the spring.io blog *Introducing Jackson 3
> support in Spring* (2025-10-07 — the `tools.jackson` package move,
> `JsonMapper` replacing mutable `ObjectMapper` as the entry point, and
> `JacksonJsonHttpMessageConverter`), the Spring Boot 4.1.0 reference *JSON*
> chapter (docs.spring.io — the auto-configured `JsonMapper` bean), and the
> Spring Framework 7.0.8 reference on the `-parameters` requirement for formal
> parameter names. Record component retention is a class-file property (JVMS
> `Record` attribute), distinct from `-parameters`.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A record is the right shape for a request or response body for one reason that
has nothing to do with brevity: a DTO's job is to be a *value* that crosses a
boundary once, and a record is the only Java construct that makes that
structurally true rather than merely intended. The components are final, the
canonical constructor is the single point of entry, and there is nowhere to hang
the mutable state that turns a DTO into an accidental domain object. The cost is
equally structural — a record has no notion of an absent field, and that single
gap is what makes `PATCH` genuinely hard.**

## Why a record and not a class

```java
// The whole DTO.
public record NewOrder(String customerRef,
                       List<OrderLine> lines,
                       String currency) { }

public record OrderLine(String sku, int quantity) { }
```

What you get without writing it: a canonical constructor, accessors,
`equals`/`hashCode` over all components, and a `toString`. What you *cannot*
get: a setter, an uninitialised field, or a subclass — records are implicitly
final and cannot extend anything.

That last restriction is usually cited as a limitation and is in fact the point.
A DTO hierarchy with a shared abstract base is a design that has begun treating
transport objects as a domain model; records make it impossible rather than
merely unwise. Where DTOs genuinely need a common type, a **sealed interface**
that several records implement expresses the closed set honestly and works with
pattern matching:

```java
public sealed interface PaymentInstruction
        permits CardPayment, TransferPayment { }

public record CardPayment(String token, int amountMinor)   implements PaymentInstruction { }
public record TransferPayment(String iban, int amountMinor) implements PaymentInstruction { }
```

Records, sealed types and pattern matching as language features are
[Phase 2 · Records](../../phase-2-classes-objects/README.md)'s subject; what
follows is only what changes when the record meets HTTP.

## How Jackson 3 binds a record

Deserialisation targets the **canonical constructor**. Jackson reads the
component names, matches them against JSON property names, converts each value,
and invokes the constructor once — so a record instance is either fully
constructed or not constructed at all. There is no window in which a
half-populated DTO exists, which is the property a `new` plus setters model
cannot offer.

Component names survive compilation independently of the `-parameters` flag,
because a record's components are recorded in the class file's `Record`
attribute rather than inferred from constructor parameter names. That is why
record binding is more robust than ordinary constructor binding.

⚠️ **The exception is an explicit `@JsonCreator` constructor.** If you add a
non-canonical constructor and annotate it as the creator, it is an ordinary
constructor again and its parameter names come from the `-parameters` flag, not
from the `Record` attribute. In a Boot project the flag is on anyway (see
[chunk 3](03-the-named-inputs.md)), so this rarely surfaces — but it is the
mechanism behind the advice, common in older material, to annotate every record
component with `@JsonProperty`.

Where the wire name and the component name genuinely differ, annotate the
component:

```java
public record NewOrder(
        @JsonProperty("customer_ref") String customerRef,
        List<OrderLine> lines) { }
```

## Validation on records

Jakarta Validation **3.1** lists *"Clarify Java Records support"* as its
substantive change over 3.0, so constraints on components are specified
behaviour rather than an implementation courtesy:

```java
public record NewOrder(
        @NotBlank String customerRef,
        @NotEmpty List<@Valid OrderLine> lines,
        @Pattern(regexp = "[A-Z]{3}") String currency) { }
```

Alongside that, a record's **compact constructor** is the place for invariants
that must hold no matter who constructs the object:

```java
public record OrderLine(String sku, int quantity) {
    public OrderLine {                       // compact canonical constructor
        Objects.requireNonNull(sku, "sku");
        if (quantity < 1) {
            throw new IllegalArgumentException("quantity must be positive");
        }
    }
}
```

These two mechanisms are not alternatives and the distinction matters: **the
annotations guard the HTTP boundary, the constructor guards the type.** A test
fixture, a message consumer or another service calling the same code
constructs the record directly and never passes through a `Validator` — so an
invariant that only exists as an annotation is not an invariant at all. The
argument is developed further in **topic 08 · Validation** *(not written yet)*.

⚠️ Throwing from a compact constructor during *deserialisation* surfaces as a
message-conversion failure rather than a validation failure, so the two
mechanisms also produce different error responses. Keep constructor guards for
genuine invariants and let annotations carry everything a client could
plausibly get wrong.

## Never return your persistence entities

The strongest argument for DTOs is not layering purity, it is a list of concrete
failures that returning entities produces:

- **Serialising a lazy association** triggers a load during response writing —
  after the transaction has usually closed. Depending on the provider that is
  either an exception mid-response, with the status line already sent, or a
  storm of `N+1` queries executed while serialising a collection.
- **Every field is published by default.** A column added for an internal
  purpose — an audit flag, a password hash, an internal cost — appears in the
  API the moment it appears on the entity. The default is *expose*, and it is
  silent.
- **A bidirectional association serialises into a cycle** unless something
  breaks it, so the fix becomes a scattering of `@JsonIgnore` that encodes
  serialisation concerns into the persistence model.
- **The API shape becomes the schema shape.** A column rename is now a breaking
  API change, and the two things that should evolve independently are welded
  together.

A record DTO costs a mapping step and buys the ability to change either side
without touching the other. Persistence mechanics — lazy loading, transaction
boundaries, the `N+1` pattern — are **Phase 10 · Data access**
*(not written yet)*.

## Gotchas

**Symptom:** an `int` component arrives as `0` and downstream logic treats it as a real quantity
**Cause:** a primitive component has no null, so an absent JSON field becomes the primitive default, which is indistinguishable from a client genuinely sending zero
**Fix:** use the boxed type for anything genuinely optional, and add `@NotNull` so absence is rejected at the boundary rather than defaulted silently

**Symptom:** deserialisation fails complaining that a constructor argument has no property name
**Cause:** an explicit `@JsonCreator` constructor was added, so names come from the `-parameters` flag rather than from the record's `Record` attribute — and the flag is off in this build
**Fix:** either delete the custom creator and let Jackson use the canonical constructor, or enable `-parameters` (see [chunk 3](03-the-named-inputs.md)). Annotating every component with `@JsonProperty` also works and is what most older material recommends, but it is treating the symptom

**Symptom:** a response includes an internal field nobody intended to publish
**Cause:** the endpoint returns a persistence entity, so every mapped column is serialised by default — the exposure is opt-out, and adding a column is enough to leak it
**Fix:** return a record DTO listing exactly the fields the API publishes. The mapping step is the feature: adding a column can no longer change the API by accident

**Symptom:** serialising a response throws partway through, with the status line already sent and the body truncated
**Cause:** a lazy association was traversed during serialisation, after the transaction closed — the entity escaped the boundary that made it valid
**Fix:** map to a DTO inside the transaction, so what leaves the service layer is already a fully-materialised value

**Symptom:** two DTOs need shared fields and the record cannot extend a base class
**Cause:** records are implicitly final and cannot extend anything
**Fix:** treat it as the design signal it is. Where a common type is genuinely needed, a `sealed interface` implemented by several records expresses a closed set and works with pattern matching; where it is not, duplicate the components — DTOs are allowed to be repetitive, because their job is to describe one wire format exactly

## Interview questions

**★ Why prefer a record over a class for a request or response body?**
Because a DTO should be a value that crosses a boundary once, and a record makes
that structurally true instead of merely intended: components are final, the
canonical constructor is the single point of entry, and there is nowhere to hang
mutable state. You also get `equals`, `hashCode` and `toString` over all
components, which makes DTOs trivially comparable in tests. And because Jackson
targets the canonical constructor, an instance is either fully constructed or
not constructed at all — there is never a half-populated DTO, which a `new` plus
setters model cannot promise. The brevity is real but it is the least
interesting part.

**★ Records cannot extend anything. Is that a problem for DTOs?**
Almost never, and it is usually a benefit. A DTO hierarchy with a shared
abstract base is a design that has started treating transport objects as a
domain model, and records make that impossible rather than merely inadvisable.
Where a genuine common type is needed — a polymorphic payload, say — a sealed
interface implemented by several records expresses the closed set honestly and
composes with pattern matching. Where it is not needed, duplicating a couple of
components across two records is the right answer, because each record is
supposed to describe one wire format exactly rather than share an abstraction
with another.

**★ Does record deserialisation depend on the `-parameters` compiler flag?**
Not for the canonical constructor. A record's component names are stored in the
class file's `Record` attribute, which is emitted regardless of compiler flags,
so Jackson can read them without `-parameters` — which makes record binding more
robust than ordinary constructor binding. The exception is an explicit
`@JsonCreator` constructor: that is an ordinary constructor again, so its
parameter names come from `-parameters` as usual. In a Boot project the flag is
enabled by the starter parent anyway, so this rarely bites in practice, but it
explains why so much older material tells you to annotate every record component
with `@JsonProperty`.

**★ Where do you put validation on a record — annotations or the compact constructor?**
Both, for different jobs. Constraint annotations on the components guard the
**HTTP boundary**: they are evaluated by a `Validator` when the request is bound
and they produce a structured 400 naming the offending field. The compact
constructor guards the **type**: it runs for every construction, including from a
test fixture, a message consumer or another service, none of which pass through
a `Validator`. So an invariant that exists only as an annotation is not an
invariant — it is a boundary check. My rule is that annotations carry everything
a client could plausibly get wrong, and the constructor carries the things that
must be true for the object to make sense at all. Worth noting they fail
differently too: throwing from a compact constructor during deserialisation
surfaces as a message-conversion failure, not a validation failure.

**★ Give me the concrete reasons not to return JPA entities from a controller.**
Four, all of them things that actually happen. Serialising a lazy association
triggers a load during response writing, usually after the transaction closed —
either an exception with the status line already sent, or `N+1` queries executed
while serialising a collection. Every mapped field is published by default, so
adding an internal column silently adds it to the public API. Bidirectional
associations serialise into a cycle unless broken, which pushes `@JsonIgnore`
annotations into the persistence model where they do not belong. And the API
shape becomes the schema shape, so a column rename becomes a breaking API change
and two things that should evolve independently cannot. A DTO costs one mapping
step and removes all four.

---

← Prev: [Binding the body](04-binding-the-body.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The absent field, and `PATCH`](06-the-absent-field.md)
