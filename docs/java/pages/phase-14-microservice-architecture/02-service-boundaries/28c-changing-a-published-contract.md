---
title: "\"Backwards-compatible\" is a word teams use without defining, which is why contracts break anyway — two of the changes that break consumers produce no schema diff at all, and the only way to make a genuinely breaking change safely is to ship both forms and delete the old one on evidence rather than on a date"
sidebar_label: "28c · Changing a published contract"
sidebar_position: 44
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design Reference* (2015), *Published
> Language*, as reproduced in the ddd-crew *Context Mapping Guide*
> ([github.com/ddd-crew/context-mapping](https://github.com/ddd-crew/context-mapping)); Martin
> Fowler, *ParallelChange*
> ([martinfowler.com](https://martinfowler.com/bliki/ParallelChange.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[28 · Published language vs aggregate](28-published-language-vs-aggregate.md) establishes that the contract is authored separately from the model. This chunk is what happens next, and it is where the real damage occurs: the contract has to change, other teams are reading it, and the team's shared definition of "backwards-compatible" turns out to be a feeling rather than a list. Two of the changes that break consumers leave the schema byte-identical — tightening a validation rule, and quietly repurposing what a field means — so no diff, no test and no schema registry will catch either. And the changes that genuinely cannot be made compatibly have exactly one safe procedure, whose difficult phase is not the one anybody plans for.**

## The compatibility rules, stated as rules

"Backwards-compatible" is the word everyone uses and almost nobody defines, which is why contracts
break anyway. For a JSON or event contract, it decomposes into a short list you can actually check in
review:

| Change | Safe? | Why |
|---|---|---|
| **Add an optional field** | ✅ | Old consumers ignore what they do not read |
| **Add a *required* field** | ❌ | Every existing producer is now emitting an invalid message |
| **Remove a field** | ❌ | Even one you believe nobody reads. You do not know that |
| **Rename a field** | ❌ | A remove and an add, wearing one commit |
| **Change a field's type** | ❌ | Including `int` → `string`, and including "it is still a number" |
| **Tighten validation** | ❌ | Yesterday's valid message is today's rejection — a breaking change with no schema diff |
| **Loosen validation** | ✅ | Nothing previously accepted stops being accepted |
| **Add an enum value** | ⚠️ | Safe for *producers* only if every consumer already tolerates unknown values. Usually they do not |
| **Change a field's meaning** | 🔴 | The worst one: no diff, no error, silently wrong data downstream |

🔴 **The last two rows are where real incidents come from**, because neither shows up as a schema
change. An enum gaining `PARTIALLY_REFUNDED` breaks every consumer whose `switch` has no default
branch, and repurposing `status` from "payment status" to "fulfilment status" produces a system that
is confidently, quietly wrong.

### Renaming a record component is a breaking change that Java will help you make

This one catches Java teams specifically, because the language makes the dangerous edit feel safe:

```java
public record OrderSummary(UUID orderId, BigDecimal totalAmount, Instant createdAt) {}
```

Rename `totalAmount` to `grandTotal` and your IDE updates every call site, the module compiles, every
test passes — and the JSON field is now `grandTotal`. **The refactor was type-safe in Java and
breaking on the wire**, because the wire contract is derived from the component names by default.

```java
// The wire name is now pinned, and decoupled from the Java identifier.
// Renaming the component is a local refactor again; changing the annotation is a contract change.
public record OrderSummary(
    @JsonProperty("orderId")     UUID orderId,
    @JsonProperty("totalAmount") BigDecimal totalAmount,
    @JsonProperty("createdAt")   Instant createdAt) {}
```

**Pin the wire names explicitly on anything published.** The annotation is noise on an internal type
and it is the whole point on a contract type — it converts a silent breaking change into a visible
one, which is the only thing you actually want from it.

## Changing a contract anyway: expand, migrate, contract

Everything above says what you cannot do to a live contract. The way you do it regardless is
Fowler's *Parallel Change*, and its three phases map exactly onto a published language:

> **Expand** — *"you augment the interface to support both the old and the new versions."*
> **Migrate** — *"you update all clients using the old version to the new version. This can be done incrementally."*
> **Contract** — *"you perform the contract phase to remove the old version and change the interface so that it only supports the new version."*

```java
// EXPAND: both fields ship. The old one is populated from the new one, and deprecated in the open.
public record OrderSummary(
    UUID orderId,
    @Deprecated BigDecimal totalAmount,     // old name, still emitted, still correct
    BigDecimal grandTotal,                  // new name
    Instant createdAt) {

    public static OrderSummary of(UUID orderId, BigDecimal amount, Instant createdAt) {
        return new OrderSummary(orderId, amount, amount, createdAt);   // one value, two names
    }
}

// MIGRATE: consumers move to grandTotal on their own schedule. You watch, you do not wait.
// CONTRACT: the component and its @Deprecated marker are deleted -- only once nobody reads it.
```

🔴 **The phase that is skipped is Migrate, and skipping it is what makes the contract phase an
outage.** The reason Fowler gives for the whole pattern is that the code should be
*"released in any of these three phases"* — so the discipline is that Expand ships alone, and
Contract does not ship until you can *show* the old field has no readers. In a monolith your compiler
tells you when that is true. Across a service boundary nothing does, which is why the evidence has to
come from somewhere else: consumer-driven contract tests, or request logging on the deprecated field.
That is **11 · Consumer-driven contract testing** *(not written yet)*'s subject, and it is the
mechanism that turns "we think nobody uses it" into a fact.

## Gotchas

**★ Symptom: a downstream service starts throwing on a field nobody changed.**
Cause: an enum gained a value. The producer's change was additive and looked safe; the consumer
deserialises into its own enum, or switches on the value with no default branch, and an unrecognised
constant is an error rather than an unknown.
Fix: treat enums in a published language as open sets on the consuming side, and say so in the
contract. Carry the value as a string at the boundary and map it, so an unknown value is data rather
than an exception:
```java
// contract type: an open set
public record OrderSummary(UUID orderId, String status, Instant createdAt) {}

// consumer: unknown values survive
OrderStatus known = OrderStatus.parse(summary.status())     // returns UNKNOWN, does not throw
    ;
```
On the producing side, adding a value is only safe once you know every consumer does this. Until
then it is a breaking change with no schema diff.

**★ Symptom: a field's meaning changed and nothing anywhere reported an error.**
Cause: `status` used to mean payment status and now means fulfilment status. Same name, same type,
same schema — every check passes and every consumer is now wrong.
Fix: never repurpose a name. Add the new field, deprecate the old one, and delete it once nobody
reads it — the expand/migrate/contract sequence above exists precisely for the changes that no
automated check can catch. A repurposed field is the one contract defect that testing does not find.

**★ Symptom: the published record was renamed in a safe IDE refactor and consumers broke.**
Cause: component names are the wire names by default, so a Java-level rename is a wire-level rename
that the compiler happily applies everywhere.
Fix: pin wire names with `@JsonProperty` on every published type. Then a rename is local and a
contract change is a visible edit to an annotation.

## Interview questions

**★ Which changes to a JSON contract are backwards-compatible, and which two break consumers without changing the schema?**
Safe: adding an optional field, and loosening validation. Breaking: removing a field, renaming one,
changing its type, and adding a *required* field. The two that break consumers with no schema diff at
all are **tightening validation** — yesterday's valid message is today's rejection, and nothing in the
contract document changed — and **repurposing a field's meaning**, which produces no error anywhere
and silently corrupts data downstream. Adding an enum value sits between: additive in the schema,
breaking for any consumer that does not already tolerate unknown values.

**★ How do you make a breaking change to a contract that other teams depend on?**
Expand, migrate, contract. Ship both the old and new form together so *"the interface supports both
the old and the new versions"*; let consumers move *"incrementally"* on their own schedule; then
remove the old form. The discipline that makes it work is that each phase is independently
releasable, and that Contract does not ship on a date — it ships when you have evidence the old form
has no readers. In-process the compiler is that evidence. Across a boundary you need consumer-driven
contract tests or request logging on the deprecated field, because "we announced the deprecation" is
not evidence.

---

← [Never publish the aggregate](28b-never-publish-the-aggregate.md) · [Topic index](README.md) · Next → [Anticorruption layer](29-anticorruption-layer.md)
