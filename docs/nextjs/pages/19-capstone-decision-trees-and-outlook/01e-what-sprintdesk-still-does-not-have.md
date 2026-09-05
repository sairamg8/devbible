---
title: "The half of a retrospective everybody skips is the honest list of what the application still cannot do — and it is only useful if every entry is marked as a deferral, which is a decision, or a gap, which is an absence, because the two belong in completely different places"
sidebar_label: "01e · What SprintDesk does not have"
sidebar_position: 13
description: "Six deferrals with the reason and the trigger that would end each, seven gaps with the cost and the missing owner, and the classification rule that stops a team relitigating settled questions while never scheduling real work."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 — this page composes material already verified across chapters 7, 11, 12, 13, 15, 16 and 17 of this book against the Next.js 16.3.4 documentation. It introduces no new framework claims of its own; every capability named as missing is one an earlier chapter of this book describes.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**Every retrospective produces a list of what was built. Almost none produces the list of what was not, and the omission is not modesty — it is the reason the same argument recurs every quarter. An application's absences come in exactly two kinds and they are not interchangeable. A *deferral* is a decision: somebody weighed it, chose not to do it, and can say why and what would change their mind. A *gap* is an absence: nobody ever considered it, so there is no reason, no trigger and no owner. Filed correctly, a deferral goes into the load-bearing pile from [01b](01b-the-decisions-that-are-now-load-bearing.md) and stops being re-argued, and a gap goes into the backlog and gets scheduled. Filed wrongly — and the common error is one direction — a team spends a year relitigating settled questions while the real work is never written down at all.**

## The classification rule

| | A deferral | A gap |
|---|---|---|
| What it is | a decision not to build something | an absence nobody decided |
| It must carry | **a reason** and **a trigger** | **a cost** and **an owner** |
| Where it belongs | the load-bearing pile — it is a commitment | the backlog — it is work |
| How it is closed | the trigger fires, and it is reopened with new information | it is scheduled and done |
| How it goes wrong | it is re-argued from scratch every quarter | it is described as "a decision we made", by nobody in particular |

🔴 **The test for which one you are holding is a single question: *who decided, and when?*** A name and a date makes it a deferral. A shrug makes it a gap, and the shrug is the answer far more often than anybody expects — [01ba](01ba-the-inherited-pile.md) is the same question asked about defaults instead of features.

## The deferrals

Six, each with the reason it was deferred and the observable event that should reopen it.

### D1 · Concurrent writes to the same card

**Reason.** Chapter 15 answers *which* — which driver, which pooling model, which entry point. **Chapter 16** answers *how, concretely, and what breaks*, and its thesis is that **CRUD is easy until two requests overlap** ([chapter 16 overview](../16-building-a-crud-api-with-postgres/01-explanation.md)). SprintDesk's board has not had that pass. Two people dragging the same card resolve as last-write-wins, silently, with both clients showing their own optimistic result until a refresh disagrees with one of them.

**Trigger.** The first report of a card that "moved back on its own". That report is the concurrency finding arriving as a support ticket, and it will not mention concurrency.

⚠️ **This is the deferral most likely to be mistaken for a gap**, because nothing in the codebase records it. It is a deferral only because the chapter that owns it is named and scheduled; if it were not, this entry would be in the second half of this page.

### D2 · No read replica, no multi-region data story

**Reason.** The strongest reason on this page, and it is the framework's own: multi-region compute in front of a single-region database is *"almost always slower than one region"*, because a dynamic request is a handful of sequential database round trips and moving the compute lengthens every one of them while shortening only the hop the CDN already handled. On top of that, `preferredRegion` is deprecated in 16 with no framework-level replacement ([ch17 · multi-region and data locality](../17-deployment-scaling-and-observability/03-multi-region-strategies-and-data-locality-patterns.md)).

**Trigger.** Users concentrated in a second region **and** a plan for the data to follow them. Not the first condition alone — that is the mistake the chapter exists to prevent.

### D3 · The queue has no priority and no fairness

**Reason.** One job kind, one latency expectation. `FOR UPDATE SKIP LOCKED` hands each worker whatever the claim query's ordering returns, and with a single job type that ordering is the whole policy ([ch15 · Postgres as a queue](../15-databases-apis-and-full-stack-patterns/04d-postgres-as-a-queue-skip-locked.md)).

**Trigger.** A second job kind with a different latency expectation — the moment a password-reset email queues behind four thousand digest jobs, ordering becomes a product decision rather than a `ORDER BY` clause. A per-tenant fairness problem arrives at the same moment: one large tenant's backlog is currently everybody's backlog.

### D4 · SSE has no back-pressure strategy beyond the protocol shape

**Reason.** The board's event rate is low, and the stream is already snapshot-plus-delta with durable events resumable by `Last-Event-ID`, which is the shape that makes dropping safe. Chapter 15 names the three honest strategies for a push source outrunning its client — shed, coalesce, or persist — and SprintDesk has chosen none of them explicitly ([ch15 · pull sources and back-pressure](../15-databases-apis-and-full-stack-patterns/03e-pull-sources-and-back-pressure.md)).

**Trigger.** Any bulk operation on a board — an import, a column-wide move, a template applied. That is the first time the producer can outrun a reader, and the queue that grows is in the server's heap.

### D5 · WebSockets

**Reason.** Already recorded in the load-bearing pile, which is exactly where a deferral belongs: a Route Handler cannot express a protocol upgrade, and a socket needs a process that outlives the request, which deletes one of the two deployment targets ([01b](01b-the-decisions-that-are-now-load-bearing.md)).

**Trigger.** A feature that genuinely needs client-to-server streaming rather than server-to-client push — collaborative cursors, live text editing. Nothing SprintDesk has today qualifies, and polling or SSE-down-plus-POST-up covers the rest.

### D6 · An external message broker

**Reason.** The transactional enqueue. The job row is inserted in the same transaction as the write that causes it, and no broker can join that transaction — [01b](01b-the-decisions-that-are-now-load-bearing.md) covers the arithmetic of the reversal.

**Trigger.** Job volume that a Postgres table cannot serve without contending with user-facing queries, or a job kind that must survive the database being unavailable. Both are real; neither is true yet.

## The gaps

Eight, each with what it costs and the fact that nobody owns it. **None of these has a reason, because nobody decided anything.**

### G1 · No negative authorization test

**Cost.** [01d](01d-the-checklist-pass-security-and-the-data-access-layer.md) records that the review heuristic *"does this action verify auth"* returns true for every action in the application, and that only a test where a valid session acts on another team's id can distinguish an action that checks the relationship from one that checks only the session. Chapter 13's suite has the tenancy predicate test; it does not have this one.

🔴 **This is the cheapest artefact on the page and it guards the most expensive failure.** It is first.

### G2 · No per-tenant rate limits

**Cost.** Three operations whose cost is borne outside the request — the digest enqueue, an SSE stream open, an attachment upload — are unbounded, and the checklist's own wording (*"consider rate limiting for expensive operations"*) was read as optional rather than as a trigger. This is a gap and not a deferral for the specific reason that **nobody ever decided against it.**

### G3 · No audit log

**Cost.** Nothing records who moved which card, when, or what the data access layer returned to them. The consequence is not felt in normal operation and is total during an incident: after a suspected tenancy leak the question is *"what did they actually see"*, and an application without an audit log cannot answer it — which means the incident cannot be scoped, and an unscopeable incident is disclosed at its maximum plausible extent.

### G4 · No soft delete

**Cost.** A deleted board is gone. There is no undo, no recovery window and no way to answer a customer who deleted the wrong thing. Every application eventually grows this feature; the ones that grow it late do so under pressure, from a backup, by hand.

### G5 · No SLO

**Cost.** Chapter 11's audit produced spans that outlive their author, and chapter 17 put one instrumentation file behind both deployments — so SprintDesk can *measure*. It has never *promised*. A span is a number; an SLO is a threshold, a window and an owner, and without one there is no definition of "SprintDesk is up" that two people would state the same way, which means there is nothing for an alert to fire against.

### G6 · No incident runbook

**Cost.** This one is half-built, which is why it is easy to miss. Chapter 7's milestone produced a failure map with a chosen degradation rung per dependency ([ch7 · full error boundary coverage](../07-error-handling-loading-states-and-resilience/07-project-milestone-sprintdesk-gets-full-error-boundary-covera.md)) — that is the *user-facing* half. The operator-facing half does not exist: what an on-call engineer checks first, in what order, for each of the six seams chapter 15 named. The map says what the user sees; a runbook says what you do, and the difference matters most at 3am when the person reading it did not write it.

### G7 · Accessibility is audited, not gated

**Cost.** Chapter 12's milestone included an accessibility pass, and it was an event. `next lint` was removed and `next build` no longer lints, so nothing has enforced it since — as [01c](01c-the-checklist-pass-rendering-caching-and-the-build.md) records, a project that never added an explicit lint step has had no a11y rule fire, silently, with no configuration change to point at. The cost is that the audit's result decays from the day it was signed off, and nothing reports the decay.

### G8 · No Content Security Policy and no security-header set

**Cost.** The official checklist carries this one verbatim — *"**Content Security Policy**: Consider adding a Content Security Policy to protect your application against various security threats such as cross-site scripting, clickjacking, and other code injection attacks"* — and it was read exactly the way G2's *"consider rate limiting"* was read: as optional. Nothing in SprintDesk emits a CSP, and nothing emits the non-CSP header set that belongs beside it in `headers()` in `next.config` — `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` ([Appendix D part 2](../20-appendices/04b-appendix-d-security.md)).

⚠️ **The Next.js-specific difficulty is real and is the reason this is harder than a config line**: a strict CSP and a framework that inlines scripts are in tension, so the workable shape is a per-request nonce generated in `proxy.ts` and threaded through. SprintDesk already has a `proxy.ts` — which makes this the one gap on the page whose remediation has a file waiting for it, and also the one where the `middleware` to `proxy` rename means the runtime underneath that file is Node.js and not configurable.

## Where each of these goes

This is the payoff, and it is the reason the page exists at all rather than being a list of regrets.

**The six deferrals belong in [01b](01b-the-decisions-that-are-now-load-bearing.md)'s load-bearing pile**, with their reason and trigger attached, in the repository's context file where the next change has to read them — chapter 14's milestone is [decisions, not advice](../14-agent-driven-development/07-project-milestone-sprintdesk-gets-an-agentsmd.md), and a deferral is a decision. Written down, D2 answers "should we deploy to Europe?" in one sentence for the next three people who ask it. Not written down, it is answered from scratch, badly, every time.

**The eight gaps belong in the backlog with an owner and an estimate**, in the order their failure costs the most: G1, then G2, then G3, then the rest. A gap does not need a discussion; it needs a ticket.

⚠️ **Two of the eight — G2 and G8 — are on the official checklist under the word "consider", and both were read as optional.** That is worth noticing as a pattern rather than as two coincidences: a checklist item phrased as a suggestion produces a gap rather than a deferral, because nobody records a decision about a suggestion. When you write your own checklist, "consider X" is the phrasing to avoid.

🔴 **The failure mode is one-directional and worth naming precisely.** Gaps get described as deferrals — *"we decided not to do audit logging"*, said by somebody who was not in a meeting that never happened — and once an absence has been re-labelled as a decision it stops being schedulable, because reopening it requires an argument rather than a sprint. The reverse error is rarer and cheaper: a deferral treated as a gap merely wastes the discussion again.

## Gotchas

**★ Symptom: the "what we don't have" list is written, and six months later the same items are still on it, unchanged.** Cause: nothing on the list was classified, so every item needs a discussion before it needs an engineer. Fix: mark each entry as a deferral or a gap and require the missing fields — reason and trigger for one, cost and owner for the other. An entry that cannot be given its fields is not ready to be on the list.

**★ Symptom: "we decided not to do that" is said about something nobody remembers deciding.** Cause: a gap acquired the language of a deferral through repetition. Fix: ask for the name and the date. If neither exists it is a gap, and it goes to the backlog rather than back into the discussion.

**★ Symptom: a customer deletes the wrong board and the recovery is a manual restore from a backup by an engineer.** Cause: no soft delete, filed as an absence nobody costed. Fix: a `deleted_at` column and a predicate in the data access layer alongside the tenancy predicate — which is the cheapest place to add it precisely because the layer already exists and every query already goes through it.

**★ Symptom: after a suspected data-isolation incident, nobody can say which records were exposed.** Cause: no audit log, so the only evidence is application logs written for debugging. Fix: log the authorization decisions, not the requests — who asked, for which tenant's data, and what the data access layer returned. Without that the incident is scoped at its maximum plausible extent, which is the worst possible disclosure.

**★ Symptom: an on-call engineer pages the person who wrote the feature, every time.** Cause: the failure map is user-facing and there is no operator-facing runbook, so the knowledge of what to check first lives in one head. Fix: write the check order for each of the six seams — the acceptance questions from chapter 15's milestone are already the right questions; the runbook is those questions with the answer for *your* deployment written next to each.

**★ Symptom: the team argues about deploying to a second region for the third time this year.** Cause: a well-reasoned deferral was never recorded, so it is re-derived from scratch, badly, by whoever is in the room. Fix: record the reason and the trigger in the context file. "Compute must follow data; revisit when we have users concentrated in a second region *and* a plan for the data" is one line, and it ends the argument permanently rather than for a week.

**★ Symptom: a password-reset email arrives forty minutes late, and the queue is healthy.** Cause: it queued behind a large tenant's digest backlog; there is no priority and no per-tenant fairness, because with one job kind neither was needed. Fix: this deferral's trigger has fired — the ordering in the claim query is now a product decision, and the fix is a priority column plus a fairness key, not more workers.

**★ Symptom: an accessibility regression ships six months after a clean audit.** Cause: the audit was an event and nothing gates it, because `next lint` was removed and `next build` no longer lints. Fix: an explicit lint job in CI. The general form is worth stating: any quality that was established by an audit and is not enforced by a gate is decaying from the day it was signed off, and nothing reports the decay.

**★ Symptom: an alert fires constantly and nobody trusts it, or nothing fires at all during an outage.** Cause: there is instrumentation but no SLO — spans measure, and a threshold with a window and an owner is what an alert needs to be about. Fix: write one sentence defining "up" for the board route, with a number and a window, and let the alert be about that sentence. One SLO that people believe is worth more than a dashboard nobody reads.

**★ Symptom: a penetration test reports missing security headers on an application that passed its own security review.** Cause: the checklist item says *"consider adding a Content Security Policy"*, and an item phrased as a suggestion generates no decision and therefore no record — it produces a gap that looks like it was considered. Fix: add the non-CSP headers through `headers()` in `next.config` first, because they are unconditional, then do the nonce work in `proxy.ts` for the CSP itself. And rewrite the item in your own checklist as an assertion, because "consider" is what let it through.

**★ Symptom: the gap list is thirty items long and demoralising.** Cause: it mixed absences with deferrals and with things that are simply not features of this product. Fix: only list what an earlier decision, chapter or checklist actually implies you should have. A gap is the absence of something you *needed*; everything else is just software you have not written, and there is an infinite supply of that.

## Interview questions

**★ What is the difference between a deferral and a gap, and why does the distinction earn its keep?**
A deferral is a decision not to build something: somebody weighed it, and it carries a reason and a trigger that would reopen it. A gap is an absence nobody considered: it carries a cost and needs an owner. They earn the distinction because they belong in different places and are closed by different actions. A deferral belongs with the load-bearing decisions, where the next change will read it, and it is closed when its trigger fires. A gap belongs in the backlog and is closed by being scheduled. The test that separates them is a single question — who decided, and when — and a shrug is a complete answer meaning "gap".

**★ Which direction does the misfiling usually go, and what does it cost?**
Gaps get relabelled as deferrals. Somebody says "we decided not to do audit logging" about a meeting that never happened, and from that moment the absence is protected by a decision nobody made: reopening it now requires an argument rather than a ticket, so it never gets scheduled. The reverse error — treating a real deferral as a gap — costs a repeated discussion and nothing else. That asymmetry is why the who-and-when question is worth asking pedantically, including of yourself.

**★ SprintDesk has no multi-region deployment. Is that a problem?**
No, and it is the best-justified absence in the application. Multi-region compute in front of a single-region database is almost always slower than one region, because a dynamic request is several sequential database round trips and moving the compute lengthens all of them while shortening only the hop the CDN already handled. The API you would reach for, `preferredRegion`, is deprecated in 16 with no framework-level successor — region placement is a platform concern now. So this is a deferral with a documented reason, and its trigger has two conditions rather than one: users concentrated in a second region *and* a plan for the data to follow them. Firing on the first condition alone is the mistake.

**★ Why is a missing audit log a gap rather than a nice-to-have?**
Because of what it costs at exactly one moment. In normal operation nobody notices. During a suspected data-isolation incident the only question that matters is what the affected party actually saw, and an application that logged requests rather than authorization decisions cannot answer it. An incident that cannot be scoped is disclosed at its maximum plausible extent, which is usually far larger than the real one. The cost is therefore not a feature gap, it is the difference between "eleven records were exposed" and "we cannot rule out any record", said to a customer.

**★ The failure map from the error-handling chapter exists. Why is that not a runbook?**
Because it faces the wrong direction. The failure map says what the *user* experiences when each dependency degrades — which rung of the ladder they land on — and it was written to make degradation a decision rather than an accident. A runbook says what the *operator* does: what to check first, in what order, with the answer for this deployment written next to each check. Chapter 15's six acceptance questions are already the right questions for SprintDesk; a runbook is those questions with your connection ceiling, your migration gate and your cache layers filled in. The gap is not knowledge, it is that the knowledge is in a chapter and not in a file the on-call engineer can open.

**★ Concurrent writes to the same card are unresolved. Why is that a deferral rather than a bug?**
Because the chapter that owns it is named and the resolution is scheduled — chapter 16's thesis is that CRUD is easy until two requests overlap, and every interesting decision in a CRUD API is a decision about what happens when two requests arrive at once. Until that pass, two people dragging the same card resolve as last-write-wins, both clients show their own optimistic result, and nothing errors. That is a known, bounded, recorded consequence with a trigger — the first report of a card that moved back on its own — which is what makes it a deferral. Had nobody named it, the identical situation would be a gap, and the difference is entirely in whether it was written down.

**★ You have limited time. Which absence do you close first, and why that one?**
The negative authorization test. It is the cheapest artefact on the list — a test where a valid session acts on another team's id and is expected to fail — and until it exists nobody can distinguish an application that checks relationships from one that checks only sessions, because every positive test passes either way. The failure it guards is a cross-tenant data exposure, which is the only item on the page whose cost is categorically different from the others. Per-tenant rate limits are second, because they are an open gap on operations whose cost leaves the request; the audit log is third, because it is what makes the first two failures survivable when they happen anyway.

**★ Two of these gaps are items the official checklist actually contains. How did they get missed?**
Both are phrased as "consider" — consider rate limiting for expensive operations, consider adding a Content Security Policy — and a suggestion does not generate a decision. Nobody writes down that they considered something and declined; they simply move to the next line. So the item leaves no trace either way, which means it produces a gap that is indistinguishable from a deferral six months later, and the team's honest belief is that it was reviewed. The lesson transfers to any checklist you write yourself: phrase every item as an assertion with an observation attached, and let the reviewer record a deliberate exception if they want one. "Consider" is the word that lets an item through a review without leaving evidence that it did.

**★ How do you keep this list from becoming a demoralising thirty-item backlog nobody reads?**
Only list absences that an earlier decision, chapter or checklist implies you should have had. A gap is the absence of something needed; everything else is software not yet written, and there is an unlimited supply of that. Then classify every entry, give it its required fields, and move the deferrals out of the list entirely into the decision record — they are not work, and leaving them among the work is what makes the list feel infinite. What remains is a small ordered set of tickets with owners, which is a backlog rather than a confession.

{/* FOOTER */}
