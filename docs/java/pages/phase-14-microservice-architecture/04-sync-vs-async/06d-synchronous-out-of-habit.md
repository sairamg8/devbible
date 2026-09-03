---
title: "Nine kinds of call are synchronous in almost every codebase for no reason anyone can articulate, and each one has a named replacement that is neither exotic nor expensive"
sidebar_label: "28 · Synchronous out of habit"
sidebar_position: 28
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io "Pattern: Messaging"
> ([microservices.io](https://microservices.io/patterns/communication-style/messaging.html)),
> "Pattern: Event-driven architecture"
> ([microservices.io](https://microservices.io/patterns/data/event-driven-architecture.html)),
> Martin Fowler, "What do you mean by 'Event-Driven'?"
> ([martinfowler.com](https://martinfowler.com/articles/201701-event-driven.html)), and
> RFC 9110 §15.3.3 ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html)).
> 🔴 **No sandbox, and no broker mechanics** — phase 15 owns those. Version spine: JDK 25 ·
> Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[25 · What must be synchronous](06-what-must-be-synchronous.md) produced a table where three
of fourteen hops were genuinely required. This chunk is the other eleven, sorted into the nine
recurring shapes, each with the replacement, the objection you will hear, and the answer to it.
None of the replacements requires a broker in its cheapest form. The reason these calls persist
is not difficulty; it is that adding one is a one-line change and removing one requires somebody
to have noticed.**

## 1 · Enrichment for display

**"Fetch the customer's name / the product title / the category to put in the response."**

The largest category by count. Replacement: a local copy —
[27 · The read that could have been a copy](06c-the-read-that-could-have-been-a-copy.md), or,
for anything describing a past event, denormalisation onto your own aggregate at write time.

*Objection*: "we'd be duplicating their data." *Answer*: yes, three fields of it, and the
alternative is a hard dependency on the read path of a page users load constantly.

## 2 · Existence checks

**"Call Customer Service to check the customer exists before creating the order."**

Almost always advisory rather than gating ([25](06-what-must-be-synchronous.md)). If the customer
does not exist, the order fails downstream anyway; you are paying a synchronous hop on 100% of
requests to catch a case that occurs in a fraction of a percent, and the check is racy regardless
— the customer could be deleted a millisecond after it returns.

Replacement: rely on the foreign-key-shaped constraint where the value is actually used, or
validate against a local copy. Where an identifier is supplied by an authenticated caller, the
token already proves the subject exists.

## 3 · Audit and compliance records

**"Write an audit entry to the audit service before returning."**

Replacement: an event. Audit consumers are the canonical asynchronous consumer — they need
completeness, not immediacy.

*Objection*: "compliance requires the audit record." *Answer*: compliance requires that the record
*exists*, which a durable handoff guarantees at least as well as a synchronous call that can fail
after the business change committed. A synchronous audit call is in fact **worse** for
completeness, because when it fails you either fail the user's operation over an audit record or
you swallow the error and lose the record — both bad. An outbox row committed with the business
change loses nothing.

## 4 · Notifications to humans

**"Send the confirmation email / SMS / push before returning."**

Replacement: an event, or a row in your own table drained by a poller.

*Objection*: "the user expects the email." *Answer*: they expect it within a minute, not within
your HTTP response. Coupling order placement to an SMTP relay's availability makes email outages
into order outages.

## 5 · Search and read-model indexing

**"Index the order so it appears in the order list."**

Replacement: an event. This is CQRS in its most ordinary form, and **03 ·
Database-per-service** *(not written yet)* owns the read-model discussion.

*Objection*: "the user will place an order and not see it in the list." *Answer*: a real problem
with a well-known set of solutions — read-your-writes handling on the client — and it is
**39 · Eventual consistency reaches the UI** *(not written yet)*, not an
argument for a synchronous index write.

## 6 · Analytics and metrics

**"Post the event to the analytics service."**

Replacement: an event, or a local log the analytics pipeline scrapes.

There is rarely an objection to this one; it survives because nobody looked at it. It is the
easiest single hop to delete in most codebases, and it frequently has the *worst* timeout
configuration because nobody considered it load-bearing.

## 7 · Cache and CDN invalidation

**"Invalidate the cached product page after the update."**

Replacement: an event, or a short TTL that makes the invalidation unnecessary.

*Objection*: "the cache must be correct immediately." *Answer*: sometimes true for a price, rarely
true for anything else. And a synchronous invalidation that fails leaves the cache wrong *and*
fails the write, which is strictly worse than an event that retries.

## 8 · Downstream work that must happen

**"Tell the warehouse. Tell the billing system. Tell the partner."**

Replacement: an event with a durable handoff, plus monitoring on the consumer.

*Objection*: "this must happen." *Answer*: it must happen; it need not happen *now*. This is the
rephrasing from [25](06-what-must-be-synchronous.md), and it converts more objections than
anything else in this topic. The obligation it creates is real: a durable handoff and a monitored
consumer, because "must happen" now needs an alarm rather than a stack frame.

## 9 · Long-running work the caller waits for

**"Generate the report / process the upload / run the export, and return it."**

Replacement: `202 Accepted` and a status resource. RFC 9110 §15.3.3 describes exactly this
purpose:

> *"The 202 response is intentionally noncommittal. Its purpose is to allow a server to accept a
> request for some other process (perhaps a batch-oriented process that is only run once per day)
> without requiring that the user agent's connection to the server persist until the process is
> completed."*

Detail in [29 · The user who is waiting](06e-the-user-who-is-waiting.md).

*Objection*: "the client can't handle a status resource." *Answer*: sometimes true and it is a
client work item, not an architecture constraint. A long synchronous request holds a thread, a
connection and often a proxy timeout you do not control.

## The pattern behind all nine

Look at what 3 through 8 have in common: **the caller does not use the result.** It calls, ignores
or barely checks the response, and continues. That is the loudest signal in a codebase that a hop
is synchronous by habit:

```java
auditClient.record(new AuditEntry(...));       // return value ignored
emailClient.sendConfirmation(order);           // return value ignored
searchClient.index(order);                     // return value ignored
analyticsClient.track("order_placed", order);  // return value ignored
```

Four hard dependencies, four timeouts, four availability terms, four entries in the tail
arithmetic — and **not one line of code uses what any of them returned.** A method whose return
value is discarded is not asking a question; it is making a statement. Statements go on a queue.

**This is a `grep`-able heuristic**: find client calls whose results are unused. It is the fastest
first pass over an unfamiliar codebase and it finds real hops every time.

## Gotchas

**★ A synchronous audit or notification call is worse for reliability than an event, not better.**
When it fails you must either fail the user's operation or swallow the error and lose the record.
An outbox row committed with the business change does neither. "Compliance requires it to be
synchronous" inverts the actual reliability argument.

**★ Existence checks are racy and therefore not the guarantee they appear to be.** The entity can
be deleted the instant after the check returns, so the check narrows a window rather than closing
it. If the correctness argument depends on the window being closed, the check was never sufficient
and something else has to enforce it.

**★ Habitual hops usually have the worst timeout configuration in the service**, because nobody
considered them important enough to budget. The analytics call with a thirty-second default is
exactly the one that will exhaust your thread pool during that provider's incident — see
[16 · Bimodal latency and exhaustion](04e-bimodal-latency-and-exhaustion.md).

**★ Removing a habitual hop introduces a consumer somebody must own.** An event with no monitored
consumer is a silent failure waiting to be discovered by an auditor. The work is not "delete the
call"; it is "move the work and put an alarm on it". Budget for the second half.

**★ Ignoring a client call's return value is a signal, not a style issue.** It says the caller
does not need the answer, which means the interaction is a notification wearing a request/reply
shape — the worst combination, because you pay the coupling and get no result. Treat a discarded
client result as a review finding.

**★ Nine categories does not mean nine separate projects.** Most of them collapse into two pieces
of infrastructure: a durable handoff (an outbox table plus a drainer, or a broker), and a local
copy mechanism. Build those once and the nine become configuration.

## Interview questions

**★ Name the kinds of synchronous call that are usually habit rather than necessity.**
Enrichment for display, existence checks, audit and compliance writes, notifications to humans,
search and read-model indexing, analytics, cache invalidation, downstream work that must happen
but not now, and long-running work the caller waits for. Their replacements are a local copy, a
constraint at the point of use, and an event or `202 Accepted` respectively. None of the
replacements is exotic, and in their cheapest form none requires a broker.

**★ What is the fastest way to find these in an unfamiliar codebase?**
Find calls to remote clients whose return value is discarded. A method whose result nobody uses is
not asking a question — it is announcing something — and announcements belong on a durable queue,
not on the request path. Each such call is currently costing a timeout, an availability term and a
tail-latency draw for no informational benefit whatsoever. It is a five-minute `grep` and it
finds real hops nearly every time.

**★ Why is a synchronous audit call worse for compliance than an asynchronous one?**
Because its failure mode forces a bad choice. If the audit service is down, either you fail the
user's business operation over a bookkeeping record, or you catch the exception and lose the
record — and in practice teams choose the second, so the synchronous design loses audit entries
precisely during incidents. An outbox row committed in the same transaction as the business change
cannot be lost, and it is delivered whenever the audit consumer recovers. Completeness is what
compliance asks for, and the asynchronous design gives more of it.

**★ How would you respond to "but this work must happen"?**
By agreeing and separating "must happen" from "must happen now". The warehouse must be told; there
is no requirement that it be told inside the HTTP response. Making it asynchronous does not weaken
the guarantee provided the handoff is durable — committed in the same transaction as the business
change — and provided the consumer is monitored. The obligation it creates is an alarm on consumer
lag and dead letters, which is a real cost and much smaller than an availability term on the
critical path.

**★ Your service ignores the return value of four different client calls. What does that tell
you?**
That four interactions are notifications implemented as request/reply, which is the worst
combination available: you pay full temporal coupling, four availability terms, four timeouts and
four tail draws, and you receive no information in exchange. Each of the four should be a durable
handoff — an event or an outbox row — with an owner and an alarm on the consumer side. It is also
worth checking their timeout configuration first, because calls nobody considered important tend
to have the most dangerous defaults.

{/* FOOTER */}
