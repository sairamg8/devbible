---
title: "An HTTP response is read and discarded, so publishing your aggregate over REST couples consumers for the length of a request — publishing it to a topic materialises your internal schema inside other teams' databases, where no deployment of yours can ever reach it again"
sidebar_label: "28d · The event has a longer half-life"
sidebar_position: 49
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design Reference* (2015), *Published
> Language*, as reproduced in the ddd-crew *Context Mapping Guide*
> ([github.com/ddd-crew/context-mapping](https://github.com/ddd-crew/context-mapping)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[28b · Never publish the aggregate](28b-never-publish-the-aggregate.md) makes its case against an HTTP endpoint, and the case is real but forgiving: a response is transient, so the coupling it creates lasts exactly as long as the request. The same mistake made against a message topic is a different mistake wearing the same code. Events are stored — projected into consumers' own tables, replayed from the log months later, and reported on by people you have never met — so your internal field names stop being a coupling and become **data in somebody else's database**. There is no deployment on your side that fixes that, which changes what "be careful what you publish" means from a style preference into an irreversible decision.**

## 🔴 The hard case is not REST. It is the event.

Everything above is about an HTTP response, which is the *easy* version of this mistake, because an
HTTP response is transient. A consumer reads it, uses it, discards it. Publish the aggregate to a
topic instead and the failure changes shape entirely:

**A published event is not read and discarded — it is stored.** Consumers project it into their own
tables, replay it from the log months later, and build reports on fields you forgot you emitted. By
the time you rename a column, your internal schema is not merely *coupled* to five other services;
it is **materialised inside five other databases**, and there is no deployment you can perform that
fixes it.

```java
// The same anti-pattern, with a much longer half-life
@Transactional
public void placeOrder(PlaceOrderCommand command) {
    Order order = orderRepository.save(Order.from(command));
    events.publishEvent(order);      // 🔴 the aggregate, on the wire, forever
}
```

```java
// The event is authored, and carries only what the outside world is entitled to know
@Transactional
public void placeOrder(PlaceOrderCommand command) {
    Order order = orderRepository.save(Order.from(command));
    events.publishEvent(new OrderPlacedEvent(
        order.getId(), order.getCustomerId(), order.getTotalAmount(), Instant.now()));
}
```

**Three practical consequences, all of which follow from "stored, not transient":**

1. **You cannot un-publish a field.** Removing it from the event stops new messages carrying it and
   does nothing about the two years of history a consumer is replaying. Anything sensitive that ever
   entered an event should be treated as disclosed.
2. **Lazy loading is not merely a crash risk, it is a data-shape risk.** Serialising an aggregate
   with an uninitialised collection emits an event that is *silently incomplete* rather than one that
   fails loudly — and a consumer's projection is now missing rows nobody will notice for a quarter.
3. **The event is the one contract that survives extraction unchanged.** A REST response becomes a
   new endpoint when the module is lifted out; the event topic is already the wire format. That is
   why the `:: events` slice in [25b · Named interfaces](25b-named-interfaces.md) is the one worth
   guarding hardest.

## What "versioning an event" actually means, and why it is not versioning a REST endpoint

With HTTP you can run `/v1/orders` and `/v2/orders` side by side and retire v1 when its traffic
reaches zero. **That option does not exist for a log you replay**, because v1 messages are still in
it and a replay in 2028 will hand them to today's consumer. Event compatibility is therefore not a
transition you complete; it is a property the consumer has to hold forever.

Three strategies, and they are not equivalent:

| Strategy | What it means | What it costs |
|---|---|---|
| **Strictly additive** | Only ever add optional fields; never remove, rename or retype | Cheapest. The schema accumulates fields nobody uses, forever |
| **Versioned topic** | `orders.placed.v2` alongside `orders.placed.v1`, both produced during migration | Producers dual-write; consumers migrate on their own schedule; v1 is retired only when *no consumer will ever replay it* |
| **Upcasting on read** | Consumers hold a function per old version that transforms it into the current shape | Complexity concentrates in the consumer, which is also where it can actually be tested |

🔴 **Note the retirement condition in the middle row — it is stricter than it looks.** "No consumer
reads v1 today" is not the same as "no consumer will replay v1", and the second is the one that
matters. A topic with infinite retention is a schema you have promised to support indefinitely, and
that promise is made by a retention setting rather than by anyone's decision.

```java
// Additive done properly: the new field is optional, and old messages remain valid.
public record OrderPlacedEvent(
    UUID orderId,
    UUID customerId,
    List<OrderItemDto> items,
    BigDecimal totalAmount,
    Instant occurredAt,
    @Nullable String salesChannel) {          // added in v1.4; absent in every earlier message

    // The consumer's read path states the default, once, where it can be reviewed.
    public String salesChannelOrDefault() {
        return salesChannel == null ? "UNKNOWN" : salesChannel;
    }
}
```

⚠️ **A schema registry enforces the compatibility rule you configured; it does not choose it for
you, and it cannot see the two changes that carry no schema diff** — tightening a validation rule and
repurposing a field's meaning, both from
[28c · Changing a published contract](28c-changing-a-published-contract.md). A green registry check
is a statement about field names and types, and nothing else.

## The event is the contract that survives extraction

There is one more reason to guard the event shape harder than the REST shape, and it is a boundary
argument rather than a compatibility one.

When the module is finally lifted into its own service, **every other contract it has is re-created
in a new form.** The internal API becomes an HTTP endpoint. The in-process call becomes a client. The
package-private types stay behind. The published event, alone, is already exactly what it will be
afterwards — the same record, the same fields, the same consumers — because it was a wire format
from the day it was written.

That makes the event slice the highest-leverage thing to get right before extraction, and it is why
[25b · Named interfaces](25b-named-interfaces.md) treats `:: events` as the slice with its own
compatibility promise. Everything else about the module is provisional. The event is not.

## Gotchas

**★ Symptom: a field that was removed from the API two years ago is still in a downstream service's database.**
Cause: it was removed from an *event*, not from history. Consumers projected it into their own tables
when it was being published, and a replay re-materialises it.
Fix: for events, "remove the field" is not an operation you can perform. Plan for it in the other
direction — publish only what the outside world is entitled to know, and treat anything that has ever
been in an event as permanently disclosed. Where removal is genuinely required for compliance,
it is a coordinated deletion project across every consumer's store, not a producer-side change.

**★ Symptom: a consumer's projection is missing rows, intermittently, with no error anywhere.**
Cause: the aggregate was serialised into an event while a collection was still an uninitialised
proxy. Over HTTP that throws; into a message it can produce a **valid message with an empty array**,
which every consumer accepts.
Fix: build the event from explicit fields rather than from the aggregate, so an absent collection is
a compile error rather than an empty one:
```java
// the shape makes the omission impossible to express
new OrderPlacedEvent(order.getId(), order.getCustomerId(),
                     order.getItems().stream().map(OrderItemDto::from).toList(),
                     order.getTotalAmount(), Instant.now());
```

**★ Symptom: a consumer that was working fine breaks when the team enables log replay for a backfill.**
Cause: the consumer was written against the current event shape and has never seen a v1 message. Live
traffic never exercised the old form, so the incompatibility was invisible until the replay.
Fix: test consumers against archived messages, not only against messages the current producer emits.
If old shapes must remain readable, the transformation belongs in the consumer as an explicit
upcasting step rather than as an assumption:
```java
OrderPlacedEvent current = switch (envelope.schemaVersion()) {
    case 1 -> upcastV1(envelope.payload());     // salesChannel did not exist yet
    case 2 -> envelope.payload();
    default -> throw new IllegalStateException("Unknown schema version: " + envelope.schemaVersion());
};
```

**★ Symptom: the schema registry is green and a consumer is silently computing the wrong totals.**
Cause: the registry checks names and types. The change was `totalAmount` switching from
order-total-excluding-tax to order-total-including-tax — same name, same type, same schema, different
meaning.
Fix: a registry cannot catch this and no test on the producer side can either. The only defences are
naming that makes meaning explicit (`totalExcludingTaxMinor`) and never repurposing a field — add a
new one and deprecate the old, exactly as in
[28c · Changing a published contract](28c-changing-a-published-contract.md).

**★ Symptom: nobody can say whether a five-year-old event version can be retired.**
Cause: retirement was reasoned about as "is anyone reading it", when the question is "will anyone
ever replay it" — and topic retention, not any team's decision, decides the answer.
Fix: make the retention setting an explicit architectural decision with an owner, and record it next
to the contract. Infinite retention is a commitment to support every schema you have ever published;
that may be the right choice, but it should be a choice somebody made rather than a default nobody
revisited.

## Interview questions

**★ Why is publishing an aggregate to a message topic worse than returning it from a REST endpoint?**
Because of what the consumer does with it. An HTTP response is read and discarded, so the coupling
lasts as long as the request; an event is **stored** — projected into consumers' own tables, replayed
from the log months later, and reported on. By the time you want to rename a column, your internal
schema is materialised inside several other databases and no deployment on your side fixes it. The
same mistake, with a half-life measured in years instead of milliseconds. It is also why a field that
has ever appeared in an event should be considered permanently disclosed.

**★ Why can you not version an event topic the way you version a REST endpoint?**
Because an HTTP version is retired when its *traffic* reaches zero, and an event version is retired
only when nothing will ever *replay* it. Both `/v1` and `/v2` can run side by side and v1 disappears
once the last caller migrates; a v1 message sitting in a retained log will be handed to a consumer
during any future backfill, so the consumer must be able to read it indefinitely. That turns
compatibility from a transition you complete into a property you hold, and it means the retention
setting on the topic is quietly making an architectural commitment on your behalf.

**★ What does a schema registry actually guarantee, and what does it miss?**
It guarantees that a new schema satisfies the compatibility mode you configured — typically that
fields were not removed, renamed or retyped in a way that breaks readers. It misses everything that
is not expressible as a field name or type: a validation rule tightened on the producing side so that
previously-valid messages are now rejected, and a field whose meaning changed while its name and type
did not. Both break consumers, neither produces a schema diff, and the second corrupts data silently
rather than failing. A green registry is a floor, not a guarantee.

**★ Of all the contracts a module has, why is the event the one to get right before extraction?**
Because it is the only one that survives extraction unchanged. The internal API becomes an HTTP
endpoint, the in-process call becomes a client, the package-private types stay behind — all of that
is re-created in a new form when the module is lifted out. The published event is already a wire
format with external consumers and its own compatibility promise, so it is the same artefact before
and after. Everything else about the module is provisional; the event is the part you have already
shipped.

---

← [Changing a published contract](28c-changing-a-published-contract.md) · [Topic index](README.md) · Next → [Anticorruption layer](29-anticorruption-layer.md)
