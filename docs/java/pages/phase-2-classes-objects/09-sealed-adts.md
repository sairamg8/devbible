---
title: "Sealed types + records + switch = ADTs"
sidebar_label: "09 · Sealed types as ADTs"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against JEP 409 (Sealed Classes, finalized in 17), JEP 440
> (Record Patterns, 21), JEP 441 (Pattern Matching for switch, 21), and JLS
> SE 25 §8.1.1.2 / §9.1.1.4 (sealed and permitted subtypes) and §14.11.1
> (exhaustive switch).

**A sealed interface declares the complete list of shapes a value can take;
records give each shape its own data; `switch` proves you handled every one
of them — at compile time. That triple is Java's algebraic-data-type story,
and its practical payoff is blunt: when a new outcome is added to the
domain, every `switch` in the codebase that ignores it *stops compiling*,
instead of silently falling into a `default` branch at 2 a.m.**

## The problem this solves

Model a payment attempt's outcome. Before sealed types, the honest options
were all bad in a characteristic way:

- **A status enum plus nullable fields** — `PaymentResult{status, authCode,
  declineReason, error}` where `authCode` is meaningful only when
  `status == APPROVED`. Every consumer must know which fields go with which
  status; nothing checks that they do. Invalid combinations are
  representable, so they eventually get represented.
- **An open class hierarchy plus `instanceof` chains** — extensible by
  anyone, so no `if`/`else` chain over it can ever claim to be complete,
  and the compiler agrees: it checks nothing.
- **The visitor pattern** — exhaustiveness done manually, at the price of an
  interface, N `visit` methods, and double dispatch ceremony for every
  operation.

An ADT ("sum type") says: *a `PaymentResult` is exactly one of Approved,
Declined, or Failed — each with its own fields — and nothing else, ever.*
Java can now state all three clauses.

## The shape: one sealed interface, one record per case

```java
public sealed interface PaymentResult
        permits Approved, Declined, Failed {}

public record Approved(String authCode, BigDecimal amount) implements PaymentResult {}
public record Declined(DeclineReason reason, String processorMessage) implements PaymentResult {}
public record Failed(Exception cause, boolean retryable) implements PaymentResult {}
```

Each case carries *only its own* data — `authCode` exists exclusively on
`Approved`, so "declined payment with an auth code" is not merely invalid,
it is unrepresentable. The records bring the value semantics of
[topic 08](08-records/README.md) for free: equality, `toString` for logs,
compact-constructor validation per case.

The sealing rules (JEP 409):

- Every permitted subtype must be `final`, `sealed` (its own sub-list), or
  `non-sealed` (deliberately re-opened). Records qualify automatically —
  they are final.
- Permitted subtypes must live in the same module as the sealed type, or —
  on the classpath — the same package. The hierarchy is a *local, auditable*
  fact.
- If all subtypes sit in the same source file, `permits` can be omitted and
  is inferred. Small ADTs are often written exactly that way: one file, one
  interface, three records.

## Exhaustive switch: the compiler joins the code review

```java
String describe(PaymentResult result) {
    return switch (result) {
        case Approved(String code, BigDecimal amt) -> "approved " + amt + " (" + code + ")";
        case Declined(DeclineReason r, String msg)  -> "declined: " + r;
        case Failed(Exception e, boolean retry)     -> retry ? "retry later" : "hard failure";
    };                                              // no default — on purpose
}
```

Because `PaymentResult` is sealed, the compiler knows the case list is
complete and requires **no `default`**. That absence is the feature. Add a
fourth case — `record Pending(...) implements PaymentResult` — and this
switch, and every other one over `PaymentResult`, fails to compile with
"the switch expression does not cover all possible input values". The type
system just found every call site your new requirement affects.

The `switch` machinery itself — arrows, `yield`, expression vs statement,
`null` handling — is Phase 1's:
[the modern switch](../phase-1-language-core/08-control-flow-switch/01-the-modern-switch.md)
and [patterns, null and legacy](../phase-1-language-core/08-control-flow-switch/02-patterns-null-and-legacy.md).
This page adds what sealing contributes: the *closed-world guarantee* that
makes omitting `default` safe.

Record patterns (JEP 440) deconstruct in place — `case Approved(String
code, var amt)` binds components directly, nests
(`case Shipped(Address(var city, var zip), var eta)`), and combines with
guards: `case Failed(var e, true) when attempts < 3 -> requeue()`.

## Enum or sealed hierarchy?

Both model "one of a fixed set". The decider is whether the cases carry
**different data**:

| | `enum` | sealed interface + records |
|---|---|---|
| Cases are | a fixed set of *constants* | a fixed set of *types* |
| Per-case data | same fields for every constant | each case declares its own |
| Exhaustive `switch` | ✅ | ✅ |
| Instances | one shared instance per case | as many as you construct |
| Best for | `DayOfWeek`, `OrderStatus`, strategy tables ([topic 10](10-enums/README.md)) | results, events, commands, states-with-payload |

`DeclineReason` above is rightly an enum *inside* the ADT — the two nest
naturally. If you find an enum sprouting nullable "sometimes" fields, that
is the signal it wants to become a sealed hierarchy.

Beyond results: domain **events** (`OrderEvent = Placed | Cancelled |
Refunded`), **commands**, workflow **states** where each state has its own
payload, and recursive structures (`Json = JsonObject | JsonArray |
JsonString | ...`) all take this shape. It also retires most uses of the
visitor pattern — a `switch` with record patterns is the visitor with the
ceremony deleted.

## Gotchas

**Symptom:** adding a new case broke nothing at compile time — a bug shipped anyway
**Cause:** the switches had `default` branches, which swallow new cases silently
**Fix:** over a sealed type, omit `default`; if some cases genuinely share handling, prefer listing them (`case Declined d, Failed f ->` patterns per case) so additions still surface

**Symptom:** `MatchException` at run time from a switch that compiled clean
**Cause:** the sealed hierarchy gained a case but this switch's class was not recompiled (separate compilation — JEP 441 defines this failure)
**Fix:** rebuild dependents together; treat the exception in production as "stale binary", not a logic bug

**Symptom:** `class is not allowed to extend sealed class` from a new implementor
**Cause:** the type isn't in `permits`, or sits outside the sealed type's module/package
**Fix:** that is the seal working; add it to `permits` (and recompile the world) or reconsider whether the hierarchy should be open

**Symptom:** permitted subtype fails to compile: "sealed, non-sealed or final modifiers expected"
**Cause:** every permitted subtype must declare its own openness; a plain class qualifies for none of it
**Fix:** mark it `final` (usual), `sealed` (nested ADT), or `non-sealed` (deliberate re-opening — document why)

**Symptom:** `non-sealed` appeared and quietly killed exhaustiveness guarantees downstream
**Cause:** `non-sealed` re-opens that branch to arbitrary subclasses, so the closed-world reasoning stops at it
**Fix:** treat `non-sealed` as an API decision needing the same scrutiny as making a field public; ADT-style hierarchies should be all-final

**Symptom:** Jackson can't deserialize the sealed interface: "abstract type needs to be mapped to concrete type"
**Cause:** sealing constrains *subtyping*; it gives serializers no type tag to dispatch on
**Fix:** standard polymorphic config — `@JsonTypeInfo`/`@JsonSubTypes` on the sealed interface (the `permits` list makes the subtype list easy to keep honest)

**Symptom:** `switch` over the ADT compiles without covering every record — no error
**Cause:** switching on a *supertype pattern* (`case PaymentResult r`) or including `default`/a total `case Object o` — totality achieved a case too early
**Fix:** switch on the specific cases; keep the selector the sealed type and the patterns the leaves

## Interview questions

**★ What do sealed interfaces, records, and switch each contribute to modelling `PaymentResult = Approved | Declined | Failed`?**
Sealed: the closed case list — no fourth outcome can exist unannounced.
Records: per-case data with value semantics and constructor validation, so
each shape carries exactly its own fields. Switch: compiler-checked
exhaustiveness at every consumption site. Together they make invalid
combinations unrepresentable and missed cases uncompilable.

**★ Why is omitting `default` over a sealed type a feature, not sloppiness?**
`default` is where unknown futures go to be ignored. Without it, adding a
case turns every affected switch into a compile error — the compiler
enumerates your migration checklist. With it, new cases route into old
handling silently and become production surprises.

**★ Enum vs sealed hierarchy — the decision rule?**
Same data per case (or none) and singleton semantics → enum. Different data
per case → sealed interface with a record per case. The "enum with nullable
sometimes-fields" shape is the tell that you're on the wrong side.

**★ What are the constraints on permitted subtypes, and why?**
Each must be `final`, `sealed`, or `non-sealed`, and must be co-located with
the sealed type (same module, or same package on the classpath). The point
is auditable closure: the whole hierarchy is knowable at compile time, which
is precisely what exhaustiveness checking relies on.

**How can a pattern switch that compiled cleanly still throw `MatchException`?**
Separate compilation: the hierarchy gained a case, dependents weren't
recompiled, and at run time a value matches no case. The exception is the
JVM's "your binaries disagree" signal — fix the build, not the switch.

**Where did this leave the visitor pattern?**
Mostly retired for closed hierarchies. The visitor existed to fake
exhaustive case analysis in an open-hierarchy language; `switch` over a
sealed type does it natively, per operation, without touching the data
types or paying double-dispatch ceremony.

---

← Prev: [Records](08-records/README.md) · Index: [Phase 2 — Classes and objects](README.md) · Next → [Enums](10-enums/README.md)
