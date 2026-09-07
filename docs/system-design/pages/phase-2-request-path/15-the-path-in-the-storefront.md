---
title: "Two requests through the same edge — a product page and a checkout — take opposite decisions at every hop: the first is cached, anonymous, retried and rate-limited by IP and stops at the edge; the second is uncacheable, authenticated, idempotent by key, rate-limited by user and goes all the way to one row — and saying both traces is the phase's gate"
sidebar_label: "15 · The path in the storefront"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. A synthesis of this phase's pages; every protocol claim is sourced on
> the page it comes from — [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) for
> idempotency and Retry-After, [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) for 429,
> [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446.html) for resumption and 0-RTT, and the
> latency ladder of [phase 0](../phase-0-the-interview/05-the-latency-ladder.md) for the
> figures, which are orders of magnitude on illustrative timeouts. **No sandbox run; no
> measurement.**

**The same edge, the same gateway, the same services — and a product page and a checkout make
different decisions at every one of them, which is the point of tracing both.** The product
page is a read for an anonymous visitor: it is cacheable, so the CDN answers it and the origin
never sees most of them; it is idempotent, so any hop may retry it; it is rate-limited by IP
because there is no user; and it can be served stale, from a replica, or degraded without
recommendations. The checkout is a write by an authenticated buyer: nothing on the path may
cache it; it is a `POST`, so it is retried only under an idempotency key; it is rate-limited by
user and admitted by resource on sale day; it goes to the primary, holds one row for one short
transaction, and the provider's thirty seconds are spent outside it. Every page in this phase
made one of those decisions; this page makes them all, twice, hop by hop, with the timeouts,
the failure at each hop and what the buyer sees — and ends with the gate's own question, the
2-second timeout that became a 14-second outage, answered on this path.

## The two traces, hop by hop

| Hop | `GET /products/42` — anonymous | `POST /api/orders` — authenticated |
|---|---|---|
| **DNS** ([09](09-dns-as-a-component.md)) | `shop.example.com` → the CDN, 300 s TTL, cached on the device after the first visit | `api.example.com` → the geo-routed gateway balancer, 60 s TTL — the record that fails over |
| **TCP + TLS** ([01](01-from-the-tap-to-the-first-byte.md), [10](10-tls-termination-and-where-it-lives.md)) | to the nearest edge; TLS 1.3 resumed; **0-RTT allowed** — a replayed GET is harmless | to the nearest edge; resumed; **0-RTT refused** — the gateway rejects early data on a POST |
| **HTTP version** ([11](11-http-1-1-http-2-and-http-3.md)) | HTTP/3 where the network allows; thirty images on one connection, a loss stalls one | the same connection; one stream |
| **CDN edge** ([05](05-cdns.md)) | **cache hit** on key = path + currency, session cookie absent; 60 s TTL + stale-while-revalidate; purged by tag on price change; ends here for most requests | `private, no-store`; **pass-through** on a warm edge→origin connection over the backbone |
| **Edge rate limit** ([07](07-rate-limiting.md)) | per IP, 1,000/min — the volumetric shield | per IP, the same shield; the real limit is downstream |
| **Network balancer** ([02](02-load-balancing-layer-4-vs-layer-7.md)) | on a miss: a connection to a gateway replica | a connection to a gateway replica |
| **Gateway** ([03](03-reverse-proxies-and-api-gateways.md)) | route → catalogue; auth **optional** — no session, so anonymous; rate limit per IP 100/s; gzip; request ID | route → orders; auth **required** — token verified locally against the cached key, `X-User-Id` forwarded on the private network; rate limit **per user 5/s** (429 + Retry-After); body ≤ 64 KB; **Idempotency-Key required**; sale-day **admission** on the hot product; request ID |
| **Deadline** ([08](08-timeouts-retries-and-budgets.md)) | 2 s set at the gateway, propagated | 10 s set at the gateway, propagated |
| **Layer-7 balancing** ([02](02-load-balancing-layer-4-vs-layer-7.md)) | round robin to catalogue replicas; **one retry on another replica** — idempotent | round robin to order replicas; **no gateway retry** — the client's retry with the same key is the safe one |
| **Service discovery** ([12](12-service-discovery.md)) | `catalogue` Service, readiness-gated endpoints | `orders` Service; `orders → inventory` over gRPC balanced client-side across pod endpoints |
| **Service** ([04](04-stateless-services-and-where-the-state-went.md)) | stateless; product cache (Redis) → replica on miss; **recommendations with a 200 ms timeout and a breaker**, page renders without them | stateless; the transaction: insert order (pending), reserve inventory, outbox row — **commit**; then the provider call from the HTTP pool with its own 30 s timeout; then a second transaction to paid/failed; the callback resolves the order by ID on any replica |
| **Pool** ([14](14-connection-pooling-and-keep-alive.md)) | a connection held ~5 ms; from the replica pool | a connection held ~20 ms — **never across the provider call** |
| **Store** | the replica, or Redis; read-your-writes not needed | the **primary**; one row lock for one short transaction; the idempotency table |
| **Serialization** ([13](13-serialization-on-the-wire.md)) | JSON, gzipped above 1 KB; images as WebP/AVIF from the CDN; fields the screen shows | JSON in, JSON out; the order event to the log as Protobuf with a version |
| **Response** | 200, cached at the edge; the buyer's first byte ~30–45 ms on a repeat visit from the same continent | 201 `{orderId, status: 'pending'}`; ~100 ms from another continent — one crossing, the floor for a write |
| **After the response** | — | outbox → publisher → log → notification, fulfilment, indexer; the order status page gets "paid" over SSE ([06](06-long-lived-connections.md)) |

Reading the two columns top to bottom is the phase gate: every hop named, its latency to an
order of magnitude, TLS termination and rate limiting placed with a reason, and the two
requests taking opposite decisions at each one.

## The same hop, opposite decisions — why

| Decision | Product page | Checkout | Because |
|---|---|---|---|
| **Cache** | yes, at the edge and in Redis | never, anywhere | a read of shared, slowly changing data versus a write that must reach the primary; a cached 201 would be a phantom order |
| **0-RTT** | allowed | refused | RFC 8446: 0-RTT is replayable; a replayed GET returns a page, a replayed POST places an order |
| **Retry** | at the gateway, on another replica | only by the client, with the same idempotency key | RFC 9110: automatic retry is for idempotent methods; POST is not, unless the key makes it so |
| **Rate-limit key** | IP | user, plus admission by resource | no identity on an anonymous read; a per-user limit does not bound the sum on one row |
| **Authentication** | optional | required, verified at the gateway | reads are public; writes name a buyer |
| **Timeout** | 2 s, with recommendations at 200 ms | 10 s, with the provider outside the deadline's critical section | a page that is slow is abandoned; an order that is slow must still complete or fail cleanly |
| **Store** | replica or cache | primary | staleness is acceptable on a product page; an order is written once |
| **Degradation** | without recommendations, stale from the edge, from the replica | pending state, never a silent failure; 503 + Retry-After when shedding | a smaller page is still a page; a half-done order is a support ticket |

The interviewer's follow-up is usually to flip one: *"what if the product page were
personalised?"* — the cache key gains the user or the page becomes uncacheable, the auth
becomes required, the rate limit moves to per-user, and the edge no longer answers it; the trace
changes at four hops, and a candidate who can say which four has understood the path rather
than memorised it.

## What each hop costs, in order of magnitude

```text
product page, repeat visit, same continent      checkout, another continent
  DNS              0 (cached)                       0 (cached)
  TCP + TLS       ~15 ms (resumed, to the edge)     0 (keep-alive on the open connection)
  edge cache hit  ~15 ms round trip                 —
                                                    edge → origin        ~90 ms  (backbone, one crossing)
                                                    gateway               ~1 ms  (local token check, counter increment)
                                                    order service         ~5 ms  (the transaction: 3 writes, 1 lock, commit)
                                                    provider call        ~500 ms–30 s — outside the transaction; the buyer waits on it
                                                    second transaction    ~2 ms
                                                    response             ~90 ms
  first byte      ~30–45 ms                         ~200 ms + the provider — the floor is one crossing; the provider is the variable
```

Illustrative arithmetic on the ladder's figures, and the shape is the lesson: the product page
is dominated by the *nearest* round trip because it never leaves the edge; the checkout is
dominated by the crossing and the provider, and the design's job was to make sure neither is
paid twice — TLS at the edge so the handshake does not cross, the provider outside the
transaction so the row lock does not wait on it.

## Where each trace fails, and what the buyer sees

| Hop fails | Product page | Checkout |
|---|---|---|
| DNS provider | site not found — until the TTL, cached answers keep working | the same |
| the edge PoP | routed to the next PoP by the CDN; a cold cache there | the same; the crossing is from a different city |
| the origin (region) | **served stale from the edge** — `stale-if-error`; the catalogue is a day old and up | 503 + Retry-After from the edge; the cart is saved; "checkout is briefly unavailable" |
| the gateway's counter store | fail open — admitted, logged | fail open — admitted; admission on the hot product falls back to the service's own limit |
| the key for token verification | not needed | the cached key serves; rotation keeps the old key valid through the window |
| the catalogue service | 502 → one gateway retry on another replica; then the edge's stale copy | — |
| recommendations | the page without them, in 200 ms | — |
| the replica | reads fall back to the primary | — |
| the primary | reads unaffected | writes fail for the failover's seconds; "try again" with the same key — safe |
| the provider | — | order stays **pending**; retried by the reconciliation job; the buyer sees "payment pending", never a failure and never a double charge |
| the log / publisher | — | the order is committed; the email and fulfilment are **late**, not lost — the outbox row waits |
| the connection tier | — | the status page reconnects with `Last-Event-ID` and catches up |

Two rows are the marks. The origin down while the product page stays up — a cache that serves
stale on error turns a regional outage into a slightly stale catalogue. And the provider down
while checkout produces pending orders — the pending state, the idempotency key and the
reconciliation job together mean the worst case is "late", never "twice" or "lost".

## The gate's question, answered on this path

*Why did a 2-second timeout at the client become a 14-second outage at the database?* Because,
in the design that fails: the client gave up at 2 s and retried; the gateway waited 5 s per
attempt and retried twice; the catalogue service ran each query for 7 s and never cancelled it;
so one abandoned page request kept six queries running on the replica until 19 s, and every
other client did the same — the replica's slowness was made of abandoned work, which is why
each query took 7 s. In this path it cannot happen: the 2-second deadline is set at the
gateway and propagated, the service's query is cancelled at 1.8 s at the driver, the gateway
retries once — only because a `GET` is idempotent — from a budget, and an expired deadline is
never retried. One query per client request, cancelled early, and the replica stays fast. For
the checkout the same discipline plus one more rule: the provider is outside the deadline's
critical section and outside the transaction, so its thirty seconds hold an HTTP connection
from a cheap pool and never a row lock or a database connection.

## Saying it in the round

The two traces in ninety seconds: *"A product page: DNS cached, resumed TLS to the nearest
edge, cache hit keyed on path and currency, sixty-second TTL with stale-while-revalidate and a
tag purge on price change — most never reach us; on a miss, per-IP limit at the gateway, a
two-second propagated deadline, round robin with one retry because it's idempotent, the
catalogue service with a product cache and a 200 ms breaker on recommendations, the replica
behind it. A checkout: same edge, no cache, no 0-RTT, one crossing on a warm connection to the
gateway, token verified locally, per-user limit and sale-day admission, an idempotency key
required, ten-second deadline, no gateway retry, the order service commits the order pending
with its reservation and outbox row in one short transaction, then calls the provider from an
HTTP pool with its own timeout, then a second transaction; the callback resolves the order by
ID on any replica; the status page gets 'paid' over SSE. The floor is one crossing; the provider
is the variable; nothing on the path holds the row while it waits."*

## Gotchas

**★ Symptom: both traces described the same way — "goes through the CDN to the gateway to the
service".** Cause: the hops named, the decisions not. Fix: at each hop, the opposite choice and
the reason — cache/no cache, 0-RTT/refused, retry/key, IP/user, replica/primary.

**★ Symptom: the checkout traced with a retry at the gateway.** Cause: RFC 9110's idempotency
rule forgotten for POST. Fix: the client retries with the same idempotency key; the gateway
passes failures through.

**★ Symptom: "the CDN caches the API response for a minute" — including the order.** Cause:
`Cache-Control` not set per route. Fix: `private, no-store` on every authenticated or
mutating route; the CDN rule refuses to store them regardless.

**Symptom: the product page down because the region is down.** Cause: no `stale-if-error`.
Fix: the edge serves stale on origin error; the catalogue survives the region.

**Symptom: 0-RTT enabled site-wide.** Cause: the checkout's replay risk missed. Fix: early data
accepted for GET only; the gateway rejects it on POST.

**Symptom: the personalised follow-up answered by "add the user to the cache key".** Cause: one
of four hops changed. Fix: key or uncacheable, auth required, per-user limit, no edge answer —
say all four.

**Symptom: the provider's latency on the checkout's critical path — holding the row.** Cause:
the transaction shape. Fix: commit first, call after, second transaction; the provider holds
an HTTP connection, never a row.

**Symptom: latency figures presented as measured.** Cause: the ladder's arithmetic stated as
data. Fix: "illustrative, orders of magnitude; I'd measure the real path."

**Symptom: the failure walk done for the boxes, not per trace.** Cause: one column. Fix: the
same hop fails differently for a read and a write — stale page versus pending order — and both
are said.

## Interview questions

**★ Trace a product page and a checkout through the same edge, naming each hop's decision.**
Product page: DNS cached; resumed TLS to the nearest edge with 0-RTT allowed; HTTP/3; a cache
hit keyed on path and currency with a sixty-second TTL, stale-while-revalidate and tag purge —
most end here; on a miss, a per-IP limit, a two-second propagated deadline, round robin with
one retry because GET is idempotent, the stateless catalogue service with a Redis product cache,
a 200 ms breaker on recommendations, the replica; JSON gzipped; served stale if the origin is
down. Checkout: DNS to the geo-routed gateway; the same edge, no cache, 0-RTT refused,
pass-through on a warm connection — one crossing; token verified locally, per-user limit with
429 and Retry-After, sale-day admission, idempotency key required, ten-second deadline, no
gateway retry; the order service commits pending, reservation and outbox in one short
transaction, calls the provider from an HTTP pool outside it, finishes in a second transaction;
the callback resolves by order ID on any replica; the event goes out through the outbox; the
status page updates over SSE.

**★ Why do the two requests take opposite decisions at the same hop?**
Because one is a shared, slowly changing read and the other is an authenticated write. A read
can be cached, served stale, retried anywhere, rate-limited by IP and degraded — the worst
outcome is a slightly old page. A write must reach the primary once: a cached response is a
phantom order, a replayed 0-RTT flight or a blind retry is a double order, an anonymous limit
does not bound one user, and "degraded" means a pending state with a reconciliation job rather
than a smaller page. RFC 9110's idempotency rule and RFC 8446's 0-RTT warning are the two
protocol facts behind the split.

**★ What happens to each request when the region is down?**
The product page is served stale from the edge — `stale-if-error` — so the catalogue is browsable
with prices up to a minute old and images from the CDN; the buyer may not notice. The checkout
gets 503 with Retry-After from the edge, the cart is safe in Redis in the surviving region or
in the client's copy, and the page says checkout is briefly unavailable; when the region
returns or DNS fails over to the second region, the client retries with the same idempotency
key and the order is placed once. A read survives as stale; a write waits.

**What if the product page were personalised?**
Four hops change. The cache key must include the user — or, more honestly, the page becomes
uncacheable at the edge with `private, no-store` and only its fragments (images, the static
shell) stay cached. Authentication becomes required, verified at the gateway. The rate-limit key
moves from IP to user. And the edge no longer answers it, so every request pays the crossing —
which is the argument for keeping personalisation in a separate small request that the page
fetches after the cached shell renders.

**Answer the phase gate: the 2-second client timeout and the 14-second database outage.**
Timeouts that grew along the path — 2 s at the client, 5 s per attempt at the gateway, 7 s per
query at the service — with retries at every layer and no cancellation, so one abandoned page
request became six seven-second queries on the replica, and every client did the same; the
replica was slow because it was full of abandoned work. On this path the deadline is set once
at the gateway and propagated, each hop's timeout is what remains, the query is cancelled at
the driver, the only retry is one idempotent GET retry from a budget, and an expired deadline
is never retried; the checkout additionally keeps the provider outside the transaction so no
row lock waits on it.

**Where in the two traces is the floor, and what would double it?**
The product page's floor is one round trip to the nearest edge on a cache hit — tens of
milliseconds. The checkout's floor is one crossing to the origin region — around a hundred
milliseconds from another continent — plus the provider's variable time. It doubles if TLS
terminates at the origin so the handshakes cross too, if a service calls a store or the provider
in another region synchronously, or if the provider call sits inside the transaction so its
latency is added to the row's lock time and to the buyer's wait at the same moment.

---

← Prev: [14 · Connection pooling and keep-alive](14-connection-pooling-and-keep-alive.md) · Index: [Phase 2 — The request path](README.md) · Next → **Service mesh** *(not written yet)*
