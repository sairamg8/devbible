---
title: "One aggregate per transaction is a rule of thumb and its author says so, listing four specific reasons to break it — knowing those four is what stops the rule being either dogma or an excuse"
sidebar_label: "18 · Reasons to break the rule"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Vaughn Vernon, *Effective Aggregate Design, Part I and Part
> II: Making Aggregates Work Together* (2011), section *"Reasons To Break the Rules"*
> ([dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/), CC BY-ND 3.0).
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**A rule everyone repeats and nobody is allowed to break becomes dogma; a rule with no
stated exceptions becomes an excuse, because every violation gets justified ad hoc. Vernon
avoids both by naming four reasons and closing the list. This chunk is those four, each
translated from "may I write two aggregates in one transaction" into the question this topic
actually cares about: "does this force these two things into the same service?"**

## The rule's own status

Vernon is explicit that the rule is a heuristic:

> *"Limiting the modification of one aggregate instance per transaction may sound overly
> strict. However, it is a rule of thumb and should be the goal in most cases."*

And equally explicit that breaking it is a decision, not a fallback:

> *"An experienced DDD practitioner may at times decide to persist changes to multiple
> aggregate instances in a single transaction, but only with good reason."*

The four reasons follow. Note what is *not* on the list: "it was easier", "the deadline",
"we will fix it later". Those are the reasons that actually appear in codebases, and the
value of knowing the real four is being able to say which one a given case is — or that it is
none of them.

## Reason One — user interface convenience

A screen lets a user define common properties once and create a batch of things. The
transaction writes many aggregates.

Vernon's test for why this is safe:

> *"if creating a batch of aggregate instances all at once is semantically no different than
> creating one at a time repeatedly, it represents one reason to break the rule of thumb with
> impunity"*

The key word is **semantically**. No invariant spans the batch; each new aggregate maintains
its own invariants; the batch is a UI affordance. Contrast with a batch where the members
constrain each other — "allocate this budget across these five campaigns, totalling exactly
the budget" — which is a genuine cross-aggregate invariant and is not this reason.

**Boundary translation:** none. A batch of independent creations imposes no co-location
requirement, because each creation could equally be its own transaction. If your only
multi-aggregate write is of this shape, the boundary is free.

He also notes Udi Dahan's preferred alternative — a message bus carrying multiple logical
messages in one physical message, processed in one transaction on the server side — which
keeps the application service free of batch-specific methods.

```java
package com.retailer.sales.internal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
class BasketImportService {

    private final BasketRepository baskets;

    BasketImportService(BasketRepository baskets) {
        this.baskets = baskets;
    }

    /// Reason One. Each imported basket is independent; no rule spans the batch.
    /// This writes N aggregates in one transaction and imposes no co-location
    /// requirement, because it is semantically N separate operations.
    @Transactional
    public List<BasketId> importAll(List<BasketDraft> drafts) {
        return drafts.stream()
                .map(draft -> baskets.save(Basket.from(draft)).id())
                .toList();
    }
}
```

## Reason Two — lack of technical mechanisms

Eventual consistency needs *"some kind of out-of-band processing capability, such as
messaging, timers, or background threads"*. Vernon reports facing a project with none of
those and asks what could be done.

His warning about the wrong answer is the useful part:

> *"If we aren't careful, this situation could lead us back toward designing large cluster
> aggregates."*

So the failure mode is not the multi-aggregate transaction; it is the enormous aggregate
built to make the multi-aggregate transaction unnecessary — which reintroduces the
contention and the loading cost the rules exist to avoid.

He offers a mitigating factor worth carrying into service design: **user-aggregate
affinity**.

> *"Are the business work flows such that only one user would be focused on one set of
> aggregate instances at any given time? Ensuring user-aggregate affinity makes the decision
> to alter multiple aggregate instances in a single transaction more sound since it tends to
> prevent the violation of invariants and transactional collisions."*

**Boundary translation:** this reason is mostly obsolete in a Spring Boot 4.1 service —
`@Async`, `@Scheduled`, `@TransactionalEventListener`, Spring Modulith's event publication
registry and any broker all exist. Where it survives is in constrained environments:
regulated runtimes with no background execution, serverless functions with no durable timer,
or a platform where introducing a broker requires a governance process longer than the
project. There, the honest answer is fewer services, not larger aggregates.

## Reason Three — global transactions

An enterprise policy or a legacy technology mandates XA two-phase commit. Vernon's advice is
to contain rather than surrender:

> *"Even if you must use a global transaction, you don't necessarily have to modify multiple
> aggregate instances at once in your local bounded context. If you can avoid doing so, at
> least you can prevent transactional contention in your core domain and actually obey the
> rules of aggregates as far as it depends on you."*

And he names the cost plainly: *"your system will probably never scale as it could if you
were able to avoid two-phase commits and the immediate consistency that goes along with
them."*

**Boundary translation:** a mandated global transaction across two components is a statement
that those two components are not independently deployable, whatever the diagram says. If
the policy is immovable, put them in one service and stop paying for a boundary you are
forbidden to use. The most common instance is an XA transaction spanning a database and a
JMS queue in an older estate; if that is your constraint, say so in the architecture document
rather than drawing a boundary the platform will not honour.

## Reason Four — query performance

> *"There may be times when it's best to hold direct object references to other aggregates.
> This could be used to ease repository query performance issues."*

This one is about *reference by identity* rather than about the transaction rule, and Vernon
attaches a caveat: *"These must be weighed carefully in the light of potential size and
overall performance trade-off implications."*

**Boundary translation:** a direct object reference held for query convenience is a hard
block on separating the two aggregates, and it usually buys something a read model would buy
better. Inside one service it is a defensible optimisation. As soon as a boundary is
proposed between the two, it becomes the first thing to remove, and the replacement is a
query-side projection — which is **03 · Database-per-service** *(not written yet)*.

## The list is closed, and that is the point

Vernon's own summing up:

> *"Certainly we don't go in search of excuses to break the aggregate rules of thumb. In the
> long run, adhering to the rules will benefit our projects."*

In practice the value of a closed list is procedural. When a pull request writes two
aggregate roots in one transaction, the review question is not "is this okay?" — it is
"which of the four is this?" That question has a right answer, an answer of "none", or an
answer of "Reason One" that a reviewer can check by asking whether any rule spans the batch.
Every one of those outcomes is better than a judgement call.

The allow-list in [15 · Finding it in the code](09b-finding-it-in-the-code.md) is where the
answer gets recorded.

## Gotchas

**★ Symptom: every multi-aggregate write in the codebase is justified as "Reason One".**
Cause: the semantic test is being skipped. Fix: for each case, name the invariant that would
be violated if the members were written one at a time. If you can name one, it is not Reason
One — it is a real cross-aggregate invariant and it pins those aggregates together.

**★ Reaching for a giant aggregate because eventual consistency is unavailable.** This is
the specific failure Vernon warns about under Reason Two, and it is worse than the problem:
you get lock contention, unbounded loading, and a shape that cannot ever be split. If the
mechanisms genuinely do not exist, keep the aggregates small and accept the multi-aggregate
transaction, in one service.

**★ Treating user-aggregate affinity as a guarantee.** It reduces collisions; it does not
eliminate them, and Vernon says so — *"in rare situations users may face concurrency
conflicts"*, which optimistic locking on each aggregate still has to catch. Affinity is an
argument for accepting a risk, never for removing the version column.

**★ Symptom: a direct object reference between two aggregates that a proposed boundary would
cut.** Cause: Reason Four applied inside a monolith and never revisited. Fix: replace it with
an identity reference plus a read-side projection *before* the split, as a separate change,
so the split itself is not also a performance change.

**★ Using Reason Three to justify a boundary rather than to refuse one.** A mandated global
transaction is a reason to keep components together; it is never a reason to split them and
rely on XA across services, which trades away the availability the split was for.

**★ Applying the four reasons to a service boundary decision as if they were permissions.**
They are exceptions to the *aggregate* rule of thumb. Only two of them — Two and Three —
have any tendency to argue for co-locating services, and both do so by removing an option
rather than by granting one.

## Interview questions

**★ Is one aggregate per transaction an absolute rule?**
No, and its author says so: it is a rule of thumb that *"should be the goal in most cases"*,
with four named exceptions. What matters is that the exception list is closed and specific —
user-interface batch convenience where the batch has no shared invariant; a platform with no
mechanism for out-of-band processing at all; a mandated global transaction; and holding a
direct object reference for query performance. Knowing the four converts a code review from
a judgement call into a question with a checkable answer: which of these is this one?

**★ Which of the four exceptions actually affect where a service boundary goes?**
Really only two, and both by constraining rather than permitting. "Lack of technical
mechanisms" means eventual consistency is unavailable, so anything requiring cross-aggregate
consistency has to sit in one service — the correct response is fewer services, not bigger
aggregates. "Global transactions" means a policy has already declared two components jointly
deployable, so a boundary between them is fictional. The batch-convenience exception imposes
nothing, because the writes are semantically independent. The query-performance exception is
a direct object reference that must be removed before a split, not a reason to avoid one.

**★ How would you tell a genuine batch-convenience case from a cross-aggregate invariant?**
Ask whether writing the members one at a time, in separate transactions, would ever produce
an invalid state. Importing fifty independent baskets: no — each is valid alone, so the batch
is a UI affordance. Allocating a fixed budget across five campaigns so the total is exactly
the budget: yes — a partial write leaves the budget over- or under-allocated, so there is a
real invariant spanning the five and they belong in one consistency boundary. The shape of
the code is identical; only the test distinguishes them.

**★ A team says they cannot use eventual consistency because their platform has no
messaging. What is the right response?**
First, check it, because on Spring Boot 4.1 the claim is usually false —
`@TransactionalEventListener`, `@Async`, `@Scheduled` and Spring Modulith's event publication
registry give durable in-process eventual consistency with no broker at all. If the
constraint is genuine — a regulated runtime with no background execution, or a governance
process that makes a broker infeasible — then accept multi-aggregate transactions within one
service, and specifically do *not* respond by building a large cluster aggregate, which is
the trap Vernon names: it gives you contention and unbounded loading and permanently blocks
any future split.

**★ Where should the exceptions be recorded?**
In the build, as an allow-list attached to the architecture test that detects
multi-aggregate writes, with each entry carrying which reason it is and a ticket reference
where the entry is temporary. That placement matters: an exception in a wiki is invisible at
the moment somebody adds the sixteenth one, whereas an exception that must be added to a test
file is a change a reviewer sees. The allow-list is a debt register, and it should be
reviewed on the same cadence as the architecture.

{/* FOOTER */}
