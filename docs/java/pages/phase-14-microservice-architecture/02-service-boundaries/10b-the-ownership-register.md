---
title: "Write the ownership register down as a table of facts, rules and owners, because every unwritten ownership assumption eventually becomes a second writer — and a field with two writers is not a boundary in dispute, it is a defect with a schedule"
sidebar_label: "17 · The ownership register"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *Database per Service*
> ([microservices.io](https://microservices.io/patterns/data/database-per-service.html)) and
> *Shared database*
> ([microservices.io](https://microservices.io/patterns/data/shared-database.html)); Vaughn
> Vernon, *Effective Aggregate Design, Part II* (2011)
> ([dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/), CC BY-ND 3.0).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**[16 · Who owns the data](10-who-owns-the-data.md) gives the test. This chunk gives the
artefact and the failure modes, because a test applied in a meeting and never recorded lasts
about a quarter. The register is a small table, it fits on one page per context, and its
entire purpose is to make the second writer visible on the day it is proposed rather than in
the incident review eighteen months later.**

## The register

One row per fact that has a rule. Facts with no rule do not need rows; they follow their
neighbours.

| Fact | Rule that can refuse a change | Owner | Others hold it as | Update path |
|---|---|---|---|---|
| `customer.email` | Unique; verified before use for auth | Identity | Replica (Support, Marketing) | `IdentityChanged` event |
| `customer.creditLimit` | Set by credit policy; capped by risk score | Credit | Query at checkout | Synchronous call, fail closed |
| `customer.marketingConsent` | Lawful basis + timestamp required | Consent | Replica (Marketing) | `ConsentChanged` event |
| `product.price` | Within margin floor; one active per channel per instant | Pricing | Replica (Catalogue, Search) | `PriceChanged` event |
| `product.description` | Approved before publication | Catalogue | Replica (Search) | `ProductPublished` event |
| `stockItem.onHand` | `onHand − reserved ≥ 0` | Inventory | Replica, display only (Catalogue) | `StockLevelChanged` event |
| `order.deliveryAddress` | Immutable after placement | Sales | Copy at placement (Fulfilment) | Copied in `OrderPlaced` |
| `order.status` | State machine; only Sales may transition | Sales | Replica (Support) | `OrderStatusChanged` event |

Four columns do the work.

**"Rule that can refuse a change"** — if this cell is empty, the fact has no owner and the
row should be deleted or the rule found. An empty cell with a named owner is a claim
somebody will contest.

**"Owner"** — exactly one name. Never two, never "shared", never a team that no longer
exists.

**"Others hold it as"** — reference, replica or query, from
[16 · Who owns the data](10-who-owns-the-data.md). A blank here means nobody outside knows
about it, which is the healthiest possible state.

**"Update path"** — the named mechanism. If you cannot name it, the replica is a fork.

## The five ways a second writer appears

Every one of these is proposed by a reasonable person for a reasonable reason, and every one
of them ends the boundary.

### 1. The admin back door

A back-office screen writes another service's table directly, because "it is just a
correction and going through the API is slow". The correction bypasses the rule, so the rule
is now enforced on some paths and not others, which is worse than not having it — the
owner's code will assume its invariant holds.

**The fix, shown rather than described:** the owner exposes the correction as a first-class
operation with its own authorisation, and the back office calls it.

```java
package com.retailer.inventory;

/// Corrections are a real business operation with a real rule — they need a reason and
/// an actor, and they are refused if they would violate the invariant. Exposing this is
/// what makes "go through the API" acceptable to the people doing stock counts.
public interface StockCorrectionService {

    /// @throws InsufficientStockException if the correction would leave the item
    ///         unable to honour its existing reservations.
    CorrectionId correct(Sku sku,
                         WarehouseId warehouse,
                         int newOnHand,
                         CorrectionReason reason,
                         ActorId performedBy);
}
```

### 2. The ETL job that writes back

A nightly pipeline reads from three services, computes something, and writes the result into
one of them. It is a second writer with no rule enforcement and no audit trail, and it runs
at 3am when nobody is watching. If the computed value matters, it is a fact the owner should
compute or accept through its API; if it does not matter, it belongs in a read model that
nobody writes back from.

### 3. The "sync service"

A component whose job is to keep two services' copies of the same data in agreement. Its
existence is proof that two services write the same fact, and it converts an ownership
problem into a distributed-convergence problem, which is strictly harder. When you find one,
the finding is not "the sync service is buggy"; it is "there are two owners".

### 4. The migration that never finished

The new service was supposed to take over ownership, the old one still writes for "the
legacy path", and the legacy path is now four years old. This is the most common source of
dual writes in real systems and it is invisible in a design document, because the design
document describes the end state. The register should record the *current* state, with the
dual write named as a dated defect.

### 5. The shared library that writes

A `common-persistence` module with a `CustomerUpdater` used by three services. Every caller
is a writer, and the rule — if there is one — lives in a jar version rather than in a
service. See [23 · The shared model jar](16-the-shared-model-jar.md).

## Making the register enforceable

For services sharing a database during a migration, the strongest available enforcement is
database-level and it is worth the trouble:

```sql
-- Each service connects as its own role. Ownership is expressed as a grant,
-- so a second writer fails at the connection rather than in a code review.
CREATE ROLE inventory_svc LOGIN;
CREATE ROLE sales_svc     LOGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON stock_item, reservation TO inventory_svc;
GRANT SELECT                          ON stock_item             TO sales_svc;

GRANT SELECT, INSERT, UPDATE          ON orders, order_line     TO sales_svc;
-- inventory_svc is deliberately granted nothing on orders.
```

This is a transitional mechanism, not a destination — the destination is a database per
service. It earns its place because during a strangler migration it is the only thing
standing between the register and reality, and because a permission error in a pull-request
build is a conversation, whereas a silent second writer is an incident.

Within one deployable, the equivalent enforcement is module visibility plus the ArchUnit or
Spring Modulith rules in [15 · Finding it in the code](09b-finding-it-in-the-code.md) and
[34 · Verifying the boundary](25-verifying-the-boundary.md).

## Where the register lives

In the repository of the service that owns the facts, as a markdown file, reviewed in the
same pull request as any change to those facts. Not in a wiki: a wiki page is edited by
whoever remembers it exists, and the register's value is entirely in being reviewed at the
moment somebody proposes a second writer.

A register that has not been edited in a year is either a stable system or an abandoned
document, and you can tell which by checking whether any of the last year's schema changes
touched a fact it lists.

## Gotchas

**★ Symptom: a "sync service" in the architecture diagram.** Cause: two owners for one
fact. Fix: pick an owner and make the other side a replica with a one-way update path. The
sync service is not fixable as a sync service; every improvement to it is an improvement to
a mechanism that should not exist.

**★ Symptom: an incident caused by a correction made in the database.** Cause: no
first-class correction operation, so the only available tool was SQL. Fix: model corrections
as domain operations with a reason and an actor. Teams resist this because corrections feel
exceptional; they are not — in any real system they are a weekly business process.

**★ A register with a row whose owner is "shared" or "TBD".** Cause: the meeting ended
without a decision and the row was left honest. Fix: honest is good, but the row is a live
defect — it should carry a ticket and an owner-of-the-decision, not a permanent shrug.

**★ Writing the register for the target architecture rather than the current one.** The
register's job is to make today's second writers visible. A register describing the intended
end state hides exactly the thing it exists to expose.

**★ Symptom: two services agree on ownership but one still reads the other's tables.**
Cause: read access was never discussed because it felt harmless. Fix: it is not harmless —
it makes the owner's schema a public contract, so a column rename becomes a coordinated
release. Record read access in the register too, and prefer an API or an event-fed replica.

**★ Granting database roles and then using one superuser connection anyway.** The grants are
enforcement only if each service authenticates as its own role. A shared `app` user with
full rights makes the SQL above documentation.

## Interview questions

**★ What goes in an ownership register and why is it worth maintaining?**
One row per fact that has a rule: the fact, the rule that can refuse a change to it, the
single owner, how other services hold it (reference, replica or query) and the named update
path. It is worth maintaining because ownership decisions are made in meetings and forgotten
in months, and the specific thing that goes wrong is a second writer appearing for a
perfectly reasonable local reason — an admin correction, an ETL write-back, an unfinished
migration. The register makes that proposal visible at review time, which is the only time it
is cheap to refuse.

**★ You find a service whose job is to keep two other services' data in sync. What is your
assessment?**
That two services write the same fact, and the sync service is the symptom rather than the
system. It converts an ownership question into a convergence problem, which is harder: it
needs conflict resolution, it needs to decide who wins on simultaneous edits, and it will
produce drift that shows up as customer-visible inconsistency. The remedy is to choose one
owner, turn the other into a replica fed one-way by events, and delete the sync service —
which is usually resisted, because the sync service is load-bearing by the time anyone
notices it.

**★ An operations team needs to correct data directly in the database. What do you do?**
Model the correction. Corrections are not exceptional; in any system with physical goods,
manual processes or upstream data quality problems they are a weekly business operation with
a real rule — a stock correction must not leave existing reservations unfulfillable, and it
needs a reason and an actor for audit. Exposing it as a first-class API operation gives the
ops team something faster and safer than SQL, which is what actually stops the direct
writes. Telling them to stop without giving them a replacement guarantees the practice
continues.

**★ How would you enforce ownership while two services still share a database?**
Database roles. Each service connects as its own role, and grants express the register:
the owner gets write on its tables, everyone else gets read at most, and preferably nothing.
A second writer then fails at the connection rather than surviving code review, and the
failure appears in a build rather than in production. It is transitional — the destination
is a database per service — but during a strangler migration it is the only mechanism that
keeps the register and reality in agreement.

**★ Why record read access in the register, not just writes?**
Because reading another service's tables makes its schema a public contract without anyone
agreeing to it. The owner can no longer rename a column, change a type or restructure a
table without a coordinated release, which is design-time coupling of exactly the kind the
boundary was meant to remove. Recording reads makes the cost visible and usually motivates
replacing them with an API or an event-fed replica, which restores the owner's freedom to
change its storage.

{/* FOOTER */}
