---
title: "Traffic has a shape — steady, diurnal, or a spike — and the peak-to-average ratio decides whether you design for the peak or shed load at it; a flash sale, a match starting and a ticket window are the same shape with different names"
sidebar_label: "04 · Traffic shapes"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method and tendencies — no traffic figure from any named company is
> quoted; every number is an assumption stated for the example. Builds on
> [03 · Estimation](03-back-of-the-envelope-estimation.md) (the peak factor) and the latency
> ladder on [phase 0's page 05](../phase-0-the-interview/05-the-latency-ladder.md). Code is
> TypeScript targeting Node 24 (LTS), written to be runnable; **nothing was run**.

**The average request rate designs nothing. The shape of the traffic — steady, diurnal, or a
spike — and the ratio between its peak and its average are what decide the architecture,
because they decide whether capacity can be added in time or must be there already, and
whether the design's job at the peak is to serve every request or to choose which ones to
drop.** Steady traffic is the easy case and rare. Diurnal traffic rises and falls with the day
and is what autoscaling was built for, because the rise is slow enough to follow. A spike — a
flash sale opening, a match starting, a ticket window at ten in the morning — rises faster than
any scaler can react, concentrates on one path, and is usually ten to a hundred times the
average for minutes. For a spike the choice is binary: provision for it in advance, or admit a
bounded rate and put the rest in a queue with a wait page. Both are legitimate designs; what is
not legitimate is a design that mentions neither and hopes.

## The three shapes

| Shape | Looks like | Peak : average | What it implies |
|---|---|---|---|
| **Steady** | flat within a factor of two all day — a B2B API, an internal service | ~1–2× | capacity fixed near the peak; simplest design; rare for consumer products |
| **Diurnal** | a daily wave — evening peak, night trough, weekend differences | ~3–5× | autoscaling on a lagging signal works, because the rise takes hours; scale-down saves money at the trough |
| **Spike** | a step: a sale opens, a match kicks off, a window opens at a fixed time | 10–100× for minutes | scaling cannot follow a step; either pre-provision for it or admit a bounded rate and queue the rest |

Most consumer systems are diurnal with spikes on top, and the spike is what the design is
actually for. The storefront's traffic is diurnal all year and a spike on sale day; the design
conversation is about the spike.

## The peak-to-average ratio is the number to say

[Estimation](03-back-of-the-envelope-estimation.md) produced an average. The next sentence is
the ratio, and it is a design decision as much as an observation: "average a hundred checkouts
a second; sale-day peak a hundred times that for the first ten minutes — I'll design the read
path for the peak, because it is cheap to cache, and admit checkouts at a bounded rate, because
the inventory row cannot take a hundred times its normal load." That sentence contains the
whole traffic-shape answer: the shape, the ratio, which path the peak lands on, and the
peak-versus-shed decision per path.

Two habits around the ratio. Say it per path — reads and writes peak differently, and the
write path is usually where the ratio hurts. And say *when* the peak happens, because a
predictable spike (a scheduled sale) can be pre-provisioned and an unpredictable one (a viral
post) cannot.

## Where the peak lands

A spike does not hit the whole system evenly. It concentrates on:

- **One product's row** — the sale item; every checkout contends on it.
- **One endpoint** — "join contest", "book seat", "add to cart" for the sale item.
- **One moment** — the first seconds after the window opens, when retries from impatient
  clients multiply the real demand.
- **The write path** — reads are cacheable and the cache absorbs a read spike; writes are not,
  and the primary or the hot row is where the spike becomes contention.

So a spike design is mostly a *hot-row* design and an *admission* design, not a fleet-size
design. Adding servers helps the read path and does almost nothing for a single row's lock.

## Designing for the peak

When the spike is predictable and the business will pay, provision for it:

- **Pre-warm** — scale the stateless tier up before the window opens; warm caches with the
  sale catalogue; open database connections ahead of demand.
- **Take the hot path off the database** — move the sale item's counter to a store that can
  decrement atomically at the required rate (a Redis counter with periodic reconciliation, or a
  per-product reservation ledger), and keep the durable order write behind it.
- **Serve reads from the edge** — the sale page, the product page and the countdown are static
  for the duration; a CDN absorbs the read spike entirely.
- **Rehearse** — a load test at the expected peak, on the real path, before the day.

The cost is capacity that sits idle the rest of the year, and the design should say so.

## Shedding at the peak

When the peak exceeds what the write path can take — or when paying for idle capacity is not
worth it — the design admits a bounded rate and sheds the rest *gracefully*:

- **A queue with a wait page** — admit N checkouts a second; everyone else sees a position
  and a countdown rather than an error. The queue is honest and it is what users have come to
  expect from ticket windows.
- **Priority** — admit logged-in users with a cart before anonymous traffic; admit the checkout
  endpoint before recommendations.
- **Degrade non-essential paths** — turn off recommendations, reviews and analytics on the
  sale page; serve the last good version of anything that can be stale.
- **Rate limit per client** — a retry storm from impatient clients is a spike on top of the
  spike; a per-client limit with a retry-after keeps it bounded.
- **Fail fast at the edge** — a request that will not be served should be told so in
  milliseconds at the gateway, not after holding a connection for thirty seconds.

A minimal admission gate, the shape of the thing rather than a product:

```ts
// admission at the gateway: a token bucket for the checkout path.
// admitted requests proceed; the rest get a wait-page response with a retry hint.
export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  constructor(private readonly ratePerSecond: number, private readonly burst: number) {
    this.tokens = burst;
  }
  tryAcquire(): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.ratePerSecond);
    this.last = now;
    if (this.tokens >= 1) { this.tokens -= 1; return true; }
    return false;
  }
}

export const checkoutGate = new TokenBucket(200, 400); // 200 checkouts/s sustained, 400 burst

export function admit(): { admitted: true } | { admitted: false; retryAfterSeconds: number } {
  return checkoutGate.tryAcquire()
    ? { admitted: true }
    : { admitted: false, retryAfterSeconds: 5 }; // the wait page polls, it does not hammer
}
```

The bucket's rate is the number the inventory path can sustain — the output of the deep dive,
not a guess — and a distributed version needs the counter in a shared store; phase 3 and phase 7
of this track cover the real implementations. The interview point is that the admitted rate is
*chosen* and the rejection is *designed*.

## The storefront's sale day, as the sentence

"Diurnal traffic with a scheduled spike on sale day. Reads peak at perhaps a hundred times
average and go to the CDN and the product cache, which I'll pre-warm. Checkouts peak at maybe
fifty times average on the sale item's row; I'll move that item's stock counter to an atomic
store, admit checkouts at the rate that counter and the order write can sustain — say two
hundred a second — and put everyone else in a queue with a wait page. Recommendations and
reviews are off for the duration. We pay with a wait for some customers and idle capacity the
rest of the year; we get an inventory row that never
oversells and a checkout that stays up."

Every clause is a decision an interviewer can probe, and the shape of the traffic is what
produced each one.

## Gotchas

**★ Symptom: "we'll autoscale" as the answer to a flash sale.** Cause: diurnal and spike
treated as the same shape. Fix: a spike is a step that scaling cannot follow; say whether you
pre-provision or admit a bounded rate, and what the user sees when not admitted.

**★ Symptom: more servers for a sale, and the inventory row still locks.** Cause: the peak
lands on one row, not on the fleet. Fix: the hot-row design — an atomic counter off the primary,
a reservation ledger, a bounded admission rate — because a single row's lock is not helped by
replicas of the code that waits on it.

**Symptom: the peak stated for the system, not per path.** Cause: one ratio. Fix: reads and
writes peak differently; the write path's ratio is the one that decides the design.

**Symptom: a retry storm doubled the spike.** Cause: clients retrying rejected requests
immediately. Fix: per-client rate limits with a retry-after, and a wait page that polls on a
schedule rather than on refresh.

**Symptom: users saw errors at the peak instead of a queue.** Cause: shedding without a
designed rejection. Fix: the wait page with a position — the rejection is a product feature,
and it is the difference between "the sale broke" and "the queue was long".

**Symptom: the design assumed the peak was predictable, and it was a viral post.** Cause: the
"when" of the spike not stated. Fix: say whether the spike is scheduled (pre-provision) or not
(admission and degradation are the only tools).

**Symptom: recommendations and reviews still running on the sale page at the peak.** Cause:
no degradation list. Fix: a named list of paths turned off for the duration, decided in advance
and switchable by flag.

**Symptom: the admitted rate was a guess.** Cause: the gate set before the deep dive. Fix: the
rate is the output of the hot-path deep dive — what the counter and the order write sustain —
and the gate is set to it.

## Interview questions

**★ What are the traffic shapes, and how does each change the design?**
Steady — flat within a factor of two; fixed capacity near the peak; rare. Diurnal — a daily
wave with a peak a few times the trough; autoscaling on a lagging signal works because the rise
is slow, and scale-down saves money. Spike — a step ten to a hundred times average for minutes,
concentrated on one path and often one row; scaling cannot follow it, so the design either
pre-provisions for a scheduled spike or admits a bounded rate and queues the rest with a wait
page. Most consumer systems are diurnal with spikes on top, and the spike is what the design is
for.

**★ Design for the peak or shed at it — how do you choose, and what does each cost?**
Design for the peak when the spike is scheduled and the business will pay for capacity that is
idle the rest of the year: pre-warm the stateless tier and the caches, take the hot row off the
primary, serve the read spike from the edge, rehearse with a load test. Shed when the peak
exceeds what the write path can sustain or the idle cost is not worth it: admit a bounded rate
chosen from the hot-path deep dive, queue the rest behind a wait page with a position, degrade
non-essential paths, rate-limit retries, fail fast at the edge. The costs are idle capacity in
the first case and a wait for some customers in the second; both are legitimate and the
sentence names which was chosen and why.

**Where does a spike actually land in the storefront?**
On the sale item's inventory row, on the checkout endpoint, in the first seconds after the sale
opens, and on the write path. The read spike goes to the CDN and the product cache and is
absorbed cheaply; the write spike becomes contention on one row, which more servers do not help.
So the sale-day design is a hot-row design — an atomic counter off the primary or a reservation
ledger — plus an admission gate, not a fleet-size decision.

**Why is a wait page a design decision rather than a failure?**
Because shedding is inevitable above a chosen rate, and the rejection can either be an error or
a product feature. A queue with a position and a countdown tells the user the truth, keeps
retries off the system, and is what ticket windows have trained users to expect. An error at
the peak reads as "the sale broke"; a long queue reads as "the sale was popular". The admitted
rate behind it is the output of the deep dive, and the page is the honest face of that number.

**How does a retry storm interact with a spike, and what prevents it?**
Rejected or slow requests get retried immediately by impatient clients, which multiplies the
real demand and can turn a survivable spike into an outage. Per-client rate limits with a
retry-after header, a wait page that polls on a schedule rather than on refresh, and failing
fast at the edge so a rejected request costs milliseconds rather than a held connection keep the
retry load bounded.

---

← Prev: [03 · Estimation](03-back-of-the-envelope-estimation.md) · Index: [Phase 1 — The method](README.md) · Next → **The API sketch** *(not written yet)*
