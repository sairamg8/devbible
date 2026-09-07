---
title: "Two unrelated problems share the name attack at the edge — a flood measured in bits and packets, absorbed by capacity and anycast a long way from your origin, and a handful of cheap-to-send requests that each cost you a database — so the design is a stack of layers that each subtract one class of traffic, and the residue that is authenticated, well-formed, uncacheable and expensive was always yours to handle"
sidebar_label: "18 · Abuse at the edge"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07 against [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §4, §5 and
> §7.3 (429 and 431, both *"MUST NOT be stored by a cache"*, and the "when under attack … just
> drop connections" consideration) and [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
> §15.6.4 (503 and Retry-After) — quoted verbatim below. A fetch of RFC 9110 for the 403, 413 and
> 414 definitions returned a **truncated document**, so those three codes are described as
> mechanism and deliberately **not quoted**. CDN, anycast and DDoS-mitigation vendor documentation
> was **not fetched**: everything about what an edge absorbs is common practice, written without a
> vendor, a product or a traffic figure. Security in depth is
> [Part 9](../../syllabus/09-security-and-compliance.md). **No sandbox run; no measurement.**

**"The CDN handles it" is the answer that fails the question, because two unrelated problems
share the name.** One is a *flood*: bits and packets aimed at a link or a connection table,
defended by having more capacity than the flood and spreading it across so many places that no
single link carries it — a network problem solved a long way from your code. The other is *a few
requests a second that each cost you a database*: an uncached search with a sort, a deeply nested
query, a login that must run a deliberately slow hash. Each of those is a few hundred bytes on
the wire and individually indistinguishable from a customer, so every bandwidth-shaped defence in
the path sees precisely nothing. This chunk is the layered model — what the network absorbs, what
the cache absorbs, what the rule layer absorbs, and the residue that reaches your code — plus why
your origin's address is part of the design, the status codes for refusing work, and the one
caching rule that turns a defence into a self-inflicted outage. The rule layer that sits here is
[18b](18b-the-waf-and-its-false-positives.md) and the response ladder above it is
[18c](18c-bots-challenges-and-the-ladder.md); the abuse that is *business logic* — stuffing,
scraping, hoarding, enumeration — is [18d](18d-abuse-that-is-business-logic.md), because it
defeats everything on all three; and what to give up when the traffic wins anyway is
[18e](18e-degrading-instead-of-falling-over.md).

## The layers, and what each one can actually absorb

| Layer | Subtracts | Cannot see |
|---|---|---|
| **the network** — anycast edge, provider capacity | packet floods, malformed and spoofed traffic, connections that never complete a handshake | anything about the request; nothing has been parsed yet |
| **the CDN cache** ([05](05-cdns.md)) | every repeat of a cacheable read — a scraper on a cached catalogue is answered at the edge and the origin never learns of it | anything uncacheable: search, cart, checkout, every write |
| **the edge rule layer** — WAF, bot scoring, per-IP limits ([18b](18b-the-waf-and-its-false-positives.md)) | known-bad request *shapes*, oversized requests, protocol anomalies, source reputation, blunt volume per address | who the caller is in your system, whether they own the row, what the request costs you |
| **the gateway** ([03](03-reverse-proxies-and-api-gateways.md)) | unauthenticated requests, schema violations, oversized bodies, per-user and per-route limits ([07](07-rate-limiting.md)) | which single resource is hot; whether this valid request is the ten-thousandth this hour |
| **your service** | per-account and per-resource limits, authorization, admission on the hot row | nothing — but it has already paid to receive the request |
| **your database** | the correctness invariant: stock never goes negative | everything else |

Read it downwards and the sentence to say in the round appears: **each layer subtracts one class
of traffic and hands the rest down, and the residue — authenticated, well-formed, uncacheable,
expensive — is yours by construction.** Anycast cannot know a query is slow. A cache cannot help
with a checkout. A pattern rule cannot know who owns order 1234. The design is not "put a box in
front of it"; it is knowing which box removes which class, and then naming what is left.

## Volumetric and application-layer are not the same problem

| | **Volumetric** | **Application-layer** |
|---|---|---|
| measured in | bits/s, packets/s, connections/s | requests/s **weighted by what each request costs you** |
| exhausts | link capacity, packet processing, connection-tracking state | threads, connection pools ([14](14-connection-pooling-and-keep-alive.md)), CPU, the database |
| must be stopped | upstream of the narrowest link — in a network with more capacity than the flood | where the *cost* is known: the gateway, or the service that owns the resource |
| the mechanism | anycast spreads one destination address across many points of presence, so each site drops its share locally and no single link carries the whole thing | counting and admission per caller, per route, per resource — and caching, so the request is not expensive in the first place |
| in your logs | **nothing**, or an outage: the traffic never arrived because the pipe was full | ordinary-looking traffic, then rising latency and a saturated pool |
| the giveaway | your own bandwidth graphs, and your provider's, upstream of you | latency and saturation at unremarkable request counts |

The number that matters for the second column is not a rate, it is a **ratio**: what the request
costs the sender against what it costs you. Two hundred bytes that trigger an uncached full-text
search with a sort and a count is an asymmetry of orders of magnitude, and the design response is
to *reduce the asymmetry* — cache it, cap the expensive variants, require authentication, put a
cost budget on the endpoint — not to identify the sender, which you generally cannot do
([18d](18d-abuse-that-is-business-logic.md)).

Two cases sit between the columns and are worth naming, because they are what interviewers
actually describe. A **flood of complete, valid HTTP requests for one uncacheable URL** is
volumetric in count and application-layer in shape: the edge's per-IP limits absorb some, request
coalescing and an origin shield ([05](05-cdns.md)) collapse the misses into one origin request,
and the remainder is a load-shed decision ([08](08-timeouts-retries-and-budgets.md)). And a
**flood of connections that are opened and never finish** costs a *slot* at whoever holds them
rather than bandwidth: the defence is that the edge terminates the connection so your origin never
holds a client's ([10](10-tls-termination-and-where-it-lives.md)), plus header and body read
timeouts and a concurrent-connection cap at the terminating proxy
([06](06-long-lived-connections.md)).

## The origin's address is part of the design

Every defence above is optional for anyone who can reach your origin directly. If the origin
answers on a routable address, the edge is a suggestion. Three mechanisms, and you need all
three, because each covers the others' gap:

1. **A network allowlist at the origin** — the firewall or security group accepts connections
   only from the CDN's published address ranges. Those ranges *change*; the allowlist has to be
   refreshed automatically from the published list, or the day a range is added a slice of your
   users gets a refused connection and nothing appears in your application logs.
2. **Proof that the request came through *your* edge** — a shared secret header the origin
   requires, or better, mutual TLS between edge and origin
   ([10](10-tls-termination-and-where-it-lives.md)). The allowlist alone only proves the request
   came through *that CDN*, whose address ranges are shared with every other customer of it.
3. **Never publish the origin.** No DNS record pointing at it ([09](09-dns-as-a-component.md)),
   no `Location` header on a redirect that names it, no error page or health endpoint that prints
   its hostname, and no staging host sitting beside it on the same address.

The trade is real and belongs in the answer: you now have no path around your own edge. Debugging
needs a bastion, health checks need an allowlisted source, and a CDN outage is a full outage with
no bypass — so the design includes a documented, reviewed break-glass change that opens a path,
with an expiry on it, and the knowledge that using it removes every control on these three pages
at once.

## The codes for refusing work, and the caching rule

| Situation | Code | Header | Stored by a cache? |
|---|---|---|---|
| the caller exceeded its rate ([07](07-rate-limiting.md)) | **429** | `Retry-After` | **MUST NOT** — RFC 6585 §4 |
| we are shedding load ([08](08-timeouts-retries-and-budgets.md), [18e](18e-degrading-instead-of-falling-over.md)) | **503** | `Retry-After` | no |
| header fields too large | **431** | — | **MUST NOT** — RFC 6585 §5 |
| body too large / URI too long | 413 / 414 | — | no |
| a block decision | 403, a generic page, a reference id | — | no |
| a challenge ([18c](18c-bots-challenges-and-the-ladder.md)) | the interstitial | — | no |
| a flood, where answering is itself the cost | *no response* | — | — |

> *"The 429 status code indicates that the user has sent too many requests in a given amount of
> time ("rate limiting")."* … *"Responses with the 429 status code MUST NOT be stored by a
> cache."* — RFC 6585, §4

> *"The 431 status code indicates that the server is unwilling to process the request because its
> header fields are too large."* … *"It can be used both when the set of request header fields in
> total is too large, and when a single header field is at fault."* … *"Responses with the 431
> status code MUST NOT be stored by a cache."* — RFC 6585, §5

> *"The 503 (Service Unavailable) status code indicates that the server is currently unable to
> handle the request."* … *"The server MAY send a Retry-After header field to suggest an
> appropriate time for the client to retry."* — RFC 9110, §15.6.4

And the sentence that generalises to all three chunks:

> *"Servers are not required to use the 431 status code; when under attack, it may be more
> appropriate to just drop connections, or take other steps."* — RFC 6585, §7.3

**Answering costs more than dropping.** A rendered error page, a challenge, a JSON body
explaining which limit was hit — each is work you perform on the sender's behalf, and a status
code is only useful to a client that intends to obey it. Politeness is for callers you believe
are real; under pressure the correct response is the cheapest one that is still correct, and the
cheapest is silence.

The rule that actually bites in production: **your abuse responses travel back out through your
own CDN.** A 429, a block page or a challenge stored under a product URL is then served to every
visitor for the length of a TTL — a self-inflicted outage with the RFC's own MUST NOT as its
epitaph, and precisely the cache-key failure [05](05-cdns.md) describes. So `Cache-Control:
no-store` on every abuse response *and* an edge rule that stores no non-2xx for those routes:
two independent mistakes are required to cause it, and you want both covered. The block page
itself stays generic — one message plus a reference id that maps to the edge log entry — so
support can find the decision without the page becoming a description of your rule set.

## The storefront's edge topology

```text
network        anycast edge absorbs packet floods; each point of presence drops its own share
origin         no publicly reachable address; security-group allowlist of the CDN's published
               ranges, refreshed automatically from the published list — not by hand
               + mutual TLS edge→origin, so "any tenant of that CDN" is not a path in
cache          catalogue pages and images cached at the edge; a scraper on those costs one edge
               hit and the origin never learns of it (05); search and checkout are pass-through
slots          the edge terminates every client connection (10); the origin's read timeouts and
               per-address connection cap protect its slots, not its bandwidth
responses      429 + Retry-After (caller's rate) · 503 + Retry-After (our shed) · 431 (headers)
               · 413 (body over 64 KB) · 403 generic page + reference id (block) · drop (flood)
               all Cache-Control: no-store, and the edge stores no non-2xx on these routes
break-glass    one documented change opens a direct path to the origin; it carries an expiry and
               a review, and using it removes every control at once
```

The `responses` block is the row people forget to say aloud, and the `break-glass` row is the one
that makes the cloaking answer sound like a design rather than a slogan: the cost of having no
way in is that *you* have no way in either.

## Gotchas

**★ Symptom: the attack went straight past the CDN.** Cause: the origin answers on a reachable
address, so every edge control was optional for anyone who found it. Fix: allowlist the CDN's
published ranges at the origin with an automated refresh, require mutual TLS or a shared secret
from the edge, and remove every DNS record, redirect and error page that names the origin.

**★ Symptom: a 429 or a block page was served to every visitor of a product page for a whole
TTL.** Cause: an abuse response cached by your own CDN, against RFC 6585's explicit MUST NOT.
Fix: `Cache-Control: no-store` on every abuse response *and* an edge rule that stores no non-2xx
for those routes.

**★ Symptom: bandwidth graphs were flat and the site was down anyway.** Cause: an
application-layer attack — a few hundred bytes per request, an uncached search behind each one —
which no bandwidth-shaped defence can see. Fix: measure requests weighted by cost: origin request
rate, cache-miss share, pool saturation ([14](14-connection-pooling-and-keep-alive.md)), and
defend where the cost is known ([07](07-rate-limiting.md), [18d](18d-abuse-that-is-business-logic.md)).

**Symptom: the origin was locked to the CDN's ranges and something still reached it directly
through that CDN.** Cause: those ranges are shared with every other tenant of the same provider,
so an address allowlist proves only "came through this CDN", not "came through our
configuration". Fix: mutual TLS from the edge, or a shared secret header the origin requires.

**Symptom: the day the provider published a new address range, a slice of requests was refused at
the origin.** Cause: a hand-maintained origin allowlist. Fix: automate the refresh from the
published list, and alarm on connection-refused counts at the origin — the only place that number
exists, since the requests never reached your application.

**Symptom: the origin's connection slots filled with connections that never sent a complete
request.** Cause: slot exhaustion rather than bandwidth exhaustion; nothing on the bandwidth graph
moves. Fix: terminate at the edge so the origin holds no client connections, plus header and body
read timeouts and a per-address concurrent-connection cap at the terminating proxy.

**Symptom: under attack we returned a polite 429 to everything and the flood did not slow down.**
Cause: 429 is a request to a cooperative client; a sender that is not cooperating ignores it while
you pay to render it. Fix: cooperative codes for callers you believe are real, and drop for the
rest — RFC 6585 §7.3's own advice.

**Symptom: overload was reported to clients as 429.** Cause: our condition sent as the caller's
rate. Fix: 503 with `Retry-After` when we are shedding, 429 when they exceeded their own limit;
clients back off differently from each and your dashboards should too.

**Symptom: the block page named the rule that fired.** Cause: a debugging aid shipped to every
visitor. Fix: a generic page plus a reference id that maps to the edge log entry — support can
find it, the page does not describe the rule set.

**Symptom: monitoring reported the origin down after cloaking was enabled.** Cause: the health
check came from a source the new allowlist rejects. Fix: monitors and synthetic checks are an
explicit, verified allowlist entry; alarm on refused connections so this is caught in minutes.

**Symptom: a break-glass bypass opened during an incident was still open months later.** Cause: no
expiry and no review on the change. Fix: the break-glass path carries an expiry, an owner and a
review; closing it is part of the incident's follow-up, not a good intention.

## Interview questions

**★ What does the CDN absorb, and what still reaches you?**
The cache absorbs every repeat of a cacheable read, so a popular catalogue page — or a scraper on
static content — is answered at the edge and the origin never sees it. The network layer absorbs
packet floods, because anycast spreads one address across many points of presence and each drops
its share locally. The edge rule layer absorbs requests with a recognisably bad shape, oversized
requests, and blunt per-address volume. What reaches you is everything uncacheable and
well-formed: search, cart, checkout, every write, every authenticated API call — which is exactly
the expensive set. The residue is the answer: authenticated, well-formed, uncacheable, expensive
requests are yours by construction, which is why rate limiting, admission control and
authorization live in your code and not at the edge.

**★ Volumetric versus application-layer — what changes about the defence?**
A volumetric attack is measured in bits and packets and exhausts a link or a connection table, so
it has to be absorbed upstream of your narrowest link by something with more capacity than the
flood; anycast is the mechanism, spreading one destination across many sites so no single link
carries it, and the traffic never appears in your logs because it never arrived. An
application-layer attack is measured in requests weighted by what each costs you: a few hundred
bytes triggering an uncached search or a slow password hash. Bandwidth defences see nothing,
because there is no bandwidth to see. The defence is where the cost is known — caching so the
request stops being expensive, per-caller and per-resource limits, admission control, and cost
caps on the expensive endpoints. The framing to give is the asymmetry ratio: cheap to send,
expensive to serve, and the fix is to close that gap rather than to identify the sender.

**★ Why does it matter whether your origin is directly reachable?**
Because every control at the edge is optional for anyone who can address the origin directly — the
CDN then defends only the traffic that chooses to go through it. Cloaking is three parts: the
origin's firewall accepts only the CDN's published ranges, refreshed automatically because those
ranges change; the origin additionally requires proof that the request came through *your*
configuration — mutual TLS or a shared secret — since the ranges are shared with every other
customer of that provider; and nothing publishes the origin, meaning no DNS record, no redirect
naming it, no error page printing its hostname, no staging host beside it. The trade is that you
lose every path around your own edge, so a provider outage is a full outage and debugging needs a
bastion; say that, and say that the break-glass change has an expiry.

**What do you return to a client you are limiting or blocking, and what must never happen to that
response?**
429 with `Retry-After` and a body naming the limit when it is the caller's rate; 503 with
`Retry-After` when you are shedding, because that is your condition rather than theirs; 431 when
the header fields are too large; 413 or 414 for an oversized body or URI; 403 with a generic page
and a reference id for a block decision. What must never happen is caching: RFC 6585 says
responses with 429 and with 431 must not be stored by a cache, and the practical failure is your
own CDN storing a block page under a product URL and serving it to everyone for a TTL. So
`no-store` on the response and an edge rule that stores no non-2xx on those routes.

**When is dropping better than answering?**
When the sender is not cooperating, because every byte of an answer is work you do on their
behalf. RFC 6585 §7.3 says it directly for 431 — a server is not required to use the status code,
and under attack it may be more appropriate to just drop connections — and it generalises: a
rendered error page or a challenge costs CPU, a TLS session and often money per request, while a
drop costs a packet. The rule of thumb is that status codes are a contract with clients who
intend to obey them, so they go to traffic you believe is real; volume you have already decided
is abusive gets the cheapest correct treatment, which is no response at all.

**Where do you defend against a flood of complete, valid requests for one uncacheable URL?**
In three places, because it is volumetric in count and application-layer in shape. At the edge:
per-address rate limits, and request coalescing plus an origin shield so that a hundred edge
misses for the same key become one origin request. At the gateway: per-route limits, since one
URL being hot is a route-level fact, and a global shed that returns 503 with `Retry-After` above
a concurrency threshold. In the service: admission control on the resource being hit, and — if
the response can tolerate it — making the URL cacheable for even a few seconds, which converts
the whole problem into an edge hit. Naming all three, and saying which one you would reach for
first, is the answer; naming only the edge is not.

← Prev: [17f · Graph authorisation, cost and federation](17f-graphql-authorisation-cost-and-federation.md) · Index: [Phase 2 — The request path](README.md) · Next → [18b · The WAF and its false positives](18b-the-waf-and-its-false-positives.md)
