---
title: "A common-domain jar cancels every service boundary in the system at compile time, because a change to a shared type is a coordinated release of everything that depends on it — the network boundary remains and the independence it was for is gone"
sidebar_label: "16 · The shared model jar"
sidebar_position: 27
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *Dark matter force: minimize design-time
> coupling*
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-design-time-coupling.html)),
> which defines design-time coupling as *"the likelihood that they need to change together
> for the same reason"* and notes that tight coupling creates expensive lockstep changes; the
> ddd-crew *Context Mapping* material on Shared Kernel
> ([github.com/ddd-crew](https://github.com/ddd-crew/context-mapping)); Eric Evans,
> *Domain-Driven Design* (2003), Ch. 14, cited by concept.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Every organisation that splits a Java monolith arrives at the same idea within about three
months: the services all need `Customer`, `Order`, `Money` and `Address`, so put them in a
shared library and depend on it. It is proposed by good engineers, it removes visible
duplication, and it reconstructs the monolith at compile time. The services still deploy
separately and they can no longer change separately, which is the worst available
combination — you keep the network's failure modes and lose the independence you bought them
for.**

## The mechanism

`common-domain-1.4.0.jar` contains `Order`. Six services depend on it.

Sales needs a new field on `Order`. It bumps the jar to `1.5.0`. Now:

- Six services must eventually move to `1.5.0`, or the codebase has two definitions of
  `Order` in production and everyone must know which service is on which.
- If the change is anything other than an addition — a rename, a type change, a validation
  rule — the six must move *together*, because the wire format they serialise changes with
  it.
- Any service that cannot move — because it is frozen, or its team is mid-quarter, or it
  depends transitively on `1.3.0` through another shared jar — blocks the change.

That is design-time coupling of one across all six pairs. The definition again: *"the
likelihood that they need to change together for the same reason"*. The jar makes the answer
"always".

The failure is quiet, which is what makes it dangerous. Nothing breaks on the day the jar is
introduced. It breaks the first time a change is urgent.

## The three things people put in the jar, ranked by damage

**Domain entities and aggregates — catastrophic.** `Order`, `Customer`, `Product`. These are
each context's own model, and sharing them means the contexts have one model, which means
there are no contexts. The polysemy in [02b · The same word, two
meanings](02b-the-same-word-two-meanings.md) says these types *should* differ per context;
the jar forces them to be identical, so every context's needs accumulate in one class and
each service ignores the fields it does not use.

**API DTOs — bad, and defensible in exactly one direction.** A jar containing the request and
response types for a service's API. Damaging when it is *shared* — a consumer that compiles
against the provider's DTO class cannot tolerate a field it does not know about, and the
tolerant-reader principle is defeated at compile time. Defensible when the provider publishes
a **client** library that it owns and versions, and consumers may skip versions. The
difference is who owns the artefact and whether consumers can lag; the shape of the code is
identical. Contract evolution is **05 · Inter-service REST** *(not written yet)*'s subject.

**Small immutable values and utilities — usually fine.** `Money`, `CountryCode`, `Sku`,
`Currency`, a `Result` type, a correlation-id holder. They change rarely, they carry no
business decision, and if they do change everyone genuinely does want the change. This is a
legitimate shared kernel — with the rules in [33 · Shared kernel](33-shared-kernel.md).

## The test

Before anything goes in a shared library, ask:

> **If this type changes, must every dependant change?** If yes, they are one deployable unit
> and the boundaries between them are decorative.

Followed by:

> **Does this type contain a business decision?** Anything with a conditional that encodes a
> rule — `canBeCancelled()`, `isEligibleForFreeShipping()`, a validation that a specific
> department owns — belongs to exactly one context. Shipping it in a jar means the rule is
> versioned by build tooling rather than owned by a service.

`Money.plus` is arithmetic. `Money.applyDiscount` is a decision. The first is shareable and
the second is not, and they will end up in the same class unless somebody watches.

## What to do instead: duplicate the shape, share nothing else

```java
// service: retailer-sales
package com.retailer.sales;

/// Sales' Order. Sales owns it, changes it whenever it likes, and nobody else compiles
/// against it.
public final class Order { /* Sales' fields, Sales' rules */ }
```

```java
// service: retailer-fulfilment
package com.retailer.fulfilment;

/// Fulfilment's own model of the same real-world thing, containing only what Fulfilment
/// needs and enforcing only Fulfilment's rules. It is not a subset of Sales' Order and
/// it is not generated from it.
public final class Shipment { /* Fulfilment's fields, Fulfilment's rules */ }
```

```java
// service: retailer-fulfilment — the translation, owned by the consumer
package com.retailer.fulfilment.internal.acl;

import com.retailer.fulfilment.*;

/// Fulfilment's anticorruption layer. It reads the wire representation — a Jackson-bound
/// record or a generated client type — and produces Fulfilment's own model. When Sales
/// adds a field, this class ignores it and nothing else in Fulfilment changes.
final class SalesOrderTranslator {

    Shipment toShipment(SalesOrderPayload payload) {
        var pickLines = payload.lines().stream()
                .filter(line -> "PHYSICAL".equals(line.fulfilmentType()))
                .map(line -> new PickLine(new Sku(line.sku()), line.quantity()))
                .toList();
        return Shipment.forSalesOrder(
                new SalesOrderRef(payload.orderNumber()),
                Address.parse(payload.deliveryAddress()),
                pickLines);
    }
}
```

The duplication is real and it is the point. Two types that look similar and change for
different reasons are not duplication in the sense that matters; duplication that hurts is
duplicated *rules*, and there is none here — Sales owns cancellation policy, Fulfilment owns
pickability.

## The Maven shape that makes the boundary visible

If a shared library exists at all, it should be small, named honestly, and impossible to
extend accidentally:

```xml
<!-- retailer-shared-values/pom.xml -->
<project>
  <artifactId>retailer-shared-values</artifactId>
  <version>2.0.1</version>
  <description>
    Immutable values with no business rules: Money, Sku, CountryCode, CustomerId.
    NOTHING with a conditional that encodes a business decision may be added here.
    Owner: platform. Adding a type requires review by the architecture group.
  </description>
  <dependencies/>   <!-- deliberately empty: no Spring, no Jackson, no JPA -->
</project>
```

The empty `<dependencies>` is the strongest available constraint. A values library with no
framework dependencies cannot contain a JPA entity, a Spring component or a Jackson-annotated
DTO, so the categories of thing that cause the damage are excluded by construction rather
than by policy.

An ArchUnit rule enforces the other half:

```java
@ArchTest
static final ArchRule shared_values_hold_no_rules = noClasses()
        .that().resideInAPackage("com.retailer.shared..")
        .should().dependOnClassesThat().resideInAnyPackage(
                "com.retailer.sales..", "com.retailer.pricing..",
                "com.retailer.inventory..", "com.retailer.fulfilment..");
```

A shared type that depends on a context is a rule that escaped.

## Gotchas

**★ Symptom: a release note that says "upgrade common-domain to 1.5.0 in all services".**
Cause: the jar is the boundary. Fix: that sentence is the definition of a lockstep release;
whatever the diagram says, those services are one deployable unit.

**★ Symptom: a shared type with fields that only one service uses.** Cause: accretion — each
context added what it needed. Fix: split it per context. The presence of unused fields is
proof the contexts model the thing differently, which is the argument against sharing.

**★ Symptom: a service pinned to an old version of the shared jar.** Cause: it could not
afford to move. Fix: this is the coupling becoming visible; the pin is a fork in slow motion,
and it will eventually be resolved by someone doing a large risky upgrade under pressure.

**★ Putting JPA entities in a shared jar.** Now the database schema is shared too, because
the mapping is. This is the shared-database anti-pattern arriving through the build system,
and it is harder to see than a direct table read.

**★ Symptom: a `common` module that grows monotonically.** Cause: no owner and no admission
criteria. Fix: an explicit owner, a written rule (no business decisions, no framework
dependencies), and review on every addition. Without all three it grows, because adding to it
is always the locally cheapest option.

**★ Treating a provider-published client library as the same thing.** It is not, provided the
provider owns it, versions it, and consumers may lag. The danger is a library *shared between
peers*, where nobody owns it and everyone must move together.

**★ Sharing test fixtures or builders across services.** The same mechanism with less
visibility: a change to a shared test builder breaks other teams' builds, and now your test
code has the coupling your production code avoided.

## Interview questions

**★ What is wrong with a shared domain library across microservices?**
It reintroduces design-time coupling — the likelihood that components must change together
for the same reason — at compile time, which is exactly what the split was supposed to remove.
The services still deploy separately, so you keep the network's failure modes, but a change to
a shared type is a coordinated upgrade across every dependant, so you lose the independence.
It is also evidence that the contexts have not been separated: if six services genuinely need
the same `Order` class, they are modelling one thing the same way, which means there is one
context, not six.

**★ Is anything safe to share?**
Small immutable values with no business decisions — `Money`, `Sku`, `CountryCode`, an
identifier type — and cross-cutting utilities like a correlation-id holder. They change rarely
and when they do everyone genuinely wants the change, which is the definition of a legitimate
shared kernel. Two safeguards make it stick: an explicit owner with admission criteria, and a
build constraint that makes the dangerous categories impossible — a values module with no
Spring, JPA or Jackson dependency cannot contain an entity, a component or a DTO.

**★ How do you tell a shared kernel from a shared model jar?**
By what changes when the business changes. A shared kernel contains things that are not about
your business at all — money arithmetic, country codes, identifier formats — so a business
rule change never touches it. A shared model jar contains your business, so every business
change is a jar release and a coordinated upgrade. The practical probe: look at the jar's
commit history and ask, for each change, which department requested it. If the answers are
department names, it is a shared model.

**★ Is duplicating the model across services not just duplication?**
It duplicates shape and not rules, and only duplicated rules cost you. Two `Order`-ish types
in two contexts look similar today and diverge tomorrow, because they change for different
reasons — Sales' order acquires a gift-message field, Fulfilment's shipment acquires a hazard
classification, and neither cares about the other's. Sharing one class forces both sets of
concerns into it and makes every change a joint decision. The duplication people should worry
about is two services both deciding whether an order can be cancelled.

**★ A team proposes putting the API DTOs in a shared jar so the client and server cannot
drift. What is your response?**
That preventing drift is the problem, not the goal. A consumer compiling against the
provider's DTO class cannot be a tolerant reader — an unknown field becomes a compile or
deserialisation concern rather than something to ignore — so the provider loses the ability to
add fields freely, which is the cheapest kind of API evolution there is. The acceptable form
is a client library that the *provider* owns and versions, which consumers may lag behind by
several versions. The unacceptable form is a jar shared between peers with no owner, where
everybody must move at once.

---

← [Too small](15-too-small.md) · [Topic index](README.md) · Next → [The god service](17-the-god-service.md)
