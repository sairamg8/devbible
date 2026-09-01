---
title: "The shape of a service's API is the most reliable public evidence about whether its boundary is real: an API of nouns and four verbs cannot enforce anything, and an API of named commands cannot help but tell you what the service is for"
sidebar_label: "21 · CRUD is not a capability"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Michael Nygard, *The Entity Service Antipattern* (2017)
> ([michaelnygard.com](https://www.michaelnygard.com/blog/2017/12/the-entity-service-antipattern/));
> microservices.io *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html));
> Vaughn Vernon, *Effective Aggregate Design, Part I* (2011)
> ([dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/), CC BY-ND 3.0), on
> commands versus queries on an aggregate.
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**You can usually judge a service boundary without seeing the code, from the API alone. A
`PUT /orders/{id}` that accepts the whole order tells you the service cannot enforce a state
machine, because the caller is allowed to set any field to any value. A
`POST /orders/{id}/cancellation` with a reason tells you the service owns a decision. This
chunk is about reading that evidence, and about the specific damage a full-replacement update
does to a boundary — because it is not a style preference, it is a transfer of authority from
the service to its callers.**

## What `PUT` of a whole resource actually concedes

Consider the two ways to express "this order was cancelled".

```java
// Concedes everything.
@PutMapping("/orders/{id}")
OrderDto replace(@PathVariable String id, @RequestBody OrderDto order) { ... }
```

The caller sends a complete order with `status = "CANCELLED"`. For this endpoint to be safe
the service must:

- reject transitions the state machine forbids, by comparing every field to the stored
  version;
- decide which fields the caller is allowed to change at all, per role, per state;
- work out *what the caller meant*, because "status changed and cancellationReason appeared"
  has to be reverse-engineered into an intent.

Almost nobody writes that. What gets written is a save, and from that moment the order's
state machine is advisory — any caller can move an order to any state, and the rule that
"only a placed order may be cancelled" exists in whichever callers remembered it.

```java
// Concedes nothing.
@PostMapping("/orders/{id}/cancellation")
ResponseEntity<CancellationDto> cancel(@PathVariable OrderId id,
                                       @RequestBody CancelOrderRequest request) { ... }
```

The intent is named. The service consults its own state, applies its own rule, and refuses
if the rule says no. The caller cannot express an invalid transition, because there is no
field to set.

## The full contrast

```java
package com.retailer.sales.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/// Every endpoint is a decision the service owns. A reader of this interface knows what
/// Sales is for, and a caller cannot bypass a rule because there is no endpoint that
/// lets them set state directly.
@RestController
@RequestMapping("/orders")
public class OrderController {

    private final OrderPlacement placement;

    OrderController(OrderPlacement placement) {
        this.placement = placement;
    }

    @PostMapping
    ResponseEntity<OrderAcceptedDto> place(@RequestBody PlaceOrderRequest request) {
        var id = placement.place(request.toCommand());
        return ResponseEntity.accepted().body(new OrderAcceptedDto(id.value()));
    }

    /// Cancellation is a business operation with a rule and a reason, not a field write.
    @PostMapping("/{id}/cancellation")
    ResponseEntity<Void> cancel(@PathVariable OrderId id,
                                @RequestBody CancelOrderRequest request) {
        placement.cancel(id, request.reason());
        return ResponseEntity.noContent().build();
    }

    /// Changing a delivery address after placement is a distinct operation with a
    /// distinct rule — it is refused once the shipment is picked. That rule is
    /// expressible only because the operation is named.
    @PostMapping("/{id}/delivery-address-changes")
    ResponseEntity<Void> changeDeliveryAddress(@PathVariable OrderId id,
                                               @RequestBody ChangeAddressRequest request) {
        placement.changeDeliveryAddress(id, request.address());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    OrderDto get(@PathVariable OrderId id) {
        return placement.find(id).map(OrderDto::from).orElseThrow(OrderNotFound::new);
    }
}
```

Read the endpoint list on its own: place, cancel, change delivery address. That is the
capability, legible from outside, without documentation. Compare with `GET`, `POST`, `PUT`,
`DELETE` on `/orders`, which tells a reader that orders are stored here and nothing else.

## The anaemic model is the same problem one layer in

An entity with only getters and setters is a service with only CRUD, at class scope: the
rules cannot live there because there is nowhere for them to live, so they migrate to a
"service" class, and from there to callers.

```java
// Anaemic: every rule about an order must be enforced by whoever holds one.
public class Order {
    private OrderStatus status;
    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus status) { this.status = status; }
}
```

```java
// Behavioural: the rule cannot be bypassed, because there is no setter to bypass it with.
public final class Order {

    private OrderStatus status;

    public Cancellation cancel(CancellationReason reason, Clock clock) {
        if (!status.allowsCancellation()) {
            throw new IllegalOrderTransition(status, OrderStatus.CANCELLED);
        }
        this.status = OrderStatus.CANCELLED;
        return new Cancellation(reason, clock.instant());
    }
}
```

The link to boundaries is direct: an anaemic model cannot be moved behind a network boundary
without its rules, because it has none. The refactor from anaemic to behavioural is the
preparation for a split, and it can be done entirely in-process before any boundary is drawn.

## The API tells you where the rules are — a checklist

Given only an API, three questions locate the rules:

**1. Can any endpoint return a business-reason failure?**
`409 Conflict` because the order was already dispatched, `422` because the discount would
breach the margin floor. If the only failures are `400` (malformed) and `404` (missing), the
service holds no rules.

**2. Can the caller set state directly?**
Any endpoint accepting a status, a flag or a computed total as input has handed the rule to
the caller. A price submitted by the client rather than computed by Pricing is the classic:
the rule "which price applies" now lives in every client.

**3. Is there an endpoint per intent, or an endpoint per table?**
Endpoints named after operations (`/cancellation`, `/dispatch`, `/price-quotes`) are
decisions. Endpoints named after resources with four verbs are storage.

## Concurrency: the second thing full replacement destroys

Full-object updates also make optimistic concurrency the caller's problem. Two clients read
an order, both change different fields, both `PUT` — last write wins and one change vanishes
silently. Named operations avoid this by construction, because each carries only the field it
is about, and the service applies its own version check:

```java
/// The command carries the version the caller believed it was acting on. The service
/// refuses if the world moved, and the refusal is a 409 the caller can handle
/// meaningfully — because it knows what it was trying to do.
public record ChangeAddressRequest(Address address, long expectedVersion) { }
```

This matters for boundaries because a service that cannot detect concurrent modification
cannot enforce an invariant under load, and an invariant that only holds under low
concurrency is not an invariant. The rule and the version check must be on the same side of
the line.

## When CRUD is honest

Configuration, content, media, saved preferences, feature flags — data with no rule other
than validity. There, a `PUT` of the whole thing is the correct API and pretending otherwise
produces ceremony with no benefit. The distinction is not the shape of the data; it is
whether anything can refuse a change for a business reason.

## Gotchas

**★ Symptom: a service with only `400` and `404` failure responses.** Cause: it enforces no
business rules. Fix: this is the fastest external test for an entity service, and it works on
an OpenAPI document with no access to the code.

**★ Symptom: the client sends the price.** Cause: pricing rules moved to the client. Fix:
the client sends what it wants to buy; the service returns what it costs. A client-supplied
price is also, separately, a security defect.

**★ Symptom: two concurrent edits and one silently disappears.** Cause: full-object
replacement with no version. Fix: named operations carrying the expected version, and a `409`
when it does not match. Retrofitting this onto a `PUT` API is hard because the caller does
not know which of the fields it sent were the ones it meant to change.

**★ Adding `PATCH` and calling it fixed.** `PATCH` with an arbitrary field map is the same
concession in a smaller envelope: the caller still names fields rather than intents, so the
service still cannot tell what was meant.

**★ Symptom: an `updateOrder` method with a twelve-field request object and a switch on
which fields are non-null.** Cause: several operations collapsed into one endpoint. Fix: they
are separate operations with separate rules; the null-check switch is the state machine,
written badly.

**★ Assuming a REST-shaped URL means resource-oriented design is wrong.** It is not; naming
an operation as a subordinate resource — `POST /orders/{id}/cancellation` — is both RESTful
and intent-revealing. The problem is never the URL style, it is whether the caller can set
state directly.

**★ Symptom: the domain object is a record with all fields public and no methods.** Cause:
anaemic model. Fix: records are excellent for values and for events; an aggregate root with
rules needs behaviour and controlled mutation, and making it a record is choosing
serialisability over enforceability.

## Interview questions

**★ How can you assess a service boundary from its API alone?**
Three questions. Can any endpoint fail for a business reason — a `409` because the order was
already dispatched, rather than only `400` and `404`? Can the caller set state directly, by
supplying a status or a price or a total? And are the endpoints named after intents or after
tables? A service whose only failures are malformed-input and not-found, which accepts full
resource replacement, and whose endpoints mirror its tables, holds no rules — which means the
rules are in its callers, duplicated, and the boundary is not doing any work.

**★ What is actually wrong with `PUT /orders/{id}` taking the whole order?**
It transfers authority to the caller. For the endpoint to be safe the service would have to
compare every field against the stored version, decide which fields this caller may change in
this state, and infer the caller's intent from the diff — and almost nobody writes that, so
what ships is a save. From then on any caller can put an order into any state, so the state
machine is advisory and lives in whichever callers remembered it. It also destroys optimistic
concurrency: two callers changing different fields both send whole objects, and one change
disappears with no error.

**★ Is an anaemic domain model a boundary problem or a code-style problem?**
Both, and the boundary consequence is the one that costs money. An entity with only getters
and setters has nowhere for rules to live, so they migrate outward — first into a "service"
class, then into callers. That means the state and the rules about it are already separated
before any network is involved, so drawing a service boundary around the state moves the
data and leaves the rules behind. The refactor from anaemic to behavioural is therefore
preparation for a split, and it is entirely in-process, which makes it cheap and reversible.

**★ Where is CRUD the right API?**
Where nothing can refuse a change for a business reason: content, media, saved preferences,
feature flags, arbitrary documents. That is essentially the definition of a generic subdomain,
and the honest thing is to say so — pretending a settings store has a domain model produces
ceremony with no enforcement behind it. The mistake is applying the same shape to a core
domain, which is made entirely of rules.

**★ A team says intent-based endpoints are "not RESTful". How do you answer?**
By pointing out that modelling an operation as a subordinate resource is standard REST:
`POST /orders/{id}/cancellation` creates a cancellation, which is a resource with an
identity, a timestamp and a reason, and is exactly the kind of thing REST is good at. The
argument is not about URL style at all — it is about whether the caller can put the system
into a state its owner would refuse. You can build an intent-based API with entirely
conventional REST URLs; you cannot build an enforceable one out of full-resource replacement.

{/* FOOTER */}
