---
title: "Five minutes for requirements, ten for estimation and the API, fifteen for the diagram and its paths, ten for one deep dive, five to wrap up — a budget checked against the clock at four points, with a fixed order of what to drop when behind and a rule for when to stop talking"
sidebar_label: "15 · Time management in 45 minutes"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method — the budget is a tendency observed across the common 45-minute
> format, not a standard, and individual companies vary it (a 60-minute round, a 30-minute phone
> screen, a staff round that spends longer on requirements); the variants are covered below. The
> rubric lines each block serves are on [phase 0's rubric page](../phase-0-the-interview/03-the-rubric.md);
> the summary mechanics are on [phase 0's communication page](../phase-0-the-interview/09-communication-mechanics.md).
> **No sandbox run.**

**Forty-five minutes is enough for the whole method, and most candidates run out of time because
they spend it in the wrong place — twelve minutes on requirements, or a deep dive that opens at
minute forty.** The budget is five for requirements, ten for estimation and the API sketch,
fifteen for the high-level diagram with its read and write paths and the failure walk, ten for
one deep dive, five to wrap up — and the budget is worth nothing unless it is *checked*: at
minutes five, fifteen, thirty and forty there is a thing that must already be on the board, and
if it is not, a fixed order says what to drop. Being behind is normal; being behind without
noticing is the failure. The other half of time management is silence: a design round is a
conversation, and the candidate who fills every second has stopped the interviewer from steering
towards the marks. This page is the budget with its checkpoints, the order of sacrifice, the
rule for stopping, the common variants, and the storefront run against the clock.

## The budget, with what must exist at each checkpoint

| Minutes | Block | On the board when it ends | Rubric line it fills |
|---|---|---|---|
| 0–5 | **Requirements** ([01](01-functional-requirements.md), [02](02-non-functional-requirements.md)) | three to five journeys, the out-of-scope list, three non-functionals with numbers | clarification, scope |
| 5–15 | **Estimation and the API** ([03](03-back-of-the-envelope-estimation.md), [05](05-the-api-sketch.md)) | reads/s, writes/s, storage — arithmetic shown; the two or three endpoints that matter, with idempotency named | estimation, API |
| 15–30 | **The diagram, the paths, the walk** ([07](07-the-high-level-diagram.md), [08](08-read-path-and-write-path.md), [11](11-bottlenecks-and-single-points-of-failure.md)) | the container-level diagram, journeys numbered, read and write paths traced, the failure walk done left to right | design, failure |
| 30–40 | **One deep dive** ([09](09-choosing-the-deep-dives.md)) | one box opened, two alternatives with the failure that rejected one, the trade-off sentence | depth, trade-offs |
| 40–45 | **Wrap-up** | the scaling walk in a sentence, cost in a sentence, the not-yet list, questions | scaling, evolution, communication |

The four checkpoints are the whole discipline. **Minute five:** are the journeys written? If
not, stop asking and write them. **Minute fifteen:** are there three numbers and an endpoint on
the board? If not, the estimation compresses to reads/s and writes/s and the API to the checkout
endpoint alone. **Minute thirty:** is the diagram drawn and walked? If not, the walk is done in
its short form — the primary, the cache, the external dependency — and the deep dive starts
anyway. **Minute forty:** has one box been opened? If not, the wrap-up is the deep dive said
aloud in ninety seconds rather than drawn.

## The order of sacrifice

When behind, drop in this order, and say that you are dropping it — "I'll skip the storage
estimate; the write rate is the number that matters here":

1. **Cost and evolution** ([13](13-designing-for-cost.md), [14](14-evolution-and-operations.md))
   compress to one sentence each in the wrap-up.
2. **The second deep dive** — was never in the budget; one done well beats two half-opened.
3. **Storage and bandwidth estimates** — keep reads/s and writes/s, which choose the boxes.
4. **API detail** — keep the endpoint the deep dive needs (checkout) with its idempotency key;
   the rest are named, not written.
5. **The long failure walk** — becomes the short form: primary, cache, external dependency,
   region, four sentences.
6. **The scaling walk** — becomes "the numbers license this; the next step would be X when Y".

Never dropped, whatever the clock says:

- the journeys and the out-of-scope list — everything after is graded against them;
- the numbers that choose the boxes — reads/s and writes/s;
- the diagram, at the container level, with the checkout journey numbered onto it;
- one deep dive with two alternatives and a trade-off sentence;
- the ten-minute summaries, because they are how the interviewer's notes get filled.

Dropping the deep dive to finish the diagram is the wrong trade: the diagram alone fills the
design line, and the depth and trade-off lines, which weigh most at senior level, stay empty.

## When to stop talking

Silence is where the interviewer steers, and a candidate who never leaves any has taken the
wheel away. Four rules:

**Stop after a decision.** State the choice, its trade-off sentence, and stop for two seconds.
The interviewer either nods — move on — or asks, and the question is the mark they are trying to
give you.

**Stop at each ten-minute summary.** "So far: journeys, numbers, an API; the diagram is next —
anything you'd like me to change before I draw?" The pause is an invitation; take the answer.

**Answer the question asked, then stop.** "Why a log?" gets the four-clause sentence, not a
history of messaging systems. If the interviewer wanted more, they ask; if they wanted to move
on, the extra minute was taken from the deep dive.

**Stop when the interviewer starts.** An interruption is steering, not rudeness; finish the
clause and yield. The candidate who talks over the redirect ends up designing a system the
interviewer stopped grading five minutes ago.

And one for the last five minutes: the wrap-up ends with a question to the interviewer, not a
final flourish. "What would you have pushed on?" gets a useful answer and ends the round on the
interviewer's terms.

## Recovering when behind

The three common ways to lose time, and the recovery for each:

**Ten minutes on requirements.** Usually a question-and-answer loop that never closes. Recovery:
write the journeys you have, say "I'll assume the rest and flag it", and move; estimation
compresses to two numbers.

**Taken deep early.** The interviewer asks about the inventory row at minute twelve. Recovery:
answer in two minutes at the level of a decision — "reservation with a TTL; I'll open it in the
deep dive" — write it on the board as the chosen deep dive, and return to the diagram. Saying
"I'll come back to that" and then actually coming back is a mark.

**Drawing slowly.** Boxes redrawn, arrows rerouted, the diagram erased and restarted. Recovery:
the fixed layout from [07](07-the-high-level-diagram.md) — client, edge, gateway, services,
stores, async below — drawn as a template in the first minute of the block, then filled; on a
remote whiteboard, the pre-made shape library from
[phase 0's tooling page](../phase-0-the-interview/11-whiteboard-and-remote-tooling.md).

## The variants

| Format | What changes | The budget |
|---|---|---|
| **60 minutes** | more depth, not more breadth | 5 · 10 · 15 · **20** (two deep dives, or one plus the scaling walk in full) · 10 wrap-up with evolution and cost |
| **30-minute screen** | one journey, one number, one diagram, one decision | 3 · 5 · 12 · 7 · 3 — the API is one endpoint; the failure walk is the primary and the external dependency |
| **Interviewer-driven** | they hold the clock; you hold the method | keep the checkpoints in your head; at each redirect, say where it lands in the method — "that's the write path; I'll trace it now" |
| **Staff round** | requirements and trade-offs weigh more; the diagram less | 10 · 5 · 10 · 10 · 10 — the wrap-up is the evolution and not-yet list, said in full ([phase 0's staff page](../phase-0-the-interview/01b-staff-and-reading-the-room.md)) |
| **Take-home or written** | no clock; the same order on paper | **17 · The same method in writing** *(not written yet)* |

The method does not change between formats; the budget does. Asking at minute zero — "is this
the usual forty-five, and would you like me to drive?" — settles which column applies.

## The storefront against the clock

A script, with timestamps, for "design the checkout for an online store":

- **0:00** — "I'll take five minutes on requirements, then numbers and the API, then a diagram,
  then one deep dive. Stop me anywhere." Journeys: browse, cart, checkout, pay, confirm.
  Out: returns, recommendations, multi-currency. Non-functionals: checkout under a second at p99,
  no double charge, orders never lost.
- **0:05** — a million users, a hundred reads a second, a thousand at a sale; half an order a
  second, fifty at a flash sale; a quarter terabyte over seven years. "The write path at the
  flash sale is the problem, not read capacity." Endpoints: `POST /orders` with an idempotency
  key, `GET /orders/:id`, the provider callback.
- **0:15** — the diagram: client, CDN, gateway, catalogue, cart, order, payment adapter, primary
  and replica, Redis for carts, outbox, log, workers. Checkout numbered onto it. Write path
  traced: commit before the provider call. Failure walk left to right, fifteen boxes, two
  minutes. **First summary.**
- **0:30** — deep dive: the inventory row at the flash sale. Two alternatives: row lock with
  admission, versus a reservation counter in Redis reconciled to the row. The failure that
  rejects the naked row lock; the trade-off sentence for the counter. **Second summary.**
- **0:40** — "Scaling: the numbers license one primary with a replica and a cache; sharding at
  tens of thousands of writes a second, not before. Cost: egress and the database dominate. Week
  one is one service and one database; the log arrives with the second consumer. What would you
  have pushed on?"
- **0:45** — done, with a minute to spare for their question.

## Gotchas

**★ Symptom: minute forty, and the deep dive is just starting.** Cause: no checkpoints; the
diagram absorbed the budget. Fix: the minute-thirty check — diagram drawn and walked or not, the
deep dive starts — and the short-form walk when behind.

**★ Symptom: twelve minutes of requirements questions.** Cause: the question loop never closed.
Fix: at minute five, write what you have, state the assumptions, and move; flag the open ones
for the wrap-up.

**Symptom: two deep dives, both shallow.** Cause: breadth chosen over depth. Fix: one deep dive
with two alternatives and a trade-off sentence; name the second as "what I'd open next".

**Symptom: the interviewer redirected and the candidate kept going.** Cause: talking through the
steering. Fix: finish the clause, yield, and say where the redirect lands in the method.

**Symptom: silence never offered; no questions from the interviewer.** Cause: every second
filled. Fix: two seconds after each decision, an explicit invitation at each summary.

**Symptom: the storage estimate computed carefully, the write rate never stated.** Cause: the
wrong number kept when compressing. Fix: reads/s and writes/s are never dropped; storage and
bandwidth are the first estimates to go.

**Symptom: an early deep question answered for eight minutes.** Cause: the deep dive taken at
minute twelve, before the diagram existed. Fix: a two-minute answer at the level of a decision,
written as the chosen deep dive, and a return to the diagram — then actually returning.

**Symptom: the wrap-up is a restatement of the whole design.** Cause: the last five minutes spent
on what is already on the board. Fix: the wrap-up is the three sentences that were dropped —
scaling, cost, evolution — and a question to the interviewer.

**Symptom: the 30-minute screen run on the 45-minute budget.** Cause: format unasked. Fix: ask at
minute zero; on a screen, one journey, one number, one diagram, one decision.

**Symptom: the diagram erased and redrawn twice.** Cause: no layout template. Fix: the fixed
left-to-right layout drawn empty in the first minute of the block, then filled.

## Interview questions

**★ How do you split forty-five minutes, and what do you check along the way?**
Five on requirements, ten on estimation and the API, fifteen on the diagram with its paths and
failure walk, ten on one deep dive, five to wrap up. Checked at four points: journeys written by
minute five; three numbers and an endpoint by fifteen; the diagram drawn and walked by thirty;
one box opened by forty. Missing a checkpoint triggers a fixed compression — two numbers instead
of five, the short failure walk, a deep dive said aloud instead of drawn — never a silent overrun.

**★ You are ten minutes behind at minute twenty-five. What do you drop?**
Cost and evolution compress to a sentence each in the wrap-up; the second deep dive was never
budgeted; storage and bandwidth estimates go, keeping reads and writes per second; the API keeps
only the checkout endpoint with its idempotency key; the failure walk goes to its short form —
primary, cache, external dependency, region. Kept whatever happens: the journeys, the two
numbers, the container-level diagram with checkout numbered on it, one deep dive with two
alternatives and a trade-off sentence, and the summaries.

**When should you stop talking?**
After every decision, for two seconds — the nod or the question that follows is the interviewer
steering towards a mark. At each ten-minute summary, with an explicit invitation to redirect.
After answering the question actually asked, rather than the broader one it could have been.
And the moment the interviewer starts speaking: finish the clause, yield, and say where the
redirect lands in the method.

**The interviewer asks a deep question at minute twelve. What do you do?**
Answer in two minutes at the level of a decision — "reservation with a TTL in front of the row;
that's my deep dive" — write it on the board as the chosen deep dive, and return to the diagram.
The mark is in the return: saying "I'll come back to that" and then coming back shows the clock
is being held; opening the box before the diagram exists produces depth with nothing to attach
it to.

**How does the budget change for a 60-minute round, a 30-minute screen and a staff round?**
Sixty minutes buys depth, not breadth — twenty minutes for two deep dives or one plus the full
scaling walk, and a ten-minute wrap-up with evolution and cost. A thirty-minute screen is one
journey, one number, one diagram, one decision, on a 3 · 5 · 12 · 7 · 3 budget. A staff round
weights requirements and trade-offs over the diagram — ten minutes on requirements, ten on the
wrap-up's evolution and not-yet list. The method is the same; asking the format at minute zero
picks the budget.

---

← Prev: [14 · Evolution and operations](14-evolution-and-operations.md) · Index: [Phase 1 — The method](README.md) · Next → [16 · Estimation worked examples](16-estimation-worked-examples.md)
