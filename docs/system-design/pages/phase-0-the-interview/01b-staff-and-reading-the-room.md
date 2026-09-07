---
title: "The staff answer adds a time axis and an organisation — what breaks first, what is deliberately not built yet, what the team can run — and the room tells you which level it expects if you listen to the follow-ups"
sidebar_label: "01b · Staff, and reading the room"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Technical claims against the Google SRE book —
> [*Embracing Risk*](https://sre.google/sre-book/embracing-risk/) — and the
> [Dynamo paper](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) (§2.3, §4.5).
> What each level is *asked* has no primary source: stated as tendencies, never statistics.
> Second half of topic 01; the first half is
> [01 · Design at each level](01-what-design-means-at-each-level.md). **No sandbox run.**

**A staff answer rarely names a technology the senior answer lacks. It names a sequence and a
constraint — which assumption breaks first, what is deliberately not built until a stated trigger,
and what the team that exists can actually operate.** The senior design is a snapshot that survives
10×; the staff design is a trajectory with the triggers marked on it. And because the loop's level
is stated in the job title but the interviewer's expectation is not, the second half of this page is
about reading the follow-ups: a changed number is the senior test, a changed organisation is the
staff test, and silence after a choice is an invitation to say its cost.

## What "own" means at staff

The questions a staff engineer answers without being asked:

- **Which assumption breaks first, and when?** A counter-based key server is fine at the numbers
  you estimated; it is the first thing to fall over when a marketing campaign makes link creation
  bursty. Say that, and say what you would watch to see it coming.
- **What do we not build yet?** Multi-region, sharding the link table, a custom analytics
  pipeline — each is a real future need and a real present cost. A staff answer names the trigger
  that would justify each, so the design has a *roadmap*, not just a shape.
- **What does it cost to operate?** Not a price list — the SRE book's point is about the shape of
  the curve:

  > *"experience shows that as we build systems, cost does not increase linearly as reliability
  > increments—an incremental improvement in reliability may cost 100x more than the previous
  > increment."* — SRE book, *Embracing Risk*

  A staff engineer uses that to argue for *less* reliability where the user cannot tell:

  > *"a user on a 99% reliable smartphone cannot tell the difference between 99.99% and 99.999%
  > service reliability!"* — SRE book, *Embracing Risk*

- **How does the design get replaced?** Every staff-level design has a migration story — how the
  key scheme changes without breaking existing links, how the order table is split without a
  freeze. The junior design is a snapshot; the staff design is a trajectory.

## The "not yet" list, written down

The single most legible staff habit is a second column next to the diagram. It is short, and each
line has a trigger that is a number or an event, never "later":

| Not built yet | Trigger to build it | What we do instead, for now |
|---|---|---|
| Multi-region | users outside one geography, or a compliance rule that pins data to a region | one region, cross-zone replicas, a CDN in front of the redirect path |
| Sharding the link table | the table passes what one primary node holds comfortably, or p99 write latency climbs with size | one primary, one replica, the key as the primary key so a future shard key already exists |
| A dedicated analytics pipeline | click volume exceeds what the primary's write path absorbs alongside redirects | append clicks to a separate table, roll up nightly |
| A ticket server for keys | random keys start colliding often enough that the existence check dominates the write path | random keys with a unique index and a single retry on collision |

Every row is a decision *deferred with a reason*, which is the opposite of a decision forgotten. An
interviewer who asks "what would you change at 100×?" is handed this table.

## The storefront's checkout at all three levels

| Level | What is on the board |
|---|---|
| SDE-2 | The `createOrder` from the first half: idempotency key, atomic stock decrement, the order row, then a payment call; a `PENDING_PAYMENT` → `PAID` state change on the provider's callback |
| Senior | *Reserve-then-charge* versus *charge-then-reserve*, each with the failure it leaves behind (reserved-but-unpaid stock vs paid-but-unavailable stock); an outbox row written in the same transaction so the order event survives a crash; a reservation TTL so abandoned checkouts release stock; a stated position on what happens when the provider times out (retry with the same idempotency key, never a fresh charge) |
| Staff | The inventory row as the first thing to break at a flash sale, and the two escapes — a per-product reservation ledger or moving the hot products' counters to Redis with periodic reconciliation; the reconciliation job the payment provider forces on you regardless; what the team of six can operate, and therefore which of those escapes is actually available |

Notice that the staff row contains no technology the senior row lacks. It contains a *sequence*
and a *constraint* — what breaks first, and what this team can run.

The Dynamo paper is the model for the "what this team can run" clause too: its quorum is tunable
per service precisely because the operators, not the paper, know their own latency budget:

> *"In this model, the latency of a get (or put) operation is dictated by the slowest of the R (or
> W) replicas. For this reason, R and W are usually configured to be less than N, to provide better
> latency."* — Dynamo, §4.5

A staff answer treats every knob that way: not "the right value" but "the value this team will set,
and what they give up by setting it".

## Reading which level the room expects

The tells, stated as tendencies:

- **Follow-ups that change a number** ("what if writes are 10× reads?") are the senior test. A
  memorised diagram cannot answer them; a reasoned one can.
- **Follow-ups that change the organisation** ("the team is three people", "we have to migrate
  off the counter with zero downtime") are the staff test.
- **An interviewer who stops you from going deep** is telling you the round is scoped at
  breadth; one who keeps returning to one box wants depth there. Read that as the agenda.
- **Silence after your choice** is an invitation to say the cost. Fill it with the trade-off
  sentence, not with more boxes.
- **"What would you do differently at your current company?"** is a staff question in disguise:
  it asks whether your design is shaped by an organisation you know or by a textbook.

When the level is genuinely unclear, answer at senior and *offer* the staff layer: "I can also walk
through what I'd defer and what would trigger building it, if that's useful." An interviewer who
wants it will take it; one who does not will move on, and nothing was lost.

## Gotchas

**★ Symptom: asked "when would you revisit this?" and you have no trigger.** Cause: the design
was presented as final; every deferred item was "later". Fix: keep the "not yet" table and read a
row from it — "sharding, when the table passes what one node holds or p99 writes climb with size;
until then the key is the primary key so the shard key already exists."

**Symptom: the staff interviewer asks "what would you not build?" and you list nothing.** Cause:
every named feature was built. Fix: keep a deliberate "not yet" list next to the diagram, each with
its trigger: "not multi-region until we have users outside one geography; not a custom analytics
pipeline until click volume exceeds what the primary's write path absorbs."

**Symptom: you defended one design against every follow-up.** Cause: treating a changed constraint
as an attack on the design rather than a new requirement. Fix: say "with that change I would
switch to…" out loud. The reversal condition *is* the senior signal; refusing to reverse reads as
rigidity.

**Symptom: told "that's a good design for a much bigger company".** Cause: the operating cost was
never weighed — a design the interviewer's team of five could not run. Fix: ask how big the team
is early, and let it prune: "with five engineers I'd take the managed queue over self-hosted Kafka
and accept the throughput ceiling; that ceiling is far above our estimate."

**Symptom: the migration question ("how do you move off the counter with no downtime?") produces
a rewrite, not a migration.** Cause: the design had no seam. Fix: build the seam in from the start
and say so: new links get the new scheme, old links keep resolving because the redirect path looks
keys up by value, not by scheme; the counter is retired when its last key is older than the
retention window.

**Symptom: you gave the staff answer and the interviewer cut you off.** Cause: the round was
scoped at senior or below and the roadmap read as avoiding the concrete design. Fix: concrete first,
trajectory second — get one component demonstrably right, then offer the deferrals as an add-on
rather than leading with them.

**Symptom: "what breaks first?" answered with "the database".** Cause: the generic answer, true of
every system, graded as no answer. Fix: name the row, the query and the symptom: "the inventory row
for the sale product — every checkout updates it, so lock waits on that one row climb before
anything else; the first symptom is p99 checkout latency, not errors."

## Interview questions

**★ What does a staff-level answer add that a senior answer lacks?**
A time axis and an organisation. Which assumption breaks first and roughly when; what is
deliberately not built yet and what would trigger building it; what the design costs to operate
with the team that exists; and how the design is migrated when it is replaced. The technology named
is usually the same as the senior's. The difference is that the staff answer is a trajectory with
triggers, not a snapshot.

**★ How do you tell which level the interviewer is grading at?**
From the follow-ups. Changed numbers — "10× writes", "a million links a day" — test whether the
design was derived or remembered, which is the senior bar. Changed organisations — "three
engineers", "zero-downtime migration off the counter", "what would you do at your current
company" — test ownership, which is the staff bar. An interviewer who keeps returning to one box
wants depth there; one who stops you going deep wants breadth. When it is unclear, answer at senior
and offer the deferrals and triggers as an optional layer.

**How should you react when a follow-up changes a constraint you designed around?**
Treat it as a new requirement, not an attack. Say what changes: "with writes at 10× reads the
cache stops paying for itself and the write path is the constraint; I'd move key generation off
the counter and partition the table." The willingness to reverse a choice when its reason
disappears is the signal; defending the original design is the anti-signal.

**Why does the SRE book's cost curve matter in a design interview?**
Because it licenses a senior to argue for *less*. The book's claim is that an incremental
improvement in reliability may cost a hundred times the previous increment, and that a user on an
unreliable device cannot tell the difference between four nines and five. A candidate who uses that
to say "the redirect path gets three nines and a cache; the analytics path gets best effort" is
demonstrating exactly the judgement the round exists to find — spending reliability where the user
can perceive it.

**What is a "seam", and why does a staff design need one?**
A seam is the place a design can be changed without a rewrite — the redirect path resolving keys by
value rather than by generation scheme, the order table keyed so a future shard key already exists,
the payment call behind an interface so the provider can be swapped. A staff answer builds seams
deliberately and names them, because the migration question is coming and "we'd rewrite it" is
graded as not having thought about year two.

**Why is "the database" the wrong answer to "what breaks first?"**
Because it is true of every system and therefore says nothing about this one. The graded answer
names the specific resource, the access pattern that saturates it and the first symptom: the
inventory row for the sale product under concurrent checkouts, showing up as p99 latency before
errors; or the key counter under a bursty campaign, showing up as create-link timeouts while
redirects are fine. Specificity is the evidence that the design was reasoned rather than recited.

---

← Prev: [01 · Design at each level](01-what-design-means-at-each-level.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next → **The three rounds that carry the word "design"** *(not written yet)*
