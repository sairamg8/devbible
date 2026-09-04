---
title: "Start from what the system can be asked to do, never from what it stores — because a list of system operations and the aggregates each one touches is a decomposition you can derive mechanically, and a data model is a decomposition that will hand you entity services"
sidebar_label: "21 · System operations first"
sidebar_position: 38
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *Assemblage overview: Part 1 — Defining system
> operations*
> ([microservices.io](https://microservices.io/post/architecture/refactoring/2023/07/27/assemblage-overview-part-1-defining-system-operations.html)),
> which defines a system operation as *"an externally invokable behavior implemented by the
> application. It reads and/or writes one or more business entities, a.k.a. DDD aggregates."*;
> *Assemblage overview: Part 2 — Defining subdomains*
> ([microservices.io](https://microservices.io/post/architecture/2023/08/14/assemblage-overview-part-2-defining-subdomains.html)),
> which defines a subdomain as *"a team-sized chunk of business functionality, a.k.a. business
> capability. It consists of the entities/aggregates acted upon by system operations."*; and
> the *Microservice Architecture Glossary*
> ([microservices.io](https://microservices.io/articles/glossary)), which classifies system
> operations as commands and queries, local or distributed.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**The single procedural change that most improves a decomposition is to start from behaviour.
Chris Richardson's Assemblage process makes this its first step, and the reason is structural
rather than stylistic: a subdomain is defined as the aggregates acted on by system operations,
so without the operations you cannot derive subdomains at all — you can only guess at them
from the data model, and a data model decomposes into entity services every single time.**

## The definitions, and why the ordering is forced

> *"A system operation is an externally invokable behavior implemented by the application. It
> reads and/or writes one or more business entities, a.k.a. DDD aggregates."*

> *"A subdomain is a team-sized chunk of business functionality, a.k.a. business capability. It
> consists of the entities/aggregates acted upon by system operations."*

Read them together and the dependency is unavoidable. Subdomains are *defined in terms of*
system operations. If you start with entities you have no way to group them except by
association, and association gives you the entity graph, which gives you entity services.

The glossary adds the classification that makes the list usable:

> *"There are two types: commands and queries. In a microservice architecture, a system
> operation is either local (implemented by a single service) or distributed (implemented by
> multiple collaborating services)."*

That local/distributed distinction is the scoring function for a candidate boundary. Count
how many of your operations become distributed under each candidate partition; that count is
the boundary's ongoing cost, and it is computable before you write anything.

## Producing the list

On an existing Spring Boot 4.1 codebase, most of it is mechanical:

```bash
# HTTP-invoked operations.
grep -rn '@\(Get\|Post\|Put\|Patch\|Delete\|Request\)Mapping' src/main/java

# Scheduled operations — externally invoked by the clock, and easy to forget.
grep -rn '@Scheduled' src/main/java

# Message-driven operations.
grep -rn '@KafkaListener\|@RabbitListener\|@JmsListener\|@ServiceActivator' src/main/java

# Batch job entry points.
grep -rn 'JobBuilder\|@EnableBatchProcessing\|StepBuilder' src/main/java
```

On a greenfield project, they come from the requirements: what will actors — users, other
systems, schedulers — need this system to do? Richardson's process documents each with a
specification, and the parts that matter for boundaries are the signature and the entities
touched.

## The table

One row per operation. Two of the five columns do the work.

| Operation | Type | Actor | Aggregates written | Aggregates read |
|---|---|---|---|---|
| `placeOrder` | Command | Customer | `Order`, `StockItem` | `Product`, `Customer` |
| `cancelOrder` | Command | Customer or agent | `Order`, `StockItem` | — |
| `quoteBasket` | Query | Customer | — | `Product`, `Promotion`, `Customer` |
| `capturePayment` | Command | System (scheduler) | `Payment`, `Invoice` | `Order` |
| `recordPick` | Command | Warehouse operative | `Shipment` | — |
| `dispatchShipment` | Command | Warehouse operative | `Shipment` | `Order` |
| `receiveReturn` | Command | Warehouse operative | `Return`, `StockItem` | `Order` |
| `refund` | Command | Agent | `Refund`, `Payment` | `Order`, `Return` |
| `publishProduct` | Command | Merchandiser | `Product` | — |
| `repriceProduct` | Command | Pricing analyst | `PriceList` | `Product` |
| `findOrderHistory` | Query | Customer | — | `Order`, `Shipment`, `Payment` |

**The written column is the constraint.** Every operation that writes more than one aggregate
is either a real cross-aggregate invariant — pinning those aggregates together — or one of
Vernon's four exceptions ([11 · Reasons to break the
rule](11-reasons-to-break-the-rule.md)). Group aggregates by co-written pairs and you have the
consistency components from [07 · Finding the invariants](07-finding-the-invariants.md),
derived from behaviour rather than from the schema.

**The read column is the cost.** Reading across a boundary is allowed and normal — Vernon:
*"referencing multiple aggregates in one request does not give license to cause modification
on two or more of them"* — but each cross-boundary read becomes an API call, a replica or a
composed query. Count them per candidate partition to estimate integration cost.

## Where to find the operations when nobody wrote them down

"List the system operations" is easy advice and hard to start, because most systems have no document
that contains them. They are recoverable from four artefacts, and the order matters — the first two
are cheap and incomplete, the last two are where the operations that break boundaries hide.

| Source | What it yields | Blind spot |
|---|---|---|
| **API gateway / access logs, grouped by route and method** | The operations external clients actually invoke, ranked by real volume | Everything that is not an HTTP request |
| **UI screens and their primary actions** | The user-facing operations, named the way users name them | Anything without a screen |
| 🔴 **Scheduled jobs, batch runs and cron** | Operations nobody thinks of as operations | — |
| 🔴 **Admin tools, support consoles and runbooks** | Operations performed *on* the system by staff | — |

```bash
# The operations your users actually perform, ranked. Method + normalised path.
awk '{print $6, $7}' access.log   | sed -E 's#/[0-9a-f-]{8,}#/{id}#g; s#/[0-9]+#/{id}#g'   | sort | uniq -c | sort -rn | head -40
```

🔴 **The bottom two rows are where boundary violations live, and they are systematically omitted.**
A nightly reconciliation job that writes to three aggregates is a system operation with the widest
transactional reach in the system, and it appears in no API document and on no screen. So is the
support tool that lets an agent cancel an order and refund it in one click. A partition designed from
the HTTP surface alone will place a boundary directly through both of them, and the failure will
surface months later as a batch job that cannot be made consistent.

**The practical instruction:** before scoring any partition, go and ask what runs on a schedule and
what the support team can do. Both lists are short, both are quick to obtain, and both routinely
change the answer.

## Grouping into subdomains

With the table in hand the grouping is close to mechanical:

1. **Start from the write clusters.** Aggregates that are written together in some operation
   are in one consistency component and therefore one subdomain candidate. `Order` +
   `StockItem` cluster through `placeOrder`, `cancelOrder` and `receiveReturn`; `Payment` +
   `Invoice` + `Refund` cluster through `capturePayment` and `refund`.
2. **Check each cluster with the whose-job question.** `Order` + `StockItem` clusters only
   because `placeOrder` writes both — and whether that write must be atomic is exactly
   [08 · Whose job is it?](08-whose-job-is-it.md). If it is the system's job, the cluster
   dissolves and the two are separable.
3. **Assign every remaining aggregate to exactly one subdomain**, per the Assemblage
   constraint that each subdomain is in one and only one service.
4. **Name each group with a verb.** A group you cannot name with a business verb is a group
   of leftovers; look again ([05 · One service, one
   capability](05-one-service-one-capability.md)).

Applied to the table above, a first grouping: *take an order* (`Order`), *know where stock
is* (`StockItem`), *collect money* (`Payment`, `Invoice`, `Refund`), *get a parcel to a door*
(`Shipment`, `Return`), *decide what a customer pays* (`PriceList`, `Promotion`), *merchandise*
(`Product`).

Note that `findOrderHistory` reads across four of those groups. That is a composed query, it
is entirely normal, and how to serve it is **03 · Database-per-service** *(not written yet)*.
It is not an argument against the boundaries.

## Scoring a partition: how many operations become distributed

The number to compute for each candidate partition:

> **Distributed operations** = operations whose written aggregates span more than one service.

An operation that becomes distributed needs a workflow, compensation and a failure story
forever. An operation that stays local is free. This is the honest comparison between two
candidate partitions, and it is far more informative than counting services.

Add the softer version for reads: operations whose *read* set spans services need composition
or replicas. Cheaper than a distributed write, and not free.

## Why data-first fails, stated once

Starting from the data model, you have entities and relationships. The only grouping available
is by association, which produces clusters around whatever the schema happens to link — and
since the schema links everything within a few hops, you either get one enormous group or you
give up and make each entity its own service. That is the entity-service anti-pattern arriving
by a respectable-looking route ([13 · Entity services](13-entity-services.md)).

Behaviour, by contrast, groups entities by *use*, and use is what the Common Closure Principle
is about.

## Gotchas

**★ Symptom: an operation list drawn only from HTTP endpoints.** Cause: scheduled jobs and
message consumers were forgotten. Fix: they are system operations by the definition — the
scheduler is an external actor — and they are frequently the ones that write across aggregate
boundaries, because batch code accretes without review.

**★ Symptom: two hundred operations.** Cause: CRUD endpoints counted individually. Fix:
collapse trivial reads and writes of a single aggregate into the capability they serve; the
list should be of things the business would recognise, not of HTTP verbs.

**★ Confusing the read column with the write column.** Reading several aggregates in one
operation is normal and constrains nothing. Only the write set pins aggregates together. This
is the single most common error in the exercise and it makes everything look inseparable.

**★ Symptom: an operation whose write set is enormous.** Cause: usually a batch job or an
import. Fix: check whether the writes must be atomic; batch imports are almost always Vernon's
Reason One — semantically independent writes done together for convenience — and impose no
co-location requirement.

**★ Deriving operations from the current UI.** The UI reflects one client's needs and a
particular era of design. Screens change; capabilities do not. Derive from what the business
does and check against the UI, not the other way round.

**★ Skipping the verb-naming step.** A group you cannot name is a group you have not
understood, and it will turn out to be leftovers assembled by exclusion. The naming step costs
minutes and catches it.

**★ Treating a composed query as a boundary violation.** `findOrderHistory` reading across
four services is normal in any decomposition and has well-known solutions. It is a data-access
problem for topic 03, not evidence that the boundaries are wrong.

**★ Symptom: the partition scores well and a nightly job cannot be made consistent under it.**
Cause: the operation list was built from the HTTP surface. A batch job is a system operation — often
the one with the widest transactional reach — and it appears in no API document and on no screen.
Fix: enumerate scheduled work before scoring anything. `crontab`, the scheduler's job list, and the
`@Scheduled` annotations in the codebase are three minutes of work that routinely change the answer:
```bash
grep -rn '@Scheduled' src/main/java | sed 's/.*@Scheduled/@Scheduled/'
```

**★ Symptom: a support tool turns out to write across three services, discovered after the split.**
Cause: operations performed *on* the system by staff were not counted as operations. The support
console's "cancel and refund" button is a single business operation with a single expectation of
atomicity, and nobody modelled it.
Fix: ask the support team what their tools can do, and add each capability to the operation list.
It is the shortest useful conversation available in a decomposition exercise and it is almost never
had.

## Interview questions

**★ Why start a decomposition from system operations rather than from the data model?**
Because a subdomain is *defined* as the aggregates acted on by system operations, so without
the operations there is nothing to group by except association — and association gives you the
entity graph, which gives you entity services. Behaviour groups entities by use, which is what
the Common Closure Principle is about. Practically, the operation list is also mechanically
extractable from an existing codebase: endpoints, scheduled methods, message listeners and
batch entry points.

**★ What do you record for each operation, and which part determines the boundaries?**
The type (command or query), the actor, the aggregates written and the aggregates read. The
write set determines the boundaries: aggregates written together in one operation are in one
consistency component unless the atomicity turns out not to be required. The read set
determines the integration cost, because each cross-boundary read becomes an API call, a
replica or a composed query. Conflating the two is the usual mistake and it makes everything
look inseparable, since almost every operation reads widely.

**★ How do you compare two candidate partitions objectively?**
Count how many system operations become distributed under each — that is, how many have a
write set spanning more than one service. A distributed operation needs a workflow,
compensation, idempotency and a permanent failure story; a local one is free. Then count
cross-boundary reads as a secondary, cheaper cost. That gives you two numbers per candidate
partition, computed before any code exists, and it is a far more useful comparison than the
number of services.

**★ Where do scheduled jobs fit?**
They are system operations, because the definition is "externally invokable behaviour" and the
scheduler is an external actor. They are also the ones most often left out of the analysis and
most likely to write across aggregate boundaries, because batch code accumulates over years
with less design attention than request paths. A nightly job that touches six aggregates is
either a serious constraint on your partition or — more often — a reconciliation for an
invariant somebody already gave up on, which is its own finding.

**★ Your operation table shows a query that reads from five candidate services. Does that
invalidate the boundaries?**
No. Cross-aggregate reads are explicitly permitted and are normal in every decomposition; what
constrains a boundary is writes. A query spanning five services is a composition problem with
standard answers — API composition or a dedicated read model fed by events — and it belongs to
the data-side topic rather than to the boundary decision. What would invalidate the boundaries
is a *command* whose write set spans five services, because that is a distributed transaction
you cannot have.

**★ Nobody has written down the system operations. Where do you actually get them from?**
Four artefacts, and the order matters because the cheap ones are incomplete in a specific direction.
Access logs grouped by route and normalised path give you what external clients really invoke, ranked
by volume. UI screens give the user-facing operations named the way users name them. Then the two that
matter most and are almost always skipped: **scheduled jobs** and **admin or support tooling**. A
nightly reconciliation that writes three aggregates is a system operation with the widest transactional
reach in the system and appears in no API document; a support console's "cancel and refund" button is
one business operation with one expectation of atomicity and appears on no customer-facing screen. A
partition designed from the HTTP surface alone will run a boundary straight through both, and the
failure shows up months later as a batch job that cannot be made consistent. Both lists are short and
quick to obtain, which is what makes omitting them expensive rather than excusable.

---

← [Event storming](20-event-storming.md) · [Topic index](README.md) · Next → [The ten forces](22-the-ten-forces.md)
