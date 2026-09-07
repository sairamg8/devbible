---
title: "Between the tap and the first byte are seven hops — DNS, TCP, TLS, the CDN edge, the balancer, the gateway, the service and its store — each costing a round trip or a queue, and the design questions of this phase are which hops can answer without the rest and which round trips can be removed"
sidebar_label: "01 · From the tap to the first byte"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Latency figures are the Norvig table
> ([norvig.com/21-days.html](https://norvig.com/21-days.html) — *"send packet US to Europe and
> back 150 milliseconds"*) and the circulated Dean list (same-datacentre round trip ~500 µs),
> orders of magnitude only. Protocol facts: [RFC 9000](https://www.rfc-editor.org/rfc/rfc9000.html)
> (QUIC's *"low-latency connection establishment"*), [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446.html)
> (TLS 1.3 resumption with a PSK, 0-RTT's weaker properties), [RFC 9113](https://www.rfc-editor.org/rfc/rfc9113.html)
> (HTTP/2 multiplexing) — verbatim below. TCP's three-way handshake and DNS resolution are stated
> as protocol mechanism, not quoted (RFC 9293 and RFC 1035 not fetched). **No sandbox run.**

**A request is a sequence of round trips before it is a sequence of boxes, and the first job of
this phase is to be able to say the sequence with a cost on each step.** From the tap on the
phone: a DNS lookup (a round trip to a resolver, often cached), a TCP handshake (one round trip),
a TLS handshake (one more, or none on resumption), then the HTTP request itself to the nearest
edge — the CDN, which may answer from cache and end the story — else onward over the provider's
network to a load balancer, a gateway that authenticates and rate-limits, a service, and a store
whose own round trip is the last. On a phone in Europe talking to an origin in the US each
round trip is around 150 ms; inside a datacentre it is around half a millisecond; so the design
lever is *which round trips happen across the continent and which inside the building*. This
page is the hops in order with the cost of each, the hops that can answer without the rest, the
round trips that can be removed and by what, and the sentence that says the whole path in the
round.

## The hops, in order

| # | Hop | What happens | Cost, order of magnitude | Can it answer alone? |
|---|---|---|---|---|
| 1 | **DNS** | the name becomes an address; the resolver walks root → TLD → authoritative, or answers from its cache | a round trip to the resolver (ms); tens of ms on a cold cache; ~0 when cached on the device | no — but a cached answer costs nothing |
| 2 | **TCP handshake** | SYN, SYN-ACK, ACK — one round trip before any byte of payload | one RTT: ~150 ms intercontinental, ~10–30 ms to a nearby edge | no |
| 3 | **TLS handshake** | key agreement and authentication; TLS 1.3 completes in one round trip, or zero on resumption | one RTT, or none | no |
| 4 | **CDN edge** | the request reaches the nearest point of presence; a cache hit is served here | one RTT to the edge for the request itself, tens of ms | **yes — for static and cacheable content** |
| 5 | **Edge → origin network** | the provider's backbone from the edge to the region | tens of ms; often faster than the public internet |—|
| 6 | **Load balancer** | connection or request distributed to a healthy backend | sub-ms inside the region | no |
| 7 | **Gateway** | TLS termination if not earlier; authentication, rate limiting, routing | sub-ms to a few ms (a token check may call a store) | **yes — to reject**: a 401 or 429 stops here |
| 8 | **Service** | the handler; may call other services (each a same-datacentre RTT, ~0.5 ms) | ms | yes, if it has what it needs cached |
| 9 | **Store** | the database or cache round trip | ~0.5 ms RTT + the query; a cache in memory is µs | — |
| 10 | **The way back** | the response retraces the path; the first byte arrives after every forward hop plus the store | the sum | — |

Two numbers carry the whole table, and both are in the latency ladder of
[phase 0](../phase-0-the-interview/05-the-latency-ladder.md):

> *"send packet US to Europe and back — 150 milliseconds"* — Norvig; and, from the circulated
> list credited to Dean and Norvig, *round trip within the same datacenter — about 500,000
> nanoseconds*, half a millisecond.

Three hundred to one. A request that spends three round trips crossing the ocean before its
first payload byte has spent 450 ms on handshakes; the same three inside the region cost 1.5 ms.
Everything in this phase is arranged around that ratio: terminate the expensive handshakes as
close to the user as possible, answer from the edge when the content allows, and keep the
chatty parts — service-to-service calls, database round trips — inside the building.

## The hops that can answer without the rest

Reading the table's last column from the top: the earliest hop that can produce the response is
the one that should, because every hop after it is latency and load.

- **The device's own cache** — a DNS answer with time-to-live remaining, an HTTP response with a
  fresh `Cache-Control` — costs no round trip at all. The catalogue's product images and the
  storefront's JavaScript bundle should live here after the first visit.
- **The CDN edge** answers static assets and cacheable pages — images, bundles, a product page
  for anonymous visitors — in one RTT to the nearest city. This is the hop that removes the
  ocean from most reads, and **05 · CDNs** *(not written yet)* is the page.
- **The gateway** answers *no*: an expired token is a 401 and a rate-limited client a 429 before
  any service is touched. That the rejection is early is the point — the sale-day admission of
  [phase 1](../phase-1-the-method/04-traffic-shapes.md) lives here for the same reason.
- **The service with a cache** answers from memory or a same-region cache without the store's
  round trip.
- **The store** answers everything else, and is the hop the design tries hardest to keep off the
  path of the common read.

The storefront's two requests illustrate the split. *A product page* for an anonymous visitor
ends at hop 4: DNS cached, TCP and TLS to the edge, the page from the edge cache. *A checkout*
goes to hop 9: it cannot be cached, must be authenticated, rate-limited, handled, and committed
— and the design's job is to make sure it takes the ocean once, not three times.

## The round trips that can be removed

Each round trip on the table has a mechanism that removes or hides it:

| Round trip | Removed by | The primary source |
|---|---|---|
| DNS | caching at the device and resolver; a long TTL on stable records; DNS prefetch hints in the page | mechanism |
| TCP handshake | keep-alive — reuse the connection for the next request; HTTP/2 puts every request on one connection | RFC 9113: *"allowing multiple concurrent exchanges on the same connection"* |
| TCP + TLS together | QUIC — the transport and TLS handshakes are combined | RFC 9000: *"QUIC integrates the TLS handshake"*, *"low-latency connection establishment"* |
| TLS handshake on a repeat visit | session resumption with a pre-shared key; 0-RTT data for idempotent requests | RFC 8446 §2.2: PSKs *"established … in a previous connection and then used to establish a new connection ("session resumption")"* |
| The ocean, for reads | the CDN edge; a regional origin for dynamic reads | mechanism |
| The ocean, for handshakes | TLS termination at the edge — the user's handshakes are with the nearest city, and the edge keeps warm connections to the origin | mechanism; **10** *(not written yet)* |
| Service → service hops | fewer hops — a call graph that is a line, not a tree; caching between them | mechanism |
| The store | a cache in front of it; read-your-writes only where needed ([phase 1's read path](../phase-1-the-method/08-read-path-and-write-path.md)) | mechanism |

The 0-RTT row comes with the RFC's own warning, and a candidate who mentions 0-RTT without it
has read a summary:

> *"The security properties for 0-RTT data are weaker than those for other kinds of TLS data.
> Specifically: This data is not forward secret, as it is encrypted solely under keys derived
> using the offered PSK. There are no guarantees of non-replay between connections."* — RFC 8446,
> §2.3

So 0-RTT is for a `GET` of a product page and never for `POST /orders` — a replayed checkout is
a duplicate order, which is exactly the property idempotency keys exist to defeat
([phase 1's API page](../phase-1-the-method/05-the-api-sketch.md)).

## The path with numbers: the storefront from Europe

A buyer in Berlin, the origin in Virginia, the CDN with a point of presence in Frankfurt, a
first visit (nothing cached) and then a repeat visit:

```text
FIRST VISIT — product page
  DNS (resolver cold)            ~30 ms
  TCP to Frankfurt edge          ~15 ms   (one RTT to the edge, not the ocean)
  TLS 1.3 to the edge            ~15 ms
  HTTP GET → edge cache MISS
    edge → Virginia origin       ~90 ms   (backbone, one way ~45 ms, request + response)
    gateway + service + store     ~5 ms
  first byte at the phone       ~155 ms   — then ~15 ms per additional round trip for assets, which hit the edge

REPEAT VISIT — product page
  DNS cached                      0
  TCP to edge                    ~15 ms
  TLS resumption                  0–15 ms (0-RTT for the GET)
  edge cache HIT                 ~15 ms
  first byte                     ~30–45 ms

CHECKOUT — POST /orders
  connection reused (keep-alive)  0
  edge → origin                  ~90 ms   (must go to the origin: uncacheable, authenticated)
  gateway: token check, rate limit ~1 ms
  order service: transaction      ~5 ms   (commit before the provider call)
  response at the phone         ~100 ms   — one ocean crossing, which is the floor for a write from Berlin to Virginia
```

The figures are illustrative arithmetic on the ladder's orders of magnitude, not measurements.
What they show is the shape: the first visit is dominated by handshakes and one origin miss; the
repeat visit is the edge; the checkout is one unavoidable crossing, and any design that makes it
two — a service in Virginia calling a store in Oregon, a synchronous call to a payment provider
on another continent inside the request — doubles the floor.

## Where the failures are

Each hop has a failure the failure walk of [phase 1](../phase-1-the-method/11-bottlenecks-and-single-points-of-failure.md)
must name, and this table is the list for the request path:

| Hop | Fails as | Seen by the buyer as |
|---|---|---|
| DNS | no answer, or a stale answer after a failover | "site not found", or traffic to a dead address until the TTL expires |
| TCP / TLS | a timeout on the handshake; a certificate rejected | a spinner, then a browser error |
| CDN edge | a point of presence down; a cache stampede on a miss | slow, then origin overloaded |
| Load balancer | a health check that lies; connection draining skipped on deploy | requests routed to a dead pod; reset connections mid-deploy |
| Gateway | the auth store unreachable; the rate limiter's counter store down | every request 401, or the limiter fails open or closed |
| Service | a slow dependency with no timeout | the connection held; pools exhausted upstream |
| Store | the primary failing over | writes fail for seconds; reads continue if routed to a replica |

## Saying the path in the round

*"From the phone: DNS, then a TCP and a TLS handshake to the nearest edge — one round trip each,
tens of milliseconds because the edge is close; the product page is served from the edge cache
and never reaches us. A checkout can't be cached: it goes edge to origin over the provider's
backbone, one ocean crossing, then the gateway checks the token and the rate limit, the order
service commits, and the response comes back the same way — about a hundred milliseconds from
Europe, which is the floor for a write, so I keep the provider call out of the transaction and
every service-to-service hop inside the region."* Thirty seconds, every hop named, two numbers,
and the design decisions arriving as consequences.

## Gotchas

**★ Symptom: the path drawn as boxes with no round trips.** Cause: the hops known, their cost
not. Fix: the table — each handshake is a round trip, each crossing 150 ms, each same-region hop
half a millisecond; say the numbers.

**★ Symptom: "the CDN makes everything fast."** Cause: the edge assumed to answer writes. Fix:
the edge answers cacheable reads; a checkout goes to the origin and its floor is one crossing —
the CDN's contribution to it is the warm connection and edge TLS termination.

**★ Symptom: 0-RTT proposed for the checkout request.** Cause: the RFC's warning unread. Fix:
RFC 8446 §2.3 — 0-RTT data is not forward secret and may be replayed; use it for idempotent
reads only, never for `POST /orders`.

**Symptom: three round trips across the ocean before the first byte.** Cause: TLS terminated at
the origin. Fix: terminate at the edge; the user's handshakes are to the nearest city and the
edge holds warm connections to the origin.

**Symptom: a service in one region calling a store in another on every request.** Cause: the
crossing counted once. Fix: data and compute in the same region; cross-region only
asynchronously.

**Symptom: the DNS TTL set to a day, and a failover takes a day.** Cause: DNS treated as free.
Fix: a TTL matched to the failover time you need — and the honesty that resolvers do not always
respect it (**09** *(not written yet)*).

**Symptom: "HTTP/2 fixes head-of-line blocking."** Cause: the two levels conflated. Fix:
RFC 9113 says TCP head-of-line blocking is *not* addressed by HTTP/2; that is what QUIC and
HTTP/3 are for (**11** *(not written yet)*).

**Symptom: the gateway calls the auth store on every request, across a region.** Cause: a
rejection hop made expensive. Fix: verify tokens locally with a cached key; the gateway's job is
to say no cheaply.

**Symptom: the first-byte figure quoted as a measurement.** Cause: arithmetic presented as
data. Fix: "illustrative, on the ladder's orders of magnitude — I'd measure the real path."

## Interview questions

**★ Trace a request from a phone to your service and back, with the cost of each hop.**
DNS — a round trip to the resolver, often cached to zero. TCP — one round trip, tens of
milliseconds to a nearby edge, 150 across an ocean. TLS 1.3 — one round trip, or none with
resumption. The CDN edge — serves cacheable content and stops there; otherwise forwards over the
provider's backbone to the origin region. Load balancer — sub-millisecond. Gateway — token check
and rate limit, a millisecond, and the place a request is rejected early. Service — milliseconds,
plus half a millisecond per same-region call. Store — half a millisecond round trip plus the
query. Then back. The first byte is the sum, dominated by whichever hops cross the ocean.

**★ Which hops can answer without the rest, and why does it matter?**
The device's cache, at no cost; the CDN edge, for static and cacheable content, in one nearby
round trip; the gateway, to reject — 401, 429 — before any service is touched; a service's own
cache, without the store. It matters because every hop after the one that answers is latency
and load: a product page that ends at the edge never reaches the origin, and a rejected request
that stops at the gateway never consumes a service. The design pushes each response to the
earliest hop that can produce it.

**★ What removes a round trip, and which ones can be removed?**
DNS — caching and TTLs. The TCP handshake — keep-alive and HTTP/2's single connection for many
exchanges. TCP and TLS together — QUIC, which integrates the TLS handshake and offers
low-latency establishment. The TLS handshake on repeat visits — resumption with a pre-shared key,
and 0-RTT for idempotent requests only, since RFC 8446 says 0-RTT data is not forward secret and
may be replayed. The ocean — the CDN for reads and TLS termination at the edge for handshakes.
The store — a cache in front of it. Service hops — fewer of them.

**Why is a write from Europe to a US origin about 100 ms at best, and what makes it 300?**
Because a write cannot be cached or served at the edge; it must reach the origin, one
intercontinental crossing at around 150 ms round trip, minus what the backbone and warm edge
connections save. It becomes 300 or more when the path crosses twice — TLS terminated at the
origin so the handshakes cross too, a service calling a store or a provider in another region
synchronously — or when the provider call sits inside the transaction and its latency is added
to the buyer's wait.

**Where does TLS termination belong, and what does the choice cost?**
At the edge, for the user's handshakes: the client negotiates with the nearest city, and the
edge keeps warm, reused connections to the origin so no handshake crosses the ocean. The cost
is that the edge sees plaintext, so the edge is a trusted party and traffic from edge to origin
is re-encrypted — a second, cheap handshake inside the provider's network. Terminating at the
origin keeps the edge blind and adds a crossing per handshake; terminating in the pod adds a
certificate to every service.

**What does the CDN do for a request it cannot cache?**
Less than candidates think, and not nothing: the user's TCP and TLS handshakes are with the
nearby edge instead of the far origin, the edge-to-origin leg runs over the provider's backbone
on connections already open, and the edge can absorb abuse before it reaches the origin. The
floor for the request is still one crossing — the CDN removes handshakes from the ocean, not
the ocean from the write.

---

← Index: [Phase 2 — The request path](README.md) · Next → [02 · Load balancing, layer 4 vs layer 7](02-load-balancing-layer-4-vs-layer-7.md)
