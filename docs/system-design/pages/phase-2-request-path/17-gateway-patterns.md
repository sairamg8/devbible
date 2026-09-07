---
title: "The plain gateway routes and enforces policy but deliberately shapes nothing, so teams outgrow it along three named pressures — one payload serving clients that want different ones, one screen costing four round trips, one config file owned by nobody — and the backend-for-frontend answers two of the three by giving each client type its own edge and giving that edge to the team that ships the screens"
sidebar_label: "17 · Gateway patterns"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. Gateway patterns — backend-for-frontend, aggregation, federation — are
> **method with no single primary source**, and are written as such: no vendor, no product, no
> version, no benchmark, and no figure that is not arithmetic done in front of you. What a
> gateway *is*, and the cross-cutting policy it holds, is
> [03](03-reverse-proxies-and-api-gateways.md) and is not repeated here. Contract design for
> REST and GraphQL belongs to [phase 6's syllabus](../../syllabus/06-api-design-and-contracts.md),
> which owns it in depth. This topic continues across five siblings: partial failure, shared
> deadlines and the tail are [17b](17b-aggregation-and-partial-failure.md); the fan-out N+1 is
> [17c](17c-the-fan-out-n-plus-1.md); where the composition belongs and the
> routing-versus-orchestration line are [17d](17d-routing-versus-orchestration.md); and the graph
> at the edge is [17e](17e-graphql-at-the-edge.md) and
> [17f](17f-graphql-authorisation-cost-and-federation.md). **No sandbox run.**

**A gateway pattern is what you build *on top of* the one policy point of
[03](03-reverse-proxies-and-api-gateways.md) once one shape of API stops fitting every client —
and because each pattern is a second system to run, deploy, monitor and be paged for, it has to
be earned by a pressure you can name.** The plain gateway routes, authenticates, limits and
logs; what it deliberately does not do is change the *shape* of anything, because a box that
reshapes payloads is a box that has opinions about the domain. That restraint holds until a
mobile app wants six fields of forty over a slow link, until one screen needs four services and
therefore four crossings, or until the single routing file becomes the thing every team edits
and no team owns. This page is those three pressures, the backend-for-frontend as the answer to
divergence and ownership, the failure mode where N BFFs each reimplement the policy the shared
edge already had, how limits and state work once there are several edges, and when none of it
is worth doing.

## Where the plain gateway stops fitting

| Pressure | What it looks like | The pattern that answers it |
|---|---|---|
| **Client divergence** | one `GET /products/42` serves the union of what every client needs: the web page's forty fields, the app's six, the partner's stable subset — and the app pays for the other thirty-four on a mobile link ([13](13-serialization-on-the-wire.md)) | a **backend-for-frontend** per client type |
| **Chattiness** | one screen needs catalogue, price, inventory and reviews, so the client makes four calls; on a high-latency network the cost is the round trips, not the bytes ([the ladder](../phase-0-the-interview/05-the-latency-ladder.md)) | **aggregation** at the edge ([17b](17b-aggregation-and-partial-failure.md)) |
| **Ownership** | one gateway config the app team must get a platform-team review to change, so a screen change waits behind a queue that has nothing to do with the screen | a **BFF owned by the client team** |

They compose — a BFF that aggregates is the usual shape, and a GraphQL server used as one
client's BFF is that shape again with a query language on the front
([17e](17e-graphql-at-the-edge.md)). And none of them is a reason to move the policy: TLS, token
verification, request IDs and the volumetric limit stay exactly where
[03](03-reverse-proxies-and-api-gateways.md) put them.

## Backend-for-frontend

One gateway **per client type** — not per client instance, and not per screen: a web BFF, a
mobile BFF (often one for both app platforms, sometimes one each when the screens genuinely
diverge), and a partner or public API, which is a client type like any other and the one with
the strictest contract.

| BFF | Shape it returns | Cadence it moves at |
|---|---|---|
| **web** | large, denormalised, often server-rendered; many fields per response, because a round trip is cheap from a datacentre-adjacent browser session | deploys with the web app, many times a day |
| **mobile** | small; only what the screen renders; aggregated so one screen is one call | deploys with the app *release train*, and must keep serving versions already installed on phones |
| **partner** | versioned, conservative, documented; nothing changes shape without a new version | changes on a deprecation schedule measured in months |

**The client team owns its BFF, and that ownership is the whole point.** The team that changes
the screen changes the endpoint that feeds it, in the same change, on the same release, with no
queue at a platform team and no coordination with another client's deploys. A BFF owned by a
central team is the single gateway again with extra hostnames and extra pipelines: all of the
cost, none of the reason.

**What belongs in a BFF:** response shaping — field selection, renaming, flattening; aggregation
for its own screens ([17b](17b-aggregation-and-partial-failure.md)); caching tuned to its own
client; protocol adaptation, so services can speak gRPC and Protobuf internally
([13](13-serialization-on-the-wire.md)) while the app gets JSON; and compatibility shims per app
version, because you cannot force a phone to upgrade — the shim lives in the BFF precisely so
that the *services* never carry it.

**What must never be in a BFF:** authoritative business rules, the only implementation of a
write, or ownership of data. A BFF holds no domain state. The test is
[04](04-stateless-services-and-where-the-state-went.md)'s, asked about the whole box: if this BFF
were deleted and rewritten from the services' published contracts, would anything be lost? If
yes, it has grown a domain, and the routing-versus-orchestration section of
[17b](17b-aggregation-and-partial-failure.md) is about you.

### The failure mode: N BFFs, N implementations of the same policy

Four BFFs means four token verifications, four rate limiters, four request-ID conventions and
four sets of security headers — and they drift, because they deploy on four cadences. One of
them eventually verifies the token differently, or forgets a body-size cap, and the weakest is
the one that gets found. The fix is topology, not discipline: keep **one shared policy edge in
front of the BFFs** and let each BFF do only shaping and aggregation.

```text
clients                one shared policy edge (03)                  per-client BFFs                services
  web       ──┐                                                       web BFF     ──┐
  iOS         ├──►  TLS terminated · token verified locally     ──►    mobile BFF   ├──►  catalogue
  Android     ├──►  request ID assigned · per-IP volumetric limit      partner API ──┘     price
  partner   ──┘     429 + Retry-After contract · one access log                            inventory
                                                                                           orders
    identity reaches every BFF as a verified header on a private network;
    a BFF that re-verifies the token itself costs a signature check and survives
    a network misconfiguration — 03's rule, unchanged by the split
```

A shared *library* is the other answer, and it is worse in one specific way: a library drifts
across release trains — the mobile BFF is three versions behind because the app train is slow —
and the drift is invisible until an audit. The edge cannot be behind itself. Duplicated *code*
between BFFs is acceptable and often correct; duplicated *policy* is the thing that bites.

## Limits and state once there are several edges

**Rate limits belong to the client type and the user, not to the gateway instance**
([07](07-rate-limiting.md)). A mobile screen that costs one aggregated call and a web screen
that costs eight direct ones cannot share a per-request budget without punishing the client that
batched well — the well-behaved app hits the limit first, which is exactly backwards. The key is
`(user, client type, route)`, counted in the shared store so the limit survives any BFF replica
being replaced mid-deploy.

A second limit points the other way: **each BFF is itself a client of the upstream services**,
so catalogue and pricing limit *by calling service*. One BFF bug that loops must not be able to
saturate a service that every other client depends on, and the upstream is the only place that
can enforce that, because the looping BFF is not going to limit itself.

Everything here is stateless in [04](04-stateless-services-and-where-the-state-went.md)'s sense:
per-request caches die with the request, response caches live in a shared store, nothing touches
local disk, no session lives in process. That is what lets a BFF run several replicas, be
restarted mid-deploy and be drained without a user noticing — and a BFF that needs sticky
sessions has quietly given that up.

## When not to

- **One client type and a handful of services.** The plain gateway shapes nothing and needs
  nothing; a BFF here is a second deploy pipeline for a response shape a service could have
  returned.
- **Two clients that want the same payload.** That is not divergence, it is one API with two
  callers — and splitting it doubles the change cost of every field forever.
- **A BFF per screen.** Forty tiny services that all need the same auth, all break together and
  all belong to whoever touched them last. The unit is the client type.
- **A pattern adopted to fix three round trips.** Try batch endpoints upstream first: cheaper,
  still a `GET`, still cacheable at the edge ([05](05-cdns.md)), and no new box to operate.
- **When nobody will own it.** An unowned BFF becomes the platform team's queue — which is
  precisely the ownership problem the pattern was adopted to solve, restored with more hostnames.

## The storefront

```text
today (03's single gateway)
  web + mobile + partner → gateway → catalogue / price / inventory / orders     one payload shape for all three

the pressures, named before the pattern is proposed
  the app's product screen wants 6 fields of 40, from 4 services, in 1 round trip on a mobile link
  the partner wants a versioned contract that does not move when the web app ships on a Tuesday
  the app team waits on a platform review to add one field to one screen

the shape that earns its cost
  gateway (UNCHANGED — 03): TLS · token verified locally · request ID · per-IP volumetric limit · 429 + Retry-After
    → web BFF       owned by the web team;   large denormalised payloads;   deploys with the web app
    → mobile BFF    owned by the app team;   screen-shaped payloads;        per-app-version shims live here
    → partner API   owned by the platform team; versioned REST; deprecation windows in months; limit tier per API key
  services UNCHANGED: each owns its data, and limits its callers by calling service

limits
  (user, client=mobile, route) and (user, client=web, route) counted in the shared store — never per BFF replica
  api_key → tier at the partner edge; catalogue limits "calls from mobile-bff" so one loop cannot starve the web

what deliberately does NOT change
  checkout stays on 03's gateway route: one client call, one service, an Idempotency-Key — nothing to shape
  GET /products/42 keeps its cacheable anonymous edge route (05) — that is the request the CDN is paying for
```

The last two lines are the argument restated: the pattern goes where the pressure is, never
across the whole surface. The checkout gains nothing from a BFF and would lose the single clear
write path of [15](15-the-path-in-the-storefront.md); the anonymous product page gains nothing
and would lose the edge cache that answers most of its traffic.

## Gotchas

**★ Symptom: four BFFs, four token verifications, and one of them was wrong.** Cause:
cross-cutting policy copied into each BFF and left to drift across four release cadences. Fix:
one shared policy edge in front of all of them ([03](03-reverse-proxies-and-api-gateways.md)) —
TLS, verification, request ID, volumetric limit — and BFFs that only shape and aggregate. A
shared library is second best, because it drifts silently with the slowest release train.

**★ Symptom: the BFF is owned by the platform team, and every client change queues behind it.**
Cause: the pattern adopted for its diagram rather than its ownership. Fix: give each BFF to the
client team that ships the screens. If that is organisationally impossible, the BFF is not buying
anything the single gateway does not already give you, and the single gateway is cheaper.

**★ Symptom: the rate limit is "per gateway", and the app that batches well hits it first.**
Cause: limiting requests at the box instead of the caller. Fix: key limits on
`(user, client type, route)` in the shared store ([07](07-rate-limiting.md)), and separately
limit each BFF *at the upstreams* by calling service, so one BFF's loop cannot saturate a shared
one.

**★ Symptom: mobile compatibility shims accumulating inside the catalogue service.** Cause: no
per-client layer, so the shared service carries every client's history and can never delete a
field. Fix: the shim lives in the mobile BFF, which knows which app versions are in the field;
the service keeps one clean contract and one deprecation policy.

**Symptom: a BFF per screen, and forty of them.** Cause: the unit chosen as the screen rather
than the client type. Fix: one BFF per client type, with screens as routes inside it — a route is
cheap, a service is not.

**Symptom: the BFF started querying the catalogue database directly, "just for one field".**
Cause: a BFF given a datastore connection. Fix: a BFF calls services, never their stores; the
service owns its data and its schema, and a shared database between a service and a gateway is
the coupling that makes both undeployable.

**Symptom: the partner integration broke when the web BFF changed a payload.** Cause: the
partner treated as a caller of the web client's edge rather than as its own client type. Fix: a
partner API as its own BFF with versioning, a deprecation window and its own limit tiers — that
is what makes it possible to move the web payload weekly.

**Symptom: the BFF needs sticky sessions.** Cause: per-user state cached in process, so replicas
are no longer interchangeable. Fix: [04](04-stateless-services-and-where-the-state-went.md)'s
rule without exception — the response cache is a shared store, the per-request cache dies with
the request, and a BFF replica can be killed between two requests without a user noticing.

**Symptom: a new BFF shipped without an access log, a dashboard or an on-call rotation.** Cause:
the pattern counted as a payload-shaping layer rather than as a service. Fix: treat each BFF as
a first-class service on the failure walk — replicas, health checks, drain on deploy, its own
latency and error dashboards, and an owner who gets paged; if the team will not take the pager,
they should not take the BFF.

## Interview questions

**★ What is a backend-for-frontend, and who owns it?**
A gateway per client type — web, mobile, partner — that shapes and aggregates responses for that
client's screens, sitting *behind* the shared policy edge rather than replacing it. The client
team owns it, and that is the point rather than a detail: the team that changes the screen
changes the endpoint in the same change, on its own release cadence, with no cross-team queue,
and the app's compatibility shims live there instead of accumulating inside services every client
shares. A BFF owned by a central platform team is the single gateway again with more hostnames —
all of the operational cost and none of the reason. And a BFF owns no domain state: delete it,
rebuild it from the services' published contracts, and nothing is lost.

**★ You have four BFFs. How do you stop each of them reimplementing authentication?**
By not putting authentication in them. One shared policy edge stays in front of all four and does
what [03](03-reverse-proxies-and-api-gateways.md) already described — TLS termination, token
verification against a cached key, request ID, per-IP volumetric limiting, the 429 contract — and
each BFF does only shaping and aggregation. The alternative, a shared library, drifts across four
release trains and the drift is invisible: the BFF whose app release cadence is slowest ends up
three versions behind on the security code. If a BFF must verify for itself as defence in depth,
it re-verifies the forwarded token's signature locally, which is a signature check and no round
trip, and it never trusts a header a client could have set.

**★ When is a gateway pattern the wrong answer?**
When there is one client type and a handful of services — the plain gateway shapes nothing and
needs nothing, and a BFF is a second pipeline for a payload a service could have returned. When
two clients want the same payload, which is one API with two callers rather than divergence.
When the unit chosen is the screen rather than the client type, which produces dozens of tiny
services that break together. When the problem is three round trips that batch endpoints upstream
would fix more cheaply while keeping a cacheable `GET`. And when nobody will own it, because an
unowned BFF becomes the platform team's queue — the ownership problem the pattern exists to
solve, restored with more moving parts.

**A team proposes a BFF because "microservices need one". What do you ask?**
Which of the three pressures they actually have: do clients genuinely want different payloads, is
a screen costing several round trips on a slow network, or is ownership of the current gateway
blocking them? If none applies, the answer is no, because the cost is a service per client type —
a pipeline, replicas, dashboards, an on-call rotation and a policy surface that can drift from
the others. If one applies, the next question is who will own it; if the answer is the platform
team, the pattern does not deliver the thing it is being adopted for.

**How do rate limits change once you have several BFFs?**
They stop being a property of the box and become a property of the caller. Limits are keyed on
the user, the client type and the route, counted in a shared store, so a mobile client whose
screen costs one aggregated call and a web client whose screen costs eight direct calls each get
a budget that matches how they were designed to behave — otherwise the client that batched well
is throttled first. A second, opposite limit lives at the upstream services, keyed by calling
service, so that a bug in one BFF cannot consume the capacity every other client depends on. And
the counters live in the shared store rather than in a replica, because BFF replicas are
disposable by design.

**Why does putting the compatibility shim in the BFF matter?**
Because a phone cannot be forced to upgrade, so some version of your app that shipped two years
ago is still calling you today, and the only question is where its accommodation lives. In the
BFF, it is code owned by the team that shipped that app version, deleted when their telemetry
says nobody is on it, and invisible to every other client. In the service, it is a permanent
field nobody dares remove, a `null` that means three different things, and a contract that every
other consumer must now understand. The BFF exists partly so that the services can keep one clean
contract and one deprecation policy.

← Prev: [16g · When a mesh earns its cost](16g-when-a-mesh-earns-its-cost.md) · Index: [Phase 2 — The request path](README.md) · Next → [17b · Aggregation and partial failure](17b-aggregation-and-partial-failure.md)
