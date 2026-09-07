---
title: "Choose the deep dive on purpose — the component with the hardest scale, the one the interviewer keeps returning to, and the one you can defend under three follow-ups — because picking wrongly wastes the last twenty minutes"
sidebar_label: "09 · Choosing the deep dives"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method and tendencies; the rubric line it serves is on
> [phase 0's rubric page](../phase-0-the-interview/03-the-rubric.md), the mechanics of the ask on
> [phase 0's communication page](../phase-0-the-interview/09-communication-mechanics.md). Examples
> on the storefront's checkout. **No sandbox run.**

**The deep dive is where senior loops put the most weight, it gets about ten minutes, and the
choice of *which* box to open is made before the interviewer asks — by three tests, applied in
order.** First, the component with the hardest scale or the hardest invariant: the one the
estimation and the write-path walk pointed at, which in the storefront is the inventory row
under sale-day contention and the payment boundary around it. Second, the component the
interviewer keeps returning to: a hint, a repeated question, a "what about…" — that is the
agenda, and it overrides the first test. Third, the one you can defend under three follow-ups:
a deep dive is a mechanism a level below the names, and if you cannot describe the row, the key,
the state and the failure between two steps, it is not a deep dive yet. Name the choice, say why,
offer the alternative, get a yes — and then spend the ten minutes on mechanism, not on more
boxes.

## The three tests

| Test | Question | Storefront answer |
|---|---|---|
| **Hardest** | where did the numbers and the write-path walk point? which invariant is most expensive to keep? | the sale item's inventory row: every checkout contends on it; the invariant is "never oversell"; the payment boundary sits right next to it |
| **Wanted** | what has the interviewer hinted at, returned to, or asked "what about" for? | if they said "I care about payments" or asked twice about the callback — that, regardless of test one |
| **Defensible** | can I describe the mechanism a level below the names, and survive three follow-ups on it? | the reservation ledger, the conditional decrement, the expiry job, the reconciliation with the provider — yes; a search-relevance deep dive — not for this reader |

The tests are ordered: the interviewer's agenda beats the hardest component, and defensibility
vetoes both — a deep dive you cannot defend is worse than a shallower one you can, because the
follow-ups are where the level is decided.

## The candidates, in most systems

A short list of the boxes that are usually worth opening, because each hides a mechanism with
real failure modes:

- **The contended write** — the hot row, the counter, the seat lock; reservation versus
  decrement, and what releases a reservation.
- **The external boundary** — the payment provider, the SMS gateway; idempotent calls,
  timeouts, callbacks, reconciliation.
- **Fan-out** — the feed, notifications; write-time versus read-time fan-out, the celebrity
  case, the merge.
- **The cache and its invalidation** — what is cached, the stampede, read-your-writes.
- **Delivery guarantees** — the outbox, at-least-once plus idempotent consumers, ordering per
  key.
- **The index** — the search engine's freshness, sync from the primary via change capture.
- **Partitioning** — the shard key, the hot shard, cross-shard queries; only if the numbers
  forced sharding.

For the storefront's checkout the first two are the same box, which is why it is the obvious
deep dive: inventory contention and the payment boundary are two halves of the write-path walk.

## What a deep dive consists of

Ten minutes, on one box, in this shape:

1. **Redraw the box on fresh space** at component level — the steps inside it, the tables it
   touches, the calls it makes ([07](07-the-high-level-diagram.md)).
2. **State the invariant** the box exists to keep: "stock is never negative and every
   reservation is either confirmed or released."
3. **Show the mechanism** a level below the names: the conditional `UPDATE`, the reservation
   row with a TTL, the expiry job that releases, the reconciliation job that asks the provider
   about pending orders older than N minutes.
4. **Put two alternatives on the board** with the failure each invites — "decrement on
   checkout versus reserve-then-confirm; a Redis counter versus the primary's row" — and
   choose, with the cost said ([10 · Trade-offs in one sentence](10-trade-offs-in-one-sentence.md)).
5. **Walk the failures inside the box**: a crash between the decrement and the order insert;
   the provider timing out; the callback arriving twice; the expiry job running late.
6. **Name the residual** — the failure the design accepts: "a crash between commit and the
   provider call leaves a reserved, unpaid order for up to the expiry window; we accept it and
   the reconciliation job bounds it."

A deep dive that stops at step 3 is a description; steps 4 to 6 are what the senior grade is
made of.

## The ask

Before opening the box, one sentence naming the choice, the reason and the alternative:
"I'd go deep on inventory contention and the payment boundary, because that's where the sale
breaks and where the invariant lives — or would you rather I went deep on the read path and
caching?" Three outcomes and all are fine: a yes, a redirect, or "your call". What is not fine
is opening a box without asking and finding out at minute forty that the interviewer wanted the
other one.

## Reading the interviewer's signals

The second test needs the signals read. Stated as tendencies:

- **A hint** ("what about the write path?") is a request for depth there.
- **A repeated question** on one component means the first answer was not deep enough — go
  deeper on it, do not move on.
- **"How would that behave when…"** names the box to open and the failure to start from.
- **An interruption that stops a deep dive** means the round is scoped at breadth; wrap the
  box in one sentence and return to the diagram.
- **Silence** after the high-level diagram is the invitation to ask.

## Two deep dives, or one?

Usually one, done properly. A second is worth attempting only when the first closed cleanly
with time left — and then it should be the component the interviewer's signals pointed at
second, or the other half of the same journey (the read path's cache, after the write path's
row). Two shallow deep dives grade below one deep one, because the follow-ups on the shallow
ones have nowhere to go.

## Gotchas

**★ Symptom: ten minutes deep on search relevance, and "I was hoping to see payments."**
Cause: the ask never made; the box chosen from what the candidate knew best rather than from
the numbers or the interviewer's signals. Fix: the three tests in order, the choice named with
its reason and the alternative, and a yes before opening the box.

**★ Symptom: the deep dive was a list of technologies inside the box.** Cause: stopping at the
names. Fix: the mechanism — the row, the key, the state, the failure between two steps — plus
two alternatives with their costs and the residual failure the design accepts.

**Symptom: a repeated question on the callback, and you moved on to caching.** Cause: the
repeat read as satisfied rather than as unsatisfied. Fix: a repeated question means go deeper
there; the interviewer is telling you where the grade is.

**Symptom: the deep dive chosen on the hardest component, and you could not survive the second
follow-up.** Cause: defensibility not tested before choosing. Fix: the third test vetoes — pick
the box you can defend under three follow-ups, and say why the harder one is a known gap.

**Symptom: two deep dives, both shallow.** Cause: breadth mistaken for thoroughness. Fix: one
box, all six steps; a second only if the first closed with time to spare.

**Symptom: the deep dive drew more boxes.** Cause: staying at container level. Fix: redraw the
chosen box on fresh space at component level — steps, tables, calls — and stay inside it.

**Symptom: no residual named, and "so it never fails?"** Cause: the design presented as
complete. Fix: name the failure the design accepts and what bounds it; a residual stated is
judgement, a residual discovered is a gap.

## Interview questions

**★ How do you choose what to go deep on?**
Three tests in order: the component with the hardest scale or the most expensive invariant,
which the estimation and the write-path walk point at; the component the interviewer has
hinted at or returned to, which overrides the first; and the one I can defend under three
follow-ups, which vetoes both — a deep dive I cannot defend grades worse than a shallower one I
can. Then the ask: name the choice, the reason and the alternative, and get a yes before
opening the box. For the storefront's checkout that is inventory contention and the payment
boundary, which are two halves of the same write path.

**★ What does a good deep dive contain?**
The chosen box redrawn at component level; the invariant it keeps; the mechanism a level below
the names — the conditional decrement, the reservation with a TTL, the expiry and reconciliation
jobs; two alternatives with the failure each invites and a choice with its cost; the failure walk
inside the box — a crash between two steps, a timeout, a duplicate callback; and the residual
failure the design accepts, with what bounds it. A deep dive that stops at the mechanism is a
description; the alternatives, the failures and the residual are the senior grade.

**Why does the interviewer's hint override the hardest component?**
Because the hint is the agenda: it names the rubric line the interviewer is trying to fill, and
ten minutes on a box they did not ask about — however hard — leaves that line blank. A hint
taken immediately is also graded on its own; a hint deferred to finish the planned deep dive is
graded against. When the hinted box is one you cannot defend, say so and offer the nearest one
you can.

**One deep dive or two?**
One, done to all six steps. A second only if the first closed cleanly with time left, and then
on the component the interviewer's signals pointed at second or the other half of the same
journey. Two shallow deep dives grade below one deep one, because follow-ups are where the level
is decided and shallow dives give them nowhere to go.

---

← Prev: [08 · Read path and write path](08-read-path-and-write-path.md) · Index: [Phase 1 — The method](README.md) · Next → [10 · Trade-offs in one sentence](10-trade-offs-in-one-sentence.md)
