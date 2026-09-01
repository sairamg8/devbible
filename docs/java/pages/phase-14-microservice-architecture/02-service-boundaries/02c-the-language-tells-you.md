---
title: "Before you draw anything, read your own code out loud — qualifier creep, translation methods and a glossary that needs footnotes are boundaries the codebase has already discovered for you"
sidebar_label: "04 · The language tells you"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Martin Fowler, *BoundedContext*
> ([martinfowler.com](https://martinfowler.com/bliki/BoundedContext.html)); Eric Evans,
> *Domain-Driven Design* (2003), Ch. 2 "Ubiquitous Language", cited by concept;
> microservices.io *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Boundary discovery is usually presented as a workshop with sticky notes. It is often
faster to read the code you already have, because a codebase that has been fighting a
missing boundary leaves a specific and recognisable set of scars: names that need
qualifiers, methods that translate one shape to another, mappers that exist for no
persistence reason, and a domain glossary where half the entries say "in this context…".
This chunk is a list of those scars and what each one tells you.**

## Scar 1 — qualifier creep

The tell: a noun that can never be used bare.

```java
OrderDto toOrderForShipping(Order order);
OrderView toOrderAsBilled(Order order);
OrderSummary toOrderForSupport(Order order);
```

If your codebase contains `orderForShipping`, `orderAsBilled` and `orderForSupport`, the
qualifiers are not naming conventions. They are the names of the contexts, written by
developers who needed to disambiguate and had no boundary to hang the disambiguation on.
Each qualifier is a context asking to exist.

The correction is not to rename these into a tidier scheme. It is to notice that
`OrderForShipping` has a natural home where it would be called simply `Shipment`, and that
in that home it would have behaviour rather than being a bag of fields.

**Threshold worth using:** two qualifiers is a coincidence; three is a boundary. A concept
with three distinct qualified forms in one package has three audiences, and the package
containing all three is doing three jobs.

## Scar 2 — the mapper that maps nothing structural

Persistence mappers are ordinary: an entity to a row, an aggregate to a document. Those
exist because of storage technology and say nothing about boundaries.

The interesting mapper is the one that converts between two *domain* shapes with no
technology in between:

```java
@Component
class OrderTranslator {

    /// Fulfilment's view of a sales order. Notice what this method is doing: it is
    /// deciding, on Fulfilment's behalf, what a sales order means. That decision belongs
    /// to somebody. Right now it belongs to whoever last edited this file.
    ShippableOrder toShippable(Order order) {
        var lines = order.lines().stream()
                .filter(line -> line.fulfilmentType() == FulfilmentType.PHYSICAL)
                .map(line -> new PickLine(line.sku(), line.quantity()))
                .toList();
        var address = order.deliveryAddress() != null
                ? order.deliveryAddress()
                : order.billingAddress();          // a business rule, hidden in a mapper
        return new ShippableOrder(order.id(), lines, address);
    }
}
```

The `filter` and the address fallback are business rules. They are Fulfilment's rules, sat
in a class that neither Sales nor Fulfilment owns. That class is an anticorruption layer
that has not been given a name or a home. Give it one — see
[29 · Anticorruption layer](29-anticorruption-layer.md) — and the boundary becomes explicit
without moving a single service.

## Scar 3 — the glossary with footnotes

Ask for the team's domain glossary. If it exists at all, look for entries of this form:

> **Reservation** — a hold on stock for a specific order. *Note: in the pricing module,
> "reservation" refers to a held promotional allocation and is unrelated.*

That footnote is a bounded context, documented, and then ignored by the code. Every
footnote of the form "in the X module this means Y instead" is an edge that exists in the
language, is known to the team, and has not been given a boundary. These are the cheapest
boundaries to draw, because the disagreement is already agreed.

## Scar 4 — a class that imports across the whole codebase

Run the import census. The type imported by every package is either a genuinely shared
value (`Money`, `Instant`) or a context that has leaked everywhere.

```bash
# Which of our own types are imported from the most distinct packages?
grep -rho '^import com\.retailer\.[a-z.]*\.[A-Z][A-Za-z]*;' src/main/java \
  | sort | uniq -c | sort -rn | head -40
```

That command reports counts; interpret them yourself rather than trusting a threshold. What
you are looking for is a *domain* type — one with behaviour and business rules — appearing
near the top. A `Money` at the top is expected. An `Order` at the top means every context
knows Sales' internal model, and there is no boundary anywhere near Sales.

## Scar 5 — the enum everyone must switch on

Covered in detail in [02b · The same word, two
meanings](02b-the-same-word-two-meanings.md). The short form: a status enum with values
that most consumers must ignore is several contexts sharing one type.

## Scar 6 — methods named after another department

```java
class Order {
    void markAsPickedByWarehouse() { }
    void applyFinanceApprovedDiscount() { }
    void flagForComplianceReview() { }
}
```

When a class's methods name other departments, those departments' rules have been imported
into it. Each of those methods contains, or should contain, a rule the naming department
owns. `markAsPickedByWarehouse` is a state transition triggered by an event from
Fulfilment; `applyFinanceApprovedDiscount` has a Finance-owned rule about what counts as
approved. The class is a meeting room, and the boundary is somewhere in the middle of it.

## Scar 7 — the "and" in a class or service name

`CustomerAndAccountService`, `OrderProcessingAndNotificationHandler`. This is a well-worn
smell but it earns its place here because at service scale it is decisive: a service whose
one-line description needs an "and" fails the *one service, one capability* test in
[05 · One service, one capability](05-one-service-one-capability.md). At class scale it is
a refactoring; at service scale it is a boundary error you will pay for with every release.

## Scar 8 — the field nobody can define

Pick the three most-used fields on your central entity and ask four people what each means,
individually. A `customer.type` where four people give four answers is a field carrying
several contexts' distinctions in one column. Usually it started as two values and grew a
tail of special cases, each added for a different department.

## Scar 9 — a comment that says "do not use this from X"

```java
/// NOTE: do not call this from the reporting module — it triggers the recalculation
/// side effect and reporting must not mutate.
public Money recalculateTotal() { ... }
```

A comment restricting a caller is a boundary that the compiler could enforce and does not.
Java gives you three real enforcement mechanisms — package-private visibility, Spring
Modulith's internal packages, and JPMS — and a comment is none of them. See
[26 · ArchUnit rules](26-archunit-rules.md) and [34 · Verifying the
boundary](25-verifying-the-boundary.md).

## Scar 10 — a "utils" or "common" package with domain logic in it

`com.retailer.common` containing `OrderUtils.canBeCancelled(Order)` is a rule that has been
homeless long enough to be filed under "common". Rules do not belong to everyone; they
belong to whoever answers for them. A common package full of domain predicates is a list of
decisions with no owner, and it is usually the single densest source of evidence about
missing contexts in a legacy codebase.

## How to run this as a two-hour exercise

1. List every domain noun used in more than one top-level package.
2. For each, write the definition each package's code implies — from the fields it reads
   and the rules it enforces, not from the class comment.
3. Mark every noun where two definitions differ. Those are candidate context edges.
4. For each candidate, find the code that currently translates between the two
   definitions. It exists; it is usually in a mapper, a service method, or a `switch`.
5. That translation code, plus the two definitions, is your boundary and its
   anticorruption layer, already written. You are naming it, not inventing it.

Nothing in that exercise requires a workshop, a facilitator, or agreement from anyone. It
produces a boundary hypothesis grounded in the code that exists, which is a considerably
better starting point than a whiteboard — see [18 · Boundaries from a
whiteboard](18-boundaries-from-a-whiteboard.md).

## Gotchas

**★ Symptom: the exercise produces thirty candidate contexts.** Cause: you counted every
naming inconsistency as a polysemy. Fix: keep only the nouns where the two definitions have
*different rules or different cardinality*, not merely different fields. A `Customer` with
an extra column in one place is a projection; a `Customer` that one place says can exist
without an email and another says cannot is a context.

**★ Mistaking a DTO for a context.** Every REST endpoint has a response DTO, and it is
shaped for a screen, not for a domain. A hundred DTOs is not a hundred contexts. Look for
translations that encode *rules*, not translations that drop fields.

**★ Reading intent from names alone.** Names lie, especially old ones. `LegacyOrder` may be
the current model and `Order` the abandoned rewrite. Confirm each definition against what
the code actually enforces before treating a name as evidence.

**★ Running the census on generated or vendor code.** Import counts across a codebase that
includes generated OpenAPI clients or a large vendor SDK will be dominated by noise. Scope
the census to your own root package, as the command above does.

**★ Treating "utils" as a refactoring problem.** Moving `OrderUtils.canBeCancelled` into
`Order` is the right first step, but it is not the finding. The finding is that a rule had
no owner for long enough to be filed under "common", which means the boundary around that
rule was never drawn. Fix the rule's home, then ask why it was homeless.

**★ Doing this once.** Language scars accumulate continuously. The census is worth a
calendar entry, because the new qualifier that appeared in the last quarter is the earliest
signal you will get that a context is splitting.

## Interview questions

**★ You join a team with a 400,000-line service and are asked whether it should be split.
What do you look at first, and why not the architecture diagram?**
The diagram records what someone intended; the code records what happened. I would start
with the language scars: qualified names, domain-to-domain mappers, the glossary's
footnotes, the shared status enums, and the import census for domain types. Those are
evidence, they take hours rather than weeks, and they point at edges the team has already
been working around. Then I would corroborate with change history — which packages actually
change together — before proposing anything, because language evidence tells you where the
concepts differ and change evidence tells you whether that difference costs anything.

**★ Why is a mapper between two domain models a stronger signal than a mapper between a
domain model and a DTO?**
Because a domain-to-DTO mapper is explained by the transport — the wire format is different
from the in-memory format for reasons that have nothing to do with the business. A
domain-to-domain mapper has no such excuse: something is converting one understanding of a
concept into another understanding, which means two understandings exist. The rules
embedded in that conversion — the filters, the defaults, the fallbacks — are the boundary's
translation logic, and they are usually sitting in a class that neither side owns.

**★ Is qualifier creep always a boundary, or sometimes just bad naming?**
Sometimes just bad naming, and the discriminator is whether the qualifiers correspond to
*audiences* or to *shapes*. `OrderSummary` and `OrderDetail` are shapes for one audience —
that is view modelling. `OrderForShipping`, `OrderAsBilled` and `OrderForSupport` are three
audiences with three different sets of facts they care about and three different rules they
apply. Audiences are contexts; shapes are not.

**★ What would make you decide *not* to act on a language scar you found?**
Cost and stability. If two definitions differ but the concept has not changed in three
years and no team is blocked, the boundary is real but drawing it buys nothing — the
translation is written once and never touched. I would document the scar and leave it. The
boundaries worth spending money on are the ones where the ambiguity is *currently* causing
coordinated changes or production defects, which is exactly what the change-history analysis
in [19 · Change history as evidence](19-change-history-as-evidence.md) is for.

{/* FOOTER */}
