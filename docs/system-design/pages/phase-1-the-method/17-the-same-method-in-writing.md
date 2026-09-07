---
title: "A design document is the round written down for people who were not in the room — context, goals and non-goals, options with their costs, the decision, risks and rollout — and an architecture decision record is the one-page form that outlives the document, the project and the author"
sidebar_label: "17 · The same method in writing"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. The architectural-decision and ADR definitions are
> [adr.github.io](https://adr.github.io/) (verbatim). The design-document shape — context, goals,
> non-goals, options, decision, risks, rollout — is described as **common practice across large
> engineering organisations, not attributed to any company or standard**; it is method. The
> mapping onto the round's steps is this track's. The written form is what a take-home design
> exercise and a staff loop ask for ([phase 0's staff page](../phase-0-the-interview/01b-staff-and-reading-the-room.md)).
> **No sandbox run.**

**The method does not change when the whiteboard becomes a document; the audience does.** In the
round, the interviewer is present, steers, and sees the reasoning as it happens. A design
document is read alone, asynchronously, by reviewers who will look for the one thing you did not
consider, and — the part that matters most — by engineers two years later who need to know
*why* the system is shaped the way it is, after everyone who decided has left. So the written
form carries what the round carries — requirements, numbers, options with their costs, the
decision, the failure walk, the rollout — with two additions the room never needed: an explicit
list of what the design will *not* do, because a reader cannot ask, and a record of the decision
that is short enough to survive after the document itself is stale. That record is the
architecture decision record: one page, one decision, its context and its consequences, kept
in the repository as a log. This page is the mapping from the round to the document, the
sections and what each must contain, the ADR and when to write one, the review process, and the
writing habits that make a design document read as a decision rather than a description.

## The round, mapped onto the document

| The round's step | The document's section | What changes in writing |
|---|---|---|
| reading the question, clarifying | **Context** — the problem, who has it, what exists today | the questions you would have asked are answered up front, with the assumptions marked |
| functional requirements ([01](01-functional-requirements.md)) | **Goals** | numbered, testable, short |
| the out-of-scope list | **Non-goals** | mandatory in writing — the reader cannot ask "does this cover returns?" |
| non-functional requirements ([02](02-non-functional-requirements.md)) | **Requirements** with numbers | every adjective becomes a number with a source |
| estimation ([03](03-back-of-the-envelope-estimation.md)) | **Scale**, or an appendix | the chain of assumptions shown; the reviewer checks the factors, not the product |
| the API sketch, data model ([05](05-the-api-sketch.md), [06](06-the-data-model-from-access-patterns.md)) | **Design** | the endpoints and tables that matter; the rest linked |
| the diagram, the paths ([07](07-the-high-level-diagram.md), [08](08-read-path-and-write-path.md)) | **Design** — one container-level diagram, the two paths as numbered lists | a sequence diagram for the write path where the ordering is the point (**18 · Diagrams that scale** *(not written yet)*) |
| the deep dive, trade-offs ([09](09-choosing-the-deep-dives.md), [10](10-trade-offs-in-one-sentence.md)) | **Options considered** — each with its cost, the rejected ones with the failure that rejected them | the four-clause sentence becomes a row per option |
| the failure walk ([11](11-bottlenecks-and-single-points-of-failure.md)) | **Risks and mitigations** | a table: risk, likelihood, what the buyer sees, mitigation, owner |
| cost ([13](13-designing-for-cost.md)) | **Cost** | the ranked lines and their drivers; per-unit where possible |
| evolution ([14](14-evolution-and-operations.md)) | **Rollout** — phases, migrations, flags, the step back at each phase | the not-yet list with its triggers |
| the wrap-up | **Open questions** and **Decision** | the decision at the *top*, not the end |

The one section the round has no analogue for is **Non-goals**. On a whiteboard the interviewer
asks "and returns?"; in a document the reader assumes the omission was an oversight unless the
document says it was a choice.

## What each section must contain

**Context.** Three paragraphs at most: what the system does today, what has changed — a
number, a product decision, an incident — and why a design is needed now. A reader who already
knows the system should be able to skip it; a reader who does not should need nothing else.

**Goals and non-goals.** Two numbered lists. A goal is testable: "a checkout that never double
charges" rather than "a robust checkout". A non-goal is a thing a reasonable reader would
expect and is not getting: "multi-currency", "returns", "a second region". The non-goals list
is where scope disputes are settled before review, and it is the section reviewers read first.

**Requirements with numbers.** The non-functionals from the round, each with a figure and where
it came from: "checkout under one second at p99 — the current p99 is 1.8 s; product asked for
under one". A requirement without a number is a wish.

**Options considered.** The heart of the document, and the section most often written last and
thin. For each option — the chosen one and at least one rejected — the same four clauses as the
round: what it is, what it buys against a requirement above, what it costs, and for the
rejected ones the failure that rejected them. A table with one row per option and the
requirements as columns makes the comparison legible. An option list of one is a description,
not a design.

**Decision.** One paragraph, at the top of the document as well as here, in the four-clause
form: "we will commit the order before calling the provider, over charging inside the
transaction, because a row lock must not span a network call; we accept a pending state, a
stock expiry and a reconciliation job." Readers who stop after the first screen leave with the
decision.

**Design.** One diagram at the container level; the write path and the read path as numbered
lists or a sequence diagram; the endpoints and tables the decision touches. Everything else —
the full schema, every endpoint — is linked, not inlined. A design section that runs to twenty
pages has stopped being a decision document.

**Risks and mitigations.** The failure walk as a table. The reviewer's job is to find the risk
you missed; listing the ones you found, with what the buyer sees and the mitigation, moves the
review from "did you think of X" to "is the mitigation for X enough".

**Rollout.** Phases, each with the migration it carries, the flag that gates it, and the step
back if it fails ([14](14-evolution-and-operations.md)). A rollout with no step back is the
section a reviewer should refuse to approve.

**Cost.** The ranked lines and their drivers, per unit where the business will read it.

**Open questions.** The things the author does not know, named as such, each with who can
answer it. A document with no open questions has hidden them.

## The architecture decision record

The document goes stale; the decisions in it do not. The ADR is the form that keeps them:

> *"A justified design choice that addresses a functional or non-functional requirement that is
> architecturally significant."* — adr.github.io, on an architectural decision

> *"Captures a single AD and its rationale; Put it simply, ADR can help you understand the
> reasons for a chosen architectural decision, along with its trade-offs and consequences."* —
> adr.github.io, on the record

One decision per record; the collection in a repository is the project's decision log. The
shape is fixed and short, and the storefront's first one looks like this:

```markdown
# ADR-0003 — Commit the order before calling the payment provider

**Status:** accepted (2026-09-07). Supersedes none. Superseded by none.

## Context
Checkout holds a row lock on `inventory` while the payment provider is called. The provider's
p99 is 8 s and its timeout is 30 s. On sale day the inventory row for the sale item serves at
most one checkout per lock-hold time; with the call inside the transaction that is under one
checkout every eight seconds against an observed sixty a second.

## Decision
The order is committed in state `pending` with its inventory reservation and outbox row in one
local transaction *before* the provider is called. The provider's result — or its absence after
the timeout — moves the order to `paid` or `failed` in a second transaction. A reservation
expires after 15 minutes if no result arrives.

## Options considered
1. Provider call inside the transaction — rejected: lock-hold time is the provider's latency.
2. Optimistic decrement with retry — rejected: the retry storm on the sale item is the same
   contention with more load.
3. Commit-before-call with a pending state — chosen.

## Consequences
- A `pending` state exists and every reader of orders must handle it.
- An expiry job releases reservations; a reconciliation job resolves orders whose provider
  result was lost.
- Double-publish of the order event is possible; consumers are idempotent (ADR-0004).
- Lock-hold time drops from the provider's latency to a local commit, ~5 ms.
```

Write one when a decision is expensive to reverse — a store, a boundary, a consistency choice,
a transaction shape — and *not* for choices a refactor undoes. Status is the field that makes
the log honest: an ADR is never edited into a different decision; it is superseded by a new one
that names it, so the log reads as history. A reviewer of a design document should be able to
find, in the decision log, every ADR the document relies on and the one it will add.

## The review

A design document is reviewed, and the review has its own failure modes:

- **A named set of approvers, and a deadline.** "Comments by Friday; decision Monday" — without
  the deadline the review runs for weeks and the design is decided by whoever stopped
  commenting last. Silence past the deadline is not approval; the author asks each named
  approver for a yes.
- **Comments on the options, not the prose.** A review that fixes sentences has not reviewed
  the design. The reviewer's questions are the round's: which requirement does this option
  serve, what does it cost, what breaks if this box dies, what is the step back.
- **Disagreement recorded, not erased.** A reviewer who preferred option 2 gets a line in the
  document saying so and why the author still chose 3; the future reader learns more from the
  disagreement than from the consensus.
- **The document is the decision, and then it is frozen.** After approval, the ADR is written
  and the document stops changing; changes go in a new document or a superseding ADR. A
  document edited for a year is a wiki page, and nobody knows what was approved.

## Writing habits that make it a decision

- **The decision first.** The opening screen carries the problem in a sentence, the decision in
  the four-clause form, and the cost. Everything below is evidence.
- **Numbers, not adjectives.** "Fast" is a wish; "under one second at p99, currently 1.8 s" is a
  requirement. Every adjective in a draft is a number not yet found.
- **Every option gets its cost.** An option described only by its benefits was not considered;
  it was advertised.
- **Short, with links.** The document is the decision and the reasoning; the schema, the full
  API, the estimation arithmetic are appendices or links. A reviewer who has to read twenty
  pages to find the decision reviews the first three and approves the rest unread.
- **The reviewer's questions pre-answered.** The failure walk, the not-yet list and the open
  questions are there because those are the questions; answering them in the document turns
  the review into a check rather than an interrogation.
- **Written for the reader two years out.** They have the code and not the context; the
  document's job is the context, and the ADR's job is to still be findable when the document is
  not.

## In the interview

Three forms ask for the written method. A **take-home design exercise** is the document above
in four to eight pages, and it is graded on non-goals, options with costs and the rollout —
the sections that show judgement — rather than on the diagram. A **staff loop** asks for a
design document you have written, and the questions are about the review: who disagreed, what
changed, what you would decide differently now. And the in-round question **"how would you
write this up?"** wants the mapping table above said in a minute, ending with "and an ADR for
each decision that is expensive to reverse — the transaction shape, the log, the cart store".

## Gotchas

**★ Symptom: the design document has one option.** Cause: the decision made before the
document, then described. Fix: at least one rejected option per decision, with the failure that
rejected it; the comparison table with requirements as columns.

**★ Symptom: no non-goals section; review comments are all scope.** Cause: the round's
out-of-scope list forgotten in writing. Fix: a numbered non-goals list, read first by every
reviewer, that names what a reasonable reader would expect and is not getting.

**Symptom: the decision is on page nine.** Cause: the document written in the order it was
thought. Fix: decision, cost and the problem on the first screen; the rest is evidence.

**Symptom: "the system will be highly available and fast".** Cause: adjectives where numbers
belong. Fix: each requirement as a figure with a source — the current value and the target.

**Symptom: the review ran for three weeks and ended by exhaustion.** Cause: no approvers, no
deadline. Fix: named approvers, a comment deadline, a decision date, and an explicit yes from
each — silence is not approval.

**Symptom: the ADR was edited when the decision changed.** Cause: the log treated as a wiki.
Fix: a new ADR with status *accepted* that names the old one as *superseded*; the old one keeps
its text and gets the status change only.

**Symptom: an ADR for every choice, including the linter.** Cause: no test for significance.
Fix: an ADR for decisions expensive to reverse — stores, boundaries, consistency, transaction
shape — and nothing for what a refactor undoes.

**Symptom: the rollout section says "deploy and monitor".** Cause: the evolution step skipped
in writing. Fix: phases, each with its migration, its flag and its step back; a reviewer should
refuse a rollout with no way back.

**Symptom: the take-home is twenty pages, mostly diagrams.** Cause: description mistaken for
design. Fix: four to eight pages; non-goals, options with costs, risks and rollout carry the
marks; the diagrams are one container-level view and one sequence diagram for the write path.

## Interview questions

**★ How would you write this design up?**
As the round in document form: context, goals and a non-goals list, requirements with numbers,
scale as an appendix with the arithmetic shown, the design with one container-level diagram and
the two paths, options considered with each one's cost and the rejected ones' failures, the
decision in the four-clause form at the top, risks as the failure walk in a table, a rollout
with a step back per phase, cost per unit, and open questions with owners. Then an ADR for each
decision that is expensive to reverse — the transaction shape, the log over a queue, the cart
store — kept in the repository as a decision log.

**★ What is an architecture decision record, and when do you write one?**
A one-page record of a single architecturally significant decision — its context, the decision,
the options considered and the consequences — with a status that is only ever changed by a
superseding record, so the collection reads as the project's history. Written for decisions
that are expensive to reverse: a store, a service boundary, a consistency choice, a transaction
shape. Not written for choices a refactor undoes. It outlives the design document, which goes
stale, and it is what the engineer two years out finds when asking why.

**Why does a document need a non-goals section when the round did not?**
Because the reader cannot ask. In the round the interviewer says "and returns?" and the
out-of-scope answer is given in a breath; a reviewer reading alone assumes an omission was an
oversight unless the document says it was a choice, and the review fills with scope comments.
The non-goals list is read first by every reviewer and settles scope before the options are
discussed.

**How do you run the review so that it ends in a decision?**
Named approvers, a comment deadline and a decision date, stated in the document; comments
directed at the options — which requirement, what cost, what breaks, what is the step back —
rather than at the prose; disagreement recorded in the document with the reason the author
still chose otherwise; an explicit yes from each approver, because silence is not approval; and
the document frozen after approval, with changes going to a new document or a superseding ADR.

**What separates a design document from a description of a system?**
Options with costs and a decision. A description has one design and explains it; a design
document has at least two options per significant decision, each with what it buys against a
requirement and what it costs, the rejected ones with the failure that rejected them, and a
decision in the four-clause form at the top. The non-goals, the risks table and the rollout's
step back are the other tells; a description has none of them.

---

← Prev: [16 · Estimation worked examples](16-estimation-worked-examples.md) · Index: [Phase 1 — The method](README.md) · Next → **Diagrams that scale with the conversation** *(not written yet)*
