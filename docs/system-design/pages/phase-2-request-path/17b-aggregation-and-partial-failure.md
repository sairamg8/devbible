---
title: "The arrow that splits into four and rejoins hides the three things that decide whether an aggregating edge is any good — what you return when three of four upstreams answered, that the client's deadline is one shared envelope rather than a per-leg allowance, and that a parallel fan-out's latency is its slowest leg, so a screen users call slow can be built entirely from services whose own dashboards look healthy"
sidebar_label: "17b · Aggregation and partial failure"
sidebar_position: 17.2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. Aggregation and its failure modes are **method with no single primary
> source** and are written as such — no vendor, no product, no benchmark, and every number below
> is arithmetic on an illustrative budget rather than a measurement. The one primary-sourced rule
> is [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §9.2.2 on idempotent methods and
> automatic retry — verbatim below — which decides which legs of a fan-out may be retried at all.
> Continues [17](17-gateway-patterns.md); the N+1 and where composition belongs are
> [17c](17c-the-fan-out-n-plus-1.md); the graph at the edge is
> [17e](17e-graphql-at-the-edge.md). Deadlines and retry budgets are
> [08](08-timeouts-retries-and-budgets.md)'s and are applied here, not re-derived.
> **No sandbox run.**

**Aggregation is one client call in, several upstream calls behind it, one response out — and it
is drawn as an arrow that splits into four and rejoins, which is exactly the picture that hides
everything hard about it.** The fan-out itself is trivial; three of its consequences are not.
*Partial failure*: three upstreams answered and one timed out, and both obvious answers — fail
the whole call, or return a `200` with holes — are wrong in a way that costs you either an
outage or a week of not noticing one. *The deadline*: the client gave the aggregate one budget
for the whole thing rather than one budget per leg, and the commonest bug in the wild is an
upstream client library with its own default timeout that outlives its caller. *The tail*: a
parallel fan-out finishes when the **slowest** leg finishes, so adding a fast fifth service to a
screen is still not free, and four teams can each honestly say "it's not us" about a screen that
is measurably slow. This page is those three, with the labelling scheme that answers the first
and turns out to answer the third as well.

## Partial failure: what do you return when three of four answered?

This is a design decision, and it is made **per upstream, not per endpoint**. Every leg of the
fan-out carries one of three labels, chosen when the screen is designed:

| Label | Meaning | What the aggregate does |
|---|---|---|
| **required** | the response is meaningless without it — the product itself, its price | fail the whole call: 503 with `Retry-After` ([03](03-reverse-proxies-and-api-gateways.md)) |
| **degradable** | the screen renders without it — reviews, recommendations, "customers also bought" | return the rest, name the hole explicitly, and count it |
| **stale-acceptable** | last known good beats nothing — a delivery estimate, a badge | serve from the aggregate's cache and mark the value stale |

Both unlabelled defaults are wrong, in opposite directions. An aggregate that fails whole because
reviews timed out has turned a review outage into a catalogue outage — the cheapest service on
the screen now decides whether anyone can shop. An aggregate that returns `200` with three
sections silently empty has taught every client that every field is optional, and has hidden the
outage from its own dashboard, because a successful status code is what the alerting counts. So
the *contract* carries the partiality:

```ts
// partial success is in the type, not in the client's imagination
type ProductScreen = {
  product: Product;                 // required   — no product, no response
  price: Price;                     // required
  stock: Stock | null;              // degradable — the app renders "checking availability"
  reviews: ReviewSummary | null;    // degradable — the section is omitted entirely
  degraded: { field: string; reason: 'timeout' | 'unavailable' | 'stale' }[];
};
```

`degraded` is the load-bearing field. It is what lets the client render honestly rather than
showing an empty reviews block that looks like a product nobody has reviewed, and its rate per
field is what the dashboard alerts on. Without it, "the reviews service is down" and "this
product has no reviews" are the same response, which is how a dependency stays broken for a week.
It is also the field that makes the degradation of
[04](04-stateless-services-and-where-the-state-went.md) visible from outside the box instead of
being a decision buried in a `catch`.

## The deadline is shared across the fan-out, not granted per call

[08](08-timeouts-retries-and-budgets.md)'s rule applied to a fan-out: the client's budget is one
number for the whole thing, and the aggregate spends from it. Parallel legs share the *wall
clock* — they overlap, so each may be allowed most of what remains. Sequential legs share the
*sum* — the second leg's timeout is what is left after the first actually finished, not its own
default all over again.

```text
app's deadline arriving at the aggregate                       2000 ms
  reserve for its own work + writing the response              − 200 ms   → 1800 ms to spend
  parallel (independent): catalogue · price · inventory · reviews
       the ENVELOPE for all four is 1800 ms of wall clock — overlapping, so it is not divided
       each leg still gets a TIGHTER timeout of its own:  700 / 500 / 300 / 400 ms
  sequential (dependent): cart → price-for-cart
       cart ≤ 800 ms;  price-for-cart ≤ (1800 ms − cart's ACTUAL elapsed), never 1800 ms again
  the bug in the wild: an upstream client library with its own 5 s default,
  which outlives the caller — the app has given up, the fan-out is still running
```

Two rules fall out of that block. The aggregate **propagates the remaining deadline** rather than
restarting a timer, because a hop that starts fresh has made every downstream timeout advisory
and every upstream's work potentially unread — the abandoned work of
[08](08-timeouts-retries-and-budgets.md), now multiplied by the fan-out's width, arriving at
services whose connection pools ([14](14-connection-pooling-and-keep-alive.md)) are being held
for a response nobody will read. And a retry *inside* the fan-out spends from the same envelope:
one retry of a 300 ms leg is 600 ms of an 1800 ms budget, which is why a budget rather than a
retry count is the control. RFC 9110 decides which legs may be retried at all:

> *"A request method is idempotent if the intended effect on the server of multiple identical
> requests with that method is the same as the effect for a single such request"* — *"Clients
> may be able to automatically retry requests with idempotent methods following a connection
> failure, since the intended effect should be equivalent"* — RFC 9110, §9.2.2

So a read fan-out that builds a screen may retry freely inside its budget, and a fan-out that
*writes* to two services may not — which is the first sign it does not belong in a gateway at
all, and is [17c](17c-the-fan-out-n-plus-1.md)'s orchestration argument.

## The tail is the slowest leg, not the average

A parallel fan-out returns when the **last** leg returns, so the aggregate's latency is the
maximum of n, never the mean. Two consequences that get answered wrong in the round. Adding a
fifth service to a screen is not free even when that service is fast, because more independent
legs means more chances that one of them lands in its own slow tail, and the aggregate inherits
whichever did. And the aggregate's slow-request rate is therefore worse than any single
upstream's — which is how a screen users call slow can be assembled entirely from services whose
own dashboards look healthy, and why "it's not us" is the honest answer from four teams at once.

The levers are the labels from the first section, reused as latency controls:

- **A per-leg timeout tighter than the envelope**, so a degradable leg is cut loose early instead
  of dragging the whole response to its own worst case.
- **`degradable` as a latency tool, not only a failure tool** — a reviews section that missed its
  400 ms is dropped, not waited for, and the `degraded` array says so.
- **A cache in the aggregate in front of the worst-tailed leg**, so the slow path is taken rarely
  rather than on every request.
- **Fewer required legs.** Each required leg is a veto over the whole screen; the design question
  is how many vetoes a screen deserves, and the answer is usually one or two.
- **Move a genuinely slow leg out of the synchronous fan-out**: the client fetches it separately
  after first paint. That is a product decision the design should surface rather than absorb.

The sentence for the round: *"the fan-out's latency is its slowest leg, so the degradable legs
get short timeouts and the screen renders without them."*

## The storefront

```text
the mobile product screen, aggregated at the mobile BFF (17)
  budget 2000 ms from the app · reserve 200 ms · four parallel legs · remaining deadline propagated to each
    catalogue    required     700 ms    fail → 503 + Retry-After to the app
    price        required     500 ms    fail → 503
    inventory    degradable   300 ms    fail → stock: null, degraded[] += inventory/timeout
    reviews      degradable   400 ms    fail → reviews: null, degraded[] += reviews/unavailable
  retries: every leg here is a GET, so one retry each is permitted INSIDE the 1800 ms envelope
           nothing in this fan-out writes — RFC 9110 §9.2.2 is what makes that safe

what the app renders when inventory is degraded
  the product, the price, the images, and "checking availability" where the stock badge goes
  NOT an empty badge, and NOT an error screen — the degraded[] entry is what distinguishes them

what the dashboard shows
  degraded-rate per field (inventory/timeout, reviews/unavailable) — the alert that catches a
  dependency failing quietly behind a 200
  the SCREEN's own latency distribution, not only the four upstreams' — the fan-out is slower
  than all of them and only the screen's own measurement shows it
```

The last block is the point of the page: four healthy upstream dashboards and one unhappy screen
is the normal state of an un-instrumented fan-out, and the two metrics that fix it are the
degraded rate per field and the aggregate's own latency.

## Gotchas

**★ Symptom: the aggregate returns `200` with three sections empty and nobody noticed for a
week.** Cause: partial failure swallowed, so an outage is indistinguishable from empty data. Fix:
a `degraded` array in the response naming each dropped field and the reason, rendered honestly by
the client and alerted on by rate — and `required` legs that fail the call with a 503 and a
`Retry-After` instead of pretending.

**★ Symptom: the client's 2-second deadline, and four upstreams each given their own 2 seconds.**
Cause: the budget treated as a per-call allowance rather than a shared envelope. Fix: propagate
the *remaining* deadline; reserve time for the aggregate's own work and the response write; give
degradable legs timeouts far tighter than the envelope ([08](08-timeouts-retries-and-budgets.md)).

**★ Symptom: the screen's slow-request rate is worse than every upstream's own.** Cause: a
parallel fan-out waits for its slowest leg, so tail risk compounds with the number of legs. Fix:
fewer required legs, per-leg timeouts tighter than the envelope, degradable sections cut loose
early, a cache in front of the worst-tailed leg — and move a genuinely slow leg out of the
synchronous path so the client fetches it after first paint.

**★ Symptom: a review-service outage took the whole product page down.** Cause: every leg treated
as required by default. Fix: label each leg required / degradable / stale-acceptable at design
time and wire the aggregate to the label; reviews are degradable, price is not, and the label
belongs in the API design rather than in a `catch` block someone wrote at 2am.

**Symptom: upstream services still executing a fan-out the client abandoned.** Cause: the
deadline not propagated, so each leg runs to its own default long after the app gave up. Fix:
propagate the remaining deadline on every leg and cancel the outstanding legs when the envelope
expires; unread work is load that produces nothing and holds pooled connections while doing it.

**Symptom: the aggregate retried a leg that charged a card.** Cause: a retry policy applied to the
fan-out as a whole rather than per method. Fix: RFC 9110 §9.2.2 — retry the idempotent legs,
never the non-idempotent one; and a fan-out that contains a write does not belong in a gateway
([17c](17c-the-fan-out-n-plus-1.md)).

**Symptom: the four upstream dashboards are green and users say the screen is slow.** Cause: the
aggregate's own latency never measured, only its legs'. Fix: instrument the aggregate's response
latency per route as a first-class metric; it is the maximum of its legs plus its own work, and
it is the only number that matches what the user experiences.

**Symptom: a degradable section renders as an empty list, and support cannot tell whether the
product has no reviews or the service is down.** Cause: `null` and "empty" collapsed into one
representation. Fix: `null` plus a `degraded` entry means "we could not ask"; an empty array
means "we asked and there are none" — two different renderings and two different alerts.

**Symptom: every leg is `required` because nobody wanted to decide.** Cause: labelling skipped, so
the default is the strictest one. Fix: labelling is part of designing the screen, and the product
owner is in that conversation — "does this screen render without reviews?" is a product question
with an engineering consequence.

## Interview questions

**★ Your gateway aggregates four services for one screen. Three answer and one times out. What do
you return?**
It depends on a label decided at design time per upstream, not on whatever the code happens to do.
A **required** leg — the product, its price — fails the whole call with a 503 and a `Retry-After`,
because a product screen without a price is not a screen. A **degradable** leg — reviews,
recommendations — is omitted, and the response carries an explicit list naming the dropped field
and the reason, so the client renders honestly and the dashboard alerts on the rate. A
**stale-acceptable** leg is served from the aggregate's cache and marked stale. Name both failure
modes to show the thinking: failing whole on reviews turns a review outage into a catalogue
outage, and a silent `200` with holes teaches clients that every field is optional while hiding
the outage from your own alerting.

**★ How do timeouts work across a fan-out?**
The client's deadline is one budget for the whole aggregate, not a per-call allowance. The
aggregate reserves a slice for its own work and the response write, then propagates the
*remaining* deadline to each leg — parallel legs overlap so they share wall-clock time, while
sequential legs share the sum, meaning the second one's timeout is what is left after the first
actually finished. Degradable legs get timeouts far tighter than the envelope so they are cut
loose rather than dragging the response to their own worst case. Retries spend from the same
budget, so it is a budget rather than a retry count that controls amplification, and RFC 9110
§9.2.2 decides what may be retried at all — idempotent legs may be retried automatically after a
connection failure, a write may not. The bug to look for is an upstream client library with its
own default timeout that outlives its caller, leaving services executing work nobody will read.

**★ Why is a fan-out's latency worse than any of its upstreams'?**
Because a parallel fan-out finishes when its slowest leg finishes, so its latency is the maximum
of n rather than the average, and every additional leg is another chance to land in somebody's
tail. That is why a screen users call slow can be assembled entirely from services whose own
dashboards look fine, and why adding "one more fast service" to a screen is never free. The design
answers are to reduce the number of required legs, give each leg a timeout tighter than the
envelope, treat degradable sections as a latency tool rather than only a failure tool, cache in
front of the worst-tailed leg, and move a genuinely slow leg out of the synchronous path. The
observability answer is to measure the aggregate's own latency, because the legs' dashboards
will not show it.

**How would you make a partially degraded response visible rather than invisible?**
Three places. In the contract: the response type has nullable degradable fields plus an explicit
list naming what was dropped and why, so "we could not ask" is a different value from "there is
nothing". In the client: a rendering for each degraded field that tells the user something honest
— "checking availability" rather than a blank badge — so the product decision is made once,
deliberately. In the dashboard: a degraded rate per field, alerted on, because a dependency that
fails behind a `200` is exactly the failure that nothing else catches. Together they turn silent
partial failure into a signal that someone gets paged for.

**When would you not aggregate at all?**
When the request writes, because a fan-out of writes needs a compensating action and a gateway
has no durable place to run one — the checkout stays a single call to a single service that owns
its transaction and its outbox. When the composition is a single call, because there is nothing
to compose. When the client is on a fast network and the composition is purely presentational, so
the client can do it and you avoid operating a box. And when the upstreams have no batch
endpoints yet, because aggregating over per-item calls simply moves the N+1 closer to the
services and hides it behind a green status code
([17c](17c-the-fan-out-n-plus-1.md)).

← Prev: [17 · Gateway patterns](17-gateway-patterns.md) · Index: [Phase 2 — The request path](README.md) · Next → [17c · The fan-out N+1](17c-the-fan-out-n-plus-1.md)
