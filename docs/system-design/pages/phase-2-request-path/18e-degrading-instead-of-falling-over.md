---
title: "When the traffic wins anyway, the design decision is what to give up and in which order — shed with 503 and Retry-After, serve stale from the edge, admit at the rate the hot path can actually serve, and turn features off by configuration — because a site that gets smaller under pressure stays up, while one that only gets slower queues itself to death"
sidebar_label: "18e · Degrading instead of falling over"
sidebar_position: 18.8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. **Method and common practice** — load shedding, admission control,
> waiting rooms and feature degradation have no single primary source and are written as every
> gateway and CDN implements them, with no vendor, product or figure. The one normative contract
> is 503 with `Retry-After`, quoted verbatim from
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15.6.4 below, alongside
> [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §4 on 429, quoted in
> [18](18-abuse-at-the-edge.md). Stale-while-revalidate and stale-if-error are named as the CDN
> mechanisms of [05](05-cdns.md); RFC 9111 was **not fetched**. **No sandbox run.**

**Every control on the previous four pages can be correct and the traffic can still be more than
you can serve — so the last design question is not how to stop it, it is what you give up first.**
A system that only gets *slower* under pressure queues itself to death: every request waits, every
timeout fires, every client retries, and the retry storm of
[08](08-timeouts-retries-and-budgets.md) finishes the job. A system that gets *smaller* stays up —
it refuses some requests immediately with a code that says come back, serves older data instead of
fresh data, admits work at the rate the slow resource can actually take, and turns off the
expensive features first. All four of those are decisions with a business owner, made and written
down before the incident, and the reason they belong on an abuse page is that abuse is when you
find out whether you made them.

## The four ways to give less

| Mechanism | What the user gets | Costs | Decide in advance |
|---|---|---|---|
| **shed** — refuse above a concurrency threshold | 503 with `Retry-After` immediately, not a timeout | the request is gone | the threshold, and which routes are exempt |
| **serve stale** — the edge answers from an expired copy | a page that may be minutes old ([05](05-cdns.md)) | staleness, bounded and stated | which objects may go stale and for how long |
| **admit** — a queue in front of the scarce resource | a wait, then a normal response | a queue is a promise you must keep | the admission rate, from measured capacity |
| **degrade** — turn features off | a smaller product: no recommendations, no facets, no search | the feature | the order, as a config flag not a deploy |

> *"The 503 (Service Unavailable) status code indicates that the server is currently unable to
> handle the request."* … *"The server MAY send a Retry-After header field to suggest an
> appropriate time for the client to retry."* — RFC 9110, §15.6.4

The distinction that gets marks: **429 is the caller's condition and 503 is yours.** A caller over
its own limit is told 429 with `Retry-After` ([07](07-rate-limiting.md)); a caller who did nothing
wrong while you are over capacity is told 503 with `Retry-After`, and clients — and your own
retry logic — treat those differently. Sending 429 for overload teaches every well-behaved client
to slow down permanently while the abusive traffic does not.

## Shedding is a concurrency decision, not a rate

A rate limit protects a *caller's* fair share; a shed protects *your* capacity, and capacity is
concurrency: the number of requests in flight holding a thread, a connection and a pool slot
([14](14-connection-pooling-and-keep-alive.md)). So the shed threshold is expressed in requests in
flight, or in queue depth, or in the age of the oldest queued request — never in requests per
second, which tells you nothing about how long each one is holding something.

```ts
// admission at the gateway or in the service: the check is in-process and needs no shared state,
// which is exactly why it is the backstop when the rate limiter's store is unreachable (07)
if (inFlight >= MAX_IN_FLIGHT || queueAgeMs > SHED_AFTER_MS) {
  return serviceUnavailable({ retryAfterSeconds: 5 });      // 503 + Retry-After, fast and cheap
}
```

Two properties make this the right backstop. It is **local** — every replica decides for itself,
so it works when Redis is down and abuse controls have failed open
([18c](18c-bots-challenges-and-the-ladder.md)) — and it is **immediate**, which is the whole
point: a fast 503 leaves the client's deadline intact, while a slow timeout burns it and produces
a retry ([08](08-timeouts-retries-and-budgets.md)). Shedding is only safe because the services are
stateless ([04](04-stateless-services-and-where-the-state-went.md)): any replica may refuse any
request because none of them holds anything the request needed.

## Admission and the waiting room

When the scarce thing is one resource — the sale-day product row, the payment provider's quota,
the database's connection budget — the answer is not to refuse everyone but to admit at the rate
the resource can serve. A waiting room is that idea made visible to the user: a page that says
you are in line, with a token that admits you later.

- **The admission rate comes from measured capacity**, not from a guess, and it is the same
  arithmetic as pool sizing — how many can be in flight against that resource at once.
- **Release with jitter.** Draining a queue in one burst recreates the herd of
  [14](14-connection-pooling-and-keep-alive.md) against the resource you were protecting.
- **A queue is a promise.** If the wait is longer than people will tolerate, they abandon and
  retry, which converts one queued request into several. Show a position or an estimate, cap the
  queue, and shed with 503 beyond the cap rather than accepting an unbounded line.
- **The token must be bound to an identity**, or the queue itself becomes the thing being gamed —
  which is [18d](18d-abuse-that-is-business-logic.md)'s problem arriving one rung earlier.

## The order you give things up

The list is written before the incident, because during it nobody agrees. It is expressed as
configuration flags that can be flipped without a deploy, and every flag has a documented blast
radius:

```text
1  recommendations, "customers also bought", personalisation   →  off; the page still sells
2  search facets, sorting, deep pagination                     →  reduced; basic search survives
3  search itself                                               →  cached suggestions only
4  catalogue freshness                                         →  serve stale at the edge (05)
5  account pages, order history                                →  degraded or shed with 503
—  login and checkout                                          →  never shed, never challenged
```

Two rules make this a design rather than a list. **The revenue path is last**, and everything else
is negotiable in service of it. And **each step is reversible in one flag**, so the person on call
can take the step and undo it without a release — a degradation you can only reach by deploying is
not available during the incident that needs it.

## What you must be able to see

Abuse is detected in aggregates, and the aggregates have to exist before the day you need them:

| Signal | Catches |
|---|---|
| origin request rate vs edge request rate; cache-miss share | a shift from cached to uncached traffic |
| in-flight requests, queue depth, pool saturation | the actual capacity wall |
| failed-to-successful login ratio, fleet-wide | credential stuffing ([18d](18d-abuse-that-is-business-logic.md)) |
| deep-pagination and export share of search | scraping the expensive shapes |
| checkout attempts per product and per account | hoarding on a drop |
| block rate per rule, challenge pass rate | the defences themselves misfiring ([18b](18b-the-waf-and-its-false-positives.md)) |
| orders per minute, signups per minute | everything above, from the business side |

And the one that is structurally hard: **a request blocked at the edge is invisible in your
application logs**, because it never arrived. Edge decision logs have to be shipped into the same
store as application logs, carrying the same request id
([03](03-reverse-proxies-and-api-gateways.md)), or half your incident timeline is missing and a
support ticket with a reference id cannot be traced to anything.

## The storefront's degradation plan

```text
thresholds     shed at N requests in flight per replica, or queue age over 500 ms → 503 + Retry-After
exempt         /api/auth/login and /api/orders are never shed by the generic threshold; they are
               protected by admission on the resource instead, so a buyer mid-checkout finishes
stale          catalogue and product pages: stale-while-revalidate, plus stale-if-error so an
               origin outage serves yesterday's catalogue rather than a 502 (05)
waiting room   sale-day drops only: token bound to the account, admitted at the measured rate of
               the checkout path, released with jitter, queue capped and 503 beyond the cap
flags          recommendations → facets → search → account pages, in that order, each one flag
observability  edge decisions in the application log store with the same request id; alarms on
               in-flight, cache-miss share, failed-login ratio, block rate per rule, orders/min
```

The `exempt` row is the one that turns a shed from a blunt instrument into a design: a generic
threshold that also refuses checkouts protects the database by cancelling the revenue, which is
rarely the trade anyone wanted.

## Gotchas

**★ Symptom: under load the site got slower and slower and then fell over.** Cause: no shed —
everything queued, every client's deadline expired, and the retries arrived on top
([08](08-timeouts-retries-and-budgets.md)). Fix: an in-process concurrency threshold that returns
503 with `Retry-After` immediately; a fast refusal preserves the client's deadline, a slow timeout
destroys it.

**★ Symptom: the shed protected the database by refusing checkouts.** Cause: a global threshold
with no route priority. Fix: a written degradation order with the revenue path exempt — shed
recommendations, facets and search first, protect login and checkout with admission on the
resource instead.

**★ Symptom: none of the abuse was noticed for months.** Cause: no aggregate signals — every
request looked fine individually, and that is all anything measured. Fix: dashboards for
failed-login ratio, cache-miss share, deep-pagination share, checkout attempts per product and
per account, and orders per minute.

**Symptom: the waiting room drained and the checkout fell over anyway.** Cause: the queue released
in a burst, recreating the herd against the resource it was protecting. Fix: admit at the measured
rate of the path with jitter, and cap the queue rather than accepting an unbounded line.

**Symptom: overload was returned as 429 and well-behaved clients throttled themselves for hours.**
Cause: our condition reported as the caller's rate. Fix: 503 with `Retry-After` when we are
shedding; 429 only when that caller exceeded its own limit.

**Symptom: the degradation plan existed but required a deploy.** Cause: feature switches
implemented as code paths behind a release rather than as runtime configuration. Fix: flags
readable at request time with a documented blast radius, flippable by the person on call.

**Symptom: the origin was down and the edge served 502s though everything was cached.** Cause: no
`stale-if-error`. Fix: allow the edge to serve a stale copy when the origin is unreachable — a
day-old catalogue is a product, a 502 is not ([05](05-cdns.md)).

**Symptom: an incident timeline had a hole where the blocked requests should be.** Cause: edge
decisions logged only at the edge. Fix: ship them to the application log store with the same
request id, so a reference id on a block page can be traced.

**Symptom: the queue token was reusable and the waiting room became the thing being gamed.**
Cause: an unbound admission token. Fix: bind the token to the authenticated account, make it
single-use, and expire it.

## Interview questions

**★ What does degrading under abuse actually look like?**
Four mechanisms, chosen in advance and each with an owner. Shedding: above a concurrency
threshold, refuse immediately with 503 and `Retry-After` rather than letting the request queue —
a fast refusal preserves the client's deadline, a slow timeout destroys it and produces a retry.
Serving stale: the edge answers from an expired copy, with `stale-while-revalidate` for load and
`stale-if-error` for an origin outage, which turns a 502 into a slightly old catalogue. Admission:
in front of a single scarce resource, admit at the rate that resource can serve and queue or shed
the rest, releasing with jitter so the drain does not become a herd. And feature degradation: turn
off recommendations, then facets, then search, by configuration flag rather than by deploy. The
principle is that the site should get smaller, not slower.

**★ In what order do you shed, and who decides?**
The order is written before the incident and the business owns it, because it is a revenue
decision rather than a technical one. Recommendations and personalisation go first — the page
still sells without them. Then search facets, sorting and deep pagination, which are the expensive
uncacheable shapes. Then search itself, reduced to cached suggestions. Then catalogue freshness,
by serving stale. Then account and history pages. Login and checkout are never shed by the generic
threshold; they are protected by admission control on the resource they contend for, so a buyer
already in the flow completes. Every step is one flag with a documented blast radius, reversible
by the person on call without a release.

**★ Why is 503 the right answer and 429 the wrong one when you are overloaded?**
Because they describe different conditions and clients act on them differently. 429 says this
caller sent too many requests in a given amount of time — their problem, their rate, and a
well-behaved client will back its own traffic off for a long time afterwards. 503 says the server
is currently unable to handle the request, which is our condition and says nothing about the
caller, and RFC 9110 lets us attach `Retry-After` to suggest when to come back. If overload is
reported as 429, every cooperative client — your own mobile app, your partners, your retry logic
— throttles itself while the traffic that caused the problem does not, so you lose the good
traffic and keep the bad.

**Where does the shed threshold come from, and why not requests per second?**
From concurrency: requests in flight, queue depth, or the age of the oldest queued request. A
rate tells you nothing about how long each request holds a thread, a connection and a pool slot,
so the same rate can be comfortable or fatal depending on what the requests are doing — which is
the pool-sizing arithmetic of [14](14-connection-pooling-and-keep-alive.md) seen from the other
side. In-flight count is also the only signal available locally, in-process, with no shared state,
which is what makes it the backstop that still works when the rate limiter's store is unreachable
and every other abuse control has failed open.

**What has to be true about the services for shedding to be safe?**
They have to be stateless in the sense of
[04](04-stateless-services-and-where-the-state-went.md): no replica holds anything a particular
request needed, so any replica may refuse any request without losing work or breaking a session.
The refusal also has to be genuinely cheap — a fast, non-blocking 503 that does not touch the
database, or the shed becomes another way to spend the capacity it was protecting. And the write
paths have to be idempotent or key-protected, because a client that receives a 503 will retry and
you need that retry to be safe.

← Prev: [18d · Abuse that is business logic](18d-abuse-that-is-business-logic.md) · Index: [Phase 2 — The request path](README.md) · Next → **Phase 3 — Caching everywhere** *(not written yet)*
