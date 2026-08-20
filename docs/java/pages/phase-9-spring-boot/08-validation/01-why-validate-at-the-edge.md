---
title: "Why validation belongs at the edge"
sidebar_label: "1 · Why validate at the edge"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Validation,
> Data Binding, and Type Conversion* and *Java Bean Validation*
> (docs.spring.io/spring-framework/reference/core/validation/) — and the Spring
> Boot reference *Validation*
> (docs.spring.io/spring-boot/reference/io/validation.html). Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**Validation is a boundary concern, and the argument for it is not tidiness —
it is arithmetic. A check you perform once at the edge is written once. The
same check omitted at the edge has to be repeated at every point downstream
that could be reached by a bad value, forever, by every future maintainer who
remembers. "Reject at the edge, keep the domain clean" is the trade of one
declaration for an unbounded number of defensive `if` statements.**

## Three different things are called "invalid"

They arrive at the same controller, produce similar-looking error responses,
and are handled by three completely different mechanisms. Most confusion about
Bean Validation is really confusion about which of the three you are looking
at.

**1 · Structurally wrong — the bytes do not form the object.** A truncated JSON
document, a string where a number belongs, `"2026-13-45"` in a `LocalDate`
field. This never reaches validation at all: the message converter fails first
and the request dies during binding. That is Jackson's territory and it is
covered in
[binding the body](../07-rest-controllers/04-binding-the-body.md) and
[the absent field](../07-rest-controllers/06-the-absent-field.md).

**2 · Well-formed but nonsensical on its own terms.** The object was built, and
you can tell it is wrong by looking at nothing but the object: a null customer
name, a quantity of `-3`, an email of `"hello"`, a 40,000-character note field.
**This is exactly and only what Bean Validation is for.** The defining property
is *self-containment* — the decision needs the candidate value and a literal in
the annotation, and nothing else.

**3 · Well-formed, individually plausible, and wrong given the state of the
system.** The SKU does not exist. That email is already registered. There are
four units in stock and the order asks for six. **This is not validation, it is
a business rule**, and no amount of annotation will express it, because the
answer depends on a database read that may be stale by the time you act on it.

The line between 2 and 3 is the useful one and it is sharp: **if answering the
question requires reading anything other than the request, it is not a
constraint.**

## What validation is not

- **It is not authorization.** "Is this field within range" and "is this caller
  allowed to set this field" are different questions with different failure
  codes — 400 versus 401/403 — and different mechanisms. A `@Size(max = 5)` on
  a `roles` list does not stop a user granting themselves `ADMIN`. Authorization
  is the filter chain's job, in **Topic 11 — Spring Security** *(not written
  yet)*.
- **It is not sanitisation.** A constraint decides whether to accept a value; it
  does not rewrite it. Escaping is an *output* concern belonging to whatever
  renders the value, and a validator that quietly strips characters has changed
  the user's data without telling them.
- **It is not uniqueness, existence, or any other query.** A
  `@UniqueEmail` custom constraint that hits the database is a real pattern and
  people write it, but it is a business rule wearing a constraint's clothing:
  it can pass validation and still fail on insert, because the row can appear
  in the microseconds between the two. See
  [chunk 10](10-spring-managed-and-composition.md) for what injecting a
  repository into a validator can and cannot buy you.
- **It is not a replacement for domain invariants.** More on that next.

## The DTO carries constraints; the domain type carries invariants

This looks like duplication and is not. They are two different guarantees with
two different audiences.

```java
// The edge. Untrusted, nullable-by-nature, describes the wire contract.
public record CreateOrderRequest(
        @NotBlank @Size(max = 120) String customerName,
        @NotNull @Positive Integer quantity,
        @NotBlank @Email String contactEmail) { }

// The domain. Trusted, non-null by construction, describes the model.
public record Order(String customerName, int quantity, Email contact) {
    public Order {
        Objects.requireNonNull(customerName);
        if (quantity <= 0) throw new IllegalArgumentException("quantity");
    }
}
```

The DTO's annotations produce **a 400 with a field-by-field report** for a
human on the other end of an HTTP call. The record's compact constructor
produces **an `IllegalArgumentException` that should never fire**, because a
caller that reaches it has already been screened. It is an assertion, not a
user-facing check — which is why it can be terse and why its message does not
need translating. Compact constructors and this style of invariant are
[records](../../phase-2-classes-objects/08-records/README.md) and
[immutable design](../../phase-2-classes-objects/12-immutable-design/README.md).

**The payoff is what the service layer stops containing.** Without an edge:

```java
public Order place(CreateOrderRequest req) {
    if (req.customerName() == null || req.customerName().isBlank())
        throw new IllegalArgumentException("name required");
    if (req.quantity() == null || req.quantity() <= 0)
        throw new IllegalArgumentException("bad quantity");
    // ... and the same block, slightly differently worded, in every other
    //     method that accepts this request type
}
```

With an edge, `place` opens by using the values. That is the whole benefit, and
it compounds: the second entry point that accepts the same DTO — a batch
importer, a message consumer — reuses the annotations rather than re-deriving
the checks.

## Bounded input is a security property, not a nicety

`@Size(max = ...)` on every incoming string and collection is worth applying
even when the business has no opinion about length. An unbounded string field
is an unbounded allocation, an unbounded log line, an unbounded database write
attempt, and — if any downstream regex touches it — an unbounded backtracking
target. The cap is the point; the number is negotiable.

⚠️ **Validation fails open by default.** A field with no annotation on it is
accepted, whatever it contains. Bean Validation is an allowlist you have to
write, so the failure mode of forgetting is silence, never an error. That is
the single most important structural fact about it and it is why the gotchas in
this topic are mostly *"nothing happened"* rather than *"the wrong thing
happened"*.

## The trade-off

Declarative constraints are not free, and the honest costs are these.

- **The rule moves out of Java and into an annotation.** It is no longer
  reachable by a plain unit test of the type, is not visible to a caller
  reading the constructor, and cannot express anything a constant plus a value
  cannot decide. Anything conditional — *"`discountCode` is required only when
  `channel` is `PARTNER`"* — needs a class-level custom constraint
  ([chunk 11](11-cross-field-rules.md)) and immediately reads worse than the
  four-line `if` it replaced.
- **You take a dependency and a startup cost.** Hibernate Validator is a real
  library that builds metadata for every constrained class it meets. For an
  ordinary service this is noise; for a function that wants to start in
  milliseconds it is a line item.
- **The DTO becomes a second model.** Constraints belong on the request type,
  not the entity — which means writing the request type. Teams that annotate
  their JPA entities and bind them straight from HTTP save that class and pay
  for it with mass-assignment exposure and a validation policy that is now
  shared, inappropriately, between the wire and the database.
- **The alternative is "parse, don't validate".** Instead of accepting a wide
  type and asserting things about it, accept a narrow type that cannot hold a
  bad value: a static factory `Email.parse(String)` returning
  `Result<Email, String>`, a `Quantity` that cannot be negative. This is
  stronger — the guarantee is carried in the type rather than in a side channel
  — and it costs you the free field-by-field error report, the message
  interpolation, and the framework integration. Most Spring codebases land on:
  **Bean Validation at the HTTP edge, narrow types inside**, which is the
  layering above.

## Gotchas

**Symptom** · Constraints on the DTO, and the domain still receives a null.
**Cause** · Some other entry point — a scheduled job, a Kafka consumer, a test
fixture — constructs the DTO directly. Annotations do nothing unless something
invokes a `Validator`.
**Fix** · Keep the domain's own invariants (the compact constructor above).
Edge validation is the first line, not the only one.

**Symptom** · The API rejects a value the business considers legal, and nobody
can find where.
**Cause** · A constraint written to protect a downstream system (a column
width, a third-party API's limit) sitting on a DTO with no comment.
**Fix** · Constraints that exist for a technical reason belong next to a
comment naming the reason, or they will be loosened by whoever hits them first.

**Symptom** · Validation logic drifts between two endpoints that accept "the
same" object.
**Cause** · Two DTOs copied from each other.
**Fix** · One request type per *contract*, shared where the contract genuinely
is shared; the create-versus-update case is what **validation groups** exist
for ([chunk 12](12-validation-groups.md)) and is not a reason to duplicate.

**Symptom** · A `@UniqueEmail` constraint passes and the insert then fails with
a constraint-violation error from the database.
**Cause** · Time-of-check to time-of-use. Nothing holds a lock between the
validator's query and the write.
**Fix** · Keep the friendly pre-check if you like, but the database's unique
index is the actual enforcement and its failure must be translated into a
sensible response — see
[custom exceptions and translation](../../phase-5-exceptions/04-custom-exceptions-translation.md).

**Symptom** · A field arrives as `null` and no violation is reported, even
though the field "obviously" cannot be optional.
**Cause** · No `@NotNull`. Almost every other constraint treats `null` as
valid, deliberately.
**Fix** · This is the single most common Bean Validation mistake and
[chunk 2](02-the-constraints.md) is largely about it.

**Symptom** · Error messages leak column names and internal identifiers to API
clients.
**Cause** · Default messages plus DTO field names that mirror the schema.
**Fix** · [Chunk 16](16-message-codes.md) — relabel the message argument
rather than the field, and it is a design decision, not a formatting one.

## Interview questions

**★ Where should validation live in a layered application, and why there?**
At the boundary that accepts untrusted input — the controller for HTTP, the
consumer for a message, the CLI parser for an argument. The reason is that a
value validated once at the edge is guaranteed for every code path behind it,
whereas a value validated in the service is guaranteed only on the paths that
remembered. The domain keeps its own constructor invariants as assertions, but
those are a safety net for programmer error, not the user-facing check.

**★ What kinds of rule can Bean Validation *not* express?**
Anything whose answer requires state outside the object under validation:
uniqueness, existence of a referenced entity, sufficiency of stock, whether the
caller is permitted. Also anything requiring a decision that changes over time
independently of the code. Those are business rules and they belong in the
service, with a domain exception and a status code that says something other
than 400 — typically 409 or 422.

**★ Isn't putting constraints on a DTO and invariants on the domain type just
writing the same rule twice?**
They are two rules that happen to agree today. The DTO constraint is a
*contract with a client* — it must produce a readable, translatable,
field-addressed error. The domain invariant is an *assertion about program
correctness* — it should never fire, and if it does, the right response is a
500 and a bug report, not a friendly message. They also diverge in practice:
the wire type accepts `Integer` so that "absent" and "zero" are
distinguishable, while the domain type takes `int` because absence is not
representable there.

**★ Why is `@Size(max = ...)` worth adding to a string with no business length
limit?**
Because unbounded input is an unbounded cost somewhere downstream — allocation,
logging, database write, and especially regular-expression matching, where a
long input against a backtracking pattern is a denial-of-service primitive. A
cap that is obviously generous still closes the class of problem.

**★ What is the failure mode of forgetting a constraint, and why does that
matter more than usual?**
Silence. There is no error, no warning and no log line; the value is simply
accepted. Because the omission is invisible, the standard defence is a test per
constrained request type that asserts the *rejections*, not a review that
assumes someone will notice.

**★ Someone proposes validating the JPA entity directly and skipping the request
DTO. What is your argument?**
Three separate ones. First, binding HTTP directly onto a persistent type is a
mass-assignment vector — a field you never meant to expose becomes settable.
Second, the wire's shape and the table's shape have different reasons to
change, and merging them means every column rename is an API break. Third, the
constraints then serve two masters: JPA reads some of them for schema
generation, so a `@Size` you tighten for the API can alter DDL. The DTO is one
extra class and it buys all three back.

---

← Index: [Validation](README.md) · Phase: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The constraints themselves](02-the-constraints.md)
