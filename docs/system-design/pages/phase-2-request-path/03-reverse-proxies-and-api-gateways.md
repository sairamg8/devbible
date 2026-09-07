---
title: "A reverse proxy stands in for the servers behind it; an API gateway is a reverse proxy that also enforces policy — authentication, rate limits, TLS, compression, routing, shaping — which makes it the one place every request is inspected and the one box whose death is every request's death"
sidebar_label: "03 · Reverse proxies and API gateways"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method and common practice — the proxy and gateway responsibilities are
> described as NGINX, Envoy, HAProxy and the cloud gateways implement them, without vendor
> claims. The protocol facts are [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §4
> (429, *"MUST NOT be stored by a cache"*, Retry-After) and [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
> §10.2.3 / §15.6.4 (Retry-After, 503) — verbatim below. **No sandbox run.**

**A reverse proxy is a server that receives the client's request and makes the real request
on the client's behalf, so that the client only ever talks to one address and never learns
where the work is done. An API gateway is a reverse proxy with opinions: it is where the
policies that every request must obey are enforced once — who you are, how often you may ask,
which service answers, whether the response is compressed, what the request may look like — so
that no service has to implement them and no service can forget to.** The gateway is therefore
two things at once: the single policy point that makes a system coherent, and the single point
of failure that the failure walk has to answer for. This page is what a reverse proxy does and
why it exists, the seven jobs a gateway takes off the services, what each costs, the gateway on
the failure walk and the two ways it fails, and the storefront's gateway with its rules written
out.

## The reverse proxy

A *forward* proxy stands in for clients (the corporate proxy that fetches the web on your
behalf); a *reverse* proxy stands in for servers. The client resolves one name, connects to one
address, and the proxy opens its own connection to whichever backend it chooses and relays the
exchange. Three things follow, and they are the reasons it exists:

1. **The backends are hidden.** Their addresses, count and topology are the proxy's business;
   they can change under a stable public address. Every deploy, scale event and migration in
   [phase 1](../phase-1-the-method/14-evolution-and-operations.md) happens behind it.
2. **The connection is split.** The client's connection — possibly slow, mobile, half-open —
   terminates at the proxy; the proxy's connection to the backend is fast, local, and pooled.
   A backend never waits on a slow client's upload or a slow client's read; the proxy buffers.
3. **One place to do the same thing to every request.** TLS, compression, logging, headers —
   the beginnings of a gateway.

The layer-7 balancer of [02](02-load-balancing-layer-4-vs-layer-7.md) is a reverse proxy that
chooses among equivalent backends; a gateway is a reverse proxy that chooses among *different*
ones and enforces policy on the way.

## The seven jobs of a gateway

| Job | What the gateway does | What it takes off the services | The cost |
|---|---|---|---|
| **Routing** | `/api/catalogue` → catalogue service, `/api/orders` → order service; by path, host, header, version | knowing about each other; a public port each | a routing table that is configuration and can be wrong |
| **TLS termination** | holds the certificates, decrypts, optionally re-encrypts to backends | certificate management per service; the handshake CPU | the gateway sees plaintext; it is trusted |
| **Authentication offload** | validates the token — signature against a cached public key — and forwards the identity as a header | every service parsing and verifying tokens | services must trust the header, so the network must not let clients set it |
| **Rate limiting** | counts per user, key or IP; rejects with 429 | the counter, the store, the rejection contract | a counter store on the hot path; fail-open or fail-closed |
| **Compression** | gzip, brotli on responses; decompresses request bodies | CPU per response in every service | CPU at the gateway; small responses not worth compressing |
| **Request shaping** | body size limits, header limits, timeouts, schema or content-type checks, rejecting malformed requests | defensive parsing everywhere | rejects that the service never sees or logs |
| **Observability** | one request ID assigned, one access log, one place to measure latency and errors per route | correlating logs across services | the log volume of every request in one place |

Also commonly: caching of responses for cacheable routes, request and response header rewriting,
CORS, retries of idempotent requests on another backend, and canary or A/B routing by header or
percentage.

The authentication row carries the trap. Once the gateway has verified the token and forwards
`X-User-Id: 42`, every service trusts that header — so a client that can reach a service
directly and set the header is authenticated as anyone. The rule: services are reachable only
from the gateway (network policy, mutual TLS, a private network), or the gateway forwards the
*token* and services verify the signature locally against the same cached key. The second is
cheap — a signature check, no store — and survives a misconfigured network.

## The rate-limit contract

The gateway's rejection has a defined shape, and quoting the RFC is the difference between "we
return an error" and knowing the contract:

> *"The 429 status code indicates that the user has sent too many requests in a given amount of
> time ("rate limiting")."* — *"The response representations SHOULD include details explaining
> the condition, and MAY include a Retry-After header indicating how long to wait before making
> a new request."* — *"Responses with the 429 status code MUST NOT be stored by a cache."* —
> RFC 6585, §4

> *"The Retry-After header field indicates how long a client should wait before retrying a
> request to the origin server."* — RFC 9110, §10.2.3

So the gateway returns 429 with a `Retry-After`, the CDN in front must not cache it, and a
well-behaved client waits. The same header rides on 503 — RFC 9110 §15.6.4: *"The server MAY
send a Retry-After header field to suggest an appropriate time for the client to retry"* —
which is what the gateway returns when it is *shedding* for overload rather than limiting a
client: 429 is "you asked too much", 503 is "we cannot serve right now", and mixing them
confuses every retry policy downstream. The algorithms — token bucket and the rest — are
**07 · Rate limiting** *(not written yet)*.

## The gateway on the failure walk

Every request passes through it, so its death is total, and it fails in two ways that need
different answers:

**It dies.** The answer is the balancer's: replicas behind a network balancer, health-checked,
drained on deploy — the gateway is stateless by design, and the one piece of state it needs,
the rate-limit counters, lives in a store, so any replica can serve any request.

**Its dependencies die.** The gateway calls two things on the hot path: the key it verifies
tokens against, and the counter store for rate limits. Each has a fail-open / fail-closed
decision that must be made on purpose:

| Dependency down | Fail closed | Fail open |
|---|---|---|
| public key for token verification | every request 401 — an outage | serve with the cached key; keys rotate slowly, so a cached key is correct for hours |
| rate-limit counter store | every request 429 — an outage caused by the limiter | admit everything — the services take full load; acceptable if they can shed themselves |
| routing configuration store | the last known routes | the last known routes — routing config is loaded, not fetched per request |

The senior sentence: *"the gateway fails open on the counter store and caches the verification
key, so its own dependencies cannot take the site down; the one thing it must never do is
forward an unverified identity header."*

**Its configuration is wrong.** A routing rule, a limit, a body-size cap — deployed like
infrastructure, breaks like code. Routing config is versioned, reviewed, canaried on one replica
and covered by a synthetic check per route, exactly as [phase 1](../phase-1-the-method/14-evolution-and-operations.md)
treats a deploy.

## The gateway as a bottleneck

Every request costs the gateway a TLS decrypt, a parse, a token verification and a counter
increment, and at a thousand requests a second none of that is a concern; at a hundred thousand
it is a fleet. Two things keep it cheap: local token verification (no network call) and a
counter store that batches — approximate counting, per-replica local buckets synchronised to
the store every second — rather than a round trip per request. A gateway that calls an auth
service *and* a counter store *and* a config service per request has put three same-region
round trips (half a millisecond each) in front of every service call, and it is the slowest box
on the diagram.

## The storefront's gateway

Written out, because the round asks "what does it do?":

```text
routes
  /api/catalogue/**   → catalogue service      auth: optional     rate: 100/s per IP     cache: 60 s for anonymous GET
  /api/cart/**        → cart service           auth: session      rate: 20/s per user
  /api/orders/**      → order service          auth: required     rate: 5/s per user     body ≤ 64 KB   Idempotency-Key required on POST
  /api/admin/**       → admin service          auth: required, role=admin; mTLS from the admin network only
  /webhooks/payment   → payment adapter        auth: provider signature; rate: 1000/s per provider IP range
  /static/**          → CDN only — never reaches the gateway

policy
  TLS terminated here; re-encrypted to services over the private network
  token verified locally against the cached JWKS (refresh hourly; fail open on stale key)
  identity forwarded as X-User-Id; services reachable only from the gateway's network
  429 with Retry-After on per-user limits; 503 with Retry-After when shedding for overload
  sale-day admission: /api/orders POST behind a queue when the inventory service reports pressure
  request ID assigned; one access log line per request with route, status, latency
  gzip/brotli on responses over 1 KB
```

The one route worth a sentence is the webhook: the provider's callback arrives at the gateway
like any request, is authenticated by the provider's signature rather than a user token, and
is rate-limited generously per the provider's address range — because a limiter tuned for users
would reject a burst of legitimate payment confirmations.

## Gotchas

**★ Symptom: a service trusts `X-User-Id` and a client sets it directly.** Cause: identity
forwarded as a header without network isolation. Fix: services reachable only from the gateway,
or forward the token and verify the signature locally against the cached key.

**★ Symptom: the rate limiter's Redis died and the whole site returned 429.** Cause: fail-closed
on the counter store. Fix: fail open — admit and log — and let services shed; a limiter must not
be the outage.

**★ Symptom: "what does the gateway do?" answered with "routing".** Cause: one job of seven.
Fix: routing, TLS, auth offload, rate limits, compression, request shaping, observability — and
what each takes off the services.

**Symptom: 429 responses cached by the CDN and served to everyone.** Cause: RFC 6585's *MUST
NOT be stored* ignored, or a cache that does not know it. Fix: explicit `Cache-Control:
no-store` on 429s; verify the CDN honours it.

**Symptom: overload returned as 429.** Cause: shedding conflated with limiting. Fix: 503 with
`Retry-After` for "we cannot serve", 429 for "you asked too much"; clients back off differently.

**Symptom: the gateway calls the auth service on every request.** Cause: verification treated as
a lookup. Fix: local signature verification against a cached public key; the auth service is
called at login, not per request.

**Symptom: an auth-key rotation caused an hour of 401s.** Cause: the cached key not refreshed,
and fail-closed. Fix: refresh on a schedule and on an unknown key ID; keep the previous key valid
through the rotation window.

**Symptom: the payment webhook rate-limited during a sale.** Cause: the user limiter applied to
the provider. Fix: a separate route with signature auth and a limit sized for the provider's
burst.

**Symptom: a routing change broke checkout and no alert fired.** Cause: gateway config deployed
without checks. Fix: versioned, reviewed, canaried; a synthetic request per route.

**Symptom: the gateway is the slowest box.** Cause: three round trips per request — auth
service, counter store, config store. Fix: local verification, batched counters, loaded
configuration; the gateway's per-request work should be CPU only.

## Interview questions

**★ What is an API gateway, and what does it take off the services?**
A reverse proxy that enforces cross-cutting policy once, at the edge: routing by path and host,
TLS termination, authentication offload with the identity forwarded, rate limiting with the
429 contract, compression, request shaping — size and header limits, malformed-request
rejection — and observability with one request ID and one access log. Each of those is code
every service would otherwise carry and could forget; the gateway makes them uniform. The price
is a single policy point that is also a single point of failure and that sees every request in
plaintext.

**★ The gateway verified the token and forwarded the user ID as a header. What can go wrong?**
Any client that can reach a service directly and set that header is authenticated as anyone.
The fix is one of two: make services reachable only from the gateway — network policy, mutual
TLS, a private network — or forward the token itself and have services verify the signature
locally against the same cached public key, which costs a signature check and no round trip and
survives a misconfigured network.

**★ How does a gateway fail, and what do you do about each?**
It dies: stateless replicas behind a network balancer, drained on deploy, with rate-limit state
in a store. Its dependencies die: fail open on the counter store — admit and log — and cache the
token-verification key so key-service outages and rotations do not become 401 storms; the one
thing never done is forwarding an unverified identity. Its configuration is wrong: routing rules
are versioned, reviewed, canaried and covered by a synthetic check per route, because a wrong
route is an outage the health checks cannot see.

**What is the difference between 429 and 503, and why does it matter?**
RFC 6585's 429 says the user has sent too many requests — a per-client limit; RFC 9110's 503
says the server is currently unable to handle the request — overload or shedding. Both may
carry Retry-After. It matters because clients back off differently: a 429 is the client's
fault and its own retries should slow; a 503 is the server's condition and every client should
back off with jitter. Returning 429 for overload tells each client it is the problem and hides
the outage; and 429s must not be cached, which a CDN needs to be told.

**Why verify tokens at the gateway rather than in each service — and what must be true for
that to be safe?**
Because it is done once, uniformly, with no service able to forget it, and because a local
signature check against a cached public key costs microseconds and no network call. It is safe
only if services trust nothing a client could have set: either they are unreachable except
through the gateway, or they re-verify the forwarded token themselves. The key is cached with a
refresh on schedule and on an unknown key ID, and the previous key stays valid through
rotation, so a key-service outage or a rotation never becomes an authentication outage.

**Where does sale-day admission live, and why there?**
At the gateway, on the checkout route: it is the earliest hop that knows the user and the
route, it is stateless so any replica can enforce the policy, and rejecting or queueing there
means the order service and the inventory row never see the excess. The admission state — how
many are being let through, the wait queue — lives in a store, not the gateway, so that gateway
replicas can die and be replaced without losing it.

---

← Prev: [02 · Load balancing, layer 4 vs layer 7](02-load-balancing-layer-4-vs-layer-7.md) · Index: [Phase 2 — The request path](README.md) · Next → **Stateless services, and where the state went** *(not written yet)*
