---
title: "Records in practice"
sidebar_label: "2 · Records in practice"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against JEP 395 (Records, 16), the Jackson databind
> 2.12+ release notes (native record support), the Bean Validation 3.x
> (Jakarta Validation) spec on record components, the Jakarta Persistence
> spec's entity requirements (no-arg constructor, non-final), and the
> Java Object Serialization spec's record serialization rules.

**In application code, "should this be a record?" has a default answer —
yes for anything that is transparent data: request/response DTOs, value
objects, map keys, config carriers, stream intermediates. The craft is in
the exceptions (JPA entities, mutable identity, huge optional-field shapes)
and in two habits that make record types *actually* safe: defensive copies
in the compact constructor, and validation that rides along on every
deserialization.**

## DTOs with Jackson

Jackson supports records natively since 2.12: components map to JSON
properties, deserialization goes through the **canonical constructor**, and
no annotations are needed for the straightforward case:

```java
public record CreateOrderRequest(String customerId,
                                 List<LineItem> items,
                                 String couponCode) {   // may be absent → null
    public CreateOrderRequest {
        Objects.requireNonNull(customerId, "customerId");
        items = List.copyOf(items);                     // defensive + null-hostile
    }
}
```

Two properties of this arrangement do real work:

- **Validation runs on deserialization.** Because Jackson calls the
  canonical constructor, the compact-constructor checks from
  [chunk 1](01-the-feature.md) fire for JSON input too. A hand-rolled
  JavaBean DTO deserializes via setters or field access — an invalid one
  can exist in memory before any validator looks at it. The record version
  cannot.
- **Component names are in the class file.** Records retain component names
  by specification, so constructor-parameter mapping needs no `-parameters`
  compiler flag and no `@JsonProperty` on every component — those are only
  for *renames* (`@JsonProperty("customer_id") String customerId`).

Bean Validation composes: `record CreateOrderRequest(@NotBlank String
customerId, @Size(min = 1) List<LineItem> items)` — annotations on record
components propagate to the right targets by spec. Keep hard invariants
("amount is never negative, ever") in the compact constructor and use
annotation validation for the *reportable* rules a 400 response should
enumerate; the constructor is the last line of defence, not the error UX.

## The phase-gate example: `Money`, `HashSet`-safe

The gate asks for a `Money` that cannot exist invalid and behaves in hash
collections. Everything it needs was assembled across this phase:

```java
public record Money(BigDecimal amount, Currency currency) {
    public Money {
        Objects.requireNonNull(amount, "amount");
        Objects.requireNonNull(currency, "currency");
        if (amount.signum() < 0) throw new IllegalArgumentException("negative: " + amount);
        amount = amount.setScale(currency.getDefaultFractionDigits(),
                                 RoundingMode.HALF_EVEN);   // normalize scale
    }
    public Money plus(Money other) {
        if (!currency.equals(other.currency))
            throw new IllegalArgumentException(currency + " + " + other.currency);
        return new Money(amount.add(other.amount), currency);
    }
}
```

The scale normalization is the subtle half: `new BigDecimal("1.5")` and
`new BigDecimal("1.50")` are `compareTo`-equal but not `equals`-equal, so
without normalization two "equal" `Money` values land in different
`HashSet` buckets — the trap documented in
[topic 06 chunk 2](../06-equals-hashcode/02-implementing-it-right.md).
Normalizing in the constructor means the generated `equals`/`hashCode` are
simply *correct*, everywhere, with no override.

Note the "wither" style: records have no setters, so evolution methods
(`plus`, `withCouponCode(...)`) return new instances — and because they
call the canonical constructor, they re-validate for free.

## Records vs Lombok vs JavaBeans

| | JavaBean (hand-written) | Lombok `@Value`/`@Data` | record |
|---|---|---|---|
| Boilerplate | all of it, by hand | annotation-generated | language-generated |
| `equals`/`hashCode` drift on field add | likely | no | impossible |
| Immutability | discipline | `@Value` yes, `@Data` no | fields final by construction |
| Tooling/debugger view | plain class | *generated* code — stack traces and coverage on lines you never wrote | specified by the JLS; every tool understands it |
| Extra dependency | none | annotation processor, IDE plugin, version coupling with the JDK | none |
| Semantic claim to readers | none | "less typing" | **"this is transparent immutable data"** — a statement the compiler enforces |

The honest summary: Lombok solved a real problem in 2010-era Java, and in
codebases already carrying it, `@Builder` still covers the many-optional-
fields case records handle awkwardly. For *new* data carriers on 17+, a
record is the same win with no dependency, no processor magic, and a
stronger contract. Migrating `@Value` classes to records is usually
mechanical; migrating `@Data` (mutable) classes is a design change, not a
rename.

## When *not* a record

- **JPA entities.** The spec requires a no-arg constructor and non-final
  fields/class for proxying and lazy loading; entities have *mutable
  identity* (same row, changing state) — the exact opposite of a record's
  value semantics. Records fit persistence as **embeddables** (Hibernate
  6.2+ maps `record Address(...)` as `@Embeddable`), **projections**
  (Spring Data derives constructor projections from records), and query
  DTOs — the read side, not the managed-entity side.
- **Mutable identity in general.** Anything whose `equals` should be an ID
  while state evolves ([topic 06 chunk 3](../06-equals-hashcode/03-where-it-breaks-in-production.md))
  is a class with ID-based equality, not a record.
- **Many optional components.** A record with nine components, six
  nullable, makes every call site read like `new Config(a, null, null, d,
  null, ...)`. Either split the type (often the real fix) or pair the
  record with a small hand-written builder / static factories.
- **Frameworks that mutate.** Anything instantiating via no-arg constructor
  plus setters (older binding layers, some config mappers) predates
  records; check the framework version before converting the type it binds.

## Deconstruction at the use sites

Record patterns (JEP 440) make consuming these types read like the data
they are — including nested shapes:

```java
return switch (result) {
    case Approved(String code, Money(var amt, var cur)) ->
        "captured %s %s (%s)".formatted(amt, cur, code);
    case Declined(var reason, var msg) -> "declined: " + reason;
    case Failed(var cause, true)       -> "transient: " + cause.getMessage();
    case Failed(var cause, false)      -> "permanent: " + cause.getMessage();
};
```

The full pattern story — sealing, exhaustiveness, guards — is
[topic 09](../09-sealed-adts.md); the point here is that records are its
raw material: the more of your domain travels as records, the more of your
control flow the compiler can check.

## Gotchas

**Symptom:** Jackson throws `InvalidDefinitionException: cannot construct instance` for a record
**Cause:** jackson-databind older than 2.12, or a shaded/managed older version winning dependency resolution
**Fix:** upgrade databind; check `mvn dependency:tree` — record support is version-gated, not configurable

**Symptom:** JSON field `customer_id` arrives `null` in component `customerId`
**Cause:** name mismatch — records fix parameter *names*, not naming *strategies*
**Fix:** `@JsonProperty("customer_id")` on the component, or a global `PropertyNamingStrategies.SNAKE_CASE`

**Symptom:** `@NotNull` on a record component "does nothing"
**Cause:** validation annotations only fire where a `Validator` runs (web layer `@Valid`, method validation) — declaring them is not enforcement
**Fix:** keep `@Valid` at the binding site; duplicate genuinely critical invariants in the compact constructor, which needs no framework to fire

**Symptom:** `Money` deserialized from a trusted internal queue skipped validation
**Cause:** it didn't — but only because it's a record; if the producer used Java serialization on a *class*, readObject bypasses constructors
**Fix:** records are the fix: Java serialization of records is *specified* to go through the canonical constructor, closing the classic deserialization-bypasses-invariants hole

**Symptom:** entity converted to a record; Hibernate fails at bootstrap or lazy loading silently breaks
**Cause:** entities need proxyability (non-final) and a no-arg constructor; records are final with no such constructor, and identity semantics conflict with value equality
**Fix:** entities stay classes; use records for embeddables, projections, and DTOs at the boundary

**Symptom:** two config records differ only in a `Map` component's iteration order — tests flake on `equals`
**Cause:** component type is `HashMap`-backed; `Map.equals` is order-insensitive but the *test fixture* compared `toString`
**Fix:** assert on the record's `equals`, not its string form; `toString` output order is not a contract

**Symptom:** a "record with a builder" has drifted — builder sets 8 of 9 components, one silently defaults wrong
**Cause:** hand-written builder duplicates the component list without compiler help
**Fix:** have `build()` call the canonical constructor and keep all defaulting in one place there; better, ask whether the 9-component record should be two types

**Symptom:** converting a Lombok `@Data` class to a record broke callers everywhere
**Cause:** `@Data` classes are mutable with `getX()`/`setX()`; records are immutable with `x()` — this is an API redesign wearing a rename's clothes
**Fix:** migrate `@Value` classes mechanically; for `@Data`, first decide the type *should* be immutable, then update call sites to wither-style copies

## Interview questions

**★ Why is a record DTO safer than a JavaBean DTO for request binding?**
Deserialization funnels through the canonical constructor, so compact-
constructor validation and defensive copies run on every instance including
JSON-born ones. Bean binding via setters/fields can materialize invalid
half-built objects that no constructor ever saw.

**★ Why are records a poor fit for JPA entities but a good fit for projections?**
Entities: mutable identity, proxy/lazy-loading machinery needing non-final
types and no-arg constructors — all contradict records. Projections and
embeddables are read-shaped value data — exactly a record's contract.

**★ Records vs Lombok — what's the argument beyond "no dependency"?**
A record is a *semantic claim* the compiler enforces (transparent, immutable,
final) and every tool understands, because it's in the JLS. Lombok is code
generation: same keystrokes saved, but the guarantees are conventions, the
tooling needs plugins, and `@Data` quietly permits mutation.

**★ How does Java serialization treat records differently from classes, and why does it matter?**
Class deserialization bypasses constructors (the historical invariant-bypass
vulnerability); record deserialization is specified to call the canonical
constructor with the stream's component values. Invariants hold even for
hostile streams — records are the recommended shape for anything
serialization-adjacent.

**★ Where does `Money`'s `HashSet` safety actually come from?**
Constructor-side normalization: scale fixed with `setScale` before fields
assign, so `BigDecimal`'s scale-sensitive `equals` never sees `1.5` vs
`1.50`. Generated `equals`/`hashCode` then agree everywhere, with no
overrides to maintain.

**When would you still write a builder, and how do you keep it honest?**
Many components with real optionality that genuinely belong in one type.
Keep it honest by making `build()` delegate to the canonical constructor so
validation/normalization stay single-sourced — the builder is UX, never a
second construction path.

**A teammate proposes converting every DTO *and* entity to records for consistency. Your review?**
DTOs, value objects, keys: yes. Entities: no — identity + mutability +
proxying are structural mismatches. Consistency of *principle* (records for
values, classes for identities) beats consistency of syntax.

---

← Prev: [The feature](01-the-feature.md) · Index: [Records](README.md)
