---
title: "Interviewers grade against a rubric with roughly seven lines, and every line needs evidence they can write down — \"correct but silent\" fails the last two"
sidebar_label: "03 · The rubric"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. The rubric is a **synthesis of how product-company loops tend to grade**,
> not a quoted document — no company's form is reproduced. Where a line touches a technical
> standard, the source is the Google SRE book,
> [*Service Level Objectives*](https://sre.google/sre-book/service-level-objectives/), and the
> [Dynamo paper](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) §2.2.
> **No sandbox run.**

**Design interviews are graded on a written form, and the form has lines. The lines vary in
wording between companies but converge on the same seven: requirements gathering, estimation, a
coherent high-level design, depth on at least one component, handling of scale and failure,
trade-offs stated without prompting, and communication.** The interviewer's job after the round is
to write one or two sentences of *evidence* per line. A candidate who produced no evidence for a
line gets a blank, and a blank grades as a miss — which is why a correct design delivered in
silence fails the last two lines and often the sixth. The rubric is not a secret. Knowing it lets
you generate the evidence on purpose, in the order the interviewer needs it.

## The seven lines, and what evidence looks like

| Line | What the interviewer writes down if it went well | What they write if it did not |
|---|---|---|
| **1 · Requirements** | "Scoped to three journeys, listed what's out, asked about consistency for checkout unprompted" | "Started drawing at minute two; I had to supply the scale" |
| **2 · Estimation** | "Derived peak QPS from DAU and actions, sized the cache from the hot fraction, said the numbers were rounded" | "Numbers only when asked; no arithmetic shown" |
| **3 · High-level design** | "One coherent diagram, numbered flows, every box justified by a requirement" | "Boxes with no flows; a queue with no consumer; the write path missing" |
| **4 · Depth** | "Went deep on inventory contention: row locks vs reservation ledger, chose one, explained the failure of the other" | "Stayed at the level of names; could not explain what the cache does on a miss" |
| **5 · Scale and failure** | "Walked the diagram for SPOFs; named replication lag as the read-your-writes risk after checkout" | "Never mentioned failure; 'we'd add more servers'" |
| **6 · Trade-offs** | "Said the cost of every choice before I asked: eventual consistency for the cart, paid with read-side merge" | "Choices presented as facts; when asked for the downside, had none" |
| **7 · Communication** | "Thought aloud, summarised every few minutes, checked before deep-diving, took the hint" | "Long silences; ignored my redirect; talked over the question" |

Three things follow from the table. First, **the evidence is sentences, not diagrams** — an
interviewer cannot write "the diagram was good" on line 6. Second, **lines 6 and 7 are graded
from what you said unprompted**; a trade-off supplied when asked is evidence for line 4 (you knew
it), not for line 6 (you volunteer it). Third, **line 5 is the most commonly blank**, because
failure does not come up on its own; it has to be walked.

## How the lines weight at each level

The lines do not weigh equally, and the weighting shifts with the level of the loop (see
[01 · Design at each level](01-what-design-means-at-each-level.md)):

- **SDE-2 loops** weight lines 1, 3 and 4 — did you scope, produce a coherent design, and build
  one thing properly. Lines 5 and 6 are bonuses.
- **Senior loops** weight lines 4, 5 and 6 — depth, failure, trade-offs — with 1 and 2 assumed.
  A senior candidate who needs prompting for a trade-off has answered at SDE-2 level.
- **Staff loops** add a line that is not on the form above — *evolution and ownership*: what
  breaks first, what is deferred, what the team can run. It is graded through lines 5 and 6 with
  a longer time horizon.

Line 7 is a multiplier on every level: strong evidence on the other six, delivered badly, is
recorded as weaker than it was, because the interviewer has to reconstruct it.

## The measures the rubric expects you to use

Two of the lines — estimation and scale — assume a vocabulary that the rest of this phase builds.
Two habits are worth taking from the primary sources now, because interviewers who have read them
listen for them.

**Percentiles, not averages.** An estimation that ends in an average latency is weaker evidence
than one that ends in a p99, because the tail is where systems are designed. Dynamo is the
canonical statement of the habit:

> *"In this paper there are many references to this 99.9th percentile of distributions, which
> reflects Amazon engineers' relentless focus on performance from the perspective of the customers'
> experience. Many papers report on averages, so these are included where it makes sense for
> comparison purposes. Nevertheless, Amazon's engineering and optimization efforts are not focused
> on averages."* — Dynamo, §2.2

**Objectives, not adjectives.** "Highly available" is not a requirement; a target is. The SRE
book's vocabulary is what the interviewer is translating your words into:

> *"An SLI is a service level indicator—a carefully defined quantitative measure of some aspect of
> the level of service that is provided."* · *"An SLO is a service level objective: a target value
> or range of values for a service level that is measured by an SLI."* — SRE book, ch. 4

A candidate who says "checkout needs three nines of availability measured as successful requests
over total, and p99 under half a second" has produced evidence for lines 1 and 2 in one sentence.

## A worked round, scored

"Design a notification service for the storefront" — order confirmations, shipping updates,
marketing pushes — walked in the rubric's order, with the sentence that earns each line:

1. **Requirements (minutes 0–5).** "Three journeys: transactional notifications on order events,
   marketing campaigns to segments, and user preferences. Out of scope: the template editor and
   analytics. Transactional must not be lost and should arrive within a minute; marketing can be
   delayed and must respect opt-outs." *Line 1: scoped, out-of-scope named, the consistency
   distinction between the two journeys made unprompted.*
2. **Estimation (5–12).** "Say a million orders a day, three notifications each — about three
   million transactional messages a day, roughly thirty-five a second on average, and I'll design
   the transactional path for a sale-day peak of ten times that. A campaign to ten million users
   is a burst, not a rate — it's a queue-drain problem." *Line 2: derived, rounded, the two
   traffic shapes told apart.*
3. **High-level design (12–27).** Order events on a log; a notification service consuming them,
   writing a notification row per recipient per channel, and handing sends to per-channel
   workers behind a queue; a preferences store consulted before enqueueing; provider adapters for
   email, SMS and push. Flows numbered on the board. *Line 3: every box justified by a journey.*
4. **Depth (27–37).** "The hard part is exactly-once to the user. The provider call is not
   idempotent, so I make the send idempotent on my side: a notification row with a status and a
   unique key per (order event, recipient, channel); the worker claims it, calls the provider, and
   records the provider's message id. A crash between the call and the record is the residual —
   I'd bound it with a claim lease and accept a rare duplicate over a lost confirmation." *Line 4:
   mechanism, a chosen failure, the residual named.*
5. **Scale and failure (37–41).** "Single points: the preferences store on the transactional
   path — I'd cache it with a short TTL and fail open to sending, because a duplicate marketing
   opt-out check is cheaper than a lost order confirmation. The provider is the other — per-channel
   circuit breakers and a fallback provider for SMS." *Line 5: walked, with the fail-open decision
   reasoned.*
6. **Trade-offs (throughout).** "I chose a log over a queue for order events because two consumers
   need them — notifications and fulfilment — and I pay with consumer-side offset management. I
   chose at-least-once plus idempotency over any exactly-once claim, and I pay with a dedupe table
   that needs a retention policy." *Line 6: two choices, each with its price, unprompted.*
7. **Communication (throughout).** A summary at minutes 12, 27 and 41; "shall I go deep on
   delivery or on the campaign fan-out?" before the deep dive; the interviewer's hint about
   preferences taken as the agenda. *Line 7: evidence the interviewer did not have to create.*

The design is not exotic. What earns the lines is that every one of them has a sentence attached
that the interviewer can copy into the form.

## Producing the evidence on purpose

A self-check to run in practice sessions, and silently in the real one at the summaries:

```text
Line 1  Did I say what is OUT of scope?                       yes / no
Line 2  Did I show arithmetic, and say I was rounding?         yes / no
Line 3  Does every box have a flow number through it?          yes / no
Line 4  Have I explained one mechanism a level below names?    yes / no
Line 5  Have I walked the diagram asking "what if this dies"?  yes / no
Line 6  Have I said the cost of a choice BEFORE being asked?   yes / no
Line 7  When did I last summarise?                             minute ___
```

This is illustrative, not a company's form. Its value is that a "no" on any line at minute 30 is
still fixable; discovering the blank in the feedback is not. The practice method that uses it is
in [10 · How to practise](10-how-to-practise.md).

## Gotchas

**★ Symptom: "the design was fine, but the feedback says trade-offs were weak."** Cause: every
choice was stated as a fact, and the downsides came out only when asked — evidence for line 4, not
line 6. Fix: attach the cost to the choice in the same breath, every time: "a cache here, paid for
with staleness for the TTL; acceptable because we scoped edits out of the SLO."

**★ Symptom: a correct, complete design and a "no hire" on communication.** Cause: long silences
while drawing, no summaries, the interviewer's redirect not taken; the form's line 7 had nothing to
record and line 6 was inferred as weak. Fix: narrate while drawing, summarise every ten minutes in
one sentence, and treat every hint as the agenda — say "you mentioned preferences; let me go there."

**Symptom: line 5 blank — "never discussed failure."** Cause: failure does not surface by itself;
it has to be walked. Fix: at the end of the high-level design, before the deep dive, walk the
diagram once out loud: "if the balancer dies… if the primary dies… if the queue is unavailable… if
the provider times out." Thirty seconds produces the evidence.

**Symptom: "estimation was hand-wavy."** Cause: numbers stated without arithmetic, or an average
where a peak was needed. Fix: say the derivation — "a million orders, three messages each, thirty-
five a second average, design for ten times that at a sale" — and say the rounding out loud. The
arithmetic is the evidence; the number alone is not.

**Symptom: "stayed at the level of names."** Cause: the deep dive named a technique (idempotency,
a circuit breaker) and never showed its mechanism. Fix: for the component you go deep on, describe
the row, the key, the state and the failure between two steps — "a notification row with a unique
key per event-recipient-channel; the worker claims it; the residual is a crash between the provider
call and the record."

**Symptom: strong on every line, and the feedback says "did not scope."** Cause: the
requirements were in your head and the design was consistent with them, but the interviewer never
heard the out-of-scope list. Fix: write requirements *on the board*, including the out-of-scope
items, so line 1 has visible evidence and the interviewer can redirect early.

**Symptom: the interviewer keeps asking "why?" and it feels hostile.** Cause: they are trying to
fill line 6 for you, because you have not. Fix: read a "why?" as "say the trade-off" and answer in
the form *chose X over Y because Z, pay with W*. After two such answers the questions stop, because
the line is filled.

**Symptom: you answered every line, and the feedback is "too shallow for the level."** Cause: the
loop was senior and the evidence was SDE-2-grade — a design with one option per decision. Fix:
lines 4 and 6 at senior mean alternatives on the board and a reason for the rejection of each; see
[01 · Design at each level](01-what-design-means-at-each-level.md).

## Interview questions

**★ What are the lines on a system design rubric, and which ones are graded from what you say
unprompted?**
Requirements gathering, estimation, a coherent high-level design, depth on at least one component,
handling of scale and failure, trade-offs, and communication. Lines 6 and 7 are graded from
volunteered behaviour: a trade-off given when asked is evidence that you knew it (line 4), not that
you state costs as a habit (line 6); communication is what the interviewer did not have to
extract. A correct design delivered silently therefore fails both, and usually leaves line 5 blank
as well, because failure has to be walked deliberately.

**★ Why does "correct but silent" fail?**
Because the interviewer writes evidence, not impressions. A silent candidate produces a diagram,
which is evidence for line 3 only. Lines 1, 2, 4, 5 and 6 need sentences — the out-of-scope list,
the arithmetic, the mechanism, the failure walk, the cost of each choice — and line 7 needs the
summaries and the responses to hints. With no sentences, five lines are blank, and blanks grade as
misses regardless of how good the diagram was.

**★ Give the one-sentence version of evidence for each of the seven lines on a notification
service.**
Requirements: "transactional must not be lost and lands within a minute; marketing can lag and must
respect opt-outs; the template editor is out." Estimation: "a million orders, three messages each,
thirty-five a second average, design the transactional path for ten times that." Design: "order
events on a log, a consumer writing a row per recipient per channel, per-channel workers, provider
adapters." Depth: "exactly-once to the user via an idempotent row keyed on event-recipient-channel;
the residual is a crash between the provider call and the record." Failure: "the preferences store
is on the hot path — cache it and fail open to sending." Trade-off: "a log over a queue because two
consumers need the events; paid with offset management." Communication: a summary every ten
minutes and the hint taken as the agenda.

**Why do interviewers care about percentiles rather than averages in estimation?**
Because the tail is where systems are designed and where users notice. A store that averages ten
milliseconds and spikes to two seconds at the 99th percentile fails the user on every hundredth
request, and a page that makes twenty calls hits that tail on most page views. Dynamo's paper
states the habit directly — its engineering effort is focused on the 99.9th percentile, not on
averages — and a candidate who estimates in percentiles is signalling that they have designed for
tails before.

**What is the difference between a requirement and an adjective, in rubric terms?**
"Highly available" is an adjective; "three nines measured as successful requests over total, over
a rolling month" is a requirement, because it names an indicator and a target — the SRE book's SLI
and SLO. Line 1 is graded on requirements. A candidate who translates the adjective into an
indicator and a target has also produced evidence for line 2, since a target implies the
arithmetic that follows.

**How does the weighting of the lines change between an SDE-2 loop and a senior loop?**
SDE-2 loops weight scoping, a coherent design and depth on one component; failure and trade-offs
are bonuses. Senior loops assume scoping and estimation and weight depth, failure and trade-offs —
with alternatives expected on the board and the cost of each choice said unprompted. Staff loops
add evolution and ownership, graded through the same lines with a longer horizon. Communication
multiplies every level: the same evidence delivered badly is recorded as weaker.

**What should you do when you realise at minute thirty that a line is blank?**
Fill it in the next summary. "Before I go deeper — let me walk failure once: if the balancer dies…
if the primary dies… if the provider times out." Or: "I've made two choices without saying their
cost — the log costs us offset management; the dedupe table costs us a retention policy." A line
filled late is graded as filled; a line discovered blank in the feedback is not.

---

← Prev: [02 · The three design rounds](02-the-three-design-rounds.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next → [04 · The vocabulary contract](04-the-vocabulary-contract.md)
