---
title: "A reasoned wrong answer beats a memorised right one, because the follow-up — \"what if writes are ten times reads?\" — is the real test, and a memorised diagram cannot answer it"
sidebar_label: "08 · Reasoned beats memorised"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method, not a quoted standard; interview-format observations are
> tendencies. The one technical claim — that Dynamo's design is derived from a stated requirement —
> is quoted from the [Dynamo paper](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf)
> §2.3. **No sandbox run.**

**The canonical designs are public, so producing one carries no information about you. What
carries information is whether the design was derived — and the interviewer finds out with one
follow-up that changes a constraint.** A candidate who reasoned from requirements to a design that
is slightly wrong re-derives under the new constraint and arrives somewhere sensible; a candidate
who reproduced the correct diagram from memory has nothing to re-derive from and stalls. The
interviewer would rather hire the first, because the first will make good decisions at work when
the question is one nobody has written a diagram for. This page is about what "reasoned" looks
like from the outside, why the follow-up exposes the difference, and how to study so that the
reasoning is what you remember.

## What memorised looks like from the interviewer's chair

The tells are consistent, and interviewers see them weekly:

- **The design arrives complete.** Boxes appear in the order they appear in the well-known
  diagram, not in the order the requirements would produce them — the cache before anyone has
  said the read ratio.
- **Components with no requirement.** A component is present because the diagram has it, and the
  candidate cannot say which journey needs it. "Why is there a message queue?" — "For
  decoupling." Decoupling what from what, and why?
- **The same design for every question.** The shortener, the feed and the chat app all get the
  same shape with different labels, because the shape is what was memorised.
- **The follow-up stalls.** "What if writes are ten times reads?" is answered with a pause and
  then a restatement of the original design, because there is no chain of reasoning to walk back
  along.
- **Vocabulary without mechanism.** "We'd use consistent hashing" with no account of what
  problem it solves here, or what happens when a node joins.

None of these is dishonest. They are what studying diagrams produces. The fix is to study the
derivations instead.

## What reasoned looks like

Reasoned designs have a visible chain: requirement → number → constraint → choice → cost. Each
link is a sentence the interviewer heard:

1. "Reads are two orders of magnitude above writes" *(number)*
2. "so the read path is where the scale is, and the write path is where correctness is"
   *(constraint)*
3. "so a cache in front of the redirect store, and the store itself needs to be simple and
   durable" *(choice)*
4. "and we pay with stale redirects for the TTL after an edit, which we scoped as rare" *(cost)*

When the follow-up arrives — "writes are now ten times reads" — the chain is re-walked from step
1: the number changed, so the constraint changes (the write path is now where the scale is), so
the choice changes (the cache stops paying; the store's write throughput is the limit; key
generation becomes the bottleneck), and a new cost is named (partitioning the table by key, and
losing cheap range queries over creation time). That answer might be wrong in a detail. It is
graded well because every step was visible and the interviewer can see how the candidate would
correct it.

## Why the follow-up is the real test

The first design is a warm-up; the interviewer already knows the canonical answer and is not
learning much from hearing it. The follow-up is where the round's information is, and there are
only a few kinds:

| Follow-up | What it changes | What a reasoned answer does |
|---|---|---|
| "Writes are 10× reads" | the ratio, and therefore which path has the scale | drops the read cache, moves the constraint to write throughput and key generation |
| "One account has fifty million followers" | a uniform assumption becomes skewed | switches that account from fan-out-on-write to fan-out-on-read, and says how the two merge |
| "Now it has to be global" | one region becomes many | adds the cross-region rung from the [ladder](05-the-latency-ladder.md) to every synchronous path and makes replication asynchronous with a stated recovery point |
| "The team is three people" | operational capacity | replaces self-hosted components with managed ones and states their ceilings |
| "The provider is down five percent of the time" | a dependency's reliability | adds a queue and retry in front of it, and says what the user sees meanwhile |
| "It must be exactly once" | a delivery guarantee | asks whether at-least-once plus idempotent consumers satisfies it, and shows the idempotency key |
| "What would you change if you had to ship in two weeks?" | time | names what is deferred and what it costs to defer |

Every row is answered by re-walking the chain from the link that changed. A memorised design has
no chain, so the answer to every row is silence or the original diagram again.

## Being wrong well

A reasoned answer is allowed to be wrong; what it is not allowed to be is *unexplained*. The
habits that make a wrong answer graded well:

- **State the assumption that led there.** "I assumed edits are rare, which is why the cache's
  staleness was acceptable." If the assumption is wrong, the interviewer corrects it and the
  design updates — that is the round working as intended.
- **Derive out loud, including the dead ends.** "A counter would be simplest, but it's a single
  writer — so random keys with an existence check." The rejected option is evidence of choosing.
- **When corrected, say what changes, not why you were right.** "If edits are common, the TTL
  has to be short or the cache has to be invalidated on write — I'd invalidate, and pay with a
  store round trip on every edit."
- **Keep the chain short enough to walk.** Four links, not ten; the interviewer has to be able
  to follow it back.

The primary sources model this. Dynamo's design is not presented as the right answer; it is
presented as the consequence of one requirement, and the paper says so:

> *"For a number of Amazon services, rejecting customer updates could result in a poor customer
> experience. For instance, the shopping cart service must allow customers to add and remove items
> from their shopping cart even amidst network and server failures. This requirement forces us to
> push the complexity of conflict resolution to the reads in order to ensure that writes are never
> rejected."* — Dynamo, §2.3

A candidate who has read that explains eventual consistency as a *consequence* — and can say what
they would do if the requirement were different, which is the follow-up.

## Two shorteners

The same question, answered two ways, with the same follow-up.

**Memorised.** "We hash the URL to base-62, store it in a key-value store, put a cache in front
for redirects, and add a CDN." Follow-up: "we need to guarantee no collisions and we want to
support analytics that need creation order." Answer: a pause; "we could use a bigger hash"; the
creation-order requirement is not addressed.

**Reasoned.** "Reads dominate, so the redirect path is cached and the store is simple. For keys:
a counter is simplest and gives creation order for free, but it's a single writer; random keys
scale the write path but need a uniqueness check and lose ordering; hashing the URL gives
idempotent creates but leaks the URL and collides. At the stated scale I'd take the counter with
a ticket-server range per node, and accept the operational cost of the ticket server." Follow-up,
same as above. Answer: "Then the counter is the right call and I'd keep it — the ordering
requirement is exactly what it gives; the collision guarantee is free because keys are assigned,
not derived. The cost is that the ticket server is now on the critical path, so it needs a warm
standby, and I'd hand out ranges of a thousand so a node can survive the ticket server being down
for a while."

The reasoned candidate's first design was arguably heavier than needed. It was graded better,
because the follow-up found a chain to walk and the memorised design found nothing.

## Studying so that the reasoning is what you remember

The canonical designs are worth knowing; the question is what to store. For each system in the
[catalogue](../../syllabus/12-the-hld-catalogue.md), keep three things and throw away the diagram:

1. **The requirement that makes it interesting.** For the feed: skew — some accounts have
   enormous fan-out. For the shortener: reads far above writes. For payments: idempotency and
   reconciliation. If you cannot name it, you have not understood the design, only seen it.
2. **The chain from that requirement to the central choice.** Written as the four links above.
3. **The follow-ups, with the re-derived answer.** At least three per system, from the table.
   Practising the follow-ups is the whole method; the first design takes care of itself once the
   chain is known.

A design you can re-derive from its requirement in two minutes is one you know. A diagram you can
draw in two minutes is one you have seen.

## Gotchas

**★ Symptom: the first design was excellent and the follow-up produced silence.** Cause: the
design was reproduced, not derived; there was no chain to walk back. Fix: for every canonical
system, learn the requirement that shapes it and the chain from that requirement to the central
choice — then practise the constraint-changing follow-ups until re-deriving is reflexive.

**Symptom: "why is there a queue?" answered with "for decoupling."** Cause: a component present
because the diagram has it. Fix: every component owes a journey and a requirement; if you cannot
name them, remove the component and see whether the design still meets the requirements — if it
does, it was decoration.

**Symptom: the design was wrong and you spent the follow-up defending it.** Cause: the correction
heard as a verdict on you. Fix: treat every correction as a changed requirement and say what
changes — being corrected and updating is the round working; being corrected and arguing is the
anti-signal.

**Symptom: the same shape on the board for the shortener, the feed and the chat app.** Cause:
one memorised template. Fix: start each design from its interesting requirement rather than from
a shape; the feed's skew, the shortener's ratio and chat's ordering produce different diagrams
because they are different problems.

**Symptom: a beautifully reasoned design that arrived nowhere near the canonical one.** Cause:
the chain started from a wrong assumption that was never stated, so it was never corrected. Fix:
say assumptions out loud as you make them; a stated wrong assumption gets fixed at minute five, an
unstated one at minute forty.

**Symptom: you know the mechanism and still answered with the name.** Cause: under a clock, the
name is what comes out first. Fix: make "the level below the name" a habit in practice — every
time you say "consistent hashing" or "idempotent", follow it with one sentence of mechanism, until
the sentence arrives on its own.

## Interview questions

**★ Why would an interviewer prefer a reasoned wrong answer to a memorised right one?**
Because the right answer is public and carries no information about the candidate, while the
reasoning does: it shows the chain from requirement to choice, it is correctable, and it predicts
how the candidate will decide at work when there is no diagram to recall. The follow-up that
changes a constraint is how the interviewer tells the two apart — the reasoned design re-derives
from the changed link, the memorised one has nothing to re-derive from. A wrong step in a visible
chain is graded as a correctable mistake; a right diagram with no chain is graded as unknown.

**★ Walk the chain for the shortener and then re-walk it under "writes are ten times reads."**
Reads far above writes, so the read path carries the scale and the write path carries
correctness; so a cache in front of the redirect store and a simple durable store behind it; paid
for with stale redirects for the TTL after an edit, acceptable because edits were scoped as rare.
Under ten times writes: the write path now carries the scale; the cache stops paying and the
store's write throughput and key generation become the constraint; so random keys with a
uniqueness check instead of a single counter, and a table partitioned by key; paid for with the
loss of cheap creation-order queries and an existence check per create.

**What does "being wrong well" consist of?**
Stating the assumption that led to the choice, deriving out loud including the rejected options,
responding to a correction with what changes rather than why the original held, and keeping the
chain short enough that the interviewer can walk it back. The Dynamo paper is the model: its
eventual consistency is presented as the consequence of a requirement — writes must never be
rejected — not as the right answer, which is why a reader can say what the design would be under a
different requirement.

**How do you study canonical designs so that you can re-derive rather than recall them?**
For each system, keep the requirement that makes it interesting, the four-link chain from that
requirement to the central choice, and three constraint-changing follow-ups with their re-derived
answers — and discard the diagram. The test of knowing a design is re-deriving it from its
requirement in two minutes; the test of having seen it is drawing it in two, and only the first
survives the follow-up.

**A component is on your board and you cannot say which requirement needs it. What do you do?**
Say so and remove it: "I put a queue here by habit — let me check whether anything needs it. The
order events have one consumer, so a direct call with a retry is simpler; I'll take the queue
out." Removing decoration on your own is graded well; being asked "why is that there?" and
answering "for decoupling" is graded as memorised.

**Which follow-ups should you practise, and why those?**
The ones that change a constraint the design rests on: the read/write ratio, uniformity (a
celebrity account), region count, team size, a dependency's reliability, a delivery guarantee,
and time to ship. They cover the links a design chain is built from — numbers, assumptions of
uniformity, the latency floor, operational capacity, failure and guarantees — so practising them
exercises every place a re-derivation can start.

---

← Prev: [07 · The common ways to fail](07-the-common-ways-to-fail.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next → [09 · Communication mechanics](09-communication-mechanics.md)
