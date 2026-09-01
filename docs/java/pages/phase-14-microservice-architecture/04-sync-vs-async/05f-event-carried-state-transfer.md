---
title: "Event-carried state transfer is the only shape that removes a read entirely rather than deferring it, which is why it is the strongest availability move available — and why it hands you a second copy of somebody else's data to be wrong about"
sidebar_label: "23 · Event-carried state transfer"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Martin Fowler, "What do you mean by 'Event-Driven'?"
> ([martinfowler.com](https://martinfowler.com/articles/201701-event-driven.html)),
> microservices.io "Pattern: Event-driven architecture"
> ([microservices.io](https://microservices.io/patterns/data/event-driven-architecture.html))
> and "Pattern: API Composition"
> ([microservices.io](https://microservices.io/patterns/data/api-composition.html)).
> 🔴 **No sandbox, and no broker or outbox mechanics** — phase 15 owns those. Version spine:
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Every other technique in this topic makes a synchronous hop cheaper, safer or more graceful.
Event-carried state transfer deletes it. The consumer keeps its own copy of the fields it needs,
maintained by events from the owner, and reads it locally — so the owner's availability leaves
the consumer's arithmetic completely, the owner's latency leaves its budget, and the owner's
tail leaves its p99. It is the single largest available win, and its price is a second copy of
data you do not own, which will be stale, which someone has to be accountable for.**

## Fowler's definition, verbatim

> *"You want to update clients of a system in such a way that they don't need to contact the
> source system in order to do further work."*

and the cost, stated in his characteristically blunt way:

> *"There's lots of data schlepped around and lots of copies"*

The definition is worth reading as a *goal statement* rather than a mechanism. The mechanism —
events carrying state, a local projection, a store — is downstream of the goal, which is that
the consumer never has to ask.

## What leaves the equation

Compare against every other remedy in this topic:

| Remedy | Owner's availability | Owner's latency | Owner's tail | Owner's capacity |
|---|---|---|---|---|
| Timeout + retry | still in the product | still in the budget | still yours | still your load |
| Circuit breaker | still in the product | reduced when open | still yours | reduced when open |
| Soft dependency + fallback | **removed** | still in the budget on the happy path | still yours | still your load |
| Cached response | removed *when warm* | reduced on hit | reduced on hit | reduced on hit |
| **Event-carried state transfer** | **removed** | **removed** | **removed** | **removed** |

Only the last row clears every column, and it does so because **there is no call**. That is the
whole argument, and it is why this shape is worth the operational work it costs.

## What a state-carrying event looks like

Not the whole aggregate. The fields consumers need, plus enough identity and versioning to apply
them correctly:

```java
public record CustomerProfileChanged(
        String customerId,
        long version,               // monotonically increasing per customer
        String displayName,
        String tier,
        String countryCode,
        Instant occurredAt) {}
```

The `version` field is not decoration. It is what makes the consumer's projection correct under
out-of-order and duplicate delivery, which are both normal — see
[40 · Duplicates and ordering](08c-duplicates-and-ordering.md).

The consumer's side is a projection into its own store, and the only interesting line is the
version guard:

```java
@Component
class CustomerProjection {

    private final CustomerCopyRepository copies;

    CustomerProjection(CustomerCopyRepository copies) {
        this.copies = copies;
    }

    @Transactional
    public void apply(CustomerProfileChanged event) {
        copies.findById(event.customerId())
              .filter(existing -> existing.version() >= event.version())
              .ifPresentOrElse(
                  newer -> { /* stale or duplicate event — discard */ },
                  ()    -> copies.save(CustomerCopy.from(event)));
    }
}
```

Two properties this gives you, and both matter more than they look:

- **Idempotent.** Re-delivering the same event is a no-op, because the stored version is not less
  than the incoming one. At-least-once delivery is therefore fine.
- **Order-tolerant.** An event that arrives after a newer one is discarded rather than
  overwriting. You do not need the broker to guarantee ordering, only that each event carries its
  version.

🔴 The broker configuration, partitioning, consumer groups and the outbox that publishes these
atomically with the owner's write are **phase 15's**; see
[Phase 15 · Messaging and event-driven architecture](../../phase-15-messaging-event-driven/README.md).

## The price, itemised honestly

**1 · Staleness.** The copy lags the source by the end-to-end propagation time. That lag is a
*business* parameter, not an engineering one: a display name being seconds old is invisible; a
credit limit being seconds old may be a loss. **Every copied field needs an approved staleness
budget**, and fields that cannot tolerate any staleness must not be copied — they stay
synchronous, and that is a legitimate outcome. See
[26 · The read that could have been a copy](06c-the-read-that-could-have-been-a-copy.md).

**2 · Duplication.** Fowler's *"lots of data schlepped around and lots of copies"*. Storage is
cheap; the expensive part is that a customer's tier now exists in five places, and when the
business changes what "tier" means, five teams have code that interprets it.

**3 · A new correctness surface.** The projection can be wrong: a bug drops events, a consumer is
down past the broker's retention, a schema change is mishandled. Unlike a synchronous read, a
wrong copy does not announce itself — it serves confidently incorrect data. This is the failure
mode that makes people distrust the pattern, and it is manageable only with the reconciliation in
the next section.

**4 · Bootstrapping.** A new consumer needs the current state of every entity before it can serve
anything, and replaying from the beginning of a topic may not be possible or affordable. Somebody
has to build a backfill, and it is usually discovered late.

**5 · Deletion and privacy.** If the owner deletes a customer, every copy must delete too, and you
have to be able to prove it. Copies are a data-protection obligation as much as an engineering
one, and a copy nobody remembers is a compliance finding.

## The control that makes it safe: reconciliation

The one non-negotiable operational addition, and the thing that separates teams who trust their
copies from teams who quietly reintroduce synchronous reads "just to be sure":

**A periodic job that compares the copy against the owner and reports divergence.** Not repairs
it silently — *reports* it, with a count, as a metric you alarm on. Divergence is not just drift;
it is the signal that the event pipeline has a bug, and repairing without reporting hides the
bug forever.

Cheap forms that work: a nightly checksum per entity from the owner compared against the
consumer's; a count-and-max-version comparison; a sampled field-by-field diff over a random
subset. Any of them is enormously better than none.

## Where the line sits against API composition

The API Composition pattern is the alternative for cross-service queries, and its stated drawback
is efficiency:

> *"Some queries would result in inefficient, in-memory joins of large datasets."*

The availability drawback — the composed query's availability is the product across every service
composed — is the one this topic adds, in
[07 · Chains, fan-out and composition](03c-chains-fan-out-and-composition.md).

**Composition is the right choice when the data is large, rarely queried, or changes so fast that
a copy would always be wrong. State transfer is the right choice when the data is small, read
constantly, and changes slowly.** Reference data — names, tiers, categories, prices, addresses —
is almost always the second case, which is why it is the standard starting point.

## Gotchas

**★ Copying a field with no approved staleness budget is a decision nobody made.** "How old can
this be before it is wrong?" has an answer per field, and the answer comes from the business.
Without it, the first stale-data incident becomes an argument about whether the whole pattern was
a mistake, when the actual mistake was copying one field that should have stayed synchronous.

**★ A projection without a version guard corrupts itself on redelivery or reordering.** At-least-once
delivery is the norm, and an older event overwriting a newer one leaves the copy permanently wrong
with no error anywhere. The guard is three lines and it is the difference between a copy you can
trust and one you cannot.

**★ Nobody backfills, so the first consumer works and the second one does not.** The first consumer
was built when the system was small and caught up from the topic; the second arrives two years
later when retention has long since expired. Design the backfill mechanism with the first
consumer, or the pattern stops being available exactly when it is most valuable.

**★ Copies drift silently, and drift is discovered by a customer.** Without reconciliation the
first signal is a support ticket about a wrong name on an invoice. The reconciliation job is not a
nice-to-have; it is what makes the copy trustworthy enough to build on.

**★ Repairing divergence without reporting it hides the bug that caused it.** A self-healing job
that silently overwrites the copy every night means the event pipeline can be broken indefinitely
while everything looks fine. Report first, repair second, and alarm on the count.

**★ The copy becomes a second source of truth by accretion.** Someone adds a field to the local
copy that the owner does not have. Someone else writes to it. Now two services own the same
concept and they disagree. The copy must be **read-only and derived**, enforced by convention and
ideally by schema — no write path, ever.

**★ Deleting the source does not delete the copies, and someone will ask you to prove that it
did.** Right-to-erasure obligations follow the data. Every copy needs a deletion path driven by a
deletion event, and an inventory of who holds copies of what — which is a thing to write down at
the start, not to reconstruct under a regulator's deadline.

**★ Schema changes on a state-carrying event are worse than on a notification.** A notification is
transient and a bad one affects one message; a state event feeds a stored projection, so a
mishandled schema change writes wrong data that persists after the bug is fixed. Contract tests
matter more here than anywhere else in the topic.

## Interview questions

**★ What is event-carried state transfer and why is it stronger than a cache or a fallback?**
The consumer maintains its own copy of the fields it needs, kept current by events from the owner,
and reads it locally — Fowler's goal is that clients *"don't need to contact the source system in
order to do further work"*. It is stronger than a cache or a fallback because it removes the call
entirely: the owner's availability leaves the consumer's product, the owner's latency leaves its
budget, the owner's tail leaves its p99, and the owner's capacity is unaffected by the consumer's
read rate. A cache achieves some of that only while warm; a fallback achieves only the
availability column.

**★ What must a state-carrying event include beyond the data?**
A stable entity identifier and a monotonically increasing version, so the consumer can guard
against duplicates and out-of-order delivery — both of which are normal with at-least-once
messaging. With a version guard the projection is idempotent and order-tolerant, which means you
do not need ordering guarantees from the broker. Without one, a redelivered or late event silently
overwrites newer data and the copy is permanently wrong with no error raised anywhere.

**★ How do you decide which fields to copy?**
By staleness tolerance, agreed with the business, per field. Fields that are display-only or
change rarely — names, categories, country codes, tiers — copy well. Fields where a few seconds of
lag is a financial or safety risk — a credit limit, a current balance, an authorisation decision —
should stay synchronous, and deciding that explicitly is a valid outcome rather than a failure of
the pattern. The heuristic that follows is that reference data copies and transactional state does
not.

**★ What operational control makes copies trustworthy?**
Reconciliation: a periodic comparison of the copy against the owner that *reports* divergence as
an alarmed metric. Checksums per entity, count-and-max-version comparisons or sampled field diffs
all work. The important detail is reporting rather than silently repairing — a self-healing job
with no alarm lets the event pipeline stay broken indefinitely while the dashboards look healthy,
and divergence is the primary signal that something in the pipeline is wrong.

**★ When would you use API composition instead?**
When the data is large, queried rarely, or changes fast enough that a copy would be wrong more
often than right — the cases where maintaining a projection costs more than it saves. Composition's
own drawback is stated in the pattern: inefficient in-memory joins over large datasets, plus the
availability cost this topic adds, since the composed query's availability is the product across
every service it touches. The dividing line is roughly small-slow-hot data to copies,
large-fast-cold data to composition.

**★ What is the compliance dimension of this pattern?**
Every copy is personal data you now hold and must be able to delete and account for. A deletion in
the owner has to propagate as a deletion event that every consumer honours, and you need an
inventory of which services hold copies of which fields in order to answer an erasure request at
all. That inventory is trivial to maintain from the start and close to impossible to reconstruct
later, which makes it a first-day artefact rather than a later concern.

{/* FOOTER */}
