---
title: "DNS is the coarsest load balancer you own and the slowest failover — it steers by answering a name with different addresses, it commits for as long as the TTL, and every resolver between you and the user may ignore that TTL — so it is where geo-routing and region failover live, and never where a fast failover does"
sidebar_label: "09 · DNS as a component"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method and common practice — TTL behaviour, anycast, geo-routing and
> health-checked DNS failover are described as the major managed DNS services implement them,
> without vendor names or defaults. The DNS specifications (RFC 1034/1035) were **not fetched**;
> resolution and TTL are stated as mechanism, nothing quoted. The latency of the lookup is the
> ladder of [phase 0](../phase-0-the-interview/05-the-latency-ladder.md). **No sandbox run.**

**DNS is on every diagram as a box nobody designs, and it is a component with three properties
that decide what it can and cannot do.** It *steers*: the authoritative server can answer the
same name with different addresses depending on who asks, when, and what is healthy — which
makes it a load balancer across regions and a failover mechanism. It *commits*: every answer
carries a time-to-live, and resolvers and clients cache it for that long, so a change is not
seen until caches expire — which makes it the slowest failover on the path. And it is *not
under your control past your own servers*: the resolver at the ISP, the operating system's
cache, the browser's cache and the application's own cache each decide how long to keep an
answer, and some ignore the TTL. So DNS is where the coarse decisions live — which region, which
continent, which provider — with TTLs chosen for the failover time you can accept, and never
where a fast failover lives; that is the balancer's job, one layer down. This page is the
lookup and its cost, TTL as a commitment and who honours it, anycast and geo-routing, health-
checked failover with its honest timeline, DNS on the failure walk, and the storefront's zone.

## The lookup, and what it costs

A resolver asked for `shop.example.com` walks the hierarchy — the root servers for `.com`, the
`.com` servers for `example.com`, the authoritative servers for the name — unless it has a
cached answer at any level, which it almost always does for the upper levels. The client asks
its resolver (the ISP's, a public one, or the corporate one); the resolver answers from cache
or walks; the operating system and the browser cache the answer in front of the resolver.

The cost, in the ladder's terms: a cached answer is free; a resolver-cached answer is one round
trip to the resolver, a few milliseconds; a cold walk is several round trips, tens of
milliseconds — and it happens once per TTL per resolver, not per user. The lookup is on the
critical path of a first visit and off it afterwards ([01](01-from-the-tap-to-the-first-byte.md)).
Two things reduce it: a long TTL on records that do not change, and a name that resolves at a
CNAME chain of length one rather than three — each CNAME is a lookup.

## TTL: a commitment, and who keeps it

The TTL is the authoritative server's instruction: "you may use this answer for n seconds".
The trade is direct: a long TTL means fewer lookups and a change that takes up to n seconds to
be seen everywhere; a short TTL means every resolver asks often — load on the authoritative
servers, a lookup on more first visits — and a change that propagates in n seconds.

The part candidates miss is that n is a *suggestion* past your own servers:

| Cache | Honours the TTL? |
|---|---|
| your authoritative servers | yes — they set it |
| the resolver (ISP, public) | usually; some clamp a minimum (a short TTL is raised to their floor) or a maximum |
| the operating system | usually; some cache for a fixed time regardless |
| the browser | its own cache with its own limit, often a minute, regardless of TTL |
| the application runtime | the one you own — a JVM, a connection pool or an HTTP client that resolved once at startup and *never again* is the classic |

So a 60-second TTL gives a change that most clients see in a minute, some in five, and a
misbehaving cache never — until it restarts. A design that says "we fail over with DNS in
thirty seconds" is promising the best case; the honest sentence is *"most traffic moves within
the TTL; a tail of clients with stale caches keeps arriving at the old address for minutes, so
the old address must keep answering — or redirecting — for that long."* And in your own
runtime, the resolution must be *re-done* — a client that caches the address forever has made
DNS failover impossible for itself.

## Anycast: one address, many places

Anycast announces the *same* address from many locations, and the network routes each client to
the nearest announcement. It is how public resolvers and the root servers are reachable in one
round trip from anywhere, and how a CDN's edge is one address that resolves — at the network
layer, not at DNS — to the nearest point of presence. Two consequences: the failover is the
network's, in seconds, when a location withdraws its announcement — faster than any TTL; and
it is for stateless, connectionless or short-connection services, because a route change
mid-connection moves the client to a different location that does not have the connection.
DNS servers are the canonical anycast service; a long-lived WebSocket tier is the canonical
thing not to anycast.

## Geo-routing and weighted answers

The authoritative server can answer differently by who asks:

- **Geo-routing** — the resolver's location (or the client's subnet, when the resolver passes
  it) selects the region's address: European users get the European load balancer. The
  coarse, region-level steering that a balancer cannot do because the balancer is *in* a region.
  The failure: the resolver's location is not the user's — a corporate resolver on another
  continent, or a public resolver without client-subnet support, sends users to the wrong
  region, so the region must still serve them, slowly.
- **Weighted answers** — a percentage of resolvers get address A, the rest B: a coarse canary
  of a new region or provider, or a migration in steps. Coarse because the unit is resolvers,
  not users, and a resolver serves many.
- **Latency-based** — the region with the lowest measured latency from the resolver's network.
  The same steering with a better signal than geography.

All of them are *coarse* — the unit of decision is a resolver's population for a TTL — which is
exactly what makes them right for regions and wrong for backends. Within a region the balancer
decides per connection or per request; DNS decides per resolver per TTL.

## Health-checked failover: the honest timeline

A managed DNS service can check each address's health and stop answering with a failed one.
The timeline, worked, for a region failing over by DNS with a 60-second TTL and a health check
every 30 seconds needing 3 failures:

```text
t = 0       the region's balancer stops answering
t = 30–90   the health checker sees 3 consecutive failures (30 s interval × 3) and withdraws the address
t = 90      new lookups get the healthy region
t = 90–150  resolvers whose cached answer was fresh at t = 90 keep the old address until their TTL expires (up to 60 s)
t = 150     most traffic is on the healthy region
t = 150+    the tail: browser caches, clamped resolvers, runtimes that resolved at startup — minutes to hours
```

Two and a half minutes to "most", and a tail — and the region-level failover is what the
second region of [phase 1's scaling walk](../phase-1-the-method/12-the-scaling-walk.md) actually
costs in recovery time, over and above the data's recovery point. Shorter TTLs and faster
checks shrink the first two numbers; nothing shrinks the tail except the old address continuing
to answer. That is why the sentence for a region failover is *"DNS, a minute or two for most
traffic, and the failed region's front door keeps redirecting for the tail"* — and why anything
that must fail over in seconds — a balancer's backend, a database primary — does not use DNS
to do it.

## DNS on the failure walk

DNS was the first row of [phase 1's failure walk](../phase-1-the-method/11-bottlenecks-and-single-points-of-failure.md)
and the answer was "a managed provider". The design details behind that answer:

- **Two authoritative providers**, or one with anycast across many sites — the authoritative
  servers for the zone are the single point, and a provider outage takes the name with it. Two
  providers means keeping the zone in sync between them, which is tooling.
- **Long TTLs on the apex and the records that never change**; short TTLs only on the records
  that fail over — the balancer's address — and set to the failover time you actually want,
  not to "short to be safe", which is load on the authoritative servers for no gain.
- **The registrar and the zone's own credentials** are the thing that, compromised, moves the
  entire site: DNS is on the security walk as well.
- **Internal DNS** — service discovery inside the platform (**12 · Service discovery** *(not written yet)*) — is a separate system with separate failure modes and much shorter TTLs,
  because inside the platform the caches are yours.

## The storefront's zone

```text
shop.example.com        A/AAAA → the CDN (anycast; the CDN does its own edge routing)     TTL 300 s
api.example.com         A/AAAA → the API gateway's balancer, geo-routed: eu → eu balancer, else → us balancer
                                  health-checked; TTL 60 s — the region-failover record
static.example.com      CNAME → the CDN's hostname                                         TTL 3600 s — never changes
admin.example.com       A → the admin balancer, one region                                 TTL 300 s
_provider-verification  TXT records for the payment provider and the email gateway         TTL 3600 s
mail: MX                the email provider                                                 TTL 3600 s
```

The one short TTL is on `api.example.com`, because that is the record that fails over; the
rest are long because they change only by a deploy that can lower the TTL a day ahead. The
runtime rule alongside it: the Node services resolve the database's and the cache's names
through the platform's internal DNS on every new connection, and the HTTP client to the
payment provider re-resolves rather than pinning — so that the provider's own failover works.

## Gotchas

**★ Symptom: "we fail over with DNS in thirty seconds."** Cause: the TTL taken as the failover
time. Fix: health-check interval plus failures plus TTL for most traffic, and a tail of stale
caches for minutes; the old address keeps answering or redirecting.

**★ Symptom: after a failover, some clients hit the dead address for hours.** Cause: caches
that ignore the TTL — a browser, a clamped resolver, a runtime that resolved once. Fix: expect
the tail; keep the old address serving a redirect; in your own runtimes, re-resolve per
connection.

**★ Symptom: a database failover planned via DNS.** Cause: DNS used for a seconds-scale
failover. Fix: DNS is for regions; a primary's failover is a proxy, a floating address or a
driver that discovers the new primary.

**Symptom: European users routed to the US.** Cause: geo-routing on the resolver's location,
and their resolver is elsewhere. Fix: client-subnet where the resolver supports it; every region
serves every user, if slowly; latency-based routing as the better signal.

**Symptom: every record at a 30-second TTL "to be safe".** Cause: TTL confused with agility.
Fix: short only on the failover record; long on the rest; lower a TTL a day before a planned
change.

**Symptom: the first visit is slow and the trace shows three lookups.** Cause: a CNAME chain.
Fix: one CNAME to the CDN, or an alias record at the apex; each CNAME is a round trip on a cold
cache.

**Symptom: the WebSocket tier put behind anycast, and connections drop on route changes.**
Cause: anycast for a stateful, long-connection service. Fix: anycast for the edge and DNS; a
unicast address per region for the connection tier.

**Symptom: the DNS provider's outage took the site down though every server was up.** Cause:
one authoritative provider. Fix: two providers with the zone synced, or a provider with anycast
across many sites; long TTLs so resolvers keep answering through a short provider outage.

**Symptom: the payment provider failed over and our calls kept going to the old address.**
Cause: the HTTP client pinned the resolved address. Fix: re-resolve on new connections; bound
the client's own DNS cache to the TTL.

**Symptom: the zone changed by someone who should not have.** Cause: registrar or zone
credentials unguarded. Fix: DNS on the security walk — locked registrar, two-factor, change
audit — because a zone change moves the whole site.

## Interview questions

**★ Why is DNS the slowest failover you own, and what is it good for?**
Because a change is seen only when caches expire: the health check must observe the failure
(interval times failures), then new lookups get the new answer, then every resolver's cached
answer must reach its TTL — and some caches ignore the TTL entirely, so a tail of clients keeps
arriving at the old address for minutes to hours. It is good for coarse steering that changes
rarely — which region, which provider, a canary by percentage of resolvers — where a minute or
two is acceptable. Anything that must fail over in seconds — a backend, a database primary —
uses a balancer, a floating address or a discovering client instead.

**★ Explain TTL and who honours it.**
The authoritative server's instruction to cache an answer for n seconds. Long TTLs mean fewer
lookups and slow propagation; short TTLs mean more load on the authoritative servers and faster
propagation. Past your own servers it is a suggestion: resolvers usually honour it but may clamp
it; operating systems and browsers keep their own caches with their own limits; and a runtime
that resolved once at startup never re-asks. So a 60-second TTL moves most traffic in a minute
and leaves a tail — which is why the old address must keep answering and why your own clients
must re-resolve.

**What is anycast, and what should not use it?**
The same address announced from many locations, with the network routing each client to the
nearest — how DNS servers and CDN edges are one round trip away from everywhere, with failover
at the network layer in seconds when a site withdraws. It suits stateless or short-connection
services. A stateful, long-connection service should not use it: a route change mid-connection
moves the client to a location that does not hold the connection. The WebSocket tier gets a
unicast address per region.

**How does geo-routing decide, and how does it get it wrong?**
By the location of the *resolver* asking — or the client's subnet when the resolver forwards
it — mapped to the nearest region's address. It gets it wrong when the resolver is not where
the user is: a corporate resolver on another continent, a public resolver without client-subnet
support. So every region must be able to serve every user, if slowly, and latency-based routing
— the region with the lowest measured latency from the resolver's network — is the better
signal when available.

**Work the timeline of a region failover by DNS.**
With a 60-second TTL and a 30-second health check needing three failures: the region fails at
zero; the checker withdraws the address between thirty and ninety seconds; new lookups get the
healthy region from then; resolvers with a fresh cached answer keep the old one for up to
another sixty seconds; most traffic has moved by about two and a half minutes; and a tail of
stale caches continues for minutes to hours, which the failed region's front door absorbs by
redirecting. That timeline is the recovery time a second region costs, on top of its recovery
point.

**Which records get a short TTL, and why not all of them?**
Only the record that fails over — the API gateway's balancer address — with a TTL equal to the
failover time you actually want. Everything else is long: the apex, the CDN CNAME, mail and
verification records, because they change only by a planned deploy that can lower the TTL a day
in advance. A short TTL on everything buys nothing and costs a lookup on more first visits and
load on the authoritative servers; it is not agility, it is churn.

---

← Prev: [08 · Timeouts, retries and budgets](08-timeouts-retries-and-budgets.md) · Index: [Phase 2 — The request path](README.md) · Next → **TLS termination and where it lives** *(not written yet)*
