---
title: "The callers of a full-replacement API are already performing intents and simply have no vocabulary for them — which means the list of operations the API should have offered is recoverable from its traffic, and is more accurate than any list the consuming teams could give you"
sidebar_label: "13d · Migrating a public CRUD API"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against RFC 9110, *HTTP Semantics*, §9.3.4 (PUT), §9.3.3 (POST) and §9.2.2
> (idempotent methods), at [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html); Martin
> Fowler, *ParallelChange*
> ([martinfowler.com](https://martinfowler.com/bliki/ParallelChange.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[13b · CRUD is not a capability](13b-crud-is-not-a-capability.md) establishes that a full-replacement API publishes the absence of business rules, and that RFC 9110 says so in the protocol's own terms. That is a diagnosis for a service you are designing. For one that is already deployed with consumers you do not control, the interesting question is different and more tractable than it looks: you do not need the consuming teams to tell you which operations they need, because they are already telling you. Every `PUT` that changes three particular fields together is an unnamed operation, and the set of fields changed per caller clusters into the four or five real operations the API should have had — recovered from behaviour rather than from what anybody believes they do.**

## The migration, when the CRUD API is already public

Knowing the API is wrong does not tell you what to do about one with consumers. The sequence is
expand / migrate / contract from
[28c · Changing a published contract](28c-changing-a-published-contract.md), with one addition
specific to this case: **the intent endpoints go in first and the CRUD endpoint keeps working**, and
you learn what the operations actually are from the traffic.

```java
@RestController
@RequestMapping("/orders")
class OrderController {

    // EXPAND: the operations, added alongside. Each one is a decision the service makes.
    @PostMapping("/{id}/cancellation")
    CancellationReceipt cancel(@PathVariable UUID id, @RequestBody CancelOrderCommand cmd) {
        return orders.cancel(id, cmd.reason());
    }

    @PostMapping("/{id}/delivery-address-changes")
    OrderSummary changeAddress(@PathVariable UUID id, @RequestBody ChangeAddressCommand cmd) {
        return orders.changeDeliveryAddress(id, cmd.address());
    }

    // MIGRATE: the old verb stays, and starts telling you what callers are really doing with it.
    @PutMapping("/{id}")
    @Deprecated
    OrderSummary replace(@PathVariable UUID id, @RequestBody OrderRepresentation body) {
        log.info("deprecated-put order={} changedFields={} caller={}",
            id, diffAgainstStored(id, body), currentCaller());
        return orders.legacyReplace(id, body);
    }
}
```

🔴 **The `changedFields` log line is the useful part, and it is worth more than a survey.** Callers
using a full-replacement API are performing intents; they just have no vocabulary for them. Logging
which fields each caller actually changes gives you the real list of operations — usually four or
five, where the API offered one — and it comes from behaviour rather than from asking people what
they think they do.

**Contract only on evidence**, per the same rule as any other published contract: the `PUT` goes when
the log shows no callers, not on a date.

## Reading the changed-field log

The log is only useful if you know what you are looking for in it. Field sets cluster, and the
clusters are the operations:

| Changed field set, observed | The operation nobody named | Caller |
|---|---|---|
| `status: CANCELLED` alone | Cancel an order | web, mobile |
| `deliveryAddress.*` | Change the delivery address | web, support tool |
| `status: SHIPPED`, `trackingRef` | Record dispatch | warehouse job |
| `lines[*].quantity`, `total` | Amend quantities | support tool |
| every field, unchanged values included | 🔴 **a client doing read-modify-write** | mobile |

**The last row is the one to look for first**, because it is both the most common and the most
dangerous. A caller that reads the whole order, changes one field in memory and writes the whole
thing back is carrying every other field along with it — so two such callers overlapping silently
discard each other's work, and the API gave them no other option. Those callers are the strongest
argument for the migration and the ones to move first.

⚠️ **Do not design the intent endpoints before reading the log.** The temptation is to write the four
endpoints you expect and then check; the value of the exercise is that the real list is usually not
the expected one — there is a support-tool operation nobody in the room knew about, and one of the
"obviously needed" endpoints turns out to have no callers at all.

## The endpoint you will never be allowed to remove

Sometimes Contract never comes: an external partner is on a signed integration contract, or a client
ships on a two-year hardware refresh cycle. That is a legitimate outcome and it needs to be planned
for rather than treated as failure.

**What changes is where the CRUD endpoint sits.** It stops being the service's API and becomes an
**adapter in front of it** — a translation from full-replacement requests into the service's real
operations, living at the edge, with the domain behind it never seeing a whole-object write:

```java
// The legacy verb, reimplemented as a translator. The domain below it has no replace() at all.
@PutMapping("/{id}")
@Deprecated
OrderSummary legacyReplace(@PathVariable UUID id, @RequestBody OrderRepresentation body) {
    Set<String> changed = diffAgainstStored(id, body);
    if (changed.equals(Set.of("status")) && body.status() == CANCELLED) {
        orders.cancel(id, CancellationReason.LEGACY_API);
    } else if (changed.stream().allMatch(f -> f.startsWith("deliveryAddress"))) {
        orders.changeDeliveryAddress(id, body.deliveryAddress());
    } else {
        throw new UnsupportedLegacyMutationException(id, changed);
    }
    return orders.summarise(id);
}
```

🔴 **The `else` branch is deliberate and is the point.** Rejecting unmapped field combinations means
the legacy surface can only shrink, and every new combination a caller invents fails loudly instead of
being silently absorbed. That converts a permanent endpoint from a permanent liability into a bounded
one — this is [29 · Anticorruption layer](29-anticorruption-layer.md) applied to your own past.

## Gotchas

**★ Symptom: the API is `PUT`-based and the team insists it is idempotent as required.**
Cause: the operations underneath are transitions, not replacements. RFC 9110 requires PUT to be
idempotent — *"multiple identical requests will have the same effect as a single request"* — and a
cancellation, a refund or a stock reservation applied twice is not the same as applied once.
Fix: the mismatch is the diagnosis, not a detail to paper over. Model the transition as a `POST` to a
subordinate resource, where the resource *"process[es] the representation … according to the
resource's own specific semantics"* and repeat submissions are handled by an idempotency key rather
than by pretending the operation is a replacement.

**★ Symptom: nobody can enumerate the operations the CRUD endpoint is being used for.**
Cause: the API offered one verb, so every distinct intent arrived through it and none was ever named.
The knowledge exists only in the callers.
Fix: log the changed field set per caller on the deprecated endpoint. Four or five real operations
usually fall out within a business cycle, discovered from behaviour rather than from asking teams to
describe what they do:
```java
log.info("deprecated-put order={} changedFields={} caller={}", id, diffAgainstStored(id, body), currentCaller());
```

**★ Symptom: the new intent endpoints go live and nobody uses them.**
Cause: they were designed from what the team expected the operations to be, before reading the log,
so they do not match what callers are actually doing.
Fix: read first, design second. The list recovered from changed-field sets routinely contains an
operation nobody in the room knew about and omits one everybody was sure was needed.

**★ Symptom: the deprecated `PUT` is quietly gaining new callers.**
Cause: it still works and it is still the easiest thing to integrate against, so new consumers keep
choosing it — and each one extends the deprecation timeline.
Fix: make the legacy endpoint reject field combinations it has not seen before, so its surface can
only shrink, and refuse new integrations against it at review time. A deprecated endpoint that still
accepts arbitrary writes is not deprecated, it is just labelled.

## Interview questions

**★ You inherit a public CRUD API and cannot break its consumers. How do you find out what operations it should have had?**
From the traffic, not from a survey. Add the intent endpoints alongside the existing `PUT`, leave the
`PUT` working and deprecated, and log the **set of fields each caller actually changes** on every
request to it. Callers of a full-replacement API are already performing intents; they simply had no
vocabulary to express them, so the changed-field sets cluster into the four or five operations the
API should have offered. That gives you the real list from behaviour rather than from what teams
believe they do, and it doubles as the deprecation evidence — the `PUT` is removed when the log shows
no callers, not on a date somebody picked.

**★ A partner contract means the CRUD endpoint can never be removed. Is the migration pointless?**
No — what changes is the endpoint's role rather than its existence. It stops being the service's API
and becomes an anticorruption layer in front of it: a translator that maps full-replacement requests
onto the service's real operations, so the domain behind it never accepts a whole-object write and
never learns the legacy shape. The important detail is that the translator should **reject field
combinations it does not recognise** rather than falling back to a generic replace. That makes the
legacy surface monotonically shrinking — every new combination a caller invents fails loudly instead
of being absorbed — which turns a permanent endpoint from an unbounded liability into a bounded one
you can reason about.

---

← [CRUD is not a capability](13b-crud-is-not-a-capability.md) · [Topic index](README.md) · Next → [What to build instead](13c-what-to-build-instead.md)
