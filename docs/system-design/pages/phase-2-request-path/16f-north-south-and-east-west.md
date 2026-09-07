---
title: "A gateway decides whether an untrusted request may enter the system at all; a mesh carries an already-admitted request between workloads that can prove who they are — they run the same proxy software and share half a feature list, which is why teams keep buying one to do the other's job, and neither substitutes for the other"
sidebar_label: "16f · North-south and east-west"
sidebar_position: 16.5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. **Method and common practice** — the gateway's responsibilities are the
> seven jobs of [03](03-reverse-proxies-and-api-gateways.md), described there as NGINX, Envoy,
> HAProxy and the cloud gateways implement them; ingress and egress gateways as mesh components,
> and the placement of each policy, are stated as common practice with no vendor defaults, no
> version numbers and no benchmark figures. The 429 and 503 contracts are
> [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §4 and
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15.6.4, quoted in full on
> [03](03-reverse-proxies-and-api-gateways.md) and [07](07-rate-limiting.md). **No sandbox run.**

**If you take one thing from this topic into an interview, take this distinction, because it is the
one that separates a candidate who has read about meshes from one who has placed a box on a
diagram and defended it.** North-south is traffic crossing the trust boundary: a browser, an app,
a partner's server — unknown, unauthenticated, possibly hostile — reaching your system. East-west
is traffic between your own workloads, each of which can prove what it is. The gateway of
[03](03-reverse-proxies-and-api-gateways.md) owns the first and the mesh owns the second, they
frequently run the identical proxy binary, and roughly half their feature lists overlap — which is
exactly why "we have a mesh, do we still need the gateway?" gets asked, and why the answer is yes.

## The two directions

| | North-south — the gateway ([03](03-reverse-proxies-and-api-gateways.md)) | East-west — the mesh ([16](16-service-mesh.md)) |
|---|---|---|
| The traffic | client → system, across the trust boundary | service → service, inside it |
| The caller | unknown, untrusted, any client software, possibly hostile | a known workload holding a certificate |
| The identity that matters | the **user**, proven by a token | the **workload**, proven by a certificate ([16b](16b-mesh-mtls-and-workload-identity.md)) |
| Certificates | a public CA, a public name, trusted by browsers | the mesh's private root, short-lived, internal names |
| The threat | abuse, volumetric attack, malformed input, credential stuffing | fan-out amplification, partial failure, lateral movement after a compromise |
| Typical policy | user authn, rate limits by IP/key/user, WAF and bot rules, body-size and schema shaping, CORS, compression, the public routing table | mTLS, workload authorization, per-request balancing and locality, retries and timeouts, outlier ejection, traffic splitting |
| How many proxies | a handful of replicas | one per pod |
| Failure | its death is every *external* request's death | its death is every *internal call's* death — larger, not smaller |
| What it cannot see | anything that happens between services after admission | anything about the user, or anything that never entered |

The sentence worth memorising: **a gateway decides whether an untrusted request may enter the
system at all; a mesh carries an already-admitted request between workloads that can prove who they
are.**

## Why the confusion is structural

It is not carelessness. Three real facts make it easy:

1. **They are often the same software.** The same proxy is deployed as an edge gateway and as a
   sidecar; the feature list is nearly identical because it is nearly the same program.
2. **Half the features genuinely overlap.** Both terminate TLS, route, retry, time out, balance and
   emit telemetry. The overlapping half is where the confusion lives; the non-overlapping half is
   where the decision lives.
3. **Mesh distributions ship an "ingress gateway".** It is a gateway *operated by the mesh's
   control plane*, and it is genuinely convenient — one configuration language, and its hop to the
   services behind it gets mTLS for free. It is not the mesh doing the gateway's job: that
   component still has to do all seven jobs of [03](03-reverse-proxies-and-api-gateways.md), and
   being inside a mesh gets it none of them.

## Where each policy belongs

| Policy | Gateway | Mesh | Both, deliberately? |
|---|---|---|---|
| **User authentication** | yes — verify the token once | no — it authenticates workloads, not people | the mesh can additionally require the peer to *be* the gateway ([16b](16b-mesh-mtls-and-workload-identity.md)) |
| **User authorization** | coarse (this token may reach this route) | no | fine-grained ("buyer 42 may read order 7") stays in the service, always |
| **Rate limiting** | yes — per IP, per key, per user, returning 429 with `Retry-After` | not really: a per-upstream concurrency cap bounds *load*, not a *user* | yes: edge IP shield, gateway per-user limit, mesh concurrency cap — three different jobs ([07](07-rate-limiting.md)) |
| **TLS from a public CA** | yes | no — internal, short-lived, private root | the two meet at the gateway's outbound hop |
| **WAF, bot rules, challenge pages** | yes | no — it has no notion of a hostile browser | no |
| **Body size and schema shaping** | yes | no | no |
| **Compression** | yes, for clients over the internet | rarely worth the CPU internally | no |
| **Routing** | public paths → services | service → service, by subset and identity | different routing tables, different lifecycles |
| **Mutual TLS between hops** | it is one hop; everything behind it is flat without a mesh | yes, every internal hop | this is the mesh's non-overlapping half |
| **Per-request balancing and locality** | for its own upstreams | for every internal hop | no |
| **Retries and timeouts** | for the client-facing hop | for internal hops | **never both on the same hop** ([16c](16c-mesh-retries-timeouts-and-circuit-breaking.md)) |
| **Canary** | by user, sticky for a session | by service, per request ([16d](16d-mesh-traffic-splitting-and-canaries.md)) | user-facing A/B belongs at the gateway |
| **Telemetry** | per public route | per internal hop | both, joined by the gateway's request ID |

Reading the "Both, deliberately?" column top to bottom is the actual answer to "where do I put
this": three rows are defence in depth, one row is a hard *never*, and the rest are single-owner.

## What each genuinely cannot do for the other

- **A gateway cannot secure the inside.** It is one hop. Behind it, forty services on a flat
  network is the pre-mesh threat model of [16b](16b-mesh-mtls-and-workload-identity.md), and no
  amount of gateway policy changes it.
- **A gateway cannot see service-to-service traffic.** It is not on that path, so retries, tails
  and partial failures between services are invisible to it.
- **A mesh cannot decide whether an anonymous flood should be admitted.** It has no notion of a
  user, no WAF, no challenge page, and its per-workload identity means nothing to a browser. When a
  mesh's ingress gateway does this, it is being a gateway.
- **A mesh does not remove the need for one public entry point** with one public certificate, one
  routing table, one rate limiter and one access log — the coherence argument of
  [03](03-reverse-proxies-and-api-gateways.md).

## Egress: the third role nobody draws

Calls *leaving* the system — the payment provider, the email gateway — are neither north-south nor
east-west, and a deliberate exit point earns its place for four reasons: the destination is pinned
in one configuration rather than in five services' environment variables; the provider's credentials
live in one place; a rate limit against the provider's quota can be enforced once, for the whole
fleet; and there is one place that knows what left the system, which is what a corporate firewall
allowlist and most audits actually want.

Its cost is the usual one: an egress gateway is a new single point of failure on every external
call, so it needs replicas, health checks and a plan for what happens when it is unavailable —
exactly the failure walk of
[phase 1](../phase-1-the-method/11-bottlenecks-and-single-points-of-failure.md), applied to the box
you just added to save configuration.

## The storefront

```text
browser → CDN → gateway     NORTH-SOUTH: public TLS, user token verified once, per-IP and per-user rate limits
                            with 429 + Retry-After, body limits, WAF, the public routing table, the request ID
gateway → services          the boundary: the gateway forwards the identity, and the mesh makes that safe by
                            requiring the peer identity to be the gateway's
orders ↔ inventory ↔ cart   EAST-WEST: mTLS, workload authorization, per-request balancing, retries and timeouts
                            owned here and nowhere else, outlier ejection, per-hop telemetry
orders → payment provider   EGRESS: one exit point, credentials in one place, a fleet-wide limit against the
                            provider's quota, and one log of what left — with replicas, because it is now on
                            the critical path of every payment
user-facing A/B             at the gateway, sticky on the session cookie — never a mesh weight, which is
                            per request and knows nothing about the shopper
rate limiting               three layers doing three jobs: the CDN's volumetric IP shield, the gateway's
                            per-user limit, the mesh's per-upstream concurrency cap
```

## Gotchas

**★ Symptom: "we have a mesh, so we removed the API gateway."** Cause: treating the overlapping
half of the feature lists as the whole list. Fix: something must still verify user tokens, rate-limit
by IP and user, run WAF rules, cap body sizes and hold the public certificate — the mesh's ingress
gateway can be that something, but only by doing all seven jobs of
[03](03-reverse-proxies-and-api-gateways.md); being inside a mesh gets it none of them.

**★ Symptom: user authorization drifted into mesh policy and nobody can explain who may do what.**
Cause: mesh authorization is per workload and looks like access control, so user rules get written
against it. Fix: user identity is verified at the gateway and enforced in the service; the mesh's
policy says which *service* may call which *service*. The two compose and never substitute.

**★ Symptom: a hop is retried by both the gateway and the sidecar in front of the same service.**
Cause: two boxes with retry features and no owner assigned per hop. Fix: assign retry ownership per
hop explicitly — the mesh for internal hops, the client for the browser hop — and turn the other
off, because the multiplication of [16c](16c-mesh-retries-timeouts-and-circuit-breaking.md) does not
care which layer is which.

**Symptom: an abusive user was not stopped, despite per-service concurrency caps in the mesh.**
Cause: a concurrency cap bounds load, not a user; the mesh has no idea who is asking. Fix: per-user
and per-key limits stay at the gateway with 429 and `Retry-After`; the mesh's cap is a bulkhead, not
a rate limiter, and the two are different controls ([07](07-rate-limiting.md)).

**Symptom: a mesh ingress gateway was exposed with no body-size limit, no WAF and no bot rules.**
Cause: "the mesh handles ingress" read as "the mesh handles the internet". Fix: treat the ingress
gateway as a gateway and configure the full policy set on it; the mesh contributes mTLS on its
outbound hop and nothing else.

**Symptom: the new egress gateway took the payment path down.** Cause: a single exit point added
for configuration hygiene, with no replicas and no plan for its own failure. Fix: replicas, health
checks and an explicit answer for "what happens when it is unavailable" before it carries payments —
it is a box on the failure walk like any other.

**Symptom: user-facing A/B behaviour was implemented as a mesh weight and shoppers saw both
variants.** Cause: mesh splitting is per request between services, with no notion of a session. Fix:
decide the bucket at the gateway or CDN where the session cookie lives, make it sticky, and pass the
bucket down as a header if inner services need it.

## Interview questions

**★ What is the difference between an API gateway and a service mesh?**
Direction and trust. A gateway sits on north-south traffic — clients crossing the trust boundary
into the system — and its job is to decide whether an untrusted request may enter at all: verify the
user's token, rate-limit by IP and user, run WAF and bot rules, cap body sizes, hold the public
certificate, route to the right service and assign the request ID. A mesh sits on east-west traffic
— your own workloads calling each other — and its job is to carry an already-admitted request
between workloads that can prove who they are: mutual TLS with per-workload identity, authorization
between services, per-request balancing and locality, retries and timeouts, outlier ejection and
traffic splitting. They run the same proxy software and overlap on TLS, routing, retries and
telemetry, which is why they get confused; the non-overlapping halves are the point. The gateway
cannot secure the inside, because it is one hop and everything behind it is flat. The mesh cannot
decide whether an anonymous flood should be admitted, because it has no notion of a user.

**★ We have a mesh. Do we still need a gateway?**
Yes, or something doing the gateway's job. Verifying the user's token, limiting by IP and user,
running WAF and bot rules, capping request bodies, holding the public certificate and publishing one
routing table are all north-south concerns the mesh has no mechanism for — its identity model is
workloads, and a browser has no workload identity. The mesh's own ingress gateway is a perfectly
good place to do it, and it is convenient because it is configured in the same language and gets
mTLS on its hop to the services behind it; but it is a gateway, and it needs all seven of the
gateway's jobs configured on it. What the mesh does change is one specific thing: the gateway
forwards a user identity header, and the mesh lets the services require the caller to *be* the
gateway, so that forwarded header stops being trustworthy-by-network-configuration and becomes
trustworthy-by-certificate.

**★ You have both. Where do you enforce rate limiting?**
In three places doing three different jobs. The CDN or edge enforces a volumetric per-IP shield
that absorbs floods before they reach you. The gateway enforces the real limits, per user and per
API key, returning 429 with `Retry-After` — that is where identity exists, so that is where a
per-user limit is possible at all. The mesh enforces per-upstream concurrency and pending-request
caps, which is a *bulkhead* and not a rate limit: it bounds how much load one caller's proxy will
put on one dependency, and it knows nothing about who is asking. The mistake is treating the third
as a substitute for the second — a concurrency cap will not stop one abusive account, and a per-user
limit will not stop a slow dependency absorbing every worker.

**What is an egress gateway for, and what does it cost?**
It is the deliberate exit point for calls leaving the system. It buys four things: the external
destination is pinned in one configuration rather than in five services' environment variables; the
provider's credentials live in one place; a fleet-wide rate limit against the provider's quota is
enforceable at all; and one component knows what left the system, which is what firewall allowlists
and audits want. It costs a new single point of failure on every external call, so it needs
replicas, health checks and an explicit answer for its own unavailability before it carries
payments. It is also the third direction people forget when drawing the diagram — north-south in,
east-west across, and egress out.

**Which of the gateway's seven jobs does a mesh take over?**
Essentially none of them, and the honest answer says so. Routing, user authentication, rate
limiting, request shaping, compression and the public TLS certificate are north-south concerns and
stay at the gateway. Observability is the one genuine overlap: the mesh adds per-internal-hop
telemetry that the gateway could never see, joined to the gateway's records by the request ID. What
a mesh adds is a different list entirely — mutual TLS on every internal hop, workload authorization,
per-request internal balancing, uniform internal retries and timeouts, and traffic splitting between
services. If a mesh appears to remove a gateway job, check whether the job is simply not being done
any more.

← Prev: [16e · What a mesh costs](16e-what-a-service-mesh-costs.md) · Index: [Phase 2 — The request path](README.md) · Next → [16g · When a mesh earns its cost](16g-when-a-mesh-earns-its-cost.md)
