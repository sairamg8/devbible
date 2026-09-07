---
title: "A rate limiter is a counter with a policy for time — token bucket for bursts, sliding window for fairness, fixed window for cheapness — keyed by user, key or IP, kept in a shared store, answering 429 with Retry-After, and enforced in more than one place because the edge, the gateway and the service each protect something different"
sidebar_label: "07 · Rate limiting"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §4
> (429 — the definition, Retry-After, *"MUST NOT be stored by a cache"*, and that the RFC does
> not define how the user is identified or requests counted) and [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
> §10.2.3 / §15.6.4 (Retry-After; 503) — verbatim below. The five algorithms and the Redis
> patterns are common practice, stated as such; no library or Redis version is claimed, and the
> Redis sketch is labelled pseudo-code. **No sandbox run.**

**A rate limiter decides, per key and per window of time, whether this request may proceed, and
the whole design is in three choices: what the key is, how time is measured, and where the
count lives.** The algorithms are policies for time: a *token bucket* refills at a steady rate
and lets a client spend a saved-up burst; a *leaky bucket* smooths to a fixed output rate; a
*fixed window* counts per calendar interval and is cheap and unfair at the boundary; a *sliding
log* keeps every timestamp and is exact and expensive; a *sliding counter* weights two fixed
windows and is nearly exact and cheap. The key is a user, an API key, an IP, a route, or a
combination — and each protects against a different abuse. The count lives in a shared store,
because a limit enforced per replica is multiplied by the replica count. The response is a
contract the RFC defines — 429, a Retry-After, never cached — and the place to enforce it is
"more than one", because the edge shields the origin, the gateway shields the services, and the
service shields the one resource that matters. This page is the five algorithms with code for
the two that matter, the keys and what each defends, the distributed counter and its race, the
429 contract, the placement question, and the storefront's limits.

## The five algorithms

| Algorithm | Mechanism | Allows a burst? | Memory per key | Boundary behaviour | Use it for |
|---|---|---|---|---|---|
| **token bucket** | tokens added at rate r up to capacity b; a request takes one; none left → reject | yes, up to b | two numbers (tokens, last refill) | none — continuous | API limits where short bursts are fine: "100/s, burst 200" |
| **leaky bucket** | requests queue; drain at fixed rate r; queue full → reject | no — output is smoothed | the queue, or two numbers | none | shaping traffic to a downstream with a fixed capacity |
| **fixed window** | count per interval (per minute); reset at the boundary | up to 2× at the boundary | one integer | a client can do 2× the limit across one boundary | cheap, coarse limits where 2× is acceptable |
| **sliding log** | store every request's timestamp; count those within the last window | no — exact | one entry per request | exact | low-rate, high-value limits: logins, password resets |
| **sliding counter** | current window's count plus the previous window's count weighted by overlap | approximately no | two integers | ~exact; small error | the general-purpose distributed limiter |

Token bucket is what "rate limit" usually means in an API's documentation — a rate and a burst
— and sliding counter is what a distributed limiter usually implements, because it is two
integers per key and nearly exact.

```ts
// token bucket — rate r per second, capacity b; refills lazily on each check (no timer)
export class TokenBucket {
  private tokens: number;
  private last: number;
  constructor(private readonly rate: number, private readonly capacity: number, now = Date.now()) {
    this.tokens = capacity; this.last = now;
  }
  tryTake(now = Date.now()): boolean {
    const elapsed = (now - this.last) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.rate);   // refill for the time that passed
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
  retryAfterSeconds(): number { return Math.max(0, (1 - this.tokens) / this.rate); } // for the Retry-After header
}

// sliding counter — two fixed windows, the previous one weighted by how much of it is still inside the sliding window
export function slidingCount(prevCount: number, currCount: number, windowMs: number, now: number): number {
  const elapsedInCurrent = now % windowMs;                       // how far into the current window we are
  const weight = (windowMs - elapsedInCurrent) / windowMs;       // the fraction of the previous window still in view
  return prevCount * weight + currCount;
}
// allow if slidingCount(...) < limit; then increment currCount
```

The fixed window's boundary problem, in one sentence for the round: *"a limit of a hundred a
minute lets a client send a hundred at 12:00:59 and a hundred at 12:01:00 — two hundred in a
second — which is why the sliding counter weights the previous window instead of forgetting
it."*

## The key: what you are protecting against

RFC 6585 is explicit that the key is the designer's problem:

> *"This specification does not define how the origin server identifies the user, nor how it
> counts requests."* — RFC 6585, §4

| Key | Protects against | Fails when |
|---|---|---|
| **per user** (authenticated) | one account hammering the API; a runaway client | the abuse is unauthenticated — signups, logins, search |
| **per API key** | a partner integration exceeding its plan | the same partner uses many keys |
| **per IP** | unauthenticated abuse; scrapers | many users behind one NAT share the limit; an attacker has many IPs |
| **per route** | one expensive endpoint (search, export) starving the rest | — this is a capacity limit, keyed by route rather than caller |
| **per resource** | one hot object — a product on sale day, a document | — this is admission, keyed by what is contended |
| **global** | the service's total capacity | it is a load shed, not a rate limit: 503, not 429 |

Real systems layer keys: an IP limit generous enough for a NAT, a per-user limit tighter than
it, a per-route limit on the expensive endpoints, and a global shed. The per-user limit is the
one that returns 429; the global one returns 503.

## The distributed counter

A limit enforced in each of ten stateless replicas is ten times the limit, so the count lives in
a shared store — Redis, in practice — and the design questions are the round trip and the race.

**The race.** Read the count, compare, then increment is two operations, and two replicas
racing let two requests through at the limit. The store must do check-and-increment
atomically: an atomic increment whose *result* is compared (`INCR` returns the new value; if
it exceeds the limit, the request is rejected and the increment is harmless because the key
expires), or a small server-side script that does the sliding-counter arithmetic and the
increment in one step.

```text
# sliding counter in Redis — pseudo-code for a server-side script; keys expire so idle clients cost nothing
key_curr = "rl:{user}:{floor(now / window)}"
key_prev = "rl:{user}:{floor(now / window) - 1}"
prev = GET key_prev or 0
curr = GET key_curr or 0
weight = (window - now mod window) / window
if prev * weight + curr >= limit: return REJECT, retry_after = window - (now mod window)
INCR key_curr; EXPIRE key_curr 2 * window
return ALLOW
```

**The round trip.** One store call per request on the hot path is sub-millisecond in-region and
fine at thousands a second; at a hundred thousand a second it is the store's ceiling. The
standard relief is **local buckets synchronised to the store** — each gateway replica keeps a
per-key token bucket in memory and reconciles with the store every hundred milliseconds or
every N requests — trading exactness (a client can briefly exceed the limit by the replica
count times the sync interval's worth) for a store that sees a fraction of the traffic. Say the
trade: *"approximate by up to a few percent, in exchange for the store not being on every
request."*

**When the store is down.** The gateway's fail-open decision from
[03](03-reverse-proxies-and-api-gateways.md): admit and log, and let the global shed protect the
services. A limiter that fails closed makes its own store the outage.

## The 429 contract

The response is defined, and the parts candidates omit are the ones the RFC makes normative:

> *"The 429 status code indicates that the user has sent too many requests in a given amount of
> time ("rate limiting")."* — *"The response representations SHOULD include details explaining
> the condition, and MAY include a Retry-After header indicating how long to wait before making
> a new request."* — *"Responses with the 429 status code MUST NOT be stored by a cache."* —
> RFC 6585, §4

So: status 429; a body that says which limit and when it resets; a `Retry-After` in seconds
(RFC 9110 §10.2.3: the field indicates how long a client should wait before retrying); and
cache-control that ensures no CDN stores it. The commonly added headers — `RateLimit-Limit`,
`RateLimit-Remaining`, `RateLimit-Reset` — are convention rather than this RFC, and are worth
naming as such. And the distinction that matters for every client's retry logic: 429 is the
*client's* rate; overload is **503 with Retry-After** — RFC 9110 §15.6.4: *"The server MAY
send a Retry-After header field to suggest an appropriate time for the client to retry"* — and
a client backs off differently from each (**08 · Timeouts, retries and budgets** *(not written yet)*).

## Where to enforce it, and why "more than one place"

| Place | What it protects | Key it can see | What it cannot do |
|---|---|---|---|
| **the CDN / edge** | the origin's bandwidth and the gateway itself from volumetric abuse | IP, route, geography | know the user; enforce business limits |
| **the gateway** | the services, uniformly | user, API key, route, IP | know which single resource is hot |
| **the service** | one resource — the inventory row, a third-party API's quota, an expensive query | resource, tenant | protect the gateway from being hit |
| **the client / SDK** | the user's own quota, politely | its own count | be trusted |

Each layer sees a key the others do not, and each defends a different thing: the edge sheds
floods the gateway should never see; the gateway enforces the API's published limits; the
service protects the resource it owns from *legitimate* traffic that is still too much — the
sale-day product, the payment provider's own rate limit that we must not exceed. A design that
limits only at the gateway lets a flood reach the gateway; one that limits only at the service
has already paid for every rejected request; one that limits only at the edge has no notion of
a user. So: coarse at the edge, business limits at the gateway, resource limits in the service.

## The storefront's limits

```text
edge       per IP: 1,000/min, burst 200 — volumetric shield; challenge page above it
gateway    per user:   /api/cart 20/s · /api/orders POST 5/s · /api/search 10/s (sliding counter in Redis)
           per IP, unauthenticated: /api/auth/login 10/min (sliding log — exact, low rate); /api/auth/signup 5/hour
           per route: /api/export 2/min per user — the expensive endpoint
           global shed: 503 + Retry-After when the order service reports pressure
service    order service: admission on the sale-day product — N checkouts/s on that row, queue beyond
           payment adapter: token bucket matching the provider's documented limit — never exceed it
           email worker: token bucket matching the gateway's send quota
```

Two rows carry the marks. The login limit uses a sliding log because exactness matters and the
rate is tiny — the cost of storing ten timestamps is nothing, and a fixed window would allow
twenty attempts across a boundary. And the payment adapter's bucket is a limit we impose on
*ourselves* to stay within a provider's quota: rate limiting is not only defence against callers
but discipline towards dependencies.

## Gotchas

**★ Symptom: the limit is ten times what was configured.** Cause: counters per replica. Fix: a
shared store with atomic check-and-increment; local buckets only as an approximation
synchronised to it.

**★ Symptom: a client sends double the limit in one second at the top of the minute.** Cause:
fixed window boundary. Fix: sliding counter — weight the previous window — or a token bucket
with a burst you chose.

**★ Symptom: a 429 was cached by the CDN and served to every user for a minute.** Cause: RFC
6585's *MUST NOT be stored* not enforced. Fix: `Cache-Control: no-store` on 429s and a CDN rule.

**Symptom: an office of five hundred users is rate-limited as one.** Cause: per-IP key behind a
NAT. Fix: per-user limits for authenticated traffic; the IP limit generous, for floods only.

**Symptom: two requests got through at the limit.** Cause: read-then-increment race across
replicas. Fix: atomic increment with the result compared, or a server-side script.

**Symptom: overload returned as 429 and clients slowed their own retries while the site stayed
down.** Cause: shedding sent as a per-client limit. Fix: 503 with Retry-After for overload; 429
for the client's own rate.

**Symptom: Redis is down and every request is rejected.** Cause: fail-closed limiter. Fix: fail
open — admit and log — with the global shed as the backstop.

**Symptom: the sale-day product overwhelmed the row though the gateway limited every user.**
Cause: a per-user limit does not bound the *sum*. Fix: a per-resource limit in the service —
admission on the hot row.

**Symptom: the payment provider suspended the account for exceeding its quota.** Cause: no
limit towards the dependency. Fix: a token bucket in the adapter matching the provider's
documented rate.

**Symptom: the store sees a round trip per request at a hundred thousand a second.** Cause: an
exact limiter on a hot path. Fix: local buckets synchronised to the store; say the
approximation.

**Symptom: 429 with no Retry-After and no body.** Cause: the contract half-implemented. Fix: the
header in seconds, a body naming the limit and reset, no-store.

## Interview questions

**★ Token bucket, sliding window, fixed window — how do they differ and when do you use each?**
A token bucket refills at a rate up to a capacity and lets a client spend a saved burst — the
usual "rate plus burst" API limit, two numbers per key. A fixed window counts per interval and
resets at the boundary — one integer, cheap, and a client can do double the limit across a
boundary. A sliding log stores every timestamp — exact and expensive, right for low-rate,
high-value limits like logins. A sliding counter weights the previous fixed window by its
overlap with the current sliding window — two integers, nearly exact, the general-purpose
distributed limiter. A leaky bucket smooths output to a fixed rate for a downstream with fixed
capacity.

**★ How do you rate-limit across ten replicas?**
With the count in a shared store, because per-replica counters multiply the limit by ten. The
check and the increment must be atomic — an increment whose returned value is compared to the
limit, or a server-side script doing the sliding-counter arithmetic and increment in one step —
or two replicas racing admit two requests at the limit. At very high request rates, local
buckets per replica synchronised to the store every hundred milliseconds keep the store off the
hot path at the cost of a small, stated inexactness. When the store is down, fail open and rely
on the global shed.

**★ What is the correct response when a client is rate-limited?**
RFC 6585's 429: a body explaining which limit and when it resets, a Retry-After header saying
how long to wait, and no caching — the RFC says 429 responses must not be stored by a cache, so
the CDN is told explicitly. The RFC leaves the key and the counting to the designer. Overload
is a different response: 503 with Retry-After, because it is the server's condition rather than
the client's rate, and clients back off differently from each.

**Where in the path do you enforce rate limits, and why more than one place?**
Coarse, per-IP limits at the edge to shed floods the gateway should never see; business
limits — per user, per key, per route — at the gateway, which knows the identity and protects
the services uniformly; resource limits in the service that owns the resource, which is the
only place that knows the inventory row is hot or that a provider's quota is nearly spent.
Each layer sees a key the others cannot and defends a different thing; limiting in one place
leaves the other two unprotected.

**A per-user limit is enforced and the sale-day product still overwhelmed the database. Why?**
Because a per-user limit bounds each client, not the sum: a hundred thousand users each within
their five-a-second limit is five hundred thousand a second on one row. The protection for a
contended resource is a per-resource limit — admission at the service or gateway on that
product's checkout, letting through what the row can serve and queueing or rejecting the rest
with Retry-After. Rate limiting by caller and admission by resource are different keys for
different threats.

**Why would a service rate-limit itself?**
To stay within a dependency's quota: a payment provider's documented rate, an email gateway's
send limit, a partner API's plan. A token bucket in the adapter matching the provider's limit
means a spike in our traffic becomes a queue on our side rather than a suspension on theirs.
Rate limiting is discipline towards dependencies as well as defence against callers, and the
bucket's parameters come from the provider's documentation, not from our estimate.

---

← Prev: [06 · Long-lived connections](06-long-lived-connections.md) · Index: [Phase 2 — The request path](README.md) · Next → **Timeouts, retries and budgets along the path** *(not written yet)*
