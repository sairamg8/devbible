---
title: "A graph at the edge buys one round trip for a screen's data and ends over- and under-fetching, and it pays for that with the transport: every query is a POST to a single URL, so the CDN that answered most of your traffic has nothing to key on and nothing to store, HTTP's automatic-retry allowance no longer applies, and a partial failure now arrives as a 200 with an errors array that no status-code dashboard will ever notice"
sidebar_label: "17e · GraphQL at the edge"
sidebar_position: 17.6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. 🔴 Two GraphQL primary sources were attempted for this page —
> [graphql.org/learn/caching](https://graphql.org/learn/caching/) and the
> [GraphQL specification](https://spec.graphql.org/October2021/) — and **both returned HTTP 403 to
> the fetch**, so nothing on this page is quoted from either and every GraphQL claim is stated as
> mechanism. The quoted rules are HTTP's, from
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §9.2.1 and §9.2.2 (safe methods,
> idempotent methods and automatic retry) — verbatim below — which is what actually decides that a
> `POST` to one URL is uncacheable and unretryable. Schema design, persisted-query and federation
> *contracts* belong to [phase 6's syllabus](../../syllabus/06-api-design-and-contracts.md), which
> owns them in depth. The server-side costs — per-field authorisation, query cost limits, the
> resolver N+1, schema ownership — are [17f](17f-graphql-authorisation-cost-and-federation.md).
> **No sandbox run.**

**A GraphQL layer at the edge is the third gateway pattern, and the honest way to place it is as a
trade rather than an upgrade: it removes over- and under-fetching and collapses a screen into one
round trip, and it hands back the entire HTTP transport layer you were getting for free.** The win
is real and it is largest exactly where [17](17-gateway-patterns.md)'s pressures were sharpest —
a mobile client on a high-latency link asking for six fields of forty from four services, where
the cost is the round trips rather than the bytes. The bill arrives at the CDN: every query is a
`POST` to a single URL, and both of the things HTTP gives a `GET` — a shared cache that can key on
the request, and permission to retry automatically after a connection failure — are gone by
definition, not by configuration. This page is what the graph genuinely fixes, why the edge cache
stops working and what persisted queries restore, why a `200` with an `errors` array breaks your
alerting, and where the layer should sit.

## What a graph at the edge genuinely fixes

| Problem | What it looked like with fixed endpoints | What the graph does |
|---|---|---|
| **Over-fetching** | one `GET /products/42` returns forty fields because the web page needs them; the app discards thirty-four over a mobile link ([13](13-serialization-on-the-wire.md)) | the client names the fields it wants; the response contains those |
| **Under-fetching** | no endpoint matches the screen, so the client makes four calls and pays four crossings ([the ladder](../phase-0-the-interview/05-the-latency-ladder.md)) | one query, one round trip, the server does the fan-out next to the services |
| **A new screen needs a new endpoint** | a backend change, a review and a deploy before the screen can be built | the fields already exist in the schema; the client writes a new query |
| **The contract is prose** | "what does this endpoint return when the product is unavailable?" answered by reading code | a typed schema with nullability stated per field, which is a promise the server keeps |

```graphql
# one round trip for the mobile product screen — what four separate calls used to fetch
query ProductScreen($id: ID!) {
  product(id: $id)   { id title images(limit: 3) { url } }
  price(productId: $id)     { amount currency }
  stock(productId: $id)     { available }
  reviews(productId: $id, first: 3) { rating body }
}
```

The third row is the same ownership win [17](17-gateway-patterns.md)'s BFF bought, obtained
differently: a BFF gives the client team a service it can change, and a graph gives the client
team a query it can change. That is why "a GraphQL server used as one client's BFF" is the
commonest sane deployment — the two patterns are answers to the same pressure.

## Why the edge cache stops helping

A GraphQL request is conventionally a `POST` with the query in the body, to one URL for the whole
API. Both halves of that sentence are the problem, and the rule that makes it a problem is HTTP's,
not GraphQL's:

> *"A request method is considered 'safe' if its defined semantics are essentially read-only"* —
> *"GET, HEAD, OPTIONS, and TRACE are defined as safe methods"* — RFC 9110, §9.2.1

> *"Clients may be able to automatically retry requests with idempotent methods following a
> connection failure, since the intended effect should be equivalent"* — RFC 9110, §9.2.2

A shared cache keys on the method and the request target. With one URL and one method, every
query in your entire product is the same cache key with a different body — so the CDN of
[05](05-cdns.md), which was answering the majority of your traffic and paying for most of your
latency win, becomes a pass-through. And because a `POST` is neither safe nor idempotent, the
automatic-retry allowance of §9.2.2 does not apply to it either: the retry you were getting from
clients, proxies and balancers for free on reads is now something you must implement and reason
about yourself.

Three mitigations, in the order they are usually worth doing:

**Persisted queries.** The client sends an identifier for a query the server already knows,
instead of the query text. Once the request carries no body, it can be a `GET`:

```text
POST /graphql       body = { "query": "...", "variables": {...} }
                    → one URL, one method: nothing at the edge can key on it, and §9.2.2 does not apply

GET  /graphql?id=<hash-of-a-registered-query>&variables=<url-encoded>
                    → a distinct URL per query+variables: a shared cache CAN key on it,
                      and it is a safe method again, so intermediaries may retry it
```

That is one mechanism doing three jobs: it restores edge cacheability, it restores the safe-method
retry, and — because only registered queries are accepted — it doubles as the allowlist that stops
a client sending an arbitrarily expensive query at all
([17f](17f-graphql-authorisation-cost-and-federation.md)). The costs are real: the registry is a
build-and-deploy artefact that has to be published before the client that uses it ships, and a
mobile app version in the field pins its queries into that registry for as long as it lives.

**Cache inside the server, per entity.** The edge cannot cache the response, but the server can
cache the *things* the response is assembled from — the product, the price — with their own keys
and TTLs in a shared store. That moves the win from "no origin round trip" to "no upstream call",
which is smaller but is the one still available.

**Keep a REST route for the traffic that was paying for the CDN.** The anonymous product page is
high-volume, identical for every visitor and perfectly cacheable as a `GET`. There is no rule
saying a graph must serve every request: the storefront can run a graph for the app's authenticated
screens and keep `GET /products/42` as an edge-cached route, and that mix is a design decision
rather than an admission of defeat.

## A `200` with an `errors` array breaks your alerting

A GraphQL response can carry partial data and a list of errors under a successful HTTP status
code. That is the same partial failure as [17b](17b-aggregation-and-partial-failure.md) — but now
the transport's status code, which every CDN, balancer, access log and default dashboard in the
path uses to decide whether something went wrong, says nothing went wrong.

Three consequences to design for. **Error rate must be computed from the response body**, not the
status line, or a failing resolver is invisible on every dashboard you already have. **Client
error handling has to read the errors array**, because an HTTP-level "it worked" is not an answer
about whether the screen has data. And **the alerting a REST edge gave you does not carry over**:
the 5xx rate that used to page someone is now flat by construction, which is the single most
expensive surprise in moving an edge to a graph.

## Where the layer sits

| Placement | Earns its cost when | What it costs |
|---|---|---|
| **as one client's BFF** | one client type — usually mobile — has the divergence and chattiness pressure of [17](17-gateway-patterns.md), and the others do not | one service, owned by that client team; other clients keep their existing routes and their edge cache |
| **as one shared graph for all clients** | several client types want different shapes of the same domain, and the schema is small enough for one team to own | the schema becomes a shared artefact — the single-gateway ownership problem, restored, and now with a type system ([17f](17f-graphql-authorisation-cost-and-federation.md)) |
| **as a federated graph** | many teams, each owning part of the domain, and one graph is genuinely required by the clients | a composing router on every request, cross-team schema composition checks in CI, and cross-subgraph joins that are fan-outs by another name ([17f](17f-graphql-authorisation-cost-and-federation.md)) |
| **not at the edge at all** | the client's problem is three round trips, and batch endpoints upstream would fix it ([17c](17c-the-fan-out-n-plus-1.md)) | nothing — this is the option people skip |

## The storefront

```text
the pressure that justifies a graph here
  the mobile app's product screen: 6 fields of 40, from 4 services, on a high-latency link
  the app team wants to add a field to a screen without waiting for a backend deploy

the shape
  graph deployed as the MOBILE BFF only — the web app and the partner API keep their REST routes
  behind 03's policy edge, unchanged: TLS, token verification, request ID, per-IP volumetric limit

the transport decisions, made deliberately
  persisted queries only: the app ships a registry hash per query; requests are GET /graphql?id=…&variables=…
    → edge-cacheable for the anonymous parts, safe to retry, and an allowlist against expensive queries
  ad-hoc POST /graphql is enabled in development, and rejected in production

what STAYS on REST and why
  GET /products/42        anonymous, identical for everyone, high volume → the edge answers it (05)
  POST /api/orders        one client call, one owner, an Idempotency-Key → nothing to compose (15, 17d)

alerting that had to be rebuilt
  error rate parsed from the response body's errors array — the 5xx rate on /graphql is flat by design
  degraded-field rate per resolver, same idea as 17b's degraded[]
```

The two REST routes are the point: the graph went where the pressure was, and the request that was
paying for the CDN stayed where it was.

## Gotchas

**★ Symptom: the graph shipped and the CDN hit ratio collapsed.** Cause: every query became a
`POST` to one URL, which a shared cache cannot key on and RFC 9110 gives no retry allowance for.
Fix: persisted queries served as `GET /graphql?id=…&variables=…`, per-entity caching inside the
server, and keep the high-volume anonymous reads on cacheable REST routes.

**★ Symptom: the 5xx rate on the graph endpoint is flat, and users report broken screens.** Cause:
GraphQL returns partial failures as a `200` with an `errors` array, so status-code alerting sees
nothing. Fix: compute error rate from the response body, alert on it, and add a degraded-field rate
per resolver in the spirit of [17b](17b-aggregation-and-partial-failure.md)'s `degraded` array.

**★ Symptom: "GraphQL will make it faster" with no round-trip problem to solve.** Cause: the
pattern adopted for its ergonomics rather than a named pressure. Fix: name which of
[17](17-gateway-patterns.md)'s three pressures applies; if the answer is three round trips on a
fast network, batch endpoints upstream ([17c](17c-the-fan-out-n-plus-1.md)) are cheaper and keep
the edge cache.

**★ Symptom: persisted queries adopted, and a released app version stopped working after a
registry cleanup.** Cause: the registry treated as a cache rather than as a contract with every app
version in the field. Fix: registry entries are retired on the same schedule as app versions, with
telemetry on which hashes are still being requested; the registry is published *before* the client
that uses it ships, never after.

**Symptom: the graph is one shared schema and every team edits it.** Cause: the single-gateway
ownership problem restored with a type system on top. Fix: either one team genuinely owns a small
schema, or move to subgraphs with composition checks in CI
([17f](17f-graphql-authorisation-cost-and-federation.md)) — the thing that must not happen is a
shared file with no owner.

**Symptom: the client stopped retrying failed reads after the migration.** Cause: automatic retry
was a property of safe methods, and the migration made every read a `POST`. Fix: persisted queries
as `GET` restore it for intermediaries; otherwise implement retry deliberately in the client with
jitter and a budget ([08](08-timeouts-retries-and-budgets.md)), because nothing in the path is
doing it for you any more.

**Symptom: a mutation and a query sent in the same request, and someone retried it.** Cause: the
single endpoint hides the safe/unsafe distinction that a URL used to make obvious. Fix: mutations
are never in a retryable path without an idempotency key held by the owning service
([17d](17d-routing-versus-orchestration.md)); keep mutations out of persisted-`GET` routes
entirely, so the safe-method route stays genuinely safe.

## Interview questions

**★ Why does putting GraphQL at the edge hurt your CDN, and what do you do about it?**
Because a shared cache keys on the method and the request target, and a conventional GraphQL
request is a `POST` to one URL for the whole API — so every query in the product is the same cache
key with a different body, and the edge that was answering most of your traffic becomes a
pass-through. RFC 9110 also only permits automatic retry after a connection failure for idempotent
methods, so you lose the free retry on reads at the same time. The main mitigation is persisted
queries: the client sends an identifier for a pre-registered query, which makes the request a `GET`
with a distinct URL per query and variables — cacheable at the edge, safe to retry, and
simultaneously an allowlist against expensive queries. Then cache per entity inside the server,
and keep the genuinely high-volume anonymous reads on REST routes, because there is no rule that
one API style has to serve everything.

**★ What does a graph at the edge actually fix?**
Over-fetching and under-fetching, and the ownership friction between them. Over-fetching: one
endpoint returns the union of every client's needs and a mobile client discards most of it on a
slow link. Under-fetching: no endpoint matches the screen, so the client makes four calls and pays
four crossings, which on a high-latency mobile network is the dominant cost — the graph turns that
into one round trip with the fan-out happening next to the services. And a new screen usually
needs no backend change at all, because the fields already exist in the schema; that is the same
ownership win a BFF buys, obtained by giving the client team a query to change instead of a
service.

**★ Your GraphQL error rate looks like zero. Why don't you believe it?**
Because GraphQL returns partial failures as a `200` with an `errors` array and possibly partial
data, so the HTTP status code — which the CDN, the balancer, the access log and every default
dashboard use to decide whether something failed — reports success while a resolver is down.
Error rate has to be computed from the response body and alerted on there, and it is worth adding
a per-resolver degraded rate in the spirit of an aggregate's degraded list, so "the reviews
resolver is failing" is distinguishable from "this product has no reviews". Missing this is the
most expensive surprise in moving an edge to a graph, because the alerting you already had goes
quiet rather than going wrong.

**Would you put a graph in front of everything?**
No. The pattern earns its cost where clients want different shapes and screens cost round trips —
typically a mobile client — and it costs you the edge cache exactly where the edge cache was
worth most: high-volume, anonymous, identical-for-everyone reads. So the usual shape is a graph as
one client's BFF, with the anonymous product page kept as a cacheable `GET` and writes kept as a
single call to the service that owns them. A mixed estate is the normal outcome, and being able to
say which request goes to which style, and why, is the answer the round is looking for.

**How do persisted queries change the deployment story?**
They turn the set of allowed queries into a build artefact with a lifecycle. The registry must be
published before the client that references it ships, or the first request from the new version
fails; entries cannot be deleted while any app version in the field still sends that hash, so
retirement is driven by telemetry on which hashes are still arriving rather than by a cleanup
ticket; and development needs a way to run ad-hoc queries that production rejects. In exchange you
get three things from one mechanism: `GET` requests the edge can cache, safe-method retry
semantics back, and an allowlist that removes arbitrary query cost as an attack surface.

← Prev: [17d · Routing versus orchestration](17d-routing-versus-orchestration.md) · Index: [Phase 2 — The request path](README.md) · Next → [17f · Graph authorisation, cost and federation](17f-graphql-authorisation-cost-and-federation.md)
